/**
 * Pure attention classifier — no React, no DOM, no `performance.now()`, no
 * refs. State in, state out; every timestamp/interval arrives as an
 * argument. This exists so detection logic can be unit-tested and replayed
 * against recorded fixtures without a live camera — see
 * docs/attention-baseline.md and scripts/replay.ts.
 *
 * Phase 0 was a mechanical extraction of what used to be inlined in
 * lib/hooks/useAttention.ts's requestAnimationFrame loop, proven behavior-
 * identical by __tests__/attention/golden.test.ts (now retired — see that
 * file's header for why).
 *
 * Phase 1 makes hysteresis, calibration, and smoothing frame-rate
 * independent — see git history / docs/attention-baseline.md's Phase 1
 * section for the full reasoning. Every duration below runs on elapsed
 * milliseconds, timestamp-anchored, never a frame count.
 *
 * Phase 2 adds neutral-pose calibration and an elliptical, vertically-
 * asymmetric deadzone — see docs/attention-baseline.md's Phase 2 section.
 * `worldDevX`/`worldDevY` measure deviation from the user's own calibrated
 * neutral pose (0 if uncalibrated); `gazeWeightK` is an explicit weight on
 * iris offset when combining it with head pose; `*RX`/`*RDown`/`*RUp`
 * ellipse radii replace single-circle thresholds.
 *
 * Phase 3 (this revision) softens the binary decision into a continuous
 * `focusScore ∈ [0,1]` and replaces single-threshold hysteresis with a
 * Schmitt trigger:
 *   - Each of the three "is something wrong" dimensions (eyes closed,
 *     head too extreme, gaze/head deviation too far from neutral) gets its
 *     own smooth 1→0 falloff (`smoothFalloff`) instead of a hard boolean —
 *     `softInnerFactor`/`softOuterFactor` mark where the falloff starts
 *     and ends, as a multiple of the existing ellipse radii (head/gaze) or
 *     grace period (eyes). `focusScore` is the min of the three — the
 *     weakest dimension still dominates, same as the old AND of three
 *     booleans, just continuous now.
 *   - `applySchmittTrigger` replaces `applyHysteresis`: distinct
 *     focused→distracted (`schmittLow`) and distracted→focused
 *     (`schmittHigh`) thresholds, each still gated on a sustained streak
 *     (`msToDistract`/`msToRefocus`, the same timestamp-anchored mechanism
 *     Phase 1 introduced), PLUS a minimum dwell time (`minDwellMs`) since
 *     the last flip regardless of streak length. The gap between the two
 *     thresholds kills flicker structurally — a score oscillating in the
 *     dead zone between them can't flip anything, by construction, not by
 *     luck of counter timing.
 *   - `no_face` gets its own longer grace period (`noFaceGraceMs`) before
 *     the *binary* state flips to distracted (leaning out of frame briefly
 *     shouldn't visibly flip the UI) — but `focusScore` is 0 immediately,
 *     every no-face frame, no grace: there's no face to credit regardless
 *     of what the UI shows.
 *   - `isFocused` (the binary) is kept only for UI display, per the plan;
 *     `focusScore` is what session/coin logic should integrate over time —
 *     see context/SessionContext.tsx.
 *
 * ── Pipeline ─────────────────────────────────────────────────────────
 * landmarks (478/frame, or null = no face)
 *   │
 *   ├─► roll (eye-corner tilt angle)
 *   │      │
 *   │      ▼ (de-roll nose/face-edge points first)
 *   │  yaw   = (nose.x - faceCenter.x) / (faceWidth/2)
 *   │  pitch = (nose.y - faceCenter.y) / (faceHeight/2)
 *   │
 *   ├─► EAR (eyelid openness, both eyes) ──► raw eyesClosed?
 *   │        │                                   │
 *   │        ▼ (EMA'd every frame, time-const α)  ▼ (drives calibration + timer)
 *   │   smoothedEar                    one-time session calibration:
 *   │                                  baseline (first ~2s of open-eye
 *   │                                  sampling time) × 0.75
 *   │
 *   └─► iris center (468/473) vs eye-socket center ──► gaze offset (horiz+vert)
 *            ▲
 *            └── EMA update SKIPPED while eyesClosed (blink transition
 *                frames have unreliable iris position)
 *   │
 *   ▼
 * worldDevX = (yaw-yaw0) + k·(gazeX-gazeX0)   worldDevY = (pitch-pitch0) + k·(gazeY-gazeY0)
 *   (0 during any blink; yaw0/pitch0/gazeX0/gazeY0 = calibrated neutral pose, 0 if uncalibrated)
 * headPoseMag = |yaw,pitch|   (uncalibrated — see computeHeadPitch's note on why)
 *   │
 *   ▼
 * eyeScore   = smoothFalloff(eyesClosedMs / eyesClosedGraceMs, inner, outer)
 * headScore  = smoothFalloff(ellipseDistance(yaw,pitch, headPose*), inner, outer)
 * gazeScore  = smoothFalloff(ellipseDistance(worldDevX,worldDevY, worldDeviation*), inner, outer)
 * focusScore = min(eyeScore, headScore, gazeScore)
 *   │
 *   ▼
 * Schmitt trigger + min dwell (focusScore < schmittLow sustained
 * msToDistract → distracted; focusScore > schmittHigh sustained
 * msToRefocus → focused; either way gated on minDwellMs since last flip)
 * ───────────────────────────────────────────────────────────────────── */

export type Landmark = { x: number; y: number; z: number };

export type DistractionReason =
  | "eyes_closed"
  | "looking_away"
  | "head_extreme"
  | "no_face"
  | null;

