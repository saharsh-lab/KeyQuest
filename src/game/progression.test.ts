import { describe, expect, it } from 'vitest'
import type { TestResult } from '@/engine/types'
import { addDays, dayKey } from '@/lib/utils'
import { baseXp, currentStreak, dailyQuest, levelFromXp, validate } from './progression'

const r = (over: Partial<TestResult>): TestResult =>
  ({ id: Math.random().toString(), profileId: 'p', date: new Date().toISOString(), mode: 'arena', config: { difficulty: 'medium', category: 'common' }, wpm: 50, raw: 55, accuracy: 96, consistency: 80, correctChars: 250, incorrectChars: 0, errors: 3, keystrokes: 260, backspaces: 3, durationMs: 60000, totalChars: 250, completed: true, valid: true, samples: [], keyHits: {}, keyMisses: {}, xp: 0, isPB: false, ...over }) as TestResult

describe('progression', () => {
  it('levels follow the XP curve', () => {
    expect(levelFromXp(0).level).toBe(1)
    expect(levelFromXp(99).level).toBe(1)
    expect(levelFromXp(100).level).toBe(2)
    expect(levelFromXp(250).level).toBe(3)
  })
  it('rejects unfinished, idle and very inaccurate runs', () => {
    expect(validate(r({ completed: false }))).toBeTruthy()
    expect(validate(r({ accuracy: 40 }))).toBeTruthy()
    expect(validate(r({ keystrokes: 3 }))).toBeTruthy()
    expect(validate(r({}))).toBeUndefined()
  })
  it('XP scales with words, difficulty and accuracy', () => {
    expect(baseXp(r({}))).toBe(50)
    expect(baseXp(r({ config: { difficulty: 'expert', category: 'common' } }))).toBe(75)
    expect(baseXp(r({ accuracy: 70 }))).toBeLessThan(50)
  })
  it('streaks count consecutive days ending today or yesterday', () => {
    const at = (d: string) => new Date(d + 'T12:00:00').toISOString()
    const today = dayKey()
    expect(currentStreak([r({ date: at(today) }), r({ date: at(addDays(today, -1)) }), r({ date: at(addDays(today, -3)) })])).toBe(2)
    expect(currentStreak([r({ date: at(addDays(today, -1)) })])).toBe(1)
    expect(currentStreak([r({ date: at(addDays(today, -2)) })])).toBe(0)
    expect(currentStreak([r({ date: at(today), valid: false })])).toBe(0)
  })
  it('daily quest is deterministic per day', () => {
    expect(dailyQuest([], '2026-10-15')).toEqual(dailyQuest([], '2026-10-15'))
  })
})
