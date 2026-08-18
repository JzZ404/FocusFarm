# FocusFarm Design System

Source of truth for colors, typography, and component patterns. This was
reverse-engineered from the existing implementation (`app/globals.css`,
`tailwind.config.ts`, and component usage) — it documents what's actually
shipping, not an aspirational system. Keep it in sync when you change styles.

Aesthetic: retro pixel-art game UI. Chunky hard-edged borders and box-shadows
(no blur), `Press Start 2P` bitmap font throughout, dark forest-green base
with bright accent greens.

## Accessibility standard

**Target: WCAG AA minimum (4.5:1 text, 3:1 UI component boundaries/large text).**
Before changing any color pairing, check it — see "Contrast checklist" below.

## Colors

### Core palette (`:root` custom properties, `app/globals.css`)

| Token | Hex | Use |
|---|---|---|
| `--farm-bg` | `#1a2e1a` | Page background (dark forest green) |
| `--farm-panel` | `#0f1f0f` | Modal/card panel fill (`.pixel-panel`) |
| `--farm-border` | `#2d4a2d` | Borders, and now also solid fills for secondary buttons |
| `--grass-a/b/c/d` | `#6aaa35` `#72b43d` `#63a02e` `#78b840` | Farm grid tile variants |
| `--soil` | `#c8a46e` | Farm grid dirt tiles |
| `--wood` | `#8b5e30` | Decorative wood accents |

### Header / chrome

- `#0a150a` — near-black green, used for page headers (Shop/Session) and as
  the pixel-stroke outline color for hero text.
- `rgba(10,21,10,0.88)` — translucent variant for the Farm page header (sits
  over the water-colored `#a8d8c6` canvas backdrop).

### Semantic colors

| Color | Hex | Meaning |
|---|---|---|
| Focused / success | `#4ade80` | Attention-detected, session-complete heading, live-session pulse |
| Distracted / error | `#f87171` | Attention lost, "Away" stat |
| Coin / currency | `#fbbf24` (UI accents), `#f5c518` (coin icon fill), `#ffe566` (coin badge text) | All money-related UI |
| Danger | `#cc4444` fill / `#fbf8ee` border | Destructive actions (`.pixel-btn-danger`, Abandon session) |

### Reward-tier colors (session page)

`#fbbf24` Warm Up → `#4ade80` Good Start → `#60a5fa` Solid Focus → `#c084fc` Deep Focus.

### Tailwind extension (`tailwind.config.ts`)

`farm.grass` `#5a8a3c`, `farm.grass-light` `#7ab648`, `farm.grass-dark` `#3d6b28`,
`farm.soil` `#8b5e3c`, `farm.sky` `#87ceeb`, `farm.coin` `#fbbf24`,
`farm.focused` `#4ade80`, `farm.distracted` `#f87171`, `farm.bg` `#1a2e1a`,
`farm.panel` `#0f1f0f`, `farm.border` `#2d4a2d`.
Note: these Tailwind tokens and the `--farm-*` CSS custom properties encode
the *same* colors under two different systems (Tailwind utility classes vs.
inline `style={{ background: "var(--farm-bg)" }}`) — both are in active use,
pick whichever the surrounding code already uses rather than mixing new ones in.

## Typography

Font: `Press Start 2P` (loaded via Google Fonts in `globals.css`), applied
with `.font-pixel`. Seven-tier size scale — **every pixel-font text element
must use exactly one of these classes**, no ad-hoc inline font sizes:

| Class | Size | Use |
|---|---|---|
| `.text-pixel-3xl` | 72px | Mega hero — reserved for the starter menu "FocusFarm" title, nothing else |
| `.text-pixel-2xl` | 48px | Focal numeric displays (session timer) |
| `.text-pixel-xl` | 24px | Secondary hero-adjacent headings |
| `.text-pixel-lg` | 16px | Big numbers, modal headings (Sessions count, prices) |
| `.text-pixel-md` | 11px | Header/section titles, primary button labels |
| `.text-pixel-sm` | 9px | Body text, secondary button labels |
| `.text-pixel-xs` | 7px | Captions, micro labels, footnotes |

Exception: standalone decorative emoji may use Tailwind `text-2xl`/`text-4xl`
sizing — they aren't pixel-font glyphs so the scale doesn't apply.