/** Everything the classifier carries between frames. Never mutated in place. */
export interface AttentionState {
  focused: boolean;
  /** ms timestamp focusScore last went below schmittLow continuously;
   * null otherwise. Mutually exclusive with aboveHighSinceMs — see
   * applySchmittTrigger. */
  belowLowSinceMs: number | null;
  /** ms timestamp focusScore last went above schmittHigh continuously;
   * null otherwise. */
  aboveHighSinceMs: number | null;
  /** ms timestamp `focused` last actually changed value; null if it never
   * has this session. Gates the minimum-dwell requirement. */
  lastFlipMs: number | null;
  /** ms timestamp no-face streak started; null while a face is detected. */
  noFaceSinceMs: number | null;
  /** ms timestamp eyes first went closed; null while open. */
  eyesClosedSinceMs: number | null;
  /** ms timestamp the gaze first pointed down past the inner tolerance;
   * null while it isn't. Phase 4: gives sustained downward gaze its own
   * grace period (lookingDownGraceMs), independent of the general
   * gazeScore ellipse — a brief glance down at the keyboard while typing
   * and a sustained stare at a phone are geometrically identical to this
   * classifier (both are "gaze pointed down"), so only *duration*
   * distinguishes them. See gazeScore's computation for how this is used. */
  gazeDownSinceMs: number | null;
  /** EMA-smoothed signals. null = not yet initialized this session. */
  emaYaw: number | null;
  emaPitch: number | null;
  emaEar: number | null;
  emaGazeX: number | null;
  emaGazeY: number | null;
  /** One-time session EAR calibration accumulator (frozen once complete). */
  calibSum: number;
  calibCount: number;
  /** Elapsed ms of valid (open-eye) calibration sampling time so far —
   * gates calibration completion; calibCount is only for averaging. */
  calibMs: number;
  calibThreshold: number;
}

/** Every constant that used to be a hardcoded module-level `const`. */
export interface AttentionConfig {
  earClosedThresholdDefault: number;
  earClosedFactor: number;
  earThresholdMin: number;
  earThresholdMax: number;
  /** Elapsed ms of open-eye sampling time to build the per-session EAR baseline. */
  calibrationMs: number;
  eyesClosedGraceMs: number;
  /** Calibrated neutral pose (Phase 2) — 0 when no session calibration has
   * been run, which makes every worldDevX/Y computation reduce to raw
   * yaw+gaze from an assumed-zero origin (Phase 1 behavior). Populated by
   * lib/attention/neutralCalibration.ts's onboarding capture. */
  neutralYaw: number;
  neutralPitch: number;
  neutralGazeX: number;
  neutralGazeY: number;
  /** Weight applied to iris offset when combining it with head pose into a
   * single deviation-from-neutral vector — yaw/pitch and iris offset are
   * different units, so this isn't assumed to be 1.0. Fit against fixtures
   * by scripts/fitCalibration.ts; defaults to 1 (Phase 1's implicit weight). */
  gazeWeightK: number;
  /** Elliptical, vertically-asymmetric deadzone radii for
   * worldDevX/worldDevY. RDown/RUp let downward tolerance differ from
   * upward (laptop screens sit below eye level, so more downward
   * tolerance is correct — a circle couldn't express this). Also the
   * "distance = 1" reference for gazeScore's soft falloff (Phase 3). */
  worldDeviationRX: number;
  worldDeviationRDown: number; // dy >= 0 (pitch convention: positive = looking down)
  worldDeviationRUp: number;
  /** Phase 4: how long a downward gaze deviation is fully forgiven
   * (treated as 0 for gazeScore's ellipse distance) before it starts
   * counting at all — glancing down at a keyboard while typing and
   * staring at a phone look geometrically identical to this classifier
   * (both are "gaze pointed down"); only sustained duration tells them
   * apart. Not fit against data — no fixture recorded this specific
   * behavior; a starting value based on the user's own stated real-world
   * timing (keyboard glances stay under ~10s even while typing
   * continuously; phone-looking sustains 10-30s+), meant to be revised
   * after live testing. Only applies to downward gaze specifically —
   * sideways/upward deviation is untouched, unaffected by this. */
  lookingDownGraceMs: number;
  /** Same ellipse treatment for raw (uncalibrated) head pose alone — the
   * "landmarks too extreme to trust" cutoff, independent of calibration.
   * Also the "distance = 1" reference for headScore's soft falloff. */
  headPoseRX: number;
  headPoseRDown: number;
  headPoseRUp: number;
  /** Phase 3: soft-falloff band, as a multiple of each dimension's own
   * "distance = 1" reference (ellipse radius for head/gaze, grace period
   * for eyes). Score is 1 at/inside softInnerFactor, 0 at/beyond
   * softOuterFactor, linearly interpolated between — see smoothFalloff. */
  softInnerFactor: number;
  softOuterFactor: number;
  /** Schmitt trigger thresholds on focusScore — distinct so a score
   * oscillating between them can't flip anything (see applySchmittTrigger). */
  schmittLow: number;
  schmittHigh: number;
  /** Minimum ms between flips, regardless of how far past a Schmitt
   * threshold focusScore sits — a second anti-flicker mechanism stacked on
   * top of the threshold gap. */
  minDwellMs: number;
  /** Sustained ms focusScore must stay below schmittLow before the binary
   * state flips to distracted. */
  msToDistract: number;
  /** Sustained ms focusScore must stay above schmittHigh before the binary
   * state flips back to focused. */
  msToRefocus: number;
  /** ms a no-face streak can persist before the *binary* state is forced
   * to distracted — longer than msToDistract on purpose (leaning out of
   * frame briefly ≠ a real distraction), and independent of it: focusScore
   * is 0 for every no-face frame regardless of this grace period, so
   * reward never depends on it, only the UI-facing binary flag does. */
  noFaceGraceMs: number;
  /** EMA time constant (ms) — larger = slower/smoother. Replaces a fixed
   * per-call alpha; actual per-frame alpha is derived from dtMs (see ema()). */
  emaTauMs: number;
  /** dtMs above this is treated as a stall (tab backgrounded, camera
   * hiccup) rather than a real elapsed interval — see isStall below. */
  stallGapMs: number;
}

