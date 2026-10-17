// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TestResult } from '@/engine/types'
import { DEFAULT_SETTINGS, defaultData, isPersisted, loadData, normalize, prune, removeProfile, requestPersistence, saveData, STORAGE_KEY } from './storage'
import type { AppData } from './types'

let n = 0
const r = (over: Partial<TestResult> = {}): TestResult =>
  ({ id: `r${n++}`, profileId: 'p1', date: new Date(2026, 0, 1).toISOString(), mode: 'arena', config: { difficulty: 'medium', category: 'common' }, wpm: 50, raw: 55, accuracy: 96, consistency: 80, correctChars: 250, incorrectChars: 0, errors: 3, keystrokes: 260, backspaces: 3, durationMs: 60000, totalChars: 250, completed: true, valid: true, samples: [{ s: 1, wpm: 50, raw: 55, errors: 0 }], keyHits: {}, keyMisses: {}, xp: 10, isPB: false, ...over }) as TestResult

const data = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  version: 1,
  profiles: [{ id: 'p1', name: 'Ada', createdAt: '2026-01-01T00:00:00.000Z' }],
  activeProfileId: 'p1',
  settings: { ...DEFAULT_SETTINGS },
  results: [],
  progress: { p1: { xpLedger: [], achievements: {}, boss: {}, dailyQuests: {}, zenMs: 0 } },
  ...over,
})

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('normalize', () => {
  it('round-trips valid data unchanged', () => {
    const d = defaultData()
    d.results = [r({ profileId: d.activeProfileId })]
    expect(normalize(JSON.parse(JSON.stringify(d)))).toEqual(d)
  })

  it('rejects input with no usable profile', () => {
    expect(() => normalize(null)).toThrow()
    expect(() => normalize('hello')).toThrow()
    expect(() => normalize({ profiles: [] })).toThrow()
    expect(() => normalize({ profiles: [{ name: 'no id' }, 42, null] })).toThrow()
  })

  it('resets each bad setting to its default and keeps the good ones', () => {
    const out = normalize(
      data({ settings: { theme: 123, difficulty: 'insane', fontSize: 'lg', sound: 'yes', volume: 5, length: { kind: 'time', value: 7 }, caretStyle: 'block', bogus: true } }),
    )
    expect(out.settings.theme).toBe(DEFAULT_SETTINGS.theme)
    expect(out.settings.difficulty).toBe(DEFAULT_SETTINGS.difficulty)
    expect(out.settings.sound).toBe(DEFAULT_SETTINGS.sound)
    expect(out.settings.length).toEqual(DEFAULT_SETTINGS.length)
    expect(out.settings.volume).toBe(1)
    expect(out.settings.fontSize).toBe('lg')
    expect(out.settings.caretStyle).toBe('block')
    expect(out.settings).not.toHaveProperty('bogus')
  })

  it('keeps a valid test length', () => {
    expect(normalize(data({ settings: { length: { kind: 'words', value: 50 } } })).settings.length).toEqual({ kind: 'words', value: 50 })
  })

  it('falls back to defaults when settings are missing or not an object', () => {
    expect(normalize(data({ settings: undefined })).settings).toEqual(DEFAULT_SETTINGS)
    expect(normalize(data({ settings: [1, 2] })).settings).toEqual(DEFAULT_SETTINGS)
  })

  it('drops malformed results and keeps good ones', () => {
    const good = r()
    const out = normalize(
      data({ results: [good, null, 'x', r({ wpm: 'fast' as never }), r({ date: 'not a date' }), r({ samples: undefined as never }), { ...r(), id: undefined }] }),
    )
    expect(out.results).toEqual([good])
  })

  it('repairs profiles, the active profile and per-profile progress', () => {
    const out = normalize(
      data({
        profiles: [{ id: 'p1', name: 'Ada' }, { id: 'p1', name: 'Dupe' }, { id: 'p2', name: '  ' }, { name: 'no id' }],
        activeProfileId: 'gone',
        progress: { p1: { xpLedger: 'oops', achievements: [], zenMs: -5, boss: { normal: 2 } } },
      }),
    )
    expect(out.profiles.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(out.profiles[1].name).toBe('Player')
    expect(typeof out.profiles[0].createdAt).toBe('string')
    expect(out.activeProfileId).toBe('p1')
    expect(out.progress.p1).toEqual({ xpLedger: [], achievements: {}, boss: { normal: 2 }, dailyQuests: {}, zenMs: 0 })
    expect(out.progress.p2).toEqual({ xpLedger: [], achievements: {}, boss: {}, dailyQuests: {}, zenMs: 0 })
  })
})

describe('prune', () => {
  const base = (results: TestResult[]) => ({ ...(normalize(data()) as AppData), results })

  it('caps history at the newest 1500 results', () => {
    const results = Array.from({ length: 1600 }, () => r())
    const out = prune(base(results)).results
    expect(out).toHaveLength(1500)
    expect(out[0].id).toBe(results[100].id)
    expect(out.at(-1)!.id).toBe(results.at(-1)!.id)
  })

  it('drops per-second samples from all but the newest 300 results', () => {
    const out = prune(base(Array.from({ length: 400 }, () => r()))).results
    expect(out.slice(0, 100).every((x) => x.samples.length === 0)).toBe(true)
    expect(out.slice(100).every((x) => x.samples.length === 1)).toBe(true)
  })

  it('keeps ghost timelines for the 10 fastest runs per word count plus each player’s best', () => {
    const words = { difficulty: 'medium', category: 'common', length: { kind: 'words', value: 25 } } as const
    const p1 = Array.from({ length: 15 }, (_, i) => r({ config: words, wpm: 100 - i, timeline: [0, 0, 1000, 5] }))
    const p2Best = r({ profileId: 'p2', config: words, wpm: 20, timeline: [0, 0] })
    const out = prune(base([...p1, p2Best])).results
    const kept = out.filter((x) => x.timeline).map((x) => x.id)
    expect(kept).toEqual([...p1.slice(0, 10).map((x) => x.id), p2Best.id])
  })
})

describe('loadData / saveData', () => {
  it('starts fresh when nothing is saved', () => {
    const { data: d, error } = loadData()
    expect(error).toBeUndefined()
    expect(d.profiles).toHaveLength(1)
  })

  it('round-trips through localStorage', () => {
    const d = normalize(data({ results: [r()] }))
    expect(saveData(d)).toBeNull()
    expect(loadData().data).toEqual(d)
  })

  it('resets corrupt saves but keeps a backup copy', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    const { data: d, error } = loadData()
    expect(error).toMatch(/reset/)
    expect(d.profiles).toHaveLength(1)
    const backup = Object.keys(localStorage).find((k) => k.startsWith(`${STORAGE_KEY}:corrupt:`))
    expect(backup && localStorage.getItem(backup)).toBe('{not json')
  })

  it('reports when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(loadData().error).toMatch(/unavailable/)
  })

  it('sheds the oldest third of history when storage is full', () => {
    const real = Storage.prototype.setItem
    let calls = 0
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k, v) {
      if (calls++ === 0) throw new DOMException('full', 'QuotaExceededError')
      real.call(this, k, v)
    })
    const results = Array.from({ length: 30 }, () => r())
    expect(saveData(normalize(data({ results })))).toMatch(/oldest results were removed/)
    const saved = loadData().data.results
    expect(saved).toHaveLength(20)
    expect(saved[0].id).toBe(results[10].id)
  })

  it('reports when storage is still full after shedding', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(saveData(normalize(data()))).toMatch(/Storage is full/)
  })
})

