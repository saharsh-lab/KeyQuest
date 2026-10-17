import { AnimatePresence, motion } from 'framer-motion'
import { Award, Map, Sparkles, Target, Trophy, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useStore, type Celebration } from '@/game/store'

const ICONS = { level: Sparkles, achievement: Award, mission: Target, quest: Map, pb: Trophy }

function Toast({ c, onDone }: { c: Celebration; onDone: () => void }) {
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const id = setTimeout(() => done.current(), 5200)
    return () => clearTimeout(id)
  }, [])
  const Icon = ICONS[c.kind]
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="pointer-events-auto flex w-80 max-w-[calc(100vw-32px)] items-start gap-3 rounded-card border border-border bg-surface p-3.5 shadow-card"
      role="status"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
        <Icon className="size-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{c.title}</div>
        <div className="mt-0.5 text-xs text-muted">{c.detail}</div>
      </div>
      <button type="button" onClick={onDone} aria-label="Dismiss" className="rounded p-0.5 text-subtle hover:text-fg">
        <X className="size-3.5" />
      </button>
    </motion.div>
  )
}

/** Milestone toasts: level-ups, achievements, missions and quests. */
export function Celebrations() {
  const { celebrations, dismissCelebration } = useStore()
  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-50 flex flex-col gap-2 lg:bottom-6" aria-live="polite">
      <AnimatePresence>
        {celebrations.slice(0, 2).map((c) => (
          <Toast key={c.id} c={c} onDone={() => dismissCelebration(c.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}
