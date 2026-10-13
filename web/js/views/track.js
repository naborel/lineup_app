// Track: every exercise in your split with a place to enter today's sets and a read on whether it's moving.
// Exercises that have history but left the split sit in the Archive below.
import { h, icon, seg, today, addDays, fmtDate, daysAgo, num, debounce } from '../util.js';
import * as store from '../store.js';
import * as cat from '../catalog.js';
import { frame } from '../tiles.js';
import { sparkline } from '../charts.js';
import { setsLabel } from '../metrics.js';
import { series, bestLabel, bestPoints, deltaChip, bestEver, setText, volumeTrend, trendText, trendNote, rollingVolumePoints } from '../progress.js';

export function mount(root, ctx) {
  let filter = 'all', date = today();

  const summary = h('div', { class: 'sub' });
  const dateInput = h('input', { class: 'input date', type: 'date', value: date, max: '2099-12-31', 'aria-label': 'Session date', onchange: () => { if (dateInput.value) { date = dateInput.value; update(); } } });
  const dateNote = h('span', { class: 'sub date-note' });
  const shift = n => { date = addDays(date, n); dateInput.value = date; update(); };
  const daySeg = h('div', { class: 'day-filter' });
  const cards = h('div', { class: 'tcards' });
  const archive = h('div');

  root.replaceChildren(
    h('div', { class: 'page-head enter' },
      h('div', null, h('h1', { class: 'display' }, 'Track'), summary),
      h('div', { class: 'head-actions date-nav' },
        h('button', { class: 'btn sm icon-btn', type: 'button', 'aria-label': 'Previous day', onclick: () => shift(-1) }, icon('arrowL')),
        dateInput,
        h('button', { class: 'btn sm icon-btn', type: 'button', 'aria-label': 'Next day', onclick: () => shift(1) }, icon('arrowR')),
        dateNote)),
    daySeg, cards, archive);

  // ---------- one exercise ----------
  function statsBlock(exId) {
    const ser = series(exId);
    const box = h('div', { class: 'tc-stats' });
    if (!ser.length) { box.append(h('div', { class: 'sub none' }, 'No sessions logged yet')); return box; }
    const last = ser[ser.length - 1], prev = ser[ser.length - 2];
    // the best set you've ever done on this lift, as you'd say it: "225 × 12" (heaviest weight, most reps at it)
    const top = bestEver(ser), fresh = top === last && ser.length > 1;
    const before = fresh ? bestEver(ser.slice(0, -1)) : null;
    box.append(
      h('button', { class: 'tc-stat best', type: 'button', title: 'Your heaviest weight on this lift and the most reps you’ve done with it. Open progress', onclick: () => ctx.openExercise(exId) },
        h('span', { class: 'k' }, 'Best set'), h('b', { class: 'num' }, setText(top.st)),
        fresh ? h('span', { class: 'delta up' }, icon('up'), 'New best') : h('span', { class: 'delta first' }, fmtDate(top.date)),
        h('span', { class: 'was num' }, fresh ? `was ${setText(before.st)}` : top === last ? 'first session' : `last ${setText(last.st)}`)),
      // which way the work is going: recent sessions' average volume against the ones before, as a percentage.
      // Nobody knows whether 4,275 lb or 19 reps is good; everybody knows what "+6%" means
      (() => {
        const tr = volumeTrend(ser), t = tr && trendText(tr), what = last.st.weighted ? 'volume (weight × reps, all sets)' : 'reps (all sets)';
        const note = trendNote(tr);
        const title = (!tr ? 'Which way your work is going, once there are two sessions.'
          : tr.k === 1 ? `Your ${what} last time against the time before.`
          : `The average ${what} of your last ${tr.k} sessions against the ${tr.k} before them, so one off day doesn't swing it.`)
          + (note ? ` ${note.title}` : '') + ' Open progress';
        return h('button', { class: 'tc-stat vol', type: 'button', title, onclick: () => ctx.openExercise(exId) },
          h('span', { class: 'k' }, last.st.weighted ? 'Volume trend' : 'Reps trend'),
          t ? h('b', { class: `num trend ${t.dir}` }, icon(t.dir), t.text) : h('b', { class: 'num trend none' }, '—'),
          h('span', { class: 'delta first' }, !tr ? 'first session' : tr.k === 1 ? 'vs last time' : `last ${tr.k}`),
          sparkline(rollingVolumePoints(ser)),
          note ? h('span', { class: 'cmp' }, note.label) : null);
      })(),
      h('button', { class: 'tc-stat', type: 'button', title: 'Open progress', onclick: () => ctx.openExercise(exId) },
        h('span', { class: 'k', title: 'The session’s strongest set as an estimated one-rep max, so sets at different weights can be compared' }, last.st.weighted ? 'Est. 1RM' : 'Most reps'), h('b', { class: 'num' }, bestLabel(last.st)),
        prev ? deltaChip(prev.st.best.e1, last.st.best.e1) : h('span', { class: 'delta first' }, 'first session'),
        sparkline(bestPoints(ser))));
    return box;
  }

  function card(exId, planned, where, i) {
    const e = cat.exOr(exId);
    const entry = store.entryOn(exId, date);
    const last = store.lastBefore(exId, date);
    const rowsWanted = Math.max(entry ? entry.sets.length : 0, planned || 0, 1);
    const setsBox = h('div', { class: 'tc-sets' });
    const lastLine = h('div', { class: 'tc-last sub' });
    let stat = statsBlock(exId);
    const inputs = [];   // [{w, r, l}] input elements per set (l: left reps, single-arm/leg lifts only)
    const single = store.isSingle(exId), kind = cat.sideKind(e);

    const read = () => inputs.map(x => ({ w: x.w.value, r: x.r.value, ...(x.l ? { l: x.l.value } : {}) }));
    // what you type is written to storage straight away; only the numbers beside it wait for a pause in typing
    const refresh = debounce(() => { const next = statsBlock(exId); stat.replaceWith(next); stat = next; mark(); }, 350);
    const save = () => { store.setEntry(exId, date, read(), { silent: true, now: true }); refresh(); };
    save.flush = () => { store.setEntry(exId, date, read(), { silent: true, now: true }); refresh.flush(); };
    const mark = () => {
      const has = !!store.entryOn(exId, date);
      el.classList.toggle('logged', has);
      badge.hidden = !has;
    };
    const addRow = (vals, focus) => {
      const n = inputs.length;
      const ph = last && last.sets[n] ? last.sets[n] : last && last.sets.length ? last.sets[last.sets.length - 1] : null;
      const w = h('input', { class: 'input', type: 'number', inputMode: 'decimal', step: 'any', min: 0, placeholder: ph && ph.w != null ? num(ph.w) : store.unit(), value: vals && vals.w != null ? num(vals.w) : '', 'aria-label': `Set ${n + 1} weight`, oninput: save });
      const r = h('input', { class: 'input', type: 'number', inputMode: 'numeric', step: 1, min: 0, placeholder: ph && ph.r != null ? String(ph.r) : single ? 'R' : 'reps', value: vals && vals.r != null ? String(vals.r) : '', 'aria-label': `Set ${n + 1} reps${single ? ', right' : ''}`, oninput: save });
      // single arm or leg: right reps, then left (hint: last time's left, or its one number when it had no sides)
      const l = single ? h('input', { class: 'input', type: 'number', inputMode: 'numeric', step: 1, min: 0, placeholder: ph && (ph.l ?? ph.r) != null ? String(ph.l ?? ph.r) : 'L', value: vals && vals.l != null ? String(vals.l) : '', 'aria-label': `Set ${n + 1} reps, left`, oninput: save }) : null;
      // typing reps with the weight left blank: assume the weight shown as the hint (same as last time)
      for (const box of [r, l].filter(Boolean)) box.addEventListener('change', () => { if (box.value && !w.value && ph && ph.w != null) { w.value = num(ph.w); save(); } });
      inputs.push({ w, r, l });
      const row = single
        ? h('div', { class: 'setin sides' }, h('span', { class: 'n' }, n + 1), w, h('span', { class: 'x' }, '×'),
          h('label', { class: 'side' }, h('span', null, 'R'), r), h('label', { class: 'side' }, h('span', null, 'L'), l))
        : h('label', { class: 'setin' }, h('span', { class: 'n' }, n + 1), w, h('span', { class: 'x' }, '×'), r);
      setsBox.insertBefore(row, addBtn);
      if (focus) w.focus();
    };
    const addBtn = h('button', { class: 'btn xs ghost', type: 'button', onclick: () => addRow(null, true) }, icon('plus'), 'Set');
    setsBox.append(addBtn);
    for (let k = 0; k < rowsWanted; k++) addRow(entry ? entry.sets[k] : null, false);

    const same = last && !entry ? h('button', { class: 'btn xs', type: 'button', title: 'Fill in the same sets as last time, then change what moved',
      onclick: () => {
        while (inputs.length < last.sets.length) addRow(null, false);
        last.sets.forEach((x, k) => {
          inputs[k].w.value = x.w != null ? num(x.w) : ''; inputs[k].r.value = x.r != null ? String(x.r) : '';
          if (inputs[k].l) inputs[k].l.value = (x.l ?? x.r) != null ? String(x.l ?? x.r) : '';
        });
        save.flush(); same.remove();
      } }, icon('repeat'), 'Same as last') : null;
    lastLine.append(...(last ? [h('span', null, `Last · ${fmtDate(last.date)} (${daysAgo(last.date)}):`), h('b', { class: 'num' }, setsLabel(last)), same].filter(Boolean) : ['First time logging this one.']));

    // the cue: one line above the sets; click it to change it right here
    const cueRow = h('div', { class: 'tc-cue' });
    const addCue = h('button', { class: 'btn xs ghost tc-addcue', type: 'button', title: 'A one-line cue for this lift, shown above the sets', onclick: () => drawCue(true) }, icon('note'), 'Cue');
    function drawCue(editing = false) {
      const text = store.cue(exId);
      cueRow.hidden = !text && !editing;
      addCue.hidden = !!text || editing;
      if (!editing) {
        cueRow.replaceChildren(text ? h('button', { class: 'cue-t', type: 'button', title: `${text}\n(click to change it)`, 'aria-label': `Cue: ${text}. Click to change it` }, icon('note'), h('span', null, text)) : '');
        const t = cueRow.querySelector('.cue-t');
        if (t) t.addEventListener('click', () => drawCue(true));
        return;
      }
      let done = false;
      const inp = h('input', { class: 'input cue-in', value: text, maxLength: store.CUE_MAX, spellcheck: false, placeholder: 'e.g. close-grip MAG handle · elbows to hips', 'aria-label': `Cue for ${e.name}` });
      const finish = keep => { if (done) return; done = true; if (keep) store.setCue(exId, inp.value, { silent: true }); drawCue(false); };
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') finish(true); else if (ev.key === 'Escape') { ev.stopPropagation(); finish(false); } });
      inp.addEventListener('blur', () => finish(true));
      cueRow.replaceChildren(h('label', { class: 'cue-field' }, icon('note'), inp));
      inp.focus();
    }
    drawCue(false);

    const badge = h('span', { class: 'chip good', hidden: !entry }, icon('check'), 'Logged');
    const el = h('article', { class: `glass tcard enter${entry ? ' logged' : ''}`, style: { '--i': Math.min(i, 8) } },
      h('header', { class: 'tc-head' },
        h('button', { class: 'tc-id', type: 'button', title: 'Details and progress', onclick: () => ctx.openExercise(exId) },
          frame(e, { size: 52 }),
          h('span', null, h('span', { class: 'nm' }, e.name),
            h('span', { class: 'sub' }, single ? h('span', { class: 'side-tag', title: 'Each set: weight × right reps and left reps' }, `Single ${kind}`) : null,
              [where, planned ? `${planned} sets planned` : null].filter(Boolean).join(' · ')))),
        h('span', { class: 'tc-right' }, addCue, badge)),
      h('div', { class: 'tc-body' }, h('div', { class: 'tc-entry' }, cueRow, setsBox, lastLine), stat));
    return el;
  }

  function update() {
    const st = store.get();
    const used = store.usedDays();
    if (filter !== 'all' && !used.includes(filter)) filter = 'all';
    const active = store.activeIds();
    const arch = store.archivedIds();
    summary.replaceChildren(h('b', null, store.splitName(store.activeSplit())), ' · ', h('b', null, active.length), ` active ${active.length === 1 ? 'exercise' : 'exercises'} · `, h('b', null, arch.length), ' archived');
    dateNote.textContent = date === today() ? 'Today' : `${fmtDate(date, { weekday: true })} · ${daysAgo(date)}`;

    daySeg.replaceChildren(used.length ? seg([{ value: 'all', label: 'All' }, ...used.map(i => ({ value: i, label: st.days[i].name.trim() ? `${i + 1} · ${st.days[i].name.trim()}` : `Day ${i + 1}` }))],
      filter, v => { filter = v; update(); }, 'small') : '');

    let list;
    if (filter === 'all') list = active.map(id => { const pl = store.placements(id); return { id, planned: pl[0].item.sets, where: pl.map(p => store.dayLabel(p.di)).join(', ') }; });
    else list = st.days[filter].items.map(it => ({ id: it.ex, planned: it.sets, where: store.dayLabel(filter) }));
    cards.replaceChildren(...(list.length ? list.map((x, i) => card(x.id, x.planned, x.where, i)) : [h('section', { class: 'glass card' }, h('div', { class: 'empty' },
      h('div', { class: 'display' }, 'Nothing to track yet'),
      h('div', { class: 'sub' }, 'Tracking follows your split: once exercises are in a day, they show up here with a place to enter sets.'),
      h('button', { class: 'btn sm primary', type: 'button', onclick: () => ctx.go('split') }, 'Plan your split')))]));

    archive.replaceChildren();
    if (arch.length) {
      archive.append(
        h('div', { class: 'page-head sub-head' }, h('div', null, h('h2', { class: 'display' }, 'Archive'),
          h('div', { class: 'sub' }, 'Exercises with history that aren’t in the split right now. Put one back in a day and it picks up where it left off.'))),
        h('section', { class: 'glass arch' }, arch.map(id => {
          const e = cat.exOr(id), ser = series(id);
          const lastS = ser[ser.length - 1], top = bestEver(ser);
          return h('button', { class: 'arch-row', type: 'button', onclick: () => ctx.openExercise(id) },
            frame(e, { size: 40, badge: false }),
            h('span', { class: 'a-id' }, h('span', { class: 'nm' }, e.name), h('span', { class: 'sub' }, lastS ? `Last trained ${fmtDate(lastS.date)} · ${ser.length} ${ser.length === 1 ? 'session' : 'sessions'}` : 'No completed sets')),
            top ? h('span', { class: 'a-best' }, h('span', { class: 'k' }, 'Best set'), h('b', { class: 'num' }, setText(top.st))) : null,
            ser.length ? sparkline(bestPoints(ser)) : null,
            icon('arrowR'));
        })));
    }
  }

  update();
  // other pages or the sheet changed the log or split: redraw (typing in this page saves silently, so it never lands here)
  return { update };
}
