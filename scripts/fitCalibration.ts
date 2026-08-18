#!/usr/bin/env tsx
/**
 * Build Mandate Phase 2's fitting script: grid search over
 * (gazeWeightK, worldDeviationRX, worldDeviationRDown, worldDeviationRUp)
 * against every fixture in fixtures/attention/, picking the combination
 * with the lowest pooled false-distract rate subject to pooled miss rate
 * staying at or under MISS_RATE_CEILING — per the plan: "false-distract is
 * worse than a miss for a self-report coin game nobody is incentivized to
 * game" (see Build Mandate Phase 3.4), so false-distract is the thing to
 * minimize, miss rate is the constraint it can't blow past doing so.
 *
 * Run via `npm run attention:fit`.
 *
 * Each fixture gets its OWN neutral-pose calibration baseline (derived
 * from the first ~3s of its first "focused"-labeled segment — real
 * fixtures predate this phase and never ran an actual onboarding capture,
 * so this stands in for one), but the grid-searched radii/weight are
 * shared across all fixtures — the fit is for one universal config
 * intended to generalize, not per-fixture-optimal values that would just
 * overfit further on top of an already-thin, same-person dataset (see the
 * caveat printed at the end of this script's output, and
 * docs/attention-baseline.md).
 *
 * headPoseRX/RDown/RUp are deliberately NOT included in this grid — see
 * classify.ts's comment on why head-pose extremity stays uncalibrated and
 * out of scope for this fit; only the world-deviation ellipse (the actual
 * "looking away from the screen" decision) is tuned here.
 */
import fs from "node:fs";
import path from "node:path";
import { loadFixture, replayFixture, type FixtureFile, type LabelName } from "./replay";
import { trustedLabelAt, LABEL_BOUNDARY_TRIM_MS } from "./metrics";
import { deriveNeutralCalibration } from "./deriveNeutralCalibration";
import { DEFAULT_CONFIG, type AttentionConfig } from "../lib/attention/classify";
import { applyCalibrationToConfig, type NeutralCalibration } from "../lib/attention/neutralCalibration";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/attention");

/** Per the plan: "optimizing lowest false-distract rate subject to miss
 * rate staying under ~15%." Not tuned against anything itself — the
 * plan's own stated ceiling. */
const MISS_RATE_CEILING = 0.15;

// ── Grid ranges — a reasonable starting search space, not exhaustive. If
// the winning value below sits at an edge of its range, that's a signal
// the true optimum is outside what was searched, not that this is final. ──
const GRID = {
  gazeWeightK: [0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0],
  worldDeviationRX: [0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.65, 0.8, 1.0],
  worldDeviationRDown: [0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.75],
  worldDeviationRUp: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4],
};

interface Candidate {
  gazeWeightK: number;
  worldDeviationRX: number;
  worldDeviationRDown: number;
  worldDeviationRUp: number;
}

interface FixturePrep {
  file: string;
  fixture: FixtureFile;
  calibration: NeutralCalibration | null;
  trustedLabels: (LabelName | null)[]; // aligned to fixture.frames, precomputed once (config-independent)
}

function prepareFixture(file: string): FixturePrep {
  const fixture = loadFixture(path.join(FIXTURES_DIR, file));
  const sortedMarkers = [...fixture.label_markers].sort((a, b) => a.t - b.t);
  const trustedLabels = fixture.frames.map((f) =>
    trustedLabelAt(sortedMarkers, f.t, LABEL_BOUNDARY_TRIM_MS)
  );
  return { file, fixture, calibration: deriveNeutralCalibration(fixture), trustedLabels };
}

interface PooledRates {
  falseDistractRate: number;
  missRate: number;
  focusedLabeled: number;
  missLabeled: number;
}

/** Pools raw frame counts across every fixture (not an average of
 * per-fixture percentages, which would misweight a shorter fixture equally
 * against a longer one) using each fixture's OWN calibration baseline but
 * the SAME candidate radii/weight for all of them. */
