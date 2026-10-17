import { motion, useAnimationControls } from 'framer-motion'
import { Heart, Lock, Skull, Swords, Timer } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Banner, ModeHeader } from '@/components/ModeHeader'
import { ResultsView } from '@/components/ResultsView'
import { TypingSurface } from '@/components/TypingSurface'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Segmented } from '@/components/ui/segmented'
import { generateText } from '@/engine/textGen'
import type { Category, Difficulty } from '@/engine/types'
import { useTypingSession } from '@/engine/useTypingSession'
import { useStore, type RecordOutcome } from '@/game/store'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useSound } from '@/hooks/useSound'
import { cn, mulberry32 } from '@/lib/utils'

type BossDifficulty = 'easy' | 'normal' | 'hard' | 'nightmare'

const BOSS_DIFF: Record<BossDifficulty, { label: string; speed: number; damage: number; text: Difficulty; mult: number }> = {
  easy: { label: 'Easy', speed: 0.75, damage: 4, text: 'easy', mult: 0.8 },
  normal: { label: 'Normal', speed: 1, damage: 6, text: 'medium', mult: 1 },
  hard: { label: 'Hard', speed: 1.25, damage: 8, text: 'hard', mult: 1.3 },
  nightmare: { label: 'Nightmare', speed: 1.5, damage: 12, text: 'expert', mult: 1.7 },
}

interface Boss {
  stage: number
  name: string
  title: string
  words: number
  baseWpm: number
  category: Exclude<Category, 'custom'>
}

const BOSSES: Boss[] = [
  { stage: 1, name: 'Typo Slime', title: 'It feeds on misspelled words.', words: 15, baseWpm: 25, category: 'common' },
  { stage: 2, name: 'Grammar Golem', title: 'Slow, stubborn, and very heavy.', words: 25, baseWpm: 30, category: 'common' },
  { stage: 3, name: 'Syntax Serpent', title: 'Speaks only in keywords.', words: 25, baseWpm: 35, category: 'programming' },
  { stage: 4, name: 'Quote Wraith', title: 'Haunts you with famous last words.', words: 35, baseWpm: 40, category: 'quotes' },
  { stage: 5, name: 'The Keylord', title: 'Master of every key on the board.', words: 45, baseWpm: 45, category: 'technology' },
]

const MAX_HP = 100

