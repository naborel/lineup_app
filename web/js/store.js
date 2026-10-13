// Your data: your saved splits (one of them loaded), your favorites, custom exercises, the training log and notes.
// Everything is saved in this browser (localStorage). Export a backup from the status menu to move it
// between your computer and your phone.
import { uid, debounce, today, normalize } from './util.js';
import { setCustom, index, ex, all, muscle, EQ, KIND } from './catalog.js';

// the app's first name was Liftboard; the key stays so saved data carries over
const KEY = 'liftboard-state';
export const DAY_COUNT = 8;
export const DEFAULT_SETS = 3;

const emptyDays = () => Array.from({ length: DAY_COUNT }, () => ({ name: '', items: [] }));
// `days` is the loaded split: the very same array as that split's entry in `splits`, so editing the split
// you're looking at edits the saved split, and everything else in the app (Favorites, Track, Table) reads `days`.
const fresh = () => {
  const days = emptyDays();
  return {
  v: 1,
  days,               // [{name, items: [{id, ex, sets}]}] × 8, the loaded split
  splits: [{ id: 's_main', name: 'My split', days }],   // every saved split: [{id, name, days}]
  active: 's_main',   // id of the loaded split
  favorites: [],      // exercise ids you like, whether or not they're in the split
  custom: [],         // [{id, name, eq, kind, mech, p: [zones], s: [zones]}]
  log: [],            // [{id, date: 'YYYY-MM-DD', ex, sets: [{w, r}]}]  one entry per exercise per day
  cues: {},           // exercise id → a one-line cue shown on its Track card ("close-grip MAG handle")
  notes: {},          // exercise id → your longer notes (seat height, setup), kept in its details
  prefs: { unit: 'lb', lastDay: 0 },
  };
};

let state = fresh();
const subs = new Set();
const statusSubs = new Set();
let storageOk = true;
// Every built Lineup.html carries the time it was built. Saved data remembers the build that saved it, so an
// older copy of the file (one still in Downloads, say) can tell it's older and stays out of the way instead of
// saving over what a newer copy wrote.
const BUILD = (typeof window !== 'undefined' && +window.LB_BUILD) || 0;
let older = false;          // the data here was saved by a newer copy of the file
let saveAnyway = false;     // …and you chose to let this copy save over it
// Several tabs (or copies of the file) can share this browser's storage. A page writes only when something changed
// in it, and before it writes it checks that storage still holds what it last read or wrote. If another tab saved
// in between, it takes that tab's data first, so a tab left open from yesterday can't save its old data over today's.
let lastRaw = null;         // the stored text this page last read or wrote
let dirty = false;          // something changed here that isn't stored yet
let dataDirty = false;      // …and it's your data (log, split, favorites, notes), not just a setting
const changedPrefs = new Set();   // settings changed here since the last write