function evaluateCandidate(prepared: FixturePrep[], candidate: Candidate): PooledRates {
  let focusedLabeled = 0;
  let focusedWrong = 0;
  let missLabeled = 0;
  let missWrong = 0;

  for (const prep of prepared) {
    const config: AttentionConfig = applyCalibrationToConfig(
      { ...DEFAULT_CONFIG, ...candidate },
      prep.calibration
    );
    const replayed = replayFixture(prep.fixture, config);
    replayed.forEach((f, i) => {
      const label = prep.trustedLabels[i];
      if (label === null) return;
      if (label === "focused") {
        focusedLabeled++;
        if (!f.isFocused) focusedWrong++;
      } else if (label === "phone" || label === "looking_away") {
        missLabeled++;
        if (f.isFocused) missWrong++;
      }
    });
  }

  return {
    falseDistractRate: focusedLabeled > 0 ? focusedWrong / focusedLabeled : NaN,
    missRate: missLabeled > 0 ? missWrong / missLabeled : NaN,
    focusedLabeled,
    missLabeled,
  };
}

function fmtPct(n: number): string {
  return Number.isNaN(n) ? "n/a" : `${(n * 100).toFixed(1)}%`;
}

function fmtCandidate(c: Candidate): string {
  return `k=${c.gazeWeightK} RX=${c.worldDeviationRX} RDown=${c.worldDeviationRDown} RUp=${c.worldDeviationRUp}`;
}

