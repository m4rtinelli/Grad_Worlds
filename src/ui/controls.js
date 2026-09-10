import { ICONS } from './icons.js';
import { normalizeHex } from '../core/palette.js';

/* ------------------------------------------------------------------ */
/* element helpers                                                     */
/* ------------------------------------------------------------------ */

export function el(tag, cls, parent) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (parent) parent.appendChild(node);
  return node;
}

/** Re-read every bound control under `root` (after state changes elsewhere). */
export function refreshTree(root) {
  root.querySelectorAll('[data-ctl]').forEach((n) => n.__refresh?.());
}

const PANEL_OPEN = new Map();   // remembers fold state across rebuilds

export function panel(parent, title, { open = true, action } = {}) {
  const key = title;
  const isOpen = PANEL_OPEN.has(key) ? PANEL_OPEN.get(key) : open;

  const wrap = el('div', 'panel', parent);
  wrap.dataset.open = String(isOpen);

  const head = el('div', 'panel__head', wrap);
  const chev = el('span', 'panel__chev', head);
  chev.innerHTML = ICONS.chevron;
  chev.firstElementChild.style.width = '100%';
  chev.firstElementChild.style.height = '100%';

  const h = el('span', 'panel__title', head);
  h.textContent = title;

  if (action) {
    const a = el('button', 'btn btn--ghost btn--sm', head);
    a.textContent = action.label;
    a.onclick = (e) => { e.stopPropagation(); action.onClick(); };
  }

  head.onclick = () => {
    const next = wrap.dataset.open !== 'true';
    wrap.dataset.open = String(next);
    PANEL_OPEN.set(key, next);
  };

  return el('div', 'panel__body', wrap);
}

export function row(parent, label) {
  const r = el('div', 'row', parent);
  const l = el('span', 'row__label', r);
  l.textContent = label;
  const c = el('div', 'row__control', r);
  return c;
}

export function hint(parent, text) {
  const h = el('p', 'hint', parent);
  h.textContent = text;
  return h;
}

export function divider(parent) {
  return el('div', 'divider', parent);
}

/* ------------------------------------------------------------------ */
/* bound controls                                                      */
/* ------------------------------------------------------------------ */

/**
 * Slider + editable numeric field bound to obj[key].
 *
 * Pointer-driven rather than an <input type="range"> so it can offer the things
 * that make a parameter panel pleasant: click anywhere to jump, shift-drag for
 * fine control, wheel to nudge, double-click to reset, and a draggable number
 * field. `onChange` fires on every change, after the value is written back.
 */
