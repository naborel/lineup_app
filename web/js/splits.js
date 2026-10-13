// The Splits card under the coverage model: your saved splits, one of them loaded.
// Click a split to load it (Favorites, Track and Table follow); hover one to preview it on the model.
// Each has a menu to rename, duplicate, share or delete it. Import adds a split someone sent you.
import { h, icon } from './util.js';
import { popover, toast } from './ui.js';
import * as store from './store.js';
import { openShare, openImport } from './share.js';

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** opts: {ctx, onPreview(split | null)} → {el, update} */
export function splitsCard({ ctx, onPreview }) {
  const list = h('div', { class: 'sp-list', role: 'list' });
  const importBtn = h('button', { class: 'btn xs', type: 'button', title: 'Add a split or favorites someone shared with you', onclick: () => openImport(importBtn, ctx) }, icon('upload'), 'Import');
  const newBtn = h('button', { class: 'btn xs', type: 'button', title: 'Start an empty split', onclick: () => {
    const r = store.newSplit();
    toast(`Started “${store.splitName(store.activeSplit())}”, an empty split`, { label: 'Undo', fn: r.undo });
    requestAnimationFrame(() => { const b = moreBtn(r.id); if (b) menu(b, r.id, true); });
  } }, icon('plus'), 'New');
  const el = h('section', { class: 'glass splits-card enter', style: { '--i': 2 } },
    h('div', { class: 'cover-head' }, h('div', { class: 'ss-t' }, 'Splits'), h('span', { class: 'grow' }), importBtn, newBtn),
    list,
    h('div', { class: 'sp-note' }, 'Click a split to load it; hover to preview it on the model. Changes save to the loaded split as you go.'));

  const moreBtn = id => list.querySelector(`.sp-row[data-id="${id}"] .sp-more`);

  function load(id) {
    const name = store.splitName(store.splits().find(sp => sp.id === id));
    const undo = store.switchSplit(id);
    if (undo) toast(`Loaded “${name}”`, { label: 'Undo', fn: undo });
  }

  function menu(anchor, id, focusName = false) {
    const sp = store.splits().find(x => x.id === id);
    if (!sp) return;
    popover(anchor, close => {
      const on = sp.id === store.get().active, only = store.splits().length < 2, name = store.splitName(sp);
      const nameIn = h('input', { class: 'input sp-name', value: sp.name, maxLength: 60, placeholder: 'Untitled split', 'aria-label': 'Split name', spellcheck: false,
        oninput: () => store.renameSplit(sp.id, nameIn.value), onkeydown: e => { if (e.key === 'Enter') close(); } });
      if (focusName) setTimeout(() => { nameIn.focus(); nameIn.select(); }, 30);
      return h('div', { class: 'item-menu' },
        h('div', { class: 'im-row' }, h('span', null, 'Name'), nameIn),
        h('div', { class: 'sep' }),
        on ? null : h('button', { class: 'opt', type: 'button', onclick: () => { close(); load(sp.id); } }, icon('body'), h('span', null, 'Load this split')),
        h('button', { class: 'opt', type: 'button', onclick: () => {
          close();
          const r = store.duplicateSplit(sp.id);
          toast(`Made a copy, “${store.splitName(store.activeSplit())}”, and loaded it`, { label: 'Undo', fn: r.undo });
        } }, icon('copy'), h('span', null, 'Duplicate')),
        h('button', { class: 'opt', type: 'button', onclick: () => { close(); openShare(moreBtn(sp.id) || anchor, 'split', sp.id); } }, icon('ext'), h('span', null, 'Share…')),
        h('div', { class: 'sep' }),
        h('button', { class: 'opt danger', type: 'button', disabled: only, onclick: () => {
          close();
          const undo = store.deleteSplit(sp.id);
          if (undo) toast(`Deleted “${name}”${on ? `; loaded “${store.splitName(store.activeSplit())}”` : ''}`, { label: 'Undo', fn: undo }, 9000);
        } }, icon('trash'), h('span', null, 'Delete this split'), only ? h('span', { class: 'hint' }, 'your only one') : null));
    }, { width: 320, className: 'item-pop' });
  }

  function update() {
    const st = store.get();
    list.replaceChildren(...store.splits().map(sp => {
      const on = sp.id === st.active, { days, exercises } = store.splitSize(sp), name = store.splitName(sp);
      const main = h('button', { class: 'sp-main', type: 'button', 'aria-current': on ? 'true' : null, title: on ? 'Loaded' : `Load ${name}`, onclick: () => { if (!on) load(sp.id); } },
        h('span', { class: 'dot' }),
        h('span', { class: 'nm' }, name),
        h('span', { class: 'mt' }, exercises ? `${plural(days, 'day')} · ${plural(exercises, 'exercise')}` : 'empty'),
        on ? h('span', { class: 'chip loaded' }, 'Loaded') : null);
      if (!on) {
        main.addEventListener('mouseenter', () => onPreview(sp));
        main.addEventListener('mouseleave', () => onPreview(null));
        main.addEventListener('focus', () => onPreview(sp));
        main.addEventListener('blur', () => onPreview(null));
      }
      const more = h('button', { class: 'btn xs ghost icon-btn sp-more', type: 'button', title: 'Rename, duplicate, share or delete', 'aria-label': `Menu for ${name}`, onclick: () => menu(more, sp.id) }, icon('dots'));
      return h('div', { class: `sp-row${on ? ' on' : ''}`, 'data-id': sp.id, role: 'listitem' }, main, more);
    }));
  }

  update();
  return { el, update };
}
