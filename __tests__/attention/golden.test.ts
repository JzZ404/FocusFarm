/**
 * RETIRED as an active test starting Phase 1 (describe.skip below) — kept
 * as a historical record, not deleted.
 *
 * This was the golden-master test for the Phase 0 classifier extraction:
 * `referenceClassify` below is a deliberately independent, self-contained
 * re-implementation of the pre-refactor frame-*counter* logic that used to
 * be inlined in lib/hooks/useAttention.ts's requestAnimationFrame loop — it
 * does NOT import anything from lib/attention/classify.ts except the
 * `Landmark` type, specifically so it couldn't silently pass by comparing
 * the new code against itself. It proved Phase 0's extraction was
 * byte-identical to what shipped before it, frame-by-frame.
 *
 * Phase 1 intentionally broke that premise: hysteresis/calibration/smoothing
 * became duration-based instead of frame-count-based (see classify.ts's
 * header and __tests__/attention/frameRateIndependence.test.ts), which is a
 * real behavior change, not a bug — the whole point was to stop being
 * rate-dependent. Byte-identical-to-the-frame-counter-reference is no
 * longer the right thing to assert; classify.test.ts's "calibration
 * convergence" and "frame-rate independence" blocks plus
 * frameRateIndependence.test.ts now cover what actually matters for this
 * behavior. Left in place (skipped, not removed) so the pre-Phase-1
 * reference implementation and what it proved stay visible in history.
 */
import {
  classifyFrame,
  createInitialAttentionState,
  DEFAULT_CONFIG,
  type Landmark,
  type DistractionReason,
} from "@/lib/attention/classify";
import {
  neutralFrame,
  closedEyesFrame,
  lookingAwayFrame,
  lookingDownFrame,
  headExtremeFrame,
  withOverrides,
  NEUTRAL_OVERRIDES,
} from "./fixtures";

// ── Reference implementation (frozen copy of pre-refactor logic) ──────────

const REF_EAR_CLOSED_THRESHOLD_DEFAULT = 0.25;
const REF_EAR_CLOSED_FACTOR = 0.75;
const REF_EAR_THRESHOLD_MIN = 0.15;
const REF_EAR_THRESHOLD_MAX = 0.3;
const REF_CALIBRATION_FRAMES = 60;
const REF_EYES_CLOSED_GRACE_MS = 1500;
const REF_WORLD_GAZE_DEADZONE = 0.3;
const REF_HEAD_POSE_HARD_LIMIT = 0.75;
const REF_FRAMES_TO_DISTRACT = 6;
const REF_FRAMES_TO_REFOCUS = 4;
const REF_EMA_ALPHA = 0.35;

const REF_RIGHT_EYE_EAR = [33, 160, 158, 133, 153, 144];
const REF_LEFT_EYE_EAR = [362, 385, 387, 263, 373, 380];
const REF_RIGHT_EYE_CORNERS = { outer: 33, inner: 133 };
const REF_LEFT_EYE_CORNERS = { outer: 263, inner: 362 };
const REF_RIGHT_IRIS_CENTER = 468;
const REF_LEFT_IRIS_CENTER = 473;
const REF_NOSE_TIP = 1;
const REF_FACE_LEFT_EDGE = 234;
const REF_FACE_RIGHT_EDGE = 454;
const REF_FACE_TOP = 10;
const REF_FACE_BOTTOM = 152;

