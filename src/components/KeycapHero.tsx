import { useEffect, useRef } from 'react'
import { useStore } from '@/game/store'
import { navigate } from '@/hooks/useHashRoute'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useSound } from '@/hooks/useSound'
import { cn } from '@/lib/utils'

const ROWS = [
  { keys: ['K', 'E', 'Y'], offset: 0.6 },
  { keys: ['Q', 'U', 'E', 'S', 'T'], offset: 0 },
]

function Cap({ label, wide, accent, delay, onPress }: { label: string; wide?: boolean; accent?: boolean; delay: number; onPress: (el: HTMLElement) => void }) {
  return (
    <div className="hero-float" style={{ animationDelay: `${delay}s` }}>
      <button
        type="button"
        tabIndex={-1}
        data-char={label.length === 1 ? label.toLowerCase() : undefined}
        onPointerDown={(e) => onPress(e.currentTarget)}
        className={cn('hero-cap', wide && 'is-wide', accent && 'is-accent')}
        aria-hidden
      >
        <span className="hero-face hero-top">{label}</span>
        <span className="hero-face hero-front" />
        <span className="hero-face hero-left" />
        <span className="hero-face hero-right" />
      </button>
    </div>
  )
}

/**
 * A small CSS-3D board of floating keycaps. It leans toward the pointer, and real keystrokes press
 * the matching caps. Enter jumps into the Arena.
 */
export function KeycapHero({ className }: { className?: string }) {
  const { settings } = useStore()
  const reduced = useReducedMotion()
  const sound = useSound()
  const wrap = useRef<HTMLDivElement>(null)
  const flat = !settings.effects3d

  const press = (el: Element | null) => {
    if (!el) return
    el.classList.remove('is-down')
    // Force a reflow so repeated presses replay the animation.
    void (el as HTMLElement).offsetWidth
    el.classList.add('is-down')
    window.setTimeout(() => el.classList.remove('is-down'), 160)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [role="dialog"], [role="combobox"]')) return
      const root = wrap.current
      if (!root) return
      if (e.key === 'Enter' && !t?.closest('button, a')) {
        press(root.querySelector('.hero-cap.is-accent'))
        sound.key(true)
        window.setTimeout(() => navigate('/arena'), 140)
        return
      }
      if (e.key.length !== 1) return
      const caps = root.querySelectorAll(`[data-char="${CSS.escape(e.key.toLowerCase())}"]`)
      if (caps.length) {
        caps.forEach(press)
        sound.key(true)
      } else {
        root.classList.remove('is-bump')
        void root.offsetWidth
        root.classList.add('is-bump')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sound])

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || flat || e.pointerType === 'touch') return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    e.currentTarget.style.setProperty('--tilt-x', `${(-y * 14).toFixed(2)}deg`)
    e.currentTarget.style.setProperty('--tilt-z', `${(x * 18).toFixed(2)}deg`)
  }
  const onLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--tilt-x', '0deg')
    e.currentTarget.style.setProperty('--tilt-z', '0deg')
  }

  let i = 0
  return (
    <div ref={wrap} onPointerMove={onMove} onPointerLeave={onLeave} className={cn('hero-scene', flat && 'is-flat', className)} aria-hidden>
      <div className="hero-board">
        {ROWS.map((row, r) => (
          <div
            key={r}
            className="flex gap-[var(--gap)]"
            style={{
              marginLeft: `calc(${row.offset} * (var(--cap) + var(--gap)))`,
            }}
          >
            {row.keys.map((k, c) => {
              const d = (i++ * 0.37) % 3
              return (
                <Cap
                  key={c}
                  label={k}
                  delay={-d}
                  onPress={(el) => {
                    press(el)
                    sound.key(true)
                  }}
                />
              )
            })}
            {r === 1 ? (
              <Cap
                label="GO"
                wide
                accent
                delay={-1.2}
                onPress={(el) => {
                  press(el)
                  sound.key(true)
                  window.setTimeout(() => navigate('/arena'), 140)
                }}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
