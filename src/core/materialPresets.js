import { defaultMaterial } from './defaults.js';

const PRESET_KEY = 'zivo.materialPresets.v1';
const DEFAULT_KEY = 'zivo.materialDefault.v1';

/** Every field of a material block, so a preset restores a look completely. */
const FIELDS = [
  'ramp', 'colors', 'stops',
  'lightGain', 'lightWrap', 'ambient', 'fresnelMix', 'fresnelPower', 'specular', 'specPower',
  'noiseScale', 'noiseAmount', 'octaves', 'warpAmount', 'warpScale', 'flowSpeed', 'noiseSpace',
  'rampOffset', 'contrast', 'posterize', 'smear',
  'grain', 'dither', 'opacity'
];

/** Copy only the material fields — never ids, names or transforms. */
export function pickMaterial(m) {
  const out = {};
  for (const k of FIELDS) {
    if (m[k] === undefined) continue;
    out[k] = Array.isArray(m[k]) ? [...m[k]] : m[k];
  }
  return out;
}

/** Write a stored look onto a live material object, in place. */
export function applyMaterial(target, preset) {
  Object.assign(target, pickMaterial(preset));
  return target;
}

/* ------------------------------------------------------------------ */
/* saved presets                                                       */
/* ------------------------------------------------------------------ */

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

/** @returns {{name: string, material: object}[]} newest first */
export function listPresets() {
  const all = read(PRESET_KEY, []);
  return Array.isArray(all) ? all : [];
}

export function savePreset(name, material) {
  const clean = String(name || '').trim().slice(0, 40);
  if (!clean) return null;
  const all = listPresets().filter((p) => p.name !== clean);
  all.unshift({ name: clean, material: pickMaterial(material), saved: Date.now() });
  write(PRESET_KEY, all.slice(0, 60));
  return clean;
}

export function deletePreset(name) {
  write(PRESET_KEY, listPresets().filter((p) => p.name !== name));
}

export function getPreset(name) {
  return listPresets().find((p) => p.name === name) || null;
}

/** Merge presets from an imported file. Returns how many were added. */
export function importPresets(json) {
  const incoming = Array.isArray(json) ? json : json?.presets;
  if (!Array.isArray(incoming)) throw new Error('Not a preset file');

  const all = listPresets();
  let added = 0;
  for (const p of incoming) {
    if (!p?.name || !p?.material) continue;
    let name = String(p.name).slice(0, 40);
    // Keep both when a name already exists rather than silently overwriting.
    if (all.some((x) => x.name === name)) {
      let n = 2;
      while (all.some((x) => x.name === `${name} ${n}`)) n++;
      name = `${name} ${n}`;
    }
    all.push({ name, material: pickMaterial(p.material), saved: Date.now() });
    added++;
  }
  write(PRESET_KEY, all);
  return added;
}

export function exportPresets() {
  return JSON.stringify({ kind: 'zivo.materialPresets', version: 1, presets: listPresets() }, null, 2);
}

/* ------------------------------------------------------------------ */
/* the default a new object starts from                                */
/* ------------------------------------------------------------------ */

export function setDefaultMaterial(material) {
  return write(DEFAULT_KEY, pickMaterial(material));
}

export function clearDefaultMaterial() {
  try { localStorage.removeItem(DEFAULT_KEY); } catch { /* ignore */ }
}

export function hasCustomDefault() {
  return read(DEFAULT_KEY, null) !== null;
}

/** The stored default if one was set, otherwise the house default. */
export function userDefaultMaterial() {
  const stored = read(DEFAULT_KEY, null);
  const base = defaultMaterial();
  return stored ? applyMaterial(base, stored) : base;
}
