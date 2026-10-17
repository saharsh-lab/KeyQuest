export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'
export type Category = 'common' | 'programming' | 'technology' | 'quotes' | 'custom'
export type Language = 'english' | 'spanish' | 'french' | 'german'
export type CodeLanguage = 'javascript' | 'python' | 'java' | 'sql'

export type TestLength = { kind: 'time'; value: 15 | 30 | 60 | 120 } | { kind: 'words'; value: 10 | 25 | 50 | 100 }

export type GameMode = 'arena' | 'ghost' | 'boss' | 'survival' | 'code' | 'precision' | 'daily' | 'zen'

/** Options that change how keystrokes are interpreted. */
export interface TypingBehavior {
  allowBackspace: boolean
  stopOnError: boolean
  autoIndent: boolean
}

/** One character the player has put into the buffer at a target position. */
export interface TypedChar {
  ch: string
  correct: boolean
  /** Inserted automatically (code indentation). Excluded from every metric. */
  auto: boolean
}

/**
 * Event log entry. `net` is the number of correct, non-auto characters in the buffer after the event,
 * which is everything needed to rebuild live WPM, per-second graphs and ghost replays after the fact.
 */
export interface LogEvent {
  t: number
  kind: 'char' | 'back'
  correct: boolean
  net: number
}

export interface PerSecondSample {
  s: number
  wpm: number
  raw: number
  errors: number
}

export interface ResultConfig {
  length?: TestLength
  difficulty: Difficulty
  category: Category | 'code'
  language?: Language
  codeLanguage?: CodeLanguage
  /** Mode-specific variant, e.g. boss stage or ghost opponent. */
  variant?: string
}

export interface TestResult {
  id: string
  profileId: string
  date: string
  mode: GameMode
  config: ResultConfig
  wpm: number
  raw: number
  accuracy: number
  consistency: number
  correctChars: number
  incorrectChars: number
  errors: number
  keystrokes: number
  backspaces: number
  durationMs: number
  totalChars: number
  completed: boolean
  valid: boolean
  invalidReason?: string
  samples: PerSecondSample[]
  keyHits: Record<string, number>
  keyMisses: Record<string, number>
  /** Flattened [ms, net, ms, net, ...] progress curve used for ghost replays (kept only for top results). */
  timeline?: number[]
  xp: number
  isPB: boolean
  meta?: Record<string, number | string | boolean>
}
