import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Info, Lightbulb, Minus, RotateCcw, SkipForward, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { lengthLabel, recommendations } from '@/game/progression'
import type { RecordOutcome } from '@/game/store'
import { useStore } from '@/game/store'
import { cn, formatDuration } from '@/lib/utils'
import { RunChart } from './charts'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Kbd } from './ui/kbd'
import { Tooltip } from './ui/tooltip'

export function Delta({ value, unit = '', digits = 0, invert }: { value: number | null; unit?: string; digits?: number; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-xs text-subtle">first run</span>
  const good = invert ? value < 0 : value > 0
  const flat = Math.abs(value) < 10 ** -digits / 2
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs tabular-nums', flat ? 'text-subtle' : good ? 'text-accent-text' : 'text-danger')}>
      <Icon className="size-3" />
      {value > 0 ? '+' : ''}
      {value.toFixed(digits)}
      {unit}
    </span>
  )
}

function Metric({ label, value, sub, hint }: { label: string; value: ReactNode; sub?: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-xs text-muted">
        {label}
        {hint ? (
          <Tooltip content={hint}>
            <button type="button" className="text-subtle hover:text-fg" aria-label={`About ${label}`}>
              <Info className="size-3" />
            </button>
          </Tooltip>
        ) : null}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {sub ? <div className="mt-0.5">{sub}</div> : null}
    </div>
  )
}

interface Props {
  outcome: RecordOutcome
  onRestart: () => void
  onNext?: () => void
  nextLabel?: string
  /** Mode-specific banner (boss defeated, ghost result, quest status...). */
  header?: ReactNode
  restartLabel?: string
  /** The new-test key (Tab or Shift+Enter) triggers onNext on this screen. */
  nextShortcut?: boolean
}

export function ResultsView({ outcome, onRestart, onNext, nextLabel = 'Next test', header, restartLabel = 'Retry', nextShortcut }: Props) {
  const { results, settings } = useStore()
  const r = outcome.result
  const prev = outcome.previous
  const best = outcome.previousBest
  const recs = r.valid ? recommendations(r, results) : []
  const errorRate = r.keystrokes ? (r.errors / r.keystrokes) * 100 : 0
  const missed = Object.entries(r.keyMisses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const restartKey = settings.restartKey === 'tab' ? 'Tab' : 'Shift + Enter'

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex flex-col gap-4">
      {header}

      {!r.valid ? (
        <div className="flex items-start gap-2 rounded-card border border-border bg-surface-2 px-4 py-3 text-sm text-muted" role="status">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            This run does not count toward records or XP: <span className="text-fg">{r.invalidReason?.toLowerCase()}</span>.
          </span>
        </div>
      ) : null}

      <Card>
        <CardContent className="grid gap-6 pt-5 md:grid-cols-[220px_1fr]">
          <div className="flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted">
                WPM
                {r.isPB && r.meta?.beatPrevious ? (
                  <Badge variant="accent">
                    <Trophy /> New personal best
                  </Badge>
                ) : r.isPB ? (
                  <Badge variant="accent">First record</Badge>
                ) : null}
              </div>
              <div className="mt-1 text-6xl font-semibold tracking-tight tabular-nums text-accent-text">{Math.round(r.wpm)}</div>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className="text-muted">vs last</span>
                <Delta value={prev ? r.wpm - prev.wpm : null} digits={1} />
              </div>
              {best ? (
                <div className="mt-0.5 flex items-center gap-2 text-sm">
                  <span className="text-muted">vs best</span>
                  <Delta value={r.wpm - best.wpm} digits={1} />
                </div>
              ) : null}
            </div>
            <div className="text-xs text-subtle">
              {r.config.length ? lengthLabel(r.config.length) + ' · ' : ''}
              <span className="capitalize">{r.config.difficulty}</span> · <span className="capitalize">{r.config.category}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Metric label="Accuracy" value={`${r.accuracy.toFixed(1)}%`} sub={<Delta value={prev ? r.accuracy - prev.accuracy : null} unit="%" digits={1} />} hint="Correct keystrokes ÷ all character keystrokes. Fixed mistakes still count." />
            <Metric label="Raw WPM" value={Math.round(r.raw)} sub={<Delta value={prev ? r.raw - prev.raw : null} digits={1} />} hint="All character keystrokes ÷ 5 ÷ minutes, including mistakes." />
            <Metric label="Consistency" value={`${Math.round(r.consistency)}%`} sub={<Delta value={prev ? r.consistency - prev.consistency : null} unit="%" />} hint="How steady your per-second speed was. 100% means perfectly even." />
            <Metric label="Time" value={formatDuration(r.durationMs)} sub={<span className="text-xs text-subtle">{(r.durationMs / 1000).toFixed(1)}s active</span>} />
            <Metric label="Correct chars" value={r.correctChars} sub={<span className="text-xs text-subtle">of {r.totalChars} in text</span>} />
            <Metric label="Incorrect chars" value={r.incorrectChars} sub={<span className="text-xs text-subtle">left uncorrected</span>} />
            <Metric label="Errors" value={r.errors} sub={<Delta value={prev ? r.errors - prev.errors : null} invert />} hint="Every wrong keystroke, including ones you fixed." />
            <Metric label="Error rate" value={`${errorRate.toFixed(1)}%`} sub={<span className="text-xs text-subtle">{r.backspaces} backspaces</span>} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Speed over time</CardTitle>
          </CardHeader>
          <CardContent>
            <RunChart samples={r.samples} compareWpm={best?.wpm} />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>XP earned</CardTitle>
              <span className="text-sm font-semibold tabular-nums text-accent-text">+{outcome.xpTotal}</span>
            </CardHeader>
            <CardContent>
              {outcome.xp.length ? (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {outcome.xp.map((x, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="truncate text-muted">{x.reason}</span>
                      <span className="tabular-nums">+{x.amount}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No XP for this run.</p>
              )}
              {outcome.levelAfter > outcome.levelBefore ? <p className="mt-3 text-sm text-accent-text">Level up! You reached level {outcome.levelAfter}.</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Most missed keys</CardTitle>
            </CardHeader>
            <CardContent>
              {missed.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {missed.map(([k, n]) => (
                    <span key={k} className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm">
                      <span className="font-mono">{k === ' ' ? '␣' : k}</span>
                      <span className="text-xs tabular-nums text-danger">×{n}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No missed keys. Clean run.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {recs.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="size-4 text-accent-text" /> Practice recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {recs.map((rec) => (
              <div key={rec.title} className="rounded-lg border border-border bg-surface-2/50 p-3.5">
                <div className="text-sm font-medium">{rec.title}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{rec.detail}</p>
                {rec.action ? (
                  <a href={rec.action.href} className="mt-2 inline-block text-[13px] font-medium text-accent-text hover:underline">
                    {rec.action.label} →
                  </a>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" onClick={onRestart}>
          <RotateCcw /> {restartLabel}
        </Button>
        {onNext ? (
          <Button variant="primary" onClick={onNext}>
            <SkipForward /> {nextLabel}
            {nextShortcut ? <Kbd className="ml-1 border-accent-fg/20 bg-transparent text-accent-fg/70">{restartKey}</Kbd> : null}
          </Button>
        ) : null}
      </div>
    </motion.div>
  )
}
