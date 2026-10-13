// Checks for clearing the log from the Table page.  node tools/check7.mjs [outdir for screenshots]
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
const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('liftboard-state')));
const go = async pg => { await p.evaluate(h => { location.hash = h; }, pg); await settle(700); };
const clearBtn = p.locator('.page-head .clear-btn');
const undo = async () => { await p.locator('.toast button').last().click(); await settle(700); };

await p.goto(file); await p.waitForSelector('.page-head'); await settle();
await go('table');
ok('with nothing logged the button is there but off', await clearBtn.innerText() === 'Clear log' && await clearBtn.isDisabled());

// the example: a split, favorites, and weeks of made-up sessions
await go('split');
await p.locator('.split-empty button', { hasText: 'Load an example' }).click(); await settle(900);
const before = await saved();
const setsOf = st => st.log.reduce((a, e) => a + e.sets.length, 0);
ok('the example put sets in the log', setsOf(before) > 300, `${setsOf(before)} sets in ${before.log.length} entries`);
await go('track');
ok('Track has an Archive while the old lifts have history', /Archive/.test(await p.locator('#view').innerText()));
await go('table');
ok('the button is on', !(await clearBtn.isDisabled()));
if (out) await p.screenshot({ path: `${out}/c1-table.png` });

// one click only arms it
await clearBtn.click(); await settle(300);
ok('the first click asks for a second and deletes nothing', /Click again to confirm/.test(await clearBtn.innerText()) && setsOf(await saved()) === setsOf(before));
if (out) await p.screenshot({ path: `${out}/c2-confirm.png` });
await settle(3600);
ok('left alone, it stands down', await clearBtn.innerText() === 'Clear log' && setsOf(await saved()) === setsOf(before));

// filtered to one exercise: clears only that one
await p.selectOption('select[aria-label="Exercise"]', 'Hack_Squat'); await settle(500);
const hack = before.log.filter(e => e.ex === 'Hack_Squat').reduce((a, e) => a + e.sets.length, 0);
ok('filtered to one exercise the button says so', await clearBtn.innerText() === 'Clear this exercise' && hack > 0);
await clearBtn.click(); await settle(200); await clearBtn.click(); await settle(800);
let st = await saved();
ok('only that exercise is cleared', !st.log.some(e => e.ex === 'Hack_Squat') && setsOf(st) === setsOf(before) - hack, `${setsOf(before)} − ${hack} = ${setsOf(st)}`);
ok('the message says what went, and the table is back to everything', new RegExp(`Cleared ${hack} sets of Hack Squat`).test(await p.locator('.toast').last().innerText()) && await p.inputValue('select[aria-label="Exercise"]') === '', await p.locator('.toast').last().innerText());
await undo();
ok('Undo brings them back', setsOf(await saved()) === setsOf(before));

// the whole log
await p.locator('.page-head .clear-btn').click(); await settle(200); await p.locator('.page-head .clear-btn').click(); await settle(800);
st = await saved();
ok('two clicks clear the whole log', st.log.length === 0 && /No sets logged yet/.test(await p.locator('.tbl').innerText()) && /^0 sets/.test(await p.locator('.page-head .sub').innerText()));
ok('the split, favorites and notes are untouched', JSON.stringify(st.days) === JSON.stringify(before.days) && JSON.stringify(st.favorites) === JSON.stringify(before.favorites) && JSON.stringify(st.notes) === JSON.stringify(before.notes));
ok('the button goes off again', await p.locator('.page-head .clear-btn').isDisabled());
if (out) await p.screenshot({ path: `${out}/c3-cleared.png` });
await go('track');
const track = await p.locator('#view').innerText();
ok('Track still lists the split, with no history and no Archive', !/Archive/.test(track) && /Incline Dumbbell Press|Lat Pulldown|Hack Squat/.test(track));
if (out) await p.screenshot({ path: `${out}/c4-track.png` });
// and a real set goes in on a clean log
await go('table');
await p.fill('.add-row input[aria-label="Weight"]', '225'); await p.fill('.add-row input[aria-label="Reps"]', '12'); await p.locator('.add-row .btn.primary').click(); await settle(700);
st = await saved();
ok('a new set logs onto the empty table', st.log.length === 1 && st.log[0].sets[0].w === 225 && st.log[0].sets[0].r === 12 && await p.locator('.tbl tbody tr').count() === 1);
console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no page errors');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
