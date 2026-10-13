// The body: a front/back muscle map (data/body.json) drawn as glass pieces that take a colour per muscle,
// and the small cropped versions used as exercise tiles.
import { h, s } from './util.js';
import { SILVER, heat, helpedColour } from './metrics.js';

let BODY = null;
const byZone = { front: new Map(), back: new Map() };   // view → zone → parts

export async function load() {
  BODY = window.LB_DATA ? window.LB_DATA.body : await (await fetch('/data/body.json')).json();
  for (const side of ['front', 'back']) {
    for (const part of BODY.views[side].parts) {
      if (!byZone[side].has(part.z)) byZone[side].set(part.z, []);
      byZone[side].get(part.z).push(part);
    }
  }
}

let instance = 0;

/**
 * A front + back map. Returns {el, paint(colours), preview(exercise|null), select(zone|null)}.
 *   paint(Map zone → css colour | null): null/absent leaves the muscle silver
 *   onPick(zone, event), onHover(zone | null, event): optional
 */
export function bodyMap({ onPick = null, onHover = null, cls = '' } = {}) {
  const id = 'bm' + (++instance);
  const paths = new Map(), grads = new Map();
  const wrap = h('div', { class: `bodymap ${cls}${onPick ? ' pickable' : ''}` });
  for (const side of ['front', 'back']) {
    const v = BODY.views[side];
    const defs = s('defs');
    const g = s('g', { class: 'bm-muscles' });
    for (const zone of byZone[side].keys()) {
      // each muscle is its own piece of glass: lit from the top-left, deeper at the bottom
      const grad = s('linearGradient', { id: `${id}-${side}-${zone}`, x1: '0.1', y1: '0', x2: '0.7', y2: '1', class: 'bm-grad' },
        s('stop', { offset: '0', class: 'g0' }), s('stop', { offset: '0.5', class: 'g1' }), s('stop', { offset: '1', class: 'g2' }));
      defs.append(grad);
      if (!grads.has(zone)) grads.set(zone, []);
      grads.get(zone).push(grad);
      for (const part of byZone[side].get(zone)) {
        const p = s('path', { d: part.d, class: 'mz', 'data-z': zone, fill: `url(#${id}-${side}-${zone})` });
        g.append(p);
        if (!paths.has(zone)) paths.set(zone, []);
        paths.get(zone).push(p);
      }
    }
    const svg = s('svg', { viewBox: v.vb.join(' '), class: 'bm-svg', role: 'img', 'aria-label': `${side} of the body` },
      defs,
      s('path', { d: v.outline, class: 'bm-out' }),
      s('g', { class: 'bm-base' }, v.base.map(b => s('path', { d: b.d }))),
      g);
    wrap.append(h('figure', { class: 'bm-view' }, svg, h('figcaption', null, side === 'front' ? 'Front' : 'Back')));
  }

  const zoneAt = e => { const t = e.target.closest && e.target.closest('.mz'); return t ? t.getAttribute('data-z') : null; };
  let hovered = null;
  const setHover = (zone, e) => {
    if (zone === hovered) { if (zone && onHover) onHover(zone, e); return; }
    if (hovered) (paths.get(hovered) || []).forEach(p => p.classList.remove('hov'));
    hovered = zone;
    if (zone) (paths.get(zone) || []).forEach(p => p.classList.add('hov'));
    onHover && onHover(zone, e);
  };
  if (onPick || onHover) {
    wrap.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') setHover(zoneAt(e), e); });
    wrap.addEventListener('pointerleave', e => setHover(null, e));
  }
  if (onPick) wrap.addEventListener('click', e => { const z = zoneAt(e); if (z) onPick(z, e); });

  return {
    el: wrap,
    paint(colours) {
      for (const [zone, list] of grads) {
        const c = colours && colours.get(zone);
        list.forEach(gr => gr.style.setProperty('--c', c || SILVER));
        (paths.get(zone) || []).forEach(p => p.classList.toggle('lit', !!c));
      }
    },
    /** Outline the muscles an exercise works (hovering a tile). */
    preview(e) {
      wrap.classList.toggle('previewing', !!e);
      for (const [zone, list] of paths) {
        const k = !e ? 0 : e.p.includes(zone) ? 1 : e.s.includes(zone) ? 2 : 0;
        list.forEach(p => { p.classList.toggle('pv1', k === 1); p.classList.toggle('pv2', k === 2); });
      }
    },
    select(zone) {
      for (const [z, list] of paths) list.forEach(p => p.classList.toggle('sel', z === zone));
    },
  };
}

// ---------- exercise tiles: a crop of the map around the muscles the lift trains ----------
const tileCache = new Map();
const TILE = { primary: heat(2), secondary: helpedColour(), rest: 'rgba(214,220,235,0.16)', base: 'rgba(214,220,235,0.09)' };

function tileGeometry(e) {
  const areaIn = side => e.p.reduce((sum, z) => sum + (byZone[side].get(z) || []).reduce((a, p) => a + p.bb[2] * p.bb[3], 0), 0);
  const side = areaIn('back') > areaIn('front') ? 'back' : 'front';
  const v = BODY.views[side], axis = v.vb[0] + v.vb[2] / 2;
  let parts = e.p.flatMap(z => byZone[side].get(z) || []);
  if (!parts.length) parts = v.parts;
  const box = list => {
    const x0 = Math.min(...list.map(p => p.bb[0])), y0 = Math.min(...list.map(p => p.bb[1]));
    const x1 = Math.max(...list.map(p => p.bb[0] + p.bb[2])), y1 = Math.max(...list.map(p => p.bb[1] + p.bb[3]));
    return [x0, y0, x1 - x0, y1 - y0];
  };
  let bb = box(parts);
  if (bb[2] > 270) {   // the same muscle on two limbs: show one side, larger
    const oneSide = parts.filter(p => p.bb[0] + p.bb[2] / 2 < axis);
    if (oneSide.length) bb = box(oneSide);
  }
  const size = Math.max(190, Math.max(bb[2], bb[3]) * 1.28);
  const cx = bb[0] + bb[2] / 2, cy = bb[1] + bb[3] / 2;
  return { side, crop: [cx - size / 2, cy - size / 2, size, size] };
}

/** A small picture of the muscles an exercise trains, as an image URL. */
export function tileImage(e) {
  const key = e.id + '|' + e.p.join(',') + '|' + e.s.join(',');
  let uri = tileCache.get(key);
  if (uri) return uri;
  const { side, crop } = tileGeometry(e);
  const v = BODY.views[side];
  const hit = bb => bb[0] < crop[0] + crop[2] && bb[0] + bb[2] > crop[0] && bb[1] < crop[1] + crop[3] && bb[1] + bb[3] > crop[1];
  const fillOf = z => (e.p.includes(z) ? TILE.primary : e.s.includes(z) ? TILE.secondary : TILE.rest);
  // draw quiet pieces first so the lit ones sit on top
  const rank = z => (e.p.includes(z) ? 2 : e.s.includes(z) ? 1 : 0);
  const pieces = v.parts.filter(p => hit(p.bb)).sort((a, b) => rank(a.z) - rank(b.z))
    .map(p => `<path d="${p.d}" fill="${fillOf(p.z)}"/>`).join('');
  const base = v.base.filter(b => hit(b.bb)).map(b => `<path d="${b.d}" fill="${TILE.base}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop.map(n => Math.round(n)).join(' ')}">${base}${pieces}</svg>`;
  uri = 'data:image/svg+xml,' + encodeURIComponent(svg);
  tileCache.set(key, uri);
  return uri;
}
