import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Build (or rebuild) a geometry from an object's `geometry` parameter block. */
export function buildGeometry(type, g) {
  switch (type) {
    case 'sphere':
      return new THREE.SphereGeometry(g.radius, g.segments, Math.round(g.segments / 2));

    case 'roundedBox': {
      // RoundedBoxGeometry clamps the radius internally, but keep it sane here too.
      const r = Math.min(g.cornerRadius, Math.min(g.width, g.height, g.depth) / 2 - 1e-4);
      return new RoundedBoxGeometry(g.width, g.height, g.depth, g.segments, Math.max(0.001, r));
    }

    case 'capsule':
      return new THREE.CapsuleGeometry(g.radius, g.length, Math.round(g.segments / 2), g.segments);

    case 'torus':
      return new THREE.TorusGeometry(g.radius, g.tube, g.tubeSegments, g.segments);

    case 'cylinder':
      return new THREE.CylinderGeometry(g.radiusTop, g.radiusBottom, g.height, g.segments, 1, false);

    default:
      return new THREE.SphereGeometry(1, 64, 32);
  }
}

/** Parameters that are exposed in the inspector, per object type. */
export const GEOMETRY_CONTROLS = {
  sphere: [
    { key: 'radius', label: 'Radius', min: 0.05, max: 4, step: 0.01 },
    { key: 'segments', label: 'Segments', min: 8, max: 192, step: 2 }
  ],
  roundedBox: [
    { key: 'width', label: 'Width', min: 0.05, max: 6, step: 0.01 },
    { key: 'height', label: 'Height', min: 0.05, max: 6, step: 0.01 },
    { key: 'depth', label: 'Depth', min: 0.05, max: 6, step: 0.01 },
    { key: 'cornerRadius', label: 'Corner', min: 0.001, max: 2, step: 0.005 },
    { key: 'segments', label: 'Smoothness', min: 1, max: 24, step: 1 }
  ],
  capsule: [
    { key: 'radius', label: 'Radius', min: 0.05, max: 3, step: 0.01 },
    { key: 'length', label: 'Length', min: 0, max: 6, step: 0.01 },
    { key: 'segments', label: 'Segments', min: 6, max: 96, step: 2 }
  ],
  torus: [
    { key: 'radius', label: 'Radius', min: 0.1, max: 4, step: 0.01 },
    { key: 'tube', label: 'Thickness', min: 0.02, max: 2, step: 0.01 },
    { key: 'segments', label: 'Segments', min: 8, max: 256, step: 4 },
    { key: 'tubeSegments', label: 'Tube seg.', min: 4, max: 96, step: 2 }
  ],
  cylinder: [
    { key: 'radiusTop', label: 'Top', min: 0, max: 3, step: 0.01 },
    { key: 'radiusBottom', label: 'Bottom', min: 0, max: 3, step: 0.01 },
    { key: 'height', label: 'Height', min: 0.05, max: 6, step: 0.01 },
    { key: 'segments', label: 'Segments', min: 3, max: 128, step: 1 }
  ],
  metaballs: [
    { key: 'count', label: 'Balls', min: 1, max: 14, step: 1 },
    { key: 'resolution', label: 'Resolution', min: 16, max: 80, step: 4 },
    { key: 'strength', label: 'Strength', min: 0.05, max: 1.6, step: 0.01 },
    { key: 'subtract', label: 'Falloff', min: 2, max: 30, step: 0.5 },
    { key: 'spread', label: 'Spread', min: 0, max: 1, step: 0.01 },
    { key: 'chainSpacing', label: 'Spacing', min: 0, max: 1, step: 0.01 },
    { key: 'wobble', label: 'Wobble', min: 0, max: 0.8, step: 0.01 },
    { key: 'wobbleSpeed', label: 'Wobble spd', min: 0, max: 3, step: 0.01 }
  ]
};

/** Keys that require a full geometry rebuild when changed. */
export function geometryKeys(type) {
  return (GEOMETRY_CONTROLS[type] || []).map((c) => c.key);
}
