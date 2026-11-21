/* eye.js - two passes. The first puts the picture together: one place turning into the
 * next, and how it turns (falling into it, torn into strips, burnt white, smeared, opened
 * like an eye, folded like a kaleidoscope...). The second is the eye itself: never in
 * focus, every light streaked, the sun too close, and the faster you move the more it tears. */
import * as THREE from '../vendor/three.module.min.js';

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const COMMON = `
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

const COMPOSE = `
precision highp float;
uniform sampler2D tA, tB;
uniform vec4 uFitA, uFitB;
uniform float uPixA, uPixB;
uniform vec2 uResA, uResB;
uniform vec3 uGradeA, uGradeB;
uniform float uP, uType, uSeed, uTime, uFlow;
uniform vec2 uCenter, uAspect, uOut;
varying vec2 vUv;
${COMMON}
vec3 hueSat(vec3 c, float h, float s) {
  float Y = dot(c, vec3(0.299, 0.587, 0.114)), I = dot(c, vec3(0.596, -0.274, -0.322)), Q = dot(c, vec3(0.211, -0.523, 0.312));
  float ch = cos(h), sh = sin(h), I2 = (I * ch - Q * sh) * s, Q2 = (I * sh + Q * ch) * s;
  return vec3(Y + 0.956 * I2 + 0.621 * Q2, Y - 0.272 * I2 - 0.647 * Q2, Y - 1.106 * I2 + 1.703 * Q2);
}
vec3 grade(vec3 c, vec3 g) { return clamp(hueSat(c, g.x, g.y), 0.0, 1.0) * vec3(1.0 + g.z * 0.05, 1.0 + g.z * 0.012, 1.0 - g.z * 0.07); }
vec3 pick(sampler2D t, vec4 fit, float pix, vec2 res, vec2 uv) {
  vec2 w = vec2(vnoise(uv * 3.0 + uTime * 0.11) - 0.5, vnoise(uv * 3.0 - uTime * 0.09 + 7.0) - 0.5);
  uv += w * uFlow * 0.01;
  vec2 q = (uv - 0.5) * fit.xy + 0.5 + fit.zw;
  q = 1.0 - abs(1.0 - mod(q, 2.0));
  if (pix > 0.5) { q = (floor(q * res) + 0.5) / res; return pow(texture2D(t, clamp(q, 0.002, 0.998)).rgb, vec3(0.4545)); }
  return texture2D(t, clamp(q, 0.002, 0.998)).rgb;
}
vec3 A(vec2 uv) { return grade(pick(tA, uFitA, uPixA, uResA, uv), uGradeA); }
vec3 B(vec2 uv) { return grade(pick(tB, uFitB, uPixB, uResB, uv), uGradeB); }
vec2 kal(vec2 uv, float amt) {
  vec2 d = (uv - 0.5) * uAspect; float r = length(d), a = atan(d.y, d.x), seg = 6.2831853 / 6.0;
  float fa = abs(mod(a + uTime * 0.2, seg) - seg * 0.5);
  return mix(uv, vec2(cos(fa), sin(fa)) * r / uAspect + 0.5, amt);
}
void main() {
  vec2 uv = vUv;
  float p = uP;
  vec3 col;
  if (p <= 0.0005) col = A(uv);
  else if (p >= 0.9995) col = B(uv);
  else {
    float tri = 1.0 - abs(2.0 * p - 1.0);
    int type = int(uType + 0.5);
    // whatever the way, some rows slip while it happens
    float row = floor(uv.y * 80.0);
    float slip = step(1.0 - tri * 0.3, h1(vec2(row, floor(uTime * 20.0) + uSeed))) * (h1(vec2(row, uSeed)) - 0.5) * 0.1 * tri;
    vec2 u = uv + vec2(slip, 0.0);
    if (type == 0) {            // falling into it
      vec2 c = uCenter; vec3 a = vec3(0.0), b = vec3(0.0);
      float za = 1.0 + p * p * 3.2, zb = mix(2.4, 1.0, p);
      for (int i = 0; i < 6; i++) { float k = 1.0 + float(i) * 0.04 * tri; a += A(c + (u - c) / (za * k)); b += B(c + (u - c) / (zb * k)); }
      col = mix(a / 6.0 * (1.0 + p * 1.2), b / 6.0, smoothstep(0.38, 0.62, p));
    } else if (type == 1) {     // torn into strips: each slides away like film, the next picture right behind it
      float n = 7.0 + floor(h1(vec2(uSeed, 3.0)) * 20.0), band = floor(uv.y * n);
      float r = h1(vec2(band, uSeed + 1.0)), dir = h1(vec2(band, uSeed + 2.0)) < 0.5 ? -1.0 : 1.0;
      float st = 0.08 + r * 0.5, s = smoothstep(st, st + 0.42, p), x = u.x + dir * s;
      bool inA = x >= 0.0 && x <= 1.0;
      vec2 q = vec2(inA ? x : x - dir, u.y);
      col = inA ? A(q) : B(q);
      col.r = mix(col.r, (inA ? A(q + vec2(0.008, 0.0)) : B(q + vec2(0.008, 0.0))).r, tri);
      col += vec3(1.0, 1.0, 0.94) * smoothstep(0.01, 0.0, min(abs(x), abs(x - 1.0))) * 0.8 * step(0.002, s) * step(s, 0.998);
    } else if (type == 2) {     // coming apart into squares
      float cell = mix(1.0, 64.0, pow(tri, 1.4));
      vec2 g = uOut / cell, q = (floor(u * g) + 0.5) / g;
      float d = h1(floor(u * g) + uSeed);
      col = (p + (d - 0.5) * 0.3 * tri) < 0.5 ? A(q) : B(q);
    } else if (type == 3) {     // the next one grows through like light through leaves
      float nz = fbm(u * vec2(uAspect.x, 1.0) * 2.6 + uSeed * 7.0), e = p * 1.3 - 0.15;
      col = mix(B(u), A(u), smoothstep(e - 0.025, e + 0.025, nz));
      col += vec3(1.0, 0.99, 0.84) * smoothstep(0.07, 0.0, abs(nz - e)) * 1.3;
    } else if (type == 4) {     // burnt white
      vec3 base = p < 0.5 ? A(u) : B(u);
      col = mix(base * (1.0 + tri * 2.0), vec3(1.0, 1.0, 0.95), pow(tri, 0.7) * 0.94);
    } else if (type == 5) {     // smeared one way
      float ang = uSeed * 6.2831853; vec2 d = vec2(cos(ang), sin(ang)) / uAspect;
      float k = tri * 0.42; vec3 a = vec3(0.0), b = vec3(0.0);
      for (int i = 0; i < 8; i++) { float s = (float(i) / 7.0 - 0.5) * k; a += A(u + d * s); b += B(u + d * s); }
      col = mix(a, b, smoothstep(0.42, 0.58, p)) / 8.0;
    } else if (type == 6) {     // opened like an eye, from where the sun is
      float dist = length((uv - uCenter) * uAspect), r = p * 1.5;
      col = mix(A(u), B(u), smoothstep(r, r - 0.06, dist));
      col += vec3(1.0, 1.0, 0.9) * smoothstep(0.04, 0.0, abs(dist - r)) * tri;
    } else if (type == 7) {     // folded into a kaleidoscope and out again
      col = p < 0.5 ? A(kal(u, smoothstep(0.0, 0.5, p))) : B(kal(u, smoothstep(1.0, 0.5, p)));
      col += vec3(1.0, 1.0, 0.95) * pow(tri, 8.0) * 0.3;
    } else if (type == 8) {     // blinds
      float n = 6.0 + floor(h1(vec2(uSeed, 9.0)) * 10.0), x = uv.x * n, ci = floor(x), f = fract(x);
      float q = clamp((p - h1(vec2(ci, uSeed)) * 0.4) / 0.6, 0.0, 1.0);
      col = f < q ? B(u) : A(u);
      col += vec3(1.0) * smoothstep(0.03, 0.0, abs(f - q)) * 0.6 * tri;
    } else {                    // letters: it goes dark green; the letters are drawn on top, elsewhere
      vec3 base = p < 0.5 ? A(u) : B(u);
      col = mix(base, base * vec3(0.12, 0.25, 0.16) + vec3(0.01, 0.04, 0.02), smoothstep(0.0, 0.35, tri));
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const OPTICS = `
precision highp float;
uniform sampler2D tScene;
uniform float uTime, uAstig, uAngle, uGhost, uExpose, uBlind, uClosed, uSunAmt, uStreak, uLeak, uTape, uDim, uVel, uHaze, uFlare, uChroma, uZoomBlur, uSpec, uSweepAng, uInvert, uMosaic, uWave, uRays, uShafts;
uniform vec2 uSun, uSun2, uGhostDir, uAspect, uMotion, uMotionC, uSweep, uShake;
varying vec2 vUv;
${COMMON}
vec3 S(vec2 uv) { uv = 1.0 - abs(1.0 - mod(uv, 2.0)); return texture2D(tScene, clamp(uv, 0.001, 0.999)).rgb; }
void main() {
  vec2 uv = vUv + uShake;
  // the picture going liquid for a moment
  if (uWave > 0.001) { uv.x += sin(uv.y * 38.0 + uTime * 11.0) * 0.014 * uWave; uv.y += sin(uv.x * 23.0 + uTime * 8.0) * 0.008 * uWave; }
  // or falling apart into big squares
  if (uMosaic > 0.001) { vec2 g = vec2(uAspect.x, 1.0) * mix(240.0, 30.0, uMosaic); uv = (floor(uv * g) + 0.5) / g; }
  if (uTape > 0.001) {
    float line = floor(uv.y * 240.0), tick = floor(uTime * 30.0);
    uv.x += (h1(vec2(line, tick)) - 0.5) * 0.004 * uTape + sin(uv.y * 30.0 + uTime * 2.0) * 0.0015 * uTape;
  }
  // moving fast tears the picture along the way it moves
  float va = clamp(abs(uVel) * 0.5, 0.0, 1.0);
  vec2 d0 = normalize(mix(vec2(cos(uAngle), sin(uAngle)), vec2(0.0, 1.0), va));
  vec2 dir = d0 / uAspect, per = vec2(-d0.y, d0.x) / uAspect;
  float L = uAstig * 0.022;
  vec3 col = vec3(0.0);
  if (L < 0.0012) col = S(uv);          // in focus: the picture as it is
  else {
    for (int i = 0; i < 16; i++) {
      float fi = float(i), a = fi * 2.39996, r = sqrt((fi + 0.5) / 16.0);
      col += S(uv + dir * cos(a) * r * L + per * sin(a) * r * L * 0.22);
    }
    col /= 16.0;
  }
  // moving: the picture is smeared along the way it goes and pulled towards you, like a slow shutter.
  // the light parts leave longer trails, and the colours separate a little along the smear
  float M = length(uMotion) + uZoomBlur;
  if (M > 0.002) {
    vec3 acc = vec3(0.0), ws = vec3(0.0);
    float j = h1(gl_FragCoord.xy + fract(uTime * 7.0) * 91.0) - 0.5;
    vec2 fromC = uv - uMotionC;
    for (int i = 0; i < 24; i++) {
      float t = (float(i) + 0.5 + j) / 24.0 - 0.5, u = t + 0.5;
      vec3 c = S(uv + uMotion * t - fromC * uZoomBlur * u);
      float lum = dot(c, vec3(0.3, 0.55, 0.15));
      vec3 w = (vec3(1.0) + uSpec * vec3(u - 0.5, 0.0, 0.5 - u) * 1.8) * (1.0 + max(lum - 0.62, 0.0) * 6.0) * (1.15 - abs(t));
      acc += c * w; ws += w;
    }
    col = mix(col, acc / ws, smoothstep(0.002, 0.02, M));
  }
  // colours coming apart for a moment
  if (uChroma > 0.001) { col.r = S(uv + vec2(uChroma * 0.012, uChroma * 0.003)).r; col.b = S(uv - vec2(uChroma * 0.012, uChroma * 0.003)).b; }
  col.r = mix(col.r, S(uv + vec2(0.0, uVel * 0.02)).r, va);
  col.b = mix(col.b, S(uv - vec2(0.0, uVel * 0.02)).b, va);
  if (uGhost > 0.01) {
    vec3 g = (S(uv + uGhostDir * 0.6) + S(uv + uGhostDir + dir * L * 0.5) + S(uv + uGhostDir - dir * L * 0.5)) / 3.0;
    col = mix(col, max(col, g), uGhost * 0.55);
  }
  vec3 st = vec3(0.0);
  if (uStreak > 0.01) for (int i = 1; i <= 5; i++) {
    float s = float(i) / 5.0, f = (1.0 - s) * (1.0 - s);
    st += (max(S(uv + dir * s * 0.16) - 0.72, 0.0) + max(S(uv - dir * s * 0.16) - 0.72, 0.0)) * f;
    st += (max(S(uv + per * s * 0.06) - 0.75, 0.0) + max(S(uv - per * s * 0.06) - 0.75, 0.0)) * f * 0.5;
  }
  col += st * uStreak * vec3(1.0, 1.0, 0.92) * 0.75;
  vec3 b = vec3(0.0);
  for (int i = 0; i < 6; i++) { float a = float(i) * 1.047 + 0.3; b += max(S(uv + vec2(cos(a), sin(a)) / uAspect * 0.035) - 0.55, 0.0); }
  col += b * 0.24;
  vec2 d = (uv - uSun) * uAspect;
  float r = length(d);
  // the light that follows you: never quite round, never still, soft at every edge, a little of it left behind
  vec2 wq = d + (vec2(vnoise(uv * 2.6 + uTime * 0.21), vnoise(uv * 2.6 - uTime * 0.17 + 5.0)) - 0.5) * 0.18;
  float th = uTime * 0.07 + sin(uTime * 0.19) * 0.8, cs = cos(th), sn = sin(th), sq = 1.0 + 0.5 * (0.5 + 0.5 * sin(uTime * 0.23));
  vec2 e2 = vec2(cs * wq.x + sn * wq.y, -sn * wq.x + cs * wq.y) * vec2(1.0 / sq, sq);
  float re = length(e2);
  float breathe = 0.8 + 0.2 * sin(uTime * 0.61) + 0.16 * (vnoise(vec2(uTime * 0.4, 9.0)) - 0.5);
  vec3 tint = mix(vec3(1.0, 0.97, 0.84), vec3(0.86, 1.0, 0.8), 0.5 + 0.5 * sin(uTime * 0.11));
  float r2 = length((uv - uSun2) * uAspect);
  float glow = exp(-re * re * 7.0) * 0.5 + exp(-re * 2.0) * 0.26 + exp(-r2 * r2 * 5.0) * 0.22;
  float discs = 0.0; vec3 dcol = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 o = vec2(sin(uTime * (0.19 + fi * 0.06) + fi * 2.1), cos(uTime * (0.15 + fi * 0.05) + fi * 1.3)) * (0.08 + 0.05 * fi);
    float rad = 0.045 + 0.025 * fi * 0.5 + 0.02 * sin(uTime * 0.5 + fi), rr = length(d - o);
    float k = smoothstep(rad, rad * 0.5, rr) * (0.09 + 0.06 * (0.5 + 0.5 * sin(uTime * 0.8 + fi * 2.0)));
    dcol += mix(vec3(1.0, 0.95, 0.78), vec3(0.78, 1.0, 0.86), fract(fi * 0.37)) * k;
  }
  col += (tint * glow + dcol) * (0.4 + uSunAmt * 0.7) * breathe;
  // rays out of the light: their number, width, length and direction never stay the same
  if (uRays > 0.001) {
    vec2 cd = normalize(d + 1e-5);
    float f1 = 2.0 + 1.6 * (0.5 + 0.5 * sin(uTime * 0.13)), f2 = 5.0 + 3.0 * (0.5 + 0.5 * sin(uTime * 0.09 + 2.0));
    float n1 = vnoise(cd * f1 + vec2(uTime * 0.22, -uTime * 0.17)), n2 = vnoise(cd * f2 + vec2(-uTime * 0.31, uTime * 0.26) + 7.0);
    float rays = pow(clamp(n1 * 0.65 + n2 * 0.35, 0.0, 1.0), 2.2 + 1.8 * (0.5 + 0.5 * sin(uTime * 0.21)));
    float len = 0.25 + 0.3 * (0.5 + 0.5 * sin(uTime * 0.17)) + 0.35 * vnoise(cd * 2.0 + uTime * 0.4);
    col += tint * rays * exp(-r / len) * smoothstep(0.0, 0.05, r) * uRays * 0.9 * breathe;
  }
  // shafts of light falling through leaves, drifting, widening and narrowing
  if (uShafts > 0.001) {
    float sa = -0.35 + 0.25 * sin(uTime * 0.04);
    vec2 fall = vec2(sin(sa), -cos(sa));
    float across = dot((uv - vec2(0.5, 1.0)) * uAspect, vec2(-fall.y, fall.x)), down = dot((uv - vec2(0.5, 1.0)) * uAspect, fall);
    float w = 3.0 + 2.5 * (0.5 + 0.5 * sin(uTime * 0.07));
    float sh = pow(vnoise(vec2(across * w + uTime * 0.12, uTime * 0.08)), 3.0) + 0.6 * pow(vnoise(vec2(across * w * 2.3 - uTime * 0.2, 4.0 + uTime * 0.1)), 4.0);
    col += vec3(1.0, 0.98, 0.84) * sh * exp(-down * 0.9) * uShafts * 0.55;
  }
  // light passing over everything, as if something moved in front of the sun
  if (uSweep.y > 0.001) {
    vec2 sd = vec2(cos(uSweepAng), sin(uSweepAng));
    float v = dot((uv - 0.5) * uAspect, sd) / length(uAspect) + 0.5;
    col += vec3(1.0, 0.99, 0.88) * exp(-pow((v - uSweep.x) / 0.1, 2.0)) * uSweep.y * (0.6 + 0.6 * vnoise(uv * 7.0 + uTime));
  }
  // a flare: a long flat streak through the sun, and the lens's ghosts on the line through the middle
  if (uFlare > 0.001) {
    col += vec3(0.85, 1.0, 0.9) * exp(-abs(uv.y - uSun.y) * 90.0) * smoothstep(1.2, 0.0, abs(uv.x - uSun.x)) * uFlare * 0.9;
    for (int i = 1; i <= 4; i++) {
      vec2 gp = uSun + (vec2(0.5) - uSun) * float(i) * 0.55;
      float gr = length((uv - gp) * uAspect), rad = 0.03 + float(i) * 0.025;
      col += mix(vec3(0.7, 1.0, 0.75), vec3(1.0, 0.95, 0.7), float(i) / 4.0) * smoothstep(rad, rad * 0.6, gr) * 0.12 * uFlare;
    }
  }
  float lk = smoothstep(0.9, 0.0, abs(uv.x + sin(uTime * 0.07) * 0.6 - 0.5 + (uv.y - 0.5) * 0.5));
  col += vec3(0.55, 0.62, 0.25) * lk * uLeak * 0.25;
  if (uTape > 0.001) {
    vec3 sm = (S(uv - vec2(0.007, 0.0)) + S(uv - vec2(0.0035, 0.0)) + col + S(uv + vec2(0.005, 0.0))) * 0.25;
    float y = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, (vec3(y) + (sm - dot(sm, vec3(0.299, 0.587, 0.114))) * 1.15) * vec3(0.97, 1.03, 0.9), uTape);
  }
  // haze: the light pressed soft and green; with little haze the picture keeps its own contrast
  vec3 soft = 1.0 - exp(-col * uExpose);
  vec3 plain = clamp(col * (0.55 + 0.3 * uExpose), 0.0, 1.0);
  col = mix(plain, soft, uHaze);
  col = mix(col, vec3(dot(col, vec3(0.3, 0.55, 0.15))), 0.1 * uHaze);
  col = mix(col, col * vec3(0.94, 1.0, 0.9) + vec3(0.03, 0.07, 0.035) * (1.0 - col), uHaze);
  if (uTape > 0.001) {
    col *= 1.0 - uTape * 0.1 * step(0.5, fract(gl_FragCoord.y * 0.5));
  }
  col = mix(col, col * vec3(0.16, 0.3, 0.2) + vec3(0.01, 0.035, 0.02), uDim);
  vec3 after = vec3(0.012, 0.045, 0.03) + (b * 0.35 + st * 0.25) * vec3(0.55, 0.85, 0.4) + vec3(0.25, 0.4, 0.15) * exp(-r * 3.0) * uSunAmt;
  col = mix(col, after, uClosed);
  col = mix(col, vec3(1.0) - col * vec3(0.85, 0.7, 0.95), uInvert);   // for an instant, the negative
  col = mix(col, vec3(0.985, 1.0, 0.95), uBlind);
  col += (h1(gl_FragCoord.xy + floor(uTime * 24.0)) - 0.5) * 0.025;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createEye(renderer) {
  const blank = new THREE.DataTexture(new Uint8Array([200, 230, 190, 255]), 1, 1); blank.needsUpdate = true;
  const rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const C = {
    tA: { value: blank }, tB: { value: blank }, uFitA: { value: new THREE.Vector4(1, 1, 0, 0) }, uFitB: { value: new THREE.Vector4(1, 1, 0, 0) },
    uPixA: { value: 0 }, uPixB: { value: 0 }, uResA: { value: new THREE.Vector2(1, 1) }, uResB: { value: new THREE.Vector2(1, 1) },
    uGradeA: { value: new THREE.Vector3(0, 1, 0) }, uGradeB: { value: new THREE.Vector3(0, 1, 0) },
    uP: { value: 0 }, uType: { value: 0 }, uSeed: { value: 0.3 }, uTime: { value: 0 }, uFlow: { value: 1 },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: new THREE.Vector2(1, 1) }, uOut: { value: new THREE.Vector2(1, 1) }
  };
  const O = {
    tScene: { value: rt.texture }, uTime: { value: 0 }, uAstig: { value: 1 }, uAngle: { value: 0.3 }, uGhost: { value: 0.5 }, uExpose: { value: 1.6 },
    uBlind: { value: 0 }, uClosed: { value: 0 }, uSunAmt: { value: 0.6 }, uStreak: { value: 1 }, uLeak: { value: 0.5 }, uTape: { value: 0 }, uDim: { value: 0 }, uVel: { value: 0 },
    uHaze: { value: 1 }, uFlare: { value: 0 }, uChroma: { value: 0 }, uZoomBlur: { value: 0 }, uSpec: { value: 0 }, uSweepAng: { value: 0 }, uInvert: { value: 0 }, uMosaic: { value: 0 }, uWave: { value: 0 }, uRays: { value: 0.6 }, uShafts: { value: 0 },
    uMotion: { value: new THREE.Vector2(0, 0) }, uMotionC: { value: new THREE.Vector2(0.5, 0.5) },
    uSun2: { value: new THREE.Vector2(0.7, 0.75) }, uSweep: { value: new THREE.Vector2(0, 0) }, uShake: { value: new THREE.Vector2(0, 0) },
    uSun: { value: new THREE.Vector2(0.7, 0.75) }, uGhostDir: { value: new THREE.Vector2(0.006, 0.003) }, uAspect: { value: new THREE.Vector2(1, 1) }
  };
  const quad = function (frag, U) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false }));
    m.frustumCulled = false; const s = new THREE.Scene(); s.add(m); return s;
  };
  const s1 = quad(COMPOSE, C), s2 = quad(OPTICS, O), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), size = new THREE.Vector2();
  return {
    compose: C, optics: O,
    size: function () { renderer.getDrawingBufferSize(size); rt.setSize(Math.max(4, size.x), Math.max(4, size.y)); C.uOut.value.copy(size); },
    render: function () { renderer.setRenderTarget(rt); renderer.render(s1, cam); renderer.setRenderTarget(null); renderer.render(s2, cam); }
  };
}

// how a picture of size (w, h) covers a screen of aspect a, zoomed by z and moved by (px, py)
export function cover(w, h, a, z, px, py, out) {
  const ia = w / h;
  let sx = 1, sy = 1;
  if (a > ia) sy = ia / a; else sx = a / ia;
  sx /= z; sy /= z;
  return out.set(sx, sy, px * (1 - sx) / 2, py * (1 - sy) / 2);
}

export const TRANSITIONS = ['fall', 'strips', 'squares', 'grow', 'burn', 'smear', 'eye', 'kaleidoscope', 'blinds', 'letters'];
