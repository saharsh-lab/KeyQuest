/**
 * React binding for the typing engine: owns the timer, pause/resume and keyboard/mobile input,
 * and produces a SessionSummary when a run ends. All metric math lives in engine.ts / metrics.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  appendText,
  backspace,
  createEngine,
  isComplete,
  typeableLength,
  typeChar,
  uncorrectedErrors,
  type EngineState,
} from './engine'
import { accuracy, buildTimeline, consistency, perSecondSamples, wpm } from './metrics'
import type { PerSecondSample, TypingBehavior } from './types'

export type SessionStatus = 'idle' | 'running' | 'paused' | 'finished'
export type FinishReason = 'time' | 'complete' | 'manual' | 'failed'

export interface SessionSummary {
  reason: FinishReason
  durationMs: number
  wpm: number
  raw: number
  accuracy: number
  consistency: number
  correctChars: number
  incorrectChars: number
  errors: number
  keystrokes: number
  backspaces: number
  totalChars: number
  completed: boolean
  samples: PerSecondSample[]
  keyHits: Record<string, number>
  keyMisses: Record<string, number>
  timeline: number[]
  bestStreak: number
  engine: EngineState
}

export interface KeystrokeInfo {
  kind: 'char' | 'back'
  typed: string
  expected: string
  correct: boolean
  engine: EngineState
  t: number
}

export interface SessionOptions {
  text: string
  timeLimitMs?: number
  /** Called when the remaining text runs low; should return more text starting with a separator. */
  extendText?: () => string
  behavior: TypingBehavior
  /** End the run as soon as the last character is typed (default true). */
  finishWhenComplete?: boolean
  pausable?: boolean
  disabled?: boolean
  onFinish?: (summary: SessionSummary) => void
  onKeystroke?: (info: KeystrokeInfo) => void
  onStart?: () => void
}

const now = () => performance.now()

export function summarize(engine: EngineState, durationMs: number, reason: FinishReason, autoIndent: boolean): SessionSummary {
  const samples = perSecondSamples(engine.log, durationMs)
  const totalChars = typeableLength(engine.target, autoIndent)
  return {
    reason,
    durationMs,
    wpm: wpm(engine.net, durationMs),
    raw: wpm(engine.keystrokes, durationMs),
    accuracy: accuracy(engine.correctKeystrokes, engine.keystrokes),
    consistency: consistency(samples.map((s) => s.raw)),
    correctChars: engine.net,
    incorrectChars: uncorrectedErrors(engine),
    errors: engine.errorKeystrokes,
    keystrokes: engine.keystrokes,
    backspaces: engine.backspaces,
    totalChars,
    completed: reason === 'time' || reason === 'complete',
    samples,
    keyHits: engine.keyHits,
    keyMisses: engine.keyMisses,
    timeline: buildTimeline(engine.log, durationMs),
    bestStreak: engine.bestStreak,
    engine,
  }
}

