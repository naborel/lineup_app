// Functional check of the built file: the maths, adding/removing, logging, the table, backup round-trip and
// that everything survives a reload.  node tools/check.mjs
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';
const file = 'file://' + path.resolve('Lineup.html');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-'));
const ctx = await chromium.launchPersistentContext(dir, { viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = ctx.pages()[0] || await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? '  → ' + extra : ''}`); };
const state = () => p.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')));
const settle = (ms = 500) => p.waitForTimeout(ms);
const zoneColour = z => p.evaluate(zz => getComputedStyle(document.querySelector(`.bm-grad[id*="-front-${zz}"], .bm-grad[id*="-back-${zz}"]`)).getPropertyValue('--c').trim(), z);

await p.goto(file); await p.waitForSelector('.page-head'); await settle();

// 1. empty start
ok('starts empty', (await p.$$('.lane.empty-lane')).length === 8);
const silver = await zoneColour('chest_upper');

// 2. add Incline Dumbbell Press to day 1 through the day picker
await p.click('.lane[data-day="0"] .lane-add'); await settle(300);
await p.fill('.picker input[type=search]', 'incline dumbbell press'); await settle(300);
await p.click('.picker .res'); await settle(900);
let st = await state();
ok('exercise added to day 1', st.days[0].items.length === 1 && st.days[0].items[0].ex === 'Incline_Dumbbell_Press');
ok('it became a favorite too', st.favorites.includes('Incline_Dumbbell_Press'));
const once = await zoneColour('chest_upper');
ok('upper chest lights up (once = light red)', once !== silver, `${silver} → ${once}`);
const helped = await zoneColour('chest_lower');
ok('mid chest only helped (paler than upper)', helped !== once && helped !== silver, helped);
await p.keyboard.press('Escape'); await settle(200);

// 3. a second upper-chest lift on the same day → 1.4, on another day → 2
await p.click('.lane[data-day="0"] .lane-add'); await settle(300);
await p.fill('.picker input[type=search]', 'low-to-high'); await settle(300);
await p.click('.picker .res'); await settle(900);
const sameDay = await zoneColour('chest_upper');
await p.keyboard.press('Escape');
// move it to day 3 with the tile menu
await p.click('.lane[data-day="0"] .bx-wrap:nth-child(2) .bx'); await settle(300);
await p.click('.item-menu .im-row:nth-of-type(3) .daypick button:nth-child(3)'); await settle(900);
st = await state();
ok('moved to day 3', st.days[0].items.length === 1 && st.days[2].items.length === 1);
const otherDay = await zoneColour('chest_upper');
ok('same day counts less than another day', sameDay !== otherDay && sameDay !== once, `once ${once} · same day ${sameDay} · two days ${otherDay}`);

// 4. log a session, then a better one, and read the two measures
await p.evaluate(() => { location.hash = 'track'; }); await settle(700);
const fillSets = async (date, sets) => {
  await p.fill('.date-nav input[type=date]', date); await p.dispatchEvent('.date-nav input[type=date]', 'change'); await settle(500);
  const c = p.locator('.tcard').first();
  for (let i = 0; i < sets.length; i++) {
    const row = c.locator('.setin').nth(i);
    await row.locator('input').nth(0).fill(String(sets[i][0]));
    await row.locator('input').nth(1).fill(String(sets[i][1]));
  }
  await settle(700);
};
await fillSets('2026-09-01', [[60, 11], [60, 10], [60, 6]]);
await fillSets('2026-09-08', [[60, 12], [60, 11], [60, 8]]);
st = await state();
const log = st.log.filter(e => e.ex === 'Incline_Dumbbell_Press').sort((a, b) => a.date < b.date ? -1 : 1);
ok('two sessions saved', log.length === 2 && log[0].sets.length === 3 && log[1].sets.length === 3, JSON.stringify(log.map(e => e.sets.map(s => s.w + 'x' + s.r))));
const vol = e => e.sets.reduce((a, s) => a + s.w * s.r, 0);
ok('volume 1620 → 1860', vol(log[0]) === 1620 && vol(log[1]) === 1860);
const shown = await p.locator('.tcard').first().locator('.tc-stat').allInnerTexts();
ok('first card is the best set: 60 × 12, new best, was 60 × 11', /Best set/.test(shown[0]) && /60 × 12/.test(shown[0]) && /New best/.test(shown[0]) && /was 60 × 11/.test(shown[0]), shown[0].replace(/\n/g, ' | '));
ok('second card: the volume trend, +14.8% on last time (1,620 → 1,860)', /^Volume trend/.test(shown[1]) && /\+4\.8%|\+15%/.test(shown[1]) && /vs last time/.test(shown[1]) && !/1,860/.test(shown[1]), shown[1].replace(/\n/g, ' | '));
ok('card shows est. 1RM 84 lb and a rise', /84 lb/.test(shown[2]) && /\+/.test(shown[2]), shown[2].replace(/\n/g, ' | '));

// a heavier top set with fewer reps becomes the best set, even though its estimated 1RM is lower
await fillSets('2026-09-15', [[70, 5], [60, 12], [60, 10]]);
const heavy = await p.locator('.tcard').first().locator('.tc-stat').allInnerTexts();
ok('heaviest weight wins: best set is 70 × 5, was 60 × 12', /70 × 5/.test(heavy[0]) && /New best/.test(heavy[0]) && /was 60 × 12/.test(heavy[0]), heavy[0].replace(/\n/g, ' | '));
ok('the trend follows: 1,860 → 1,670 reads −10%, in amber', /^Volume trend/.test(heavy[1]) && /−10%/.test(heavy[1]) && await p.locator('.tcard').first().locator('.tc-stat.vol b.trend.down').count() === 1, heavy[1].replace(/\n/g, ' | '));
ok('est. 1RM still follows the strongest set (60 × 12 → 84 lb)', /84 lb/.test(heavy[2]), heavy[2].replace(/\n/g, ' | '));
await fillSets('2026-09-15', [['', ''], ['', ''], ['', '']]);

// 5. sheet: charts + history
await p.locator('.tcard').first().locator('.tc-id').click(); await settle(900);
ok('sheet has the weight-and-reps chart (two sessions each) and the volume and est. 1RM charts (two points each)', (await p.$$('.sheet .combo')).length === 1 && (await p.$$('.sheet .combo .pt.w')).length === 2 && (await p.$$('.sheet .combo .pt.r')).length === 2 && (await p.$$('.sheet .chart .pt')).length === 4);
const hist = await p.locator('.sheet .hist tbody tr').allInnerTexts();
ok('history lists both sessions, newest first', hist.length === 2 && /60 × 12, 11, 8/.test(hist[0]) && /60 × 11, 10, 6/.test(hist[1]), hist[0].replace(/\s+/g, ' '));
await p.click('.sheet .close'); await settle(400);

// 6. table: edit a cell, delete a row, undo
await p.evaluate(() => { location.hash = 'table'; }); await settle(700);
ok('table has 6 rows', (await p.$$('.tbl tbody tr')).length === 6);
const firstReps = p.locator('.tbl tbody tr').first().locator('input.cell.n').nth(1);
const before = await firstReps.inputValue();
await firstReps.fill('13'); await firstReps.dispatchEvent('change'); await settle(600);
st = await state();
ok('editing a cell changes the log', st.log.some(e => e.sets.some(s => s.r === 13)), `was ${before}`);
await p.locator('.tbl tbody tr').first().locator('.act button').click(); await settle(500);
ok('delete removes a row', (await p.$$('.tbl tbody tr')).length === 5);
await p.click('.toast .btn'); await settle(500);
ok('undo brings it back', (await p.$$('.tbl tbody tr')).length === 6);

// 7. reload: everything still there
await p.reload(); await p.waitForSelector('.page-head'); await settle(700);
st = await state();
ok('survives a reload', st.days[0].items.length === 1 && st.log.length === 2 && (await p.$$('.tbl tbody tr')).length === 6);

// 8. archive: take the lift out of the split, it should move to Archive with its history
await p.evaluate(() => { location.hash = 'split'; }); await settle(700);
await p.hover('.lane[data-day="0"] .bx-wrap'); await p.click('.lane[data-day="0"] .bx-wrap .rx'); await settle(700);
await p.evaluate(() => { location.hash = 'track'; }); await settle(700);
const arch = await p.locator('.arch-row').allInnerTexts();
ok('removed lift shows in Archive with its sessions', arch.length === 1 && /Incline Dumbbell Press/.test(arch[0]) && /2 sessions/.test(arch[0]), (arch[0] || '').replace(/\s+/g, ' '));

// 9. backup round-trip
await p.click('#save-status'); await settle(300);
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.pop .opt:has-text("Save a backup")')]);
const saved = path.join(dir, 'backup.json'); await dl.saveAs(saved);
const backup = JSON.parse(fs.readFileSync(saved, 'utf8'));
ok('backup file has the log and split', backup.app === 'liftboard' && backup.log.length === 2 && backup.days.length === 8);
await p.click('#save-status'); await settle(300);
await p.click('.pop .opt:has-text("Clear everything")'); await settle(600);
st = await state();
ok('clear everything empties it', st.log.length === 0 && st.favorites.length === 0);
await p.click('#save-status'); await settle(300);
const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('.pop .opt:has-text("Load a backup")')]);
await chooser.setFiles(saved); await settle(900);
st = await state();
ok('loading the backup restores it', st.log.length === 2 && st.favorites.includes('Incline_Dumbbell_Press'));

console.log(`\n${pass} passed, ${fail} failed`);
console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no page errors');
await ctx.close();
fs.rmSync(dir, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
