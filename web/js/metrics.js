// The maths: how red a muscle gets from a split, and what a logged session is worth.
import { ex, credit } from './catalog.js';
import { num } from './util.js';

// ---------- coverage of a split ----------
// Each muscle gets a score from the split, and the score picks its colour.
//
// Direct work (lifts that train the muscle directly, 1 each):
//   per day, the first counts in full and any further ones that day count SAME_DAY_EXTRA.
//   So one direct lift = 1, two on different days = 2, two on the same day = 1.4.
//
// Helper work (lifts that only help, 0.5 each, the "fractional sets" convention), added up the same way.
// What it is worth depends on whether the muscle also has direct work:
//   - no direct lift anywhere in the split: helpers count as they are, but stop at HELPED_CAP, a pale tint
//     below the colour of one direct lift. Helpers alone never add up to a hit.
//   - with direct work: helpers count HELPER_ON_TOP of their value, and still never add more than HELPED_CAP.
//     In the one study that put a helper on top of a direct exercise (bench press added to triceps
//     extensions), it added about a third of the growth it produced alone.
// So one direct lift with three helpers on other days = 1 + 0.3 × 1.5 = 1.45: more than one direct lift,
// clearly less than two. The Science page (web/js/views/science.js) sets out the evidence.
export const SAME_DAY_EXTRA = 0.4;
export const HELPED_CAP = 0.6;
export const HELPER_ON_TOP = 0.3;
const dayValue = load => Math.min(load, 1) + SAME_DAY_EXTRA * Math.max(0, load - 1);

/**
 * days: [{items: [{ex, sets}]}] → Map(zone → {score, directScore, helperScore, helperPart, capped, direct, touched, sets, hits})
 *   score = what the model shows = directScore + helperPart
 *   helperScore = helper work at face value; helperPart = what it's allowed to add; capped = the cap held it back
 *   direct = days with direct work; touched = days with any; sets = planned sets, helpers counting half
 */
export function coverage(days) {
  const out = new Map();
  const get = z => {
    let c = out.get(z);
    if (!c) out.set(z, (c = { score: 0, directScore: 0, helperScore: 0, helperPart: 0, capped: false, direct: 0, touched: 0, sets: 0, hits: [] }));
    return c;
  };
  days.forEach((day, di) => {
    const directLoad = new Map(), helperLoad = new Map();
    for (const item of day.items) {
      const e = ex(item.ex);
      if (!e) continue;
      for (const z of [...e.p, ...e.s]) {
        const c = credit(e, z);
        const load = c === 1 ? directLoad : helperLoad;
        load.set(z, (load.get(z) || 0) + c);
        const cov = get(z);
        cov.sets += c * (item.sets || 0);
        cov.hits.push({ day: di, ex: e.id, credit: c, sets: item.sets || 0 });
      }
    }
    for (const z of new Set([...directLoad.keys(), ...helperLoad.keys()])) {
      const cov = get(z);
      cov.touched += 1;
      if (directLoad.has(z)) { cov.direct += 1; cov.directScore += dayValue(directLoad.get(z)); }
      if (helperLoad.has(z)) cov.helperScore += dayValue(helperLoad.get(z));
    }
  });
  for (const cov of out.values()) {
    const worth = cov.direct ? HELPER_ON_TOP * cov.helperScore : cov.helperScore;
    cov.helperPart = Math.min(HELPED_CAP, worth);
    cov.capped = worth > HELPED_CAP;
    cov.score = cov.directScore + cov.helperPart;
  }
  return out;
}

// ---------- heat: silver → light red → red → deep red ----------
export const SILVER = '#9ba2b4';
export const HEAT = [        // [score, colour]; one hue, getting deeper
  [0.5, '#bfa0a6'],
  [1, '#f08c8c'],
  [2, '#e5383b'],
  [3, '#b8111f'],
  [4, '#7d0915'],
];
export const HEAT_MAX = HEAT[HEAT.length - 1][0];
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');

/** The pale tint of a muscle that is helped but never trained directly: also used for "helps" on tiles. */
export const helpedColour = () => heat(HELPED_CAP);

/** Colour for a coverage score (null when the muscle isn't touched at all). */
export function heat(score) {
  if (!score || score <= 0) return null;
  if (score <= HEAT[0][0]) return mix(SILVER, HEAT[0][1], score / HEAT[0][0]);
  for (let i = 1; i < HEAT.length; i++) {
    if (score <= HEAT[i][0]) return mix(HEAT[i - 1][1], HEAT[i][1], (score - HEAT[i - 1][0]) / (HEAT[i][0] - HEAT[i - 1][0]));
  }
  return HEAT[HEAT.length - 1][1];
}

