import * as THREE from 'three';
import { emit } from '../core/bus.js';
import { select, scheduleSave } from '../core/state.js';

const NDC = new THREE.Vector2();
const PLANE = new THREE.Plane();
const HIT = new THREE.Vector3();
const CAM_DIR = new THREE.Vector3();

/**
 * Viewport interaction:
 *   - click an object to select it, drag to move it
 *   - the light has its own handle on the stage (see ui/lightGizmo.js)
 *   - drag empty space to orbit, shift/middle-drag to pan, wheel to dolly
 *   - shift while dragging a gizmo moves it towards / away from the camera
 */
export class ViewportControls {
  constructor(state, viewport) {
    this.state = state;
    this.viewport = viewport;
    this.manager = viewport.manager;
    this.canvas = viewport.canvas;

    this.raycaster = new THREE.Raycaster();
    this.drag = null;
    this.hover = null;

    this._bind();
  }

  /* ------------------------------------------------------------------ */

  get camera() { return this.manager.activeCamera; }

  _ndc(e) {
    const r = this.canvas.getBoundingClientRect();
    NDC.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    );
    return NDC;
  }

  _cast(e) {
    this.raycaster.setFromCamera(this._ndc(e), this.camera);
  }

  /** What is under the pointer: the light gizmo, an object, or nothing. */
  _pick(e) {
    this._cast(e);

    const meshes = [];
    const byMesh = new Map();
    this.state.scene.objects.forEach((obj) => {
      if (!obj.visible) return;
      const entry = this.manager.entries.get(obj.id);
      if (!entry) return;
      meshes.push(entry.mesh);
      byMesh.set(entry.mesh, obj);
    });

    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length) return { kind: 'object', obj: byMesh.get(hits[0].object), mesh: hits[0].object };
    return null;
  }

  /** Point where the pointer ray meets the camera-facing plane through `origin`. */
  _planePoint(e, origin) {
    this._cast(e);
    this.camera.getWorldDirection(CAM_DIR);
    PLANE.setFromNormalAndCoplanarPoint(CAM_DIR, origin);
    return this.raycaster.ray.intersectPlane(PLANE, HIT) ? HIT.clone() : null;
  }

  /* ------------------------------------------------------------------ */

  _bind() {
    const el = this.canvas;

    el.addEventListener('pointerdown', (e) => {
      if (this.state.tab !== 'scene') return;
      el.setPointerCapture(e.pointerId);

      const pan = e.button === 1 || (e.button === 0 && e.altKey);
      const pick = pan ? null : this._pick(e);

      if (pick?.kind === 'object') {
        if (this.state.scene.selectedId !== pick.obj.id) select(pick.obj.id);
        const origin = pick.mesh.getWorldPosition(new THREE.Vector3());
        this.drag = {
          kind: 'object',
          obj: pick.obj,
          origin,
          start: this._planePoint(e, origin),
          base: new THREE.Vector3(pick.obj.position.x, pick.obj.position.y, pick.obj.position.z),
          y: e.clientY
        };
        el.style.cursor = 'grabbing';
        return;
      }

      this.drag = {
        kind: pan || e.shiftKey ? 'pan' : 'orbit',
        x: e.clientX,
        y: e.clientY
      };
      el.style.cursor = this.drag.kind === 'pan' ? 'grabbing' : 'grabbing';
    });

    el.addEventListener('pointermove', (e) => {
      if (this.state.tab !== 'scene') return;

      if (!this.drag) { this._updateHover(e); return; }

      switch (this.drag.kind) {
        case 'object':  this._dragVector(e, this.drag.obj.position); break;
        case 'orbit':   this._orbit(e); break;
        case 'pan':     this._pan(e); break;
      }
    });

    const stop = (e) => {
      if (!this.drag) return;
      const wasGizmo = this.drag.kind === 'object';
      this.drag = null;
      el.style.cursor = '';
      try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      if (wasGizmo) scheduleSave();
    };
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('pointerleave', () => { if (!this.drag) el.style.cursor = ''; });

    el.addEventListener('wheel', (e) => {
      if (this.state.tab !== 'scene') return;
      e.preventDefault();
      const c = this.state.scene.camera;
      // Clamp per-event delta: trackpads and some mice emit deltas of several
      // hundred, which would otherwise double the distance in a single tick.
      const dy = Math.max(-120, Math.min(120, e.deltaY));
      const f = Math.exp(dy * 0.0022);
      if (c.mode === 'orthographic') c.zoom = THREE.MathUtils.clamp(c.zoom / f, 0.05, 20);
      else c.distance = THREE.MathUtils.clamp(c.distance * f, 0.6, 120);
      emit('ui:values');
    }, { passive: false });

    // Keep the browser context menu out of the way of middle/right dragging.
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ------------------------------------------------------------------ */

  /** Screen-plane move for the selected object. `target` has x/y/z. */
  _dragVector(e, target) {
    const d = this.drag;

    if (e.shiftKey) {
      // Depth: push along the camera axis by vertical pointer movement.
      this.camera.getWorldDirection(CAM_DIR);
      const amount = (e.clientY - d.y) * this.state.scene.camera.distance * 0.004;
      target.x = d.base.x + CAM_DIR.x * amount;
      target.y = d.base.y + CAM_DIR.y * amount;
      target.z = d.base.z + CAM_DIR.z * amount;
    } else {
      const point = this._planePoint(e, d.origin);
      if (!point || !d.start) return;
      target.x = d.base.x + (point.x - d.start.x);
      target.y = d.base.y + (point.y - d.start.y);
      target.z = d.base.z + (point.z - d.start.z);
    }
    emit('ui:values');
  }

  _orbit(e) {
    const c = this.state.scene.camera;
    c.azimuth -= (e.clientX - this.drag.x) * 0.006;
    c.elevation = THREE.MathUtils.clamp(c.elevation + (e.clientY - this.drag.y) * 0.006, -1.52, 1.52);
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
    emit('ui:values');
  }

  _pan(e) {
    const c = this.state.scene.camera;
    const dx = e.clientX - this.drag.x;
    const dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;

    const scale = c.distance * 0.0016;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
    c.target.x -= (right.x * dx - up.x * dy) * scale;
    c.target.y -= (right.y * dx - up.y * dy) * scale;
    c.target.z -= (right.z * dx - up.z * dy) * scale;
    emit('ui:values');
  }

  _updateHover(e) {
    const pick = this._pick(e);
    const kind = pick?.kind ?? null;
    if (kind !== this.hover) {
      this.hover = kind;
      this.canvas.style.cursor = kind ? 'grab' : '';
    }
  }
}
