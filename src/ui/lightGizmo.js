import * as THREE from 'three';
import { emit } from '../core/bus.js';
import { scheduleSave } from '../core/state.js';
import { el } from './controls.js';

const V = new THREE.Vector3();
const PLANE = new THREE.Plane();
const CAM_DIR = new THREE.Vector3();
const HIT = new THREE.Vector3();

/**
 * The light handle lives in the DOM, over the whole stage, rather than in the
 * 3D scene. The light is usually outside the export frame, so an in-canvas gizmo
 * would be unreachable — this one stays grabbable anywhere on the stage and can
 * never end up in an exported frame.
 */
export class LightGizmo {
  constructor(state, stageEl, viewport) {
    this.state = state;
    this.stage = stageEl;
    this.viewport = viewport;
    this.raycaster = new THREE.Raycaster();
    this.drag = null;

    this.layer = el('div', 'gizmo-layer', stageEl);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    svg.appendChild(this.line);
    this.layer.appendChild(svg);

    this.handle = el('div', 'gizmo-light', this.layer);
    this.handle.title = 'Drag to move the light · shift-drag for depth';
    const tag = el('span', 'gizmo-light__tag', this.handle);
    tag.textContent = 'Light';

    this._bind();
  }

  get camera() { return this.viewport.manager.activeCamera; }

  /* Pointer position as NDC relative to the render canvas — values outside
     -1..1 are fine and are exactly what makes off-frame dragging work. */
  _ndc(e) {
    const r = this.viewport.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    );
  }

  _planePoint(e, origin) {
    this.raycaster.setFromCamera(this._ndc(e), this.camera);
    this.camera.getWorldDirection(CAM_DIR);
    PLANE.setFromNormalAndCoplanarPoint(CAM_DIR, origin);
    return this.raycaster.ray.intersectPlane(PLANE, HIT) ? HIT.clone() : null;
  }

  _bind() {
    this.handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const l = this.state.scene.light;
      const origin = new THREE.Vector3(l.x, l.y, l.z);
      this.drag = {
        origin,
        start: this._planePoint(e, origin),
        base: origin.clone(),
        y: e.clientY
      };
      this.handle.dataset.drag = '1';
      this.handle.setPointerCapture(e.pointerId);
    });

    this.handle.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const l = this.state.scene.light;
      const d = this.drag;

      if (e.shiftKey) {
        this.camera.getWorldDirection(CAM_DIR);
        const amount = (e.clientY - d.y) * this.state.scene.camera.distance * 0.004;
        l.x = d.base.x + CAM_DIR.x * amount;
        l.y = d.base.y + CAM_DIR.y * amount;
        l.z = d.base.z + CAM_DIR.z * amount;
      } else {
        const p = this._planePoint(e, d.origin);
        if (!p || !d.start) return;
        l.x = d.base.x + (p.x - d.start.x);
        l.y = d.base.y + (p.y - d.start.y);
        l.z = d.base.z + (p.z - d.start.z);
      }
      emit('ui:values');
    });

    const stop = (e) => {
      if (!this.drag) return;
      this.drag = null;
      delete this.handle.dataset.drag;
      try { this.handle.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      scheduleSave();
    };
    this.handle.addEventListener('pointerup', stop);
    this.handle.addEventListener('pointercancel', stop);
  }

  /** Project the light (and the camera target) onto the stage, once per frame. */
  update() {
    const s = this.state.scene;
    const show = this.state.tab === 'scene' && s.light.showHelper;
    this.layer.style.display = show ? '' : 'none';
    if (!show) return;

    const canvasRect = this.viewport.canvas.getBoundingClientRect();
    const stageRect = this.stage.getBoundingClientRect();
    if (!canvasRect.width) return;

    const toStage = (x, y, z) => {
      V.set(x, y, z).project(this.camera);
      return {
        x: canvasRect.left - stageRect.left + (V.x * 0.5 + 0.5) * canvasRect.width,
        y: canvasRect.top - stageRect.top + (-V.y * 0.5 + 0.5) * canvasRect.height
      };
    };

    // While the light orbits, follow the animated position rather than the stored one.
    const live = this.viewport.manager.currentLight || s.light;
    const raw = toStage(live.x, live.y, live.z);
    const t = toStage(s.camera.target.x, s.camera.target.y, s.camera.target.z);

    // A light is usually well outside the frame, so park the handle on the edge of
    // the stage when it would fall off it. Dragging works from deltas, so a parked
    // handle still moves the light correctly.
    const m = 16;
    const p = {
      x: Math.min(stageRect.width - m, Math.max(m, raw.x)),
      y: Math.min(stageRect.height - m, Math.max(m, raw.y))
    };
    const parked = p.x !== raw.x || p.y !== raw.y;
    this.handle.dataset.parked = parked ? '1' : '0';

    this.handle.style.left = `${p.x}px`;
    this.handle.style.top = `${p.y}px`;
    this.line.setAttribute('x1', p.x);
    this.line.setAttribute('y1', p.y);
    this.line.setAttribute('x2', t.x);
    this.line.setAttribute('y2', t.y);

    // An orbiting light is driven by the clock, so its handle is not draggable.
    this.handle.style.pointerEvents = s.light.orbit ? 'none' : 'auto';
    this.handle.style.opacity = s.light.orbit ? '0.5' : '1';
  }
}
