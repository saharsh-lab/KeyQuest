import { ChevronDown, Pencil, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { LANGUAGE_LABELS } from '@/data/words'
import type { Category, Difficulty, Language, TestLength } from '@/engine/types'
import { DIFFICULTY_REQ, difficultyUnlocked } from '@/game/progression'
import { useStore } from '@/game/store'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { Segmented } from './ui/segmented'
import { Select } from './ui/select'

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert']
export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'common', label: 'Common words' },
  { value: 'programming', label: 'Programming' },
  { value: 'technology', label: 'Technology' },
  { value: 'quotes', label: 'Quotes' },
  { value: 'custom', label: 'Custom text' },
]
export const TIME_VALUES = [15, 30, 60, 120] as const
export const WORD_VALUES = [10, 25, 50, 100] as const

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function DifficultyPicker({ value, onChange, size }: { value: Difficulty; onChange: (d: Difficulty) => void; size?: 'sm' | 'md' }) {
  const { level, results } = useStore()
  return (
    <Segmented
      label="Difficulty"
      value={value}
      onChange={onChange}
      size={size}
      options={DIFFICULTIES.map((d) => ({ value: d, label: cap(d), locked: difficultyUnlocked(d, level.level, results) ? undefined : DIFFICULTY_REQ[d] }))}
    />
  )
}

export function CustomTextDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { settings, updateSettings } = useStore()
  const [draft, setDraft] = useState(settings.customText)
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(settings.customText)
        onOpenChange(o)
      }}
    >
      <DialogContent title="Custom text" description="Paste or write anything you want to practice. It is typed in order and repeats if the test needs more words.">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={7}
          maxLength={5000}
          className="w-full resize-y rounded-lg border border-border bg-surface-2 p-3 font-mono text-sm outline-none focus:border-border-strong"
          placeholder="The quick brown fox jumps over the lazy dog."
          aria-label="Custom text"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-subtle">{words} words</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!words}
              onClick={() => {
                updateSettings({ customText: draft.replace(/\s+/g, ' ').trim(), category: 'custom' })
                onOpenChange(false)
              }}
            >
              Use this text
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** The Arena's option bar: length, difficulty, category and language. */
export function TestOptions({ disabled }: { disabled?: boolean }) {
  const { settings, updateSettings } = useStore()
  const [customOpen, setCustomOpen] = useState(false)
  // On phones the full bar pushes the text below the fold, so it collapses behind a one-line summary.
  const [expanded, setExpanded] = useState(false)
  const { length } = settings
  const values = length.kind === 'time' ? TIME_VALUES : WORD_VALUES
  const summary = [
    length.kind === 'time' ? `${length.value}s` : `${length.value} words`,
    cap(settings.difficulty),
    CATEGORIES.find((c) => c.value === settings.category)?.label,
    settings.category === 'common' ? LANGUAGE_LABELS[settings.language] : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : undefined}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls="test-options"
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-left text-sm sm:hidden"
      >
        <span className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="size-4 shrink-0 text-muted" />
          <span className="truncate">{summary}</span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted transition-transform', expanded && 'rotate-180')} />
      </button>
      <div id="test-options" className={cn('flex-wrap items-center gap-2 sm:flex', expanded ? 'mt-2 flex sm:mt-0' : 'hidden')}>
        <Segmented
          label="Test type"
          value={length.kind}
          onChange={(kind) => updateSettings({ length: kind === 'time' ? { kind: 'time', value: 30 } : { kind: 'words', value: 25 } })}
          options={[
            { value: 'time', label: 'Time' },
            { value: 'words', label: 'Words' },
          ]}
        />
        <Segmented
          label={length.kind === 'time' ? 'Duration in seconds' : 'Word count'}
          value={length.value}
          onChange={(v) => updateSettings({ length: { kind: length.kind, value: v } as TestLength })}
          options={values.map((v) => ({ value: v, label: length.kind === 'time' ? `${v}s` : String(v) }))}
        />
        <DifficultyPicker value={settings.difficulty} onChange={(difficulty) => updateSettings({ difficulty })} />
        <Select<Category>
          label="Category"
          value={settings.category}
          onValueChange={(category) => {
            if (category === 'custom' && !settings.customText) setCustomOpen(true)
            else updateSettings({ category })
          }}
          options={CATEGORIES}
        />
        {settings.category === 'common' ? (
          <Select<Language>
            label="Language"
            value={settings.language}
            onValueChange={(language) => updateSettings({ language })}
            options={(Object.keys(LANGUAGE_LABELS) as Language[]).map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))}
            className="min-w-28"
          />
        ) : null}
        {settings.category === 'custom' ? (
          <Button variant="ghost" size="sm" onClick={() => setCustomOpen(true)}>
            <Pencil /> Edit text
          </Button>
        ) : null}
      </div>
      <CustomTextDialog open={customOpen} onOpenChange={setCustomOpen} />
    </div>
  )
}
