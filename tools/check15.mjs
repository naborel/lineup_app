// Checks for comparing volume set for set, an option on the Volume chart (every set counts as logged by default):
// with it on, fewer sets never count against you and more count for you. Worked out by hand (100 lb throughout, so volume = 100 × reps):
//   Reverse pec deck, oldest first: 12/11/10 ×3 sessions (3,300 each), a short day 12 (1,200), 12/11/10 (3,300),
//   then cut to 2 sets: 12/11 (2,300) and 13/11 (2,400).
//   Set for set: the 3-set sessions count their best 2 (2,300), the short day is left out →
//     last 3 (2,300, 2,300, 2,400) against the 3 before (2,300 ×3) = +1.4%
//   As logged: last 3 (3,300, 2,300, 2,400 = 2,667) against Sep 10/17/24 (3,300, 3,300, 1,200 = 2,600) = +2.6%
//   Trends (Shoulders, 3 months): set for set first 3 vs last 3 counted = +1.4%; as logged (3,300 → 2,667) = −19%
// node tools/check15.mjs [outdir for screenshots]
import { chromium } from 'playwright';
import path from 'path';
const out = process.argv[2];
const file = 'file://' + path.resolve('Lineup.html');
const b = await chromium.launch();
const errs = [];
let fail = 0; const ok = (n, c, x = '') => { if (!c) fail++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${x ? '  → ' + x : ''}`); };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const sets = (...r) => r.map(x => ({ w: 100, r: x }));
const RPD = 'Reverse_Machine_Flyes', CURL = 'Barbell_Curl', ROW = 'Bent_Over_Barbell_Row', PRESS = 'Machine_Shoulder_Military_Press';
const day = items => ({ name: 'Day', items: items.map((ex, k) => ({ id: ex + k, ex, sets: 3 })) });
function seedOf(log, ex = [RPD], prefs = {}) {
  const days = [day(ex), ...Array.from({ length: 7 }, () => ({ name: '', items: [] }))];
  return { v: 1, days, splits: [{ id: 's1', name: 'T', days }], active: 's1', favorites: [], custom: [], notes: {}, cues: {}, prefs,
    log: log.map(([d, ex, s], i) => ({ id: 'l' + i, date: ago(d), ex, sets: s })) };
}
async function person(name, data, page = 'track') {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(s => { if (location.search === '?seed') localStorage.setItem('liftboard-state', s); }, JSON.stringify(data));
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${name} PAGEERROR ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errs.push(`${name} CONSOLE ${m.text()}`); });
  await p.goto(file + '?seed#' + page); await p.waitForSelector('.page-head'); await p.waitForTimeout(1000);
  return p;
}
const txt = async loc => (await loc.innerText()).replace(/\s+/g, ' ').trim();
const trendOf = async (p, name) => txt(p.locator('.tcard', { has: p.locator('.tc-id .nm', { hasText: name }) }).locator('.tc-stat.vol'));

// ---------- a cut from 3 sets to 2, with a short day: as logged by default ----------
const cut = seedOf([[40, RPD, sets(12, 11, 10)], [33, RPD, sets(12, 11, 10)], [26, RPD, sets(12, 11, 10)], [19, RPD, sets(12)],
  [12, RPD, sets(12, 11, 10)], [5, RPD, sets(12, 11)], [0, RPD, sets(13, 11)]]);
const p = await person('cut', cut);
const settle = (ms = 600) => p.waitForTimeout(ms);
let t = await trendOf(p, 'Reverse Pec Deck');
ok('by default every set counts as logged: +2.6%, no note', /\+2\.6%/.test(t) && !/best|left out/.test(t), t);
await p.locator('.tc-id').click(); await settle(1000);
const chart = () => p.locator('.sheet .chart-block:has(.vol-view)');
ok('the Volume chart offers “Set for set”, with “As logged” chosen and a line on when to use it',
  await chart().locator('.seg button[aria-pressed="true"]').innerText() === 'As logged' && /A dip from doing fewer sets\?/.test(await txt(chart().locator('.vol-view-row'))) && /every exercise and Trends/.test(await txt(chart().locator('.vol-view-row'))));
ok('as logged: no hollow dots, no notes in the history', await chart().locator('.pt.ghost').count() === 0 && !/counted in the trend|left out/.test(await txt(p.locator('.sheet .hist tbody'))) && /Volume trend \+2\.6%/.test(await txt(p.locator('.sheet .stat-tiles'))));
if (out) { await chart().scrollIntoViewIfNeeded(); await p.mouse.move(2, 2); await settle(300); await chart().screenshot({ path: `${out}/v1-logged.png` }); }

// ---------- switched to set for set ----------
await chart().locator('.seg button', { hasText: 'Set for set' }).click(); await settle(1000);
ok('“Set for set”: the short day is a hollow dot off the line', await chart().locator('.pt.ghost').count() === 1 && await chart().locator('.pt').count() === 7);
const hist = await txt(p.locator('.sheet .hist tbody'));
ok('the history marks the sessions counted on 2 of their 3 sets, and the short day', (hist.match(/best 2 counted in the trend/g) || []).length === 4 && /short session: left out of the trend/.test(hist), hist.slice(0, 200));
ok('cutting to 2 sets isn’t a drop: the trend tile reads +1.4%', /Volume trend \+1\.4%/.test(await txt(p.locator('.sheet .stat-tiles'))));
ok('… and it’s remembered', (await p.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')).prefs.volumeView)) === 'sets');
if (out) { await chart().scrollIntoViewIfNeeded(); await p.mouse.move(2, 2); await settle(300); await chart().screenshot({ path: `${out}/v2-sets.png` }); }
await p.keyboard.press('Escape'); await settle(700);
t = await trendOf(p, 'Reverse Pec Deck');
ok('the Track card follows: +1.4% on the best 2 of each earlier session, and says so', /\+1\.4%/.test(t) && /best 2 sets each/.test(t), t);
ok('pointing at it explains why', /Compared set for set: you do 2 sets now/.test(await p.locator('.tc-stat.vol').getAttribute('title')));
await p.evaluate(() => { location.hash = 'trends'; }); await settle(1100);
ok('Trends follow it too: Shoulders volume +1.4%', /Volume \+1\.4%/.test(await txt(p.locator('.tr-card[data-group="Shoulders"]'))), await txt(p.locator('.tr-card[data-group="Shoulders"]')));
await p.locator('#save-status').click(); await settle(400);
ok('the switch lives only on the Volume chart (not in the status menu)', !/Volume/.test(await txt(p.locator('.pop'))));
await p.keyboard.press('Escape'); await settle(300);
await p.evaluate(() => { location.hash = 'track'; }); await settle(900);
await p.locator('.tc-id').click(); await settle(1000);
await chart().locator('.seg button', { hasText: 'As logged' }).click(); await settle(900);
await p.keyboard.press('Escape'); await settle(500);
await p.evaluate(() => { location.hash = 'trends'; }); await settle(1100);
ok('switching back: Trends show every set again (Shoulders −19%)', /Volume −19%/.test(await txt(p.locator('.tr-card[data-group="Shoulders"]'))), await txt(p.locator('.tr-card[data-group="Shoulders"]')));

// ---------- the rule itself (set for set switched on): more sets count for you ----------
const up = await person('up', seedOf([[35, CURL, sets(10, 10)], [28, CURL, sets(10, 10)], [21, CURL, sets(10, 10)], [14, CURL, sets(10, 10, 10)], [7, CURL, sets(10, 10, 10)], [0, CURL, sets(10, 10, 10)]], [CURL], { volumeView: 'sets' }));
t = await trendOf(up, 'Barbell Curl');
ok('going from 2 sets to 3 for good shows as more work: +50%', /\+50%/.test(t) && !/best|left out/.test(t), t);
const extra = await person('extra', seedOf([[21, ROW, sets(10, 10, 10)], [14, ROW, sets(10, 10, 10)], [7, ROW, sets(10, 10, 10)], [0, ROW, sets(10, 10, 10, 10)]], [ROW], { volumeView: 'sets' }));
t = await trendOf(extra, 'Barbell Row');
ok('an extra set on a good day counts while it’s the latest: +17%', /\+17%/.test(t), t);
const after = await person('after', seedOf([[28, ROW, sets(10, 10, 10)], [21, ROW, sets(10, 10, 10)], [14, ROW, sets(10, 10, 10)], [7, ROW, sets(10, 10, 10, 10)], [0, ROW, sets(10, 10, 10)]], [ROW], { volumeView: 'sets' }));
t = await trendOf(after, 'Barbell Row');
ok('… and is compared set for set once you’re back to 3: steady', /steady/.test(t), t);

// ---------- a workout still being logged ----------
const mid = await person('mid', seedOf([[21, PRESS, sets(10, 10, 10)], [14, PRESS, sets(10, 10, 10)], [7, PRESS, sets(10, 10, 11)]], [PRESS], { volumeView: 'sets' }));
const before = await trendOf(mid, 'Machine Shoulder Press');
const ins = mid.locator('.tcard .tc-sets input');
await ins.nth(0).fill('100'); await ins.nth(1).fill('10'); await mid.waitForTimeout(1200);
const during = await trendOf(mid, 'Machine Shoulder Press');
ok('one set into today’s workout, the trend holds still and says why', before.split(' ').slice(0, 4).join(' ') === during.split(' ').slice(0, 4).join(' ') && /fewer sets: left out/.test(during), `${before} | ${during}`);

console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no page errors');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
