import { WAVES } from '../core/oscillators.js';

export const EFFECTOR_MODES = [
  { id: 'mouse',     label: 'Mouse' },
  { id: 'orbit',     label: 'Orbit' },
  { id: 'lissajous', label: 'Lissajous' },
  { id: 'figure8',   label: 'Figure 8' },
  { id: 'drift',     label: 'Drift' },
  { id: 'pulse',     label: 'Pulse' },
  { id: 'sweep',     label: 'Sweep' }
];

/**
 * Where the effector sits at time `t` (canvas-centred units, y up).
 * Returns multipliers so a preset can breathe its radius/strength too.
 */
export function effectorAt(mode, t, speed, pointer) {
  const a = t * speed * Math.PI * 2;
  switch (mode) {
    case 'orbit':
      return { x: Math.cos(a) * 0.3, y: Math.sin(a) * 0.3, radiusMul: 1, strengthMul: 1 };

    case 'lissajous':
      return { x: Math.sin(a * 1.5) * 0.42, y: Math.sin(a * 2) * 0.3, radiusMul: 1, strengthMul: 1 };

    case 'figure8':
      return { x: Math.sin(a) * 0.4, y: Math.sin(a) * Math.cos(a) * 0.42, radiusMul: 1, strengthMul: 1 };

    case 'drift':
      return {
        x: WAVES.wander(t * speed * 0.6) * 0.42,
        y: WAVES.wander(t * speed * 0.6 + 17.3) * 0.34,
        radiusMul: 1 + WAVES.wander(t * speed * 0.4 + 5.1) * 0.25,
        strengthMul: 1
      };

    case 'pulse':
      return {
        x: 0, y: 0,
        radiusMul: 1 + Math.sin(a) * 0.55,
        strengthMul: 0.75 + Math.sin(a + 1.2) * 0.25
      };

    case 'sweep':
      return { x: WAVES.triangle(t * speed) * 0.55, y: Math.sin(a * 0.5) * 0.1, radiusMul: 1.2, strengthMul: 1 };

    case 'mouse':
    default:
      return { x: pointer.x, y: pointer.y, radiusMul: 1, strengthMul: 1 };
  }
}

/** Presets that set several field parameters at once. */
export const FIELD_PRESETS = {
  'Soft Bloom': {
    material: { ramp: 'Eclipse', noiseScale: 0.9, noiseAmount: 0.5, warpAmount: 0.7, octaves: 4, flowSpeed: 0.1, contrast: 1.1, grain: 0.03 },
    effector: { mode: 'mouse', radius: 0.5, strength: 0.8, falloff: 2.2, swirl: 0.25, speed: 0.3 },
    shade: 0.4, vignette: 0.15, scale: 1.0
  },
  'Liquid Ink': {
    material: { ramp: 'Metaball', noiseScale: 1.15, noiseAmount: 0.7, warpAmount: 1.2, octaves: 5, flowSpeed: 0.08, contrast: 1.45, grain: 0.02 },
    effector: { mode: 'drift', radius: 0.4, strength: 1.0, falloff: 1.8, swirl: 0.55, speed: 0.25 },
    shade: 0.55, vignette: 0.0, scale: 1.1
  },
  'Chromatic Blot': {
    material: { ramp: 'Gel Blot', noiseScale: 2.2, noiseAmount: 0.7, warpAmount: 0.5, octaves: 3, flowSpeed: 0.05, contrast: 1.6, smear: 0.35, grain: 0.05 },
    effector: { mode: 'sweep', radius: 0.5, strength: 0.8, falloff: 2.4, swirl: 0.2, speed: 0.15 },
    shade: 0.25, vignette: 0.1, scale: 0.9
  },
  'Slow Orbit': {
    material: { ramp: 'Molecule', noiseScale: 0.7, noiseAmount: 0.45, warpAmount: 0.9, octaves: 4, flowSpeed: 0.06, contrast: 1.0, grain: 0.025 },
    effector: { mode: 'orbit', radius: 0.5, strength: 1.0, falloff: 2.2, swirl: 0.8, speed: 0.12 },
    shade: 0.5, vignette: 0.2, scale: 0.85
  },
  'Signal': {
    material: { ramp: 'Ember', noiseScale: 1.8, noiseAmount: 0.9, warpAmount: 0.35, octaves: 3, flowSpeed: 0.22, contrast: 2.6, posterize: 7, dither: 0.35, grain: 0.04 },
    effector: { mode: 'lissajous', radius: 0.3, strength: 1.3, falloff: 1.4, swirl: 1.4, speed: 0.35 },
    shade: 0.3, vignette: 0.0, scale: 1.2
  }
};
