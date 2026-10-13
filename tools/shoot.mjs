// Dev helper: open the built file, load the example, and screenshot every page. node tools/shoot.mjs <outdir> [width] [height]
import { chromium } from 'playwright';
import path from 'path';
const out = process.argv[2] || 'shots';
const W = +process.argv[3] || 1440, H = +process.argv[4] || 900;
const file = 'file://' + path.resolve('Lineup.html');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: W < 600 ? 2 : 1, hasTouch: W < 600, isMobile: W < 600 });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await p.goto(file);
await p.waitForSelector('.page-head', { timeout: 8000 }).catch(() => {});
await p.waitForTimeout(900);
await p.screenshot({ path: `${out}/01-split-empty.png` });
const btn = await p.$('.split-empty .btn');
if (btn) { await btn.click(); await p.waitForTimeout(1200); }
await p.screenshot({ path: `${out}/02-split.png` });
await p.screenshot({ path: `${out}/02-split-full.png`, fullPage: true });
for (const pg of ['favorites', 'track', 'table']) {
  await p.evaluate(id => { location.hash = id; }, pg);
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `${out}/03-${pg}.png` });
}
await p.evaluate(() => { location.hash = 'track'; });
await p.waitForTimeout(700);
await p.click('.tc-id');
await p.waitForTimeout(1200);
await p.screenshot({ path: `${out}/04-sheet.png` });
console.log(errs.length ? errs.slice(0, 12).join('\n') : 'no errors');
await b.close();