// Phase 1's ms constants below are derived from the Phase 0 frame-counter
// defaults (framesToDistract: 6, framesToRefocus: 4, calibrationFrames: 60,
// emaAlpha: 0.35 — see git history), assuming the ~30fps baseline those
// were implicitly tuned against. Two different conversions are needed:
//
// - Hysteresis/calibration use a streak-since-timestamp anchor: the anchor
//   frame itself has elapsed = 0, so "flips after N sustained frames" is
//   (N-1) frame intervals elapsed, not N — using N here would make the new
//   version measurably slower to react than the old one at the same
//   nominal rate.
// - EMA alpha is a genuinely continuous formula (alpha = 1 - exp(-dt/tau)),
//   no streak/off-by-one to account for — tau is solved directly so that
//   alpha ≈ 0.35 falls out at dt ≈ 33.3ms (30fps).
//
// These were a documented, defensible starting point for continuity with
// pre-Phase-1 behavior, verified via `npm run attention:eval` to confirm
// no regression — not fit against fixtures themselves.
const ASSUMED_FRAME_INTERVAL_MS = 1000 / 30; // 33.33ms — for the derivation above only, not read at runtime

export const DEFAULT_CONFIG: AttentionConfig = {
  earClosedThresholdDefault: 0.25, // used until session calibration completes
  earClosedFactor: 0.75, // calibrated threshold = person's own open-eye EAR baseline × this
  earThresholdMin: 0.15, // clamp so a noisy calibration window can't make the threshold unusable
  earThresholdMax: 0.3,
  calibrationMs: 59 * ASSUMED_FRAME_INTERVAL_MS, // ≈1967ms — was 60 frames
  eyesClosedGraceMs: 1500, // eyes can be closed this long without counting as distracted (blink tolerance) — already ms, unchanged
  // Phase 2: neutral offsets default to 0 (uncalibrated) — populated
  // per-session by the live onboarding capture (see this file's header and
  // lib/attention/neutralCalibration.ts) via applyCalibrationToConfig.
  // gazeWeightK/worldDeviationR{X,Down,Up} below, unlike the offsets, are
  // NOT session-specific — they're grid-search fit once by
  // scripts/fitCalibration.ts against every fixture in fixtures/attention/
  // (run via `npm run attention:fit`), assuming calibration IS applied
  // (each fixture got its own derived neutral baseline during fitting).
  // See docs/attention-baseline.md's Phase 2 section for the full
  // comparison table and the generalization caveat that comes with only
  // 2 same-person fixtures.
  neutralYaw: 0,
  neutralPitch: 0,
  neutralGazeX: 0,
  neutralGazeY: 0,
  gazeWeightK: 1,
  // worldDeviationRX widened 0.65→1.0 as of 2026-08-18, from live testing
  // (not a fixture re-fit — the 2 recorded fixtures apparently don't cover
  // this case much): looking at the left/right edge of a laptop screen
  // reads as "looking_away" even while genuinely reading the screen.
  // Likely cause: worldDevX = yaw + k·gazeX simply adds head-turn and
  // eye-shift together, but real gaze naturally combines head rotation
  // AND eye rotation toward the same target (this is normal human gaze
  // behavior, not two independent signals) — coordinated movement toward
  // an edge stacks up faster than either alone, so it can cross the
  // threshold well before you've actually looked away. Widening RX is the
  // direct fix for the reported symptom; gazeWeightK is also a plausible
  // lever for the same root cause (reduce how much the eye term adds on
  // top of head rotation) but deliberately not touched in the same change
  // — only one variable moved at a time so a re-test can actually tell
  // which lever mattered. Revisit with a real fixture covering edge-of-
  // screen viewing if this needs further tuning.
  worldDeviationRX: 1.0,
  worldDeviationRDown: 0.2,
  worldDeviationRUp: 0.1,
  // Phase 4: started at 10000 (the user's own stated keyboard-glance
  // ceiling), live-tested, reported as too long — 10s of un-flagged phone
  // time felt too lenient in practice even if keyboard glances really do
  // stay under that ceiling. Cut to 5000. Still not fit against any
  // fixture (none recorded this specific behavior) — a live-feel tuning
  // value, not a data-fit one. Revisit again after this round of testing.
  lookingDownGraceMs: 5000,
  headPoseRX: 0.75, // NOT included in the Phase 2 fit, see headScore's comment below
  headPoseRDown: 0.75,
  headPoseRUp: 0.75,
  // Phase 3: not fit against fixtures (this phase doesn't refit geometry,
  // it adds a scoring/hysteresis mechanism on top of Phase 2's) — chosen
  // to match the plan's own suggested starting values directly.
  softInnerFactor: 0.8,
  softOuterFactor: 1.3,
  schmittLow: 0.35,
  schmittHigh: 0.6,
  minDwellMs: 600,
  msToDistract: 5 * ASSUMED_FRAME_INTERVAL_MS, // ≈167ms — was 6 frames pre-Phase-1
  msToRefocus: 3 * ASSUMED_FRAME_INTERVAL_MS, // ≈100ms — was 4 frames pre-Phase-1
  noFaceGraceMs: 2000,
  emaTauMs: 77.4, // solved so alpha ≈ 0.35 at dt ≈ 33.3ms (30fps) — was a fixed 0.35 alpha
  stallGapMs: 500, // Build Mandate Phase 1: "~500ms" backgrounded-tab guard
};

export function createInitialAttentionState(
  config: AttentionConfig = DEFAULT_CONFIG
): AttentionState {
  return {
    focused: false,
    belowLowSinceMs: null,
    aboveHighSinceMs: null,
    lastFlipMs: null,
    noFaceSinceMs: null,
    eyesClosedSinceMs: null,
    gazeDownSinceMs: null,
    emaYaw: null,
    emaPitch: null,
    emaEar: null,
    emaGazeX: null,
    emaGazeY: null,
    calibSum: 0,
    calibCount: 0,
    calibMs: 0,
    calibThreshold: config.earClosedThresholdDefault,
  };
}

