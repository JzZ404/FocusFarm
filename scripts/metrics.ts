#!/usr/bin/env tsx
/**
 * Aggregate replay metrics across every fixture in fixtures/attention/.
 * Run via `npm run attention:eval`.
 *
 * The Phase 0 acceptance criterion is that this script prints a baseline
 * table, recorded once in docs/attention-baseline.md — every later phase
 * reports its numbers as a delta against that baseline, not in isolation.
 *
 * Since Phase 2, each fixture is replayed with its OWN derived neutral-
 * pose calibration applied (see deriveNeutralCalibration.ts), not raw
 * DEFAULT_CONFIG — DEFAULT_CONFIG's ellipse radii are now fit assuming
 * calibration IS applied (see classify.ts's DEFAULT_CONFIG comment and
 * scripts/fitCalibration.ts), so replaying uncalibrated here would
 * silently misrepresent real usage, which always calibrates first. This
 * is a real methodology change from the Phase 0/1 baseline numbers in
 * docs/attention-baseline.md, which had no calibration concept at all —
 * flagged there, not just here.
 */
import fs from "node:fs";
import path from "node:path";
import {
  loadFixture,
  replayFixture,
  type ReplayedFrame,
  type LabelName,
  type LabelMarker,
} from "./replay";
import { deriveNeutralCalibration } from "./deriveNeutralCalibration";
import { DEFAULT_CONFIG } from "../lib/attention/classify";
import { applyCalibrationToConfig } from "../lib/attention/neutralCalibration";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/attention");

/**
 * Frames within this many ms of a label transition (on either side) are
 * excluded from every metric below, not just treated as unlabeled — added
 * after a real recording session surfaced the actual problem: there's
 * inherent reaction-time lag around pressing the marker key (the human
 * either starts drifting into the next behavior slightly before pressing
 * it, or hasn't fully settled into it yet right after), so the frames
 * right at a boundary aren't trustworthy ground truth in either direction.
 * 1000ms is the low end of what was reported as noticeable; adjust here if
 * later fixtures suggest otherwise — this isn't tuned against anything,
 * it's a reasonable first guess exactly like the classifier's own constants.
 */
export const LABEL_BOUNDARY_TRIM_MS = 1000;

/** Like replay.ts's labelAt, but returns null (no trusted ground truth) for
 * any frame within LABEL_BOUNDARY_TRIM_MS of either edge of its segment —
 * see the constant's comment above for why. */
export function trustedLabelAt(
  markers: LabelMarker[],
  t: number,
  trimMs: number
): LabelName | null {
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].t;
    const end = i + 1 < markers.length ? markers[i + 1].t : Infinity;
    if (t < start || t >= end) continue;
    if (t < start + trimMs) return null; // too soon after this label started
    if (end !== Infinity && t > end - trimMs) return null; // too close to the next transition
    return markers[i].label;
  }
  return null;
}

export interface FixtureMetrics {
  file: string;
  totalFrames: number;
  labeledFrames: number;
  /** 0..1 over labeled frames — isFocused matches what the label implies. */
  accuracy: number;
  /** 0..1 over "focused"-labeled frames — the priority metric (see
   * Build Mandate Phase 3.4: false-distract is worse than a miss for a
   * self-report coin game nobody is incentivized to game). */
  falseDistractRate: number;
  /** 0..1 over "phone"/"looking_away"-labeled frames. */
  missRate: number;
  flipsPerMinuteFocused: number;
  /** Seconds where a "focused" frame was misread as distracted (binary
   * isFocused vs. label) — what the UI-display state gets wrong. */
  secondsLostFocused: number;
  /** Seconds where a non-focused frame was misread as focused (binary). */
  secondsWronglyCredited: number;
  /** Build Mandate Phase 3: the same two quantities, but weighted by
   * focusScore instead of the binary isFocused flag — this is what reward
   * accrual (context/SessionContext.tsx, driven by focusScore since Phase
   * 3) actually loses/wrongly-credits, and the number Phase 3's "seconds-
   * mis-credited improves" acceptance criterion is about. Diverges from
   * the binary numbers above on purpose once Phase 3 lands — see
   * docs/attention-baseline.md's Phase 3 section for why they're expected
   * to move in different directions (the Schmitt trigger's dwell time
   * trades UI-display responsiveness for structurally fewer flips; the
   * continuous score is judged on its own, independent of that trade). */
  scoreSecondsLostFocused: number;
  scoreSecondsWronglyCredited: number;
}

