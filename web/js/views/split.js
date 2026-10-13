// Split: the model on the left turns red where your split reaches; the eight day slots on the right hold
// the exercises. Tap a muscle to find exercises for it, or "+" on a day to add to that day.
// The model shows the whole split unless you pick days to look at (the chips above it, or a click on a day row).
// Under the model, the Splits card holds your saved splits; the one loaded is the one on this page.
import { h, icon, isTouch } from '../util.js';
import { popover, toast, confirmButton, closePop } from '../ui.js';
import * as store from '../store.js';
import * as cat from '../catalog.js';
import { bodyMap } from '../body.js';
import { coverage, heat, helpedColour, HEAT, HEAT_MAX, SILVER } from '../metrics.js';
import { unit } from '../tiles.js';
import { openPicker } from '../picker.js';
import { loadSample } from '../sample.js';
import { splitsCard } from '../splits.js';
import { openOptimize } from './optimizeSheet.js';

const sets = n => (Math.round(n * 10) / 10) + (n === 1 ? ' set' : ' sets');

export function mount(root, ctx) {
  let cov = new Map();
  let drag = null;
  // The days the model is showing. Empty means the whole split. It's a way of looking, not part of the plan,
  // so it isn't saved: the page always opens on the whole split.
  const shown = new Set();
  let lastSplit = store.get().active;   // a different split loaded: start again from the whole split
  let previewing = null;                // a saved split being hovered in the Splits card
  const filtered = () => shown.size > 0;
  // days can share a name (two "Push" days), so always say the number
  const full = i => { const n = store.get().days[i].name.trim(); return `Day ${i + 1}${n ? ` (${n})` : ''}`; };
  const shownLabel = () => { const d = [...shown].sort((a, b) => a - b); return d.length === 1 ? full(d[0]) : `Days ${d.map(i => i + 1).join(' + ')}`; };
  function toggleDay(di) {
    if (!store.get().days[di].items.length) return;
    if (shown.has(di)) shown.delete(di); else shown.add(di);
    update();
  }
  const showAll = () => { shown.clear(); update(); };
  const showOnly = di => { shown.clear(); shown.add(di); update(); };

  // ---------- model ----------
  let picking = null;   // the muscle the picker is open for
  // fade the tiles that don't train this muscle, so the ones that do stand out
  const spotlight = zone => {
    root.querySelectorAll('.bx-wrap').forEach(w => w.classList.toggle('dim', !!zone && !w.dataset.zones.split(' ').includes(zone)));
    root.querySelectorAll('.cov-row').forEach(r => r.classList.toggle('hov', r.dataset.z === zone));
  };
  // open the picker beside the model rather than on top of it: you want to watch it change
  function pickFor(zone, e, anchor = null) {
    const card = coverCard.getBoundingClientRect();
    const beside = innerWidth > 900 ? { x: card.right + 8, y: Math.max(card.top, 84) - 6 } : { x: e.clientX, y: e.clientY };
    picking = zone; map.select(zone); spotlight(zone);
    openPicker(anchor || beside, { muscle: zone, day: shown.size === 1 ? [...shown][0] : null, onDetails: ctx.openExercise, onClose: () => { picking = null; map.select(null); spotlight(null); } });
  }
  const tip = h('div', { class: 'bm-tip' });
  const moveTip = e => {
    const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 10);
    tip.style.left = x + 'px'; tip.style.top = (e.clientY + 16) + 'px';
  };
  const map = bodyMap({
    onPick: (zone, e) => { tip.classList.remove('on'); pickFor(zone, e); },
    onHover: (zone, e) => {
      spotlight(zone || picking);
      if (!zone) { tip.classList.remove('on'); return; }
      const m = cat.muscle(zone), c = cov.get(zone);
      tip.replaceChildren(h('b', null, m.name), h('span', null, !c ? (filtered() ? `Not trained on ${shown.size === 1 ? 'this day' : 'these days'}` : 'Not in your split yet') : `${c.direct ? `${c.direct}× direct` : 'helped only'} · ${sets(c.sets)}`));
      tip.classList.add('on'); moveTip(e);
    },
  });
  // two states that aren't on the scale (untouched, helped only), then the scale for direct work
  const key = (colour, label, title) => h('span', { class: 'key', title }, h('i', { class: 'sw', style: { background: colour } }), label);
  const pos = sc => (sc - 1) / (HEAT_MAX - 1) * 100;
  const legend = h('div', { class: 'legend' },
    h('div', { class: 'keys' },
      key(SILVER, 'Not hit', 'Nothing in the split touches it'),
      key(helpedColour(), 'Helped only', 'Other lifts involve it, but nothing trains it directly. It stays this pale however many of them there are.')),
    h('div', { class: 'scale' },
      h('div', { class: 'bar', style: { background: `linear-gradient(90deg, ${HEAT.filter(([sc]) => sc >= 1).map(([sc, c]) => `${c} ${pos(sc)}%`).join(', ')})` } }),
      h('div', { class: 'ticks' }, ['Once', 'Twice', '3×', '4×+'].map((t, i) => h('span', { style: { left: pos(i + 1) + '%' } }, t)))),
    h('button', { class: 'link how', type: 'button', onclick: () => ctx.go('science') }, 'How the colour is worked out'));
  // which days the model shows
  const showRow = h('div', { class: 'cover-show' });
  const coverHint = isTouch() ? 'Tap a muscle to find exercises for it' : 'Click a muscle to find exercises for it';
  const coverSub = h('div', { class: 'sub' }, coverHint);
  const coverCard = h('section', { class: 'glass cover enter', style: { '--i': 1 } },
    h('div', { class: 'cover-head' }, h('div', { class: 'ss-t' }, 'Coverage'), coverSub),
    showRow, map.el, legend);
  const paint = c => map.paint(new Map([...c].map(([z, v]) => [z, heat(v.score)])));
  // hovering a saved split shows it on the model without loading it
  const cards = splitsCard({ ctx, onPreview: sp => {
    previewing = sp;
    coverCard.classList.toggle('previewing', !!sp);
    coverSub.textContent = sp ? `Previewing “${store.splitName(sp)}”. Click it to load it.` : coverHint;
    paint(sp ? coverage(sp.days) : cov);
  } });
  const left = h('div', { class: 'split-left' }, coverCard, cards.el);
  // the left column follows you down the page, as long as it fits on the screen
  const stick = () => left.classList.toggle('stick', left.offsetHeight <= innerHeight - 100);
  const ro = new ResizeObserver(stick);
  ro.observe(left);
  addEventListener('resize', stick);

  // ---------- days ----------
  const lanes = h('div', { class: 'lanes' });
  const empty = h('div', { class: 'split-empty' });
  const daysCard = h('section', { class: 'glass days enter', style: { '--i': 2 } }, empty, lanes);
  const covList = h('div', { class: 'cov-cols' });
  const covScope = h('span', { class: 'chip scope' }), covSub = h('div', { class: 'sub' });
  // Optimize sets: proposes sets per exercise from what each muscle gets; you choose what to apply
  const optBtn = h('button', { class: 'btn sm opt-btn', type: 'button', title: 'Propose how many sets each exercise gets, from the sets each muscle gets. Nothing changes until you apply it.', onclick: () => openOptimize() }, icon('sliders'), 'Optimize sets');
  const covCard = h('section', { class: 'glass cov-card enter', style: { '--i': 3 } },
    h('div', { class: 'cover-head' }, h('div', { class: 'ss-t' }, 'By muscle'), covScope, covSub, optBtn),
    covList);

  const summary = h('div', { class: 'sub' });
  const clearBtn = confirmButton('Clear split', 'trash', () => { const undo = store.clearSplit(); toast('Split cleared. Your favorites and log are untouched.', { label: 'Undo', fn: undo }); });
  root.replaceChildren(
    h('div', { class: 'page-head enter' },
      h('div', null, h('h1', { class: 'display' }, 'Split'), summary),
      h('div', { class: 'head-actions' }, clearBtn)),
    h('div', { class: 'split-grid' }, left, h('div', { class: 'split-right' }, daysCard, covCard)),
    tip);

  // ---------- an exercise in a day ----------
  function itemMenu(anchor, di, item) {
    const e = cat.exOr(item.ex);
    popover(anchor, close => {
      const n = h('b', { class: 'num' }, String(item.sets));
      const step = d => { store.setItemSets(di, item.id, item.sets + d); n.textContent = String(store.get().days[di].items.find(it => it.id === item.id)?.sets ?? item.sets); item = store.get().days[di].items.find(it => it.id === item.id) || item; };
      const dayButtons = copy => h('div', { class: 'daypick' }, store.get().days.map((d, i) => h('button', {
        type: 'button', class: d.items.length ? 'used' : '', disabled: i === di, title: store.dayLabel(i),
        onclick: () => { close(); store.moveItem(di, item.id, i, { copy }); },
      }, String(i + 1))));
      return h('div', { class: 'item-menu' },
        h('div', { class: 'head' }, e.name),
        h('div', { class: 'im-row' }, h('span', null, 'Sets'), h('div', { class: 'stepper' },
          h('button', { type: 'button', class: 'btn xs icon-btn', 'aria-label': 'Fewer sets', onclick: () => step(-1) }, icon('minus')), n,
          h('button', { type: 'button', class: 'btn xs icon-btn', 'aria-label': 'More sets', onclick: () => step(1) }, icon('plus')))),
        h('div', { class: 'im-row' }, h('span', null, 'Move to'), dayButtons(false)),
        h('div', { class: 'im-row' }, h('span', null, 'Copy to'), dayButtons(true)),
        h('div', { class: 'sep' }),
        h('button', { class: 'opt', type: 'button', onclick: () => { close(); ctx.openExercise(e.id); } }, icon('info'), h('span', null, 'View details and progress')),
        h('button', { class: 'opt danger', type: 'button', onclick: () => { close(); removeItem(di, item); } }, icon('trash'), h('span', null, `Remove from ${store.dayLabel(di)}`)));
    }, { width: 336, className: 'item-pop' });
  }
  // ---------- a whole day ----------
  function dayMenu(anchor, di) {
    const plural = n => `${n} ${n === 1 ? 'exercise' : 'exercises'}`;
    popover(anchor, close => h('div', { class: 'item-menu' },
      h('div', { class: 'head' }, full(di)),
      h('div', { class: 'im-row' }, h('span', null, 'Copy to'), h('div', { class: 'daypick' }, store.get().days.map((d, i) => h('button', {
        type: 'button', class: d.items.length ? 'used' : '', disabled: i === di,
        title: i === di ? null : d.items.length ? `${full(i)}: keeps what it has and gains the rest` : `${full(i)}: empty`,
        onclick: () => {
          close();
          const r = store.copyDay(di, i);
          toast(r.added ? `Copied ${plural(r.added)} from ${full(di)} to ${full(i)}${r.skipped ? `, ${r.skipped} already there` : ''}` : `${full(i)} already has everything in ${full(di)}`, { label: 'Undo', fn: r.undo });
        },
      }, String(i + 1))))),
      h('div', { class: 'im-note' }, 'Copies every exercise with its sets. A day that already has exercises keeps them and gains the ones it’s missing.'),
      h('div', { class: 'sep' }),
      shown.size === 1 && shown.has(di)
        ? h('button', { class: 'opt', type: 'button', onclick: () => { close(); showAll(); } }, icon('body'), h('span', null, 'Show the whole split on the model'))
        : h('button', { class: 'opt', type: 'button', onclick: () => { close(); showOnly(di); } }, icon('body'), h('span', null, `Show only ${full(di)} on the model`)),
      h('button', { class: 'opt danger', type: 'button', onclick: () => { close(); const was = full(di); const undo = store.clearDay(di); toast(`Cleared ${was}`, { label: 'Undo', fn: undo }); } }, icon('trash'), h('span', null, `Clear ${full(di)}`))),
    { width: 336, className: 'item-pop' });
  }

  function removeItem(di, item) {
    const undo = store.removeItem(di, item.id);
    toast(`Removed ${cat.exOr(item.ex).name} from ${store.dayLabel(di)}`, { label: 'Undo', fn: undo });
  }

  function lane(day, di) {
    const total = day.items.reduce((a, it) => a + (it.sets || 0), 0);
    const name = h('input', { class: 'day-name', value: day.name, placeholder: day.items.length ? 'Name this day' : 'Rest / unused', maxLength: 24, 'aria-label': `Name for day ${di + 1}`,
      oninput: () => store.setDayName(di, name.value) });
    const add = h('button', { class: 'lane-add', type: 'button', 'aria-label': `Add exercises to day ${di + 1}`, title: 'Add exercises',
      onclick: () => openPicker(add, { day: di, onDetails: ctx.openExercise }) }, icon('plus'), day.items.length ? null : 'Add exercises');
    const units = h('div', { class: 'lane-units' }, day.items.map(item => {
      const e = cat.exOr(item.ex);
      const btn = unit(e, { size: 60, sets: item.sets, onClick: () => itemMenu(btn, di, item) });
      const wrap = h('div', { class: 'bx-wrap', draggable: !isTouch(), 'data-zones': [...e.p, ...e.s].join(' '), 'data-id': item.id },
        btn,
        h('button', { class: 'rx', type: 'button', title: `Remove from ${store.dayLabel(di)}`, 'aria-label': `Remove ${e.name}`, onclick: () => removeItem(di, item) }, icon('x')));
      wrap.addEventListener('mouseenter', () => map.preview(e));
      wrap.addEventListener('mouseleave', () => map.preview(null));
      wrap.addEventListener('dragstart', ev => { drag = { di, id: item.id }; wrap.classList.add('dragging'); ev.dataTransfer.effectAllowed = 'copyMove'; ev.dataTransfer.setData('text/plain', e.name); closePop(); });
      wrap.addEventListener('dragend', () => { drag = null; wrap.classList.remove('dragging'); root.querySelectorAll('.lane.over, .bx-wrap.before').forEach(x => x.classList.remove('over', 'before')); });
      wrap.addEventListener('dragover', ev => { if (!drag || drag.id === item.id) return; ev.preventDefault(); wrap.classList.add('before'); });
      wrap.addEventListener('dragleave', () => wrap.classList.remove('before'));
      wrap.addEventListener('drop', ev => { if (!drag) return; ev.preventDefault(); ev.stopPropagation(); store.moveItem(drag.di, drag.id, di, { before: item.id, copy: ev.ctrlKey || ev.metaKey }); });
      return wrap;
    }), add);
    const more = h('button', { class: 'btn xs ghost icon-btn lane-more', type: 'button', title: 'Copy this whole day to another day, or clear it', 'aria-label': `Menu for day ${di + 1}`,
      onclick: () => dayMenu(more, di) }, icon('copy'));
    const el = h('div', { class: `lane${day.items.length ? '' : ' empty-lane'}${shown.has(di) ? ' shown' : ''}`, 'data-day': di },
      h('div', { class: 'lane-label' },
        h('div', { class: 'ln' }, `Day ${di + 1}`, day.items.length ? more : null), name,
        h('div', { class: 'lc' }, day.items.length ? [h('b', null, day.items.length), h('span', null, `${day.items.length === 1 ? 'exercise' : 'exercises'} · ${total} sets`)] : null)),
      units);
    // a click on the row itself (not on a tile, a button or the name) shows or hides this day on the model
    el.addEventListener('click', ev => { if (!ev.target.closest('button, input, .bx-wrap')) toggleDay(di); });
    el.addEventListener('dragover', ev => { if (!drag) return; ev.preventDefault(); ev.dataTransfer.dropEffect = ev.ctrlKey || ev.metaKey ? 'copy' : 'move'; el.classList.add('over'); });
    el.addEventListener('dragleave', ev => { if (!el.contains(ev.relatedTarget)) el.classList.remove('over'); });
    el.addEventListener('drop', ev => { if (!drag) return; ev.preventDefault(); store.moveItem(drag.di, drag.id, di, { copy: ev.ctrlKey || ev.metaKey }); });
    return el;
  }

  function update() {
    const st = store.get();
    if (st.active !== lastSplit) { lastSplit = st.active; shown.clear(); }
    cards.update();
    // a day that has been emptied can't stay picked
    [...shown].forEach(i => { if (!st.days[i].items.length) shown.delete(i); });
    const whole = coverage(st.days);
    // the days not shown keep their place, so "Day 5" still means day 5 in the coverage notes
    cov = filtered() ? coverage(st.days.map((d, i) => (shown.has(i) ? d : { ...d, items: [] }))) : whole;
    paint(previewing ? coverage(previewing.days) : cov);

    showRow.replaceChildren(
      h('span', { class: 'lbl' }, 'Show'),
      h('button', { class: 'all', type: 'button', 'aria-pressed': String(!filtered()), onclick: showAll }, 'Whole split'),
      h('div', { class: 'daypick' }, st.days.map((d, i) => h('button', {
        type: 'button', class: d.items.length ? 'used' : '', disabled: !d.items.length, 'aria-pressed': String(shown.has(i)), 'aria-label': `Show ${full(i)}`,
        title: d.items.length ? `${full(i)}: ${shown.has(i) ? 'showing, click to hide' : 'click to show it on the model'}` : `${full(i)}: empty`,
        onclick: () => toggleDay(i),
      }, String(i + 1)))));
    lanes.classList.toggle('filtering', filtered());
    covScope.hidden = !filtered();
    covScope.textContent = filtered() ? `${shownLabel()} only` : '';
    covSub.textContent = filtered()
      ? 'How often each muscle is trained directly on the days shown, and how many sets it gets there (a lift that only helps counts half).'
      : 'How often each muscle is trained directly per pass through the split, and how many sets it gets (a lift that only helps counts half).';

    // keep whatever day name is being typed
    const focused = document.activeElement && document.activeElement.classList.contains('day-name') ? document.activeElement.closest('.lane')?.dataset.day : null;
    const caret = focused != null ? document.activeElement.selectionStart : 0;
    lanes.replaceChildren(...st.days.map(lane));
    if (focused != null) { const inp = lanes.querySelector(`.lane[data-day="${focused}"] .day-name`); if (inp) { inp.focus(); inp.setSelectionRange(caret, caret); } }

    const count = st.days.reduce((a, d) => a + d.items.length, 0);
    const training = st.days.filter(d => d.items.length).length;
    const ms = cat.muscles();
    const twice = ms.filter(m => (whole.get(m.id)?.direct || 0) >= 2).length, missed = ms.filter(m => !whole.get(m.id)?.direct);
    summary.replaceChildren(h('b', { class: 'split-name' }, store.splitName(store.activeSplit())), ' · ', ...(count ? [h('b', null, training), ` training ${training === 1 ? 'day' : 'days'} · `, h('b', null, count), ` exercises · `, h('b', null, twice), ` of ${ms.length} muscles hit directly twice or more`,
      missed.length ? ` · ${missed.length} with no direct work` : ''] : ['Eight slots. Fill the days you train and leave the rest empty.']));
    clearBtn.disabled = !count;
    optBtn.disabled = !count;

    empty.hidden = !!count;
    if (!count) empty.replaceChildren(...[
      h('div', { class: 'display' }, 'Nothing planned yet'),
      h('div', { class: 'sub' }, 'Add exercises with + on a day, or tap a muscle on the model to see what trains it. Anything you add is also kept in your Favorites.'),
      store.isEmpty() ? h('button', { class: 'btn sm', type: 'button', onclick: () => { const undo = loadSample(); toast('Example split and eight weeks of made-up sessions loaded.', { label: 'Undo', fn: undo }); } }, icon('body'), 'Load an example to look around') : null].filter(Boolean));

    if (picking) requestAnimationFrame(() => spotlight(picking));

    covList.replaceChildren(...cat.groups().map(g => h('div', { class: 'cov-group' },
      h('div', { class: 'eyebrow' }, g),
      cat.muscles().filter(m => m.group === g).map(m => {
        const c = cov.get(m.id);
        const row = h('button', { class: `cov-row${c && c.direct ? '' : ' none'}`, type: 'button', 'data-z': m.id, title: `Find exercises for ${m.name.toLowerCase()}`,
          onclick: e => pickFor(m.id, e, row) },
          h('i', { class: 'sw', style: { background: c ? heat(c.score) : null } }),
          h('span', { class: 'nm' }, m.name),
          h('span', { class: 'fq num' }, c ? (c.direct ? `${c.direct}×` : 'helped') : '—'),
          h('span', { class: 'st num' }, c ? sets(c.sets) : ''));
        row.addEventListener('mouseenter', () => map.select(m.id));
        row.addEventListener('mouseleave', () => map.select(picking));
        return row;
      }))));
  }

  update();
  return { update, unmount() { tip.remove(); ro.disconnect(); removeEventListener('resize', stick); } };
}
