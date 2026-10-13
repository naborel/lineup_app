// Checks for Optimize sets (By muscle on the Split page): a proposal of sets per exercise from the sets each muscle
// gets, never applied by itself. The test split, worked out with an independent prototype of the rule:
//   Push A: bench, pec deck, pushdown · Pull: lat pulldown, row, curl · Push B: incline press, lateral raise (planned 2),
//   overhead extension, pushdown · Legs: leg press, leg extension, leg curl (planned 5). 40 sets.
//   Aim 8: only the lateral raise changes, 2 → 3 (side delts' only direct work). 41 sets.
//   Aim 4: bench, pec deck, both pushdowns, lat pulldown, leg press, leg extension → 2; leg curl 5 → 4;
//          lateral raise 2 → 3. 33 sets. (The pushdown on two days at 2 each: the "two days, 2 sets each" case.)
// node tools/check14.mjs [outdir for screenshots]
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
const out = process.argv[2];
const file = 'file://' + path.resolve('Lineup.html');
const DATA = JSON.parse(fs.readFileSync('data/exercises.json', 'utf8'));
const EX = new Map(DATA.exercises.map(e => [e.id, e]));
const b = await chromium.launch();
const errs = [];
let fail = 0; const ok = (n, c, x = '') => { if (!c) fail++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${x ? '  → ' + x : ''}`); };

const plan = [
  ['Push A', [['Barbell_Bench_Press_-_Medium_Grip', 3], ['Butterfly', 3], ['Triceps_Pushdown_-_V-Bar_Attachment', 3]]],
  ['Pull', [['Wide-Grip_Lat_Pulldown', 3], ['Bent_Over_Barbell_Row', 3], ['Barbell_Curl', 3]]],
  ['Push B', [['Incline_Dumbbell_Press', 3], ['Side_Lateral_Raise', 2], ['Standing_Dumbbell_Triceps_Extension', 3], ['Triceps_Pushdown_-_V-Bar_Attachment', 3]]],
  ['Legs', [['Leg_Press', 3], ['Leg_Extensions', 3], ['Lying_Leg_Curls', 5]]],
];
let n = 0;
const days = [...plan.map(([name, items]) => ({ name, items: items.map(([ex, sets]) => ({ id: 'i' + (n++), ex, sets })) })), ...Array.from({ length: 4 }, () => ({ name: '', items: [] }))];
const seed = { v: 1, days, splits: [{ id: 's1', name: 'Test split', days }], active: 's1', favorites: [], custom: [], log: [], notes: {}, cues: {}, prefs: {} };

async function person(name, data) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  if (data) await ctx.addInitScript(s => { if (location.search === '?seed') localStorage.setItem('liftboard-state', s); }, JSON.stringify(data));
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${name} PAGEERROR ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errs.push(`${name} CONSOLE ${m.text()}`); });
  await p.goto(file + (data ? '?seed' : '') + '#split'); await p.waitForSelector('.page-head'); await p.waitForTimeout(900);
  return p;
}
const txt = async loc => (await loc.innerText()).replace(/\s+/g, ' ').trim();

const fresh = await person('fresh', null);
ok('with nothing planned, Optimize sets is greyed out', await fresh.locator('.cov-card .opt-btn').isDisabled());

const p = await person('me', seed);
const settle = (ms = 500) => p.waitForTimeout(ms);
const state = () => p.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')));
const planned = async () => Object.fromEntries((await state()).days.flatMap(d => d.items.map(it => [it.id, it.sets])));
const rows = async () => (await p.locator('.sheet .opt-row').evaluateAll(rs => rs.map(r => ({ id: r.dataset.id, on: r.getAttribute('aria-checked') === 'true', text: r.textContent.replace(/\s+/g, ' ') }))));
const open = async () => { await p.locator('.cov-card .opt-btn').click(); await settle(800); };
const before = await planned();

await open();
ok('the button sits on the By muscle card and opens a panel, aiming for 8 to start with',
  await p.locator('.sheet .opt-aim .seg button[aria-pressed="true"]').innerText() === '8' && /middle ground/.test(await txt(p.locator('.sheet .opt-aim-note'))));
let r = await rows();
ok('aim 8: only the lateral raise changes, back up from 2 to 3 (side delts’ only direct work)', r.length === 1 && /Dumbbell Lateral Raise/.test(r[0].text) && /2→3/.test(r[0].text.replace(/\s/g, '')) && /Keeps side delts at 3 direct sets/.test(r[0].text), JSON.stringify(r));
ok('the total reads 40 → 41', /^40 sets now ?→ ?41/.test(await txt(p.locator('.sheet .opt-total'))), await txt(p.locator('.sheet .opt-total')));
const under = await txt(p.locator('.sheet .opt-under'));
ok('muscles already under the aim are listed, leg curls’ 5 sets left as planned', /Side delts 3/.test(under) && /Hamstrings 5/.test(under), under);
if (out) await p.screenshot({ path: `${out}/o1-aim8.png` });

await p.locator('.sheet .opt-aim .seg button', { hasText: /^4$/ }).click(); await settle(500);
r = await rows();
const has = (re, from, to, k = 0) => r.filter(x => re.test(x.text)).some((x, i, a) => a.length > k && x.text.replace(/\s/g, '').includes(`${from}→${to}`));
ok('aim 4: nine changes, 40 → 33 sets', r.length === 9 && /^40 sets now ?→ ?33/.test(await txt(p.locator('.sheet .opt-total'))), `${r.length} · ${await txt(p.locator('.sheet .opt-total'))}`);
ok('a pushdown on two days goes to 2 on each', r.filter(x => /Triceps Pushdown/.test(x.text) && x.text.replace(/\s/g, '').includes('3→2')).length === 2);
ok('leg curls planned at 5 come down only to 4 (hamstrings keep 4)', has(/Lying Leg Curl/, 5, 4));
ok('the row, the curl and the extensions keep 3 (not listed)', !r.some(x => /Barbell Row|Barbell Curl|Overhead Dumbbell Extension/.test(x.text)));
ok('the aim is remembered', (await state()).prefs.setTarget === 4);
if (out) await p.screenshot({ path: `${out}/o2-aim4.png` });

// untick one, then close without applying
const bench = r.find(x => /Barbell Bench Press/.test(x.text));
await p.locator(`.sheet .opt-row[data-id="${bench.id}"]`).click(); await settle(300);
ok('unticking a change leaves it out: 34 sets, Apply 8 changes', /^40 sets now ?→ ?34/.test(await txt(p.locator('.sheet .opt-total'))) && /Apply 8 changes/.test(await txt(p.locator('.sheet .opt-total .btn'))));
await p.keyboard.press('Escape'); await settle(600);
ok('closing the panel changes nothing', JSON.stringify(await planned()) === JSON.stringify(before));

// apply, undo, apply
await open();
ok('it reopens on the aim you picked, every change ticked', await p.locator('.sheet .opt-aim .seg button[aria-pressed="true"]').innerText() === '4' && (await rows()).every(x => x.on) && (await rows()).length === 9);
await p.locator(`.sheet .opt-row[data-id="${bench.id}"]`).click(); await settle(300);
await p.locator('.sheet .opt-total .btn').click(); await settle(800);
let now = await planned();
ok('Apply sets what was ticked, and only that', now[bench.id] === 3 && Object.values(now).reduce((a, x) => a + x, 0) === 34 && await p.locator('.sheet').count() === 0);
await p.locator('.toast .btn', { hasText: 'Undo' }).click(); await settle(600);
ok('Undo puts every set back', JSON.stringify(await planned()) === JSON.stringify(before));
await open();
await p.locator('.sheet .opt-total .btn').click(); await settle(800);
now = await planned();
ok('applying all of it: 33 sets', Object.values(now).reduce((a, x) => a + x, 0) === 33);
const covRow = await txt(p.locator('.cov-row[data-z="tri_lat"]'));
ok('By muscle follows: triceps lateral head 8 sets', /8 sets/.test(covRow), covRow);

// the rule, checked from outside: every directly trained muscle has at least 3 direct sets and at least
// min(4, what it had at the start) sets, helpers counting half
const vol = (ds, setsOf) => {
  const v = new Map(), d = new Map();
  ds.forEach(day => day.items.forEach(it => { const e = EX.get(it.ex); const s = setsOf(it);
    for (const z of e.p) { v.set(z, (v.get(z) || 0) + s); d.set(z, (d.get(z) || 0) + s); }
    for (const z of e.s) v.set(z, (v.get(z) || 0) + s / 2); }));
  return { v, d };
};
const st = await state();
const start = vol(days, it => Math.max(3, it.sets)), end = vol(st.days, it => it.sets);
const bad = [...start.d.keys()].filter(z => end.d.get(z) < 3 || end.v.get(z) < Math.min(4, start.v.get(z)) - 1e-9);
ok('no muscle ends under 3 direct sets or under the aim (unless it started under)', bad.length === 0, bad.join(', '));
await open();
ok('optimizing again changes nothing more', await p.locator('.sheet .opt-none').count() === 1 && /already fit an aim of 4/.test(await txt(p.locator('.sheet .opt-none'))));
await p.keyboard.press('Escape'); await settle(400);

console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no page errors');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