export function slider(parent, label, obj, key, opts = {}) {
  const {
    min = 0, max = 1, step = 0.01, onChange, unit = '',
    curve = 1,
    def = Number(obj[key] ?? 0)
  } = opts;

  const c = row(parent, label);
  c.dataset.ctl = 'slider';

  const track = el('div', 'slider', c);
  track.tabIndex = 0;
  track.setAttribute('role', 'slider');
  track.setAttribute('aria-label', label);

  el('div', 'slider__track', track);
  const fill = el('div', 'slider__fill', track);
  const thumb = el('div', 'slider__thumb', track);

  const num = el('input', 'num', c);
  num.type = 'text';
  num.spellcheck = false;

  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
  const span = max - min;

  /* Optional response curve: >1 gives the low end more of the track, which is what
     size / scale parameters need. Only meaningful for all-positive ranges. */
  const curved = curve !== 1 && min >= 0;
  const toPos = (v) => {
    const t = span === 0 ? 0 : (v - min) / span;
    return curved ? Math.pow(Math.max(0, t), 1 / curve) : t;
  };
  const fromPos = (p) => {
    const t = Math.min(1, Math.max(0, p));
    return min + (curved ? Math.pow(t, curve) : t) * span;
  };
  const read = () => {
    const v = Number(obj[key]);
    return Number.isFinite(v) ? v : min;
  };
  const quantize = (v) => {
    const snapped = Math.round((v - min) / step) * step + min;
    return Number(Math.min(max, Math.max(min, snapped)).toFixed(6));
  };

  let dragging = false;

  function paint() {
    const v = Math.min(max, Math.max(min, read()));
    const pct = toPos(v);
    // Bipolar ranges fill from zero, unipolar ones from the left edge.
    const originPct = min < 0 && max > 0 ? -min / span : 0;
    const a = Math.min(pct, originPct);
    const b = Math.max(pct, originPct);
    fill.style.left = `${a * 100}%`;
    fill.style.width = `${(b - a) * 100}%`;
    thumb.style.left = `${pct * 100}%`;
    track.setAttribute('aria-valuenow', String(v));
    if (document.activeElement !== num) num.value = v.toFixed(decimals) + unit;
  }

  function commit(v, silent = false) {
    const next = quantize(v);
    if (next === obj[key] && !silent) { paint(); return; }
    obj[key] = next;
    paint();
    onChange?.(next);
  }

  const valueAtX = (clientX) => {
    const r = track.getBoundingClientRect();
    return fromPos(r.width ? (clientX - r.left) / r.width : 0);
  };

  /* ---- pointer ---- */
  let fineAnchor = 0;   // track position (0..1) when shift was engaged
  let fineX = 0;

  track.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    track.dataset.drag = '1';
    track.setPointerCapture(e.pointerId);
    track.focus({ preventScroll: true });
    if (e.shiftKey) { fineAnchor = toPos(read()); fineX = e.clientX; track.dataset.fine = '1'; }
    else commit(valueAtX(e.clientX));
  });

  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    if (e.shiftKey) {
      // Engage fine mode from wherever the value currently is.
      if (track.dataset.fine !== '1') { fineAnchor = toPos(read()); fineX = e.clientX; track.dataset.fine = '1'; }
      const r = track.getBoundingClientRect();
      const perPx = r.width ? 1 / r.width : 0;
      commit(fromPos(fineAnchor + (e.clientX - fineX) * perPx * 0.2));
    } else {
      delete track.dataset.fine;
      commit(valueAtX(e.clientX));
    }
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    delete track.dataset.drag;
    delete track.dataset.fine;
    try { track.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  track.addEventListener('dblclick', () => commit(def));

  track.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dir = Math.sign(e.deltaY || e.deltaX) * -1;
    commit(read() + dir * step * (e.shiftKey ? 0.2 : 1) * 3);
  }, { passive: false });

  track.addEventListener('keydown', (e) => {
    const big = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); commit(read() + step * big); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); commit(read() - step * big); }
    if (e.key === 'Home') { e.preventDefault(); commit(min); }
    if (e.key === 'End') { e.preventDefault(); commit(max); }
  });

  /* ---- number field: type a value, or drag it sideways to scrub ---- */
  let scrub = null;

  num.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || document.activeElement === num) return;
    scrub = { x: e.clientX, start: read(), moved: false, id: e.pointerId };
    num.setPointerCapture(e.pointerId);
  });

  num.addEventListener('pointermove', (e) => {
    if (!scrub) return;
    const dx = e.clientX - scrub.x;
    if (!scrub.moved && Math.abs(dx) < 3) return;
    scrub.moved = true;
    e.preventDefault();
    commit(scrub.start + dx * step * (e.shiftKey ? 0.25 : 1));
  });

  const endScrub = (e) => {
    if (!scrub) return;
    try { num.releasePointerCapture(scrub.id); } catch { /* already gone */ }
    if (!scrub.moved) num.focus({ preventScroll: true });
    scrub = null;
  };
  num.addEventListener('pointerup', endScrub);
  num.addEventListener('pointercancel', endScrub);

  num.addEventListener('focus', () => { num.value = read().toFixed(decimals); num.select(); });
  num.addEventListener('blur', () => paint());
  num.addEventListener('change', () => {
    const v = parseFloat(num.value);
    commit(Number.isFinite(v) ? v : read());
  });
  num.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { num.blur(); return; }
    const big = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowUp') { e.preventDefault(); commit(read() + step * big); num.value = read().toFixed(decimals); }
    if (e.key === 'ArrowDown') { e.preventDefault(); commit(read() - step * big); num.value = read().toFixed(decimals); }
  });

  c.__refresh = paint;
  paint();
  return c;
}

/**
 * A one-property view over `target[key]` that reads and writes its reciprocal.
 * Lets a "size" slider drive a stored frequency without changing the state shape.
 */
