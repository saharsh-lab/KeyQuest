import { useEffect } from 'react'
import { useStore } from '@/game/store'

/**
 * Monkeytype-style focus: while a run is active, everything marked `data-focus-fade` fades out and the
 * cursor hides. Moving the mouse brings the interface back until the next keystroke.
 */
export function useFocusMode(active: boolean) {
  const { settings } = useStore()
  const on = active && settings.focusMode
  useEffect(() => {
    const root = document.documentElement
    if (!on) return
    root.classList.add('is-typing')
    let x = -1
    let y = -1
    const show = (e: MouseEvent) => {
      // Ignore the synthetic zero-distance moves some browsers fire on scroll or focus.
      if (x >= 0 && Math.abs(e.clientX - x) + Math.abs(e.clientY - y) > 4) root.classList.remove('is-typing')
      x = e.clientX
      y = e.clientY
    }
    const hide = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key !== 'Escape') root.classList.add('is-typing')
    }
    window.addEventListener('mousemove', show)
    window.addEventListener('keydown', hide)
    return () => {
      window.removeEventListener('mousemove', show)
      window.removeEventListener('keydown', hide)
      root.classList.remove('is-typing')
    }
  }, [on])
}
