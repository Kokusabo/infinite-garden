/* lens.js - the camera the garden is seen through. One picture goes in; out comes
 * a perfect lens, a dream gone soft, a worn tape, a cheap digital camera blown out
 * by the sun, or light-green letters. They mix: nothing is ever quite one of them. */

const CANDIDATES = " .'`,:;-~=+*<>!ilcxvzoaunesOQ0#%&8@$MW";

function glyphAtlas() {
  const size = 40, font = '400 ' + size + 'px "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
  const m = document.createElement('canvas').getContext('2d');
  m.font = font;
  const cw = Math.ceil(m.measureText('M').width), ch = Math.ceil(size * 1.25);
  const probe = document.createElement('canvas'); probe.width = cw; probe.height = ch;
  const px = probe.getContext('2d', { willReadFrequently: true });
  const list = [];
  for (const c of CANDIDATES) {
    px.clearRect(0, 0, cw, ch); px.font = font; px.fillStyle = '#fff'; px.textBaseline = 'middle';
    px.fillText(c, 0, ch / 2);
    const d = px.getImageData(0, 0, cw, ch).data;
    let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i];
    list.push([c, s]);
  }
  list.sort(function (a, b) { return a[1] - b[1]; });
  const max = list[list.length - 1][1] || 1, N = 16;
  let chars = ' ';
  for (let k = 1; k < N; k++) {
    const target = k / (N - 1) * max;
    let best = null, bd = 1e18;
    for (let i = 1; i < list.length; i++) {
      const d = Math.abs(list[i][1] - target);
      if (d < bd && chars.indexOf(list[i][0]) < 0) { bd = d; best = list[i][0]; }
    }
    if (best) chars += best;
  }
  const c = document.createElement('canvas'); c.width = cw * chars.length; c.height = ch;
  const x = c.getContext('2d'); x.font = font; x.fillStyle = '#fff'; x.textBaseline = 'middle';
  for (let i = 0; i < chars.length; i++) x.fillText(chars[i], i * cw, ch / 2);
  return { canvas: c, count: chars.length, aspect: cw / ch };
}

const VERT = 'attribute vec2 p; varying vec2 vUv; void main() { vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';

