// Science: what the app assumes, where each assumption comes from, and how far to trust it.
// The numbers quoted here were read from the linked sources in October 2026. The worked examples are
// computed live by the same code that colours the model, so they can't drift from what the app does.
import { h, icon } from '../util.js';
import * as cat from '../catalog.js';
import { coverage, heat, SILVER, SAME_DAY_EXTRA, HELPED_CAP, HELPER_ON_TOP } from '../metrics.js';

const SRC = {
  dose: ['Pelland and colleagues: weekly volume, frequency and muscle growth, 67 studies pooled (preprint)', 'https://sportrxiv.org/index.php/server/preprint/view/460'],
  session: ['Per-session volume and muscle growth, pooled analysis (preprint)', 'https://sportrxiv.org/index.php/server/preprint/view/537'],
  rows: ['Mannarino and colleagues, 2021: dumbbell rows versus curls for the biceps', 'https://paulogentil.com/pdf/Single-Joint%20Exercise%20Results%20in%20Higher%20Hypertrophy%20of%20Elbow%20Flexors%20Than%20Multijoint%20Exercise.pdf'],
  squat: ['Kubo and colleagues, 2019: squat depth and the size of each leg muscle', 'https://uniguacu.com.br/wp-content/uploads/2023/09/Artigo-Agachamento.pdf'],
  bench: ['Brandão and colleagues, 2020: bench press and triceps extensions, alone and combined', 'https://paulogentil.com/pdf/Varying%20the%20Order%20of%20Combinations%20of%20Single-%20and%20Multi-Joint%20Exercises%20Differentially%20Affects%20Resistance%20Training%20Adaptations.pdf'],
  incline: ['Horizontal versus incline bench press in untrained men, 2020', 'https://busqueda.bvsalud.org/portal/resource/pt/mdl-32922646'],
  arms: ['Adding single-joint exercises in recreational bodybuilders', 'https://pure.solent.ac.uk/en/publications/single-joint-exercises-do-not-provide-benefits-in-performance-and/'],
  armsWomen: ['Barbalho and colleagues, 2018: adding single-joint exercises in untrained women', 'https://pure.solent.ac.uk/en/publications/the-influence-of-adding-single-joint-exercise-to-a-multi-joint-re/'],
  armsMen: ['de França and colleagues, 2015: adding single-joint exercises in trained men', 'https://pure.solent.ac.uk/en/publications/the-effects-of-adding-single-joint-exercises-to-a-multi-joint-exe/'],
  beardsley: ['Chris Beardsley: fatigue, volume and how often a muscle can be trained', 'https://www.patreon.com/posts/strength-102633917'],
  onerm: ['Reynolds, Gordon and Robergs, 2006: predicting a one-rep max from multi-rep sets', 'https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf'],
};

const pct = n => Math.round(n * 100) + '%';
const p = (...kids) => h('p', null, ...kids);
const ul = (...items) => h('ul', null, items.map(it => h('li', null, ...(Array.isArray(it) ? it : [it]))));
const b = t => h('b', null, t);
const code = t => h('code', null, t);

// how solid: said in words and an icon, never by colour alone
const RATING = {
  average: ['good', 'check', 'Holds on average'],
  tested: ['good', 'check', 'Supported where tested'],
  direction: ['warn', 'info', 'Direction supported, the number is a guess'],
  onestudy: ['warn', 'info', 'Direction supported, the number is from one study'],
  premise: ['warn', 'info', 'Your premise, thin support'],
  gap: ['warn', 'info', 'Known gap'],
  choice: ['muted', 'note', 'A cautious choice'],
  convention: ['muted', 'note', 'Conventions'],
};
const ratingChip = key => { const [cls, ic, label] = RATING[key]; return h('span', { class: `chip ${cls}` }, icon(ic), label); };

