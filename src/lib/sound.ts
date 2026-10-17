/**
 * Synthesized sounds (Web Audio): no audio files to download, and nothing plays until the player
 * has interacted with the page, as browsers require.
 */
import type { SoundProfile } from '@/game/types'

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function blip(freq: number, duration: number, volume: number, type: OscillatorType, sweepTo?: number) {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t + duration)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

function noiseBurst(duration: number, volume: number, filterFreq: number) {
  const ac = audio()
  if (!ac) return
  const len = Math.floor(ac.sampleRate * duration)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
  const src = ac.createBufferSource()
  src.buffer = buf
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = filterFreq
  const gain = ac.createGain()
  gain.gain.value = volume
  src.connect(filter).connect(gain).connect(ac.destination)
  src.start()
}

export function playKey(profile: SoundProfile, volume: number) {
  const jitter = 0.94 + Math.random() * 0.12
  if (profile === 'click') noiseBurst(0.03, volume * 1.6, 3200 * jitter)
  else if (profile === 'typewriter') {
    noiseBurst(0.05, volume * 2, 1800 * jitter)
    blip(140 * jitter, 0.05, volume * 0.3, 'square')
  } else blip(620 * jitter, 0.05, volume * 0.25, 'sine', 420)
}

export function playError(volume: number) {
  blip(180, 0.12, volume * 0.35, 'triangle', 110)
}

export function playSuccess(volume: number) {
  blip(660, 0.12, volume * 0.3, 'sine')
  setTimeout(() => blip(990, 0.18, volume * 0.3, 'sine'), 90)
}

export function playHit(volume: number) {
  blip(90, 0.18, volume * 0.5, 'sawtooth', 50)
}

// ---- Ambient (Zen mode): filtered brown noise with a slow swell, like distant rain. ----

let ambient: { stop: () => void } | null = null

export function startAmbient(volume: number) {
  stopAmbient()
  const ac = audio()
  if (!ac) return
  const len = ac.sampleRate * 4
  const buf = ac.createBuffer(2, len, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let last = 0
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      d[i] = last * 3.5
    }
  }
  const src = ac.createBufferSource()
  src.buffer = buf
  src.loop = true
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 900
  const gain = ac.createGain()
  gain.gain.value = 0
  gain.gain.linearRampToValueAtTime(volume * 0.5, ac.currentTime + 2)
  const lfo = ac.createOscillator()
  const lfoGain = ac.createGain()
  lfo.frequency.value = 0.07
  lfoGain.gain.value = 250
  lfo.connect(lfoGain).connect(filter.frequency)
  src.connect(filter).connect(gain).connect(ac.destination)
  src.start()
  lfo.start()
  ambient = {
    stop: () => {
      const t = ac.currentTime
      gain.gain.cancelScheduledValues(t)
      gain.gain.setValueAtTime(gain.gain.value, t)
      gain.gain.linearRampToValueAtTime(0, t + 0.6)
      setTimeout(() => {
        try {
          src.stop()
          lfo.stop()
        } catch {
          /* already stopped */
        }
      }, 700)
    },
  }
}

export function stopAmbient() {
  ambient?.stop()
  ambient = null
}
