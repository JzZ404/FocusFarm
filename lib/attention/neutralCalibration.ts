/**
 * Neutral-pose calibration — Build Mandate Phase 2. Pure functions only
 * (no React/DOM/clock reads), same discipline as classify.ts: a short
 * "look at the center of your screen and hold still" capture produces
 * `{yaw0, pitch0, gazeX0, gazeY0, ear0, sigmas}`, which
 * lib/attention/classify.ts's DEFAULT_CONFIG's neutralYaw/neutralPitch/
 * neutralGazeX/neutralGazeY get populated from before a session starts.
 *
 * Two-part API:
 *   - `createCalibrationSampler()` / `addSample()` / `finalizeCalibration()`
 *     — accumulate RawSignals frames (see classify.ts's computeRawSignals)
 *     over a capture window, compute mean + stddev per axis, and either
 *     succeed or ask for a retry if the person moved too much to trust the
 *     result (see NEUTRAL_CALIB_MAX_SIGMA below).
 *   - `applyCalibrationToConfig()` — merges a NeutralCalibration into an
 *     AttentionConfig's neutral* fields. Used identically by the live hook
 *     (merge with DEFAULT_CONFIG at session start) and by
 *     scripts/fitCalibration.ts (build a per-fixture calibrated config for
 *     replay, since real fixtures predate this phase and never ran a real
 *     onboarding capture — see that script for how it derives a synthetic
 *     baseline from each fixture's own "focused" segment).
 */
import type { AttentionConfig, RawSignals } from "./classify";

export const NEUTRAL_CALIB_DURATION_MS = 3000; // "hold still for 3 seconds"

/** Reject/retry threshold: if a signal's stddev over the capture window
 * exceeds this, the person moved too much during calibration to trust the
 * mean as their resting neutral pose. One shared threshold across
 * yaw/pitch/gazeX/gazeY.
 *
 * First guess here was 0.06 (pure heuristic, no data behind it) — measured
 * against real fixture data via scripts/fitCalibration.ts's
 * `DEBUG_CALIB=1` output (see docs/attention-baseline.md's Phase 2
 * section), natural "focused" behavior's yaw sigma alone came in around
 * 0.077-0.086, comfortably failing that guess, while pitch/gazeX/gazeY all
 * stayed under 0.03. 0.10 gives headroom above the observed yaw worst case
 * while still catching someone clearly moving around (the "too much
 * movement" unit test in neutralCalibration.test.ts uses 0.5, an order of
 * magnitude past any reasonable threshold, to stay meaningful regardless
 * of where exactly this constant lands).
 *
 * That measurement came from fixtures recorded as natural "act focused"
 * behavior, not a deliberate "hold still, look at the center of the
 * screen" task — the real onboarding capture asks for the latter, which
 * should measure *tighter* than this in practice. This constant is
 * deliberately on the permissive side until real onboarding attempts (not
 * a fixture-derived proxy) are observed — see the Build Mandate memory. */
export const NEUTRAL_CALIB_MAX_SIGMA = 0.1;

/** Minimum samples before finalizing — guards against a near-empty window
 * (e.g. the face dropped out for almost the whole capture) producing a
 * mean/stddev off just one or two frames. */
const NEUTRAL_CALIB_MIN_SAMPLES = 10;

export interface NeutralCalibration {
  yaw0: number;
  pitch0: number;
  gazeX0: number;
  gazeY0: number;
  ear0: number;
  sigmas: { yaw: number; pitch: number; gazeX: number; gazeY: number };
  calibratedAtMs: number;
}

/** Running sum/sum-of-squares per axis — avoids storing every sample just
 * to compute mean/stddev at the end (Welford-style would be marginally
 * more numerically stable, but a 3-second capture at video framerate is at
 * most a few hundred samples; the naive sum-of-squares formula is more
 * than accurate enough at that scale and much simpler to read). */
export interface CalibrationSampler {
  count: number;
  sums: { yaw: number; pitch: number; gazeX: number; gazeY: number; ear: number };
  sumSquares: { yaw: number; pitch: number; gazeX: number; gazeY: number };
}

export function createCalibrationSampler(): CalibrationSampler {
  return {
    count: 0,
    sums: { yaw: 0, pitch: 0, gazeX: 0, gazeY: 0, ear: 0 },
    sumSquares: { yaw: 0, pitch: 0, gazeX: 0, gazeY: 0 },
  };
}

