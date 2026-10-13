// Progress for one exercise: its sessions in order, the best set you've done, and what the app shows.
//   Best set = the set itself, "225 × 12": the heaviest weight you've lifted and the most reps you got with it
//   Reps     = the session's working weight and the reps done at it, added over its sets: 225 × 9, 5, 5 is
//              19 reps at 225. Progress is reps climbing at a weight, then the weight going up (and the reps
//              starting lower again: that's a step forward, so it's shown as the weight going up, not a drop)
//   Est. 1RM = the session's strongest set as an estimated one-rep max, so sets at different weights
//              sit on one line (110 × 10 plots above 100 × 12)
//   Volume   = weight × reps over all sets: only a trend line now, because nobody knows what 4,275 lb means
// 3 sets of 11, 10, 6 → 12, 11, 8 at the same weight raises all of them.
import { h, icon, fmt, num } from './util.js';
import * as store from './store.js';
import { stats, setsLabel, setLabel, change, heavier, repsText } from './metrics.js';

/** Sessions with at least one completed set, oldest first: [{date, entry, st}] */
export function series(exId) {
  const single = store.isSingle(exId);
  return store.entriesOf(exId).map(entry => ({ date: entry.date, entry, st: stats(entry, single) })).filter(x => x.st.n > 0);
}

/**
 * The session holding your best set: the heaviest weight, and the most reps at that weight.
 * The first time it happened holds the title until it's beaten.
 */
export function bestEver(ser) {
  let top = null;
  for (const x of ser) if (!top || heavier(x.st.heavy, top.st.heavy)) top = x;
  return top;
}
/** A session's best set as text: "225 × 12", or "15 reps" for bodyweight work */
export const setText = st => setLabel(st.heavy);

export const volumeLabel = st => (st.weighted ? `${fmt.format(Math.round(st.volume))} ${store.unit()}` : `${st.reps} reps`);
export const bestLabel = st => (st.best ? (st.weighted ? `${fmt.format(Math.round(st.best.e1))} ${store.unit()}` : `${repsText(st.best)} reps`) : '—');

/** "19 reps", and what it's at: "Reps at 225" (or "Reps" for bodyweight work). */
export const repsLabel = st => `${st.work.reps} ${st.work.reps === 1 ? 'rep' : 'reps'}`;
export const repsTitle = st => (st.work.w ? `Reps at ${num(st.work.w)}` : 'Reps');

/**
 * What changed since the session before, as a chip: the weight went up (+10 lb, a step forward even though
 * the reps start lower), went down, or stayed and the reps moved (+1 rep / −2 reps / same).
 */
export function repsChip(prev, last) {
  if (!prev) return null;
  const a = prev.st.work, b = last.st.work, u = store.unit();
  if (a.w !== b.w) {
    const up = b.w > a.w;
    return h('span', { class: `delta ${up ? 'up' : 'flat'} wchg`, title: up ? `Up from ${num(a.w)} to ${num(b.w)} ${u}. Fewer reps at a new weight is normal: the count starts again from here.` : `Down from ${num(a.w)} to ${num(b.w)} ${u}` },
      icon(up ? 'up' : 'down'), `${num(Math.abs(b.w - a.w))} ${u}`);
  }
  const d = b.reps - a.reps;
  const dir = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
  return h('span', { class: `delta ${dir}`, title: `Reps${b.w ? ` at ${num(b.w)} ${u}` : ''}, compared with the session before` }, icon(dir),
    d ? `${d > 0 ? '+' : '−'}${Math.abs(d)} ${Math.abs(d) === 1 ? 'rep' : 'reps'}` : 'same');
}
/** Reps at the working weight per session: [{date, y}] (Track's little line) */
export const repsPoints = ser => ser.map(x => ({ date: x.date, y: x.st.work.reps }));

// The details chart splits each session's work into its two halves: average weight × total reps = volume.
/** Average weight per rep, each session (215 × 12, 225 × 8, 225 × 6 → 220.4). Bodyweight sessions have none. */
export const avgWeightPoints = ser => ser.map(x => ({ date: x.date, y: x.st.weighted ? x.st.avgW : null }));
/** All the reps of each session. */
export const totalRepsPoints = ser => ser.map(x => ({ date: x.date, y: x.st.reps }));

/**
 * Which way the work is going, as one number: the average volume of your last few sessions against the same
 * number of sessions before them (3 and 3 once there are 6; 2 and 2 with 4 or 5; last time against the time
 * before with 2 or 3), so one off day doesn't swing it. → {pct, k} or null before there are 2 sessions.
 * Volume is weight × reps over all sets (all the reps for bodyweight work).
 */
export function volumeTrend(ser) {
  const n = ser.length;
  if (n < 2) return null;
  const k = Math.min(3, Math.floor(n / 2));
  const mean = xs => xs.reduce((a, x) => a + x.st.volume, 0) / xs.length;
  const recent = mean(ser.slice(n - k)), before = mean(ser.slice(n - 2 * k, n - k));
  return before > 0 ? { pct: (recent / before - 1) * 100, k } : null;
}
/** "↑ 6.2%" / "↓ 12%" / "steady" (within 1%): the volume trend as the Track card shows it. */
export function trendText(t) {
  const dir = Math.abs(t.pct) < 1 ? 'flat' : t.pct > 0 ? 'up' : 'down';
  const a = Math.abs(t.pct);
  return { dir, text: dir === 'flat' ? 'steady' : `${t.pct > 0 ? '+' : '−'}${a < 10 ? num(Math.round(a * 10) / 10) : Math.round(a)}%` };
}
/** Volume per session, each point the average of it and up to two sessions before (the line the trend follows). */
export const rollingVolumePoints = ser => ser.map((x, i) => {
  const w = ser.slice(Math.max(0, i - 2), i + 1);
  return { date: x.date, y: w.reduce((a, s) => a + s.st.volume, 0) / w.length };
});

export const volumePoints = ser => ser.map(x => ({ date: x.date, y: x.st.volume, tip: setsLabel(x.entry) }));
export const bestPoints = ser => ser.map(x => ({ date: x.date, y: x.st.best.e1, tip: setLabel(x.st.best) }));

/** ▲ +6% / ▼ −3% / – same, comparing the last two sessions. */
export function deltaChip(a, b) {
  const pct = change(a, b);
  if (pct == null) return null;
  const r = Math.round(pct * 10) / 10;
  const dir = r > 0.05 ? 'up' : r < -0.05 ? 'down' : 'flat';
  return h('span', { class: `delta ${dir}`, title: 'Compared with the session before' }, icon(dir),
    dir === 'flat' ? 'same' : `${r > 0 ? '+' : '−'}${num(Math.abs(r))}%`);
}

/** What changed between the last two sessions, in words (for the sheet). */
export function lastChange(ser) {
  if (ser.length < 2) return null;
  const a = ser[ser.length - 2].st, b = ser[ser.length - 1].st;
  return { volume: change(a.volume, b.volume), best: change(a.best.e1, b.best.e1), reps: b.reps - a.reps };
}
