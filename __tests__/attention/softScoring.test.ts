/**
 * Build Mandate Phase 3: continuous focusScore + Schmitt trigger + min
 * dwell + no-face grace. classify.test.ts's existing suites already cover
 * a lot of this incidentally (their assertions still held after this
 * phase's rewrite — traced by hand, not just observed passing, since
 * every segment in those scenarios is long enough that minDwellMs was
 * never the binding constraint). This file targets the mechanisms that
 * needed dedicated, isolated coverage: nothing existing exercised the
 * dwell gate, the Schmitt dead zone, or the no-face grace period directly.
 */
import {
  classifyFrame,
  createInitialAttentionState,
  DEFAULT_CONFIG,
  type AttentionState,
} from "@/lib/attention/classify";
import {
  neutralFrame,
  closedEyesFrame,
  headExtremeFrame,
  withOverrides,
  NEUTRAL_OVERRIDES,
} from "./fixtures";

// worldDevX includes the SAME emaYaw headScore's ellipse distance uses
// (uncalibrated by default, neutralYaw=0) — a pure yaw perturbation always
// shows up in both head and gaze distance, just scaled by different radii.
// Tests below that want to isolate "only head is off" neutralize the gaze
// dimension with very wide worldDeviation radii instead of relying on
// headExtremeFrame() to only affect one dimension, which it doesn't.
const ISOLATE_HEAD_ONLY = {
  ...DEFAULT_CONFIG,
  worldDeviationRX: 100,
  worldDeviationRDown: 100,
  worldDeviationRUp: 100,
};

describe("focusScore combination", () => {
  it("is the min of the three sub-scores, not an average", () => {
    const state = createInitialAttentionState();
    const result = classifyFrame(headExtremeFrame(), 1000, 33, state, ISOLATE_HEAD_ONLY);
    expect(result.debug.eyeScore).toBe(1);
    expect(result.debug.gazeScore).toBe(1);
    expect(result.debug.headScore).toBeLessThan(1);
    expect(result.debug.focusScore).toBe(result.debug.headScore);
    // Not an average — min() with two scores at 1 equals the third score
    // exactly, an average would be pulled up toward 1.
    expect(result.debug.focusScore).not.toBeCloseTo(
      (result.debug.eyeScore + result.debug.headScore + result.debug.gazeScore) / 3,
      2
    );
  });

  it("a brief blink well under the grace period leaves eyeScore (and therefore focusScore) at 1 — no reward impact", () => {
    let state = createInitialAttentionState();
    let tNowMs = 0;
    let result = classifyFrame(neutralFrame(), tNowMs, 0, state, DEFAULT_CONFIG);
    state = result.state;
    // A ~300ms blink — well under softInnerFactor(0.8) × eyesClosedGraceMs(1500) = 1200ms.
    for (let i = 0; i < 9; i++) {
      tNowMs += 33;
      result = classifyFrame(closedEyesFrame(), tNowMs, 33, state, DEFAULT_CONFIG);
      state = result.state;
    }
    expect(result.debug.eyeScore).toBe(1);
    expect(result.debug.focusScore).toBe(1);
  });
});