function normalise(s) {
  const base = fresh();
  if (!s || typeof s !== 'object') return base;
  const out = { ...base, ...s, prefs: { ...base.prefs, ...(s.prefs || {}) } };
  for (const k of ['lastBackup', 'unbackedSince', 'browserNoted']) delete out.prefs[k];   // from a reminder that was tried and removed
  out.days = normDays(s.days);
  // saved splits; data from before there were several has just the one, which becomes "My split"
  const seen = new Set();
  const splits = (Array.isArray(s.splits) ? s.splits : []).filter(sp => sp && sp.id && !seen.has(sp.id) && seen.add(sp.id))
    .map(sp => ({ id: String(sp.id), name: String(sp.name ?? '').slice(0, 60), days: normDays(sp.days) }));
  let active = splits.find(sp => sp.id === s.active);
  if (!active) { active = { id: splits.length ? uid('s') : 's_main', name: splits.length ? 'Recovered split' : 'My split', days: out.days }; splits.unshift(active); }
  active.days = out.days;   // what was being edited wins, and from here on they're one and the same
  out.splits = splits;
  out.active = active.id;
  // favorites were called "options" in earlier builds; saved data and backups from then still load
  out.favorites = [...new Set([...(s.favorites || []), ...(s.options || [])].filter(Boolean))];
  delete out.options;
  out.custom = (s.custom || []).filter(c => c && c.id && c.name && Array.isArray(c.p) && c.p.length);
  out.log = (s.log || []).filter(e => e && e.ex && /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') && Array.isArray(e.sets))
    .map(e => ({ id: e.id || uid('l'), date: e.date, ex: e.ex, sets: e.sets.map(x => ({ w: x && x.w != null && x.w !== '' ? +x.w : null, r: x && x.r != null && x.r !== '' ? +x.r : null })) }));
  out.notes = s.notes && typeof s.notes === 'object' ? { ...s.notes } : {};
  out.cues = Object.fromEntries(Object.entries(s.cues && typeof s.cues === 'object' ? s.cues : {}).map(([k, v]) => [k, oneLine(v)]).filter(([, v]) => v));
  return out;
}

function normDays(src) {
  return emptyDays().map((d, i) => {
    const x = (Array.isArray(src) ? src[i] : null) || {};
    return { name: String(x.name ?? '').slice(0, 40), items: (Array.isArray(x.items) ? x.items : []).filter(it => it && typeof it.ex === 'string' && it.ex)
      .map(it => ({ id: typeof it.id === 'string' && it.id ? it.id : uid('i'), ex: it.ex, sets: Number.isFinite(+it.sets) ? Math.max(1, Math.min(12, Math.round(+it.sets))) : DEFAULT_SETS })) };
  });
}

const setStatus = st => statusSubs.forEach(fn => fn(st));
const blocked = () => older && !saveAnyway;
const busy = () => setStatus(blocked() ? 'older' : 'saving');
const persist = debounce(() => {
  if (!dirty) return;
  try {
    const cur = localStorage.getItem(KEY);
    if (cur != null && cur !== lastRaw) syncFrom(cur);   // another tab saved since: take that first
    if (blocked()) { setStatus('older'); return; }
    if (BUILD) state.build = BUILD;
    const raw = JSON.stringify(state);
    localStorage.setItem(KEY, raw);
    lastRaw = raw; dirty = dataDirty = false; changedPrefs.clear();
    storageOk = true; setStatus('saved');
  }
  catch (e) { storageOk = false; setStatus('error'); }
}, 250);

const flushAll = () => persist.flush();

/**
 * Take what another tab saved. Anything changed here and not yet stored is kept on top: settings always; and if
 * your data changed here too (two tabs edited at once), this tab's version wins, plus any sessions only the other
 * tab logged.
 */
function syncFrom(raw) {
  let data;
  try { data = JSON.parse(raw); } catch (e) { return; }
  if (!data || typeof data !== 'object') return;
  lastRaw = raw;
  older = !!(BUILD && +data.build > BUILD);
  const theirs = normalise(data);
  if (dataDirty) {
    const have = new Set(state.log.map(e => e.id)), day = new Set(state.log.map(e => `${e.ex}|${e.date}`));
    for (const e of theirs.log) if (!have.has(e.id) && !day.has(`${e.ex}|${e.date}`)) state.log.push(e);
    return;
  }
  for (const k of changedPrefs) { if (state.prefs[k] === undefined) delete theirs.prefs[k]; else theirs.prefs[k] = state.prefs[k]; }
  adopt(theirs);
  subs.forEach(fn => fn());
}
/** Another tab may have saved while this one was in the background or just opening: catch up. */
function catchUp() {
  let cur = null;
  try { cur = localStorage.getItem(KEY); } catch (e) { return; }
  if (cur != null && cur !== lastRaw) { syncFrom(cur); setStatus(blocked() ? 'older' : 'saved'); }
}

function adopt(next) {
  state = next;
  setCustom(state.custom);
  index();
}

export function init() {
  let saved = null, raw = null;
  try { raw = localStorage.getItem(KEY); saved = JSON.parse(raw || 'null'); } catch (e) { storageOk = false; }
  older = !!(BUILD && saved && +saved.build > BUILD);
  lastRaw = raw;
  adopt(normalise(saved));
  window.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushAll(); else catchUp(); });
  window.addEventListener('focus', catchUp);
  // another tab saved: follow along (a tab that's typing keeps its change; see syncFrom)
  window.addEventListener('storage', e => { if (e.key === KEY && e.newValue != null && e.newValue !== lastRaw) { syncFrom(e.newValue); setStatus(blocked() ? 'older' : dirty ? 'saving' : 'saved'); } });
}

