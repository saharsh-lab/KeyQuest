import { Ghost, HardDrive, Trophy, Users, Wifi } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ProfileMenu } from '@/components/ProfileMenu'
import { cap, DIFFICULTIES } from '@/components/TestOptions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { Difficulty } from '@/engine/types'
import { BOARDS, LocalLeaderboardProvider, type BoardId, type LeaderboardEntry } from '@/game/leaderboard'
import { useStore } from '@/game/store'
import { navigate } from '@/hooks/useHashRoute'
import { cn, formatDuration, relativeDay } from '@/lib/utils'

export function LeaderboardPage() {
  const { data, profile } = useStore()
  // Open on the board of the player's most recent standard test, so their runs are visible straight away.
  const [board, setBoard] = useState<BoardId>(() => {
    const last = [...data.results].reverse().find((r) => r.valid && (r.mode === 'arena' || r.mode === 'daily') && r.config.length)
    const id = last?.config.length ? (`${last.config.length.kind}${last.config.length.value}` as BoardId) : 'time30'
    return BOARDS.some((b) => b.id === id) ? id : 'time30'
  })
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all')
  const [bestPerPlayer, setBestPerPlayer] = useState(true)
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const provider = useMemo(() => new LocalLeaderboardProvider(data), [data])
  const meta = BOARDS.find((b) => b.id === board)!

  useEffect(() => {
    let alive = true
    setRows(null)
    setError(null)
    provider
      .list({ board, difficulty, bestPerPlayer, limit: 50 })
      .then((r) => alive && setRows(r))
      .catch(() => alive && setError('The leaderboard could not be loaded.'))
    return () => {
      alive = false
    }
  }, [provider, board, difficulty, bestPerPlayer])

  const fmt = (e: LeaderboardEntry) => (meta.metric === 'time' ? formatDuration(e.value) : meta.metric === 'score' ? e.value.toLocaleString() : `${Math.round(e.value)}`)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            Leaderboard <Badge variant="outline"><HardDrive /> {provider.label}</Badge>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Rankings from results actually recorded in this browser, across every local player. Nothing here is a global or online ranking.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Leaderboard">
          {BOARDS.map((b) => (
            <button
              key={b.id}
              role="tab"
              aria-selected={board === b.id}
              type="button"
              onClick={() => setBoard(b.id)}
              className={cn('h-8 shrink-0 rounded-lg px-3 text-[13px] font-medium transition-colors', board === b.id ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg')}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Select<Difficulty | 'all'>
          label="Difficulty"
          value={difficulty}
          onValueChange={setDifficulty}
          options={[{ value: 'all', label: 'All difficulties' }, ...DIFFICULTIES.map((d) => ({ value: d, label: cap(d) }))]}
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <Switch checked={bestPerPlayer} onCheckedChange={setBestPerPlayer} aria-label="Best run per player only" />
          Best run per player
        </label>
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-4">
          {error ? (
            <p role="alert" className="py-10 text-center text-sm text-danger">{error}</p>
          ) : rows === null ? (
            <div className="flex flex-col gap-2 py-2" aria-busy="true" aria-label="Loading leaderboard">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-surface-2" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Trophy className="size-7 text-subtle" />
              <p className="text-sm text-muted">No runs on this board yet.</p>
              <Button variant="link" onClick={() => navigate(board === 'survival' ? '/play/survival' : board === 'precision' ? '/play/precision' : '/arena')}>
                Set the first record →
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="w-10 pb-2 font-normal">#</th>
                  <th className="pb-2 font-normal">Player</th>
                  <th className="pb-2 text-right font-normal">{meta.metric === 'wpm' ? 'WPM' : meta.metric === 'time' ? 'Survived' : 'Score'}</th>
                  <th className="pb-2 text-right font-normal">Acc</th>
                  <th className="hidden pb-2 font-normal sm:table-cell sm:pl-6">Difficulty</th>
                  <th className="hidden pb-2 font-normal md:table-cell">Date</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((e, i) => (
                  <tr key={e.resultId} className={cn('border-t border-border', e.playerId === profile.id && 'bg-accent-soft/40')}>
                    <td className={cn('py-2.5 tabular-nums', i < 3 ? 'font-semibold text-accent-text' : 'text-muted')}>{i + 1}</td>
                    <td className="py-2.5">
                      {e.playerName}
                      {e.playerId === profile.id ? <span className="ml-1.5 text-xs text-subtle">(you)</span> : null}
                    </td>
                    <td className="py-2.5 text-right font-medium tabular-nums">{fmt(e)}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted">{e.accuracy.toFixed(1)}%</td>
                    <td className="hidden py-2.5 text-muted sm:table-cell sm:pl-6">{cap(e.difficulty)}</td>
                    <td className="hidden py-2.5 text-muted md:table-cell">{relativeDay(e.date)}</td>
                    <td className="py-2.5 text-right">
                      {e.raceable ? (
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/play/ghost?run=${e.resultId}`)} aria-label={`Race ${e.playerName}'s ghost`}>
                          <Ghost /> Race
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4" /> Compete on this device
              </CardTitle>
              <CardDescription>Add a player for each person who shares this computer. Everyone gets their own XP and streak, and all of you appear on this leaderboard. Race each other’s ghosts from word-count boards.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">
              {data.profiles.length} {data.profiles.length === 1 ? 'player' : 'players'} · playing as <span className="text-fg">{profile.name}</span>
            </span>
            <div className="rounded-lg border border-border">
              <ProfileMenu />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="size-4" /> Online play
              </CardTitle>
              <CardDescription>
                Online races and global rankings need accounts and a server, which this build does not have. The leaderboard is built on a provider interface, so an online provider can be added later without changing this page.
              </CardDescription>
            </div>
            <Badge variant="outline">Not connected</Badge>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
