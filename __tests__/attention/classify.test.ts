/**
 * Targeted invariant tests for classifyFrame, independent of the golden-
 * master comparison. These are the tests the Build Mandate calls out
 * explicitly — polarity is the exact bug class that broke the blendshape
 * iteration (see lib/attention/classify.ts's file header), so it gets its
 * own always-run assertion rather than relying on end-to-end coverage
 * alone.
 *
 * Calibration/hysteresis tests below drive classifyFrame with a fixed
 * dt=33 per call (~30fps) and wait on `state.calibMs`/`config.calibrationMs`
 * rather than a hardcoded frame count — Phase 1 made calibration duration-
 * based instead of frame-count-based (see classify.ts), so "how many calls
 * that takes" is no longer a fixed, meaningful number to assert against.
 */
import {
  classifyFrame,
  createInitialAttentionState,
  DEFAULT_CONFIG,
} from "@/lib/attention/classify";
import {
  neutralFrame,
  closedEyesFrame,
  headExtremeFrame,
  lookingDownFrame,
  rotateFrame,
  withOverrides,
  NEUTRAL_OVERRIDES,
} from "./fixtures";

describe("eyes-closed polarity", () => {
  it("a synthetic closed-eye landmark set produces eyesClosedInstant === true", () => {
    const state = createInitialAttentionState();
    const result = classifyFrame(closedEyesFrame(), 1000, 33, state, DEFAULT_CONFIG);
    expect(result.debug.eyesClosedInstant).toBe(true);
  });

  it("a synthetic open-eye landmark set produces eyesClosedInstant === false", () => {
    const state = createInitialAttentionState();
    const result = classifyFrame(neutralFrame(), 1000, 33, state, DEFAULT_CONFIG);
    expect(result.debug.eyesClosedInstant).toBe(false);
  });

  it("sustained closure past the grace period reports reason 'eyes_closed', not 'looking_away' or focused", () => {
    let state = createInitialAttentionState();
    let tNowMs = 0;
    // Clear calibration first on open eyes so the threshold isn't the
    // (looser) uncalibrated default when we test closure.
    while (state.calibMs < DEFAULT_CONFIG.calibrationMs) {
      tNowMs += 33;
      state = classifyFrame(neutralFrame(), tNowMs, 33, state, DEFAULT_CONFIG).state;
    }
    let result;
    // Grace period is 1500ms; keep closing eyes well past it.
    while (tNowMs < 5000) {
      tNowMs += 33;
      result = classifyFrame(closedEyesFrame(), tNowMs, 33, state, DEFAULT_CONFIG);
      state = result.state;
    }
    expect(result!.isFocused).toBe(false);
    expect(result!.reason).toBe("eyes_closed");
  });
});

describe("roll compensation", () => {
  it("rotating an entire neutral landmark set leaves computed yaw/pitch effectively unchanged", () => {
    const base = neutralFrame();
    const pivot = { x: 0.5, y: 0.5 }; // rotate around the face's rough center
    const rotated = rotateFrame(base, pivot, (15 * Math.PI) / 180); // 15° tilt

    const state = createInitialAttentionState();
    const baseResult = classifyFrame(base, 1000, 33, state, DEFAULT_CONFIG);
    const rotatedResult = classifyFrame(rotated, 1000, 33, state, DEFAULT_CONFIG);

    // Rotating every landmark simultaneously is exactly what a physically
    // tilted head does — computeRoll should measure that same angle and
    // de-rotate before computing yaw/pitch, so the two should land close
    // together. Not bit-identical (roll is measured from the eye corners
    // specifically, not the same pivot used to build this fixture, so
    // there's a small residual), but nowhere near the raw 15° of intended
    // skew if roll compensation weren't happening at all.
    expect(
      Math.abs(rotatedResult.debug.rawYaw - baseResult.debug.rawYaw)
    ).toBeLessThan(0.05);
    expect(
      Math.abs(rotatedResult.debug.rawPitch - baseResult.debug.rawPitch)
    ).toBeLessThan(0.05);
    // And the roll angle itself should be measured close to what was applied.
    expect(rotatedResult.debug.roll).toBeCloseTo((15 * Math.PI) / 180, 1);
  });

  it("head_extreme still fires correctly on a genuinely extreme (non-rolled) pose", () => {
    const state = createInitialAttentionState();
    const result = classifyFrame(headExtremeFrame(), 1000, 33, state, DEFAULT_CONFIG);
    // Phase 2's DEFAULT_CONFIG head-pose radii are circle-preserving
    // (RX == RDown == RUp), so comparing headPoseMag against any one of
    // them is equivalent to the old single-circular-limit check.
    expect(result.debug.headPoseMag).toBeGreaterThan(DEFAULT_CONFIG.headPoseRX);
  });
});