function expectedFocused(label: LabelName): boolean {
  return label === "focused";
}

export function computeMetrics(
  file: string,
  replayed: ReplayedFrame[],
  markers: LabelMarker[]
): FixtureMetrics {
  const sortedMarkers = [...markers].sort((a, b) => a.t - b.t);

  // Each frame's duration weight comes from the FULL original (untrimmed)
  // sequence — computed before any boundary trimming is applied — so a
  // frame right before a trimmed-out gap never gets credited with the
  // gap's whole span. Only afterward do we attach the trusted label (or
  // null) and filter.
  const withWeight = replayed.map((f, i) => {
    const next = replayed[i + 1];
    const dtMs = next ? next.t - f.t : 33; // 33ms nominal fallback for the last sample
    return { ...f, dtSec: Math.max(0, dtMs) / 1000 };
  });

  const labeled = withWeight
    .map((f) => ({ ...f, label: trustedLabelAt(sortedMarkers, f.t, LABEL_BOUNDARY_TRIM_MS) }))
    .filter((f): f is (typeof withWeight)[number] & { label: LabelName } => f.label !== null);

  let correct = 0;
  let focusedLabeled = 0;
  let focusedWrong = 0;
  let missLabeled = 0;
  let missWrong = 0;
  let secondsLostFocused = 0;
  let secondsWronglyCredited = 0;
  let scoreSecondsLostFocused = 0;
  let scoreSecondsWronglyCredited = 0;

  for (const f of labeled) {
    const expected = expectedFocused(f.label);
    if (f.isFocused === expected) correct++;

    if (f.label === "focused") {
      focusedLabeled++;
      if (!f.isFocused) {
        focusedWrong++;
        secondsLostFocused += f.dtSec;
      }
      // Reward shortfall: how much of this focused second focusScore
      // *didn't* credit — 0 when focusScore is 1 the whole second.
      scoreSecondsLostFocused += (1 - f.focusScore) * f.dtSec;
    } else {
      if (f.label === "phone" || f.label === "looking_away") {
        missLabeled++;
        if (f.isFocused) missWrong++;
      }
      if (f.isFocused) secondsWronglyCredited += f.dtSec;
      // Reward wrongly given: however much focusScore credited a second
      // that shouldn't have earned anything.
      scoreSecondsWronglyCredited += f.focusScore * f.dtSec;
    }
  }

  // Flips/min over trusted "focused" frames — but a recording can (and
  // this feedback round's did) have multiple separate focused segments
  // with other labels in between, and boundary trimming opens further
  // gaps. Naively comparing consecutive entries of a label-filtered array
  // would count a spurious "flip" every time it jumps from the tail of one
  // focused segment to the head of the next, and a naive first-to-last
  // span as the rate denominator would silently include the non-focused
  // time between them. ADJACENCY_GAP_MS keeps both parts honest: only
  // count a flip between frames that are actually next to each other in
  // time, and sum real per-frame durations (already gap-safe — see
  // withWeight above) for the denominator instead of a span.
  const ADJACENCY_GAP_MS = 500;
  let flips = 0;
  let prevFocused: boolean | null = null;
  let prevT: number | null = null;
  let totalFocusedSeconds = 0;
  const focusedOnly = labeled.filter((f) => f.label === "focused");
  for (const f of focusedOnly) {
    totalFocusedSeconds += f.dtSec;
    const adjacent = prevT !== null && f.t - prevT <= ADJACENCY_GAP_MS;
    if (adjacent && prevFocused !== null && f.isFocused !== prevFocused) flips++;
    prevFocused = f.isFocused;
    prevT = f.t;
  }
  const flipsPerMinuteFocused =
    totalFocusedSeconds > 0 ? flips / (totalFocusedSeconds / 60) : 0;

  return {
    file,
    totalFrames: replayed.length,
    labeledFrames: labeled.length,
    accuracy: labeled.length > 0 ? correct / labeled.length : NaN,
    falseDistractRate: focusedLabeled > 0 ? focusedWrong / focusedLabeled : NaN,
    missRate: missLabeled > 0 ? missWrong / missLabeled : NaN,
    flipsPerMinuteFocused,
    secondsLostFocused,
    secondsWronglyCredited,
    scoreSecondsLostFocused,
    scoreSecondsWronglyCredited,
  };
}

