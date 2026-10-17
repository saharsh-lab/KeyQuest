import { Flag, Ghost, Play, User } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { LiveStats } from '@/components/LiveStats'
import { Banner, ModeHeader } from '@/components/ModeHeader'
import { ResultsView } from '@/components/ResultsView'
import { TypingSurface } from '@/components/TypingSurface'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { Slider } from '@/components/ui/slider'
import { timelineAt } from '@/engine/metrics'
import { generateText } from '@/engine/textGen'
import type { TestResult } from '@/engine/types'
import { useTypingSession } from '@/engine/useTypingSession'
import { ghostKey } from '@/game/storage'
import { useStore, type RecordOutcome } from '@/game/store'
import { navigate } from '@/hooks/useHashRoute'
import { focusIsNeutral, useShortcuts } from '@/hooks/useShortcuts'
import { useSound } from '@/hooks/useSound'
import { cn, formatDuration, mulberry32, relativeDay } from '@/lib/utils'

type Opponent = { kind: 'self' | 'player'; result: TestResult; name: string } | { kind: 'pacer'; wpm: number; name: string }

function Track({ label, icon: Icon, fraction, you }: { label: string; icon: typeof User; fraction: number; you?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 truncate text-sm text-muted sm:w-36">{label}</div>
      <div className="relative h-8 flex-1 rounded-lg bg-surface-2">
        <div className="absolute inset-y-0 right-2 flex items-center text-subtle">
          <Flag className="size-3.5" />
        </div>
        <div className="absolute inset-y-1 left-1 right-8">
          <div
            className={cn('absolute top-0 flex size-6 -translate-x-1/2 items-center justify-center rounded-md transition-[left] duration-100 ease-linear', you ? 'bg-accent text-accent-fg' : 'border border-dashed border-border-strong bg-surface-3 text-muted')}
            style={{ left: `${Math.min(1, fraction) * 100}%` }}
          >
            <Icon className="size-3.5" />
          </div>
        </div>
      </div>
      <div className="w-12 text-right text-xs tabular-nums text-muted">{Math.round(Math.min(1, fraction) * 100)}%</div>
    </div>
  )
}

