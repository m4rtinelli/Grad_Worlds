import * as THREE from 'three';
import { FIELD_VERT, FIELD_FRAG } from './shaders/field.glsl.js';
import { effectorAt } from './motion.js';

/** Full-frame interactive gradient. Its own renderer, sharing the stage frame. */
export class FieldApp {
  constructor(state, frameEl) {
    this.state = state;
    this.frameEl = frameEl;

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.canvas = this.renderer.domElement;
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    frameEl.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();

    this.uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },

      uColors: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()] },
      uStops: { value: new THREE.Vector4(0, 0.35, 0.7, 1) },

      uNoiseScale: { value: 1.1 },
      uNoiseAmount: { value: 0.55 },
      uOctaves: { value: 4 },
      uWarpAmount: { value: 0.85 },
      uWarpScale: { value: 0.9 },
      uFlowSpeed: { value: 0.16 },

      uRampOffset: { value: 0 },
      uContrast: { value: 1.25 },
      uPosterize: { value: 0 },
      uSmear: { value: 0 },
      uGrain: { value: 0.035 },
      uDither: { value: 0.5 },

      uScale: { value: 1 },
      uRotation: { value: 0 },
      uVignette: { value: 0 },

      uShade: { value: 0.45 },
      uLightDir: { value: new THREE.Vector2(-0.7, 0.7) },

      uP0: { value: new THREE.Vector2(0, 0) },
      uP1: { value: new THREE.Vector2(0, 0) },
      uUseSecond: { value: 0 },
      uRadius: { value: 0.42 },
      uStrength: { value: 0.9 },
      uFalloff: { value: 2 },
      uSwirl: { value: 0.6 }
    };

    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader: FIELD_VERT,
      fragmentShader: FIELD_FRAG,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false
    });
    this.quad = new THREE.Mesh(geo, mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    this.time = 0;
    this.pointer = { x: 0, y: 0 };      // smoothed, canvas-centred units
    this.pointerTarget = { x: 0, y: 0 };
    this.hasPointer = false;

    this._bindPointer();
    this.resize();
  }

  _bindPointer() {
    const toField = (e) => {
      const r = this.canvas.getBoundingClientRect();
      const aspect = this.state.canvas.width / this.state.canvas.height;
      const x = ((e.clientX - r.left) / r.width - 0.5) * aspect;
      const y = (0.5 - (e.clientY - r.top) / r.height);
      return { x, y };
    };

    const move = (e) => {
      if (this.state.tab !== 'field') return;
      this.pointerTarget = toField(e);
      this.hasPointer = true;
    };

    this.frameEl.addEventListener('pointermove', move);
    this.frameEl.addEventListener('pointerdown', move);
    this.frameEl.addEventListener('pointerleave', () => { this.hasPointer = false; });
  }

  resize() {
    const { width, height } = this.state.canvas;
    const q = this.state.field.quality;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(Math.round(width * q), Math.round(height * q), false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  syncUniforms() {
    const f = this.state.field;
    const m = f.material;
    const u = this.uniforms;

    for (let i = 0; i < 4; i++) u.uColors.value[i].set(m.colors[i] || '#000000');
    u.uStops.value.set(m.stops[0], m.stops[1], m.stops[2], m.stops[3]);

    u.uNoiseScale.value = m.noiseScale;
    u.uNoiseAmount.value = m.noiseAmount;
    u.uOctaves.value = Math.max(1, Math.round(m.octaves));
    u.uWarpAmount.value = m.warpAmount;
    u.uWarpScale.value = m.warpScale;
    u.uFlowSpeed.value = m.flowSpeed;

    u.uRampOffset.value = m.rampOffset;
    u.uContrast.value = m.contrast;
    u.uPosterize.value = m.posterize;
    u.uSmear.value = m.smear;
    u.uGrain.value = m.grain;
    u.uDither.value = m.dither;

    u.uScale.value = f.scale;
    u.uRotation.value = (f.rotation * Math.PI) / 180;
    u.uVignette.value = f.vignette;
    u.uShade.value = f.shade;

    const ang = (f.lightAngle * Math.PI) / 180;
    u.uLightDir.value.set(Math.cos(ang), Math.sin(ang));

    u.uFalloff.value = f.effector.falloff;
    u.uSwirl.value = f.effector.swirl;
    u.uUseSecond.value = f.effector.secondary ? 1 : 0;
  }

  step(dt) {
    const f = this.state.field;
    if (f.playing) this.time += dt * f.speed;

    // Pointer easing runs on wall-clock time so it always feels responsive.
    const k = 1 - Math.pow(f.effector.inertia, Math.max(dt, 1e-4) * 60);
    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * k;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * k;

    this.renderAt(this.time);
  }

  renderAt(time) {
    const f = this.state.field;
    const e = f.effector;
    this.syncUniforms();

    const pos = effectorAt(e.mode, time, e.speed, this.pointer);
    this.uniforms.uP0.value.set(pos.x, pos.y);
    this.uniforms.uP1.value.set(-pos.x, -pos.y);
    this.uniforms.uRadius.value = e.radius * (pos.radiusMul ?? 1);
    this.uniforms.uStrength.value = e.strength * (pos.strengthMul ?? 1);

    this.uniforms.uTime.value = time;
    const size = this.renderer.getSize(new THREE.Vector2());
    this.uniforms.uResolution.value.copy(size);

    this.renderer.render(this.scene, this.camera);
  }

  /** Export renders at full canvas resolution regardless of the quality setting. */
  beginExport(scale = 1) {
    const { width, height } = this.state.canvas;
    this.renderer.setSize(Math.round(width * scale), Math.round(height * scale), false);
  }

  renderExportFrame(time) {
    this.renderAt(time);
    return this.canvas;
  }

  endExport() {
    this.resize();
  }

  dispose() {
    this.quad.geometry.dispose();
    this.quad.material.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
