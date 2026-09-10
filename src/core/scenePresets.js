import { makeObject, makeOscillator, baseMaterial } from './defaults.js';
import { RAMP_PRESETS, BRAND } from './palette.js';

function mat(rampName, over = {}) {
  const m = baseMaterial(rampName);
  Object.assign(m, over);
  m.colors = [...RAMP_PRESETS[rampName].colors];
  m.stops = [...RAMP_PRESETS[rampName].stops];
  if (over.colors) m.colors = [...over.colors];
  if (over.stops) m.stops = [...over.stops];
  return m;
}

function obj(type, patch = {}) {
  const o = makeObject(type, 0);
  const { material, geometry, oscillators, ...rest } = patch;
  Object.assign(o, rest);
  if (geometry) Object.assign(o.geometry, geometry);
  if (material) o.material = material;
  if (oscillators) o.oscillators = oscillators;
  return o;
}

function osc(target, amp, freq, phase = 0, wave = 'sine') {
  return { ...makeOscillator(target), amp, freq, phase, wave };
}

/** Starting points modelled on the reference imagery. */
export const SCENE_PRESETS = {
  Eclipse: () => ({
    canvas: { preset: 'square', width: 1080, height: 1080, background: '#F6D9D4' },
    camera: { mode: 'perspective', fov: 30, distance: 8.4, azimuth: 0, elevation: 0.03, target: { x: 0, y: 0, z: 0 }, zoom: 1 },
    light: { x: 2.4, y: 5.2, z: 4.2, intensity: 1.25, color: '#FFFFFF', showHelper: true, orbit: false, orbitSpeed: 0.15 },
    backdrop: {
      enabled: true, distance: 16, scale: 3.2,
      material: mat('Eclipse', {
        noiseSpace: 'screen', lightGain: 0, ambient: 0.42, fresnelMix: 0,
        noiseScale: 0.5, noiseAmount: 0.2, warpAmount: 0.25, smear: -0.8,
        contrast: 0.9, grain: 0.03, flowSpeed: 0.03
      })
    },
    objects: [
      obj('sphere', {
        name: 'Eclipse',
        geometry: { radius: 1.85, segments: 128 },
        material: mat('Eclipse', {
          lightGain: 1.3, lightWrap: 0.42, ambient: 0.0, fresnelMix: -0.28,
          fresnelPower: 1.8, specular: 0.12, specPower: 60,
          noiseScale: 0.55, noiseAmount: 0.07, warpAmount: 0.35, octaves: 3,
          contrast: 1.7, smear: 0.1, grain: 0.03, flowSpeed: 0.04
        }),
        oscillators: [osc('material.rampOffset', 0.05, 0.08)]
      })
    ]
  }),

  Chain: () => ({
    canvas: { preset: 'portrait', width: 1080, height: 1350, background: BRAND.paper },
    camera: { mode: 'perspective', fov: 34, distance: 12.5, azimuth: -0.32, elevation: 0.2, target: { x: 0, y: 0, z: 0 }, zoom: 1 },
    light: { x: -3.4, y: 4.6, z: 4.4, intensity: 1.2, color: '#FFFFFF', showHelper: true, orbit: false, orbitSpeed: 0.15 },
    backdrop: { enabled: false, distance: 16, scale: 3, material: mat('Chrome', { lightGain: 0, ambient: 0.6 }) },
    objects: [0, 1, 2, 3, 4].map((i) =>
      obj('roundedBox', {
        name: `Slab ${i + 1}`,
        position: { x: (i - 2) * 1.18, y: (i - 2) * 0.78, z: (i % 2) * -0.6 },
        rotation: { x: 0, y: -18, z: -12 },
        geometry: { width: 2.6, height: 0.95, depth: 0.95, cornerRadius: 0.47, segments: 12 },
        // Alternating red / neutral slabs, as in the reference strip.
        material: mat(i % 2 ? 'Chrome' : 'Molecule', {
          lightGain: 0.8, lightWrap: 0.35, ambient: 0.0, fresnelMix: -0.22,
          noiseScale: 1.0, noiseAmount: 0.22, warpAmount: 0.5, octaves: 3,
          rampOffset: 0.25, contrast: 1.25, grain: 0.03, flowSpeed: 0.1, noiseSpace: 'world'
        }),
        oscillators: [
          osc('position.y', 0.28, 0.18, i * 0.2),
          osc('material.rampOffset', 0.12, 0.12, i * 0.15)
        ]
      })
    )
  }),

  Metaballs: () => ({
    canvas: { preset: 'landscape', width: 1920, height: 1080, background: '#EFEDE8' },
    camera: { mode: 'perspective', fov: 30, distance: 10.5, azimuth: 0, elevation: 0.0, target: { x: 0, y: 0, z: 0 }, zoom: 1 },
    light: { x: 1.8, y: 3.2, z: 5.5, intensity: 1.3, color: '#FFFFFF', showHelper: true, orbit: false, orbitSpeed: 0.15 },
    backdrop: { enabled: false, distance: 16, scale: 3, material: mat('Chrome', { lightGain: 0, ambient: 0.6 }) },
    objects: [-1, 0, 1].map((i) =>
      obj('metaballs', {
        name: `Column ${i + 2}`,
        position: { x: i * 2.5, y: 0, z: 0 },
        scale: { x: 1.6, y: 2.6, z: 1.6 },
        geometry: {
          resolution: 48, count: i === 0 ? 5 : 4, strength: 0.7, subtract: 11,
          spread: 0.72, axis: 'y', chainSpacing: 0.25, wobble: 0.11, wobbleSpeed: 0.3 + i * 0.08
        },
        material: mat('Metaball', {
          lightGain: 1.4, lightWrap: 0.3, ambient: 0.0, fresnelMix: -0.4, fresnelPower: 2.2,
          specular: 0.2, specPower: 40,
          noiseScale: 1.0, noiseAmount: 0.14, warpAmount: 0.45, octaves: 3,
          contrast: 1.55, grain: 0.025, flowSpeed: 0.12, noiseSpace: 'local'
        }),
        oscillators: [osc('position.y', 0.35, 0.14, i * 0.33)]
      })
    )
  }),

  Molecule: () => ({
    canvas: { preset: 'banner', width: 1500, height: 600, background: BRAND.paper },
    camera: { mode: 'perspective', fov: 28, distance: 12, azimuth: 0.3, elevation: 0.12, target: { x: 0, y: 0, z: 0 }, zoom: 1 },
    light: { x: 3.6, y: 4.4, z: 3.2, intensity: 1.2, color: '#FFFFFF', showHelper: true, orbit: true, orbitSpeed: 0.06 },
    backdrop: { enabled: false, distance: 16, scale: 3, material: mat('Chrome', { lightGain: 0, ambient: 0.6 }) },
    objects: [
      [-3.1, 0.35, 0, 1.0], [-2.2, -0.6, 0.5, 0.72], [-3.4, -0.85, -0.4, 0.66],
      [-0.6, 0.15, 0, 0.82], [0.75, -0.35, 0.3, 0.7],
      [2.5, 0.6, 0, 1.05], [3.5, -0.35, -0.35, 0.78], [1.9, -0.8, 0.4, 0.62]
    ].map(([x, y, z, r], i) =>
      obj('sphere', {
        name: `Atom ${i + 1}`,
        position: { x, y, z },
        geometry: { radius: r, segments: 96 },
        material: mat('Molecule', {
          lightGain: 1.25, lightWrap: 0.6, ambient: 0.06, fresnelMix: -0.3,
          noiseScale: 1.3, noiseAmount: 0.26, warpAmount: 0.6, octaves: 3,
          contrast: 1.35, grain: 0.04, flowSpeed: 0.09, noiseSpace: 'world'
        }),
        oscillators: [
          osc('position.y', 0.12, 0.22, i * 0.12),
          osc('scale.uniform', 0.04, 0.17, i * 0.2)
        ]
      })
    )
  }),

  Orbit: () => ({
    canvas: { preset: 'square', width: 1080, height: 1080, background: '#111111' },
    camera: { mode: 'perspective', fov: 32, distance: 9.5, azimuth: 0.2, elevation: 0.18, target: { x: 0, y: 0, z: 0 }, zoom: 1 },
    light: { x: 4.2, y: 2.4, z: 3.0, intensity: 1.35, color: '#FFFFFF', showHelper: true, orbit: true, orbitSpeed: 0.12 },
    backdrop: { enabled: false, distance: 16, scale: 3, material: mat('Ember', { lightGain: 0, ambient: 0.35 }) },
    objects: [
      obj('torus', {
        name: 'Ring',
        rotation: { x: 72, y: 0, z: 0 },
        geometry: { radius: 2.4, tube: 0.28, segments: 220, tubeSegments: 48 },
        material: mat('Ember', {
          lightGain: 1.35, lightWrap: 0.4, ambient: 0.0, fresnelMix: -0.35,
          noiseScale: 1.2, noiseAmount: 0.16, warpAmount: 0.6, octaves: 3,
          contrast: 1.3, grain: 0.02, flowSpeed: 0.18, noiseSpace: 'local'
        }),
        oscillators: [osc('rotation.z', 180, 0.05, 0, 'saw')]
      }),
      obj('capsule', {
        name: 'Core',
        geometry: { radius: 0.85, length: 1.3, segments: 48 },
        material: mat('Ember', {
          lightGain: 1.25, lightWrap: 0.5, ambient: 0.04, fresnelMix: -0.45,
          noiseScale: 0.8, noiseAmount: 0.14, warpAmount: 0.45, octaves: 3,
          contrast: 1.3, grain: 0.02, flowSpeed: 0.1
        }),
        oscillators: [osc('rotation.y', 180, 0.08, 0, 'saw'), osc('scale.uniform', 0.06, 0.3)]
      })
    ]
  })
};

export const SCENE_PRESET_NAMES = Object.keys(SCENE_PRESETS);
