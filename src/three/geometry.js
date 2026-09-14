import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Build (or rebuild) a geometry from an object's `geometry` parameter block. */
export function buildGeometry(type, g) {
  switch (type) {
    case 'svg':
      return buildSvgGeometry(g);

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

/**
 * Extrude the filled paths of an SVG document into one mesh. The result is
 * centred on the origin and scaled so its largest dimension equals `g.size`,
 * so the extrusion depth is expressed as a fraction of that size and any
 * artboard scale in the file is irrelevant.
 */
function buildSvgGeometry(g) {
  try {
    const { paths } = new SVGLoader().parse(g.svg || '');

    // Prefer filled paths (that is what a logo's silhouette is); if the file is
    // stroke-only fall back to outlining every path.
    let usable = paths.filter((p) => {
      const fill = p.userData?.style?.fill;
      return fill !== undefined && fill !== 'none';
    });
    if (!usable.length) usable = paths;

    const shapes = usable.flatMap((p) => SVGLoader.createShapes(p));
    if (!shapes.length) throw new Error('No fillable paths in SVG');

    // Work out the outline's extent first so depth / bevel scale with the art.
    const box = new THREE.Box2();
    shapes.forEach((s) => s.getPoints(8).forEach((pt) => box.expandByPoint(pt)));
    const extent = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) || 1;
    const unit = extent / g.size;   // one world unit, in SVG units

    const bevel = g.bevelSize > 0;
    const pieces = shapes.map((shape) => new THREE.ExtrudeGeometry(shape, {
      depth: g.depth * unit,
      curveSegments: Math.max(1, Math.round(g.curveSegments)),
      bevelEnabled: bevel,
      bevelSize: g.bevelSize * unit,
      bevelThickness: g.bevelThickness * unit,
      bevelSegments: Math.max(1, Math.round(g.bevelSegments)),
      bevelOffset: 0
    }));

    const geom = pieces.length === 1 ? pieces[0] : mergeGeometries(pieces, false);
    pieces.forEach((p) => { if (p !== geom) p.dispose(); });

    // SVG has y pointing down: a half-turn about X puts it upright while keeping
    // the winding (a plain mirror would flip every normal inwards).
    geom.rotateX(Math.PI);
    geom.scale(1 / unit, 1 / unit, 1 / unit);
    geom.center();
    return geom;
  } catch (err) {
    console.warn('SVG extrude failed:', err);
    return new THREE.SphereGeometry(0.5, 32, 16);
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
  svg: [
    { key: 'size', label: 'Size', min: 0.1, max: 8, step: 0.01 },
    { key: 'depth', label: 'Depth', min: 0, max: 4, step: 0.01 },
    { key: 'bevelSize', label: 'Bevel', min: 0, max: 0.5, step: 0.005 },
    { key: 'bevelThickness', label: 'Bevel depth', min: 0, max: 0.5, step: 0.005 },
    { key: 'bevelSegments', label: 'Bevel seg.', min: 1, max: 12, step: 1 },
    { key: 'curveSegments', label: 'Curve seg.', min: 1, max: 48, step: 1 }
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
