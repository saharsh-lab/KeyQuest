import { useEffect, useState } from 'react'
import { useStore } from '@/game/store'

/** The theme actually in effect ("system" resolved against the OS preference). */
export function useResolvedTheme(): 'dark' | 'light' {
  const { settings } = useStore()
  const [osLight, setOsLight] = useState(() => window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)')
    if (!mq) return
    const on = () => setOsLight(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  if (settings.theme === 'system') return osLight ? 'light' : 'dark'
  return settings.theme
}