export const get = () => state;
export const canSave = () => storageOk;
/** 'saved' | 'error' (storage blocked) | 'older' (an older copy, not saving over newer data) */
export const saveState = () => (!storageOk ? 'error' : blocked() ? 'older' : 'saved');
export const build = () => BUILD;
export const isOlderCopy = () => blocked();
/** Let an older copy save anyway (you meant to go back to it). */
export function useThisCopy() { saveAnyway = true; persist.flush(); setStatus('saved'); }
export const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };
export const onStatus = fn => { statusSubs.add(fn); return () => statusSubs.delete(fn); };

// touch: a change to your data (not just a remembered setting)
function commit(silent = false, touch = true) {
  dirty = true;
  if (touch) dataDirty = true;
  busy();
  persist();
  if (!silent) subs.forEach(fn => fn());
}

/** Run a change and get back a function that undoes it. */
function undoable(fn) {
  const before = JSON.stringify(state);
  fn();
  commit();
  return () => { adopt(normalise(JSON.parse(before))); commit(); };
}

// ---------- split ----------
export const placements = exId => state.days.flatMap((d, di) => d.items.filter(it => it.ex === exId).map(item => ({ di, item })));
export const inSplit = exId => state.days.some(d => d.items.some(it => it.ex === exId));
export const inDay = (di, exId) => state.days[di].items.some(it => it.ex === exId);
/** Exercise ids in the split, each once, in day order. */
export const activeIds = () => [...new Set(state.days.flatMap(d => d.items.map(it => it.ex)))];
export const dayLabel = di => state.days[di].name.trim() || `Day ${di + 1}`;
export const usedDays = () => state.days.map((d, i) => i).filter(i => state.days[i].items.length);

export function addToDay(di, exId, { sets = null, before = null } = {}) {
  return undoable(() => {
    const prev = placements(exId)[0];
    const item = { id: uid('i'), ex: exId, sets: sets ?? (prev ? prev.item.sets : DEFAULT_SETS) };
    const items = state.days[di].items;
    const at = before ? items.findIndex(it => it.id === before) : -1;
    if (at >= 0) items.splice(at, 0, item); else items.push(item);
    if (!state.favorites.includes(exId)) state.favorites.push(exId);   // anything you train is one of your favorites
    state.prefs.lastDay = di;
  });
}
export function removeItem(di, itemId) {
  return undoable(() => { state.days[di].items = state.days[di].items.filter(it => it.id !== itemId); });
}
export function removeFromDay(di, exId) {
  return undoable(() => { state.days[di].items = state.days[di].items.filter(it => it.ex !== exId); });
}
export function moveItem(fromDi, itemId, toDi, { before = null, copy = false } = {}) {
  return undoable(() => {
    const from = state.days[fromDi].items;
    const i = from.findIndex(it => it.id === itemId);
    if (i < 0 || before === itemId) return;
    const item = copy ? { ...from[i], id: uid('i') } : from.splice(i, 1)[0];
    const to = state.days[toDi].items;
    const at = before ? to.findIndex(it => it.id === before) : -1;
    if (at >= 0) to.splice(at, 0, item); else to.push(item);
    state.prefs.lastDay = toDi;
  });
}
export function setItemSets(di, itemId, sets) {
  const item = state.days[di].items.find(it => it.id === itemId);
  if (!item) return;
  item.sets = Math.max(1, Math.min(12, Math.round(sets)));
  commit();
}
export function setDayName(di, name) { state.days[di].name = name; commit(true); }
export function clearSplit() { return undoable(() => { state.days.forEach(d => { d.items = []; d.name = ''; }); }); }
/**
 * Copy a whole day into another: every exercise with its planned sets, and the name if the target has none.
 * Exercises the target day already has are left as they are, so nothing there is overwritten.
 */
