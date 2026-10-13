// Checks for: whole-group muscle filters, the "+" on Favorites groups, saved splits (switching, preview,
// rename, duplicate, delete, what other pages show), and sharing splits and favorites between two people.
// node tools/check8.mjs [outdir for screenshots]
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';
const out = process.argv[2];
const file = 'file://' + path.resolve('Lineup.html');
const b = await chromium.launch();
const errs = [];
async function person(name, seed = null) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  // saved data from an earlier build, put in place before the app starts (it saves as it goes)
  if (seed) await ctx.addInitScript(s => { if (!sessionStorage.seeded) { localStorage.setItem('liftboard-state', s); sessionStorage.seeded = '1'; } }, JSON.stringify(seed));
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${name} PAGEERROR ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errs.push(`${name} CONSOLE ${m.text()}`); });
  await p.goto(file + '#split'); await p.waitForSelector('.page-head'); await p.waitForTimeout(600);
  return p;
}
let fail = 0; const ok = (n, c, x = '') => { if (!c) fail++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${x ? '  → ' + x : ''}`); };
const me = await person('me');
const friend = await person('friend');
const settle = (p, ms = 500) => p.waitForTimeout(ms);
const state = p => p.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')));
const shot = async (p, name) => { if (!out) return; await p.screenshot({ path: `${out}/${name}` }); };
const go = async (p, pg) => { await p.evaluate(h => { location.hash = h; }, pg); await settle(p, 800); };
const colour = (p, z, side = 'front') => p.evaluate(([zz, sd]) => getComputedStyle(document.querySelector(`.bm-grad[id*="-${sd}-${zz}"]`)).getPropertyValue('--c').trim(), [z, side]);
const add = async (p, day, name) => {
  await p.click(`.lane[data-day="${day}"] .lane-add`); await settle(p, 300);
  await p.fill('.picker input[type=search]', name); await settle(p, 300);
  await p.click('.picker .res'); await settle(p, 600);
  await p.keyboard.press('Escape'); await settle(p, 200);
};
const rows = p => p.locator('.sp-row').evaluateAll(els => els.map(e => ({ name: e.querySelector('.nm').textContent, on: e.classList.contains('on'), meta: e.querySelector('.mt').textContent })));
const row = (p, name) => p.locator('.sp-row', { has: p.locator('.nm', { hasText: new RegExp(`^${name.replace(/[()]/g, '\\$&')}$`) }) });
const toastAction = async p => { await p.locator('.toast button').last().click(); await settle(p, 900); };
// the muscle dropdown: open it from `scope` and click a choice by value ('g:Legs', 'quads', '' for all)
const pickMuscle = async (p, scope, v) => { await p.click(`${scope} .msel`); await settle(p, 250); await p.click(`.msel-pop .ms-o[data-v="${v}"]`); await settle(p, 600); };
const muscleValue = (p, scope) => p.getAttribute(`${scope} .msel`, 'data-value');

// ---------- whole groups in the muscle filter ----------
await me.click('.lane[data-day="0"] .lane-add'); await settle(me, 300);
await me.click('.picker .msel'); await settle(me, 300);
const groupRows = await me.locator('.msel-pop .ms-o.grp').evaluateAll(os => os.map(o => `${o.dataset.v}=${o.textContent}`));
ok('the group names themselves are choices', groupRows.join() === 'g:Chest=Chest,g:Shoulders=Shoulders,g:Back=Back,g:Arms=Arms,g:Core=Core,g:Legs=Legs', groupRows.join());
ok('with no extra "All …" rows, and the muscles listed under each', !/All (chest|legs|arms)/i.test(await me.locator('.msel-pop').innerText()) && (await me.locator('.msel-pop .ms-o.mus').count()) === 23);
ok('group names stand out from the muscles under them', await me.locator('.msel-pop .ms-o.grp').first().evaluate(e => +getComputedStyle(e).fontWeight) > await me.locator('.msel-pop .ms-o.mus').first().evaluate(e => +getComputedStyle(e).fontWeight));
await shot(me, 'g0-dropdown.png');
await me.keyboard.press('Escape'); await settle(me, 300);
ok('Escape closes the dropdown and leaves the picker open', (await me.locator('.msel-pop').count()) === 0 && (await me.locator('.picker').count()) === 1);
await me.click('.picker .msel'); await settle(me, 300);
await me.locator('.msel-pop .ms-o', { hasText: /^Legs$/ }).click(); await settle(me, 600);
ok('clicking "Legs" picks the whole group, and the picker stays open', await muscleValue(me, '.picker') === 'g:Legs' && /^Legs$/.test(await me.locator('.picker .msel').innerText()) && (await me.locator('.picker').count()) === 1 && (await me.locator('.msel-pop').count()) === 0);
const legNames = await me.locator('.picker .res .t').allInnerTexts();
ok('"All legs" lists quads, hamstring and calf lifts together', ['Back Squat', 'Romanian Deadlift', 'Leg Curl', 'Calf Raise'].every(n => legNames.some(x => x.includes(n.split(' ').pop()))) && legNames.length > 60, `${legNames.length} lifts`);
ok('and the panel above sums up every leg muscle', /Legs/.test(await me.locator('.pk-zone .zt').innerText()) && (await me.locator('.pk-zone .zg span').count()) === 7);
await shot(me, 'g1-all-legs.png');
await me.keyboard.press('Escape'); await settle(me, 300);

// ---------- Favorites: every group, each with a + ----------
await go(me, 'favorites');
ok('My favorites shows all six groups, each with an add button', (await me.locator('.lanes > .lane').count()) === 6 && (await me.locator('.lanes .lane-add').count()) === 6);
await me.locator('.lane[data-group="Back"] .lane-add').click(); await settle(me, 500);
ok('the + opens the picker on that whole group, in favorites mode', await muscleValue(me, '.picker') === 'g:Back' && /^Back$/.test(await me.locator('.picker .msel').innerText()) && /add it to your favorites/.test(await me.locator('.pk-days').innerText()));
const first = await me.locator('.picker .res .t').nth(1).innerText();
await me.locator('.picker .res').nth(1).click(); await settle(me, 500);
ok('clicking a row stars it, and it stays where it was', await me.locator('.picker .res .t').nth(1).innerText() === first && /Favorite/.test(await me.locator('.picker .res').nth(1).innerText()));
await me.locator('.picker .res').nth(2).click(); await settle(me, 400);
await me.locator('.picker .res').nth(2).click(); await settle(me, 400);
ok('clicking again unstars it', (await state(me)).favorites.length === 1, (await state(me)).favorites.join());
await shot(me, 'g2-fav-picker.png');
await me.keyboard.press('Escape'); await settle(me, 300);
ok('the starred lift sits in the Back group', (await me.locator('.lane[data-group="Back"] .bx-wrap').count()) === 1);
await pickMuscle(me, '.box-toolbar', 'g:Legs');
ok('the Favorites filter takes a whole group too (no leg favorites yet)', (await me.locator('.lanes .empty .display').innerText()) === 'Nothing matches');
await me.locator('.seg button', { hasText: 'Catalog' }).click(); await settle(me, 1200);
// by keyboard this time: open, Home, type a to jump to "Arms", Enter
await me.focus('.box-toolbar .msel'); await me.keyboard.press('ArrowDown'); await settle(me, 300);
await me.keyboard.press('Home'); await me.keyboard.press('a'); await me.keyboard.press('Enter'); await settle(me, 1000);
ok('the dropdown works from the keyboard', await muscleValue(me, '.box-toolbar') === 'g:Arms', await muscleValue(me, '.box-toolbar'));
ok('catalog filtered to all arms', (await me.locator('.lanes .bx-wrap').count()) > 30 && (await me.locator('.lane[data-group="Arms"] .bx-wrap').count()) > 20);

// ---------- saved splits ----------
await go(me, 'split');
ok('one split to start, called "My split", loaded', JSON.stringify(await rows(me)) === JSON.stringify([{ name: 'My split', on: true, meta: 'empty' }]));
await add(me, 0, 'barbell bench press');
await add(me, 0, 'lateral raise');
await add(me, 1, 'wide-grip lat pulldown');
ok('the row counts what is in it', (await rows(me))[0].meta === '2 days · 3 exercises', (await rows(me))[0].meta);
const chestA = await colour(me, 'chest_lower');
// a second split, named as it's made
await me.locator('.splits-card .btn', { hasText: 'New' }).click(); await settle(me, 700);
ok('New starts an empty split, loads it, and asks for a name', (await rows(me)).length === 2 && (await rows(me))[1].on && await me.evaluate(() => document.activeElement.classList.contains('sp-name')));
await me.keyboard.press('Control+A'); await me.keyboard.type('Legs focus'); await me.keyboard.press('Enter'); await settle(me, 500);
ok('typed name shows in the list and under the title', (await rows(me))[1].name === 'Legs focus' && /^Legs focus · /.test(await me.locator('.page-head .sub').innerText()));
ok('the new split has empty days and a silver chest', (await me.locator('.lane:not(.empty-lane)').count()) === 0 && await colour(me, 'chest_lower') !== chestA);
await add(me, 0, 'back squat');
await add(me, 2, 'romanian deadlift');
// day filter resets when another split loads
await me.locator('.cover-show .daypick button').nth(2).click(); await settle(me, 1100);
const hamsB = await colour(me, 'hamstrings', 'back');
// hover preview of the other split
await row(me, 'My split').locator('.sp-main').hover(); await settle(me, 1100);
ok('hovering another split previews it on the model without loading it', /Previewing “My split”/.test(await me.locator('.cover .cover-head .sub').innerText()) && await colour(me, 'chest_lower') === chestA && (await rows(me))[1].on);
await shot(me, 'g3-preview.png');
await me.mouse.move(700, 10); await settle(me, 1100);
ok('moving away shows the loaded split again', await colour(me, 'hamstrings', 'back') === hamsB && /Click a muscle/.test(await me.locator('.cover .cover-head .sub').innerText()));
// load the first one
await row(me, 'My split').locator('.sp-main').click(); await settle(me, 900);
await settle(me, 600);   // the model eases into its new colours
ok('clicking it loads it: days, model and title follow', (await rows(me))[0].on && /^My split/.test(await me.locator('.page-head .sub').innerText()) && (await me.locator('.lane[data-day="0"] .bx-wrap').count()) === 2 && await colour(me, 'chest_lower') === chestA);
ok('the day filter went back to the whole split', (await me.locator('.cover-show .daypick button[aria-pressed="true"]').count()) === 0);
ok('and Undo on the message goes back', /Loaded “My split”/.test(await me.locator('.toast').last().innerText()));
await shot(me, 'g4-splits.png');

// other pages follow the loaded split
await go(me, 'favorites');
await me.locator('.seg button', { hasText: 'My favorites' }).click(); await settle(me, 500);
const favSub = await me.locator('.page-head .sub').innerText();
ok('Favorites counts what is in the loaded split', /3 in your split/.test(favSub), favSub);
await go(me, 'track');
const trackA = await me.locator('#view').innerText();
ok('Track lists the loaded split', /^My split · 3 active/m.test(trackA.split('\n').slice(1).join('\n')) || /My split · 3 active/.test(trackA), trackA.split('\n').slice(0, 3).join(' | '));
// log a bench session, then load the other split: bench moves to the Archive
const benchCard = me.locator('.tcard', { hasText: 'Barbell Bench Press' }).first();
await benchCard.locator('.tc-sets input').nth(0).fill('185'); await benchCard.locator('.tc-sets input').nth(1).fill('8'); await settle(me, 900);
await go(me, 'split');
await row(me, 'Legs focus').locator('.sp-main').click(); await settle(me, 800);
await go(me, 'track');
const trackB = await me.locator('#view').innerText();
ok('with the other split loaded, Track shows its lifts and bench is in the Archive', /Legs focus · 2 active/.test(trackB) && /Archive[\s\S]*Barbell Bench Press/.test(trackB) && !/Lateral Raise/.test(trackB));
await go(me, 'table');
ok('Table offers the loaded split first', (await me.locator('.add-row select optgroup').first().getAttribute('label')) === 'In your split' && /Back Squat/.test(await me.locator('.add-row select optgroup').first().innerText()));
await go(me, 'split');

// duplicate, rename, delete, undo
await row(me, 'Legs focus').locator('.sp-more').click(); await settle(me, 300);
await me.locator('.item-menu .opt', { hasText: 'Duplicate' }).click(); await settle(me, 800);
let r = await rows(me);
ok('Duplicate makes a loaded copy with the same days', r.length === 3 && r[2].name === 'Legs focus copy' && r[2].on && r[2].meta === '2 days · 2 exercises', JSON.stringify(r));
await row(me, 'Legs focus copy').locator('.sp-more').click(); await settle(me, 300);
await me.locator('.item-menu .opt.danger').click(); await settle(me, 800);
r = await rows(me);
ok('Delete removes it and loads its neighbour', r.length === 2 && r[1].on && r[1].name === 'Legs focus');
await toastAction(me);
ok('Undo brings it back, loaded', (await rows(me)).length === 3 && (await rows(me))[2].on);
await row(me, 'Legs focus copy').locator('.sp-more').click(); await settle(me, 300);
await me.locator('.item-menu .opt.danger').click(); await settle(me, 800);
await me.reload(); await me.waitForSelector('.page-head'); await settle(me, 800);
r = await rows(me);
ok('splits, names and the loaded one survive a reload', r.map(x => x.name).join() === 'My split,Legs focus' && r[1].on, JSON.stringify(r));
let st = await state(me);
ok('saved data: the loaded split and the split list agree', st.active === st.splits[1].id && JSON.stringify(st.days) === JSON.stringify(st.splits[1].days));

// ---------- share a split with a custom exercise in it ----------
await go(me, 'favorites');
await me.click('button:has-text("Custom exercise")'); await settle(me, 500);
await me.fill('.sheet input.wide', 'Belt Squat Pause');
await me.click('.sheet .chip.tog:has-text("Quads")');
await me.click('.sheet button:has-text("Add exercise")'); await settle(me, 900);
await me.click('.sheet .close'); await settle(me, 400);
await go(me, 'split');
await add(me, 4, 'belt squat pause');
await me.locator('.lane[data-day="0"] .day-name').fill('Lower A'); await settle(me, 400);
await row(me, 'Legs focus').locator('.sp-more').click(); await settle(me, 300);
await me.locator('.item-menu .opt', { hasText: 'Share' }).click(); await settle(me, 800);
const code = await me.inputValue('.share textarea.code');
ok('Share gives a code starting LB1-', /^LB1-z[A-Za-z0-9_-]+$/.test(code), `${code.length} characters`);
ok('and says what is in it', /3 training days · 3 exercises with planned sets · 1 custom exercise/.test(await me.locator('.share .sh-what').innerText()), await me.locator('.share .sh-what').innerText());
await shot(me, 'g5-share.png');
const [dl] = await Promise.all([me.waitForEvent('download'), me.locator('.share .btn', { hasText: 'Save as file' }).click()]);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-'));
const shareFile = path.join(tmp, dl.suggestedFilename());
await dl.saveAs(shareFile);
ok('Save as file writes a readable share file', dl.suggestedFilename() === 'Legs-focus.lineup-split.json' && JSON.parse(fs.readFileSync(shareFile, 'utf8')).kind === 'split');
await me.keyboard.press('Escape'); await settle(me, 300);

// the friend: bad input first
const fImport = () => friend.locator('.splits-card .btn', { hasText: 'Import' }).click();
await friend.reload(); await friend.waitForSelector('.page-head'); await settle(friend, 600);
await fImport(); await settle(friend, 300);
await friend.fill('.share textarea.code', 'hello there'); await friend.locator('.share .btn.primary').click(); await settle(friend, 400);
ok('a wrong code gets a plain explanation', /doesn’t look like a Lineup share code/.test(await friend.locator('.share .sh-err').innerText()));
await friend.fill('.share textarea.code', code.slice(0, 60)); await friend.locator('.share .btn.primary').click(); await settle(friend, 400);
ok('so does a code that was cut short', /make sure all of it was copied/.test(await friend.locator('.share .sh-err').innerText()));
// a pasted code that a messaging app wrapped onto several lines, with words around it
await friend.fill('.share textarea.code', `here's my split:\n${code.slice(0, 50)}\n${code.slice(50)}\n`); await friend.locator('.share .btn.primary').click(); await settle(friend, 900);
r = await rows(friend);
ok('the friend imports it: added to their splits, not loaded', r.length === 2 && r[1].name === 'Legs focus' && !r[1].on && r[0].on, JSON.stringify(r));
ok('the message offers to load it', /Added “Legs focus” to your splits/.test(await friend.locator('.toast').last().innerText()));
ok('an empty split beside others shows no stray text', !/\bnull\b/.test(await friend.locator('#view').innerText()));
await shot(friend, 'g6-imported.png');
await toastAction(friend);
r = await rows(friend);
st = await state(friend);
ok('Load it loads it: same days, names, sets and the custom exercise', r[1].on && st.days[0].name === 'Lower A' && st.days[4].items[0] && st.custom.length === 1 && st.custom[0].name === 'Belt Squat Pause' && st.days[4].items[0].ex === st.custom[0].id
  && (await friend.locator('.lane[data-day="4"] .bx').innerText()).includes('Belt Squat Pause'));
ok('their favorites are left alone (only what they star or add by hand joins them)', st.favorites.length === 0);
ok('and nothing of the log came across', st.log.length === 0);
// the same split again, from the file this time: a second copy with its own name, and no second custom exercise
await fImport(); await settle(friend, 300);
await friend.locator('.share input[type=file]').setInputFiles(shareFile); await settle(friend, 900);
r = await rows(friend); st = await state(friend);
ok('importing the file adds it again under a new name, reusing the custom exercise', r.length === 3 && r[2].name === 'Legs focus (2)' && st.custom.length === 1, r.map(x => x.name).join());
// a full backup is not a share
fs.writeFileSync(path.join(tmp, 'backup.json'), JSON.stringify({ app: 'liftboard', ...st }));
await fImport(); await settle(friend, 300);
await friend.locator('.share input[type=file]').setInputFiles(path.join(tmp, 'backup.json')); await settle(friend, 600);
ok('a full backup is turned away with directions', /That’s a full backup/.test(await friend.locator('.share .sh-err').innerText()));
await friend.keyboard.press('Escape'); await settle(friend, 300);
// a share link (when Lineup is on a web address) opens Import with the code
await friend.goto(file + '#import=' + code); await friend.waitForSelector('.page-head'); await settle(friend, 1400);
r = await rows(friend);
ok('a #import= link imports straight away', r.length === 4 && r[3].name === 'Legs focus (3)', r.map(x => x.name).join());

// ---------- share favorites ----------
await go(me, 'favorites');
const myFavs = (await state(me)).favorites;
await me.locator('.page-head .btn', { hasText: 'Share' }).click(); await settle(me, 700);
const favCode = await me.inputValue('.share textarea.code');
ok('favorites share says how many', new RegExp(`^${myFavs.length} exercises · 1 custom exercise`).test(await me.locator('.share .sh-what').innerText()), await me.locator('.share .sh-what').innerText());
await me.keyboard.press('Escape');
await go(friend, 'favorites');
// the friend already likes one of them
await friend.locator('.lane[data-group="Shoulders"] .lane-add').click(); await settle(friend, 400);
await friend.fill('.picker input[type=search]', 'lateral raise'); await settle(friend, 400);
await friend.locator('.picker .res').first().click(); await settle(friend, 400);
await friend.keyboard.press('Escape'); await settle(friend, 300);
const before = (await state(friend)).favorites.length;
await friend.locator('.page-head .btn', { hasText: 'Import' }).click(); await settle(friend, 300);
await friend.fill('.share textarea.code', favCode); await friend.locator('.share .btn.primary').click(); await settle(friend, 900);
const prevText = await friend.locator('.share').innerText();
ok('importing favorites shows the list first: what is new and what they have', new RegExp(`Favorites list · ${myFavs.length} exercises`).test(prevText) && /1 you already have/.test(prevText) && (await friend.locator('.fav-prev .fp').count()) === myFavs.length, prevText.split('\n').slice(0, 2).join(' | '));
await shot(friend, 'g7-fav-preview.png');
await friend.locator('.share .btn.primary').click(); await settle(friend, 900);
st = await state(friend);
ok('adding takes only the new ones', st.favorites.length === before + myFavs.length - 1 && st.custom.length === 1, `${before} → ${st.favorites.length}`);
await toastAction(friend);
ok('Undo takes them back off', (await state(friend)).favorites.length === before);
// a favorites code pasted into the Split page's Import goes to the same preview
await go(friend, 'split');
await fImport(); await settle(friend, 300);
await friend.fill('.share textarea.code', favCode); await friend.locator('.share .btn.primary').click(); await settle(friend, 900);
ok('a favorites code on the Split page gets the same preview', /Favorites list/.test(await friend.locator('.share').innerText()));
await friend.keyboard.press('Escape');

// ---------- data from before saved splits ----------
const old = await person('old', { v: 1, days: [{ name: 'Push', items: [{ id: 'i1', ex: 'Barbell_Bench_Press_-_Medium_Grip', sets: 4 }] }], favorites: ['Barbell_Bench_Press_-_Medium_Grip'], custom: [], log: [], notes: {}, prefs: {} });
await settle(old, 600);
r = await rows(old); st = await state(old);
ok('data saved before saved splits becomes "My split", untouched', r.length === 1 && r[0].name === 'My split' && r[0].on && st.days[0].name === 'Push' && st.days[0].items[0].sets === 4 && st.splits[0].days[0].items[0].ex === 'Barbell_Bench_Press_-_Medium_Grip');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no page errors');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
