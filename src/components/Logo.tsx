export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--surface-3)" />
        <rect x="7" y="9" width="18" height="14" rx="3" fill="none" stroke="var(--accent-text)" strokeWidth="2" />
        <rect x="11" y="18" width="10" height="2" rx="1" fill="var(--accent-text)" />
        <rect x="11" y="13" width="2" height="2" rx="1" fill="var(--accent-text)" />
        <rect x="15" y="13" width="2" height="2" rx="1" fill="var(--accent-text)" />
        <rect x="19" y="13" width="2" height="2" rx="1" fill="var(--accent-text)" />
      </svg>
      {compact ? null : <span className="text-[15px] font-semibold tracking-tight">KeyQuest</span>}
    </span>
  )
}
