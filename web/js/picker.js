// The exercise picker: search, an optional muscle filter, and a day to add to.
// Your favorites are listed first, then the rest of the catalog (same idea as "+ Pick" in Draftboard).
// Opened from "+" on a day (day chosen for you) or by tapping a muscle on the model (muscle chosen for you).
// In favorites mode (the "+" on a group on the Favorites page) there's no day: a click stars or unstars.
import { h, icon, isTouch } from './util.js';
import { popover, repositionPop } from './ui.js';
import * as store from './store.js';
import * as cat from './catalog.js';
import { frame } from './tiles.js';
import { coverage } from './metrics.js';

/** A row for an exercise in a list. actions: nodes placed on the right. */
export function exerciseRow(e, { sub = null, actions = null, onClick = null, i = 0, mark = null, cls = '' } = {}) {
  return h('div', { class: `res ${cls}`, role: 'option', tabIndex: -1, style: { '--i': Math.min(i, 18) }, onclick: ev => { if (!ev.target.closest('.acts')) onClick && onClick(ev); } },
    frame(e, { size: 38, badge: false, mark }),
    h('div', { style: { minWidth: 0 } },
      h('div', { class: 't' }, e.name),
      h('div', { class: 'm' }, sub ?? `${cat.primaryLine(e)} · ${cat.EQ[e.eq]}`)),
    h('div', { class: 'acts' }, actions));
}

/**
 * Muscle dropdown: the group names (Chest, Arms, Legs…) are choices themselves, with their muscles listed
 * under them. A browser's own dropdown can't make a group heading clickable, so this one is drawn here.
 * Returns the button; its data-value is the current choice ('' for all, 'g:Arms' for a group, or a muscle id).
 */
let closeOpenDrop = null;
export function muscleSelect(value, onChange, { allLabel = 'All muscles' } = {}) {
  let current = value || '', panel = null, active = 0, cleanup = null;
  const items = [{ v: '', t: allLabel, cls: 'all' },
    ...cat.groups().flatMap(g => [{ v: cat.groupKey(g), t: g, cls: 'grp' }, ...cat.muscles().filter(m => m.group === g).map(m => ({ v: m.id, t: m.name, cls: 'mus' }))])];
  const text = h('span', { class: 'ms-v' });
  const btn = h('button', { class: 'input select msel', type: 'button', 'aria-label': 'Muscle', 'aria-haspopup': 'listbox', 'aria-expanded': 'false',
    onclick: () => (panel ? close() : open()),
    onkeydown: e => { if (!panel && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); open(); } } }, text);
  const sync = () => { const it = items.find(x => x.v === current) || items[0]; text.textContent = it.t; btn.dataset.value = current; };

  function pick(v) {
    close(); btn.focus({ preventScroll: true });
    if (v === current) return;
    current = v; sync(); onChange(v || null);
  }
  function setActive(i, scroll) {
    active = Math.max(0, Math.min(items.length - 1, i));
    [...panel.children].forEach((o, j) => o.classList.toggle('kb', j === active));
    if (scroll) panel.children[active].scrollIntoView({ block: 'nearest' });
  }
  function place() {
    const r = btn.getBoundingClientRect(), w = Math.max(r.width, 230);
    const below = innerHeight - r.bottom - 14, above = r.top - 14;
    const down = below >= 260 || below >= above;
    panel.style.width = w + 'px';
    panel.style.left = Math.max(10, Math.min(r.left, innerWidth - w - 10)) + 'px';
    panel.style.maxHeight = Math.min(440, down ? below : above) + 'px';
    if (down) { panel.style.top = (r.bottom + 6) + 'px'; panel.style.bottom = ''; }
    else { panel.style.bottom = (innerHeight - r.top + 6) + 'px'; panel.style.top = ''; panel.style.setProperty('--origin', 'bottom center'); }
  }
  function key(e) {
    const step = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 }[e.key];
    if (step) setActive(active + step, true);
    else if (e.key === 'Home') setActive(0, true);
    else if (e.key === 'End') setActive(items.length - 1, true);
    else if (e.key === 'Enter' || e.key === ' ') pick(items[active].v);
    else if (e.key === 'Escape' || e.key === 'Tab') { close(); btn.focus({ preventScroll: true }); if (e.key === 'Tab') return; }
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      // type a letter to jump to the next choice starting with it
      const k = e.key.toLowerCase(), n = items.length;
      for (let j = 1; j <= n; j++) { const it = items[(active + j) % n]; if (it.t.toLowerCase().startsWith(k)) { setActive((active + j) % n, true); break; } }
    } else return;
    e.preventDefault(); e.stopPropagation();   // keep Escape from also closing the picker around it
  }
  function open() {
    if (closeOpenDrop) closeOpenDrop();
    panel = h('div', { class: 'pop-child msel-pop', role: 'listbox', tabIndex: -1, 'aria-label': 'Muscle', onkeydown: key },
      items.map((it, i) => h('div', { class: `ms-o ${it.cls}`, role: 'option', 'aria-selected': String(it.v === current), 'data-v': it.v,
        title: it.cls === 'grp' ? `Every ${it.t.toLowerCase()} muscle` : null, onclick: () => pick(it.v), onpointermove: () => { if (active !== i) setActive(i, false); } }, it.t)));
    document.body.append(panel);
    place();
    setActive(Math.max(0, items.findIndex(x => x.v === current)), true);
    panel.focus({ preventScroll: true });
    btn.setAttribute('aria-expanded', 'true');
    const onDown = e => { if (!panel.contains(e.target) && !btn.contains(e.target)) close(); };
    const onScroll = e => { if (!panel.contains(e.target)) close(); };
    const onPopClose = () => { if (!btn.isConnected || btn.closest('.pop.out')) close(); };
    document.addEventListener('pointerdown', onDown, true);
    addEventListener('scroll', onScroll, true);
    addEventListener('resize', close);
    document.addEventListener('lb:popclose', onPopClose);
    cleanup = () => {
      document.removeEventListener('pointerdown', onDown, true);
      removeEventListener('scroll', onScroll, true);
      removeEventListener('resize', close);
      document.removeEventListener('lb:popclose', onPopClose);
    };
    closeOpenDrop = close;
  }
  function close() {
    if (!panel) return;
    cleanup(); panel.remove(); panel = null;
    btn.setAttribute('aria-expanded', 'false');
    if (closeOpenDrop === close) closeOpenDrop = null;
  }
  sync();
  return btn;
}

