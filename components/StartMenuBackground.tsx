"use client";

import { useEffect, useRef } from "react";

// Full-bleed procedural background for the starter menu — cottage/forest
// strip. The static part (sky, ground, cottage, trees, fence, sign,
// flowers) is drawn once by public/focusfarm/menuScene.js and cached as an
// ImageBitmap; this component redraws that cached bitmap plus two animated
// layers (drifting clouds, rising chimney smoke) on top every frame. Same
// "cache the static scene, animate overlays on top" split FarmCanvas.tsx
// uses for the windmill blades/water effects.
// Guards against a race: React Strict Mode (on by default in Next.js dev)
// double-invokes effects, so this can run twice back-to-back. Treating "a
// <script> tag with this src already exists" as "already finished
// loading" resolves the second invocation's promise (and its whole .then
// chain) before the first invocation's tag has actually finished loading
// and executing — same bug FarmCanvas.tsx's loadScript had. Track
// completion explicitly instead of inferring it from the tag's presence.
function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") { res(); return; }
      existing.addEventListener("load", () => res());
      existing.addEventListener("error", () => rej());
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => { s.dataset.loaded = "true"; res(); };
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

// Hard-edged pixel circle — same per-pixel fillRect technique sprites.js's
// own circle() helper uses. ctx.arc/ellipse always anti-alias their edges
// regardless of imageSmoothingEnabled (that flag only affects drawImage
// scaling, not path fills), which is why the first pass's clouds/smoke
// looked smooth/soft next to the rest of the hard-edged pixel art. Drawing
// blocky circles like this at the scene's own art resolution (see the fx
// canvas below), then nearest-neighbor-upscaling the whole thing, keeps
// the animated layer pixelated the same way as everything static.
function blockCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  const R = Math.round(r);
  const CX = Math.round(cx), CY = Math.round(cy);
  const R2 = R * R + R * 0.3;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy <= R2) ctx.fillRect(CX + dx, CY + dy, 1, 1);
    }
  }
}

// A few different blob arrangements so clouds don't all look identical,
// just scaled.
const CLOUD_VARIANTS: [number, number, number][][] = [
  [[0, 0, 10], [8, -3, 7], [-9, -2, 7], [4, 4, 8], [-5, 4, 7]],
  [[0, 0, 9], [7, 2, 6], [-7, 1, 7], [-2, -4, 6], [3, -3, 5]],
  [[0, 0, 8], [9, -1, 6], [-6, 3, 6], [2, 5, 7], [-9, 4, 5]],
  [[0, 0, 11], [10, 0, 6], [-10, -1, 6], [3, 5, 8], [-4, -4, 6]],
];

function drawCloud(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, variant: number) {
  const blobs = CLOUD_VARIANTS[variant % CLOUD_VARIANTS.length];
  for (const [dx, dy, r] of blobs) {
    blockCircle(ctx, cx + (dx * s) / 10, cy + (dy * s) / 10, (r * s) / 10, "#fdfefe");
  }
}

interface Cloud {
  x: number;
  y: number;
  scale: number;
  variant: number;
  speed: number; // art-units/sec, drifts right and wraps
}

const SMOKE_COUNT = 4;
const SMOKE_DURATION = 3.2; // seconds per puff's rise-and-fade cycle

function drawSmoke(ctx: CanvasRenderingContext2D, originX: number, originY: number, elapsed: number) {
  for (let i = 0; i < SMOKE_COUNT; i++) {
    const phase = (((elapsed / SMOKE_DURATION) + i / SMOKE_COUNT) % 1 + 1) % 1;
    const rise = phase * 34;
    const wobble = Math.sin(phase * Math.PI * 3 + i * 1.7) * 3.5;
    const size = 2 + phase * 3.5;
    const alpha = phase < 0.12 ? phase / 0.12 : 1 - (phase - 0.12) / 0.88;
    blockCircle(ctx, originX + wobble, originY - rise, size, `rgba(230,233,231,${Math.max(0, alpha * 0.85).toFixed(3)})`);
  }
}

