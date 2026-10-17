import { useEffect, useRef } from 'react'

/** Return false from a handler to let the key through (e.g. Tab while navigating controls). */
export type ShortcutMap = Record<string, (e: KeyboardEvent) => boolean | void>

/**
 * Global shortcuts, captured before the typing input sees the key.
 * Keys are written like "Tab", "Escape", "Alt+KeyR", "Shift+Enter" (using KeyboardEvent.code for letters/digits).
 * Ignored while the user is typing into any other text field (custom text, profile names...).
 */
export function useShortcuts(map: ShortcutMap, enabled = true) {
  const ref = useRef(map)
  ref.current = map
  useEffect(() => {
    if (!enabled) return
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const isTyping = t?.dataset?.typing === 'true'
      if (!isTyping && t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (t?.closest?.('[role="dialog"]')) return
      const parts: string[] = []
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      const base = e.altKey ? e.code : e.key
      const combo = [...parts, base].join('+')
      const handler = ref.current[combo] ?? (e.shiftKey && !e.altKey ? undefined : ref.current[e.key])
      if (handler && !e.ctrlKey && !e.metaKey) {
        if (handler(e) === false) return
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', on, true)
    return () => window.removeEventListener('keydown', on, true)
  }, [enabled])
}

/** True when focus is in the typing area or nowhere in particular (safe to treat Tab as "restart"). */
export function focusIsNeutral(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return !t || t === document.body || t.dataset?.typing === 'true'
}
