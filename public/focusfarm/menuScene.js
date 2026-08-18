/* FocusFarm — starter-menu background scene.
   A side-view cottage/forest strip (sky, grass-on-soil ground, mushroom
   cottage, pines, fence, signpost, flowers) in the same procedural,
   zero-image-asset style as public/focusfarm/scene.js — different
   composition (flat side view, not the top-down farm island) but reuses
   sprites.js's PAL/sprite techniques and even a few of its actual sprites
   (S.pine, S.fence, S.sign, S.flowers, S.rock) directly.
   This module draws the STATIC layer only (everything that doesn't move).
   Clouds and chimney smoke are animated per-frame by
   components/StartMenuBackground.tsx on top of this — see the smokeOrigin/
   groundY/ART_S it reads off window.FFMenuScene after render() runs.
   Requires sprites.js (window.FF) loaded first.
   Usage: FFMenuScene.render(canvasEl, { seed: 11 }); */
(function () {
  const AW = 480, AH = 270;   // art-pixel resolution (16:9)
  const OUT_W = 1920, OUT_H = 1080;
  const ART_S = OUT_W / AW;   // 4

  // Native offset of the chimney's top opening within buildMushroomCottage's
  // own canvas (see sprites.js) — used below to compute smokeOrigin once we
  // know where the cottage itself is actually placed.
  const CHIMNEY_TOP = { x: 6.5, y: 22 };

  function makeRng(seed) {
    let s = seed || 11;
    return {
      f() { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; },
      i(a, b) { return Math.floor(a + this.f() * (b - a + 1)); },
    };
  }

  function render(canvas, opts) {
    opts = opts || {};
    const FF = window.FF;
    const rng = makeRng(opts.seed || 11);
    const f = () => rng.f(), ri = (a, b) => rng.i(a, b);

    const art = document.createElement('canvas');
    art.width = AW; art.height = AH;
    const c = art.getContext('2d');
    c.imageSmoothingEnabled = false;

    // Was 196, then raised to 165 (too much ground), then eased down to
    // 190 — still too much ground relative to the sky/scenery, so this
    // brings it down further still.
    const groundY = 210;

    // ---- sky (soft gradient, cheerful but muted — not the reference's
    // saturated cyan) ----
    const grad = c.createLinearGradient(0, 0, 0, groundY);
    grad.addColorStop(0, '#a9d3e6'); grad.addColorStop(1, '#dcf0f2');
    c.fillStyle = grad; c.fillRect(0, 0, AW, groundY);

    // ---- ground: 3 stacked layers, each edge treated differently on
    // purpose (not two matching scalloped edges):
    //  - grass/soil boundary: flat and mostly straight, just a little
    //    pixel-level jitter — grass is a thin, continuous, flat strip.
    //  - soil/underground boundary: genuinely chunky/jagged, stepped
    //    random blocks (not a smooth repeating wave) — "chunky pixelated
    //    peaks and dips."
    // Colors pulled from our own established tokens (--grass-a, --soil,
    // scene.js's soilD/soilL) instead of the more saturated reference-
    // matched hexes from the previous pass; the underground blue-grey and
    // the outline brown are new but built to sit in the same
    // muted/desaturated register as the rest of the palette. ----
    function dot(cx, cy, w, h, color) { c.fillStyle = color; c.fillRect(cx, cy, w, h); }
    const OUTLINE = '#4f4034'; // PAL's own "soft outline" brown, not flat black
    const GRASS = '#6aaa35';   // --grass-a
    const SOIL = '#c8a46e', SOIL_DARK = '#ab7e54', SOIL_LIGHT = '#e8cca0'; // --soil + scene.js soilD/soilL
    const ROCK = '#7f8fa0', ROCK_DARK = '#5f6f80', ROCK_LIGHT = '#a3b0bd'; // new muted blue-grey family
    const OUTLINE_H = 2;
    const dirtBase = groundY + 8;         // thin grass band
    const rockBaseNominal = dirtBase + 26; // soil band's nominal thickness — actual bottom edge wobbles around this

    // grass/soil: flat, with sparse 1px dips only (deterministic per-x hash
    // so it's stable without needing to precompute an array)
    function grassEdge(x) {
      const h = Math.abs(Math.sin(Math.floor(x / 11) * 12.9898) * 43758.5453) % 1;
      return h < 0.35 ? 1 : 0;
    }
    // soil/underground: chunky stepped jaggedness — a random walk held
    // constant across each ~13px segment, so edges jump between flat
    // "steps" instead of a smooth curve.
    const SEG_W = 13;
    const rockLevels = [];
    let lvl = 0;
    for (let i = 0; i < Math.ceil(AW / SEG_W) + 2; i++) {
      lvl = Math.max(-3, Math.min(6, lvl + ri(-3, 3)));
      rockLevels.push(lvl);
    }

    for (let x = 0; x < AW; x++) {
      const dirtEdge = dirtBase + grassEdge(x);
      const rockEdge = rockBaseNominal + rockLevels[Math.floor(x / SEG_W)];

      c.fillStyle = GRASS; c.fillRect(x, groundY, 1, dirtEdge - groundY);

      c.fillStyle = OUTLINE; c.fillRect(x, dirtEdge, 1, OUTLINE_H);
      c.fillStyle = SOIL; c.fillRect(x, dirtEdge + OUTLINE_H, 1, rockEdge - dirtEdge - OUTLINE_H);

      c.fillStyle = OUTLINE; c.fillRect(x, rockEdge, 1, OUTLINE_H);
      c.fillStyle = ROCK; c.fillRect(x, rockEdge + OUTLINE_H, 1, AH - rockEdge - OUTLINE_H);
    }
    // soil texture: sparse darker AND lighter patches (rocks/dirt
    // variation) — kept well clear of the wobbly boundaries on both sides
    // so a patch never lands outside its layer.
    for (let i = 0; i < 34; i++) {
      const x = ri(2, AW - 3), y = ri(dirtBase + OUTLINE_H + 4, rockBaseNominal - 6);
      dot(x, y, ri(1, 2), ri(1, 2), f() < 0.5 ? SOIL_DARK : SOIL_LIGHT);
    }
    // underground texture: sparse lighter AND darker blue-gray patches
    for (let i = 0; i < 34; i++) {
      const x = ri(2, AW - 3), y = ri(rockBaseNominal + 10, AH - 3);
      dot(x, y, ri(1, 2), ri(1, 2), f() < 0.5 ? ROCK_DARK : ROCK_LIGHT);
    }

    // ---- sprites ----
    function draw(name, cx, baseY, scale, opt) {
      opt = opt || {};
      const s = FF.raster(name, scale || 2);
      const w = s.width, h = s.height;
      const x = Math.round(cx - w / 2), y = Math.round(baseY - h);
      if (opt.flip) { c.save(); c.translate(x + w, y); c.scale(-1, 1); c.drawImage(s, 0, 0); c.restore(); }
      else c.drawImage(s, x, y);
    }
    // Trees drawn via makeFoliage (S.pine/tree/apple) hide almost their
    // whole trunk behind the bottom canopy blob by design — fine for the
    // farm's top-down view, but in this side-on scene it reads as a canopy
    // floating with no trunk. Draw an explicit trunk stub first, then sit
    // the canopy sprite on top of it with a few px of overlap so the join
    // is seamless (its own near-invisible trunk stub blends into the top
    // of this one).
    function drawTree(name, cx, groundBaseY, scale, opt) {
      const trunkH = Math.round(5 * scale), trunkW = Math.max(2, Math.round(1.6 * scale));
      c.fillStyle = '#8a5e3c';
      c.fillRect(Math.round(cx - trunkW / 2), Math.round(groundBaseY - trunkH), trunkW, trunkH);
      c.fillStyle = '#6a4626';
      c.fillRect(Math.round(cx - trunkW / 2), Math.round(groundBaseY - trunkH), 1, trunkH);
      draw(name, cx, groundBaseY - trunkH + 3, scale, opt);
    }

    // cottage (left, per the reference) + short fence run beside it, then a
    // small background pine — all left of x=155.
    const cottageCx = 78, cottageScale = 2;
    draw('mushroomCottage', cottageCx, groundY, cottageScale);
    // S.fence's own grid has a blank bottom row (its content ends 1 native
    // row above the sprite's own bottom edge, which is what baseY anchors)
    // — without the +2 (1 row * scale 2) the fence renders floating 2px
    // above the actual grass line.
    draw('fence', 148, groundY + 2, 2);
    draw('fence', 180, groundY + 2, 2);
    drawTree('pine', 112, groundY, 2);

    // x=155–325 is deliberately kept clear of tall scenery — that's roughly
    // where the title text and the button column sit on top of this
    // background (see app/page.tsx), and a tree poking up from behind them
    // read as a visual glitch rather than depth.
    // All three pines share the exact same groundY (no +/- jitter) — a
    // vertical offset here used to shift the whole tree (trunk included)
    // above/below the actual grass line, which is what made them look like
    // they were floating instead of standing on the ground.
    drawTree('pine', 352, groundY, 3);
    drawTree('pine', 398, groundY, 2);

    // signpost + a couple of rocks at its base (right side, per the reference)
    draw('rock', 418, groundY + 6, 2);
    draw('sign', 450, groundY + 6, 2);
    draw('rock', 468, groundY + 4, 2, { flip: true });

    // flowers scattered along the grass line — kept clear of the sign+rock
    // cluster at x=406-480 (the last one used to sit at x=440, right on
    // top of the sign at x=450).
    draw('flowers', 18, groundY + 8, 2);
    draw('flowers', 210, groundY + 6, 2, { flip: true });
    draw('flowers', 270, groundY + 9, 2);
    draw('flowers', 310, groundY + 5, 2, { flip: true });
    draw('flowers', 240, groundY + 4, 2, { flip: true });

    // ---- upscale to output canvas ----
    canvas.width = OUT_W; canvas.height = OUT_H;
    const oc = canvas.getContext('2d');
    oc.imageSmoothingEnabled = false;
    oc.drawImage(art, 0, 0, AW, AH, 0, 0, OUT_W, OUT_H);

    // ---- expose static facts the animation layer needs ----
    const dims = FF.dims('mushroomCottage');
    window.FFMenuScene.groundY = groundY;
    window.FFMenuScene.smokeOrigin = {
      x: (cottageCx - (dims.w * cottageScale) / 2) + CHIMNEY_TOP.x * cottageScale,
      y: (groundY - dims.h * cottageScale) + CHIMNEY_TOP.y * cottageScale,
    };

    return canvas;
  }

  window.FFMenuScene = { render, OUT_W, OUT_H, ART_S };
})();
