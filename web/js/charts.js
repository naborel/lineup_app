// Line charts for progress: one measure per chart, a 2px line, a marker per session, and a
// crosshair + tooltip on hover/touch. The plot is an SVG stretched to the box; labels and markers are
// HTML on top so they stay crisp at any width. comboChart puts weight (left axis) and reps (right axis)
// on one chart, each scaled to fill it so their trends line up.
import { h, s, fmt, fmtDate, toDate } from './util.js';

const DAY = 86400000;

function scale(points) {
  const ys = points.map(p => p.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (lo === hi) { lo -= Math.abs(lo) * 0.05 || 1; hi += Math.abs(hi) * 0.05 || 1; }
  const pad = (hi - lo) * 0.14;
  lo -= pad; hi += pad;
  const t0 = toDate(points[0].date).getTime(), t1 = toDate(points[points.length - 1].date).getTime();
  const span = Math.max(t1 - t0, DAY);
  return {
    lo, hi,
    x: p => (points.length === 1 ? 50 : 2 + (toDate(p.date).getTime() - t0) / span * 96),
    y: p => 100 - (p.y - lo) / (hi - lo) * 100,
  };
}

// Lines are drawn as smooth curves through every point. The curve is "monotone": between two sessions it
// never bulges above the higher one or below the lower one, so it never shows a high or low that didn't happen.
// coords: [[x, y]] in chart units (0–100).
function curve(c) {
  const n = c.length;
  if (n === 1) return `M${c[0][0].toFixed(2)} ${c[0][1].toFixed(2)} L${c[0][0].toFixed(2)} ${c[0][1].toFixed(2)}`;   // a dot
  const dx = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = c[i + 1][0] - c[i][0] || 1e-6; m[i] = (c[i + 1][1] - c[i][1]) / dx[i]; }
  const t = c.map((_, i) => (i === 0 ? m[0] : i === n - 1 ? m[n - 2] : m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], q = a * a + b * b;
    if (q > 9) { const k = 3 / Math.sqrt(q); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  const f = v => v.toFixed(2);
  let d = `M${f(c[0][0])} ${f(c[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h3 = dx[i] / 3;
    d += ` C${f(c[i][0] + h3)} ${f(c[i][1] + t[i] * h3)} ${f(c[i + 1][0] - h3)} ${f(c[i + 1][1] - t[i + 1] * h3)} ${f(c[i + 1][0])} ${f(c[i + 1][1])}`;
  }
  return d;
}
// A gap (a session with no value, like a bodyweight day on a weighted lift) splits a line into pieces;
// a piece with one point is a dot. Returns the pieces as coordinate lists.
function pieces(points, X, Y) {
  const out = [];
  points.forEach((p, i) => {
    if (p == null || p.y == null) { out.push(null); return; }
    if (!out.length || out[out.length - 1] == null) out.push([]);
    out[out.length - 1].push([X(p, i), Y(p, i)]);
  });
  return out.filter(Boolean);
}
const pathOf = (points, sc) => pieces(points, p => sc.x(p), p => sc.y(p)).map(curve).join(' ');

/** A tiny trend line with a dot on the latest point. points: [{date, y}] */
export function sparkline(points, { cls = '' } = {}) {
  if (!points.length) return h('div', { class: `spark empty ${cls}` });
  const sc = scale(points);
  const last = points[points.length - 1];
  const svg = s('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    points.length > 1 ? s('path', { d: pathOf(points, sc), class: 'ln' }) : null);
  return h('div', { class: `spark ${cls}` }, svg, h('i', { class: 'pt', style: { left: sc.x(last) + '%', top: sc.y(last) + '%' } }));
}

/**
 * points: [{date: 'YYYY-MM-DD', y: number, tip: string}]  (oldest first)
 * opts: {format: number → string, height}
 */
export function lineChart(points, { format = v => fmt.format(Math.round(v)), height = 150 } = {}) {
  // with lots of sessions the dots crowd the line: show the latest, and the others as you point at them
  const box = h('div', { class: `chart${points.length > 16 ? ' dense' : ''}`, style: { height: height + 'px' } });
  if (!points.length) { box.classList.add('empty'); box.append(h('span', null, 'No sessions yet')); return box; }
  const sc = scale(points);
  const gid = 'cg' + Math.random().toString(36).slice(2, 8);
  const line = pathOf(points, sc);
  const area = points.length > 1 ? `${line} L${sc.x(points[points.length - 1]).toFixed(2)} 100 L${sc.x(points[0]).toFixed(2)} 100 Z` : '';
  const svg = s('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('defs', null, s('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: 0, 'stop-color': 'var(--series)', 'stop-opacity': 0.22 }), s('stop', { offset: 1, 'stop-color': 'var(--series)', 'stop-opacity': 0 }))),
    [25, 50, 75].map(y => s('line', { x1: 0, x2: 100, y1: y, y2: y, class: 'grid' })),
    area ? s('path', { d: area, fill: `url(#${gid})` }) : null,
    points.length > 1 ? s('path', { d: line, class: 'ln' }) : null);
  const plot = h('div', { class: 'plot' }, svg);
  const dots = points.map(p => h('i', { class: 'pt', style: { left: sc.x(p) + '%', top: sc.y(p) + '%' } }));
  const cross = h('div', { class: 'cross' });
  const tip = h('div', { class: 'tip' });
  plot.append(...dots, cross, tip);

  const show = i => {
    const p = points[i];
    dots.forEach((d, j) => d.classList.toggle('on', j === i));
    cross.style.left = sc.x(p) + '%';
    cross.classList.add('on');
    tip.replaceChildren(...[h('b', null, format(p.y)), h('span', null, fmtDate(p.date, { year: true })), p.tip ? h('em', null, p.tip) : null].filter(Boolean));
    tip.classList.add('on');
    const x = sc.x(p);
    tip.style.left = x + '%';
    tip.style.transform = `translate(${x > 70 ? 'calc(-100% - 10px)' : '10px'}, 0)`;
    tip.style.top = Math.min(sc.y(p), 62) + '%';
  };
  const hide = () => { dots.forEach(d => d.classList.remove('on')); cross.classList.remove('on'); tip.classList.remove('on'); };
  const nearest = e => {
    const r = plot.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * 100;
    let best = 0, bd = Infinity;
    points.forEach((p, i) => { const d = Math.abs(sc.x(p) - px); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  plot.addEventListener('pointermove', e => show(nearest(e)));
  plot.addEventListener('pointerdown', e => show(nearest(e)));
  plot.addEventListener('pointerleave', hide);

  const first = points[0], last = points[points.length - 1];
  box.append(
    h('div', { class: 'yax' }, h('span', null, format(sc.hi - (sc.hi - sc.lo) * 0.25)), h('span', null, format((sc.hi + sc.lo) / 2)), h('span', null, format(sc.lo + (sc.hi - sc.lo) * 0.25))),
    plot,
    h('div', { class: 'xax' }, h('span', null, fmtDate(first.date)), points.length > 1 ? h('span', null, fmtDate(last.date)) : null));
  return box;
}

/**
 * Weight and reps on one chart: weight on the left axis, reps on the right. Both lines are centred and drawn
 * on one shared scale of change, so the same percentage looks the same size on either: 215 → 225 (+4.7%)
 * climbs about as far as 17 → 18 reps (+5.9%). Whichever moved most fills the chart; if the weight never
 * changed, the reps fill it and the weight is a flat line through the middle. (The scale is logarithmic,
 * which is what makes equal percentages equal distances.) Every session is connected: when the weight goes up
 * and the reps come down, you see both lines move at once.
 * dates: ['YYYY-MM-DD'] (oldest first)
 * series: [{key, side: 'left' | 'right', color, points: [{y | null}] (one per date), format,
 *           ticks: 'values' | 'range', flatAt (where a line that never changes sits, %)}]
 * tipOf(i) → nodes for the tooltip.
 */
export function comboChart(dates, series, { tipOf = () => [], height = 190 } = {}) {
  const n = dates.length;
  const t = dates.map(d => toDate(d).getTime());
  const span = Math.max(t[n - 1] - t[0], DAY);
  const X = i => (n === 1 ? 50 : 2 + (t[i] - t[0]) / span * 96);
  const gid = 'cc' + Math.random().toString(36).slice(2, 8);
  const defs = s('defs');
  const svg = s('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, defs,
    [25, 50, 75].map(gy => s('line', { x1: 0, x2: 100, y1: gy, y2: gy, class: 'grid' })));
  const areas = s('g'), lines = s('g');
  svg.append(areas, lines);
  const plot = h('div', { class: 'plot' }, svg);
  const yl = h('div', { class: 'yax' }), yr = h('div', { class: 'yax r' });
  const dots = [];
  const [B0, B1] = [10, 90];
  // one scale for every line: half the widest swing (in log terms) fills half the chart
  const range = sr => { const v = sr.points.map(p => p && p.y).filter(y => y > 0); return v.length ? [Math.min(...v), Math.max(...v)] : null; };
  const half = Math.max(0, ...series.map(range).filter(Boolean).map(([lo, hi]) => (Math.log(hi) - Math.log(lo)) / 2));
  for (const sr of series) {
    const ys = sr.points.map(p => (p && p.y > 0 ? p.y : null));
    const vals = ys.filter(v => v != null);
    if (!vals.length) continue;
    const lo = Math.min(...vals), hi = Math.max(...vals), mid = (Math.log(hi) + Math.log(lo)) / 2;   // centred
    const Y = v => (half === 0 ? sr.flatAt ?? 50 : (B0 + B1) / 2 - (Math.log(v) - mid) / half * (B1 - B0) / 2);
    defs.append(s('linearGradient', { id: `${gid}-${sr.key}`, x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: 0, 'stop-color': sr.color, 'stop-opacity': sr.key === 'w' ? 0.2 : 0.12 }), s('stop', { offset: 1, 'stop-color': sr.color, 'stop-opacity': 0 })));
    const parts = pieces(sr.points, (p, i) => X(i), p => Y(p.y));
    for (const c of parts) {
      const d = curve(c);
      if (c.length > 1) areas.append(s('path', { d: `${d} L${c[c.length - 1][0].toFixed(2)} 100 L${c[0][0].toFixed(2)} 100 Z`, fill: `url(#${gid}-${sr.key})` }));
      lines.append(s('path', { d, class: `ln ${sr.key}` }));
    }
    ys.forEach((v, i) => {
      if (v == null) return;
      const dot = h('i', { class: `pt ${sr.key}`, 'data-i': i, style: { left: X(i) + '%', top: Y(v) + '%' } });
      plot.append(dot); dots.push(dot);
    });
    // highest and lowest first, then whatever else fits without two numbers touching (13px apart)
    const distinct = [...new Set(vals)].sort((a, b) => b - a);
    const wanted = sr.ticks === 'values' && distinct.length <= 4 ? [hi, lo, ...distinct] : [hi, lo, Math.round((hi + lo) / 2)];
    const gap = 13 / Math.max(height - 24, 40) * 100, kept = [];
    for (const v of [...new Set(wanted)]) if (kept.every(k => Math.abs(Y(k) - Y(v)) >= gap)) kept.push(v);
    (sr.side === 'right' ? yr : yl).append(...kept.map(v => h('span', { class: sr.key, style: { top: Y(v) + '%' } }, sr.format(v))));
  }
  const cross = h('div', { class: 'cross' });
  const tip = h('div', { class: 'tip' });
  plot.append(cross, tip);
  const box = h('div', { class: 'combo', style: { height: height + 'px' } }, yl, plot, yr,
    h('div', { class: 'xax' }, h('span', null, fmtDate(dates[0])), n > 1 ? h('span', null, fmtDate(dates[n - 1])) : null));

  const show = i => {
    cross.style.left = X(i) + '%'; cross.classList.add('on');
    dots.forEach(dt => dt.classList.toggle('on', +dt.dataset.i === i));
    tip.replaceChildren(...tipOf(i).filter(Boolean));
    tip.classList.add('on');
    tip.style.left = X(i) + '%';
    tip.style.top = '2%';
    tip.style.transform = `translate(${X(i) > 60 ? 'calc(-100% - 10px)' : '10px'}, 0)`;
  };
  const hide = () => { cross.classList.remove('on'); dots.forEach(dt => dt.classList.remove('on')); tip.classList.remove('on'); };
  const nearest = e => {
    const r = plot.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * 100;
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) { const dd = Math.abs(X(i) - px); if (dd < bd) { bd = dd; best = i; } }
    return best;
  };
  plot.addEventListener('pointermove', e => show(nearest(e)));
  plot.addEventListener('pointerdown', e => show(nearest(e)));
  plot.addEventListener('pointerleave', hide);
  return box;
}

/** The key above a combo chart: a short line in each measure's colour and its name. */
/** The key for a two-axis chart: the first measure sits over the left axis, the second over the right, each in its
 *  line's colour with a swatch drawn like the line (a line through a dot). */
export const comboKey = items => h('div', { class: 'combo-key' }, items.map(([key, label, side]) =>
  h('span', { class: `ck ${key}`, title: `${label}: the ${side} axis` }, h('i'), label)));
