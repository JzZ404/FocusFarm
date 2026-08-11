/* FocusFarm — procedural farm scene generator.
   Draws a cozy Sprout Lands-style island farm onto a canvas.
   Requires sprites.js (window.FF) to be loaded first.
   Usage: FFScene.render(canvasEl, { seed: 7 });  */
(function () {
  const AW = 432, AH = 160;          // art-pixel resolution
  const OUT_W = 3455, OUT_H = 1280;  // final output resolution

  const COL = {
    water:'#a8d8c6', waterD:'#94ccb6', waterL:'#c6e9da', foam:'#d8f0e6',
    grass:'#bfdc8e', grassD:'#a7cd73', grassDark:'#93bd63', grassL:'#d2e8a6',
    soil:'#d8b489', soilD:'#c3996a', soilL:'#e8cca0', soilDk:'#ab7e54',
    path:'#d3aa78', pathD:'#bf9460', pathL:'#e4c191', pebble:'#b29068',
    wood:'#b07a4e', woodD:'#8a5e3c', woodL:'#d8b079',
    ink:'#5e7d4a', cream:'#f6f8e4',
  };

  function makeRng(seed) {
    let s = seed || 7;
    return {
      f() { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; },
      i(a, b) { return Math.floor(a + this.f() * (b - a + 1)); },
    };
  }

  function render(canvas, opts) {
    opts = opts || {};
    const FF = window.FF;
    const rng = makeRng(opts.seed || 7);
    const f = () => rng.f(), ri = (a, b) => rng.i(a, b);

    // compose at art resolution
    const art = document.createElement('canvas');
    art.width = AW; art.height = AH;
    const c = art.getContext('2d');
    c.imageSmoothingEnabled = false;

    function rrp(x, y, w, h, r) {
      c.beginPath(); c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    }
    function blob(cx, cy, rx, ry) { c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.closePath(); }
    function cm(p0, p1, p2, p3, t) {
      const t2 = t * t, t3 = t2 * t;
      return [
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ];
    }
    // organic coastline: wobbled ring -> smooth closed catmull path
    function isleBase(cx, cy, rx, ry, wob, n) {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        const wr = 1 + (Math.sin(a * 3 + 1.2) * 0.5 + Math.sin(a * 5 + 0.4) * 0.3 + (f() - 0.5) * 0.5) * wob;
        pts.push([cx + Math.cos(a) * rx * wr, cy + Math.sin(a) * ry * wr]);
      }
      return pts;
    }
    function expand(pts, cx, cy, k) {
      return pts.map((p) => { const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1; return [p[0] + dx / d * k, p[1] + dy / d * k]; });
    }
    function closedPath(pts) {
      const n = pts.length; c.beginPath();
      for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
        for (let t = 0; t < 1; t += 0.12) { const pt = cm(p0, p1, p2, p3, t); if (i === 0 && t === 0) c.moveTo(pt[0], pt[1]); else c.lineTo(pt[0], pt[1]); }
      }
      c.closePath();
    }

    // ---- water ----
    c.fillStyle = COL.water; c.fillRect(0, 0, AW, AH);
    // gentle horizontal ripple dashes, low contrast
    for (let i = 0; i < 520; i++) { const x = ri(0, AW - 3), y = ri(0, AH - 1); c.fillStyle = f() < 0.5 ? COL.waterL : COL.waterD; c.fillRect(x, y, f() < 0.5 ? 2 : 1, 1); }
    // cute little sparkles (✦) scattered on the water
    c.fillStyle = COL.foam;
    for (let i = 0; i < 90; i++) {
      const x = ri(3, AW - 4), y = ri(3, AH - 4);
      c.fillRect(x, y, 1, 1); c.fillRect(x - 1, y, 1, 1); c.fillRect(x + 1, y, 1, 1); c.fillRect(x, y - 1, 1, 1); c.fillRect(x, y + 1, 1, 1);
    }

    // ---- organic island (no outline ring) ----
    // icy/ry grown (was 84/64) and shifted down so the coastline actually
    // reaches the field's bottom edge (fcy+fry=158) — it used to end around
    // y=148 there, leaving the field's south end floating in open water.
    const icx = 216, icy = 90;
    const base = isleBase(icx, icy, 205, 82, 0.085, 20);
    const isl = { x: 8, y: 6, w: 416, h: 152 }; // approx bounds for texture/placement
    c.save(); closedPath(base); c.fillStyle = COL.grass; c.fill(); c.clip();
    // soft, low-contrast grass mottling
    for (let i = 0; i < 2600; i++) { const x = ri(isl.x, isl.x + isl.w), y = ri(isl.y, isl.y + isl.h); c.fillStyle = f() < 0.5 ? COL.grassL : COL.grassD; c.fillRect(x, y, 1, 1); }
    // gentle grass tufts (little dark v's)
    for (let i = 0; i < 150; i++) { const x = ri(isl.x + 4, isl.x + isl.w - 4), y = ri(isl.y + 4, isl.y + isl.h - 4); c.fillStyle = COL.grassDark; c.fillRect(x, y, 1, 2); c.fillRect(x - 1, y + 1, 1, 1); c.fillRect(x + 1, y + 1, 1, 1); }
    // tiny scattered dot-flowers (white & soft yellow) for cuteness
    for (let i = 0; i < 70; i++) { const x = ri(isl.x + 6, isl.x + isl.w - 6), y = ri(isl.y + 6, isl.y + isl.h - 6); c.fillStyle = f() < 0.5 ? '#fbf6e2' : '#f3e07a'; c.fillRect(x, y, 1, 1); }
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(isl.x, isl.y, isl.w, 12);
    c.restore();

    // ---- pond ----
    (function (cx, cy, rx, ry) {
      c.save(); blob(cx, cy, rx + 1.5, ry + 1.5); c.fillStyle = COL.grassDark; c.fill(); c.restore();
      c.save(); blob(cx, cy, rx, ry); c.fillStyle = COL.waterD; c.fill(); c.clip();
      c.fillStyle = COL.water; blob(cx, cy - 0.5, rx - 1, ry - 1); c.fill();
      c.fillStyle = COL.waterL; for (let i = 0; i < 40; i++) { const x = ri(cx - rx, cx + rx), y = ri(cy - ry, cy + ry); c.fillRect(x, y, 2, 1); } c.restore();
    })(78, 66, 18, 9);

    // ---- moored rowboat (bottom-left water) ----
    (function (bx, by) {
      // mooring post on the shore + crisp rope to the boat
      c.fillStyle = COL.woodD; c.fillRect(bx - 26, by - 16, 2, 7);
      c.fillStyle = COL.wood; c.fillRect(bx - 26, by - 16, 2, 2);
      c.fillStyle = '#9a6a42';
      for (let i = 0; i <= 14; i++) { const t = i / 14; c.fillRect(Math.round((bx - 25) + 16 * t), Math.round((by - 13) + 11 * t), 1, 1); }
      // foam ring around the hull
      c.fillStyle = COL.foam;
      for (let i = 0; i < 46; i++) { const a = f() * Math.PI * 2; const rx = 11 + ri(0, 2), ry = 6 + ri(0, 1); c.fillRect(Math.round(bx + Math.cos(a) * rx), Math.round(by + 3 + Math.sin(a) * ry), 1, 1); }
      // hull
      const s = FF.raster('boat', 1);
      c.drawImage(s, Math.round(bx - s.width / 2), Math.round(by - s.height / 2));
    })(74, 150);

    // ---- dirt trails ----
    function catmull(p0, p1, p2, p3, t) {
      const t2 = t * t, t3 = t2 * t;
      return [
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ];
    }
    function tpts(ctrl) {
      const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]]; const out = [];
      for (let i = 0; i < P.length - 3; i++) for (let t = 0; t < 1; t += 0.03) out.push(catmull(P[i], P[i + 1], P[i + 2], P[i + 3], t));
      return out;
    }
    function stamp(p, w, col) { c.fillStyle = col; c.fillRect(Math.round(p[0] - w / 2), Math.round(p[1] - w / 2), w, w); }
    function trail(ctrl, wd) {
      const pts = tpts(ctrl);
      pts.forEach((p) => stamp(p, wd, COL.path));
      pts.forEach((p, i) => { if (i % 2) return;
        if (f() < 0.55) { c.fillStyle = COL.pathD; c.fillRect(Math.round(p[0] + ri(-wd / 2, wd / 2)), Math.round(p[1] + ri(-wd / 2, wd / 2)), 1, 1); }
        if (f() < 0.30) { c.fillStyle = COL.pathL; c.fillRect(Math.round(p[0] + ri(-wd / 2, wd / 2)), Math.round(p[1] + ri(-wd / 2, wd / 2)), 1, 1); } });
      c.fillStyle = COL.pebble; pts.forEach((p, i) => { if (i % 10 === 0 && f() < 0.6) c.fillRect(Math.round(p[0] + ri(-1, 1)), Math.round(p[1] + ri(-1, 1)), 1, 1); });
      c.fillStyle = COL.grassDark; pts.forEach((p, i) => { if (i % 4 === 0 && f() < 0.5) { const a = f() * 6.28; c.fillRect(Math.round(p[0] + Math.cos(a) * wd / 2), Math.round(p[1] + Math.sin(a) * wd / 2), 1, 1); } });
    }
    // Arcs above and around the field's fenced footprint (not just barely
    // clearing it) — waypoints keep 20px+ clearance from the nearest fence
    // post throughout, recomputed for the field's new smaller/shifted size.
    trail([[93, 94], [145, 90], [200, 90], [252, 94], [296, 100], [352, 119], [392, 110]], 7);
    // (removed a second stub trail that sat entirely inside the field —
    // redundant with the field's own soil texture, and part of the overlap)

    // ---- field (rounded-rect soil patch, was a full oval) ----
    const field = (function () {
      // Scaled down a bit (frx 84->76, fry 26->24) and shifted up (fcy 132->126)
      // — at the old size its fence padding reached y=164, past the AH=160
      // canvas bottom, clipping it. fr raised again (20->22, near the max
      // valid radius for this box) for noticeably rounder corners.
      const fcx = 226, fcy = 126, frx = 76, fry = 24, fr = 22;
      const fx = fcx - frx, fy = fcy - fry, fw = frx * 2, fh = fry * 2;
      c.save(); rrp(fx - 2, fy - 2, fw + 4, fh + 4, fr + 2); c.fillStyle = COL.soilDk; c.fill(); c.restore();
      c.save(); rrp(fx, fy, fw, fh, fr); c.fillStyle = COL.soil; c.fill(); c.clip();
      for (let i = 0; i < 2600; i++) { const x = ri(fcx - frx, fcx + frx), y = ri(fcy - fry, fcy + fry); c.fillStyle = f() < 0.5 ? COL.soilL : COL.soilD; c.fillRect(x, y, 1, 1); }
      // soft tilled hints (subtle, short dashes)
      c.fillStyle = COL.soilD;
      for (let yy = fcy - fry + 7; yy < fcy + fry - 4; yy += 7) for (let xx = fcx - frx + 6; xx < fcx + frx - 6; xx += 4) { if (f() < 0.7) c.fillRect(xx, yy, 2, 1); }
      c.restore();
      return { cx: fcx, cy: fcy, rx: frx, ry: fry, fx, fy, fw, fh, fr };
    })();
    // point at parameter t (0-1) walking clockwise around a rounded rect's
    // perimeter, starting at the top edge just right of the top-left corner
    function roundedRectPoint(x, y, w, h, r, t) {
      const sw = w - 2 * r, sh = h - 2 * r, arc = (Math.PI / 2) * r;
      const perim = 2 * sw + 2 * sh + 4 * arc;
      let d = ((t % 1) + 1) % 1 * perim;
      if (d < sw) return [x + r + d, y]; d -= sw;
      if (d < arc) { const a = -Math.PI / 2 + (d / arc) * (Math.PI / 2); return [x + w - r + Math.cos(a) * r, y + r + Math.sin(a) * r]; } d -= arc;
      if (d < sh) return [x + w, y + r + d]; d -= sh;
      if (d < arc) { const a = (d / arc) * (Math.PI / 2); return [x + w - r + Math.cos(a) * r, y + h - r + Math.sin(a) * r]; } d -= arc;
      if (d < sw) return [x + w - r - d, y + h]; d -= sw;
      if (d < arc) { const a = Math.PI / 2 + (d / arc) * (Math.PI / 2); return [x + r + Math.cos(a) * r, y + h - r + Math.sin(a) * r]; } d -= arc;
      if (d < sh) return [x, y + h - r - d]; d -= sh;
      const a = Math.PI + (d / arc) * (Math.PI / 2); return [x + r + Math.cos(a) * r, y + r + Math.sin(a) * r];
    }

    // ---- sprites ----
    const cache = {}; function spr(n) { if (!cache[n]) cache[n] = FF.raster(n, 1); return cache[n]; }

    const items = [];
    const add = (n, cx, baseY, opt) => items.push(Object.assign({ name: n, cx, baseY }, opt || {}));
    function drawSprite(it) {
      const s = spr(it.name), w = s.width, h = s.height;
      const x = Math.round(it.cx - w / 2), y = Math.round(it.baseY - h);
      c.save(); c.globalAlpha = 0.12; c.fillStyle = '#46502f'; blob(it.cx, it.baseY - 1, w * 0.36, 2.2); c.fill(); c.restore();
      if (it.flip) { c.save(); c.translate(x + w, y); c.scale(-1, 1); c.drawImage(s, 0, 0); c.restore(); } else c.drawImage(s, x, y);
    }

    // trees
    add('tree', 96, 45); add('pine', 128, 49);
    add('tree', 158, 46, { flip: true }); add('tree', 300, 47); add('apple', 332, 45, { flip: true });
    add('pine', 362, 50); add('tree', 380, 60); add('tree', 400, 66, { flip: true }); // was 392,46 / 414,54 — sat in water past the island's tapering right tip
    add('tree', 200, 66, { flip: true }); add('pine', 258, 72); add('apple', 150, 82); add('tree', 360, 86); add('pine', 408, 98);
    // right-side forest — the island's right edge grew a lot when it was
    // enlarged for the field, opening up room here. Mixes all 3 tree types
    // (round/pine/apple) with real gaps between clumps, not a solid wall.
    add('pine', 345, 100); add('apple', 415, 88, { flip: true }); add('tree', 326, 112);
    add('pine', 400, 120); add('tree', 370, 132, { flip: true });
    // buildings
    add('coop', 95, 86); add('house', 252, 108); add('well', 358, 118);
    // windmill tucked close behind the barn — cx (222) sits almost inside
    // the barn's own footprint (barn spans ~201-231), and baseY (44) is
    // less than the barn's (62) so it draws first in the baseY-sort and
    // the barn overlaps in front, hiding the tower/base with just the cap
    // and blades peeking out above the roofline. Placement (art-space)
    // exposed via FFScene.windmillPlacement below — FarmCanvas.tsx combines
    // it with FF.windmillHub to animate the blades on top of the cached
    // static background each frame.
    const windmillPlacement = { cx: 228, baseY: 52 };
    add('windmill', windmillPlacement.cx, windmillPlacement.baseY);
    add('barn', 216, 62); // top-middle of the map, open meadow between the pond cluster and the right-side forest
    // dock — juts out from the SE shore into open water past the forest
    // (island's edge there is high enough up (~y139) that the dock's own
    // lower rows, drawn below its baseY, land past it in water).
    add('dock', 380, 152);
    // ---- field planting — organized rows (was a naturalistic scatter) ----
    (function () {
      // little soil mound under a planted seedling
      function mound(cx, by) {
        c.save();
        c.fillStyle = COL.soilDk; c.beginPath(); c.ellipse(cx, by - 1, 4.2, 1.7, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#9fb1cf'; c.beginPath(); c.ellipse(cx, by - 1.3, 3, 1.1, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#b8c6df'; c.fillRect(Math.round(cx - 1), Math.round(by - 2), 2, 1);
        c.restore();
      }
      function plant(name, cx, by, opt) { mound(cx, by); add(name, cx, by, opt); }
      const cols = [166, 186, 206, 226, 246, 266, 286]; // 7 evenly-spaced columns
      // row 1 — wheat / sprout alternating
      add('wheat', cols[0], 111); plant('sprout', cols[1], 112);
      add('wheat', cols[2], 111); plant('sprout', cols[3], 112);
      add('wheat', cols[4], 111); plant('sprout', cols[5], 112);
      add('wheat', cols[6], 111);
      // row 2 — carrots flanking the scarecrow at dead center
      plant('carrot', cols[0], 126, { flip: true }); plant('carrot', cols[1], 126);
      add('tallgrass', cols[2], 124); add('scarecrow', cols[3], 126); add('tallgrass', cols[4], 124, { flip: true });
      plant('carrot', cols[5], 126); plant('carrot', cols[6], 126, { flip: true });
      // row 3 — leafy crop2
      add('crop2', cols[0], 141); add('crop2', cols[1], 141, { flip: true });
      add('crop2', cols[2], 141); add('crop2', cols[3], 141, { flip: true });
      add('crop2', cols[4], 141); add('crop2', cols[5], 141, { flip: true });
      add('crop2', cols[6], 141);
      // sunflowers stand guard at the back corners
      add('sunflower', 164, 106); add('sunflower', 288, 106, { flip: true });
    })();
    add('sign', 144, 142);
    // post-and-rail fence — loops around the field's right/bottom/left
    // sides only. Top edge + top-right corner both left open (the corner
    // was still catching the road on its way past) since the road runs
    // right along there — a fence there would block/overlap it.
    (function () {
      const pad = 6; // fence sits just outside the soil edge
      const x = field.fx - pad, y = field.fy - pad, w = field.fw + pad * 2, h = field.fh + pad * 2, r = field.fr + pad;
      const sw = w - 2 * r, sh = h - 2 * r, arc = (Math.PI / 2) * r;
      const perim = 2 * sw + 2 * sh + 4 * arc;
      const N = 34, gapStart = 0, gapEnd = (sw + arc) / perim; // top edge + top-right corner
      for (let i = 0; i < N; i++) {
        const t = i / N;
        if (t >= gapStart && t < gapEnd) continue; // entrance opening
        const [px, py] = roundedRectPoint(x, y, w, h, r, t);
        add('fence', px, py);
      }
    })();
    // decor
    add('bush', 40, 80); add('bush', 360, 66); add('bush', 405, 108); add('bush', 24, 112, { flip: true }); add('bush', 128, 118, { flip: true });
    add('flowers', 60, 118); add('flowers', 120, 138, { flip: true }); add('flowers', 345, 140); add('flowers', 390, 124, { flip: true }); add('flowers', 330, 112);
    // more bush/flowers around the pond (left side)
    add('bush', 50, 56); add('bush', 66, 96, { flip: true });
    add('flowers', 66, 48); add('flowers', 35, 64); add('flowers', 48, 92, { flip: true });
    add('mushroom', 108, 116); add('mushroom', 388, 94, { flip: true });
    add('rock', 26, 140); add('rock', 398, 142, { flip: true }); add('rock', 178, 58);
    add('log', 70, 132, { flip: true }); add('log', 340, 138);
    add('chest', 118, 90, { flip: true }); add('chest', 288, 108);
    // one grouped hay pile, up and to the right of the coop (95,86), the
    // left house — was two separate piles, the lower one sitting right on
    // the road (removed, merged in here instead)
    add('hay', 112, 72); add('hay', 122, 75, { flip: true });
    add('hay', 106, 78); add('hay', 128, 70, { flip: true });
    add('lantern', 272, 104);
    add('tallgrass', 300, 150, { flip: true }); add('tallgrass', 95, 150, { flip: true }); add('tallgrass', 410, 120); add('tallgrass', 55, 86);
    add('apple', 376, 104, { flip: true }); add('apple', 392, 112); add('bush', 406, 120, { flip: true });
    add('flowers', 372, 124); add('tallgrass', 388, 128, { flip: true }); add('mushroom', 360, 118);
    // sprinkle a few details into the open meadow
    add('rock', 240, 74); add('rock', 312, 70, { flip: true });
    add('tallgrass', 196, 70); add('tallgrass', 268, 60, { flip: true }); add('tallgrass', 322, 66);
    add('flowers', 214, 92, { flip: true }); add('flowers', 286, 56);
    add('sprout', 188, 102); add('sprout', 332, 96, { flip: true }); add('mushroom', 250, 86);
    add('lily', 60, 50); add('lily', 76, 53, { flip: true }); add('reeds', 46, 49); add('reeds', 88, 49, { flip: true });
    add('lily', 10, 42); add('lily', 426, 72, { flip: true }); add('lily', 220, 12); add('lily', 300, 156, { flip: true });
    add('reeds', 16, 150); add('reeds', 420, 30); add('rock', 8, 82, { flip: true }); add('rock', 428, 120);
    // lotus leaves scattered on the open water in the 4 corners (the only
    // spots with enough clearance from the island's coastline)
    add('lotus', 25, 25); add('lotusleaf', 60, 20, { flip: true });
    add('lotusleaf', 395, 28, { flip: true });
    add('lotus', 415, 145, { flip: true }); add('lotus', 370, 148, { flip: true });
    add('lotusleaf', 35, 140);

    items.sort((a, b) => a.baseY - b.baseY); items.forEach(drawSprite);

    // ---- upscale to output canvas ----
    canvas.width = OUT_W; canvas.height = OUT_H;
    const oc = canvas.getContext('2d');
    oc.imageSmoothingEnabled = false;
    oc.drawImage(art, 0, 0, AW, AH, 0, 0, OUT_W, OUT_H);

    // ---- FOCUS FARM logo (drawn crisp at output res) ----
    const pix = (window.FFScene && FFScene._fontReady) ? '"Pixelify Sans", monospace' : 'monospace';
    oc.textBaseline = 'top';
    function logoLine(txt, x, y, size) {
      oc.font = '700 ' + size + 'px ' + pix;
      oc.fillStyle = 'rgba(60,70,45,0.22)'; oc.fillText(txt, x + 9, y + 11);      // soft shadow
      oc.fillStyle = '#6f9a5a'; oc.fillText(txt, x + 5, y + 6);                    // green drop
      oc.fillStyle = COL.cream; oc.fillText(txt, x, y);                            // cream fill
      oc.lineWidth = 5; oc.strokeStyle = COL.ink; oc.strokeText(txt, x, y);        // outline
    }
    logoLine('FOCUS', 150, 70, 150);
    logoLine('FARM', 176, 214, 150);

    // ---- very faint scanline sheen ----
    oc.globalAlpha = 0.025; oc.fillStyle = '#ffffff';
    for (let y = 0; y < OUT_H; y += 6) oc.fillRect(0, y, OUT_W, 1);
    oc.globalAlpha = 1;

    // expose windmill placement (art-space) for the animated blades overlay
    window.FFScene.windmillPlacement = windmillPlacement;

    // expose every placed item (art-space name/cx/baseY/flip) so
    // FarmCanvas.tsx can build ground-animal obstacle regions and the
    // random top-layer occlusion set without hand-duplicating positions
    // here. flip is included so a top-layer redraw matches the orientation
    // already baked into the background.
    window.FFScene.sceneItems = items.map((it) => ({ name: it.name, cx: it.cx, baseY: it.baseY, flip: !!it.flip }));

    return canvas;
  }

  window.FFScene = { render, OUT_W, OUT_H };
})();
