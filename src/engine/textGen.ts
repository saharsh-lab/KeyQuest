import {
  ENGLISH_ADVANCED,
  ENGLISH_COMMON,
  LANGUAGE_WORDS,
  PROGRAMMING_IDENTIFIERS,
  PROGRAMMING_WORDS,
  QUOTES,
  TECHNOLOGY_WORDS,
} from '@/data/words'
import { pick, type Rng } from '@/lib/utils'
import type { Category, Difficulty, Language } from './types'

export interface TextOptions {
  difficulty: Difficulty
  category: Category
  language: Language
  customText?: string
}

const PUNCT_END = ['.', '.', '.', ',', ',', ',', ';', '?', '!', ':']
const EXPERT_WRAP: [string, string][] = [
  ['(', ')'],
  ['"', '"'],
  ["'", "'"],
  ['[', ']'],
]

function basePool(o: TextOptions): string[] {
  switch (o.category) {
    case 'programming':
      return o.difficulty === 'hard' || o.difficulty === 'expert'
        ? [...PROGRAMMING_WORDS, ...PROGRAMMING_IDENTIFIERS, ...PROGRAMMING_IDENTIFIERS]
        : PROGRAMMING_WORDS
    case 'technology':
      return TECHNOLOGY_WORDS
    case 'common':
    default: {
      if (o.language !== 'english') return LANGUAGE_WORDS[o.language]
      if (o.difficulty === 'easy') return ENGLISH_COMMON.slice(0, 200).filter((w) => w.length <= 5)
      if (o.difficulty === 'medium') return ENGLISH_COMMON
      if (o.difficulty === 'hard') return [...ENGLISH_COMMON, ...ENGLISH_ADVANCED]
      return [...ENGLISH_COMMON.slice(150), ...ENGLISH_ADVANCED, ...ENGLISH_ADVANCED]
    }
  }
}

const capitalize = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

/** Apply Hard/Expert decoration (capitals, punctuation, numbers, symbols) to a list of words. */
function decorate(words: string[], difficulty: Difficulty, rng: Rng): string[] {
  if (difficulty === 'easy' || difficulty === 'medium') return words
  const expert = difficulty === 'expert'
  const out: string[] = []
  let sentenceStart = true
  for (let w of words) {
    if (/[^a-zA-ZÀ-ÿ]/.test(w)) {
      // Already contains symbols (identifiers); leave it alone.
      out.push(w)
      sentenceStart = false
      continue
    }
    if (rng() < (expert ? 0.08 : 0.04)) {
      out.push(String(Math.floor(rng() * (expert ? 10000 : 100))))
    }
    if (sentenceStart || rng() < (expert ? 0.12 : 0.03)) w = capitalize(w)
    sentenceStart = false
    if (expert && rng() < 0.07) {
      const [a, b] = pick(EXPERT_WRAP, rng)
      w = a + w + b
    }
    if (expert && rng() < 0.04) w = w + '-' + pick(ENGLISH_COMMON.slice(0, 120), rng)
    if (rng() < (expert ? 0.22 : 0.14)) {
      const p = pick(PUNCT_END, rng)
      w += p
      if (p === '.' || p === '?' || p === '!') sentenceStart = true
    }
    out.push(w)
  }
  return out
}

function simplify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Generate `count` words. Never repeats the same word twice in a row. */
export function generateWords(count: number, o: TextOptions, rng: Rng): string[] {
  if (o.category === 'quotes') return quoteWords(count, o.difficulty, rng)
  if (o.category === 'custom') return customWords(count, o, rng)
  const pool = basePool(o)
  const words: string[] = []
  let prev = ''
  while (words.length < count) {
    const w = pick(pool, rng)
    if (w === prev) continue
    words.push(w)
    prev = w
  }
  return decorate(words, o.difficulty, rng)
}

function quoteWords(count: number, difficulty: Difficulty, rng: Rng): string[] {
  const out: string[] = []
  let last = -1
  while (out.length < count) {
    let i = Math.floor(rng() * QUOTES.length)
    if (i === last) i = (i + 1) % QUOTES.length
    last = i
    const text = difficulty === 'easy' ? simplify(QUOTES[i].text) : QUOTES[i].text
    out.push(...text.split(' '))
  }
  return out.slice(0, count)
}

function customWords(count: number, o: TextOptions, rng: Rng): string[] {
  const words = (o.customText ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return generateWords(count, { ...o, category: 'common' }, rng)
  // Custom text is typed in order and repeats if the test needs more words.
  const out: string[] = []
  while (out.length < count) out.push(...words)
  return out.slice(0, count)
}

export function generateText(count: number, o: TextOptions, rng: Rng): string {
  return generateWords(count, o, rng).join(' ')
}

/** A single full quote, with attribution, for quote-style challenges. */
export function randomQuote(rng: Rng) {
  return pick(QUOTES, rng)
}
