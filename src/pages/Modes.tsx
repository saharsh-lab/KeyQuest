import { ArrowRight, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tilt } from '@/components/Tilt'
import { Card } from '@/components/ui/card'
import { MODES, type ModeInfo } from '@/game/modes'
import { useStore } from '@/game/store'
import { dayKey, formatDuration } from '@/lib/utils'

export function ModesPage() {
  const { results, progress } = useStore()

  const stat = (m: ModeInfo): string => {
    const rs = results.filter((r) => r.mode === m.id && r.valid)
    switch (m.id) {
      case 'daily':
        return progress.dailyQuests[dayKey()] ? 'Completed today' : `${Object.keys(progress.dailyQuests).length} completed`
      case 'boss': {
        const best = Math.max(0, ...Object.values(progress.boss))
        return best ? `Highest stage cleared: ${best}` : 'No bosses defeated yet'
      }
      case 'survival': {
        const best = rs.reduce((m, r) => Math.max(m, r.durationMs), 0)
        return best ? `Longest: ${formatDuration(best)}` : 'No runs yet'
      }
      case 'precision': {
        const best = rs.reduce((m, r) => Math.max(m, Number(r.meta?.score ?? 0)), 0)
        return best ? `Best score: ${best.toLocaleString()}` : 'No runs yet'
      }
      case 'ghost': {
        const wins = results.filter((r) => r.mode === 'ghost' && r.meta?.won).length
        return rs.length ? `${wins} wins in ${rs.length} races` : 'No races yet'
      }
      case 'zen':
        return progress.zenMs ? `${formatDuration(progress.zenMs)} in Zen` : 'Not visited yet'
      default: {
        const best = rs.reduce((m, r) => Math.max(m, r.wpm), 0)
        return best ? `Best: ${Math.round(best)} WPM` : 'No runs yet'
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Game modes</h1>
        <p className="mt-1 text-sm text-muted">Seven ways to practice. Every mode records real results and earns XP only for finished, valid runs.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map((m) => {
          const done = m.id === 'daily' && progress.dailyQuests[dayKey()]
          return (
            <a key={m.id} href={m.href} className="group rounded-card focus-visible:outline-offset-4">
              <Tilt className="h-full">
                <Card className="flex h-full flex-col p-5 transition-colors group-hover:border-border-strong" style={{ transformStyle: 'preserve-3d' }}>
                  <div className="flex items-start justify-between" style={{ transformStyle: 'preserve-3d' }}>
                    <div className="tilt-pop flex size-10 items-center justify-center rounded-lg bg-surface-2 text-fg transition-colors group-hover:bg-accent group-hover:text-accent-fg">
                      <m.icon className="size-5" />
                    </div>
                    {done ? (
                      <Badge variant="accent">
                        <Check /> Today
                      </Badge>
                    ) : null}
                  </div>
                  <h2 className="mt-4 font-medium">{m.name}</h2>
                  <p className="text-[13px] text-accent-text">{m.tagline}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{m.description}</p>
                  <div className="mt-auto flex items-center justify-between pt-4 text-xs text-subtle">
                    <span>{stat(m)}</span>
                    <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
                  </div>
                </Card>
              </Tilt>
            </a>
          )
        })}
      </div>
    </div>
  )
}
