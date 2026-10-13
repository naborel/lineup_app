// Exercise details (the side sheet): what it is and what it trains, where it sits in your split,
// and your progress on it so far: charts, numbers and the session history.
import { h, icon, fmt, fmtDate, num, autosize } from '../util.js';
import { openSheet, closeSheet, toast, confirmButton } from '../ui.js';
import * as store from '../store.js';
import * as cat from '../catalog.js';
import { frame } from '../tiles.js';
import { bodyMap } from '../body.js';
import { heat, helpedColour, setsLabel, repsText } from '../metrics.js';
import { lineChart, comboChart, comboKey } from '../charts.js';
import { series, bestLabel, volumeTrend, trendText, volumePoints, bestPoints, deltaChip, bestEver, setText, repsLabel, repsTitle, repsChip, avgWeightPoints, totalRepsPoints } from '../progress.js';

export function showExercise(id, ctx) {
  const e = cat.exOr(id);
  const placing = h('div');
  const progress = h('div');
  const history = h('div');

  // ----- static parts -----
  const map = bodyMap({ cls: 'mini' });
  map.paint(new Map([...e.p.map(z => [z, heat(2)]), ...e.s.map(z => [z, helpedColour()])]));
  const p0 = cat.photo(e, 0), p1 = cat.photo(e, 1);
  const photo = p0 ? h('div', { class: 'photo', title: 'Start and finish positions' },
    h('img', { src: p0, alt: `${e.name}: start position`, loading: 'lazy', onerror: () => photo.remove() }),
    p1 ? h('img', { class: 'b', src: p1, alt: `${e.name}: end position`, loading: 'lazy', onerror: ev => ev.target.remove() }) : null) : null;
  // two kinds of note: a one-line cue that shows on the Track card, and longer notes that stay here
  let cueEdited = false;
  const cueCount = h('span', { class: 'num' });
  const countCue = () => { cueCount.textContent = `${cueIn.value.length}/${store.CUE_MAX}`; };
  const cueIn = h('input', { class: 'input cue-in', value: store.cue(id), maxLength: store.CUE_MAX, spellcheck: false, 'aria-label': 'Cue',
    placeholder: 'A short cue, e.g. close-grip MAG handle · elbows to hips',
    oninput: () => { cueEdited = true; countCue(); store.setCue(id, cueIn.value, { silent: true }); },
    onchange: () => { cueEdited = false; store.setCue(id, cueIn.value); },
    onkeydown: ev => { if (ev.key === 'Enter') cueIn.blur(); } });
  countCue();
  const note = h('textarea', { class: 'note-body', rows: 1, placeholder: 'Longer notes: seat height, setup, what worked, what to try next…', value: store.get().notes[id] || '', oninput: () => store.setNote(id, note.value) });
  autosize(note);
  const chips = (zones, cls) => zones.map(z => h('span', { class: `chip ${cls}` }, h('i', { class: 'sw', style: { background: cls === 'pri' ? heat(2) : helpedColour() } }), cat.muscle(z).name));

  const renderPlacing = () => {
    const pl = store.placements(id), isFav = store.isFavorite(id);
    const days = h('div', { class: 'daypick' }, store.get().days.map((d, i) => h('button', {
      type: 'button', class: d.items.length ? 'used' : '', 'aria-pressed': String(store.inDay(i, id)), title: store.dayLabel(i),
      onclick: () => { if (store.inDay(i, id)) store.removeFromDay(i, id); else store.addToDay(i, id); },
    }, String(i + 1))));
    placing.replaceChildren(
      h('div', { class: 'sheet-actions' },
        pl.length ? h('span', { class: 'chip good' }, icon('check'), `In your split · ${pl.map(p => store.dayLabel(p.di)).join(', ')}`)
          : store.loggedIds().has(id) ? h('span', { class: 'chip muted' }, icon('archive'), 'Archived · not in your split')
          : h('span', { class: 'chip muted' }, 'Not in your split'),
        e.gone ? null : h('button', { class: `btn sm${isFav ? '' : ' primary'}`, type: 'button', disabled: isFav && pl.length > 0, title: isFav && pl.length ? 'It’s in your split, so it stays a favorite' : null,
          onclick: () => store.toggleFavorite(id) }, icon(isFav ? 'starFill' : 'star'), isFav ? 'One of your favorites' : 'Add to your favorites'),
        e.gone ? null : h('button', { class: 'btn sm', type: 'button', title: 'A copy under a new name, tracked on its own: another grip, a particular machine', onclick: () => editCustom(null, ctx, { from: id }) }, icon('copy'), 'Make a variation'),
        e.custom ? h('button', { class: 'btn sm', type: 'button', onclick: () => editCustom(id, ctx) }, icon('note'), 'Edit') : null,
        e.gone ? null : sideToggle()),
      e.gone ? h('span') : h('div', { class: 'im-row' }, h('span', null, 'Days'), days));
  };

  // single arm / single leg: on, each set on Track is weight × right reps and left reps
  function sideToggle() {
    const on = store.isSingle(id), kind = cat.sideKind(e);
    return h('button', { class: `btn sm side-tog${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on),
      title: on ? `Logged one ${kind} at a time: weight × right reps and left reps for each set. Click if it works both ${kind}s together.`
        : `Click if this works one ${kind} at a time: each set gets right and left reps.`,
      onclick: () => store.setSingle(id, !on) },   // the sheet redraws on any change
      on ? icon('check') : null, `Single ${kind}`);
  }

  const renderProgress = () => {
    const ser = series(id);
    if (!ser.length) {
      progress.replaceChildren(h('div', { class: 'eyebrow' }, 'Your progress'),
        h('div', { class: 'lead-card' }, h('div', null, h('b', null, 'Nothing logged yet'), h('div', { class: 'sub' }, 'Enter sets on the Track page and the charts fill in here.')),
          h('button', { class: 'btn sm', type: 'button', onclick: () => { closeSheet(); ctx.go('track'); } }, 'Track')));
      history.replaceChildren();
      return;
    }
    const last = ser[ser.length - 1], prev = ser[ser.length - 2], first = ser[0];
    const top = bestEver(ser);
    const weighted = last.st.weighted, anyWeight = ser.some(x => x.st.weighted), u = store.unit();
    // the session's work in its two halves: average weight (left axis) × total reps (right axis) = volume.
    // Both centred on one scale of change, so their rises add up to the volume's rise. Every session is
    // connected: when the weight goes up and the reps come down, both lines show it at once.
    const w1 = v => num(Math.round(v * 10) / 10);
    const lines = anyWeight ? [
      { key: 'w', side: 'left', color: 'var(--series)', ticks: 'values', flatAt: 36, format: w1, points: avgWeightPoints(ser) },
      { key: 'r', side: 'right', color: '#e3e6f2', ticks: 'range', flatAt: 64, format: v => String(Math.round(v)), points: totalRepsPoints(ser) },
    ] : [
      { key: 'r', side: 'left', color: '#e3e6f2', ticks: 'range', format: v => String(Math.round(v)), points: totalRepsPoints(ser) },
    ];
    const tipOf = i => {
      const x = ser[i];
      return [h('b', null, setsLabel(x.entry)), h('span', null, fmtDate(x.date, { year: true })),
        h('em', null, x.st.weighted ? `avg ${w1(x.st.avgW)} ${u} × ${x.st.reps} reps = ${fmt.format(Math.round(x.st.volume))} ${u}` : `${x.st.reps} reps`)];
    };
    progress.replaceChildren(...[
      h('div', { class: 'eyebrow' }, 'Your progress', h('span', null, `${ser.length} ${ser.length === 1 ? 'session' : 'sessions'} since ${fmtDate(first.date, { year: true })}`)),
      // the same story as the Track card, plus reps at the working weight (the last session itself is in History)
      h('div', { class: 'stat-tiles' },
        h('div', { title: `Heaviest weight and the most reps at it. Set on ${fmtDate(top.date, { year: true })}` }, h('span', null, `Best set · ${fmtDate(top.date)}`), h('b', null, setText(top.st))),
        (() => {
          const tr = volumeTrend(ser), t = tr && trendText(tr);
          return h('div', { title: !tr ? 'Which way your work is going, once there are two sessions' : tr.k === 1 ? 'Volume last time against the time before' : `Average volume of your last ${tr.k} sessions against the ${tr.k} before them` },
            h('span', null, `${weighted ? 'Volume' : 'Reps'} trend`),
            t ? h('b', { class: `trend ${t.dir}` }, icon(t.dir), t.text) : h('b', { class: 'trend none' }, '—'));
        })(),
        h('div', { title: `${last.st.work.sets.join(', ')} on ${fmtDate(last.date, { year: true })}` }, h('span', null, repsTitle(last.st)), h('b', null, repsLabel(last.st))),
        h('div', null, h('span', null, weighted ? 'Est. 1RM now' : 'Top reps now'), h('b', null, bestLabel(last.st)))),
      h('div', { class: 'chart-block' },
        h('div', { class: 'chart-head' }, h('span', { class: 'h-section' }, anyWeight ? 'Weight and reps' : 'Reps'),
          h('span', { class: 'sub' }, anyWeight ? 'average weight per rep, and total reps, each session' : 'reps in each session'),
          repsChip(prev, last)),
        anyWeight ? comboKey([['w', `Average weight (${u})`, 'left'], ['r', 'Total reps', 'right']]) : null,
        comboChart(ser.map(x => x.date), lines, { tipOf, height: anyWeight ? 190 : 150 }),
        anyWeight ? h('p', { class: 'combo-note' }, 'Average weight × total reps = volume (the next chart). Both lines share one scale of change.') : null),
      // volume: the simplest "am I doing more work" line, even while the weight stays put (bodyweight lifts already have it above)
      anyWeight ? h('div', { class: 'chart-block' },
        h('div', { class: 'chart-head' }, h('span', { class: 'h-section' }, 'Volume'), h('span', { class: 'sub' }, `weight × reps, all sets: the work you did (${u})`),
          prev ? deltaChip(prev.st.volume, last.st.volume) : null),
        lineChart(volumePoints(ser))) : null,
      h('div', { class: 'chart-block' },
        h('div', { class: 'chart-head' }, h('span', { class: 'h-section' }, weighted ? 'Est. 1RM' : 'Most reps'), h('span', { class: 'sub' }, weighted ? `each session’s strongest set as a one-rep max (${store.unit()})` : 'most reps in one set'),
          prev ? deltaChip(prev.st.best.e1, last.st.best.e1) : null),
        lineChart(bestPoints(ser)))].filter(Boolean));   // no volume chart for bodyweight lifts

    history.replaceChildren(
      h('div', { class: 'eyebrow' }, 'History', h('button', { class: 'link', type: 'button', onclick: () => { closeSheet(); ctx.goTable(id); } }, 'Edit in the table')),
      h('table', { class: 'hist' },
        h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, 'Sets'), h('th', { class: 'n' }, 'Reps'), h('th', { class: 'n' }, weighted ? 'Est. 1RM' : 'Top reps'), h('th', null))),
        h('tbody', null, [...ser].reverse().map((x, i, arr) => {
          const before = arr[i + 1];
          return h('tr', null,
            h('td', null, fmtDate(x.date, { year: true })),
            h('td', { class: 'num' }, setsLabel(x.entry)),
            h('td', { class: 'n num', title: x.st.work.w ? `Reps at ${num(x.st.work.w)}` : 'Reps' }, x.st.work.reps, before ? repsChip(before, x) : null),
            h('td', { class: 'n num' }, x.st.weighted ? fmt.format(Math.round(x.st.best.e1)) : repsText(x.st.best)),
            h('td', { class: 'act' }, h('button', { class: 'btn xs ghost icon-btn danger', type: 'button', title: 'Delete this session', 'aria-label': `Delete the session on ${fmtDate(x.date)}`,
              onclick: () => { const undo = store.deleteEntry(x.entry.id); toast(`Deleted ${e.name} on ${fmtDate(x.date)}`, { label: 'Undo', fn: undo }); } }, icon('trash'))));
        }))));
  };

  const body = h('div', null,
    h('div', { class: 'sheet-hero' }, frame(e, { size: 92 }),
      h('div', null, h('h3', null, e.name), h('div', { class: 'meta' }, cat.meta(e)),
        e.variantOf ? h('div', { class: 'meta origin' }, 'Variation of ', h('button', { class: 'link', type: 'button', onclick: () => showExercise(e.base, ctx) }, e.variantOf), ': same description and photos, its own history.')
          : e.custom ? h('div', { class: 'meta origin' }, 'Your own exercise.')
          : e.auto ? h('div', { class: 'meta origin', title: 'Worked out by rule from the source database’s broad muscle groups and the name. Nobody has checked it.' }, icon('info'), 'Muscles mapped automatically. If they look wrong, make a variation and correct them.') : null)),
    placing,
    h('section', { class: 'cue-notes' },
      h('div', { class: 'eyebrow' }, 'Cue', h('span', null, 'one line, shown on the Track card · ', cueCount)),
      h('label', { class: 'cue-field' }, icon('note'), cueIn),
      h('div', { class: 'eyebrow' }, 'Notes', h('span', null, 'longer notes, kept here')),
      note),
    h('section', null, progress),
    h('section', null, history),
    h('section', null,
      h('div', { class: 'eyebrow' }, 'What it trains'),
      h('div', { class: 'trains' }, map.el,
        h('div', { class: 'trains-list' },
          h('div', { class: 'k' }, 'Directly'), h('div', { class: 'chips' }, chips(e.p, 'pri')),
          e.s.length ? [h('div', { class: 'k' }, 'Also helps (counts half)'), h('div', { class: 'chips' }, chips(e.s, 'sec'))] : null))),
    photo ? h('section', null, h('div', { class: 'eyebrow' }, 'The movement', h('span', null, e.variantOf ? `start and finish · shown for ${e.variantOf}` : 'start and finish')), photo) : null,
    e.how.length ? h('section', null, h('div', { class: 'eyebrow' }, 'How to do it'), h('ol', { class: 'howto' }, e.how.map(t => h('li', null, t)))) : null);

  const redraw = () => { renderPlacing(); renderProgress(); };
  redraw();
  const unsub = store.subscribe(redraw);
  // closing the sheet mid-edit still updates the Track card
  openSheet(body, { onClose: () => { unsub(); if (cueEdited) store.setCue(id, cueIn.value); } });
}

// ---------- custom exercises ----------
/**
 * The editor for your own exercises. Three ways in:
 *   editCustom(id)                 change one of yours
 *   editCustom(null)               a new one from scratch
 *   editCustom(null, ctx, {from})  a variation of an existing lift: starts with its type and muscles, and keeps its
 *                                  description and photos by remembering which catalog lift it came from (base)
 */
export function editCustom(id, ctx, { from = null } = {}) {
  const cur = id ? cat.ex(id) : null;
  const src = !id && from ? cat.ex(from) : null;
  const like = cur || src;
  const def = like ? { name: cur ? cur.name : '', eq: like.eq, kind: like.kind, mech: like.mech || 'compound', p: [...like.p], s: [...like.s] } : { name: '', eq: 'machine', kind: 'push', mech: 'compound', p: [], s: [] };
  // a variation of a variation still points at the original catalog lift
  const base = cur ? cur.base || null : src ? (src.custom ? src.base || null : src.id) : null;
  const baseName = base && cat.ex(base) ? cat.ex(base).name : null;
  const name = h('input', { class: 'input wide', value: def.name, placeholder: src ? `Name it, e.g. Single-Arm ${src.name}` : 'Name, e.g. Prime Incline Press', maxLength: 60, oninput: () => { def.name = name.value; sync(); } });
  const select = (key, opts) => { const el = h('select', { class: 'input select', onchange: () => { def[key] = el.value; sync(); } }, Object.entries(opts).map(([k, v]) => h('option', { value: k, selected: def[key] === k }, v))); return el; };
  const preview = h('div');
  const zones = h('div');
  const save = h('button', { class: 'btn primary', type: 'button', onclick: () => {
    const res = store.saveCustom({ id, name: def.name.trim(), eq: def.eq, kind: def.kind, mech: def.mech, p: def.p, s: def.s, ...(base ? { base } : {}) });
    toast(id ? 'Exercise updated' : `${def.name.trim()} added to your favorites`);
    showExercise(res.id, ctx);
  } }, icon('check'), id ? 'Save changes' : 'Add exercise');

  const drawZones = () => zones.replaceChildren(...cat.groups().map(g => h('div', { class: 'zone-group' }, h('div', { class: 'k' }, g),
    h('div', { class: 'chips' }, cat.muscles().filter(m => m.group === g).map(m => {
      const state = def.p.includes(m.id) ? 'pri' : def.s.includes(m.id) ? 'sec' : '';
      return h('button', { class: `chip tog ${state}`, type: 'button', title: 'Click to cycle: direct → helps → off', onclick: () => {
        def.p = def.p.filter(z => z !== m.id); def.s = def.s.filter(z => z !== m.id);
        if (state === '') def.p.push(m.id); else if (state === 'pri') def.s.push(m.id);
        drawZones(); sync();
      } }, state ? h('i', { class: 'sw', style: { background: state === 'pri' ? heat(2) : helpedColour() } }) : null, m.name, state === 'sec' ? h('small', null, 'helps') : null);
    })))));
  function sync() {
    // a name that already exists would give two tiles you can't tell apart
    const taken = cat.all().some(x => x.id !== id && x.name.trim().toLowerCase() === def.name.trim().toLowerCase());
    save.disabled = !def.name.trim() || !def.p.length || taken;
    save.title = taken ? 'Another exercise already has this name' : '';
    preview.replaceChildren(def.p.length ? frame({ id: 'preview', ...def }, { size: 92 }) : h('div', { class: 'xf blank', style: { '--sz': '92px' } }));
  }
  drawZones(); sync();

  openSheet(h('div', null,
    h('div', { class: 'sheet-hero' }, preview, h('div', null, h('h3', null, id ? 'Edit exercise' : src ? 'New variation' : 'New exercise'),
      h('div', { class: 'meta' }, baseName ? `Based on ${baseName}. It keeps that lift’s description and photos and is tracked on its own.`
        : src ? `Starts from ${src.name}’s muscles. Tracked on its own.` : 'For a machine or lift the catalog doesn’t have'))),
    h('section', null, h('div', { class: 'eyebrow' }, 'Name'), name),
    h('section', null, h('div', { class: 'eyebrow' }, 'Type'),
      h('div', { class: 'form-row' }, select('eq', cat.EQ), select('kind', cat.KIND), select('mech', { compound: 'Compound', isolation: 'Isolation' }))),
    h('section', null, h('div', { class: 'eyebrow' }, 'Muscles', h('span', null, 'click once for direct, twice for helps')), zones),
    h('div', { class: 'sheet-actions' }, save,
      id ? confirmButton('Delete exercise', 'trash', () => { const undo = store.deleteCustom(id); closeSheet(); toast('Exercise deleted. Its logged sessions are kept.', { label: 'Undo', fn: undo }); }) : null)));
  if (!id) name.focus();
}