**Hero text stroke:** `.text-pixel-stroke` adds a hard 8-direction outline
(no blur, matches the game's chunky border language), currently `var(--wood)`
`#8b5e30` at 16px weight — a deliberate design choice that **fails the
contrast checklist below** (2.58:1 vs `--farm-bg`, needs 3:1); kept anyway
per explicit direction, documented here so it isn't mistaken for an
oversight. Prior iterations: white (`#ffffff`, 14.49:1 AAA) → yellow
(`#fbbf24`, 8.68:1 AAA, dropped for blending with the green fill and the
coin-yellow accent elsewhere) → wood brown (current). Use on
`.text-pixel-xl`/`.text-pixel-2xl`/`.text-pixel-3xl` hero text. When
choosing a stroke color, separate it from the fill color by *hue*, not just
luminance — a stroke that only differs in lightness from the fill still
reads as one blended shape.

## Buttons (`PixelButton` component, `.pixel-btn*` classes)

Four variants — **primary / secondary (`outline`) / tertiary / danger** —
plus three sizes. Primary/secondary/danger share the chunky 3D pixel-corner
treatment (`clip-path` notched corners + hard offset `box-shadow` for the
"pressed" 3D edge, `outline` for the border since real `border` would be
clipped); tertiary deliberately opts out of all of that (see below).

| Variant | Background | Text | Border | Use |
|---|---|---|---|---|
| `primary` (default) | `#3e7c3e` | `#ffffff` | `#c8f0a8` | Main CTA (Start, Finish session, Buy) |
| `outline` (secondary) | `var(--farm-border)` `#2d4a2d` | `#c8f0a8` | `#6aaa35` | Secondary actions (back links, Start Focus Session's "tap to return") |
| `tertiary` | transparent | `#9ca3af` | none (underline only) | De-emphasized actions (Cancel (refund), preview Hide/Show) |
| `danger` | `#cc4444` | `#ffffff` | `#fbf8ee` | Destructive (Abandon session) |

Sizes: `sm` (9px text), `md` (11px, default), `lg` (13px, hero CTAs).
`tertiary` ignores `size` — it sets its own compact 9px/8px-12px padding
regardless (see globals.css comment on why composing it with `pixel-btn-sm`/
`-lg` doesn't work).

**`onScene` prop**: every primary/secondary usage above sits on a flat dark
background (page body `#1a2e1a`, header `#0a150a`, `.pixel-panel` `#0f1f0f`)
*except* the 3 starter-menu buttons (Start/Shop/How to Play) and the farm
page's floating session CTA, which sit directly on an illustrated scene
(`StartMenuBackground/menuScene.js`, `FarmCanvas`). One border color can't
hit 3:1 against both a near-black page and a light sky/soil scene — the
luminance windows don't overlap (the scene's grass tone is literally
`--grass-a` `#6aaa35`, the same token used for the dark-context border, so a
mid-tone border reads ~1:1 wherever it lands on grass). Pass `onScene` to
swap back to the darker, scene-tuned border (`#1a4a1a` primary / `#0f2f0f`
secondary) on any button placed over illustrated art instead of a flat page.

**Icon-only circular buttons** are a separate, smaller pattern for floating
utility controls (not `PixelButton`) — see `BackgroundMusic` and
`ClearAnimalsButton`, both using the shared `.pixel-icon-btn` class:
`w-10 h-10 rounded-full`, `backdrop-blur`, single glyph, no text label,
`2px solid rgba(255,255,255,0.5)` border. The two components each set their
own background color/opacity (near-opaque — `black/70`+ or `red-950/75`+ —
so the effective backdrop stays dark and stable regardless of what's
actually playing behind them, since both float over the live, unpredictable
farm canvas / webcam feed on at least one page) and a `:focus-visible`
ring is baked into the shared class. Use this pattern (not a full
`PixelButton`) for floating corner controls where a single icon is
self-explanatory.

**Filter chips** (`.pixel-chip` + `.pixel-chip-on`/`-off`) are a third,
even smaller pattern for segmented/mutually-exclusive toggle groups — see
ShopCatalog's sort-order picker. Not a `PixelButton` variant (a group of
options isn't a standalone action), but shares the same border/focus
tokens as everything else.

## Panels

`.pixel-panel` — `#0f1f0f` fill, `#2d4a2d` 3px outline, notched corners
(same clip-path as buttons), used for modals and cards (session summary,
How to Play, reward-tier reference card).

## Contrast checklist

Before shipping a new color pairing:

1. **Text vs its background** — AA needs ≥4.5:1 (all pixel-font sizes here
   count as "small text," so 4.5:1 applies even to `.text-pixel-2xl`).
2. **Non-text UI boundaries** (button/input borders, icons) vs the adjacent
   color — WCAG 1.4.11 needs ≥3:1. This is easy to miss: a border can look
   "fine" in isolation but fail against a specific dark background.
3. Verify both, not just text — see the changelog below for a case where
   text passed (5.94:1) but the border silently failed (2.26:1), making the
   whole button look invisible.

## Changelog

- **2026-08-17** — Session page "Start with Camera"/"Start without Camera":
  both were already `size="lg"` (same font-size/padding props), but their
  container used `items-center`, so each button sized to its own text and
  rendered at a visibly different width ("Start without Camera" is 3
  characters longer). Container switched to `items-stretch` + `w-fit`
  (sizes to the widest child's natural width, not a guessed fixed cap —
  tried `max-w-xs` first, wrapped the longer label to 2 lines) so both
  buttons fill the same width.
- **2026-08-17** — ShopItemCard's locked-card pixelation (`pixelate-locked`/
  `pixelate-locked-hover`, rendered by `ShopCatalog`) retuned: default state
  moved to what used to be the hover-only finer grid (4px blocks — reads as
  less obscured by default), hover steps down one more notch to 2px blocks
  for a stronger peek. (An intermediate iteration swapped hover to a plain
  `blur()` instead of a second pixelate filter — reverted; both states stay
  pixelated, matching the app's hard-edged art everywhere else, per
  explicit direction.)
- **2026-08-17** — Site-wide button audit + consistency pass. Findings:
  1. **`.pixel-btn`/`.pixel-btn-outline`/`.pixel-btn-danger`'s borders were
     tuned once for the starter menu's illustrated background and never
     re-checked against the (more common) flat dark contexts they also
     appear in** — headers (`#0a150a`), page body (`--farm-bg`), panels
     (`--farm-panel`). Measured as low as 1.00–1.67:1 there (needs 3:1),
     i.e. invisible on every "Home"/"Farm" header button and every primary
     button on the session page body. Fixed by flipping the default border
     to a light, dark-context-tuned color per variant (`#c8f0a8` primary,
     `#6aaa35` secondary, `#fbf8ee` danger — all reused tokens) and adding
     `onScene` (see Buttons section above) to keep the original dark
     scene-tuned border for the handful of buttons that actually sit on
     illustrated art.
  2. **Farm page's floating "START FOCUS SESSION" button measured 1.74:1**
     (white text on `#4ade80`) — a 4th, unrelated bespoke button style
     (rounded-xl pill, its own color scheme) that was also the single
     worst contrast failure found, on the app's main CTA. Converted to a
     real `PixelButton` (`primary`/`lg`, `onScene`); the "tap to return"
     pill became `outline`/`onScene`.
  3. Icon buttons (`BackgroundMusic`, `ClearAnimalsButton`) had a
     `rgba(255,255,255,0.15)` border (~1.3–1.55:1) and, for the music
     toggle's muted state, a `#6b7280` glyph that fell to 1.17:1 over the
     light farm-page canvas. Consolidated into a shared `.pixel-icon-btn`
     class: border bumped to `rgba(255,255,255,0.5)`, each button's fill
     opacity raised (`black/50`→`/70`, `red-950/60`→`/75`) so the effective
     backdrop stays dark regardless of the live scene/video behind it, and
     the muted-state color swapped to `#9ca3af`.
  4. ShopCatalog's sort chips had a `border-farm-border` (`#2d4a2d`)
     outline against its own `bg-farm-panel` fill — 1.74:1, failing against
     *itself*. New `.pixel-chip`/`.pixel-chip-on`/`-off` classes reuse
     `#6aaa35`.
  5. Two raw, unpadded text buttons — Shop's "Cancel (refund)" (text-red-400
     at 4.01:1 against its banner, under this doc's 4.5:1 small-text
     standard) and AttentionHUD's preview "Hide"/"Show" toggle — were both
     under the WCAG 2.5.8 24×24px target-size minimum (no padding, ~11-15px
     tall) with no custom focus ring. New `tertiary` `PixelButton` variant
     added for exactly this case (padded, real focus ring). The Hide/Show
     toggle additionally needed `.pixel-btn-tertiary-inset` (an
     `outline-offset: -3px` focus ring) since it sits 4px from the edge of
     an `overflow-hidden` container — an outward ring would've been cropped,
     the same class of bug the button clip-path fix below documents.
  6. `.pixel-btn:disabled`'s text/bg (`#7a9a7a` on `#4a6a4a`, 1.95:1) is
     under 4.5:1 but WCAG exempts inactive controls from the text-contrast
     SC — left as-is, noted here rather than silently skipped.