const FRAG = `
precision mediump float;
uniform sampler2D uTex, uGlyph;
uniform vec2 uRes, uSrc;
uniform float uTime, uBlur, uVhs, uAscii, uExpose, uFish, uBloom, uSharp, uFlash, uTrack, uRoll, uCell, uGlyphN, uGlyphAspect, uDark;
varying vec2 vUv;
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 tx(vec2 uv) { return texture2D(uTex, clamp(uv, 0.001, 0.999)).rgb; }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec2 uv = vUv;
  vec2 px = 1.0 / uSrc;
  // a cheap wide lens bulges the middle and darkens the corners
  vec2 q = uv * 2.0 - 1.0;
  if (uFish > 0.001) { q *= 1.0 - uFish * 0.12 * (1.0 - dot(q, q) * 0.5); uv = q * 0.5 + 0.5; }
  // the tape: lines wobble, a band of noise crawls up, sometimes the picture rolls
  float tick = floor(uTime * 30.0);
  float line = floor(uv.y * uSrc.y);
  float band = 0.0;
  if (uVhs > 0.001) {
    uv.y = fract(uv.y + uRoll);
    uv.x += (h1(vec2(line, tick)) - 0.5) * 0.003 * uVhs + sin(uv.y * 40.0 + uTime * 3.0) * 0.0012 * uVhs;
    band = smoothstep(0.018, 0.0, abs(uv.y - fract(uTrack))) * uVhs;
    uv.x += band * (h1(vec2(line, tick + 3.0)) - 0.5) * 0.05;
  }
  vec3 col;
  // out of focus: a disc of samples
  if (uBlur > 0.02) {
    col = vec3(0.0);
    float r = uBlur * 9.0;
    for (int i = 0; i < 18; i++) {
      float fi = float(i), a = fi * 2.39996, rr = sqrt((fi + 0.5) / 18.0) * r;
      col += tx(uv + vec2(cos(a), sin(a)) * rr * px);
    }
    col /= 18.0;
  } else {
    col = tx(uv);
    // the perfect lens: a touch of sharpening and colour fringes at the edges
    vec3 nb = (tx(uv + vec2(px.x, 0.0)) + tx(uv - vec2(px.x, 0.0)) + tx(uv + vec2(0.0, px.y)) + tx(uv - vec2(0.0, px.y))) * 0.25;
    col += (col - nb) * uSharp;
    float ca = dot(q, q) * 0.0025 * uSharp;
    col.r = mix(col.r, tx(uv + q * ca).r, 0.6); col.b = mix(col.b, tx(uv - q * ca).b, 0.6);
  }
  // light bleeding round everything bright
  vec3 b = vec3(0.0);
  for (int i = 0; i < 10; i++) {
    float fi = float(i), a = fi * 2.39996, rr = (4.0 + fi * 1.6) * (1.0 + uBlur);
    b += max(tx(uv + vec2(cos(a), sin(a)) * rr * px) - 0.66, 0.0);
  }
  col += b * uBloom * 0.22;
  if (uVhs > 0.001) {
    // colour smeared sideways, kept apart from the brightness, as tape does
    vec3 s = (tx(uv - vec2(4.0, 0.0) * px) + tx(uv - vec2(2.0, 0.0) * px) + col + tx(uv + vec2(3.0, 0.0) * px)) * 0.25;
    vec3 v = vec3(luma(col)) + (s - luma(s)) * 1.25;
    v.r = mix(v.r, tx(uv + vec2(6.0, 0.0) * px).r, 0.3);
    v = mix(v, v * vec3(0.94, 1.05, 0.9), 0.6);
    col = mix(col, v, uVhs);
    col *= 1.0 - uVhs * 0.14 * step(0.5, fract(gl_FragCoord.y * 0.5));
    col += (h1(vec2(gl_FragCoord.x * 0.3, line + tick)) - 0.5) * 0.12 * uVhs;
    col = mix(col, vec3(h1(gl_FragCoord.xy + tick)) * 0.8 + col * 0.4, band * 0.35);
  }
  // a cheap camera in full sun: everything bright burns out
  col = mix(col, 1.0 - exp(-col * 2.4), uExpose);
  col = mix(col, col * col * (3.0 - 2.0 * col), uExpose * 0.2);
  col = mix(col, vec3(luma(col)), uExpose * 0.15);
  // letters, light green
  if (uAscii > 0.001) {
    vec2 size = vec2(uCell * uGlyphAspect, uCell);
    vec2 cell = floor(gl_FragCoord.xy / size), local = fract(gl_FragCoord.xy / size);
    vec3 sc = tx((cell + 0.5) * size / uRes);
    float lv = luma(sc);
    float ink = uDark > 0.5 ? smoothstep(0.04, 0.7, lv) : smoothstep(0.3, 0.98, lv);
    float idx = floor(ink * (uGlyphN - 1.0) + 0.5);
    float a = texture2D(uGlyph, vec2((idx + local.x) / uGlyphN, 1.0 - local.y)).a;
    vec3 paper = vec3(0.035, 0.09, 0.05), green = mix(vec3(0.5, 0.92, 0.45), clamp(sc * 1.35, 0.0, 1.0), 0.45);
    vec3 asc = mix(paper, green, a);
    col = mix(col, asc, step(h1(cell * 0.71 + 2.3), uAscii));
  }
  // corners, grain, flash
  float vig = smoothstep(1.5, 0.45, length(q * vec2(1.0, 0.9)));
  col *= mix(1.0, vig, 0.35 + uFish * 0.5);
  col += (h1(gl_FragCoord.xy + tick * 1.7) - 0.5) * 0.03;
  col = mix(col, vec3(0.94, 1.0, 0.9), uFlash);
  gl_FragColor = vec4(col, 1.0);
}`;

export function createLens(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  function texture(unit) {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  const picture = texture(0), glyphs = texture(1);
  const atlas = glyphAtlas();
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, glyphs);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
  const U = {};
  ['uTex', 'uGlyph', 'uRes', 'uSrc', 'uTime', 'uBlur', 'uVhs', 'uAscii', 'uExpose', 'uFish', 'uBloom', 'uSharp', 'uFlash', 'uTrack', 'uRoll', 'uCell', 'uGlyphN', 'uGlyphAspect', 'uDark']
    .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uGlyph, 1);
  gl.uniform1f(U.uGlyphN, atlas.count); gl.uniform1f(U.uGlyphAspect, atlas.aspect);

  return {
    // draw the picture through the lens. s: the camera's settings this frame
    draw: function (src, s) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, picture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.uniform2f(U.uRes, canvas.width, canvas.height); gl.uniform2f(U.uSrc, src.width, src.height);
      gl.uniform1f(U.uTime, s.time); gl.uniform1f(U.uBlur, s.blur); gl.uniform1f(U.uVhs, s.vhs); gl.uniform1f(U.uAscii, s.ascii);
      gl.uniform1f(U.uExpose, s.expose); gl.uniform1f(U.uFish, s.fish); gl.uniform1f(U.uBloom, s.bloom); gl.uniform1f(U.uSharp, s.sharp);
      gl.uniform1f(U.uFlash, s.flash); gl.uniform1f(U.uTrack, s.track); gl.uniform1f(U.uRoll, s.roll); gl.uniform1f(U.uCell, s.cell); gl.uniform1f(U.uDark, s.dark);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  };
}
