import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MousePointerClick } from 'lucide-react'
import type { TypedChar } from '@/engine/types'
import type { TypingSession } from '@/engine/useTypingSession'
import { useStore } from '@/game/store'
import type { FontSize } from '@/game/types'
import { useFocusMode } from '@/hooks/useFocusMode'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/utils'

const FONT_PX: Record<FontSize, number> = { sm: 20, md: 24, lg: 29, xl: 35 }
const CODE_FONT_PX: Record<FontSize, number> = { sm: 15, md: 17, lg: 20, xl: 24 }
const LINE = 1.6

/** Per-character state codes: c = correct, x = wrong, a = auto-inserted, - = not typed yet. */
function codesFor(typed: TypedChar[], start: number, end: number): string {
  let s = ''
  for (let i = start; i < end; i++) {
    const t = typed[i]
    s += !t ? '-' : t.auto ? 'a' : t.correct ? 'c' : 'x'
  }
  return s
}

const Chunk = memo(function Chunk({ text, start, codes, code }: { text: string; start: number; codes: string; code?: boolean }) {
  return (
    <>
      {[...text].map((ch, j) => {
        const st = codes[j]
        const isNl = ch === '\n'
        const isSpace = ch === ' '
        return (
          <span
            key={j}
            data-i={start + j}
            className={cn(isSpace && st === 'x' && 'rounded-sm bg-[var(--arena-error)]/25', isNl && 'select-none opacity-40')}
            style={{
              color: st === 'c' || st === 'a' ? 'var(--arena-correct)' : st === 'x' ? 'var(--arena-error)' : 'var(--arena-pending)',
              textDecorationLine: st === 'x' && !isSpace && !isNl ? 'underline' : 'none',
              textDecorationThickness: '2px',
              textUnderlineOffset: '6px',
            }}
          >
            {isNl ? (code ? '↵' : ' ') : ch}
            {isNl ? '\n' : null}
          </span>
        )
      })}
    </>
  )
})

interface Props {
  session: TypingSession
  variant?: 'flow' | 'code'
  lines?: number
  onShortcut?: (e: React.KeyboardEvent<HTMLElement>) => boolean
  autoFocus?: boolean
  className?: string
  /** Hide colouring of mistakes (Zen keeps it; used nowhere else by default). */
  ariaLabel?: string
  disabled?: boolean
  /** Character index reached by a ghost opponent; drawn as a second, faint caret. */
  ghostPos?: number
}

