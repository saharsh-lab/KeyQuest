import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  Flame,
  Gamepad2,
  Keyboard,
  LayoutDashboard,
  Moon,
  Settings as SettingsIcon,
  Sun,
  Trophy,
  TriangleAlert,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '@/game/store'
import { useResolvedTheme } from '@/hooks/useTheme'
import { levelTitle } from '@/game/progression'
import { cn } from '@/lib/utils'
import { Progress } from './ui/progress'
import { Tooltip } from './ui/tooltip'
import { Logo } from './Logo'
import { ProfileMenu } from './ProfileMenu'

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/arena', label: 'Arena', icon: Keyboard },
  { href: '/modes', label: 'Game Modes', icon: Gamepad2 },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
]

export function isActive(path: string, href: string) {
  if (href === '/') return path === '/'
  if (href === '/modes') return path.startsWith('/modes') || path.startsWith('/play')
  return path.startsWith(href)
}

export function AppShell({ path, children, minimal }: { path: string; children: ReactNode; minimal?: boolean }) {
  const { level, xp, streak, settings, updateSettings, storageError, dismissStorageError } = useStore()
  const dark = useResolvedTheme() === 'dark'

  if (minimal) return <>{children}</>

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside data-focus-fade className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-surface/40 px-3 py-4 lg:flex">
        <a href="#/" className="mb-6 flex items-center gap-2 px-2">
          <Logo />
        </a>
        <nav className="flex flex-col gap-0.5" aria-label="Main">
          {NAV.map((n) => {
            const active = isActive(path, n.href)
            return (
              <a
                key={n.href}
                href={`#${n.href}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                  active ? 'bg-surface-2 font-medium text-fg' : 'text-muted hover:bg-surface-2/60 hover:text-fg',
                )}
              >
                <n.icon className={cn('size-4', active && 'text-accent-text')} />
                {n.label}
              </a>
            )
          })}
        </nav>
        <div className="mt-auto rounded-lg border border-border bg-surface p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted">Level {level.level}</span>
            <span className="text-[11px] text-subtle">{levelTitle(level.level)}</span>
          </div>
          <Progress value={level.progress * 100} className="mt-2" label="Level progress" />
          <div className="mt-1.5 text-[11px] text-subtle">
            {level.into} / {level.needed} XP · {xp.toLocaleString()} total
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header data-focus-fade className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur sm:px-6">
          <a href="#/" className="lg:hidden" aria-label="KeyQuest home">
            <Logo compact />
          </a>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Tooltip content={streak > 0 ? `${streak}-day streak. Complete a run every day to keep it.` : 'No active streak. Complete a run today to start one.'}>
              <div className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm" tabIndex={0}>
                <Flame className={cn('size-4', streak > 0 ? 'text-accent-text' : 'text-subtle')} />
                <span className="tabular-nums">{streak}</span>
              </div>
            </Tooltip>
            <Tooltip content={`${level.into} / ${level.needed} XP to level ${level.level + 1}`}>
              <div className="flex h-8 items-center gap-2 rounded-lg px-2 text-sm" tabIndex={0}>
                <span className="rounded-md bg-accent px-1.5 text-xs font-semibold text-accent-fg">Lv {level.level}</span>
                <div className="hidden w-20 sm:block">
                  <Progress value={level.progress * 100} label="Level progress" />
                </div>
              </div>
            </Tooltip>
            <button
              type="button"
              onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}
              className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={settings.theme === 'system' ? 'Following system theme' : undefined}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <ProfileMenu />
          </div>
        </header>

        {storageError ? (
          <div role="alert" className="flex items-start gap-2 border-b border-border bg-danger-soft px-4 py-2 text-sm text-danger sm:px-6">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span className="flex-1">{storageError}</span>
            <button type="button" onClick={dismissStorageError} aria-label="Dismiss" className="rounded p-0.5 hover:bg-danger-soft">
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={path.split('?')[0]} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav data-focus-fade className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-bg/95 backdrop-blur lg:hidden" aria-label="Main">
        {NAV.map((n) => {
          const active = isActive(path, n.href)
          return (
            <a
              key={n.href}
              href={`#${n.href}`}
              aria-current={active ? 'page' : undefined}
              className={cn('flex flex-col items-center gap-0.5 py-2 text-[10px]', active ? 'text-fg' : 'text-subtle')}
            >
              <n.icon className={cn('size-5', active && 'text-accent-text')} />
              <span className="truncate">{n.label.replace('Game ', '')}</span>
            </a>
          )
        })}
      </nav>
    </div>
  )
}
