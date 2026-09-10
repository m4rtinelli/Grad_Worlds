import { panel, slider, selectRow, toggleRow, textRow, button, buttonRow, hint, el } from './controls.js';
import { materialPanel } from './materialPanel.js';
import { GEOMETRY_CONTROLS } from '../three/geometry.js';
import { OBJECT_TYPES, makeOscillator } from '../core/defaults.js';
import { userDefaultMaterial } from '../core/materialPresets.js';
import { OSC_TARGETS, WAVE_LIST } from '../core/oscillators.js';
import { state, changeObjectType, applyMaterialToAll, scheduleSave } from '../core/state.js';
import { emit } from '../core/bus.js';
import { icon } from './icons.js';

const touch = (topic) => { emit(topic); scheduleSave(); };

export function buildInspector(host, obj) {
  host.innerHTML = '';

  if (!obj) {
    const p = el('div', 'empty', host);
    p.textContent = 'Select or add an object to edit it.';
    return;
  }

  /* ---------------- object ---------------- */
  const info = panel(host, 'Object');
  textRow(info, 'Name', obj, 'name', () => touch('ui:layers'));
  selectRow(info, 'Type', obj, 'type', OBJECT_TYPES, (v) => {
    changeObjectType(obj, v);
    scheduleSave();
  });
  toggleRow(info, 'Visible', obj, 'visible', () => touch('ui:layers'));

  /* ---------------- transform ---------------- */
  const tr = panel(host, 'Transform');
  slider(tr, 'Position X', obj.position, 'x', { min: -12, max: 12, step: 0.01, onChange: () => scheduleSave() });
  slider(tr, 'Position Y', obj.position, 'y', { min: -12, max: 12, step: 0.01, onChange: () => scheduleSave() });
  slider(tr, 'Position Z', obj.position, 'z', { min: -12, max: 12, step: 0.01, onChange: () => scheduleSave() });
  slider(tr, 'Rotate X', obj.rotation, 'x', { min: -180, max: 180, step: 0.5, unit: '°', onChange: () => scheduleSave() });
  slider(tr, 'Rotate Y', obj.rotation, 'y', { min: -180, max: 180, step: 0.5, unit: '°', onChange: () => scheduleSave() });
  slider(tr, 'Rotate Z', obj.rotation, 'z', { min: -180, max: 180, step: 0.5, unit: '°', onChange: () => scheduleSave() });
  slider(tr, 'Scale X', obj.scale, 'x', { min: 0.01, max: 6, step: 0.01, onChange: () => scheduleSave() });
  slider(tr, 'Scale Y', obj.scale, 'y', { min: 0.01, max: 6, step: 0.01, onChange: () => scheduleSave() });
  slider(tr, 'Scale Z', obj.scale, 'z', { min: 0.01, max: 6, step: 0.01, onChange: () => scheduleSave() });

  const trBtns = buttonRow(tr);
  button(trBtns, 'Reset transform', () => {
    obj.position = { x: 0, y: 0, z: 0 };
    obj.rotation = { x: 0, y: 0, z: 0 };
    obj.scale = { x: 1, y: 1, z: 1 };
    emit('ui:inspector');
    scheduleSave();
  }, 'btn btn--sm');
  button(trBtns, 'Uniform scale', () => {
    const s = obj.scale.x;
    obj.scale.y = s; obj.scale.z = s;
    emit('ui:inspector');
    scheduleSave();
  }, 'btn btn--sm');

  /* ---------------- geometry ---------------- */
  const gcs = GEOMETRY_CONTROLS[obj.type] || [];
  if (gcs.length) {
    const g = panel(host, 'Geometry');
    if (obj.type === 'metaballs') {
      selectRow(g, 'Chain axis', obj.geometry, 'axis', [
        { id: 'x', label: 'X' }, { id: 'y', label: 'Y' }, { id: 'z', label: 'Z' }
      ], () => touch('scene:objects'));
      hint(g, 'Resolution drives cost — keep it low while designing, raise it before export.');
    }
    gcs.forEach((c) => {
      slider(g, c.label, obj.geometry, c.key, {
        min: c.min, max: c.max, step: c.step,
        onChange: () => touch('scene:objects')
      });
    });
  }

  /* ---------------- material ---------------- */
  const matHost = el('div', null, host);
  const matHead = panel(matHost, 'Material actions');
  const mb = buttonRow(matHead);
  button(mb, 'Copy to all', () => {
    applyMaterialToAll(obj.material);
    scheduleSave();
  }, 'btn btn--sm');
  button(mb, 'Reset to default', () => {
    obj.material = userDefaultMaterial();
    emit('scene:material');
    emit('ui:inspector');
    scheduleSave();
  }, 'btn btn--sm');

  materialPanel(host, obj.material, () => touch('scene:material'));

  /* ---------------- oscillators ---------------- */
  buildOscillators(host, obj);
}

