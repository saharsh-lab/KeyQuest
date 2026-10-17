/**
 * Progression rules: XP, levels, streaks, personal bests, missions, achievements, unlocks and the daily quest.
 * Everything here is derived from recorded results so rewards always trace back to real typing.
 */
import type { Category, Difficulty, GameMode, TestLength, TestResult } from '@/engine/types'
import { addDays, clamp, dayKey, hashString, mulberry32, pick, startOfWeek, weekKey } from '@/lib/utils'
import type { ProfileProgress } from './types'

// ---------- Levels ----------

/** XP needed to go from `level` to `level + 1`. */
export const xpToNext = (level: number) => 100 + 50 * (level - 1)

export function levelFromXp(xp: number) {
  let level = 1
  let remaining = xp
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level)
    level++
  }
  return { level, into: remaining, needed: xpToNext(level), progress: remaining / xpToNext(level) }
}

export const totalXp = (p: ProfileProgress) => p.xpLedger.reduce((a, b) => a + b.amount, 0)

export const LEVEL_TITLES = [
  'Novice',
  'Apprentice',
  'Key Scout',
  'Wordsmith',
  'Swift Hands',
  'Rhythm Keeper',
  'Flow Runner',
  'Key Knight',
  'Velocity Sage',
  'Grandmaster',
]
export const levelTitle = (level: number) => LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 2))]

// ---------- Validity & XP ----------

export const DIFFICULTY_MULT: Record<Difficulty, number> = { easy: 0.8, medium: 1, hard: 1.25, expert: 1.5 }

/** Modes that produce comparable WPM numbers (Zen and Survival are scored differently). */
export const SPEED_MODES: GameMode[] = ['arena', 'ghost', 'boss', 'code', 'precision', 'daily']

export function validate(r: Pick<TestResult, 'completed' | 'keystrokes' | 'accuracy' | 'durationMs' | 'raw' | 'mode'>): string | undefined {
  if (!r.completed) return 'Run was not finished'
  if (r.mode === 'survival') return r.durationMs < 10000 ? 'Survived under 10 seconds' : undefined
  if (r.keystrokes < 10) return 'Too few keystrokes'
  if (r.durationMs < 2000) return 'Too short'
  if (r.accuracy < 50) return 'Accuracy below 50%'
  if (r.raw < 5) return 'Looks idle (raw speed under 5 WPM)'
  return undefined
}

/** Base XP for a valid run: words typed correctly, scaled by difficulty and accuracy. */
export function baseXp(r: Pick<TestResult, 'correctChars' | 'accuracy' | 'config'>): number {
  const accFactor = clamp((r.accuracy - 60) / 35, 0.2, 1)
  return Math.max(1, Math.round((r.correctChars / 5) * DIFFICULTY_MULT[r.config.difficulty] * accFactor))
}

// ---------- Personal bests ----------

export function lengthLabel(l?: TestLength) {
  if (!l) return ''
  return l.kind === 'time' ? `${l.value}s` : `${l.value} words`
}

export function pbKey(r: Pick<TestResult, 'mode' | 'config'>): string {
  const c = r.config
  return [r.mode, c.length ? `${c.length.kind}${c.length.value}` : '', c.difficulty, c.category, c.language ?? '', c.codeLanguage ?? '', c.variant ?? ''].join('|')
}

export function bestFor(results: TestResult[], key: string): TestResult | undefined {
  let best: TestResult | undefined
  for (const r of results) if (r.valid && pbKey(r) === key && (!best || r.wpm > best.wpm)) best = r
  return best
}

// ---------- Streaks ----------

export function activeDays(results: TestResult[]): Set<string> {
  const s = new Set<string>()
  for (const r of results) if (r.valid) s.add(dayKey(new Date(r.date)))
  return s
}