describe("Schmitt trigger dead zone", () => {
  it("a focusScore strictly between schmittLow and schmittHigh never flips, no matter how long it's sustained", () => {
    // A precise, hand-solved yaw offset: with headPoseRX=0.75 (DEFAULT_CONFIG,
    // unmodified) and softInnerFactor/softOuterFactor=0.8/1.3, an ellipse
    // distance of 1.1 lands smoothFalloff at (1.3-1.1)/(1.3-0.8) = 0.4 —
    // squarely inside (schmittLow=0.35, schmittHigh=0.6). distance 1.1 at
    // radius 0.75 is yaw=0.825; the fixture's nose.x/faceWidth geometry
    // (see fixtures.ts's NEUTRAL_OVERRIDES) maps that to nose.x = 0.665.
    const midBandFrame = withOverrides({ ...NEUTRAL_OVERRIDES, 1: { x: 0.665, y: 0.53, z: 0 } });

    let state = createInitialAttentionState();
    let tNowMs = 0;
    let result = classifyFrame(midBandFrame, tNowMs, 0, state, ISOLATE_HEAD_ONLY);
    state = result.state;
    expect(result.debug.focusScore).toBeGreaterThan(DEFAULT_CONFIG.schmittLow);
    expect(result.debug.focusScore).toBeLessThan(DEFAULT_CONFIG.schmittHigh);

    for (let i = 0; i < 200; i++) {
      tNowMs += 33;
      result = classifyFrame(midBandFrame, tNowMs, 33, state, ISOLATE_HEAD_ONLY);
      state = result.state;
    }
    // Nearly 7 seconds sustained in the dead zone — still never flipped
    // away from the initial (uncalibrated default) focused=false state,
    // proving the dead zone structurally blocks flips rather than just
    // delaying them.
    expect(result.isFocused).toBe(false);
    expect(state.belowLowSinceMs).toBeNull();
    expect(state.aboveHighSinceMs).toBeNull();
  });
});

describe("minimum dwell time", () => {
  it("blocks a flip within minDwellMs of the previous one even once the sustained-streak threshold is met", () => {
    const flipAtMs = 1000;
    let state: AttentionState = {
      ...createInitialAttentionState(),
      focused: true,
      lastFlipMs: flipAtMs,
      calibThreshold: DEFAULT_CONFIG.earClosedThresholdDefault,
    };

    let tNowMs = flipAtMs;
    let result;
    const justUnderDwellMs = flipAtMs + DEFAULT_CONFIG.minDwellMs - 50;
    while (tNowMs < justUnderDwellMs) {
      tNowMs += 33;
      result = classifyFrame(headExtremeFrame(), tNowMs, 33, state, DEFAULT_CONFIG);
      state = result.state;
    }
    // msToDistract (~167ms) has been satisfied several times over by now
    // (the bad streak started right after flipAtMs), but minDwellMs
    // (600ms since flipAtMs) hasn't — must still read focused.
    expect(result!.isFocused).toBe(true);

    while (tNowMs < flipAtMs + DEFAULT_CONFIG.minDwellMs + 500) {
      tNowMs += 33;
      result = classifyFrame(headExtremeFrame(), tNowMs, 33, state, DEFAULT_CONFIG);
      state = result.state;
    }
    // Now well past the dwell gate too, still distracted the whole time —
    // must have flipped.
    expect(result!.isFocused).toBe(false);
  });
});

describe("no-face grace period", () => {
  it("holds the binary state through the grace period but reports focusScore 0 immediately, then flips distracted once the grace period elapses", () => {
    let state: AttentionState = { ...createInitialAttentionState(), focused: true };
    let tNowMs = 1000;

    let result = classifyFrame(null, tNowMs, 0, state, DEFAULT_CONFIG);
    state = result.state;
    expect(result.isFocused).toBe(true); // held, not flipped yet
    expect(result.focusScore).toBe(0); // but zero credit immediately
    expect(result.reason).toBeNull(); // held state shows no reason either

    // Small per-call dt steps — a big single jump would exceed
    // stallGapMs and trip the stall guard, which resets the no-face
    // streak anchor (correctly, for a real backgrounded-tab gap) and
    // isn't what this test is isolating.
    const graceStartMs = tNowMs;
    while (tNowMs < graceStartMs + DEFAULT_CONFIG.noFaceGraceMs - 100) {
      tNowMs += 33;
      result = classifyFrame(null, tNowMs, 33, state, DEFAULT_CONFIG);
      state = result.state;
    }
    expect(result.isFocused).toBe(true);
    expect(result.focusScore).toBe(0);

    while (tNowMs < graceStartMs + DEFAULT_CONFIG.noFaceGraceMs + 200) {
      tNowMs += 33;
      result = classifyFrame(null, tNowMs, 33, state, DEFAULT_CONFIG);
      state = result.state;
    }
    expect(result.isFocused).toBe(false);
    expect(result.reason).toBe("no_face");
    expect(result.focusScore).toBe(0);
  });
});
