import { Code2, Crosshair, Ghost, Leaf, Map, Shield, Swords, type LucideIcon } from 'lucide-react'
import type { GameMode } from '@/engine/types'

export interface ModeInfo {
  id: Exclude<GameMode, 'arena'>
  href: string
  name: string
  tagline: string
  description: string
  icon: LucideIcon
}

export const MODES: ModeInfo[] = [
  {
    id: 'daily',
    href: '#/play/daily',
    name: 'Daily Quest',
    tagline: 'A new challenge every day',
    description: 'Hit the day’s target speed and accuracy in a set category to earn bonus XP. Resets at your local midnight.',
    icon: Map,
  },
  {
    id: 'ghost',
    href: '#/play/ghost',
    name: 'Ghost Race',
    tagline: 'Race your own best run',
    description: 'A replay of your fastest run races beside you, keystroke-accurate. Beat it to take its place.',
    icon: Ghost,
  },
  {
    id: 'boss',
    href: '#/play/boss',
    name: 'Boss Battle',
    tagline: 'Five stages, four difficulties',
    description: 'Finish the passage before the boss timer runs out. Every mistake costs you health.',
    icon: Swords,
  },
  {
    id: 'survival',
    href: '#/play/survival',
    name: 'Survival',
    tagline: 'Don’t let them land',
    description: 'Words fall toward the danger line, faster and faster. Type them to clear them. Three misses and it’s over.',
    icon: Shield,
  },
  {
    id: 'code',
    href: '#/play/code',
    name: 'Code Rush',
    tagline: 'Java, Python, JavaScript, SQL',
    description: 'Type real code with brackets, operators and indentation. Enter for new lines; indentation fills in for you.',
    icon: Code2,
  },
  {
    id: 'precision',
    href: '#/play/precision',
    name: 'Precision',
    tagline: 'Accuracy over speed',
    description: 'You can’t move past a mistake. Clean streaks multiply your score, errors cost points.',
    icon: Crosshair,
  },
  {
    id: 'zen',
    href: '#/play/zen',
    name: 'Zen',
    tagline: 'No timer, no pressure',
    description: 'Endless text, a quiet screen and optional ambient sound. Stats only if you ask for them.',
    icon: Leaf,
  },
]