const TOPICS = () => [
  {
    id: 'half', title: 'A helping lift counts half', rating: 'average',
    does: [p('Every lift lists the muscles it trains directly and the ones it only helps with. A helper counts as half a set under By muscle. For colour it starts at half a direct lift, then is limited by the two rules below.')],
    says: [
      p('This comes from an analysis that pooled 67 training studies (2,058 people). It tried three ways of counting a set for a muscle that assists but isn’t the main mover: as a full set, as nothing, and as half. Half predicted muscle growth best. The authors list “every helper is worth half” as a limitation of their own method.'),
      p('Half is an average over very different cases:'),
      ul(
        [b('About half. '), 'Dumbbell rows grew the biceps 5.2%; curls grew them 11.1%. Same sets, 10 untrained men, 8 weeks.'],
        [b('About nothing. '), 'Ten weeks of full squats grew three of the quad muscles 3.5–6.8% and left the fourth, the rectus femoris, unchanged (−0.3%), along with the hamstrings. Bench pressing alone grew the lateral head of the triceps 7.2% and the long head 2.1%, which was within noise.'],
        [b('About the same as direct. '), 'Those squats grew the adductors (6.2%) and glutes (6.7%) as much as the quads.'],
        [b('Closer than it looks. '), 'Incline pressing grew the upper chest more than flat pressing, with no difference at the other two chest sites measured (47 untrained men, 8 weeks). So the incline press may be undersold as a helper for the rest of the chest.']),
      p(`So the half is right in aggregate and rough for any one pairing. Which muscles each lift trains and helps was decided by hand for ${cat.all().filter(e => !e.auto && !e.custom).length} lifts in this catalog, using these studies where they exist. The other ${cat.all().filter(e => e.auto).length} were mapped by rule from the source database’s 17 broad muscle groups and the lift’s name. They are marked auto-mapped; treat those as a first guess.`),
    ],
    sources: ['dose', 'rows', 'squat', 'bench', 'incline'],
    change: [code('tools/build_catalog.py'), ' lists each hand-mapped lift’s direct and helped muscles, and holds the rules for the rest. Edit it, then run ', code('python app.py --catalog'), '. In the app, “Make a variation” lets you correct one lift’s muscles for yourself.'],
  },
  {
    id: 'cap', title: 'Helpers alone never count as a hit', rating: 'choice',
    does: [p('A muscle that nothing in the split trains directly stays at the pale “helped only” tint, however many helping lifts stack up. It can’t reach the colour of one direct lift.')],
    says: [
      p('No study shows a point where stacked helper work equals direct work, and for some muscles (the rectus femoris and hamstrings in squats, the triceps long head in presses) helper work does close to nothing.'),
      p('Three small studies took people training only with compound lifts and added direct arm work for 8 weeks. Arm size rose more with the direct work in two of them (3.5% against 4.4% in untrained women, a clear difference; 1.3% against 3.2% in trained men, not a clear one) and no differently in the third, in recreational bodybuilders. All three measured the arm with a tape, which is a blunt tool.'),
      p('The cap exists so a missing direct exercise is always visible on the model. It is a planning rule, not a measured threshold.'),
    ],
    sources: ['dose', 'squat', 'bench', 'armsWomen', 'armsMen', 'arms'],
    change: [code('HELPED_CAP'), ` in `, code('web/js/metrics.js'), ` (now ${HELPED_CAP}; one direct lift is 1).`],
  },
  {
    id: 'ontop', title: 'On top of direct work, a helper adds less', rating: 'onestudy',
    does: [p(`Once a muscle has a direct lift, each helper counts ${pct(HELPER_ON_TOP)} of what it would alone, and all its helpers together never add more than ${HELPED_CAP}. One direct lift with three helpers on other days scores ${round(1 + HELPER_ON_TOP * 1.5)}: more than one direct lift, clearly less than two. A direct lift plus any number of helpers never looks like a second direct day.`)],
    says: [
      p('One study tested this head-on. Untrained men trained the triceps for 10 weeks with extensions only (direct), bench press only (helper), or both, and muscle size was measured by MRI:'),
      ul(
        'Extensions only: triceps +9.5%.',
        'Bench press only: +4.8%.',
        'Both: +10.4% and +11.5%, depending on the order. The differences from extensions alone were not statistically clear.'),
      p(`If the helper simply added on, both together would have given about 14%. It gave about 11%, so on top of direct work the bench press was worth roughly ${pct(HELPER_ON_TOP)} of what it produced alone. That is where the ${pct(HELPER_ON_TOP)} comes from.`),
      p('The detail explains why. The helper grew only the part of the muscle the direct lift had missed: the lateral head came entirely from the bench press (7.2% alone, about 7% combined, 0.6% from extensions), and the long head entirely from extensions (17.5% alone, 14–18% combined, 2.1% from bench). Where the direct lift already did the job, the helper added nothing.'),
      p('It fits the wider picture: in the pooled analysis growth rises with the square root of weekly sets, so each added set is worth less than the one before. But this exact number rests on one 10-week study of one muscle, so treat it as rough.'),
    ],
    sources: ['bench', 'dose'],
    change: [code('HELPER_ON_TOP'), ' in ', code('web/js/metrics.js'), '.'],
  },
  {
    id: 'twice', title: 'Twice per split is the target', rating: 'premise',
    does: [p('One day of direct work is light red, two is full red, more is deeper.')],
    says: [
      p('This was the starting assumption for the app. In the pooled analysis, once the number of sets was accounted for, training a muscle more often added about 0.3% growth, with a plausible range from −0.1% to 0.8%. The authors call that “compatible with negligible effects”. Twice is not better in itself.'),
      p('The practical case for it is recovery. Chris Beardsley argues that only so many hard sets for a muscle are productive in one workout (roughly 1–3 in a full-body session, 3–5 in an upper/lower one), so reaching a useful total means spreading it across days. Frequency is a way to fit the sets in.'),
    ],
    sources: ['dose', 'beardsley'],
    change: ['The colour steps are ', code('HEAT'), ' in ', code('web/js/metrics.js'), '.'],
  },
  {
    id: 'sameday', title: `A second exercise the same day counts ${pct(SAME_DAY_EXTRA)}`, rating: 'direction',
    does: [p(`Two direct lifts for a muscle on different days score 2. On the same day they score ${1 + SAME_DAY_EXTRA}.`)],
    says: [
      p('The direction is supported. A pooled analysis of per-session volume found that returns shrink as sets pile up in one session, and past roughly 11 half-counted sets it could no longer detect further gains. Beardsley puts the drop-off much earlier.'),
      p(`Nobody has measured “${pct(SAME_DAY_EXTRA)}”. It is this app’s number, chosen so the same day clearly counts for less than another day. By the pooled analysis a second exercise still adds a fair amount, so it may be on the harsh side.`),
    ],
    sources: ['session', 'beardsley'],
    change: [code('SAME_DAY_EXTRA'), ' in ', code('web/js/metrics.js'), '.'],
  },
  {
    id: 'sets', title: 'Colour follows frequency, not sets', rating: 'gap',
    does: [p('Planned sets don’t change the colour: one set and five sets of a lift look the same on the model. Sets are listed under By muscle on the Split page, with helpers counting half.')],
    says: [
      p('The number of hard sets a muscle gets each week is the best-supported driver of growth: more sets, more growth, with shrinking returns, starting from about 4 half-counted sets a week as the least that reliably does something. Few studies go past about 25.'),
      p('The model shows how often and how directly each muscle is trained, which is what the app was designed around. Read the set counts beside it; a muscle can be full red on two sets a week.'),
    ],
    sources: ['dose'],
    change: [code('coverage()'), ' in ', code('web/js/metrics.js'), '. Weighting the colour by sets is a possible next step.'],
  },
  {
    id: 'zones', title: 'Parts of a muscle are separate zones', rating: 'tested',
    does: [p('Upper and mid-lower chest, the three delt heads, and the triceps long head versus the other two are separate zones, so a lift can train one part directly and only help another.')],
    says: [
      p('Where it has been measured, the parts do grow differently: incline pressing grew the upper chest more than flat pressing; bench pressing grew the lateral triceps head while extensions grew the long head; squats grew three of the four quad muscles and not the fourth.'),
      p('Elsewhere the zones follow anatomy, not a growth study. Quads, hamstrings and calves are still one zone each.'),
    ],
    sources: ['incline', 'bench', 'squat'],
    change: ['Zones are defined in ', code('tools/build_catalog.py'), ' and cut from the body map by ', code('tools/build_body.mjs'), '.'],
  },
  {
    id: 'track', title: 'What the Track numbers mean', rating: 'convention',
    does: [ul(
      [b('Best set'), ' is the heaviest weight you’ve lifted on a lift and the most reps you’ve done with it. Heavier always wins; at the same weight, more reps wins. This is your definition, and it is how lifters say it.'],
      [b('Volume trend'), ' (the middle card on Track) is which way your work is going, as a percentage: the average volume of your last 3 sessions against the 3 before them, so one off day doesn’t swing it. With 4 or 5 sessions it compares the last 2 with the 2 before; with 2 or 3, last time with the time before. Nobody knows whether 4,275 lb or 19 reps is good for a lift; everybody knows what +6% means. Moving up in weight usually costs reps, so it can read lower for a session or two after a jump while Best set and Est. 1RM show the step forward.'],
      [b('Reps at 225'), ' (a tile in an exercise’s details) are the reps you got at the weight you worked at (the heaviest that session), added over its sets: 225 × 9, 5, 5 is 19.'],
      [b('Est. 1RM'), ' turns each session’s strongest set into an estimated one-rep max: weight × (1 + reps ÷ 30), the Epley formula. It puts sets at different weights on one line.'],
      [b('Weight and reps'), ', the first chart in an exercise’s details, splits each session’s work into its two halves: the average weight per rep (each set’s weight counted once for every rep in it, so 215 × 12, 225 × 8, 225 × 6 averages 220.4) and the total reps. Average weight × total reps is the volume. Both lines are drawn on one logarithmic scale, so equal percentages are equal distances and the two lines’ rises add up to the volume’s rise.'],
      [b('Volume'), ' is weight × reps, added over all the sets of a session: how much work you did (all the reps for bodyweight work). On Track it appears only as the trend; in an exercise’s details it has its own chart.'],
      [b('Trends'), ' measures each exercise against itself (strength and volume, as percentages, over the chosen window) and averages them per muscle, counting only the exercises that train it directly. This is not the Split page’s rule, on purpose: helping lifts do grow a muscle (that’s why they count half there), but a row is limited by the back, not the biceps, so a heavier row says little about stronger biceps. A muscle with only helping lifts says so instead of borrowing their numbers. It shows direction, not size: a muscle at +6% has exercises that got about 6% stronger, not 6% bigger. Strength gains early on are partly the nervous system learning the lift, so they run ahead of muscle growth.'])],
    says: [
      p('The one-rep max is an estimate. In a study of how well multi-rep sets predict a true max, 5-rep sets predicted best, the link between load and reps was curved, and the authors advised using no more than 10 reps in straight-line formulas like this one. Treat the line as a trend for one lift, and trust it less when the sets are high-rep.'),
      p('The growth research above counts sets, not weight moved. Volume is a progress signal for one lift over time, not a measure of how much stimulus a muscle got.'),
      p('What a weight jump should cost, by the same formulas: in the 5 to 12 rep range each rep is worth roughly 2.5 to 3.5% of the weight, so a 5% jump (215 to 225) usually costs one or two reps per set. Losing more than that on the first day at a new weight is common and tends to come back within a few sessions, which is the pattern the reps line is drawn to show.'),
      p('The formulas disagree most at high reps. For 215 × 12, seven common ones give anywhere from 276 to 311, so a few percent either way on a 12-rep set is within their disagreement. They agree better in the 3 to 8 rep range.'),
    ],
    sources: ['onerm', 'dose'],
    change: [code('e1rm()'), ' and ', code('stats()'), ' in ', code('web/js/metrics.js'), '.'],
  },
];

