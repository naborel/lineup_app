// Exercise "units": the framed tile (a crop of the body with the trained muscles lit), and the
// tile + name button used in days, favorites and the catalog.
import { h, icon } from './util.js';
import { tileImage } from './body.js';
import { EQ } from './catalog.js';

/**
 * opts: size (px), mark ('split' = mint check, 'favorite' = gold star), sets (number shown bottom-left),
 *       badge (show the equipment glyph, default true)
 */
export function frame(e, { size = 64, mark = null, sets = null, badge = true, cls = '' } = {}) {
  const sizeCls = size <= 30 ? ' xs' : size <= 44 ? ' sm' : '';
  return h('div', { class: `xf${sizeCls} ${cls}`, style: { '--sz': size + 'px' } },
    h('img', { class: 'port', src: tileImage(e), alt: '', loading: 'lazy', decoding: 'async', draggable: false }),
    badge && size > 30 ? h('span', { class: 'eqb', title: EQ[e.eq] || '' }, icon('eq_' + (EQ[e.eq] ? e.eq : 'other'))) : null,
    mark === 'split' ? h('span', { class: 'mk in-split', title: 'In your split' }, icon('check')) : null,
    mark === 'favorite' ? h('span', { class: 'mk is-fav', title: 'One of your favorites' }, icon('starFill')) : null,
    sets != null && size > 44 ? h('span', { class: 'sets', title: `${sets} sets planned` }, `${sets}×`) : null);
}

/** Tile with its name underneath: a button. */
export function unit(e, { size = 60, mark = null, sets = null, onClick = null, sub = null, cls = '' } = {}) {
  return h('button', { class: `bx ${cls}`, type: 'button', title: e.name, onclick: onClick },
    frame(e, { size, mark, sets }),
    h('span', { class: 'nm' }, e.name),
    sub ? h('span', { class: 'cap' }, sub) : null);
}
