import { Heart, Pause, Play, Shield } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Stat } from '@/components/LiveStats'
import { Banner, ModeHeader } from '@/components/ModeHeader'
import { ResultsView } from '@/components/ResultsView'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ENGLISH_ADVANCED, ENGLISH_COMMON, PROGRAMMING_WORDS, TECHNOLOGY_WORDS } from '@/data/words'
import { createEngine } from '@/engine/engine'
import { accuracy, buildTimeline, consistency, perSecondSamples, wpm } from '@/engine/metrics'
import type { LogEvent } from '@/engine/types'
import type { SessionSummary } from '@/engine/useTypingSession'
import { useStore, type RecordOutcome } from '@/game/store'
import { useFocusMode } from '@/hooks/useFocusMode'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useSound } from '@/hooks/useSound'
import { cn, formatDuration, pick } from '@/lib/utils'

const DANGER = 0.86
const LIVES = 3
const FIELD_H = 440

interface Faller {
  id: number
  text: string
  x: number
  y: number
  speed: number
}

interface Game {
  status: 'idle' | 'running' | 'paused' | 'over'
  fallers: Faller[]
  elapsed: number
  nextSpawn: number
  lives: number
  cleared: number
  chars: number
  keystrokes: number
  correct: number
  errors: number
  keyHits: Record<string, number>
  keyMisses: Record<string, number>
  log: LogEvent[]
  nextId: number
  flash: number
}

const newGame = (): Game => ({
  status: 'idle',
  fallers: [],
  elapsed: 0,
  nextSpawn: 0,
  lives: LIVES,
  cleared: 0,
  chars: 0,
  keystrokes: 0,
  correct: 0,
  errors: 0,
  keyHits: {},
  keyMisses: {},
  log: [],
  nextId: 1,
  flash: -10000,
})

const EASY = ENGLISH_COMMON.filter((w) => w.length <= 5)
const MID = ENGLISH_COMMON.filter((w) => w.length >= 4)
const HARD = [...ENGLISH_ADVANCED.filter((w) => w.length <= 11), ...PROGRAMMING_WORDS, ...TECHNOLOGY_WORDS]

/** Difficulty ramps with survival time: spawn rate, fall speed and word length all increase. */
function curve(seconds: number) {
  return {
    spawnMs: Math.max(650, 2300 - seconds * 18),
    speed: Math.min(0.3, 0.065 + seconds * 0.0016),
    pool: seconds < 30 ? EASY : seconds < 80 ? MID : HARD,
  }
}

