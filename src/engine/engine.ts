/**
 * Pure typing engine. No React, no timers: every function takes a state and returns a new one.
 * The caller supplies `t`, the active (unpaused) milliseconds since the first keystroke.
 */
import type { LogEvent, TypedChar, TypingBehavior } from './types'

export interface EngineState {
  target: string
  typed: TypedChar[]
  log: LogEvent[]
  /** Character keystrokes (not backspaces, not auto-indent). */
  keystrokes: number
  correctKeystrokes: number
  errorKeystrokes: number
  backspaces: number
  /** Correct, non-auto characters currently in the buffer. */
  net: number
  streak: number
  bestStreak: number
  /** Per expected key: how often it was attempted and missed. Keys are lowercased, space is ' '. */
  keyHits: Record<string, number>
  keyMisses: Record<string, number>
  lastKey: { typed: string; expected: string; correct: boolean; at: number } | null
}

export function createEngine(target: string): EngineState {
  return {
    target,
    typed: [],
    log: [],
    keystrokes: 0,
    correctKeystrokes: 0,
    errorKeystrokes: 0,
    backspaces: 0,
    net: 0,
    streak: 0,
    bestStreak: 0,
    keyHits: {},
    keyMisses: {},
    lastKey: null,
  }
}

export const position = (s: EngineState) => s.typed.length
export const isComplete = (s: EngineState) => s.typed.length >= s.target.length
export const expectedChar = (s: EngineState) => s.target[s.typed.length] ?? ''

/** Total characters the player is expected to type themselves (auto-indent excluded). */
export function typeableLength(target: string, autoIndent: boolean): number {
  if (!autoIndent) return target.length
  let n = 0
  let lineStart = true
  for (const ch of target) {
    if (ch === '\n') {
      n++
      lineStart = true
      continue
    }
    if (lineStart && ch === ' ') continue
    lineStart = false
    n++
  }
  return n
}

const keyId = (ch: string) => (ch === '\n' ? '⏎' : ch.toLowerCase())

export function typeChar(s: EngineState, ch: string, t: number, b: TypingBehavior): { state: EngineState; correct: boolean } {
  if (isComplete(s)) return { state: s, correct: false }
  const expected = expectedChar(s)
  const correct = ch === expected
  const k = keyId(expected)
  const keyHits = { ...s.keyHits, [k]: (s.keyHits[k] ?? 0) + 1 }
  const keyMisses = correct ? s.keyMisses : { ...s.keyMisses, [k]: (s.keyMisses[k] ?? 0) + 1 }
  const streak = correct ? s.streak + 1 : 0
  const base = {
    ...s,
    keystrokes: s.keystrokes + 1,
    correctKeystrokes: s.correctKeystrokes + (correct ? 1 : 0),
    errorKeystrokes: s.errorKeystrokes + (correct ? 0 : 1),
    keyHits,
    keyMisses,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    lastKey: { typed: ch, expected, correct, at: t },
  }

  // Stop-on-error: the mistake is counted, but the cursor does not move.
  if (!correct && b.stopOnError) {
    return { state: { ...base, log: [...s.log, { t, kind: 'char', correct, net: s.net }] }, correct }
  }

  const typed = [...s.typed, { ch, correct, auto: false }]
  let net = s.net + (correct ? 1 : 0)

  // Auto-indent: after a correct newline, fill the next line's leading spaces for the player.
  if (correct && ch === '\n' && b.autoIndent) {
    while (typed.length < s.target.length && s.target[typed.length] === ' ') {
      typed.push({ ch: ' ', correct: true, auto: true })
    }
  }

  return { state: { ...base, typed, net, log: [...s.log, { t, kind: 'char', correct, net }] }, correct }
}

/** Backspace one character, or a whole word when `word` is set (Ctrl/Alt+Backspace). */
export function backspace(s: EngineState, t: number, b: TypingBehavior, word = false): EngineState {
  if (!b.allowBackspace || s.typed.length === 0) return s
  const typed = s.typed.slice()
  let net = s.net
  const popOne = () => {
    // Remove any auto-inserted indentation together with the character before it.
    while (typed.length && typed[typed.length - 1].auto) typed.pop()
    const c = typed.pop()
    if (c?.correct) net--
  }
  if (word) {
    // Skip trailing whitespace, then delete back to the previous whitespace.
    while (typed.length && /\s/.test(typed[typed.length - 1].ch) && !typed[typed.length - 1].auto) popOne()
    while (typed.length && !/\s/.test(typed[typed.length - 1].ch)) popOne()
  } else {
    popOne()
  }
  return {
    ...s,
    typed,
    net,
    backspaces: s.backspaces + 1,
    log: [...s.log, { t, kind: 'back', correct: true, net }],
  }
}

/** Extend the target (timed tests generate text on demand). */
export function appendText(s: EngineState, more: string): EngineState {
  return { ...s, target: s.target + more }
}

/** Incorrect characters still present in the buffer (uncorrected errors). */
export function uncorrectedErrors(s: EngineState): number {
  let n = 0
  for (const c of s.typed) if (!c.correct) n++
  return n
}

/** Index range of the word that contains `pos`, used to underline the active word. */
export function wordBounds(target: string, pos: number): [number, number] {
  let start = pos
  while (start > 0 && !/\s/.test(target[start - 1])) start--
  let end = pos
  while (end < target.length && !/\s/.test(target[end])) end++
  return [start, end]
}
