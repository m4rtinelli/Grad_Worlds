import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { buildGeometry } from './geometry.js';
import { createGradientMaterial, syncGradientMaterial, syncGradientContext } from './GradientMaterial.js';
import { oscillatorDeltas } from '../core/oscillators.js';

const MATERIAL_RANGE = {
  rampOffset: [-1, 1],
  contrast: [0.05, 4],
  noiseAmount: [0, 2],
  noiseScale: [0.01, 12],
  warpAmount: [0, 3],
  smear: [-2, 2]
};

/**
 * Owns the three.js scene graph and keeps it in sync with the plain-object state.
 * Rendering is time-driven (absolute seconds) rather than delta-driven so that
 * PNG-sequence export is frame-exact.
 */
export class SceneManager {
  constructor(state) {
    this.state = state;
    this.entries = new Map();   // object id -> { mesh, material, type, geomHash }

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.01, 500);
    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 500);
    this.activeCamera = this.camera;

    this.helpers = new THREE.Group();
    this.helpers.name = 'helpers';
    this.scene.add(this.helpers);

    this._buildBackdrop();
    this._buildSelectionHelper();
  }

  /* ------------------------------------------------------------------ */
  /* construction                                                        */
  /* ------------------------------------------------------------------ */

  _buildBackdrop() {
    this.backdropMaterial = createGradientMaterial(this.state.scene.backdrop.material);
    this.backdropMaterial.depthWrite = false;
    this.backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), this.backdropMaterial);
    this.backdrop.renderOrder = -1;
    this.backdrop.frustumCulled = false;
    this.scene.add(this.backdrop);
  }

  _buildSelectionHelper() {
    this.selectionBox = new THREE.Box3Helper(new THREE.Box3(), 0xf73a52);
    this.selectionBox.material.transparent = true;
    this.selectionBox.material.opacity = 0.5;
    this.selectionBox.visible = false;
    this.helpers.add(this.selectionBox);
  }

  /* ------------------------------------------------------------------ */
  /* object sync                                                         */
  /* ------------------------------------------------------------------ */

  geomHash(obj) {
    return obj.type + ':' + JSON.stringify(obj.geometry);
  }

  syncObjects() {
    const wanted = new Set(this.state.scene.objects.map((o) => o.id));

    for (const [id, entry] of this.entries) {
      if (!wanted.has(id)) {
        this.scene.remove(entry.mesh);
        entry.mesh.geometry?.dispose?.();
        entry.material.dispose();
        this.entries.delete(id);
      }
    }

    this.state.scene.objects.forEach((obj) => {
      let entry = this.entries.get(obj.id);
      const hash = this.geomHash(obj);

      if (entry && entry.type !== obj.type) {
        this.scene.remove(entry.mesh);
        entry.mesh.geometry?.dispose?.();
        entry.material.dispose();
        this.entries.delete(obj.id);
        entry = undefined;
      }

      if (!entry) {
        const material = createGradientMaterial(obj.material);
        const mesh = obj.type === 'metaballs'
          ? this._createMarchingCubes(obj, material)
          : new THREE.Mesh(buildGeometry(obj.type, obj.geometry), material);
        mesh.name = obj.name;
        this.scene.add(mesh);
        entry = { mesh, material, type: obj.type, geomHash: hash };
        this.entries.set(obj.id, entry);
      } else if (entry.geomHash !== hash) {
        if (obj.type === 'metaballs') {
          if (entry.mesh.resolutionValue !== obj.geometry.resolution) {
            this.scene.remove(entry.mesh);
            entry.mesh.geometry?.dispose?.();
            const mesh = this._createMarchingCubes(obj, entry.material);
            this.scene.add(mesh);
            entry.mesh = mesh;
          }
        } else {
          entry.mesh.geometry.dispose();
          entry.mesh.geometry = buildGeometry(obj.type, obj.geometry);
        }
        entry.geomHash = hash;
      }
    });
  }

  _createMarchingCubes(obj, material) {
    const res = Math.max(16, Math.round(obj.geometry.resolution));
    const mc = new MarchingCubes(res, material, true, false, 90000);
    mc.isolation = 80;
    mc.resolutionValue = res;
    mc.frustumCulled = false;
    // The field lives in local [-1, 1]; a fixed bound keeps picking working without
    // recomputing bounds over ~90k vertices every frame.
    mc.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.sqrt(3));
    mc.geometry.boundingBox = new THREE.Box3(
      new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1)
    );
    return mc;
  }

  syncMaterials() {
    this.state.scene.objects.forEach((obj) => {
      const entry = this.entries.get(obj.id);
      if (entry) syncGradientMaterial(entry.material, obj.material);
    });
    syncGradientMaterial(this.backdropMaterial, this.state.scene.backdrop.material);
  }

  /* ------------------------------------------------------------------ */
  /* per-frame                                                           */
  /* ------------------------------------------------------------------ */

  update(time, width, height) {
    const s = this.state.scene;
    const light = { ...s.light };

    if (s.light.orbit) {
      const r = Math.hypot(s.light.x, s.light.z) || 1;
      const a = time * s.light.orbitSpeed * Math.PI * 2;
      light.x = Math.cos(a) * r;
      light.z = Math.sin(a) * r;
    }
    this.currentLight = light;

    this.updateCamera(width, height);
    this.updateBackdrop(width, height);

    s.objects.forEach((obj) => {
      const entry = this.entries.get(obj.id);
      if (!entry) return;
      entry.mesh.visible = obj.visible;
      if (!obj.visible) return;

      const d = oscillatorDeltas(obj.oscillators, time);

      entry.mesh.position.set(
        obj.position.x + d.position.x,
        obj.position.y + d.position.y,
        obj.position.z + d.position.z
      );
      entry.mesh.rotation.set(
        (obj.rotation.x + d.rotation.x) * Math.PI / 180,
        (obj.rotation.y + d.rotation.y) * Math.PI / 180,
        (obj.rotation.z + d.rotation.z) * Math.PI / 180
      );
      entry.mesh.scale.set(
        Math.max(0.001, obj.scale.x + d.scale.x),
        Math.max(0.001, obj.scale.y + d.scale.y),
        Math.max(0.001, obj.scale.z + d.scale.z)
      );

      if (Object.keys(d.material).length) {
        const m = { ...obj.material };
        for (const [k, v] of Object.entries(d.material)) {
          const [lo, hi] = MATERIAL_RANGE[k] || [-Infinity, Infinity];
          m[k] = Math.min(hi, Math.max(lo, (m[k] ?? 0) + v));
        }
        syncGradientMaterial(entry.material, m);
      }

      if (obj.type === 'metaballs') this._updateMarchingCubes(entry.mesh, obj, time);

      syncGradientContext(entry.material, { time, width, height, light });
    });

    syncGradientContext(this.backdropMaterial, { time, width, height, light });

    this.updateSelectionHelper();
  }

  _updateMarchingCubes(mc, obj, time) {
    const g = obj.geometry;
    mc.reset();

    const count = Math.max(1, Math.round(g.count));
    const axis = g.axis || 'y';
    const span = g.spread;
    const wob = g.wobble;

    for (let i = 0; i < count; i++) {
      const u = count === 1 ? 0.5 : i / (count - 1);
      const centered = (u - 0.5) * span * (1 + g.chainSpacing);
      const phase = time * g.wobbleSpeed + i * 0.7;

      let x = 0.5, y = 0.5, z = 0.5;
      const jitterA = Math.sin(phase) * wob;
      const jitterB = Math.cos(phase * 0.83 + 1.1) * wob;

      if (axis === 'x') { x += centered; y += jitterA; z += jitterB; }
      else if (axis === 'z') { z += centered; x += jitterA; y += jitterB; }
      else { y += centered; x += jitterA; z += jitterB; }

      mc.addBall(
        THREE.MathUtils.clamp(x, 0.02, 0.98),
        THREE.MathUtils.clamp(y, 0.02, 0.98),
        THREE.MathUtils.clamp(z, 0.02, 0.98),
        g.strength,
        g.subtract
      );
    }

    if (typeof mc.update === 'function') mc.update();
  }

  updateBackdrop(width, height) {
    const b = this.state.scene.backdrop;
    this.backdrop.visible = b.enabled;
    if (!b.enabled) return;

    const cam = this.activeCamera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    this.backdrop.position.copy(cam.position).addScaledVector(dir, b.distance);
    this.backdrop.quaternion.copy(cam.quaternion);

    let h, w;
    if (cam.isOrthographicCamera) {
      h = (cam.top - cam.bottom) / cam.zoom;
      w = (cam.right - cam.left) / cam.zoom;
    } else {
      h = 2 * Math.tan((cam.fov * Math.PI / 180) / 2) * b.distance;
      w = h * (width / height);
    }
    this.backdrop.scale.set(w * b.scale, h * b.scale, 1);
  }

  updateCamera(width, height) {
    const c = this.state.scene.camera;
    const aspect = width / height;
    const t = c.target;

    const x = t.x + c.distance * Math.cos(c.elevation) * Math.sin(c.azimuth);
    const y = t.y + c.distance * Math.sin(c.elevation);
    const z = t.z + c.distance * Math.cos(c.elevation) * Math.cos(c.azimuth);

    if (c.mode === 'orthographic') {
      const h = c.distance * 0.5 / c.zoom;
      this.orthoCamera.left = -h * aspect;
      this.orthoCamera.right = h * aspect;
      this.orthoCamera.top = h;
      this.orthoCamera.bottom = -h;
      this.orthoCamera.position.set(x, y, z);
      this.orthoCamera.lookAt(t.x, t.y, t.z);
      this.orthoCamera.updateProjectionMatrix();
      this.activeCamera = this.orthoCamera;
    } else {
      this.camera.fov = c.fov;
      this.camera.aspect = aspect;
      this.camera.position.set(x, y, z);
      this.camera.lookAt(t.x, t.y, t.z);
      this.camera.updateProjectionMatrix();
      this.activeCamera = this.camera;
    }
  }

  updateSelectionHelper() {
    const id = this.state.scene.selectedId;
    const entry = id ? this.entries.get(id) : null;
    if (!entry || !entry.mesh.visible || !this.helpersVisible || !this.state.scene.showSelection) {
      this.selectionBox.visible = false;
      return;
    }
    const box = new THREE.Box3().setFromObject(entry.mesh);
    if (box.isEmpty()) { this.selectionBox.visible = false; return; }
    this.selectionBox.box.copy(box);
    this.selectionBox.visible = true;
  }

  set helpersVisible(v) { this._helpersVisible = v; this.helpers.visible = v; }
  get helpersVisible() { return this._helpersVisible !== false; }

  dispose() {
    this.entries.forEach((e) => { e.mesh.geometry?.dispose?.(); e.material.dispose(); });
    this.entries.clear();
    this.backdrop.geometry.dispose();
    this.backdropMaterial.dispose();
  }
}
