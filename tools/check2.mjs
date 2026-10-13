// More checks: copying a whole day, drag and drop between days, a custom exercise, "Same as last", the exercise photo.
// node tools/check2.mjs [outdir for screenshots]
import { chromium } from 'playwright';
import path from 'path';
const out = process.argv[2];   // optional: a folder for screenshots
const file = 'file://' + path.resolve('Lineup.html');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
const state = () => p.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')));
const settle = (ms = 500) => p.waitForTimeout(ms);
const shot = async name => { if (out) await p.screenshot({ path: `${out}/${name}` }); };
let fail = 0; const ok = (n, c, x = '') => { if (!c) fail++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${x ? '  → ' + x : ''}`); };
await p.goto(file); await p.waitForSelector('.page-head'); await settle();
await p.click('.split-empty .btn'); await settle(1200);
await shot('n1-split-1280.png');

// copy a whole day: Push (day 1) into the empty day 7, then again, then Pull on top, then clear it
const dayCopy = async (from, to) => { await p.click(`.lane[data-day="${from}"] .lane-more`); await settle(300); await p.click(`.item-menu .daypick button:nth-child(${to + 1})`); await settle(700); };
let s0 = await state();
await dayCopy(0, 6);
let s1 = await state();
ok('copy day: every exercise, its sets and the name', s1.days[6].name === 'Push' && s1.days[6].items.map(i => i.ex + i.sets).join() === s0.days[0].items.map(i => i.ex + i.sets).join() && s1.days[0].items.length === 6, (await p.locator('.toast span').first().innerText()));
ok('the copies are separate tiles', s1.days[6].items.every(i => !s0.days[0].items.some(j => j.id === i.id)));
await dayCopy(0, 6);
ok('copying again adds nothing', (await state()).days[6].items.length === 6, (await p.locator('.toast span').first().innerText()));
await dayCopy(1, 6);
s1 = await state();
ok('copying onto a day with exercises keeps them and adds the rest', s1.days[6].items.length === 11 && s1.days[6].name === 'Push', (await p.locator('.toast span').first().innerText()));
await p.click('.toast .btn'); await settle(500);
ok('undo takes the second copy back out', (await state()).days[6].items.length === 6);
await shot('n0-daymenu-before.png');
await p.click('.lane[data-day="6"] .lane-more'); await settle(400);
await shot('n0-daymenu.png');
await p.click('.item-menu .opt.danger'); await settle(600);
s1 = await state();
ok('clear day empties it', s1.days[6].items.length === 0 && s1.days[6].name === '');

// drag the first tile of day 1 onto day 4 (empty)
let st = await state(); const first = st.days[0].items[0].ex;
await p.dragAndDrop('.lane[data-day="0"] .bx-wrap:nth-child(1)', '.lane[data-day="3"]'); await settle(800);
st = await state();
ok('drag to another day moves it', st.days[3].items.length === 1 && st.days[3].items[0].ex === first && st.days[0].items.length === 5);
// drag it back in front of the first tile of day 1
await p.dragAndDrop('.lane[data-day="3"] .bx-wrap:nth-child(1)', '.lane[data-day="0"] .bx-wrap:nth-child(1)'); await settle(800);
st = await state();
ok('drop on a tile inserts before it', st.days[0].items[0].ex === first && st.days[0].items.length === 6 && st.days[3].items.length === 0);

// rename a day while typing keeps focus
await p.click('.lane[data-day="3"] .day-name'); await p.keyboard.type('Arms'); await settle(500);
st = await state();
ok('day name saved', st.days[3].name === 'Arms');

// custom exercise
await p.evaluate(() => { location.hash = 'favorites'; }); await settle(700);
await p.click('button:has-text("Custom exercise")'); await settle(500);
await p.fill('.sheet input.wide', 'Prime Incline Press');
await p.click('.sheet .chip.tog:has-text("Upper chest")');
await p.click('.sheet .chip.tog:has-text("Front delts")'); await p.click('.sheet .chip.tog:has-text("Front delts")');
await settle(300);
await shot('n2-custom.png');
await p.click('.sheet button:has-text("Add exercise")'); await settle(900);
st = await state();
const cu = st.custom[0];
ok('custom exercise saved with direct + helper muscles', cu && cu.name === 'Prime Incline Press' && cu.p.join() === 'chest_upper' && cu.s.join() === 'delt_front' && st.favorites.includes(cu.id), JSON.stringify(cu));
await shot('n3-custom-sheet.png');
await p.click('.sheet .close'); await settle(400);

// same as last
await p.evaluate(() => { location.hash = 'track'; }); await settle(800);
const before = (await state()).log.length;
await p.locator('.tcard').first().locator('button:has-text("Same as last")').click(); await settle(700);
st = await state();
ok('"Same as last" logs a copy for today', st.log.length === before + 1);
ok('card marked as logged', await p.locator('.tcard').first().locator('.chip.good').isVisible());

// photo in the sheet
await p.locator('.tcard').first().locator('.tc-id').click(); await settle(2500);
const photo = await p.evaluate(() => { const i = document.querySelector('.sheet .photo img'); return i ? { ok: i.complete && i.naturalWidth > 0, src: i.src } : null; });
console.log('photo:', JSON.stringify(photo));
await p.evaluate(() => { const s = document.querySelector('.sheet'); s.scrollTop = 900; }); await settle(400);
await shot('n4-sheet-lower.png');
await p.evaluate(() => { const s = document.querySelector('.sheet'); s.scrollTop = s.scrollHeight; }); await settle(400);
await shot('n5-sheet-bottom.png');
console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no page errors');
await b.close();
process.exit(fail ? 1 : 0);
