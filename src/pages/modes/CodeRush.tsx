import { Code2, Pause, Play, RotateCcw, Shuffle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { LiveStats } from '@/components/LiveStats'
import { ModeHeader } from '@/components/ModeHeader'
import { ResultsView } from '@/components/ResultsView'
import { cap } from '@/components/TestOptions'
import { TypingSurface } from '@/components/TypingSurface'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Kbd } from '@/components/ui/kbd'
import { CODE_LANGUAGE_LABELS, CODE_SNIPPETS } from '@/data/code'
import type { CodeLanguage } from '@/engine/types'
import { useTypingSession } from '@/engine/useTypingSession'
import { useStore, type RecordOutcome } from '@/game/store'
import { focusIsNeutral, useShortcuts } from '@/hooks/useShortcuts'
import { useSound } from '@/hooks/useSound'
import { cn } from '@/lib/utils'

export function CodeRushPage() {
  const { settings, results, recordResult } = useStore()
  const sound = useSound()
  const [lang, setLang] = useState<CodeLanguage>('javascript')
  const snippets = useMemo(() => CODE_SNIPPETS.filter((s) => s.language === lang), [lang])
  const [snippetId, setSnippetId] = useState(snippets[0].id)
  const snippet = CODE_SNIPPETS.find((s) => s.id === snippetId) ?? snippets[0]
  const [outcome, setOutcome] = useState<RecordOutcome | null>(null)

  const session = useTypingSession({
    text: snippet.code,
    behavior: { allowBackspace: settings.allowBackspace, stopOnError: settings.stopOnError, autoIndent: settings.autoIndent },
    onKeystroke: (k) => k.kind === 'char' && sound.key(k.correct),
    onFinish: (summary) => {
      setOutcome(
        recordResult({
          summary,
          mode: 'code',
          config: { difficulty: snippet.difficulty, category: 'code', codeLanguage: snippet.language, variant: snippet.id },
        }),
      )
    },
  })

  const load = (id: string) => {
    const s = CODE_SNIPPETS.find((x) => x.id === id)!
    setSnippetId(id)
    session.reset(s.code)
    setOutcome(null)
  }
  const pickLang = (l: CodeLanguage) => {
    setLang(l)
    load(CODE_SNIPPETS.find((s) => s.language === l)!.id)
  }
  const next = () => {
    const i = snippets.findIndex((s) => s.id === snippet.id)
    load(snippets[(i + 1) % snippets.length].id)
  }
  const random = () => {
    const others = CODE_SNIPPETS.filter((s) => s.id !== snippet.id)
    const s = others[Math.floor(Math.random() * others.length)]
    setLang(s.language)
    load(s.id)
  }

  useShortcuts({
    [settings.restartKey === 'tab' ? 'Tab' : 'Shift+Enter']: (e) => {
      if (settings.restartKey === 'tab' && !focusIsNeutral(e) && !outcome) return false
      next()
    },
    Escape: () => (session.status === 'paused' ? session.resume() : session.pause()),
    'Alt+KeyR': () => load(snippet.id),
  })

  const best = (id: string) => results.filter((r) => r.valid && r.mode === 'code' && r.config.variant === id).reduce((m, r) => Math.max(m, r.wpm), 0)

  return (
    <div className="flex flex-col gap-6">
      <ModeHeader
        icon={Code2}
        title="Code Rush"
        description={settings.autoIndent ? 'Press Enter at the end of each line. Leading indentation is filled in for you and is not counted.' : 'Press Enter at the end of each line and type the indentation yourself (auto-indent is off in Settings).'}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Language" value={lang} onChange={pickLang} options={(Object.keys(CODE_LANGUAGE_LABELS) as CodeLanguage[]).map((l) => ({ value: l, label: CODE_LANGUAGE_LABELS[l] }))} />
        <Button variant="ghost" size="sm" onClick={random}>
          <Shuffle /> Random snippet
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {snippets.map((s) => {
          const b = best(s.id)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => load(s.id)}
              className={cn('flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] transition-colors', s.id === snippet.id ? 'border-accent-text/60 bg-accent-soft text-fg' : 'border-border text-muted hover:bg-surface-2 hover:text-fg')}
            >
              {s.title}
              <span className="text-[11px] text-subtle">{cap(s.difficulty)}</span>
              {b ? <span className="text-[11px] tabular-nums text-accent-text">{Math.round(b)}</span> : null}
            </button>
          )
        })}
      </div>

      {outcome ? (
        <ResultsView outcome={outcome} onRestart={() => load(snippet.id)} restartLabel="Retry snippet" onNext={next} nextLabel="Next snippet" nextShortcut />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <LiveStats session={session} progress={`${Math.round((session.engine.typed.length / snippet.code.length) * 100)}%`} />
            <div className="flex items-center gap-1.5">
              <Badge variant="outline">{CODE_LANGUAGE_LABELS[snippet.language]}</Badge>
              {session.status === 'running' || session.status === 'paused' ? (
                <Button variant="secondary" size="sm" onClick={() => (session.status === 'paused' ? session.resume() : session.pause())}>
                  {session.status === 'paused' ? <Play /> : <Pause />}
                  {session.status === 'paused' ? 'Resume' : 'Pause'}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => load(snippet.id)}>
                <RotateCcw /> Restart
              </Button>
            </div>
          </div>
          <div className="rounded-card border border-border bg-surface p-4 sm:p-5">
            <TypingSurface session={session} variant="code" lines={Math.min(14, snippet.code.split('\n').length + 1)} ariaLabel="Code typing area" />
          </div>
          <p className="text-center text-xs text-subtle">
            <Kbd>Enter</Kbd> new line · <Kbd>Esc</Kbd> pause · <Kbd>Alt + R</Kbd> restart · <Kbd>{settings.restartKey === 'tab' ? 'Tab' : 'Shift + Enter'}</Kbd> next snippet
          </p>
        </>
      )}
    </div>
  )
}
