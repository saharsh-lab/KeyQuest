import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PerSecondSample } from '@/engine/types'

const axis = { stroke: 'var(--fg-subtle)', fontSize: 11, tickLine: false, axisLine: false } as const

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: { name?: string; value?: number | string; color?: string; dataKey?: string | number }[]
  labelFormat?: (l: string | number) => string
  unit?: string
}

export function ChartTooltip({ active, payload, label, labelFormat, unit = '' }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-card">
      <div className="mb-1 text-muted">{labelFormat ? labelFormat(label ?? '') : label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums text-fg">
            {typeof p.value === 'number' ? Math.round(p.value * 10) / 10 : p.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: i.dashed ? `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)` : i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

/** WPM and raw WPM over the run (same unit, one axis), with a separate error strip beneath. */
export function RunChart({ samples, compareWpm }: { samples: PerSecondSample[]; compareWpm?: number }) {
  if (samples.length < 2) {
    return <p className="py-10 text-center text-sm text-muted">The run was too short to graph.</p>
  }
  const data = samples.map((s) => ({ ...s, best: compareWpm }))
  return (
    <div>
      <Legend
        items={[
          { label: 'WPM', color: 'var(--accent-text)' },
          { label: 'Raw WPM', color: 'var(--chart-2)' },
          ...(compareWpm ? [{ label: 'Previous best', color: 'var(--fg-subtle)', dashed: true }] : []),
        ]}
      />
      <div className="mt-3 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="s" {...axis} tickFormatter={(v) => `${v}s`} minTickGap={24} />
            <YAxis {...axis} allowDecimals={false} width={44} />
            <Tooltip content={<ChartTooltip labelFormat={(l) => `Second ${l}`} />} cursor={{ stroke: 'var(--border-strong)' }} />
            {compareWpm ? <Line dataKey="best" name="Previous best" stroke="var(--fg-subtle)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} /> : null}
            <Line dataKey="raw" name="Raw WPM" stroke="var(--chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            <Line dataKey="wpm" name="WPM" stroke="var(--accent-text)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-subtle">
        <span className="w-12 shrink-0">Errors</span>
        <div className="h-8 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={samples} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="s" hide />
              <YAxis hide allowDecimals={false} />
              <Tooltip content={<ChartTooltip labelFormat={(l) => `Second ${l}`} />} cursor={{ fill: 'var(--surface-3)' }} />
              <Bar dataKey="errors" name="Errors" fill="var(--danger)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export interface HistoryPoint {
  label: string
  wpm: number
  accuracy: number
}

/** WPM per run over time. Accuracy is shown in the tooltip, not on a second axis. */
export function HistoryChart({ data, height = 200, dashed }: { data: HistoryPoint[]; height?: number; dashed?: boolean }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" {...axis} minTickGap={28} />
          <YAxis {...axis} allowDecimals={false} width={44} domain={[0, 'auto']} />
          <Tooltip content={<HistoryTip />} cursor={{ stroke: 'var(--border-strong)' }} />
          <Line
            dataKey="wpm"
            name="WPM"
            stroke={dashed ? 'var(--fg-subtle)' : 'var(--accent-text)'}
            strokeDasharray={dashed ? '5 4' : undefined}
            strokeWidth={2}
            dot={{ r: 2.5, strokeWidth: 0, fill: dashed ? 'var(--fg-subtle)' : 'var(--accent-text)' }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function HistoryTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const p = (payload[0] as unknown as { payload: HistoryPoint }).payload
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-card">
      <div className="mb-1 text-muted">{p.label}</div>
      <div className="tabular-nums">
        <span className="font-medium text-fg">{Math.round(p.wpm)}</span> <span className="text-muted">WPM</span>
        <span className="mx-1.5 text-subtle">·</span>
        <span className="font-medium text-fg">{Math.round(p.accuracy)}%</span> <span className="text-muted">acc</span>
      </div>
    </div>
  )
}