function main() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.log(`No fixtures directory at ${FIXTURES_DIR} — nothing to fit against.`);
    return;
  }
  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) {
    console.log("No fixtures found in fixtures/attention/ — nothing to fit against.");
    return;
  }

  console.log(`Preparing ${files.length} fixture(s)...`);
  const prepared = files.map(prepareFixture);
  for (const p of prepared) {
    console.log(
      `  ${p.file}: neutral calibration ${p.calibration ? "OK" : "FAILED (using uncalibrated/0 offsets for this fixture)"}` +
        (p.calibration
          ? ` — yaw0=${p.calibration.yaw0.toFixed(3)} pitch0=${p.calibration.pitch0.toFixed(3)} gazeX0=${p.calibration.gazeX0.toFixed(3)} gazeY0=${p.calibration.gazeY0.toFixed(3)}`
          : "")
    );
  }

  // ── Three-way comparison: shipped Phase 1, +calibration only, +fitted radii ──
  const phase1Baseline: Candidate = { gazeWeightK: 1, worldDeviationRX: 0.3, worldDeviationRDown: 0.3, worldDeviationRUp: 0.3 };
  const uncalibratedPrep = prepared.map((p) => ({ ...p, calibration: null }));
  const phase1Rates = evaluateCandidate(uncalibratedPrep, phase1Baseline);
  const calibratedOnlyRates = evaluateCandidate(prepared, phase1Baseline);

  console.log(`\nGrid: ${GRID.gazeWeightK.length}×${GRID.worldDeviationRX.length}×${GRID.worldDeviationRDown.length}×${GRID.worldDeviationRUp.length} = ${GRID.gazeWeightK.length * GRID.worldDeviationRX.length * GRID.worldDeviationRDown.length * GRID.worldDeviationRUp.length} candidates, miss-rate ceiling ${fmtPct(MISS_RATE_CEILING)}`);

  // Currently-shipped DEFAULT_CONFIG's own radii, evaluated the same
  // pooled way as every grid candidate — the actual "what happens if we
  // change nothing" baseline, not just the old circular-default rows
  // above (which predate Phase 2's fit entirely).
  const shippedCandidate: Candidate = {
    gazeWeightK: DEFAULT_CONFIG.gazeWeightK,
    worldDeviationRX: DEFAULT_CONFIG.worldDeviationRX,
    worldDeviationRDown: DEFAULT_CONFIG.worldDeviationRDown,
    worldDeviationRUp: DEFAULT_CONFIG.worldDeviationRUp,
  };
  const shippedRates = evaluateCandidate(prepared, shippedCandidate);

  let bestUnderCeiling: { candidate: Candidate; rates: PooledRates } | null = null;
  // Fallback per the plan's own stated priority (Phase 3.4: false-distract
  // is worse than a miss) if nothing clears the ceiling: lowest false-
  // distract in the WHOLE grid, not lowest miss rate — minimizing miss
  // rate alone picks the opposite of what the plan actually wants.
  let lowestFalseDistract: { candidate: Candidate; rates: PooledRates } | null = null;
  let evaluated = 0;
  const start = Date.now();

  for (const gazeWeightK of GRID.gazeWeightK) {
    for (const worldDeviationRX of GRID.worldDeviationRX) {
      for (const worldDeviationRDown of GRID.worldDeviationRDown) {
        for (const worldDeviationRUp of GRID.worldDeviationRUp) {
          const candidate: Candidate = { gazeWeightK, worldDeviationRX, worldDeviationRDown, worldDeviationRUp };
          const rates = evaluateCandidate(prepared, candidate);
          evaluated++;

          if (
            !Number.isNaN(rates.falseDistractRate) &&
            (!lowestFalseDistract || rates.falseDistractRate < lowestFalseDistract.rates.falseDistractRate)
          ) {
            lowestFalseDistract = { candidate, rates };
          }
          if (
            !Number.isNaN(rates.missRate) &&
            !Number.isNaN(rates.falseDistractRate) &&
            rates.missRate <= MISS_RATE_CEILING &&
            (!bestUnderCeiling || rates.falseDistractRate < bestUnderCeiling.rates.falseDistractRate)
          ) {
            bestUnderCeiling = { candidate, rates };
          }
        }
      }
    }
  }

  console.log(`Evaluated ${evaluated} candidates in ${((Date.now() - start) / 1000).toFixed(1)}s\n`);

  console.log("Phase 1 (shipped, uncalibrated, circular default radii):");
  console.log(`  falseDistract=${fmtPct(phase1Rates.falseDistractRate)} missRate=${fmtPct(phase1Rates.missRate)} (n=${phase1Rates.focusedLabeled}/${phase1Rates.missLabeled})`);

  console.log("\n+ neutral-pose calibration only (still circular default radii, k=1):");
  console.log(`  falseDistract=${fmtPct(calibratedOnlyRates.falseDistractRate)} missRate=${fmtPct(calibratedOnlyRates.missRate)} (n=${calibratedOnlyRates.focusedLabeled}/${calibratedOnlyRates.missLabeled})`);

  console.log(`\nCurrently shipped DEFAULT_CONFIG (${fmtCandidate(shippedCandidate)}):`);
  console.log(`  falseDistract=${fmtPct(shippedRates.falseDistractRate)} missRate=${fmtPct(shippedRates.missRate)}`);

  if (bestUnderCeiling) {
    console.log(`\n+ fitted ellipse radii (winner, ${fmtCandidate(bestUnderCeiling.candidate)}):`);
    console.log(`  falseDistract=${fmtPct(bestUnderCeiling.rates.falseDistractRate)} missRate=${fmtPct(bestUnderCeiling.rates.missRate)}`);
    console.log(
      `\nDEFAULT_CONFIG should be updated to: gazeWeightK: ${bestUnderCeiling.candidate.gazeWeightK}, worldDeviationRX: ${bestUnderCeiling.candidate.worldDeviationRX}, worldDeviationRDown: ${bestUnderCeiling.candidate.worldDeviationRDown}, worldDeviationRUp: ${bestUnderCeiling.candidate.worldDeviationRUp}`
    );
  } else {
    console.log(
      `\nNo candidate in the grid kept miss rate at or under ${fmtPct(MISS_RATE_CEILING)} — ` +
        `not a radii problem, the Schmitt trigger's threshold gap itself raises the achievable miss-rate floor ` +
        `above the ceiling for this dataset (see the "Phase 1" row above: even circular defaults sit at ` +
        `${fmtPct(phase1Rates.missRate)}, already past ${fmtPct(MISS_RATE_CEILING)}, before any radii choice).`
    );
    console.log(
      `Lowest false-distract in the whole grid (the plan's actual stated priority when the ceiling can't be met): ` +
        `${fmtCandidate(lowestFalseDistract!.candidate)} — falseDistract=${fmtPct(lowestFalseDistract!.rates.falseDistractRate)} missRate=${fmtPct(lowestFalseDistract!.rates.missRate)}`
    );
    console.log(
      `Compare to shipped: falseDistract=${fmtPct(shippedRates.falseDistractRate)} missRate=${fmtPct(shippedRates.missRate)} — ` +
        (lowestFalseDistract!.rates.falseDistractRate < shippedRates.falseDistractRate
          ? "grid found something better; consider updating DEFAULT_CONFIG."
          : "shipped config is already at or near the grid's best false-distract rate — no update indicated.")
    );
  }

  console.log(
    "\nCaveat: fit against only " +
      files.length +
      " fixture(s), all the same person. These constants are not proven to generalize " +
      "to other faces/eye-shapes/camera angles — see docs/attention-baseline.md's Phase 2 section."
  );
}

const isMain = path.resolve(process.argv[1] ?? "") === path.resolve(__filename);
if (isMain) main();
