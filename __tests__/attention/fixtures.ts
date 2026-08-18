/**
 * Shared synthetic landmark builders for attention-detection tests. Not a
 * test file itself (no `.test.ts` suffix, jest won't pick it up) — imported
 * by golden.test.ts and classify.test.ts so both draw from the same base
 * "neutral face" instead of maintaining separate copies.
 */
import type { Landmark } from "@/lib/attention/classify";

export function baseLandmarks(): Landmark[] {
  return Array.from({ length: 478 }, () => ({ x: 0, y: 0, z: 0 }));
}

export function withOverrides(overrides: Record<number, Landmark>): Landmark[] {
  const lm = baseLandmarks();
  for (const [idxStr, point] of Object.entries(overrides)) {
    lm[Number(idxStr)] = point;
  }
  return lm;
}

/** Eyes comfortably open, looking dead ahead, head level and facing camera. */
export const NEUTRAL_OVERRIDES: Record<number, Landmark> = {
  234: { x: 0.3, y: 0.5, z: 0 }, // FACE_LEFT_EDGE
  454: { x: 0.7, y: 0.5, z: 0 }, // FACE_RIGHT_EDGE
  10: { x: 0.5, y: 0.2, z: 0 }, // FACE_TOP
  152: { x: 0.5, y: 0.8, z: 0 }, // FACE_BOTTOM
  1: { x: 0.5, y: 0.53, z: 0 }, // NOSE_TIP
  // right eye: outer=33, upper-outer=160, upper-inner=158, inner=133, lower-inner=153, lower-outer=144
  33: { x: 0.35, y: 0.45, z: 0 },
  160: { x: 0.37, y: 0.435, z: 0 },
  158: { x: 0.43, y: 0.435, z: 0 },
  133: { x: 0.45, y: 0.45, z: 0 },
  153: { x: 0.43, y: 0.465, z: 0 },
  144: { x: 0.37, y: 0.465, z: 0 },
  468: { x: 0.4, y: 0.45, z: 0 }, // right iris, centered
  // left eye: inner=362, upper=385/387, outer=263, lower=373/380
  362: { x: 0.55, y: 0.45, z: 0 },
  385: { x: 0.57, y: 0.435, z: 0 },
  387: { x: 0.63, y: 0.435, z: 0 },
  263: { x: 0.65, y: 0.45, z: 0 },
  373: { x: 0.63, y: 0.465, z: 0 },
  380: { x: 0.57, y: 0.465, z: 0 },
  473: { x: 0.6, y: 0.45, z: 0 }, // left iris, centered
};

export function neutralFrame(): Landmark[] {
  return withOverrides(NEUTRAL_OVERRIDES);
}

/** Same as neutral but eyelids pinched shut (near-zero vertical eye gap). */
export function closedEyesFrame(): Landmark[] {
  return withOverrides({
    ...NEUTRAL_OVERRIDES,
    160: { x: 0.37, y: 0.449, z: 0 },
    158: { x: 0.43, y: 0.449, z: 0 },
    153: { x: 0.43, y: 0.451, z: 0 },
    144: { x: 0.37, y: 0.451, z: 0 },
    385: { x: 0.57, y: 0.449, z: 0 },
    387: { x: 0.63, y: 0.449, z: 0 },
    373: { x: 0.63, y: 0.451, z: 0 },
    380: { x: 0.57, y: 0.451, z: 0 },
  });
}

/** Neutral head, both irises shifted hard toward the outer corners (looking sideways). */
export function lookingAwayFrame(): Landmark[] {
  return withOverrides({
    ...NEUTRAL_OVERRIDES,
    468: { x: 0.365, y: 0.45, z: 0 },
    473: { x: 0.635, y: 0.45, z: 0 },
  });
}

/** Head pitched down (nose lower) — "looking at your phone." */
export function lookingDownFrame(): Landmark[] {
  return withOverrides({
    ...NEUTRAL_OVERRIDES,
    1: { x: 0.5, y: 0.75, z: 0 },
  });
}

/** Head yawed hard to one side. */
export function headExtremeFrame(): Landmark[] {
  return withOverrides({
    ...NEUTRAL_OVERRIDES,
    1: { x: 0.68, y: 0.53, z: 0 },
  });
}

/**
 * Rotates an entire landmark set by `angleRad` around `pivot` — for testing
 * that head roll doesn't perturb yaw/pitch. Rotates every point (not just
 * the eye-corner pivots used to *measure* roll), matching what an actual
 * physically-tilted head does to every landmark simultaneously.
 */
export function rotateFrame(
  landmarks: Landmark[],
  pivot: { x: number; y: number },
  angleRad: number
): Landmark[] {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return landmarks.map((p) => {
    const dx = p.x - pivot.x;
    const dy = p.y - pivot.y;
    return {
      x: pivot.x + dx * cos - dy * sin,
      y: pivot.y + dx * sin + dy * cos,
      z: p.z,
    };
  });
}
