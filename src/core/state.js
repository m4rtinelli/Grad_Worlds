import { defaultState, makeObject, defaultGeometry, nextId } from './defaults.js';
import { userDefaultMaterial } from './materialPresets.js';
import { emit } from './bus.js';

const STORAGE_KEY = 'zivo.gradient.studio.v1';

export const state = defaultState();

/* ---------------- deep helpers ---------------- */

export const clone = (v) => JSON.parse(JSON.stringify(v));

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
  return value;
}

/* ---------------- selection ---------------- */

export function selectedObject() {
  return state.scene.objects.find((o) => o.id === state.scene.selectedId) || null;
}

export function select(id) {
  state.scene.selectedId = id;
  emit('scene:selection', id);
  emit('ui:inspector');
}

/* ---------------- object CRUD ---------------- */

export function addObject(type) {
  const obj = makeObject(type, state.scene.objects.length);
  obj.material = userDefaultMaterial();
  // Nudge new objects onto a free spot so they do not stack invisibly.
  obj.position.x = (state.scene.objects.length % 5) * 0.9 - 1.8;
  state.scene.objects.push(obj);
  state.scene.selectedId = obj.id;
  emit('scene:objects');
  emit('ui:layers');
  emit('ui:inspector');
  return obj;
}

export function removeObject(id) {
  const i = state.scene.objects.findIndex((o) => o.id === id);
  if (i < 0) return;
  state.scene.objects.splice(i, 1);
  if (state.scene.selectedId === id) {
    state.scene.selectedId = state.scene.objects[Math.min(i, state.scene.objects.length - 1)]?.id ?? null;
  }
  emit('scene:objects');
  emit('ui:layers');
  emit('ui:inspector');
}

export function duplicateObject(id) {
  const src = state.scene.objects.find((o) => o.id === id);
  if (!src) return;
  const copy = clone(src);
  copy.id = nextId('obj');
  copy.name = src.name.replace(/ copy( \d+)?$/, '') + ' copy';
  copy.position.x += 0.9;
  copy.oscillators = copy.oscillators.map((o) => ({ ...o, id: nextId('osc') }));
  state.scene.objects.splice(state.scene.objects.indexOf(src) + 1, 0, copy);
  state.scene.selectedId = copy.id;
  emit('scene:objects');
  emit('ui:layers');
  emit('ui:inspector');
  return copy;
}

export function reorderObject(id, delta) {
  const objs = state.scene.objects;
  const i = objs.findIndex((o) => o.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= objs.length) return;
  [objs[i], objs[j]] = [objs[j], objs[i]];
  emit('ui:layers');
}

export function changeObjectType(obj, type) {
  obj.type = type;
  obj.geometry = defaultGeometry(type);
  emit('scene:objects');
  emit('ui:layers');
  emit('ui:inspector');
}

/* ---------------- material propagation ---------------- */

export function applyMaterialToAll(material) {
  state.scene.objects.forEach((o) => { o.material = clone(material); });
  emit('scene:material');
}

/* ---------------- persistence ---------------- */

function stripRuntime(s) {
  const out = clone(s);
  out.scene.time = 0;
  return out;
}

export function serialize() {
  return JSON.stringify(stripRuntime(state), null, 2);
}

export function hydrate(data) {
  const fresh = defaultState();
  const merged = deepMerge(fresh, data);
  // Arrays are replaced wholesale, not merged.
  merged.scene.objects = (data?.scene?.objects || []).map((o) => deepMerge(makeObject(o.type || 'sphere'), o));
  Object.assign(state, merged);
  emit('scene:objects');
  emit('scene:camera');
  emit('canvas:resize');
  emit('ui:rebuild');
}

function deepMerge(base, patch) {
  if (patch === undefined || patch === null) return base;
  if (Array.isArray(base) || Array.isArray(patch)) return clone(patch ?? base);
  if (typeof base !== 'object' || typeof patch !== 'object') return patch ?? base;
  const out = { ...base };
  for (const k of Object.keys(patch)) out[k] = deepMerge(base[k], patch[k]);
  return out;
}

export function saveLocal() {
  try { localStorage.setItem(STORAGE_KEY, serialize()); } catch { /* quota / private mode */ }
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    hydrate(JSON.parse(raw));
    return true;
  } catch { return false; }
}

export function clearLocal() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

let saveTimer = 0;
export function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveLocal, 600);
}
