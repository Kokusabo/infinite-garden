/* main.js - the tape. Press play, and the garden goes on: every scroll, swipe or arrow
 * is another plot; a touch changes the colours of the one you are in; holding turns it
 * to letters; typing makes things grow. Left alone, it drifts on by itself.
 * There is no last plot. */
import { plan, paint, rng } from './painters.js?v=1';
import { createLens } from './lens.js?v=1';
import { createSound } from './sound.js?v=1';

const $ = function (s) { return document.querySelector(s); };
const rand = function (a, b) { return a + Math.random() * (b - a); };
const pad = function (n, w) { return String(n).padStart(w, '0'); };
const lerp = function (a, b, t) { return a + (b - a) * t; };
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const html = document.documentElement;
let flash = 0;

/* ---------- sound: on from the first touch, unless turned off before ---------- */
const sound = createSound();
const sndBtn = $('#snd');
let soundWanted = true;
try { soundWanted = localStorage.getItem('garden-sound') !== 'off'; } catch (e) { soundWanted = true; }
function showSound(on) { sndBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); sndBtn.textContent = on ? 'SOUND ON' : 'SOUND OFF'; }
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

/* ---------- the other tapes ---------- */
const tapes = $('#tapes'), eject = $('#eject');
eject.addEventListener('click', function () { const open = tapes.hidden; tapes.hidden = !open; eject.setAttribute('aria-expanded', open ? 'true' : 'false'); });
$('#tapes-close').addEventListener('click', function () { tapes.hidden = true; eject.setAttribute('aria-expanded', 'false'); });

/* ---------- words that come and go ---------- */
const LINES = [
  'nobody waters it.', 'it grew while you were away.', 'the keys stopped answering in spring.',
  'you have been here before. the light was different.', 'every leaf is a different green. count them.',
  'the tape remembers more than you do.', 'some of this is real.', 'the machine is still on. listen.',
  'it does not end. it only changes colour.', 'you fell asleep with the window open.',
  'press play again.', 'there is no last plot.', 'it was greener when you looked away.',
  'recorded over something. you can still see it underneath.', 'the sun is in the wrong place. it does not mind.',
  'stay as long as it takes.'
];
const MODES = ['lens', 'dream', 'vhs', 'digi', 'dream', 'lens', 'vhs', 'ascii'];
const MODE_NAME = { lens: 'AUTO', dream: 'SOFT', vhs: 'SP', digi: 'SUN', ascii: 'TXT' };

/* ---------- start ---------- */
const view = $('#view');
const lens = (function () { try { return createLens(view); } catch (e) { console.error(e); return null; } })();
const deck = $('#deck'), playBtn = $('#play');
let started = false;
function begin() {
  if (started) return;
  started = true;
  sound.start();
  setTimeout(function () { sound.play(); }, 60);
  deck.classList.add('off');
  setTimeout(function () { deck.hidden = true; }, 1200);
  flash = 1;
}
playBtn.addEventListener('click', begin);
deck.addEventListener('pointerdown', function (e) { if (e.target === deck) begin(); });

if (!lens) { html.classList.add('no-gl'); }
else run();

