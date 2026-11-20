/* main.js - a garden seen with eyes that never quite focus. Photographs and a few old
 * low-polygon places drift into one another; the sun is always slightly too bright, and
 * sometimes it whites everything out. Flowers made of letters grow on top, clean and
 * sharp, the only sharp thing there is. Touch, and one grows there. Hold, and your eyes
 * close. Type, and what you type grows. It does not end. */
import * as THREE from '../vendor/three.module.min.js';
import { createDream, cover } from './dream.js?v=1';
import { createWorld, WORLD_NAMES } from './worlds.js?v=1';
import { makeFlower, bloom } from './ascii.js?v=1';
import { createSound } from './sound.js?v=2';

const $ = function (s) { return document.querySelector(s); };
const rand = function (a, b) { return a + Math.random() * (b - a); };
const lerp = function (a, b, t) { return a + (b - a) * t; };
const smooth = function (t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clock = function () { return performance.now() / 1000; };
const FOOTAGE = 28;

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

/* ---------- elsewhere ---------- */
const tapes = $('#tapes'), eject = $('#eject');
eject.addEventListener('click', function () { const open = tapes.hidden; tapes.hidden = !open; eject.setAttribute('aria-expanded', open ? 'true' : 'false'); });

/* ---------- words, now and then ---------- */
const WORDS = [
  'it was brighter than this', 'don\'t look straight at it', 'you never saw it properly. nobody does',
  'it keeps growing while you blink', 'green again', 'somebody planted you here',
  'the light is coming from inside it', 'it was summer the whole time', 'hold still. it is almost in focus',
  'you have been here. you were smaller', 'everything is a little too bright', 'it remembers your hands',
  'one more minute', 'there was a window here', 'the grass grew over the sound'
];
const wordsEl = $('#words');
function say(text) {
  wordsEl.textContent = text;
  wordsEl.style.left = rand(8, 46) + 'vw'; wordsEl.style.top = rand(12, 78) + 'vh';
  wordsEl.classList.add('on');
  setTimeout(function () { wordsEl.classList.remove('on'); }, 5200);
}

/* ---------- opening the eyes ---------- */
const lids = $('#lids'), openBtn = $('#open');
let started = false, openedAt = 1e9;
(function () {
  // a flower on the first screen, before anything
  const f = makeFlower((Math.random() * 1e9) | 0, { kind: 'tulip', size: 15 });
  $('#first').textContent = f.rows.join('\n');
})();
function begin() {
  if (started) return;
  started = true; openedAt = clock();
  sound.start(); setTimeout(function () { sound.play(); }, 80);
  lids.classList.add('off');
  setTimeout(function () { lids.hidden = true; }, 2600);
}
openBtn.addEventListener('click', begin);
lids.addEventListener('pointerdown', function (e) { if (e.target === lids) begin(); });
window.addEventListener('keydown', function (e) { if (!started && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); begin(); } });

/* ---------- the eye ---------- */
const view = $('#view');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas: view, antialias: false, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
if (!renderer) document.documentElement.classList.add('no-gl');
else run();

