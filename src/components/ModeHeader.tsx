import { ArrowLeft, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function ModeHeader({ icon: Icon, title, description, right }: { icon: LucideIcon; title: string; description: string; right?: ReactNode }) {
  return (
    <div data-focus-fade className="flex flex-col gap-3">
      <a href="#/modes" className="inline-flex w-fit items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Game modes
      </a>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2">
            <Icon className="size-5 text-accent-text" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">{title}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-muted">{description}</p>
          </div>
        </div>
        {right}
      </div>
    </div>
  )
}

export function Banner({ tone, title, children }: { tone: 'win' | 'lose' | 'neutral'; title: string; children?: ReactNode }) {
  const cls = tone === 'win' ? 'border-accent-text/40 bg-accent-soft' : tone === 'lose' ? 'border-danger/40 bg-danger-soft' : 'border-border bg-surface-2'
  return (
    <div className={`rounded-card border px-5 py-4 ${cls}`} role="status">
      <div className={`text-base font-semibold ${tone === 'win' ? 'text-accent-text' : tone === 'lose' ? 'text-danger' : ''}`}>{title}</div>
      {children ? <div className="mt-1 text-sm text-muted">{children}</div> : null}
    </div>
  )
}
