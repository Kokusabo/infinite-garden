/* main.js - a garden you move through yourself. Nothing moves on unless you do: scroll,
 * swipe or press a key and the next scene comes, and how hard you push is how hard it
 * tears. Between photographs come old 3d places, pictures remembered as letters, and
 * pages from a book about all this. Touch, and a flower made of letters grows there.
 * Hold, and your eyes close. Type, and what you type grows. It does not end. */
import * as THREE from '../vendor/three.module.min.js';
import { createEye, cover, TRANSITIONS } from './eye.js?v=1';
import { createWorld, WORLD_NAMES } from './worlds.js?v=3';
import { makeFlower, bloom, createLetters } from './ascii.js?v=3';
import { createScenes } from './scenes.js?v=1';
import { createType } from './type.js?v=1';
import { createPages } from './pages.js?v=1';
import { createSound } from './sound.js?v=3';

const $ = function (s) { return document.querySelector(s); };
const rand = function (a, b) { return a + Math.random() * (b - a); };
const lerp = function (a, b, t) { return a + (b - a) * t; };
const clamp01 = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
const smooth = function (t) { t = clamp01(t); return t * t * (3 - 2 * t); };
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clock = function () { return performance.now() / 1000; };
const FOOTAGE = 57;
const footage = function (n) { return 'footage/' + String(n).padStart(2, '0') + '.jpg?v=1'; };
const stamp = $('#stamp');

/* ---------- sound: on from the first touch, unless turned off before ---------- */
const sound = createSound();
const sndBtn = $('#snd');
let soundWanted = true;
try { soundWanted = localStorage.getItem('garden-sound') !== 'off'; } catch (e) { soundWanted = true; }
function showSound(on) { sndBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); sndBtn.textContent = on ? 'sound' : 'no sound'; }
showSound(soundWanted);
function wakeSound(e) { if (!soundWanted || (e && e.target && e.target.closest && e.target.closest('#snd'))) return; sound.start(); }
['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'].forEach(function (ev) { window.addEventListener(ev, wakeSound, true); });
sndBtn.addEventListener('click', function () {
  let on;
  if (soundWanted && sound.isOn()) on = sound.toggle(); else { sound.start(); on = true; }
  soundWanted = on;
  try { localStorage.setItem('garden-sound', on ? 'on' : 'off'); } catch (e) { /* not remembered */ }
  showSound(on);
});
const tapes = $('#tapes'), eject = $('#eject');
eject.addEventListener('click', function () { const open = tapes.hidden; tapes.hidden = !open; eject.setAttribute('aria-expanded', open ? 'true' : 'false'); });

/* ---------- opening the eyes ---------- */
const lids = $('#lids'), openBtn = $('#open'), hint = $('#hint');
let started = false, openedAt = 1e9;
$('#first').textContent = makeFlower((Math.random() * 1e9) | 0, { kind: 'tulip', size: 15 }).rows.join('\n');
function begin() {
  if (started) return;
  started = true; openedAt = clock();
  sound.start(); setTimeout(function () { sound.play(); }, 80);
  lids.classList.add('off');
  setTimeout(function () { lids.hidden = true; }, 2600);
  setTimeout(function () { if (!moved) hint.classList.add('on'); }, 3200);
}
let moved = false;
openBtn.addEventListener('click', begin);
lids.addEventListener('pointerdown', function (e) { if (e.target === lids) begin(); });

/* ---------- the eye ---------- */
const view = $('#view');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas: view, antialias: false, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
if (!renderer) document.documentElement.classList.add('no-gl');
else run();