function fmtPct(n: number): string {
  return Number.isNaN(n) ? "n/a" : `${(n * 100).toFixed(1)}%`;
}

interface LabelBreakdown {
  label: LabelName;
  count: number;
  focusedCount: number;
  reasonCounts: Map<string, number>;
}

/** Per-ground-truth-label breakdown: what fraction of frames the classifier
 * called focused (should be ~100% only for "focused" itself), and when it
 * called distracted, which reason fired most. Answers questions like "is
 * absent actually landing on no_face, or something else" directly instead
 * of by inspection. */
function computeLabelBreakdown(
  replayed: ReplayedFrame[],
  markers: LabelMarker[]
): Map<LabelName, LabelBreakdown> {
  const sortedMarkers = [...markers].sort((a, b) => a.t - b.t);
  const byLabel = new Map<LabelName, LabelBreakdown>();

  for (const f of replayed) {
    const label = trustedLabelAt(sortedMarkers, f.t, LABEL_BOUNDARY_TRIM_MS);
    if (label === null) continue;
    let entry = byLabel.get(label);
    if (!entry) {
      entry = { label, count: 0, focusedCount: 0, reasonCounts: new Map() };
      byLabel.set(label, entry);
    }
    entry.count++;
    if (f.isFocused) entry.focusedCount++;
    else if (f.reason) entry.reasonCounts.set(f.reason, (entry.reasonCounts.get(f.reason) ?? 0) + 1);
  }
  return byLabel;
}

function mergeBreakdowns(all: Map<LabelName, LabelBreakdown>[]): LabelBreakdown[] {
  const merged = new Map<LabelName, LabelBreakdown>();
  for (const byLabel of all) {
    for (const [label, entry] of byLabel) {
      let m = merged.get(label);
      if (!m) {
        m = { label, count: 0, focusedCount: 0, reasonCounts: new Map() };
        merged.set(label, m);
      }
      m.count += entry.count;
      m.focusedCount += entry.focusedCount;
      for (const [r, c] of entry.reasonCounts) {
        m.reasonCounts.set(r, (m.reasonCounts.get(r) ?? 0) + c);
      }
    }
  }
  const order: LabelName[] = ["focused", "phone", "looking_away", "eyes_closed", "absent"];
  return order.filter((l) => merged.has(l)).map((l) => merged.get(l)!);
}

function topReason(entry: LabelBreakdown): string {
  let best: string | null = null;
  let bestCount = 0;
  for (const [r, c] of entry.reasonCounts) {
    if (c > bestCount) {
      best = r;
      bestCount = c;
    }
  }
  if (!best) return "—";
  const pct = ((bestCount / entry.count) * 100).toFixed(0);
  return `${best} (${pct}%)`;
}

function printLabelBreakdown(entries: LabelBreakdown[]) {
  console.log("\nBy ground-truth label (aggregate across all fixtures):");
  console.log(
    "label".padEnd(14) +
      "frames".padStart(8) +
      "% classified focused".padStart(22) +
      "  top reason when distracted"
  );
  for (const e of entries) {
    const pctFocused = e.count > 0 ? (e.focusedCount / e.count) * 100 : NaN;
    console.log(
      e.label.padEnd(14) +
        String(e.count).padStart(8) +
        (Number.isNaN(pctFocused) ? "n/a" : `${pctFocused.toFixed(1)}%`).padStart(22) +
        `  ${topReason(e)}`
    );
  }
}

