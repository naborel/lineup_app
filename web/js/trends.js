// Progress by muscle: every exercise's own change over a time window, combined for each muscle and group.
//
// You can't add a 225 lb row to a 30 lb curl, so each exercise is measured against itself, as a percentage:
//   strength = its Est. 1RM (most reps for bodyweight work): the average of its last few sessions in the window
//              against the average of its first few (up to 3 and 3, the same rule as the Track card)
//   volume   = the same for weight × reps over all sets
// A muscle's trend is the average of the exercises that train it directly — its main muscle. Exercises that only
// help (rows for the biceps, presses for the triceps) are left out: they're usually stopped by the main muscle, not
// the helper, so their numbers say little about it. They're counted, so a muscle trained only that way can say so.
// A group (Chest, Back…) is the same over every exercise whose main muscle is in it.
import * as store from './store.js';
import * as cat from './catalog.js';
import { series, compareVolume } from './progress.js';
import { today, addDays } from './util.js';

/** Time windows, in days (null = everything). */
export const WINDOWS = [
  { id: '4w', label: '4 weeks', days: 28 },
  { id: '3m', label: '3 months', days: 91 },
  { id: '6m', label: '6 months', days: 182 },
  { id: 'all', label: 'All', days: null },
];
export const windowOf = id => WINDOWS.find(w => w.id === id) || WINDOWS[1];

const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const kOf = n => Math.min(3, Math.floor(n / 2));
/** The last k values against the first k, as a percentage (k up to 3, at most half of them). */
function change(vals) {
  const n = vals.length;
  if (n < 2) return null;
  const k = kOf(n), a = mean(vals.slice(0, k)), b = mean(vals.slice(n - k));
  return a > 0 ? (b / a - 1) * 100 : null;
}

/**
 * Each logged exercise's change over the window. An exercise needs two sessions to have a trend: the ones in the
 * window, plus the last one before it, so a lift trained once in the window still compares with where it was.
 * → [{id, e, pts: [{date, s (strength), v (volume)}], strength, volume, sessions, last}]
 */
export function exerciseTrends(windowId) {
  const w = windowOf(windowId);
  const since = w.days ? addDays(today(), -w.days) : null;
  const out = [];
  for (const id of store.loggedIds()) {
    const e = cat.ex(id);
    if (!e) continue;
    let ser = series(id);
    if (!ser.length) continue;
    // a lift logged both with and without weight is compared within the kind of its latest session
    const weighted = ser[ser.length - 1].st.weighted;
    ser = compareVolume(ser.filter(x => x.st.weighted === weighted));
    let pts = since ? ser.filter(x => x.date > since) : ser;
    if (!pts.length) continue;
    if (since) { const before = ser.filter(x => x.date <= since).pop(); if (before) pts = [before, ...pts]; }
    // volume set for set (or as logged; the same switch as Track), one-off short sessions left out
    const p = pts.map(x => ({ date: x.date, s: x.st.best.e1, v: x.cv.short ? null : x.cv.vol }));
    out.push({ id, e, pts: p, strength: change(p.map(x => x.s)), volume: change(p.map(x => x.v).filter(v => v != null)), sessions: p.length, last: p[p.length - 1].date, weighted });
  }
  return out;
}

/**
 * The trend for one muscle ('lats') or a whole group ('g:Back') from the exercises' trends.
 * Only exercises that train it directly count; `helpers` is how many others help it.
 * → {strength, volume, exercises: [{…exercise trend, credit}], helpers, index: [{date, y}]}
 *   index: strength over time, the same average taken at each session date, so it ends at `strength`
 */
export function trendFor(list, key) {
  const ex = [];
  let helpers = 0;
  for (const t of list) { const c = cat.credit(t.e, key); if (c >= 1) ex.push({ ...t, credit: 1 }); else if (c) helpers++; }
  const avg = field => {
    const xs = ex.filter(t => t[field] != null);
    const w = xs.reduce((a, t) => a + t.credit, 0);
    return w ? xs.reduce((a, t) => a + t.credit * t[field], 0) / w : null;
  };
  ex.sort((a, b) => (b.strength ?? -1e9) - (a.strength ?? -1e9));
  return { strength: avg('strength'), volume: avg('volume'), exercises: ex, helpers, index: indexOf(ex.filter(t => t.strength != null)) };
}

// Each exercise's change so far (the average of its sessions up to that date, at most its last k, against the
// average of its first k), averaged over the exercises trained by then. The last point is the headline number.
function indexOf(ex) {
  const dates = [...new Set(ex.flatMap(t => t.pts.map(p => p.date)))].sort();
  return dates.map(d => {
    let w = 0, sum = 0;
    for (const t of ex) {
      const upto = t.pts.filter(p => p.date <= d);
      if (!upto.length) continue;
      const k = kOf(t.pts.length), base = mean(t.pts.slice(0, k).map(p => p.s)), cur = mean(upto.slice(-k).map(p => p.s));
      if (base > 0) { w += t.credit; sum += t.credit * (cur / base - 1) * 100; }
    }
    return { date: d, y: w ? sum / w : 0 };
  });
}

/** How a trend reads: up / down / flat (within 1%) / none, and its text (+4.2%, −12%, steady, —). */
export function readTrend(pct) {
  if (pct == null) return { dir: 'none', text: '—' };
  const a = Math.abs(pct);
  if (a < 1) return { dir: 'flat', text: 'steady' };
  return { dir: pct > 0 ? 'up' : 'down', text: `${pct > 0 ? '+' : '−'}${a < 10 ? (Math.round(a * 10) / 10).toFixed(1).replace(/\.0$/, '') : Math.round(a)}%` };
}

// ---------- colour on the body: green where you're getting stronger, amber where you're not ----------
const SILVER = [155, 162, 180], STEADY = [128, 135, 152], GOOD = [85, 211, 167], WARM = [242, 182, 94];
const mix = (a, b, t) => `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(', ')})`;
/** null (no trend) → silver; within 1% → a quiet grey; then more green or amber the bigger the change, full at 10%. */
export function trendColour(pct) {
  if (pct == null) return null;
  const a = Math.abs(pct);
  if (a < 1) return mix(SILVER, STEADY, 1);
  const t = 0.35 + 0.65 * Math.min(1, (a - 1) / 9);
  return mix(STEADY, pct > 0 ? GOOD : WARM, t);
}
