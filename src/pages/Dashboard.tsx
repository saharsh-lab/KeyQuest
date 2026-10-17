import { ArrowRight, Check, Flame, Gauge, Keyboard, Lock, Map, Sparkles, Target, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { HistoryChart, type HistoryPoint } from '@/components/charts'
import { KeycapHero } from '@/components/KeycapHero'
import { cap, DIFFICULTIES } from '@/components/TestOptions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { TestLength } from '@/engine/types'
import { MODES } from '@/game/modes'
import {
  activeMissions,
  dailyQuest,
  DIFFICULTY_REQ,
  difficultyUnlocked,
  lengthLabel,
  levelTitle,
  longestStreak,
  SPEED_MODES,
  weakKeys,
} from '@/game/progression'
import { useStore } from '@/game/store'
import { navigate } from '@/hooks/useHashRoute'
import { dayKey, relativeDay } from '@/lib/utils'

// Illustrative curve shown only before the player has any results. Always labeled as sample data.
const SAMPLE: HistoryPoint[] = [32, 35, 34, 38, 41, 39, 44, 46, 45, 49, 52, 51].map((wpm, i) => ({ label: `Run ${i + 1}`, wpm, accuracy: 92 + (i % 4) }))

function Tile({ icon: Icon, label, value, sub }: { icon: typeof Flame; label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {sub ? <div className="mt-1 text-xs text-subtle">{sub}</div> : null}
    </Card>
  )
}

export function DashboardPage() {
  const { profile, results, progress, level, xp, streak, updateSettings } = useStore()
  const speed = useMemo(() => results.filter((r) => r.valid && SPEED_MODES.includes(r.mode)), [results])
  const best = useMemo(() => speed.reduce<(typeof speed)[number] | undefined>((b, r) => (!b || r.wpm > b.wpm ? r : b), undefined), [speed])
  const recent = speed.slice(-20)
  const avgAcc = recent.length ? recent.reduce((a, r) => a + r.accuracy, 0) / recent.length : null
  const quest = useMemo(() => dailyQuest(results), [results])
  const questDone = !!progress.dailyQuests[dayKey()]
  const missions = useMemo(() => activeMissions(results, progress), [results, progress])
  const weak = useMemo(() => weakKeys(results.filter((r) => r.valid)), [results])
  const longest = useMemo(() => longestStreak(results), [results])
  const nextBossStage = Math.min(5, (progress.boss.normal ?? 0) + 1)
  const hasData = speed.length > 0

  const chartData: HistoryPoint[] = recent.map((r) => ({ label: relativeDay(r.date), wpm: r.wpm, accuracy: r.accuracy }))

  const cont = !questDone
    ? { label: 'Continue Quest: Daily Quest', href: '/play/daily' }
    : (progress.boss.normal ?? 0) < 5
      ? { label: `Continue Quest: Boss stage ${nextBossStage}`, href: '/play/boss' }
      : { label: 'Continue Quest: Ghost Race', href: '/play/ghost' }

  const quick = (length: TestLength) => {
    updateSettings({ length })
    navigate('/arena')
  }

  const byDifficulty = DIFFICULTIES.map((d) => {
    const rs = speed.filter((r) => r.config.difficulty === d)
    return {
      d,
      runs: rs.length,
      best: rs.reduce((m, r) => Math.max(m, r.wpm), 0),
      avg: rs.length ? rs.slice(-10).reduce((a, r) => a + r.wpm, 0) / Math.min(10, rs.length) : 0,
      unlocked: difficultyUnlocked(d, level.level, results),
    }
  })
  const maxBest = Math.max(60, ...byDifficulty.map((x) => x.best))

  return (
    <div className="flex flex-col gap-6">
      {/* Below lg, the hero and Quick start lead the page (negative order), so starting a test needs no scrolling. */}
      <Card className="relative overflow-hidden max-lg:-order-2">
        <section className="grid items-center gap-2 p-5 sm:p-6 md:grid-cols-[1fr_minmax(0,1.1fr)]">
          <div className="relative z-10">
            <p className="text-sm text-muted">{hasData ? 'Welcome back,' : 'Welcome to KeyQuest,'}</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl">{profile.name}</h1>
            <p className="mt-1 text-sm text-muted">
              Level {level.level} · {levelTitle(level.level)} · {level.needed - level.into} XP to level {level.level + 1}
            </p>
            <Button variant="primary" size="lg" className="mt-5" onClick={() => navigate(cont.href)}>
              {cont.label} <ArrowRight />
            </Button>
            <p className="mt-3 hidden text-xs text-subtle sm:block">
              Tap the keys or type on your keyboard. Press <kbd className="rounded border border-border px-1 font-mono">Enter</kbd> to jump into the Arena.
            </p>
          </div>
          {/* Decorative; hidden on phones so the page leads with actions. Wrapped because .hero-scene sets display itself. */}
          <div className="max-sm:hidden">
            <KeycapHero className="-my-2" />
          </div>
        </section>
      </Card>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Sparkles} label="Level" value={level.level} sub={<Progress value={level.progress * 100} className="mt-1" label="Level progress" />} />
        <Tile icon={Flame} label="Streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} sub={`Longest: ${longest} ${longest === 1 ? 'day' : 'days'}`} />
        <Tile icon={Trophy} label="Personal best" value={best ? `${Math.round(best.wpm)} WPM` : '—'} sub={best ? `${best.accuracy.toFixed(1)}% accuracy · ${lengthLabel(best.config.length) || best.mode}` : 'Complete a run to set one'} />
        <Tile icon={Target} label="Total XP" value={xp.toLocaleString()} sub={avgAcc !== null ? `Avg accuracy ${avgAcc.toFixed(1)}% (last ${recent.length})` : 'No runs yet'} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent performance</CardTitle>
              <CardDescription>{hasData ? `WPM over your last ${recent.length} runs` : 'Your WPM trend will appear here'}</CardDescription>
            </div>
            {!hasData ? <Badge variant="sample">Sample data</Badge> : null}
          </CardHeader>
          <CardContent>
            {hasData && recent.length < 2 ? (
              <div className="flex h-[200px] flex-col items-center justify-center gap-1 text-center">
                <div className="text-3xl font-semibold tabular-nums">{Math.round(recent[0].wpm)} WPM</div>
                <p className="text-sm text-muted">One run so far. Complete another to see a trend.</p>
              </div>
            ) : (
              <div className="relative">
                <HistoryChart data={hasData ? chartData : SAMPLE} dashed={!hasData} />
                {!hasData ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-lg border border-border bg-surface/90 px-4 py-3 text-center shadow-card">
                      <p className="text-sm">This is example data, not yours.</p>
                      <Button variant="link" className="mt-1" onClick={() => quick({ kind: 'time', value: 30 })}>
                        Take your first 30s test →
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Map className="size-4 text-accent-text" /> Daily challenge
              </CardTitle>
              <CardDescription>{quest.title}</CardDescription>
            </div>
            {questDone ? (
              <Badge variant="accent">
                <Check /> Done
              </Badge>
            ) : (
              <Badge>+{quest.xp} XP</Badge>
            )}
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Target</dt>
                <dd className="font-medium tabular-nums">{quest.targetWpm} WPM</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Min accuracy</dt>
                <dd className="font-medium tabular-nums">{quest.minAccuracy}%</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Category</dt>
                <dd className="font-medium">{cap(quest.category)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Length</dt>
                <dd className="font-medium">
                  {lengthLabel(quest.length)} · {cap(quest.difficulty)}
                </dd>
              </div>
            </dl>
            <Button className="mt-auto w-full" variant={questDone ? 'secondary' : 'primary'} onClick={() => navigate('/play/daily')}>
              {questDone ? 'Play again for practice' : 'Start quest'}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Missions</CardTitle>
            <span className="text-xs text-subtle">{missions.filter((m) => m.done).length}/{missions.length} done</span>
          </CardHeader>
          <CardContent className="flex flex-col gap-3.5">
            {(['daily', 'weekly'] as const).map((period) => (
              <div key={period} className="flex flex-col gap-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-subtle">{period === 'daily' ? 'Today' : 'This week'}</div>
                {missions
                  .filter((m) => m.period === period)
                  .map((m) => (
                    <div key={m.key}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className={m.done ? 'text-muted line-through' : undefined}>{m.title}</span>
                        <span className="shrink-0 text-xs tabular-nums text-subtle">{m.done ? <Check className="size-3.5 text-accent-text" /> : `+${m.xp} XP`}</span>
                      </div>
                      <Progress value={(m.value / m.target) * 100} className="mt-1.5" label={m.title} />
                      <div className="mt-1 text-[11px] tabular-nums text-subtle">
                        {m.value.toLocaleString()} / {m.target.toLocaleString()}
                      </div>
                    </div>
                  ))}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Skill progression</CardTitle>
              <CardDescription>Best WPM by difficulty tier</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {byDifficulty.map((x) => (
              <div key={x.d}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    {!x.unlocked ? <Lock className="size-3 text-subtle" /> : null}
                    {cap(x.d)}
                  </span>
                  <span className="text-xs tabular-nums text-muted">{x.runs ? `${Math.round(x.best)} best · ${Math.round(x.avg)} avg` : x.unlocked ? 'No runs yet' : 'Locked'}</span>
                </div>
                <Progress value={(x.best / maxBest) * 100} className="mt-1.5" label={`${x.d} best WPM`} />
                {!x.unlocked ? <p className="mt-1 text-[11px] text-subtle">{DIFFICULTY_REQ[x.d]}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Weak keys</CardTitle>
              <CardDescription>Highest miss rate over your last 30 runs</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {weak.length ? (
              <ul className="flex flex-col gap-2.5">
                {weak.map((k) => (
                  <li key={k.key} className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 font-mono text-sm">{k.key === ' ' ? '␣' : k.key}</span>
                    <div className="flex-1">
                      <Progress value={Math.min(100, k.rate * 100 * 4)} barClassName="bg-danger" label={`${k.key} miss rate`} />
                    </div>
                    <span className="w-24 text-right text-xs tabular-nums text-muted">
                      {(k.rate * 100).toFixed(1)}% · {k.misses}/{k.hits}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center">
                <Keyboard className="size-6 text-subtle" />
                <p className="text-sm text-muted">{hasData ? 'No consistent weak keys yet. Nice.' : 'Weak keys show up after a few runs.'}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="max-lg:-order-1">
        <h2 className="mb-3 text-sm font-medium">Quick start</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { kind: 'time', value: 15 },
              { kind: 'time', value: 30 },
              { kind: 'time', value: 60 },
              { kind: 'words', value: 25 },
              { kind: 'words', value: 50 },
            ] as TestLength[]
          ).map((l) => (
            <Button key={l.kind + l.value} variant="secondary" onClick={() => quick(l)}>
              <Gauge /> {lengthLabel(l)}
            </Button>
          ))}
        </div>
      </section>

      <section aria-label="Game modes" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:-mt-3 lg:grid-cols-7">
        {MODES.map((m) => (
          <a key={m.id} href={m.href} className="group flex flex-col gap-2 rounded-card border border-border bg-surface p-3 transition-colors hover:border-border-strong hover:bg-surface-2">
            <m.icon className="size-4 text-muted group-hover:text-accent-text" />
            <span className="text-sm font-medium">{m.name}</span>
          </a>
        ))}
      </section>
    </div>
  )
}
