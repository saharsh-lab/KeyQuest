/**
 * LocalStorage persistence. Everything lives under one versioned key; reads are validated and fall back to
 * defaults so a corrupt or partial record never crashes the app.
 */
import type { TestResult } from '@/engine/types'
import { uid } from '@/lib/utils'
import type { AppData, ProfileProgress, Settings } from './types'

export const STORAGE_KEY = 'keyquest:v1'
const MAX_RESULTS = 1500
const KEEP_SAMPLES = 300
const KEEP_TIMELINES_PER_KEY = 10

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  sound: true,
  volume: 0.4,
  soundProfile: 'soft',
  errorSound: true,
  reducedMotion: 'system',
  fontSize: 'md',
  caretStyle: 'line',
  smoothCaret: true,
  difficulty: 'medium',
  category: 'common',
  language: 'english',
  customText: '',
  length: { kind: 'time', value: 30 },
  keyboardLayout: 'qwerty',
  showKeyboard: true,
  fingerGuide: false,
  keyboardTheme: 'graphite',
  arenaTheme: 'default',
  allowBackspace: true,
  stopOnError: false,
  autoIndent: true,
  restartKey: 'tab',
  showLiveStats: true,
  ambientSound: false,
  focusMode: true,
  effects3d: true,
}

export const emptyProgress = (): ProfileProgress => ({
  xpLedger: [],
  achievements: {},
  boss: {},
  dailyQuests: {},
  zenMs: 0,
})

export function defaultData(): AppData {
  const id = uid()
  return {
    version: 1,
    profiles: [{ id, name: 'Player 1', createdAt: new Date().toISOString() }],
    activeProfileId: id,
    settings: { ...DEFAULT_SETTINGS },
    results: [],
    progress: { [id]: emptyProgress() },
  }
}

export interface LoadOutcome {
  data: AppData
  error?: string
}

export function loadData(): LoadOutcome {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return { data: defaultData(), error: 'Browser storage is unavailable, so progress will not be saved in this session.' }
  }
  if (!raw) return { data: defaultData() }
  try {
    return { data: normalize(JSON.parse(raw)) }
  } catch {
    try {
      localStorage.setItem(`${STORAGE_KEY}:corrupt:${Date.now()}`, raw)
    } catch {
      /* ignore */
    }
    return { data: defaultData(), error: 'Saved progress could not be read and was reset. A backup copy was kept in storage.' }
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Allowed values for settings that are string unions; anything else falls back to the default. */
const SETTING_CHOICES: Partial<Record<keyof Settings, readonly string[]>> = {
  theme: ['dark', 'light', 'system'],
  soundProfile: ['click', 'soft', 'typewriter'],
  reducedMotion: ['system', 'on', 'off'],
  fontSize: ['sm', 'md', 'lg', 'xl'],
  caretStyle: ['line', 'block', 'underline', 'off'],
  difficulty: ['easy', 'medium', 'hard', 'expert'],
  category: ['common', 'programming', 'technology', 'quotes', 'custom'],
  language: ['english', 'spanish', 'french', 'german'],
  keyboardLayout: ['qwerty', 'dvorak', 'colemak', 'azerty'],
  restartKey: ['tab', 'shift-enter'],
}
const LENGTH_CHOICES = { time: [15, 30, 60, 120], words: [10, 25, 50, 100] }

/** Keep each saved setting only if it has the right type (and an allowed value); otherwise use the default. */
function normalizeSettings(input: unknown): Settings {
  const s = isObj(input) ? input : {}
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const v = s[key]
    if (key === 'length') {
      const len = v as Partial<Settings['length']> | undefined
      if (isObj(len) && (len.kind === 'time' || len.kind === 'words') && (LENGTH_CHOICES[len.kind] as unknown[]).includes(len.value)) out.length = { kind: len.kind, value: len.value }
      continue
    }
    if (typeof v !== typeof DEFAULT_SETTINGS[key] || (typeof v === 'number' && !Number.isFinite(v))) continue
    if (SETTING_CHOICES[key] && !SETTING_CHOICES[key].includes(v as string)) continue
    out[key] = v
  }
  out.volume = Math.min(1, Math.max(0, out.volume as number))
  return out as unknown as Settings
}

function normalizeProgress(input: unknown): ProfileProgress {
  const p = isObj(input) ? input : {}
  const base = emptyProgress()
  return {
    xpLedger: Array.isArray(p.xpLedger) ? p.xpLedger.filter((a) => isObj(a) && isNum(a.amount) && typeof a.id === 'string') : base.xpLedger,
    achievements: isObj(p.achievements) ? (p.achievements as ProfileProgress['achievements']) : base.achievements,
    boss: isObj(p.boss) ? (p.boss as ProfileProgress['boss']) : base.boss,
    dailyQuests: isObj(p.dailyQuests) ? (p.dailyQuests as ProfileProgress['dailyQuests']) : base.dailyQuests,
    zenMs: isNum(p.zenMs) && p.zenMs >= 0 ? p.zenMs : base.zenMs,
  }
}

