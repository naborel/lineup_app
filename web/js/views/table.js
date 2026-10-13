// Table: every logged set as a row. Sort it, filter it, fix a typo in place, add or delete rows,
// take the lot out as CSV, or clear the log to start again.
import { h, icon, today, num, fmt, download } from '../util.js';
import { toast, confirmButton } from '../ui.js';
import * as store from '../store.js';
import * as cat from '../catalog.js';
import { e1rm } from '../metrics.js';

const PAGE = 150;
const COLS = [
  { k: 'date', label: 'Date' }, { k: 'name', label: 'Exercise' }, { k: 'idx', label: 'Set', n: true }, { k: 'w', label: 'Weight', n: true },
  { k: 'r', label: 'Reps', n: true }, { k: 'vol', label: 'Volume', n: true }, { k: 'e1', label: 'Est. 1RM', n: true },
];

export function mount(root, ctx, params = {}) {
  let sort = { k: 'date', dir: -1 }, exFilter = params.ex || '', shown = PAGE;

  const summary = h('div', { class: 'sub' });
  const exSel = h('select', { class: 'input select', 'aria-label': 'Exercise', onchange: () => { exFilter = exSel.value; shown = PAGE; update(); } });
  const body = h('tbody');
  const head = h('tr');
  const more = h('div', { class: 'more' });
  // Clear: the whole log, or just the exercise the table is filtered to. Two clicks, and it can be undone.
  const clearHost = h('span', { class: 'clear-host' });
  let clearKey = null;
  const sets = n => `${fmt.format(n)} ${n === 1 ? 'set' : 'sets'}`;
  function clearLog() {
    const ex = exFilter, n = store.setRows().filter(r => !ex || r.ex === ex).length;
    const undo = store.clearLog(ex || null);
    exFilter = ''; shown = PAGE; update();
    toast(ex ? `Cleared ${sets(n)} of ${cat.exOr(ex).name} from your log.` : `Cleared ${sets(n)} from your log. Your split and favorites are untouched.`, { label: 'Undo', fn: undo }, 12000);
  }
  // add-a-row form
  const aDate = h('input', { class: 'input date', type: 'date', value: today(), 'aria-label': 'Date' });
  const aEx = h('select', { class: 'input select', 'aria-label': 'Exercise for the new row' });
  const aW = h('input', { class: 'input n', type: 'number', inputMode: 'decimal', step: 'any', min: 0, placeholder: 'weight', 'aria-label': 'Weight' });
  const aR = h('input', { class: 'input n', type: 'number', inputMode: 'numeric', step: 1, min: 0, placeholder: 'reps', 'aria-label': 'Reps' });
  const addRow = () => {
    if (!aEx.value || !aDate.value || !aR.value) { toast('Pick an exercise and a date, and enter the reps.'); return; }
    store.addSet(aEx.value, aDate.value, { w: aW.value === '' ? null : +aW.value, r: +aR.value });
    aR.value = ''; aR.focus();
  };
  [aW, aR].forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') addRow(); }));

  root.replaceChildren(
    h('div', { class: 'page-head enter' },
      h('div', null, h('h1', { class: 'display' }, 'Table'), summary),
      h('div', { class: 'head-actions' },
        clearHost,
        h('button', { class: 'btn sm', type: 'button', onclick: () => download(`lineup-log-${today()}.csv`, store.exportCSV(), 'text/csv') }, icon('download'), 'CSV'))),
    h('section', { class: 'glass box-panel enter', style: { '--i': 1 } },
      h('div', { class: 'box-toolbar' }, exSel, h('span', { class: 'grow' }),
        h('div', { class: 'add-row' }, aDate, aEx, aW, h('span', { class: 'x' }, '×'), aR, h('button', { class: 'btn sm primary', type: 'button', onclick: addRow }, icon('plus'), 'Add set'))),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, head), body)),
      more));

  const options = (ids, selected) => ids.map(id => h('option', { value: id, selected: id === selected }, cat.exOr(id).name));

  function update() {
    const all = store.setRows();
    const logged = [...store.loggedIds()];
    const byName = (a, b) => cat.exOr(a).name.localeCompare(cat.exOr(b).name);
    exSel.replaceChildren(h('option', { value: '' }, 'All exercises'), ...options(logged.sort(byName), exFilter));
    const active = store.activeIds(), others = [...new Set([...store.get().favorites, ...logged])].filter(id => !active.includes(id)).sort(byName);
    const keep = aEx.value || exFilter || active[0] || '';
    aEx.replaceChildren(...[
      active.length ? h('optgroup', { label: 'In your split' }, options(active, keep)) : null,
      others.length ? h('optgroup', { label: 'Other favorites and history' }, options(others, keep)) : null].filter(Boolean));
    if (!active.length && !others.length) aEx.append(h('option', { value: '' }, 'Add exercises to your split first'));

    const rows = all.filter(r => !exFilter || r.ex === exFilter).map(r => ({ ...r, name: cat.exOr(r.ex).name, vol: (r.w || 0) * (r.r || 0), e1: r.w && r.r ? e1rm(r.w, r.r) : 0 }));
    const { k, dir } = sort;
    rows.sort((a, b) => {
      const av = a[k] ?? -1, bv = b[k] ?? -1;
      const c = av < bv ? -1 : av > bv ? 1 : 0;
      return c * dir || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || a.name.localeCompare(b.name) || a.idx - b.idx;
    });
    const sessions = new Set(all.map(r => r.date)).size;
    summary.replaceChildren(h('b', null, fmt.format(all.length)), ` ${all.length === 1 ? 'set' : 'sets'} over `, h('b', null, sessions), ` training ${sessions === 1 ? 'day' : 'days'}`,
      exFilter ? ` · showing ${rows.length} for ${cat.exOr(exFilter).name}` : '');

    // rebuilt only when what it would clear changes, so a half-confirmed click isn't lost to an unrelated redraw
    const key = `${exFilter}|${rows.length > 0}`;
    if (key !== clearKey) {
      clearKey = key;
      const btn = confirmButton(exFilter ? 'Clear this exercise' : 'Clear log', 'trash', clearLog);
      btn.disabled = !rows.length;
      btn.title = exFilter ? `Delete every logged set of ${cat.exOr(exFilter).name}` : 'Delete every logged set. Your split and favorites stay.';
      clearHost.replaceChildren(btn);
    }

    head.replaceChildren(...COLS.map(c => h('th', { class: c.n ? 'n' : '', 'aria-sort': sort.k === c.k ? (sort.dir > 0 ? 'ascending' : 'descending') : null },
      h('button', { type: 'button', onclick: () => { sort = sort.k === c.k ? { k: c.k, dir: -sort.dir } : { k: c.k, dir: c.k === 'name' ? 1 : -1 }; update(); } },
        c.k === 'w' ? `Weight (${store.unit()})` : c.label, sort.k === c.k ? icon(sort.dir > 0 ? 'up' : 'down') : null))), h('th', null));

    if (!rows.length) {
      body.replaceChildren(h('tr', null, h('td', { colSpan: COLS.length + 1 }, h('div', { class: 'empty' },
        h('div', { class: 'display' }, 'No sets logged yet'), h('div', { class: 'sub' }, 'Sets you enter on the Track page land here, one row each. You can also add them with the row above.')))));
      more.replaceChildren();
      return;
    }
    body.replaceChildren(...rows.slice(0, shown).map(r => {
      const vol = h('td', { class: 'n num' }, r.w ? fmt.format(Math.round(r.vol)) : '—');
      const e1 = h('td', { class: 'n num' }, r.e1 ? fmt.format(Math.round(r.e1)) : '—');
      const recompute = () => {
        const w = +wIn.value || 0, reps = +rIn.value || 0;
        vol.textContent = w ? fmt.format(Math.round(w * reps)) : '—';
        e1.textContent = w && reps ? fmt.format(Math.round(e1rm(w, reps))) : '—';
      };
      const dIn = h('input', { class: 'cell date', type: 'date', value: r.date, 'aria-label': 'Date', onchange: () => { if (dIn.value && dIn.value !== r.date) store.moveSet(r.entry.id, r.idx, dIn.value); } });
      const wIn = h('input', { class: 'cell n', type: 'number', inputMode: 'decimal', step: 'any', min: 0, value: num(r.w), placeholder: '—', 'aria-label': 'Weight',
        onchange: () => { store.updateSet(r.entry.id, r.idx, { w: wIn.value === '' ? null : +wIn.value }); recompute(); } });
      const rIn = h('input', { class: 'cell n', type: 'number', inputMode: 'numeric', step: 1, min: 0, value: r.r ?? '', 'aria-label': 'Reps',
        onchange: () => { store.updateSet(r.entry.id, r.idx, { r: rIn.value === '' ? null : +rIn.value }); recompute(); } });
      return h('tr', null,
        h('td', null, dIn),
        h('td', null, h('button', { class: 'link', type: 'button', onclick: () => ctx.openExercise(r.ex) }, r.name)),
        h('td', { class: 'n num' }, r.idx + 1), h('td', { class: 'n' }, wIn), h('td', { class: 'n' }, rIn), vol, e1,
        h('td', { class: 'act' }, h('button', { class: 'btn xs ghost icon-btn danger', type: 'button', 'aria-label': 'Delete this set', title: 'Delete this set',
          onclick: () => { const undo = store.deleteSet(r.entry.id, r.idx); toast('Set deleted', { label: 'Undo', fn: undo }); } }, icon('trash'))));
    }));
    more.replaceChildren(rows.length > shown ? h('button', { class: 'btn sm', type: 'button', onclick: () => { shown += PAGE * 2; update(); } }, `Show more (${rows.length - shown} left)`) : '');
  }

  update();
  return { update };
}
