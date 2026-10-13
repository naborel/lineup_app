// Checks for weight and reps as the progress measures: the Reps card on Track (in place of Volume), and the
// details: a Weight and reps chart (weight on the left axis, reps on the right, smooth lines scaled alike),
// then Volume and Est. 1RM as charts of their own.
// Uses the Barbell Row numbers from the user's own test: 215 × 12, 8, 6 then 225 × 8, 5, 4 → 8, 5, 5 → 9, 5, 5.
// node tools/check10.mjs [outdir for screenshots]
import { chromium } from 'playwright';
import path from 'path';
const out = process.argv[2];
const file = 'file://' + path.resolve('Lineup.html');
const b = await chromium.launch();
const errs = [];
let fail = 0; const ok = (n, c, x = '') => { if (!c) fail++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${x ? '  → ' + x : ''}`); };
const R = 'Bent_Over_Barbell_Row', C = 'Barbell_Curl', P = 'Pullups', K = 'Seated_Cable_Rows', M = 'Lying_T-Bar_Row';
const S = (w, ...reps) => reps.map(r => ({ w, r }));
const seed = { v: 1, days: [{ name: 'Pull', items: [{ id: 'i1', ex: R, sets: 3 }, { id: 'i2', ex: C, sets: 2 }, { id: 'i3', ex: P, sets: 2 }, { id: 'i4', ex: 'Face_Pull', sets: 3 }, { id: 'i5', ex: K, sets: 3 }, { id: 'i6', ex: M, sets: 3 }] }], favorites: [], custom: [], notes: {}, cues: {}, prefs: {},
  log: [
    { id: 'a', date: '2026-10-09', ex: R, sets: S(215, 12, 8, 6) },
    { id: 'b', date: '2026-10-10', ex: R, sets: S(225, 8, 5, 4) },
    { id: 'c', date: '2026-10-11', ex: R, sets: S(225, 8, 5, 5) },
    { id: 'd', date: '2026-10-12', ex: R, sets: S(225, 9, 5, 5) },
    { id: 'e', date: '2026-10-08', ex: C, sets: S(60, 12, 10) },
    { id: 'f', date: '2026-10-11', ex: C, sets: S(65, 8, 7) },          // ends on a weight jump
    { id: 'g', date: '2026-10-05', ex: P, sets: S(null, 10, 8) },
    { id: 'h', date: '2026-10-09', ex: P, sets: S(null, 11, 9) },       // bodyweight
    { id: 'k', date: '2026-10-10', ex: 'Face_Pull', sets: S(40, 15, 15, 12) },   // one session only
    { id: 'm1', date: '2026-10-02', ex: K, sets: S(150, 6, 5, 5) },               // the same weight throughout
    { id: 'm2', date: '2026-10-04', ex: K, sets: S(150, 6, 6, 5) },
    { id: 'm3', date: '2026-10-06', ex: K, sets: S(150, 7, 6, 5) },
    { id: 'm4', date: '2026-10-08', ex: K, sets: S(150, 7, 6, 6) },
    // mixed weights in a session (the user's example), then a session with a heavier top set
    { id: 'n1', date: '2026-10-03', ex: M, sets: [{ w: 215, r: 12 }, { w: 225, r: 8 }, { w: 225, r: 6 }] },
    { id: 'n2', date: '2026-10-07', ex: M, sets: [{ w: 215, r: 12 }, { w: 225, r: 9 }, { w: 225, r: 7 }] },
    { id: 'n3', date: '2026-10-11', ex: M, sets: [{ w: 225, r: 10 }, { w: 235, r: 6 }, { w: 225, r: 7 }] },
  ] };
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addInitScript(s => { if (!sessionStorage.seeded) { localStorage.setItem('liftboard-state', s); sessionStorage.seeded = '1'; } }, JSON.stringify(seed));
const p = await ctx.newPage();
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
const settle = (ms = 500) => p.waitForTimeout(ms);
await p.goto(file + '#track'); await p.waitForSelector('.page-head'); await settle(1200);
const card = name => p.locator('.tcard', { has: p.locator('.tc-id .nm', { hasText: new RegExp(`^${name}$`) }) });
const stats = async name => (await card(name).locator('.tc-stat').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());

// ---------- Track ----------
let row = await stats('Barbell Row');
ok('three cards: Best set, Volume trend, Est. 1RM; no raw volume number', row.length === 3 && /^Best set/.test(row[0]) && /^Volume trend/.test(row[1]) && /^Est\. 1RM/.test(row[2]) && !/lb/.test(row[1]), row.join(' | '));
// 4 sessions: the last 2 against the 2 before. (4,050 + 4,275) / (5,590 + 3,825) − 1 = −11.6%
ok('four sessions: last 2 against the 2 before, −12% (the weight jump costs reps), in amber', /−12%/.test(row[1]) && /last 2/.test(row[1]) && await card('Barbell Row').locator('.tc-stat.vol b.trend.down').count() === 1, row[1]);
const cable = await stats('Seated Cable Row');
ok('same weight, reps creeping up: +12%, in green', /\+12%/.test(cable[1]) && /last 2/.test(cable[1]) && await card('Seated Cable Row').locator('.tc-stat.vol b.trend.up').count() === 1, cable[1]);
const curl = await stats('Barbell Curl');
ok('two sessions: last time against the time before', /vs last time/.test(curl[1]) && /−26%/.test(curl[1]), curl[1]);
const tbar = await stats('Chest-Supported T-Bar Row');
ok('three sessions: still last time against the time before', /vs last time/.test(tbar[1]), tbar[1]);
const pull = await stats('Pull-Up');
ok('bodyweight: a reps trend, +11%', /^Reps trend/.test(pull[1]) && /\+11%/.test(pull[1]), pull[1]);
ok('one session so far: "first session"', /first session/.test((await stats('Face Pull'))[1]));
if (out) await p.screenshot({ path: `${out}/r1-track.png`, fullPage: true });

// ---------- details ----------
await card('Barbell Row').locator('.tc-id').click(); await settle(900);
const tiles = (await p.locator('.sheet .stat-tiles > div').allInnerTexts()).map(t => t.replace(/\s+/g, ' '));
ok('details tiles: Best set, Volume trend, Reps at 225, Est. 1RM (no "Last": that\'s in History)', tiles.length === 4 && /^Best set · Oct 12 225 × 9/.test(tiles[0]) && /^Volume trend −12%/.test(tiles[1]) && /^Reps at 225 19 reps/.test(tiles[2]) && /^Est\. 1RM now 293 lb/.test(tiles[3]) && !tiles.some(t => /^Last/.test(t)), tiles.join(' | '));
ok('the trend tile is amber going down, like the Track card', await p.locator('.sheet .stat-tiles b.trend.down').count() === 1);
ok('no tile label is cut short', await p.locator('.sheet .stat-tiles span').evaluateAll(sp => sp.every(s => s.scrollWidth <= s.clientWidth)));
const head = (await p.locator('.sheet .chart-block').first().locator('.chart-head').innerText()).replace(/\s+/g, ' ');
ok('first chart is Weight and reps, with +1 rep', /^Weight and reps/.test(head) && /\+1 rep/.test(head), head);
const key = (await p.locator('.sheet .combo-key').innerText()).replace(/\s+/g, ' ');
ok('its key: average weight and total reps, and what they multiply to', /Average weight \(lb\)/.test(key) && /Total reps/.test(key) && /Average weight × total reps = volume/.test(await p.locator('.sheet .combo-note').innerText()), key);
const kb = await p.locator('.sheet .combo-key .ck').evaluateAll(cs => cs.map(c => c.getBoundingClientRect()));
const ax = await p.locator('.sheet .combo .yax').evaluateAll(ys => ys.map(y => y.getBoundingClientRect()));
ok('the weight key sits over the left axis and the reps key over the right', kb.length === 2 && Math.abs(kb[0].left - ax[0].left) < 4 && Math.abs(kb[1].right - ax[1].right) < 4 && Math.abs(kb[0].top - kb[1].top) < 2,
  JSON.stringify({ k: kb.map(r => [Math.round(r.left), Math.round(r.right)]), a: ax.map(r => [Math.round(r.left), Math.round(r.right)]) }));
const paths = await p.locator('.sheet .combo svg path').evaluateAll(ps => ps.map(x => ({ cls: x.getAttribute('class') || '', d: x.getAttribute('d'), fill: x.getAttribute('fill') || '' })));
const lines = k => paths.filter(x => x.cls === `ln ${k}`);
ok('two measures, each one connected line through every session', lines('w').length === 1 && lines('r').length === 1 && (lines('r')[0].d.match(/M/g) || []).length === 1 && (lines('r')[0].d.match(/C/g) || []).length === 3);
ok('the lines are smooth curves through the points', /C/.test(lines('w')[0].d) && /C/.test(lines('r')[0].d));
ok('each has a soft fade under it, like the 1RM chart', paths.filter(x => x.fill.startsWith('url(')).length === 2);
ok('no dashed guide at the weight change', await p.locator('.sheet .combo .guide').count() === 0);
// one centred scale of change for both lines: equal percentages are equal distances
const tops = k => p.locator(`.sheet .combo .pt.${k}`).evaluateAll(ds => ds.map(d => parseFloat(d.style.top)));
const tw = await tops('w'), tr = await tops('r');   // weight: 215, 225, 225, 225 · reps: 26, 17, 18, 19
const ratio = (tw[0] - tw[1]) / (tr[1] - tr[0]), want = Math.log(225 / 215) / Math.log(26 / 17);
ok('a 10 lb jump on 215 (+4.7%) rises in proportion to the reps swing 17 → 26 (+53%)', Math.abs(ratio - want) < 0.01, `${ratio.toFixed(3)} vs ${want.toFixed(3)}`);
ok('both lines are centred on the chart', Math.abs((tw[0] + tw[1]) / 2 - 50) < 0.5 && Math.abs((Math.min(...tr) + Math.max(...tr)) / 2 - 50) < 0.5, JSON.stringify({ tw, tr }));
ok('the line that moved most (reps) fills the chart', Math.abs(Math.min(...tr) - 10) < 0.5 && Math.abs(Math.max(...tr) - 90) < 0.5);
ok('both weights are labelled on the left axis', (await p.locator('.sheet .combo .yax:not(.r) span').allInnerTexts()).join() === '225,215');
const leftTicks = await p.locator('.sheet .combo .yax:not(.r) span').allInnerTexts();
const rightTicks = await p.locator('.sheet .combo .yax.r span').evaluateAll(sp => sp.map(x => ({ t: x.textContent, y: x.getBoundingClientRect().top })));
ok('left axis: the weights, 225 and 215', leftTicks.join() === '225,215', leftTicks.join());
const apart = rightTicks.every((a, i) => rightTicks.every((c, j) => i === j || Math.abs(a.y - c.y) >= 14));
ok('right axis: the reps, top and bottom always, no numbers touching', rightTicks.some(x => x.t === '26') && rightTicks.some(x => x.t === '17') && apart, rightTicks.map(x => x.t).join());
const colours = await p.evaluate(() => {
  const c = sel => getComputedStyle(document.querySelector(sel)).stroke || getComputedStyle(document.querySelector(sel)).color;
  return { w: c('.sheet .combo .ln.w'), r: c('.sheet .combo .ln.r'), tw: getComputedStyle(document.querySelector('.sheet .combo .yax span.w')).color, tr: getComputedStyle(document.querySelector('.sheet .combo .yax span.r')).color };
});
ok('each line has its own colour, and each axis is coloured like its line', colours.w !== colours.r && colours.tw !== colours.tr, JSON.stringify(colours));
const plot = await p.locator('.sheet .combo .plot').boundingBox();
await p.mouse.move(plot.x + plot.width * 0.34, plot.y + 30); await settle(300);
const tip = (await p.locator('.sheet .combo .tip').innerText()).replace(/\s+/g, ' ');
ok('pointing at a session shows its sets, and average weight × total reps = volume', /225 × 8, 5, 4/.test(tip) && /avg 225 lb × 17 reps = 3,825 lb/.test(tip), tip);
if (out) { await p.locator('.sheet').evaluate(el => el.querySelector('.chart-block').scrollIntoView({ block: 'start' })); await settle(300); await p.screenshot({ path: `${out}/r2-details.png` }); }
const vhead = (await p.locator('.sheet .chart-block').nth(1).locator('.chart-head').innerText()).replace(/\s+/g, ' ').trim();
ok('Volume is its own chart again, second, with its trend (+5.6%)', /^Volume/.test(vhead) && /\+5\.6%/.test(vhead) && await p.locator('.sheet .chart-block').nth(1).locator('.chart .pt').count() === 4, vhead);
ok('Est. 1RM chart is third', /^Est\. 1RM/.test((await p.locator('.sheet .chart-block').nth(2).locator('.chart-head').innerText()).trim()));
const hist = (await p.locator('.sheet table.hist').innerText()).replace(/\s+/g, ' ');
ok('history shows reps, with the weight jump marked', /Date Sets Reps Est\. 1RM/.test(hist) && /225 × 8, 5, 4 17 10 lb 285/.test(hist) && !/Volume/.test(hist), hist.slice(0, 200));
await p.keyboard.press('Escape'); await settle(500);

// mixed weights: the weight line is the average per rep, the reps line counts every rep
await card('Chest-Supported T-Bar Row').locator('.tc-id').click(); await settle(900);
const mw = await tops('w'), mr = await tops('r');
const avg = [(215 * 12 + 225 * 14) / 26, (215 * 12 + 225 * 16) / 28, (225 * 17 + 235 * 6) / 23], tot = [26, 28, 23];
const lw = Math.log(Math.max(...avg) / Math.min(...avg)), lr = Math.log(Math.max(...tot) / Math.min(...tot));
ok('mixed weights: average weight per rep, total reps, on the same scale of change', Math.abs(Math.abs((mw[0] - mw[2]) / (mr[1] - mr[2])) - Math.log(avg[2] / avg[0]) / Math.log(tot[1] / tot[2])) < 0.02 && lr > lw, JSON.stringify({ mw, mr }));
const lt = await p.locator('.sheet .combo .yax:not(.r) span').allInnerTexts();
ok('the left axis shows the averages (220.4 … 227.6)', lt.includes('227.6') && lt.includes('220.4'), lt.join());
const mp = await p.locator('.sheet .combo .plot').boundingBox();
await p.mouse.move(mp.x + 4, mp.y + 30); await settle(300);
const mt = (await p.locator('.sheet .combo .tip').innerText()).replace(/\s+/g, ' ');
ok('its tooltip: 215×12 · 225×8 · 225×6, avg 220.4 lb × 26 reps = 5,730 lb', /215×12 · 225×8 · 225×6/.test(mt) && /avg 220\.4 lb × 26 reps = 5,730 lb/.test(mt), mt);
ok('a heavier top set (235) keeps the reps line connected, with no guide', await p.locator('.sheet .combo .guide').count() === 0 && await p.locator('.sheet .combo svg path.ln.r').count() === 1);
await p.keyboard.press('Escape'); await settle(500);

// the same weight throughout: a flat weight line through the middle, the reps filling the chart
await card('Seated Cable Row').locator('.tc-id').click(); await settle(900);
const kw = await tops('w'), kr = await tops('r');
ok('same weight throughout: weight is flat through the middle and the reps fill the chart', kw.every(y => Math.abs(y - 50) < 0.5) && Math.abs(Math.min(...kr) - 10) < 0.5 && Math.abs(Math.max(...kr) - 90) < 0.5, JSON.stringify({ kw, kr }));
await p.keyboard.press('Escape'); await settle(500);

// bodyweight: just reps
await card('Pull-Up').locator('.tc-id').click(); await settle(900);
ok('bodyweight lifts get a plain Reps chart (no weight, no key) and no separate volume chart', /^Reps/.test((await p.locator('.sheet .chart-block').first().locator('.chart-head').innerText()).trim())
  && await p.locator('.sheet .combo svg path.ln').count() === 1 && await p.locator('.sheet .combo-key').count() === 0
  && await p.locator('.sheet .chart-block').count() === 2 && !/\bnull\b/.test(await p.locator('.sheet').innerText()));
await p.keyboard.press('Escape'); await settle(500);
// one session: draws without lines, no errors
await card('Face Pull').locator('.tc-id').click(); await settle(900);
ok('a single session draws its points', await p.locator('.sheet .combo .pt').count() >= 2);
await p.keyboard.press('Escape'); await settle(500);

// Science page says what the numbers are
await p.evaluate(() => { location.hash = 'science'; }); await settle(900);
const sci = await p.locator('#view').innerText();
ok('Science page explains reps at the weight, and what a weight jump costs', /are the reps you got at the weight you worked at/.test(sci) && /costs one or two reps per set/.test(sci) && /276 to 311/.test(sci));
console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no page errors');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
