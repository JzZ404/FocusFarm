# Starter Menu + Dev Clear-Animals Button — Design

**Date:** 2026-08-09
**Status:** Approved

## Summary

Two additions to FocusFarm:

1. A floating "Clear Animals" dev button, always visible, for quickly resetting the farm's animal placements while testing.
2. A starter/title menu at the app's entry point (`/`), with the farm view moved to `/farm`.

## Feature 1: Clear Animals button

**Purpose:** Dev/testing convenience — quickly wipe placed animals without clearing coins, profile, or session history.

- **Location:** `fixed bottom-20 right-4 z-50` — stacked directly above the existing `BackgroundMusic` toggle button (`fixed bottom-4 right-4 z-50` in [components/BackgroundMusic.tsx](../../../components/BackgroundMusic.tsx)), so the two don't overlap.
- **Style:** `PixelButton` `danger` variant, `sm` size, label `🗑 Clear Animals` — reuses the existing `.pixel-btn-danger` class in `globals.css`, no new styles needed.
- **Visibility:** always visible, all environments (not gated behind `NODE_ENV`).
- **Behavior:**
  1. On click, show a native `confirm("Delete all N animals from your farm?")` (N = current tile count).
  2. If confirmed, clear **only** `farm.tiles` — coins, profile, streak, and session history are untouched.
- **Implementation:**
  - Add `clearFarmTiles(): FarmGrid` to `lib/storage.ts` — resets `tiles` to `[]`, keeps `gridWidth`/`gridHeight`, persists via `saveFarm`.
  - Add `clearAnimals()` to `FarmContext` — calls `clearFarmTiles()`, updates local `farm` state.
  - New component `components/ClearAnimalsButton.tsx`, mounted in `app/layout.tsx` alongside `BackgroundMusic` so it's visible on every route.

## Feature 2: Starter menu

**Purpose:** A title screen that greets the player every time the app loads, before they enter the farm.

### Routing change

- `app/page.tsx` (currently the farm view) moves to `app/farm/page.tsx`, unchanged.
- `app/page.tsx` becomes the new starter menu. Since `/` is the app's actual entry point, the menu is shown on every fresh load with no extra state/flags needed.
- Update the 4 existing internal links that currently point back to `/` expecting the farm, to point to `/farm` instead:
  - `app/shop/page.tsx` — 2 back-link `<Link href="/">`
  - `app/session/page.tsx` — 1 back-link `<Link href="/">`, 1 `router.push("/")` after dismissing the post-session summary

### Menu screen

Full-height page matching the existing pixel-art aesthetic (`--farm-bg` background, `font-pixel` typography, same button system as the rest of the app).

- **Title:** "FocusFarm" in large pixel font (`text-pixel-lg` or larger), centered, with a small decorative accent (e.g. 🌾/🐾).
- **Buttons**, stacked vertically in this order:
  1. **Start** (`pixel-btn`, primary) → `router.push("/farm")`. Plain navigation — no data wipe, no confirmation. Works identically for new and returning players since `getFarm()`/`getProfile()`/`getLedger()` already fall back to fresh defaults when no save exists.
  2. **Shop** (`pixel-btn-outline`) → `router.push("/shop")`. Direct shortcut into the shop, skipping the farm view.
  3. **How to Play** (`pixel-btn-outline`, `sm`) → opens a modal popup (local component state, not a route change).
- No "Resume" button — removed from scope. "Start" is the only way into the farm and never mutates saved data.

### How to Play modal

Small centered pop-up with a dark backdrop, pixel-bordered panel matching the app's existing panel styling (`--farm-panel` / `--farm-border`), with a close button (✕ or "Got it").

Content:

```
How to Play

🎯 Start a Focus Session
Your webcam checks that you're paying attention.

🪙 Earn Coins
Stay focused during your session to earn coins.

🛒 Visit the Shop
Spend coins on animals and decorations.

🐾 Grow Your Farm
Watch it grow as you stay productive.
```

- **Implementation:** New component `components/HowToPlayModal.tsx`, local `useState` for open/closed, rendered from the starter menu page.

## Files touched

| File | Change |
|---|---|
| `lib/storage.ts` | add `clearFarmTiles()` |
| `context/FarmContext.tsx` | add `clearAnimals()` |
| `components/ClearAnimalsButton.tsx` | new |
| `app/layout.tsx` | mount `ClearAnimalsButton` alongside `BackgroundMusic` |
| `app/page.tsx` | replaced — becomes starter menu |
| `app/farm/page.tsx` | new — current contents of old `app/page.tsx`, unchanged |
| `components/HowToPlayModal.tsx` | new |
| `app/shop/page.tsx` | 2 links: `/` → `/farm` |
| `app/session/page.tsx` | 1 link + 1 `router.push`: `/` → `/farm` |

## Out of scope

- No "Start New" data-wipe flow (dropped per user feedback — Start is a plain navigation).
- No dev-only gating on the Clear Animals button (visible in all environments per user preference).
- No changes to session/webcam/attention-detection logic.
