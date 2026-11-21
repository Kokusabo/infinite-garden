/* worlds.js - a few places made the old way, like a game nobody finished: low polygons,
 * small pixel textures, fog. A meadow with a chair in it, a glass house full of plants,
 * an empty white room where something grows towards the window. Each is drawn small,
 * into its own picture, and then seen through the same eyes as the photographs. */
import * as THREE from '../vendor/three.module.min.js';
import { makeFlower } from './ascii.js?v=3';

const TAU = Math.PI * 2;
function rng(seed) { let s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function tex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const R0 = rng(41);
function speckle(x, w, h, base, cols, n) { x.fillStyle = base; x.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { x.fillStyle = cols[(R0() * cols.length) | 0]; x.fillRect((R0() * w) | 0, (R0() * h) | 0, 1 + (R0() * 2 | 0), 1); } }

const T = {};
function textures() {
  if (T.grass) return T;
  T.grass = tex(32, 32, function (x, w, h) { speckle(x, w, h, '#7fa35a', ['#6d924c', '#8db466', '#99bd70', '#749a52', '#a5c47a'], 260); }, [60, 60]);
  T.tuft = tex(16, 16, function (x) { for (let i = 0; i < 9; i++) { const bx = 2 + (R0() * 12) | 0, hh = 6 + (R0() * 9) | 0; x.fillStyle = ['#7fa85a', '#93bd68', '#6c9649', '#a8cc7c'][i % 4]; for (let y = 0; y < hh; y++) x.fillRect(bx + Math.round((y / hh) * (R0() * 2 - 1)), 15 - y, 1, 1); } });
  T.flower = tex(8, 8, function (x) { x.fillStyle = '#f7fbf0'; x.fillRect(3, 1, 2, 2); x.fillRect(1, 3, 2, 2); x.fillRect(5, 3, 2, 2); x.fillRect(3, 5, 2, 2); x.fillStyle = '#e8d978'; x.fillRect(3, 3, 2, 2); x.fillStyle = '#6c9649'; x.fillRect(4, 7, 1, 1); });
  T.leafy = tex(32, 32, function (x) {
    for (let i = 0; i < 70; i++) { const px = 4 + R0() * 24, py = 2 + R0() * 26, s = 2 + R0() * 3; x.fillStyle = ['#3f7a3a', '#5a9a4a', '#77b45a', '#9ccc72', '#2f6430'][(R0() * 5) | 0]; x.beginPath(); x.ellipse(px, py, s, s * 0.6, R0() * 3, 0, TAU); x.fill(); }
    x.fillStyle = '#4b6b3a'; x.fillRect(15, 20, 2, 12);
  });
  T.plaster = tex(32, 32, function (x, w, h) { speckle(x, w, h, '#eef1ea', ['#e2e7de', '#f6f8f2', '#dfe4d8', '#d6ddd0'], 200); x.fillStyle = 'rgba(120,140,110,0.18)'; x.fillRect(0, 20 + (R0() * 8 | 0), 32, 1); }, [4, 2]);
  T.tile = tex(32, 32, function (x, w, h) { speckle(x, w, h, '#dfe5dc', ['#d3dbd0', '#e9eee6'], 120); x.fillStyle = '#b9c4b6'; x.fillRect(0, 15, 32, 1); x.fillRect(15, 0, 1, 32); x.fillRect(0, 31, 32, 1); x.fillRect(31, 0, 1, 32); x.fillStyle = '#9aa894'; x.fillRect(4, 6, 9, 1); x.fillRect(12, 7, 1, 5); }, [8, 30]);
  T.ivy = tex(32, 32, function (x) { for (let i = 0; i < 40; i++) { x.fillStyle = ['#3e7436', '#5b9446', '#78ad57', '#2d5e2c'][(R0() * 4) | 0]; const px = R0() * 32, py = R0() * 32; x.fillRect(px | 0, py | 0, 3, 2); x.fillRect((px | 0) + 1, (py | 0) - 1, 1, 1); } });
  T.wood = tex(16, 16, function (x, w, h) { speckle(x, w, h, '#f2f2ec', ['#e4e6de', '#fbfbf6'], 40); });
  T.concrete = tex(32, 32, function (x, w, h) { speckle(x, w, h, '#c9c8bc', ['#bdbcaf', '#d4d3c8', '#b3b4a6', '#dad9cf'], 260); x.fillStyle = 'rgba(80,90,70,0.25)'; x.fillRect(0, 0, 32, 1); });
  T.moss = tex(32, 32, function (x) { for (let i = 0; i < 160; i++) { x.fillStyle = ['#6f9a3e', '#87b04c', '#5b8636', '#a3c460', '#4c7430'][(R0() * 5) | 0]; x.fillRect((R0() * 32) | 0, (R0() * 32) | 0, 2, 1 + (R0() * 2 | 0)); } });
  return T;
}
function crossed(texture, w, h) {
  const g = new THREE.BufferGeometry(), a = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), b = a.clone().rotateY(Math.PI / 2);
  const m = new THREE.Mesh(a, null); void m;
  const pos = [], uv = [], idx = [];
  [a, b].forEach(function (p, k) { const o = pos.length / 3; pos.push.apply(pos, p.attributes.position.array); uv.push.apply(uv, p.attributes.uv.array); idx.push.apply(idx, Array.from(p.index.array).map(function (i) { return i + o; })); void k; });
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function scatter(scene, geo, mat, n, place) {
  const im = new THREE.InstancedMesh(geo, mat, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) { const r = place(i); p.set(r[0], r[1], r[2]); q.setFromEuler(e.set(0, r[3], 0)); s.setScalar(r[4]); m.compose(p, q, s); im.setMatrixAt(i, m); }
  scene.add(im); return im;
}
function lights(scene, hemi, sun) {
  scene.add(new THREE.HemisphereLight(0xf4fbe8, 0x8fa080, hemi));
  const d = new THREE.DirectionalLight(0xfffbe8, sun); d.position.set(-20, 40, 15); scene.add(d);
}

/* ---------- a meadow, a chair, wires ---------- */
function meadow() {
  const t = textures(), R = rng(7), scene = new THREE.Scene();
  scene.background = new THREE.Color('#eaf3dd'); scene.fog = new THREE.Fog('#e3efd6', 6, 60);
  lights(scene, 2.2, 1.6);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: t.grass }));
  scene.add(ground);
  const tuftMat = new THREE.MeshLambertMaterial({ map: t.tuft, alphaTest: 0.5, side: THREE.DoubleSide });
  scatter(scene, crossed(t.tuft, 1, 1), tuftMat, 4200, function () { return [(R() - 0.5) * 60, 0, -R() * 80 + 6, R() * TAU, 0.22 + R() * 0.4]; });
  scatter(scene, crossed(t.flower, 0.25, 0.25), new THREE.MeshLambertMaterial({ map: t.flower, alphaTest: 0.5, side: THREE.DoubleSide }), 900, function () { return [(R() - 0.5) * 50, 0, -R() * 70 + 5, R() * TAU, 0.5 + R() * 0.6]; });
  // a white chair, facing away
  const white = new THREE.MeshLambertMaterial({ map: t.wood }), chair = new THREE.Group();
  [[0, 0.45, 0, 0.5, 0.06, 0.5], [0, 0.8, 0.22, 0.5, 0.65, 0.05]].forEach(function (b) { const m = new THREE.Mesh(new THREE.BoxGeometry(b[3], b[4], b[5]), white); m.position.set(b[0], b[1], b[2]); chair.add(m); });
  [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].forEach(function (l) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.05), white); m.position.set(l[0], 0.22, l[1]); chair.add(m); });
  chair.position.set(1.4, 0, -9); chair.rotation.y = 0.3; scene.add(chair);
  // an old television in the grass, still on, showing a flower made of letters
  const tvc = document.createElement('canvas'); tvc.width = 160; tvc.height = 120;
  const tvx = tvc.getContext('2d'), tvTex = new THREE.CanvasTexture(tvc);
  tvTex.magFilter = THREE.NearestFilter; tvTex.minFilter = THREE.NearestFilter; tvTex.generateMipmaps = false; tvTex.colorSpace = THREE.SRGBColorSpace;
  function channel(seed) {
    const f = makeFlower(seed, { size: 15 });
    tvx.fillStyle = '#1c4a26'; tvx.fillRect(0, 0, 160, 120);
    tvx.font = 'bold 8px monospace'; tvx.fillStyle = '#e4ffd6';
    const w = f.rows[0] ? f.rows[0].length : 0, ox = (160 - w * 4.8) / 2;
    f.rows.forEach(function (row, i) { tvx.fillText(row, ox, 8 + i * 7); });
    tvx.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < 120; y += 2) tvx.fillRect(0, y, 160, 1);
    tvTex.needsUpdate = true;
  }
  channel(3);
  const tv = new THREE.Group(), shell = new THREE.MeshLambertMaterial({ color: 0x4c4f48 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.58, 0.6), shell); body.position.y = 0.29; tv.add(body);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.41), new THREE.MeshBasicMaterial({ map: tvTex, fog: false })); screen.position.set(-0.06, 0.3, 0.301); tv.add(screen);
  tv.position.set(-0.7, 0, -5.2); tv.rotation.y = 0.35; scene.add(tv);
  let chan = 0;
  // poles and the wires between them
  const pole = new THREE.MeshLambertMaterial({ color: 0x8c8a7c }), wire = new THREE.LineBasicMaterial({ color: 0x5d6656 });
  const tops = [];
  for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 8, 0.18), pole); p.position.set(-9 + i * 1.5, 4, -10 - i * 14); scene.add(p); const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), pole); bar.position.set(p.position.x, 7.6, p.position.z); scene.add(bar); tops.push(p.position); }
  [-0.7, 0, 0.7].forEach(function (o) { for (let i = 0; i < tops.length - 1; i++) { const pts = []; for (let k = 0; k <= 12; k++) { const u = k / 12; pts.push(new THREE.Vector3(tops[i].x + o + (tops[i + 1].x - tops[i].x) * u, 7.65 - Math.sin(u * Math.PI) * 0.8, tops[i].z + (tops[i + 1].z - tops[i].z) * u)); } scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire)); } });
  // trees far off, round and soft
  const crown = new THREE.MeshLambertMaterial({ map: t.leafy, color: 0xd0e8c0 });
  for (let i = 0; i < 14; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + R() * 2.5, 0), crown); c.position.set((R() - 0.5) * 70, 2.5 + R() * 2, -40 - R() * 30); scene.add(c); }
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.05, 300);
  return { scene: scene, camera: camera, update: function (t) {
    camera.position.set(Math.sin(t * 0.05) * 1.5, 1.3 + Math.sin(t * 0.4) * 0.03, 2 - t * 0.35 % 30); camera.lookAt(camera.position.x * 0.5 + 0.2, 1.0, camera.position.z - 10);
    if (Math.floor(t / 6) !== chan) { chan = Math.floor(t / 6); channel(chan * 977 + 5); }
  } };
}

