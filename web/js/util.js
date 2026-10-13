// Small DOM helpers. No framework: h() builds elements, the views re-render the parts that change.
// (Same helpers as Draftboard, plus dates and number formatting for the log.)

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [prop, val] of Object.entries(v)) {
          if (val == null) continue;
          if (prop.startsWith('--')) el.style.setProperty(prop, String(val)); // custom properties need setProperty
          else el.style[prop] = val;
        }
      }
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k in el && !k.startsWith('aria') && !k.startsWith('data') && k !== 'role' && k !== 'list') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Like h(), for SVG elements. */
export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object') { for (const [p, val] of Object.entries(v)) el.style.setProperty(p, String(val)); }
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

export const icon = (name, cls) => {
  const span = document.createElement('span');
  span.innerHTML = ICONS[name] || ICONS.dot;
  const svg = span.firstElementChild;
  if (cls) svg.classList.add(...String(cls).split(/\s+/).filter(Boolean));
  svg.setAttribute('aria-hidden', 'true');
  return svg;
};

const S = (d, extra = '') => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const ICONS = {
  plus: S('<path d="M8 3.5v9M3.5 8h9"/>'),
  minus: S('<path d="M3.5 8h9"/>'),
  x: S('<path d="m4.5 4.5 7 7m0-7-7 7"/>'),
  search: S('<circle cx="7" cy="7" r="4.25"/><path d="m10.2 10.2 3.3 3.3"/>'),
  dots: S('<circle cx="3.5" cy="8" r=".9" fill="currentColor"/><circle cx="8" cy="8" r=".9" fill="currentColor"/><circle cx="12.5" cy="8" r=".9" fill="currentColor"/>'),
  dot: S('<circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none"/>'),
  check: S('<path d="m3.5 8.5 3 3 6-7"/>'),
  star: S('<path d="m8 2.6 1.65 3.4 3.72.5-2.72 2.6.67 3.7L8 11.05 4.68 12.8l.67-3.7L2.63 6.5l3.72-.5z"/>'),
  starFill: S('<path d="m8 2.6 1.65 3.4 3.72.5-2.72 2.6.67 3.7L8 11.05 4.68 12.8l.67-3.7L2.63 6.5l3.72-.5z" fill="currentColor"/>'),
  info: S('<circle cx="8" cy="8" r="5.75"/><path d="M8 7.2v3.6M8 5.1v.1"/>'),
  trash: S('<path d="M3.5 4.5h9M6.5 4.5V3.2h3v1.3M4.7 4.5l.6 8.3h5.4l.6-8.3"/>'),
  copy: S('<rect x="5.5" y="5.5" width="7" height="7" rx="1.6"/><path d="M10.5 5.5V4.2c0-.9-.7-1.7-1.6-1.7H4.2c-.9 0-1.7.8-1.7 1.7v4.7c0 .9.8 1.6 1.7 1.6h1.3"/>'),
  filter: S('<path d="M2.8 4h10.4M4.8 8h6.4M6.8 12h2.4"/>'),
  arrowL: S('<path d="M10 3.5 5.5 8l4.5 4.5"/>'),
  arrowR: S('<path d="M6 3.5 10.5 8 6 12.5"/>'),
  chev: S('<path d="m4 6 4 4 4-4"/>'),
  up: S('<path d="M8 12.5v-9M4.2 7.2 8 3.4l3.8 3.8"/>'),
  down: S('<path d="M8 3.5v9M4.2 8.8 8 12.6l3.8-3.8"/>'),
  flat: S('<path d="M3.5 8h9"/>'),
  download: S('<path d="M8 2.8v7.4M4.9 7.3 8 10.4l3.1-3.1M3 13.2h10"/>'),
  upload: S('<path d="M8 10.4V3M4.9 6.1 8 3l3.1 3.1M3 13.2h10"/>'),
  archive: S('<rect x="2.5" y="3" width="11" height="3.2" rx="1"/><path d="M3.5 6.2v6.3h9V6.2M6.5 9h3"/>'),
  table: S('<rect x="2.5" y="3" width="11" height="10" rx="1.6"/><path d="M2.5 6.6h11M2.5 9.8h11M6.4 6.6V13"/>'),
  sliders: S('<path d="M2.8 4.5h6.4M12.4 4.5h.8M2.8 11.5h.8M6.8 11.5h6.4"/><circle cx="10.8" cy="4.5" r="1.6"/><circle cx="5.2" cy="11.5" r="1.6"/>'),
  chart: S('<path d="M2.8 12.8h10.4M3.5 10.5l3-3.4 2.4 2 3.6-4.6"/>'),
  repeat: S('<path d="M3 7.5V6.2A2.2 2.2 0 0 1 5.2 4H12M10.2 2.2 12 4l-1.8 1.8M13 8.5v1.3a2.2 2.2 0 0 1-2.2 2.2H4M5.8 13.8 4 12l1.8-1.8"/>'),
  body: S('<circle cx="8" cy="3.4" r="1.5"/><path d="M4 6.2h8M8 6.2v4M8 10.2l-2 3.6M8 10.2l2 3.6"/>'),
  note: S('<path d="M4 2.8h6l2.5 2.5v7.9H4z"/><path d="M6 7h4.5M6 9.5h4.5"/>'),
  ext: S('<path d="M9 3h4v4M13 3 7.5 8.5M11.5 9.5v3h-8v-8h3"/>'),
  // equipment glyphs (tile corner badges)
  eq_barbell: S('<path d="M1.8 8h12.4M4 5v6M12 5v6M2.6 6.4v3.2M13.4 6.4v3.2"/>'),
  eq_dumbbell: S('<path d="M5.4 8h5.2M4.6 5.4v5.2M11.4 5.4v5.2M2.8 6.6v2.8M13.2 6.6v2.8"/>'),
  eq_cable: S('<circle cx="8" cy="4" r="1.6"/><path d="M8 5.6v4.6M5.6 12.6h4.8M6.4 10.2h3.2l.8 2.4"/>'),
  eq_machine: S('<rect x="4.5" y="2.8" width="7" height="10.4" rx="1.2"/><path d="M4.5 6.2h7M4.5 9.2h7"/>'),
  eq_bodyweight: S('<circle cx="8" cy="3.6" r="1.4"/><path d="M4.2 6.4 8 7.4l3.8-1M8 7.4v3.2l-1.8 3M8 10.6l1.8 3"/>'),
  eq_kettlebell: S('<path d="M5.6 6.2a2.6 2.6 0 1 1 4.8 0"/><circle cx="8" cy="9.6" r="3.6"/>'),
  eq_band: S('<path d="M2.5 8c1.4-3 2.8-3 4.2 0s2.8 3 4.2 0 1.6-2 2.6-1.4"/><path d="M2.5 11.5h11"/>'),
  eq_other: S('<circle cx="8" cy="8" r="3.2"/>'),
};

