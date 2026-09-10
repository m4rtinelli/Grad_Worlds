import { panel, slider, selectRow, toggleRow, hint, chips } from './controls.js';
import { materialPanel } from './materialPanel.js';
import { EFFECTOR_MODES, FIELD_PRESETS } from '../field/motion.js';
import { RAMP_PRESETS } from '../core/palette.js';
import { state, scheduleSave } from '../core/state.js';
import { emit } from '../core/bus.js';
import { buildExportPanel } from './exportPanel.js';

const touch = () => { scheduleSave(); };

export function buildFieldLeft(host) {
  host.innerHTML = '';
  const f = state.field;

  const pre = panel(host, 'Presets');
  chips(pre, Object.keys(FIELD_PRESETS), () => false, (name) => applyFieldPreset(name));
  hint(pre, 'Each preset sets the ramp, noise and effector together.');

  /* effector */
  const ef = panel(host, 'Effector');
  const e = f.effector;
  selectRow(ef, 'Motion', e, 'mode', EFFECTOR_MODES, touch);
  hint(ef, 'Mouse follows the pointer over the canvas. Every other mode animates on its own clock.');
  slider(ef, 'Radius', e, 'radius', { min: 0.02, max: 1.5, step: 0.005, onChange: touch });
  slider(ef, 'Strength', e, 'strength', { min: 0, max: 3, step: 0.01, onChange: touch });
  slider(ef, 'Falloff', e, 'falloff', { min: 0.3, max: 6, step: 0.05, onChange: touch });
  slider(ef, 'Swirl', e, 'swirl', { min: -3, max: 3, step: 0.01, onChange: touch });
  slider(ef, 'Speed', e, 'speed', { min: 0, max: 2, step: 0.005, onChange: touch });
  slider(ef, 'Mouse ease', e, 'inertia', { min: 0.001, max: 0.98, step: 0.005, onChange: touch });
  toggleRow(ef, 'Mirror second', e, 'secondary', touch);

  /* frame */
  const fr = panel(host, 'Frame');
  slider(fr, 'Zoom', f, 'scale', { min: 0.2, max: 4, step: 0.01, onChange: touch });
  slider(fr, 'Rotation', f, 'rotation', { min: -180, max: 180, step: 0.5, unit: '°', onChange: touch });
  slider(fr, 'Vignette', f, 'vignette', { min: 0, max: 1, step: 0.01, onChange: touch });

  /* pseudo light */
  const li = panel(host, 'Light');
  hint(li, 'The 2D field has no geometry — this embosses the noise so it reads as volume.');
  slider(li, 'Shade', f, 'shade', { min: 0, max: 2, step: 0.01, onChange: touch });
  slider(li, 'Angle', f, 'lightAngle', { min: 0, max: 360, step: 1, unit: '°', onChange: touch });
}

export function buildFieldRight(host) {
  host.innerHTML = '';
  const f = state.field;

  const tr = panel(host, 'Transport');
  slider(tr, 'Speed', f, 'speed', { min: 0, max: 4, step: 0.01, onChange: touch });

  materialPanel(host, f.material, touch, { lighting: false, spaceControl: false });
  buildExportPanel(host);
}

export function applyFieldPreset(name) {
  const p = FIELD_PRESETS[name];
  if (!p) return;
  const f = state.field;

  if (p.material?.ramp) {
    const r = RAMP_PRESETS[p.material.ramp];
    if (r) { f.material.colors = [...r.colors]; f.material.stops = [...r.stops]; }
  }
  Object.assign(f.material, p.material);
  Object.assign(f.effector, p.effector);
  if (p.shade !== undefined) f.shade = p.shade;
  if (p.vignette !== undefined) f.vignette = p.vignette;
  if (p.scale !== undefined) f.scale = p.scale;

  emit('ui:rebuild');
  scheduleSave();
}
