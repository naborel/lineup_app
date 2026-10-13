// Checks for showing only some days on the model.  node tools/check5.mjs [outdir for screenshots]
import { chromium } from 'playwright';
import path from 'path';
const out = process.argv[2];
const file = 'file://' + path.resolve('Lineup.html');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
const settle = (ms = 500) => p.waitForTimeout(ms);
let fail = 0; const ok = (n, c, x = '') => { if (!c) fail++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${x ? '  → ' + x : ''}`); };
const shot = async (name, sel = null) => { if (!out) return; await p.mouse.move(5, 5); await settle(500); await (sel ? (await p.$(sel)).screenshot({ path: `${out}/${name}` }) : p.screenshot({ path: `${out}/${name}` })); };
const colour = (z, side = 'front') => p.evaluate(([zz, sd]) => getComputedStyle(document.querySelector(`.bm-grad[id*="-${sd}-${zz}"]`)).getPropertyValue('--c').trim(), [z, side]);
const add = async (day, name) => {
  await p.click(`.lane[data-day="${day}"] .lane-add`); await settle(300);
  await p.fill('.picker input[type=search]', name); await settle(300);
  await p.click('.picker .res'); await settle(700);
  await p.keyboard.press('Escape'); await settle(200);
};
const pressed = () => p.locator('.cover-show .daypick button[aria-pressed="true"]').allInnerTexts();
const shownLanes = () => p.locator('.lane.shown').evaluateAll(els => els.map(e => +e.dataset.day + 1));
const row = async z => (await p.locator(`.cov-row[data-z="${z}"]`).innerText()).replace(/\s+/g, ' ');
// the free space of a day row: the far right of the row, past the tiles
const clickRow = async day => { await p.evaluate(() => scrollTo(0, 0)); const bx = await p.locator(`.lane[data-day="${day}"]`).boundingBox(); await p.mouse.click(bx.x + bx.width - 30, bx.y + bx.height / 2); await settle(1100); };

await p.goto(file); await p.waitForSelector('.page-head'); await settle();
const silver = await colour('chest_lower');
// two pull days with different lifts, and a push day
await add(0, 'barbell bench press');     // day 1: chest
await add(1, 'wide-grip lat pulldown');  // day 2: lats
await add(1, 'barbell curl');            //        biceps
await add(4, 'seated cable rows');       // day 5: mid back
await add(4, 'hammer curls');            //        biceps again
const all = { chest: await colour('chest_lower'), lats: await colour('lats', 'back'), mid: await colour('mid_back', 'back'), bi: await colour('biceps') };
ok('whole split to start: nothing picked, "Whole split" on', (await pressed()).length === 0 && await p.getAttribute('.cover-show .all', 'aria-pressed') === 'true');
ok('empty days can\'t be picked', await p.locator('.cover-show .daypick button').nth(2).isDisabled() && !(await p.locator('.cover-show .daypick button').nth(1).isDisabled()));
ok('biceps is trained twice across the split', /2×/.test(await row('biceps')), await row('biceps'));
await shot('f1-whole.png');

// pick day 2 with its chip
await p.locator('.cover-show .daypick button').nth(1).click(); await settle(1100);   // the colour eases over
const d2 = { chest: await colour('chest_lower'), lats: await colour('lats', 'back'), mid: await colour('mid_back', 'back'), bi: await colour('biceps') };
ok('day 2 only: chest goes back to silver, lats drop from twice to once', d2.chest === silver && d2.lats !== silver && d2.lats !== all.lats, `chest ${all.chest} → ${d2.chest} · lats ${all.lats} → ${d2.lats}`);
ok('day 2 only: the other pull day\'s row work is gone and biceps drops to once', d2.mid !== all.mid && d2.bi !== all.bi && /1×/.test(await row('biceps')), await row('biceps'));
ok('the row is outlined and the others step back', String(await shownLanes()) === '2' && await p.locator('.lanes.filtering').count() === 1);
ok('By muscle says which days it covers', /Day 2 only/.test(await p.locator('.cov-card .chip.scope').innerText()));
ok('the summary under the title still describes the whole split', /3 training days/.test(await p.locator('.page-head .sub').innerText()), await p.locator('.page-head .sub').innerText());
await shot('f2-day2.png');

// add the other pull day by clicking its row
await clickRow(4);
ok('clicking a row\'s free space adds that day', String(await pressed()) === '2,5' && String(await shownLanes()) === '2,5', String(await pressed()));
ok('both pull days: back and biceps as in the whole split, chest still silver', await colour('mid_back', 'back') === all.mid && await colour('biceps') === all.bi && await colour('chest_lower') === silver);
ok('label for several days', /Days 2 \+ 5 only/.test(await p.locator('.cov-card .chip.scope').innerText()), await p.locator('.cov-card .chip.scope').innerText());
await shot('f3-days2and5.png');

// clicks inside the row that mean something else don't toggle it
await p.locator('.lane[data-day="0"] .bx-wrap button').first().click(); await settle(400);
ok('clicking a tile opens its menu and leaves the picked days alone', await p.locator('.item-menu').count() === 1 && String(await pressed()) === '2,5');
await p.keyboard.press('Escape'); await settle(200);
await p.locator('.lane[data-day="0"] .day-name').click(); await p.keyboard.type('Push'); await settle(500);
ok('typing a day name leaves the picked days alone', String(await pressed()) === '2,5' && await p.inputValue('.lane[data-day="0"] .day-name') === 'Push');

// clicking a picked row again drops it; emptying a picked day drops it too
await clickRow(1);
ok('clicking a picked row again hides it', String(await pressed()) === '5');
await p.locator('.lane[data-day="4"] .lane-more').click(); await settle(300);
ok('the day menu offers the whole split when that day is the only one shown', await p.locator('.item-menu .opt', { hasText: 'Show the whole split' }).count() === 1);
await p.locator('.item-menu .opt.danger').click(); await settle(1100);
ok('clearing the only picked day returns to the whole split', (await pressed()).length === 0 && await p.locator('.lanes.filtering').count() === 0 && await colour('chest_lower') === all.chest);
await p.locator('.toast button').click(); await settle(700);   // undo the clear

// the day menu: show only this day; and "Whole split" resets
await p.locator('.lane[data-day="0"] .lane-more').click(); await settle(300);
await p.locator('.item-menu .opt', { hasText: 'Show only Day 1 (Push)' }).click(); await settle(1100);
ok('day menu: show only this day', String(await pressed()) === '1' && await colour('lats', 'back') === silver && await colour('chest_lower') === all.chest);
// with one day shown, a muscle click opens the picker on that day
await p.locator('.cov-row[data-z="abs"]').click(); await settle(500);
ok('with one day shown the picker adds to that day', String(await p.locator('.picker .daypick button[aria-pressed="true"]').allInnerTexts()) === '1');
await p.keyboard.press('Escape'); await settle(300);
await p.click('.cover-show .all'); await settle(1100);
ok('"Whole split" shows everything again', (await pressed()).length === 0 && await colour('lats', 'back') === all.lats && await colour('biceps') === all.bi && (await shownLanes()).length === 0);
// it is a way of looking, not saved
await p.locator('.cover-show .daypick button').nth(0).click(); await settle(400);
const saved = await p.evaluate(() => localStorage.getItem('liftboard-state'));
ok('the picked days are not written to the saved data', !/shown/.test(saved));
await p.reload(); await p.waitForSelector('.page-head'); await settle(700);
ok('reopening the page starts on the whole split', (await pressed()).length === 0);
console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no page errors');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