export const debounce = (fn, ms) => {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  return d;
};

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
/** 135 → "135", 137.5 → "137.5" */
export const num = v => (v == null || v === '' || Number.isNaN(+v) ? '' : String(Math.round(+v * 100) / 100));

// ---------- dates (the log stores local calendar days as YYYY-MM-DD) ----------
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const toDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export function addDays(iso, n) {
  const d = toDate(iso); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fmtDate(iso, { year = 'auto', weekday = false } = {}) {
  if (!iso) return '';
  const d = toDate(iso);
  const showYear = year === true || (year === 'auto' && d.getFullYear() !== new Date().getFullYear());
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(showYear ? { year: 'numeric' } : {}), ...(weekday ? { weekday: 'short' } : {}) });
}
export function daysAgo(iso) {
  const n = Math.round((toDate(today()) - toDate(iso)) / 86400000);
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 0) return fmtDate(iso);
  return n < 60 ? `${n} days ago` : fmtDate(iso);
}

/** Sliding glass indicator for .seg controls. */
export function seg(buttons, value, onChange, cls = '') {
  const ind = h('span', { class: 'ind' });
  const wrap = h('div', { class: `seg ${cls}`, role: 'group' }, ind);
  const place = (btn, instant) => {
    if (!btn) { ind.style.width = '0px'; return; }
    if (instant) ind.style.transition = 'none';
    ind.style.width = btn.offsetWidth + 'px';
    ind.style.transform = `translateX(${btn.offsetLeft - 4}px)`;
    if (instant) requestAnimationFrame(() => { ind.style.transition = ''; });
  };
  const els = buttons.map(b => {
    const btn = h('button', { type: 'button', 'aria-pressed': String(b.value === value), title: b.title || null, 'aria-label': b.aria || null, class: b.cls || null },
      b.content ?? b.label);
    btn.addEventListener('click', () => {
      els.forEach(x => x.setAttribute('aria-pressed', String(x === btn)));
      place(btn);
      onChange(b.value);
    });
    wrap.append(btn);
    return btn;
  });
  const sync = () => place(els.find(e => e.getAttribute('aria-pressed') === 'true'), true);
  requestAnimationFrame(() => requestAnimationFrame(sync));
  if (document.fonts) document.fonts.ready.then(sync);
  wrap.sync = sync;
  return wrap;
}

/** Grow a textarea to fit its content. */
export function autosize(ta) {
  const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
  ta.addEventListener('input', fit);
  requestAnimationFrame(fit);
  return ta;
}

export function normalize(str) {
  return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export const isTouch = () => matchMedia('(hover: none)').matches;
export const isNarrow = () => matchMedia('(max-width: 900px)').matches;

/** Offer a file to save. */
export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
