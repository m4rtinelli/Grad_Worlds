import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { ViewportControls } from './ViewportControls.js';

/** WebGL renderer + camera interaction + the frame clock for the 3D tab. */
export class Viewport {
  constructor(state, frameEl) {
    this.state = state;
    this.frameEl = frameEl;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,   // required for canvas.toBlob() capture
      powerPreference: 'high-performance'
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);

    this.canvas = this.renderer.domElement;
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    frameEl.appendChild(this.canvas);

    this.manager = new SceneManager(state);
    this.clock = new THREE.Clock();
    this.time = 0;
    this.fps = 0;
    this._fpsAcc = 0;
    this._fpsFrames = 0;

    this.controls = new ViewportControls(state, this);
    this.resize();
  }

  /* ---------------- sizing ---------------- */

  resize() {
    const { width, height, dpr } = this.state.canvas;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  /* ---------------- frame ---------------- */

  step(dt) {
    const s = this.state.scene;
    if (s.playing) this.time += dt * s.speed;
    s.time = this.time;
    this.renderAt(this.time);

    this._fpsAcc += dt;
    this._fpsFrames++;
    if (this._fpsAcc > 0.5) {
      this.fps = Math.round(this._fpsFrames / this._fpsAcc);
      this._fpsAcc = 0;
      this._fpsFrames = 0;
    }
  }

  /** Deterministic render at an absolute time — used by both preview and export. */
  renderAt(time) {
    const { width, height, background, transparent } = this.state.canvas;
    this.manager.update(time, width, height);

    if (transparent) {
      this.renderer.setClearColor(0x000000, 0);
    } else {
      this.renderer.setClearColor(new THREE.Color(background), 1);
    }
    this.renderer.render(this.manager.scene, this.manager.activeCamera);
  }

  /** Export lifecycle: hide gizmos and optionally supersample. */
  beginExport(scale = 1) {
    this._exportPrevHelpers = this.manager.helpersVisible;
    this.manager.helpersVisible = false;
    this.renderer.setPixelRatio(scale);
    this.renderer.setSize(this.state.canvas.width, this.state.canvas.height, false);
  }

  renderExportFrame(time) {
    this.renderAt(time);
    return this.canvas;
  }

  endExport() {
    this.manager.helpersVisible = this._exportPrevHelpers !== false;
    this.resize();
  }

  setTime(t) {
    this.time = t;
    this.state.scene.time = t;
  }

  dispose() {
    this.manager.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
