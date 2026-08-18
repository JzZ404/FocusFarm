/**
 * Shared by scripts/metrics.ts and scripts/fitCalibration.ts: derives a
 * per-fixture neutral-pose calibration baseline from the first ~3s of a
 * fixture's first "focused"-labeled segment, standing in for the real
 * onboarding capture (see lib/attention/neutralCalibration.ts) — every
 * fixture in fixtures/attention/ predates Phase 2 and never ran an actual
 * one. Exists as its own module (not inlined in either script) so both
 * always derive calibration identically; metrics.ts needs this too, not
 * just the fitting script, because DEFAULT_CONFIG's ellipse radii are now
 * fit assuming calibration IS applied (see classify.ts's DEFAULT_CONFIG
 * comment) — replaying uncalibrated would silently misrepresent real
 * usage, which always calibrates first.
 */
import { toClassifierLandmarks, type FixtureFile } from "./replay";
import { DEFAULT_CONFIG, computeRawSignals } from "../lib/attention/classify";
import {
  createCalibrationSampler,
  addSample,
  finalizeCalibration,
  NEUTRAL_CALIB_DURATION_MS,
  type NeutralCalibration,
} from "../lib/attention/neutralCalibration";

export function deriveNeutralCalibration(fixture: FixtureFile): NeutralCalibration | null {
  const sortedMarkers = [...fixture.label_markers].sort((a, b) => a.t - b.t);
  const firstFocused = sortedMarkers.find((m) => m.label === "focused");
  if (!firstFocused) return null;
  const windowStart = firstFocused.t;
  const windowEnd = windowStart + NEUTRAL_CALIB_DURATION_MS;

  let sampler = createCalibrationSampler();
  for (const frame of fixture.frames) {
    if (frame.t < windowStart) continue;
    if (frame.t >= windowEnd) break; // frames are time-ordered
    const landmarks = toClassifierLandmarks(frame.landmarks);
    if (!landmarks) continue;
    const raw = computeRawSignals(landmarks, DEFAULT_CONFIG.earClosedThresholdDefault);
    sampler = addSample(sampler, raw);
  }
  const result = finalizeCalibration(sampler, windowEnd);
  return result.status === "ok" ? result.calibration : null;
}
