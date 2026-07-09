# Local Attention-Detection Patch — Handoff

## Why this exists

The just-pulled `main` (commit `df92445`) ships a Pomodoro loop, a shop, a coin
ledger, a Jest suite, sprites — a real MVP. The one part that doesn't work the
way the product brief calls for is the **focus signal itself**: it only checks
whether your eyelids are open. If you sit at the camera with your eyes open but
your gaze on your phone, the session still earns coins.

The owning developer is unreachable today, so this patch fixes it locally on
`main`. When her next branch lands, hand her this folder and the changes can be
either re-merged on top or replayed via the saved patch.

## Baseline

| | |
|---|---|
| Baseline commit | `e6c4bf1` — *style: Sessions centred in header, farm re-centred vertically* (re-merged on 2026-06-01 after pull) |
| Branch | `main` |
| Files touched | 3 (`lib/hooks/useAttention.ts`, `components/AttentionHUD.tsx`, `app/session/page.tsx`) |
| Lines | +176 / −29 |
| Full-file snapshots | [`our-version/`](./our-version/) — byte-identical copies of the three modified files |
| Patch file | [`attention-fix.patch`](./attention-fix.patch) |

The `.gitignore`, `package-lock.json`, and `tsconfig.tsbuildinfo` changes in the
working tree are **incidental** (added `.gstack/`, npm dedup, tsc cache) — not
part of this patch.

## What the bug was

[`lib/hooks/useAttention.ts`](../../lib/hooks/useAttention.ts) computed only the
**Eye Aspect Ratio (EAR)** — eyelid height ÷ eye width — and treated `ear > 0.2`
as "focused":

```ts
const ear = (leftEAR + rightEAR) / 2;
const focused = ear > EAR_THRESHOLD;   // EAR_THRESHOLD = 0.2
```

EAR answers one question: are the eyelids open? It cannot tell whether the user
is looking at the screen or out the window. MediaPipe Face Landmarker already
returns iris landmarks (468–477) and 478 face-mesh points, but none of that was
being read.

## What we changed

The focus decision combines head pose and iris position into a single
**world-space gaze estimate**, then ANDs that against eyes-open. Frame-count
hysteresis prevents flicker.

```
worldGaze = headYaw + irisOffset           // combined gaze vector in image space
isFocused = eyesOpen
            AND |headYaw| < HEAD_YAW_HARD_LIMIT    // landmarks reliable
            AND |worldGaze| < WORLD_GAZE_DEADZONE  // eyes actually on screen
```

The key idea: when the head turns one way and the eyes compensate the other way
to keep looking at the screen, the two contributions **cancel** and the user is
still focused. When the eyes leave the screen (head straight or head turned),
they **add up** and the user is distracted.

| Signal | How it's computed | When it fails |
|---|---|---|
| **Eyes open** | EAR averaged across both eyes | `ear < 0.18` → eyes closed |
| **Head not extreme** | nose-tip horizontal position vs face-edge landmarks (`1`, `234`, `454`) — normalized to `[-1, 1]` | `\|yaw\| > 0.75` → face too profile for iris landmarks to be trustworthy |
| **Gaze on screen** | `headYaw + irisOffset`. Iris from landmarks `468`, `473` against eye-corner midpoint (`33/133`, `263/362`), averaged across both eyes | `\|worldGaze\| > 0.30` → eyes off-screen |

**Scenarios the new model handles correctly:**

| User pose | Old EAR model | Old AND model | **New world-gaze model** |
|---|---|---|---|
| Looking straight at screen | ✅ focused | ✅ focused | ✅ focused |
| Eyes closed | ❌ distracted | ❌ distracted | ❌ distracted |
| Head turned 30° right, eyes compensating to look at screen | ❌ would still focus (no check) | ❌ flagged distracted (false negative) | ✅ focused — head/iris cancel |
| Head straight, eyes glancing at phone off-screen | ❌ focused (false positive) | ❌ distracted | ❌ distracted |
| Head turned and eyes also pointing further off | ❌ focused (false positive) | ❌ distracted | ❌ distracted |

**Hysteresis:** 6 consecutive bad frames (~100 ms at 60 fps) flips the badge to
`DISTRACTED`; 4 consecutive good frames flips it back to `FOCUSED`. Counters are
stored in `useRef` so they don't trigger per-frame re-renders.

**Why a "reason":** when distracted, the hook now reports `distractedReason`
(`eyes_closed` / `head_turned` / `gaze_off_screen` / `no_face`) and the HUD
shows it as a subtitle. Users were getting flagged distracted with no clue
why — this closes that loop.

## File-by-file changelog

### `lib/hooks/useAttention.ts` — full rewrite (+170 / −20)

**Public API additions:**
```ts
export type DistractionReason =
  | "eyes_closed"
  | "looking_away"        // gaze off-screen — most common case
  | "head_extreme"        // face too profile for landmarks (>~55° head turn)
  | "no_face"
  | null;

export interface AttentionState {
  isDetecting: boolean;
  isFocused: boolean;
  faceDetected: boolean;
  eyeAspectRatio: number;
  headYaw: number;          // NEW — head pose in image space
  gazeOffset: number;       // NEW — iris-in-socket
  worldGaze: number;        // NEW — combined: head + iris
  distractedReason: DistractionReason;   // NEW
  error: string | null;
}
```

Existing consumers (`app/session/page.tsx`) keep working — the new fields are
additive.

