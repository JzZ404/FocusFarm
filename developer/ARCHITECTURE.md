# FocusFarm — Architecture Document

**Developer:** Murphy Wei  
**Project Owner:** Joyce Zhou  
**Version:** 1.0 — Initial Architecture

---

## Tech Stack & Justification

### Frontend — Next.js (App Router)

**Why Next.js over plain React:**  
Next.js gives us file-based routing, fast local dev with hot reload, and an easy path to optional server features (e.g., Supabase auth) without re-architecting. The App Router supports React Server Components, which keeps the farm homepage lightweight. For MVP, we deploy as a static export (`next export`) — no server required.

### Computer Vision — MediaPipe Face Landmarker

**Why MediaPipe over TensorFlow.js:**  
MediaPipe's Face Landmarker WASM bundle runs entirely in-browser, ships with a pre-trained 468-point face mesh, and exposes eye landmark indices directly. This gives us gaze/presence detection in ~50 lines of code. TensorFlow.js requires more manual model selection, loading, and preprocessing. MediaPipe is the faster path to a working attention signal.

**Attention heuristic (MVP):**  
- Face landmarks detected + eye aspect ratio above threshold = **Focused**
- No face landmarks OR eyes closed / off-screen = **Distracted**

### State & Persistence — LocalStorage + React Context

**Why not a database for MVP:**  
The SPEC explicitly scopes out cloud sync. LocalStorage is zero-config, works offline, and is sufficient for a single-user desktop app. A thin Context layer (`FarmContext`) wraps all reads/writes so we can swap to Supabase later by changing one file.

### Styling — Tailwind CSS + Custom Pixel CSS

Tailwind handles layout and utility classes. Pixel art rendering (farm grid, sprites) uses a custom CSS layer with `image-rendering: pixelated` and fixed tile sizes. No CSS-in-JS libraries — keeps the bundle lean.

### Asset Pipeline — Static Sprite Sheets

