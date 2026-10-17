import { describe, expect, it } from 'vitest'
import { backspace, createEngine, typeableLength, typeChar, uncorrectedErrors } from '../engine'
import { accuracy, buildTimeline, consistency, perSecondSamples, timelineAt, wpm } from '../metrics'
import { summarize } from '../useTypingSession'

const B = { allowBackspace: true, stopOnError: false, autoIndent: false }

function typeAll(text: string, input: string, behavior = B, step = 100) {
  let s = createEngine(text)
  let t = 0
  for (const ch of input) {
    t += step
    s = ch === '\b' ? backspace(s, t, behavior) : typeChar(s, ch, t, behavior).state
  }
  return { s, t }
}

describe('metrics', () => {
  it('uses the five-character word convention', () => {
    expect(wpm(50, 60000)).toBe(10)
    expect(wpm(250, 30000)).toBe(100)
    expect(wpm(10, 0)).toBe(0)
  })
  it('computes accuracy from keystrokes', () => {
    expect(accuracy(9, 10)).toBe(90)
    expect(accuracy(0, 0)).toBe(100)
  })
  it('consistency is 100 for a perfectly even pace', () => {
    expect(consistency([60, 60, 60])).toBe(100)
    expect(consistency([20, 100])).toBeLessThan(50)
  })
})

describe('engine', () => {
  it('counts correct characters and keystrokes', () => {
    const { s } = typeAll('hello world', 'hello world')
    expect(s.net).toBe(11)
    expect(s.keystrokes).toBe(11)
    expect(s.errorKeystrokes).toBe(0)
  })

  it('a corrected mistake keeps net chars but lowers accuracy', () => {
    const { s, t } = typeAll('abc', 'ax\bbc')
    expect(s.net).toBe(3)
    expect(s.keystrokes).toBe(4)
    expect(s.errorKeystrokes).toBe(1)
    expect(s.backspaces).toBe(1)
    const sum = summarize(s, t, 'complete', false)
    expect(sum.accuracy).toBe(75)
    expect(sum.incorrectChars).toBe(0)
  })

  it('uncorrected mistakes add nothing to WPM', () => {
    const { s } = typeAll('abcd', 'axcd')
    expect(s.net).toBe(3)
    expect(uncorrectedErrors(s)).toBe(1)
  })

  it('backspace removes a correct char and decrements net', () => {
    const { s } = typeAll('abc', 'ab\b')
    expect(s.typed.length).toBe(1)
    expect(s.net).toBe(1)
  })

  it('ignores backspace when disabled', () => {
    const { s } = typeAll('abc', 'ax\b', { ...B, allowBackspace: false })
    expect(s.typed.length).toBe(2)
  })

  it('stop-on-error does not advance but records the error', () => {
    const { s } = typeAll('abc', 'axbc', { ...B, stopOnError: true })
    expect(s.typed.length).toBe(3)
    expect(s.errorKeystrokes).toBe(1)
    expect(s.net).toBe(3)
  })

  it('ctrl+backspace deletes the previous word', () => {
    let s = typeAll('one two', 'one tw').s
    s = backspace(s, 1000, B, true)
    expect(s.typed.length).toBe(4)
    s = backspace(s, 1100, B, true)
    expect(s.typed.length).toBe(0)
    expect(s.net).toBe(0)
  })

  it('auto-indent fills leading spaces and excludes them from metrics', () => {
    const code = 'if x:\n    y'
    const b = { ...B, autoIndent: true }
    const { s, t } = typeAll(code, 'if x:\ny', b)
    expect(s.typed.length).toBe(code.length)
    expect(s.net).toBe(7)
    expect(typeableLength(code, true)).toBe(7)
    expect(summarize(s, t, 'complete', true).totalChars).toBe(7)
    // Backspacing the y also leaves the indentation intact; backspacing again removes indent + newline.
    const back = backspace(backspace(s, t + 1, b), t + 2, b)
    expect(back.typed.length).toBe(5)
  })

  it('per-second samples rebuild net WPM over time', () => {
    const { s } = typeAll('aaaaaaaaaa', 'aaaaaaaaaa', B, 200) // 10 chars over 2s
    const samples = perSecondSamples(s.log, 2000)
    expect(samples).toHaveLength(2)
    expect(samples[1].wpm).toBe(60) // 10 chars / 5 / (2/60)
    expect(samples[0].raw).toBe(48) // 4 chars within the first second
  })

  it('ghost timeline interpolates progress', () => {
    const { s } = typeAll('aaaaa', 'aaaaa', B, 200)
    const tl = buildTimeline(s.log, 1000)
    expect(timelineAt(tl, 1000)).toBe(5)
    expect(timelineAt(tl, 500)).toBeGreaterThanOrEqual(2)
  })
})
