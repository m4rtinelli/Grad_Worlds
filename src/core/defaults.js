import { BRAND, RAMP_PRESETS } from './palette.js';

export const CANVAS_PRESETS = [
  { id: 'square',    label: 'Square 1:1',      width: 1080, height: 1080 },
  { id: 'portrait',  label: 'Portrait 4:5',    width: 1080, height: 1350 },
  { id: 'story',     label: 'Story 9:16',      width: 1080, height: 1920 },
  { id: 'landscape', label: 'Landscape 16:9',  width: 1920, height: 1080 },
  { id: 'wide',      label: 'Wide 21:9',       width: 2520, height: 1080 },
  { id: 'banner',    label: 'Banner 5:2',      width: 1500, height: 600 },
  { id: 'poster',    label: 'Poster 2:3',      width: 1600, height: 2400 },
  { id: 'custom',    label: 'Custom…',         width: 1200, height: 900 }
];

export const OBJECT_TYPES = [
  { id: 'sphere',     label: 'Sphere' },
  { id: 'roundedBox', label: 'Rounded' },
  { id: 'capsule',    label: 'Capsule' },
  { id: 'torus',      label: 'Torus' },
  { id: 'cylinder',   label: 'Cylinder' },
  { id: 'metaballs',  label: 'Metaballs' }
];

/** Geometry parameters per object type. */
export function defaultGeometry(type) {
  switch (type) {
    case 'sphere':
      return { radius: 1, segments: 96 };
    case 'roundedBox':
      return { width: 1.6, height: 1, depth: 1, cornerRadius: 0.42, segments: 12 };
    case 'capsule':
      return { radius: 0.55, length: 1.2, segments: 32 };
    case 'torus':
      return { radius: 1, tube: 0.38, segments: 128, tubeSegments: 48 };
    case 'cylinder':
      return { radiusTop: 0.7, radiusBottom: 0.7, height: 1.6, segments: 64 };
    case 'metaballs':
      return {
        resolution: 48,
        count: 6,
        strength: 0.62,
        subtract: 12,
        spread: 0.62,
        axis: 'y',
        chainSpacing: 0.34,
        wobble: 0.18,
        wobbleSpeed: 0.35
      };
    default:
      return {};
  }
}

/**
 * The noisy-gradient material parameters. Shared shape for 3D objects and the 2D field.
 *
 * `baseMaterial` is the stable studio baseline that the built-in scene presets are
 * built on — leave it alone so those presets keep looking the way they were designed.
 * `defaultMaterial` is what a newly added object gets.
 */
function makeMaterial(rampName, over) {
  const ramp = RAMP_PRESETS[rampName] || RAMP_PRESETS.Molecule;
  return {
    ramp: rampName,
    colors: [...ramp.colors],
    stops: [...ramp.stops],

    // Lighting response
    lightGain: 1.0,      // how strongly N·L drives the ramp
    lightWrap: 0.45,     // wrap-around softness (0 = hard terminator)
    ambient: 0.12,       // constant lift
    fresnelMix: 0.35,    // rim contribution to the ramp
    fresnelPower: 2.6,
    specular: 0.18,      // narrow highlight lift toward stop 0
    specPower: 34,

    // Noise
    noiseScale: 1.6,     // frequency; the UI shows its reciprocal as "Size"
    noiseAmount: 0.22,
    octaves: 3,
    warpAmount: 0.45,
    warpScale: 0.9,
    flowSpeed: 0.12,     // noise drift over time
    noiseSpace: 'world',  // world | local | screen

    // Ramp shaping
    rampOffset: 0.0,
    contrast: 1.0,
    posterize: 0,        // 0 = off, otherwise number of bands
    smear: 0.0,          // vertical bias — the "blot" streak look

    // Finishing
    grain: 0.035,
    dither: 0.5,
    opacity: 1.0,

    ...over
  };
}

