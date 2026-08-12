/* FocusFarm — original cozy pixel sprite library.
   Sprites authored as pixel grids (one char = one pixel). ' ' = transparent.
   Rendered to canvas at integer scale, served as crisp data URLs. */
(function () {
  const PAL = {
    ' ': null,
    'x': '#4f4034', // soft outline
    'l': '#96c76b', // leaf
    'L': '#bbdf92', // leaf light
    'k': '#74a857', // leaf dark
    'e': '#dcefb6', // grass accent / leaf highlight
    't': '#b58a5b', // trunk
    'T': '#8c6038', // trunk dark
    's': '#d8b489', // soil
    'S': '#b3865c', // soil dark
    'w': '#bd8d5d', // wood
    'W': '#dcb888', // wood light
    'o': '#8a5e40', // wood dark
    'r': '#8f7aa8', // roof (soft periwinkle)
    'R': '#6b577f', // roof dark
    'P': '#b3a3cc', // roof light
    'n': '#f0d9aa', // wall cream
    'N': '#fbeece', // wall light
    'F': '#fbf8ee', // white
    'm': '#f7d96a', // gold
    'M': '#dab24a', // gold dark
    'y': '#f3e07a', // flower yellow
    'q': '#f2adc0', // pink
    'Q': '#fad3de', // pink light
    'z': '#e88575', // red comb
    'j': '#e7ad58', // beak / feet
    'b': '#a8d8c6', // water
    'B': '#cdeadc', // water light
    'a': '#b6c6b8', // stone
    'A': '#85998c', // stone dark
    'g': '#74a857', // stem
    'G': '#9ccb6f', // stem light
    'c': '#ee9a52', // carrot
    'C': '#f6b46f', // carrot light
    'v': '#e8645a', // berry red
    'u': '#86b9bc', // window glass
    'U': '#c8e6e5', // window light
  };

  const S = {};

  // ---------- procedural foliage (round, soft, multi-tone) ----------
  const FOL = {
    X: '#5a7d44', k: '#74a857', l: '#96c76b', L: '#bbdf92', e: '#dcefb6',
    Xp: '#4f6f3e', kp: '#699c4f', lp: '#86bb60', Lp: '#aad683', // pine (a touch deeper)
    t: '#b58a5b', T: '#8c6038',
  };
  function makeFoliage(spec) {
    let cached = null;
    function build() {
      const w = spec.w, h = spec.h;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      const set = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
      const blobs = spec.blobs;
      const inside = (x, y) => { for (const b of blobs) { const dx = x - b.x, dy = y - b.y; if (dx * dx + dy * dy <= b.r * b.r) return true; } return false; };
      let minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9;
      blobs.forEach((b) => { minY = Math.min(minY, b.y - b.r); maxY = Math.max(maxY, b.y + b.r); minX = Math.min(minX, b.x - b.r); maxX = Math.max(maxX, b.x + b.r); });
      const pine = !!spec.pine;
      const C = pine ? { X: FOL.Xp, k: FOL.kp, l: FOL.lp, L: FOL.Lp, e: FOL.e } : FOL;
      // trunk first (canopy overlaps it)
      if (spec.trunk) {
        const tr = spec.trunk;
        for (let y = tr.y; y < tr.y + tr.h; y++) for (let x = tr.x; x < tr.x + tr.w; x++) {
          set(x, y, (x === tr.x + tr.w - 1 && tr.w > 1) ? FOL.T : FOL.t);
        }
      }
      // canopy
      const hl = spec.hl || { x: minX + (maxX - minX) * 0.34, y: minY + (maxY - minY) * 0.28, r: (maxX - minX) * 0.22 };
      for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(h - 1, Math.ceil(maxY)); y++) {
        for (let x = Math.max(0, Math.floor(minX)); x <= Math.min(w - 1, Math.ceil(maxX)); x++) {
          if (!inside(x, y)) continue;
          const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
          if (edge) { set(x, y, C.X); continue; }
          const ny = (y - minY) / (maxY - minY), nx = (x - minX) / (maxX - minX);
          let b = (1 - ny) * 0.72 + (1 - nx) * 0.28;
          if (Math.hypot(x - hl.x, y - hl.y) < hl.r) b += 0.26;
          set(x, y, b > 0.82 ? C.e : b > 0.6 ? C.L : b > 0.36 ? C.l : C.k);
        }
      }
      // little shadow under canopy edge
      if (!pine) for (let x = Math.floor(minX) + 2; x < maxX - 1; x++) { if (inside(x, Math.floor(maxY) - 1)) set(x, Math.floor(maxY), C.k); }
      // dots (apples / blossoms / berries)
      if (spec.dots) spec.dots.forEach((d) => { if (inside(d.x, d.y)) { set(d.x, d.y, d.c); if (d.hi) set(d.x, d.y - 1, '#fff6ef'); if (d.lo && inside(d.x, d.y + 1)) set(d.x, d.y + 1, d.lo); } });
      cached = cv; return cv;
    }
    const fn = () => cached || build();
    fn.__w = spec.w; fn.__h = spec.h; fn.__proc = true;
    return fn;
  }

  // ---- ROUND OAK TREE 21x24 ----
  S.tree = makeFoliage({
    w: 21, h: 24,
    blobs: [{ x: 10, y: 11, r: 8 }, { x: 5, y: 9, r: 5 }, { x: 15, y: 9, r: 5 }, { x: 10, y: 6, r: 5.5 }, { x: 7, y: 14, r: 4.5 }, { x: 14, y: 14, r: 4.5 }],
    trunk: { x: 9, w: 3, y: 17, h: 6 },
    hl: { x: 6, y: 7, r: 3.6 },
  });

  // ---- APPLE TREE 21x24 ----
  S.apple = makeFoliage({
    w: 21, h: 24,
    blobs: [{ x: 10, y: 11, r: 8 }, { x: 5, y: 9, r: 5 }, { x: 15, y: 9, r: 5 }, { x: 10, y: 6, r: 5.5 }, { x: 7, y: 14, r: 4.5 }, { x: 14, y: 14, r: 4.5 }],
    trunk: { x: 9, w: 3, y: 17, h: 6 },
    hl: { x: 6, y: 7, r: 3.6 },
    dots: [
      { x: 6, y: 12, c: '#e8645a', hi: true }, { x: 14, y: 13, c: '#e8645a', hi: true },
      { x: 10, y: 15, c: '#e8645a', hi: true }, { x: 15, y: 8, c: '#e8645a', hi: true },
      { x: 9, y: 9, c: '#f2adc0', hi: true },
    ],
  });

  // ---- PINE / CONIFER 18x24 ----
  S.pine = makeFoliage({
    w: 18, h: 25, pine: true,
    blobs: [{ x: 9, y: 18, r: 6 }, { x: 9, y: 13, r: 5.4 }, { x: 9, y: 8.5, r: 4.4 }, { x: 9, y: 5, r: 3.2 }],
    trunk: { x: 8, w: 2, y: 21, h: 3 },
    hl: { x: 7, y: 6, r: 2.6 },
  });

  // ---- BUSH / SHRUB 18x12 ----
  S.bush = makeFoliage({
    w: 18, h: 12,
    blobs: [{ x: 6, y: 7, r: 4.6 }, { x: 11, y: 7, r: 4.6 }, { x: 8, y: 4.5, r: 3.8 }, { x: 13, y: 6, r: 3.6 }, { x: 9, y: 8, r: 4.4 }],
    hl: { x: 5, y: 4, r: 2.6 },
    dots: [{ x: 5, y: 8, c: '#e8645a', hi: true }, { x: 12, y: 8, c: '#e8645a', hi: true }],
  });

  // ---------- procedural cabin (refined, like the reference) ----------
  const ROOFS = {
    periwinkle: { Rl: '#b8a8d0', Rm: '#9080ac', Rd: '#6b577f' },
    teal:       { Rl: '#abdacf', Rm: '#7cb6aa', Rd: '#538177' },
    rose:       { Rl: '#e6bac6', Rm: '#cc8d9d', Rd: '#9c6270' },
    slate:      { Rl: '#9fb0bd', Rm: '#71828f', Rd: '#4a5860' }, // for the barn
  };
  // wall wood-tone presets — 'tan' is the original house/coop look, unchanged.
  const WALLS = {
    tan:  { wl: '#e2c094', wm: '#c2925f', wd: '#8a5e3c' },
    barn: { wl: '#d9a58c', wm: '#bd7c5c', wd: '#8a5843' }, // barn red — muted to match the rest of the map's pastel palette (was too saturated)
  };
  function buildCabin(opt) {
    opt = opt || {};
    const roof = ROOFS[opt.roof || 'periwinkle'];
    const wall = WALLS[opt.wall || 'tan'];
    let cached = null;
    function build() {
      const w = 28, h = 31;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
      const set = (px, py, c) => { x.fillStyle = c; x.fillRect(px, py, 1, 1); };
      const rect = (px, py, pw, ph, c) => { x.fillStyle = c; x.fillRect(px, py, pw, ph); };
      const C = {
        cream: '#fbeece', creamD: '#ecd9ac',
        wl: wall.wl, wm: wall.wm, wd: wall.wd, dark: '#5a3f2c',
        gl: '#cfe9e6', gm: '#84b9b8', knob: '#f3d96a',
      };
      // ----- BODY -----
      const bx = 5, bw = 18, by = 15, bh = 10;
      rect(bx, by, bw, bh, C.wm);
      for (let py = by + 2; py < by + bh; py += 3) rect(bx, py, bw, 1, C.wl);   // plank highlights
      rect(bx, by, 1, bh, C.wd); rect(bx + bw - 1, by, 1, bh, C.wd);            // side outlines
      rect(bx, by + bh - 1, bw, 1, C.wd);                                       // base sill
      // windows (cross-framed)
      function win(wx, wy) {
        rect(wx - 1, wy - 1, 7, 7, C.wd);
        rect(wx, wy, 5, 5, C.gm); rect(wx, wy, 5, 2, C.gl);
        rect(wx + 2, wy, 1, 5, C.wd); rect(wx, wy + 2, 5, 1, C.wd);
      }
      win(bx + 2, by + 2); win(bx + bw - 7, by + 2);
      // door (rounded top, dark opening, step)
      const dw = 6, dx = Math.round(bx + bw / 2 - dw / 2), dtop = by + 2;
      rect(dx, dtop, dw, by + bh - dtop, C.wd);
      rect(dx + 1, dtop + 1, dw - 2, by + bh - dtop - 1, C.dark);
      rect(dx + 1, dtop, dw - 2, 1, C.wl);
      set(dx, dtop, C.wm); set(dx + dw - 1, dtop, C.wm);
      set(dx + dw - 2, dtop + 4, C.knob);
      // ----- ROOF (rounded, vertical stripes) -----
      const cxc = 14;
      for (let ry = 4; ry <= 13; ry++) {
        const t = (ry - 4) / 9, half = Math.round(4.5 + t * 10.5);
        for (let rx = cxc - half; rx <= cxc + half; rx++) {
          let col;
          if (rx === cxc - half || rx === cxc + half || ry === 13) col = roof.Rd;
          else col = ((rx - (cxc - half)) % 3 === 2) ? roof.Rm : roof.Rl;
          set(rx, ry, col);
        }
      }
      rect(11, 3, 6, 1, roof.Rl); rect(12, 2, 4, 1, roof.Rm);    // rounded cap
      // ----- CREAM EAVE (overhang) -----
      rect(1, 13, 26, 2, C.cream); rect(1, 15, 26, 1, C.creamD);
      for (let sx = 3; sx < 26; sx += 4) set(sx, 16, C.cream);   // little scalloped drips
      // ----- STILTS -----
      rect(bx + 2, by + bh, 2, 4, C.wd); rect(bx + bw - 4, by + bh, 2, 4, C.wd);
      cached = cv; return cv;
    }
    const fn = () => cached || build();
    fn.__w = 28; fn.__h = 31; fn.__proc = true; return fn;
  }

  // ---------- procedural barn — dedicated shape (not a recolored cabin):
  // gambrel roof (dominates the silhouette, unlike the cabin's smaller
  // rounded roof), a cross-braced hayloft window on the gable, and double
  // X-braced barn doors instead of a single round-top door. Same drawing
  // primitives/technique as buildCabin (rect/set, striped roof, cream trim)
  // and the same WALLS.barn palette, so it still reads as part of the same
  // family — just a different building type, per reference image. ----------
  function buildBarn() {
    let cached = null;
    function build() {
      const w = 30, h = 34;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
      const set = (px, py, c) => { x.fillStyle = c; x.fillRect(px, py, 1, 1); };
      const rect = (px, py, pw, ph, c) => { x.fillStyle = c; x.fillRect(px, py, pw, ph); };
      const wall = WALLS.barn;
      // monochrome barn-red roof (same hue family as the walls, darker) —
      // the reference barn's roof and walls are both red, differentiated
      // by shading and white trim, not a contrasting roof hue. Muted to
      // match the walls (was too saturated relative to the rest of the map).
      const roofC = { Rl: '#c99a86', Rm: '#a4735c', Rd: '#77503e' };
      const C = {
        cream: '#fbeece', creamD: '#ecd9ac',
        wl: wall.wl, wm: wall.wm, wd: wall.wd, dark: '#4a3428',
      };
      // ----- BODY -----
      const bx = 6, bw = 18, by = 21, bh = 9;
      rect(bx, by, bw, bh, C.wm);
      for (let py = by + 2; py < by + bh; py += 2) rect(bx, py, bw, 1, C.wl); // denser plank banding — corrugated-siding feel
      rect(bx, by, 1, bh, C.wd); rect(bx + bw - 1, by, 1, bh, C.wd);
      rect(bx, by + bh - 1, bw, 1, C.wd);
      // small side window (right side only, like the reference's lower window)
      rect(bx + bw - 7, by + 2, 5, 5, C.wd);
      rect(bx + bw - 6, by + 3, 3, 3, C.dark);
      // ----- DOUBLE X-BRACED BARN DOORS -----
      const dw = 6, dh = bh - 1, dx1 = Math.round(bx + bw / 2 - dw), dy = by + 1;
      function doorPanel(px) {
        rect(px, dy, dw, dh, C.wd);
        rect(px + 1, dy, dw - 2, dh, C.dark);
        for (let i = 0; i < dh; i++) {
          const t = i / (dh - 1);
          set(Math.round(px + 1 + t * (dw - 3)), dy + i, C.wl);
          set(Math.round(px + dw - 2 - t * (dw - 3)), dy + i, C.wl);
        }
      }
      doorPanel(dx1); doorPanel(dx1 + dw);
      rect(dx1 + dw - 1, dy, 1, dh, C.cream); // white divider between panels
      // ----- GAMBREL ROOF (tall, dominates the silhouette) -----
      const cxc = 15;
      for (let ry = 3; ry <= 20; ry++) {
        const t = (ry - 3) / 17;
        const half = Math.round(1 + t * 13);
        for (let rx = cxc - half; rx <= cxc + half; rx++) {
          let col;
          if (rx === cxc - half || rx === cxc + half || ry === 20) col = roofC.Rd;
          else col = ((rx - (cxc - half)) % 3 === 2) ? roofC.Rm : roofC.Rl;
          set(rx, ry, col);
        }
      }
      rect(12, 2, 6, 1, roofC.Rl); rect(13, 1, 4, 1, roofC.Rm); // ridge cap
      // ----- HAYLOFT WINDOW (cross-braced), high on the gable -----
      const hx = cxc - 3, hy = 10, hs = 6;
      rect(hx - 1, hy - 1, hs + 2, hs + 2, C.cream);
      rect(hx, hy, hs, hs, C.dark);
      for (let i = 0; i < hs; i++) { set(hx + i, hy + i, C.wl); set(hx + hs - 1 - i, hy + i, C.wl); }
      // ----- CREAM EAVE -----
      rect(2, 19, w - 4, 2, C.cream); rect(2, 21, w - 4, 1, C.creamD);
      // ----- STILTS -----
      rect(bx + 2, by + bh, 2, 3, C.wd); rect(bx + bw - 4, by + bh, 2, 3, C.wd);
      cached = cv; return cv;
    }
    const fn = () => cached || build();
    fn.__w = 30; fn.__h = 34; fn.__proc = true; return fn;
  }

  // ---------- procedural windmill — split into a static base (tower + cap
  // + mast) and a separate blades sprite, so the blades can be redrawn
  // with a canvas rotation each animation frame (FarmCanvas.tsx) instead
  // of being baked into the once-rendered, cached scene background. Same
  // trig-based line technique as the fence-loop math in scene.js; reuses
  // existing wood tones (C.wl/wm/wd) and stone tones — no new colors. ----
  const WINDMILL_HUB = { x: 13, y: 14 }; // hub position within the 26x36 base canvas
  function buildWindmillBase() {
    let cached = null;
    function build() {
      // h=36 matches the tower's actual base (towerBot below) exactly — it
      // was 44 (8px of empty padding under the tower), which put the base
      // sprite's bottom-edge anchor 8px below where the tower visually
      // ends, floating it above its own ground shadow.
      const w = 26, h = 36;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
      const set = (px, py, c) => { x.fillStyle = c; x.fillRect(px, py, 1, 1); };
      const rect = (px, py, pw, ph, c) => { x.fillStyle = c; x.fillRect(px, py, pw, ph); };
      const C = {
        wl: '#e2c094', wm: '#c2925f', wd: '#8a5e3c', dark: '#5a3f2c',
      };
      const cxc = 13;
      // ----- TOWER (tapered — narrow at top, wide at base) -----
      const towerTop = 22, towerBot = 36;
      for (let ty = towerTop; ty <= towerBot; ty++) {
        const t = (ty - towerTop) / (towerBot - towerTop);
        const half = Math.round(3 + t * 4);
        rect(cxc - half, ty, half * 2, 1, C.wm);
        set(cxc - half, ty, C.wd); set(cxc + half - 1, ty, C.wd);
      }
      for (let ty = towerTop + 3; ty < towerBot; ty += 4) {
        const t = (ty - towerTop) / (towerBot - towerTop);
        const half = Math.round(3 + t * 4);
        rect(cxc - half + 1, ty, half * 2 - 2, 1, C.wl);
      }
      rect(cxc - 2, towerBot - 5, 4, 5, C.dark); // door
      // ----- CAP -----
      rect(cxc - 4, towerTop - 3, 8, 3, C.dark);
      rect(cxc - 3, towerTop - 5, 6, 2, C.dark);
      rect(cxc - 1, towerTop - 6, 2, 1, C.dark);
      // ----- MAST stub (blades attach here, drawn separately on top) -----
      const hx = WINDMILL_HUB.x, hy = WINDMILL_HUB.y;
      set(hx, hy + 1, C.wd); set(hx, hy + 2, C.wd);
      cached = cv; return cv;
    }
    const fn = () => cached || build();
    fn.__w = 26; fn.__h = 36; fn.__proc = true; return fn;
  }
  // Blades only, centered in their own square canvas so a caller can rotate
  // around its exact center (ctx.translate(hubX,hubY) + ctx.rotate(angle) +
  // drawImage centered) without needing to know the internal hub offset.
  function buildWindmillBlades() {
    let cached = null;
    function build() {
      const w = 34, h = 34, cx = 17, cy = 17; // center = hub
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
      const set = (px, py, c) => { x.fillStyle = c; x.fillRect(px, py, 1, 1); };
      const C = { stone: '#b6c6b8', stoneD: '#85998c', cream: '#fbeece' };
      // 4-arm pinwheel, 45°/135°/225°/315°, ~2px thick
      const L = 13;
      for (let a = 0; a < 4; a++) {
        const ang = a * Math.PI / 2 + Math.PI / 4;
        const dx = Math.cos(ang), dy = Math.sin(ang), px2 = -dy, py2 = dx;
        const col = (a % 2 === 0) ? C.stone : C.stoneD;
        for (let s = 2; s <= L; s++) {
          const bx = cx + dx * s, by = cy + dy * s;
          set(Math.round(bx), Math.round(by), col);
          set(Math.round(bx + px2), Math.round(by + py2), col);
        }
      }
      set(cx, cy, C.cream); // hub center
      cached = cv; return cv;
    }
    const fn = () => cached || build();
    fn.__w = 34; fn.__h = 34; fn.__proc = true; return fn;
  }

  // ---------- procedural steam locomotive — a small farmyard vehicle prop.
  // Full reconstruction (not a re-skin of the old tractor/cart): compact
  // side-view toy locomotive — charcoal cabin + chimney toward the rear,
  // a rust-orange boiler toward the front, two wheels underneath. Flat
  // solid-color blocks with hard pixel edges only (each shape gets at most
  // a 1px light-top/dark-bottom edge, same technique as every other sprite
  // in this file — no gradients or anti-aliasing). Colors are muted/
  // desaturated versions of the rust-orange/charcoal family (not the same
  // hexes as the barn/other buildings) so it doesn't pop out against the
  // soft pastel grass the way the first pass's more saturated tones did. ----
  function buildLocomotive() {
    let cached = null;
    function build() {
      // v2 — shorter boiler (shrunk in from the right, so the cabin/rear
      // end keeps its position and the whole thing reads more compact and
      // left-weighted) and a smaller front/right wheel instead of a
      // matched pair.
      const w = 26, h = 22;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
      const set = (px, py, c) => { x.fillStyle = c; x.fillRect(px, py, 1, 1); };
      const rect = (px, py, pw, ph, c) => { x.fillStyle = c; x.fillRect(px, py, pw, ph); };
      const circle = (cxp, cyp, r, c) => {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r + r * 0.3) set(cxp + dx, cyp + dy, c);
        }
      };
      const C = {
        body: '#5c5248', bodyD: '#453d34', bodyL: '#79705f',
        rust: '#b8815f', rustD: '#8a5c3f', rustL: '#d1a37e',
        glass: '#86b9bc', glassL: '#c8e6e5',
        trim: '#4a545c',
      };
      // ----- WHEELS (drawn first — cabin/boiler sit on top, overlapping
      // only the top few rows, so most of each wheel stays visible below
      // the body). Rear (left) wheel is the full size; front (right) wheel
      // is smaller — its center sits lower so both still touch the same
      // ground line. Clearly separated by a gap of undercarriage between
      // them. Outer charcoal rim, rust inner hub, small dark center. -----
      const wr = 6, wy = 16, rearX = 6;
      const wr2 = 4, wy2 = 17, frontX = 20;
      circle(rearX, wy, wr, C.bodyD); circle(rearX, wy, wr - 3, C.rust); circle(rearX, wy, 1, C.trim);
      circle(frontX, wy2, wr2, C.bodyD); circle(frontX, wy2, wr2 - 2, C.rust); circle(frontX, wy2, 1, C.trim);
      rect(0, 21, 26, 1, C.trim); // ground shadow line under both wheels
      // ----- UNDERCARRIAGE — small dark blue/gray strip visible under the
      // boiler, in the gap between the two wheels -----
      rect(12, 13, 4, 3, C.trim);
      // ----- BOILER — horizontal rust-orange block, front/right (shortened
      // from the first pass — was 19px, now 14px) -----
      rect(9, 7, 14, 7, C.rust);
      rect(9, 7, 14, 1, C.rustL); rect(9, 13, 14, 1, C.rustD); rect(22, 7, 1, 7, C.rustD);
      // ----- CABIN — short charcoal block, rear/left -----
      rect(2, 5, 9, 8, C.body);
      rect(2, 5, 9, 1, C.bodyL); rect(2, 12, 9, 1, C.bodyD);
      rect(2, 5, 1, 8, C.bodyD); rect(10, 5, 1, 8, C.bodyD);
      // window — small light blue-gray rectangle in the cabin
      rect(4, 7, 4, 4, C.glass); rect(4, 7, 4, 1, C.glassL); rect(4, 7, 1, 4, C.glassL);
      // ----- CHIMNEY — tall narrow charcoal stack above the cabin, with a
      // wider cap at the top -----
      rect(2, 0, 5, 2, C.body); rect(2, 0, 5, 1, C.bodyL); // wide cap
      rect(3, 2, 3, 3, C.body); rect(3, 4, 3, 1, C.bodyD); // narrow shaft down to the cabin roofline
      cached = cv; return cv;
    }
    const fn = () => cached || build();
    fn.__w = 26; fn.__h = 22; fn.__proc = true; return fn;
  }

  // ---- CHICKEN (faces right) 13x12
  S.chicken = [
    "       x     ",
    "      xzx    ",
    "   xxx z xx  ",
    "  xFFFFFFx   ",
    " xFFFFFFFFx  ",
    " xFFxFFFFFxj ",
    " xFFFFFFFFxjj",
    " xFFFFFFFFx  ",
    "  xFFFFFFx   ",
    "  xxjxxjxx   ",
    "    j   j    ",
    "             ",
  ];

  // ---- BABY CHICK 9x9
  S.chick = [
    "         ",
    "   xxx   ",
    "  xyyyx  ",
    " xyyyyyxj",
    " xyxyyyx ",
    " xyyyyyx ",
    "  xyyyx  ",
    "  xj jx  ",
    "         ",
  ];

  // ---- SHEEP (faces left) 16x13
  S.sheep = [
    "                ",
    "    FFFFFF      ",
    "   FFFFFFFF     ",
    "  xxFFFFFFFF    ",
    " xnnxFFFFFFF    ",
    " xnFnxFFFFFFF   ",
    " xnnnxFFFFFFF   ",
    "  xxxFFFFFFF    ",
    "   xFFFFFFFx    ",
    "   x FF FF x    ",
    "     t  t       ",
    "     t  t       ",
    "                ",
  ];

  // ---- COW (faces left, cream + brown patches) 18x13
  S.cow = [
    "                  ",
    "   xx       xx    ",
    "  xNNx     xNNx   ",
    " xxxxxxxxxxxxxx   ",
    " xNNNNooNNNNNNx   ",
    " xNNooooNNNooNx   ",
    "xqxNNNNNNNooNNx   ",
    "xqxNNNNNNNNNNNx   ",
    " xNNNNNNNNNNNNx   ",
    " xNxNNNNNNNxNNx   ",
    "  txx     txx     ",
    "  tt       tt     ",
    "                  ",
  ];

  // ---- FLOWER PATCH 13x9
  S.flowers = [
    "  q   y   q  ",
    " qQq yyy qQq ",
    "  q   y   q  ",
    "  g   g   g  ",
    " ge  geg  eg ",
    "  g   g   g  ",
    " eGe eGe eGe ",
    "             ",
    "             ",
  ];

  // ---- CROP stage 1: sprout 10x10
  S.sprout = [
    "          ",
    "          ",
    "    G     ",
    "   GgG    ",
    "  G g G   ",
    "    g     ",
    "   sss    ",
    "  sSSSs   ",
    "   sss    ",
    "          ",
  ];

  // ---- CROP stage 2: leafy 11x11
  S.crop2 = [
    "           ",
    "   l   l   ",
    "  lLl gLl  ",
    "  lLlglLl  ",
    "   lgGgl   ",
    "    ggg    ",
    "   sssss   ",
    "  sSSSSSs  ",
    "  sSSSSSs  ",
    "   sssss   ",
    "           ",
  ];

  // ---- CROP stage 3: ripe carrots 12x12
  S.carrot = [
    "            ",
    "  G  G  G   ",
    " GgG GgG G  ",
    "  g   g  g  ",
    "  cc cc cc  ",
    "  CC CC CC  ",
    "  cc cc cc  ",
    "   c  c  c  ",
    "  sssssss   ",
    " sSSSSSSSs  ",
    "  sssssss   ",
    "            ",
  ];

  // ---- HOUSE / FARMHOUSE 32x30
  // ---- HOUSE / COOP (procedural cabins) / BARN (dedicated shape, see buildBarn) ----
  S.house = buildCabin({ roof: 'periwinkle' });
  S.coop = buildCabin({ roof: 'teal' });
  S.barn = buildBarn();
  S.windmill = buildWindmillBase();
  S.windmillBlades = buildWindmillBlades();
  S.locomotive = buildLocomotive();

  // ---- L-SHAPED DOCK 34x13 (wood-plank pier — same 3-tone o/W/w technique
  // as the boat below) for the north-facing (top-edge) shore between the
  // barn and the forest. Posts stand along the BOTTOM edge of the deck
  // (same convention as a straight pier: legs support the planks from
  // below), so baseY anchors the sprite's bottom right at the post row and
  // the deck itself is drawn extending upward from there.
  S.dockL = [
    "   ooooooooo                      ",
    "   oWWWWWWWo                      ",
    "   oWWWWWWWo                      ",
    "   owwwwwwwo                      ",
    "   ooooooooooooooooooooooooooooo  ",
    "   oWWWWWWWWWWWWWWWWWWWWWWWWWWWo  ",
    "   oWWWWWWWWWWWWWWWWWWWWWWWWWWWo  ",
    "   owwwwwwwwwwwwwwwwwwwwwwwwwwwo  ",
    "   ooooooooooooooooooooooooooooo  ",
    "        o      o      o      o    ",
    "       bBb    bBb    bBb    bBb   ",
    "        b      b      b      b    ",
    "                                   ",
  ];

  // ---- BOAT 21x11 (cute wooden rowboat) ----
  S.boat = [
    "                     ",
    "   ooooooooooooooo   ",
    "  oWWWWWWWWWWWWWWWo  ",
    "  oWoooooooooooooWo  ",
    "  oWoWWWWWWWWWWWoWo  ",
    "  oWowwwwwwwwwwwoWo  ",
    "  oWoWWWWWWWWWWWoWo  ",
    "  oWoooooooooooooWo  ",
    "  oWWWWWWWWWWWWWWWo  ",
    "   ooooooooooooooo   ",
    "                     ",
  ];

  // ---- WHEAT BUNDLE 9x12 ----
  S.wheat = [
    "  y y y  ",
    " yMyMyMy ",
    " yMyMyMy ",
    " yMyMyMy ",
    "  MMMMM  ",
    "   ggg   ",
    "  g g g  ",
    "  g g g  ",
    "  ggggg  ",
    "   g g   ",
    "  Gg gG  ",
    "         ",
  ];

  // ---- FENCE segment 16x14
  S.fence = [
    "                ",
    "  W          W  ",
    " oWo        oWo ",
    " oWo        oWo ",
    "ooooooooooooooo ",
    " oWo        oWo ",
    " oWo        oWo ",
    "ooooooooooooooo ",
    " oWo        oWo ",
    " oWo        oWo ",
    " oWo        oWo ",
    "                ",
  ];

  // ---- POND 24x16
  S.pond = [
    "      bbbbbbbbbb        ",
    "    bbBBBBBBBBBBbb      ",
    "   bBBBBBBBBBBBBBBb     ",
    "  bBBBBBBBBBBBBBBBBb    ",
    "  bBBBBBFBBBBBBBBBBb    ",
    "  bBBBBBBBBBBBFBBBBb    ",
    "  bBBBBBBBBBBBBBBBBb    ",
    "   bBBBBBBBBBBBBBBb     ",
    "    bbBBBBBBBBBBbb      ",
    "      bbbbbbbbbb        ",
    "                       ",
  ];

  // ---- SCARECROW 14x22
  S.scarecrow = [
    "      jj      ",
    "     jyyj     ",
    "    jyyyyj    ",
    "   xj y yjx   ",
    "    jyyyyj    ",
    "     juuj     ",
    "  ooooooooo   ",
    "  o  ttt  o   ",
    "     ttt      ",
    "    tttttt    ",
    "    t t t t   ",
    "    t  t      ",
    "    t  t      ",
    "   gg  gg     ",
    "              ",
  ];

  // ---- ROCK 12x9
  S.rock = [
    "            ",
    "    aaaa    ",
    "  aaAAAAaa  ",
    " aAAAAAAAAa ",
    " aAAAAAAAAa ",
    " AAAAAAAAAa ",
    "  AAAAAAAa  ",
    "            ",
    "            ",
  ];

  // ---- MUSHROOM patch 11x10
  S.mushroom = [
    "           ",
    "  vvv      ",
    " vFvFv vv  ",
    " vvvvvvFvv ",
    "  NNN vvFv ",
    "  NNN  NN  ",
    "  NNN  NN  ",
    "           ",
    "           ",
  ];

  // ---- LANTERN / LAMP POST 7x15
  S.lantern = [
    "   m   ",
    "  xMx  ",
    " xNyNx ",
    " xNyNx ",
    " xNNNx ",
    "  xmx  ",
    "   o   ",
    "   o   ",
    "   o   ",
    "   o   ",
    "   o   ",
    "   o   ",
    "  ooo  ",
    " ooooo ",
    "       ",
  ];

  // ---- WELL 18x18
  S.well = [
    "    RRRRRRRR    ",
    "   RrrrrrrrrR   ",
    "  RRRRRRRRRRRR  ",
    "    o      o    ",
    "    o      o    ",
    "   wwwwwwwwww   ",
    "   wbBBBBBBbw   ",
    "   wbBBBBBBbw   ",
    "   wbbbbbbbbw   ",
    "   wwwwwwwwww   ",
    "   oWWWWWWWWo   ",
    "   oWWWWWWWWo   ",
    "                ",
  ];

  // ---- HAY BALE 14x11
  S.hay = [
    "              ",
    "  yyyyyyyyyy  ",
    " yMyyyyyyyMy  ",
    " yyyMyyyMyyy  ",
    " yyyyyMyyyyy  ",
    " yMyyyyyyyMy  ",
    " yyyMyyyMyyy  ",
    "  yyyyyyyyyy  ",
    "              ",
  ];

  // ---- COIN 12x12
  S.coin = [
    "    MMMM    ",
    "  MMmmmmMM  ",
    " MmmmNmmmM  ",
    " MmNmmmmmM  ",
    "MmmmmNmmmmM ",
    "MmmNmmmmmmM ",
    "MmmmmmNmmmM ",
    " MmmmNmmmM  ",
    " MmmmmmmmM  ",
    "  MMmmmmMM  ",
    "    MMMM    ",
    "            ",
  ];

  // ---- DUCK (faces right) 13x11
  S.duck = [
    "             ",
    "    xxx      ",
    "   xFFFx     ",
    "   xFxFx jj  ",
    "   xFFFFxjj  ",
    " xxFFFFFFx   ",
    "xFFFFFFFFFx  ",
    "xFFFFFFFFx   ",
    " xxFFFFxx    ",
    "   j  j      ",
    "             ",
  ];

  // ---- SIGN POST 13x14
  S.sign = [
    "             ",
    " WWWWWWWWWWW ",
    " WnnnnnnnnnW ",
    " WnggnngnnW  ",
    " WnnnnnnnnnW ",
    " WWWWWWWWWWW ",
    "     oo      ",
    "     oo      ",
    "     oo      ",
    "    oooo     ",
    "             ",
  ];

  // ---- SUNFLOWER 9x15
  S.sunflower = [
    "   yyy   ",
    "  yyMyy  ",
    "  yMoMy  ",
    "  yyMyy  ",
    "   yyy   ",
    "    G    ",
    "   lGl   ",
    "    g    ",
    "   lgL   ",
    "    g    ",
    "   Lgl   ",
    "    g    ",
    "   geg   ",
    "    g    ",
    "         ",
  ];

  // ---- LOG 12x7
  S.log = [
    "            ",
    "   TttttttT ",
    "  TwwwwwwwwT",
    "  TowowowoT ",
    "  TwwwwwwwwT",
    "   TttttttT ",
    "            ",
  ];

  // ---- CHEST 10x9
  S.chest = [
    "          ",
    "  owwwwo  ",
    "  wmMMmw  ",
    "  owwwwo  ",
    "  wWWWWw  ",
    "  womoww  ",
    "  wWWWWw  ",
    "  oooooo  ",
    "          ",
  ];

  // ---- LILY PAD 10x6
  S.lily = [
    "          ",
    "   qLl    ",
    "  lLLLl   ",
    " lLLLLLl  ",
    "  klllk   ",
    "          ",
  ];

  // ---- LOTUS (round pad + flower) 12x8, and LOTUS LEAF (pad only) 12x8 —
  // bigger/rounder than the lily pad above, scattered on open water.
  S.lotus = [
    "            ",
    "     q      ",
    "    qQq     ",
    "   lLLLLl   ",
    "  lLLLLLLl  ",
    "  lLLkLLLl  ",
    "   lLLLLl   ",
    "    llll    ",
  ];
  S.lotusleaf = [
    "            ",
    "            ",
    "   lLLLLl   ",
    "  lLLLLLLl  ",
    "  lLLkLLLl  ",
    "   lLLLLl   ",
    "    llll    ",
    "            ",
  ];

  // ---- TALL GRASS 12x6
  S.tallgrass = [
    "            ",
    "  g   g  g  ",
    " gGg gGg Gg ",
    "  gGg Gg g  ",
    " eGe gGe eg ",
    "            ",
  ];

  // ---- REEDS / CATTAILS 8x9
  S.reeds = [
    "        ",
    "  T  T  ",
    "  T  t  ",
    "  t  g  ",
    "  g  g  ",
    " Gg  gG ",
    "  g  g  ",
    "  g eg  ",
    "  ge g  ",
  ];

  // Render a sprite (grid OR procedural function) to a canvas at integer `scale`.
  function rasterName(name, scale) {
    scale = scale || 1;
    const spr = S[name];
    if (typeof spr === 'function') {
      const base = spr();
      if (scale === 1) return base;
      const cv = document.createElement('canvas');
      cv.width = base.width * scale; cv.height = base.height * scale;
      const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(base, 0, 0, base.width, base.height, 0, 0, cv.width, cv.height);
      return cv;
    }
    return toCanvas(spr, scale);
  }

  function toCanvas(gridOrName, scale) {
    if (typeof gridOrName === 'string') return rasterName(gridOrName, scale);
    if (typeof gridOrName === 'function') {
      const base = gridOrName();
      if ((scale || 1) === 1) return base;
      const cv = document.createElement('canvas');
      cv.width = base.width * (scale || 1); cv.height = base.height * (scale || 1);
      const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(base, 0, 0, base.width, base.height, 0, 0, cv.width, cv.height);
      return cv;
    }
    const grid = gridOrName;
    scale = scale || 4;
    const h = grid.length;
    const w = Math.max.apply(null, grid.map((r) => r.length));
    const cv = document.createElement('canvas');
    cv.width = w * scale;
    cv.height = h * scale;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < h; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const col = PAL[row[x]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return cv;
  }

  const urlCache = {};
  function url(name, scale) {
    const key = name + '@' + (scale || 4);
    if (urlCache[key]) return urlCache[key];
    if (!S[name]) { console.warn('no sprite', name); return ''; }
    const u = rasterName(name, scale).toDataURL();
    urlCache[key] = u;
    return u;
  }

  function dims(name) {
    const spr = S[name];
    if (typeof spr === 'function') return { w: spr.__w, h: spr.__h };
    return { w: Math.max.apply(null, spr.map((r) => r.length)), h: spr.length };
  }

  window.FF = { PAL, sprites: S, url, dims, toCanvas, raster: rasterName, windmillHub: WINDMILL_HUB };
})();