function run() {
  const dream = createDream(renderer), U = dream.uniforms;
  // nothing here is sharp, so the eye is drawn at a fraction of the screen and stretched
  function size() {
    const scale = Math.min(window.devicePixelRatio || 1, 2) * (window.innerWidth < 700 ? 0.38 : 0.5);
    renderer.setPixelRatio(scale);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    U.uAspect.value.set(window.innerWidth / window.innerHeight, 1);
  }
  size();
  window.addEventListener('resize', size);

  /* ---- what can be seen ---- */
  const loader = new THREE.TextureLoader();
  const order = []; for (let i = 0; i < FOOTAGE; i++) order.push(i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const k = order[i]; order[i] = order[j]; order[j] = k; }
  let oi = 0, wi = Math.floor(Math.random() * WORLD_NAMES.length), sinceWorld = 0;
  const worlds = {};
  function photo(cb) {
    const n = order[oi++ % order.length];
    loader.load('footage/' + String(n).padStart(2, '0') + '.jpg?v=1', function (t) {
      t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      cb({ tex: t, w: t.image.width, h: t.image.height, pix: 0 });
    }, undefined, function () { cb(null); });
  }
  function world() {
    const name = WORLD_NAMES[wi++ % WORLD_NAMES.length];
    if (!worlds[name]) worlds[name] = createWorld(name, renderer);
    const w = worlds[name];
    return { tex: w.texture, w: w.w, h: w.h, pix: 1, world: w, born3d: clock() };
  }
  // each picture gets its own slow drift: a zoom in or out, a pan
  function dress(s) {
    s.z0 = rand(1.0, 1.12); s.z1 = s.z0 + rand(-0.1, 0.12); s.px0 = rand(-0.7, 0.7); s.py0 = rand(-0.7, 0.7); s.px1 = s.px0 + rand(-0.5, 0.5); s.py1 = s.py0 + rand(-0.5, 0.5);
    s.born = clock(); s.life = reduced ? rand(18, 26) : rand(10, 17);
    return s;
  }
  let A = null, B = null, mixT0 = 0, loading = false;
  function next() {
    if (loading || B) return;
    loading = true;
    const want3d = sinceWorld >= 3 && Math.random() < 0.3;
    const got = function (s) {
      loading = false;
      if (!s) return;
      sinceWorld = s.pix ? 0 : sinceWorld + 1;
      dress(s);
      if (!A) { A = s; return; }
      B = s; mixT0 = clock();
      if (sound.isOn() && Math.random() < 0.5) sound.skip(0.15);
    };
    if (want3d) got(world()); else photo(got);
  }
  next();

  /* ---- flowers ---- */
  const garden = $('#garden'), blooms = [];
  function plant(x, y, petal, big) {
    const small = window.innerWidth < 700;
    const sz = big ? (small ? 13 : 20) : (small ? rand(9.5, 12) : rand(13, 18));
    const f = makeFlower((Math.random() * 1e9) | 0, { size: big ? 26 : rand(14, 24), petal: petal });
    const b = bloom(garden, f, x, y, sz, big ? 6 : rand(7, 12));
    if (big) b.el.classList.add('after');
    blooms.push(b);
    if (blooms.length > 6) { const o = blooms.shift(); o.el.remove(); }
  }
  let nextBloom = 3;

  /* ---- the eye's own drift ---- */
  const sun = new THREE.Vector2(0.72, 0.78), sunT = new THREE.Vector2(0.72, 0.78);
  let mouse = false, closed = 0, holding = false, blindT0 = -1, blindPlanted = false, nextBlind = rand(16, 26), nextWords = rand(18, 30), flash = 0;
  let angle = rand(0, Math.PI), angleV = rand(-0.05, 0.05);
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') { mouse = true; sunT.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight); }
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) clearTimeout(holdTimer);
  }, { passive: true });

  /* ---- touching it ---- */
  let down = null, holdTimer = 0, lastNext = 0;
  function isUI(el) { return el && el.closest && el.closest('a, button, .tapes, .lids'); }
  view.addEventListener('pointerdown', function (e) {
    if (!started) return;
    down = { x: e.clientX, y: e.clientY, t: clock() };
    clearTimeout(holdTimer);
    holdTimer = setTimeout(function () { holding = true; }, 420);
  });
  window.addEventListener('pointerup', function (e) {
    clearTimeout(holdTimer);
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (holding) { holding = false; flash = 0.8; }   // opening the eyes again: too bright
    else if (Math.hypot(dx, dy) > 50) drift();
    else if (!isUI(e.target)) plant(e.clientX, e.clientY, null, false);
    down = null;
  });
  window.addEventListener('pointercancel', function () { clearTimeout(holdTimer); holding = false; down = null; });
  view.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  view.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  function drift() { const t = clock(); if (t - lastNext < 2 || !A) return; lastNext = t; A.life = Math.min(A.life, t - A.born); }
  let wheelAcc = 0;
  window.addEventListener('wheel', function (e) { e.preventDefault(); wheelAcc += Math.abs(e.deltaY) + Math.abs(e.deltaX); if (wheelAcc > 120) { wheelAcc = 0; drift(); } }, { passive: false });
  window.addEventListener('keydown', function (e) {
    if (!started) return;
    if (e.key === 'Escape') { tapes.hidden = true; return; }
    if (e.key.startsWith('Arrow') || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); drift(); return; }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && /\S/.test(e.key)) plant(rand(0.12, 0.88) * window.innerWidth, rand(0.5, 0.95) * window.innerHeight, e.key, false);
  });

  if (/[?&]debug\b/.test(location.search)) {
    window.__garden = {
      begin: begin, next: function () { if (A) A.life = 0; }, blind: function () { nextBlind = 0; },
      world: function () { B = null; A = dress(world()); }, plant: plant, still: function () { nextBlind = 1e9; if (A) A.life = 1e9; }
    };
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = clock();
    if (!started) return;   // the eyes are still shut

    // time for the next picture?
    if (A && !B && t - A.born > A.life) next();
    let mix = 0;
    if (B) {
      mix = smooth((t - mixT0) / (reduced ? 6 : 4));
      if (mix >= 1) { if (A && A.pix === 0 && A.tex) A.tex.dispose(); A = B; B = null; mix = 0; }
    }
    const aspect = window.innerWidth / window.innerHeight;
    [A, B].forEach(function (s, k) {
      if (!s) return;
      if (s.world) { s.world.size(aspect); s.world.draw(t - s.born3d); s.w = s.world.w; s.h = s.world.h; }
      const p = Math.min(1, (t - s.born) / Math.max(1, s.life + 4));
      cover(s.w, s.h, aspect, lerp(s.z0, s.z1, p), lerp(s.px0, s.px1, p), lerp(s.py0, s.py1, p), k ? U.uFitB.value : U.uFitA.value);
      (k ? U.tB : U.tA).value = s.tex; (k ? U.uPixB : U.uPixA).value = s.pix; (k ? U.uResB : U.uResA).value.set(s.w, s.h);
    });
    U.uMix.value = mix;

    // the eye wanders: the smear turns, the double image slides, the sun moves
    angleV += (Math.random() - 0.5) * dt * 0.02; angleV = Math.max(-0.07, Math.min(0.07, angleV));
    angle += angleV * dt * (reduced ? 0.3 : 1);
    U.uAngle.value = angle;
    U.uAstig.value = 1.0 + 0.35 * Math.sin(t * 0.21) + 0.15 * Math.sin(t * 0.67);
    U.uGhost.value = 0.55 + 0.35 * Math.sin(t * 0.13 + 1);
    U.uGhostDir.value.set(Math.cos(t * 0.05) * 0.008, Math.sin(t * 0.07) * 0.005);
    if (!mouse) sunT.set(0.5 + Math.sin(t * 0.031) * 0.38, 0.62 + Math.sin(t * 0.047) * 0.3);
    sun.lerp(sunT, 1 - Math.exp(-dt * (mouse ? 1.5 : 0.5)));
    U.uSun.value.copy(sun);
    U.uStreak.value = 1.0 + 0.4 * Math.sin(t * 0.17);
    U.uLeak.value = 0.5 + 0.5 * Math.sin(t * 0.09);
    U.uFlow.value = 1;

    // the sun in the eyes, now and then: it swells, everything goes white, a flower is left
    if (started && !reduced && blindT0 < 0 && t - openedAt > nextBlind) { blindT0 = t; blindPlanted = false; nextBlind = t - openedAt + rand(24, 42); }
    let blind = 0, expose = 1.55 + 0.25 * Math.sin(t * 0.3);
    if (blindT0 >= 0) {
      const b = t - blindT0;
      const k = b < 2.2 ? smooth(b / 2.2) : b < 3.6 ? 1 : 1 - smooth((b - 3.6) / 2.4);
      blind = k * 0.9; expose *= 1 + k * 2.2;
      if (b > 2.0 && !blindPlanted) { blindPlanted = true; plant(window.innerWidth * rand(0.35, 0.65), window.innerHeight * rand(0.62, 0.8), null, true); }
      if (b > 6) blindT0 = -1;
    }
    // the first seconds: the eyes have only just opened
    const opening = started ? 1 - smooth((t - openedAt) / 3.5) : 1;
    flash = Math.max(0, flash - dt * 0.9);
    U.uBlind.value = Math.min(1, Math.max(blind, opening * 0.95, flash));
    U.uExpose.value = expose * (1 + opening * 1.5);
    U.uSunAmt.value = 0.55 + 0.25 * Math.sin(t * 0.23) + blind * 0.6;
    closed += ((holding ? 1 : 0) - closed) * (1 - Math.exp(-dt * 5));
    U.uClosed.value = closed;
    U.uTime.value = t;

    dream.render();

    // flowers grow by themselves too
    if (started && t - openedAt > nextBloom) {
      nextBloom = t - openedAt + rand(4, 9);
      if (blooms.length < 4) plant(window.innerWidth * rand(0.08, 0.92), window.innerHeight * rand(0.45, 0.98), null, false);
    }
    for (let i = blooms.length - 1; i >= 0; i--) if (!blooms[i].tick(t)) blooms.splice(i, 1);
    if (started && t - openedAt > nextWords) { nextWords = t - openedAt + rand(22, 40); say(WORDS[Math.floor(Math.random() * WORDS.length)]); }
    sound.mood(0.15 + blind * 0.3, t);
  }
  requestAnimationFrame(frame);
}
