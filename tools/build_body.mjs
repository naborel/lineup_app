// One-off: turn the open-source body map (tools/body_raw.json) into data/body.json, the shape the app reads.
//
// Source: react-muscle-highlighter 1.2.0 (MIT, "My Muscle Contributors"), male front/back views.
// What this adds on top of the source paths:
//   - each path is assigned to one of Lineup's muscle zones (finer than the source: e.g. the single
//     chest shape is cut into upper and mid/lower, each deltoid into front/side or rear/side, and the
//     trapezius diamond into upper traps and mid back)
//   - cuts are done here, once, with real geometry (paper.js), so the app only ever draws plain paths
//   - every part carries its bounding box, used to frame the little muscle crops on exercise tiles
//
// Needs: node, playwright (chromium) and paper (npm).  Run: node tools/build_body.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const raw = JSON.parse(fs.readFileSync(path.join(here, 'body_raw.json'), 'utf8'));

const AXIS = { front: 364, back: 1083.5 };          // the figure's centre line in each view
const VIEWBOX = { front: [34, 96, 660, 1270], back: [753.5, 96, 660, 1270] };
const GAP = 1.6;                                    // half the gap left between two halves of a cut shape

// Cuts, written for the figure's left-hand side (screen left); the right side is mirrored.
// Each cut is a line a→b; "first" is the zone on the upper/outer side, "second" the other.
const CUTS = {
  'front|chest': { a: [240, 388], b: [366, 346], first: 'chest_upper', second: 'chest_lower', firstSide: 'above' },
  'front|deltoids': { a: [243, 295], b: [218, 402], first: 'delt_side', second: 'delt_front', firstSide: 'left' },
  'back|deltoids': { a: [944, 303], b: [920, 402], first: 'delt_side', second: 'delt_rear', firstSide: 'left' },
  'back|trapezius': { a: [995, 338], b: [1082, 350], first: 'traps_upper', second: 'mid_back', firstSide: 'above' },
};

const SIMPLE = {
  front: {
    obliques: 'obliques', abs: 'abs', biceps: 'biceps', triceps: 'tri_long', neck: 'neck', trapezius: 'traps_upper',
    adductors: 'adductors', quadriceps: 'quads', tibialis: 'tibialis', calves: 'calves', forearm: 'forearms',
  },
  back: {
    neck: 'traps_upper', forearm: 'forearms', adductors: 'adductors', hamstring: 'hamstrings', calves: 'calves',
  },
};
const BASE = new Set(['head', 'hair', 'hands', 'feet', 'ankles', 'knees']);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<canvas id="c" width="10" height="10"></canvas>');
await page.addScriptTag({ path: require.resolve('paper/dist/paper-core.min.js') });

