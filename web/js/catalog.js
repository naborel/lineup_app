// The exercise catalog (data/exercises.json, built by tools/build_catalog.py) plus your own custom exercises.
import { normalize } from './util.js';

let DATA = null;
const byId = new Map();
const muscleById = new Map();
let custom = [];
let customById = new Map();

export async function load() {
  DATA = window.LB_DATA ? window.LB_DATA.catalog : await (await fetch('/data/exercises.json')).json();
  DATA.exercises.forEach(e => byId.set(e.id, e));
  DATA.muscles.forEach((m, i) => { m.order = i; muscleById.set(m.id, m); });
  return DATA;
}

/** Custom exercises live in your saved state; the store hands them over whenever they change. */
export function setCustom(list) {
  // A variation names the catalog lift it's based on (base) and borrows that lift's description and photos.
  custom = (list || []).map(c => {
    const base = c.base ? byId.get(c.base) || null : null;
    return { s: [], ...c, how: base ? base.how : [], img: 0, custom: true, variantOf: base ? base.name : null, group: (muscleById.get(c.p[0]) || {}).group || 'Chest' };
  });
  customById = new Map(custom.map(c => [c.id, c]));
}

export const groups = () => DATA.groups;
export const muscles = () => DATA.muscles;
export const muscle = id => muscleById.get(id);
export const all = () => [...DATA.exercises, ...custom];
export const ex = id => byId.get(id) || customById.get(id) || null;
/** For log rows whose exercise no longer exists (a deleted custom one). */
export const exOr = id => ex(id) || { id, name: 'Removed exercise', eq: 'other', kind: 'push', mech: '', p: [], s: [], how: [], img: 0, group: '', gone: true };

export const EQ = { barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable', machine: 'Machine', bodyweight: 'Bodyweight', kettlebell: 'Kettlebell', band: 'Band', other: 'Other' };
export const KIND = { push: 'Push', pull: 'Pull', legs: 'Legs', core: 'Core' };

/**
 * A muscle filter is either one zone ('quads') or a whole group ('g:Legs', every zone in Legs).
 * The dropdowns offer both, so anything that filters by muscle goes through these.
 */
export const isGroup = key => typeof key === 'string' && key.startsWith('g:');
export const groupKey = g => `g:${g}`;
export const zonesOf = key => (!key ? [] : isGroup(key) ? DATA.muscles.filter(m => m.group === key.slice(2)).map(m => m.id) : [key]);
/** Short name for a filter: 'Quads', or 'Legs' for the whole group. */
export const filterName = key => (isGroup(key) ? key.slice(2) : (muscleById.get(key) || { short: key }).short);

/** 1 for a muscle (or any muscle of a group) the lift trains directly, 0.5 for one it only helps with, 0 otherwise. */
export const credit = (e, key) => {
  if (!isGroup(key)) return e.p.includes(key) ? 1 : e.s.includes(key) ? 0.5 : 0;
  const zs = zonesOf(key);
  return e.p.some(z => zs.includes(z)) ? 1 : e.s.some(z => zs.includes(z)) ? 0.5 : 0;
};

export const meta = e => [EQ[e.eq], e.mech ? e.mech[0].toUpperCase() + e.mech.slice(1) : null, KIND[e.kind]].filter(Boolean).join(' · ');
export const short = id => (muscleById.get(id) || { short: id }).short;
export const primaryLine = e => e.p.map(short).join(' + ');
export const secondaryLine = e => e.s.map(short).join(', ');

/** Photo n (0 or 1) of a lift from the source set, or null. A variation shows the photos of the lift it's based on. */
export const photo = (e, n) => {
  const src = e.custom ? (e.base ? byId.get(e.base) : null) : e;
  return src && src.img > n ? `${DATA.imageBase}${src.id}/${n}.jpg` : null;
};
/** How a lift got its muscles: 'variation' and 'custom' are yours, 'auto' was mapped by rule and not checked, null by hand. */
export const origin = e => (e.variantOf ? 'variation' : e.custom ? 'custom' : e.auto ? 'auto' : null);
export const ORIGIN = { variation: 'variation', custom: 'custom', auto: 'auto-mapped' };

const haystack = new Map();
function hay(e) {
  let t = haystack.get(e);
  if (!t) {
    t = normalize([e.name, e.words || '', e.src || '', EQ[e.eq], KIND[e.kind], e.group,
      ...e.p.map(z => muscleById.get(z).name), ...e.s.map(z => muscleById.get(z).short)].join(' '));
    haystack.set(e, t);
  }
  return t;
}

/**
 * Search the catalog. Every word of the query has to match somewhere (name, muscle, equipment, alias).
 * opts.muscle keeps lifts that hit that zone or group (direct ones first); opts.boost is a Set of ids ranked higher.
 */
export function search(q, { muscle: zone = null, boost = null, limit = 60 } = {}) {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  const out = [];
  for (const e of all()) {
    const c = zone ? credit(e, zone) : 1;
    if (!c) continue;
    const t = hay(e), name = normalize(e.name);
    if (!words.every(w => t.includes(w))) continue;
    let score = 0;
    if (words.length) {
      const joined = words.join(' ');
      if (name.startsWith(joined)) score += 40;
      else if (name.includes(joined)) score += 25;
      score += words.filter(w => name.includes(w)).length * 6;
    }
    if (zone) score += c === 1 ? 100 : 0;
    if (boost && boost.has(e.id)) score += 12;
    out.push({ e, score, c });
  }
  out.sort((a, b) => b.score - a.score || a.e.order - b.e.order);
  return out.slice(0, limit).map(o => o.e);
}

/** Catalog order is the display order; number everything once so sorts are stable. */
export function index() {
  all().forEach((e, i) => { e.order = i; });
}
