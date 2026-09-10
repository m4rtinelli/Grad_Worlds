const TAU = Math.PI * 2;

/** Bipolar waveforms in -1..1, phase in turns (0..1). */
export const WAVES = {
  sine:     (x) => Math.sin(x * TAU),
  triangle: (x) => 4 * Math.abs(((x + 0.75) % 1) - 0.5) - 1,
  saw:      (x) => 2 * ((x + 0.5) % 1) - 1,
  square:   (x) => (((x % 1) + 1) % 1 < 0.5 ? 1 : -1),
  /* Smooth pseudo-random walk — deterministic, so exports stay reproducible. */
  wander:   (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const r = (n) => {
      const s = Math.sin(n * 127.1) * 43758.5453;
      return (s - Math.floor(s)) * 2 - 1;
    };
    const a = r(i), b = r(i + 1);
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  }
};

export const WAVE_LIST = Object.keys(WAVES);

export const OSC_TARGETS = [
  { id: 'position.x', label: 'Position X' },
  { id: 'position.y', label: 'Position Y' },
  { id: 'position.z', label: 'Position Z' },
  { id: 'rotation.x', label: 'Rotate X' },
  { id: 'rotation.y', label: 'Rotate Y' },
  { id: 'rotation.z', label: 'Rotate Z' },
  { id: 'scale.uniform', label: 'Scale (all)' },
  { id: 'scale.x', label: 'Scale X' },
  { id: 'scale.y', label: 'Scale Y' },
  { id: 'scale.z', label: 'Scale Z' },
  { id: 'material.rampOffset', label: 'Ramp offset' },
  { id: 'material.contrast', label: 'Ramp contrast' },
  { id: 'material.noiseAmount', label: 'Noise amount' },
  { id: 'material.noiseScale', label: 'Noise scale' },
  { id: 'material.warpAmount', label: 'Warp amount' },
  { id: 'material.smear', label: 'Smear' }
];

export function evalOscillator(osc, time) {
  const fn = WAVES[osc.wave] || WAVES.sine;
  return fn(time * osc.freq + osc.phase) * osc.amp;
}

/**
 * Returns additive deltas for one object at absolute time `time`.
 * Nothing is mutated — the renderer adds these on top of the stored base values,
 * so scrubbing time or exporting a sequence is always deterministic.
 */
export function oscillatorDeltas(oscillators, time) {
  const d = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 0, y: 0, z: 0 },
    material: {}
  };
  for (const osc of oscillators) {
    if (!osc.enabled) continue;
    const v = evalOscillator(osc, time);
    const [group, key] = osc.target.split('.');
    if (group === 'scale' && key === 'uniform') {
      d.scale.x += v; d.scale.y += v; d.scale.z += v;
    } else if (group === 'material') {
      d.material[key] = (d.material[key] || 0) + v;
    } else if (d[group] && key in d[group]) {
      d[group][key] += v;
    }
  }
  return d;
}