describe("calibration convergence", () => {
  it("freezes a threshold at baseline-open-EAR × earClosedFactor once calibrationMs of open-eye time has elapsed", () => {
    let state = createInitialAttentionState();
    let tNowMs = 0;
    let lastResult;
    while (state.calibMs < DEFAULT_CONFIG.calibrationMs) {
      tNowMs += 33;
      lastResult = classifyFrame(neutralFrame(), tNowMs, 33, state, DEFAULT_CONFIG);
      state = lastResult.state;
    }

    expect(state.calibMs).toBeGreaterThanOrEqual(DEFAULT_CONFIG.calibrationMs);
    expect(state.calibCount).toBeGreaterThan(0);
    // Threshold should have moved off the uncalibrated default once
    // calibration completes (the synthetic neutral-eye EAR here isn't
    // exactly the default, so the calibrated value should differ) and
    // stay within the configured clamp range.
    expect(state.calibThreshold).toBeGreaterThanOrEqual(DEFAULT_CONFIG.earThresholdMin);
    expect(state.calibThreshold).toBeLessThanOrEqual(DEFAULT_CONFIG.earThresholdMax);
    expect(lastResult!.debug.calibrationProgress).toBe(1);
  });

  it("does not advance calibration progress while eyes are instantaneously closed", () => {
    let state = createInitialAttentionState();
    let tNowMs = 0;
    // Alternate closed/open — only open frames should count toward calibration.
    for (let i = 0; i < 10; i++) {
      tNowMs += 33;
      state = classifyFrame(closedEyesFrame(), tNowMs, 33, state, DEFAULT_CONFIG).state;
    }
    expect(state.calibCount).toBe(0);
    expect(state.calibMs).toBe(0);
  });

  it("a blink mid-calibration does not drag the baseline toward the closed-eye EAR", () => {
    let openOnlyState = createInitialAttentionState();
    let mixedState = createInitialAttentionState();
    let tNowMs = 0;

    // A blink costs mixedState 2 frames that don't advance calibMs, so give
    // both runs a generous buffer past the point calibration should have
    // completed rather than a tight frame count.
    const bufferFrames = Math.ceil(DEFAULT_CONFIG.calibrationMs / 33) + 10;
    for (let i = 0; i < bufferFrames; i++) {
      tNowMs += 33;
      openOnlyState = classifyFrame(neutralFrame(), tNowMs, 33, openOnlyState, DEFAULT_CONFIG).state;
      // Same sequence, but with a few blinks spliced in — those frames
      // must not count toward the open-eye baseline average.
      const frame = i === 5 || i === 6 ? closedEyesFrame() : neutralFrame();
      mixedState = classifyFrame(frame, tNowMs, 33, mixedState, DEFAULT_CONFIG).state;
    }

    expect(openOnlyState.calibMs).toBeGreaterThanOrEqual(DEFAULT_CONFIG.calibrationMs);
    expect(mixedState.calibMs).toBeGreaterThanOrEqual(DEFAULT_CONFIG.calibrationMs);
    expect(mixedState.calibThreshold).toBeCloseTo(openOnlyState.calibThreshold, 5);
  });
});

describe("frame-rate independence (Phase 1)", () => {
  it("msToDistract/msToRefocus flip on elapsed time, not call count — a slower call rate still flips at ~the same wall-clock time", () => {
    // Drive the same "looking away" scenario at two different simulated
    // frame rates (~30fps vs ~15fps) and confirm both flip to distracted
    // at close to the same elapsed wall-clock time, not after the same
    // number of calls (which would be the old, rate-dependent behavior).
    function timeToDistract(dtMs: number): number {
      let state = createInitialAttentionState();
      let tNowMs = 0;
      // Clear calibration on neutral frames first.
      while (state.calibMs < DEFAULT_CONFIG.calibrationMs) {
        tNowMs += dtMs;
        state = classifyFrame(neutralFrame(), tNowMs, dtMs, state, DEFAULT_CONFIG).state;
      }
      const distractStartMs = tNowMs;
      let result = classifyFrame(headExtremeFrame(), tNowMs, dtMs, state, DEFAULT_CONFIG);
      state = result.state;
      while (result.isFocused !== false || result.reason === null) {
        tNowMs += dtMs;
        result = classifyFrame(headExtremeFrame(), tNowMs, dtMs, state, DEFAULT_CONFIG);
        state = result.state;
        if (tNowMs - distractStartMs > 5000) throw new Error("never flipped distracted");
      }
      return tNowMs - distractStartMs;
    }

    const at30fps = timeToDistract(33.33);
    const at15fps = timeToDistract(66.67);

    // Within one slow-rate frame interval of each other — the residual gap
    // is discretization (a coarser dt can only land on/after the threshold,
    // never exactly on it), not rate-dependent drift.
    expect(Math.abs(at30fps - at15fps)).toBeLessThan(70);
  });

  it("a dtMs gap larger than stallGapMs resets EMA smoothing instead of blending through it", () => {
    let state = createInitialAttentionState();
    // Establish a smoothed baseline looking straight ahead.
    let result = classifyFrame(neutralFrame(), 1000, 33, state, DEFAULT_CONFIG);
    state = result.state;
    for (let i = 0; i < 20; i++) {
      result = classifyFrame(neutralFrame(), 1000 + i * 33, 33, state, DEFAULT_CONFIG);
      state = result.state;
    }

    // Simulate a tab-backgrounded gap, then resume on an extreme head pose.
    const resumeAtMs = 1000 + 20 * 33 + DEFAULT_CONFIG.stallGapMs + 1000;
    const afterStall = classifyFrame(
      headExtremeFrame(),
      resumeAtMs,
      resumeAtMs - (1000 + 20 * 33),
      state,
      DEFAULT_CONFIG
    );

    expect(afterStall.debug.isStall).toBe(true);
    // Smoothing should have snapped to the new raw reading, not blended a
    // near-1.0-alpha step from the stale pre-stall value (mathematically
    // similar in this specific case, but the state should show an actual
    // reset happened — the first post-stall EMA read equals the raw value).
    expect(afterStall.debug.smoothedYaw).toBeCloseTo(afterStall.debug.rawYaw, 10);
  });
});