/** Consecutive days with at least one valid run, ending today (or yesterday if today has none yet). */
export function currentStreak(results: TestResult[]): number {
  const days = activeDays(results)
  let d = dayKey()
  if (!days.has(d)) d = addDays(d, -1)
  let n = 0
  while (days.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export function longestStreak(results: TestResult[]): number {
  const days = [...activeDays(results)].sort()
  let best = 0
  let run = 0
  let prev = ''
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

// ---------- Daily quest ----------

export interface DailyQuest {
  day: string
  title: string
  category: Exclude<Category, 'custom'>
  difficulty: Difficulty
  length: TestLength
  targetWpm: number
  minAccuracy: number
  xp: number
}

const QUEST_TITLES: Record<DailyQuest['category'], string[]> = {
  common: ['Everyday Express', 'Plain Words Sprint', 'The Common Road'],
  programming: ['Compiler’s Gauntlet', 'Syntax Sprint', 'Refactor Run'],
  technology: ['Circuit Dash', 'Silicon Sprint', 'Bandwidth Burst'],
  quotes: ['Words of the Wise', 'Quote Marathon', 'Echoes of Greatness'],
}

/**
 * Deterministic for a given day. The WPM target adapts to the player's average from before today,
 * so it stays fixed for the whole day no matter how many attempts they make.
 */
export function dailyQuest(results: TestResult[], day = dayKey()): DailyQuest {
  const rng = mulberry32(hashString(`quest:${day}`))
  const category = pick(['common', 'programming', 'technology', 'quotes'] as const, rng)
  const difficulty = pick(['easy', 'medium', 'medium', 'hard'] as const, rng)
  const length = pick(
    [
      { kind: 'words', value: 25 },
      { kind: 'words', value: 50 },
      { kind: 'time', value: 30 },
      { kind: 'time', value: 60 },
    ] as TestLength[],
    rng,
  )
  const prior = results.filter((r) => r.valid && SPEED_MODES.includes(r.mode) && dayKey(new Date(r.date)) < day).slice(-10)
  const avg = prior.length ? prior.reduce((a, r) => a + r.wpm, 0) / prior.length : 30
  const stretch = 0.95 + rng() * 0.15
  const targetWpm = Math.max(20, Math.round((avg * stretch) / 5) * 5)
  const minAccuracy = pick([90, 92, 94, 95], rng)
  return { day, title: pick(QUEST_TITLES[category], rng), category, difficulty, length, targetWpm, minAccuracy, xp: 150 }
}

export const meetsQuest = (q: DailyQuest, r: TestResult) => r.valid && r.wpm >= q.targetWpm && r.accuracy >= q.minAccuracy

// ---------- Missions ----------

export interface MissionDef {
  id: string
  title: string
  target: number
  xp: number
  measure: (results: TestResult[], progress: ProfileProgress, periodStart: Date) => number
}

const valid = (rs: TestResult[]) => rs.filter((r) => r.valid)
const sum = (rs: TestResult[], f: (r: TestResult) => number) => rs.reduce((a, r) => a + f(r), 0)

const DAILY_POOL: MissionDef[] = [
  { id: 'd-tests-3', title: 'Complete 3 runs', target: 3, xp: 40, measure: (rs) => valid(rs).length },
  { id: 'd-tests-5', title: 'Complete 5 runs', target: 5, xp: 60, measure: (rs) => valid(rs).length },
  { id: 'd-chars-1500', title: 'Type 1,500 correct characters', target: 1500, xp: 50, measure: (rs) => sum(valid(rs), (r) => r.correctChars) },
  { id: 'd-chars-3000', title: 'Type 3,000 correct characters', target: 3000, xp: 80, measure: (rs) => sum(valid(rs), (r) => r.correctChars) },
  { id: 'd-acc-95', title: 'Finish a 30s+ run at 95% accuracy', target: 1, xp: 50, measure: (rs) => valid(rs).filter((r) => r.accuracy >= 95 && r.durationMs >= 28000).length },
  { id: 'd-mode', title: 'Play 2 different game modes', target: 2, xp: 50, measure: (rs) => new Set(valid(rs).filter((r) => r.mode !== 'arena').map((r) => r.mode)).size },
  { id: 'd-code', title: 'Clear a Code Rush snippet', target: 1, xp: 40, measure: (rs) => valid(rs).filter((r) => r.mode === 'code').length },
  { id: 'd-precision', title: 'Score 97% accuracy in Precision', target: 1, xp: 60, measure: (rs) => valid(rs).filter((r) => r.mode === 'precision' && r.accuracy >= 97).length },
  { id: 'd-boss', title: 'Defeat a boss', target: 1, xp: 60, measure: (rs) => rs.filter((r) => r.mode === 'boss' && r.meta?.won).length },
  { id: 'd-hard', title: 'Finish a run on Hard or Expert', target: 1, xp: 50, measure: (rs) => valid(rs).filter((r) => r.config.difficulty === 'hard' || r.config.difficulty === 'expert').length },
]

const WEEKLY_POOL: MissionDef[] = [
  { id: 'w-tests-20', title: 'Complete 20 runs', target: 20, xp: 200, measure: (rs) => valid(rs).length },
  { id: 'w-chars-15k', title: 'Type 15,000 correct characters', target: 15000, xp: 250, measure: (rs) => sum(valid(rs), (r) => r.correctChars) },
  { id: 'w-days-5', title: 'Practice on 5 different days', target: 5, xp: 250, measure: (rs) => activeDays(rs).size },
  { id: 'w-boss-3', title: 'Defeat 3 bosses', target: 3, xp: 200, measure: (rs) => rs.filter((r) => r.mode === 'boss' && r.meta?.won).length },
  { id: 'w-ghost', title: 'Beat a ghost in Ghost Race', target: 1, xp: 150, measure: (rs) => rs.filter((r) => r.mode === 'ghost' && r.meta?.won).length },
  { id: 'w-survive-90', title: 'Survive 90 seconds', target: 1, xp: 200, measure: (rs) => rs.filter((r) => r.mode === 'survival' && r.durationMs >= 90000).length },
  {
    id: 'w-quests-3',
    title: 'Complete 3 Daily Quests',
    target: 3,
    xp: 250,
    measure: (_rs, p, start) => Object.keys(p.dailyQuests).filter((d) => d >= dayKey(start)).length,
  },
]

export interface MissionState extends MissionDef {
  period: 'daily' | 'weekly'
  key: string
  value: number
  done: boolean
}

export function activeMissions(results: TestResult[], progress: ProfileProgress, now = new Date()): MissionState[] {
  const today = dayKey(now)
  const wk = weekKey(now)
  const ws = startOfWeek(now)
  const dRng = mulberry32(hashString(`missions:${today}`))
  const wRng = mulberry32(hashString(`weekly:${wk}`))
  const pickN = (pool: MissionDef[], n: number, rng: () => number) => {
    const copy = pool.slice()
    const out: MissionDef[] = []
    while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0])
    return out
  }
  const todays = results.filter((r) => dayKey(new Date(r.date)) === today)
  const weeks = results.filter((r) => new Date(r.date) >= ws)
  return [
    ...pickN(DAILY_POOL, 3, dRng).map((m) => ({ ...m, period: 'daily' as const, key: `mission:${m.id}:${today}`, rs: todays })),
    ...pickN(WEEKLY_POOL, 3, wRng).map((m) => ({ ...m, period: 'weekly' as const, key: `mission:${m.id}:${wk}`, rs: weeks })),
  ].map(({ rs, ...m }) => {
    const value = Math.min(m.target, m.measure(rs, progress, ws))
    return { ...m, value, done: value >= m.target }
  })
}

// ---------- Achievements ----------

export interface AchievementCtx {
  results: TestResult[]
  progress: ProfileProgress
  streak: number
}

export interface AchievementDef {
  id: string
  title: string
  description: string
  icon: string
  xp: number
  check: (c: AchievementCtx) => boolean
}

const speedRuns = (c: AchievementCtx) => c.results.filter((r) => r.valid && SPEED_MODES.includes(r.mode) && r.correctChars >= 100)
const speed = (w: number) => (c: AchievementCtx) => speedRuns(c).some((r) => r.wpm >= w)

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-steps', title: 'First Steps', description: 'Complete your first run.', icon: 'Footprints', xp: 25, check: (c) => c.results.some((r) => r.valid) },
  { id: 'speed-40', title: 'Picking Up Pace', description: 'Reach 40 WPM (100+ characters).', icon: 'Gauge', xp: 50, check: speed(40) },
  { id: 'speed-60', title: 'Swift Fingers', description: 'Reach 60 WPM (100+ characters).', icon: 'Zap', xp: 100, check: speed(60) },
  { id: 'speed-80', title: 'Blur', description: 'Reach 80 WPM (100+ characters).', icon: 'Wind', xp: 150, check: speed(80) },
  { id: 'speed-100', title: 'Triple Digits', description: 'Reach 100 WPM (100+ characters).', icon: 'Rocket', xp: 250, check: speed(100) },
  { id: 'speed-120', title: 'Light Speed', description: 'Reach 120 WPM (100+ characters).', icon: 'Sparkles', xp: 400, check: speed(120) },
  { id: 'flawless', title: 'Flawless', description: '100% accuracy over 100+ characters.', icon: 'Gem', xp: 100, check: (c) => speedRuns(c).some((r) => r.accuracy === 100) },
  { id: 'marathon', title: 'Marathoner', description: 'Complete a 120-second test.', icon: 'Timer', xp: 75, check: (c) => c.results.some((r) => r.valid && r.config.length?.kind === 'time' && r.config.length.value === 120) },
  { id: 'dedicated', title: 'Dedicated', description: 'Complete 25 runs.', icon: 'Repeat', xp: 100, check: (c) => c.results.filter((r) => r.valid).length >= 25 },
  { id: 'veteran', title: 'Veteran', description: 'Complete 100 runs.', icon: 'Medal', xp: 300, check: (c) => c.results.filter((r) => r.valid).length >= 100 },
  { id: 'streak-3', title: 'Warming Up', description: 'Keep a 3-day streak.', icon: 'Flame', xp: 60, check: (c) => c.streak >= 3 },
  { id: 'streak-7', title: 'On Fire', description: 'Keep a 7-day streak.', icon: 'Flame', xp: 150, check: (c) => c.streak >= 7 },
  { id: 'streak-30', title: 'Unstoppable', description: 'Keep a 30-day streak.', icon: 'Crown', xp: 500, check: (c) => c.streak >= 30 },
  { id: 'ghostbuster', title: 'Ghostbuster', description: 'Beat your own ghost in Ghost Race.', icon: 'Ghost', xp: 100, check: (c) => c.results.some((r) => r.mode === 'ghost' && r.meta?.won && r.meta?.opponent === 'self') },
  { id: 'boss-3', title: 'Giant Slayer', description: 'Clear boss stage 3 on any difficulty.', icon: 'Swords', xp: 100, check: (c) => Object.values(c.progress.boss).some((s) => s >= 3) },
  { id: 'boss-5', title: 'Dungeon Master', description: 'Clear the final boss stage.', icon: 'Skull', xp: 250, check: (c) => Object.values(c.progress.boss).some((s) => s >= 5) },
  { id: 'nightmare', title: 'Nightmare Walker', description: 'Clear any boss on Nightmare.', icon: 'Moon', xp: 200, check: (c) => (c.progress.boss.nightmare ?? 0) >= 1 },
  { id: 'survivor-60', title: 'Survivor', description: 'Last 60 seconds in Survival.', icon: 'Shield', xp: 75, check: (c) => c.results.some((r) => r.mode === 'survival' && r.durationMs >= 60000) },
  { id: 'survivor-180', title: 'Last One Standing', description: 'Last 3 minutes in Survival.', icon: 'ShieldCheck', xp: 200, check: (c) => c.results.some((r) => r.mode === 'survival' && r.durationMs >= 180000) },
  {
    id: 'polyglot',
    title: 'Polyglot Coder',
    description: 'Clear Code Rush in Java, Python, JavaScript and SQL.',
    icon: 'Code',
    xp: 150,
    check: (c) => new Set(c.results.filter((r) => r.valid && r.mode === 'code').map((r) => r.config.codeLanguage)).size >= 4,
  },
  { id: 'sharpshooter', title: 'Sharpshooter', description: 'Reach a 150-character streak in Precision.', icon: 'Crosshair', xp: 120, check: (c) => c.results.some((r) => r.mode === 'precision' && Number(r.meta?.bestStreak ?? 0) >= 150) },
  { id: 'quest-1', title: 'Questing', description: 'Complete a Daily Quest.', icon: 'Map', xp: 50, check: (c) => Object.keys(c.progress.dailyQuests).length >= 1 },
  { id: 'quest-7', title: 'Seasoned Adventurer', description: 'Complete 7 Daily Quests.', icon: 'Compass', xp: 200, check: (c) => Object.keys(c.progress.dailyQuests).length >= 7 },
  { id: 'zen-10', title: 'Inner Calm', description: 'Spend 10 minutes typing in Zen mode.', icon: 'Leaf', xp: 75, check: (c) => c.progress.zenMs >= 600000 },
  { id: 'expert-50', title: 'Expert Hands', description: 'Reach 50 WPM on Expert difficulty.', icon: 'Award', xp: 150, check: (c) => speedRuns(c).some((r) => r.config.difficulty === 'expert' && r.wpm >= 50) },
  { id: 'pb-5', title: 'Always Improving', description: 'Set 5 new personal bests.', icon: 'TrendingUp', xp: 100, check: (c) => c.results.filter((r) => r.isPB && r.meta?.beatPrevious).length >= 5 },
]

