// An example to look around with: a five-day split over the eight slots, a few extra favorites,
// two archived lifts, and nine passes of made-up sessions that creep upward the way real ones do.
// Loaded only when you ask for it (Split page while empty, or the status menu), and undoable.
import { today, addDays, uid } from './util.js';
import * as store from './store.js';

// [day index, exercise id, planned sets, start weight, increment, lowest reps, highest reps]
const PLAN = [
  [0, 'Incline_Dumbbell_Press', 3, 60, 5, 8, 12], [0, 'Machine_Bench_Press', 3, 150, 10, 8, 12], [0, 'Seated_Dumbbell_Press', 2, 45, 5, 8, 12],
  [0, 'Standing_Low-Pulley_Deltoid_Raise', 3, 15, 2.5, 10, 15], [0, 'Triceps_Pushdown_-_Rope_Attachment', 3, 50, 5, 10, 15], [0, 'Cable_Rope_Overhead_Triceps_Extension', 2, 40, 5, 10, 15],
  [1, 'Wide-Grip_Lat_Pulldown', 3, 140, 10, 8, 12], [1, 'Lying_T-Bar_Row', 3, 90, 10, 8, 12], [1, 'Reverse_Machine_Flyes', 3, 80, 10, 10, 15],
  [1, 'lb_bayesian_cable_curl', 3, 25, 2.5, 8, 12], [1, 'Hammer_Curls', 2, 30, 5, 8, 12],
  [2, 'Hack_Squat', 3, 180, 10, 6, 10], [2, 'Romanian_Deadlift', 3, 185, 10, 6, 10], [2, 'Leg_Extensions', 3, 130, 10, 10, 15],
  [2, 'Seated_Leg_Curl', 3, 110, 10, 8, 12], [2, 'Standing_Calf_Raises', 3, 180, 10, 8, 12], [2, 'Cable_Crunch', 3, 90, 10, 10, 15],
  [4, 'Smith_Machine_Incline_Bench_Press', 3, 135, 10, 6, 10], [4, 'Seated_Cable_Rows', 3, 130, 10, 8, 12], [4, 'Butterfly', 2, 130, 10, 10, 15],
  [4, 'V-Bar_Pulldown', 3, 130, 10, 8, 12], [4, 'Side_Lateral_Raise', 3, 20, 2.5, 12, 18], [4, 'EZ-Bar_Skullcrusher', 2, 65, 5, 8, 12], [4, 'Incline_Dumbbell_Curl', 2, 25, 2.5, 8, 12],
  [5, 'Leg_Press', 3, 320, 20, 8, 12], [5, 'Lying_Leg_Curls', 3, 90, 10, 8, 12], [5, 'Split_Squat_with_Dumbbells', 2, 40, 5, 8, 12],
  [5, 'Barbell_Hip_Thrust', 3, 225, 20, 8, 12], [5, 'Seated_Calf_Raise', 3, 90, 10, 10, 15], [5, 'Hanging_Leg_Raise', 3, 0, 0, 8, 15],
];
const NAMES = ['Push', 'Pull', 'Legs', '', 'Upper', 'Lower', '', ''];
const EXTRA_FAVORITES = ['Dumbbell_Bench_Press', 'Pullups', 'Face_Pull', 'Barbell_Squat', 'Dips_-_Chest_Version', 'Preacher_Curl'];
const ARCHIVED = [['Barbell_Bench_Press_-_Medium_Grip', 3, 185, 5, 5, 8], ['Barbell_Curl', 3, 70, 5, 8, 12]];
const PASSES = 9;

// small repeatable pseudo-random, so the example looks the same each time
function rng(seed) { let x = seed % 2147483647; if (x <= 0) x += 2147483646; return () => (x = x * 16807 % 2147483647) / 2147483647; }

function sessions(exId, setsN, w0, inc, lo, hi, dates, seed) {
  const rand = rng(seed);
  let w = w0, top = lo + 1 + Math.floor(rand() * 2);
  return dates.map(date => {
    const sets = [];
    let r = top;
    for (let k = 0; k < setsN; k++) { sets.push({ w: w || null, r: Math.max(lo - 3, r) }); r -= 1 + (rand() < 0.45 ? 1 : 0); }
    // next time: usually a rep better; now and then the same or a rep short
    const roll = rand();
    if (top >= hi) { if (inc) { w += inc; top = lo + 1; } else top += roll < 0.5 ? 1 : 0; }
    else top += roll < 0.68 ? 1 : roll < 0.9 ? 0 : -1;
    top = Math.max(lo, top);
    return { id: uid('l'), date, ex: exId, sets };
  });
}

export function loadSample() {
  const end = today();
  const start = addDays(end, -(PASSES * store.DAY_COUNT - 1));
  const days = NAMES.map(name => ({ name, items: [] }));
  const log = [];
  PLAN.forEach(([di, exId, setsN, w0, inc, lo, hi], i) => {
    days[di].items.push({ id: uid('i'), ex: exId, sets: setsN });
    const dates = Array.from({ length: PASSES }, (_, c) => addDays(start, c * store.DAY_COUNT + di)).filter(d => d <= end);
    log.push(...sessions(exId, setsN, w0, inc, lo, hi, dates, 101 + i * 37));
  });
  ARCHIVED.forEach(([exId, setsN, w0, inc, lo, hi], i) => {
    const dates = Array.from({ length: 7 }, (_, c) => addDays(start, -70 + c * 8 + i));
    log.push(...sessions(exId, setsN, w0, inc, lo, hi, dates, 911 + i * 53));
  });
  const favorites = [...new Set([...PLAN.map(p => p[1]), ...EXTRA_FAVORITES, ...ARCHIVED.map(a => a[0])])];
  return store.replaceAll({ v: 1, days, splits: [{ id: 's_example', name: 'Example split', days }], active: 's_example', favorites, custom: [], log, cues: { 'Wide-Grip_Lat_Pulldown': 'Thumbless grip · chest up, elbows to back pockets', Hack_Squat: 'Feet low and narrow · sit deep, no bounce', Incline_Dumbbell_Press: 'Bench at 30° · elbows 45°, stretch at the bottom' }, notes: { Hack_Squat: 'Feet low and narrow. Seat pin 4.' }, prefs: { unit: 'lb', lastDay: 0, sample: true } });
}