function printTable(rows: FixtureMetrics[]) {
  const cols: [string, (m: FixtureMetrics) => string, number][] = [
    ["file", (m) => m.file, 36],
    ["frames", (m) => String(m.totalFrames), 8],
    ["labeled", (m) => String(m.labeledFrames), 9],
    ["accuracy", (m) => fmtPct(m.accuracy), 10],
    ["falseDistract", (m) => fmtPct(m.falseDistractRate), 15],
    ["missRate", (m) => fmtPct(m.missRate), 10],
    ["flips/min", (m) => m.flipsPerMinuteFocused.toFixed(2), 11],
    ["secLost", (m) => m.secondsLostFocused.toFixed(1), 9],
    ["secWrongCredit", (m) => m.secondsWronglyCredited.toFixed(1), 16],
    ["scoreSecLost", (m) => m.scoreSecondsLostFocused.toFixed(1), 14],
    ["scoreSecWrongCredit", (m) => m.scoreSecondsWronglyCredited.toFixed(1), 21],
  ];
  console.log(cols.map(([label, , width]) => label.padStart(width)).join(""));
  for (const m of rows) {
    console.log(cols.map(([, get, width]) => get(m).padStart(width)).join(""));
  }
}

function main() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.log(`No fixtures directory at ${FIXTURES_DIR} — nothing to evaluate.`);
    return;
  }
  const files = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    console.log(
      "No fixtures found in fixtures/attention/. Record one at /dev/record first, " +
        "download the JSON, and move it into fixtures/attention/."
    );
    return;
  }

  const loaded = files.map((file) => {
    const fixture = loadFixture(path.join(FIXTURES_DIR, file));
    const calibration = deriveNeutralCalibration(fixture);
    const config = applyCalibrationToConfig(DEFAULT_CONFIG, calibration);
    const replayed = replayFixture(fixture, config);
    return { file, fixture, replayed, calibrated: calibration !== null };
  });

  const perFixture: FixtureMetrics[] = loaded.map(({ file, fixture, replayed }) =>
    computeMetrics(file, replayed, fixture.label_markers)
  );

  const uncalibratedCount = loaded.filter((l) => !l.calibrated).length;
  if (uncalibratedCount > 0) {
    console.log(
      `Note: ${uncalibratedCount}/${loaded.length} fixture(s) had no valid neutral-pose calibration derivable ` +
        `(too little face-visible/held-still time in their first "focused" segment) — replayed with 0 neutral offsets for those.`
    );
  }
  console.log(
    `(excluding frames within ${LABEL_BOUNDARY_TRIM_MS}ms of any label transition — see LABEL_BOUNDARY_TRIM_MS)`
  );
  console.log("\nPer-fixture:");
  printTable(perFixture);

  const breakdowns = loaded.map(({ fixture, replayed }) =>
    computeLabelBreakdown(replayed, fixture.label_markers)
  );
  printLabelBreakdown(mergeBreakdowns(breakdowns));

  const totalLabeled = perFixture.reduce((s, m) => s + m.labeledFrames, 0);
  const totalCorrect = perFixture.reduce(
    (s, m) => s + (Number.isNaN(m.accuracy) ? 0 : m.accuracy * m.labeledFrames),
    0
  );
  const totalSecondsLost = perFixture.reduce((s, m) => s + m.secondsLostFocused, 0);
  const totalSecondsWrongCredit = perFixture.reduce(
    (s, m) => s + m.secondsWronglyCredited,
    0
  );
  const totalScoreSecondsLost = perFixture.reduce((s, m) => s + m.scoreSecondsLostFocused, 0);
  const totalScoreSecondsWrongCredit = perFixture.reduce(
    (s, m) => s + m.scoreSecondsWronglyCredited,
    0
  );

  console.log("\nAggregate:");
  console.log(`  fixtures: ${files.length}`);
  console.log(`  total labeled frames: ${totalLabeled}`);
  console.log(
    `  overall accuracy: ${totalLabeled > 0 ? fmtPct(totalCorrect / totalLabeled) : "n/a"}`
  );
  console.log(
    `  [binary isFocused, UI-display-equivalent] seconds lost: ${totalSecondsLost.toFixed(1)}s, wrongly credited: ${totalSecondsWrongCredit.toFixed(1)}s`
  );
  console.log(
    `  [Phase 3 focusScore, what reward accrual actually uses] seconds lost: ${totalScoreSecondsLost.toFixed(1)}s, wrongly credited: ${totalScoreSecondsWrongCredit.toFixed(1)}s`
  );
}

const isMain = path.resolve(process.argv[1] ?? "") === path.resolve(__filename);
if (isMain) main();
