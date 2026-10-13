// The Optimize sets panel: what the proposal would change and why. Nothing changes until you apply it, and each
// change can be left out. The rule itself is in web/js/optimize.js.
import { h, icon, seg } from '../util.js';
import { openSheet, closeSheet, toast } from '../ui.js';
import * as store from '../store.js';
import * as cat from '../catalog.js';
import { optimize, TARGETS, DEFAULT_TARGET, AIMS } from '../optimize.js';

export function openOptimize() {
  const saved = store.get().prefs.setTarget;
  let target = TARGETS.includes(saved) ? saved : DEFAULT_TARGET;
  const skip = new Set();   // changes you've unticked (by item id)
  const body = h('div', { class: 'opt-sheet' });

  function draw() {
    const r = optimize(store.get().days, target);
    const picked = r.changes.filter(c => !skip.has(c.id));
    const after = r.total.from + picked.reduce((a, c) => a + c.to - c.from, 0);
    const applyBtn = h('button', { class: 'btn sm primary', type: 'button', disabled: !picked.length, onclick: () => {
      const undo = store.applySets(picked);
      closeSheet();
      toast(`Sets updated on ${picked.length} ${picked.length === 1 ? 'exercise' : 'exercises'}.`, { label: 'Undo', fn: undo }, 8000);
    } }, icon('check'), picked.length ? `Apply ${picked.length} ${picked.length === 1 ? 'change' : 'changes'}` : 'Nothing to apply');

    body.replaceChildren(
      h('div', { class: 'sheet-hero opt-hero' }, h('div', null,
        h('h3', null, 'Optimize sets'),
        h('div', { class: 'meta' }, 'A proposal for how many sets each exercise gets. Nothing changes until you apply it, and you can leave any change out.'))),
      h('section', { class: 'opt-target' },
        h('div', { class: 'opt-aim' }, h('span', null, 'Aim for'), seg(TARGETS.map(n => ({ value: n, label: String(n) })), target, v => { target = v; store.setPref('setTarget', v); skip.clear(); draw(); }, 'small'),
          h('span', null, 'sets per muscle each time through your split')),
        h('p', { class: 'opt-aim-note' }, AIMS[target]),
        h('p', { class: 'sub' }, 'Every exercise starts at 3 sets, or more where you’ve planned more. Sets come off, down to 2, where the muscles they work still get this many from the rest of your split (lifts that only help count half), and no muscle goes under 3 direct sets. Isolation lifts and ones later in the day go first, so your main lifts keep 3.')),
      // the totals and the one button that changes anything, side by side
      h('div', { class: 'opt-total' },
        h('span', null, h('b', { class: 'num' }, r.total.from), ' sets now', h('span', { class: 'arr' }, '→'), h('b', { class: 'num' }, after), ` with ${picked.length === r.changes.length ? 'these' : 'the ticked'} changes`),
        applyBtn),
      r.changes.length
        ? h('section', null, h('div', { class: 'eyebrow' }, 'Changes', h('span', null, `${r.changes.length}`)),
          h('div', { class: 'opt-list' }, r.changes.map(c => {
            const on = !skip.has(c.id);
            return h('button', { class: `opt-row${on ? ' on' : ''}`, type: 'button', role: 'checkbox', 'aria-checked': String(on), 'data-id': c.id,
              onclick: () => { if (on) skip.add(c.id); else skip.delete(c.id); draw(); } },
              h('span', { class: 'box' }, on ? icon('check') : null),
              h('span', { class: 'what' }, h('span', { class: 'nm' }, cat.exOr(c.ex).name), h('span', { class: 'sub' }, `${store.dayLabel(c.di)} · ${c.why}`)),
              h('span', { class: 'chg num' }, `${c.from}`, h('span', { class: 'arr' }, '→'), h('b', null, `${c.to}`)));
          })))
        : h('div', { class: 'opt-none' }, icon('check'), h('span', null, `Your sets already fit an aim of ${target}.`)),
      r.under.length ? h('section', { class: 'opt-under' },
        h('div', { class: 'eyebrow' }, `Already under ${target}`, h('span', null, 'left as they are')),
        h('p', { class: 'sub' }, 'Trimming can’t help these. A fourth set, another exercise, or the muscle on a second day would raise them.'),
        h('div', { class: 'chips' }, r.under.map(u => h('span', { class: 'chip' }, cat.muscle(u.z).name, h('b', { class: 'num' }, u.sets))))) : null);
  }
  draw();
  openSheet(body);
}