export function TypingSurface({ session, variant = 'flow', lines, onShortcut, autoFocus = true, className, ariaLabel = 'Typing area', disabled, ghostPos }: Props) {
  const { settings } = useStore()
  const reduced = useReducedMotion()
  useFocusMode(session.status === 'running' && !disabled)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const [caret, setCaret] = useState({ left: 0, top: 0, width: 12 })
  const [offset, setOffset] = useState(0)
  const [ghost, setGhost] = useState<{ left: number; top: number } | null>(null)

  const { engine, status } = session
  const code = variant === 'code'
  const fontPx = code ? CODE_FONT_PX[settings.fontSize] : FONT_PX[settings.fontSize]
  const lineH = Math.round(fontPx * LINE)
  const visibleLines = lines ?? (code ? 12 : 3)
  const pos = engine.typed.length

  // Split into chunks (words for flow text, lines for code) so only the active chunk re-renders per key.
  const chunks = useMemo(() => {
    const out: { start: number; text: string }[] = []
    const t = engine.target
    if (code) {
      let s = 0
      for (let i = 0; i < t.length; i++) {
        if (t[i] === '\n') {
          out.push({ start: s, text: t.slice(s, i + 1) })
          s = i + 1
        }
      }
      if (s < t.length) out.push({ start: s, text: t.slice(s) })
    } else {
      const re = /\S+\s?|\s/g
      let m: RegExpExecArray | null
      while ((m = re.exec(t))) out.push({ start: m.index, text: m[0] })
    }
    return out
  }, [engine.target, code])

  const focus = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.value = ' '
    el.setSelectionRange(1, 1)
  }, [])

  useEffect(() => {
    if (autoFocus && !disabled) focus()
  }, [autoFocus, disabled, focus])

  // Typing anywhere on the page focuses the typing area (unless the user is in another field).
  useEffect(() => {
    if (disabled) return
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return
      const t = e.target as HTMLElement
      if (t && t !== document.body) {
        if (t.closest('input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="dialog"], [role="slider"]')) return
        // Space and Enter keep activating whatever button or link has focus.
        if ((e.key === ' ' || e.key === 'Enter') && t.closest('button, a, [role="radio"], [role="switch"], [role="tab"]')) return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        focus()
        e.preventDefault()
        session.handleKeyDown(e)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled, focus, session])

  // Measure caret position after every change and scroll so the active line stays in view.
  useLayoutEffect(() => {
    const inner = innerRef.current
    if (!inner) return
    const atEnd = pos >= engine.target.length
    const idx = atEnd ? engine.target.length - 1 : pos
    const el = inner.querySelector<HTMLElement>(`[data-i="${idx}"]`)
    if (!el) {
      setCaret({ left: 0, top: 0, width: fontPx * 0.6 })
      setOffset(0)
      return
    }
    let left = el.offsetLeft + (atEnd ? el.offsetWidth : 0)
    // Snap to the top of the line box (inline spans report the top of their glyph area).
    let top = Math.floor((el.offsetTop + 2) / lineH) * lineH
    // A caret sitting on a newline belongs at the end of that line, which is where the ↵ glyph is.
    if (atEnd && engine.target[idx] === '\n') {
      left = 0
      top += lineH
    }
    setCaret({ left, top, width: Math.max(el.offsetWidth, fontPx * 0.5) })
    const anchor = code ? Math.min(4, visibleLines - 2) : 1
    setOffset(Math.max(0, top - lineH * anchor))
  }, [pos, engine.target, fontPx, lineH, code, visibleLines, chunks])

  useLayoutEffect(() => {
    const inner = innerRef.current
    if (ghostPos === undefined || !inner) return setGhost(null)
    const i = Math.min(Math.floor(ghostPos), engine.target.length - 1)
    const el = inner.querySelector<HTMLElement>(`[data-i="${i}"]`)
    if (!el) return setGhost(null)
    setGhost({ left: el.offsetLeft + (ghostPos >= engine.target.length ? el.offsetWidth : 0), top: Math.floor((el.offsetTop + 2) / lineH) * lineH })
  }, [ghostPos, engine.target, lineH, chunks])

  const caretStyle = settings.caretStyle
  const blinking = status !== 'running'
  const smooth = settings.smoothCaret && !reduced

  return (
    <div
      className={cn('relative rounded-card', `arena-theme-${settings.arenaTheme}`, className)}
      style={{ background: 'var(--arena-bg)' }}
      onMouseDown={(e) => {
        e.preventDefault()
        focus()
      }}
    >
      <div
        className="relative overflow-hidden font-mono"
        style={{ height: lineH * visibleLines, fontSize: fontPx, lineHeight: `${lineH}px` }}
        aria-hidden
      >
        <div
          ref={innerRef}
          className={cn('relative', code ? 'whitespace-pre' : 'whitespace-pre-wrap break-words')}
          style={{ transform: `translateY(${-offset}px)`, transition: smooth ? 'transform 160ms ease-out' : undefined, overflowWrap: 'anywhere' }}
        >
          {chunks.map((c) => (
            <Chunk key={c.start} text={c.text} start={c.start} codes={codesFor(engine.typed, c.start, c.start + c.text.length)} code={code} />
          ))}
          {ghost ? (
            <span
              className="pointer-events-none absolute rounded-full opacity-50"
              style={{ left: ghost.left - 1, top: ghost.top + lineH * 0.12, width: 2.5, height: lineH * 0.76, background: 'var(--fg-subtle)', transition: smooth ? 'left 120ms linear, top 120ms linear' : undefined }}
              title="Ghost"
            />
          ) : null}
          {caretStyle !== 'off' && focused && status !== 'finished' ? (
            <span
              className={cn('pointer-events-none absolute rounded-full', blinking && 'caret-blink')}
              style={{
                left: caret.left - (caretStyle === 'line' ? 1 : 0),
                top: caretStyle === 'underline' ? caret.top + lineH - 6 : caret.top + lineH * 0.12,
                width: caretStyle === 'line' ? 2.5 : caret.width,
                height: caretStyle === 'underline' ? 3 : lineH * 0.76,
                background: 'var(--arena-caret)',
                opacity: caretStyle === 'block' ? 0.35 : 1,
                borderRadius: caretStyle === 'block' ? 4 : 2,
                transition: smooth ? 'left 90ms ease-out, top 90ms ease-out' : undefined,
              }}
            />
          ) : null}
        </div>
      </div>

      <textarea
        ref={inputRef}
        data-typing="true"
        aria-label={ariaLabel}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        defaultValue=" "
        disabled={disabled}
        className="absolute inset-0 h-full w-full cursor-default resize-none opacity-0"
        style={{ fontSize: 16 }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (onShortcut?.(e)) return
          session.handleKeyDown(e)
        }}
        onInput={session.handleInput}
        onPaste={(e) => e.preventDefault()}
      />

      {(!focused || status === 'paused') && !disabled && status !== 'finished' ? (
        <button
          type="button"
          onClick={focus}
          className="absolute inset-0 flex items-center justify-center gap-2 rounded-card bg-bg/70 text-sm text-muted backdrop-blur-[2px] hover:text-fg"
        >
          <MousePointerClick className="size-4" />
          {status === 'paused' ? 'Paused. Keep typing to resume' : 'Click here or start typing to focus'}
        </button>
      ) : null}
    </div>
  )
}
