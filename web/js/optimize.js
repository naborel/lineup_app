// Optimize sets: a proposal for how many sets each exercise in the split gets. Never applied by itself.
//
// Muscle growth tracks hard sets per muscle, not per exercise (see the Science page), so the proposal starts every
// exercise at 3 (or at what you've planned, if that's more) and trims one set at a time, down to 2, where the
// muscles it trains still get enough from the rest of the split:
//   - every muscle you train directly keeps at least the target number of sets per run through the split
//     (helpers counting half), or what it had at the start, if that was already below the target;
//   - every muscle keeps at least 3 direct sets, so a muscle with one exercise on one day stays at 3;
//   - past about 11 sets for a muscle in one session, more sets in that session add nothing measurable, so those
//     sets count as spare (Remmert et al. 2025).
// Isolation lifts and ones later in the day are trimmed first, so the main lifts keep their 3.
import * as cat from './catalog.js';

export const TARGETS = [4, 6, 8, 10, 12];
/** What each aim means, in a line (Pelland et al. 2024: more sets keep adding growth, each one a little less). */
export const AIMS = {
  4: 'The least that reliably builds muscle. Two days of a muscle at 2 sets each gets there.',
  6: 'Lean: less time in the gym, a little less growth.',
  8: 'A middle ground: trims the doubled-up sets, keeps the rest.',
  10: 'Around the 10 or more a week often recommended for growth.',
  12: 'More growth for more time, with each set adding a little less.',
};
export const DEFAULT_TARGET = 8;
export const SESSION_CAP = 11;
const START = 3, FLOOR = 2, DIRECT_MIN = 3;

/** Sets per muscle for one run through the split: each session's sets, helpers half, at most SESSION_CAP a session. */
function volume(items, sets) {
  const perDay = new Map();
  items.forEach((it, i) => {
    for (const z of [...it.e.p, ...it.e.s]) {
      const k = `${z}|${it.di}`;
      perDay.set(k, (perDay.get(k) || 0) + cat.credit(it.e, z) * sets[i]);
    }
  });
  const v = new Map();
  for (const [k, n] of perDay) { const z = k.split('|')[0]; v.set(z, (v.get(z) || 0) + Math.min(n, SESSION_CAP)); }
  return v;
}
/** Direct sets per muscle (only lifts that train it directly). */
function directSets(items, sets) {
  const d = new Map();
  items.forEach((it, i) => { for (const z of it.e.p) d.set(z, (d.get(z) || 0) + sets[i]); });
  return d;
}

/**
 * days: the split's days → {changes: [{di, id, ex, from, to, why}], muscles: [{z, before, after}], under: [{z, sets}], total: {from, to}}
 *   changes are against the sets planned now; before/after are sets per run through the split.
 */
export function optimize(days, target = DEFAULT_TARGET) {
  const items = [];
  days.forEach((d, di) => d.items.forEach((it, k) => { const e = cat.ex(it.ex); if (e) items.push({ di, k, id: it.id, ex: it.ex, e, planned: it.sets || 0 }); }));
  const sets = items.map(it => Math.max(START, it.planned));
  const base = volume(items, sets);
  const trained = [...new Set(items.flatMap(it => it.e.p))];
  const need = new Map(trained.map(z => [z, Math.min(target, base.get(z) || 0)]));
  const ok = (v, d, main) => trained.every(z => (v.get(z) || 0) >= need.get(z) - 1e-9) && main.every(z => (d.get(z) || 0) >= DIRECT_MIN);

  // trim one set at a time, always the one with the most room to spare
  for (;;) {
    let best = null;
    items.forEach((it, i) => {
      if (sets[i] <= FLOOR) return;
      const t = sets.slice(); t[i] -= 1;
      const v = volume(items, t), d = directSets(items, t);
      if (!ok(v, d, it.e.p)) return;
      const room = Math.min(...it.e.p.map(z => (v.get(z) || 0) - need.get(z)));
      const key = [it.e.mech === 'isolation' ? 1 : 0, Math.round(room * 2) / 2, it.k];
      if (!best || key[0] > best.key[0] || (key[0] === best.key[0] && (key[1] > best.key[1] || (key[1] === best.key[1] && key[2] > best.key[2])))) best = { i, key };
    });
    if (!best) break;
    sets[best.i] -= 1;
  }

  const after = volume(items, sets), d = directSets(items, sets);
  const before = volume(items, items.map(it => it.planned));
  const name = z => cat.muscle(z).name.toLowerCase();
  const fmt = n => Math.round(n * 10) / 10;
  const changes = items.map((it, i) => {
    if (it.planned === sets[i]) return null;
    let why;
    if (sets[i] < it.planned) why = it.e.p.map(z => `${cat.muscle(z).name}: ${fmt(after.get(z))} sets`).join(' · ');
    else {
      // what keeps it at 3: a muscle that would fall below the target, or its only direct work
      const t = sets.slice(); t[i] -= 1;
      const v = volume(items, t), dd = directSets(items, t);
      const short = trained.find(z => it.e.p.concat(it.e.s).includes(z) && (v.get(z) || 0) < need.get(z) - 1e-9);
      const only = it.e.p.find(z => (dd.get(z) || 0) < DIRECT_MIN);
      why = sets[i] <= FLOOR ? 'Every exercise keeps at least 2 sets'
        : only ? `Keeps ${name(only)} at ${d.get(only)} direct sets` : short ? `Keeps ${name(short)} at ${fmt(after.get(short))} sets` : 'The starting 3';
    }
    return { di: it.di, id: it.id, ex: it.ex, from: it.planned, to: sets[i], why };
  }).filter(Boolean);
  const muscles = trained.map(z => ({ z, before: fmt(before.get(z) || 0), after: fmt(after.get(z) || 0) }));
  const under = muscles.filter(m => m.after < target - 1e-9).sort((a, b) => a.after - b.after).map(m => ({ z: m.z, sets: m.after }));
  return { changes, muscles, under, total: { from: items.reduce((a, it) => a + it.planned, 0), to: sets.reduce((a, b) => a + b, 0) } };
}
