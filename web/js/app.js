// Lineup (first called Liftboard): plan a lifting split on a body that turns red where you train, then track what you lift.
// This file is the shell: pages, the top bar, the status menu (backup, units) and the exercise sheet.
import { h, icon, seg, today, download } from './util.js';
import { menu, toast } from './ui.js';
import * as cat from './catalog.js';
import * as body from './body.js';
import * as store from './store.js';
import * as split from './views/split.js';
import * as favorites from './views/favorites.js';
import * as track from './views/track.js';
import * as trends from './views/trends.js';
import * as table from './views/table.js';
import * as science from './views/science.js';
import { showExercise, editCustom } from './views/exerciseSheet.js';
import { loadSample } from './sample.js';
import { openImport } from './share.js';

const PAGES = [
  { id: 'split', label: 'Split', view: split },
  { id: 'favorites', label: 'Favorites', view: favorites },
  { id: 'track', label: 'Track', view: track },
  { id: 'trends', label: 'Trends', view: trends },
  { id: 'table', label: 'Table', view: table },
  { id: 'science', label: 'Science', view: science },
];
const view = document.getElementById('view');
let current = null, page = null, navSeg = null;

const ctx = {
  openExercise: id => showExercise(id, ctx),
  editCustom: id => editCustom(id, ctx),
  makeVariation: fromId => editCustom(null, ctx, { from: fromId }),
  go: id => show(id),
  goTable: exId => show('table', { ex: exId }),
};

function show(id, params) {
  if (id === 'options') id = 'favorites';   // the page's name in earlier builds
  const def = PAGES.find(p => p.id === id) || PAGES[0];
  if (current && current.unmount) current.unmount();
  page = def.id;
  view.dataset.page = page;
  current = def.view.mount(view, ctx, params);
  store.setPref('page', page);
  if (location.hash.slice(1) !== page) history.replaceState(null, '', '#' + page);
  drawNav();
  window.scrollTo({ top: 0 });
}

function drawNav() {
  const host = document.getElementById('nav');
  if (!navSeg) {
    navSeg = seg(PAGES.map(p => ({ value: p.id, label: p.label })), page, show, 'mid');
    host.replaceChildren(navSeg);
    return;
  }
  // moved here by something other than a click on the nav: line the indicator up
  const buttons = [...navSeg.querySelectorAll('button')];
  const want = PAGES.findIndex(p => p.id === page);
  if (buttons[want] && buttons[want].getAttribute('aria-pressed') !== 'true') {
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === want)));
    navSeg.sync();
  }
}

// ---------- keeping your data safe ----------
// Saving needs nothing from you. The only note that can appear is when an older copy of the file is opened after a
// newer one has saved: it says so instead of saving over the newer data.
const LOCAL = location.protocol === 'file:';
const UA = navigator.userAgent;
const BROWSER = /Firefox\//.test(UA) ? 'firefox' : /Safari\//.test(UA) && !/Chrome|Chromium|CriOS|Edg\//.test(UA) ? 'safari' : 'other';
// browsers that handle files opened from disk differently; said quietly in the status menu, never on the page
const BROWSER_NOTE = !LOCAL ? null
  : BROWSER === 'firefox' ? 'Firefox keeps Lineup’s data with this file’s location. Save new versions over this file (same name, same folder).'
  : BROWSER === 'safari' ? 'Safari doesn’t reliably keep data for files opened from your computer. Lineup is safer in Chrome or Edge.'
  : null;
const builtLine = () => store.build() ? `This copy of Lineup was built ${new Date(store.build()).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}` : null;

let noteShown = null;
function renderNotices() {
  const box = document.getElementById('notices');
  if (!box) return;
  const which = store.isOlderCopy() ? 'older' : null;
  if (which === noteShown) return;   // redraw only when the message changes, not on every save
  noteShown = which;
  box.replaceChildren(...(which === 'older' ? [h('div', { class: 'notice warn', 'data-n': 'older' }, icon('info'),
    h('p', null, h('b', null, 'This is an older copy of Lineup. '), 'A newer copy saved the data in this browser, so nothing you change here is saved, and your newer data stays as it is. Open the newest Lineup file.'),
    h('div', { class: 'acts' }, h('button', { class: 'btn ghost sm', type: 'button', title: 'Only if you meant to go back to this version', onclick: () => {
      store.useThisCopy(); renderNotices(); toast('This copy saves from now on.');
    } }, 'Use this copy anyway')))] : []));
}

