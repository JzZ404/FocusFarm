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
// Was 216/84/175/52 — stale from before the island was enlarged for the farm
// field (scene.js is now centered at 216,90 with radii 205,82). Kept a ~10px
// art-space margin inside the true coastline so animals don't graze the edge.
const ISLE_CX = 216 * ART_SX;
const ISLE_CY = 90  * ART_SY;
const ISLE_RX = 195 * ART_SX;
const ISLE_RY = 72  * ART_SY;

function inIsland(x: number, y: number): boolean {
  const dx = (x - ISLE_CX) / ISLE_RX;
  const dy = (y - ISLE_CY) / ISLE_RY;
  return dx * dx + dy * dy <= 1;
}

// ── Water effects (ambient twinkle + click ripples) ─────────────────────────
// The water itself is baked into the static bg (flat fill + fixed dither),
// same as everything else — this layer draws animated extras on top each
// frame, same technique as the windmill blades. "Water" here is approximated
// as outside an EXPANDED copy of the true island ellipse (scene.js:
// icx=216,icy=90,rx=205,ry=82). This needs to be bigger than the base
// ellipse, not smaller — isleBase's wobble can bulge the coastline OUTWARD
// by up to ~9% at some angles, not just inward. Shrinking (what this was
// before) only guards the inward case; a sparkle could still land inside an
// outward bulge, which is exactly what was still showing up on grass.
const TRUE_ISLE_RX = 205 * ART_SX * 1.12;
const TRUE_ISLE_RY = 82  * ART_SY * 1.12;
function isWater(x: number, y: number): boolean {
  if (x < 0 || x > OUT_W || y < 0 || y > OUT_H) return false;
  const dx = (x - ISLE_CX) / TRUE_ISLE_RX;
  const dy = (y - ISLE_CY) / TRUE_ISLE_RY;
  return dx * dx + dy * dy > 1;
}

interface Sparkle { x: number; y: number; phase: number; speed: number }
const SPARKLE_COUNT = 140;
function spawnSparkle(): Sparkle {
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * OUT_W, y = Math.random() * OUT_H;
    if (isWater(x, y)) return { x, y, phase: Math.random() * Math.PI * 2, speed: 1.1 + Math.random() * 1.4 };
  }
  return { x: 20, y: 20, phase: 0, speed: 1.3 }; // pathological fallback, never realistically hit
}

interface Ripple { x: number; y: number; t: number }
const RIPPLE_DURATION = 1.4; // seconds

// ── Three-layer depth system ────────────────────────────────────────────────
// Layer 1 (back): the cached bg, plus "rerouted" trees/buildings — animals
//   are simply never allowed to stand in their upper (canopy/roof) portion,
//   so they always look correctly separated. Cheap, but it's avoidance, not
//   real occlusion — the animal walks *around*, never truly behind.
// Layer 2 (middle): the animals, drawn fresh every frame.
// Layer 3 (top): a random subset of eligible bush/tree/crop/building
//   instances are *redrawn on top of the animals* every frame, at their
//   exact baked position. Animals are free to walk anywhere near/under
//   these (no reroute) — the redraw is what hides them, so they genuinely
//   walk behind, not just around. This is what makes the world read as
//   layered/3D instead of everything sitting on one flat plane.
// The split (which instances land in which layer) is picked once via a
// deterministic seeded hash per item, so it's stable across reloads —
// same "random" set every time, matching the scene's fixed seed=7.

