import { Crosshair, Flame, RefreshCw } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Banner, ModeHeader } from '@/components/ModeHeader'
import { ResultsView } from '@/components/ResultsView'
import { Stat } from '@/components/LiveStats'
import { TypingSurface } from '@/components/TypingSurface'
import { Button } from '@/components/ui/button'
import { generateText } from '@/engine/textGen'
import { useTypingSession } from '@/engine/useTypingSession'
import { useStore, type RecordOutcome } from '@/game/store'
import { focusIsNeutral, useShortcuts } from '@/hooks/useShortcuts'
import { useSound } from '@/hooks/useSound'
import { mulberry32 } from '@/lib/utils'

const WORDS = 30
const PENALTY = 15

/** Multiplier grows by 1 for every 20 clean characters in a row, up to ×5. */
export const multiplier = (streak: number) => Math.min(5, 1 + Math.floor(streak / 20))

function grade(acc: number) {
  if (acc >= 99.5) return 'S'
  if (acc >= 98) return 'A'
  if (acc >= 95) return 'B'
  if (acc >= 90) return 'C'
  return 'D'
}

export function PrecisionPage() {
  const { settings, results, recordResult } = useStore()
  const sound = useSound()
  const rng = useRef(mulberry32((Math.random() * 2 ** 32) >>> 0))
  const textOpts = useMemo(
    () => ({ difficulty: settings.difficulty, category: settings.category === 'custom' ? ('common' as const) : settings.category, language: settings.language }),
    [settings.difficulty, settings.category, settings.language],
  )
  const makeText = useCallback(() => generateText(WORDS, textOpts, rng.current), [textOpts])
  const [text, setText] = useState(makeText)
  const [score, setScore] = useState(0)
  const scoreRef = useRef(0)
  const [outcome, setOutcome] = useState<RecordOutcome | null>(null)
  const bestScore = results.filter((r) => r.mode === 'precision' && r.valid).reduce((m, r) => Math.max(m, Number(r.meta?.score ?? 0)), 0)

  const session = useTypingSession({
    text,
    // Precision always stops on errors: you must type the right key to move on.
    behavior: { allowBackspace: false, stopOnError: true, autoIndent: false },
    onKeystroke: (k) => {
      if (k.kind !== 'char') return
      sound.key(k.correct)
      scoreRef.current = k.correct ? scoreRef.current + multiplier(k.engine.streak - 1) * 10 : Math.max(0, scoreRef.current - PENALTY * 10)
      setScore(scoreRef.current)
    },
    onFinish: (summary) => {
      const s = scoreRef.current
      setOutcome(
        recordResult({
          summary,
          mode: 'precision',
          config: { difficulty: textOpts.difficulty, category: textOpts.category, language: textOpts.category === 'common' ? textOpts.language : undefined, variant: 'precision' },
          meta: { score: s, grade: grade(summary.accuracy) },
          modeXp: (r) => (r.accuracy >= 97 ? { amount: 20, reason: 'Precision bonus (97%+)' } : null),
        }),
      )
    },
  })

  const restart = () => {
    const t = makeText()
    setText(t)
    session.reset(t)
    scoreRef.current = 0
    setScore(0)
    setOutcome(null)
  }

  useShortcuts({
    [settings.restartKey === 'tab' ? 'Tab' : 'Shift+Enter']: (e) => {
      if (settings.restartKey === 'tab' && !focusIsNeutral(e) && !outcome) return false
      restart()
    },
    Escape: () => (session.status === 'paused' ? session.resume() : session.pause()),
  })

  const streak = session.engine.streak
  const mult = multiplier(streak)

  return (
    <div className="flex flex-col gap-6">
      <ModeHeader
        icon={Crosshair}
        title="Precision"
        description={`${WORDS} words. The cursor will not move past a wrong key. Clean characters score 10 × your multiplier; each mistake costs ${PENALTY * 10} points and resets your streak.`}
      />
      {outcome ? (
        <ResultsView
          outcome={outcome}
          onRestart={restart}
          restartLabel="New text"
          header={
            <Banner
              tone={outcome.result.accuracy >= 97 ? 'win' : outcome.result.accuracy >= 90 ? 'neutral' : 'lose'}
              title={`Grade ${outcome.result.meta?.grade} · ${Number(outcome.result.meta?.score).toLocaleString()} points`}
            >
              Longest clean streak: {outcome.result.meta?.bestStreak} characters.{' '}
              {Number(outcome.result.meta?.score) > bestScore && outcome.result.valid ? 'New best score!' : bestScore ? `Best score: ${bestScore.toLocaleString()}.` : ''}
            </Banner>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <Stat label="score" value={score.toLocaleString()} accent />
              <Stat label="accuracy" value={`${session.live.accuracy.toFixed(1)}%`} />
              <Stat label="streak" value={streak} />
              <Stat label="multiplier" value={`×${mult}`} />
              <Stat label="errors" value={session.live.errors} />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted" aria-label={`Next multiplier in ${mult < 5 ? 20 - (streak % 20) : 0} characters`}>
                <Flame className="size-3.5 text-accent-text" />
                {mult < 5 ? `${20 - (streak % 20)} to ×${mult + 1}` : 'Max multiplier'}
              </div>
              <Button variant="ghost" size="sm" onClick={restart}>
                <RefreshCw /> New text
              </Button>
            </div>
          </div>
          <TypingSurface session={session} />
        </>
      )}
    </div>
  )
}
