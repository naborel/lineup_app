// Checks for keeping your data safe without asking anything of you: nothing to manage in normal use (no notes, no
// reminders), an older copy of the file not saving over newer data, several open tabs not undoing each other, and
// a set typed just before the tab closes still being saved.  node tools/check12.mjs [outdir for screenshots]
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';
const out = process.argv[2];
const file = 'file://' + path.resolve('Lineup.html');
const b = await chromium.launch();
const errs = [];
let fail = 0; const ok = (n, c, x = '') => { if (!c) fail++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${x ? '  → ' + x : ''}`); };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const L = 'Wide-Grip_Lat_Pulldown';
const base = (extra = {}) => ({ v: 1, days: [{ name: 'Pull', items: [{ id: 'i1', ex: L, sets: 3 }] }], favorites: [L], custom: [], notes: {}, cues: {},
  log: [{ id: 'l1', date: ago(20), ex: L, sets: [{ w: 100, r: 10 }] }, { id: 'l2', date: ago(13), ex: L, sets: [{ w: 105, r: 10 }] }], prefs: {}, ...extra });
const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0';
const SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

async function person(name, { seed = null, ua = null, page = 'split' } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...(ua ? { userAgent: ua } : {}) });
  if (seed) await ctx.addInitScript(s => { if (location.search === '?seed') localStorage.setItem('liftboard-state', s); }, JSON.stringify(seed));
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${name} PAGEERROR ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errs.push(`${name} CONSOLE ${m.text()}`); });
  await p.goto(file + (seed ? '?seed' : '') + '#' + page); await p.waitForSelector('.page-head'); await p.waitForTimeout(700);
  return p;
}
const settle = (p, ms = 500) => p.waitForTimeout(ms);
const stored = p => p.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state') || 'null'));
const txt = async loc => (await loc.innerText()).replace(/\s+/g, ' ').trim();
const notice = p => p.locator('#notices .notice');
const pill = p => p.locator('#save-status');
const openMenu = async p => { await pill(p).click(); await settle(p, 400); return txt(p.locator('.pop')); };
const closeMenu = async p => { await p.keyboard.press('Escape'); await settle(p, 300); };
const shot = async (p, name) => { if (out) { await p.mouse.move(5, 5); await settle(p, 900); await p.screenshot({ path: `${out}/${name}` }); } };

// ---------- nothing to manage: no notes, no reminders in normal use ----------
const fresh = await person('fresh');
const old = await person('old', { seed: base({ prefs: { lastBackup: ago(40), unbackedSince: ago(30), browserNoted: true } }) });
const ff = await person('firefox', { seed: base(), ua: FIREFOX });
const sf = await person('safari', { seed: base(), ua: SAFARI });
let quiet = true;
for (const p of [fresh, old, ff, sf]) quiet = quiet && await notice(p).count() === 0 && await p.locator('#save-status .bk').count() === 0 && await txt(pill(p)) === 'Saved in this browser';
ok('a new browser, old data never backed up, Firefox, Safari: no notes on the page, nothing on the status but “Saved”', quiet);
const m1 = await openMenu(old);
ok('the status menu is as it was, plus which build this copy is', /^Your data lives in this browser Save a backup file \.json Load a backup file… Weights in lb Weights in kg Clear everything This copy of Lineup was built \w{3} \d+, \d{4}/.test(m1), m1);
await shot(old, 'd2-menu.png');
const [dl] = await Promise.all([old.waitForEvent('download'), old.locator('.pop .opt', { hasText: 'Save a backup file' }).click()]);
ok('a backup file still saves everything', JSON.parse(fs.readFileSync(await dl.path(), 'utf8')).log.length === 2);
await settle(old, 300);
await old.locator('#nav button', { hasText: 'Track' }).click(); await settle(old, 700);
const ins = old.locator('.tcard .tc-sets input');
await ins.nth(0).fill('110'); await ins.nth(1).fill('9'); await settle(old, 700);
const st = await stored(old);
ok('settings left by the reminder that was tried and removed are tidied away', !['lastBackup', 'unbackedSince', 'browserNoted'].some(k => k in st.prefs), JSON.stringify(st.prefs));
ok('Firefox: a quiet line in the status menu about saving new versions over the file', /Firefox keeps Lineup’s data with this file’s location/.test(await openMenu(ff)));
await closeMenu(ff);
ok('Chrome: no such line', !/keeps Lineup’s data/.test(await openMenu(fresh)));
await closeMenu(fresh);

// ---------- an older copy of the file ----------
const build = await old.evaluate(() => window.LB_BUILD);
ok('each build of the file carries when it was built, and saved data remembers it', build > 1.7e12 && st.build === build);
const newerData = base({ build: build + 86400000, cues: { [L]: 'Saved by the newer copy' } });
const olderCopy = await person('olderCopy', { seed: newerData });
ok('data saved by a newer copy: this one says it’s older and won’t save', /This is an older copy of Lineup/.test(await txt(notice(olderCopy))) && await txt(pill(olderCopy).locator('span')) === 'Not saved: older copy', await txt(pill(olderCopy)));
// the colour where the dot's fade ends (a page the test browser isn't drawing doesn't run its fades)
const dots = [await pill(olderCopy).locator('.dot').evaluate(el => { el.getAnimations().forEach(a => a.finish()); return getComputedStyle(el).backgroundColor; }), 'rgb(242, 182, 94)'];
ok('… with an amber dot, like any other “not saved”', dots[0] === dots[1], dots[0]);
await shot(olderCopy, 'd3-older.png');
const before = JSON.stringify(await stored(olderCopy));
await olderCopy.locator('.lane[data-day="1"] .lane-add').click(); await settle(olderCopy, 300);
await olderCopy.fill('.picker input[type=search]', 'barbell curl'); await settle(olderCopy, 300);
await olderCopy.click('.picker .res'); await settle(olderCopy, 500); await olderCopy.keyboard.press('Escape'); await settle(olderCopy, 700);
ok('a change here leaves the newer data as it was', JSON.stringify(await stored(olderCopy)) === before && await txt(pill(olderCopy).locator('span')) === 'Not saved: older copy');
await notice(olderCopy).locator('button', { hasText: 'Use this copy anyway' }).click(); await settle(olderCopy, 700);
const after = await stored(olderCopy);
ok('“Use this copy anyway” saves from then on, keeping what the newer copy saved', after.build === build && after.days[1].items.length === 1 && after.cues[L] === 'Saved by the newer copy'
  && await notice(olderCopy).count() === 0 && await txt(pill(olderCopy).locator('span')) === 'Saved in this browser');
ok('data from this build or an earlier one: no note', await notice(await person('same', { seed: base({ build }) })).count() === 0 && await notice(await person('earlier', { seed: base({ build: build - 1e9 }) })).count() === 0);

// ---------- two tabs open at once ----------
{
  // its own browser, away from the many test pages above
  const b2 = await chromium.launch();
  const ctx = await b2.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(s => { if (location.search === '?seed') localStorage.setItem('liftboard-state', s); }, JSON.stringify(base()));
  const tab = async (name, url) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(`${name} PAGEERROR ${e.message}`)); await p.goto(file + url); await p.waitForSelector('.page-head'); await p.waitForTimeout(800); return p; };
  // seed through a throwaway tab, then wait until a new tab can see it (the test browser sometimes takes a while
  // to share a page's first writes with the next page; that's the harness, not the app)
  let ready = false;
  for (let k = 0; k < 6 && !ready; k++) {
    const seedTab = await tab('seed', '?seed#track'); await seedTab.waitForTimeout(500); await seedTab.close();
    for (let j = 0; j < 4 && !ready; j++) { const t = await ctx.newPage(); await t.goto(file.replace('Lineup.html', 'web/index.html')); ready = await t.evaluate(() => (JSON.parse(localStorage.getItem('liftboard-state') || '{}').log || []).length === 2); await t.close(); if (!ready) await new Promise(r => setTimeout(r, 400)); }
  }
  const A = await tab('tabA', '#track');                // yesterday's tab, left open
  const B = await tab('tabB', '#track');                // today's tab
  const aCards = await A.locator('.tcard').count(), bOk = await B.waitForSelector('.tcard', { timeout: 6000 }).then(() => true, () => false);
  ok('a second tab shows the same data', ready && aCards > 0 && bOk, JSON.stringify({ ready, aCards, bOk, a: await A.evaluate(() => !!localStorage.getItem('liftboard-state')), b: await B.evaluate(() => !!localStorage.getItem('liftboard-state')) }));
  const bi = B.locator('.tcard .tc-sets input');
  await B.bringToFront();
  await bi.nth(0).fill('120'); await bi.nth(1).fill('8'); await B.waitForTimeout(800);
  const today_ = () => A.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')).log.filter(e => e.sets.some(x => x.w === 120)).length);
  ok('a set logged in one tab is saved', await today_() === 1);
  await A.bringToFront(); await A.waitForTimeout(600);
  ok('the other open tab picks it up', await A.locator('.tcard .tc-sets input').first().inputValue() === '120', await A.locator('.tcard .tc-sets input').first().inputValue());
  await A.locator('#nav button', { hasText: 'Trends' }).click(); await A.waitForTimeout(800);
  await A.locator('#nav button', { hasText: 'Split' }).click(); await A.waitForTimeout(800);
  ok('moving around in the old tab doesn’t put back its old data', await today_() === 1);
  await A.close({ runBeforeUnload: true }); await B.waitForTimeout(500);
  ok('closing the old tab doesn’t either', await B.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')).log.filter(e => e.sets.some(x => x.w === 120)).length) === 1);
  // a tab that missed the news (as if it was asleep in the background) catches up before it saves
  const C = await tab('tabC', '#track');
  await C.waitForSelector('.tcard', { timeout: 6000 });
  await C.evaluate(() => { const stop = e => e.stopImmediatePropagation(); window.addEventListener('storage', stop, true); window.__stop = stop; });
  await B.bringToFront();
  await bi.nth(2).fill('115'); await bi.nth(3).fill('7'); await B.waitForTimeout(800);
  await C.bringToFront();
  await C.evaluate(() => window.removeEventListener('storage', window.__stop, true));
  await C.locator('.page-head .seg button, .unit-seg button', { hasText: 'kg' }).first().click().catch(() => {});
  await C.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); }); await C.waitForTimeout(400);
  await C.locator('#nav button', { hasText: 'Favorites' }).click(); await C.waitForTimeout(800);
  const both = await C.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')).log.find(e => e.sets.some(x => x.w === 120)));
  ok('a tab that missed another tab’s save takes it before saving its own change', both && both.sets.length === 2 && both.sets[1].w === 115, JSON.stringify(both));
  await ctx.close(); await b2.close();
}

// ---------- a set typed just before the tab closes ----------
// The test browser sometimes doesn't share a page's storage with other pages at all (the seed itself never shows
// up); that run says nothing about the app, so it's tried again. It fails only if the seed is there and the set isn't.
let typedNow = null, kept = null;
for (let attempt = 0; attempt < 4 && kept == null; attempt++) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-check12-'));
  const pc = await chromium.launchPersistentContext(dir, { headless: true });
  await pc.addInitScript(s => { if (location.search === '?seed') localStorage.setItem('liftboard-state', s); }, JSON.stringify(base({ log: [] })));
  const warm = pc.pages()[0] || await pc.newPage();
  await warm.goto(file.replace('Lineup.html', 'web/index.html')); await warm.waitForTimeout(300);
  const pp = await pc.newPage();
  await pp.goto(file + '?seed#track'); await pp.waitForSelector('.tcard'); await pp.waitForTimeout(700);
  const pi = pp.locator('.tcard .tc-sets input');
  await pi.nth(0).fill('140'); await pi.nth(1).fill('10');
  typedNow = await pp.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')).log.some(e => e.sets[0] && e.sets[0].w === 140 && e.sets[0].r === 10));
  const other = await pc.newPage();
  await pp.close({ runBeforeUnload: true });              // close the tab straight away
  for (let k = 0; k < 8; k++) {
    await other.goto(file.replace('Lineup.html', 'web/index.html')); await other.waitForTimeout(300);
    const st = await other.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state') || 'null'));
    if (st && st.days && st.days[0] && st.days[0].name === 'Pull') { kept = st.log; if (kept.length) break; }
  }
  await pc.close(); fs.rmSync(dir, { recursive: true, force: true });
}
ok('it’s in storage the moment it’s typed', typedNow === true);
ok('closing the tab straight after typing still keeps the set', kept && kept.length === 1 && kept[0].sets[0].w === 140 && kept[0].sets[0].r === 10, JSON.stringify(kept));

console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no page errors');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