export function BossBattlePage() {
  const { progress, settings, recordResult } = useStore()
  const sound = useSound()
  const [diff, setDiff] = useState<BossDifficulty>('normal')
  const cleared = progress.boss[diff] ?? 0
  const [stage, setStage] = useState(() => Math.min(5, cleared + 1))
  const [fighting, setFighting] = useState(false)
  const [hp, setHp] = useState(MAX_HP)
  const hpRef = useRef(MAX_HP)
  const [text, setText] = useState('')
  const [limitMs, setLimitMs] = useState(60000)
  const [outcome, setOutcome] = useState<RecordOutcome | null>(null)
  const shake = useAnimationControls()
  const rng = useRef(mulberry32((Math.random() * 2 ** 32) >>> 0))
  const boss = BOSSES[stage - 1]
  const cfg = BOSS_DIFF[diff]
  const targetWpm = Math.round(boss.baseWpm * cfg.speed)

  useEffect(() => {
    setStage(Math.min(5, (progress.boss[diff] ?? 0) + 1))
  }, [diff]) // eslint-disable-line react-hooks/exhaustive-deps

  const session = useTypingSession({
    text,
    timeLimitMs: limitMs,
    pausable: false,
    behavior: { allowBackspace: true, stopOnError: false, autoIndent: false },
    onKeystroke: (k) => {
      if (k.kind !== 'char') return
      if (k.correct) sound.key(true)
      else {
        sound.hit()
        hpRef.current = Math.max(0, hpRef.current - cfg.damage)
        setHp(hpRef.current)
        void shake.start({ x: [0, -5, 5, -3, 0], transition: { duration: 0.25 } })
        if (hpRef.current <= 0) session.finish('failed')
      }
    },
    onFinish: (summary) => {
      const won = summary.reason === 'complete' && hpRef.current > 0
      const out = recordResult({
        // Running out of time or health is a loss, which never counts as a finished run.
        summary: { ...summary, completed: won },
        mode: 'boss',
        config: { length: { kind: 'words', value: boss.words as 25 }, difficulty: cfg.text, category: boss.category, variant: `${diff}-${stage}` },
        meta: { won, stage, bossDifficulty: diff, hpLeft: hpRef.current, reason: won ? 'victory' : hpRef.current <= 0 ? 'health' : 'time' },
        bossCleared: won ? { difficulty: diff, stage } : undefined,
        modeXp: (_r, firstTime) => (won ? { amount: firstTime ? Math.round(40 * stage * cfg.mult) : 10, reason: firstTime ? `Defeated ${boss.name}` : 'Boss rematch' } : null),
      })
      if (won) sound.success()
      setOutcome(out)
    },
  })

  const fight = useCallback(() => {
    const t = generateText(boss.words, { difficulty: cfg.text, category: boss.category, language: 'english' }, rng.current)
    // Timer: time to type the passage at the boss's target speed, plus a short grace period.
    const limit = Math.round((t.length / 5 / targetWpm) * 60000 + 3000)
    hpRef.current = MAX_HP
    setHp(MAX_HP)
    setLimitMs(limit)
    setText(t)
    session.reset(t)
    setOutcome(null)
    setFighting(true)
  }, [boss, cfg.text, targetWpm, session])

  const nextStage = () => {
    if (outcome?.result.meta?.won && stage < 5) setStage(stage + 1)
    setFighting(false)
    setOutcome(null)
  }
  useShortcuts(
    {
      Escape: () => fighting && !outcome && setFighting(false),
      [settings.restartKey === 'tab' ? 'Tab' : 'Shift+Enter']: () => (outcome ? nextStage() : false),
    },
    fighting,
  )

  const bossHpFrac = 1 - session.engine.net / Math.max(1, session.engine.target.length)
  const remaining = session.remainingMs ?? limitMs
  const won = !!outcome?.result.meta?.won

  if (!fighting) {
    return (
      <div className="flex flex-col gap-6">
        <ModeHeader
          icon={Swords}
          title="Boss Battle"
          description="Type the boss’s passage before its timer runs out. Each mistake costs health. Clear a stage to unlock the next."
          right={<Segmented label="Boss difficulty" value={diff} onChange={setDiff} options={(Object.keys(BOSS_DIFF) as BossDifficulty[]).map((d) => ({ value: d, label: BOSS_DIFF[d].label }))} />}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {BOSSES.map((b) => {
            const locked = b.stage > cleared + 1
            const beaten = b.stage <= cleared
            const active = b.stage === stage
            return (
              <button
                key={b.stage}
                type="button"
                disabled={locked}
                onClick={() => setStage(b.stage)}
                className={cn(
                  'flex flex-col rounded-card border p-4 text-left transition-colors',
                  active ? 'border-accent-text/60 bg-accent-soft' : 'border-border bg-surface hover:bg-surface-2',
                  locked && 'cursor-not-allowed opacity-50',
                )}
              >
                <div className="flex items-center justify-between text-xs text-muted">
                  Stage {b.stage}
                  {locked ? <Lock className="size-3.5" /> : beaten ? <Badge variant="accent">Cleared</Badge> : null}
                </div>
                <div className="mt-3 font-medium">{b.name}</div>
                <div className="mt-1 text-xs text-muted">{b.title}</div>
                <div className="mt-3 text-xs tabular-nums text-subtle">
                  {b.words} words · {Math.round(b.baseWpm * cfg.speed)} WPM pace
                </div>
              </button>
            )
          })}
        </div>
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <Skull className="size-8 text-accent-text" />
          <div>
            <div className="text-lg font-semibold">{boss.name}</div>
            <p className="text-sm text-muted">
              {boss.words} {boss.category} words at {cfg.label} · beat a {targetWpm} WPM pace · each mistake costs {cfg.damage} HP
            </p>
          </div>
          <Button variant="primary" size="lg" onClick={fight}>
            <Swords /> Fight
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <ModeHeader icon={Swords} title={`Stage ${stage}: ${boss.name}`} description={`${cfg.label} · ${targetWpm} WPM pace. The timer starts on your first keystroke.`} />

      <motion.div animate={shake}>
        <Card className="grid gap-4 p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted">
                <Heart className="size-3.5" /> You
              </span>
              <span className="tabular-nums">{hp} HP</span>
            </div>
            <Progress value={hp} barClassName={hp <= 30 ? 'bg-danger' : 'bg-accent'} label="Your health" />
          </div>
          <div className={cn('flex items-center justify-center gap-1.5 font-mono text-2xl tabular-nums', remaining < 5000 && session.status === 'running' && 'text-danger')}>
            <Timer className="size-5 text-muted" />
            {(remaining / 1000).toFixed(1)}s
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted">
                <Skull className="size-3.5" /> {boss.name}
              </span>
              <span className="tabular-nums">{Math.round(bossHpFrac * 100)}%</span>
            </div>
            <Progress value={bossHpFrac * 100} barClassName="bg-danger" label="Boss health" />
          </div>
        </Card>
      </motion.div>

      {outcome ? (
        <ResultsView
          outcome={outcome}
          onRestart={fight}
          restartLabel={won ? 'Fight again' : 'Retry'}
          onNext={nextStage}
          nextShortcut
          nextLabel={won && stage < 5 ? 'Next stage' : 'Back to bosses'}
          header={
            won ? (
              <Banner tone="win" title={`${boss.name} defeated!`}>
                Finished with {hp} HP and {(remaining / 1000).toFixed(1)}s to spare.
                {stage === 5 ? ' You cleared every stage on ' + cfg.label + '.' : ' The next stage is unlocked.'}
              </Banner>
            ) : (
              <Banner tone="lose" title="Defeated">
                {outcome.result.meta?.reason === 'health' ? 'You ran out of health. Slow down a little and protect your accuracy.' : 'The boss timer ran out. Push the pace a little harder.'}
              </Banner>
            )
          }
        />
      ) : (
        <>
          <TypingSurface session={session} />
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={() => setFighting(false)}>
              Retreat (Esc)
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