// ---------- the colour rule, worked on real lifts ----------
const ZONE = 'chest_upper';
const EXAMPLES = [
  ['One direct lift', [['Incline_Dumbbell_Press']]],
  ['Two direct lifts on different days', [['Incline_Dumbbell_Press'], ['Smith_Machine_Incline_Bench_Press']]],
  ['The same two on one day', [['Incline_Dumbbell_Press', 'Smith_Machine_Incline_Bench_Press']]],
  ['Direct work on three days', [['Incline_Dumbbell_Press'], ['Smith_Machine_Incline_Bench_Press'], ['Low_Cable_Crossover']]],
  ['One direct lift, and a helper on another day', [['Incline_Dumbbell_Press'], ['Machine_Bench_Press']]],
  ['One direct lift, and three helpers on other days', [['Incline_Dumbbell_Press'], ['Machine_Bench_Press'], ['Dumbbell_Bench_Press'], ['Butterfly']]],
  ['One helper, nothing direct', [['Machine_Bench_Press']]],
  ['Three helpers on three days, nothing direct', [['Machine_Bench_Press'], ['Dumbbell_Bench_Press'], ['Butterfly']]],
];
const round = n => String(Math.round(n * 100) / 100);

function workedExamples() {
  const zoneName = cat.muscle(ZONE).name.toLowerCase();
  return h('section', { class: 'glass sci-card', id: 'sci-rule' },
    h('div', { class: 'sci-head' }, h('h2', { class: 'display' }, 'How the colour is worked out')),
    h('div', { class: 'sci-body' },
      p('For each muscle, every training day adds to a score, and the score picks the colour.'),
      ul(
        ['A lift that trains the muscle directly is worth ', b('1'), '. The first one in a day counts in full; another the same day counts ', b(pct(SAME_DAY_EXTRA)), '.'],
        ['A lift that only helps is worth ', b('0.5'), ', added up the same way.'],
        ['With no direct lift anywhere in the split, the helpers stop at ', b(String(HELPED_CAP)), ', the pale “helped only” tint.'],
        ['With a direct lift, helpers count ', b(pct(HELPER_ON_TOP)), ' of their value on top of it, and never add more than ', b(String(HELPED_CAP)), '.']),
      h('div', { class: 'eyebrow' }, `Worked for the ${zoneName}`),
      h('div', { class: 'sci-ex' }, EXAMPLES.map(([label, days]) => {
        const cov = coverage(days.map(ids => ({ items: ids.map(id => ({ ex: id, sets: 3 })) }))).get(ZONE);
        const lifts = days.map((ids, i) => `Day ${i + 1}: ${ids.map(id => cat.exOr(id).name).join(' + ')}`).join(' · ');
        return h('div', { class: 'ex-row' },
          h('i', { class: 'sw', style: { background: heat(cov.score) || SILVER } }),
          h('div', { class: 'ex-t' }, h('b', null, label), h('span', null, lifts)),
          h('div', { class: 'ex-n num' }, h('b', null, round(cov.score)),
            cov.direct && cov.helperPart ? h('span', null, `${round(cov.directScore)} direct + ${round(cov.helperPart)} from helpers`)
              : cov.capped ? h('span', null, `held from ${round(cov.helperScore)}`) : null));
      }))));
}

