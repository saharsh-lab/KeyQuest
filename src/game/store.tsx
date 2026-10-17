/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { GameMode, ResultConfig, TestResult } from '@/engine/types'
import type { SessionSummary } from '@/engine/useTypingSession'
import { dayKey, round, uid } from '@/lib/utils'
import {
  ACHIEVEMENTS,
  activeMissions,
  baseXp,
  bestFor,
  currentStreak,
  dailyQuest,
  levelFromXp,
  meetsQuest,
  pbKey,
  SPEED_MODES,
  totalXp,
  validate,
  type AchievementDef,
  type MissionState,
} from './progression'
import { emptyProgress, loadData, normalize, prune, saveData } from './storage'
import type { AppData, Profile, ProfileProgress, Settings, XpAward } from './types'

export interface RecordInput {
  summary: SessionSummary
  mode: GameMode
  config: ResultConfig
  meta?: Record<string, number | string | boolean>
  /** Boss stage cleared on this run, if any. */
  bossCleared?: { difficulty: string; stage: number }
  /** Mode-specific XP adjustments computed by the mode itself (never granted for invalid runs). */
  modeXp?: (r: TestResult, firstTime: boolean) => { amount: number; reason: string } | null
}

export interface RecordOutcome {
  result: TestResult
  previous?: TestResult
  previousBest?: TestResult
  xp: { reason: string; amount: number }[]
  xpTotal: number
  newAchievements: AchievementDef[]
  completedMissions: MissionState[]
  questCompleted: boolean
  levelBefore: number
  levelAfter: number
}

