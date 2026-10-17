import type { Category, Difficulty, Language, TestLength, TestResult } from '@/engine/types'

export type ThemeMode = 'dark' | 'light' | 'system'
export type CaretStyle = 'line' | 'block' | 'underline' | 'off'
export type FontSize = 'sm' | 'md' | 'lg' | 'xl'
export type KeyboardLayout = 'qwerty' | 'dvorak' | 'colemak' | 'azerty'
export type SoundProfile = 'click' | 'soft' | 'typewriter'
export type RestartKey = 'tab' | 'shift-enter'

export interface Settings {
  theme: ThemeMode
  sound: boolean
  volume: number
  soundProfile: SoundProfile
  errorSound: boolean
  reducedMotion: 'system' | 'on' | 'off'
  fontSize: FontSize
  caretStyle: CaretStyle
  smoothCaret: boolean
  difficulty: Difficulty
  category: Category
  language: Language
  customText: string
  length: TestLength
  keyboardLayout: KeyboardLayout
  showKeyboard: boolean
  fingerGuide: boolean
  keyboardTheme: string
  arenaTheme: string
  allowBackspace: boolean
  stopOnError: boolean
  autoIndent: boolean
  restartKey: RestartKey
  showLiveStats: boolean
  ambientSound: boolean
  /** Fade the interface away while a run is in progress. */
  focusMode: boolean
  /** Depth, tilt and floating keycaps. Off gives a flat interface. */
  effects3d: boolean
}

export interface Profile {
  id: string
  name: string
  createdAt: string
}

export interface XpAward {
  id: string
  amount: number
  reason: string
  date: string
  /** Prevents the same reward from being granted twice (e.g. a mission for a given day). */
  key?: string
}

export interface ProfileProgress {
  xpLedger: XpAward[]
  achievements: Record<string, string>
  /** Highest boss stage cleared per boss difficulty. */
  boss: Record<string, number>
  /** Daily quest completions keyed by YYYY-MM-DD. */
  dailyQuests: Record<string, string>
  zenMs: number
}

export interface AppData {
  version: 1
  profiles: Profile[]
  activeProfileId: string
  settings: Settings
  results: TestResult[]
  progress: Record<string, ProfileProgress>
}
