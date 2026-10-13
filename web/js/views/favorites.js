// Favorites: the exercises you like, whether or not they're in the current split, with the full catalog
// one click away. Building a new split starts here: everything you already know works for you is in one place.
// My favorites always shows every muscle group, each with a "+" that opens the catalog for that group.
import { h, icon, seg } from '../util.js';
import { popover, toast, confirmButton } from '../ui.js';
import * as store from '../store.js';
import * as cat from '../catalog.js';
import { unit } from '../tiles.js';
import { muscleSelect, openPicker } from '../picker.js';
import { openShare, openImport } from '../share.js';

export function mount(root, ctx) {
  let view = 'mine', q = '', zone = null, eq = null;

  const summary = h('div', { class: 'sub' });
  const lanes = h('div', { class: 'lanes' });
  const input = h('input', { class: 'input', type: 'search', placeholder: 'Filter by name, muscle or equipment', autocomplete: 'off', spellcheck: false, oninput: () => { q = input.value.trim(); update(); } });
  const viewSeg = h('div');
  const eqSel = h('select', { class: 'input select', 'aria-label': 'Equipment', onchange: () => { eq = eqSel.value || null; update(); } },
    h('option', { value: '' }, 'Any equipment'), Object.entries(cat.EQ).map(([k, v]) => h('option', { value: k }, v)));
  // send your favorites to someone, or take in a list someone sent you
  const importBtn = h('button', { class: 'btn sm', type: 'button', title: 'Add favorites (or a split) someone shared with you', onclick: () => openImport(importBtn, ctx) }, icon('upload'), 'Import');
  const shareBtn = h('button', { class: 'btn sm', type: 'button', title: 'Send your favorites to someone', onclick: () => openShare(shareBtn, 'favorites') }, icon('ext'), 'Share');
  const clearBtn = confirmButton('Clear', 'trash', () => { const undo = store.clearFavorites(); toast('Favorites cleared (exercises in your split stay).', { label: 'Undo', fn: undo }); });

  root.replaceChildren(
    h('div', { class: 'page-head enter' },
      h('div', null, h('h1', { class: 'display' }, 'Favorites'), summary),
      h('div', { class: 'head-actions' }, importBtn, shareBtn,
        h('button', { class: 'btn sm', type: 'button', onclick: () => ctx.editCustom(null) }, icon('plus'), 'Custom exercise'))),
    h('section', { class: 'glass box-panel enter', style: { '--i': 1 } },
      h('div', { class: 'box-toolbar' },
        h('div', { class: 'search' }, icon('search'), input),
        viewSeg, muscleSelect(null, v => { zone = v; update(); }), eqSel, h('span', { class: 'grow' }), clearBtn),
      lanes));

  function tileMenu(anchor, e) {
    popover(anchor, close => {
      const days = h('div', { class: 'daypick' });
      const drawDays = () => days.replaceChildren(...store.get().days.map((d, i) => h('button', {
        type: 'button', class: d.items.length ? 'used' : '', 'aria-pressed': String(store.inDay(i, e.id)), title: store.dayLabel(i),
        onclick: () => { if (store.inDay(i, e.id)) store.removeFromDay(i, e.id); else store.addToDay(i, e.id); drawDays(); },
      }, String(i + 1))));
      drawDays();
      const isFav = store.isFavorite(e.id), used = store.inSplit(e.id);
      return h('div', { class: 'item-menu' },
        h('div', { class: 'head' }, e.name),
        h('button', { class: 'opt', type: 'button', onclick: () => { close(); ctx.openExercise(e.id); } }, icon('info'), h('span', null, 'View details and progress')),
        h('div', { class: 'im-row' }, h('span', null, 'In days'), days),
        h('div', { class: 'sep' }),
        h('button', { class: 'opt', type: 'button', disabled: isFav && used, onclick: () => { close(); const undo = store.toggleFavorite(e.id); if (isFav) toast(`Removed ${e.name} from your favorites`, { label: 'Undo', fn: undo }); } },
          icon(isFav ? 'x' : 'star'), h('span', null, isFav ? 'Remove from favorites' : 'Add to your favorites'), isFav && used ? h('span', { class: 'hint' }, 'in your split') : null),
        h('button', { class: 'opt', type: 'button', onclick: () => { close(); ctx.makeVariation(e.id); } }, icon('copy'), h('span', null, 'Make a variation')),
        e.custom ? h('button', { class: 'opt', type: 'button', onclick: () => { close(); ctx.editCustom(e.id); } }, icon('note'), h('span', null, 'Edit this exercise')) : null);
    }, { width: 336, className: 'item-pop' });
  }

  function update() {
    const st = store.get(), favoriteIds = new Set(st.favorites);
    const inSplit = new Set(store.activeIds());
    viewSeg.replaceChildren(seg([
      { value: 'mine', label: `My favorites · ${st.favorites.length}` },
      { value: 'catalog', label: `Catalog · ${cat.all().length}` },
    ], view, v => { view = v; update(); }, 'small'));
    summary.replaceChildren(...(st.favorites.length
      ? [h('b', null, st.favorites.length), ` ${st.favorites.length === 1 ? 'favorite' : 'favorites'} · `, h('b', null, [...favoriteIds].filter(id => inSplit.has(id)).length), ' in your split']
      : ['The exercises you like and come back to. Add them with + on a group, or star them in the catalog.']));
    clearBtn.hidden = view !== 'mine';
    shareBtn.disabled = !st.favorites.length;
    clearBtn.disabled = !st.favorites.some(id => !inSplit.has(id));

    let list = cat.search(q, { muscle: zone, limit: 999 });
    if (!q && !zone) list = [...list].sort((a, b) => a.order - b.order);
    if (eq) list = list.filter(e => e.eq === eq);
    if (view === 'mine') list = list.filter(e => favoriteIds.has(e.id));

    // My favorites with no filter shows every group, empty or not, so there's always a "+" to start from
    const everyGroup = view === 'mine' && !q && !zone && !eq;
    if (!list.length && !everyGroup) {
      lanes.replaceChildren(h('div', { class: 'empty' },
        h('div', { class: 'display' }, 'Nothing matches'),
        h('div', { class: 'sub' }, 'Try fewer words, another muscle or any equipment.')));
      return;
    }
    lanes.replaceChildren(...cat.groups().map(g => {
      const items = list.filter(e => e.group === g);
      if (!items.length && !everyGroup) return null;
      const add = view === 'mine' ? h('button', { class: 'lane-add', type: 'button', 'aria-label': `Add ${g.toLowerCase()} exercises to your favorites`, title: `Find ${g.toLowerCase()} exercises`,
        onclick: () => openPicker(add, { mode: 'favorites', muscle: cat.groupKey(g), onDetails: ctx.openExercise }) }, icon('plus'), items.length ? null : 'Add exercises') : null;
      return h('div', { class: `lane${items.length ? '' : ' empty-lane'}`, 'data-group': g },
        h('div', { class: 'lane-label' }, h('div', { class: 'ln' }, g), h('div', { class: 'lc' }, items.length ? h('b', null, items.length) : null)),
        h('div', { class: 'lane-units' }, items.map(e => {
          const btn = unit(e, { size: 60, mark: inSplit.has(e.id) ? 'split' : null,
            sub: zone && cat.credit(e, zone) < 1 ? 'helps' : cat.ORIGIN[cat.origin(e)] || null, onClick: () => tileMenu(btn, e) });
          return h('div', { class: 'bx-wrap' }, btn,
            view === 'catalog' && !inSplit.has(e.id) ? h('button', { class: `rx star${favoriteIds.has(e.id) ? ' on' : ''}`, type: 'button', title: favoriteIds.has(e.id) ? 'Remove from favorites' : 'Add to your favorites',
              'aria-label': 'Toggle favorite', onclick: () => store.toggleFavorite(e.id) }, icon(favoriteIds.has(e.id) ? 'starFill' : 'star')) : null);
        }), add));
    }).filter(Boolean));   // a group that's filtered out draws nothing
  }

  update();
  return { update };
}
