"use client";

import { useEffect, useRef } from "react";

// ── Shared module-level atlas cache (loaded once per page session) ─────────────
interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}

let _img: HTMLImageElement | null = null;
let _frames: Record<string, AtlasFrame> | null = null;
let _promise: Promise<void> | null = null;
const _listeners: Array<() => void> = [];

function loadAtlas(): Promise<void> {
  if (_promise) return _promise;
  _promise = Promise.all([
    fetch("/animals/atlas.json").then((r) => r.json()),
    new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = "/animals/atlas.png";
    }),
  ])
    .then(([json, img]) => {
      _frames = json.frames as Record<string, AtlasFrame>;
      _img = img;
      _listeners.forEach((fn) => fn());
    })
    .catch(() => {});
  return _promise;
}

// ── Map shop item ID → atlas species name ─────────────────────────────────────
function toSpecies(itemId: string): string {
  const slug = itemId.replace(/^animal_/, "");
  const MAP: Record<string, string> = {
    shiba_dog: "dog",
    shiba: "dog",
  };
  return MAP[slug] ?? slug;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  itemId: string;  // e.g. "animal_sheep"
  size?: number;   // display size in px (default 64)
}

export default function AtlasAnimalIcon({ itemId, size = 64 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const species = toSpecies(itemId);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas || !_img || !_frames) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const data = _frames[`${species}/frontIdle`];
    if (!data) return;

    ctx.clearRect(0, 0, size, size);

    // Center the TRIMMED frame in the icon, ignoring the original sprite-cell
    // padding (spriteSourceSize / sourceSize). This guarantees the animal
    // pixels are visually centered regardless of how the artist composed the
    // cell — animals tucked in a corner of their cell no longer appear off-axis,
    // and smaller animals scale up to fill the icon instead of leaving padding.
    const { frame: f } = data;
    const scale = Math.min(size / f.w, size / f.h) * 0.9;
    const drawW = f.w * scale;
    const drawH = f.h * scale;
    const drawX = (size - drawW) / 2;
    const drawY = (size - drawH) / 2;
    ctx.drawImage(_img, f.x, f.y, f.w, f.h, drawX, drawY, drawW, drawH);
  }

  useEffect(() => {
    if (_img && _frames) {
      draw();
    } else {
      // Register listener so we redraw once atlas loads
      _listeners.push(draw);
      loadAtlas().then(draw);
      return () => {
        const idx = _listeners.indexOf(draw);
        if (idx !== -1) _listeners.splice(idx, 1);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [species, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ imageRendering: "pixelated", display: "block" }}
      aria-hidden="true"
    />
  );
}