// ---------- Unlocks ----------

export interface Unlock {
  id: string
  name: string
  requirement: string
  unlocked: (c: { level: number; achievements: Record<string, string> }) => boolean
}

export const KEYBOARD_THEMES: (Unlock & { swatch: string })[] = [
  { id: 'graphite', name: 'Graphite', swatch: '#2a2b30', requirement: 'Available from the start', unlocked: () => true },
  { id: 'outline', name: 'Outline', swatch: 'transparent', requirement: 'Reach level 2', unlocked: (c) => c.level >= 2 },
  { id: 'lime', name: 'Lime Pop', swatch: '#c6f432', requirement: 'Reach level 4', unlocked: (c) => c.level >= 4 },
  { id: 'retro', name: 'Retro Beige', swatch: '#d9cfb8', requirement: 'Earn “On Fire” (7-day streak)', unlocked: (c) => !!c.achievements['streak-7'] },
  { id: 'ocean', name: 'Deep Ocean', swatch: '#1b3b5a', requirement: 'Reach level 8', unlocked: (c) => c.level >= 8 },
]

export const ARENA_THEMES: (Unlock & { swatch: string })[] = [
  { id: 'default', name: 'Default', swatch: 'var(--surface)', requirement: 'Available from the start', unlocked: () => true },
  { id: 'focus', name: 'Focus', swatch: 'var(--surface-2)', requirement: 'Reach level 2', unlocked: (c) => c.level >= 2 },
  { id: 'terminal', name: 'Terminal', swatch: '#0b0d0b', requirement: 'Earn “Polyglot Coder” or reach level 6', unlocked: (c) => c.level >= 6 || !!c.achievements.polyglot },
  { id: 'paper', name: 'Paper', swatch: '#f3efe4', requirement: 'Reach level 5', unlocked: (c) => c.level >= 5 },
  { id: 'midnight', name: 'Midnight', swatch: '#0e1424', requirement: 'Earn “Giant Slayer” (boss stage 3)', unlocked: (c) => !!c.achievements['boss-3'] },
]