- **2026-08-09** — `.pixel-btn-outline` border (`#3a6a2a` on `#1a2e1a`,
  2.26:1) failed WCAG 1.4.11. Fixed by switching outline buttons to a solid
  fill (`--farm-border` background, `#c8f0a8` text at 7.74:1 AAA, `#5a9828`
  border at 4.11:1 vs page background) — all colors reused from the existing
  palette, no new hues introduced. Applies app-wide to every `outline`
  `PixelButton` (Shop/Session back links included), not just the starter menu.
- **2026-08-09** — Starter menu hero title promoted `.text-pixel-xl` →
  `.text-pixel-2xl`, and `.text-pixel-stroke` changed from a dark tone
  (`#0a150a`) to yellow (`#fbbf24`) — the dark stroke read as a drop shadow
  rather than an outline against the dark background; yellow gives 8.68:1
  against `--farm-bg` (AAA) and separates from the green fill by hue.
  Starter menu's three buttons (Start/Shop/How to Play) unified to `lg` size
  — same size, differentiated by `primary`/`outline` variant instead of
  scale. Added a 🏠 Home button (→ `/`) to the top-left of the Farm, Shop,
  and Session page headers, alongside the existing `← Farm` links, since
  there was previously no way back to the starter menu once you left it.
- **2026-08-09** — Starter menu title: removed the 🌾 emoji, split
  "FocusFarm" across two lines ("Focus" / "Farm") with the second line
  nudged right (`flex flex-col items-center` block, so the two-line block
  as a whole still sits centered on the page — the indent is relative to
  that centered block, not a page-level offset). `.text-pixel-stroke`
  weight bumped 2px → 4px to match the app's other chunky 3-5px offsets
  (button box-shadows); 2px read as too thin at 48px type.
