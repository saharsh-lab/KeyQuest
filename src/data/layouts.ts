import type { KeyboardLayout } from '@/game/types'

export type Finger = 'lp' | 'lr' | 'lm' | 'li' | 'ri' | 'rm' | 'rr' | 'rp' | 'th'

export interface KeyDef {
  /** Unshifted character. */
  base: string
  /** Shifted character. */
  shift: string
  finger: Finger
}

export const FINGER_NAMES: Record<Finger, string> = {
  lp: 'Left pinky',
  lr: 'Left ring',
  lm: 'Left middle',
  li: 'Left index',
  ri: 'Right index',
  rm: 'Right middle',
  rr: 'Right ring',
  rp: 'Right pinky',
  th: 'Thumb',
}

// Finger assignment is positional (standard touch-typing), so it is shared by every layout.
const FINGERS: Finger[][] = [
  ['lp', 'lp', 'lr', 'lm', 'li', 'li', 'ri', 'ri', 'rm', 'rr', 'rp', 'rp', 'rp'],
  ['lp', 'lr', 'lm', 'li', 'li', 'ri', 'ri', 'rm', 'rr', 'rp', 'rp', 'rp', 'rp'],
  ['lp', 'lr', 'lm', 'li', 'li', 'ri', 'ri', 'rm', 'rr', 'rp', 'rp'],
  ['lp', 'lr', 'lm', 'li', 'li', 'ri', 'ri', 'rm', 'rr', 'rp'],
]

type RowSpec = [string, string]

const SPECS: Record<KeyboardLayout, RowSpec[]> = {
  qwerty: [
    ['`1234567890-=', '~!@#$%^&*()_+'],
    ['qwertyuiop[]\\', 'QWERTYUIOP{}|'],
    ["asdfghjkl;'", 'ASDFGHJKL:"'],
    ['zxcvbnm,./', 'ZXCVBNM<>?'],
  ],
  dvorak: [
    ['`1234567890[]', '~!@#$%^&*(){}'],
    ["',.pyfgcrl/=\\", '"<>PYFGCRL?+|'],
    ['aoeuidhtns-', 'AOEUIDHTNS_'],
    [';qjkxbmwvz', ':QJKXBMWVZ'],
  ],
  colemak: [
    ['`1234567890-=', '~!@#$%^&*()_+'],
    ['qwfpgjluy;[]\\', 'QWFPGJLUY:{}|'],
    ["arstdhneio'", 'ARSTDHNEIO"'],
    ['zxcvbkm,./', 'ZXCVBKM<>?'],
  ],
  azerty: [
    ['²&é"\'(-è_çà)=', '²1234567890°+'],
    ['azertyuiop^$*', 'AZERTYUIOP¨£µ'],
    ['qsdfghjklmù', 'QSDFGHJKLM%'],
    ['wxcvbn,;:!', 'WXCVBN?./§'],
  ],
}

export const LAYOUT_LABELS: Record<KeyboardLayout, string> = {
  qwerty: 'QWERTY',
  dvorak: 'Dvorak',
  colemak: 'Colemak',
  azerty: 'AZERTY',
}

export function layoutRows(layout: KeyboardLayout): KeyDef[][] {
  return SPECS[layout].map(([base, shift], r) =>
    [...base].map((ch, i) => ({ base: ch, shift: [...shift][i] ?? ch, finger: FINGERS[r][i] ?? 'rp' })),
  )
}

/** Find which key produces `ch` and whether Shift is needed. */
export function locateChar(layout: KeyboardLayout, ch: string): { row: number; col: number; shift: boolean; finger: Finger } | null {
  if (ch === ' ') return { row: 4, col: 0, shift: false, finger: 'th' }
  if (ch === '\n') return { row: 2, col: 99, shift: false, finger: 'rp' }
  const rows = layoutRows(layout)
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const k = rows[r][c]
      if (k.base === ch) return { row: r, col: c, shift: false, finger: k.finger }
      if (k.shift === ch) return { row: r, col: c, shift: true, finger: k.finger }
    }
  }
  // Accented letters: fall back to the base letter's key.
  const plain = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (plain !== ch && plain.length === 1) return locateChar(layout, plain)
  return null
}
