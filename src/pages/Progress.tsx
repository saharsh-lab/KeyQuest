import { Award, BarChart3, Check, Lock } from 'lucide-react'
import { ACHIEVEMENT_ICONS } from '@/components/achievementIcons'
import { useMemo, useState } from 'react'
import { ChartTooltip, HistoryChart } from '@/components/charts'
import { cap } from '@/components/TestOptions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { VirtualKeyboard } from '@/components/VirtualKeyboard'
import type { TestResult } from '@/engine/types'
import { MODES } from '@/game/modes'
import { ACHIEVEMENTS, ARENA_THEMES, KEYBOARD_THEMES, keyStats, lengthLabel, pbKey, SPEED_MODES } from '@/game/progression'
import { useStore } from '@/game/store'
import { cn, dayKey, formatDuration, relativeDay } from '@/lib/utils'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Delta } from '@/components/ResultsView'

type Range = '7' | '30' | 'all'

const modeName = (r: TestResult) => (r.mode === 'arena' ? 'Arena' : (MODES.find((m) => m.id === r.mode)?.name ?? r.mode))

function describe(r: TestResult) {
  if (r.mode === 'code') return `${cap(r.config.codeLanguage ?? '')} snippet`
  if (r.mode === 'boss') return `Stage ${r.meta?.stage} · ${cap(String(r.meta?.bossDifficulty ?? ''))}`
  if (r.mode === 'survival') return `${r.meta?.wordsCleared ?? 0} words`
  return [lengthLabel(r.config.length), cap(r.config.difficulty), r.config.category === 'common' ? '' : cap(r.config.category)].filter(Boolean).join(' · ')
}