export function copyDay(from, to) {
  let added = 0, skipped = 0;
  const undo = undoable(() => {
    const src = state.days[from], dst = state.days[to];
    for (const it of src.items) {
      if (dst.items.some(x => x.ex === it.ex)) { skipped += 1; continue; }
      dst.items.push({ id: uid('i'), ex: it.ex, sets: it.sets });
      added += 1;
    }
    if (!dst.name.trim() && src.name.trim()) dst.name = src.name;
    state.prefs.lastDay = to;
  });
  return { undo, added, skipped };
}
export function clearDay(di) { return undoable(() => { state.days[di].items = []; state.days[di].name = ''; }); }
export function swapDays(a, b) { return undoable(() => { [state.days[a], state.days[b]] = [state.days[b], state.days[a]]; }); }

// ---------- saved splits ----------
export const splits = () => state.splits;
export const activeSplit = () => state.splits.find(sp => sp.id === state.active);
export const splitName = sp => (sp.name || '').trim() || 'Untitled split';
/** How much is in a split: training days and exercises. */
export const splitSize = sp => ({ days: sp.days.filter(d => d.items.length).length, exercises: sp.days.reduce((a, d) => a + d.items.length, 0) });
const copyDays = days => days.map(d => ({ name: d.name, items: d.items.map(it => ({ id: uid('i'), ex: it.ex, sets: it.sets })) }));
function uniqueName(name, exceptId = null) {
  const base = String(name || '').trim().slice(0, 60) || 'Untitled split';
  const taken = n => state.splits.some(sp => sp.id !== exceptId && splitName(sp).toLowerCase() === n.toLowerCase());
  let n = base, k = 2;
  while (taken(n)) n = `${base} (${k++})`;
  return n;
}
function load(sp) { state.active = sp.id; state.days = sp.days; }

/** Load a saved split. Nothing is lost: the one you leave keeps every change you made to it. */
export function switchSplit(id) {
  const sp = state.splits.find(x => x.id === id);
  if (!sp || sp.id === state.active) return null;
  return undoable(() => load(sp));
}
export function newSplit() {
  let id = null;
  const undo = undoable(() => {
    const sp = { id: uid('s'), name: uniqueName(`Split ${state.splits.length + 1}`), days: emptyDays() };
    state.splits.push(sp); load(sp); id = sp.id;
  });
  return { id, undo };
}
export function duplicateSplit(fromId) {
  let id = null;
  const undo = undoable(() => {
    const i = state.splits.findIndex(sp => sp.id === fromId);
    if (i < 0) return;
    const src = state.splits[i];
    const sp = { id: uid('s'), name: uniqueName(`${splitName(src)} copy`), days: copyDays(src.days) };
    state.splits.splice(i + 1, 0, sp); load(sp); id = sp.id;
  });
  return { id, undo };
}
export function renameSplit(id, name) {
  const sp = state.splits.find(x => x.id === id);
  if (!sp) return;
  sp.name = String(name).slice(0, 60);
  commit();
}
/** Delete a saved split (never the last one). Deleting the loaded one loads its neighbour. */
export function deleteSplit(id) {
  if (state.splits.length < 2) return null;
  return undoable(() => {
    const i = state.splits.findIndex(sp => sp.id === id);
    if (i < 0) return;
    state.splits.splice(i, 1);
    if (state.active === id) load(state.splits[Math.min(i, state.splits.length - 1)]);
  });
}

