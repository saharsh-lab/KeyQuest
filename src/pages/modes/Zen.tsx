import { motion } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff, Leaf, Square, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TypingSurface } from '@/components/TypingSurface'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tooltip } from '@/components/ui/tooltip'
import { generateText } from '@/engine/textGen'
import { useTypingSession } from '@/engine/useTypingSession'
import { useStore, type RecordOutcome } from '@/game/store'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useSound } from '@/hooks/useSound'
import { startAmbient, stopAmbient } from '@/lib/sound'
import { formatDuration, mulberry32 } from '@/lib/utils'

const IDLE_PAUSE_MS = 4000
const MIN_SESSION_MS = 15000

export function ZenPage() {
  const { settings, updateSettings, recordResult } = useStore()
  const sound = useSound()
  const rng = useRef(mulberry32((Math.random() * 2 ** 32) >>> 0))
  const opts = useMemo(
    () => ({ difficulty: 'easy' as const, category: settings.category === 'custom' && !settings.customText ? ('common' as const) : settings.category, language: settings.language, customText: settings.customText }),
    [settings.category, settings.language, settings.customText],
  )
  const [text, setText] = useState(() => generateText(80, opts, rng.current))
  const [showStats, setShowStats] = useState(false)
  const [outcome, setOutcome] = useState<RecordOutcome | null>(null)
  const lastKeyAt = useRef(0)

  const session = useTypingSession({
    text,
    extendText: () => ' ' + generateText(40, opts, rng.current),
    finishWhenComplete: false,
    behavior: { allowBackspace: true, stopOnError: false, autoIndent: false },
    onKeystroke: (k) => {
      lastKeyAt.current = performance.now()
      if (k.kind === 'char') sound.key(k.correct)
    },
    onFinish: (summary) => {
      // Zen has no finish line: a session counts once it lasted long enough to mean something.
      setOutcome(recordResult({ summary: { ...summary, completed: summary.durationMs >= MIN_SESSION_MS }, mode: 'zen', config: { difficulty: 'easy', category: opts.category } }))
    },
  })

  // Pause the clock while the player rests, so Zen stats measure typing, not thinking.
  useEffect(() => {
    if (session.status !== 'running') return
    const id = setInterval(() => {
      if (performance.now() - lastKeyAt.current > IDLE_PAUSE_MS) session.pause()
    }, 500)
    return () => clearInterval(id)
  }, [session.status, session])

  useEffect(() => {
    if (settings.ambientSound) startAmbient(settings.volume)
    else stopAmbient()
    return () => stopAmbient()
  }, [settings.ambientSound, settings.volume])

  const endSession = () => {
    if (session.status === 'idle') return
    session.finish('manual')
  }
  const again = () => {
    const t = generateText(80, opts, rng.current)
    setText(t)
    session.reset(t)
    setOutcome(null)
  }

  useShortcuts({ Escape: () => (outcome ? undefined : endSession()) })

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <a href="#/modes" className="inline-flex items-center gap-1.5 text-sm text-subtle hover:text-fg">
          <ArrowLeft className="size-4" /> Leave Zen
        </a>
        <div className="flex items-center gap-1">
          <Tooltip content={settings.ambientSound ? 'Turn ambient sound off' : 'Play soft ambient sound'}>
            <button
              type="button"
              onClick={() => updateSettings({ ambientSound: !settings.ambientSound })}
              aria-pressed={settings.ambientSound}
              aria-label="Ambient sound"
              className="flex size-9 items-center justify-center rounded-lg text-subtle hover:bg-surface-2 hover:text-fg"
            >
              {settings.ambientSound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </button>
          </Tooltip>
          <Tooltip content={showStats ? 'Hide stats' : 'Show stats'}>
            <button
              type="button"
              onClick={() => setShowStats((s) => !s)}
              aria-pressed={showStats}
              aria-label="Show stats"
              className="flex size-9 items-center justify-center rounded-lg text-subtle hover:bg-surface-2 hover:text-fg"
            >
              {showStats ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
          </Tooltip>
          {!outcome ? (
            <Button variant="ghost" size="sm" onClick={endSession} disabled={session.status === 'idle'}>
              <Square /> End session
            </Button>
          ) : null}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 pb-24 sm:px-8">
        {outcome ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="mx-auto max-w-md p-6 text-center">
              <Leaf className="mx-auto size-6 text-accent-text" />
              <h1 className="mt-3 text-lg font-semibold">Session complete</h1>
              <p className="mt-1 text-sm text-muted">{outcome.result.valid ? `You typed for ${formatDuration(outcome.result.durationMs)}.` : `Sessions under ${MIN_SESSION_MS / 1000}s are not saved.`}</p>
              <dl className="mt-5 grid grid-cols-3 gap-3">
                {[
                  ['WPM', Math.round(outcome.result.wpm)],
                  ['Accuracy', `${outcome.result.accuracy.toFixed(1)}%`],
                  ['XP', `+${outcome.xpTotal}`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-subtle">Zen earns up to 60 XP a day for clean (85%+) typing.</p>
              <div className="mt-6 flex justify-center gap-2">
                <Button asChild variant="ghost">
                  <a href="#/">Dashboard</a>
                </Button>
                <Button variant="primary" onClick={again}>
                  Keep typing
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : (
          <>
            <div className="mb-6 h-6 text-center font-mono text-sm tabular-nums text-subtle" aria-live="off">
              {showStats && session.status !== 'idle'
                ? `${Math.round(session.live.wpm)} wpm · ${Math.round(session.live.accuracy)}% · ${formatDuration(session.elapsedMs)}${session.status === 'paused' ? ' · resting' : ''}`
                : session.status === 'idle'
                  ? 'Start typing whenever you’re ready.'
                  : ''}
            </div>
            <TypingSurface session={session} lines={4} ariaLabel="Zen typing area" />
          </>
        )}
      </div>
    </div>
  )
}
