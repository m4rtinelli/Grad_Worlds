import { panel, slider, selectRow, toggleRow, colorRow, button, hint, chips, el } from './controls.js';
import { icon } from './icons.js';
import { buildInspector } from './inspector.js';
import { materialPanel } from './materialPanel.js';
import { OBJECT_TYPES } from '../core/defaults.js';
import { SCENE_PRESETS, SCENE_PRESET_NAMES } from '../core/scenePresets.js';
import { BRAND_LIST } from '../core/palette.js';
import {
  state, addObject, removeObject, duplicateObject,
  select, selectedObject, scheduleSave, clone
} from '../core/state.js';
import { emit } from '../core/bus.js';
import { buildExportPanel } from './exportPanel.js';
import { addSvgObject } from './svgImport.js';

/* ------------------------------------------------------------------ */
/* left sidebar                                                        */
/* ------------------------------------------------------------------ */

export function buildSceneLeft(host) {
  host.innerHTML = '';

  /* presets */
  const pre = panel(host, 'Start from');
  chips(pre, SCENE_PRESET_NAMES, () => false, (name) => applyScenePreset(name));
  hint(pre, 'Loads a full scene: objects, light, camera and canvas size.');

  /* add */
  const add = panel(host, 'Add object');
  const grid = el('div', 'add-grid', add);
  OBJECT_TYPES.forEach((t) => {
    const tile = el('button', 'add-tile', grid);
    tile.type = 'button';
    tile.appendChild(icon(t.id));
    const s = el('span', null, tile);
    s.textContent = t.label;
    if (t.id === 'svg') {
      tile.title = 'Upload an SVG and extrude it';
      tile.onclick = () => addSvgObject();
    } else {
      tile.onclick = () => { addObject(t.id); scheduleSave(); };
    }
  });
  hint(add, 'SVG loads a vector file and extrudes its filled paths into a solid.');

  /* layers */
  const layersHost = panel(host, 'Objects');
  const list = el('div', 'layers', layersHost);
  list.id = 'layer-list';
  renderLayers(list);

  /* camera */
  const cam = panel(host, 'Camera', { open: false });
  const c = state.scene.camera;
  selectRow(cam, 'Projection', c, 'mode', [
    { id: 'perspective', label: 'Perspective' },
    { id: 'orthographic', label: 'Orthographic' }
  ]);
  slider(cam, 'Focal (FOV)', c, 'fov', { min: 8, max: 90, step: 0.5, unit: '°' });
  slider(cam, 'Distance', c, 'distance', { min: 1, max: 60, step: 0.05 });
  slider(cam, 'Ortho zoom', c, 'zoom', { min: 0.05, max: 8, step: 0.01 });
  slider(cam, 'Azimuth', c, 'azimuth', { min: -3.15, max: 3.15, step: 0.005 });
  slider(cam, 'Elevation', c, 'elevation', { min: -1.52, max: 1.52, step: 0.005 });
  slider(cam, 'Target X', c.target, 'x', { min: -8, max: 8, step: 0.01 });
  slider(cam, 'Target Y', c.target, 'y', { min: -8, max: 8, step: 0.01 });
  slider(cam, 'Target Z', c.target, 'z', { min: -8, max: 8, step: 0.01 });
  toggleRow(cam, 'Selection box', state.scene, 'showSelection');
  hint(cam, 'Drag the canvas to orbit, shift-drag to pan, scroll to dolly.');
  button(cam, 'Reset camera', () => {
    Object.assign(c, { azimuth: 0, elevation: 0.05, distance: 9, zoom: 1, target: { x: 0, y: 0, z: 0 } });
    emit('ui:rebuild');
  }, 'btn btn--wide btn--sm');

  /* light */
  const lightHost = panel(host, 'Light');
  const l = state.scene.light;
  slider(lightHost, 'Position X', l, 'x', { min: -20, max: 20, step: 0.05 });
  slider(lightHost, 'Position Y', l, 'y', { min: -20, max: 20, step: 0.05 });
  slider(lightHost, 'Position Z', l, 'z', { min: -20, max: 20, step: 0.05 });
  slider(lightHost, 'Intensity', l, 'intensity', { min: 0, max: 3, step: 0.01 });
  colorRow(lightHost, 'Tint', () => l.color, (v) => { l.color = v; }, ['#FFFFFF', ...BRAND_LIST]);
  toggleRow(lightHost, 'Orbit light', l, 'orbit');
  slider(lightHost, 'Orbit speed', l, 'orbitSpeed', { min: -1, max: 1, step: 0.005 });
  toggleRow(lightHost, 'Show gizmo', l, 'showHelper');

  /* backdrop */
  const bd = state.scene.backdrop;
  const bdHost = panel(host, 'Backdrop', { open: false });
  toggleRow(bdHost, 'Enabled', bd, 'enabled');
  slider(bdHost, 'Distance', bd, 'distance', { min: 2, max: 60, step: 0.1 });
  slider(bdHost, 'Coverage', bd, 'scale', { min: 1, max: 8, step: 0.01 });
  hint(bdHost, 'A camera-locked gradient plane behind everything — this is what gives the reference stills their coloured haze.');
  materialPanel(bdHost, bd.material, () => { emit('scene:material'); scheduleSave(); },
    { lighting: false, titlePrefix: 'Backdrop · ', spaceControl: true });
}

