import { memo, useMemo } from 'react'
import { useStore } from '@/game/store'
import { FINGER_NAMES, layoutRows, locateChar, type Finger } from '@/data/layouts'
import type { KeyboardLayout } from '@/game/types'
import { cn } from '@/lib/utils'

const THEMES: Record<string, React.CSSProperties> = {
  graphite: { '--kb-key': 'var(--surface-2)', '--kb-fg': 'var(--fg-muted)', '--kb-border': 'var(--border)', '--kb-next': 'var(--accent-soft)', '--kb-next-fg': 'var(--accent-text)', '--kb-next-border': 'var(--accent-text)' } as React.CSSProperties,
  outline: { '--kb-key': 'transparent', '--kb-fg': 'var(--fg-subtle)', '--kb-border': 'var(--border-strong)', '--kb-next': 'transparent', '--kb-next-fg': 'var(--fg)', '--kb-next-border': 'var(--fg)' } as React.CSSProperties,
  lime: { '--kb-key': 'var(--surface-2)', '--kb-fg': 'var(--fg-muted)', '--kb-border': 'var(--border)', '--kb-next': 'var(--accent)', '--kb-next-fg': 'var(--accent-fg)', '--kb-next-border': 'var(--accent)' } as React.CSSProperties,
  retro: { '--kb-key': '#d9cfb8', '--kb-fg': '#4a4335', '--kb-border': '#bfb398', '--kb-next': '#e8742c', '--kb-next-fg': '#fff7ea', '--kb-next-border': '#c85d1b' } as React.CSSProperties,
  ocean: { '--kb-key': '#1b3b5a', '--kb-fg': '#b6d4f0', '--kb-border': '#24496d', '--kb-next': '#6fd3ff', '--kb-next-fg': '#06263d', '--kb-next-border': '#6fd3ff' } as React.CSSProperties,
}

// Subtle zone tints for the optional finger guide.
const FINGER_TINT: Record<Finger, string> = {
  lp: 'rgba(244, 114, 182, 0.16)',
  lr: 'rgba(251, 146, 60, 0.16)',
  lm: 'rgba(250, 204, 21, 0.16)',
  li: 'rgba(132, 204, 22, 0.16)',
  ri: 'rgba(45, 212, 191, 0.16)',
  rm: 'rgba(56, 189, 248, 0.16)',
  rr: 'rgba(129, 140, 248, 0.16)',
  rp: 'rgba(192, 132, 252, 0.16)',
  th: 'rgba(148, 163, 184, 0.14)',
}

interface Props {
  expected: string
  lastKey: { typed: string; expected: string; correct: boolean; at: number } | null
  missRates?: Record<string, number>
  layout: KeyboardLayout
  fingerGuide: boolean
  theme: string
  className?: string
}

interface KeyCtx {
  next: ReturnType<typeof locateChar>
  last: ReturnType<typeof locateChar>
  lastWrong: boolean
  /** Changes on every keystroke so the pressed key replays its press animation. */
  lastAt: number
  missRates?: Record<string, number>
  fingerGuide: boolean
}

function Key({ ctx, label, r, c, finger, width = 1, missKey }: { ctx: KeyCtx; label: string; r: number; c: number; finger?: Finger; width?: number; missKey?: string }) {
  const isNext = !!ctx.next && ctx.next.row === r && ctx.next.col === c
  const isLast = !!ctx.last && ctx.last.row === r && ctx.last.col === c
  const lastWrong = ctx.lastWrong
  const rate = missKey && ctx.missRates ? ctx.missRates[missKey] ?? 0 : 0
  return (
    <div
      // Remounting the last-pressed key restarts its press animation on every keystroke.
      key={isLast ? ctx.lastAt : 'idle'}
      className={cn(
        'kb-cap relative flex h-9 min-w-0 items-center justify-center rounded-md border font-mono text-[11px] sm:h-10 sm:text-[13px]',
        isNext && 'is-next font-semibold',
        isLast && 'is-pressed',
        isLast && lastWrong && 'is-wrong',
      )}
      style={
        {
          flex: `${width} ${width} 0`,
          '--cap-bg': isNext ? 'var(--kb-next)' : isLast && lastWrong ? 'var(--danger-soft)' : ctx.fingerGuide && finger ? FINGER_TINT[finger] : 'var(--kb-key)',
          color: isNext ? 'var(--kb-next-fg)' : isLast && lastWrong ? 'var(--danger)' : 'var(--kb-fg)',
          borderColor: isNext ? 'var(--kb-next-border)' : isLast ? (lastWrong ? 'var(--danger)' : 'var(--fg-subtle)') : 'var(--kb-border)',
        } as React.CSSProperties
      }
    >
      {label}
      {rate > 0.04 ? (
        <span
          className="absolute bottom-1 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-danger"
          style={{ opacity: Math.min(1, 0.35 + rate * 4) }}
        />
      ) : null}
    </div>
  )
}

