// Checks for the Trends page: progress by muscle group, with sessions whose answers are worked out by hand.
//   Lat pulldown, 3 sessions: 100 × 10, 105 × 10, 110 × 10 → strength (Est. 1RM) +10%, volume +10%
//   Barbell curl, 2 sessions: 60 × 10, 60 × 8               → strength −5%, volume −20%
//   Bench press, 40 and 10 days ago: 185 × 5, 195 × 5        → +5.4% (and in a 4-week window, the session
//                                                              before the window still anchors it)
//   Leg press, 200 and 190 days ago                          → only in the "All" window
// Only exercises that train a muscle directly count: biceps is the curl alone (−5%); the pulldown only helps it.
// Shoulders: nothing trains them directly (the bench and pulldown only help) → no trend, and it says so.
// node tools/check11.mjs [outdir for screenshots]
import { chromium } from 'playwright';
import path from 'path';
const out = process.argv[2];
const file = 'file://' + path.resolve('Lineup.html');
const b = await chromium.launch();
const errs = [];
let fail = 0; const ok = (n, c, x = '') => { if (!c) fail++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${x ? '  → ' + x : ''}`); };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const S = (w, ...r) => r.map(x => ({ w, r: x }));
const L = 'Wide-Grip_Lat_Pulldown', C = 'Barbell_Curl', B = 'Barbell_Bench_Press_-_Medium_Grip', P = 'Leg_Press';
const seed = { v: 1, days: [{ name: 'Day', items: [L, C, B].map((ex, k) => ({ id: 'i' + k, ex, sets: 1 })) }], favorites: [], custom: [], notes: {}, cues: {}, prefs: {},
  log: [
    { id: 'l1', date: ago(20), ex: L, sets: S(100, 10) }, { id: 'l2', date: ago(13), ex: L, sets: S(105, 10) }, { id: 'l3', date: ago(6), ex: L, sets: S(110, 10) },
    { id: 'c1', date: ago(12), ex: C, sets: S(60, 10) }, { id: 'c2', date: ago(5), ex: C, sets: S(60, 8) },
    { id: 'b1', date: ago(40), ex: B, sets: S(185, 5) }, { id: 'b2', date: ago(10), ex: B, sets: S(195, 5) },
    { id: 'p1', date: ago(200), ex: P, sets: S(300, 10) }, { id: 'p2', date: ago(190), ex: P, sets: S(320, 10) },
  ] };
async function person(name, data) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  // seed once per browser: the flag lives in localStorage, so a reload can't seed again over what the page saved
  // seed only on the first visit (?seed): a flag in storage could be read before the last page's writes land
  if (data) await ctx.addInitScript(s => { if (location.search === '?seed') localStorage.setItem('liftboard-state', s); }, JSON.stringify(data));
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${name} PAGEERROR ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errs.push(`${name} CONSOLE ${m.text()}`); });
  await p.goto(file + (data ? '?seed' : '') + '#trends'); await p.waitForSelector('.page-head'); await p.waitForTimeout(1300);
  return p;
}
const p = await person('me', seed);
const settle = (ms = 500) => p.waitForTimeout(ms);
const card = g => p.locator(`.tr-card[data-group="${g}"]`);
const txt = async loc => (await loc.innerText()).replace(/\s+/g, ' ').trim();
const colour = (z, side = 'front') => p.evaluate(([zz, sd]) => getComputedStyle(document.querySelector(`.bm-grad[id*="-${sd}-${zz}"]`)).getPropertyValue('--c').trim(), [z, side]);

ok('Trends sits between Track and Table', (await p.locator('#nav button').allInnerTexts()).join(' ') === 'Split Favorites Track Trends Table Science');
ok('3 months is the window to start with', await p.locator('.page-head .seg button[aria-pressed="true"]').innerText() === '3 months');
ok('every group has a card', await p.locator('.tr-card').count() === 6);
ok('Back: the pulldown, +10% strength and +10% volume', /Strength \+10%/.test(await txt(card('Back'))) && /Volume \+10%/.test(await txt(card('Back'))) && /1 exercise\b/.test(await txt(card('Back'))), await txt(card('Back')));
ok('Chest: the bench, +5.4%', /Strength \+5\.4%/.test(await txt(card('Chest'))), await txt(card('Chest')));
ok('Legs: nothing in the last 3 months', /No sessions in this window/.test(await txt(card('Legs'))));
ok('Shoulders: only helpers, so no trend, and it says why', /No direct exercise · \d help/.test(await txt(card('Shoulders'))) && !/Strength/.test(await txt(card('Shoulders'))), await txt(card('Shoulders')));
ok('the summary counts the groups getting stronger', /^2 of 6 muscle groups getting stronger · 1 weaker · 3 exercises with sessions in the last 3 months$/.test(await txt(p.locator('.page-head .sub'))), await txt(p.locator('.page-head .sub')));
await settle(900);
ok('lats are full green (+10%), biceps amber (−5%, the curl alone), quads silver (no sessions)',
  await colour('lats', 'back') === 'rgb(85, 211, 167)' && await colour('biceps') === 'rgb(201, 165, 115)' && await colour('quads') === 'rgb(155, 162, 180)',
  `${await colour('lats', 'back')} · ${await colour('biceps')} · ${await colour('quads')}`);
if (out) { await p.mouse.move(5, 5); await settle(300); await p.screenshot({ path: `${out}/t1-page.png` }); }

// the key: point at a colour for what it means
const kt = p.locator('.tr-ktip');
// waits (up to 2 s) for the definition to finish fading in or out
const shown = want => kt.evaluate((el, w) => new Promise(res => { const t0 = performance.now(); (function wait() { const o = getComputedStyle(el).opacity; if (o === w) res(true); else if (performance.now() - t0 > 2000) res(false); else requestAnimationFrame(wait); })(); }), want ? '1' : '0');
ok('the definitions are hidden until you point at the key', await shown(false));
await p.locator('.tr-legend .key[data-k="flat"]').hover();
ok('pointing at Steady explains it', await shown(true) && /^Steady Within 1% either way/.test(await txt(kt)), await txt(kt));
await p.locator('.tr-legend .key[data-k="none"]').hover(); await settle(400);
ok('moving to No direct work swaps the text', /^No direct work Nothing in this window trains this muscle as its main muscle/.test(await txt(kt)) && await p.locator('.tr-legend .key.on').count() === 1);
const tb = await kt.boundingBox(), lb = await p.locator('.tr-legend').boundingBox(), cb = await p.locator('.tr-body').boundingBox();
ok('it opens above the key, inside the body card', tb.y + tb.height <= lb.y + 1 && tb.x >= cb.x && tb.x + tb.width <= cb.x + cb.width + 1, JSON.stringify({ tb, lb }));
if (out) await p.screenshot({ path: `${out}/t1b-key.png` });
await p.mouse.move(5, 5);
ok('and goes away when you move off', await shown(false));
await p.locator('.tr-legend .key[data-k="up"]').focus();
ok('it works from the keyboard too', await shown(true) && /^Getting stronger/.test(await txt(kt)), await txt(kt));
await p.keyboard.press('Escape');
ok('Escape closes it', await shown(false));

// hover and click a muscle on the body
const lat = p.locator('.bodymap [data-zone="lats"], .bodymap path[data-z="lats"]').first();
const bx = await p.locator('.bm-grad[id*="-back-lats"]').evaluate(g => { const el = document.querySelector(`[fill="url(#${g.id})"]`); const r = el.getBoundingClientRect(); return { x: r.x + r.width * 0.3, y: r.y + r.height * 0.5 }; });
void lat;
await p.mouse.move(bx.x, bx.y); await settle(300);
ok('pointing at the lats: strength, volume and how many exercises', /Lats/.test(await txt(p.locator('.bm-tip'))) && /Strength \+10% · volume \+10% · 1 exercise/.test(await txt(p.locator('.bm-tip'))), await txt(p.locator('.bm-tip')));
await p.mouse.click(bx.x, bx.y); await settle(900);
ok('clicking them opens Back, with the Lats row picked out', /^Back/.test(await txt(p.locator('.sheet .tr-hero'))) && await p.locator('.sheet .tr-mrow.focus[data-z="lats"]').count() === 1);
const tiles = await txt(p.locator('.sheet .stat-tiles'));
ok('the group sheet: strength, volume, exercises, sessions', /Strength \+10% Volume \+10% Exercises 1 Sessions 3/.test(tiles), tiles);
ok('it lists the exercise with its own trend', /Lat Pulldown \(wide grip\).*\+10%.*\+10%/.test(await txt(p.locator('.sheet .tr-ex'))), await txt(p.locator('.sheet .tr-ex')));
if (out) await p.screenshot({ path: `${out}/t2-back.png` });
await p.locator('.sheet .tr-ex .res').first().click(); await settle(900);
ok('clicking the exercise opens its details', /Lat Pulldown \(wide grip\)/.test(await txt(p.locator('.sheet .sheet-hero h3'))));
await p.keyboard.press('Escape'); await settle(500);

// biceps: the curl alone (−5%); the pulldown helps but doesn't count
await card('Arms').click(); await settle(900);
const bi = await txt(p.locator('.sheet .tr-mrow[data-z="biceps"]'));
ok('biceps: the curl alone, −5% (the pulldown only helps, so it is left out)', /1 exercise\b/.test(bi) && /−5%/.test(bi) && !/helping/.test(bi), bi);
const tri = await txt(p.locator('.sheet .tr-mrow[data-z="tri_lat"]'));
ok('triceps (lateral head): the bench only helps, so no trend', /no direct exercise · 1 helps/.test(tri) && !/%/.test(tri), tri);
const exs = await txt(p.locator('.sheet .tr-ex'));
ok('the curl shows −5% strength and −20% volume, in amber', /Barbell Curl.*−5%.*−20%/.test(exs) && await p.locator('.sheet .tr-ex .res', { hasText: 'Barbell Curl' }).locator('.trend.down').count() === 2, exs.slice(0, 160));
ok('only the curl is listed under Arms', await p.locator('.sheet .tr-ex .res').count() === 1 && !/Lat Pulldown/.test(exs), exs.slice(0, 160));
await p.keyboard.press('Escape'); await settle(500);

// the window
await p.locator('.page-head .seg button', { hasText: 'All' }).click(); await settle(900);
ok('All: the old leg press shows up (+6.7%)', /Strength \+6\.7%/.test(await txt(card('Legs'))), await txt(card('Legs')));
ok('the window is remembered', (await p.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')).prefs.trendWindow)) === 'all');
await p.locator('.page-head .seg button', { hasText: '4 weeks' }).click(); await settle(900);
ok('4 weeks: the bench still compares with its session before the window (+5.4%)', /Strength \+5\.4%/.test(await txt(card('Chest'))), await txt(card('Chest')));
await card('Chest').click(); await settle(800);
ok('… which counts as one of its two sessions', /Sessions 2/.test(await txt(p.locator('.sheet .stat-tiles'))));
await p.keyboard.press('Escape'); await settle(400);
// reopening: a new browser started from what this one saved (reloading a file:// page in the test browser
// sometimes comes back to empty storage, which a real Chrome doesn't do)
const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')));
const again = await person('again', saved);
const pressed = await again.locator('.page-head .seg button[aria-pressed="true"]').innerText();
ok('and it reopens on the window you picked', pressed === '4 weeks', pressed);
await again.evaluate(() => { location.hash = 'track'; }); await again.waitForTimeout(600);
await again.evaluate(() => { location.hash = 'trends'; }); await again.waitForTimeout(800);
ok('… also after visiting another page', await again.locator('.page-head .seg button[aria-pressed="true"]').innerText() === '4 weeks');

// nothing logged yet
const fresh = await person('fresh', null);
ok('with nothing logged: a pointer to Track, and empty cards', /Log a couple of sessions/.test(await txt(fresh.locator('.page-head .sub'))) && await fresh.locator('.tr-card .tr-empty').count() === 6);

// the example: lots of sessions, a busy chart keeps only its latest dot
const ex = await person('example', null);
await ex.evaluate(() => { location.hash = 'split'; }); await ex.waitForTimeout(700);
await ex.locator('.split-empty button', { hasText: 'Load an example' }).click(); await ex.waitForTimeout(900);
await ex.evaluate(() => { location.hash = 'trends'; }); await ex.waitForTimeout(1300);
await ex.locator('.tr-card[data-group="Back"]').click(); await ex.waitForTimeout(900);
ok('a chart with many sessions shows the line with just its latest dot', await ex.locator('.sheet .chart.dense').count() === 1
  && await ex.locator('.sheet .chart.dense .pt').evaluateAll(ds => ds.filter(d => getComputedStyle(d).opacity !== '0').length) === 1);
console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no page errors');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
