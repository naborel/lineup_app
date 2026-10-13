// Checks that Options is now Favorites everywhere, and that data saved under the old name carries over.
// node tools/check6.mjs [outdir for screenshots]
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
const out = process.argv[2];
const file = 'file://' + path.resolve('Lineup.html');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
const settle = (ms = 500) => p.waitForTimeout(ms);
let fail = 0; const ok = (n, c, x = '') => { if (!c) fail++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${x ? '  → ' + x : ''}`); };
const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')));
// every word a person can read or hear on the page: text, tooltips, labels, placeholders
const words = () => p.evaluate(() => [document.body.innerText, ...[...document.querySelectorAll('[title], [aria-label], [placeholder]')].map(e => [e.title, e.getAttribute('aria-label'), e.getAttribute('placeholder')].join(' '))].join('\n'));
const stray = async where => { const m = (await words()).match(/.{0,40}\boptions?\b.{0,40}/i); ok(`no "option" left on ${where}`, !m, m ? m[0] : ''); };

// data as an earlier build saved it: the list is called "options" and the last page was "options"
const old = { v: 1, days: Array.from({ length: 8 }, (_, i) => ({ name: i ? '' : 'Push', items: i ? [] : [{ id: 'i1', ex: 'Barbell_Bench_Press_-_Medium_Grip', sets: 3 }] })),
  options: ['Barbell_Bench_Press_-_Medium_Grip', 'Pullups', 'Preacher_Curl'], custom: [], log: [{ id: 'l1', date: '2026-10-01', ex: 'Pullups', sets: [{ w: 0, r: 9 }] }], notes: {}, prefs: { unit: 'lb', lastDay: 0, page: 'options' } };
// put it in place before the app starts, once (the app saves as it goes, so seeding after it has loaded would be overwritten)
await ctx.addInitScript(s => { if (!sessionStorage.seeded) { localStorage.setItem('liftboard-state', s); sessionStorage.seeded = '1'; } }, JSON.stringify(old));
await p.goto(file + '#options'); await p.waitForSelector('.page-head'); await settle(700);

ok('an old #options link lands on Favorites', await p.locator('.page-head h1').innerText() === 'Favorites' && /#favorites$/.test(p.url()), p.url().split('/').pop());
ok('the tab is called Favorites', (await p.locator('#nav button').allInnerTexts()).join(' ') === 'Split Favorites Track Trends Table Science');
ok('the three saved under the old name are all there', /^3 favorites · 1 in your split/.test(await p.locator('.page-head .sub').innerText()) && await p.locator('.bx-wrap').count() === 3, await p.locator('.page-head .sub').innerText());
ok('"My favorites · 3"', /My favorites · 3/.test(await p.locator('.box-toolbar').innerText()));
await stray('Favorites (mine)');
ok('every group is drawn (three with favorites, three empty with a +), with nothing stray between them', await p.locator('.lanes').evaluate(el => [...el.childNodes].every(n => n.nodeType === 1) && el.children.length === 6 && el.querySelectorAll('.lane.empty-lane .lane-add').length === 3));
await p.locator('.bx-wrap button').first().click(); await settle(300);
await stray('the tile menu');
if (out) await p.screenshot({ path: `${out}/v1-favorites.png` });
await p.keyboard.press('Escape'); await settle(200);

// star something in the catalog: it is saved under the new name, and the old name is gone from the saved data
await p.locator('.box-toolbar .seg button', { hasText: 'Catalog' }).click(); await settle(1500);
await stray('Favorites (catalog)');
await p.locator('.bx-wrap:has-text("Arnold") .rx.star').first().click(); await settle(700);
let st = await saved();
ok('saved under "favorites", with the old three kept and no "options" list left behind', Array.isArray(st.favorites) && st.favorites.length === 4 && old.options.every(id => st.favorites.includes(id)) && !('options' in st), JSON.stringify(Object.keys(st)));

// the other pages and the exercise sheet
for (const pg of ['split', 'track', 'table', 'science']) { await p.evaluate(h => { location.hash = h; }, pg); await settle(800); await stray(pg); }
await p.evaluate(() => { location.hash = 'split'; }); await settle(600);
await p.click('.lane[data-day="1"] .lane-add'); await settle(400);
ok('the picker lists "Your favorites" first', /^Your favorites/i.test(await p.locator('.picker .assign-sub').first().innerText()), await p.locator('.picker .assign-sub').first().innerText());
await stray('the picker');
await p.locator('.picker .res .acts button[title="Details"]').first().click(); await settle(600);
await stray('the exercise sheet');
if (out) await p.screenshot({ path: `${out}/v2-sheet.png` });

// a backup file made by an earlier build still loads
await p.keyboard.press('Escape'); await settle(300); await p.keyboard.press('Escape'); await settle(300);
await p.evaluate(() => { location.hash = 'split'; }); await p.reload(); await p.waitForSelector('.page-head'); await settle(500);
const backup = path.resolve(out || '.', '_old-backup.json');
fs.writeFileSync(backup, JSON.stringify({ app: 'liftboard', exported: '2026-10-10T00:00:00Z', ...old, options: ['Face_Pull', 'Pullups'] }));
await p.click('#save-status'); await settle(300);
const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.pop .opt', { hasText: /Load a backup/ }).click()]);
await chooser.setFiles(backup); await settle(900);
st = await saved();
ok('an old backup file loads with its list as favorites', st.favorites.join() === 'Face_Pull,Pullups' && !('options' in st), JSON.stringify(st.favorites));
fs.unlinkSync(backup);
console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no page errors');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
