// Checks for the full catalog (hand-mapped + auto-mapped lifts) and for variations.  node tools/check4.mjs [outdir]
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';
const out = process.argv[2];
const file = 'file://' + path.resolve('Lineup.html');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb4-'));
const ctx = await chromium.launchPersistentContext(dir, { viewport: { width: 1440, height: 900 } });
const p = ctx.pages()[0];
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
const settle = (ms = 500) => p.waitForTimeout(ms);
const state = () => p.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')));
let fail = 0; const ok = (n, c, x = '') => { if (!c) fail++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${x ? '  → ' + x : ''}`); };
const shot = async name => { if (out) await p.screenshot({ path: `${out}/${name}.png` }); };

await p.goto(file); await p.waitForSelector('.page-head'); await settle();
const foot = await p.locator('#catalog-info').innerText();
ok('catalog has 684 lifts', /^684 exercises/.test(foot), foot.slice(0, 40));

// an auto-mapped lift can go straight into a day without being a favorite first
await p.click('.lane[data-day="0"] .lane-add'); await settle(300);
await p.fill('.picker input[type=search]', 'one arm dumbbell preacher'); await settle(400);
const rowText = await p.locator('.picker .res').first().innerText();
ok('the picker finds it and says it is auto-mapped', /One Arm Dumbbell Preacher Curl/.test(rowText) && /auto-mapped/.test(rowText), rowText.replace(/\s+/g, ' '));
await p.click('.picker .res'); await settle(800); await p.keyboard.press('Escape'); await settle(200);
let st = await state();
ok('added to day 1 straight from the catalog, and it became a favorite', st.days[0].items[0].ex === 'One_Arm_Dumbbell_Preacher_Curl' && st.favorites.includes('One_Arm_Dumbbell_Preacher_Curl'));

// its sheet: flagged as auto-mapped, with description and photos from the source
await p.click('.lane[data-day="0"] .bx'); await settle(300);
await p.click('.item-menu .opt:has-text("View details")'); await settle(1500);
ok('sheet flags the automatic mapping', await p.locator('.sheet .meta.origin').innerText().then(t => /mapped automatically/.test(t)));
ok('sheet has the source description', (await p.$$('.sheet .howto li')).length > 1);
await shot('w1-auto-sheet');

// make a variation of it
await p.click('.sheet button:has-text("Make a variation")'); await settle(500);
const save = p.locator('.sheet button:has-text("Add exercise")');
ok('variation starts with the parent’s muscles and no name', await save.isDisabled() && (await p.$$('.sheet .chip.tog.pri')).length === 1);
await p.fill('.sheet input.wide', 'Preacher Curl'); await settle(200);
ok('a name that is already taken is refused', await save.isDisabled());
await p.fill('.sheet input.wide', 'Single-Arm Machine Preacher Curl'); await settle(200);
await shot('w2-variation-editor');
await save.click(); await settle(1500);
st = await state();
const v = st.custom[0];
ok('variation saved, pointing at its parent', v && v.name === 'Single-Arm Machine Preacher Curl' && v.base === 'One_Arm_Dumbbell_Preacher_Curl' && v.p.join() === 'biceps' && st.favorites.includes(v.id), JSON.stringify(v));
ok('its sheet says what it is a variation of', await p.locator('.sheet .meta.origin').innerText().then(t => /Variation of One Arm Dumbbell Preacher Curl/.test(t)));
ok('it keeps the parent’s description', (await p.$$('.sheet .howto li')).length > 1);
const photo = await p.evaluate(() => { const i = document.querySelector('.sheet .photo img'); return i ? i.src : null; });
ok('and the parent’s photos', !!photo && photo.includes('/One_Arm_Dumbbell_Preacher_Curl/0.jpg'), photo);
await shot('w3-variation-sheet');

// put the variation in day 1 too, log each, and check the histories stay apart
await p.click('.sheet .daypick button:nth-child(1)'); await settle(600);
await p.click('.sheet .close'); await settle(400);
await p.evaluate(() => { location.hash = 'track'; }); await settle(800);
const cards = p.locator('.tcard');
ok('both show on Track as separate exercises', await cards.count() === 2);
for (const [i, w] of [[0, 30], [1, 45]]) {
  const row = cards.nth(i).locator('.setin').first();
  await row.locator('input').nth(0).fill(String(w)); await row.locator('input').nth(1).fill('10');
}
await settle(900);
st = await state();
const byEx = Object.fromEntries(st.log.map(e => [e.ex, e.sets[0].w]));
ok('their logs are separate', byEx['One_Arm_Dumbbell_Preacher_Curl'] === 30 && byEx[v.id] === 45, JSON.stringify(byEx));

// the Favorites page: catalog view draws all of it, and marks where each lift's muscles came from
await p.evaluate(() => { location.hash = 'favorites'; }); await settle(800);
ok('the variation is captioned on the Favorites page', await p.locator('.bx:has-text("Single-Arm Machine Preacher Curl") .cap').innerText().then(t => t === 'variation'));
await shot('w4-favorites-mine');
const t0 = Date.now();
await p.click('.seg.small button:nth-of-type(2)'); await p.waitForSelector('.lane-units .bx'); await settle(300);
const tiles = await p.locator('.lane-units .bx').count();
const autos = await p.locator('.lane-units .bx .cap:text-is("auto-mapped")').count();
ok('catalog view shows every lift and labels the auto-mapped ones', tiles === 685 && autos === 536, `${tiles} tiles, ${autos} auto, drawn in ${Date.now() - t0} ms`);
await p.mouse.move(5, 5); await shot('w5-catalog');
await p.fill('.box-toolbar input[type=search]', 'kettlebell'); await settle(600);
ok('new equipment types are searchable', await p.locator('.lane-units .bx').count() > 40);
await shot('w6-kettlebell');

// reload: the variation and its link survive
await p.reload(); await p.waitForSelector('.page-head'); await settle(700);
st = await state();
ok('survives a reload', st.custom[0].base === 'One_Arm_Dumbbell_Preacher_Curl' && st.log.length === 2);
console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no page errors');
await ctx.close();
fs.rmSync(dir, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
