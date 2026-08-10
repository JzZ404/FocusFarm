# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FocusFarm — a gamified productivity web app. Users earn coins by maintaining
webcam-detected attention during focus sessions, then spend coins to build a
pixelated animal farm. See `SPEC.md` for the original product spec and
`DESIGN.md` for the visual design system (colors, typography, button/panel
patterns, accessibility contrast standard).

## Commands

```bash
npm install         # install deps
npm run dev          # start dev server (Next.js + Turbopack), http://localhost:3000
npm run build         # production build
npm start             # run production build
npm test              # jest, --passWithNoTests
npm run test:ci        # jest --ci --passWithNoTests
```

Run a single test file: `npx jest __tests__/coins.test.ts`
Run a single test by name: `npx jest -t "test name substring"`

**`npm run lint` is currently broken** — there is no ESLint config file in
the repo (`eslint-config-next` is a dependency but never wired up via
`.eslintrc*`). This predates any recent changes; either add a config or
treat lint as not-yet-set-up.

**Known pre-existing test failures**: `__tests__/coins.test.ts` and
`__tests__/storage.test.ts` have ~14 failing assertions that expect a
starting coin balance of `0`, but `lib/storage.ts`'s `getLedger()` has a
`// DEMO MODE` fallback that returns a starting balance of `50` (present
since the first commit). Not something recent changes broke — either update
the tests or revert the demo balance when addressing this.

## Architecture

**Stack**: Next.js (App Router) + React + TypeScript + Tailwind. No backend —
all state persists to `localStorage` via `lib/storage.ts` (see its `KEYS`
object for the schema: profile, coins/ledger, sessions, farm grid).

**Routes** (`app/`):
- `/` — starter menu (title screen: Start / Shop / How to Play). Shown on
  every fresh load since it's the actual app entry point.
- `/farm` — the main farm view (was previously at `/` — moved when the
  starter menu was added; if you see stale links to `/farm` in the App
  Router route tree, that's expected).
- `/shop` — buy animals/decorations with coins.
- `/session` — focus session flow: webcam capture, attention detection, timer.

**State layer**: two React Contexts wrap the whole app from `app/layout.tsx`:
- `FarmContext` (`context/FarmContext.tsx`) — profile, coin ledger, farm
  grid/tiles, purchase/place/clear-animals actions. Hydrates from
  `localStorage` in a `useEffect` (not on initial render) to avoid SSR/client
  hydration mismatches — components must tolerate the empty/default state on
  first paint.
- `SessionContext` (`context/SessionContext.tsx`) — focus session
  status/timer/attention state. Deliberately lives in the root layout
  (not scoped to `/session`) so an in-progress session's timer keeps running
  if the user navigates to `/shop` or `/farm` mid-session and comes back.

**Attention detection**: `lib/hooks/useWebcam.ts` requests camera access;
`lib/hooks/useAttention.ts` runs MediaPipe Tasks Vision face landmark
detection on the video stream to classify focused vs. distracted. Reward
calculation (coins per focused second × tier multiplier) is in `lib/coins.ts`,
tiers defined in `data/rewardTiers.ts`.

**Farm rendering**: `components/FarmCanvas.tsx` is a `<canvas>`-based scene,
*not* a DOM/React render of the animals — it dynamically loads two vanilla-JS
scripts from `public/focusfarm/` (`sprites.js`, `scene.js`, exposing a
`window.FFScene` global) plus a sprite atlas (`public/animals/atlas.json` +
`atlas.png`) and runs its own `requestAnimationFrame` loop for animal
movement/rendering, syncing against `farm.tiles` from `FarmContext`. When
touching farm visuals, the logic to change is usually in `FarmCanvas.tsx`'s
`syncAnimals`/`updateAnimal`/`drawAnimal`, not JSX.

**Styling**: pixel-art design system in `app/globals.css` (`.pixel-btn*`,
`.pixel-panel`, `.text-pixel-*` typography scale, `.text-pixel-stroke`) plus
matching Tailwind color tokens in `tailwind.config.ts` (`farm.*`). Both
systems encode the same colors under two different mechanisms — see
`DESIGN.md` for the full reference and the accessibility contrast standard
to hold new colors to.
