import { NOISE_GLSL } from './noise.glsl.js';

/** Colour-ramp helpers shared by the 3D material and the 2D field shader. */
export const RAMP_GLSL = /* glsl */ `
uniform vec3  uColors[4];
uniform vec4  uStops;

vec3 rampColor(float t) {
  vec3 c = uColors[0];
  c = mix(c, uColors[1], smoothstep(uStops.x, max(uStops.y, uStops.x + 1e-4), t));
  c = mix(c, uColors[2], smoothstep(uStops.y, max(uStops.z, uStops.y + 1e-4), t));
  c = mix(c, uColors[3], smoothstep(uStops.z, max(uStops.w, uStops.z + 1e-4), t));
  return c;
}

/* Contrast around mid, offset, optional banding. */
float shapeRamp(float t, float contrast, float offset, float posterize, float ditherAmt, vec2 fragCoord) {
  t = (t - 0.5) * contrast + 0.5 + offset;
  t = clamp(t, 0.0, 1.0);
  if (posterize > 1.5) {
    float d = (hash12(fragCoord) - 0.5) * ditherAmt;
    t = clamp(floor(t * posterize + 0.5 + d) / posterize, 0.0, 1.0);
  }
  return t;
}
`;

export const GRADIENT_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vLocalPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
  vLocalPos = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const GRADIENT_FRAG = /* glsl */ `
precision highp float;

varying vec3 vWorldPos;
varying vec3 vLocalPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

uniform float uTime;
uniform vec2  uResolution;

/* light */
uniform vec3  uLightPos;
uniform vec3  uLightColor;
uniform float uLightIntensity;

/* shading response */
uniform float uLightGain;
uniform float uLightWrap;
uniform float uAmbient;
uniform float uFresnelMix;
uniform float uFresnelPower;
uniform float uSpecular;
uniform float uSpecPower;

/* noise */
uniform float uNoiseScale;
uniform float uNoiseAmount;
uniform int   uOctaves;
uniform float uWarpAmount;
uniform float uWarpScale;
uniform float uFlowSpeed;
uniform int   uNoiseSpace;   // 0 world, 1 local, 2 screen

/* ramp shaping */
uniform float uRampOffset;
uniform float uContrast;
uniform float uPosterize;
uniform float uSmear;

/* finishing */
uniform float uGrain;
uniform float uDither;
uniform float uOpacity;

${NOISE_GLSL}
${RAMP_GLSL}

void main() {
  vec2 screenUV = gl_FragCoord.xy / uResolution;

  vec3 N = normalize(vWorldNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(vViewDir);
  vec3 L = normalize(uLightPos - vWorldPos);

  /* --- noise domain --- */
  vec3 np;
  if (uNoiseSpace == 1)      np = vLocalPos;
  else if (uNoiseSpace == 2) np = vec3(screenUV * vec2(uResolution.x / uResolution.y, 1.0), 0.0);
  else                       np = vWorldPos;
  np *= uNoiseScale;

  float flow = uTime * uFlowSpeed;
  vec3 warp = vec3(
    fbm(np * uWarpScale + vec3(0.0, 0.0, flow), uOctaves, 2.0, 0.5),
    fbm(np * uWarpScale + vec3(5.2, 1.3, flow), uOctaves, 2.0, 0.5),
    fbm(np * uWarpScale + vec3(9.1, 7.7, flow), uOctaves, 2.0, 0.5)
  );
  float n = fbm(np + warp * uWarpAmount + vec3(0.0, 0.0, flow), uOctaves, 2.0, 0.5);

  /* --- light response --- */
  float ndl = dot(N, L);
  ndl = clamp((ndl + uLightWrap) / (1.0 + uLightWrap), 0.0, 1.0);
  float diffuse = ndl * uLightGain * uLightIntensity;

  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), uSpecPower) * uSpecular;
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uFresnelPower);

  /* t = 0 -> first colour (light), t = 1 -> last colour (shadow) */
  float t = 1.0 - clamp(diffuse + uAmbient + spec, 0.0, 1.5);
  t += fres * uFresnelMix;
  t += (n * 2.0 - 1.0) * uNoiseAmount;
  t += (0.5 - screenUV.y) * uSmear;

  t = shapeRamp(t, uContrast, uRampOffset, uPosterize, uDither, gl_FragCoord.xy);

  vec3 color = rampColor(t);
  color *= mix(vec3(1.0), uLightColor, 0.65);

  /* film grain, animated so exported sequences do not look frozen */
  float g = hash12(gl_FragCoord.xy + fract(uTime) * 91.7);
  color += (g - 0.5) * uGrain;

  gl_FragColor = vec4(color, uOpacity);

  #include <colorspace_fragment>
}
`;