/** Difficulty unlocks: by level, or earlier by proving the skill on the tier below. */
export function difficultyUnlocked(d: Difficulty, level: number, results: TestResult[]): boolean {
  const proven = (tier: Difficulty, w: number) =>
    results.some((r) => r.valid && SPEED_MODES.includes(r.mode) && r.config.difficulty === tier && r.wpm >= w && r.accuracy >= 95 && r.correctChars >= 100)
  if (d === 'easy' || d === 'medium') return true
  if (d === 'hard') return level >= 3 || proven('medium', 50)
  return level >= 6 || proven('hard', 65)
}

export const DIFFICULTY_REQ: Record<Difficulty, string> = {
  easy: '',
  medium: '',
  hard: 'Reach level 3, or hit 50 WPM at 95% on Medium (100+ chars)',
  expert: 'Reach level 6, or hit 65 WPM at 95% on Hard (100+ chars)',
}

// ---------- Insights ----------

export interface KeyStat {
  key: string
  hits: number
  misses: number
  rate: number
}

export function keyStats(results: TestResult[], limit = 30): KeyStat[] {
  const hits: Record<string, number> = {}
  const misses: Record<string, number> = {}
  for (const r of results.slice(-limit)) {
    for (const [k, v] of Object.entries(r.keyHits ?? {})) hits[k] = (hits[k] ?? 0) + v
    for (const [k, v] of Object.entries(r.keyMisses ?? {})) misses[k] = (misses[k] ?? 0) + v
  }
  return Object.keys(hits)
    .map((key) => ({ key, hits: hits[key], misses: misses[key] ?? 0, rate: (misses[key] ?? 0) / hits[key] }))
    .sort((a, b) => b.rate - a.rate || b.misses - a.misses)
}

