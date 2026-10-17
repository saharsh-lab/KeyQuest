# KeyQuest

A typing game with real progression: a Typing Arena, seven game modes, XP and levels, missions, achievements, unlockable themes, analytics and a local leaderboard. Everything runs in the browser and is saved to local storage. There is no backend.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # engine and progression unit tests (Vitest)
npm run build     # type-check + production build into dist/
```

`dist/` is a static site (hash routing, relative paths), so it can be opened from any static host.

## Stack

React 19, Vite, TypeScript (strict), Tailwind CSS v4, shadcn/ui-style components on Radix primitives (`src/components/ui`), Lucide icons, Framer Motion, Recharts. Fonts: Geist and Geist Mono (self-hosted via Fontsource). Sounds are synthesized with Web Audio, so there are no audio files.

## Structure

```
src/
  engine/        Typing engine, no React: engine.ts (pure state transitions), metrics.ts (WPM, accuracy,
                 consistency, per-second samples, ghost timelines), textGen.ts, useTypingSession.ts (timer,
                 pause, keyboard + mobile input binding)
  game/          types, storage (versioned localStorage + pruning), progression (XP, levels, streaks,
                 missions, achievements, unlocks, daily quest, recommendations), store.tsx (React context),
                 leaderboard.ts (provider interface + local provider), modes.ts
  data/          word lists (EN/ES/FR/DE), quotes, code snippets (JS, Python, Java, SQL), keyboard layouts
  components/    App shell, TypingSurface, VirtualKeyboard, ResultsView, charts, ui/ primitives
  pages/         Dashboard, Arena, Modes, Progress, Leaderboard, Settings, modes/* (one file per game mode)
```

## Metric definitions

- **WPM (net)**: correct characters currently in the buffer ÷ 5 ÷ minutes. A mistake fixed with backspace counts once, as correct; an uncorrected mistake adds nothing.
- **Raw WPM**: every character keystroke (including mistakes and ones later deleted) ÷ 5 ÷ minutes.
- **Accuracy**: correct keystrokes ÷ all character keystrokes. Fixed mistakes still count against it.
- **Consistency**: 100 × (1 − coefficient of variation) of per-second raw WPM.
- **Time**: active time from the first keystroke, excluding pauses. Timed tests end exactly at the limit; keystrokes after it are ignored.
- **Unfinished runs** (restarted, abandoned, boss defeats) are never counted toward records or XP. Finished runs are also rejected if they are under 2 s, under 10 keystrokes, under 50% accuracy, or look idle.
- In Code Rush, auto-inserted indentation is excluded from every metric.

## Honest-data rules

- Sample chart data on an empty dashboard is labeled "Sample data".
- The leaderboard only ranks results recorded in this browser, across local player profiles, and is labeled local. Online play is shown as not connected. To add a server, implement `LeaderboardProvider` in `src/game/leaderboard.ts`.
- XP, missions, achievements and unlocks are derived from recorded results; nothing is granted for button clicks.