/** Every intermediate value, for the debug overlay and replay metrics — not part of the decision itself. */
export interface FrameDebug {
  rawYaw: number;
  rawPitch: number;
  rawEar: number;
  rawGazeX: number;
  rawGazeY: number;
  smoothedYaw: number;
  smoothedPitch: number;
  smoothedEar: number;
  smoothedGazeX: number;
  smoothedGazeY: number;
  roll: number;
  /** Deviation from calibrated neutral pose (0 if uncalibrated — see the
   * file header). */
  worldDevX: number;
  worldDevY: number;
  worldDevMag: number;
  headPoseMag: number;
  earThreshold: number;
  /** 0..1, fraction of calibrationMs collected so far. */
  calibrationProgress: number;
  eyesClosedInstant: boolean;
  /** Phase 3 per-dimension soft scores (1 = fully fine, 0 = fully failing)
   * and their combined min — see this file's header. */
  eyeScore: number;
  headScore: number;
  gazeScore: number;
  focusScore: number;
  /** Elapsed ms of the current sustained-below-schmittLow streak (0 while
   * above it). */
  distractStreakMs: number;
  /** Elapsed ms of the current sustained-above-schmittHigh streak (0 while
   * below it). */
  focusStreakMs: number;
  /** Elapsed ms of the current no-face streak (0 while a face is detected). */
  noFaceMs: number;
  /** Elapsed ms the gaze has been continuously pointed down past the
   * inner tolerance (0 otherwise) — Phase 4's keyboard-vs-phone dwell
   * tolerance. Forgiven (doesn't count against gazeScore) below
   * lookingDownGraceMs. */
  gazeDownMs: number;
  /** True if this frame's dtMs exceeded config.stallGapMs — every
   * duration-since/smoothing anchor was reset this frame as a result. */
  isStall: boolean;
}

export interface ClassifyResult {
  state: AttentionState;
  isFocused: boolean;
  /** Continuous 0..1 attention estimate — Phase 3. This, not isFocused, is
   * what reward accrual should integrate over time (see
   * context/SessionContext.tsx). isFocused is kept for UI display only. */
  focusScore: number;
  reason: DistractionReason;
  debug: FrameDebug;
}

// ── MediaPipe 478-point face mesh indices ──────────────────────────────
// Eye-corner indices double as the outer EAR landmarks and the roll pivots.
const RIGHT_EYE_EAR = [33, 160, 158, 133, 153, 144];
const LEFT_EYE_EAR = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE_CORNERS = { outer: 33, inner: 133 };
const LEFT_EYE_CORNERS = { outer: 263, inner: 362 };
const RIGHT_IRIS_CENTER = 468;
const LEFT_IRIS_CENTER = 473;
const RIGHT_IRIS_RIM = [469, 470, 471, 472];
const LEFT_IRIS_RIM = [474, 475, 476, 477];
const NOSE_TIP = 1;
const FACE_LEFT_EDGE = 234;
const FACE_RIGHT_EDGE = 454;
const FACE_TOP = 10; // forehead/hairline
const FACE_BOTTOM = 152; // chin

// ── Pure geometry helpers (unchanged math, moved verbatim from the hook) ──