/* ---------- a glass house ---------- */
function greenhouse() {
  const t = textures(), R = rng(11), scene = new THREE.Scene();
  scene.background = new THREE.Color('#f1f6ea'); scene.fog = new THREE.Fog('#eef4e6', 3, 34);
  lights(scene, 2.4, 1.2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 80).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: t.tile }));
  floor.position.z = -36; scene.add(floor);
  const frame = new THREE.MeshLambertMaterial({ color: 0xf6f7f2 });
  for (let k = 0; k < 26; k++) {
    const z = -k * 3;
    for (let i = 0; i < 12; i++) {
      const a0 = i / 12 * Math.PI, a1 = (i + 1) / 12 * Math.PI, x0 = Math.cos(a0) * 4, y0 = Math.sin(a0) * 4.5 + 1, x1 = Math.cos(a1) * 4, y1 = Math.sin(a1) * 4.5 + 1;
      const len = Math.hypot(x1 - x0, y1 - y0), m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.06), frame);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); m.rotation.z = Math.atan2(y1 - y0, x1 - x0); scene.add(m);
    }
    [-4, 4].forEach(function (x) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.06), frame); p.position.set(x, 0.5, z); scene.add(p); });
  }
  for (let i = 0; i < 9; i++) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 80), frame); const a = i / 8 * Math.PI; rail.position.set(Math.cos(a) * 4, Math.sin(a) * 4.5 + 1, -36); scene.add(rail); }
  const leafy = new THREE.MeshLambertMaterial({ map: t.leafy, alphaTest: 0.5, side: THREE.DoubleSide });
  scatter(scene, crossed(t.leafy, 1.4, 1.6), leafy, 340, function () { const side = R() < 0.5 ? -1 : 1; return [side * (1.4 + R() * 2.3), 0, -R() * 76 + 2, R() * TAU, 0.45 + R() * 0.9]; });
  const pots = new THREE.MeshLambertMaterial({ color: 0xc9b9a3 });
  scatter(scene, new THREE.CylinderGeometry(0.22, 0.16, 0.3, 8).translate(0, 0.15, 0), pots, 60, function () { const side = R() < 0.5 ? -1 : 1; return [side * (1.2 + R() * 0.3), 0, -R() * 76, 0, 0.8 + R() * 0.6]; });
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.05, 200);
  return { scene: scene, camera: camera, update: function (t) { const z = -((t * 0.5) % 50); camera.position.set(Math.sin(t * 0.13) * 0.4, 1.5, z); camera.lookAt(Math.sin(t * 0.07) * 1.5, 1.9 + Math.sin(t * 0.05) * 0.4, z - 8); } };
}

