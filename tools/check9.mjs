// Checks for cues: the one-line note shown on a Track card above the sets, set in the details sheet
// (next to the longer notes) or right on the card.  node tools/check9.mjs [outdir for screenshots]
import { chromium } from 'playwright';
import path from 'path';
const out = process.argv[2];
const file = 'file://' + path.resolve('Lineup.html');
const b = await chromium.launch();
const errs = [];
let fail = 0; const ok = (n, c, x = '') => { if (!c) fail++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${x ? '  → ' + x : ''}`); };
async function person(name, { width = 1440, seed = null } = {}) {
  const ctx = await b.newContext({ viewport: { width, height: 900 } });
  if (seed) await ctx.addInitScript(s => { if (!sessionStorage.seeded) { localStorage.setItem('liftboard-state', s); sessionStorage.seeded = '1'; } }, JSON.stringify(seed));
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${name} PAGEERROR ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errs.push(`${name} CONSOLE ${m.text()}`); });
  await p.goto(file + '#split'); await p.waitForSelector('.page-head'); await p.waitForTimeout(600);
  return p;
}
const settle = (p, ms = 500) => p.waitForTimeout(ms);
const state = p => p.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')));
const go = async (p, pg) => { await p.evaluate(h => { location.hash = h; }, pg); await settle(p, 800); };
const add = async (p, day, name) => {
  await p.click(`.lane[data-day="${day}"] .lane-add`); await settle(p, 300);
  await p.fill('.picker input[type=search]', name); await settle(p, 300);
  await p.click('.picker .res'); await settle(p, 600);
  await p.keyboard.press('Escape'); await settle(p, 200);
};
const shot = async (p, name) => { if (out) { await p.mouse.move(5, 5); await settle(p, 300); await p.screenshot({ path: `${out}/${name}` }); } };

const p = await person('me');
await add(p, 0, 'wide-grip lat pulldown');
await add(p, 0, 'seated cable rows');
await go(p, 'track');
const card = name => p.locator('.tcard', { has: p.locator('.tc-id .nm', { hasText: name }) });
const pulldown = card('Lat Pulldown');
ok('no cue yet: nothing above the sets', await pulldown.locator('.tc-cue').isHidden() && await pulldown.locator('.tc-addcue').count() === 1);

// in the details sheet: a cue and longer notes, separately
await pulldown.locator('.tc-id').click(); await settle(p, 700);
const eyebrows = await p.locator('.sheet .cue-notes .eyebrow').allInnerTexts();
ok('the details sheet has a one-line Cue and separate Notes', eyebrows.length === 2 && /^CUE/i.test(eyebrows[0]) && /^NOTES/i.test(eyebrows[1]) && await p.locator('.sheet .cue-notes input.cue-in').count() === 1 && await p.locator('.sheet .cue-notes textarea.note-body').count() === 1, eyebrows.join(' | ').replace(/\n/g, ' '));
await p.fill('.sheet input.cue-in', 'Close-grip MAG handle · elbows to hips');
ok('it counts characters as you type', /38\/80/.test(await p.locator('.sheet .cue-notes .eyebrow').first().innerText()), await p.locator('.sheet .cue-notes .eyebrow').first().innerText());
await p.locator('.sheet textarea.note-body').fill('Seat pin 4.\nThigh pad snug.\nStop the bar at the chin, not the chest.\nTried the wide bar: lats less, biceps more.');
await shot(p, 'q1-sheet.png');
await p.keyboard.press('Escape'); await settle(p, 700);
const cueText = await pulldown.locator('.tc-cue .cue-t').innerText().catch(() => '');
ok('closing the sheet puts the cue on the Track card', cueText === 'Close-grip MAG handle · elbows to hips', cueText);
ok('the longer notes stay in the details, not on the card', !/Seat pin 4/.test(await pulldown.innerText()));
const box = await pulldown.locator('.tc-cue').boundingBox();
const sets = await pulldown.locator('.tc-sets').boundingBox();
ok('the cue sits above the sets', box && sets && box.y + box.height <= sets.y + 1, `${Math.round(box?.y)} / ${Math.round(sets?.y)}`);
ok('cards without a cue are unchanged', await card('Seated Cable Row').locator('.tc-cue').isHidden().catch(() => true));
await shot(p, 'q2-track.png');

// long cue: the box stops at 80 characters
await pulldown.locator('.tc-id').click(); await settle(p, 600);
await p.locator('.sheet input.cue-in').fill('');
await p.locator('.sheet input.cue-in').type('Close-grip MAG handle, lean back ten degrees, drive the elbows down to the hips, squeeze, slow on the way up');
const long = await p.inputValue('.sheet input.cue-in');
ok('a cue stops at 80 characters', long.length === 80 && /80\/80/.test(await p.locator('.sheet .cue-notes .eyebrow').first().innerText()), `${long.length}`);
await p.keyboard.press('Enter'); await settle(p, 300);
await p.keyboard.press('Escape'); await settle(p, 700);
const narrow = await person('narrow', { width: 430, seed: await state(p) });
await go(narrow, 'track');
const nc = narrow.locator('.tcard', { has: narrow.locator('.tc-id .nm', { hasText: 'Lat Pulldown' }) }).locator('.tc-cue .cue-t');
const geo = await nc.evaluate(el => { const s = el.querySelector('span'); return { h: el.getBoundingClientRect().height, cut: s.scrollWidth > s.clientWidth, title: el.title }; });
ok('on a narrow screen a long cue stays one line, cut short with …, whole on hover', geo.h < 40 && geo.cut && geo.title.startsWith(long), JSON.stringify({ h: Math.round(geo.h), cut: geo.cut }));
if (out) await narrow.screenshot({ path: `${out}/q3-narrow.png` });

// edit it right on the card
await pulldown.locator('.tc-cue .cue-t').click(); await settle(p, 300);
ok('clicking the cue opens it for editing, ready to type', await p.evaluate(() => document.activeElement.classList.contains('cue-in')) && (await p.inputValue('.tcard .tc-cue input.cue-in')) === long);
await p.locator('.tcard .tc-cue input.cue-in').fill('Neutral MAG handle · chest to the bar');
await p.keyboard.press('Escape'); await settle(p, 400);
ok('Escape leaves it as it was', await pulldown.locator('.tc-cue .cue-t').innerText() === long);
await pulldown.locator('.tc-cue .cue-t').click(); await settle(p, 300);
await p.locator('.tcard .tc-cue input.cue-in').fill('Neutral MAG handle · chest to the bar');
await p.keyboard.press('Enter'); await settle(p, 600);
ok('Enter keeps the change', await pulldown.locator('.tc-cue .cue-t').innerText() === 'Neutral MAG handle · chest to the bar' && (await state(p)).cues['Wide-Grip_Lat_Pulldown'] === 'Neutral MAG handle · chest to the bar');
await p.reload(); await p.waitForSelector('.page-head'); await settle(p, 800);
ok('and it is there after a reload', await card('Lat Pulldown').locator('.tc-cue .cue-t').innerText() === 'Neutral MAG handle · chest to the bar');
await card('Lat Pulldown').locator('.tc-id').click(); await settle(p, 600);
ok('the details sheet shows the same cue, and the notes are kept', await p.inputValue('.sheet input.cue-in') === 'Neutral MAG handle · chest to the bar' && /Stop the bar at the chin/.test(await p.inputValue('.sheet textarea.note-body')));
await p.keyboard.press('Escape'); await settle(p, 500);

// add one straight from a card with none, then clear it
const row = card('Seated Cable Row');
await row.hover(); await settle(p, 600);
ok('a card with no cue offers one when you point at it', await row.locator('.tc-addcue').evaluate(el => new Promise(res => { const t0 = performance.now(); (function wait() { if (getComputedStyle(el).opacity === '1') res(true); else if (performance.now() - t0 > 2000) res(false); else requestAnimationFrame(wait); })(); })));
await row.locator('.tc-addcue').click(); await settle(p, 300);
await p.keyboard.type('V-handle · pinch the shoulder blades');
await p.mouse.click(10, 300); await settle(p, 500);
ok('typing and clicking away saves it', await row.locator('.tc-cue .cue-t').innerText() === 'V-handle · pinch the shoulder blades' && await row.locator('.tc-addcue').isHidden());
await row.locator('.tc-cue .cue-t').click(); await settle(p, 300);
await p.locator('.tcard .tc-cue input.cue-in').fill(''); await p.keyboard.press('Enter'); await settle(p, 500);
ok('emptying it removes it, and the add button comes back', await row.locator('.tc-cue').isHidden() && await row.locator('.tc-addcue').count() === 1 && !('Seated_Cable_Rows' in (await state(p)).cues));

// typing a set while a cue is on the card still logs
const firstSet = card('Lat Pulldown').locator('.tc-sets input');
await firstSet.nth(0).fill('140'); await firstSet.nth(1).fill('10'); await settle(p, 900);
ok('logging sets on a card with a cue works as before', (await state(p)).log.some(e => e.ex === 'Wide-Grip_Lat_Pulldown' && e.sets[0].w === 140 && e.sets[0].r === 10));

// cues saved with line breaks (an old backup, hand-edited) come back as one line
const old = await person('old', { seed: { v: 1, days: [{ name: 'Pull', items: [{ id: 'i1', ex: 'Wide-Grip_Lat_Pulldown', sets: 3 }] }], favorites: [], custom: [], log: [], notes: {}, cues: { 'Wide-Grip_Lat_Pulldown': 'Close grip\n  elbows   to hips\n' }, prefs: {} } });
await go(old, 'track');
ok('a cue with line breaks is folded onto one line', await old.locator('.tc-cue .cue-t').innerText() === 'Close grip elbows to hips');

// the example comes with a few cues
const ex = await person('example');
await ex.locator('.split-empty button', { hasText: 'Load an example' }).click(); await settle(ex, 900);
await go(ex, 'track');
ok('the example has cues on some cards', await ex.locator('.tc-cue:not([hidden]) .cue-t').count() >= 2);
if (out) await ex.screenshot({ path: `${out}/q4-example.png` });
console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no page errors');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