export interface Celebration {
  id: string
  kind: 'level' | 'achievement' | 'mission' | 'quest' | 'pb'
  title: string
  detail: string
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Everything one run earned, as a single toast, so a big run does not bury the screen in notifications. */
export function combineCelebrations(level: number | null, quest: boolean, achievements: Pick<AchievementDef, 'title'>[], missions: Pick<MissionState, 'title'>[]): Celebration {
  const title = [
    level !== null ? `Level ${level}` : null,
    quest ? 'Daily Quest complete' : null,
    achievements.length ? `${plural(achievements.length, 'achievement')} unlocked` : null,
    missions.length ? `${plural(missions.length, 'mission')} complete` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const names = [...achievements, ...missions].map((x) => x.title)
  const shown = names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ')
  return { id: uid(), kind: level !== null ? 'level' : achievements.length ? 'achievement' : missions.length ? 'mission' : 'quest', title, detail: shown || 'See your results for details.' }
}

interface StoreValue {
  data: AppData
  profile: Profile
  progress: ProfileProgress
  settings: Settings
  results: TestResult[]
  allResults: TestResult[]
  xp: number
  level: ReturnType<typeof levelFromXp>
  streak: number
  storageError: string | null
  dismissStorageError: () => void
  updateSettings: (patch: Partial<Settings>) => void
  recordResult: (input: RecordInput) => RecordOutcome
  addProfile: (name: string) => void
  switchProfile: (id: string) => void
  renameProfile: (id: string, name: string) => void
  deleteProfile: (id: string) => void
  resetProfile: (id: string) => void
  importData: (json: string) => string | null
  exportData: () => string
  celebrations: Celebration[]
  dismissCelebration: (id: string) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadData)
  const [data, setDataState] = useState<AppData>(initial.data)
  const [storageError, setStorageError] = useState<string | null>(initial.error ?? null)
  const [celebrations, setCelebrations] = useState<Celebration[]>([])
  const dataRef = useRef(data)

  const setData = useCallback((next: AppData) => {
    dataRef.current = next
    setDataState(next)
  }, [])

  // Persist after every change (batched by React; cheap at this size).
  useEffect(() => {
    const err = saveData(prune(data))
    if (err) setStorageError(err)
  }, [data])

  // Sync across tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'keyquest:v1' || !e.newValue) return
      try {
        setData(normalize(JSON.parse(e.newValue)))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [setData])

  const profile = data.profiles.find((p) => p.id === data.activeProfileId) ?? data.profiles[0]
  const progress = data.progress[profile.id] ?? emptyProgress()
  const results = useMemo(() => data.results.filter((r) => r.profileId === profile.id), [data.results, profile.id])
  const xp = totalXp(progress)
  const level = levelFromXp(xp)
  const streak = useMemo(() => currentStreak(results), [results])

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const d = dataRef.current
      setData({ ...d, settings: { ...d.settings, ...patch } })
    },
    [setData],
  )

  const recordResult = useCallback(
    (input: RecordInput): RecordOutcome => {
      const d = dataRef.current
      const pid = d.activeProfileId
      const prog = d.progress[pid] ?? emptyProgress()
      const mine = d.results.filter((r) => r.profileId === pid)
      const s = input.summary
      const now = new Date()
      const today = dayKey(now)

      const draft: TestResult = {
        id: uid(),
        profileId: pid,
        date: now.toISOString(),
        mode: input.mode,
        config: input.config,
        wpm: round(s.wpm, 2),
        raw: round(s.raw, 2),
        accuracy: round(s.accuracy, 2),
        consistency: round(s.consistency, 1),
        correctChars: s.correctChars,
        incorrectChars: s.incorrectChars,
        errors: s.errors,
        keystrokes: s.keystrokes,
        backspaces: s.backspaces,
        durationMs: Math.round(s.durationMs),
        totalChars: s.totalChars,
        completed: s.completed,
        valid: false,
        samples: s.samples,
        keyHits: s.keyHits,
        keyMisses: s.keyMisses,
        timeline: input.config.length?.kind === 'words' && s.reason === 'complete' ? s.timeline : undefined,
        xp: 0,
        isPB: false,
        meta: { ...input.meta, bestStreak: s.bestStreak },
      }
      draft.invalidReason = validate(draft)
      draft.valid = !draft.invalidReason

      const key = pbKey(draft)
      const previousBest = bestFor(mine, key)
      const previous = [...mine].reverse().find((r) => pbKey(r) === key)
      const comparable = SPEED_MODES.includes(draft.mode)
      if (draft.valid && comparable && (!previousBest || draft.wpm > previousBest.wpm)) {
        draft.isPB = true
        draft.meta = { ...draft.meta, beatPrevious: !!previousBest }
      }

      const awards: XpAward[] = []
      const grant = (amount: number, reason: string, k?: string) => {
        if (amount <= 0) return
        if (k && prog.xpLedger.some((a) => a.key === k)) return
        awards.push({ id: uid(), amount: Math.round(amount), reason, date: now.toISOString(), key: k })
      }

      let nextProg: ProfileProgress = { ...prog }
      let questCompleted = false

      if (draft.valid) {
        if (draft.mode === 'zen') {
          // Zen: modest XP for clean typing, capped per day so it cannot be farmed.
          const cap = 60
          const earnedToday = prog.xpLedger.filter((a) => a.reason === 'Zen session' && dayKey(new Date(a.date)) === today).reduce((x, a) => x + a.amount, 0)
          const amount = draft.accuracy >= 85 ? Math.min(cap - earnedToday, Math.floor(draft.correctChars / 10)) : 0
          grant(amount, 'Zen session')
        } else if (draft.mode !== 'survival') {
          grant(baseXp(draft), 'Typing')
        }
        if (draft.isPB && draft.meta?.beatPrevious) grant(25, 'New personal best')
        if (input.bossCleared) {
          const before = prog.boss[input.bossCleared.difficulty] ?? 0
          if (input.bossCleared.stage > before) nextProg = { ...nextProg, boss: { ...prog.boss, [input.bossCleared.difficulty]: input.bossCleared.stage } }
        }
        const firstTime = input.bossCleared ? input.bossCleared.stage > (prog.boss[input.bossCleared.difficulty] ?? 0) : true
        const extra = input.modeXp?.(draft, firstTime)
        if (extra) grant(extra.amount, extra.reason)
        if (draft.mode === 'daily') {
          const q = dailyQuest(mine, today)
          if (meetsQuest(q, draft) && !prog.dailyQuests[today]) {
            nextProg = { ...nextProg, dailyQuests: { ...nextProg.dailyQuests, [today]: draft.id } }
            grant(q.xp, 'Daily Quest', `quest:${today}`)
            questCompleted = true
          }
        }
      }
      if (draft.mode === 'zen') nextProg = { ...nextProg, zenMs: prog.zenMs + draft.durationMs }

      const runXp = awards.reduce((a, b) => a + b.amount, 0)
      draft.xp = runXp
      const nextMine = [...mine, draft]

      // Missions completed by this run.
      const missionsBefore = activeMissions(mine, prog, now)
      nextProg = { ...nextProg, xpLedger: [...prog.xpLedger, ...awards] }
      const missionsAfter = activeMissions(nextMine, nextProg, now)
      const completedMissions = missionsAfter.filter((m) => m.done && !missionsBefore.find((b) => b.key === m.key)?.done && !nextProg.xpLedger.some((a) => a.key === m.key))
      for (const m of completedMissions) grant(m.xp, `Mission: ${m.title}`, m.key)

      // Achievements.
      const ctx = { results: nextMine, progress: nextProg, streak: currentStreak(nextMine) }
      const newAchievements = ACHIEVEMENTS.filter((a) => !prog.achievements[a.id] && a.check(ctx))
      const achievements = { ...prog.achievements }
      for (const a of newAchievements) {
        achievements[a.id] = now.toISOString()
        grant(a.xp, `Achievement: ${a.title}`, `ach:${a.id}`)
      }

      nextProg = { ...nextProg, achievements, xpLedger: [...prog.xpLedger, ...awards] }
      const levelBefore = levelFromXp(totalXp(prog)).level
      const levelAfter = levelFromXp(totalXp(nextProg)).level

      setData({ ...d, results: [...d.results, draft], progress: { ...d.progress, [pid]: nextProg } })

      // Celebrations (shown as toasts).
      const cel: Celebration[] = []
      if (levelAfter > levelBefore) cel.push({ id: uid(), kind: 'level', title: `Level ${levelAfter}`, detail: 'You leveled up. New rewards may be unlocked.' })
      if (questCompleted) cel.push({ id: uid(), kind: 'quest', title: 'Daily Quest complete', detail: '+150 XP' })
      for (const a of newAchievements) cel.push({ id: uid(), kind: 'achievement', title: a.title, detail: `${a.description} +${a.xp} XP` })
      for (const m of completedMissions) cel.push({ id: uid(), kind: 'mission', title: `${m.period === 'daily' ? 'Daily' : 'Weekly'} mission complete`, detail: `${m.title} +${m.xp} XP` })
      if (cel.length) setCelebrations((c) => [...c, cel.length === 1 ? cel[0] : combineCelebrations(levelAfter > levelBefore ? levelAfter : null, questCompleted, newAchievements, completedMissions)])

      return {
        result: draft,
        previous,
        previousBest,
        xp: awards.map((a) => ({ reason: a.reason, amount: a.amount })),
        xpTotal: awards.reduce((a, b) => a + b.amount, 0),
        newAchievements,
        completedMissions,
        questCompleted,
        levelBefore,
        levelAfter,
      }
    },
    [setData],
  )

  const addProfile = useCallback(
    (name: string) => {
      const d = dataRef.current
      const id = uid()
      setData({
        ...d,
        profiles: [...d.profiles, { id, name: name.trim() || `Player ${d.profiles.length + 1}`, createdAt: new Date().toISOString() }],
        progress: { ...d.progress, [id]: emptyProgress() },
        activeProfileId: id,
      })
    },
    [setData],
  )

  const switchProfile = useCallback((id: string) => setData({ ...dataRef.current, activeProfileId: id }), [setData])

  const renameProfile = useCallback(
    (id: string, name: string) => {
      const d = dataRef.current
      setData({ ...d, profiles: d.profiles.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)) })
    },
    [setData],
  )

  const deleteProfile = useCallback(
    (id: string) => {
      const d = dataRef.current
      if (d.profiles.length <= 1) return
      const profiles = d.profiles.filter((p) => p.id !== id)
      const progress = { ...d.progress }
      delete progress[id]
      setData({
        ...d,
        profiles,
        progress,
        results: d.results.filter((r) => r.profileId !== id),
        activeProfileId: d.activeProfileId === id ? profiles[0].id : d.activeProfileId,
      })
    },
    [setData],
  )

  const resetProfile = useCallback(
    (id: string) => {
      const d = dataRef.current
      setData({ ...d, results: d.results.filter((r) => r.profileId !== id), progress: { ...d.progress, [id]: emptyProgress() } })
    },
    [setData],
  )

  const importData = useCallback(
    (json: string) => {
      try {
        setData(normalize(JSON.parse(json)))
        return null
      } catch {
        return 'That file is not a valid KeyQuest export.'
      }
    },
    [setData],
  )

  const exportData = useCallback(() => JSON.stringify(dataRef.current, null, 2), [])

  const value: StoreValue = {
    data,
    profile,
    progress,
    settings: data.settings,
    results,
    allResults: data.results,
    xp,
    level,
    streak,
    storageError,
    dismissStorageError: () => setStorageError(null),
    updateSettings,
    recordResult,
    addProfile,
    switchProfile,
    renameProfile,
    deleteProfile,
    resetProfile,
    importData,
    exportData,
    celebrations,
    dismissCelebration: (id) => setCelebrations((c) => c.filter((x) => x.id !== id)),
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const v = useContext(StoreContext)
  if (!v) throw new Error('useStore must be used inside StoreProvider')
  return v
}

