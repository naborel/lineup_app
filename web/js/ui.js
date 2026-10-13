// Shared UI: popovers, menus, toasts and the side sheet (same behaviour as Draftboard's).
import { h, icon } from './util.js';

// ---------- popover ----------
let openPop = null;

export function closePop() {
  if (!openPop) return;
  const { el, cleanup, onClose } = openPop;
  openPop = null;
  cleanup();
  el.classList.add('out');
  setTimeout(() => el.remove(), 150);
  onClose && onClose();
  document.dispatchEvent(new CustomEvent('lb:popclose'));   // dropdowns opened from inside it close too
}

/**
 * Anchor a popover to `anchor` (an element, or {x, y} in viewport pixels). `build(close)` returns its content.
 * If the anchor gets re-rendered away while the popover is open, the popover stays where it was.
 */
export function popover(anchor, build, { width = null, align = 'start', onClose = null, className = '', toggle = true } = {}) {
  const sameAnchor = openPop && openPop.anchor === anchor;
  closePop();
  if (sameAnchor && toggle) return null; // clicking the trigger again toggles it shut
  const el = h('div', { class: `pop ${className}`, role: 'dialog' });
  if (width) el.style.width = typeof width === 'number' ? width + 'px' : width;
  el.append(build(closePop));
  document.body.append(el);

  let last = null;
  const rectOf = a => {
    if (a && a.getBoundingClientRect && a.isConnected) last = a.getBoundingClientRect();
    else if (a && a.x != null) last = { left: a.x, right: a.x, top: a.y, bottom: a.y };
    return last;
  };
  const place = () => {
    const r = rectOf(openPop ? openPop.anchor : anchor);
    if (!r) return;
    const w = el.offsetWidth, hgt = el.offsetHeight;
    let left = align === 'end' ? r.right - w : r.left;
    left = Math.max(10, Math.min(left, innerWidth - w - 10));
    let top = r.bottom + 6;
    if (top + hgt > innerHeight - 10) {
      if (r.top - hgt - 6 > 10) { top = r.top - hgt - 6; el.style.setProperty('--origin', 'bottom center'); }
      else top = Math.max(10, innerHeight - hgt - 10);
    }
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  };
  place();

  const onDown = e => {
    if (e.target.closest && e.target.closest('.pop-child')) return;   // a dropdown opened from inside this popover
    const a = openPop && openPop.anchor; if (!el.contains(e.target) && !(a && a.contains && a.contains(e.target))) closePop();
  };
  const onKey = e => { if (e.key === 'Escape') { const a = openPop && openPop.anchor; closePop(); a && a.isConnected && a.focus && a.focus(); } };
  const onScroll = e => { if (!el.contains(e.target)) place(); };
  setTimeout(() => {
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
  });
  const cleanup = () => {
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', place);
  };
  openPop = { el, anchor, cleanup, onClose, place };
  return el;
}
export const repositionPop = () => openPop && openPop.place();
export const popIsOpen = cls => !!(openPop && (!cls || openPop.el.classList.contains(cls)));

/** A simple menu: items = [{label, icon, onClick, danger, disabled, hint, selected} | 'sep' | {head} | {node}] */
export function menu(anchor, items, opts) {
  return popover(anchor, close => h('div', null, items.map((it, i) => {
    if (!it) return null;
    if (it === 'sep') return h('div', { class: 'sep' });
    if (it.head) return h('div', { class: 'head' }, it.head);
    if (it.node) return it.node;
    return h('button', {
      class: `opt${it.danger ? ' danger' : ''}`, type: 'button', disabled: !!it.disabled, style: { '--i': i },
      'aria-selected': it.selected ? 'true' : null,
      onclick: () => { if (!it.keepOpen) close(); it.onClick && it.onClick(); },
    }, it.icon ? icon(it.icon) : null, h('span', null, it.label), it.hint ? h('span', { class: 'hint' }, it.hint) : null,
      it.selected != null ? icon('check', 'check') : null);
  })), opts);
}

// ---------- toast ----------
let toastEl = null, toastTimer = null;
export function toast(message, action = null, ms = 5200) {
  if (toastEl) toastEl.remove();
  clearTimeout(toastTimer);
  const el = h('div', { class: 'toast', role: 'status' }, h('span', null, message),
    action ? h('button', { class: 'btn sm', type: 'button', onclick: () => { action.fn(); dismiss(); } }, action.label) : null);
  const dismiss = () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); if (toastEl === el) toastEl = null; };
  document.body.append(el);
  toastEl = el;
  toastTimer = setTimeout(dismiss, ms);
}

// ---------- side sheet ----------
let sheetEls = null;
export function openSheet(content, { onClose = null } = {}) {
  closeSheet(true);
  const scrim = h('div', { class: 'scrim', onclick: () => closeSheet() });
  const panel = h('aside', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
    h('button', { class: 'btn ghost sm icon-btn close', type: 'button', 'aria-label': 'Close', onclick: () => closeSheet() }, icon('x')),
    content);
  document.body.append(scrim, panel);
  const onKey = e => { if (e.key === 'Escape' && !document.querySelector('.pop')) closeSheet(); };
  document.addEventListener('keydown', onKey);
  sheetEls = { scrim, panel, onKey, onClose };
  panel.querySelector('.close').focus({ preventScroll: true });
}
export function closeSheet(instant = false) {
  if (!sheetEls) return;
  const { scrim, panel, onKey, onClose } = sheetEls;
  sheetEls = null;
  document.removeEventListener('keydown', onKey);
  onClose && onClose();
  if (instant) { scrim.remove(); panel.remove(); return; }
  scrim.classList.add('out'); panel.classList.add('out');
  setTimeout(() => { scrim.remove(); panel.remove(); }, 220);
}
export const sheetIsOpen = () => !!sheetEls;

/** A button that needs a second click to confirm (like Draftboard's Clear). */
export function confirmButton(label, iconName, onConfirm, cls = 'btn sm ghost danger') {
  let armed = false, timer = null;
  const text = h('span', null, label);
  const btn = h('button', { class: cls + ' clear-btn', type: 'button', onclick: () => {
    if (!armed) {
      armed = true; btn.classList.add('confirm'); text.textContent = 'Click again to confirm';
      timer = setTimeout(() => { armed = false; btn.classList.remove('confirm'); text.textContent = label; }, 3200);
      return;
    }
    clearTimeout(timer); armed = false; btn.classList.remove('confirm'); text.textContent = label;
    onConfirm();
  } }, iconName ? icon(iconName) : null, text);
  return btn;
}