function seededChance(name: string, cx: number, baseY: number, probability: number): boolean {
  let h = 0;
  const s = `${name}:${cx}:${baseY}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000 < probability;
}

const TOP_LAYER_CHANCE = 0.3; // ~30% of eligible instances become true top-layer

// Sprite categories eligible for either treatment. Small ground clutter
// (fence, rocks, flowers, etc.) is left alone entirely either way.
const TREE_NAMES = new Set(["tree", "pine", "apple", "bush"]);
const BUILDING_NAMES = new Set(["house", "coop", "barn", "well", "dock", "windmill"]);
const CROP_NAMES = new Set(["wheat", "sprout", "carrot", "crop2", "sunflower"]);

// Fraction of each sprite's height (from the top) used for movement-block
// (layer 1) or occlusion-redraw (layer 3) — same numbers serve both, since
// both are approximating "this part of the object is above ground level".
const BLOCK_FRAC: Record<string, number> = { tree: 0.78, pine: 0.78, apple: 0.78, bush: 0.7 };
function blockFracFor(name: string): number {
  return BLOCK_FRAC[name] ?? 1.0; // buildings/crops: treat the whole sprite as "above ground"
}

// Layer 1: reroute obstacles (trees/buildings NOT chosen for the top layer)
interface Obstacle { x: number; y: number; w: number; h: number; blockFrac: number }
let obstacles: Obstacle[] = [];

function inObstacleArt(xArt: number, yArt: number): boolean {
  return obstacles.some(o => xArt >= o.x && xArt <= o.x + o.w && yArt >= o.y && yArt <= o.y + o.h * o.blockFrac);
}

// Flying species (bee, bat) ignore trees/buildings entirely — they fly over
// canopies and rooftops, only the island's water edge still applies.
const FLYING_SPECIES = new Set(["bee", "bat"]);
function canFly(species: string): boolean {
  return FLYING_SPECIES.has(species);
}

function isWalkable(x: number, y: number, species: string): boolean {
  if (!inIsland(x, y)) return false;
  if (canFly(species)) return true;
  return !inObstacleArt(x / ART_SX, y / ART_SY);
}

function randomInIsland(species: string): { x: number; y: number } {
  for (let i = 0; i < 400; i++) {
    const x = (35 + Math.random() * 360) * ART_SX;
    const y = (28 + Math.random() * 110) * ART_SY;
    if (isWalkable(x, y, species)) return { x, y };
  }
  return { x: ISLE_CX, y: ISLE_CY };
}

// Layer 3: top-layer occlusion items — redrawn on top of animals each frame.
interface TopLayerItem {
  img: HTMLCanvasElement; // pre-rastered at output scale, shared across instances of the same sprite name
  dx: number; dy: number; // output-space top-left of the full sprite
  sw: number; sh: number; // source crop size (top portion only)
  flip: boolean;
}
let topLayerItems: TopLayerItem[] = [];

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
  const p = randomInIsland(species);
  const t = randomInIsland(species);
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

    // Windmill blades — drawn fresh every frame with a rotation transform,
    // on top of the cached static bg (which only has the tower/cap; scene.js
    // exposes where to anchor them). Kept separate from the animal sprites
    // above/below since it never needs y-sorting against them.
    let windmillBlades: HTMLCanvasElement | null = null;
    let windmillHubX = 0, windmillHubY = 0;
    let windmillAngle = 0;
    const WINDMILL_SPEED = 0.9; // rad/s — slow, cozy spin

    // Water: ambient twinkle pool (populated once ready) + click-spawned
    // ripples (grows as the user clicks the water, capped below).
    const sparkles: Sparkle[] = [];
    let ripples: Ripple[] = [];
    const MAX_RIPPLES = 6;

    function handleWaterClick(e: MouseEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      if (!isWater(x, y)) return;
      ripples.push({ x, y, t: 0 });
      if (ripples.length > MAX_RIPPLES) ripples.shift();
    }

    function drawWaterEffects(ctx: CanvasRenderingContext2D, dt: number) {
      const sz = Math.round(ART_SX);
      // twinkling sparkles — same plus-shaped mark and foam color as the
      // static ones already baked into the bg, just animated in alpha.
      ctx.fillStyle = "#d8f0e6"; // COL.foam in scene.js
      for (const s of sparkles) {
        s.phase += dt * s.speed;
        const a = (Math.sin(s.phase) + 1) / 2;
        if (a < 0.08) continue;
        ctx.globalAlpha = a * 0.8;
        const px = Math.round(s.x), py = Math.round(s.y);
        ctx.fillRect(px, py, sz, sz);
        ctx.fillRect(px - sz, py, sz, sz);
        ctx.fillRect(px + sz, py, sz, sz);
        ctx.fillRect(px, py - sz, sz, sz);
        ctx.fillRect(px, py + sz, sz, sz);
      }
      ctx.globalAlpha = 1;

      // click ripples — a dotted ring (hard-edged pixel dots, not a smooth
      // stroked circle, to match the rest of the scene's flat pixel style)
      // expanding and fading out. Squashed vertically to match the
      // pond/water ellipses scene.js already draws (2:1-ish perspective).
      ripples = ripples.filter(r => r.t < RIPPLE_DURATION);
      for (const r of ripples) {
        r.t += dt;
        const t = r.t / RIPPLE_DURATION;
        const radius = (10 + t * 90) * (ART_SX / 8);
        const alpha = (1 - t) * 0.7;
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha;
        const steps = 22;
        for (let i = 0; i < steps; i++) {
          const ang = (i / steps) * Math.PI * 2;
          const px = Math.round(r.x + Math.cos(ang) * radius);
          const py = Math.round(r.y + Math.sin(ang) * radius * 0.55);
          ctx.fillRect(px, py, sz, sz);
        }
      }
      ctx.globalAlpha = 1;
    }

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
        const p = randomInIsland(a.species); a.targetX = p.x; a.targetY = p.y;
        a.moving = false; return;
      }
      const step = a.speed * dt;
      const nx = a.x + dx / dist * step, ny = a.y + dy / dist * step;
      if (isWalkable(nx, ny, a.species)) { a.x = nx; a.y = ny; }
      else { const p = randomInIsland(a.species); a.targetX = p.x; a.targetY = p.y; }
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

      // Water layer — twinkles + click ripples, drawn right after the bg
      // (conceptually still "background", just animated) and before
      // animals/top-layer so it never sits on top of them.
      if (sceneReady) drawWaterEffects(ctx, dt);

      if (atlasReady) {
        if (tilesRef.current.length !== lastTileCount) syncAnimals();
        animals.forEach(a => updateAnimal(a, dt));
        animals.sort((a, b) => a.y - b.y);
        animals.forEach(a => drawAnimal(ctx, a));
      }

      // Layer 3 — redraw the top-layer subset on top of the animals just
      // drawn, so any animal currently under them is hidden (real occlusion,
      // not avoidance). See the "Three-layer depth system" comment above.
      for (const t of topLayerItems) {
        ctx.save();
        if (t.flip) {
          ctx.translate(t.dx + t.sw, t.dy);
          ctx.scale(-1, 1);
          ctx.drawImage(t.img, 0, 0, t.sw, t.sh, 0, 0, t.sw, t.sh);
        } else {
          ctx.drawImage(t.img, 0, 0, t.sw, t.sh, t.dx, t.dy, t.sw, t.sh);
        }
        ctx.restore();
      }

      if (windmillBlades) {
        windmillAngle += dt * WINDMILL_SPEED;
        ctx.save();
        ctx.translate(windmillHubX, windmillHubY);
        ctx.rotate(windmillAngle);
        ctx.drawImage(windmillBlades, -windmillBlades.width / 2, -windmillBlades.height / 2);
        ctx.restore();
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

      // Set canvas dimensions and render the scene
      // @ts-expect-error — FFScene is loaded from public script
      const FFScene = window.FFScene as {
        render: (c: HTMLCanvasElement, o: { seed: number }) => void;
        windmillPlacement?: { cx: number; baseY: number };
        sceneItems?: { name: string; cx: number; baseY: number; flip: boolean }[];
      };
      FFScene.render(canvas!, { seed: 7 });
      sceneReady = true;

      // Windmill blades — scene.js only bakes the static tower/cap into the
      // cached bg; the blades are drawn fresh each frame (see loop()) so
      // they can rotate. Position = scene.js's placement (where the windmill
      // item was added) + sprites.js's local hub offset within that 26×44
      // base sprite, converted art-space -> output-space.
      // @ts-expect-error — FF is loaded from public script (sprites.js)
      const FF = window.FF as {
        raster: (name: string, scale?: number) => HTMLCanvasElement;
        windmillHub: { x: number; y: number };
        dims: (name: string) => { w: number; h: number };
      };
      if (FFScene.windmillPlacement && FF?.windmillHub) {
        const hubArtX = FFScene.windmillPlacement.cx - 13 + FF.windmillHub.x; // 13 = base sprite half-width (26/2)
        const hubArtY = FFScene.windmillPlacement.baseY - 36 + FF.windmillHub.y; // 36 = base sprite height
        windmillHubX = hubArtX * ART_SX;
        windmillHubY = hubArtY * ART_SY;
        windmillBlades = FF.raster("windmillBlades", Math.round(ART_SX));
      }

      // Split eligible trees/buildings/crops between layer 1 (reroute) and
      // layer 3 (top-layer occlusion) — see the module-level comment above.
      if (FFScene.sceneItems && FF?.dims) {
        const rasterCache = new Map<string, HTMLCanvasElement>();
        const rasterOf = (name: string) => {
          let img = rasterCache.get(name);
          if (!img) { img = FF.raster(name, Math.round(ART_SX)); rasterCache.set(name, img); }
          return img;
        };
        const newObstacles: Obstacle[] = [];
        const newTopLayer: TopLayerItem[] = [];
        for (const it of FFScene.sceneItems) {
          const isTree = TREE_NAMES.has(it.name);
          const isBuilding = BUILDING_NAMES.has(it.name);
          const isCrop = CROP_NAMES.has(it.name);
          if (!isTree && !isBuilding && !isCrop) continue;

          if (seededChance(it.name, it.cx, it.baseY, TOP_LAYER_CHANCE)) {
            // Layer 3: no movement restriction at all — the redraw below is
            // what keeps it looking right, so animals can walk freely near it.
            const img = rasterOf(it.name);
            const frac = blockFracFor(it.name);
            const sw = img.width, sh = Math.round(img.height * frac);
            const dx = it.cx * ART_SX - img.width / 2;
            const dy = it.baseY * ART_SY - img.height;
            newTopLayer.push({ img, dx, dy, sw, sh, flip: it.flip });
          } else if (isTree || isBuilding) {
            // Layer 1: reroute, same as before — crops never got this even
            // when not chosen (too small to matter without occlusion).
            const { w, h } = FF.dims(it.name);
            newObstacles.push({ x: it.cx - w / 2, y: it.baseY - h, w, h, blockFrac: blockFracFor(it.name) });
          }
        }
        obstacles = newObstacles;
        topLayerItems = newTopLayer;
      }

      // syncAnimals() (which picks initial animal positions via
      // randomInIsland) must run after obstacles are populated above —
      // it used to run right after the atlas loaded, before the scene had
      // even rendered, so animals could spawn standing on a roof/canopy.
      syncAnimals();

      // Water ambient sparkle pool + click-to-ripple listener.
      for (let i = 0; i < SPARKLE_COUNT; i++) sparkles.push(spawnSparkle());
      canvas!.addEventListener("click", handleWaterClick);

      // Cache background as ImageBitmap for fast redraws
      if (canvas) createImageBitmap(canvas).then(bmp => { bg = bmp; });

      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    }

    init();
    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("click", handleWaterClick);
    };
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