function run() {
  const eye = createEye(renderer), C = eye.compose, O = eye.optics;
  function size() {
    const scale = Math.min(window.devicePixelRatio || 1, 2) * (window.innerWidth < 700 ? 0.42 : 0.55);
    renderer.setPixelRatio(scale);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    eye.size();
    const a = window.innerWidth / window.innerHeight;
    C.uAspect.value.set(a, 1); O.uAspect.value.set(a, 1);
  }
  size();
  window.addEventListener('resize', size);

  const visit = (Math.random() * 1e9) | 0;
  const scenes = createScenes(visit, FOOTAGE, WORLD_NAMES), get = scenes.get;

  /* ---- photographs, loaded a little ahead of you ---- */
  const loader = new THREE.TextureLoader(), photos = new Map();
  function want(n) {
    if (photos.has(n)) return photos.get(n);
    const p = { tex: null, w: 1, h: 1, ready: false };
    photos.set(n, p);
    loader.load(footage(n), function (t) {
      t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      p.tex = t; p.w = t.image.width; p.h = t.image.height; p.ready = true;
    }, undefined, function () { photos.delete(n); });
    return p;
  }
  let pos = 0, target = 0, vel = 0;
  function prune() {
    if (photos.size < 14) return;
    const keep = new Set();
    for (let i = Math.max(0, Math.floor(pos) - 2); i <= Math.floor(pos) + 4; i++) keep.add(get(i).photo);
    photos.forEach(function (p, n) { if (!keep.has(n) && p.ready) { p.tex.dispose(); photos.delete(n); } });
  }
  const worlds = {};
  function source(s) {
    if (s.kind === 'world') {
      if (!worlds[s.world]) worlds[s.world] = createWorld(s.world, renderer);
      const w = worlds[s.world];
      return { tex: w.texture, w: w.w, h: w.h, pix: 1, ready: true, world: w };
    }
    const p = want(s.photo);
    return { tex: p.tex, w: p.w, h: p.h, pix: 0, ready: p.ready, img: p.tex && p.tex.image };
  }
  // where a scene's picture sits on the screen: a slow drift, and a push as you scroll past it
  function fit(s, src, d, t, out) {
    const a = window.innerWidth / window.innerHeight;
    const z = lerp(s.z0, s.z1, 0.5 + 0.5 * Math.sin(t * 0.05 + s.seed * 6.28)) + Math.abs(d) * 0.08;
    const px = s.px + s.dx * Math.sin(t * 0.031 + s.seed * 3), py = s.py + s.dy * Math.cos(t * 0.027 + s.seed * 5) - d * 0.5;
    return cover(src.w, src.h, a, z, Math.max(-1, Math.min(1, px)), Math.max(-1, Math.min(1, py)), out);
  }
  function cropOf(src, f) { const iw = src.w, ih = src.h; return { x: (0.5 - f.x / 2 + f.z) * iw, y: (1 - (0.5 + f.y / 2 + f.w)) * ih, w: f.x * iw, h: f.y * ih }; }

  /* ---- layers on top of the picture ---- */
  const type = createType($('#words'));
  const pages = createPages($('#pages'), footage);
  const lettersCan = $('#letters'), letters = createLetters(lettersCan);
  const garden = $('#garden'), blooms = [];
  const dust = $('#dust'), dx = dust.getContext('2d'), seeds = [];
  let letterKey = '', letterPainted = 0;
  function canvases() {
    const r = Math.min(window.devicePixelRatio || 1, 2);
    [dust, lettersCan].forEach(function (c) { c.width = Math.round(window.innerWidth * r); c.height = Math.round(window.innerHeight * r); });
    dx.setTransform(r, 0, 0, r, 0, 0);
    letterKey = '';
  }
  canvases();
  window.addEventListener('resize', canvases);

  function plant(x, y, petal, big) {
    const small = window.innerWidth < 700;
    const sz = big ? (small ? 13 : 20) : (small ? rand(9.5, 12) : rand(13, 18));
    const f = makeFlower((Math.random() * 1e9) | 0, { size: big ? 26 : rand(14, 24), petal: petal });
    const b = bloom(garden, f, x, y, sz, big ? 6 : rand(6, 10));
    if (big) b.el.classList.add('after');
    b.big = big;
    blooms.push(b);
    if (blooms.length > 8) { const o = blooms.shift(); o.el.remove(); }
  }
  const SEEDS = ['*', '+', '.', "'", '*', '`', '+', '.'];
  function shed(b, k) {
    const n = Math.round((b.big ? 26 : 12) * k);
    for (let i = 0; i < n; i++) seeds.push({ x: b.x + Math.random() * b.w, y: b.y + Math.random() * b.h * 0.5, vx: rand(4, 26) + (k > 1 ? rand(-60, 60) : 0), vy: rand(-26, -8) + (k > 1 ? rand(-80, 40) : 0), ch: SEEDS[(Math.random() * SEEDS.length) | 0], born: clock(), life: rand(5, 10), ph: rand(0, 6.28) });
  }
  let dustDirty = false;
  function drawSeeds(t, dt, push) {
    if (!seeds.length && !dustDirty) return;
    dx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    dustDirty = seeds.length > 0;
    dx.font = '400 ' + (window.innerWidth < 700 ? 15 : 19) + 'px "IBM Plex Mono", ui-monospace, monospace';
    for (let i = seeds.length - 1; i >= 0; i--) {
      const p = seeds[i], age = t - p.born;
      if (age > p.life) { seeds.splice(i, 1); continue; }
      p.vx += Math.sin(t * 0.7 + p.ph) * dt * 8; p.vy += Math.cos(t * 0.9 + p.ph) * dt * 5 - push * dt * 400;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const a = Math.min(1, age * 2) * (1 - age / p.life);
      dx.fillStyle = 'rgba(24,58,30,' + (a * 0.35).toFixed(3) + ')'; dx.fillText(p.ch, p.x + 1, p.y + 1);
      dx.fillStyle = 'rgba(255,255,250,' + a.toFixed(3) + ')'; dx.fillText(p.ch, p.x, p.y);
    }
  }

  /* ---- moving: the scroll is yours; it settles on a scene when you let go ---- */
  let dragging = null, lastWheel = 0, rest = 0, gesture = false;
  function seen() { if (!moved && target > 0.3) { moved = true; hint.classList.remove('on'); } }
  function nudge(dv) { if (!started) return; if (!gesture || clock() - lastWheel > 0.2) { gesture = true; rest = Math.round(pos); } target = Math.max(0, target + dv); lastWheel = clock(); seen(); }
  if ('ontouchstart' in window) hint.querySelector('span').textContent = 'swipe';
  window.addEventListener('wheel', function (e) {
    e.preventDefault();
    const d = (e.deltaMode === 1 ? 33 : 1) * (e.deltaY + e.deltaX * 0.5);
    nudge(Math.max(-0.6, Math.min(0.6, d / 650)));
  }, { passive: false });
  window.addEventListener('keydown', function (e) {
    if (!started) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); begin(); } return; }
    if (e.key === 'Escape') { tapes.hidden = true; return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); nudge(Math.round(target) + 1 - target); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); nudge(Math.round(target) - 1 - target); return; }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && /\S/.test(e.key)) plant(rand(0.12, 0.88) * window.innerWidth, rand(0.5, 0.95) * window.innerHeight, e.key, false);
  });

  /* ---- touching: drag to move, tap to grow, hold to close your eyes ---- */
  const sun = new THREE.Vector2(0.72, 0.78), sunT = new THREE.Vector2(0.72, 0.78);
  let holdTimer = 0, holding = false, mouse = false, flash = 0;
  function isUI(el) { return el && el.closest && el.closest('a, button, .tapes, .lids'); }
  view.addEventListener('pointerdown', function (e) {
    if (!started) return;
    const now = clock();
    dragging = { x: e.clientX, y: e.clientY, from: target, lastY: e.clientY, lastT: now, v: 0, moved: false };
    gesture = true; rest = Math.round(pos);
    clearTimeout(holdTimer);
    holdTimer = setTimeout(function () { if (dragging && !dragging.moved) holding = true; }, 420);
  });
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') { mouse = true; sunT.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight); }
    if (!dragging || holding) return;
    const dy = dragging.y - e.clientY;
    if (!dragging.moved && Math.hypot(e.clientX - dragging.x, dy) > 10) { dragging.moved = true; clearTimeout(holdTimer); }
    if (dragging.moved) {
      const now = clock(), span = window.innerHeight * 0.55;
      dragging.v = lerp(dragging.v, (dragging.lastY - e.clientY) / span / Math.max(0.008, now - dragging.lastT), 0.4);
      dragging.lastY = e.clientY; dragging.lastT = now;
      target = Math.max(0, dragging.from + dy / span);
      seen();
    }
  }, { passive: true });
  window.addEventListener('pointerup', function (e) {
    clearTimeout(holdTimer);
    if (!dragging) return;
    if (holding) { holding = false; flash = 0.8; }
    else if (dragging.moved) { target = Math.max(0, target + dragging.v * 0.22); lastWheel = 0; }
    else if (!isUI(e.target)) plant(e.clientX, e.clientY, null, false);
    dragging = null;
  });
  window.addEventListener('pointercancel', function () { clearTimeout(holdTimer); holding = false; dragging = null; });
  view.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  view.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  /* ---- the eye's own life ---- */
  let closed = 0, angle = rand(0, Math.PI), angleV = rand(-0.05, 0.05);
  let blinkT0 = -1, nextBlink = rand(20, 40), twice = false, focusT0 = -1, nextFocus = rand(30, 50);
  let blindT0 = -1, blindPlanted = false, blindFor = -1, lastHalf = '', lastNear = -1, holdAt = -1;

  if (/[?&]debug\b/.test(location.search)) {
    window.__garden = {
      begin: begin, go: function (i) { target = i; pos = i; vel = 0; }, to: function (i) { target = i; }, pos: function () { return pos; },
      scene: function (i) { return get(i); }, freeze: function (k) { holdAt = k; },
      find: function (kind, from) { for (let i = from || 0; i < 400; i++) if (get(i).kind === kind) return i; return -1; },
      findTrans: function (tr, from) { for (let i = from || 1; i < 400; i++) if (get(i).trans === tr && get(i).kind === 'photo' && get(i + 1).kind === 'photo') return i; return -1; },
      plant: plant, blink: function () { nextBlink = 0; }
    };
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = clock();
    if (!started) return;

    // the scroll: once you stop, it settles on a scene - the next one, if you meant to go on at all
    if (!dragging && t - lastWheel > 0.16) {
      let goal = Math.round(target);
      if (gesture) { const d = target - rest; if (d > 0.12 && goal <= rest) goal = rest + 1; if (d < -0.12 && goal >= rest) goal = rest - 1; }
      goal = Math.max(0, goal);
      target += (goal - target) * (1 - Math.exp(-dt * 9));
      if (Math.abs(goal - target) < 0.002) { target = goal; gesture = false; }
    }
    if (holdAt >= 0) { target = holdAt; pos = holdAt; vel = 0; }
    const i0 = Math.floor(pos);
    if (!(source(get(i0 + 1)).ready && source(get(i0)).ready) && target > i0 + 0.15) target = i0 + 0.15;   // wait for it to load
    if (holdAt < 0) { const k = 110, c = 2 * Math.sqrt(k); vel += ((target - pos) * k - vel * c) * dt; pos += vel * dt; }
    if (pos < 0) { pos = 0; vel = 0; }
    for (let i = Math.max(0, i0 - 1); i <= i0 + 3; i++) source(get(i));
    prune();

    const ia = Math.floor(pos), A = get(ia), B = get(ia + 1), frac = pos - ia;
    const p = smooth((frac - 0.1) / 0.8), tri = 1 - Math.abs(2 * p - 1);
    const sa = source(A), sb = source(B), aspect = window.innerWidth / window.innerHeight;
    if (sa.world) { sa.world.size(aspect); sa.world.draw(t); sa.w = sa.world.w; sa.h = sa.world.h; }
    if (sb.world && p > 0) { sb.world.size(aspect); sb.world.draw(t); sb.w = sb.world.w; sb.h = sb.world.h; }
    if (sa.ready) { C.tA.value = sa.tex; fit(A, sa, frac, t, C.uFitA.value); C.uPixA.value = sa.pix; C.uResA.value.set(sa.w, sa.h); C.uGradeA.value.fromArray(A.grade); }
    if (sb.ready) { C.tB.value = sb.tex; fit(B, sb, frac - 1, t, C.uFitB.value); C.uPixB.value = sb.pix; C.uResB.value.set(sb.w, sb.h); C.uGradeB.value.fromArray(B.grade); }
    let trans = TRANSITIONS.indexOf(A.trans);
    if (trans === 9 && (sa.pix || sb.pix)) trans = 4;   // letters only from photographs
    C.uP.value = sb.ready ? p : 0; C.uType.value = trans; C.uSeed.value = A.seed; C.uTime.value = t;
    C.uCenter.value.set(trans === 6 ? sun.x : A.center[0], trans === 6 ? sun.y : A.center[1]);

    // a sound where one turns into the next
    const half = ia + ':' + (p > 0.5 ? 1 : 0);
    if (lastHalf && half !== lastHalf && p > 0.02 && p < 0.98) {
      const kk = Math.min(1, Math.abs(vel) * 0.35 + 0.35), tr = TRANSITIONS[trans];
      if (tr === 'strips' || tr === 'squares' || tr === 'blinds' || tr === 'letters') sound.skip(kk * 0.6);
      else if (tr === 'burn') { sound.thump(kk); sound.whoosh(kk * 0.6, vel > 0); }
      else sound.whoosh(kk, vel > 0);
    }
    lastHalf = half;
    const near = Math.round(pos);
    if (near !== lastNear) { lastNear = near; if (get(near).kind === 'page') sound.bell(); }

    // the eye: the smear turns; the faster you go the more it tears
    angleV += (Math.random() - 0.5) * dt * 0.02; angleV = Math.max(-0.07, Math.min(0.07, angleV));
    angle += angleV * dt * (reduced ? 0.3 : 1);
    let focus = 1;
    if (!reduced && focusT0 < 0 && t - openedAt > nextFocus) { focusT0 = t; nextFocus = t - openedAt + rand(35, 60); }
    if (focusT0 >= 0) { const f = t - focusT0; focus = 1 - 0.72 * (f < 1.6 ? smooth(f / 1.6) : f < 4.2 ? 1 : 1 - smooth((f - 4.2) / 1.8)); if (f > 6) focusT0 = -1; }
    O.uAngle.value = angle;
    O.uAstig.value = (1.0 + 0.35 * Math.sin(t * 0.21) + 0.15 * Math.sin(t * 0.67)) * focus * (1 - tri * 0.55);
    O.uGhost.value = 0.55 + 0.35 * Math.sin(t * 0.13 + 1);
    O.uGhostDir.value.set(Math.cos(t * 0.05) * 0.008, Math.sin(t * 0.07) * 0.005);
    O.uVel.value = reduced ? 0 : Math.max(-2.5, Math.min(2.5, vel * 0.32));
    if (!mouse) sunT.set(0.5 + Math.sin(t * 0.031) * 0.38, 0.62 + Math.sin(t * 0.047) * 0.3);
    sun.lerp(sunT, 1 - Math.exp(-dt * (mouse ? 1.5 : 0.5)));
    O.uSun.value.copy(sun);
    O.uStreak.value = 1.0 + 0.4 * Math.sin(t * 0.17) + tri * 0.6;
    O.uLeak.value = 0.5 + 0.5 * Math.sin(t * 0.09);
    O.uTape.value += ((A.tape ? 1 - p : 0) + (B.tape ? p : 0) - O.uTape.value) * (1 - Math.exp(-dt * 6));
    const date = O.uTape.value > 0.4 ? (p > 0.5 ? B.date : A.date) || '' : '';
    if (stamp.textContent !== date) stamp.textContent = date;
    stamp.classList.toggle('on', O.uTape.value > 0.4);

    // arriving at a sunny scene: the sun swells, everything goes white, a flower is left behind
    if (!reduced && get(near).sun && Math.abs(pos - near) < 0.06 && blindFor !== near && blindT0 < 0) { blindT0 = t; blindPlanted = false; blindFor = near; }
    let blind = 0, expose = 1.55 + 0.25 * Math.sin(t * 0.3);
    if (blindT0 >= 0) {
      const b = t - blindT0, kb = b < 1.8 ? smooth(b / 1.8) : b < 3.0 ? 1 : 1 - smooth((b - 3.0) / 2.0);
      blind = kb * 0.9; expose *= 1 + kb * 2.2;
      if (b > 1.6 && !blindPlanted) { blindPlanted = true; plant(window.innerWidth * rand(0.35, 0.65), window.innerHeight * rand(0.62, 0.8), null, true); }
      if (b > 5 || Math.abs(pos - blindFor) > 0.4) blindT0 = -1;
    }
    const opening = 1 - smooth((t - openedAt) / 3.5);
    flash = Math.max(0, flash - dt * 0.9);
    O.uBlind.value = Math.min(1, Math.max(blind, opening * 0.95, flash));
    O.uExpose.value = expose * (1 + opening * 1.5) * (1 + tri * 0.25);
    O.uSunAmt.value = 0.55 + 0.25 * Math.sin(t * 0.23) + blind * 0.6;

    // blinking, and the eyes held shut
    let lid = 0;
    if (!reduced && blinkT0 < 0 && t - openedAt > nextBlink) { blinkT0 = t; twice = Math.random() < 0.3; nextBlink = t - openedAt + rand(25, 55); }
    if (blinkT0 >= 0) {
      const b = t - blinkT0, one = function (x) { return x < 0 ? 0 : x < 0.16 ? smooth(x / 0.16) : x < 0.3 ? 1 : x < 0.62 ? 1 - smooth((x - 0.3) / 0.32) : 0; };
      lid = Math.max(one(b), twice ? one(b - 0.75) : 0);
      if (b > (twice ? 1.5 : 0.8)) blinkT0 = -1;
    }
    closed += ((holding ? 1 : 0) - closed) * (1 - Math.exp(-dt * 5));
    O.uClosed.value = Math.max(closed, lid);

    // letters: a scene remembered as letters, or the letters a scene passes through
    let lk = '', la = 0, ls = null, lf = null, dim = 0;
    [A, B].forEach(function (s, j) {
      if (s.kind !== 'ascii') return;
      const w = 1 - smooth(Math.abs(pos - s.i) / 0.7);
      if (w > la) { la = w; lk = 'a' + s.i; ls = j ? sb : sa; lf = j ? C.uFitB.value : C.uFitA.value; }
      dim = Math.max(dim, w * 0.86);
    });
    if (trans === 9 && p > 0 && p < 1) {
      const w = smooth(tri * 1.8);
      if (w > la) { la = w; lk = 't' + ia + (p < 0.5 ? 'a' : 'b'); ls = p < 0.5 ? sa : sb; lf = p < 0.5 ? C.uFitA.value : C.uFitB.value; }
    }
    if (la > 0.01 && ls && ls.img) {
      const live = lk[0] === 'a' && t - letterPainted > 0.2;
      if (lk !== letterKey || live) {
        letters.paint(ls.img, cropOf(ls, lf), window.innerWidth, window.innerHeight, window.innerWidth < 700 ? 10 : 13, lk === letterKey ? 0.05 : 0);
        letterKey = lk; letterPainted = t;
      }
    }
    lettersCan.style.opacity = la.toFixed(3);
    if (la <= 0.01 && letterKey) { letters.clear(); letterKey = ''; }
    O.uDim.value = dim;
    O.uTime.value = t;

    // words and pages follow the scroll
    type.update(pos, t, get);
    const covered = pages.update(pos, t, get);
    if (!covered) eye.render();

    // flowers, and their seeds, blown about by how fast you go
    for (let i = blooms.length - 1; i >= 0; i--) {
      const b = blooms[i];
      if (!b.shed && t - b.born > b.life) { b.shed = true; shed(b, 1); }
      if (!b.shed && Math.abs(vel) > 3) { b.shed = true; b.life = t - b.born; shed(b, 2); }
      if (!b.tick(t)) blooms.splice(i, 1);
    }
    drawSeeds(t, dt, Math.max(-3, Math.min(3, vel)) * 0.3);
  }
  requestAnimationFrame(frame);
}
