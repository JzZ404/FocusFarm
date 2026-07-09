"use client";

import { useEffect, useRef } from "react";
import { useFarm } from "@/context/FarmContext";

// ── Output resolution from scene.js ──────────────────────────────────────────
const OUT_W = 3455;
const OUT_H = 1280;

// Art-to-output scale (art is 432×160, upscaled 8×)
const ART_SX = OUT_W / 432; // 8.0
const ART_SY = OUT_H / 160; // 8.0

// ── Island roaming bounds (art-space ellipse scaled to output) ────────────────
const ISLE_CX = 216 * ART_SX;
const ISLE_CY = 84  * ART_SY;
const ISLE_RX = 175 * ART_SX;
const ISLE_RY = 52  * ART_SY;

function inIsland(x: number, y: number): boolean {
  const dx = (x - ISLE_CX) / ISLE_RX;
  const dy = (y - ISLE_CY) / ISLE_RY;
  return dx * dx + dy * dy <= 1;
}

function randomInIsland(): { x: number; y: number } {
  for (let i = 0; i < 400; i++) {
    const x = (35 + Math.random() * 360) * ART_SX;
    const y = (28 + Math.random() * 110) * ART_SY;
    if (inIsland(x, y)) return { x, y };
  }
  return { x: ISLE_CX, y: ISLE_CY };
}

// ── Atlas frame types ─────────────────────────────────────────────────────────
interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}
interface AtlasJson { frames: Record<string, AtlasFrame> }

// ── Atlas module-level cache ──────────────────────────────────────────────────
let _atlasImg:    HTMLImageElement | null = null;
let _atlasFrames: Record<string, AtlasFrame> | null = null;
let _atlasPromise: Promise<void> | null = null;

function loadAtlas(): Promise<void> {
  if (_atlasPromise) return _atlasPromise;
  _atlasPromise = Promise.all([
    fetch("/animals/atlas.json").then(r => r.json() as Promise<AtlasJson>),
    new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image(); img.onload = () => res(img); img.onerror = rej;
      img.src = "/animals/atlas.png";
    }),
  ]).then(([json, img]) => { _atlasFrames = json.frames; _atlasImg = img; }).catch(() => {});
  return _atlasPromise;
}

// ── Map shop item IDs → atlas species ─────────────────────────────────────────
function animalKey(itemId: string): string {
  const slug = itemId.replace(/^animal_/, "");
  const MAP: Record<string, string> = { shiba_dog: "dog", shiba: "dog", cat: "raccoon" };
  return MAP[slug] ?? slug;
}

// ── Animal scale in the 3455×1280 output canvas ───────────────────────────────
function animalScale(species: string): number {
  if (["elephant", "lion", "cow"].includes(species)) return 0.50;
  if (["bee", "bat"].includes(species)) return 0.42;
  return 0.55;
}

// ── Per-animal runtime state ──────────────────────────────────────────────────
interface Animal {
  id: string; species: string;
  x: number; y: number;
  targetX: number; targetY: number;
  facing: "front" | "left" | "right" | "back";
  moving: boolean;
  frameTime: number; walkToggle: boolean;
  speed: number; wait: number; moveInterval: number;
}

function makeAnimal(id: string, species: string): Animal {
  const p = randomInIsland();
  const t = randomInIsland();
  return {
    id, species, x: p.x, y: p.y, targetX: t.x, targetY: t.y,
    facing: "front", moving: false, frameTime: 0, walkToggle: false,
    speed: (9 + Math.random() * 7) * ART_SX,   // ~64-128 output px/s → gentle stroll
    wait: Math.random() * 1.5,
    moveInterval: 1.5 + Math.random() * 2.5,
  };
}

function getStateName(a: Animal): string {
  if (!a.moving) return `${a.facing}Idle`;
  if (a.facing === "front") return a.walkToggle ? "frontStep" : "frontIdle";
  return `${a.facing}${a.walkToggle ? "Walk" : "Idle"}`;
}

