// Trends: how every muscle group is progressing, across all of its exercises.
// With 40 exercises nobody can read 40 sets of charts, so this page answers one question per muscle: am I getting
// stronger here? Each exercise is measured against itself (its Est. 1RM and its volume, as a percentage), and a
// muscle's trend is the average of the exercises that train it directly (helpers are left out). The body turns
// green where you're getting stronger and amber where you're not; click a group or a muscle for the exercises.
import { h, icon, seg, fmtDate } from '../util.js';
import { openSheet } from '../ui.js';
import * as store from '../store.js';
import * as cat from '../catalog.js';
import { bodyMap } from '../body.js';
import { sparkline, lineChart } from '../charts.js';
import { exerciseTrends, trendFor, readTrend, trendColour, WINDOWS, windowOf } from '../trends.js';
import { exerciseRow } from '../picker.js';

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
// what to say when a muscle or group has no trend: nothing logged, or only exercises that help it
const emptyText = t => t && t.helpers ? `No direct exercise · ${t.helpers} ${t.helpers === 1 ? 'helps' : 'help'}` : 'No sessions in this window';
const chip = (pct, cls = '') => { const r = readTrend(pct); return h('span', { class: `trend ${r.dir} ${cls}` }, r.dir === 'none' ? null : icon(r.dir), r.text); };