export function baseMaterial(rampName = 'Molecule') {
  return makeMaterial(rampName, {});
}

/** House default for new objects: fine, heavily warped grain with a strong rim. */
export const DEFAULT_MATERIAL_LOOK = {
  lightGain: 0.56,
  lightWrap: 0.26,
  ambient: -0.21,
  fresnelMix: 1.0,
  fresnelPower: 2.6,
  specular: 0.18,
  specPower: 34,

  noiseScale: 25,       // Size 0.04
  noiseAmount: 0.265,
  octaves: 6,
  warpAmount: 2.88,
  warpScale: 10,        // Warp size 0.10
  flowSpeed: -0.175,
  noiseSpace: 'world'
};

export function defaultMaterial(rampName = 'Molecule') {
  return makeMaterial(rampName, DEFAULT_MATERIAL_LOOK);
}

let uid = 0;
export const nextId = (p = 'o') => `${p}${(++uid).toString(36)}${Date.now().toString(36).slice(-3)}`;

export function makeOscillator(target = 'position.y') {
  return {
    id: nextId('osc'),
    enabled: true,
    target,
    wave: 'sine',
    amp: 0.4,
    freq: 0.25,
    phase: 0
  };
}

export function makeObject(type = 'sphere', index = 0) {
  const label = OBJECT_TYPES.find((t) => t.id === type)?.label || type;
  return {
    id: nextId('obj'),
    type,
    name: `${label} ${index + 1}`,
    visible: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    geometry: defaultGeometry(type),
    material: defaultMaterial(),
    oscillators: []
  };
}

export function defaultState() {
  return {
    tab: 'scene',

    canvas: {
      preset: 'landscape',
      width: 1920,
      height: 1080,
      background: BRAND.paper,
      transparent: false,
      dpr: 1
    },

    scene: {
      playing: true,
      speed: 1,
      time: 0,
      camera: {
        mode: 'perspective',
        fov: 32,
        distance: 9,
        azimuth: 0,
        elevation: 0.05,
        target: { x: 0, y: 0, z: 0 },
        zoom: 1
      },
      light: {
        x: 3.2, y: 4.0, z: 3.6,
        intensity: 1.15,
        color: '#FFFFFF',
        showHelper: true,
        orbit: false,
        orbitSpeed: 0.15
      },
      backdrop: {
        enabled: true,
        distance: 14,
        scale: 3.2,
        material: (() => {
          const m = baseMaterial('Eclipse');
          m.noiseSpace = 'screen';
          m.noiseScale = 0.55;
          m.noiseAmount = 0.35;
          m.warpAmount = 0.3;
          m.lightGain = 0.0;
          m.ambient = 0.5;
          m.fresnelMix = 0.0;
          m.smear = 0.85;
          m.contrast = 0.8;
          m.grain = 0.03;
          return m;
        })()
      },
      showSelection: true,
      objects: [],
      selectedId: null
    },

    field: {
      playing: true,
      speed: 1,
      material: (() => {
        const m = baseMaterial('Eclipse');
        m.noiseScale = 1.1;
        m.noiseAmount = 0.55;
        m.warpAmount = 0.85;
        m.octaves = 4;
        m.flowSpeed = 0.16;
        m.contrast = 1.25;
        return m;
      })(),
      effector: {
        mode: 'mouse',        // mouse | orbit | lissajous | drift | pulse | figure8
        radius: 0.45,
        strength: 0.75,
        falloff: 2.0,
        speed: 0.35,
        inertia: 0.09,        // mouse follow smoothing
        swirl: 0.3,
        secondary: false,     // add a mirrored second effector
        showCursor: false
      },
      vignette: 0.0,
      scale: 1.0,
      rotation: 0,
      shade: 0.45,
      lightAngle: 135,
      quality: 0.75
    },

    exporter: {
      fps: 30,
      duration: 4,
      prefix: 'zivo',
      scale: 1,
      loop: true
    }
  };
}