/** A result needs its identity and the fields that charts, records and XP read; optional extras are not checked. */
function isResult(r: unknown): r is TestResult {
  if (!isObj(r)) return false
  const nums = ['wpm', 'raw', 'accuracy', 'durationMs', 'keystrokes', 'xp'] as const
  return (
    typeof r.id === 'string' &&
    typeof r.profileId === 'string' &&
    typeof r.date === 'string' &&
    !Number.isNaN(Date.parse(r.date)) &&
    typeof r.mode === 'string' &&
    isObj(r.config) &&
    nums.every((k) => isNum(r[k])) &&
    Array.isArray(r.samples) &&
    isObj(r.keyHits) &&
    isObj(r.keyMisses)
  )
}

/**
 * Validate and fill in missing fields so older, hand-edited or imported saves keep working. Bad entries are
 * dropped or reset to defaults rather than reaching the UI. Throws only when there is no usable profile.
 */
export function normalize(input: unknown): AppData {
  if (!isObj(input) || !Array.isArray(input.profiles)) throw new Error('invalid')
  const seen = new Set<string>()
  const profiles = input.profiles
    .filter((p): p is Record<string, unknown> => isObj(p) && typeof p.id === 'string' && p.id !== '' && !seen.has(p.id) && !!seen.add(p.id))
    .map((p) => ({
      id: p.id as string,
      name: typeof p.name === 'string' && p.name.trim() ? p.name : 'Player',
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
    }))
  if (profiles.length === 0) throw new Error('invalid')
  const savedProgress = isObj(input.progress) ? input.progress : {}
  const progress: AppData['progress'] = {}
  for (const p of profiles) progress[p.id] = normalizeProgress(savedProgress[p.id])
  const activeProfileId = profiles.some((p) => p.id === input.activeProfileId) ? (input.activeProfileId as string) : profiles[0].id
  const results = Array.isArray(input.results) ? input.results.filter(isResult) : []
  return { version: 1, profiles, activeProfileId, settings: normalizeSettings(input.settings), results, progress }
}

/**
 * Keep storage bounded: cap result count, drop per-second samples from old results, and keep ghost
 * timelines only for the fastest few results of each word count.
 */
export function prune(data: AppData): AppData {
  let results = data.results
  if (results.length > MAX_RESULTS) results = results.slice(results.length - MAX_RESULTS)
  const keepTimeline = new Set<string>()
  const byKey = new Map<string, TestResult[]>()
  for (const r of results) {
    if (!r.timeline) continue
    const k = ghostKey(r)
    if (!k) continue
    const list = byKey.get(k) ?? []
    list.push(r)
    byKey.set(k, list)
  }
  for (const list of byKey.values()) {
    list.sort((a, b) => b.wpm - a.wpm)
    // Keep the top results overall plus each profile's own best, so every player has a ghost.
    list.slice(0, KEEP_TIMELINES_PER_KEY).forEach((r) => keepTimeline.add(r.id))
    const seen = new Set<string>()
    for (const r of list) {
      if (!seen.has(r.profileId)) {
        seen.add(r.profileId)
        keepTimeline.add(r.id)
      }
    }
  }
  const cutoff = results.length - KEEP_SAMPLES
  results = results.map((r, i) => {
    let next = r
    if (r.timeline && !keepTimeline.has(r.id)) next = { ...next, timeline: undefined }
    if (i < cutoff && r.samples.length) next = { ...next, samples: [] }
    return next
  })
  return { ...data, results }
}

/** Results that can be replayed as a ghost share a word count. */
export function ghostKey(r: Pick<TestResult, 'config' | 'valid'>): string | null {
  if (!r.valid || r.config.length?.kind !== 'words') return null
  return `words:${r.config.length.value}`
}

export function saveData(data: AppData): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return null
  } catch (e) {
    const name = (e as Error)?.name
    if (name === 'QuotaExceededError') {
      // Shed older history and try once more.
      const slim = prune({ ...data, results: data.results.slice(Math.floor(data.results.length / 3)) })
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slim))
        return 'Storage was full, so your oldest results were removed to make room.'
      } catch {
        return 'Storage is full. New results cannot be saved until you export and reset your data.'
      }
    }
    return 'Progress could not be saved to browser storage.'
  }
}