/* ------------------------------------------------------------------ */

function buildOscillators(host, obj) {
  const body = panel(host, 'Oscillators', {
    action: {
      label: '+ Add',
      onClick: () => {
        obj.oscillators.push(makeOscillator());
        emit('ui:inspector');
        scheduleSave();
      }
    }
  });

  if (!obj.oscillators.length) {
    hint(body, 'Keyframe-free motion: each oscillator adds a wave on top of a base value.');
    button(body, '+ Add oscillator', () => {
      obj.oscillators.push(makeOscillator());
      emit('ui:inspector');
      scheduleSave();
    }, 'btn btn--wide btn--sm');
    return;
  }

  obj.oscillators.forEach((osc, i) => {
    const card = el('div', 'osc', body);

    const head = el('div', 'osc__head', card);
    const sel = el('select', null, head);
    OSC_TARGETS.forEach((t) => {
      const o = el('option', null, sel);
      o.value = t.id; o.textContent = t.label;
    });
    sel.value = osc.target;
    sel.onchange = () => { osc.target = sel.value; scheduleSave(); };

    const en = el('button', 'toggle', head);
    en.style.transform = 'scale(.8)';
    en.setAttribute('aria-checked', String(osc.enabled));
    en.onclick = () => {
      osc.enabled = !osc.enabled;
      en.setAttribute('aria-checked', String(osc.enabled));
      scheduleSave();
    };

    const del = el('button', 'layer__btn', head);
    del.style.opacity = '1';
    del.appendChild(icon('trash', 'layer__icon'));
    del.title = 'Remove oscillator';
    del.onclick = () => {
      obj.oscillators.splice(i, 1);
      emit('ui:inspector');
      scheduleSave();
    };

    selectRow(card, 'Wave', osc, 'wave', WAVE_LIST.map((w) => ({ id: w, label: w })), () => scheduleSave());
    slider(card, 'Amount', osc, 'amp', { min: -6, max: 6, step: 0.01, onChange: () => scheduleSave() });
    slider(card, 'Rate', osc, 'freq', { min: 0, max: 4, step: 0.005, unit: '', onChange: () => scheduleSave() });
    slider(card, 'Phase', osc, 'phase', { min: 0, max: 1, step: 0.005, onChange: () => scheduleSave() });
  });

  const b = buttonRow(body);
  button(b, 'Stagger phases', () => {
    obj.oscillators.forEach((o, i) => { o.phase = (i / Math.max(1, obj.oscillators.length)) % 1; });
    emit('ui:inspector');
    scheduleSave();
  }, 'btn btn--sm');
  button(b, 'Snap to loop', () => {
    const d = state.exporter.duration;
    obj.oscillators.forEach((o) => {
      const cycles = Math.max(1, Math.round(o.freq * d));
      o.freq = cycles / d;
    });
    emit('ui:inspector');
    scheduleSave();
  }, 'btn btn--sm');
  hint(body, `Snap to loop rounds every rate to a whole number of cycles across the ${state.exporter.duration}s export, so the sequence loops seamlessly.`);
}