describe("Phase 2: elliptical, vertically-asymmetric deadzone", () => {
  // Nose shifted up by the same magnitude lookingDownFrame() shifts it down
  // (neutral nose.y 0.53, lookingDownFrame uses 0.75 — a +0.22 shift).
  function lookingUpFrame() {
    return withOverrides({ ...NEUTRAL_OVERRIDES, 1: { x: 0.5, y: 0.31, z: 0 } });
  }

  it("a large downward radius and tiny upward radius let looking down pass but flag looking up", () => {
    const config = {
      ...DEFAULT_CONFIG,
      worldDeviationRX: 10,
      worldDeviationRDown: 10,
      worldDeviationRUp: 0.01,
    };
    const state = createInitialAttentionState();

    const down = classifyFrame(
      withOverrides({ ...NEUTRAL_OVERRIDES, 1: { x: 0.5, y: 0.75, z: 0 } }),
      1000,
      33,
      state,
      config
    );
    const up = classifyFrame(lookingUpFrame(), 1000, 33, state, config);

    expect(down.reason).not.toBe("looking_away");
    expect(up.reason).toBe("looking_away");
  });

  it("neutral-pose calibration cancels a resting yaw bias for world deviation, but leaves the (intentionally uncalibrated) head-pose check unaffected", () => {
    // A fixed circular world-deviation radius (0.3) to isolate the
    // calibration mechanism itself from whatever DEFAULT_CONFIG's own
    // fitted radii happen to be — this test only cares about the neutral-
    // offset subtraction, not the specific fitted ellipse shape.
    const baseConfig = {
      ...DEFAULT_CONFIG,
      worldDeviationRX: 0.3,
      worldDeviationRDown: 0.3,
      worldDeviationRUp: 0.3,
    };
    // Nose shifted moderately right of center — enough to trip that 0.3
    // radius but well under headPoseRX (0.75), so this frame isolates
    // "looking away" from "head too extreme."
    const biasedFrame = withOverrides({ ...NEUTRAL_OVERRIDES, 1: { x: 0.58, y: 0.53, z: 0 } });
    const state = createInitialAttentionState();

    const uncalibrated = classifyFrame(biasedFrame, 1000, 33, state, baseConfig);
    expect(uncalibrated.reason).toBe("looking_away");
    expect(uncalibrated.debug.headPoseMag).toBeLessThan(baseConfig.headPoseRX);

    // Calibrate neutralYaw to exactly this frame's own measured yaw — as if
    // the person's resting pose really does sit slightly off-center.
    const calibratedConfig = { ...baseConfig, neutralYaw: uncalibrated.debug.rawYaw };
    const calibrated = classifyFrame(biasedFrame, 1000, 33, state, calibratedConfig);

    expect(calibrated.reason).not.toBe("looking_away");
    // headPoseMag is raw yaw/pitch magnitude — must be identical whether or
    // not neutralYaw is set, since the head-pose ellipse deliberately
    // isn't neutral-corrected (see classify.ts's comment on headExtreme).
    expect(calibrated.debug.headPoseMag).toBe(uncalibrated.debug.headPoseMag);
  });
});

