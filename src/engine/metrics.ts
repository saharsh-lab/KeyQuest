/**
 * Metric definitions (shown to players on the results screen as well):
 *
 * - WPM (net): correct characters currently in the buffer ÷ 5 ÷ minutes. Characters that were typed wrong
 *   and later fixed count once, as correct. Uncorrected mistakes add nothing.
 * - Raw WPM: every character keystroke (right or wrong, including ones later deleted) ÷ 5 ÷ minutes.
 * - Accuracy: correct keystrokes ÷ all character keystrokes. A corrected mistake still lowers accuracy.
 * - Consistency: 100 × (1 − coefficient of variation) of the per-second raw WPM, clamped to 0–100.
 * - Time: active time from the first keystroke, excluding pauses. Timed tests end exactly at the limit.
 */
import type { LogEvent, PerSecondSample } from './types'

export const CHARS_PER_WORD = 5

export function wpm(chars: number, ms: number): number {
  if (ms <= 0) return 0
  return chars / CHARS_PER_WORD / (ms / 60000)
}

export function accuracy(correct: number, total: number): number {
  return total === 0 ? 100 : (correct / total) * 100
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const v = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.sqrt(v)
}

export function consistency(values: number[]): number {
  const vals = values.filter((v) => Number.isFinite(v))
  if (vals.length < 2) return vals.length === 1 ? 100 : 0
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  if (mean === 0) return 0
  return Math.max(0, Math.min(100, 100 * (1 - stdDev(vals) / mean)))
}

/**
 * Rebuild per-second samples from the event log. `wpm` is cumulative net WPM at the end of each second;
 * `raw` is the raw WPM within that second alone; `errors` are mistakes made during that second.
 * A trailing partial second shorter than 0.5s is merged into the previous one so it does not skew graphs.
 */
export function perSecondSamples(log: LogEvent[], durationMs: number): PerSecondSample[] {
  if (durationMs <= 0) return []
  let seconds = Math.ceil(durationMs / 1000)
  const tail = durationMs - (seconds - 1) * 1000
  const mergeTail = seconds > 1 && tail < 500
  if (mergeTail) seconds -= 1
  const chars = new Array(seconds).fill(0)
  const errs = new Array(seconds).fill(0)
  const netAt = new Array(seconds).fill(-1)
  for (const e of log) {
    const idx = Math.min(seconds - 1, Math.floor(e.t / 1000))
    if (e.kind === 'char') {
      chars[idx]++
      if (!e.correct) errs[idx]++
    }
    netAt[idx] = e.net
  }
  const out: PerSecondSample[] = []
  let lastNet = 0
  for (let i = 0; i < seconds; i++) {
    if (netAt[i] >= 0) lastNet = netAt[i]
    const end = i === seconds - 1 ? durationMs : (i + 1) * 1000
    const span = end - i * 1000
    out.push({
      s: i + 1,
      wpm: Math.round(wpm(lastNet, end)),
      raw: Math.round(wpm(chars[i], span)),
      errors: errs[i],
    })
  }
  return out
}

/** Compact [t, net] pairs at a fixed resolution for ghost replays. */
export function buildTimeline(log: LogEvent[], durationMs: number, step = 200): number[] {
  const out: number[] = [0, 0]
  let i = 0
  let net = 0
  for (let t = step; t < durationMs + step; t += step) {
    const at = Math.min(t, durationMs)
    while (i < log.length && log[i].t <= at) net = log[i++].net
    out.push(Math.round(at), net)
    if (at === durationMs) break
  }
  return out
}

/** Net characters a timeline had reached at time `t` (linear between samples). */
export function timelineAt(timeline: number[], t: number): number {
  if (!timeline.length) return 0
  for (let i = 2; i < timeline.length; i += 2) {
    const t1 = timeline[i]
    if (t1 >= t) {
      const t0 = timeline[i - 2]
      const n0 = timeline[i - 1]
      const n1 = timeline[i + 1]
      const f = t1 === t0 ? 1 : (t - t0) / (t1 - t0)
      return n0 + (n1 - n0) * f
    }
  }
  return timeline[timeline.length - 1]
}