/**
 * opts: {day: index | null, muscle: zone or 'g:Group' | null, mode: 'day' | 'favorites', onDetails(exId), onClose}
 */
export function openPicker(anchor, { day = null, muscle = null, mode = 'day', onDetails = null, onClose = null } = {}) {
  let zone = muscle, di = day ?? store.get().prefs.lastDay ?? 0, q = '';
  const favMode = mode === 'favorites';
  // in favorites mode the "your favorites" section is fixed when the list is drawn for a search or filter,
  // so a row you just starred stays where it is instead of jumping up the list
  let pinned = new Set(store.get().favorites);
  const input = h('input', { class: 'input', type: 'search', placeholder: 'Search exercises…', autocomplete: 'off', spellcheck: false });
  const list = h('div', { class: 'res-list pk-list', role: 'listbox' });
  const zoneInfo = h('div', { class: 'pk-zone' });
  const dayRow = h('div', { class: 'pk-days' });
  let sel = null;

  const renderDays = () => {
    if (favMode) { dayRow.replaceChildren(h('span', { class: 'pk-hint' }, 'Click an exercise to add it to your favorites; click again to take it off.')); return; }
    dayRow.replaceChildren(h('span', { class: 'lbl' }, 'Add to'),
      h('div', { class: 'daypick' }, store.get().days.map((d, i) => h('button', {
        type: 'button', class: d.items.length ? 'used' : '', 'aria-pressed': String(i === di), title: store.dayLabel(i),
        onclick: () => { di = i; store.setPref('lastDay', i); renderDays(); renderList(); },
      }, String(i + 1)))),
      h('span', { class: 'dname' }, store.get().days[di].name.trim() || (store.get().days[di].items.length ? '' : 'empty')));
  };

  const renderZone = () => {
    if (!zone || favMode) { zoneInfo.hidden = true; return; }
    zoneInfo.hidden = false;
    if (cat.isGroup(zone)) {
      // a whole group: how each of its muscles stands in the split
      const all = coverage(store.get().days);
      zoneInfo.replaceChildren(
        h('div', { class: 'zt' }, cat.filterName(zone), h('span', null, 'every muscle in the group')),
        h('div', { class: 'zs zg' }, cat.zonesOf(zone).map(z => {
          const c = all.get(z);
          return h('span', { class: c && c.direct ? '' : 'none' }, cat.short(z), ' ', h('b', null, c ? (c.direct ? `${c.direct}×` : 'helped') : '—'));
        })));
      return;
    }
    const m = cat.muscle(zone), cov = coverage(store.get().days).get(zone);
    const direct = cov ? cov.hits.filter(x => x.credit === 1) : [];
    const helps = cov ? cov.hits.filter(x => x.credit < 1) : [];
    const names = hits => [...new Set(hits.map(x => `${cat.exOr(x.ex).name} (D${x.day + 1})`))].join(', ');
    zoneInfo.replaceChildren(
      h('div', { class: 'zt' }, m.name, m.note ? h('span', null, m.note) : null),
      h('div', { class: 'zs' }, !cov ? 'Nothing in your split touches this yet.'
        : [direct.length ? h('span', null, h('b', null, `${cov.direct}×`), ' direct: ', names(direct), '.') : h('span', null, 'No direct work yet.'),
           helps.length ? h('span', null, ' Helped by ', names(helps), '.') : null,
           !direct.length ? h('span', null, ' Helpers alone leave it pale; a direct exercise turns it red.') : null]));
  };

  const renderList = () => {
    const favoriteIds = new Set(store.get().favorites);
    const found = cat.search(q, { muscle: zone, boost: favMode ? pinned : favoriteIds, limit: 200 });
    const first = favMode ? pinned : favoriteIds;
    const mine = found.filter(e => first.has(e.id)), rest = found.filter(e => !first.has(e.id));
    list.replaceChildren();
    let i = 0;
    const favRow = e => {
      const fav = favoriteIds.has(e.id), locked = fav && store.inSplit(e.id);
      const helper = zone && cat.credit(e, zone) < 1;
      const sub = [helper ? `Helps · mainly ${cat.primaryLine(e).toLowerCase()}` : cat.primaryLine(e), cat.EQ[e.eq], cat.ORIGIN[cat.origin(e)]].filter(Boolean).join(' · ');
      return exerciseRow(e, {
        i: i++, sub, cls: fav ? 'on' : '',
        onClick: () => { if (!locked) store.toggleFavorite(e.id); },
        actions: [
          onDetails ? h('button', { class: 'btn xs ghost icon-btn', type: 'button', title: 'Details', 'aria-label': `Details for ${e.name}`, onclick: () => onDetails(e.id) }, icon('info')) : null,
          h('span', { class: `chip ${fav ? 'good' : 'muted'} add fav`, title: locked ? 'It’s in your split, so it stays a favorite' : null }, icon(fav ? 'starFill' : 'star'), locked ? 'In split' : fav ? 'Favorite' : 'Add'),
        ],
      });
    };
    const row = e => {
      if (favMode) return favRow(e);
      const here = store.inDay(di, e.id);
      const helper = zone && cat.credit(e, zone) < 1;
      const elsewhere = store.placements(e.id).filter(p => p.di !== di).map(p => `D${p.di + 1}`);
      const sub = [helper ? `Helps · mainly ${cat.primaryLine(e).toLowerCase()}` : cat.primaryLine(e), cat.EQ[e.eq], cat.ORIGIN[cat.origin(e)], elsewhere.length ? `in ${elsewhere.join(', ')}` : null].filter(Boolean).join(' · ');
      return exerciseRow(e, {
        i: i++, sub, cls: here ? 'on' : '',
        onClick: () => { if (here) store.removeFromDay(di, e.id); else store.addToDay(di, e.id); },
        actions: [
          onDetails ? h('button', { class: 'btn xs ghost icon-btn', type: 'button', title: 'Details', 'aria-label': `Details for ${e.name}`, onclick: () => onDetails(e.id) }, icon('info')) : null,
          h('button', { class: `btn xs ghost icon-btn star${favoriteIds.has(e.id) ? ' on' : ''}`, type: 'button', title: favoriteIds.has(e.id) ? 'One of your favorites' : 'Add to your favorites',
            'aria-label': 'Toggle favorite', disabled: store.inSplit(e.id) && favoriteIds.has(e.id), onclick: () => store.toggleFavorite(e.id) }, icon(favoriteIds.has(e.id) ? 'starFill' : 'star')),
          h('span', { class: `chip ${here ? 'good' : 'muted'} add` }, icon(here ? 'check' : 'plus'), `Day ${di + 1}`),
        ],
      });
    };
    if (mine.length) list.append(h('div', { class: 'assign-sub' }, zone ? `Your favorites for ${cat.filterName(zone).toLowerCase()}` : 'Your favorites'), ...mine.map(row));
    if (rest.length) list.append(h('div', { class: 'assign-sub' }, mine.length ? 'More from the catalog' : 'Catalog'), ...rest.map(row));
    if (!found.length) list.append(h('div', { class: 'res-empty' }, q ? `No exercise matches “${q}”${zone ? ' for this muscle' : ''}.` : 'Nothing here.'));
    repositionPop();
  };

  const refilter = () => { pinned = new Set(store.get().favorites); renderList(); };
  input.addEventListener('input', () => { q = input.value.trim(); refilter(); });
  const unsub = store.subscribe(() => { renderDays(); renderZone(); renderList(); });
  const pop = popover(anchor, () => {
    sel = muscleSelect(zone, v => { zone = v; renderZone(); refilter(); });
    return h('div', { class: 'picker' },
      h('div', { class: 'pk-top' }, h('div', { class: 'search' }, icon('search'), input), sel),
      zoneInfo, dayRow, list);
  }, { className: 'picker-pop', width: 440, toggle: false, onClose: () => { unsub(); onClose && onClose(); } });
  renderDays(); renderZone(); renderList();
  if (!isTouch()) input.focus({ preventScroll: true });
  return pop;
}
