// Checks for the helper cap and the Science page.  node tools/check3.mjs [outdir for screenshots]
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
const colour = z => p.evaluate(zz => getComputedStyle(document.querySelector(`.bm-grad[id*="-front-${zz}"]`)).getPropertyValue('--c').trim(), z);
const add = async (day, name) => {
  await p.click(`.lane[data-day="${day}"] .lane-add`); await settle(300);
  await p.fill('.picker input[type=search]', name); await settle(300);
  await p.click('.picker .res'); await settle(800);
  await p.keyboard.press('Escape'); await settle(200);
};
await p.goto(file); await p.waitForSelector('.page-head'); await settle();
const silver = await colour('chest_upper');

// upper chest is only helped by these three
await add(0, 'machine chest press');
const one = await colour('chest_upper');
await add(1, 'dumbbell bench press');
const two = await colour('chest_upper');
await add(2, 'pec deck');
const three = await colour('chest_upper');
ok('one helper tints the muscle', one !== silver, `${silver} → ${one}`);
ok('helpers stop at the cap: two and three helpers look the same', two === three && two !== one, `two ${two} · three ${three}`);
const row = await p.locator('.cov-row[data-z="chest_upper"]').innerText();
ok('By muscle says "helped" and still counts the half sets', /helped/.test(row) && /4\.5 sets/.test(row), row.replace(/\s+/g, ' '));
if (out) { await p.mouse.move(5, 5); await settle(400); await (await p.$('.cover')).screenshot({ path: `${out}/s1-helped-only.png` }); }

// one direct lift for it, on its own: the "once" colour, which must be redder than any pile of helpers
await p.evaluate(() => { location.hash = 'science'; }); await settle(700);
const rows = await p.locator('.ex-row').evaluateAll(els => els.map(e => ({ t: e.querySelector('.ex-t b').textContent, n: e.querySelector('.ex-n b').textContent, held: (e.querySelector('.ex-n span') || {}).textContent || '', sw: getComputedStyle(e.querySelector('.sw')).backgroundColor })));
const by = t => rows.find(r => r.t.startsWith(t));
ok('worked examples: 1, 2, 1.4, 3', by('One direct lift').n === '1' && by('Two direct').n === '2' && by('The same two').n === '1.4' && by('Direct work on three').n === '3', rows.map(r => r.n).join(', '));
ok('a helper on top of direct work counts 30%: 1.15, and three of them 1.45', by('One direct lift, and a helper').n === '1.15' && by('One direct lift, and three helpers').n === '1.45', by('One direct lift, and three helpers').held);
ok('one direct lift plus three helpers stays short of two direct lifts', by('One direct lift, and three helpers').sw !== by('Two direct').sw && +by('One direct lift, and three helpers').n < 2);
ok('three helpers are held at 0.6 (from 1.5)', by('Three helpers').n === '0.6' && /1\.5/.test(by('Three helpers').held), by('Three helpers').held);
ok('helped-only colour on the model matches the example and differs from one direct lift', by('Three helpers').sw === three && by('One direct lift').sw !== three, `${three} vs once ${by('One direct lift').sw}`);
ok('science page has 11 cards and working source links', (await p.$$('.sci-card')).length === 11 && (await p.$$('.sci-src a[href^="https://"]')).length >= 15);
if (out) { await p.screenshot({ path: `${out}/s2-science.png` }); await p.screenshot({ path: `${out}/s3-science-full.png`, fullPage: true }); }

// back on Split: add a direct lift and the muscle joins the red scale, helpers counting on top
await p.evaluate(() => { location.hash = 'split'; }); await settle(700);
await add(3, 'incline dumbbell press');
const withDirect = await colour('chest_upper');
ok('a direct lift lifts the cap', withDirect !== three, withDirect);
ok('and the model shows the same 1.45 as the worked example', withDirect === by('One direct lift, and three helpers').sw, `${withDirect} vs ${by('One direct lift, and three helpers').sw}`);
const row2 = await p.locator('.cov-row[data-z="chest_upper"]').innerText();
ok('By muscle now says 1×', /1×/.test(row2), row2.replace(/\s+/g, ' '));
if (out) { await p.mouse.move(5, 5); await settle(500); await (await p.$('.cover')).screenshot({ path: `${out}/s4-with-direct.png` }); }
console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no page errors');
await b.close();
process.exit(fail ? 1 : 0);