Pixel assets (animals, tiles, decorations) are stored as PNG sprite sheets in `/public/assets/`. We use a simple sprite renderer component that reads `(x, y)` offsets from a manifest JSON. Open-source assets from [itch.io](https://itch.io) or placeholder colored squares for Check-In 1.

---

## Data Model

All data is stored in `localStorage` under namespaced keys (`focusfarm:*`). The shapes below are TypeScript interfaces that double as the runtime schema.

### UserProfile

```ts
// localStorage key: "focusfarm:profile"
interface UserProfile {
  userId: string;          // uuid generated on first visit
  createdAt: number;       // unix timestamp
  totalFocusMinutes: number;
  totalSessions: number;
  currentStreak: number;   // consecutive days with ≥1 session
  lastSessionDate: string; // ISO date string "YYYY-MM-DD"
}
```

### CoinLedger

```ts
// localStorage key: "focusfarm:coins"
interface CoinLedger {
  balance: number;
  transactions: CoinTransaction[];
}

interface CoinTransaction {
  id: string;
  type: "earned" | "spent";
  amount: number;
  reason: string;     // e.g. "focus_session_20min" | "purchase_chicken"
  timestamp: number;
}
```

### FocusSession

```ts
// localStorage key: "focusfarm:sessions" (array, capped at last 50)
interface FocusSession {
  id: string;
  startTime: number;
  endTime: number | null;      // null if abandoned
  targetMinutes: number;
  actualFocusedSeconds: number;
  distractedSeconds: number;
  coinsEarned: number;
  completed: boolean;
}
```

### FarmGrid

```ts
// localStorage key: "focusfarm:farm"
interface FarmGrid {
  gridWidth: number;           // default: 12
  gridHeight: number;          // default: 8
  tiles: FarmTile[];
}

interface FarmTile {
  id: string;
  itemId: string;              // references ShopItem.id
  gridX: number;
  gridY: number;
  placedAt: number;            // unix timestamp
}
```

### ShopItem (static catalog, not stored in localStorage)

```ts
// Defined in /data/shopItems.ts — no persistence needed
interface ShopItem {
  id: string;                  // e.g. "animal_chicken"
  name: string;
  category: "animal" | "building" | "decoration";
  cost: number;
  spriteSheet: string;         // path to PNG sprite sheet
  spriteX: number;             // pixel offset X
  spriteY: number;             // pixel offset Y
  spriteSize: number;          // tile size in pixels
  description: string;
  unlockCondition?: string;    // optional, e.g. "totalFocusMinutes >= 60"
}
```

### AttentionState (ephemeral, React state only — never persisted)

```ts
interface AttentionState {
  isDetecting: boolean;
  isFocused: boolean;
  faceDetected: boolean;
  eyeAspectRatio: number;
  lastUpdateMs: number;
}
```

---

## Module Breakdown

### `/app` — Next.js Pages

| Route | Component | Purpose |
|---|---|---|
| `/` | `FarmPage` | Main farm grid view, coin balance, nav |
| `/session` | `SessionPage` | Focus timer, webcam, attention HUD |
| `/shop` | `ShopPage` | Item catalog, purchase flow |

### `/components`

| Component | Responsibility |
|---|---|
| `FarmGrid` | Renders the pixel tile grid + placed items |
| `FarmTile` | Single tile renderer using sprite sheet |
| `SessionTimer` | Countdown / count-up timer display |
| `AttentionHUD` | Focused / Distracted indicator + webcam preview |
| `CoinDisplay` | Animated coin balance badge |
| `ShopCatalog` | Grid of purchasable items |
| `ShopItemCard` | Single item card with buy button |

### `/lib`

| Module | Responsibility |
|---|---|
| `attention.ts` | MediaPipe initialization, landmark processing, focus signal |
| `coins.ts` | Coin calculation formula, transaction helpers |
| `storage.ts` | All localStorage reads/writes; typed wrappers |
| `farmUtils.ts` | Grid collision, placement validation |

### `/context`

| Context | State Provided |
|---|---|
| `FarmContext` | `coins`, `farm`, `profile`, actions: `purchaseItem`, `earnCoins`, `placeTile` |
| `SessionContext` | `sessionState`, `attentionState`, actions: `startSession`, `endSession` |

### `/data`

| File | Contents |
|---|---|
| `shopItems.ts` | Static catalog of all purchasable items |
| `rewardTiers.ts` | Coin reward lookup by session duration |

---

## Engineering Plan (Agentic Phases)

Each phase maps to a Check-In deliverable. Tasks within a phase are ordered by dependency.

---

### Phase 1 — Foundation & Attention Detection

**Goal:** Runnable app with working webcam attention signal.

**Tasks (in order):**

1. **Project scaffold**  
   - Init Next.js 14 with App Router, TypeScript, Tailwind  
   - Set up ESLint, Prettier, path aliases  
   - Create folder structure per Module Breakdown above  
   - Commit: `chore: initial project scaffold`

2. **Storage layer**  
   - Implement `lib/storage.ts` with typed get/set/clear  
   - Write unit tests for serialization edge cases  
   - Commit: `feat: typed localStorage abstraction`

3. **FarmContext (stub)**  
   - Wire up context with default state (0 coins, empty farm)  
   - Connect to storage layer for hydration on mount  
   - Commit: `feat: FarmContext with localStorage hydration`

4. **Webcam access**  
   - `useWebcam` hook: request permission, return `MediaStream`  
   - Handle denied permission gracefully (error state + message)  
   - Commit: `feat: webcam permission hook`

5. **MediaPipe integration**  
   - Load `@mediapipe/tasks-vision` Face Landmarker  
   - Run inference on each video frame via `requestAnimationFrame`  
   - Extract eye landmarks, compute Eye Aspect Ratio  
   - Export `useAttention` hook returning `AttentionState`  
   - Commit: `feat: mediapipe attention detection`

6. **AttentionHUD component**  
   - Display FOCUSED / DISTRACTED indicator  
   - Show optional webcam preview (toggleable)  
   - Commit: `feat: attention HUD component`

**Deliverable:** `/session` page renders webcam, shows live FOCUSED/DISTRACTED label.

---

### Phase 2 — Session Flow, Coins & Farm Homepage

**Goal:** Full session → earn coins → view farm loop working.

**Tasks (in order):**

1. **Reward formula**  
   - Implement `lib/coins.ts`: coins based on focused seconds (not total session time)  
   - Formula: `coins = Math.floor(focusedSeconds / 60) * coinsPerMinute`  
   - Tier multipliers: 10 min = 1x, 20 min = 1.5x, 30 min = 2x  
   - Commit: `feat: coin reward calculation`

2. **SessionContext**  
   - Track `startTime`, `focusedSeconds`, `distractedSeconds` in real time  
   - On session end: compute coins, write `FocusSession` to storage, call `earnCoins`  
   - Commit: `feat: session context with real-time attention tracking`

3. **SessionPage**  
   - Start / Stop / Abandon controls  
   - Live timer display (elapsed focused time)  
   - Session summary modal on completion (time focused, coins earned)  
   - Commit: `feat: session page UI`

4. **Farm homepage scaffold**  
   - `FarmGrid` component: render 12×8 grid of grass tiles  
   - `CoinDisplay` in header  
   - Empty state messaging ("Start a session to earn coins!")  
   - Commit: `feat: farm homepage grid scaffold`

5. **Placeholder assets**  
   - Add colored 16×16 pixel squares as stand-in sprites  
   - Configure sprite manifest  
   - Commit: `feat: placeholder pixel assets`

**Deliverable:** User completes a focus session, sees coins awarded, farm grid visible.

---

### Phase 3 — Shop, Farm Rendering & Persistence (MVP Complete)

**Goal:** End-to-end MVP: buy items, place on farm, persist across refresh.

**Tasks (in order):**

1. **Shop catalog data**  
   - Define 6–8 initial items in `data/shopItems.ts`  
   - At least: 2 animals (chicken, sheep), 1 building (barn), 2 decorations  
   - Commit: `feat: shop item catalog`

2. **ShopPage UI**  
   - Grid of `ShopItemCard` components  
   - Show item name, cost, sprite preview  
   - Disable buy button if insufficient coins  
   - On purchase: deduct coins, add item to `FarmGrid`, persist  
   - Commit: `feat: shop page with purchase flow`

3. **FarmTile renderer**  
   - Render placed `FarmTile` items over the grass grid using sprite sheet offsets  
   - Commit: `feat: farm tile sprite renderer`

4. **Placement UX**  
   - After purchase, enter "placement mode": click grid cell to place item  
   - Validate no overlap with existing tiles  
   - Commit: `feat: tile placement interaction`

5. **Persistence hardening**  
   - Confirm all state survives page refresh  
   - Test: buy item → refresh → item still on farm, coins correct  
   - Handle localStorage quota errors gracefully  
   - Commit: `feat: persistence validation and error handling`

6. **End-to-end integration pass**  
   - Walk the full MVP loop manually  
   - Fix any state sync issues between contexts  
   - Commit: `fix: end-to-end integration cleanup`

7. **UI polish**  
   - Responsive layout (desktop-first, min-width 1024px)  
   - Pixel font (Press Start 2P or similar)  
   - Transition animations on coin balance change  
   - Commit: `feat: UI polish pass`

8. **README update**  
   - Add local setup instructions (`npm install`, `npm run dev`)  
   - Document env vars (none for MVP)  
   - Commit: `docs: README setup instructions`

**Deliverable:** Full MVP demo — open → session → earn coins → buy animal → farm grows → refresh → persists.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| MediaPipe WASM fails to load on some browsers | Medium | High | Graceful fallback: disable attention detection, run session as plain timer; show warning |
| Webcam permission denied | High | Medium | Clear error state with instructions; session still accessible as manual timer |
| LocalStorage quota exceeded (5MB) | Low | Medium | Cap session history at 50 entries; compress farm data if needed |
| Pixel assets unavailable / license issues | Low | Low | Start with colored rectangles; source CC0 assets from OpenGameArt.org |
| MediaPipe eye detection accuracy poor in low light | Medium | Medium | Add sensitivity threshold slider in settings; document recommended lighting |