/** Returns a new sampler with `signals` folded in — never mutates. Skips
 * frames with eyes closed (a blink mid-calibration shouldn't drag gazeX/Y
 * toward 0, the eyesClosed placeholder value — same reasoning classify.ts
 * already applies to its own EAR baseline calibration) and frames with no
 * face at all (caller passes null landmarks through as "no sample this
 * frame", not by calling this — see useNeutralCalibration). */
export function addSample(
  sampler: CalibrationSampler,
  signals: RawSignals
): CalibrationSampler {
  if (signals.eyesClosed) return sampler;
  const { yaw, pitch, gazeX, gazeY, ear } = signals;
  return {
    count: sampler.count + 1,
    sums: {
      yaw: sampler.sums.yaw + yaw,
      pitch: sampler.sums.pitch + pitch,
      gazeX: sampler.sums.gazeX + gazeX,
      gazeY: sampler.sums.gazeY + gazeY,
      ear: sampler.sums.ear + ear,
    },
    sumSquares: {
      yaw: sampler.sumSquares.yaw + yaw * yaw,
      pitch: sampler.sumSquares.pitch + pitch * pitch,
      gazeX: sampler.sumSquares.gazeX + gazeX * gazeX,
      gazeY: sampler.sumSquares.gazeY + gazeY * gazeY,
    },
  };
}

function meanAndSigma(sum: number, sumSq: number, n: number): { mean: number; sigma: number } {
  const mean = sum / n;
  // variance = E[x^2] - E[x]^2; clamp at 0 against float rounding when the
  // true variance is ~0 (a genuinely dead-still capture).
  const variance = Math.max(0, sumSq / n - mean * mean);
  return { mean, sigma: Math.sqrt(variance) };
}

export type FinalizeResult =
  | { status: "ok"; calibration: NeutralCalibration }
  | { status: "retry"; reason: string };

/** Ends a calibration attempt. `tNowMs` is stamped onto a successful
 * result as `calibratedAtMs` (caller's clock — this module stays pure, no
 * ambient time read). */
export function finalizeCalibration(
  sampler: CalibrationSampler,
  tNowMs: number
): FinalizeResult {
  if (sampler.count < NEUTRAL_CALIB_MIN_SAMPLES) {
    return { status: "retry", reason: "not enough face-visible samples — stay in frame with eyes open" };
  }

  const yaw = meanAndSigma(sampler.sums.yaw, sampler.sumSquares.yaw, sampler.count);
  const pitch = meanAndSigma(sampler.sums.pitch, sampler.sumSquares.pitch, sampler.count);
  const gazeX = meanAndSigma(sampler.sums.gazeX, sampler.sumSquares.gazeX, sampler.count);
  const gazeY = meanAndSigma(sampler.sums.gazeY, sampler.sumSquares.gazeY, sampler.count);
  const ear0 = sampler.sums.ear / sampler.count;

  const sigmas = { yaw: yaw.sigma, pitch: pitch.sigma, gazeX: gazeX.sigma, gazeY: gazeY.sigma };
  const worstSigma = Math.max(sigmas.yaw, sigmas.pitch, sigmas.gazeX, sigmas.gazeY);
  if (worstSigma > NEUTRAL_CALIB_MAX_SIGMA) {
    return { status: "retry", reason: "held still too little — try to keep your head steady" };
  }

  return {
    status: "ok",
    calibration: {
      yaw0: yaw.mean,
      pitch0: pitch.mean,
      gazeX0: gazeX.mean,
      gazeY0: gazeY.mean,
      ear0,
      sigmas,
      calibratedAtMs: tNowMs,
    },
  };
}

/** Merges a calibration (or its absence) into a config's neutral* fields.
 * `calibration: null` returns `config` unchanged — the same "0 offsets"
 * default DEFAULT_CONFIG already ships with, so an uncalibrated session
 * behaves exactly like Phase 1. */
export function applyCalibrationToConfig(
  config: AttentionConfig,
  calibration: NeutralCalibration | null
): AttentionConfig {
  if (!calibration) return config;
  return {
    ...config,
    neutralYaw: calibration.yaw0,
    neutralPitch: calibration.pitch0,
    neutralGazeX: calibration.gazeX0,
    neutralGazeY: calibration.gazeY0,
  };
}