/* ------------------------------------------------------------------ */
/* layer list                                                          */
/* ------------------------------------------------------------------ */

export function renderLayers(list) {
  if (!list) return;
  list.innerHTML = '';
  const objs = state.scene.objects;

  if (!objs.length) {
    const e = el('div', 'empty', list);
    e.textContent = 'No objects yet.';
    return;
  }

  objs.forEach((o, i) => {
    const rowEl = el('div', 'layer', list);
    rowEl.dataset.selected = String(o.id === state.scene.selectedId);
    rowEl.onclick = () => select(o.id);

    rowEl.appendChild(icon(o.type, 'layer__icon'));

    const name = el('span', 'layer__name', rowEl);
    name.textContent = o.name;

    const vis = el('button', 'layer__btn', rowEl);
    vis.appendChild(icon(o.visible ? 'eye' : 'eyeOff', 'layer__icon'));
    vis.dataset.on = String(o.visible);
    vis.title = 'Show / hide';
    vis.onclick = (e) => {
      e.stopPropagation();
      o.visible = !o.visible;
      renderLayers(list);
      scheduleSave();
    };

    const dup = el('button', 'layer__btn', rowEl);
    dup.appendChild(icon('copy', 'layer__icon'));
    dup.title = 'Duplicate';
    dup.onclick = (e) => { e.stopPropagation(); duplicateObject(o.id); scheduleSave(); };

    const del = el('button', 'layer__btn', rowEl);
    del.appendChild(icon('trash', 'layer__icon'));
    del.title = 'Delete';
    del.onclick = (e) => { e.stopPropagation(); removeObject(o.id); scheduleSave(); };
  });
}

/* ------------------------------------------------------------------ */
/* right sidebar                                                       */
/* ------------------------------------------------------------------ */

export function buildSceneRight(host) {
  host.innerHTML = '';
  const inspectorHost = el('div', null, host);
  inspectorHost.id = 'inspector-host';
  buildInspector(inspectorHost, selectedObject());
  buildExportPanel(host);
}

/* ------------------------------------------------------------------ */

export function applyScenePreset(name) {
  const p = SCENE_PRESETS[name]?.();
  if (!p) return;

  Object.assign(state.canvas, p.canvas);
  Object.assign(state.scene.camera, clone(p.camera));
  Object.assign(state.scene.light, clone(p.light));
  Object.assign(state.scene.backdrop, clone(p.backdrop));
  state.scene.objects = p.objects;
  state.scene.selectedId = p.objects[0]?.id ?? null;

  emit('canvas:resize');
  emit('scene:objects');
  emit('ui:rebuild');
  scheduleSave();
}
