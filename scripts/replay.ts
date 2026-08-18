#!/usr/bin/env tsx
/**
 * Replays a recorded fixture (see /dev/record) through classifyFrame using
 * the frames' recorded timestamps, and prints every focused/distracted
 * transition.
 *
 * CLI usage: npx tsx scripts/replay.ts fixtures/attention/some-file.json
 *
 * Also exports replayFixture()/loadFixture() for scripts/metrics.ts to
 * reuse — metrics.ts imports from here rather than re-implementing the
 * replay loop, so there's exactly one place that walks a fixture through
 * the classifier.
 */
import fs from "node:fs";
import path from "node:path";
import {
  classifyFrame,
  createInitialAttentionState,
  DEFAULT_CONFIG,
  type AttentionConfig,
  type Landmark,
  type DistractionReason,
} from "../lib/attention/classify";

export type LabelName = "focused" | "phone" | "looking_away" | "eyes_closed" | "absent";

export interface LabelMarker {
  t: number;
  label: LabelName;
}

/** What /dev/record actually writes: `z` dropped (classifyFrame never
 * reads it — see app/dev/record/page.tsx's trimLandmarks comment) and x/y
 * rounded, to keep fixture files well under the JS string-length ceiling
 * that "Invalid string length" errors come from on longer recordings. */
export type RecordedLandmark = { x: number; y: number };

export interface RecordedFrame {
  t: number;
  landmarks: RecordedLandmark[] | null;
}

export interface FixtureFile {
  label_markers: LabelMarker[];
  frames: RecordedFrame[];
}

export interface ReplayedFrame {
  t: number;
  /** null = before the first label marker, no ground truth yet for this frame. */
  label: LabelName | null;
  isFocused: boolean;
  /** Build Mandate Phase 3: continuous 0..1 — what reward accrual actually
   * integrates now (see context/SessionContext.tsx); isFocused above is
   * kept for UI-display-equivalent metrics only. */
  focusScore: number;
  reason: DistractionReason;
}

export function loadFixture(filePath: string): FixtureFile {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as FixtureFile;
}

/** Sticky label: the most recent marker at or before `t`. Assumes `markers`
 * is sorted ascending by `t` (replayFixture sorts defensively before calling). */
function labelAt(markers: LabelMarker[], t: number): LabelName | null {
  let current: LabelName | null = null;
  for (const m of markers) {
    if (m.t <= t) current = m.label;
    else break;
  }
  return current;
}

/** Fixtures store {x,y} only (see RecordedLandmark) — classifyFrame's type
 * still wants a full Landmark, so z is re-added as 0 here, once per frame,
 * rather than the recorder paying to store a value nothing ever reads. */
export function toClassifierLandmarks(landmarks: RecordedLandmark[] | null): Landmark[] | null {
  if (!landmarks) return null;
  return landmarks.map((p) => ({ x: p.x, y: p.y, z: 0 }));
}

export function replayFixture(
  fixture: FixtureFile,
  config: AttentionConfig = DEFAULT_CONFIG
): ReplayedFrame[] {
  const markers = [...fixture.label_markers].sort((a, b) => a.t - b.t);
  let state = createInitialAttentionState(config);
  let prevT: number | null = null;
  const out: ReplayedFrame[] = [];

  for (const frame of fixture.frames) {
    const dtMs = prevT === null ? 0 : frame.t - prevT;
    prevT = frame.t;
    const landmarks = toClassifierLandmarks(frame.landmarks);
    const result = classifyFrame(landmarks, frame.t, dtMs, state, config);
    state = result.state;
    out.push({
      t: frame.t,
      label: labelAt(markers, frame.t),
      isFocused: result.isFocused,
      focusScore: result.focusScore,
      reason: result.reason,
    });
  }
  return out;
}

function main() {
  const fixturePath = process.argv[2];
  if (!fixturePath) {
    console.error("usage: tsx scripts/replay.ts <fixture.json>");
    process.exit(1);
  }
  const resolved = path.resolve(fixturePath);
  if (!fs.existsSync(resolved)) {
    console.error(`fixture not found: ${resolved}`);
    process.exit(1);
  }

  const fixture = loadFixture(resolved);
  const replayed = replayFixture(fixture);

  console.log(
    `${path.basename(fixturePath)}: ${replayed.length} frames, ${fixture.label_markers.length} label markers\n`
  );
  console.log("Transitions:");
  let prevFocused: boolean | null = null;
  for (const f of replayed) {
    if (f.isFocused !== prevFocused) {
      console.log(
        `  t=${f.t.toFixed(0)}ms  label=${f.label ?? "—"}  → ${
          f.isFocused ? "FOCUSED" : "distracted"
        }${f.reason ? ` (${f.reason})` : ""}`
      );
      prevFocused = f.isFocused;
    }
  }
}

const isMain = path.resolve(process.argv[1] ?? "") === path.resolve(__filename);
if (isMain) main();