function dist2D(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Vertical eyelid gap only (EAR's numerator) — pulled out so the iris-
 * diameter-normalized alternative below (Phase 4a shadow signal) can
 * reuse the exact same "how open is the eye" measurement, differing only
 * in what it's divided by. Pure extraction, no formula change — verified
 * unchanged by the existing polarity/calibration tests, which exercise
 * computeEAR (and therefore this) indirectly. */
function eyelidVerticalGap(landmarks: Landmark[], indices: number[]): number {
  const [, p2, p3, , p5, p6] = indices.map((i) => landmarks[i]);
  return (dist2D(p2, p6) + dist2D(p3, p5)) / 2;
}

function computeEAR(landmarks: Landmark[], indices: number[]): number {
  const [p1, , , p4] = indices.map((i) => landmarks[i]);
  const vertical = eyelidVerticalGap(landmarks, indices);
  const horizontal = dist2D(p1, p4);
  return horizontal > 0 ? vertical / horizontal : 0;
}

/** Max pairwise distance among a ring of points approximating a circle's
 * diameter. Robust to not knowing the exact semantic ordering of the rim
 * points: for points roughly evenly spaced around a circle, some opposite
 * pair always realizes the true diameter, which is >= any adjacent-pair
 * chord distance — so the max alone is enough, no need to identify which
 * specific pair is "opposite." */
function ringDiameter(landmarks: Landmark[], rimIndices: number[]): number {
  let maxDist = 0;
  for (let i = 0; i < rimIndices.length; i++) {
    for (let j = i + 1; j < rimIndices.length; j++) {
      const d = dist2D(landmarks[rimIndices[i]], landmarks[rimIndices[j]]);
      if (d > maxDist) maxDist = d;
    }
  }
  return maxDist;
}

/** Phase 4a shadow signal, NOT used by any live decision yet — see
 * scripts/compareEyeOpenness.ts for the real-fixture comparison this
 * needs to win before being promoted (Build Mandate: "promote only if it
 * beats calibrated EAR in replay"). Same vertical-eyelid-gap numerator
 * EAR uses, normalized by iris diameter instead of eye width. Iris
 * diameter (~11.7mm) is anatomically near-constant across humans, unlike
 * eye width, which varies by eye shape and can shift with gaze/expression
 * — the theory is this makes the measurement less eye-shape-sensitive
 * than EAR. Untested against real data until the comparison script runs. */
export function computeIrisNormalizedOpenness(
  landmarks: Landmark[]
): { left: number; right: number; mean: number } {
  const rightVertical = eyelidVerticalGap(landmarks, RIGHT_EYE_EAR);
  const leftVertical = eyelidVerticalGap(landmarks, LEFT_EYE_EAR);
  const rightDiameter = ringDiameter(landmarks, RIGHT_IRIS_RIM);
  const leftDiameter = ringDiameter(landmarks, LEFT_IRIS_RIM);
  const right = rightDiameter > 0 ? rightVertical / rightDiameter : 0;
  const left = leftDiameter > 0 ? leftVertical / leftDiameter : 0;
  return { left, right, mean: (left + right) / 2 };
}

/** Angle (radians) of the eye-corner line vs. horizontal. 0 = level head. */
function computeRoll(landmarks: Landmark[]): number {
  const l = landmarks[LEFT_EYE_CORNERS.outer];
  const r = landmarks[RIGHT_EYE_CORNERS.outer];
  return Math.atan2(l.y - r.y, l.x - r.x);
}

/** Rotates a 2D point around a pivot by `angle` radians. */
function rotate(
  p: { x: number; y: number },
  pivot: { x: number; y: number },
  angle: number
): { x: number; y: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  };
}

/** ~0 facing camera; ±1 when nose hits a cheek edge. De-rolled first. */
function computeHeadYaw(landmarks: Landmark[], roll: number): number {
  const center = {
    x: (landmarks[FACE_LEFT_EDGE].x + landmarks[FACE_RIGHT_EDGE].x) / 2,
    y: (landmarks[FACE_LEFT_EDGE].y + landmarks[FACE_RIGHT_EDGE].y) / 2,
  };
  const nose = rotate(landmarks[NOSE_TIP], center, -roll);
  const left = rotate(landmarks[FACE_LEFT_EDGE], center, -roll);
  const right = rotate(landmarks[FACE_RIGHT_EDGE], center, -roll);
  const faceWidth = right.x - left.x;
  if (faceWidth <= 0) return 0;
  return (nose.x - center.x) / (faceWidth / 2);
}

/** Vertical counterpart to computeHeadYaw. NOTE: unlike yaw, this has no
 * anatomical zero-point (the nose tip does not sit at the forehead/chin
 * midpoint the way it sits near the cheek-to-cheek midline) — it carries a
 * person-specific bias until Phase 2's neutral-pose calibration corrects
 * for it. Flagged so it isn't mistaken for an oversight. */
function computeHeadPitch(landmarks: Landmark[], roll: number): number {
  const center = {
    x: (landmarks[FACE_TOP].x + landmarks[FACE_BOTTOM].x) / 2,
    y: (landmarks[FACE_TOP].y + landmarks[FACE_BOTTOM].y) / 2,
  };
  const nose = rotate(landmarks[NOSE_TIP], center, -roll);
  const top = rotate(landmarks[FACE_TOP], center, -roll);
  const bottom = rotate(landmarks[FACE_BOTTOM], center, -roll);
  const faceHeight = bottom.y - top.y;
  if (faceHeight <= 0) return 0;
  return (nose.y - center.y) / (faceHeight / 2);
}

/** Iris center position relative to the eye socket, normalized by eye size, both axes. */
function computeIrisOffset(
  landmarks: Landmark[],
  earIndices: number[],
  corners: { outer: number; inner: number },
  irisCenter: number
): { horizontal: number; vertical: number } {
  const outer = landmarks[corners.outer];
  const inner = landmarks[corners.inner];
  const iris = landmarks[irisCenter];
  const [, p2, p3, , p5, p6] = earIndices.map((i) => landmarks[i]);
  if (!iris) return { horizontal: 0, vertical: 0 };

  const eyeCenterX = (outer.x + inner.x) / 2;
  const eyeWidth = Math.abs(inner.x - outer.x);
  const eyeTopY = (p2.y + p3.y) / 2;
  const eyeBottomY = (p5.y + p6.y) / 2;
  const eyeCenterY = (eyeTopY + eyeBottomY) / 2;
  const eyeHeight = Math.abs(eyeBottomY - eyeTopY);

  return {
    horizontal: eyeWidth > 0 ? (iris.x - eyeCenterX) / eyeWidth : 0,
    vertical: eyeHeight > 0 ? (iris.y - eyeCenterY) / eyeHeight : 0,
  };
}

/** Everything classifyFrame derives directly from one frame's landmarks,
 * before any smoothing/state — no EMA, no hysteresis, no calibration. This
 * is what a live face gives you "right now"; classifyFrame calls it
 * internally, and lib/attention/neutralCalibration.ts's onboarding capture
 * calls it directly (same math, no reason to duplicate it) to sample a
 * user's neutral-pose baseline before a session starts. */
export interface RawSignals {
  roll: number;
  yaw: number;
  pitch: number;
  ear: number;
  /** 0,0 when eyes are closed (iris landmarks are unreliable then) — see
   * the eyesClosed gate below. */
  gazeX: number;
  gazeY: number;
  eyesClosed: boolean;
}

/** @param earThreshold whatever the caller currently considers "closed" —
 * classifyFrame passes its session-calibrated threshold; callers without
 * one yet (e.g. neutral-pose calibration, which runs before any EAR
 * calibration could have completed) pass config.earClosedThresholdDefault. */
export function computeRawSignals(
  landmarks: Landmark[],
  earThreshold: number
): RawSignals {
  const roll = computeRoll(landmarks);
  const yaw = computeHeadYaw(landmarks, roll);
  const pitch = computeHeadPitch(landmarks, roll);

  const leftEAR = computeEAR(landmarks, LEFT_EYE_EAR);
  const rightEAR = computeEAR(landmarks, RIGHT_EYE_EAR);
  const ear = (leftEAR + rightEAR) / 2;
  const eyesClosed = ear < earThreshold;

  let gazeX = 0;
  let gazeY = 0;
  if (!eyesClosed) {
    const rightGaze = computeIrisOffset(
      landmarks,
      RIGHT_EYE_EAR,
      RIGHT_EYE_CORNERS,
      RIGHT_IRIS_CENTER
    );
    const leftGaze = computeIrisOffset(
      landmarks,
      LEFT_EYE_EAR,
      LEFT_EYE_CORNERS,
      LEFT_IRIS_CENTER
    );
    gazeX = (rightGaze.horizontal + leftGaze.horizontal) / 2;
    gazeY = (rightGaze.vertical + leftGaze.vertical) / 2;
  }

  return { roll, yaw, pitch, ear, gazeX, gazeY, eyesClosed };
}

/** Normalized elliptical "distance from center," independently scaled per
 * axis with a further split on dy's sign (downward/upward tolerance can
 * differ — laptop screens sit below eye level). 0 = dead center, 1 =
 * exactly on the ellipse boundary, >1 = outside it. Shared basis for both
 * Phase 2's binary ellipse test (d <= 1) and Phase 3's soft-falloff
 * scoring (smoothFalloff(d, ...)) — one notion of "how far outside
 * tolerance," read two different ways. Degenerate radii (<=0) put every
 * non-origin point at infinite distance. */
function ellipseDistance(
  dx: number,
  dy: number,
  rx: number,
  rDown: number,
  rUp: number
): number {
  const ry = dy >= 0 ? rDown : rUp;
  if (rx <= 0 || ry <= 0) return dx === 0 && dy === 0 ? 0 : Infinity;
  return Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2);
}

