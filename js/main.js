/* main.js - a garden seen with eyes that never quite focus. Photographs and a few old
 * low-polygon places drift into one another; the sun is always slightly too bright, and
 * sometimes it whites everything out. Flowers made of letters grow on top, clean and
 * sharp, the only sharp thing there is. Touch, and one grows there. Hold, and your eyes
 * close. Type, and what you type grows. It does not end. */
import * as THREE from '../vendor/three.module.min.js';
import { createDream, cover } from './dream.js?v=2';
import { createWorld, WORLD_NAMES } from './worlds.js?v=2';
import { makeFlower, bloom, picture } from './ascii.js?v=2';
import { createSound } from './sound.js?v=2';

const $ = function (s) { return document.querySelector(s); };
const rand = function (a, b) { return a + Math.random() * (b - a); };
const lerp = function (a, b, t) { return a + (b - a) * t; };
const smooth = function (t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clock = function () { return performance.now() / 1000; };
const FOOTAGE = 57;

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
const wordsEl = $('#words'), stamp = $('#stamp');
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
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const k = a[i]; a[i] = a[j]; a[j] = k; } }
  shuffle(order);
  let oi = 0, wi = Math.floor(Math.random() * WORLD_NAMES.length), sinceWorld = 0;
  const worlds = {};
  function photo(cb) {
    if (oi > 0 && oi % order.length === 0) shuffle(order);
    const n = order[oi++ % order.length];
    loader.load('footage/' + String(n).padStart(2, '0') + '.jpg?v=1', function (t) {
      t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      cb({ tex: t, w: t.image.width, h: t.image.height, pix: 0 });
    }, undefined, function () { cb(null); });
  }
  function world(named) {
    const name = named || WORLD_NAMES[wi++ % WORLD_NAMES.length];
    if (!worlds[name]) worlds[name] = createWorld(name, renderer);
    const w = worlds[name];
    return { tex: w.texture, w: w.w, h: w.h, pix: 1, world: w, born3d: clock() };
  }
  // each picture gets its own slow drift: a zoom in or out, a pan
  function dress(s) {
    s.z0 = rand(1.0, 1.12); s.z1 = s.z0 + rand(-0.1, 0.12); s.px0 = rand(-0.7, 0.7); s.py0 = rand(-0.7, 0.7); s.px1 = s.px0 + rand(-0.5, 0.5); s.py1 = s.py0 + rand(-0.5, 0.5);
    s.born = clock(); s.life = reduced ? rand(18, 26) : rand(10, 17);
    s.hue = Math.random() < 0.25 ? 0 : rand(-0.34, 0.28); s.sat = rand(0.7, 1.18); s.warm = rand(-1, 1);
    s.tape = !s.pix && Math.random() < 0.16 ? 1 : 0;
    if (s.tape) {
      const d = new Date(1996 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28), 6 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60));
      const p2 = function (v) { return String(v).padStart(2, '0'); };
      s.date = p2(d.getMonth() + 1) + '/' + p2(d.getDate()) + '/' + d.getFullYear() + '  ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
    }
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
    b.big = big;
    blooms.push(b);
    if (blooms.length > 6) { const o = blooms.shift(); o.el.remove(); }
  }
  const dust = $('#dust'), dx = dust.getContext('2d'), seeds = [];
  const letters = $('#letters'), lx = letters.getContext('2d');
  function canvases() {
    const r = Math.min(window.devicePixelRatio || 1, 2);
    [dust, letters].forEach(function (c) { c.width = Math.round(window.innerWidth * r); c.height = Math.round(window.innerHeight * r); });
    dx.setTransform(r, 0, 0, r, 0, 0); lx.setTransform(r, 0, 0, r, 0, 0);
  }
  canvases();
  window.addEventListener('resize', canvases);
  const SEEDS = ['*', '+', '.', "'", '*', '`', '+', '.'];
  function shed(b) {
    const n = b.big ? 26 : 10 + Math.floor(Math.random() * 8);
    for (let i = 0; i < n; i++) seeds.push({ x: b.x + Math.random() * b.w, y: b.y + Math.random() * b.h * 0.45, vx: rand(4, 26), vy: rand(-26, -8), ch: SEEDS[(Math.random() * SEEDS.length) | 0], born: clock(), life: rand(6, 11), ph: rand(0, 6.28) });
  }
  let dustDirty = false;
  function drawSeeds(t, dt) {
    if (!seeds.length && !dustDirty) return;
    dx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    dustDirty = seeds.length > 0;
    dx.font = '400 ' + (window.innerWidth < 700 ? 15 : 19) + 'px "IBM Plex Mono", ui-monospace, monospace';
    for (let i = seeds.length - 1; i >= 0; i--) {
      const p = seeds[i], age = t - p.born;
      if (age > p.life) { seeds.splice(i, 1); continue; }
      p.vx += Math.sin(t * 0.7 + p.ph) * dt * 8; p.vy += Math.cos(t * 0.9 + p.ph) * dt * 5;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const a = Math.min(1, age * 2) * (1 - age / p.life);
      dx.fillStyle = 'rgba(24,58,30,' + (a * 0.35).toFixed(3) + ')'; dx.fillText(p.ch, p.x + 1, p.y + 1);
      dx.fillStyle = 'rgba(255,255,250,' + a.toFixed(3) + ')'; dx.fillText(p.ch, p.x, p.y);
    }
  }
  let nextBloom = 3;
  let memT0 = -1, nextMemory = rand(28, 44);
  function remember() {
    if (!A || A.pix || B || !A.tex || !A.tex.image) return false;
    const img = A.tex.image, f = U.uFitA.value, iw = img.width, ih = img.height;
    // the part of the photograph that is on the screen right now (textures are flipped upright)
    const crop = { x: (0.5 - f.x / 2 + f.z) * iw, y: (1 - (0.5 + f.y / 2 + f.w)) * ih, w: f.x * iw, h: f.y * ih };
    picture(lx, img, crop, window.innerWidth, window.innerHeight, window.innerWidth < 700 ? 10 : 13);
    memT0 = clock();
    letters.style.setProperty('--mx', (sun.x * 100).toFixed(1) + '%');
    letters.style.setProperty('--my', ((1 - sun.y) * 100).toFixed(1) + '%');
    return true;
  }

  /* ---- the eye's own drift ---- */
  const sun = new THREE.Vector2(0.72, 0.78), sunT = new THREE.Vector2(0.72, 0.78);
  let mouse = false, closed = 0, holding = false, blindT0 = -1, blindPlanted = false, nextBlind = rand(16, 26), nextWords = rand(18, 30), flash = 0;
  let angle = rand(0, Math.PI), angleV = rand(-0.05, 0.05);
  let blinkT0 = -1, nextBlink = rand(20, 40), twice = false, focusT0 = -1, nextFocus = rand(30, 50);
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
      remember: remember, blink: function () { nextBlink = 0; }, focus: function () { nextFocus = 0; }, tape: function () { if (A) { A.tape = 1; A.date = '11/24/2025  15:09'; } },
      world: function (name) { B = null; A = dress(world(name)); }, plant: plant, seeds: function () { return seeds.length; }, still: function () { nextBlind = 1e9; if (A) A.life = 1e9; }
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
    if (A) {
      const g = function (k) { return B ? lerp(A[k], B[k], mix) : A[k]; };
      U.uHue.value = g('hue'); U.uSat.value = g('sat'); U.uWarm.value = g('warm');
      U.uTape.value += (g('tape') - U.uTape.value) * (1 - Math.exp(-dt * 3));
      const date = U.uTape.value > 0.4 ? (B && mix > 0.5 ? B.date : A.date) || '' : '';
      if (stamp.textContent !== date) stamp.textContent = date;
      stamp.classList.toggle('on', U.uTape.value > 0.4);
    }

    // the eye wanders: the smear turns, the double image slides, the sun moves
    angleV += (Math.random() - 0.5) * dt * 0.02; angleV = Math.max(-0.07, Math.min(0.07, angleV));
    angle += angleV * dt * (reduced ? 0.3 : 1);
    U.uAngle.value = angle;
    // now and then the eye almost finds its focus, and loses it again
    let focus = 1;
    if (started && !reduced && focusT0 < 0 && t - openedAt > nextFocus) { focusT0 = t; nextFocus = t - openedAt + rand(35, 60); }
    if (focusT0 >= 0) { const f = t - focusT0; focus = 1 - 0.72 * (f < 1.6 ? smooth(f / 1.6) : f < 4.2 ? 1 : 1 - smooth((f - 4.2) / 1.8)); if (f > 6) focusT0 = -1; }
    U.uAstig.value = (1.0 + 0.35 * Math.sin(t * 0.21) + 0.15 * Math.sin(t * 0.67)) * focus;
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
    // a blink, sometimes two
    let lid = 0;
    if (started && !reduced && blinkT0 < 0 && t - openedAt > nextBlink) { blinkT0 = t; twice = Math.random() < 0.3; nextBlink = t - openedAt + rand(25, 55); }
    if (blinkT0 >= 0) {
      const b = t - blinkT0, one = function (x) { return x < 0 ? 0 : x < 0.16 ? smooth(x / 0.16) : x < 0.3 ? 1 : x < 0.62 ? 1 - smooth((x - 0.3) / 0.32) : 0; };
      lid = Math.max(one(b), twice ? one(b - 0.75) : 0);
      if (b > (twice ? 1.5 : 0.8)) blinkT0 = -1;
    }
    closed += ((holding ? 1 : 0) - closed) * (1 - Math.exp(-dt * 5));
    U.uClosed.value = Math.max(closed, lid);
    // the picture remembered as letters: it goes dim, the letters come out from where the sun is
    if (started && memT0 < 0 && blindT0 < 0 && t - openedAt > nextMemory) { if (remember()) nextMemory = t - openedAt + rand(45, 80); else nextMemory = t - openedAt + 4; }
    let dim = 0;
    if (memT0 >= 0) {
      const m = t - memT0, k = m < 1.4 ? smooth(m / 1.4) : m < 6.4 ? 1 : 1 - smooth((m - 6.4) / 2);
      dim = k * 0.86;
      letters.style.setProperty('--mr', (smooth(m / 2.6) * 150).toFixed(1) + 'vmax');
      letters.style.opacity = k.toFixed(3);
      if (m > 8.5) { memT0 = -1; letters.style.opacity = '0'; lx.clearRect(0, 0, window.innerWidth, window.innerHeight); }
    }
    U.uDim.value = dim;
    U.uTime.value = t;

    dream.render();

    // flowers grow by themselves too
    if (started && t - openedAt > nextBloom) {
      nextBloom = t - openedAt + rand(4, 9);
      if (blooms.length < 4) plant(window.innerWidth * rand(0.08, 0.92), window.innerHeight * rand(0.45, 0.98), null, false);
    }
    for (let i = blooms.length - 1; i >= 0; i--) {
      const b = blooms[i];
      if (!b.shed && t - b.born > b.life) { b.shed = true; shed(b); }
      if (!b.tick(t)) blooms.splice(i, 1);
    }
    drawSeeds(t, dt);
    if (started && t - openedAt > nextWords) { nextWords = t - openedAt + rand(22, 40); say(WORDS[Math.floor(Math.random() * WORDS.length)]); }
    sound.mood(0.15 + blind * 0.3, t);
  }
  requestAnimationFrame(frame);
}