export function reciprocalOf(target, key) {
  return {
    get value() {
      const v = Number(target[key]);
      return Number.isFinite(v) && v > 1e-6 ? 1 / v : 0;
    },
    set value(v) {
      target[key] = 1 / Math.max(Number(v) || 0, 1e-3);
    }
  };
}

export function selectRow(parent, label, obj, key, options, onChange) {
  const c = row(parent, label);
  c.dataset.ctl = 'select';
  const sel = el('select', null, c);
  options.forEach((o) => {
    const opt = el('option', null, sel);
    opt.value = o.id ?? o;
    opt.textContent = o.label ?? o;
  });
  sel.onchange = () => { obj[key] = sel.value; onChange?.(sel.value); };
  c.__refresh = () => { sel.value = obj[key]; };
  c.__refresh();
  return c;
}

export function toggleRow(parent, label, obj, key, onChange) {
  const c = row(parent, label);
  c.dataset.ctl = 'toggle';
  const btn = el('button', 'toggle', c);
  btn.type = 'button';
  btn.onclick = () => {
    obj[key] = !obj[key];
    btn.setAttribute('aria-checked', String(!!obj[key]));
    onChange?.(obj[key]);
  };
  c.__refresh = () => btn.setAttribute('aria-checked', String(!!obj[key]));
  c.__refresh();
  return c;
}

export function textRow(parent, label, obj, key, onChange) {
  const c = row(parent, label);
  c.dataset.ctl = 'text';
  const input = el('input', null, c);
  input.type = 'text';
  input.onchange = () => { obj[key] = input.value; onChange?.(input.value); };
  c.__refresh = () => { input.value = obj[key] ?? ''; };
  c.__refresh();
  return c;
}

/** Colour swatch + hex field. `get`/`set` allow binding into arrays. */
export function colorRow(parent, label, get, set, palette = []) {
  const c = row(parent, label);
  c.dataset.ctl = 'color';

  const sw = el('label', 'swatch', c);
  const picker = el('input', null, sw);
  picker.type = 'color';

  const hex = el('input', 'hexfield', c);
  hex.type = 'text';
  hex.spellcheck = false;

  const apply = (v) => {
    const h = normalizeHex(v, get());
    set(h);
    sw.style.background = h;
    picker.value = h;
    hex.value = h.toUpperCase();
  };

  picker.oninput = () => apply(picker.value);
  hex.onchange = () => apply(hex.value);

  if (palette.length) {
    // Appended to the row (a grid) rather than the control cell, so the chips get
    // their own full-width line instead of wrapping into a column.
    const strip = el('div', 'palette-strip', c.parentElement);
    palette.forEach((p) => {
      const chip = el('button', 'palette-chip', strip);
      chip.type = 'button';
      chip.style.background = p;
      chip.title = p;
      chip.onclick = () => apply(p);
    });
  }

  c.__refresh = () => {
    const h = normalizeHex(get(), '#000000');
    sw.style.background = h;
    picker.value = h;
    hex.value = h.toUpperCase();
  };
  c.__refresh();
  return c;
}

export function button(parent, label, onClick, cls = 'btn') {
  const b = el('button', cls, parent);
  b.type = 'button';
  b.textContent = label;
  b.onclick = onClick;
  return b;
}

export function buttonRow(parent) {
  return el('div', 'btn-row', parent);
}

export function chips(parent, items, isActive, onPick) {
  const wrap = el('div', 'chips', parent);
  wrap.dataset.ctl = 'chips';
  const render = () => {
    wrap.innerHTML = '';
    items.forEach((it) => {
      const b = el('button', 'chip', wrap);
      b.type = 'button';
      b.textContent = it.label ?? it;
      b.setAttribute('aria-pressed', String(isActive(it)));
      b.onclick = () => { onPick(it); render(); };
    });
  };
  wrap.__refresh = render;
  render();
  return wrap;
}

/** X/Y/Z triple of sliders bound to a {x,y,z} object. */
export function vec3(parent, label, obj, opts = {}) {
  const { min = -8, max = 8, step = 0.01, onChange } = opts;
  ['x', 'y', 'z'].forEach((axis) => {
    slider(parent, `${label} ${axis.toUpperCase()}`, obj, axis, { min, max, step, onChange });
  });
}
