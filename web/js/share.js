// Sharing a split or your favorites with someone else, and taking in what they send you.
// A share is a small JSON "envelope" ({app: 'liftboard', kind: 'split' | 'favorites', ...}, built in store.js).
// ('liftboard' and the LB1- prefix are from the app's first name; they stay, so codes work between new and old copies.)
// It travels either as a file or as a share code: the envelope compressed and written as text starting "LB1-",
// short enough to paste into a text message. Lineup is a file on your computer, so there's no link to send;
// if it's ever put on a web address, the same code rides along in a link (#import=LB1-...) and opens Import.
import { h, icon, today, download } from './util.js';
import { popover, toast } from './ui.js';
import * as store from './store.js';
import { frame } from './tiles.js';

const PREFIX = 'LB1-';

// ---------- the code ----------
const b64url = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)), c => c.charCodeAt(0));
const through = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

export async function encode(env) {
  const json = new TextEncoder().encode(JSON.stringify(env));
  // 'z' = deflated, 'j' = plain (a browser without compression streams still makes codes others can read)
  if (typeof CompressionStream === 'function') return `${PREFIX}z${b64url(await through(json, new CompressionStream('deflate-raw')))}`;
  return `${PREFIX}j${b64url(json)}`;
}
export async function decode(text) {
  // messaging apps wrap long text, so spaces and line breaks inside a pasted code are ignored
  const m = String(text).replace(/\s+/g, '').match(/LB1-([zj])([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    let bytes = unb64url(m[2]);
    if (m[1] === 'z') bytes = await through(bytes, new DecompressionStream('deflate-raw'));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) { return null; }
}

/** Read a pasted code or a file's text. Returns the envelope, or throws with a message worth showing. */
export async function parse(text) {
  const t = String(text || '').trim();
  if (!t) throw new Error('Paste a share code first, or choose a file.');
  let obj = null;
  if (t.startsWith('{')) { try { obj = JSON.parse(t); } catch (e) { throw new Error('That file isn’t something Lineup can read.'); } }
  else obj = await decode(t);
  if (!obj) throw new Error('That doesn’t look like a Lineup share code. Codes start with LB1-; make sure all of it was copied.');
  if ((obj.app === 'liftboard' || obj.app === 'lineup') && (obj.kind === 'split' || obj.kind === 'favorites')) return obj;
  if (Array.isArray(obj.days) && Array.isArray(obj.log)) throw new Error('That’s a full backup, not a share. Load it from the status menu (top right) with “Load a backup file”.');
  throw new Error('That isn’t a Lineup split or favorites list.');
}

async function copyText(text, box) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall back to selecting the text */ }
  try { box.focus(); box.select(); return document.execCommand('copy'); } catch (e) { return false; }
}
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const slug = s => String(s).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40);
const served = () => /^https?:$/.test(location.protocol);

// ---------- share ----------
/** kind: 'split' (with the split's id) or 'favorites'. */
export async function openShare(anchor, kind, id = null) {
  const env = kind === 'split' ? store.shareSplit(id) : store.shareFavorites();
  if (!env) return;
  const code = await encode(env);
  const customs = env.custom.length ? ` · ${plural(env.custom.length, 'custom exercise')}` : '';
  let what, sub, file;
  if (kind === 'split') {
    const items = env.days.flatMap(d => d.items), days = env.days.filter(d => d.items.length).length;
    what = `${plural(days, 'training day')} · ${plural(items.length, 'exercise')} with planned sets${customs}. Not your log or notes.`;
    sub = 'Send this code to anyone with Lineup. They paste it into Import on the Split page and it’s added to their splits, ready to load.';
    file = `${slug(env.name) || 'split'}.lineup-split.json`;
  } else {
    what = `${plural(env.ids.length, 'exercise')}${customs}. Not your split, log or notes.`;
    sub = 'Send this code to anyone with Lineup. They paste it into Import on the Favorites page and pick up the ones they don’t have.';
    file = `lineup-favorites-${today()}.json`;
  }
  const box = h('textarea', { class: 'input code', readOnly: true, rows: 4, spellcheck: false, 'aria-label': 'Share code', onfocus: () => box.select() });
  box.value = code;
  const copyBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: async () => {
    const ok = await copyText(code, box);
    copyBtn.lastChild.textContent = ok ? 'Copied' : 'Select and copy it';
  } }, icon('copy'), h('span', null, 'Copy code'));
  popover(anchor, () => h('div', { class: 'share' },
    h('div', { class: 'sh-t' }, kind === 'split' ? `Share “${env.name}”` : 'Share your favorites'),
    h('div', { class: 'sh-sub' }, sub),
    box,
    h('div', { class: 'sh-what' }, what),
    h('div', { class: 'sh-acts' }, copyBtn,
      h('button', { class: 'btn sm', type: 'button', onclick: () => download(file, JSON.stringify(env, null, 1)) }, icon('download'), 'Save as file'),
      served() ? h('button', { class: 'btn sm', type: 'button', onclick: async () => { await copyText(`${location.origin}${location.pathname}#import=${code}`, box); toast('Link copied'); } }, icon('ext'), 'Copy link') : null)),
  { width: 400, className: 'share-pop', toggle: false });
}

