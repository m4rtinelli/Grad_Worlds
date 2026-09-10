import { NOISE_GLSL } from '../../three/shaders/noise.glsl.js';
import { RAMP_GLSL } from '../../three/shaders/gradient.glsl.js';

export const FIELD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const FIELD_FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2  uResolution;

/* field shaping */
uniform float uNoiseScale;
uniform float uNoiseAmount;
uniform int   uOctaves;
uniform float uWarpAmount;
uniform float uWarpScale;
uniform float uFlowSpeed;

uniform float uRampOffset;
uniform float uContrast;
uniform float uPosterize;
uniform float uSmear;
uniform float uGrain;
uniform float uDither;

uniform float uScale;
uniform float uRotation;
uniform float uVignette;

/* pseudo-lighting of the scalar field */
uniform float uShade;
uniform vec2  uLightDir;

/* effectors */
uniform vec2  uP0;
uniform vec2  uP1;
uniform float uUseSecond;
uniform float uRadius;
uniform float uStrength;
uniform float uFalloff;
uniform float uSwirl;

${NOISE_GLSL}
${RAMP_GLSL}

vec2 rot2(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

/* Influence of one effector at point p: 0 far away, 1 at its centre. */
float influence(vec2 p, vec2 c) {
  float r = length(p - c) / max(uRadius, 1e-3);
  return exp(-pow(max(r, 0.0), max(uFalloff, 0.25))) * uStrength;
}

/* Displaces the sampling domain around the effectors (push + swirl). */
vec2 deform(vec2 p) {
  vec2 outp = p;
  vec2 d0 = p - uP0;
  float i0 = influence(p, uP0);
  outp += normalize(d0 + 1e-5) * i0 * uRadius * 0.9;
  outp = uP0 + rot2(outp - uP0, i0 * uSwirl * 3.14159);

  if (uUseSecond > 0.5) {
    vec2 d1 = p - uP1;
    float i1 = influence(p, uP1);
    outp += normalize(d1 + 1e-5) * i1 * uRadius * 0.9;
    outp = uP1 + rot2(outp - uP1, -i1 * uSwirl * 3.14159);
  }
  return outp;
}

/* The scalar field: domain-warped fbm in 0..1 */
float fieldAt(vec2 p, int octaves) {
  float flow = uTime * uFlowSpeed;
  vec3 np = vec3(p * uNoiseScale, flow);
  vec3 warp = vec3(
    fbm(np * uWarpScale + vec3(0.0, 0.0, flow), octaves, 2.0, 0.5),
    fbm(np * uWarpScale + vec3(4.7, 2.1, flow), octaves, 2.0, 0.5),
    fbm(np * uWarpScale + vec3(8.3, 6.4, flow), octaves, 2.0, 0.5)
  );
  return fbm(np + warp * uWarpAmount, octaves, 2.0, 0.5) * 0.5 + 0.5;
}

void main() {
  vec2 res = uResolution;
  float aspect = res.x / res.y;
  vec2 uv = gl_FragCoord.xy / res - 0.5;
  uv.x *= aspect;
  uv = rot2(uv, uRotation) / max(uScale, 1e-3);

  vec2 p = deform(uv);

  float h = fieldAt(p, uOctaves);
  float infl = influence(uv, uP0) + (uUseSecond > 0.5 ? influence(uv, uP1) : 0.0);

  /* Emboss the field with a fake light so it reads as volume, not flat noise. */
  float shade = 0.0;
  if (uShade > 0.001) {
    float e = 0.012;
    int lo = uOctaves > 3 ? 3 : uOctaves;
    float hx = fieldAt(deform(uv + vec2(e, 0.0)), lo) - fieldAt(deform(uv - vec2(e, 0.0)), lo);
    float hy = fieldAt(deform(uv + vec2(0.0, e)), lo) - fieldAt(deform(uv - vec2(0.0, e)), lo);
    vec3 n = normalize(vec3(-hx, -hy, e * 2.4));
    vec3 l = normalize(vec3(uLightDir, 0.75));
    shade = (dot(n, l) * 0.5 + 0.5 - 0.5) * uShade;
  }

  float t = 1.0 - h;
  t += (uNoiseAmount - 0.5) * 0.0;         // amount is folded into contrast below
  t -= infl * 0.55;
  t -= shade;
  t += (0.5 - gl_FragCoord.y / res.y) * uSmear;

  /* uNoiseAmount acts as the field's dynamic range around mid grey. */
  t = (t - 0.5) * (0.4 + uNoiseAmount * 1.6) + 0.5;

  t = shapeRamp(t, uContrast, uRampOffset, uPosterize, uDither, gl_FragCoord.xy);

  vec3 color = rampColor(t);

  if (uVignette > 0.001) {
    float v = smoothstep(1.25, 0.25, length(uv) * 1.1);
    color = mix(color, color * (1.0 - uVignette), 1.0 - v);
  }

  float g = hash12(gl_FragCoord.xy + fract(uTime) * 91.7);
  color += (g - 0.5) * uGrain;

  gl_FragColor = vec4(color, 1.0);

  #include <colorspace_fragment>
}
`;