export default function StartMenuBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let onMotionChange: (() => void) | undefined;
    let media: MediaQueryList | undefined;

    (async () => {
      await loadScript("/focusfarm/sprites.js").then(() =>
        loadScript("/focusfarm/menuScene.js")
      );
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;

      // @ts-expect-error — FFMenuScene is loaded from the public script above
      const FFMenuScene = window.FFMenuScene as {
        render: (c: HTMLCanvasElement, o: { seed: number }) => void;
        OUT_W: number;
        OUT_H: number;
        ART_S: number;
        groundY: number;
        smokeOrigin: { x: number; y: number };
      };
      FFMenuScene.render(canvas, { seed: 11 });
      const smokeOrigin = FFMenuScene.smokeOrigin;
      const ART_S = FFMenuScene.ART_S;
      const AW = FFMenuScene.OUT_W / ART_S;
      const AH = FFMenuScene.OUT_H / ART_S;

      // Snapshot the static scene we just drew — every frame below just
      // re-blits this instead of re-running the whole procedural draw.
      const bg = await createImageBitmap(canvas);
      if (cancelled) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Animated overlay is composed at the scene's own low art resolution
      // (not the 4x-upscaled output canvas) so blockCircle's pixels are
      // full art-space units — then the whole fx layer gets one
      // nearest-neighbor drawImage upscale onto the main canvas, same as
      // the static background did.
      const fx = document.createElement("canvas");
      fx.width = AW; fx.height = AH;
      const fxCtx = fx.getContext("2d");
      if (!fxCtx) return;
      fxCtx.imageSmoothingEnabled = false;

      const clouds: Cloud[] = [
        { x: 60, y: 40, scale: 12, variant: 0, speed: 3.2 },
        { x: 220, y: 26, scale: 9, variant: 1, speed: 4.6 },
        { x: 350, y: 55, scale: 14, variant: 2, speed: 2.6 },
        { x: 430, y: 32, scale: 8, variant: 3, speed: 5.4 },
      ];

      const start = performance.now();
      let last = start;

      function drawFrame(elapsed: number, dt: number) {
        fxCtx!.clearRect(0, 0, AW, AH);
        for (const cl of clouds) {
          cl.x += cl.speed * dt;
          const wrapAt = AW + cl.scale * 1.4;
          if (cl.x > wrapAt) cl.x = -cl.scale * 1.4;
          drawCloud(fxCtx!, cl.x, cl.y, cl.scale, cl.variant);
        }
        if (smokeOrigin) drawSmoke(fxCtx!, smokeOrigin.x, smokeOrigin.y, elapsed);

        ctx!.imageSmoothingEnabled = false;
        ctx!.drawImage(bg, 0, 0);
        ctx!.drawImage(fx, 0, 0, AW, AH, 0, 0, FFMenuScene.OUT_W, FFMenuScene.OUT_H);
      }

      function loop(now: number) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        drawFrame((now - start) / 1000, dt);
        rafId = requestAnimationFrame(loop);
      }

      // Respect prefers-reduced-motion (WCAG 2.2.2 Pause/Stop/Hide covers
      // exactly this: non-essential auto-updating motion that starts on
      // its own and runs indefinitely) — draw one static frame (clouds in
      // their starting spots, smoke mid-puff) instead of animating
      // forever. Live-listens for the setting changing while the page is
      // open, not just its value at mount.
      media = window.matchMedia("(prefers-reduced-motion: reduce)");
      onMotionChange = () => {
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        last = performance.now();
        if (media!.matches) drawFrame(0, 0);
        else rafId = requestAnimationFrame(loop);
      };
      onMotionChange();
      media.addEventListener("change", onMotionChange);
    })();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (media && onMotionChange) media.removeEventListener("change", onMotionChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      // absolute (not fixed) so it's contained by the page's relative+
      // isolate parent — see the comment there for why that containment
      // matters (a fixed/negative-z canvas under a plain non-positioned
      // parent escapes to the root stacking context and renders behind
      // that parent's own background instead of just behind its content).
      className="absolute inset-0 -z-10 h-full w-full"
      style={{ objectFit: "cover", imageRendering: "pixelated" }}
    />
  );
}