export function SurvivalPage() {
  const { results, recordResult } = useStore()
  const sound = useSound()
  const game = useRef<Game>(newGame())
  const [, setFrame] = useState(0)
  const [buffer, setBuffer] = useState('')
  const [badAt, setBadAt] = useState(-1e9)
  const [outcome, setOutcome] = useState<RecordOutcome | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bestMs = results.filter((r) => r.mode === 'survival' && r.valid).reduce((m, r) => Math.max(m, r.durationMs), 0)
  const bufferRef = useRef('')
  bufferRef.current = buffer

  const end = useCallback(() => {
    const g = game.current
    g.status = 'over'
    const ms = g.elapsed
    const samples = perSecondSamples(g.log, ms)
    const summary: SessionSummary = {
      reason: 'complete',
      durationMs: ms,
      wpm: wpm(g.chars, ms),
      raw: wpm(g.keystrokes, ms),
      accuracy: accuracy(g.correct, g.keystrokes),
      consistency: consistency(samples.map((s) => s.raw)),
      correctChars: g.chars,
      incorrectChars: 0,
      errors: g.errors,
      keystrokes: g.keystrokes,
      backspaces: 0,
      totalChars: g.chars,
      completed: true,
      samples,
      keyHits: g.keyHits,
      keyMisses: g.keyMisses,
      timeline: buildTimeline(g.log, ms),
      bestStreak: 0,
      engine: createEngine(''),
    }
    const out = recordResult({
      summary,
      mode: 'survival',
      config: { difficulty: 'medium', category: 'common' },
      meta: { wordsCleared: g.cleared, survivedMs: Math.round(ms) },
      modeXp: () => ({ amount: g.cleared + Math.floor(ms / 30000) * 10, reason: `Survived ${formatDuration(ms)}, ${g.cleared} words` }),
    })
    setOutcome(out)
    setFrame((f) => f + 1)
  }, [recordResult])

  // Game loop.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      // Real elapsed time; only very long gaps (a backgrounded tab) are clamped.
      const dt = Math.min(250, now - last)
      last = now
      const g = game.current
      if (g.status === 'running') {
        g.elapsed += dt
        const c = curve(g.elapsed / 1000)
        if (g.elapsed >= g.nextSpawn && g.fallers.length < 9) {
          let text = pick(c.pool, Math.random)
          // Avoid two falling words with the same first letter, so a prefix always means one word.
          for (let i = 0; i < 6 && g.fallers.some((f) => f.text[0] === text[0]); i++) text = pick(c.pool, Math.random)
          const width = Math.min(0.5, text.length * 0.018 + 0.04)
          g.fallers.push({ id: g.nextId++, text, x: 0.02 + Math.random() * (0.96 - width), y: -0.04, speed: c.speed * (0.85 + Math.random() * 0.3) })
          g.nextSpawn = g.elapsed + c.spawnMs
        }
        for (const f of g.fallers) f.y += (f.speed * dt) / 1000
        const landed = g.fallers.filter((f) => f.y >= DANGER)
        if (landed.length) {
          g.fallers = g.fallers.filter((f) => f.y < DANGER)
          g.lives = Math.max(0, g.lives - landed.length)
          g.flash = g.elapsed
          sound.hit()
          if (landed.some((f) => bufferRef.current && f.text.startsWith(bufferRef.current))) setBuffer('')
          if (g.lives <= 0) {
            end()
            return
          }
        }
        setFrame((f) => (f + 1) % 1e6)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [end, sound])

  const pause = useCallback(() => {
    const g = game.current
    if (g.status === 'running') g.status = 'paused'
    else if (g.status === 'paused') {
      g.status = 'running'
      inputRef.current?.focus()
    }
    setFrame((f) => f + 1)
  }, [])

  useEffect(() => {
    const onVis = () => document.hidden && game.current.status === 'running' && pause()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [pause])

  useShortcuts({ Escape: () => pause() }, !outcome)

  const start = () => {
    game.current = newGame()
    game.current.status = 'running'
    setBuffer('')
    setOutcome(null)
    setFrame((f) => f + 1)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const onChange = (value: string) => {
    const g = game.current
    if (g.status === 'idle') {
      g.status = 'running'
    } else if (g.status === 'paused') g.status = 'running'
    else if (g.status !== 'running') return
    if (value.length < buffer.length) {
      setBuffer(value.replace(/\s/g, ''))
      return
    }
    let buf = buffer
    for (const ch of value.slice(buffer.length)) {
      if (/\s/.test(ch)) continue
      const cand = buf + ch
      const target = g.fallers.filter((f) => f.text.startsWith(buf)).sort((a, b) => b.y - a.y)[0]
      g.keystrokes++
      const hit = g.fallers.some((f) => f.text.startsWith(cand))
      const expected = target?.text[buf.length]
      if (expected) {
        const k = expected.toLowerCase()
        g.keyHits[k] = (g.keyHits[k] ?? 0) + 1
        if (!hit) g.keyMisses[k] = (g.keyMisses[k] ?? 0) + 1
      }
      if (hit) {
        g.correct++
        buf = cand
        const done = g.fallers.filter((f) => f.text === buf).sort((a, b) => b.y - a.y)[0]
        if (done) {
          g.fallers = g.fallers.filter((f) => f.id !== done.id)
          g.cleared++
          g.chars += done.text.length
          buf = ''
        }
        g.log.push({ t: g.elapsed, kind: 'char', correct: true, net: g.chars })
        sound.key(true)
      } else {
        g.errors++
        g.log.push({ t: g.elapsed, kind: 'char', correct: false, net: g.chars })
        sound.key(false)
        setBadAt(performance.now())
      }
    }
    setBuffer(buf)
  }

  const g = game.current
  useFocusMode(g.status === 'running')
  const seconds = g.elapsed / 1000
  const liveWpm = g.elapsed > 1000 ? wpm(g.chars, g.elapsed) : 0
  const flashing = g.elapsed - g.flash < 350

  return (
    <div className="flex flex-col gap-6">
      <ModeHeader
        icon={Shield}
        title="Survival"
        description="Type falling words before they hit the danger line. Typing a word clears it instantly. It speeds up the longer you last."
        right={bestMs ? <span className="text-sm text-muted">Longest survival: <span className="text-fg tabular-nums">{formatDuration(bestMs)}</span></span> : null}
      />

      {outcome ? (
        <ResultsView
          outcome={outcome}
          onRestart={start}
          restartLabel="Play again"
          header={
            <Banner tone={outcome.result.durationMs >= bestMs && outcome.result.valid ? 'win' : 'neutral'} title={`Survived ${formatDuration(outcome.result.durationMs)} · ${outcome.result.meta?.wordsCleared} words cleared`}>
              {outcome.result.durationMs >= bestMs && outcome.result.valid && bestMs > 0 ? 'New longest survival!' : bestMs ? `Your longest is ${formatDuration(Math.max(bestMs, outcome.result.durationMs))}.` : 'Your first survival run is on the board.'}
            </Banner>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <Stat label="time" value={formatDuration(g.elapsed)} accent />
              <Stat label="cleared" value={g.cleared} />
              <Stat label="wpm" value={Math.round(liveWpm)} />
              <Stat label="accuracy" value={`${Math.round(accuracy(g.correct, g.keystrokes))}%`} />
              <div className="flex flex-col">
                <span className="flex h-7 items-center gap-1" aria-label={`${g.lives} lives left`}>
                  {Array.from({ length: LIVES }).map((_, i) => (
                    <Heart key={i} className={cn('size-5', i < g.lives ? 'fill-danger text-danger' : 'text-subtle')} />
                  ))}
                </span>
                <span className="mt-1 text-[11px] uppercase tracking-wider text-subtle">lives</span>
              </div>
            </div>
            {g.status === 'running' || g.status === 'paused' ? (
              <Button variant="secondary" size="sm" onClick={pause}>
                {g.status === 'paused' ? <Play /> : <Pause />} {g.status === 'paused' ? 'Resume' : 'Pause'} (Esc)
              </Button>
            ) : null}
          </div>

          <Card className={cn('relative overflow-hidden transition-colors', flashing && 'border-danger')} style={{ height: FIELD_H }} onMouseDown={(e) => { e.preventDefault(); inputRef.current?.focus() }}>
            <div className="absolute inset-x-0 border-t border-dashed border-danger/60" style={{ top: `${DANGER * 100}%` }}>
              <span className="absolute right-3 top-1 text-[10px] uppercase tracking-wider text-danger/80">danger line</span>
            </div>
            {flashing ? <div className="absolute inset-x-0 bottom-0 bg-danger-soft" style={{ top: `${DANGER * 100}%` }} /> : null}
            {g.fallers.map((f) => {
              const active = buffer && f.text.startsWith(buffer)
              const near = f.y > DANGER - 0.2
              return (
                <div
                  key={f.id}
                  className={cn('absolute whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-[17px]', active ? 'bg-accent-soft' : 'bg-surface-2', near && !active && 'text-danger')}
                  style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }}
                >
                  {active ? (
                    <>
                      <span className="text-accent-text">{buffer}</span>
                      <span>{f.text.slice(buffer.length)}</span>
                    </>
                  ) : (
                    f.text
                  )}
                </div>
              )
            })}
            {g.status === 'idle' || g.status === 'paused' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/60 backdrop-blur-[1px]">
                <p className="text-sm text-muted">{g.status === 'paused' ? 'Paused' : 'Words start falling as soon as you begin.'}</p>
                <Button variant="primary" onClick={g.status === 'paused' ? pause : start}>
                  <Play /> {g.status === 'paused' ? 'Resume' : 'Start'}
                </Button>
              </div>
            ) : null}
            <div className="absolute bottom-3 left-1/2 w-[min(320px,80%)] -translate-x-1/2">
              <input
                ref={inputRef}
                value={buffer}
                onChange={(e) => onChange(e.target.value)}
                aria-label="Type falling words here"
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                placeholder={g.status === 'running' ? 'type a word…' : ''}
                className={cn('h-10 w-full rounded-lg border bg-surface px-3 text-center font-mono text-base outline-none transition-colors', performance.now() - badAt < 220 ? 'border-danger' : 'border-border-strong focus:border-accent-text')}
              />
            </div>
          </Card>
          <p className="text-center text-xs text-subtle">
            Survival time so far: {seconds.toFixed(1)}s · wrong letters are rejected and count as errors · Esc pauses
          </p>
        </>
      )}
    </div>
  )
}