// ---------- sharing ----------
// What goes to someone else: a split (days, exercises, planned sets) or a favorites list, plus the definitions
// of any custom exercises in it so they show up properly on the other side. Never the log or notes.
const customDef = c => ({ id: c.id, name: c.name, eq: c.eq, kind: c.kind, mech: c.mech, p: c.p, s: c.s, ...(c.base ? { base: c.base } : {}) });
const customsFor = ids => state.custom.filter(c => ids.includes(c.id)).map(customDef);
export function shareSplit(id) {
  const sp = state.splits.find(x => x.id === id);
  if (!sp) return null;
  let days = sp.days.map(d => ({ name: d.name, items: d.items.map(it => ({ ex: it.ex, sets: it.sets })) }));
  while (days.length && !days[days.length - 1].items.length && !days[days.length - 1].name.trim()) days = days.slice(0, -1);
  return { app: 'liftboard', kind: 'split', v: 1, name: splitName(sp), days, custom: customsFor(sp.days.flatMap(d => d.items.map(it => it.ex))) };
}
export function shareFavorites() {
  return { app: 'liftboard', kind: 'favorites', v: 1, ids: [...state.favorites], custom: customsFor(state.favorites) };
}
const nameTaken = name => all().some(e => normalize(e.name) === normalize(name));
/** Bring in custom exercises from a share; returns their id → the id they have here (an existing match is reused). */
function adoptCustoms(defs) {
  const map = new Map();
  for (const d of Array.isArray(defs) ? defs : []) {
    if (!d || typeof d.id !== 'string' || typeof d.name !== 'string' || !d.name.trim() || !Array.isArray(d.p)) continue;
    const p = d.p.filter(z => muscle(z)), s = (Array.isArray(d.s) ? d.s : []).filter(z => muscle(z) && !p.includes(z));
    if (!p.length) continue;
    const same = state.custom.find(c => c.id === d.id)
      || state.custom.find(c => normalize(c.name) === normalize(d.name) && c.p.join() === p.join() && c.s.join() === s.join());
    if (same) { map.set(d.id, same.id); continue; }
    const id = ex(d.id) ? uid('c_') : d.id;
    let name = d.name.trim().slice(0, 60);
    if (nameTaken(name)) name = `${name} (shared)`.slice(0, 70);
    state.custom.push({ id, name, eq: d.eq in EQ ? d.eq : 'other', kind: d.kind in KIND ? d.kind : 'push', mech: typeof d.mech === 'string' ? d.mech.slice(0, 20) : '',
      p, s, ...(typeof d.base === 'string' && ex(d.base) && !ex(d.base).custom ? { base: d.base } : {}) });
    map.set(d.id, id);
    setCustom(state.custom); index();
  }
  return map;
}
/** Add a shared split to your saved splits (not loaded: that's your call). */
export function importSplit(env) {
  let id = null, name = '';
  const undo = undoable(() => {
    const map = adoptCustoms(env.custom);
    const days = normDays((Array.isArray(env.days) ? env.days : []).map(d => ({ name: d && d.name, items: (d && Array.isArray(d.items) ? d.items : []).map(it => ({ ex: it && (map.get(it.ex) || it.ex), sets: it && it.sets })) })));
    name = uniqueName(env.name || 'Shared split');
    const sp = { id: uid('s'), name, days };
    state.splits.push(sp); id = sp.id;
  });
  return { id, name, undo };
}
/** A shared favorites list, before it's added: what's in it and what would be new to you. */
export function favoritesPreview(env) {
  const defs = new Map((Array.isArray(env.custom) ? env.custom : []).filter(d => d && d.id).map(d => [d.id, d]));
  const have = new Set(state.favorites);
  const items = [], seen = new Set();
  for (const id of Array.isArray(env.ids) ? env.ids : []) {
    if (typeof id !== 'string' || seen.has(id)) continue;
    seen.add(id);
    const known = ex(id), def = defs.get(id);
    const mine = known || (def && state.custom.find(c => normalize(c.name) === normalize(def.name)));
    if (mine) items.push({ e: ex(mine.id) || mine, fresh: !have.has(mine.id) });
    else if (def && Array.isArray(def.p)) items.push({ e: { ...def, p: def.p.filter(z => muscle(z)), s: (def.s || []).filter(z => muscle(z)), custom: true, how: [], img: 0 }, fresh: true });
  }
  return { items, fresh: items.filter(x => x.fresh).length, unknown: seen.size - items.length };
}
/** Add the exercises of a shared favorites list that aren't already among yours. */
export function importFavorites(env) {
  let added = 0;
  const undo = undoable(() => {
    const map = adoptCustoms(env.custom);
    for (const raw of Array.isArray(env.ids) ? env.ids : []) {
      const id = typeof raw === 'string' ? map.get(raw) || raw : null;
      if (!id || !ex(id) || state.favorites.includes(id)) continue;
      state.favorites.push(id); added += 1;
    }
  });
  return { added, undo };
}