// ---------- status pill + menu ----------
function statusMenu(anchor) {
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => {
    const f = fileInput.files[0];
    if (!f) return;
    try { const undo = store.importText(await f.text()); toast(`Imported ${f.name}`, { label: 'Undo', fn: undo }); }
    catch (err) { toast(err instanceof SyntaxError ? 'That file isn’t valid JSON.' : String(err.message || err)); }
  } });
  document.body.append(fileInput);
  const u = store.unit();
  const built = builtLine();
  menu(anchor, [
    { head: 'Your data lives in this browser' },
    { label: 'Save a backup file', icon: 'download', hint: '.json', onClick: () => download(`lineup-${today()}.json`, store.exportText()) },
    { label: 'Load a backup file…', icon: 'upload', onClick: () => fileInput.click() },
    BROWSER_NOTE ? { node: h('div', { class: 'menu-note' }, BROWSER_NOTE) } : null,
    'sep',
    { label: 'Weights in lb', selected: u === 'lb', onClick: () => store.setPref('unit', 'lb', false) },
    { label: 'Weights in kg', selected: u === 'kg', onClick: () => store.setPref('unit', 'kg', false) },
    'sep',
    { label: 'Volume set for set', selected: store.volumeView() === 'sets', onClick: () => store.setPref('volumeView', 'sets', false) },
    { label: 'Volume as logged', selected: store.volumeView() === 'logged', onClick: () => store.setPref('volumeView', 'logged', false) },
    'sep',
    store.isEmpty() ? { label: 'Load the example', icon: 'body', onClick: () => { const undo = loadSample(); toast('Example loaded.', { label: 'Undo', fn: undo }); } } : null,
    store.isEmpty() ? null : { label: 'Clear everything', icon: 'trash', danger: true, onClick: () => { const undo = store.clearAll(); toast('Everything cleared: split, favorites and log.', { label: 'Undo', fn: undo }, 9000); } },
    built ? 'sep' : null,
    built ? { node: h('div', { class: 'menu-note small' }, built) } : null,
  ], { align: 'end', width: 260 });
}

function wireStatus() {
  const el = document.getElementById('save-status');
  const text = el.querySelector('span');
  const set = st => {
    el.dataset.s = st;
    text.textContent = st === 'saving' ? 'Saving…' : st === 'error' ? 'Not saved: browser storage is blocked' : st === 'older' ? 'Not saved: older copy' : 'Saved in this browser';
  };
  store.onStatus(st => { set(st); renderNotices(); });
  set(store.saveState());
  el.setAttribute('role', 'button'); el.tabIndex = 0;
  el.addEventListener('click', () => statusMenu(el));
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); statusMenu(el); } });
}

async function start() {
  try {
    await Promise.all([cat.load(), body.load()]);
    cat.index();
    store.init();
  } catch (err) {
    view.textContent = 'Lineup couldn’t start: ' + (err && err.message);
    return;
  }
  wireStatus();
  renderNotices();
  store.subscribe(() => { if (current) current.update(); renderNotices(); });
  const info = cat.all().length;
  document.getElementById('catalog-info').textContent = `${info} exercises · exercise data: free-exercise-db (public domain) · body map: react-muscle-highlighter (MIT)`;
  // a share link (#import=LB1-...) opens Import with the code filled in
  const shared = location.hash.startsWith('#import=') ? decodeURIComponent(location.hash.slice(8)) : '';
  const wanted = (!shared && location.hash.slice(1)) || store.get().prefs.page || 'split';
  show(wanted);
  if (shared) setTimeout(() => openImport({ x: Math.max(10, innerWidth / 2 - 210), y: 120 }, ctx, { code: shared }), 300);
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#import=')) { const code = decodeURIComponent(location.hash.slice(8)); history.replaceState(null, '', '#' + page); openImport({ x: Math.max(10, innerWidth / 2 - 210), y: 120 }, ctx, { code }); return; }
    const id = location.hash.slice(1); if (id && id !== page) show(id);
  });
  window.addEventListener('resize', () => navSeg && navSeg.sync && navSeg.sync());
}
start();