export function GhostRacePage() {
  const { results, allResults, data, profile, settings, recordResult } = useStore()
  const sound = useSound()
  const [count, setCount] = useState<25 | 50>(25)
  const [pacerWpm, setPacerWpm] = useState(() => {
    const rs = results.filter((r) => r.valid).slice(-10)
    return rs.length ? Math.max(20, Math.round(rs.reduce((a, r) => a + r.wpm, 0) / rs.length / 5) * 5) : 40
  })

  // Ghost candidates: any finished word-count run with a replay, from this or other local players.
  const candidates = useMemo(() => {
    const key = `words:${count}`
    const withReplay = allResults.filter((r) => r.timeline && ghostKey(r) === key)
    const bestByProfile = new Map<string, TestResult>()
    for (const r of withReplay) {
      const cur = bestByProfile.get(r.profileId)
      if (!cur || r.wpm > cur.wpm) bestByProfile.set(r.profileId, r)
    }
    return bestByProfile
  }, [allResults, count])

  const self = candidates.get(profile.id)
  const others = data.profiles.filter((p) => p.id !== profile.id && candidates.has(p.id))
  // A specific run can be challenged from the leaderboard via #/play/ghost?run=<id>.
  const runParam = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('run')
  const challenged = runParam ? allResults.find((r) => r.id === runParam && r.timeline) : undefined
  const [choice, setChoice] = useState<string>(() => (challenged ? `run:${challenged.id}` : self ? 'self' : 'pacer'))

  const opponent: Opponent | null = useMemo(() => {
    if (choice.startsWith('run:') && challenged) {
      const owner = data.profiles.find((p) => p.id === challenged.profileId)?.name ?? 'Player'
      return { kind: challenged.profileId === profile.id ? 'self' : 'player', result: challenged, name: `${owner}’s ghost` }
    }
    if (choice === 'self' && self) return { kind: 'self', result: self, name: 'Your best' }
    if (choice.startsWith('p:')) {
      const id = choice.slice(2)
      const r = candidates.get(id)
      const name = data.profiles.find((p) => p.id === id)?.name ?? 'Player'
      if (r) return { kind: 'player', result: r, name: `${name}’s ghost` }
    }
    return { kind: 'pacer', wpm: pacerWpm, name: `Pacer ${pacerWpm} WPM` }
  }, [choice, self, candidates, data.profiles, pacerWpm, challenged, profile.id])

  const raceCount = opponent && opponent.kind !== 'pacer' && opponent.result.config.length?.kind === 'words' ? (opponent.result.config.length.value as 25 | 50) : count
  const rng = useRef(mulberry32((Math.random() * 2 ** 32) >>> 0))
  const textOpts = { difficulty: settings.difficulty, category: settings.category === 'custom' ? ('common' as const) : settings.category, language: settings.language }
  const makeText = useCallback(() => generateText(raceCount, textOpts, rng.current), [raceCount, textOpts.difficulty, textOpts.category, textOpts.language]) // eslint-disable-line react-hooks/exhaustive-deps
  const [racing, setRacing] = useState(false)
  const [text, setText] = useState('')
  const [outcome, setOutcome] = useState<RecordOutcome | null>(null)
  const opponentRef = useRef(opponent)
  const [racingAgainst, setRacingAgainst] = useState<Opponent | null>(null)

  const ghostFinishMs = (o: Opponent, totalChars: number) => (o.kind === 'pacer' ? (totalChars / 5 / o.wpm) * 60000 : o.result.durationMs)

  const session = useTypingSession({
    text,
    behavior: { allowBackspace: settings.allowBackspace, stopOnError: settings.stopOnError, autoIndent: false },
    pausable: false,
    onKeystroke: (k) => k.kind === 'char' && sound.key(k.correct),
    onFinish: (summary) => {
      const o = opponentRef.current!
      const ghostMs = ghostFinishMs(o, summary.totalChars)
      const won = summary.reason === 'complete' && summary.durationMs < ghostMs
      const margin = Math.abs(ghostMs - summary.durationMs)
      const out = recordResult({
        summary,
        mode: 'ghost',
        config: { length: { kind: 'words', value: raceCount }, difficulty: textOpts.difficulty, category: textOpts.category, language: textOpts.category === 'common' ? textOpts.language : undefined },
        meta: { won, opponent: o.kind, opponentName: o.name, opponentWpm: o.kind === 'pacer' ? o.wpm : Math.round(o.result.wpm), marginMs: Math.round(margin) },
        modeXp: () => (won ? { amount: o.kind === 'pacer' ? 15 : 30, reason: 'Beat the ghost' } : null),
      })
      if (won) sound.success()
      setOutcome(out)
    },
  })

  const begin = () => {
    opponentRef.current = opponent
    setRacingAgainst(opponent)
    const t = makeText()
    setText(t)
    session.reset(t)
    setOutcome(null)
    setRacing(true)
  }

  useShortcuts(
    {
      [settings.restartKey === 'tab' ? 'Tab' : 'Shift+Enter']: (e) => {
        if (settings.restartKey === 'tab' && !focusIsNeutral(e) && !outcome) return false
        begin()
      },
    },
    racing,
  )

  // Ghost progress at the current moment of the player's run.
  const elapsed = session.elapsedMs
  const totalChars = session.engine.target.length
  let ghostFrac = 0
  const o = racingAgainst
  if (o && session.status !== 'idle') {
    if (o.kind === 'pacer') ghostFrac = (o.wpm * 5 * (elapsed / 60000)) / Math.max(1, totalChars)
    else ghostFrac = timelineAt(o.result.timeline ?? [], elapsed) / Math.max(1, o.result.totalChars)
  }
  const youFrac = session.engine.net / Math.max(1, totalChars)

  if (!racing) {
    return (
      <div className="flex flex-col gap-6">
        <ModeHeader icon={Ghost} title="Ghost Race" description="Race a replay of a real run. The ghost moves exactly as that run did, keystroke by keystroke." />
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Choose your opponent</CardTitle>
              <CardDescription>Ghosts come from finished word-count runs recorded on this device.</CardDescription>
            </div>
            {!challenged ? (
              <Segmented
                label="Race length"
                value={count}
                onChange={(v) => setCount(v)}
                options={[
                  { value: 25, label: '25 words' },
                  { value: 50, label: '50 words' },
                ]}
              />
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {challenged ? (
              <OpponentOption
                active={choice === `run:${challenged.id}`}
                onClick={() => setChoice(`run:${challenged.id}`)}
                title={`${data.profiles.find((p) => p.id === challenged.profileId)?.name ?? 'Player'}’s run from the leaderboard`}
                detail={`${Math.round(challenged.wpm)} WPM · ${challenged.accuracy.toFixed(1)}% · ${relativeDay(challenged.date)}`}
              />
            ) : null}
            <OpponentOption
              active={choice === 'self'}
              disabled={!self}
              onClick={() => setChoice('self')}
              title="Your personal best"
              detail={self ? `${Math.round(self.wpm)} WPM · ${formatDuration(self.durationMs)} · ${relativeDay(self.date)}` : `Finish a ${count}-word test in the Arena or here to create your ghost.`}
            />
            {others.map((p) => {
              const r = candidates.get(p.id)!
              return (
                <OpponentOption
                  key={p.id}
                  active={choice === `p:${p.id}`}
                  onClick={() => setChoice(`p:${p.id}`)}
                  title={`${p.name}’s best (local player)`}
                  detail={`${Math.round(r.wpm)} WPM · ${formatDuration(r.durationMs)}`}
                />
              )
            })}
            <OpponentOption active={choice === 'pacer'} onClick={() => setChoice('pacer')} title="Steady pacer" detail="A constant-speed marker, not a recording. Useful before you have a ghost.">
              {choice === 'pacer' ? (
                <div className="mt-3 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <Slider value={[pacerWpm]} min={15} max={160} step={5} onValueChange={([v]) => setPacerWpm(v)} aria-label="Pacer speed" className="max-w-64" />
                  <span className="w-16 text-sm tabular-nums">{pacerWpm} WPM</span>
                </div>
              ) : null}
            </OpponentOption>
          </CardContent>
        </Card>
        <div className="flex justify-center">
          <Button variant="primary" size="lg" onClick={begin}>
            <Play /> Start race vs {opponent?.name}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <ModeHeader icon={Ghost} title="Ghost Race" description={`${raceCount} words vs ${o?.name}. The race starts on your first keystroke.`} />
      <Card className="flex flex-col gap-2.5 p-4">
        <Track label="You" icon={User} fraction={youFrac} you />
        <Track label={o?.name ?? 'Ghost'} icon={Ghost} fraction={ghostFrac} />
      </Card>
      {outcome ? (
        <ResultsView
          outcome={outcome}
          onRestart={begin}
          restartLabel="Rematch"
          onNext={() => {
            setRacing(false)
            setOutcome(null)
            navigate('/play/ghost')
          }}
          nextLabel="Change opponent"
          header={
            outcome.result.meta?.won ? (
              <Banner tone="win" title={`You beat ${o?.name} by ${(Number(outcome.result.meta.marginMs) / 1000).toFixed(1)}s`}>
                {o?.kind === 'self' ? 'This run is now your fastest ghost if it set a new best.' : 'Nice racing.'}
              </Banner>
            ) : (
              <Banner tone="lose" title={`${o?.name} won`}>
                {outcome.result.completed ? `The ghost finished ${(Number(outcome.result.meta?.marginMs) / 1000).toFixed(1)}s ahead.` : 'Race not finished.'}
              </Banner>
            )
          }
        />
      ) : (
        <>
          <LiveStats session={session} />
          <TypingSurface session={session} ghostPos={ghostFrac * totalChars} />
          <div className="flex justify-center gap-2">
            <Button variant="ghost" size="sm" onClick={begin}>
              Restart race
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRacing(false)}>
              Change opponent
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function OpponentOption({ active, disabled, onClick, title, detail, children }: { active: boolean; disabled?: boolean; onClick: () => void; title: string; detail: string; children?: React.ReactNode }) {
  return (
    <div
      role="radio"
      aria-checked={active}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onClick()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'cursor-pointer rounded-lg border px-4 py-3 text-left transition-colors',
        active ? 'border-accent-text/60 bg-accent-soft' : 'border-border hover:bg-surface-2',
        disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
      )}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-0.5 text-xs text-muted">{detail}</div>
      {children}
    </div>
  )
}