describe('removeProfile', () => {
  const two = () =>
    normalize(
      data({
        profiles: [
          { id: 'p1', name: 'Ada' },
          { id: 'p2', name: 'Grace' },
        ],
        activeProfileId: 'p1',
        results: [r({ profileId: 'p1' }), r({ profileId: 'p2' }), r({ profileId: 'p2' })],
        progress: { p1: { zenMs: 5 }, p2: { zenMs: 9 } },
      }),
    )

  it('deletes another player with their results and progress', () => {
    const out = removeProfile(two(), 'p2')
    expect(out.profiles.map((p) => p.id)).toEqual(['p1'])
    expect(out.results.every((x) => x.profileId === 'p1')).toBe(true)
    expect(out.progress).not.toHaveProperty('p2')
    expect(out.activeProfileId).toBe('p1')
  })

  it('switches to a remaining player when the active one is deleted', () => {
    const out = removeProfile(two(), 'p1')
    expect(out.activeProfileId).toBe('p2')
    expect(out.results).toHaveLength(2)
    expect(out.progress.p2.zenMs).toBe(9)
  })

  it('starts over with a fresh player when the last one is deleted, keeping settings', () => {
    const d = normalize(data({ results: [r()], settings: { theme: 'light' } }))
    const out = removeProfile(d, 'p1')
    expect(out.profiles).toHaveLength(1)
    expect(out.profiles[0].id).not.toBe('p1')
    expect(out.results).toEqual([])
    expect(out.progress[out.activeProfileId]).toEqual({ xpLedger: [], achievements: {}, boss: {}, dailyQuests: {}, zenMs: 0 })
    expect(out.settings.theme).toBe('light')
  })

  it('ignores unknown ids', () => {
    const d = two()
    expect(removeProfile(d, 'nobody')).toBe(d)
  })
})

describe('persistent storage', () => {
  // jsdom has no StorageManager, so each test installs a fake one.
  const fake = (persisted: boolean, grant: boolean) => {
    const persist = vi.fn(async () => grant)
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { persisted: async () => persisted, persist } })
    return persist
  }
  afterEach(() => {
    delete (navigator as { storage?: unknown }).storage
  })

  it('does nothing where the API is missing', async () => {
    expect(await requestPersistence()).toBe(false)
    expect(await isPersisted()).toBe(false)
  })

  it('asks only when not already persisted', async () => {
    const persist = fake(true, false)
    expect(await requestPersistence()).toBe(true)
    expect(await isPersisted()).toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it('reports what the browser decides', async () => {
    fake(false, true)
    expect(await requestPersistence()).toBe(true)
    fake(false, false)
    expect(await requestPersistence()).toBe(false)
  })
})