// ---------- favorites ----------
export const isFavorite = exId => state.favorites.includes(exId);
export function toggleFavorite(exId) {
  return undoable(() => {
    if (state.favorites.includes(exId)) state.favorites = state.favorites.filter(id => id !== exId);
    else state.favorites.push(exId);
  });
}
export function clearFavorites() { return undoable(() => { state.favorites = state.favorites.filter(inSplit); }); }

// ---------- custom exercises ----------
export function saveCustom(def) {
  let id = def.id;
  const undo = undoable(() => {
    if (id) state.custom = state.custom.map(c => (c.id === id ? { ...c, ...def } : c));
    else { id = uid('c_'); state.custom.push({ ...def, id }); state.favorites.push(id); }
    setCustom(state.custom); index();
  });
  return { id, undo };
}
export function deleteCustom(id) {
  return undoable(() => {
    state.custom = state.custom.filter(c => c.id !== id);
    state.favorites = state.favorites.filter(o => o !== id);
    state.splits.forEach(sp => sp.days.forEach(d => { d.items = d.items.filter(it => it.ex !== id); }));
    setCustom(state.custom); index();
  });
}

// ---------- log ----------
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
export const entriesOf = exId => state.log.filter(e => e.ex === exId).sort(byDate);
export const entryOn = (exId, date) => state.log.find(e => e.ex === exId && e.date === date) || null;
export const lastBefore = (exId, date) => entriesOf(exId).filter(e => e.date < date && e.sets.some(x => +x.r > 0)).pop() || null;
export const loggedIds = () => new Set(state.log.map(e => e.ex));
/** Exercises with history that aren't in the split any more, most recently trained first. */
export function archivedIds() {
  const active = new Set(activeIds()), last = new Map();
  for (const e of state.log) if (!active.has(e.ex) && (!last.has(e.ex) || last.get(e.ex) < e.date)) last.set(e.ex, e.date);
  return [...last.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1)).map(x => x[0]);
}
const emptySet = x => !x || ((x.w == null || x.w === '') && (x.r == null || x.r === ''));