export function ProgressPage() {
  const { results, progress, level, settings, updateSettings } = useStore()
  const [range, setRange] = useState<Range>('30')
  const speed = useMemo(() => results.filter((r) => r.valid && SPEED_MODES.includes(r.mode)), [results])
  const inRange = useMemo(() => {
    if (range === 'all') return speed
    const cutoff = Date.now() - Number(range) * 86400000
    return speed.filter((r) => new Date(r.date).getTime() >= cutoff)
  }, [speed, range])

  // Daily averages for the trend charts.
  const daily = useMemo(() => {
    const m = new Map<string, TestResult[]>()
    for (const r of inRange) {
      const k = dayKey(new Date(r.date))
      m.set(k, [...(m.get(k) ?? []), r])
    }
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, rs]) => ({
        label: new Date(k + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        wpm: rs.reduce((a, r) => a + r.wpm, 0) / rs.length,
        accuracy: rs.reduce((a, r) => a + r.accuracy, 0) / rs.length,
        runs: rs.length,
      }))
  }, [inRange])

  const last10 = speed.slice(-10)
  const prev10 = speed.slice(-20, -10)
  const avg = (rs: TestResult[], f: (r: TestResult) => number) => (rs.length ? rs.reduce((a, r) => a + f(r), 0) / rs.length : 0)
  const totalTime = results.filter((r) => r.valid).reduce((a, r) => a + r.durationMs, 0)

  const records = useMemo(() => {
    const m = new Map<string, TestResult>()
    for (const r of speed) {
      const k = pbKey(r)
      const cur = m.get(k)
      if (!cur || r.wpm > cur.wpm) m.set(k, r)
    }
    return [...m.values()].sort((a, b) => b.wpm - a.wpm).slice(0, 12)
  }, [speed])

  const missRates = useMemo(() => Object.fromEntries(keyStats(results.filter((r) => r.valid), 100).filter((k) => k.hits >= 5).map((k) => [k.key, k.rate])), [results])
  const unlockCtx = { level: level.level, achievements: progress.achievements }
  const unlockedCount = Object.keys(progress.achievements).length

  if (!results.length) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-lg font-semibold">Progress</h1>
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <BarChart3 className="size-8 text-subtle" />
          <h2 className="font-medium">No runs recorded yet</h2>
          <p className="max-w-sm text-sm text-muted">Finish a test in the Arena or any game mode. Your speed trends, records, key accuracy and achievements will build up here.</p>
          <Button asChild variant="primary" className="mt-2">
            <a href="#/arena">Go to the Arena</a>
          </Button>
        </Card>
        <AchievementsCard progress={progress.achievements} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Progress</h1>
        <Segmented
          label="Date range"
          value={range}
          onChange={setRange}
          options={[
            { value: '7', label: '7 days' },
            { value: '30', label: '30 days' },
            { value: 'all', label: 'All time' },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Runs completed', value: results.filter((r) => r.valid).length.toLocaleString() },
          { label: 'Time typing', value: formatDuration(totalTime) },
          { label: 'Avg WPM (last 10)', value: Math.round(avg(last10, (r) => r.wpm)), delta: prev10.length ? avg(last10, (r) => r.wpm) - avg(prev10, (r) => r.wpm) : null },
          { label: 'Avg accuracy (last 10)', value: `${avg(last10, (r) => r.accuracy).toFixed(1)}%`, delta: prev10.length ? avg(last10, (r) => r.accuracy) - avg(prev10, (r) => r.accuracy) : null, unit: '%' },
          { label: 'Best WPM', value: Math.round(speed.reduce((m, r) => Math.max(m, r.wpm), 0)) },
        ].map((t) => (
          <Card key={t.label} className="p-4">
            <div className="text-xs text-muted">{t.label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{t.value}</div>
            {'delta' in t && t.delta !== null && t.delta !== undefined ? (
              <div className="mt-1 flex items-center gap-1 text-xs text-subtle">
                <Delta value={t.delta} digits={1} unit={t.unit} /> vs previous 10
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Speed trend</CardTitle>
              <CardDescription>Average WPM per day</CardDescription>
            </div>
          </CardHeader>
          <CardContent>{daily.length >= 2 ? <HistoryChart data={daily} /> : <p className="py-16 text-center text-sm text-muted">Practice on at least two days in this range to see a trend.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Accuracy trend</CardTitle>
              <CardDescription>Average accuracy per day</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {daily.length >= 2 ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={daily} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--fg-subtle)" fontSize={11} tickLine={false} axisLine={false} minTickGap={28} />
                    <YAxis stroke="var(--fg-subtle)" fontSize={11} tickLine={false} axisLine={false} width={44} domain={[(min: number) => Math.max(0, Math.floor(min - 3)), 100]} />
                    <Tooltip content={<ChartTooltip unit="%" />} cursor={{ stroke: 'var(--border-strong)' }} />
                    <Line dataKey="accuracy" name="Accuracy" stroke="var(--accent-text)" strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: 'var(--accent-text)' }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-muted">Practice on at least two days in this range to see a trend.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Personal records</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="pb-2 font-normal">Mode</th>
                  <th className="pb-2 font-normal">Setup</th>
                  <th className="pb-2 text-right font-normal">WPM</th>
                  <th className="pb-2 text-right font-normal">Acc</th>
                  <th className="hidden pb-2 text-right font-normal sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2">{modeName(r)}</td>
                    <td className="py-2 text-muted">{describe(r)}</td>
                    <td className="py-2 text-right font-medium tabular-nums">{Math.round(r.wpm)}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{r.accuracy.toFixed(1)}%</td>
                    <td className="hidden py-2 text-right text-muted sm:table-cell">{relativeDay(r.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Key accuracy</CardTitle>
              <CardDescription>Red marks show keys you miss most (last 100 runs)</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <VirtualKeyboard expected="" lastKey={null} missRates={missRates} layout={settings.keyboardLayout} fingerGuide={false} theme={settings.keyboardTheme} />
          </CardContent>
        </Card>
      </div>

      <AchievementsCard progress={progress.achievements} count={unlockedCount} />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Rewards</CardTitle>
            <CardDescription>Themes unlock as you level up and earn achievements</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {(
            [
              ['Keyboard themes', KEYBOARD_THEMES, 'keyboardTheme'],
              ['Typing-area themes', ARENA_THEMES, 'arenaTheme'],
            ] as const
          ).map(([title, list, key]) => (
            <div key={key}>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-subtle">{title}</div>
              <ul className="flex flex-col gap-1.5">
                {list.map((t) => {
                  const ok = t.unlocked(unlockCtx)
                  const equipped = settings[key] === t.id
                  return (
                    <li key={t.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                      <span className="size-5 shrink-0 rounded-md border border-border-strong" style={{ background: t.swatch }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">{t.name}</div>
                        {!ok ? <div className="text-xs text-subtle">{t.requirement}</div> : null}
                      </div>
                      {ok ? (
                        <Button size="sm" variant={equipped ? 'secondary' : 'ghost'} disabled={equipped} onClick={() => updateSettings({ [key]: t.id })}>
                          {equipped ? (
                            <>
                              <Check /> Equipped
                            </>
                          ) : (
                            'Equip'
                          )}
                        </Button>
                      ) : (
                        <Lock className="size-4 text-subtle" aria-label="Locked" />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="pb-2 font-normal">When</th>
                <th className="pb-2 font-normal">Mode</th>
                <th className="hidden pb-2 font-normal md:table-cell">Setup</th>
                <th className="pb-2 text-right font-normal">WPM</th>
                <th className="pb-2 text-right font-normal">Acc</th>
                <th className="pb-2 text-right font-normal">XP</th>
              </tr>
            </thead>
            <tbody>
              {results
                .slice(-15)
                .reverse()
                .map((r) => (
                  <tr key={r.id} className={cn('border-t border-border', !r.valid && 'text-subtle')}>
                    <td className="py-2 whitespace-nowrap">
                      {relativeDay(r.date)} <span className="text-subtle">{new Date(r.date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                    </td>
                    <td className="py-2">
                      {modeName(r)} {!r.valid ? <Badge variant="outline" className="ml-1" title={r.invalidReason}>not counted</Badge> : r.isPB ? <Badge variant="accent" className="ml-1">PB</Badge> : null}
                    </td>
                    <td className="hidden py-2 text-muted md:table-cell">{describe(r)}</td>
                    <td className="py-2 text-right tabular-nums">{Math.round(r.wpm)}</td>
                    <td className="py-2 text-right tabular-nums">{r.accuracy.toFixed(1)}%</td>
                    <td className="py-2 text-right tabular-nums text-accent-text">{r.xp ? `+${r.xp}` : '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function AchievementsCard({ progress, count }: { progress: Record<string, string>; count?: number }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Achievements</CardTitle>
          <CardDescription>
            {count ?? Object.keys(progress).length} of {ACHIEVEMENTS.length} unlocked
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const at = progress[a.id]
          const Icon = ACHIEVEMENT_ICONS[a.icon] ?? Award
          return (
            <div key={a.id} className={cn('flex items-start gap-3 rounded-lg border p-3', at ? 'border-border bg-surface-2/40' : 'border-dashed border-border')}>
              <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', at ? 'bg-accent-soft text-accent-text' : 'bg-surface-2 text-subtle')}>
                {at ? <Icon className="size-[18px]" /> : <Lock className="size-4" />}
              </div>
              <div className="min-w-0">
                {/* Locked entries read as locked through the dashed border, lock icon and muted title, not opacity, so the unlock hint stays legible. */}
                <div className={cn('text-sm font-medium', !at && 'text-muted')}>{a.title}</div>
                <div className="text-xs text-muted">{a.description}</div>
                <div className="mt-1 text-[11px] text-subtle">{at ? `Unlocked ${relativeDay(at)}` : `+${a.xp} XP`}</div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