/** 1 while x <= inner, 0 while x >= outer, linearly interpolated between —
 * Phase 3's soft-scoring primitive. `x` is generic: an ellipse distance
 * (0 = center, 1 = boundary) for head/gaze, or a grace-period fraction
 * (eyesClosedMs / eyesClosedGraceMs) for eyes — this function doesn't care
 * which, it's just a soft threshold. Linear, not smoothstep/eased — the
 * simplest defensible curve shape; revisit if a specific shape turns out
 * to matter empirically (nothing so far suggests it does). */
function smoothFalloff(x: number, inner: number, outer: number): number {
  if (x <= inner) return 1;
  if (x >= outer) return 0;
  return (outer - x) / (outer - inner);
}

/** One-pole exponential moving average, alpha derived per-call from elapsed
 * time and a time constant instead of a fixed per-call value — see
 * computeAlpha. `prev === null` on the first sample (alpha irrelevant then;
 * the raw value is taken directly). */
function ema(prev: number | null, next: number, alpha: number): number {
  return prev === null ? next : prev * (1 - alpha) + next * alpha;
}

/** alpha = 1 - exp(-dt/tau): converges at the same real-world rate
 * regardless of how often this is called. dtMs <= 0 (first frame, a
 * stalled/repeated timestamp) yields alpha 0 — no smoothing movement that
 * frame, which is correct: zero elapsed time should mean zero blend. */
function computeAlpha(dtMs: number, tauMs: number): number {
  if (dtMs <= 0) return 0;
  return 1 - Math.exp(-dtMs / tauMs);
}

/**
 * Schmitt trigger with a minimum dwell time — Build Mandate Phase 3,
 * replacing Phase 1/2's single-threshold applyHysteresis now that the
 * input is a continuous focusScore instead of a binary frameOK. Two
 * separate anti-flicker mechanisms stacked:
 *   1. Threshold gap: distinct focused→distracted (schmittLow) and
 *      distracted→focused (schmittHigh) thresholds, each still gated on a
 *      sustained streak (msToDistract/msToRefocus — the same time-anchored
 *      mechanism Phase 1 introduced, just now anchored on score-threshold
 *      crossing instead of a boolean). A score oscillating in the dead
 *      zone between the two thresholds can't flip anything, structurally —
 *      the gap itself kills flicker, not a counter that happens to reset
 *      on one good/bad frame.
 *   2. Minimum dwell: even a score that crosses a threshold and stays
 *      there long enough can't trigger ANOTHER flip until minDwellMs has
 *      passed since the last one — catches a flip-back-and-forth that
 *      would otherwise satisfy (1) very soon after a flip already fired.
 */
function applySchmittTrigger(
  focusScore: number,
  tNowMs: number,
  belowLowSinceMs: number | null,
  aboveHighSinceMs: number | null,
  lastFlipMs: number | null,
  focused: boolean,
  config: AttentionConfig
): {
  focused: boolean;
  belowLowSinceMs: number | null;
  aboveHighSinceMs: number | null;
  lastFlipMs: number | null;
  distractStreakMs: number;
  focusStreakMs: number;
} {
  const dwellOK = lastFlipMs === null || tNowMs - lastFlipMs >= config.minDwellMs;

  if (focusScore < config.schmittLow) {
    const anchor = belowLowSinceMs ?? tNowMs;
    const streakMs = tNowMs - anchor;
    const shouldFlip = focused && dwellOK && streakMs >= config.msToDistract;
    return {
      focused: shouldFlip ? false : focused,
      belowLowSinceMs: anchor,
      aboveHighSinceMs: null,
      lastFlipMs: shouldFlip ? tNowMs : lastFlipMs,
      distractStreakMs: streakMs,
      focusStreakMs: 0,
    };
  }

  if (focusScore > config.schmittHigh) {
    const anchor = aboveHighSinceMs ?? tNowMs;
    const streakMs = tNowMs - anchor;
    const shouldFlip = !focused && dwellOK && streakMs >= config.msToRefocus;
    return {
      focused: shouldFlip ? true : focused,
      belowLowSinceMs: null,
      aboveHighSinceMs: anchor,
      lastFlipMs: shouldFlip ? tNowMs : lastFlipMs,
      distractStreakMs: 0,
      focusStreakMs: streakMs,
    };
  }

  // Dead zone (schmittLow <= focusScore <= schmittHigh): neither streak
  // progresses — same mutual-exclusion reset Phase 1's two-zone version
  // used, now with a third (neutral) zone that resets both.
  return {
    focused,
    belowLowSinceMs: null,
    aboveHighSinceMs: null,
    lastFlipMs,
    distractStreakMs: 0,
    focusStreakMs: 0,
  };
}

/**
 * Classifies one frame. Pure: same inputs always produce the same outputs,
 * no reads of any ambient clock or DOM state — `tNowMs`/`dtMs` are the only
 * notion of time this function has, and both come from the caller.
 *
 * @param landmarks null means "no face detected this frame" (MediaPipe
 *   returned zero faces), not "caller doesn't have data yet."
 */
