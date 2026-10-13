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
  return compareVolume(store.entriesOf(exId).map(entry => ({ date: entry.date, entry, st: stats(entry, single) })).filter(x => x.st.n > 0));
}

/**
 * Volume compared set for set, so the trend follows how you did, not how many sets you planned. Doing fewer sets
 * never counts against you; doing more counts for you:
 *   - an earlier session counts no more sets than you've done in any session since: its best ones (the most
 *     weight × reps). Going from 3 sets to 2 compares your 2 with the best 2 of each earlier session;
 *   - a one-off short session (fewer sets than the sessions either side of it, or, while it's the latest, than both
 *     of the two before it, which includes a workout still being logged) is shown as logged and left out of the
 *     trend. Going back to your usual sets after a one-off extra set isn't short;
 *   - more sets count in full for as long as you keep doing them (a one-off extra set counts while it's the latest).
 * 'logged' (the switch in the status menu or on the Volume chart) counts every set as it was done.
 * Adds x.cv = {vol, n: sets done, counted, short, dropped: [the sets not counted, as text]} to each session.
 */
export function compareVolume(ser, mode = store.volumeView()) {
  const n = ser.map(x => x.st.setVols.length);
  const sets = mode === 'sets';
  ser.forEach((x, i) => {
    const last = i === ser.length - 1;
    x.cv = { n: n[i], short: sets && i > 0 && (last ? n[i] < Math.min(n[i - 1], i > 1 ? n[i - 2] : Infinity) : n[i] < n[i - 1] && n[i] < n[i + 1]) };
  });
  // walking back from the latest: cap = the fewest sets in any later session that isn't a one-off
  let cap = Infinity;
  for (let i = ser.length - 1; i >= 0; i--) {
    const c = ser[i].cv;
    const best = [...ser[i].st.setVols].sort((a, b) => b.vol - a.vol);
    c.counted = sets && !c.short ? Math.min(n[i], cap) : n[i];
    c.vol = best.slice(0, c.counted).reduce((a, s) => a + s.vol, 0);
    c.dropped = best.slice(c.counted).map(s => s.label);
    if (sets && !c.short) cap = Math.min(cap, n[i]);
  }
  return ser;
}
const counts = ser => ser.filter(x => !x.cv.short);

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
  const latest = ser[ser.length - 1];
  const use = counts(ser), n = use.length;
  if (n < 2) return null;
  const k = Math.min(3, Math.floor(n / 2));
  const mean = xs => xs.reduce((a, x) => a + x.cv.vol, 0) / xs.length;
  const recent = mean(use.slice(n - k)), before = mean(use.slice(n - 2 * k, n - k));
  if (!(before > 0)) return null;
  // what to say about it: the latest left out, or the earlier sessions counted on fewer sets than they had
  const trimmed = use.slice(n - 2 * k, n - k).filter(x => x.cv.counted < x.cv.n);
  const note = latest && latest.cv.short ? { kind: 'short', n: latest.cv.n, was: ser[ser.length - 2].cv.n }
    : trimmed.length ? { kind: 'trimmed', n: Math.min(...trimmed.map(x => x.cv.counted)) } : null;
  if (note && note.kind === 'short') note.was = Math.min(...ser.slice(-3, -1).map(x => x.cv.n));
  return { pct: (recent / before - 1) * 100, k, note };
}
/** The trend's note as a short label and a sentence, or null. */
export function trendNote(tr) {
  if (!tr || !tr.note) return null;
  const s = n => `${n} ${n === 1 ? 'set' : 'sets'}`;
  if (tr.note.kind === 'short') return { label: 'fewer sets: left out', title: `Your latest session has ${s(tr.note.n)}, fewer than the ${tr.note.was} before it. A one-off short session isn’t counted against you; if you keep doing ${s(tr.note.n)}, earlier sessions will be compared on their best ${tr.note.n}.` };
  return { label: `best ${s(tr.note.n)} each`, title: `Compared set for set: you do ${s(tr.note.n)} now, so earlier sessions count their best ${tr.note.n}. Doing fewer sets never counts against you; doing more counts for you.` };
}
/** "↑ 6.2%" / "↓ 12%" / "steady" (within 1%): the volume trend as the Track card shows it. */
export function trendText(t) {
  const dir = Math.abs(t.pct) < 1 ? 'flat' : t.pct > 0 ? 'up' : 'down';
  const a = Math.abs(t.pct);
  return { dir, text: dir === 'flat' ? 'steady' : `${t.pct > 0 ? '+' : '−'}${a < 10 ? num(Math.round(a * 10) / 10) : Math.round(a)}%` };
}
/** Volume per session, each point the average of it and up to two sessions before (the line the trend follows). */
export const rollingVolumePoints = ser => { const use = counts(ser); return use.map((x, i) => {
  const w = use.slice(Math.max(0, i - 2), i + 1);
  return { date: x.date, y: w.reduce((a, s) => a + s.cv.vol, 0) / w.length };
}); };

/** Volume per session as compared; a one-off short session is a hollow dot off the line. */
export const volumePoints = ser => ser.map(x => ({
  date: x.date, y: x.cv.vol, ghost: x.cv.short,
  tip: x.cv.short ? `${setsLabel(x.entry)} · fewer sets than the sessions around it: left out of the trend`
    : x.cv.dropped.length ? `${setsLabel(x.entry)} · best ${x.cv.counted} counted (you do ${x.cv.counted} now)` : setsLabel(x.entry),
}));
/** The latest session's volume against the one before it that counts. */
export const lastVolumePair = ser => { const use = counts(ser); return use.length > 1 ? [use[use.length - 2].cv.vol, use[use.length - 1].cv.vol] : null; };
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
