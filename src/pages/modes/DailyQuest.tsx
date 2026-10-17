import { Check, Map, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { LiveStats } from '@/components/LiveStats'
import { Banner, ModeHeader } from '@/components/ModeHeader'
import { ResultsView } from '@/components/ResultsView'
import { cap } from '@/components/TestOptions'
import { TypingSurface } from '@/components/TypingSurface'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { generateText } from '@/engine/textGen'
import { useTypingSession } from '@/engine/useTypingSession'
import { dailyQuest, lengthLabel } from '@/game/progression'
import { useStore, type RecordOutcome } from '@/game/store'
import { focusIsNeutral, useShortcuts } from '@/hooks/useShortcuts'
import { useSound } from '@/hooks/useSound'
import { cn, dayKey, hashString, mulberry32 } from '@/lib/utils'

function msUntilMidnight() {
  const n = new Date()
  const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1)
  return m.getTime() - n.getTime()
}

function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', ok ? 'text-accent-text' : 'text-muted')}>
      {ok ? <Check className="size-4" /> : <X className="size-4 text-danger" />}
      {label}
    </span>
  )
}

export function DailyQuestPage() {
  const { results, progress, settings, recordResult } = useStore()
  const sound = useSound()
  const today = dayKey()
  // Freeze today's quest when the page opens so the target cannot shift mid-attempt.
  const [quest] = useState(() => dailyQuest(results, today))
  const done = !!progress.dailyQuests[today]
  const attempt = useRef(0)
  const textOpts = useMemo(() => ({ difficulty: quest.difficulty, category: quest.category, language: 'english' as const }), [quest])
  const makeText = useCallback(() => {
    const rng = mulberry32(hashString(`quest-text:${today}:${attempt.current++}`))
    return generateText(quest.length.kind === 'words' ? quest.length.value : 60, textOpts, rng)
  }, [quest, textOpts, today])
  const rng = useRef(mulberry32(hashString(`quest-extend:${today}`)))
  const [text, setText] = useState(makeText)
  const [outcome, setOutcome] = useState<RecordOutcome | null>(null)

  const session = useTypingSession({
    text,
    timeLimitMs: quest.length.kind === 'time' ? quest.length.value * 1000 : undefined,
    extendText: quest.length.kind === 'time' ? () => ' ' + generateText(30, textOpts, rng.current) : undefined,
    behavior: { allowBackspace: settings.allowBackspace, stopOnError: settings.stopOnError, autoIndent: false },
    onKeystroke: (k) => k.kind === 'char' && sound.key(k.correct),
    onFinish: (summary) => {
      const o = recordResult({ summary, mode: 'daily', config: { length: quest.length, difficulty: quest.difficulty, category: quest.category, language: 'english', variant: today } })
      if (o.questCompleted) sound.success()
      setOutcome(o)
    },
  })

  const again = () => {
    const t = makeText()
    setText(t)
    session.reset(t)
    setOutcome(null)
  }

  useShortcuts({
    [settings.restartKey === 'tab' ? 'Tab' : 'Shift+Enter']: (e) => {
      if (settings.restartKey === 'tab' && !focusIsNeutral(e) && !outcome) return false
      again()
    },
    Escape: () => (session.status === 'paused' ? session.resume() : session.pause()),
  })

  const liveWpm = session.live.wpm
  const liveAcc = session.live.accuracy
  const started = session.status !== 'idle'
  const hours = Math.floor(msUntilMidnight() / 3600000)

  return (
    <div className="flex flex-col gap-6">
      <ModeHeader
        icon={Map}
        title={`Daily Quest: ${quest.title}`}
        description={`A new quest every day. Next one in about ${hours} ${hours === 1 ? 'hour' : 'hours'}.`}
        right={done ? <Badge variant="accent"><Check /> Completed today</Badge> : <Badge>+{quest.xp} XP on completion</Badge>}
      />

      {outcome ? (
        <ResultsView
          outcome={outcome}
          onRestart={again}
          restartLabel="Try again"
          header={
            outcome.questCompleted ? (
              <Banner tone="win" title="Quest complete">
                You hit {Math.round(outcome.result.wpm)} WPM at {outcome.result.accuracy.toFixed(1)}% accuracy. +{quest.xp} XP. Come back tomorrow for a new quest.
              </Banner>
            ) : done ? (
              <Banner tone="neutral" title="Practice run">
                Today’s quest is already complete, so this run earns regular XP only.
              </Banner>
            ) : (
              <Banner tone="lose" title="Not quite">
                <span className="flex flex-wrap gap-4 pt-1">
                  <Req ok={outcome.result.valid && outcome.result.wpm >= quest.targetWpm} label={`${Math.round(outcome.result.wpm)} / ${quest.targetWpm} WPM`} />
                  <Req ok={outcome.result.accuracy >= quest.minAccuracy} label={`${outcome.result.accuracy.toFixed(1)}% / ${quest.minAccuracy}% accuracy`} />
                </span>
              </Banner>
            )
          }
        />
      ) : (
        <>
          <Card className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
            {[
              ['Target speed', `${quest.targetWpm} WPM`],
              ['Min accuracy', `${quest.minAccuracy}%`],
              ['Text', `${cap(quest.category)} · ${cap(quest.difficulty)}`],
              ['Length', lengthLabel(quest.length)],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-xs text-muted">{k}</div>
                <div className="mt-0.5 font-medium">{v}</div>
              </div>
            ))}
          </Card>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <LiveStats session={session} />
            {started ? (
              <div className="flex gap-4">
                <Req ok={liveWpm >= quest.targetWpm} label="Speed on target" />
                <Req ok={liveAcc >= quest.minAccuracy} label="Accuracy on target" />
              </div>
            ) : (
              <span className="text-sm text-muted">Start typing to begin.</span>
            )}
          </div>
          <TypingSurface session={session} />
          <div className="flex justify-center gap-2">
            <Button variant="ghost" size="sm" onClick={again}>
              New attempt
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
