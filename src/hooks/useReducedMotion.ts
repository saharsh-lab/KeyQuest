import { useEffect, useState } from 'react'
import { useStore } from '@/game/store'

export function useReducedMotion(): boolean {
  const { settings } = useStore()
  const [os, setOs] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setOs(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return settings.reducedMotion === 'on' || (settings.reducedMotion === 'system' && os)
}