export function useTypingSession(opts: SessionOptions) {
  const optsRef = useRef(opts)
  optsRef.current = opts

  const [engine, setEngineState] = useState(() => createEngine(opts.text))
  const [status, setStatusState] = useState<SessionStatus>('idle')
  const [elapsed, setElapsed] = useState(0)
  const engineRef = useRef(engine)
  const statusRef = useRef<SessionStatus>('idle')
  const accRef = useRef(0)
  const startRef = useRef(0)

  const setEngine = (e: EngineState) => {
    engineRef.current = e
    setEngineState(e)
  }
  const setStatus = (s: SessionStatus) => {
    statusRef.current = s
    setStatusState(s)
  }

  const activeMs = useCallback(() => {
    return accRef.current + (statusRef.current === 'running' ? now() - startRef.current : 0)
  }, [])

  const finish = useCallback(
    (reason: FinishReason) => {
      if (statusRef.current === 'finished' || statusRef.current === 'idle') return null
      const limit = optsRef.current.timeLimitMs
      let ms = activeMs()
      if (limit && (reason === 'time' || ms > limit)) ms = limit
      accRef.current = ms
      setStatus('finished')
      setElapsed(ms)
      const summary = summarize(engineRef.current, ms, reason, optsRef.current.behavior.autoIndent)
      optsRef.current.onFinish?.(summary)
      return summary
    },
    [activeMs],
  )

  const reset = useCallback((text?: string) => {
    accRef.current = 0
    startRef.current = 0
    setStatus('idle')
    setElapsed(0)
    setEngine(createEngine(text ?? optsRef.current.text))
  }, [])

  /** Start the clock without waiting for the first keystroke (Start button). */
  const start = useCallback(() => {
    if (statusRef.current !== 'idle') return
    accRef.current = 0
    startRef.current = now()
    setStatus('running')
    optsRef.current.onStart?.()
  }, [])

  const pause = useCallback(() => {
    if (statusRef.current !== 'running' || optsRef.current.pausable === false) return
    accRef.current += now() - startRef.current
    setStatus('paused')
    setElapsed(accRef.current)
  }, [])

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return
    startRef.current = now()
    setStatus('running')
  }, [])

  // Timer: drives the visible clock and ends timed runs exactly at the limit.
  useEffect(() => {
    if (status !== 'running') return
    const id = window.setInterval(() => {
      const ms = activeMs()
      const limit = optsRef.current.timeLimitMs
      if (limit && ms >= limit) {
        finish('time')
      } else {
        setElapsed(ms)
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [status, activeMs, finish])

  // Pause automatically when the tab is hidden (only where pausing is allowed).
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && optsRef.current.pausable !== false) pause()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [pause])

  const inputChar = useCallback(
    (ch: string) => {
      const o = optsRef.current
      if (o.disabled) return
      const st = statusRef.current
      if (st === 'finished') return
      if (st === 'paused') resume()
      if (st === 'idle') {
        accRef.current = 0
        startRef.current = now()
        setStatus('running')
        o.onStart?.()
      }
      const t = activeMs()
      if (o.timeLimitMs && t >= o.timeLimitMs) {
        finish('time')
        return
      }
      let { state, correct } = typeChar(engineRef.current, ch, t, o.behavior)
      const expected = engineRef.current.target[engineRef.current.typed.length] ?? ''
      if (o.extendText && state.target.length - state.typed.length < 80) {
        state = appendText(state, o.extendText())
      }
      setEngine(state)
      o.onKeystroke?.({ kind: 'char', typed: ch, expected, correct, engine: state, t })
      if (isComplete(state) && o.finishWhenComplete !== false) finish('complete')
    },
    [activeMs, finish, resume],
  )

  const inputBackspace = useCallback(
    (word: boolean) => {
      const o = optsRef.current
      if (o.disabled || statusRef.current === 'finished' || statusRef.current === 'idle') return
      if (statusRef.current === 'paused') resume()
      const t = activeMs()
      const next = backspace(engineRef.current, t, o.behavior, word)
      if (next !== engineRef.current) {
        setEngine(next)
        o.onKeystroke?.({ kind: 'back', typed: '', expected: '', correct: true, engine: next, t })
      }
    },
    [activeMs, resume],
  )

  /** Keydown handler for the hidden input. Returns true when the key was consumed. */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement> | KeyboardEvent): boolean => {
      // AltGr (reported as Ctrl+Alt on Windows) produces real characters on many European layouts.
      const altGr = e.getModifierState?.('AltGraph') || (e.ctrlKey && e.altKey)
      if (e.metaKey || (e.ctrlKey && !altGr && e.key !== 'Backspace')) return false
      if (e.key === 'Backspace') {
        e.preventDefault()
        inputBackspace(!altGr && (e.ctrlKey || e.altKey))
        return true
      }
      if (e.key === 'Enter') {
        // Only meaningful where the text contains newlines (code); otherwise swallowed.
        e.preventDefault()
        if (engineRef.current.target.includes('\n')) inputChar('\n')
        return true
      }
      if (e.key.length === 1) {
        e.preventDefault()
        inputChar(e.key)
        return true
      }
      return false
    },
    [inputBackspace, inputChar],
  )

  /**
   * Fallback for mobile/IME keyboards that do not report usable keydown events. The input keeps a single
   * sentinel space; anything after it is typed text, and losing it means backspace.
   */
  const handleInput = useCallback(
    (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const el = e.currentTarget
      const v = el.value
      if (v.length === 0) inputBackspace(false)
      else {
        const multiline = engineRef.current.target.includes('\n')
        for (const ch of v.slice(1)) if (ch !== '\n' || multiline) inputChar(ch)
      }
      el.value = ' '
      el.setSelectionRange?.(1, 1)
    },
    [inputBackspace, inputChar],
  )

  const elapsedMs = status === 'finished' ? accRef.current : elapsed
  const live = useMemo(() => {
    const ms = Math.max(elapsedMs, 1)
    const show = elapsedMs >= 1000
    return {
      wpm: show ? wpm(engine.net, ms) : 0,
      raw: show ? wpm(engine.keystrokes, ms) : 0,
      accuracy: accuracy(engine.correctKeystrokes, engine.keystrokes),
      errors: engine.errorKeystrokes,
    }
  }, [engine, elapsedMs])

  return {
    engine,
    engineRef,
    status,
    elapsedMs,
    remainingMs: opts.timeLimitMs ? Math.max(0, opts.timeLimitMs - elapsedMs) : undefined,
    live,
    reset,
    start,
    pause,
    resume,
    finish,
    activeMs,
    inputChar,
    inputBackspace,
    handleKeyDown,
    handleInput,
  }
}

export type TypingSession = ReturnType<typeof useTypingSession>
