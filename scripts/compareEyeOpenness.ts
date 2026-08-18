#!/usr/bin/env tsx
/**
 * Build Mandate Phase 4a: "iris-diameter normalized eye-openness as a
 * shadow signal... promote only if it beats calibrated EAR in replay."
 * This is that comparison — run via `npm run attention:compare-eyes`.
 *
 * Both signals get the SAME treatment: a session-calibrated baseline
 * (mean over the first ~2s of open-eye time in the first "focused"
 * segment — a clean, label-derived stand-in for what live calibration
 * does, same trick deriveNeutralCalibration.ts uses) times the same
 * `earClosedFactor`, then compared against the `eyes_closed` ground-truth
 * label specifically. `eyes_closed` is the clean test case — Phase 4's
 * own investigation (see docs/attention-phase-log.md) found that
 * eyes-closed reads during `phone` frames likely reflect genuine
 * squinting, not classifier error, so that label isn't a clean measure
 * of which raw signal is more ACCURATE, only `eyes_closed` and `focused`
 * (real closure vs. real openness) are.
 */
import fs from "node:fs";
import path from "node:path";
import { loadFixture, toClassifierLandmarks } from "./replay";
import { trustedLabelAt, LABEL_BOUNDARY_TRIM_MS } from "./metrics";
import { computeIrisNormalizedOpenness, DEFAULT_CONFIG } from "../lib/attention/classify";
import type { Landmark } from "../lib/attention/classify";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/attention");
const CALIBRATION_WINDOW_MS = DEFAULT_CONFIG.calibrationMs;

// Reuse the same private-ish EAR computation classify.ts uses, duplicated
// here rather than exported solely for this script — computeEAR itself
// isn't part of classify.ts's public surface (only computeRawSignals and
// computeIrisNormalizedOpenness are), and this script needs the raw
// value, not the full RawSignals bundle.
const RIGHT_EYE_EAR = [33, 160, 158, 133, 153, 144];
const LEFT_EYE_EAR = [362, 385, 387, 263, 373, 380];
function dist2D(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function computeEAR(landmarks: Landmark[], indices: number[]): number {
  const [p1, p2, p3, p4, p5, p6] = indices.map((i) => landmarks[i]);
  const vertical = (dist2D(p2, p6) + dist2D(p3, p5)) / 2;
  const horizontal = dist2D(p1, p4);
  return horizontal > 0 ? vertical / horizontal : 0;
}
function rawEar(landmarks: Landmark[]): number {
  return (computeEAR(landmarks, LEFT_EYE_EAR) + computeEAR(landmarks, RIGHT_EYE_EAR)) / 2;
}

interface Sample {
  t: number;
  label: string;
  ear: number;
  iris: number;
}

function loadSamples(file: string): Sample[] {
  const fixture = loadFixture(path.join(FIXTURES_DIR, file));
  const markers = [...fixture.label_markers].sort((a, b) => a.t - b.t);
  const samples: Sample[] = [];
  for (const frame of fixture.frames) {
    const label = trustedLabelAt(markers, frame.t, LABEL_BOUNDARY_TRIM_MS);
    if (label === null) continue;
    const landmarks = toClassifierLandmarks(frame.landmarks);
    if (!landmarks) continue;
    samples.push({
      t: frame.t,
      label,
      ear: rawEar(landmarks),
      iris: computeIrisNormalizedOpenness(landmarks).mean,
    });
  }
  return samples;
}

/** Baseline = mean of the signal over the first CALIBRATION_WINDOW_MS of
 * the first "focused"-labeled segment — mirrors deriveNeutralCalibration's
 * bootstrapping trick, applied to whichever raw signal is passed in. */
function deriveBaseline(samples: Sample[], pick: (s: Sample) => number): number | null {
  const firstFocused = samples.find((s) => s.label === "focused");
  if (!firstFocused) return null;
  const windowEnd = firstFocused.t + CALIBRATION_WINDOW_MS;
  const windowSamples = samples.filter(
    (s) => s.label === "focused" && s.t >= firstFocused.t && s.t < windowEnd
  );
  if (windowSamples.length === 0) return null;
  return windowSamples.reduce((sum, s) => sum + pick(s), 0) / windowSamples.length;
}

interface Rates {
  closedRecall: number; // % of eyes_closed-labeled frames correctly read as closed
  focusedFalsePositive: number; // % of focused-labeled frames wrongly read as closed
}

function evaluate(samples: Sample[], pick: (s: Sample) => number, threshold: number): Rates {
  const closedLabeled = samples.filter((s) => s.label === "eyes_closed");
  const focusedLabeled = samples.filter((s) => s.label === "focused");
  const closedHits = closedLabeled.filter((s) => pick(s) < threshold).length;
  const focusedFalseHits = focusedLabeled.filter((s) => pick(s) < threshold).length;
  return {
    closedRecall: closedLabeled.length > 0 ? closedHits / closedLabeled.length : NaN,
    focusedFalsePositive: focusedLabeled.length > 0 ? focusedFalseHits / focusedLabeled.length : NaN,
  };
}

function fmtPct(n: number): string {
  return Number.isNaN(n) ? "n/a" : `${(n * 100).toFixed(1)}%`;
}

function main() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.log(`No fixtures directory at ${FIXTURES_DIR} — nothing to compare.`);
    return;
  }
  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) {
    console.log("No fixtures found — nothing to compare.");
    return;
  }

  const allSamples: Sample[] = [];
  console.log(`Comparing EAR vs. iris-normalized openness across ${files.length} fixture(s):\n`);

  for (const file of files) {
    const samples = loadSamples(file);
    allSamples.push(...samples);

    const earBaseline = deriveBaseline(samples, (s) => s.ear);
    const irisBaseline = deriveBaseline(samples, (s) => s.iris);
    if (earBaseline === null || irisBaseline === null) {
      console.log(`${file}: could not derive a baseline (no focused segment found) — skipped`);
      continue;
    }
    const earThreshold = Math.min(
      DEFAULT_CONFIG.earThresholdMax,
      Math.max(DEFAULT_CONFIG.earThresholdMin, earBaseline * DEFAULT_CONFIG.earClosedFactor)
    );
    // No calibrated min/max clamp exists yet for the iris-normalized scale
    // (this is a shadow signal — those clamps would need their own
    // fitting if this ever gets promoted); same factor, unclamped.
    const irisThreshold = irisBaseline * DEFAULT_CONFIG.earClosedFactor;

    const earRates = evaluate(samples, (s) => s.ear, earThreshold);
    const irisRates = evaluate(samples, (s) => s.iris, irisThreshold);

    console.log(`${file}:`);
    console.log(
      `  EAR:  baseline=${earBaseline.toFixed(4)} threshold=${earThreshold.toFixed(4)}  closedRecall=${fmtPct(earRates.closedRecall)}  focusedFalsePositive=${fmtPct(earRates.focusedFalsePositive)}`
    );
    console.log(
      `  iris: baseline=${irisBaseline.toFixed(4)} threshold=${irisThreshold.toFixed(4)}  closedRecall=${fmtPct(irisRates.closedRecall)}  focusedFalsePositive=${fmtPct(irisRates.focusedFalsePositive)}`
    );
    console.log();
  }

  console.log(
    "Reading this: higher closedRecall is better (catches real closure); lower focusedFalsePositive is better\n" +
      "(doesn't misread real openness as closed). Per the plan, iris needs to win clearly to be promoted — a\n" +
      "marginal or mixed result means EAR stays as the live signal."
  );
}

const isMain = path.resolve(process.argv[1] ?? "") === path.resolve(__filename);
if (isMain) main();
