import type { ReactNode } from 'react'
import { useStore } from '@/game/store'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/utils'

/** Leans its child toward the pointer with a soft glare, like a card held in the hand. */
export function Tilt({ children, className, max = 8 }: { children: ReactNode; className?: string; max?: number }) {
  const { settings } = useStore()
  const reduced = useReducedMotion()
  const enabled = settings.effects3d && !reduced

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || e.pointerType === 'touch') return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    const el = e.currentTarget
    el.style.setProperty('--rx', `${((0.5 - y) * max).toFixed(2)}deg`)
    el.style.setProperty('--ry', `${((x - 0.5) * max).toFixed(2)}deg`)
    el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`)
    el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`)
    el.dataset.hover = 'true'
  }
  const onLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    delete el.dataset.hover
  }

  return (
    <div className={cn('tilt', className)} onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="tilt-inner h-full">{children}</div>
    </div>
  )
}