**Tunable thresholds** (top of file):
```ts
const EAR_CLOSED_THRESHOLD = 0.25;     // EAR below this → eyes closed or partially drooped
const EYES_CLOSED_GRACE_MS = 1500;     // blink tolerance — closure under this stays focused
const WORLD_GAZE_DEADZONE = 0.30;      // |head + iris| above this → off-screen
const HEAD_YAW_HARD_LIMIT = 0.75;      // |yaw| above this → landmarks unreliable
const FRAMES_TO_DISTRACT = 6;
const FRAMES_TO_REFOCUS = 4;
```

Higher = more permissive. Tune per camera / lighting if needed. The big knobs:
- `WORLD_GAZE_DEADZONE` — drop it if the badge is too forgiving, raise it if too jumpy.
- `EYES_CLOSED_GRACE_MS` — how long a blink can be (~300ms normal blink, 1500ms gives slow blinks / long thinking-blinks a free pass).

**Blink tolerance.** A normal blink lasts ~100–400ms. The hook tracks the
timestamp when eyes first went closed (`eyesClosedSinceRef`) and only flags
`eyes_closed` once they've been closed past `EYES_CLOSED_GRACE_MS` (default
1.5s). During a brief blink, the gaze check is also bypassed (iris landmarks
are unreliable when the eyelid covers them) — `worldGaze` is forced to 0 so
blink noise can't accidentally trigger "Eyes off screen" either.

**Landmark indices used:**
- EAR (unchanged): `33, 160, 158, 133, 153, 144` (right) and `362, 385, 387, 263, 373, 380` (left)
- Head yaw: nose tip `1`, face-left edge `234`, face-right edge `454`
- Iris centers: `468` (right), `473` (left)
- Eye corners: outer `33`/`263`, inner `133`/`362`

### `components/AttentionHUD.tsx` — additive (+16 / −0)

- New optional prop `distractedReason?: DistractionReason`
- New `REASON_LABEL` map → user-friendly strings
- Renders a small subtitle under `DISTRACTED`:
  ```tsx
  {isDetecting && !isFocused && distractedReason && (
    <div className="text-xs text-gray-400 font-pixel">
      {REASON_LABEL[distractedReason]}
    </div>
  )}
  ```

### `app/session/page.tsx` — one-line wiring (+1 / −0)

Passes the new field down:
```tsx
<AttentionHUD
  ...
  distractedReason={attention.distractedReason}
/>
```

## How to merge when the developer's branch arrives

The `our-version/` folder mirrors the original repo layout, so each snapshot
file is at exactly the path it needs to overwrite. Pick the option that fits
the situation:

### Option A — developer didn't touch these three files (most likely)
Just copy our snapshots back over the new `main`:
```bash
cp developer/handoff/our-version/lib/hooks/useAttention.ts lib/hooks/useAttention.ts
cp developer/handoff/our-version/components/AttentionHUD.tsx components/AttentionHUD.tsx
cp developer/handoff/our-version/app/session/page.tsx app/session/page.tsx
```
Then `npx tsc --noEmit` and test.

### Option B — developer wrote her own gaze fix
Compare hers vs ours, take the better one (or the union):
```bash
diff lib/hooks/useAttention.ts developer/handoff/our-version/lib/hooks/useAttention.ts
```
Resolve in your editor. Keep our blink-tolerance, monotonic-timestamp, and
raised EAR threshold if her version doesn't have them.

### Option C — patch-apply onto her version
If her file structure is close to ours, the recorded diff still works:
```bash
git apply developer/handoff/attention-fix.patch
```
If `git apply` rejects, fall back to Option A or B.

## Verification

Tested locally on `localhost:3001` with a live webcam. All three behaviors flip
the badge as expected within ~100 ms:

| Action | Expected badge | Reason subtitle |
|---|---|---|
| Look straight at screen, eyes open | FOCUSED (green) | — |
| Turn head moderately but eyes track the screen | FOCUSED (green) | — |
| Blink normally (~300 ms) | FOCUSED (green) | — |
| Eyes glance off-screen (head straight) | DISTRACTED (red) | "Eyes off screen" |
| Head turned AND eyes pointing further off-screen | DISTRACTED (red) | "Eyes off screen" |
| Head turned past ~55° (profile) | DISTRACTED (red) | "Head turned too far" |
| Close eyes for > 1.5 s | DISTRACTED (red) | "Eyes closed" |
| Eyelids drooped / squinting at phone for > 1.5 s | DISTRACTED (red) | "Eyes closed" |
| Step out of frame | DISTRACTED (red) | "No face detected" |

Build verification:
- `npx tsc --noEmit` — clean
- `npm run dev` — starts, `/`, `/session`, `/shop` all 200, no React/console errors
- Jest tests untouched (no attention-related tests exist)

## Open questions for the developer

1. **Threshold calibration.** The deadzones (`YAW_DEADZONE = 0.38`, `GAZE_DEADZONE = 0.22`)
   were picked by intuition + manual testing on one face/camera. They may need
   per-user calibration on app start (one second of "look at the screen" to set
   the baseline) for users with strong head-pose offsets.
2. **No tests.** Worth adding a `__tests__/attention.test.ts` that feeds synthetic
   landmark arrays through the helper functions (`computeEAR`, `computeHeadYaw`,
   `computeEyeGazeOffset`) and asserts thresholds.
3. **`distractedReason` is reported but not logged.** Could be valuable on the
   session-summary modal (e.g. "Spent 8 minutes looking away" breakdown).