/* ---------- the white room ---------- */
function room() {
  const t = textures(), R = rng(23), scene = new THREE.Scene();
  scene.background = new THREE.Color('#f4f7f0'); scene.fog = new THREE.Fog('#f2f6ee', 4, 22);
  lights(scene, 2.0, 0.9);
  const wall = new THREE.MeshLambertMaterial({ map: t.plaster, side: THREE.BackSide });
  const box = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 10), wall); box.position.y = 2; scene.add(box);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 10).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: t.tile }));
  floor.position.y = 0.01; t.tile.repeat.set(8, 10); scene.add(floor);
  // the window: just light
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.4), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  win.position.set(0, 2.2, -4.98); scene.add(win);
  const bars = new THREE.MeshLambertMaterial({ color: 0xdfe4d8 });
  [[0, 2.2, 0.06, 2.4], [0, 2.2, 2.2, 0.06]].forEach(function (b) { const m = new THREE.Mesh(new THREE.BoxGeometry(b[2], b[3], 0.05), bars); m.position.set(b[0], b[1], -4.95); scene.add(m); });
  // the shaft it throws, down to the floor
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 6), new THREE.MeshBasicMaterial({ color: 0xfaffee, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  shaft.position.set(0, 1.2, -2.4); shaft.rotation.x = -1.05; scene.add(shaft);
  // something growing in the middle, and ivy coming in at a corner
  const leafy = new THREE.MeshLambertMaterial({ map: t.leafy, alphaTest: 0.5, side: THREE.DoubleSide });
  const plant = new THREE.Mesh(crossed(t.leafy, 1.4, 1.8), leafy); plant.position.set(0.2, 0, -1.4); scene.add(plant);
  scatter(scene, crossed(t.tuft, 1, 1), new THREE.MeshLambertMaterial({ map: t.tuft, alphaTest: 0.5, side: THREE.DoubleSide }), 40, function () { return [0.2 + (R() - 0.5) * 2, 0, -1.4 + (R() - 0.5) * 2, R() * TAU, 0.3 + R() * 0.4]; });
  const ivy = new THREE.MeshLambertMaterial({ map: t.ivy, alphaTest: 0.5, transparent: false, side: THREE.DoubleSide });
  const iv = new THREE.Mesh(new THREE.PlaneGeometry(3, 4), ivy); iv.position.set(3.97, 2, -3); iv.rotation.y = -Math.PI / 2; t.ivy.wrapS = t.ivy.wrapT = THREE.RepeatWrapping; t.ivy.repeat.set(3, 4); scene.add(iv);
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 100);
  return { scene: scene, camera: camera, update: function (t) { const a = Math.sin(t * 0.06) * 0.5; camera.position.set(Math.sin(a) * 3, 1.5 + Math.sin(t * 0.2) * 0.05, 3.5 - t * 0.02 % 1.5); camera.lookAt(0.2, 1.5, -2.5); } };
}

