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
    const icx = 216, icy = 84;
    const base = isleBase(icx, icy, 200, 64, 0.085, 20);
    const isl = { x: 12, y: 16, w: 408, h: 134 }; // approx bounds for texture/placement
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
    trail([[93, 94], [150, 101], [205, 106], [252, 110], [300, 115], [352, 119], [416, 123]], 7);
    trail([[252, 111], [250, 117]], 5);

    // ---- field (organic soil patch) ----
    const field = (function () {
      const fcx = 226, fcy = 132, frx = 84, fry = 26;
      const sb = isleBase(fcx, fcy, frx, fry, 0.07, 16);
      c.save(); closedPath(expand(sb, fcx, fcy, 2)); c.fillStyle = COL.soilDk; c.fill(); c.restore();
      c.save(); closedPath(sb); c.fillStyle = COL.soil; c.fill(); c.clip();
      for (let i = 0; i < 2600; i++) { const x = ri(fcx - frx, fcx + frx), y = ri(fcy - fry, fcy + fry); c.fillStyle = f() < 0.5 ? COL.soilL : COL.soilD; c.fillRect(x, y, 1, 1); }
      // soft tilled hints (subtle, short dashes)
      c.fillStyle = COL.soilD;
      for (let yy = fcy - fry + 7; yy < fcy + fry - 4; yy += 7) for (let xx = fcx - frx + 6; xx < fcx + frx - 6; xx += 4) { if (f() < 0.7) c.fillRect(xx, yy, 2, 1); }
      c.restore();
      return { cx: fcx, cy: fcy, rx: frx, ry: fry, fx: fcx - frx, fy: fcy - fry, fw: frx * 2, fh: fry * 2 };
    })();

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
    add('pine', 362, 50); add('tree', 392, 46); add('tree', 414, 54, { flip: true });
    add('tree', 200, 66, { flip: true }); add('pine', 258, 72); add('apple', 150, 82); add('tree', 360, 86); add('pine', 408, 98);
    // buildings
    add('coop', 95, 86); add('house', 252, 108); add('well', 358, 118);
    // ---- field planting — natural curated scatter (cute, uncluttered) ----
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
      // golden wheat bundles
      add('wheat', 174, 124); add('wheat', 196, 121, { flip: true }); add('wheat', 250, 119);
      // seedlings on mounds
      plant('sprout', 216, 129); plant('sprout', 236, 141, { flip: true }); plant('sprout', 270, 134);
      plant('sprout', 182, 147); plant('carrot', 228, 151, { flip: true }); plant('carrot', 286, 147);
      // leafy crops (sit directly)
      add('crop2', 208, 143, { flip: true }); add('crop2', 258, 149); add('crop2', 162, 138);
      // tall grass tufts for softness
      add('tallgrass', 244, 131); add('tallgrass', 200, 151, { flip: true }); add('tallgrass', 278, 120);
      // sunflowers stand at the back corners
      add('sunflower', 158, 120); add('sunflower', 300, 122, { flip: true });
      // scarecrow at the back
      add('scarecrow', 226, 116);
    })();
    add('sign', 144, 142);
    // post-and-rail fence following the field's front edge
    (function () {
      for (let i = 0; i <= 9; i++) {
        const t = i / 9, x = field.cx - field.rx + 8 + t * (field.rx * 2 - 16);
        const yy = field.cy + field.ry + 2 - Math.sin(t * Math.PI) * 2;
        add('fence', x, yy);
      }
    })();
    // decor
    add('bush', 40, 80); add('bush', 360, 66); add('bush', 405, 108); add('bush', 24, 112, { flip: true }); add('bush', 128, 118, { flip: true });
    add('flowers', 60, 118); add('flowers', 120, 138, { flip: true }); add('flowers', 345, 140); add('flowers', 390, 124, { flip: true }); add('flowers', 330, 112);
    add('mushroom', 108, 116); add('mushroom', 388, 94, { flip: true });
    add('rock', 26, 140); add('rock', 398, 142, { flip: true }); add('rock', 178, 58);
    add('log', 70, 132, { flip: true }); add('log', 340, 138);
    add('chest', 118, 90, { flip: true }); add('chest', 288, 108);
    add('hay', 116, 98); add('hay', 132, 100, { flip: true });
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

    return canvas;
  }

  window.FFScene = { render, OUT_W, OUT_H };
})();