// ---------- a logged session of one exercise ----------
/** Estimated one-rep max (Epley). Lets a 110×10 be compared with a 100×12. */
export const e1rm = (w, r) => (r <= 1 ? w : w * (1 + r / 30));

/**
 * One set as it's measured. A single-arm or single-leg set has reps for each side, r (right) and l (left):
 *   total = both sides together (what volume and total reps count), r = reps per side (the average of the two:
 *   what the best set and Est. 1RM use, so progress on either side shows), R and L the sides themselves.
 * single: the lift is one-sided. Sets logged before it was marked that way (one number) count for each side,
 * which is how one-arm lifts are usually written down (70 × 10 = 10 each arm).
 * → {w, r, total, R, L, sides} or null when the set has no reps.
 */
export function setOf(x, single = false) {
  if (!x) return null;
  const w = +x.w || 0;
  const R = x.r == null || x.r === '' ? null : +x.r, L = x.l == null || x.l === '' ? null : +x.l;
  if (L != null || single) {
    const r_ = R ?? L, l_ = L ?? R;
    if (!(r_ > 0 || l_ > 0)) return null;
    return { w, r: (r_ + l_) / 2, total: r_ + l_, R: r_, L: l_, sides: L != null };
  }
  return R > 0 ? { w, r: R, total: R, R: null, L: null, sides: false } : null;
}
/** Reps as they're written: "10", or "10/9" for right and left. */
export const repsText = x => (x.sides ? `${x.R}/${x.L}` : String(x.r));

/**
 * entry: {sets: [{w, r}]} → {n, reps, volume, heavy: {w, r}, work: {w, reps, sets}, best: {w, r, e1}, top: {w, r, load}, weighted}
 *   heavy = the "best set" as lifters say it: the heaviest weight, and the most reps done at that weight
 *   work  = the session's working weight (the heaviest) and the reps done at it, added over its sets:
 *           225 × 9, 5, 5 → {w: 225, reps: 19, sets: [9, 5, 5]}. Bodyweight sessions: every set, w = 0.
 *   avgW  = the average weight per rep: each set's weight counted once for every rep in it, so
 *           215 × 12, 225 × 8, 225 × 6 → (215·12 + 225·8 + 225·6) ÷ 26 = 220.4. avgW × reps = volume.
 *   best  = the set with the highest estimated one-rep max (what the Est. 1RM line plots)
 * Sets without reps are ignored. A session with no weight on any set is treated as bodyweight:
 * volume is total reps and both "best" sets are the one with most reps.
 */
export function stats(entry, single = false) {
  const sets = (entry.sets || []).map(x => setOf(x, single)).filter(Boolean);
  const weighted = sets.some(x => x.w > 0);
  let volume = 0, reps = 0, best = null, top = null, heavy = null;
  for (const x of sets) {
    if (!heavy || heavier(x, heavy)) heavy = x;
    reps += x.total;
    volume += weighted ? x.w * x.total : x.total;
    const e1 = weighted ? e1rm(x.w, x.r) : x.r;
    if (!best || e1 > best.e1) best = { ...x, e1 };
    const load = weighted ? x.w * x.total : x.total;
    if (!top || load > top.load) top = { ...x, load };
  }
  const atTop = heavy ? sets.filter(x => x.w === heavy.w) : [];
  const work = { w: heavy ? heavy.w : 0, reps: atTop.reduce((a, x) => a + x.total, 0), sets: atTop.map(repsText) };
  return { n: sets.length, reps, volume, heavy, work, avgW: weighted && reps ? volume / reps : 0, best, top, weighted };
}

/** Is set a a better "best set" than b? Heavier wins; at the same weight, more reps wins. */
export const heavier = (a, b) => a.w > b.w || (a.w === b.w && a.r > b.r);

/** "135 × 12, 11, 8"  ·  "135×12 · 140×10"  ·  "12, 11, 8" (bodyweight)  ·  "50 × 10/9, 9/9" (right/left) */
export function setsLabel(entry) {
  const sets = (entry.sets || []).map(x => setOf(x)).filter(Boolean);
  if (!sets.length) return '';
  const ws = [...new Set(sets.map(x => x.w))];
  if (ws.length === 1) return (ws[0] ? `${num(ws[0])} × ` : '') + sets.map(repsText).join(', ');
  return sets.map(x => `${num(x.w)}×${repsText(x)}`).join(' · ');
}

export const setLabel = x => (x.w ? `${num(x.w)} × ${repsText(x)}` : `${repsText(x)} reps`);

/** Percent change from a to b, or null when it can't be said. */
export const change = (a, b) => (a > 0 && b != null ? (b - a) / a * 100 : null);
