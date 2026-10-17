import { MotionConfig } from 'framer-motion'
import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react'
import { AppShell } from '@/components/AppShell'
import { Celebrations } from '@/components/Celebrations'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { StoreProvider } from '@/game/store'
import { useHashRoute } from '@/hooks/useHashRoute'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useResolvedTheme } from '@/hooks/useTheme'
const ArenaPage = lazy(() => import('@/pages/Arena').then((m) => ({ default: m.ArenaPage })))
const DashboardPage = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.DashboardPage })))
const LeaderboardPage = lazy(() => import('@/pages/Leaderboard').then((m) => ({ default: m.LeaderboardPage })))
const ModesPage = lazy(() => import('@/pages/Modes').then((m) => ({ default: m.ModesPage })))
const ProgressPage = lazy(() => import('@/pages/Progress').then((m) => ({ default: m.ProgressPage })))
const SettingsPage = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.SettingsPage })))
const BossBattlePage = lazy(() => import('@/pages/modes/BossBattle').then((m) => ({ default: m.BossBattlePage })))
const CodeRushPage = lazy(() => import('@/pages/modes/CodeRush').then((m) => ({ default: m.CodeRushPage })))
const DailyQuestPage = lazy(() => import('@/pages/modes/DailyQuest').then((m) => ({ default: m.DailyQuestPage })))
const GhostRacePage = lazy(() => import('@/pages/modes/GhostRace').then((m) => ({ default: m.GhostRacePage })))
const PrecisionPage = lazy(() => import('@/pages/modes/Precision').then((m) => ({ default: m.PrecisionPage })))
const SurvivalPage = lazy(() => import('@/pages/modes/Survival').then((m) => ({ default: m.SurvivalPage })))
const ZenPage = lazy(() => import('@/pages/modes/Zen').then((m) => ({ default: m.ZenPage })))

function route(path: string): ReactNode {
  const p = path.split('?')[0]
  switch (p) {
    case '/':
      return <DashboardPage />
    case '/arena':
      return <ArenaPage />
    case '/modes':
      return <ModesPage />
    case '/play/ghost':
      return <GhostRacePage />
    case '/play/boss':
      return <BossBattlePage />
    case '/play/survival':
      return <SurvivalPage />
    case '/play/code':
      return <CodeRushPage />
    case '/play/precision':
      return <PrecisionPage />
    case '/play/daily':
      return <DailyQuestPage />
    case '/play/zen':
      return <ZenPage />
    case '/progress':
      return <ProgressPage />
    case '/leaderboard':
      return <LeaderboardPage />
    case '/settings':
      return <SettingsPage />
    default:
      return (
        <div className="py-24 text-center">
          <h1 className="text-lg font-semibold">Page not found</h1>
          <p className="mt-1 text-sm text-muted">There is nothing at {p}.</p>
          <Button asChild variant="primary" className="mt-6">
            <a href="#/">Back to dashboard</a>
          </Button>
        </div>
      )
  }
}

function PageLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-48 animate-pulse rounded-md bg-surface-2" />
      <div className="h-40 animate-pulse rounded-card bg-surface-2" />
    </div>
  )
}

/** Applies theme and motion preferences to <html>. */
function DocumentPrefs() {
  const theme = useResolvedTheme()
  const reduced = useReducedMotion()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('reduce-motion', reduced)
  }, [theme, reduced])
  return null
}

function Shell() {
  const path = useHashRoute()
  const reduced = useReducedMotion()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [path])
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <DocumentPrefs />
      <AppShell path={path} minimal={path === '/play/zen'}>
        <ErrorBoundary key={path}>
          <Suspense fallback={<PageLoading />}>{route(path)}</Suspense>
        </ErrorBoundary>
      </AppShell>
      <Celebrations />
    </MotionConfig>
  )
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error(error)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-lg font-semibold">Something went wrong on this page</h1>
        <p className="mt-2 text-sm text-muted">Your saved progress is safe. Reload the page or head back to the dashboard.</p>
        <p className="mt-3 rounded-lg bg-surface-2 p-2 font-mono text-xs text-subtle">{this.state.error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button asChild variant="primary">
            <a href="#/">Dashboard</a>
          </Button>
        </div>
      </div>
    )
  }
}

export default function App() {
  // Outer boundary: an error in the shell, store or providers shows a recovery screen instead of a blank page.
  return (
    <ErrorBoundary>
      <StoreProvider>
        <TooltipProvider>
          <Shell />
        </TooltipProvider>
      </StoreProvider>
    </ErrorBoundary>
  )
}
