import { describe, expect, it } from 'vitest'
import { combineCelebrations } from './store'

const named = (...titles: string[]) => titles.map((title) => ({ title }))

describe('combineCelebrations', () => {
  it('sums up a big run in one toast', () => {
    const c = combineCelebrations(6, false, named('First Steps', 'Picking Up Pace', 'Swift Fingers', 'Blur', 'Triple Digits', 'Light Speed'), [])
    expect(c.kind).toBe('level')
    expect(c.title).toBe('Level 6 · 6 achievements unlocked')
    expect(c.detail).toBe('First Steps, Picking Up Pace, Swift Fingers and 3 more')
  })

  it('names everything when there are three or fewer', () => {
    const c = combineCelebrations(null, true, named('Flawless'), named('Finish a 30s+ run'))
    expect(c.kind).toBe('achievement')
    expect(c.title).toBe('Daily Quest complete · 1 achievement unlocked · 1 mission complete')
    expect(c.detail).toBe('Flawless, Finish a 30s+ run')
  })

  it('falls back to a pointer at the results when there is nothing to name', () => {
    const c = combineCelebrations(3, true, [], [])
    expect(c.title).toBe('Level 3 · Daily Quest complete')
    expect(c.detail).toBe('See your results for details.')
  })
})
