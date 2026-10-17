import { Pause, Play, RefreshCw, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LiveStats } from '@/components/LiveStats'
import { ResultsView } from '@/components/ResultsView'
import { CATEGORIES, DIFFICULTIES, TIME_VALUES, WORD_VALUES } from '@/components/TestOptions'
import { TestOptions } from '@/components/TestOptions'
import { TypingSurface } from '@/components/TypingSurface'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { VirtualKeyboard } from '@/components/VirtualKeyboard'
import { generateText, type TextOptions } from '@/engine/textGen'
import type { TestLength } from '@/engine/types'
import { useTypingSession } from '@/engine/useTypingSession'
import { difficultyUnlocked, keyStats } from '@/game/progression'
import { useStore, type RecordOutcome } from '@/game/store'
import { focusIsNeutral, useShortcuts } from '@/hooks/useShortcuts'
import { useSound } from '@/hooks/useSound'
import { mulberry32 } from '@/lib/utils'

export function useMissRates() {
  const { results } = useStore()
  return useMemo(() => Object.fromEntries(keyStats(results).filter((k) => k.hits >= 5).map((k) => [k.key, k.rate])), [results])
}

export function ArenaPage() {
  const { settings, updateSettings, recordResult, level, results } = useStore()
  const sound = useSound()
  const missRates = useMissRates()
  const { length, difficulty, category, language, customText } = settings
  const rng = useRef(mulberry32((Math.random() * 2 ** 32) >>> 0))
  const textOpts: TextOptions = useMemo(() => ({ difficulty, category, language, customText }), [difficulty, category, language, customText])

  const makeText = useCallback(() => generateText(length.kind === 'words' ? length.value : 60, textOpts, rng.current), [length, textOpts])
  const [text, setText] = useState(makeText)
  const [outcome, setOutcome] = useState<RecordOutcome | null>(null)

  const session = useTypingSession({
    text,
    timeLimitMs: length.kind === 'time' ? length.value * 1000 : undefined,
    extendText: length.kind === 'time' ? () => ' ' + generateText(30, textOpts, rng.current) : undefined,
    behavior: { allowBackspace: settings.allowBackspace, stopOnError: settings.stopOnError, autoIndent: false },
    onKeystroke: (k) => k.kind === 'char' && sound.key(k.correct),
    onFinish: (summary) => {
      const o = recordResult({
        summary,
        mode: 'arena',
        config: { length, difficulty, category, language: category === 'common' ? language : undefined },
      })
      setOutcome(o)
    },
  })

  const newTest = useCallback(() => {
    const t = makeText()
    setText(t)
    session.reset(t)
    setOutcome(null)
  }, [makeText, session])

  const retry = useCallback(() => {
    session.reset(text)
    setOutcome(null)
  }, [session, text])

  // New text whenever the test options change.
  const optionsKey = `${length.kind}${length.value}|${difficulty}|${category}|${language}|${customText}`
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    newTest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey])

  // If a difficulty is locked (e.g. after a reset), fall back to Medium.
  useEffect(() => {
    if (!difficultyUnlocked(difficulty, level.level, results)) updateSettings({ difficulty: 'medium' })
  }, [difficulty, level.level, results, updateSettings])

  const running = session.status === 'running'
  const togglePause = () => (session.status === 'paused' ? session.resume() : session.pause())

  const cycle = <T,>(list: readonly T[], cur: T) => list[(list.indexOf(cur) + 1) % list.length]
  const restartCombo = settings.restartKey === 'tab' ? 'Tab' : 'Shift+Enter'
  useShortcuts({
    [restartCombo]: (e) => {
      if (restartCombo === 'Tab' && !focusIsNeutral(e) && !outcome) return false
      newTest()
    },
    Escape: () => {
      if (session.status === 'running' || session.status === 'paused') togglePause()
    },
    'Alt+KeyR': () => retry(),
    'Alt+KeyM': () => {
      if (running) return
      updateSettings({ length: length.kind === 'time' ? { kind: 'words', value: 25 } : { kind: 'time', value: 30 } })
    },
    'Alt+KeyD': () => {
      if (running) return
      const unlocked = DIFFICULTIES.filter((d) => difficultyUnlocked(d, level.level, results))
      updateSettings({ difficulty: cycle(unlocked, difficulty) })
    },
    'Alt+KeyC': () => {
      if (running) return
      const cats = CATEGORIES.map((c) => c.value).filter((c) => c !== 'custom' || customText)
      updateSettings({ category: cycle(cats, category) })
    },
    ...Object.fromEntries(
      [1, 2, 3, 4].map((n) => [
        `Alt+Digit${n}`,
        () => {
          if (running) return
          const values = length.kind === 'time' ? TIME_VALUES : WORD_VALUES
          updateSettings({ length: { kind: length.kind, value: values[n - 1] } as TestLength })
        },
      ]),
    ),
  })

  const wordsTyped = text.slice(0, session.engine.typed.length).split(' ').length - (session.engine.typed.length === 0 ? 1 : 0)

  if (outcome) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">Results</h1>
        <ResultsView outcome={outcome} onRestart={retry} restartLabel="Retry same text" onNext={newTest} nextLabel="Next test" nextShortcut />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div data-focus-fade className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Typing Arena</h1>
        <p className="text-sm text-muted">The timer starts on your first keystroke.</p>
      </div>

      <div data-focus-fade>
        <TestOptions disabled={running} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        {settings.showLiveStats ? (
          <LiveStats session={session} progress={length.kind === 'words' ? `${Math.min(wordsTyped, length.value)}/${length.value}` : undefined} />
        ) : (
          <div className="text-sm text-muted">Live stats hidden</div>
        )}
        <div data-focus-fade className="flex items-center gap-1.5">
          {session.status === 'idle' ? (
            <Button variant="primary" size="sm" onClick={() => session.start()}>
              <Play /> Start
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={togglePause} disabled={session.status === 'finished'} aria-label={session.status === 'paused' ? 'Resume (Esc)' : 'Pause (Esc)'}>
              {session.status === 'paused' ? <Play /> : <Pause />}
              {session.status === 'paused' ? 'Resume' : 'Pause'}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={retry} title="Restart with the same text (Alt+R)">
            <RotateCcw /> Restart
          </Button>
          <Button variant="ghost" size="sm" onClick={newTest} title={`New text (${restartCombo})`}>
            <RefreshCw /> New test
          </Button>
        </div>
      </div>

      <TypingSurface session={session} />

      {settings.showKeyboard ? (
        <VirtualKeyboard
          expected={session.engine.target[session.engine.typed.length] ?? ''}
          lastKey={session.engine.lastKey}
          missRates={missRates}
          layout={settings.keyboardLayout}
          fingerGuide={settings.fingerGuide}
          theme={settings.keyboardTheme}
          className="hidden sm:block"
        />
      ) : null}

      <ShortcutHints restart={restartCombo} />
    </div>
  )
}

export function ShortcutHints({ restart, extra }: { restart: string; extra?: [string, string][] }) {
  const items: [string, string][] = [
    [restart.replace('+', ' + '), 'new test'],
    ['Esc', 'pause'],
    ['Alt + R', 'restart'],
    ['Alt + M', 'time / words'],
    ['Alt + 1–4', 'length'],
    ['Alt + D', 'difficulty'],
    ['Alt + C', 'category'],
    ...(extra ?? []),
  ]
  return (
    <div data-focus-fade className="hidden flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-subtle md:flex">
      {items.map(([k, label]) => (
        <span key={k} className="flex items-center gap-1.5">
          <Kbd>{k}</Kbd> {label}
        </span>
      ))}
    </div>
  )
}