export function weakKeys(results: TestResult[], n = 6): KeyStat[] {
  return keyStats(results)
    .filter((k) => k.hits >= 8 && k.misses >= 2)
    .slice(0, n)
}

export interface Recommendation {
  title: string
  detail: string
  action?: { label: string; href: string }
}

/** Practice advice drawn only from the run (and recent history) passed in. */
export function recommendations(r: TestResult, history: TestResult[]): Recommendation[] {
  const recs: Recommendation[] = []
  const weak = Object.entries(r.keyMisses)
    .filter(([k, n]) => n >= 2 || (n / (r.keyHits[k] ?? 1) >= 0.25 && (r.keyHits[k] ?? 0) >= 3))
    .sort((a, b) => b[1] / (r.keyHits[b[0]] ?? 1) - a[1] / (r.keyHits[a[0]] ?? 1))
    .slice(0, 3)
    .map(([k]) => (k === ' ' ? 'space' : k))
  if (r.accuracy < 92) {
    recs.push({
      title: 'Slow down to speed up',
      detail: `Accuracy was ${r.accuracy.toFixed(1)}%. Aim for 95%+ first; corrections cost more time than they save. Precision mode rewards clean streaks.`,
      action: { label: 'Try Precision', href: '#/play/precision' },
    })
  }
  if (weak.length) {
    recs.push({
      title: `Drill ${weak.map((k) => `“${k}”`).join(', ')}`,
      detail: 'These keys had the highest miss rate this run. Turn on finger guidance in Settings to check which finger should reach them.',
    })
  }
  if (r.consistency < 65 && r.samples.length >= 5) {
    recs.push({
      title: 'Find a steadier rhythm',
      detail: `Consistency was ${Math.round(r.consistency)}%. Your speed swung a lot second to second. Zen mode is a low-pressure way to settle into an even pace.`,
      action: { label: 'Open Zen', href: '#/play/zen' },
    })
  }
  const prev = history.filter((h) => h.valid && h.id !== r.id && SPEED_MODES.includes(h.mode)).slice(-10)
  if (prev.length >= 3) {
    const avg = prev.reduce((a, h) => a + h.wpm, 0) / prev.length
    if (r.wpm > avg * 1.08 && r.accuracy >= 95) {
      recs.push({
        title: 'Ready for a harder tier',
        detail: `This run beat your recent average of ${Math.round(avg)} WPM by ${Math.round(r.wpm - avg)} at high accuracy. Try the next difficulty or a Boss Battle.`,
        action: { label: 'Boss Battle', href: '#/play/boss' },
      })
    }
  }
  if (r.backspaces > r.keystrokes * 0.15) {
    recs.push({
      title: 'Fewer backspaces',
      detail: `You pressed backspace ${r.backspaces} times. Try finishing words even with a typo, then fix the habit in Precision mode.`,
    })
  }
  if (!recs.length) {
    recs.push({
      title: 'Solid run',
      detail: 'Nothing stood out as a weakness. Push the pace with a Ghost Race against your best run.',
      action: { label: 'Ghost Race', href: '#/play/ghost' },
    })
  }
  return recs.slice(0, 3)
}