// ── Script loader ─────────────────────────────────────────────────────────────
function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = () => res(); s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FarmCanvas() {
  const { farm } = useFarm();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tilesRef  = useRef(farm.tiles);
  tilesRef.current = farm.tiles;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId: number;
    let bg: ImageBitmap | null = null;
    let animals: Animal[] = [];
    let lastTileCount = 0;
    let lastTime = performance.now();
    let sceneReady = false;
    let atlasReady  = false;

    function syncAnimals() {
      const tiles = tilesRef.current;
      const existingIds = new Set(animals.map(a => a.id));
      const tileIds = new Set(tiles.map(t => t.id));
      animals = animals.filter(a => tileIds.has(a.id));
      for (const tile of tiles) {
        if (!existingIds.has(tile.id) && _atlasFrames) {
          const species = animalKey(tile.itemId);
          if (_atlasFrames[`${species}/frontIdle`]) {
            animals.push(makeAnimal(tile.id, species));
          }
        }
      }
      lastTileCount = tiles.length;
    }

    function updateAnimal(a: Animal, dt: number) {
      if (a.wait > 0) { a.wait -= dt; a.moving = false; return; }
      const dx = a.targetX - a.x, dy = a.targetY - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        a.wait = Math.random() * 1.8;
        a.moveInterval = 1.5 + Math.random() * 2.5;
        const p = randomInIsland(); a.targetX = p.x; a.targetY = p.y;
        a.moving = false; return;
      }
      const step = a.speed * dt;
      const nx = a.x + dx / dist * step, ny = a.y + dy / dist * step;
      if (inIsland(nx, ny)) { a.x = nx; a.y = ny; }
      else { const p = randomInIsland(); a.targetX = p.x; a.targetY = p.y; }
      a.moving = true;
      if (Math.abs(dx) > Math.abs(dy)) a.facing = dx > 0 ? "right" : "left";
      else a.facing = dy > 0 ? "front" : "back";
      a.frameTime += dt;
      if (a.frameTime > 1 / 4) { a.walkToggle = !a.walkToggle; a.frameTime = 0; }
    }

    function drawAnimal(ctx: CanvasRenderingContext2D, a: Animal) {
      if (!_atlasImg || !_atlasFrames) return;
      const state = getStateName(a);
      const data  = _atlasFrames[`${a.species}/${state}`] ?? _atlasFrames[`${a.species}/frontIdle`];
      if (!data) return;
      const { frame: f, spriteSourceSize: sss, sourceSize: ss } = data;
      const scale = animalScale(a.species);
      const dx = a.x - ss.w * scale / 2 + sss.x * scale;
      const dy = a.y - ss.h * scale + sss.y * scale;
      ctx.drawImage(_atlasImg, f.x, f.y, f.w, f.h, dx, dy, f.w * scale, f.h * scale);
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (!sceneReady || !canvas) { rafId = requestAnimationFrame(loop); return; }

      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      ctx.imageSmoothingEnabled = false;

      // Draw background
      if (bg) ctx.drawImage(bg, 0, 0);

      if (atlasReady) {
        if (tilesRef.current.length !== lastTileCount) syncAnimals();
        animals.forEach(a => updateAnimal(a, dt));
        animals.sort((a, b) => a.y - b.y);
        animals.forEach(a => drawAnimal(ctx, a));
      }

      rafId = requestAnimationFrame(loop);
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────
    async function init() {
      // Load scene scripts and atlas in parallel
      await Promise.all([
        loadScript("/focusfarm/sprites.js")
          .then(() => loadScript("/focusfarm/scene.js")),
        loadAtlas(),
      ]);

      atlasReady = true;
      syncAnimals();

      // Set canvas dimensions and render the scene
      // @ts-expect-error — FFScene is loaded from public script
      const FFScene = window.FFScene as { render: (c: HTMLCanvasElement, o: {seed:number}) => void };
      FFScene.render(canvas!, { seed: 7 });
      sceneReady = true;

      // Cache background as ImageBitmap for fast redraws
      if (canvas) createImageBitmap(canvas).then(bmp => { bg = bmp; });

      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    }

    init();
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Focus Farm"
      style={{
        display: "block",
        /* Fill container width, height scales proportionally — responsive */
        width: "100%",
        height: "auto",
        imageRendering: "pixelated",
      }}
    />
  );
}