const result = await page.evaluate(({ raw, AXIS, VIEWBOX, GAP, CUTS, SIMPLE, BASE }) => {
  /* global paper */
  paper.setup(document.getElementById('c'));
  BASE = new Set(BASE);
  const r1 = v => Math.round(v * 10) / 10;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  document.body.append(svg);
  const bboxOf = d => {
    const p = document.createElementNS(svgNS, 'path');
    p.setAttribute('d', d); svg.append(p);
    const b = p.getBBox(); p.remove();
    return [r1(b.x), r1(b.y), r1(b.width), r1(b.height)];
  };
  const area = bb => bb[2] * bb[3];
  // Uncut paths are kept exactly as the source wrote them (they use compact arc flags that are easy to corrupt).
  const tidy = d => d;
  const cutPath = (d, cut, mirrorAxis) => {
    const mx = x => (mirrorAxis == null ? x : 2 * mirrorAxis - x);
    const a = [mx(cut.a[0]), cut.a[1]], b = [mx(cut.b[0]), cut.b[1]];
    // direction and a unit normal of the cut line
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len;
    const far = 600;
    const half = sign => {
      const o = sign * GAP;
      const p1 = [a[0] - dx * 3 + nx * o, a[1] - dy * 3 + ny * o], p2 = [b[0] + dx * 3 + nx * o, b[1] + dy * 3 + ny * o];
      return new paper.Path({ segments: [p1, p2, [p2[0] + nx * sign * far, p2[1] + ny * sign * far], [p1[0] + nx * sign * far, p1[1] + ny * sign * far]], closed: true });
    };
    // The source paths use compact arc flags paper.js can't parse, so trace the outline the browser draws instead.
    const el = document.createElementNS(svgNS, 'path');
    el.setAttribute('d', d); svg.append(el);
    const total = el.getTotalLength(), steps = Math.ceil(total / 1.5), pts = [];
    for (let i = 0; i < steps; i++) { const pt = el.getPointAtLength(total * i / steps); pts.push([pt.x, pt.y]); }
    el.remove();
    const src = new paper.Path({ segments: pts, closed: true });
    const pieces = [1, -1].map(sign => {
      const clip = half(sign);
      const piece = src.intersect(clip, { insert: false });
      const centre = piece.bounds.center;
      const dd = piece.pathData.replace(/-?\d+\.\d+/g, m => String(r1(parseFloat(m))));
      clip.remove();
      return { d: dd, cx: centre.x, cy: centre.y };
    });
    src.remove();
    // which piece is "first"?
    let firstIdx;
    if (cut.firstSide === 'above') firstIdx = pieces[0].cy < pieces[1].cy ? 0 : 1;
    else { // 'left' means the outer side: screen-left on the left limb, screen-right on the mirrored one
      const leftIdx = pieces[0].cx < pieces[1].cx ? 0 : 1;
      firstIdx = mirrorAxis == null ? leftIdx : 1 - leftIdx;
    }
    return [{ zone: cut.first, d: pieces[firstIdx].d }, { zone: cut.second, d: pieces[1 - firstIdx].d }];
  };

  const out = { views: {} };
  ['front', 'back'].forEach((side, vi) => {
    const parts = [], base = [];
    for (const group of raw[side]) {
      for (const lr of ['left', 'right', 'common']) {
        const list = group.path[lr] || [];
        if (!list.length) continue;
        if (BASE.has(group.slug)) { list.forEach(d => base.push({ d: tidy(d), kind: group.slug })); continue; }
        const key = side + '|' + group.slug;
        if (CUTS[key]) {
          list.forEach(d => cutPath(d, CUTS[key], lr === 'right' ? AXIS[side] : null).forEach(p => parts.push({ z: p.zone, d: p.d })));
          continue;
        }
        if (SIMPLE[side][group.slug]) { list.forEach(d => parts.push({ z: SIMPLE[side][group.slug], d: tidy(d) })); continue; }
        // groups whose paths go to different zones, told apart by size and position
        const withBB = list.map(d => ({ d, bb: bboxOf(d) }));
        const bySize = [...withBB].sort((p, q) => area(q.bb) - area(p.bb));
        if (key === 'back|upper-back') {            // big wing = lats; of the two small ones the higher sits on the shoulder blade
          const small = bySize.slice(1).sort((p, q) => p.bb[1] - q.bb[1]);
          parts.push({ z: 'lats', d: tidy(bySize[0].d) }, { z: 'mid_back', d: tidy(small[0].d) }, { z: 'lats', d: tidy(small[1].d) });
        } else if (key === 'back|lower-back') {     // inner column = spinal erectors; outer flank = obliques seen from behind
          parts.push({ z: 'lower_back', d: tidy(bySize[0].d) }, { z: 'obliques', d: tidy(bySize[1].d) });
        } else if (key === 'back|gluteal') {
          parts.push({ z: 'glutes', d: tidy(bySize[0].d) }, { z: 'glute_med', d: tidy(bySize[1].d) });
        } else if (key === 'back|triceps') {        // the path nearest the torso = long head
          const dist = p => Math.abs(p.bb[0] + p.bb[2] / 2 - AXIS[side]);
          const lower = withBB.filter(p => p !== withBB[0]);   // path 0 is the upper outer head on both arms
          const long = lower.sort((p, q) => dist(p) - dist(q))[0];
          withBB.forEach(p => parts.push({ z: p === long ? 'tri_long' : 'tri_lat', d: tidy(p.d) }));
        } else throw new Error('No zone for ' + key);
      }
    }
    parts.forEach(p => { p.bb = bboxOf(p.d); });
    out.views[side] = { vb: VIEWBOX[side], outline: tidy(raw.outlines[vi]), parts, base: base.map(b => ({ d: b.d, bb: bboxOf(b.d) })) };
  });
  return out;
}, { raw, AXIS, VIEWBOX, GAP, CUTS, SIMPLE, BASE: [...BASE] }).catch(async err => { await browser.close(); throw err; });
await browser.close();

result.source = 'react-muscle-highlighter 1.2.0 (MIT) — zones re-cut for Liftboard by tools/build_body.mjs';
const outFile = path.join(here, '..', 'data', 'body.json');
fs.writeFileSync(outFile, JSON.stringify(result));
const zones = {};
for (const v of Object.values(result.views)) for (const p of v.parts) zones[p.z] = (zones[p.z] || 0) + 1;
console.log('wrote', outFile, fs.statSync(outFile).size, 'bytes');
console.log(zones);