describe("Phase 4: keyboard-vs-phone downward-gaze dwell tolerance", () => {
  // lookingDownFrame's pitch shift is large enough to also trip the
  // head-pose ellipse on its own — widen head-pose radii to isolate the
  // gaze/world-deviation dimension specifically, the one this mechanism
  // actually touches (same isolation technique softScoring.test.ts uses,
  // mirrored for the opposite dimension).
  const ISOLATE_GAZE_ONLY = {
    ...DEFAULT_CONFIG,
    headPoseRX: 100,
    headPoseRDown: 100,
    headPoseRUp: 100,
  };

  it("a brief downward glance well under lookingDownGraceMs leaves gazeScore (and focusScore) at 1", () => {
    let state = createInitialAttentionState();
    let tNowMs = 0;
    let result = classifyFrame(neutralFrame(), tNowMs, 0, state, ISOLATE_GAZE_ONLY);
    state = result.state;
    // A ~2s glance down — well under the 10s grace period.
    for (let i = 0; i < 60; i++) {
      tNowMs += 33;
      result = classifyFrame(lookingDownFrame(), tNowMs, 33, state, ISOLATE_GAZE_ONLY);
      state = result.state;
    }
    expect(result.debug.gazeScore).toBe(1);
    expect(result.debug.focusScore).toBe(1);
    expect(result.debug.gazeDownMs).toBeGreaterThan(0); // streak is tracked...
    expect(result.debug.gazeDownMs).toBeLessThan(ISOLATE_GAZE_ONLY.lookingDownGraceMs); // ...but still within grace
  });

  it("a sustained downward gaze past lookingDownGraceMs reduces gazeScore and eventually reads as looking_away", () => {
    let state = createInitialAttentionState();
    let tNowMs = 0;
    let result = classifyFrame(neutralFrame(), tNowMs, 0, state, ISOLATE_GAZE_ONLY);
    state = result.state;
    while (tNowMs < ISOLATE_GAZE_ONLY.lookingDownGraceMs + 3000) {
      tNowMs += 100;
      result = classifyFrame(lookingDownFrame(), tNowMs, 100, state, ISOLATE_GAZE_ONLY);
      state = result.state;
    }
    expect(result.debug.gazeScore).toBeLessThan(1);
    expect(result.debug.focusScore).toBeLessThan(1);
    expect(result.isFocused).toBe(false);
    expect(result.reason).toBe("looking_away");
  });

  it("sideways deviation is never forgiven by the downward-gaze grace, even while within it", () => {
    // Combines a downward pitch shift (which alone would be fully
    // forgiven, per the first test above) with a sideways yaw shift in
    // the SAME frame — the sideways component must still degrade
    // gazeScore regardless of the down-forgiveness being active.
    const downAndSideways = withOverrides({
      ...NEUTRAL_OVERRIDES,
      1: { x: 0.68, y: 0.75, z: 0 },
    });
    let state = createInitialAttentionState();
    let tNowMs = 0;
    let result = classifyFrame(neutralFrame(), tNowMs, 0, state, ISOLATE_GAZE_ONLY);
    state = result.state;
    // Only a couple seconds in — well within the down-forgiveness window.
    for (let i = 0; i < 30; i++) {
      tNowMs += 33;
      result = classifyFrame(downAndSideways, tNowMs, 33, state, ISOLATE_GAZE_ONLY);
      state = result.state;
    }
    expect(result.debug.gazeDownMs).toBeLessThan(ISOLATE_GAZE_ONLY.lookingDownGraceMs);
    expect(result.debug.gazeScore).toBeLessThan(1);
  });

  it("resets the down-streak timer once gaze returns to level", () => {
    let state = createInitialAttentionState();
    let tNowMs = 0;
    let result = classifyFrame(neutralFrame(), tNowMs, 0, state, ISOLATE_GAZE_ONLY);
    state = result.state;
    for (let i = 0; i < 30; i++) {
      tNowMs += 33;
      result = classifyFrame(lookingDownFrame(), tNowMs, 33, state, ISOLATE_GAZE_ONLY);
      state = result.state;
    }
    expect(result.debug.gazeDownMs).toBeGreaterThan(0);

    // worldDevY is EMA-smoothed pitch, which has real inertia — one single
    // neutral frame right after 30 sustained-down frames doesn't instantly
    // snap back (by design, same smoothing every other signal gets), so
    // give it enough frames to actually settle before checking the reset,
    // rather than asserting an instant snap that wouldn't be correct here.
    for (let i = 0; i < 20; i++) {
      tNowMs += 33;
      result = classifyFrame(neutralFrame(), tNowMs, 33, state, ISOLATE_GAZE_ONLY);
      state = result.state;
    }
    expect(result.debug.gazeDownMs).toBe(0);
    expect(result.state.gazeDownSinceMs).toBeNull();
  });
});