/** Write the sets for one exercise on one date. Trailing blank sets are dropped; an all-blank entry is removed. */
/** now: write it to storage straight away (sets as they're typed, so closing the tab a moment later loses nothing) */
export function setEntry(exId, date, sets, { silent = false, now = false } = {}) {
  const clean = sets.map(x => ({ w: x.w === '' || x.w == null || Number.isNaN(+x.w) ? null : +x.w, r: x.r === '' || x.r == null || Number.isNaN(+x.r) ? null : +x.r }));
  while (clean.length && emptySet(clean[clean.length - 1])) clean.pop();
  const cur = entryOn(exId, date);
  if (!clean.length) { if (cur) state.log = state.log.filter(e => e !== cur); }
  else if (cur) cur.sets = clean;
  else state.log.push({ id: uid('l'), date, ex: exId, sets: clean });
  commit(silent);
  if (now) persist.flush();
}
/** Empty the log: every entry, or only one exercise's. The split, favorites and notes stay as they are. */
export function clearLog(exId = null) { return undoable(() => { state.log = exId ? state.log.filter(e => e.ex !== exId) : []; }); }
export function deleteEntry(id) { return undoable(() => { state.log = state.log.filter(e => e.id !== id); }); }
export function deleteSet(entryId, idx) {
  return undoable(() => {
    const e = state.log.find(x => x.id === entryId);
    if (!e) return;
    e.sets.splice(idx, 1);
    if (!e.sets.length) state.log = state.log.filter(x => x !== e);
  });
}
export function updateSet(entryId, idx, patch) {
  const e = state.log.find(x => x.id === entryId);
  if (!e || !e.sets[idx]) return;
  Object.assign(e.sets[idx], patch);
  commit(true);
}
/** Move one set to another date (the table lets you fix a mistyped day). */
export function moveSet(entryId, idx, date) {
  return undoable(() => {
    const e = state.log.find(x => x.id === entryId);
    if (!e || !e.sets[idx] || e.date === date) return;
    const [setRow] = e.sets.splice(idx, 1);
    if (!e.sets.length) state.log = state.log.filter(x => x !== e);
    const target = entryOn(e.ex, date);
    if (target) target.sets.push(setRow); else state.log.push({ id: uid('l'), date, ex: e.ex, sets: [setRow] });
  });
}
export function addSet(exId, date, setRow) {
  return undoable(() => {
    const target = entryOn(exId, date);
    if (target) target.sets.push(setRow); else state.log.push({ id: uid('l'), date, ex: exId, sets: [setRow] });
  });
}

// ---------- notes & prefs ----------
export function setNote(exId, text) { if (text.trim()) state.notes[exId] = text; else delete state.notes[exId]; commit(true); }
/** A cue is one short line: line breaks become spaces and it stops at CUE_MAX characters. */
export const CUE_MAX = 80;
const oneLine = t => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, CUE_MAX);
export const cue = exId => state.cues[exId] || '';
/** silent while typing; a last call without it lets the pages that show cues catch up. */
export function setCue(exId, text, { silent = false } = {}) {
  const t = oneLine(text);
  if (t) state.cues[exId] = t; else delete state.cues[exId];
  commit(silent);
}
export function setPref(key, value, silent = true) { state.prefs[key] = value; changedPrefs.add(key); commit(silent, false); }
export const unit = () => state.prefs.unit || 'lb';

// ---------- backup ----------
export function exportText() {
  return JSON.stringify({ app: 'liftboard', exported: new Date().toISOString(), ...state }, null, 1);
}
export function importText(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.days) || !Array.isArray(data.log)) throw new Error('That file isn’t a Lineup backup.');
  return undoable(() => adopt(normalise(data)));
}
export function replaceAll(next) { return undoable(() => adopt(normalise(next))); }
export function clearAll() { return undoable(() => adopt(fresh())); }
export const isEmpty = () => !state.log.length && !state.favorites.length && !state.splits.some(sp => sp.days.some(d => d.items.length));

/** One row per set, for the table page and CSV export. */
export function setRows() {
  const rows = [];
  for (const e of state.log) e.sets.forEach((x, i) => { if (!emptySet(x)) rows.push({ entry: e, idx: i, date: e.date, ex: e.ex, w: x.w, r: x.r }); });
  return rows;
}
export function exportCSV() {
  const esc = v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = [['date', 'exercise', 'set', `weight_${unit()}`, 'reps'].join(',')];
  const rows = setRows().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ex < b.ex ? -1 : a.ex > b.ex ? 1 : a.idx - b.idx));
  for (const r of rows) lines.push([r.date, esc((ex(r.ex) || { name: r.ex }).name), r.idx + 1, r.w ?? '', r.r ?? ''].join(','));
  return lines.join('\n');
}
export { today };
