import { Download, Pencil, Play, Trash2, Upload } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { CATEGORIES, CustomTextDialog, DifficultyPicker } from '@/components/TestOptions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { VirtualKeyboard } from '@/components/VirtualKeyboard'
import { LAYOUT_LABELS } from '@/data/layouts'
import { LANGUAGE_LABELS } from '@/data/words'
import type { Category, Language } from '@/engine/types'
import { ARENA_THEMES, KEYBOARD_THEMES } from '@/game/progression'
import { useStore } from '@/game/store'
import type { KeyboardLayout, Settings } from '@/game/types'
import { playError, playKey } from '@/lib/sound'

function Row({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border py-3.5 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm">
          {label}
        </label>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function SettingsPage() {
  const store = useStore()
  const { settings, updateSettings: set, level, progress, profile, data } = store
  const unlockCtx = { level: level.level, achievements: progress.achievements }
  const [customOpen, setCustomOpen] = useState(false)
  const [confirm, setConfirm] = useState<null | 'reset' | 'delete'>(null)
  const [name, setName] = useState(profile.name)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const sw = (key: keyof Settings, label: string) => (
    <Switch id={`s-${key}`} checked={settings[key] as boolean} onCheckedChange={(v) => set({ [key]: v })} aria-label={label} />
  )

  const exportData = () => {
    const blob = new Blob([store.exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `keyquest-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Settings</h1>
      <p className="-mt-4 text-sm text-muted">Changes save automatically.</p>

      <Section title="Appearance">
        <Row label="Theme">
          <Segmented label="Theme" value={settings.theme} onChange={(theme) => set({ theme })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} />
        </Row>
        <Row label="Reduced motion" hint="Turns off caret glide, transitions and celebration animations.">
          <Segmented label="Reduced motion" value={settings.reducedMotion} onChange={(reducedMotion) => set({ reducedMotion })} options={[{ value: 'system', label: 'System' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
        </Row>
        <Row label="Font size">
          <Segmented label="Font size" value={settings.fontSize} onChange={(fontSize) => set({ fontSize })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }, { value: 'xl', label: 'XL' }]} />
        </Row>
        <Row label="Caret style">
          <Segmented label="Caret style" value={settings.caretStyle} onChange={(caretStyle) => set({ caretStyle })} options={[{ value: 'line', label: 'Line' }, { value: 'block', label: 'Block' }, { value: 'underline', label: 'Underline' }, { value: 'off', label: 'Off' }]} />
        </Row>
        <Row label="Smooth caret" htmlFor="s-smoothCaret">{sw('smoothCaret', 'Smooth caret')}</Row>
        <Row label="3D effects" hint="Tilted keyboard, floating keycaps and cards that lean toward the pointer." htmlFor="s-effects3d">{sw('effects3d', '3D effects')}</Row>
        <Row label="Typing-area theme" hint="More themes unlock as you progress.">
          <Select label="Typing-area theme" value={settings.arenaTheme} onValueChange={(arenaTheme) => set({ arenaTheme })} options={ARENA_THEMES.map((t) => ({ value: t.id, label: t.name, disabled: !t.unlocked(unlockCtx), hint: t.unlocked(unlockCtx) ? undefined : 'locked' }))} />
        </Row>
        <Row label="Keyboard theme">
          <Select label="Keyboard theme" value={settings.keyboardTheme} onValueChange={(keyboardTheme) => set({ keyboardTheme })} options={KEYBOARD_THEMES.map((t) => ({ value: t.id, label: t.name, disabled: !t.unlocked(unlockCtx), hint: t.unlocked(unlockCtx) ? undefined : 'locked' }))} />
        </Row>
      </Section>

      <Section title="Sound">
        <Row label="Sound effects" hint="Turn off to mute all keystroke and game sounds." htmlFor="s-sound">{sw('sound', 'Sound effects')}</Row>
        <Row label="Volume">
          <div className="flex w-56 items-center gap-3">
            <Slider value={[Math.round(settings.volume * 100)]} min={0} max={100} step={5} onValueChange={([v]) => set({ volume: v / 100 })} aria-label="Volume" disabled={!settings.sound} />
            <span className="w-10 text-right text-xs tabular-nums text-muted">{Math.round(settings.volume * 100)}%</span>
          </div>
        </Row>
        <Row label="Keystroke sound">
          <div className="flex items-center gap-2">
            <Segmented label="Keystroke sound" value={settings.soundProfile} onChange={(soundProfile) => set({ soundProfile })} options={[{ value: 'soft', label: 'Soft' }, { value: 'click', label: 'Click' }, { value: 'typewriter', label: 'Typewriter' }]} />
            <Button size="icon-sm" variant="ghost" aria-label="Preview sound" disabled={!settings.sound} onClick={() => playKey(settings.soundProfile, settings.volume)}>
              <Play />
            </Button>
          </div>
        </Row>
        <Row label="Error sound" hint="A low tone when you hit a wrong key." htmlFor="s-errorSound">
          <div className="flex items-center gap-2">
            <Button size="icon-sm" variant="ghost" aria-label="Preview error sound" disabled={!settings.sound} onClick={() => playError(settings.volume)}>
              <Play />
            </Button>
            {sw('errorSound', 'Error sound')}
          </div>
        </Row>
        <Row label="Ambient sound in Zen mode" htmlFor="s-ambientSound">{sw('ambientSound', 'Ambient sound in Zen mode')}</Row>
      </Section>

      <Section title="Test defaults" description="Used by the Arena, and by Ghost Race, Precision and Zen for their text.">
        <Row label="Difficulty">
          <DifficultyPicker value={settings.difficulty} onChange={(difficulty) => set({ difficulty })} size="sm" />
        </Row>
        <Row label="Category">
          <div className="flex items-center gap-2">
            {settings.category === 'custom' ? (
              <Button variant="ghost" size="sm" onClick={() => setCustomOpen(true)}>
                <Pencil /> Edit
              </Button>
            ) : null}
            <Select<Category> label="Category" value={settings.category} onValueChange={(category) => (category === 'custom' && !settings.customText ? setCustomOpen(true) : set({ category }))} options={CATEGORIES} />
          </div>
        </Row>
        <Row label="Text language" hint="Applies to the Common words category.">
          <Select<Language> label="Text language" value={settings.language} onValueChange={(language) => set({ language })} options={(Object.keys(LANGUAGE_LABELS) as Language[]).map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))} />
        </Row>
        <CustomTextDialog open={customOpen} onOpenChange={setCustomOpen} />
      </Section>

      <Section title="Typing behavior">
        <Row label="Allow backspace" hint="When off, mistakes stay where they are." htmlFor="s-allowBackspace">{sw('allowBackspace', 'Allow backspace')}</Row>
        <Row label="Stop on error" hint="The caret will not advance until you type the right key." htmlFor="s-stopOnError">{sw('stopOnError', 'Stop on error')}</Row>
        <Row label="Auto-indent code" hint="In Code Rush, indentation after Enter is filled in and not scored." htmlFor="s-autoIndent">{sw('autoIndent', 'Auto-indent code')}</Row>
        <Row label="Show live stats" htmlFor="s-showLiveStats">{sw('showLiveStats', 'Show live stats')}</Row>
        <Row label="Focus mode" hint="Fades the menus away while you type. Move the mouse to bring them back." htmlFor="s-focusMode">{sw('focusMode', 'Focus mode')}</Row>
      </Section>

      <Section title="Keyboard">
        <Row label="Show virtual keyboard" htmlFor="s-showKeyboard">{sw('showKeyboard', 'Show virtual keyboard')}</Row>
        <Row label="Layout" hint="Changes the on-screen keyboard to match the one you type on.">
          <Select<KeyboardLayout> label="Layout" value={settings.keyboardLayout} onValueChange={(keyboardLayout) => set({ keyboardLayout })} options={(Object.keys(LAYOUT_LABELS) as KeyboardLayout[]).map((l) => ({ value: l, label: LAYOUT_LABELS[l] }))} />
        </Row>
        <Row label="Finger guidance" hint="Tints keys by finger and names the finger for the next key." htmlFor="s-fingerGuide">{sw('fingerGuide', 'Finger guidance')}</Row>
        <div className="mt-2 rounded-lg border border-border p-4">
          <VirtualKeyboard expected="f" lastKey={null} layout={settings.keyboardLayout} fingerGuide={settings.fingerGuide} theme={settings.keyboardTheme} />
        </div>
      </Section>

      <Section title="Keyboard shortcuts">
        <Row label="New test key" hint="Tab only restarts while you are typing or on a results screen, so it still moves focus between controls.">
          <Segmented label="New test key" value={settings.restartKey} onChange={(restartKey) => set({ restartKey })} options={[{ value: 'tab', label: 'Tab' }, { value: 'shift-enter', label: 'Shift + Enter' }]} />
        </Row>
        <dl className="mt-2 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {[
            [settings.restartKey === 'tab' ? 'Tab' : 'Shift + Enter', 'New test / next'],
            ['Esc', 'Pause or resume'],
            ['Alt + R', 'Restart with the same text'],
            ['Alt + M', 'Switch time / words'],
            ['Alt + 1–4', 'Pick test length'],
            ['Alt + D', 'Cycle difficulty'],
            ['Alt + C', 'Cycle category'],
            ['Ctrl + Backspace', 'Delete previous word'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <dt className="text-muted">{v}</dt>
              <dd>
                <Kbd>{k}</Kbd>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Player and data" description="Everything is stored in this browser's local storage.">
        <Row label="Player name">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              store.renameProfile(profile.id, name)
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} aria-label="Player name" className="h-9 w-44 rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none focus:border-border-strong" />
            <Button type="submit" size="md" disabled={!name.trim() || name.trim() === profile.name}>
              Save
            </Button>
          </form>
        </Row>
        <Row label="Back up progress" hint="Download all players, results and settings as a JSON file.">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportData}>
              <Download /> Export
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload /> Import
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const err = store.importData(await f.text())
                setImportMsg(err ?? 'Backup restored.')
                e.target.value = ''
              }}
            />
          </div>
        </Row>
        {importMsg ? <p className="pb-2 text-right text-xs text-muted" role="status">{importMsg}</p> : null}
        <Row label="Reset this player's progress" hint="Deletes all results, XP and achievements for this player.">
          <Button variant="outline" onClick={() => setConfirm('reset')}>
            Reset progress
          </Button>
        </Row>
        <Row label="Remove this player" hint={data.profiles.length <= 1 ? 'You need at least one player.' : 'Removes the player and all their results.'}>
          <Button variant="outline" disabled={data.profiles.length <= 1} onClick={() => setConfirm('delete')}>
            <Trash2 /> Remove player
          </Button>
        </Row>
      </Section>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent
          title={confirm === 'reset' ? `Reset ${profile.name}'s progress?` : `Remove ${profile.name}?`}
          description={confirm === 'reset' ? 'All results, XP, streaks and achievements for this player will be permanently deleted. Settings stay.' : 'This player and all of their results will be permanently deleted.'}
        >
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm === 'reset') store.resetProfile(profile.id)
                else store.deleteProfile(profile.id)
                setConfirm(null)
              }}
            >
              {confirm === 'reset' ? 'Reset progress' : 'Remove player'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