export function classifyFrame(
  landmarks: Landmark[] | null,
  tNowMs: number,
  dtMs: number,
  state: AttentionState,
  config: AttentionConfig
): ClassifyResult {
  const isStall = dtMs > config.stallGapMs;
  // A very large dtMs (tab backgrounded, camera stalled) must not read as
  // sustained bad/good time, blink duration, or EMA blend weight — reset
  // every duration-since/smoothing anchor so this frame starts fresh
  // instead of the gap silently flipping the verdict or corrupting
  // calibration. effectiveDtMs (used for EMA alpha and calibration
  // accumulation below) is likewise clamped to 0 on a stall frame.
  // lastFlipMs is deliberately NOT reset here — see applySchmittTrigger's
  // doc comment; a real elapsed gap only ever makes the dwell gate easier
  // to satisfy on resume, never harder, so there's nothing to correct.
  const effectiveDtMs = isStall ? 0 : dtMs;
  const baseState: AttentionState = isStall
    ? {
        ...state,
        belowLowSinceMs: null,
        aboveHighSinceMs: null,
        noFaceSinceMs: null,
        eyesClosedSinceMs: null,
        gazeDownSinceMs: null,
        emaYaw: null,
        emaPitch: null,
        emaEar: null,
        emaGazeX: null,
        emaGazeY: null,
      }
    : state;

  if (!landmarks || landmarks.length === 0) {
    let noFaceSinceMs = baseState.noFaceSinceMs;
    if (noFaceSinceMs === null) noFaceSinceMs = tNowMs;
    const noFaceMs = tNowMs - noFaceSinceMs;
    // Within the grace period, hold whatever the binary state already
    // was — leaning out of frame briefly shouldn't visibly flip the UI.
    // focusScore below is 0 regardless, every no-face frame, no grace:
    // there's no face to credit either way.
    const focused = noFaceMs > config.noFaceGraceMs ? false : baseState.focused;
    const flipped = focused !== baseState.focused;
    return {
      state: {
        ...baseState,
        focused,
        belowLowSinceMs: null,
        aboveHighSinceMs: null,
        noFaceSinceMs,
        gazeDownSinceMs: null,
        lastFlipMs: flipped ? tNowMs : baseState.lastFlipMs,
      },
      isFocused: focused,
      focusScore: 0,
      reason: focused ? null : "no_face",
      debug: {
        rawYaw: 0,
        rawPitch: 0,
        rawEar: 0,
        rawGazeX: 0,
        rawGazeY: 0,
        smoothedYaw: baseState.emaYaw ?? 0,
        smoothedPitch: baseState.emaPitch ?? 0,
        smoothedEar: baseState.emaEar ?? 0,
        smoothedGazeX: baseState.emaGazeX ?? 0,
        smoothedGazeY: baseState.emaGazeY ?? 0,
        roll: 0,
        worldDevX: 0,
        worldDevY: 0,
        worldDevMag: 0,
        headPoseMag: 0,
        earThreshold: baseState.calibThreshold,
        calibrationProgress: Math.min(1, baseState.calibMs / config.calibrationMs),
        eyesClosedInstant: false,
        eyeScore: 0,
        headScore: 0,
        gazeScore: 0,
        focusScore: 0,
        distractStreakMs: 0,
        focusStreakMs: 0,
        noFaceMs,
        gazeDownMs: 0,
        isStall,
      },
    };
  }

  // Raw (unsmoothed) EAR drives the closed/open instant — using the
  // smoothed value would delay-detect both closing AND reopening,
  // undermining the precise grace-period timer below. computeRawSignals
  // needs *a* threshold to decide that instant, so it gets the same
  // session-calibrated one classifyFrame has always used here.
  const raw = computeRawSignals(landmarks, baseState.calibThreshold);
  const { roll, yaw, pitch, ear, eyesClosed } = raw;
  const rawGazeX = raw.gazeX;
  const rawGazeY = raw.gazeY;

  const alpha = computeAlpha(effectiveDtMs, config.emaTauMs);
  const emaYaw = ema(baseState.emaYaw, yaw, alpha);
  const emaPitch = ema(baseState.emaPitch, pitch, alpha);
  const emaEar = ema(baseState.emaEar, ear, alpha);

  // Gaze-offset EMA is frozen (not updated) while eyesClosed — iris
  // position is unreliable during a blink's closing/opening transition.
  // (computeRawSignals already zeroes rawGazeX/Y in that case.)
  const emaGazeX = eyesClosed ? baseState.emaGazeX : ema(baseState.emaGazeX, rawGazeX, alpha);
  const emaGazeY = eyesClosed ? baseState.emaGazeY : ema(baseState.emaGazeY, rawGazeY, alpha);
  const sGazeX = emaGazeX ?? 0;
  const sGazeY = emaGazeY ?? 0;

  // Eye-closure duration timer, to distinguish blinks from sustained closure.
  let eyesClosedSinceMs = baseState.eyesClosedSinceMs;
  if (eyesClosed) {
    if (eyesClosedSinceMs === null) eyesClosedSinceMs = tNowMs;
  } else {
    eyesClosedSinceMs = null;
  }
  const eyesClosedMs =
    eyesClosedSinceMs === null ? 0 : tNowMs - eyesClosedSinceMs;

  // One-time session calibration: sample raw EAR (not `eyesClosed` frames —
  // a blink mid-calibration would drag the baseline down) until
  // calibrationMs of valid open-eye sampling time has elapsed, then freeze
  // threshold = baseline × factor. calibCount only feeds the average, not
  // the completion gate.
  let calibSum = baseState.calibSum;
  let calibCount = baseState.calibCount;
  let calibMs = baseState.calibMs;
  let calibThreshold = baseState.calibThreshold;
  if (calibMs < config.calibrationMs && !eyesClosed) {
    calibSum += ear;
    calibCount += 1;
    calibMs += effectiveDtMs;
    if (calibMs >= config.calibrationMs) {
      const baseline = calibSum / calibCount;
      calibThreshold = Math.min(
        config.earThresholdMax,
        Math.max(config.earThresholdMin, baseline * config.earClosedFactor)
      );
    }
  }

  // World deviation = (calibrated) head pose + weighted iris offset, both
  // axes. When head turns/tilts one way and eyes compensate the other way,
  // these cancel and the user is still looking at the screen. During a
  // blink, iris landmarks are unreliable — treat as on-screen (0
  // deviation from calibrated neutral, not 0 in absolute terms — matters
  // once neutralYaw/neutralPitch are nonzero).
  const worldDevX = eyesClosed
    ? 0
    : (emaYaw - config.neutralYaw) + config.gazeWeightK * (sGazeX - config.neutralGazeX);
  const worldDevY = eyesClosed
    ? 0
    : (emaPitch - config.neutralPitch) + config.gazeWeightK * (sGazeY - config.neutralGazeY);
  const worldDevMag = Math.hypot(worldDevX, worldDevY);
  const headPoseMag = Math.hypot(emaYaw, emaPitch);

  // Phase 4: sustained-downward-gaze grace period — glancing down at a
  // keyboard while typing and staring at a phone are geometrically
  // identical to this classifier (both are "gaze pointed down"); only
  // duration tells them apart. Tracks how long the down component alone
  // (ignoring any sideways deviation) has continuously exceeded the inner
  // tolerance, exactly the same streak-since-timestamp pattern
  // eyesClosedSinceMs already uses for blink tolerance.
  const gazeIsDown = worldDevY > 0 && worldDevY / config.worldDeviationRDown > config.softInnerFactor;
  let gazeDownSinceMs = baseState.gazeDownSinceMs;
  if (gazeIsDown) {
    if (gazeDownSinceMs === null) gazeDownSinceMs = tNowMs;
  } else {
    gazeDownSinceMs = null;
  }
  const gazeDownMs = gazeDownSinceMs === null ? 0 : tNowMs - gazeDownSinceMs;
  // While forgiven, the down component is zeroed for gazeScore's distance
  // calculation only — worldDevY/worldDevMag above stay as the true,
  // unmasked values for debug/diagnostic purposes. Sideways deviation
  // (worldDevX) is never forgiven by this — a phone held off to the side
  // while looking down still counts via the X component.
  const gazeDownForgiven = gazeIsDown && gazeDownMs < config.lookingDownGraceMs;
  const scoredWorldDevY = gazeDownForgiven ? 0 : worldDevY;

  // Phase 3: three independent soft scores (1 = fully fine, 0 = fully
  // failing), combined via min — the weakest dimension still dominates,
  // same as the old AND of three booleans, just continuous now.
  const eyeScore = smoothFalloff(
    eyesClosedMs / config.eyesClosedGraceMs,
    config.softInnerFactor,
    config.softOuterFactor
  );
  // Head-pose extremity is intentionally NOT neutral-corrected — it's a
  // "landmarks too rotated to trust at all" cutoff, not a "looking away
  // from the screen" one, so a person's calibrated resting yaw/pitch bias
  // shouldn't shift where it kicks in.
  const headScore = smoothFalloff(
    ellipseDistance(emaYaw, emaPitch, config.headPoseRX, config.headPoseRDown, config.headPoseRUp),
    config.softInnerFactor,
    config.softOuterFactor
  );
  const gazeScore = smoothFalloff(
    ellipseDistance(worldDevX, scoredWorldDevY, config.worldDeviationRX, config.worldDeviationRDown, config.worldDeviationRUp),
    config.softInnerFactor,
    config.softOuterFactor
  );
  const focusScore = Math.min(eyeScore, headScore, gazeScore);

  // Instantaneous reason (which dimension is weakest right now), masked to
  // null once focusScore hits 1 (every dimension at/inside softInnerFactor
  // — as close to "the old AND of three booleans was all-false" as a
  // continuous score gets). Same eyes > head > gaze priority order the
  // pre-Phase-3 boolean version used, now as a tiebreak on ties.
  let instantReason: DistractionReason = null;
  if (focusScore < 1) {
    if (eyeScore <= headScore && eyeScore <= gazeScore) instantReason = "eyes_closed";
    else if (headScore <= gazeScore) instantReason = "head_extreme";
    else instantReason = "looking_away";
  }

  const s = applySchmittTrigger(
    focusScore,
    tNowMs,
    baseState.belowLowSinceMs,
    baseState.aboveHighSinceMs,
    baseState.lastFlipMs,
    baseState.focused,
    config
  );

  return {
    state: {
      focused: s.focused,
      belowLowSinceMs: s.belowLowSinceMs,
      aboveHighSinceMs: s.aboveHighSinceMs,
      lastFlipMs: s.lastFlipMs,
      noFaceSinceMs: null,
      eyesClosedSinceMs,
      gazeDownSinceMs,
      emaYaw,
      emaPitch,
      emaEar,
      emaGazeX,
      emaGazeY,
      calibSum,
      calibCount,
      calibMs,
      calibThreshold,
    },
    isFocused: s.focused,
    focusScore,
    reason: s.focused ? null : instantReason,
    debug: {
      rawYaw: yaw,
      rawPitch: pitch,
      rawEar: ear,
      rawGazeX,
      rawGazeY,
      smoothedYaw: emaYaw,
      smoothedPitch: emaPitch,
      smoothedEar: emaEar,
      smoothedGazeX: sGazeX,
      smoothedGazeY: sGazeY,
      roll,
      worldDevX,
      worldDevY,
      worldDevMag,
      headPoseMag,
      earThreshold: calibThreshold,
      calibrationProgress: Math.min(1, calibMs / config.calibrationMs),
      eyesClosedInstant: eyesClosed,
      eyeScore,
      headScore,
      gazeScore,
      focusScore,
      distractStreakMs: s.distractStreakMs,
      focusStreakMs: s.focusStreakMs,
      noFaceMs: 0,
      gazeDownMs,
      isStall,
    },
  };
}
