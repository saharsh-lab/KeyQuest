import { Check, Plus, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '@/game/store'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogTrigger } from './ui/dialog'

/** Local player profiles: several people can share one device and compete on the local leaderboard. */
export function ProfileMenu() {
  const { data, profile, switchProfile, addProfile } = useStore()
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-muted hover:bg-surface-2 hover:text-fg" aria-label={`Player: ${profile.name}. Switch player`}>
          <UserRound className="size-4" />
          <span className="hidden max-w-28 truncate sm:inline">{profile.name}</span>
        </button>
      </DialogTrigger>
      <DialogContent title="Players on this device" description="Profiles are stored locally in this browser. Each keeps its own XP, streak and results.">
        <ul className="flex flex-col gap-1">
          {data.profiles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  switchProfile(p.id)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                <span>{p.name}</span>
                {p.id === profile.id ? <Check className="size-4 text-accent-text" /> : null}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            addProfile(name)
            setName('')
            setOpen(false)
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="New player name"
            aria-label="New player name"
            className="h-9 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none focus:border-border-strong"
          />
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            <Plus /> Add
          </Button>
        </form>
        <p className="mt-3 text-xs text-subtle">Rename or remove players in Settings.</p>
      </DialogContent>
    </Dialog>
  )
}