function refDist2D(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function refComputeEAR(landmarks: Landmark[], indices: number[]): number {
  const [p1, p2, p3, p4, p5, p6] = indices.map((i) => landmarks[i]);
  const vertical = (refDist2D(p2, p6) + refDist2D(p3, p5)) / 2;
  const horizontal = refDist2D(p1, p4);
  return horizontal > 0 ? vertical / horizontal : 0;
}

function refComputeRoll(landmarks: Landmark[]): number {
  const l = landmarks[REF_LEFT_EYE_CORNERS.outer];
  const r = landmarks[REF_RIGHT_EYE_CORNERS.outer];
  return Math.atan2(l.y - r.y, l.x - r.x);
}

function refRotate(
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

function refComputeHeadYaw(landmarks: Landmark[], roll: number): number {
  const center = {
    x: (landmarks[REF_FACE_LEFT_EDGE].x + landmarks[REF_FACE_RIGHT_EDGE].x) / 2,
    y: (landmarks[REF_FACE_LEFT_EDGE].y + landmarks[REF_FACE_RIGHT_EDGE].y) / 2,
  };
  const nose = refRotate(landmarks[REF_NOSE_TIP], center, -roll);
  const left = refRotate(landmarks[REF_FACE_LEFT_EDGE], center, -roll);
  const right = refRotate(landmarks[REF_FACE_RIGHT_EDGE], center, -roll);
  const faceWidth = right.x - left.x;
  if (faceWidth <= 0) return 0;
  return (nose.x - center.x) / (faceWidth / 2);
}

function refComputeHeadPitch(landmarks: Landmark[], roll: number): number {
  const center = {
    x: (landmarks[REF_FACE_TOP].x + landmarks[REF_FACE_BOTTOM].x) / 2,
    y: (landmarks[REF_FACE_TOP].y + landmarks[REF_FACE_BOTTOM].y) / 2,
  };
  const nose = refRotate(landmarks[REF_NOSE_TIP], center, -roll);
  const top = refRotate(landmarks[REF_FACE_TOP], center, -roll);
  const bottom = refRotate(landmarks[REF_FACE_BOTTOM], center, -roll);
  const faceHeight = bottom.y - top.y;
  if (faceHeight <= 0) return 0;
  return (nose.y - center.y) / (faceHeight / 2);
}

function refComputeIrisOffset(
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

function refEma(prev: number | null, next: number): number {
  return prev === null ? next : prev * (1 - REF_EMA_ALPHA) + next * REF_EMA_ALPHA;
}

interface RefState {
  distractCounter: number;
  focusCounter: number;
  focused: boolean;
  eyesClosedSince: number | null;
  emaYaw: number | null;
  emaPitch: number | null;
  emaEar: number | null;
  emaGazeX: number | null;
  emaGazeY: number | null;
  calibSum: number;
  calibCount: number;
  calibThreshold: number;
}

function refCreateState(): RefState {
  return {
    distractCounter: 0,
    focusCounter: 0,
    focused: false,
    eyesClosedSince: null,
    emaYaw: null,
    emaPitch: null,
    emaEar: null,
    emaGazeX: null,
    emaGazeY: null,
    calibSum: 0,
    calibCount: 0,
    calibThreshold: REF_EAR_CLOSED_THRESHOLD_DEFAULT,
  };
}

/** Mutates `state` in place, mirroring the original ref-based hook exactly. */
function referenceClassify(
  landmarks: Landmark[] | null,
  now: number,
  state: RefState
): { isFocused: boolean; reason: DistractionReason } {
  if (!landmarks || landmarks.length === 0) {
    state.distractCounter = Math.min(state.distractCounter + 1, REF_FRAMES_TO_DISTRACT);
    state.focusCounter = 0;
    if (state.distractCounter >= REF_FRAMES_TO_DISTRACT) state.focused = false;
    return { isFocused: state.focused, reason: state.focused ? null : "no_face" };
  }

  const roll = refComputeRoll(landmarks);
  const yaw = refComputeHeadYaw(landmarks, roll);
  const pitch = refComputeHeadPitch(landmarks, roll);

  const leftEAR = refComputeEAR(landmarks, REF_LEFT_EYE_EAR);
  const rightEAR = refComputeEAR(landmarks, REF_RIGHT_EYE_EAR);
  const ear = (leftEAR + rightEAR) / 2;

  const eyesClosed = ear < state.calibThreshold;

  state.emaYaw = refEma(state.emaYaw, yaw);
  state.emaPitch = refEma(state.emaPitch, pitch);
  state.emaEar = refEma(state.emaEar, ear);

  if (!eyesClosed) {
    const rightGaze = refComputeIrisOffset(
      landmarks,
      REF_RIGHT_EYE_EAR,
      REF_RIGHT_EYE_CORNERS,
      REF_RIGHT_IRIS_CENTER
    );
    const leftGaze = refComputeIrisOffset(
      landmarks,
      REF_LEFT_EYE_EAR,
      REF_LEFT_EYE_CORNERS,
      REF_LEFT_IRIS_CENTER
    );
    const gazeX = (rightGaze.horizontal + leftGaze.horizontal) / 2;
    const gazeY = (rightGaze.vertical + leftGaze.vertical) / 2;
    state.emaGazeX = refEma(state.emaGazeX, gazeX);
    state.emaGazeY = refEma(state.emaGazeY, gazeY);
  }

  const sYaw = state.emaYaw;
  const sPitch = state.emaPitch;
  const sGazeX = state.emaGazeX ?? 0;
  const sGazeY = state.emaGazeY ?? 0;

  if (eyesClosed) {
    if (state.eyesClosedSince === null) state.eyesClosedSince = now;
  } else {
    state.eyesClosedSince = null;
  }
  const eyesClosedMs = state.eyesClosedSince === null ? 0 : now - state.eyesClosedSince;
  const eyesClosedTooLong = eyesClosedMs > REF_EYES_CLOSED_GRACE_MS;

  if (state.calibCount < REF_CALIBRATION_FRAMES && !eyesClosed) {
    state.calibSum += ear;
    state.calibCount += 1;
    if (state.calibCount === REF_CALIBRATION_FRAMES) {
      const baseline = state.calibSum / state.calibCount;
      state.calibThreshold = Math.min(
        REF_EAR_THRESHOLD_MAX,
        Math.max(REF_EAR_THRESHOLD_MIN, baseline * REF_EAR_CLOSED_FACTOR)
      );
    }
  }

  const worldGazeX = eyesClosed ? 0 : sYaw + sGazeX;
  const worldGazeY = eyesClosed ? 0 : sPitch + sGazeY;
  const worldGazeMag = Math.hypot(worldGazeX, worldGazeY);
  const headPoseMag = Math.hypot(sYaw, sPitch);

  const headExtreme = headPoseMag > REF_HEAD_POSE_HARD_LIMIT;
  const lookingAway = worldGazeMag > REF_WORLD_GAZE_DEADZONE;

  let reason: DistractionReason = null;
  if (eyesClosedTooLong) reason = "eyes_closed";
  else if (headExtreme) reason = "head_extreme";
  else if (lookingAway) reason = "looking_away";

  const frameOK = !eyesClosedTooLong && !headExtreme && !lookingAway;

  if (frameOK) {
    state.focusCounter = Math.min(state.focusCounter + 1, REF_FRAMES_TO_REFOCUS);
    state.distractCounter = 0;
    if (state.focusCounter >= REF_FRAMES_TO_REFOCUS) state.focused = true;
  } else {
    state.distractCounter = Math.min(state.distractCounter + 1, REF_FRAMES_TO_DISTRACT);
    state.focusCounter = 0;
    if (state.distractCounter >= REF_FRAMES_TO_DISTRACT) state.focused = false;
  }

  return { isFocused: state.focused, reason: state.focused ? null : reason };
}

// ── Local-only builder (roll/tilt isn't needed by classify.test.ts, so it
// stays here rather than in the shared fixtures module) ────────────────

/** Head rolled (tilted) but otherwise identical to neutral. */
function headTiltedFrame(): Landmark[] {
  const tilt = { dx: -0.03, dy: 0.02 }; // shift the "left" eye-corner pivot down-left
  return withOverrides({
    ...NEUTRAL_OVERRIDES,
    263: { x: 0.65 + tilt.dx, y: 0.45 + tilt.dy, z: 0 },
  });
}

// ── Frame sequence + comparison harness ────────────────────────────────

type NamedFrame = { landmarks: Landmark[] | null; label: string };

function buildSequence(): NamedFrame[] {
  const seq: NamedFrame[] = [];
  const push = (n: number, f: () => Landmark[] | null, label: string) => {
    for (let i = 0; i < n; i++) seq.push({ landmarks: f(), label });
  };

  push(70, neutralFrame, "neutral (past calibration)"); // clears CALIBRATION_FRAMES=60
  push(3, closedEyesFrame, "blink (brief, under grace period)");
  push(20, neutralFrame, "neutral after blink");
  push(50, closedEyesFrame, "sustained eyes closed (past grace period)");
  push(20, neutralFrame, "neutral after sustained closure");
  push(15, lookingAwayFrame, "looking away horizontally");
  push(20, neutralFrame, "neutral after looking away");
  push(15, lookingDownFrame, "looking down (phone)");
  push(20, neutralFrame, "neutral after looking down");
  push(15, headExtremeFrame, "head yaw extreme");
  push(20, neutralFrame, "neutral after head extreme");
  push(10, headTiltedFrame, "head tilted (roll)");
  push(10, () => null, "no face");
  push(10, neutralFrame, "neutral after no-face");

  return seq;
}

// eslint-disable-next-line jest/no-disabled-tests -- retired on purpose, see file header
describe.skip("Phase 0 golden master: classifyFrame matches pre-refactor logic (retired — see file header)", () => {
  it("produces an identical isFocused/reason sequence, frame by frame", () => {
    const sequence = buildSequence();

    const refState = refCreateState();
    let pureState = createInitialAttentionState();

    let tNowMs = 0;
    const dtMs = 33; // ~30fps

    const mismatches: string[] = [];

    sequence.forEach(({ landmarks, label }, i) => {
      tNowMs += dtMs;

      const refResult = referenceClassify(landmarks, tNowMs, refState);
      const pureResult = classifyFrame(landmarks, tNowMs, dtMs, pureState, DEFAULT_CONFIG);
      pureState = pureResult.state;

      if (
        refResult.isFocused !== pureResult.isFocused ||
        refResult.reason !== pureResult.reason
      ) {
        mismatches.push(
          `frame ${i} [${label}]: reference={isFocused:${refResult.isFocused},reason:${refResult.reason}} ` +
            `pure={isFocused:${pureResult.isFocused},reason:${pureResult.reason}}`
        );
      }
    });

    expect(mismatches).toEqual([]);
  });
});