function KeyboardImpl({ expected, lastKey, missRates, layout, fingerGuide, theme, className }: Props) {
  const rows = useMemo(() => layoutRows(layout), [layout])
  const next = expected ? locateChar(layout, expected) : null
  const last = lastKey ? locateChar(layout, lastKey.typed) : null
  const lastWrong = lastKey && !lastKey.correct

  const ctx: KeyCtx = { next, last, lastWrong: !!lastWrong, lastAt: lastKey?.at ?? 0, missRates, fingerGuide }
  const { settings } = useStore()
  const depth = settings.effects3d

  const shiftNeeded = !!next?.shift
  const mod = (label: string, width: number, active = false, r = -1) => (
    <div
      key={label + width + r}
      className={cn('kb-cap flex h-9 min-w-0 items-center justify-center overflow-hidden rounded-md border px-1 text-[10px] text-subtle sm:h-10 sm:text-[11px]', active && 'is-next')}
      style={
        {
          flex: `${width} ${width} 0`,
          '--cap-bg': active ? 'var(--kb-next)' : 'var(--kb-key)',
          color: active ? 'var(--kb-next-fg)' : undefined,
          borderColor: active ? 'var(--kb-next-border)' : 'var(--kb-border)',
        } as React.CSSProperties
      }
    >
      {label}
    </div>
  )

  const leftShift = shiftNeeded && next && next.finger.startsWith('r')
  const rightShift = shiftNeeded && next && next.finger.startsWith('l')

  return (
    <div className={cn('kb-scene select-none', depth && 'kb-3d', className)} style={THEMES[theme] ?? THEMES.graphite} aria-hidden>
      <div className="kb-plate mx-auto flex max-w-[760px] flex-col gap-1.5">
        <div className="flex gap-1.5">
          {rows[0].map((k, c) => (
            <Key ctx={ctx} key={c} label={k.base} r={0} c={c} finger={k.finger} missKey={k.base.toLowerCase()} />
          ))}
          {mod('⌫', 1.8)}
        </div>
        <div className="flex gap-1.5">
          {mod('tab', 1.5)}
          {rows[1].map((k, c) => (
            <Key ctx={ctx} key={c} label={/[a-z]/.test(k.base) ? k.base.toUpperCase() : k.base} r={1} c={c} finger={k.finger} missKey={k.base.toLowerCase()} width={c === 12 ? 1.3 : 1} />
          ))}
        </div>
        <div className="flex gap-1.5">
          {mod('caps', 1.8)}
          {rows[2].map((k, c) => (
            <Key ctx={ctx} key={c} label={/[a-zà-ÿ]/.test(k.base) ? k.base.toUpperCase() : k.base} r={2} c={c} finger={k.finger} missKey={k.base.toLowerCase()} />
          ))}
          <Key ctx={ctx} label="enter" r={2} c={99} width={2.1} missKey="⏎" />
        </div>
        <div className="flex gap-1.5">
          {mod('shift', 2.3, !!leftShift, 1)}
          {rows[3].map((k, c) => (
            <Key ctx={ctx} key={c} label={/[a-zà-ÿ]/.test(k.base) ? k.base.toUpperCase() : k.base} r={3} c={c} finger={k.finger} missKey={k.base.toLowerCase()} />
          ))}
          {mod('shift', 2.7, !!rightShift, 2)}
        </div>
        <div className="flex gap-1.5">
          <div style={{ flex: '3.5 3.5 0' }} />
          <Key ctx={ctx} label="space" r={4} c={0} width={7} finger="th" missKey=" " />
          <div style={{ flex: '3.5 3.5 0' }} />
        </div>
      </div>
      {fingerGuide ? (
        <p className="mt-3 text-center text-xs text-muted" aria-live="polite">
          {next ? (
            <>
              Next: <span className="font-mono text-fg">{expected === ' ' ? 'space' : expected === '\n' ? 'enter' : expected}</span> with your{' '}
              <span className="text-fg">{FINGER_NAMES[next.finger].toLowerCase()}</span>
              {next.shift ? ' (hold shift with the other hand)' : ''}
            </>
          ) : (
            'Rest your fingers on the home row: A S D F and J K L ;'
          )}
        </p>
      ) : null}
    </div>
  )
}

export const VirtualKeyboard = memo(KeyboardImpl)
