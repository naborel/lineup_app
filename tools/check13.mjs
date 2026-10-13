// Checks for single-arm and single-leg lifts: the label (from the name, or changed per exercise), right and
// left reps for each set on Track and in the Table, and how those sets are measured. Worked out by hand:
//   Dumbbell Row (a one-arm row), sessions:
//     7 days ago  70 × 10           logged before it had sides: counts 10 each side → volume 1,400, Est. 1RM 93
//     3 days ago  70 × 10/9, 10/8   volume 70 × 37 = 2,590; best per side (10 + 9) ÷ 2 = 9.5 → 70 × 1.3167 = 92
//     today       75 × 9/8          volume 75 × 17 = 1,275; per side 8.5 → 75 × 1.2833 = 96
//   Trends (Back): Est. 1RM today against 7 days ago, 96.25 ÷ 93.33 → +3.1%
// node tools/check13.mjs [outdir for screenshots]
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
const out = process.argv[2];
const file = 'file://' + path.resolve('Lineup.html');
const b = await chromium.launch();
const errs = [];
let fail = 0; const ok = (n, c, x = '') => { if (!c) fail++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${x ? '  → ' + x : ''}`); };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const ROW = 'One-Arm_Dumbbell_Row', BSS = 'Split_Squat_with_Dumbbells', LAT = 'Wide-Grip_Lat_Pulldown';
const seed = { v: 1, days: [{ name: 'Pull', items: [ROW, BSS, LAT].map((ex, k) => ({ id: 'i' + k, ex, sets: 2 })) }], favorites: [], custom: [], notes: {}, cues: {}, prefs: {},
  log: [{ id: 'a', date: ago(7), ex: ROW, sets: [{ w: 70, r: 10 }] }, { id: 'b', date: ago(3), ex: ROW, sets: [{ w: 70, r: 10, l: 9 }, { w: 70, r: 10, l: 8 }] }] };

async function person(name, data, { width = 1440, page = 'track' } = {}) {
  const ctx = await b.newContext({ viewport: { width, height: 950 }, acceptDownloads: true });
  if (data) await ctx.addInitScript(s => { if (location.search === '?seed') localStorage.setItem('liftboard-state', s); }, JSON.stringify(data));
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${name} PAGEERROR ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errs.push(`${name} CONSOLE ${m.text()}`); });
  await p.goto(file + (data ? '?seed' : '') + '#' + page); await p.waitForSelector('.page-head'); await p.waitForTimeout(900);
  return p;
}
const p = await person('me', seed);
const settle = (ms = 500) => p.waitForTimeout(ms);
const state = () => p.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')));
const txt = async loc => (await loc.innerText()).replace(/\s+/g, ' ').trim();
const card = name => p.locator('.tcard', { has: p.locator('.tc-id .nm', { hasText: new RegExp(`^${name}$`) }) });
const go = async pg => { await p.evaluate(x => { location.hash = x; }, pg); await settle(900); };

// ---------- the label ----------
ok('a one-arm row is labelled “Single arm”, a Bulgarian split squat “Single leg”, a lat pulldown nothing',
  await card('Dumbbell Row').locator('.side-tag').innerText() === 'Single arm' && await card('Bulgarian Split Squat').locator('.side-tag').innerText() === 'Single leg'
  && await card('Lat Pulldown \\(wide grip\\)').locator('.side-tag').count() === 0);
const rowSets = card('Dumbbell Row').locator('.setin');
ok('single lifts get weight × right and left reps for each set; others weight × reps',
  await rowSets.count() === 2 && await rowSets.first().locator('input').count() === 3 && (await rowSets.first().locator('.side span').allInnerTexts()).join('') === 'RL'
  && await card('Lat Pulldown \\(wide grip\\)').locator('.setin').first().locator('input').count() === 2);
const ph = await rowSets.first().locator('input').evaluateAll(xs => xs.map(x => x.placeholder));
const ph2 = await rowSets.nth(1).locator('input').evaluateAll(xs => xs.map(x => x.placeholder));
ok('the hints are last time’s numbers, side by side', ph.join(' ') === '70 10 9' && ph2.join(' ') === '70 10 8', `${ph.join(' ')} | ${ph2.join(' ')}`);
ok('the last session reads as right/left', /70 × 10\/9, 10\/8/.test(await txt(card('Dumbbell Row').locator('.tc-last'))), await txt(card('Dumbbell Row').locator('.tc-last')));
if (out) { await card('Dumbbell Row').scrollIntoViewIfNeeded(); await p.mouse.move(5, 5); await settle(300); await card('Dumbbell Row').screenshot({ path: `${out}/s1-card.png` }); }

// ---------- logging ----------
const ins = rowSets.first().locator('input');
await ins.nth(0).fill('75'); await ins.nth(1).fill('9'); await ins.nth(2).fill('8'); await settle(900);
const today = (await state()).log.find(e => e.ex === ROW && e.date === ago(0));
ok('a set is saved as weight, right and left', today && today.sets.length === 1 && today.sets[0].w === 75 && today.sets[0].r === 9 && today.sets[0].l === 8, JSON.stringify(today));
const stat = await txt(card('Dumbbell Row').locator('.tc-stats'));
ok('best set shows both sides; Est. 1RM uses the reps per side (8.5 → 96 lb)', /75 × 9\/8/.test(stat) && /96 lb/.test(stat), stat);
// the weight is assumed from the hint when you only type reps
await rowSets.nth(1).locator('input').nth(2).fill('7'); await rowSets.nth(1).locator('input').nth(2).blur(); await settle(800);
const set2 = (await state()).log.find(e => e.ex === ROW && e.date === ago(0)).sets[1];
ok('typing only reps takes the weight from the hint, as for any lift', set2 && set2.w === 70 && set2.l === 7 && set2.r == null, JSON.stringify(set2));
await rowSets.nth(1).locator('input').nth(1).fill('9'); await settle(700);
if (out) { await p.mouse.move(5, 5); await settle(300); await card('Dumbbell Row').screenshot({ path: `${out}/s2-logged.png` }); }

// ---------- the details: history, and changing the label ----------
await card('Dumbbell Row').locator('.tc-id').click(); await settle(900);
const tog = p.locator('.sheet .side-tog');
ok('the details have a “Single arm” switch, on', await tog.innerText() === 'Single arm' && await tog.getAttribute('aria-pressed') === 'true');
ok('the history lists sets as right/left', /70 × 10\/9, 10\/8/.test(await txt(p.locator('.sheet .hist'))));
const tiles = await txt(p.locator('.sheet .stat-tiles'));
ok('“Reps at 75” counts both sides', /Reps at 75 17 reps/.test(tiles), tiles);
if (out) await p.screenshot({ path: `${out}/s3-details.png` });
await tog.click(); await settle(500);
ok('switching it off is remembered for this lift', (await state()).single[ROW] === false && await p.locator('.sheet .side-tog').getAttribute('aria-pressed') === 'false');
await p.locator('.sheet .side-tog').click(); await settle(500);
ok('switching it back on returns to the automatic label (nothing stored)', !(ROW in (await state()).single));
await p.keyboard.press('Escape'); await settle(600);
await card('Lat Pulldown \\(wide grip\\)').locator('.tc-id').click(); await settle(800);
ok('a two-arm lift shows the switch off', await p.locator('.sheet .side-tog').getAttribute('aria-pressed') === 'false');
await p.locator('.sheet .side-tog').click(); await settle(500);
await p.keyboard.press('Escape'); await settle(800);
ok('switching it on: the Track card gets the label and right/left boxes', await card('Lat Pulldown \\(wide grip\\)').locator('.side-tag').innerText() === 'Single arm'
  && await card('Lat Pulldown \\(wide grip\\)').locator('.setin').first().locator('input').count() === 3 && (await state()).single[LAT] === true);

// ---------- the table ----------
await go('table');
// the n-th Dumbbell Row row on a date (the date is an input, so it's read from its value)
const tr = async (date, n) => {
  const i = await p.locator('.tbl tbody tr').evaluateAll((rows, [d, k]) => rows.map((r, j) => [j, r.querySelector('input[type=date]')?.value, r.textContent.includes('Dumbbell Row')])
    .filter(x => x[1] === d && x[2]).map(x => x[0])[k], [date, n]);
  return p.locator('.tbl tbody tr').nth(i);
};
const cells = async row => (await row.locator('td').allInnerTexts()).map(x => x.trim());
const old = await tr(ago(7), 0);
const oldC = await cells(old);
ok('an older one-number set counts for each side: volume 1,400, Est. 1RM 93', oldC.includes('1,400') && oldC.includes('93') && await old.locator('.lr input').count() === 2, oldC.join(' | '));
const b1 = await tr(ago(3), 0);
ok('a right/left set: two boxes, volume 70 × 19 = 1,330, Est. 1RM 92', await b1.locator('.lr input').count() === 2 && (await cells(b1)).includes('1,330') && (await cells(b1)).includes('92'));
await b1.locator('.lr input').nth(1).fill('10'); await b1.locator('.lr input').nth(1).press('Tab'); await settle(500);
ok('editing the left side updates it', (await state()).log.find(e => e.id === 'b').sets[0].l === 10 && (await cells(b1)).includes('1,400'));
await p.selectOption('.add-row select', ROW); await settle(200);
ok('adding a set for a single lift shows a left box too', await p.locator('.add-row input[placeholder="left"]').isVisible() && await p.locator('.add-row input[placeholder="right"]').count() === 1);
await p.fill('.add-row input[placeholder="weight"]', '65'); await p.fill('.add-row input[placeholder="right"]', '12'); await p.fill('.add-row input[placeholder="left"]', '11');
await p.locator('.add-row .btn', { hasText: 'Add set' }).click(); await settle(600);
ok('… and saves both', (await state()).log.find(e => e.ex === ROW && e.date === ago(0)).sets.some(x => x.w === 65 && x.r === 12 && x.l === 11));
await p.selectOption('.add-row select', 'Wide-Grip_Lat_Pulldown'); await settle(200);
const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('.head-actions .btn', { hasText: 'CSV' }).click()]);
const csv = fs.readFileSync(await dl.path(), 'utf8').split('\n');
ok('the CSV gives each side its own column (reps is the total)', csv[0].endsWith(',reps,reps_right,reps_left') && csv.some(l => l.endsWith(',70,20,10,10')) && csv.some(l => /,70,10,,$/.test(l)), csv.slice(0, 4).join(' / '));

// ---------- trends, and reopening ----------
await go('trends');
ok('Trends use the reps per side: Back +3.1%', /Strength \+3\.1%/.test(await txt(p.locator('.tr-card[data-group="Back"]'))), await txt(p.locator('.tr-card[data-group="Back"]')));
const again = await person('again', await state());
ok('everything is there in a new browser started from what was saved', await again.locator('.tcard .side-tag').count() === 3
  && await again.locator('.tcard', { has: again.locator('.tc-id .nm', { hasText: /^Dumbbell Row$/ }) }).locator('.setin').first().locator('input').nth(2).inputValue() === '8');

// ---------- phone width ----------
const phone = await person('phone', await state(), { width: 400 });
const sizes = await phone.locator('.tcard .setin.sides').first().evaluate(el => ({ w: el.getBoundingClientRect().width, card: el.closest('.tcard').getBoundingClientRect().width, scroll: document.documentElement.scrollWidth }));
ok('on a phone a right/left set fits on its line', sizes.w < sizes.card - 20 && sizes.scroll <= 400, JSON.stringify(sizes));
if (out) await phone.screenshot({ path: `${out}/s4-phone.png`, clip: { x: 0, y: 0, width: 400, height: 950 } });

console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no page errors');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
