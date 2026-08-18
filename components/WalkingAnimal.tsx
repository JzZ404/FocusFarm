"use client";

import { useEffect, useRef } from "react";
import { loadAtlas, getAtlasImage, getAtlasFrames } from "@/lib/spriteAtlas";

const SPEED = 34;           // px/s
const DEFAULT_MARGIN = 18;  // px kept clear at each edge, unless overridden
const ARRIVE_EPS = 2;       // px — close enough to target to count as "arrived"
const TURN_PAUSE = 0.35;    // seconds paused at a turnaround before picking a new target
const WALK_FRAME_TIME = 1 / 4; // seconds per walk-cycle frame swap

interface WalkingAnimalProps {
  /** Atlas species key, e.g. "raccoon", "fox" — must have leftWalk/leftIdle/
   *  rightWalk/rightIdle frames (see public/animals/atlas.json). */
  species: string;
  /** Rendered sprite height in px. Default 36. */
  displayHeight?: number;
  /** Px kept clear on the left before turning around. Default 18. */
  marginLeft?: number;
  /** Px kept clear on the right before turning around. Default 18. */
  marginRight?: number;
}

// Small patrol overlay — walks toward a random point within its bounds,
// pauses, picks a new random point (possibly a short hop, possibly the
// far edge), and repeats, using the same sprite atlas as FarmCanvas.
// Meant to sit as an absolutely-positioned layer over a specific region
// (e.g. the starter menu logo) — sizes itself to fill its positioned parent.
// Species is a prop (not hardcoded) since this has already been swapped
// more than once — cheap to swap again without touching this file.
export default function WalkingAnimal({
  species,
  displayHeight = 36,
  marginLeft = DEFAULT_MARGIN,
  marginRight = DEFAULT_MARGIN,
}: WalkingAnimalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId: number;
    let ready = false;
    let width = 0;
    let height = 0;
    let x = 0;
    let targetX = 0;
    let facing: "left" | "right" = "right";
    let walkToggle = false;
    let frameTime = 0;
    let pause = 0;
    let lastTime = performance.now();

    function bounds() {
      return { minX: marginLeft, maxX: Math.max(marginLeft, width - marginRight) };
    }

    function pickTarget() {
      const { minX, maxX } = bounds();
      targetX = minX + Math.random() * (maxX - minX);
      facing = targetX >= x ? "right" : "left";
    }

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = width;
      canvas!.height = height;
      const { minX, maxX } = bounds();
      if (x === 0) x = minX + Math.random() * (maxX - minX); // first run
      x = Math.min(Math.max(x, minX), maxX);
      pickTarget();
    }

    function render() {
      if (!ready || width <= 0) return;
      const ctx = canvas!.getContext("2d") as CanvasRenderingContext2D;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width, height);

      const frames = getAtlasFrames();
      const img = getAtlasImage();
      if (frames && img) {
        const state = pause > 0 ? `${facing}Idle` : `${facing}${walkToggle ? "Walk" : "Idle"}`;
        const data = frames[`${species}/${state}`] ?? frames[`${species}/${facing}Idle`];
        if (data) {
          const { frame: f, spriteSourceSize: sss, sourceSize: ss } = data;
          const scale = displayHeight / ss.h;
          const dw = f.w * scale;
          const dh = f.h * scale;
          const dx = x - (ss.w * scale) / 2 + sss.x * scale;
          const dy = height - dh; // feet on the bottom edge of the layer
          ctx.drawImage(img, f.x, f.y, f.w, f.h, dx, dy, dw, dh);
        }
      }
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (pause > 0) {
        pause -= dt;
        if (pause <= 0) pickTarget();
      } else if (Math.abs(targetX - x) <= ARRIVE_EPS) {
        pause = TURN_PAUSE;
      } else {
        const step = SPEED * dt;
        x += facing === "right" ? Math.min(step, targetX - x) : -Math.min(step, x - targetX);
        frameTime += dt;
        if (frameTime > WALK_FRAME_TIME) { walkToggle = !walkToggle; frameTime = 0; }
      }
      render();

      rafId = requestAnimationFrame(loop);
    }

    // Respect prefers-reduced-motion (WCAG 2.2.2) — the patrol is
    // non-essential auto-updating motion that starts on its own and never
    // stops, so a reduced-motion user gets one still idle frame instead of
    // a chicken pacing back and forth indefinitely. Live-listens for the
    // setting changing while the page is open.
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    function applyMotionPreference() {
      if (rafId) cancelAnimationFrame(rafId);
      lastTime = performance.now();
      if (media.matches) render();
      else rafId = requestAnimationFrame(loop);
    }

    async function init() {
      resize();
      await loadAtlas();
      ready = true;
      applyMotionPreference();
    }

    window.addEventListener("resize", resize);
    media.addEventListener("change", applyMotionPreference);
    init();
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      media.removeEventListener("change", applyMotionPreference);
    };
  }, [species, displayHeight, marginLeft, marginRight]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    />
  );
}
