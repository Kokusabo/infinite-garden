/* dream.js - how it is seen. Never sharp: the picture is smeared one way, the way an eye
 * with astigmatism smears it, and doubled a little; every bright thing throws long streaks;
 * the sun swells until it whites everything out. Two pictures can be seen at once while
 * one turns into the other. Shut your eyes and only the afterimage stays. */
import * as THREE from '../vendor/three.module.min.js';

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const FRAG = `
precision highp float;
uniform sampler2D tA, tB;
uniform vec4 uFitA, uFitB;        // scale.xy, offset.xy: how each picture covers the screen
uniform float uPixA, uPixB;       // 1 for the old 3d places: their pixels stay pixels
uniform vec2 uResA, uResB;
uniform float uMix, uTime, uAstig, uAngle, uGhost, uExpose, uBlind, uClosed, uSunAmt, uFlow, uStreak, uLeak, uHue, uSat, uWarm, uTape, uDim;
uniform vec2 uSun, uGhostDir, uAspect;
varying vec2 vUv;

float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }

vec3 pick(sampler2D t, vec4 fit, float pix, vec2 res, vec2 uv) {
  // a slow breath of air through it: leaves, heat, water in the eye
  vec2 w = vec2(vnoise(uv * 3.0 + uTime * 0.11) - 0.5, vnoise(uv * 3.0 - uTime * 0.09 + 7.0) - 0.5);
  uv += w * uFlow * 0.012;
  vec2 q = (uv - 0.5) * fit.xy + 0.5 + fit.zw;
  if (pix > 0.5) {
    // the old places are drawn in linear light; bring them to the same light as the photographs
    q = (floor(q * res) + 0.5) / res;
    return pow(texture2D(t, clamp(q, 0.002, 0.998)).rgb, vec3(0.4545));
  }
  return texture2D(t, clamp(q, 0.002, 0.998)).rgb;
}
// turn the green somewhere else: towards lime, towards mint, paler, fuller
vec3 hueSat(vec3 c, float h, float s) {
  float Y = dot(c, vec3(0.299, 0.587, 0.114)), I = dot(c, vec3(0.596, -0.274, -0.322)), Q = dot(c, vec3(0.211, -0.523, 0.312));
  float ch = cos(h), sh = sin(h), I2 = (I * ch - Q * sh) * s, Q2 = (I * sh + Q * ch) * s;
  return vec3(Y + 0.956 * I2 + 0.621 * Q2, Y - 0.272 * I2 - 0.647 * Q2, Y - 1.106 * I2 + 1.703 * Q2);
}
vec3 S(vec2 uv) {
  if (uMix <= 0.001) return pick(tA, uFitA, uPixA, uResA, uv);
  if (uMix >= 0.999) return pick(tB, uFitB, uPixB, uResB, uv);
  return mix(pick(tA, uFitA, uPixA, uResA, uv), pick(tB, uFitB, uPixB, uResB, uv), uMix);
}

void main() {
  vec2 uv = vUv;
  // an old tape: lines slide a little, a band of noise crawls up the picture
  float band = 0.0;
  if (uTape > 0.001) {
    float line = floor(uv.y * 240.0), tick = floor(uTime * 30.0);
    uv.x += (h1(vec2(line, tick)) - 0.5) * 0.004 * uTape + sin(uv.y * 30.0 + uTime * 2.0) * 0.0015 * uTape;
    band = smoothstep(0.03, 0.0, abs(uv.y - fract(uTime * 0.06))) * uTape;
    uv.x += band * (h1(vec2(line, tick + 5.0)) - 0.5) * 0.04;
  }
  vec2 dir = vec2(cos(uAngle), sin(uAngle)) / uAspect, per = vec2(-sin(uAngle), cos(uAngle)) / uAspect;
  float pix = mix(uPixA, uPixB, uMix);
  float L = uAstig * mix(0.022, 0.007, pix);
  // astigmatism: an elliptical smear, long one way, short the other
  vec3 col = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    float fi = float(i), a = fi * 2.39996, r = sqrt((fi + 0.5) / 16.0);
    vec2 o = dir * cos(a) * r * L + per * sin(a) * r * L * 0.22;
    col += S(uv + o);
  }
  col /= 16.0;
  // the second image the eye makes, a little off
  vec3 g = (S(uv + uGhostDir * 0.6) + S(uv + uGhostDir + dir * L * 0.5) + S(uv + uGhostDir - dir * L * 0.5)) / 3.0;
  col = mix(col, max(col, g), uGhost * 0.55);
  // every bright point throws streaks along the smear and, weaker, across it
  vec3 st = vec3(0.0);
  for (int i = 1; i <= 5; i++) {
    float s = float(i) / 5.0, f = (1.0 - s) * (1.0 - s);
    st += (max(S(uv + dir * s * 0.16) - 0.72, 0.0) + max(S(uv - dir * s * 0.16) - 0.72, 0.0)) * f;
    st += (max(S(uv + per * s * 0.06) - 0.75, 0.0) + max(S(uv - per * s * 0.06) - 0.75, 0.0)) * f * 0.5;
  }
  col += st * uStreak * vec3(1.0, 1.0, 0.92) * 0.75;
  // glow round everything bright
  vec3 b = vec3(0.0);
  for (int i = 0; i < 6; i++) { float a = float(i) * 1.047 + 0.3; b += max(S(uv + vec2(cos(a), sin(a)) / uAspect * 0.035) - 0.55, 0.0); }
  col += b * 0.24;
  // the sun: a hot core, a ring, rays that turn slowly
  vec2 d = (uv - uSun) * uAspect;
  float r = length(d), ang = atan(d.y, d.x);
  float rays = pow(vnoise(vec2(ang * 7.0 + uTime * 0.05, 0.0)) * 0.6 + vnoise(vec2(ang * 23.0 - uTime * 0.03, 3.0)) * 0.4, 3.0);
  float sun = exp(-r * 5.5) * 0.9 + exp(-r * 1.6) * 0.35 + rays * exp(-r * 2.2) * 0.9 + smoothstep(0.03, 0.0, abs(r - 0.22)) * 0.05;
  col += vec3(1.0, 0.99, 0.86) * sun * uSunAmt;
  // a leak of light drifting across, warm green
  float lk = smoothstep(0.9, 0.0, abs(uv.x + sin(uTime * 0.07) * 0.6 - 0.5 + (uv.y - 0.5) * 0.5));
  col += vec3(0.55, 0.62, 0.25) * lk * uLeak * 0.25;
  // the tape keeps colour apart from brightness, and smears it sideways
  if (uTape > 0.001) {
    vec3 sm = (S(uv - vec2(0.007, 0.0)) + S(uv - vec2(0.0035, 0.0)) + col + S(uv + vec2(0.005, 0.0))) * 0.25;
    float y = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 v = vec3(y) + (sm - dot(sm, vec3(0.299, 0.587, 0.114))) * 1.15;
    col = mix(col, v * vec3(0.97, 1.03, 0.9), uTape);
  }
  // exposure: the sun in the eyes
  col = 1.0 - exp(-col * uExpose);
  // every time a little different green
  col = clamp(hueSat(col, uHue, uSat), 0.0, 1.0) * vec3(1.0 + uWarm * 0.05, 1.0 + uWarm * 0.012, 1.0 - uWarm * 0.07);
  // light green, gentle: lift the shadows towards green, keep the whites a little creamy
  col = mix(col, vec3(dot(col, vec3(0.3, 0.55, 0.15))), 0.12);
  col = col * vec3(0.94, 1.0, 0.9) + vec3(0.03, 0.07, 0.035) * (1.0 - col);
  // the tape's lines and its noise
  if (uTape > 0.001) {
    col *= 1.0 - uTape * 0.1 * step(0.5, fract(gl_FragCoord.y * 0.5));
    col = mix(col, vec3(h1(gl_FragCoord.xy + floor(uTime * 30.0))) * 0.7 + col * 0.5, band * 0.5);
    col += (h1(vec2(gl_FragCoord.y, floor(uTime * 30.0))) - 0.5) * 0.03 * uTape;
  }
  // dimmed, so the letters can be read
  col = mix(col, col * vec3(0.16, 0.3, 0.2) + vec3(0.01, 0.035, 0.02), uDim);
  // eyes shut: dark green, and the bright parts burnt in as an afterimage
  vec3 after = vec3(0.012, 0.045, 0.03) + (b * 0.35 + st * 0.25) * vec3(0.55, 0.85, 0.4) + vec3(0.25, 0.4, 0.15) * exp(-r * 3.0) * uSunAmt;
  col = mix(col, after, uClosed);
  // blinded
  col = mix(col, vec3(0.985, 1.0, 0.95), uBlind);
  col += (h1(gl_FragCoord.xy + floor(uTime * 24.0)) - 0.5) * 0.025;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createDream(renderer) {
  const blank = new THREE.DataTexture(new Uint8Array([200, 230, 190, 255]), 1, 1); blank.needsUpdate = true;
  const U = {
    tA: { value: blank }, tB: { value: blank }, uFitA: { value: new THREE.Vector4(1, 1, 0, 0) }, uFitB: { value: new THREE.Vector4(1, 1, 0, 0) },
    uPixA: { value: 0 }, uPixB: { value: 0 }, uResA: { value: new THREE.Vector2(1, 1) }, uResB: { value: new THREE.Vector2(1, 1) },
    uMix: { value: 0 }, uTime: { value: 0 }, uAstig: { value: 1 }, uAngle: { value: 0.3 }, uGhost: { value: 0.5 }, uExpose: { value: 1.6 },
    uBlind: { value: 0 }, uClosed: { value: 0 }, uSunAmt: { value: 0.6 }, uFlow: { value: 1 }, uStreak: { value: 1 }, uLeak: { value: 0.5 }, uHue: { value: 0 }, uSat: { value: 1 }, uWarm: { value: 0 }, uTape: { value: 0 }, uDim: { value: 0 },
    uSun: { value: new THREE.Vector2(0.7, 0.75) }, uGhostDir: { value: new THREE.Vector2(0.006, 0.003) }, uAspect: { value: new THREE.Vector2(1, 1) }
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false }));
  mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    uniforms: U,
    render: function () { renderer.setRenderTarget(null); renderer.render(scene, camera); }
  };
}

// how a picture of size (w, h) covers a screen of aspect a, zoomed by z and moved by (px, py)
export function cover(w, h, a, z, px, py, out) {
  const ia = w / h;
  let sx = 1, sy = 1;
  if (a > ia) sy = ia / a; else sx = a / ia;
  sx /= z; sy /= z;
  const mx = (1 - sx) / 2, my = (1 - sy) / 2;
  return out.set(sx, sy, px * mx, py * my);
}