/* ---------- stairs up into the trees, and light at the top ---------- */
function stairs() {
  const t = textures(), R = rng(31), scene = new THREE.Scene();
  scene.background = new THREE.Color('#f1f7e8'); scene.fog = new THREE.Fog('#ecf4e2', 3, 26);
  lights(scene, 2.1, 1.4);
  const N = 48, rise = 0.2, run = 0.42;
  const concrete = new THREE.MeshLambertMaterial({ map: t.concrete }), moss = new THREE.MeshLambertMaterial({ map: t.moss });
  for (let i = 0; i < N; i++) {
    const h = rise * (i + 1), step = new THREE.Mesh(new THREE.BoxGeometry(2.6, h, run), concrete);
    step.position.set(0, h / 2, -run * (i + 0.5)); scene.add(step);
    if (R() < 0.75) { const w = 2.4 * (0.3 + R() * 0.7), m = new THREE.Mesh(new THREE.PlaneGeometry(w, run * 0.92).rotateX(-Math.PI / 2), moss); m.position.set((R() - 0.5) * (2.4 - w), h + 0.004, -run * (i + 0.5)); scene.add(m); }
  }
  // a rail on one side
  const rail = new THREE.MeshLambertMaterial({ color: 0x6f7a62 }), slope = Math.atan2(rise, run), len = Math.hypot(rise, run) * N;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len), rail); bar.position.set(1.15, rise * N / 2 + 0.95, -run * N / 2); bar.rotation.x = slope; scene.add(bar);
  for (let i = 2; i < N; i += 5) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.95, 0.04), rail); post.position.set(1.15, rise * (i + 1) + 0.47, -run * (i + 0.5)); scene.add(post); }
  // walls of ivy on both sides, and trees closing overhead
  const ivy = new THREE.MeshLambertMaterial({ map: t.ivy, alphaTest: 0.5, side: THREE.DoubleSide });
  t.ivy.wrapS = t.ivy.wrapT = THREE.RepeatWrapping;
  [-1.4, 1.4].forEach(function (x) { const w = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.4), ivy); w.rotation.set(0, Math.PI / 2, -slope); w.position.set(x, rise * N / 2 + 0.6, -run * N / 2); scene.add(w); });
  const leafy = new THREE.MeshLambertMaterial({ map: t.leafy, alphaTest: 0.5, side: THREE.DoubleSide });
  scatter(scene, crossed(t.leafy, 3, 4), leafy, 70, function (i) { const side = i % 2 ? -1 : 1, k = R(); return [side * (2.2 + R() * 2.5), rise * N * k - 0.5, -run * N * k, R() * TAU, 0.8 + R() * 1.2]; });
  // the top, where it is too bright to see
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  glow.position.set(0, rise * N + 1.5, -run * N - 1.5); scene.add(glow);
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 120);
  return { scene: scene, camera: camera, update: function (t) {
    const k = (t * 0.22) % (run * N * 0.75), z = 1.2 - k, y = Math.max(0, -z / run) * rise + 1.55;
    camera.position.set(Math.sin(t * 0.15) * 0.25, y + Math.sin(t * 1.6) * 0.03, z);
    camera.lookAt(Math.sin(t * 0.07) * 0.6, y + 1.2, z - 6);
  } };
}

export const WORLD_NAMES = ['meadow', 'greenhouse', 'stairs', 'room'];
const MAKERS = { meadow: meadow, greenhouse: greenhouse, room: room, stairs: stairs };

// a world drawn small into its own picture
export function createWorld(name, renderer) {
  const w = MAKERS[name]();
  const rt = new THREE.WebGLRenderTarget(320, 180, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, depthBuffer: true });
  return {
    texture: rt.texture, w: 320, h: 180,
    size: function (aspect) { const h = 250, wd = Math.round(h * aspect); if (rt.width !== wd) { rt.setSize(wd, h); this.w = wd; this.h = h; w.camera.aspect = aspect; w.camera.updateProjectionMatrix(); } },
    draw: function (t) { w.update(t); renderer.setRenderTarget(rt); renderer.render(w.scene, w.camera); renderer.setRenderTarget(null); }
  };
}
