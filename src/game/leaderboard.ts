/**
 * Leaderboard architecture. The UI only talks to a LeaderboardProvider, so an online provider
 * (backed by accounts and a server) can replace LocalLeaderboardProvider without touching the page.
 * KeyQuest ships with the local provider only: there is no backend, so nothing here is presented as global.
 */
import type { Difficulty, TestResult } from '@/engine/types'
import { ghostKey } from './storage'
import type { AppData } from './types'

export type BoardId = 'time15' | 'time30' | 'time60' | 'time120' | 'words10' | 'words25' | 'words50' | 'words100' | 'survival' | 'precision'

export const BOARDS: { id: BoardId; label: string; metric: 'wpm' | 'time' | 'score' }[] = [
  { id: 'time15', label: '15s', metric: 'wpm' },
  { id: 'time30', label: '30s', metric: 'wpm' },
  { id: 'time60', label: '60s', metric: 'wpm' },
  { id: 'time120', label: '120s', metric: 'wpm' },
  { id: 'words10', label: '10 words', metric: 'wpm' },
  { id: 'words25', label: '25 words', metric: 'wpm' },
  { id: 'words50', label: '50 words', metric: 'wpm' },
  { id: 'words100', label: '100 words', metric: 'wpm' },
  { id: 'survival', label: 'Survival', metric: 'time' },
  { id: 'precision', label: 'Precision', metric: 'score' },
]

export interface LeaderboardEntry {
  resultId: string
  playerId: string
  playerName: string
  value: number
  wpm: number
  accuracy: number
  difficulty: Difficulty
  date: string
  /** A replay exists, so this run can be raced in Ghost Race. */
  raceable: boolean
}

export interface LeaderboardQuery {
  board: BoardId
  difficulty: Difficulty | 'all'
  bestPerPlayer: boolean
  limit: number
}

export interface LeaderboardProvider {
  readonly kind: 'local' | 'online'
  readonly label: string
  list(q: LeaderboardQuery): Promise<LeaderboardEntry[]>
}

function boardMatch(r: TestResult, board: BoardId): boolean {
  if (!r.valid) return false
  if (board === 'survival') return r.mode === 'survival'
  if (board === 'precision') return r.mode === 'precision'
  // Speed boards use standard tests only (Arena and Daily Quest), so every entry typed comparable text.
  if (r.mode !== 'arena' && r.mode !== 'daily') return false
  const l = r.config.length
  return !!l && `${l.kind}${l.value}` === board
}

export class LocalLeaderboardProvider implements LeaderboardProvider {
  readonly kind = 'local' as const
  readonly label = 'Local · this device'
  private data: AppData
  constructor(data: AppData) {
    this.data = data
  }

  async list(q: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    const names = new Map(this.data.profiles.map((p) => [p.id, p.name]))
    const metric = BOARDS.find((b) => b.id === q.board)!.metric
    let rows = this.data.results
      .filter((r) => names.has(r.profileId) && boardMatch(r, q.board) && (q.difficulty === 'all' || r.config.difficulty === q.difficulty))
      .map<LeaderboardEntry>((r) => ({
        resultId: r.id,
        playerId: r.profileId,
        playerName: names.get(r.profileId)!,
        value: metric === 'time' ? r.durationMs : metric === 'score' ? Number(r.meta?.score ?? 0) : r.wpm,
        wpm: r.wpm,
        accuracy: r.accuracy,
        difficulty: r.config.difficulty,
        date: r.date,
        raceable: !!r.timeline && !!ghostKey(r),
      }))
      .sort((a, b) => b.value - a.value || b.accuracy - a.accuracy)
    if (q.bestPerPlayer) {
      const seen = new Set<string>()
      rows = rows.filter((r) => (seen.has(r.playerId) ? false : (seen.add(r.playerId), true)))
    }
    return rows.slice(0, q.limit)
  }
}