- **2026-08-09** — Added `.text-pixel-3xl` (72px) as a new top tier,
  reserved for the starter menu title only, and moved the title up to it
  (was borrowing `.text-pixel-2xl`, which reverts to numeric-display-only
  use). Stroke color: yellow → white (yellow sat too close in hue/lightness
  to both the green fill and other coin-yellow UI, read as visual noise).
  Second-line indent increased `ml-2` (8px) → `ml-6` (24px).
- **2026-08-09** — `.text-pixel-stroke`: color white → `var(--wood)`
  `#8b5e30` and weight 4px → 16px, both per explicit design direction.
  **Known deviation**: wood-on-`--farm-bg` measures 2.58:1, below the 3:1
  non-text minimum this document otherwise holds new colors to — recorded
  here rather than silently violating the checklist above. Second-line
  indent increased `ml-6` (24px) → `ml-10` (40px).
- **2026-08-09** — Starter menu title switched from the CSS-built two-line
  `.text-pixel-3xl` + `.text-pixel-stroke` text to the actual logo asset,
  `public/images/focusfarm-logo.png` (720×281, green fill / wood-brown
  stroke, two-line "FOCUS"/"FARM" lockup — turns out this asset was the
  reference the CSS iterations above were approximating). Rendered as a
  plain `<img>` with `imageRendering: pixelated` (no `next/image` usage
  exists elsewhere in the app yet, so this matches convention).
  `.text-pixel-stroke` stays defined in `globals.css` for reuse on other
  hero text — it's just no longer applied to this title.
  `public/images/` is a new top-level asset folder (lowercase, matching
  `public/animals/` `public/audio/` `public/focusfarm/`).