export function mount(root) {
  const topics = TOPICS();
  const card = t => h('section', { class: 'glass sci-card', id: 'sci-' + t.id },
    h('div', { class: 'sci-head' }, h('h2', { class: 'display' }, t.title), ratingChip(t.rating)),
    h('div', { class: 'sci-body' },
      h('div', { class: 'eyebrow' }, 'What the app does'), t.does,
      h('div', { class: 'eyebrow' }, 'What the evidence says'), t.says,
      h('div', { class: 'eyebrow' }, 'Sources'),
      h('ul', { class: 'sci-src' }, t.sources.map(k => h('li', null, h('a', { href: SRC[k][1], target: '_blank', rel: 'noopener noreferrer' }, SRC[k][0], icon('ext'))))),
      h('div', { class: 'eyebrow' }, 'Where to change it'), h('p', { class: 'sci-change' }, ...t.change)));

  const jump = id => () => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const aside = h('aside', { class: 'glass sci-aside' },
    h('div', { class: 'ss-t' }, 'At a glance'),
    h('button', { class: 'sci-jump', type: 'button', onclick: jump('sci-rule') }, h('span', null, 'How the colour is worked out')),
    topics.map(t => h('button', { class: 'sci-jump', type: 'button', onclick: jump('sci-' + t.id) }, h('span', null, t.title), ratingChip(t.rating))),
    h('button', { class: 'sci-jump', type: 'button', onclick: jump('sci-limits') }, h('span', null, 'How far any of this goes')));

  root.replaceChildren(
    h('div', { class: 'page-head enter' },
      h('div', null, h('h1', { class: 'display' }, 'Science'),
        h('div', { class: 'sub' }, 'What the app assumes, where each assumption comes from, and how far to trust it.'))),
    h('div', { class: 'sci-grid enter', style: { '--i': 1 } },
      h('div', { class: 'sci-main' },
        workedExamples(),
        topics.map(card),
        h('section', { class: 'glass sci-card', id: 'sci-limits' },
          h('div', { class: 'sci-head' }, h('h2', { class: 'display' }, 'How far any of this goes')),
          h('div', { class: 'sci-body' }, ul(
            'Most of these studies ran 8 to 10 weeks in untrained young men, in groups of 10 to 50. Trained lifters over years may differ.',
            'Every figure is a group average. People vary around it, sometimes a lot.',
            'The two pooled analyses were read as preprints.',
            'A split here can be up to 8 days and the studies count per week, so “per split” figures are slightly generous next to per-week ones.',
            'Not modelled at all: how close to failure a set is taken, range of motion, rest between sets, sleep and food.',
            'Sources were read in October 2026. The mapping of lifts to muscles is this app’s own, and most of the catalog is mapped by rule, not by hand.')))),
      aside));

  return { update() {} };
}
