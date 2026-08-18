/**
 * Build Mandate Phase 1's stated acceptance criterion: "new test proves
 * near-identical verdict timelines when the same fixture is replayed at
 * simulated 30fps vs 60fps." classify.test.ts's "frame-rate independence"
 * block already covers the core mechanism with a narrow, fast-running
 * scenario; this file is the broader property-level check the phase
 * actually asks for — a multi-segment scenario (calibration settle, blink,
 * sustained closure, looking away, back to neutral) treated as a
 * continuous function of wall-clock time, sampled at two different rates,
 * with the resulting focused/distracted transition *timestamps* (not frame
 * indices — a 60fps replay legitimately has ~2x the frame indices of a
 * 30fps replay of the same span) compared for near-equality.
 *
 * Before Phase 1, this would have failed: frame-counter hysteresis flipped
 * after N *calls*, so the 60fps replay would flip in roughly half the
 * wall-clock time of the 30fps replay for the same underlying scenario.
 */
import {
  classifyFrame,
  createInitialAttentionState,
  DEFAULT_CONFIG,
  type Landmark,
} from "@/lib/attention/classify";
import {
  neutralFrame,
  closedEyesFrame,
  lookingAwayFrame,
} from "./fixtures";

// ── Continuous-time scenario ────────────────────────────────────────────
// Each segment's landmarks are constant for its span — what varies is only
// *when* a sample lands within that span, driven by the two sampling rates
// below. Spans are chosen generously past every relevant threshold
// (calibrationMs ≈ 1967ms, eyesClosedGraceMs 1500ms, msToDistract ≈ 167ms)
// so the exact rate can't accidentally straddle a segment boundary at a
// different point relative to threshold-crossing between the two runs.
const SEGMENTS: { untilMs: number; landmarks: () => Landmark[] | null }[] = [
  { untilMs: 3000, landmarks: neutralFrame }, // calibrate + settle focused
  { untilMs: 5500, landmarks: closedEyesFrame }, // 2500ms closed, past the 1500ms grace
  { untilMs: 8000, landmarks: neutralFrame }, // back to neutral, re-settle focused
  { untilMs: 9500, landmarks: lookingAwayFrame }, // 1500ms looking away, past msToDistract
  { untilMs: 12000, landmarks: neutralFrame }, // back to neutral
];
const TOTAL_MS = SEGMENTS[SEGMENTS.length - 1].untilMs;

function landmarkAt(tMs: number): Landmark[] | null {
  for (const seg of SEGMENTS) {
    if (tMs < seg.untilMs) return seg.landmarks();
  }
  return SEGMENTS[SEGMENTS.length - 1].landmarks();
}

/** Replays the scenario at a fixed sample interval, returning the
 * timestamp of every focused/distracted transition. */
function transitionTimestamps(dtMs: number): number[] {
  let state = createInitialAttentionState();
  let prevT: number | null = null;
  let prevFocused: boolean | null = null;
  const transitions: number[] = [];

  for (let t = 0; t <= TOTAL_MS; t += dtMs) {
    const dt = prevT === null ? 0 : t - prevT;
    prevT = t;
    const result = classifyFrame(landmarkAt(t), t, dt, state, DEFAULT_CONFIG);
    state = result.state;
    if (prevFocused !== null && result.isFocused !== prevFocused) {
      transitions.push(t);
    }
    prevFocused = result.isFocused;
  }
  return transitions;
}

describe("frame-rate independence (Phase 1 acceptance criterion)", () => {
  it("the same scenario replayed at ~30fps and ~60fps produces the same number of transitions at nearly the same timestamps", () => {
    const at30fps = transitionTimestamps(1000 / 30);
    const at60fps = transitionTimestamps(1000 / 60);

    expect(at30fps.length).toBeGreaterThan(0); // sanity: the scenario actually exercises the hysteresis
    expect(at30fps.length).toBe(at60fps.length);

    // Tolerance: two full slow-rate frame intervals. Detecting a transition
    // has two independent discretization steps that can each land up to
    // one sample late — noticing the underlying segment actually changed,
    // and then separately noticing the elapsed-time threshold was crossed
    // relative to *that* sample's own anchor — and a coarser rate can only
    // ever detect either one on or after it truly happened, never before.
    // Still a fixed, small, rate-independent bound either way — not the
    // rate-*proportional* drift this phase fixed (pre-Phase-1, a 2x rate
    // change would have meant a ~2x difference in wall-clock time-to-flip
    // itself, not a small fixed discretization tolerance around it).
    const toleranceMs = 2 * (1000 / 30) + 5;
    at30fps.forEach((t30, i) => {
      expect(Math.abs(t30 - at60fps[i])).toBeLessThan(toleranceMs);
    });
  });
});