// ---------- import ----------
/** Paste a code or choose a file. A split joins your saved splits; a favorites list shows what's in it first. */
export function openImport(anchor, ctx, { code = '' } = {}) {
  let close = () => {};
  const body = h('div', { class: 'share' });
  const box = h('textarea', { class: 'input code', rows: 4, spellcheck: false, placeholder: 'Paste a share code (it starts with LB1-)', 'aria-label': 'Share code to import' });
  box.value = code;
  const err = h('div', { class: 'sh-err', role: 'alert' });
  const fileIn = h('input', { type: 'file', accept: '.json,.txt,application/json,text/plain', hidden: true, onchange: async () => {
    const f = fileIn.files[0]; fileIn.value = '';
    if (f) run(await f.text());
  } });

  async function run(text) {
    err.textContent = '';
    let env;
    try { env = await parse(text); } catch (e) { err.textContent = e.message; return; }
    if (env.kind === 'split') {
      const r = store.importSplit(env);
      close();
      toast(`Added “${r.name}” to your splits`, { label: 'Load it', fn: () => { store.switchSplit(r.id); ctx.go('split'); } }, 10000);
      return;
    }
    preview(env);
  }

  function preview(env) {
    const p = store.favoritesPreview(env);
    const add = h('button', { class: 'btn sm primary', type: 'button', disabled: !p.fresh, onclick: () => {
      const r = store.importFavorites(env);
      close();
      toast(r.added ? `Added ${plural(r.added, 'exercise')} to your favorites` : 'Nothing new to add', r.added ? { label: 'Undo', fn: r.undo } : null, 9000);
      ctx.go('favorites');
    } }, icon('starFill'), p.fresh ? `Add ${p.fresh} to my favorites` : 'You have them all');
    body.replaceChildren(
      h('div', { class: 'sh-t' }, `Favorites list · ${plural(p.items.length, 'exercise')}`),
      h('div', { class: 'sh-sub' }, [p.fresh ? `${p.fresh} new to you` : 'Nothing new to you', p.items.length - p.fresh ? `${p.items.length - p.fresh} you already have` : null,
        p.unknown ? `${plural(p.unknown, 'exercise')} this copy of Lineup doesn’t know (skipped)` : null].filter(Boolean).join(' · ') + '.'),
      h('div', { class: 'fav-prev' }, p.items.map(({ e, fresh }) => h('div', { class: `fp${fresh ? '' : ' have'}`, title: fresh ? e.name : `${e.name}: already one of yours` },
        frame(e, { size: 34, badge: false, mark: fresh ? null : 'favorite' }), h('span', null, e.name)))),
      h('div', { class: 'sh-acts' }, add, h('button', { class: 'btn sm ghost', type: 'button', onclick: draw }, 'Back')));
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));   // re-place the popover for its new height
  }

  function draw() {
    body.replaceChildren(
      h('div', { class: 'sh-t' }, 'Import a split or favorites'),
      h('div', { class: 'sh-sub' }, 'Paste the share code someone sent you, or choose the share file. A split is added to your saved splits without replacing yours; you can load it whenever you like.'),
      box, err,
      h('div', { class: 'sh-acts' },
        h('button', { class: 'btn sm primary', type: 'button', onclick: () => run(box.value) }, icon('upload'), 'Import'),
        h('button', { class: 'btn sm', type: 'button', onclick: () => fileIn.click() }, 'Choose a file…'), fileIn));
  }

  draw();
  popover(anchor, c => { close = c; return body; }, { width: 420, className: 'share-pop', toggle: false });
  setTimeout(() => box.focus({ preventScroll: true }), 30);
  if (code) run(code);
}
