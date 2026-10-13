// Dev helper: targeted screenshots of interactions. node tools/shoot2.mjs <outdir>
import { chromium } from 'playwright';
import path from 'path';
const out = process.argv[2];
const file = 'file://' + path.resolve('Lineup.html');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await p.goto(file);
await p.waitForSelector('.page-head');
await p.waitForTimeout(700);
const cover = await p.$('.cover');
await cover.screenshot({ path: `${out}/a-body-empty.png` });
await p.click('.split-empty .btn');
await p.waitForTimeout(1300);
await p.mouse.move(5, 5);
await p.waitForTimeout(700);
await (await p.$('.cover')).screenshot({ path: `${out}/b-body-sample.png` });
// click a muscle: upper chest on the front view
const box = await p.evaluate(() => { const el = document.querySelector('.mz[data-z="chest_upper"]'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await p.mouse.move(box.x, box.y); await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/c-hover-muscle.png`, clip: { x: 0, y: 0, width: 1440, height: 900 }, scale: 'css' });
await p.mouse.click(box.x, box.y); await p.waitForTimeout(700);
await p.screenshot({ path: `${out}/d-picker-muscle.png`, scale: 'css' });
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
// item menu
await p.click('.lane[data-day="0"] .bx'); await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/e-item-menu.png`, scale: 'css' });
await p.keyboard.press('Escape');
// day picker
await p.click('.lane[data-day="3"] .lane-add'); await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/f-picker-day.png`, scale: 'css' });
await p.keyboard.press('Escape');
// tile hover preview
await p.hover('.lane[data-day="1"] .bx-wrap:nth-child(2)'); await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/g-tile-hover.png`, scale: 'css' });
// favorites catalog
await p.evaluate(() => { location.hash = 'favorites'; }); await p.waitForTimeout(700);
await p.click('.seg.small button:nth-of-type(2)'); await p.waitForTimeout(900);
await p.mouse.move(5, 5);
await p.screenshot({ path: `${out}/h-catalog.png`, scale: 'css' });
// track
await p.evaluate(() => { location.hash = 'track'; }); await p.waitForTimeout(900);
await p.screenshot({ path: `${out}/i-track.png`, scale: 'css' });
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/j-archive.png`, scale: 'css' });
console.log(errs.length ? errs.slice(0, 12).join('\n') : 'no errors');
await b.close();