function run() {
  const comp = document.createElement('canvas'), cx = comp.getContext('2d');
  const prevC = document.createElement('canvas'), px = prevC.getContext('2d');
  let W = 0, H = 0;
  function size() {
    const vw = window.innerWidth, vh = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    view.width = Math.round(vw * dpr); view.height = Math.round(vh * dpr);
    const h = vw < 600 ? 520 : 560, w = Math.round(Math.min(1100, Math.max(260, h * vw / vh)));
    const changed = w !== W || h !== H;
    W = w; H = h; comp.width = prevC.width = W; comp.height = prevC.height = H;
    return changed;
  }
  size();

  // a sparkle: a hot dot with thin rays, drawn once and reused
  const spark = document.createElement('canvas'); spark.width = spark.height = 96;
  (function () {
    const x = spark.getContext('2d'), c = 48;
    const g = x.createRadialGradient(c, c, 0, c, c, 22); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.25, 'rgba(255,255,230,0.6)'); g.addColorStop(1, 'rgba(255,255,230,0)');
    x.fillStyle = g; x.fillRect(0, 0, 96, 96);
    x.globalCompositeOperation = 'lighter';
    [[0, 1], [Math.PI / 2, 1], [Math.PI / 4, 0.45], [-Math.PI / 4, 0.45]].forEach(function (r) {
      const gr = x.createLinearGradient(c - 48 * Math.cos(r[0]), c - 48 * Math.sin(r[0]), c + 48 * Math.cos(r[0]), c + 48 * Math.sin(r[0]));
      gr.addColorStop(0, 'rgba(255,255,240,0)'); gr.addColorStop(0.5, 'rgba(255,255,240,' + r[1] + ')'); gr.addColorStop(1, 'rgba(255,255,240,0)');
      x.strokeStyle = gr; x.lineWidth = 1.4; x.beginPath(); x.moveTo(c - 48 * Math.cos(r[0]), c - 48 * Math.sin(r[0])); x.lineTo(c + 48 * Math.cos(r[0]), c + 48 * Math.sin(r[0])); x.stroke();
    });
  })();

  /* ---- the plot you are in ---- */
  let n = Math.max(0, parseInt((location.hash || '').slice(1), 10) || 0), variant = 0;
  let cur = null, mode = 'lens', dateText = '', caption = '', trans = null, lastMove = 0;
  const pollen = [];
  for (let i = 0; i < 60; i++) pollen.push({ x: Math.random(), y: Math.random(), v: rand(0.004, 0.02), p: rand(0, 6.28), s: rand(0.6, 2.2) });
  let sprouts = [];

  function grow(next, nextVariant, kind) {
    if (cur) { px.clearRect(0, 0, W, H); px.drawImage(comp, 0, 0); }
    n = Math.max(0, next); variant = nextVariant || 0;
    const p = plan(n), R = rng(n * 31 + 7 + variant * 1009);
    cur = paint(p, W, H, variant);
    cur.plan = p;
    mode = p.scene === 'night' ? 'lens' : MODES[Math.floor(R() * MODES.length)];
    if (cur.stamp && mode === 'lens' && R() < 0.6) mode = 'digi';
    // the date in the corner: often today, sometimes another day entirely
    const d = R() < 0.55 ? new Date() : new Date(1998 + Math.floor(R() * 28), Math.floor(R() * 12), 1 + Math.floor(R() * 28), Math.floor(R() * 24), Math.floor(R() * 60));
    dateText = pad(d.getMonth() + 1, 2) + '/' + pad(d.getDate(), 2) + '/' + d.getFullYear() + ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2);
    caption = R() < 0.5 ? LINES[Math.floor(R() * LINES.length)] : '';
    sprouts = [];
    trans = cur && kind ? { t0: clock(), kind: kind } : null;
    capEl.classList.remove('on'); capAt = clock() + 1.6;
    try { history.replaceState(null, '', '#' + n); } catch (e) { /* the address stays */ }
  }
  const clock = function () { return performance.now() / 1000; };
  const capEl = $('#caption');
  let capAt = 0;

  /* ---- the camera: settles towards what this plot's mode wants, and wanders ---- */
  const cam = { blur: 0.6, vhs: 0, ascii: 0, expose: 0, fish: 0, bloom: 1, sharp: 0, flash: 0, track: 0, roll: 0, cell: 12, dark: 0, time: 0 };
  let holding = false, asciiUntil = 0, skipUntil = 0, rollV = 0;
  function want(t) {
    const w = { blur: 0, vhs: 0, ascii: 0, expose: 0, bloom: 1, sharp: 0 };
    const breath = 0.5 + 0.5 * Math.sin(t * 0.37 + n);           // focus hunts, slowly
    if (mode === 'lens') { w.sharp = 0.7; w.bloom = 0.9; w.blur = breath > 0.93 ? 0.5 : 0; }
    if (mode === 'dream') { w.blur = lerp(0.15, 0.95, breath); w.bloom = 1.5; w.expose = 0.25; }
    if (mode === 'vhs') { w.vhs = 1; w.blur = 0.2; w.bloom = 0.7; }
    if (mode === 'digi') { w.expose = 0.85; w.sharp = 0.35; w.bloom = 1.6; w.blur = 0.06; }
    if (mode === 'ascii') { w.ascii = 1; w.bloom = 0.5; }
    if (cur && cur.expose) w.expose = Math.max(w.expose, cur.expose);
    if (holding || t < asciiUntil) w.ascii = 1;
    if (t < skipUntil) { w.vhs = 1; w.blur = Math.max(w.blur, 0.3); }
    return w;
  }

  /* ---- drawing one frame of the garden ---- */
  function compose(t, dt) {
    const c = cur, sw = (c.sway || 0.5) * (reduced ? 0.3 : 1);
    cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
    const layer = function (img, amp, ph, zoom) {
      const dx = Math.sin(t * 0.5 + ph) * amp * sw, dy = Math.cos(t * 0.37 + ph) * amp * 0.5 * sw;
      cx.drawImage(img, -W * (zoom - 1) / 2 + dx, -H * (zoom - 1) / 2 + dy, W * zoom, H * zoom);
    };
    layer(c.back, 2, 0, 1.03);
    layer(c.mid, 4, 1.3, 1.04);
    // the fan of the machine, still turning
    if (c.fan) {
      cx.save(); cx.translate(c.fan.x, c.fan.y); cx.rotate(t * 7);
      cx.fillStyle = 'rgba(215,212,190,0.92)';
      for (let i = 0; i < 4; i++) { cx.rotate(Math.PI / 2); cx.beginPath(); cx.ellipse(c.fan.r * 0.45, 0, c.fan.r * 0.42, c.fan.r * 0.2, 0.4, 0, Math.PI * 2); cx.fill(); }
      cx.restore();
      cx.strokeStyle = 'rgba(230,232,225,0.4)'; cx.lineWidth = 1;
      for (let k = 1; k < 9; k++) { cx.beginPath(); cx.arc(c.fan.x, c.fan.y, c.fan.r * k / 9, 0, Math.PI * 2); cx.stroke(); }
    }
    // things typed into the garden, growing
    sprouts.forEach(function (s) {
      const g = Math.min(1, (t - s.t) / 1.4), h = s.h * (1 - Math.pow(1 - g, 3));
      cx.strokeStyle = 'hsla(' + s.hue + ',55%,70%,0.95)'; cx.lineWidth = 1.4;
      cx.beginPath(); cx.moveTo(s.x, s.y); cx.quadraticCurveTo(s.x + s.b * 0.3, s.y - h * 0.6, s.x + s.b * g, s.y - h); cx.stroke();
      if (g > 0.4) {
        const k = (g - 0.4) / 0.6 * 5;
        cx.fillStyle = 'hsla(' + s.hue + ',60%,62%,0.95)';
        cx.beginPath(); cx.ellipse(s.x + s.b * g - k, s.y - h, k, k * 0.5, -0.5, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.ellipse(s.x + s.b * g + k, s.y - h, k, k * 0.5, 0.5, 0, Math.PI * 2); cx.fill();
      }
    });
    layer(c.front, 9, 2.1, 1.08);
    // light: glints that come and go, a lamp, pollen in the air
    cx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < c.glints.length; i++) {
      const g = c.glints[i], tw = Math.pow(0.5 + 0.5 * Math.sin(t * g.f + g.p), 4);
      if (tw < 0.03) continue;
      const s = 18 * g.s * (0.6 + tw * 0.6);
      cx.globalAlpha = tw;
      cx.drawImage(spark, g.x - s, g.y - s, s * 2, s * 2);
    }
    if (c.lamp) { cx.globalAlpha = 0.8 + 0.2 * Math.sin(t * 3); cx.drawImage(spark, c.lamp.x - 60, c.lamp.y - 60, 120, 120); }
    cx.globalAlpha = 1;
    for (let i = 0; i < pollen.length; i++) {
      const p = pollen[i];
      p.y -= p.v * dt * 0.4; p.x += Math.sin(t * 0.6 + p.p) * dt * 0.006;
      if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
      cx.fillStyle = 'rgba(250,255,220,' + (0.25 + 0.25 * Math.sin(t * 2 + p.p)) + ')';
      cx.fillRect(p.x * W, p.y * H, p.s, p.s);
    }
    cx.globalCompositeOperation = 'source-over';
    // the plot before, fading out of this one
    if (trans) {
      const k = (t - trans.t0) / 1.3;
      if (k >= 1) trans = null;
      else {
        cx.globalAlpha = trans.kind === 'cut' ? (k < 0.08 ? 1 : 0) : Math.pow(1 - k, 1.5);
        if (trans.kind === 'skip') { const off = (1 - k) * 40 * Math.sin(k * 30); cx.drawImage(prevC, off, 0); }
        else cx.drawImage(prevC, 0, 0);
        cx.globalAlpha = 1;
      }
    }
  }

  /* ---- what the camera writes on the screen ---- */
  const osdMode = $('#osd-mode'), osdCount = $('#osd-count'), osdDate = $('#osd-date'), osdPlot = $('#osd-plot'), hint = $('#hint');
  const startT = clock();
  let idleSince = clock(), overgrowth = 0;
  const LEAVES = ['ᐝ', '❀', '✿', '⸙', '៵', 'ʚ'];
  function overgrow(s) {
    if (overgrowth <= 0) return s;
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const h = Math.sin(i * 12.9898 + s.length * 78.233) * 43758.5453, r = h - Math.floor(h);
      out += s[i] !== ' ' && r < overgrowth ? LEAVES[Math.floor(r * 997) % LEAVES.length] : s[i];
    }
    return out;
  }
  let osdAt = 0;
  function osd(t) {
    if (t - osdAt < 0.25) return;
    osdAt = t;
    const e = Math.floor(t - startT);
    const blink = Math.floor(t * 2) % 2 === 0;
    osdMode.textContent = overgrow((mode === 'vhs' ? (blink ? '▶ PLAY' : '▶     ') : '▶ PLAY') + '  ' + MODE_NAME[mode]);
    osdCount.textContent = overgrow((mode === 'vhs' ? 'SP ' : 'T ') + Math.floor(e / 3600) + ':' + pad(Math.floor(e / 60) % 60, 2) + ':' + pad(e % 60, 2));
    osdPlot.textContent = overgrow('PLOT ' + pad(n, 5) + (variant ? '.' + variant : ''));
    const showDate = mode === 'vhs' || mode === 'digi' || (cur && cur.stamp);
    osdDate.textContent = showDate ? overgrow(dateText) : '';
    html.classList.toggle('dark-plot', !!(cur && cur.dark));
    if (caption && t > capAt && !capEl.classList.contains('on') && t < capAt + 7) { capEl.textContent = caption; capEl.classList.add('on'); }
    if (capEl.classList.contains('on') && t > capAt + 7) capEl.classList.remove('on');
  }

  /* ---- moving through it ---- */
  let autoNext = clock() + 20;
  function move(d) {
    if (!started) { begin(); return; }
    const t = clock();
    if (t - lastMove < 0.9) return;
    lastMove = t;
    const kinds = ['skip', 'focus', 'focus', 'cut', 'skip'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    if (kind === 'skip') { skipUntil = t + 0.7; rollV = rand(0.8, 2.2) * (Math.random() < 0.5 ? 1 : -1); sound.skip(0.6); }
    if (kind === 'cut') flash = 0.5;
    grow(n + d, 0, kind);
    autoNext = t + 22;
    hint.classList.add('gone');
  }
  function recolour() {
    const t = clock();
    skipUntil = t + 0.35; sound.skip(0.3);
    grow(n, variant + 1, 'focus');
    autoNext = t + 22;
  }
  function touched() { idleSince = clock(); if (overgrowth > 0) overgrowth = 0; }

  let wheelAcc = 0, wheelT = 0;
  window.addEventListener('wheel', function (e) {
    e.preventDefault(); touched();
    const t = clock(); if (t - wheelT > 0.4) wheelAcc = 0; wheelT = t;
    wheelAcc += e.deltaY + e.deltaX;
    if (Math.abs(wheelAcc) > 60) { move(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; }
  }, { passive: false });
  let down = null, holdTimer = 0;
  function isUI(el) { return el && el.closest && el.closest('a, button, .tapes, .deck'); }
  view.addEventListener('pointerdown', function (e) {
    touched();
    if (!started) return;
    down = { x: e.clientX, y: e.clientY, t: clock() };
    clearTimeout(holdTimer);
    holdTimer = setTimeout(function () { holding = true; }, 380);
  });
  window.addEventListener('pointermove', function (e) {
    touched();
    // a finger that travels is swiping, not holding
    if (down && !holding && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) clearTimeout(holdTimer);
  }, { passive: true });
  window.addEventListener('pointerup', function (e) {
    clearTimeout(holdTimer);
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (holding) holding = false;
    else if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) move(dy < 0 ? 1 : -1);
    else if (Math.abs(dx) > 50) move(dx < 0 ? 1 : -1);
    else if (!isUI(e.target)) recolour();
    down = null;
  });
  window.addEventListener('pointercancel', function () { clearTimeout(holdTimer); holding = false; down = null; });
  view.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  view.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  // typing: things grow where you type. some words do more
  let typed = '';
  function sprout(xp, yp) { sprouts.push({ x: xp, y: yp, t: clock(), h: rand(14, 38), b: rand(-8, 8), hue: (cur ? cur.pal.h : 100) + rand(-10, 10) }); if (sprouts.length > 160) sprouts.shift(); }
  window.addEventListener('keydown', function (e) {
    touched();
    if (!started) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); begin(); } return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); move(1); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); move(-1); return; }
    if (e.key === 'Escape') { tapes.hidden = true; return; }
    if (e.key.length !== 1 || e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    const at = cur && cur.keys && cur.keys[k];
    if (at) sprout(at.x + rand(-6, 6), at.y + rand(-4, 4)); else sprout(rand(0.05, 0.95) * W, rand(0.55, 1.0) * H);
    typed = (typed + k).slice(-12);
    if (typed.endsWith('grow')) { typed = ''; for (let i = 0; i < 60; i++) setTimeout(function () { sprout(rand(0, 1) * W, rand(0.3, 1.02) * H); }, i * 30); }
    if (typed.endsWith('rewind')) { typed = ''; let k2 = 0; const back = function () { if (k2++ < 6 && n > 0) { lastMove = 0; move(-1); setTimeout(back, 260); } }; back(); }
  });

  window.addEventListener('resize', function () { if (size() && cur) grow(n, variant, null); });

  // ?debug: handles for looking at things on purpose
  if (/[?&]debug\b/.test(location.search)) {
    window.__garden = {
      go: function (k, v) { lastMove = 0; grow(k, v || 0, null); },
      mode: function (m) { mode = m; }, begin: begin,
      scene: function () { return cur.plan.scene; }, still: function () { autoNext = 1e12; }
    };
  }

  grow(n, 0, null);
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = clock();
    if (started && !reduced && t > autoNext && tapes.hidden) { lastMove = 0; move(1); }
    // left alone long enough, the garden grows over the words on the screen
    if (started && t - idleSince > 40) overgrowth = Math.min(0.6, overgrowth + dt * 0.01);
    // now and then the dream slips: a moment of letters, or the tape catching
    if (started && !reduced && Math.random() < dt * 0.05) { if (Math.random() < 0.5) asciiUntil = t + rand(0.2, 0.6); else { skipUntil = t + rand(0.15, 0.4); rollV = rand(-0.6, 0.6); } }

    compose(t, dt);
    const w = want(t), k = 1 - Math.exp(-dt * 3);
    ['blur', 'vhs', 'expose', 'bloom', 'sharp'].forEach(function (key) { cam[key] += (w[key] - cam[key]) * k; });
    cam.ascii += (w.ascii - cam.ascii) * (1 - Math.exp(-dt * 8));
    if (trans && trans.kind === 'focus') { const tk = (t - trans.t0) / 1.3; cam.blur = Math.max(cam.blur, Math.sin(Math.min(1, tk) * Math.PI) * 1.1); }
    cam.fish = cur && cur.fish ? 1 : 0;
    cam.dark = cur && cur.dark ? 1 : 0;
    cam.track = (cam.track + dt * 0.11) % 1;
    cam.roll = t < skipUntil ? (cam.roll + rollV * dt) % 1 : cam.roll * (1 - Math.min(1, dt * 10));
    flash = Math.max(0, flash - dt * 1.4);
    cam.flash = flash; cam.time = t;
    cam.cell = Math.round((window.innerWidth < 600 ? 10 : 13) * (view.width / window.innerWidth));
    lens.draw(comp, cam);
    osd(t);
    sound.mood(cam.vhs, t);
  }
  requestAnimationFrame(frame);
}
