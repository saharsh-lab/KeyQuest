import type { ReactNode } from 'react'
import type { TypingSession } from '@/engine/useTypingSession'
import { cn } from '@/lib/utils'

export function Stat({ label, value, accent, className }: { label: string; value: ReactNode; accent?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      <span className={cn('font-mono text-2xl font-medium tabular-nums leading-none sm:text-[28px]', accent ? 'text-accent-text' : 'text-fg')}>{value}</span>
      <span className="mt-1 text-[11px] uppercase tracking-wider text-subtle">{label}</span>
    </div>
  )
}

/** Real-time metrics row. `progress` shows words typed for word-count tests instead of time left. */
export function LiveStats({ session, progress, hidden }: { session: TypingSession; progress?: string; hidden?: boolean }) {
  const { live, remainingMs, elapsedMs } = session
  const time = remainingMs !== undefined ? Math.ceil(remainingMs / 1000) : Math.floor(elapsedMs / 1000)
  return (
    <div className={cn('flex flex-wrap items-end gap-x-5 gap-y-3 transition-opacity sm:gap-x-8', hidden && 'opacity-0')} aria-live="off">
      <Stat label={remainingMs !== undefined ? 'time left' : 'time'} value={`${time}s`} accent />
      {progress ? <Stat label="progress" value={progress} /> : null}
      <Stat label="wpm" value={Math.round(live.wpm)} />
      {/* Raw is secondary; dropping it on phones keeps the row on one line. */}
      <Stat label="raw" value={Math.round(live.raw)} className="max-sm:hidden" />
      <Stat label="accuracy" value={`${Math.round(live.accuracy)}%`} />
      <Stat label="errors" value={live.errors} />
    </div>
  )
}
