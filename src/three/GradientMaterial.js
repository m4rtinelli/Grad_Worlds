import * as THREE from 'three';
import { GRADIENT_VERT, GRADIENT_FRAG } from './shaders/gradient.glsl.js';

const SPACE = { world: 0, local: 1, screen: 2 };

/**
 * A fully parametric "noisy gradient" material.
 * It is not a PBR material: light only drives a position along a 4-stop colour
 * ramp, which is what gives the flat-but-lit look of the reference imagery.
 */
export function createGradientMaterial(params) {
  const material = new THREE.ShaderMaterial({
    vertexShader: GRADIENT_VERT,
    fragmentShader: GRADIENT_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },

      uColors: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()] },
      uStops: { value: new THREE.Vector4(0, 0.35, 0.7, 1) },

      uLightPos: { value: new THREE.Vector3(3, 4, 3) },
      uLightColor: { value: new THREE.Color(1, 1, 1) },
      uLightIntensity: { value: 1 },

      uLightGain: { value: 1 },
      uLightWrap: { value: 0.45 },
      uAmbient: { value: 0.12 },
      uFresnelMix: { value: 0.35 },
      uFresnelPower: { value: 2.6 },
      uSpecular: { value: 0.18 },
      uSpecPower: { value: 34 },

      uNoiseScale: { value: 1.6 },
      uNoiseAmount: { value: 0.22 },
      uOctaves: { value: 3 },
      uWarpAmount: { value: 0.45 },
      uWarpScale: { value: 0.9 },
      uFlowSpeed: { value: 0.12 },
      uNoiseSpace: { value: 0 },

      uRampOffset: { value: 0 },
      uContrast: { value: 1 },
      uPosterize: { value: 0 },
      uSmear: { value: 0 },

      uGrain: { value: 0.035 },
      uDither: { value: 0.5 },
      uOpacity: { value: 1 }
    },
    transparent: false,
    side: THREE.FrontSide
  });

  if (params) syncGradientMaterial(material, params);
  return material;
}

/** Push a plain-object parameter set into the material uniforms. */
export function syncGradientMaterial(material, p) {
  const u = material.uniforms;

  for (let i = 0; i < 4; i++) u.uColors.value[i].set(p.colors[i] || '#000000');
  u.uStops.value.set(p.stops[0], p.stops[1], p.stops[2], p.stops[3]);

  u.uLightGain.value = p.lightGain;
  u.uLightWrap.value = p.lightWrap;
  u.uAmbient.value = p.ambient;
  u.uFresnelMix.value = p.fresnelMix;
  u.uFresnelPower.value = p.fresnelPower;
  u.uSpecular.value = p.specular;
  u.uSpecPower.value = p.specPower;

  u.uNoiseScale.value = p.noiseScale;
  u.uNoiseAmount.value = p.noiseAmount;
  u.uOctaves.value = Math.max(1, Math.round(p.octaves));
  u.uWarpAmount.value = p.warpAmount;
  u.uWarpScale.value = p.warpScale;
  u.uFlowSpeed.value = p.flowSpeed;
  u.uNoiseSpace.value = SPACE[p.noiseSpace] ?? 0;

  u.uRampOffset.value = p.rampOffset;
  u.uContrast.value = p.contrast;
  u.uPosterize.value = p.posterize;
  u.uSmear.value = p.smear;

  u.uGrain.value = p.grain;
  u.uDither.value = p.dither;
  u.uOpacity.value = p.opacity;

  const wantsTransparency = p.opacity < 1;
  if (material.transparent !== wantsTransparency) {
    material.transparent = wantsTransparency;
    material.needsUpdate = true;
  }
}

/** Per-frame context shared by every gradient material in a scene. */
export function syncGradientContext(material, { time, width, height, light }) {
  const u = material.uniforms;
  u.uTime.value = time;
  u.uResolution.value.set(width, height);
  u.uLightPos.value.set(light.x, light.y, light.z);
  u.uLightColor.value.set(light.color);
  u.uLightIntensity.value = light.intensity;
}
