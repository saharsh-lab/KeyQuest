import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from './tooltip'

export interface SegmentOption<T> {
  value: T
  label: string
  disabled?: boolean
  locked?: string
}

/** Compact radio group used for mode, length and difficulty pickers. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: SegmentOption<T>[]
  label: string
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex items-center gap-0.5 rounded-lg bg-surface-2 p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value
        const btn = (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled || !!o.locked}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md font-medium transition-colors disabled:cursor-not-allowed',
              size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-[13px]',
              active ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
              o.locked && 'opacity-50',
            )}
          >
            {o.locked ? <Lock className="size-3" aria-hidden /> : null}
            {o.label}
          </button>
        )
        return o.locked ? (
          <Tooltip key={String(o.value)} content={`Locked: ${o.locked}`}>
            <span tabIndex={0} className="rounded-md">{btn}</span>
          </Tooltip>
        ) : (
          btn
        )
      })}
    </div>
  )
}