export function mount(root, ctx) {
  let win = windowOf(store.get().prefs.trendWindow).id;
  let list = [], byZone = new Map();

  const summary = h('div', { class: 'sub' });
  const winSeg = h('div');
  const cards = h('div', { class: 'tr-groups' });
  const tip = h('div', { class: 'bm-tip' });
  const map = bodyMap({
    onPick: zone => openGroup(cat.muscle(zone).group, zone),
    onHover: (zone, e) => {
      if (!zone) { tip.classList.remove('on'); return; }
      const t = byZone.get(zone), m = cat.muscle(zone);
      const s = readTrend(t && t.strength), v = readTrend(t && t.volume);
      tip.replaceChildren(h('b', null, m.name), h('span', null, !t || !t.exercises.length ? emptyText(t) : `Strength ${s.text} · volume ${v.text} · ${plural(t.exercises.length, 'exercise')}`));
      tip.classList.add('on');
      tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 10) + 'px'; tip.style.top = (e.clientY + 16) + 'px';
    },
  });
  // the key: point at (or tap) a colour for what it means; the definition opens above the key, across its width
  const keyTip = h('div', { class: 'tr-ktip', role: 'tooltip', id: 'tr-ktip' });
  const showDef = (btn, cls, label, def) => {
    keyTip.replaceChildren(h('b', null, h('i', { class: `sw ${cls}` }), label), h('span', null, def));
    keyTip.classList.add('on');
    for (const k of btn.parentNode.querySelectorAll('.key')) k.classList.toggle('on', k === btn);
  };
  const hideDef = btn => { keyTip.classList.remove('on'); btn.classList.remove('on'); };
  const key = (cls, label, def) => h('button', {
    class: 'key', type: 'button', 'data-k': cls, 'aria-describedby': 'tr-ktip',
    onmouseenter: e => showDef(e.currentTarget, cls, label, def), onfocus: e => showDef(e.currentTarget, cls, label, def),
    onmouseleave: e => { if (!e.currentTarget.matches(':focus-visible')) hideDef(e.currentTarget); },
    onblur: e => { if (!e.currentTarget.matches(':hover')) hideDef(e.currentTarget); },
    onkeydown: e => { if (e.key === 'Escape') e.currentTarget.blur(); },
  }, h('i', { class: `sw ${cls}` }), h('span', null, label));
  const bodyCard = h('section', { class: 'glass cover tr-body enter', style: { '--i': 1 } },
    h('div', { class: 'cover-head' }, h('div', { class: 'ss-t' }, 'Strength by muscle'), h('div', { class: 'sub' }, 'Click a muscle for the exercises behind it')),
    map.el,
    h('div', { class: 'tr-legend' }, keyTip,
      key('up', 'Getting stronger', 'Est. 1RM is up 1% or more, averaged over the exercises that train this muscle directly: your last few sessions in the window against your first few. The brighter the green, the bigger the gain (full colour at +10%).'),
      key('flat', 'Steady', 'Within 1% either way: you’re holding your strength. Common during a cut or a deload week, or once a lift gets hard to add to.'),
      key('down', 'Weaker', 'Est. 1RM is down 1% or more. Poor sleep, a deload or a missed week can do it; worth a look if it lasts several weeks. The brighter the amber, the bigger the drop (full colour at −10%).'),
      key('none', 'No direct work', 'Nothing in this window trains this muscle as its main muscle, or not enough to compare yet (an exercise needs two sessions). Exercises that only help it, like rows for the biceps, don’t count here.')));

  root.replaceChildren(
    h('div', { class: 'page-head enter' },
      h('div', null, h('h1', { class: 'display' }, 'Trends'), summary),
      h('div', { class: 'head-actions' }, winSeg)),
    h('div', { class: 'tr-grid' }, h('div', { class: 'tr-left' }, bodyCard),
      h('div', { class: 'tr-right' }, cards,
        h('p', { class: 'tr-note' }, 'Each exercise is measured against itself: its Est. 1RM (strength) and weight × reps (volume), the average of its last few sessions in the window against its first few. A muscle’s trend averages the exercises that train it directly. Ones that only help (rows for the biceps, presses for the triceps) are left out: the main muscle usually decides when the set ends, so they say little about the helper.'))),
    tip);

  function groupCard(g) {
    const t = trendFor(list, cat.groupKey(g)), n = t.exercises.length;
    const s = readTrend(t.strength);
    return h('button', { class: `glass tr-card ${s.dir}`, type: 'button', 'data-group': g, onclick: () => openGroup(g) },
      h('div', { class: 'tr-top' }, h('span', { class: 'tr-name' }, g), h('span', { class: 'tr-n' }, n ? plural(n, 'exercise') : '')),
      n ? [
        h('div', { class: 'tr-main' }, h('span', { class: 'k' }, 'Strength'), chip(t.strength, 'big'), t.index.length > 1 ? sparkline(t.index) : h('span')),
        h('div', { class: 'tr-sub' }, h('span', { class: 'k' }, 'Volume'), chip(t.volume)),
      ] : h('div', { class: 'tr-empty' }, emptyText(t)));
  }

  function openGroup(g, focus = null) {
    const t = trendFor(list, cat.groupKey(g));
    const w = windowOf(win);
    const sessions = t.exercises.reduce((a, x) => a + x.sessions, 0);
    const zones = cat.muscles().filter(m => m.group === g);
    const pct = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`;
    const body = h('div', { class: 'tr-sheet' },
      h('div', { class: 'sheet-hero tr-hero' }, h('div', null, h('h3', null, g),
        h('div', { class: 'meta' }, `${plural(t.exercises.length, 'exercise')} · ${w.days ? `last ${w.label}` : 'everything you’ve logged'}`))),
      h('div', { class: 'stat-tiles' },
        h('div', null, h('span', null, 'Strength'), chip(t.strength)),
        h('div', null, h('span', null, 'Volume'), chip(t.volume)),
        h('div', null, h('span', null, 'Exercises'), h('b', null, t.exercises.length)),
        h('div', null, h('span', null, 'Sessions'), h('b', null, sessions))),
      t.index.length > 1 ? h('section', { class: 'chart-block' },
        h('div', { class: 'chart-head' }, h('span', { class: 'h-section' }, 'Strength across the group'), h('span', { class: 'sub' }, 'each exercise against where it started in this window, averaged')),
        lineChart(t.index, { format: pct })) : null,
      h('section', null, h('div', { class: 'eyebrow' }, 'Muscles'),
        h('div', { class: 'tr-muscles' }, zones.map(m => {
          const z = byZone.get(m.id), n = z ? z.exercises.length : 0;
          return h('div', { class: `tr-mrow${m.id === focus ? ' focus' : ''}`, 'data-z': m.id },
            h('i', { class: 'sw', style: { background: trendColour(z && z.strength) || 'var(--silver)' } }),
            h('span', { class: 'nm' }, m.name),
            h('span', { class: 'cnt' }, n ? plural(n, 'exercise') : z && z.helpers ? `no direct exercise · ${z.helpers} ${z.helpers === 1 ? 'helps' : 'help'}` : 'no sessions'),
            chip(z && z.strength), chip(z && z.volume, 'small'));
        }))),
      h('section', null, h('div', { class: 'eyebrow' }, 'Exercises', h('span', null, 'strength · volume')),
        t.exercises.length ? h('div', { class: 'res-list tr-ex' }, t.exercises.map((x, i) => exerciseRow(x.e, {
          i, sub: [cat.primaryLine(x.e), plural(x.sessions, 'session'), `last ${fmtDate(x.last)}`].join(' · '),
          onClick: () => ctx.openExercise(x.id),
          actions: [chip(x.strength), chip(x.volume, 'small')],
        }))) : h('div', { class: 'sub' }, t.helpers
          ? `Nothing in this window trains these muscles directly. ${plural(t.helpers, 'exercise')} ${t.helpers === 1 ? 'helps' : 'help'}, but ${t.helpers === 1 ? 'it doesn’t' : 'they don’t'} count toward the trend.`
          : 'Nothing logged for these muscles in this window.')));
    openSheet(body);
    if (focus) requestAnimationFrame(() => { const r = body.querySelector(`.tr-mrow[data-z="${focus}"]`); if (r) r.scrollIntoView({ block: 'center' }); });
  }

  function update() {
    list = exerciseTrends(win);
    byZone = new Map(cat.muscles().map(m => [m.id, trendFor(list, m.id)]));
    map.paint(new Map([...byZone].map(([z, t]) => [z, trendColour(t.strength)])));
    winSeg.replaceChildren(seg(WINDOWS.map(x => ({ value: x.id, label: x.label })), win, v => { win = v; store.setPref('trendWindow', v); update(); }, 'small'));
    cards.replaceChildren(...cat.groups().map(groupCard));
    const gs = cat.groups().map(g => readTrend(trendFor(list, cat.groupKey(g)).strength).dir);
    const up = gs.filter(d => d === 'up').length, down = gs.filter(d => d === 'down').length, flat = gs.filter(d => d === 'flat').length;
    summary.replaceChildren(...(list.length
      ? [h('b', null, up), ` of ${gs.length} muscle groups getting stronger`, flat ? [' · ', h('b', null, flat), ' steady'] : '', down ? [' · ', h('b', null, down), ' weaker'] : '',
        ` · ${plural(list.length, 'exercise')} with sessions${windowOf(win).days ? ` in the last ${windowOf(win).label}` : ''}`].flat()
      : ['Log a couple of sessions of an exercise on Track and its muscles start showing a trend here.']));
  }

  update();
  return { update, unmount() { tip.remove(); } };
}
