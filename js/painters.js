/* painters.js - every plot of the garden is painted here, from one number.
 * The same number always grows the same plot; the next number grows something else.
 * A plot is three sheets of glass: the far one, the middle one, and the one right in
 * front of the lens (painted small and blown up, so it is out of focus). Things that
 * move - glints of sun, a fan, pollen - are drawn fresh every frame in main.js. */

const TAU = Math.PI * 2;
export function rng(seed) {
  // mix the number well first, so plots next to each other are nothing alike
  let s = (seed >>> 0) + 0x9e3779b9;
  s = Math.imul(s ^ (s >>> 16), 0x85ebca6b); s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35); s = (s ^ (s >>> 16)) >>> 0 || 1;
  const f = function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < 6; i++) f();
  return f;
}
const clamp = function (x, a, b) { return Math.min(b, Math.max(a, x)); };
const lerp = function (a, b, t) { return a + (b - a) * t; };

/* ---------- colour: always green, never the same green ---------- */
export function palette(R) {
  const h = lerp(70, 150, R()), s = lerp(26, 62, R()), l = lerp(36, 54, R());
  const p = {
    h: h, s: s, l: l,
    warm: R() < 0.5,                       // late sun, or a cold morning
    haze: lerp(0.2, 0.75, R()),
    skyH: h + lerp(-30, 70, R()), skyS: lerp(8, 45, R()), skyL: lerp(82, 96, R())
  };
  // c(dl, ds, dh, a): a green relative to this plot's green
  p.c = function (dl, ds, dh, a) {
    return 'hsla(' + (h + (dh || 0)).toFixed(1) + ',' + clamp(s + (ds || 0), 0, 100).toFixed(1) + '%,' + clamp(l + (dl || 0), 0, 100).toFixed(1) + '%,' + (a === undefined ? 1 : a) + ')';
  };
  p.sky = function (dl, a) { return 'hsla(' + p.skyH.toFixed(1) + ',' + p.skyS.toFixed(1) + '%,' + clamp(p.skyL + (dl || 0), 0, 100).toFixed(1) + '%,' + (a === undefined ? 1 : a) + ')'; };
  p.sun = p.warm ? 'rgba(255,250,210,' : 'rgba(240,255,235,';
  return p;
}

/* ---------- small things everything is made of ---------- */
function leafPath(x, kind) {
  x.beginPath();
  if (kind === 'maple') {
    // five points round a short stem
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU, r = i % 2 ? 0.45 : 1;
      const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.95;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath();
  } else if (kind === 'ivy') {
    x.moveTo(0, 1);
    x.bezierCurveTo(-1.2, 0.3, -1.1, -0.9, -0.2, -0.6);
    x.lineTo(0, -1);
    x.lineTo(0.2, -0.6);
    x.bezierCurveTo(1.1, -0.9, 1.2, 0.3, 0, 1);
  } else if (kind === 'blade') {
    x.moveTo(-0.12, 1); x.quadraticCurveTo(-0.08, 0, 0, -1); x.quadraticCurveTo(0.08, 0, 0.12, 1); x.closePath();
  } else if (kind === 'long') {
    x.moveTo(0, -1); x.quadraticCurveTo(0.32, 0, 0, 1); x.quadraticCurveTo(-0.32, 0, 0, -1);
  } else {
    x.moveTo(0, -1); x.quadraticCurveTo(0.7, -0.2, 0, 1); x.quadraticCurveTo(-0.7, -0.2, 0, -1);
  }
}
function leaf(x, px, py, size, ang, color, kind, sx) {
  x.save(); x.translate(px, py); x.rotate(ang); x.scale(size * (sx || 1), size);
  leafPath(x, kind); x.fillStyle = color; x.fill();
  x.restore();
}
// a blade of grass rising from (bx, by) to a curved tip
function blade(x, bx, by, h, w, bend, color) {
  x.beginPath();
  x.moveTo(bx - w, by);
  x.quadraticCurveTo(bx - w * 0.4 + bend * 0.4, by - h * 0.55, bx + bend, by - h);
  x.quadraticCurveTo(bx + w * 0.4 + bend * 0.4, by - h * 0.55, bx + w, by);
  x.closePath(); x.fillStyle = color; x.fill();
}
function glow(x, px, py, r, inner, a) {
  const g = x.createRadialGradient(px, py, 0, px, py, r);
  g.addColorStop(0, inner + a + ')'); g.addColorStop(1, inner + '0)');
  x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
}
// paint something small and stretch it up: out of focus, for free
function soft(dst, W, H, k, draw) {
  const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(W / k)); c.height = Math.max(2, Math.round(H / k));
  const x = c.getContext('2d'); x.scale(1 / k, 1 / k); draw(x);
  dst.save(); dst.imageSmoothingEnabled = true; dst.imageSmoothingQuality = 'high'; dst.drawImage(c, 0, 0, W, H); dst.restore();
}
function vgrad(x, W, y0, y1, stops) {
  const g = x.createLinearGradient(0, y0, 0, y1);
  stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
  x.fillStyle = g; x.fillRect(0, y0, W, y1 - y0);
}
function shafts(x, W, H, R, P, n, from) {
  x.save(); x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x0 = from.x + (R() - 0.5) * W * 0.3, ang = Math.atan2(H, W * (R() - 0.3) + (W / 2 - from.x)) ;
    const len = H * 1.6, w0 = 4 + R() * 18, w1 = w0 * (3 + R() * 4);
    const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len, nx = -Math.sin(ang), ny = Math.cos(ang);
    const g = x.createLinearGradient(x0, from.y, x0 + dx, from.y + dy);
    g.addColorStop(0, P.sun + (0.1 + R() * 0.12) + ')'); g.addColorStop(1, P.sun + '0)');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(x0 - nx * w0, from.y - ny * w0); x.lineTo(x0 + nx * w0, from.y + ny * w0);
    x.lineTo(x0 + dx + nx * w1, from.y + dy + ny * w1); x.lineTo(x0 + dx - nx * w1, from.y + dy - ny * w1); x.fill();
  }
  x.restore();
}
// glints: where the sun comes through. main.js makes them twinkle
function glints(list, R, n, area, near, bias) {
  for (let i = 0; i < n; i++) {
    let px, py;
    if (near && R() < (bias || 0.5)) { const a = R() * TAU, r = Math.pow(R(), 1.6) * near.r; px = near.x + Math.cos(a) * r; py = near.y + Math.sin(a) * r; }
    else { px = area.x + R() * area.w; py = area.y + R() * area.h; }
    list.push({ x: px, y: py, s: 0.4 + Math.pow(R(), 3) * 2.4, p: R() * TAU, f: 0.6 + R() * 2.2 });
  }
}

/* ---------- the places ---------- */
const SCENES = {
  // looking straight up through a tree; the sun leaks through everywhere
  canopy: function (L, W, H, R, P, out) {
    const sun = { x: W * lerp(0.08, 0.92, R()), y: H * lerp(0.05, 0.45, R()) };
    vgrad(L.back, W, 0, H, [[0, P.sky(4)], [1, P.sky(-6)]]);
    glow(L.back, sun.x, sun.y, H * 0.9, P.sun, 0.9);
    const kind = R() < 0.6 ? 'maple' : 'oval';
    // far leaves: light, many, small
    for (let i = 0; i < 2600; i++) {
      const px = R() * W, py = R() * H, d = Math.hypot(px - sun.x, py - sun.y) / H;
      if (d < 0.12 && R() < 0.8) continue;
      leaf(L.back, px, py, 4 + R() * 7, R() * TAU, P.c(lerp(8, 26, R()), -10, (R() - 0.5) * 14, 0.85), kind);
    }
    // branches
    L.mid.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      let px = R() < 0.5 ? -10 : W + 10, py = R() * H, a = px < 0 ? -0.3 + R() * 0.6 : Math.PI - 0.3 + R() * 0.6, w = 3 + R() * 6;
      L.mid.strokeStyle = 'hsla(' + (P.h - 50) + ',25%,' + (18 + R() * 10) + '%,0.9)';
      for (let k = 0; k < 18; k++) {
        const nx = px + Math.cos(a) * 26, ny = py + Math.sin(a) * 26;
        L.mid.lineWidth = w; L.mid.beginPath(); L.mid.moveTo(px, py); L.mid.lineTo(nx, ny); L.mid.stroke();
        px = nx; py = ny; a += (R() - 0.5) * 0.5; w *= 0.93;
      }
    }
    for (let i = 0; i < 1500; i++) {
      const px = R() * W, py = R() * H;
      if (Math.hypot(px - sun.x, py - sun.y) < H * 0.1) continue;
      leaf(L.mid, px, py, 8 + R() * 12, R() * TAU, P.c(lerp(-10, 14, R()), 0, (R() - 0.5) * 18, 0.95), kind);
    }
    soft(L.front, W, H, 6, function (x) {
      for (let i = 0; i < 26; i++) leaf(x, R() * W, R() < 0.5 ? R() * H * 0.25 : H - R() * H * 0.25, 40 + R() * 70, R() * TAU, P.c(-22, -5, 0, 0.9), kind);
    });
    glints(out.glints, R, 140, { x: 0, y: 0, w: W, h: H }, { x: sun.x, y: sun.y, r: H * 0.6 }, 0.55);
    out.sun = sun; out.sway = 1;
  },

  // the lens is in the grass; a field goes away under a white sky
  grass: function (L, W, H, R, P, out) {
    const hz = H * lerp(0.28, 0.5, R());
    vgrad(L.back, W, 0, hz, [[0, P.sky(-10)], [1, P.sky(6)]]);
    L.back.fillStyle = P.c(-26, -20, -10); L.back.fillRect(0, hz - 4, W, 6);
    for (let i = 0; i < 40; i++) { L.back.fillStyle = P.c(-24, -18, -10, 0.8); L.back.beginPath(); L.back.ellipse(R() * W, hz - 2, 10 + R() * 40, 3 + R() * 8, 0, Math.PI, TAU); L.back.fill(); }
    vgrad(L.back, W, hz, H, [[0, P.c(-4, -12)], [1, P.c(-14, 5)]]);
    // rows of blades, small far away, big close
    for (let row = 0; row < 26; row++) {
      const t = row / 25, y = lerp(hz + 4, H * 1.05, t * t), hgt = lerp(6, H * 0.7, t * t), n = Math.round(lerp(140, 40, t));
      for (let i = 0; i < n; i++) blade(L.mid, R() * W, y + R() * 10, hgt * (0.5 + R() * 0.8), lerp(0.6, 9, t * t), (R() - 0.5) * hgt * 0.5, P.c(lerp(-16, 16, R()), 0, (R() - 0.5) * 16));
    }
    soft(L.front, W, H, 9, function (x) {
      for (let i = 0; i < 9; i++) blade(x, R() * W, H * 1.1, H * (0.8 + R() * 0.6), 18 + R() * 30, (R() - 0.5) * W * 0.25, P.c(lerp(-18, 4, R()), 4, 0, 0.92));
    });
    glints(out.glints, R, 30, { x: 0, y: hz, w: W, h: H - hz }, null);
    out.fish = R() < 0.6; out.sway = 1.4; out.sun = { x: W * R(), y: hz * 0.4 };
  },

  // a field, mountains, a big sky; it is often seen through a fence
  field: function (L, W, H, R, P, out) {
    const hz = H * lerp(0.36, 0.5, R()), sun = { x: W * lerp(-0.05, 0.3, R()), y: H * lerp(0.05, 0.3, R()) };
    vgrad(L.back, W, 0, hz, [[0, 'hsl(' + (205 + R() * 20) + ',' + (35 + R() * 30) + '%,' + (55 + R() * 15) + '%)'], [1, P.sky(0)]]);
    // clouds: grey masses with bright edges
    for (let i = 0; i < 26; i++) {
      const cx = R() * W, cy = hz * lerp(0.15, 0.8, R()), r = 20 + R() * 60;
      L.back.fillStyle = 'hsla(215,10%,' + (45 + R() * 25) + '%,0.55)'; L.back.beginPath(); L.back.ellipse(cx, cy, r * 2, r * 0.6, 0, 0, TAU); L.back.fill();
      L.back.fillStyle = 'rgba(255,255,250,0.35)'; L.back.beginPath(); L.back.ellipse(cx - r * 0.3, cy - r * 0.3, r * 1.4, r * 0.3, 0, 0, TAU); L.back.fill();
    }
    glow(L.back, sun.x, sun.y, H * 0.8, P.sun, 1);
    // mountains
    L.back.fillStyle = 'hsl(' + (215 + R() * 15) + ',18%,' + (36 + R() * 14) + '%)';
    L.back.beginPath(); L.back.moveTo(0, hz);
    for (let x = 0; x <= W; x += 6) L.back.lineTo(x, hz - 6 - Math.abs(Math.sin(x * 0.011 + 1) * 22 + Math.sin(x * 0.037) * 9 + Math.sin(x * 0.005) * 18));
    L.back.lineTo(W, hz); L.back.fill();
    L.back.fillStyle = P.c(-30, -25, -10); L.back.fillRect(0, hz - 3, W, 5);
    vgrad(L.back, W, hz, H, [[0, P.c(-8, -22)], [1, P.c(-2, -14, -6)]]);
    // mown stripes, then texture
    for (let i = 0; i < 9; i++) { L.back.fillStyle = P.c(R() < 0.5 ? 5 : -5, 0, 0, 0.25); const y = lerp(hz, H, Math.pow(i / 9, 1.6)); L.back.fillRect(0, y, W, (H - hz) * 0.06 * (1 + i * 0.4)); }
    for (let i = 0; i < 9000; i++) { const y = lerp(hz, H, Math.pow(R(), 0.7)), k = (y - hz) / (H - hz); blade(L.mid, R() * W, y, 2 + k * 22, 0.4 + k * 1.6, (R() - 0.5) * k * 10, P.c((R() - 0.5) * 26, -20, (R() - 0.5) * 14, 0.7)); }
    shafts(L.mid, W, H, R, P, 3, sun);
    out.sun = sun; out.stamp = true; out.sway = 0.3;
    glints(out.glints, R, 12, { x: 0, y: hz, w: W, h: H - hz }, { x: sun.x, y: sun.y, r: H * 0.3 }, 0.6);
    if (R() < 0.75) out.objects.push('fence');
  },

  // a light wood: thin trunks going away into the haze, bright ground
  forest: function (L, W, H, R, P, out) {
    const hz = H * lerp(0.5, 0.62, R()), sun = { x: W * lerp(0.3, 0.8, R()), y: -H * 0.05 };
    vgrad(L.back, W, 0, H, [[0, P.sky(6)], [0.55, P.c(30, -20, 0)], [1, P.c(10, 0)]]);
    glow(L.back, sun.x, H * 0.1, H * 1.1, P.sun, 0.9);
    for (let layer = 0; layer < 5; layer++) {
      const far = 1 - layer / 4, x = layer < 3 ? L.back : L.mid;
      for (let i = 0; i < 14 - layer * 2; i++) {
        const tx = R() * W, w = lerp(3, 26, 1 - far) * (0.7 + R() * 0.6), lean = (R() - 0.5) * 0.08, base = hz + (1 - far) * H * 0.3;
        x.fillStyle = 'hsla(' + (P.h - 40) + ',' + (15 + far * 5) + '%,' + lerp(28, 70, far) + '%,' + lerp(1, 0.55, far) + ')';
        x.beginPath(); x.moveTo(tx - w / 2, base); x.lineTo(tx - w * 0.3 + lean * H, -10); x.lineTo(tx + w * 0.3 + lean * H, -10); x.lineTo(tx + w / 2, base); x.fill();
        for (let k = 0; k < 40; k++) leaf(x, tx + lean * H * 0.8 + (R() - 0.5) * 160, R() * H * 0.45, 5 + R() * 10 * (1.4 - far), R() * TAU, P.c(lerp(30, -6, 1 - far) + (R() - 0.5) * 10, -12 * far, 0, lerp(0.95, 0.6, far)), 'oval');
      }
    }
    // the ground, with patches of sun
    vgrad(L.mid, W, hz, H, [[0, P.c(18, -12, 0, 0.0)], [0.3, P.c(10, 0)], [1, P.c(-4, 8)]]);
    for (let i = 0; i < 46; i++) { const y = lerp(hz, H, Math.pow(R(), 0.8)); L.mid.fillStyle = P.c(32, 12, -8, 0.4); L.mid.beginPath(); L.mid.ellipse(R() * W, y, 20 + (y - hz) * 0.6 * R(), 4 + (y - hz) * 0.12, 0, 0, TAU); L.mid.fill(); }
    for (let i = 0; i < 2600; i++) { const y = lerp(hz, H, Math.pow(R(), 0.6)), s = 1 + (y - hz) / H * 9; leaf(L.mid, R() * W, y, s, R() * TAU, P.c(lerp(-6, 30, R()), 0, (R() - 0.5) * 20, 0.8), 'oval'); }
    shafts(L.mid, W, H, R, P, 7, sun);
    glints(out.glints, R, 70, { x: 0, y: hz, w: W, h: H - hz }, null);
    out.sun = sun; out.sway = 0.5;
    if (R() < 0.35) out.objects.push('vines');
  },

  // a ruined abbey: pointed arches, grass in the nave, sun on the grass
  arches: function (L, W, H, R, P, out) {
    const hz = H * lerp(0.5, 0.6, R()), stone = 'hsl(' + (52 + R() * 20) + ',' + (14 + R() * 18) + '%,';
    vgrad(L.back, W, 0, hz, [[0, P.sky(2)], [1, P.sky(8)]]);
    L.back.fillStyle = 'hsl(' + (200 + R() * 30) + ',20%,62%)'; L.back.beginPath(); L.back.moveTo(0, hz);
    for (let x = 0; x <= W; x += 8) L.back.lineTo(x, hz - 14 - Math.sin(x * 0.01 + R()) * 12); L.back.lineTo(W, hz); L.back.fill();
    vgrad(L.back, W, hz, H, [[0, P.c(-4, -18)], [1, P.c(-12, -10)]]);
    // the wall far back, with its arches cut out, two storeys
    const n = 3 + Math.floor(R() * 3), wall = L.mid;
    const drawArcade = function (x, top, bottom, n, w, col, light) {
      x.save();
      x.fillStyle = col; x.fillRect(0, top, W, bottom - top);
      x.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < n; i++) {
        const cx = (i + 0.5) * W / n, aw = W / n * w, ah = (bottom - top) * 0.82;
        x.beginPath(); x.moveTo(cx - aw / 2, bottom); x.lineTo(cx - aw / 2, bottom - ah * 0.55);
        x.quadraticCurveTo(cx - aw / 2, bottom - ah, cx, bottom - ah * 1.04); x.quadraticCurveTo(cx + aw / 2, bottom - ah, cx + aw / 2, bottom - ah * 0.55);
        x.lineTo(cx + aw / 2, bottom); x.fill();
      }
      x.restore();
      for (let i = 0; i <= n; i++) {        // columns between, lit on one side
        const cx = i * W / n, cw = W / n * (1 - w) * 0.9;
        const g = x.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
        g.addColorStop(0, stone + (light - 18) + '%)'); g.addColorStop(0.4, stone + light + '%)'); g.addColorStop(1, stone + (light - 30) + '%)');
        x.fillStyle = g; x.fillRect(cx - cw / 2, top, cw, bottom - top);
      }
      for (let k = 0; k < 600; k++) { x.fillStyle = 'rgba(40,50,30,' + (R() * 0.08) + ')'; x.fillRect(R() * W, top + R() * (bottom - top), 2 + R() * 6, 1 + R() * 3); }
    };
    drawArcade(L.back, H * 0.02, hz, n + 2, 0.66, stone + '68%)', 74);
    // the near arcade, bigger and darker, on the middle sheet
    drawArcade(wall, -H * 0.1, H * 0.92, n, 0.72, stone + '52%)', 64);
    // grass in the nave with pools of sun and shadow
    vgrad(wall, W, H * 0.86, H, [[0, P.c(-6)], [1, P.c(-14)]]);
    for (let i = 0; i < 20; i++) { wall.fillStyle = P.c(26, 20, -12, 0.55); wall.beginPath(); wall.ellipse(R() * W, lerp(hz + 6, H, R()), 30 + R() * 60, 6 + R() * 12, 0, 0, TAU); wall.fill(); }
    for (let i = 0; i < 1600; i++) { const y = lerp(H * 0.86, H, R()); blade(wall, R() * W, y, 3 + (y - H * 0.8) * 0.08, 0.8, (R() - 0.5) * 3, P.c((R() - 0.5) * 22)); }
    soft(L.front, W, H, 5, function (x) {
      const cx = R() < 0.5 ? W * 0.04 : W * 0.96, cw = W * 0.12;
      const g = x.createLinearGradient(cx - cw, 0, cx + cw, 0);
      g.addColorStop(0, stone + '34%)'); g.addColorStop(0.5, stone + '58%)'); g.addColorStop(1, stone + '30%)');
      x.fillStyle = g; x.fillRect(cx - cw / 2, 0, cw, H);
    });
    out.sun = { x: W * R(), y: -H * 0.1 }; out.sway = 0.15;
    glints(out.glints, R, 10, { x: 0, y: hz, w: W, h: H - hz }, null);
    if (R() < 0.3) out.objects.push('vines');
  },

  // dark bamboo with a few leaves burning white-green in a hole of sun
  bamboo: function (L, W, H, R, P, out) {
    L.back.fillStyle = P.c(-34, -10); L.back.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) leaf(L.back, R() * W, R() * H, 4 + R() * 12, R() * TAU, P.c(lerp(-34, -14, R()), 0, 0, 0.8), 'long', 0.6);
    const hot = { x: W * lerp(0.3, 0.7, R()), y: H * lerp(0.3, 0.6, R()) };
    glow(L.back, hot.x, hot.y, H * 0.5, 'rgba(210,255,140,', 0.35);
    for (let i = 0; i < 7; i++) {
      const x0 = R() * W, lean = (R() - 0.5) * 0.25, w = 6 + R() * 10;
      L.mid.strokeStyle = P.c(-24, -10, 0, 0.9); L.mid.lineWidth = w;
      L.mid.beginPath(); L.mid.moveTo(x0, H + 10); L.mid.lineTo(x0 + lean * H, -10); L.mid.stroke();
      for (let k = 0; k < 9; k++) { const t = k / 9; L.mid.fillStyle = P.c(-34, 0, 0, 0.9); L.mid.fillRect(x0 + lean * H * (1 - t) - w / 2 - 1, -10 + (H + 20) * t, w + 2, 2); }
    }
    for (let i = 0; i < 260; i++) {
      const px = R() * W, py = R() * H, d = Math.hypot(px - hot.x, py - hot.y) / H;
      const lit = clamp(1 - d * 2.2, 0, 1);
      leaf(L.mid, px, py, 8 + R() * 16, -0.5 + (R() - 0.5) * 1.5, lit > 0.3 ? 'hsla(' + (P.h - 20) + ',90%,' + lerp(55, 86, lit) + '%,0.95)' : P.c(lerp(-26, -8, R())), 'long', 0.55);
    }
    soft(L.front, W, H, 7, function (x) {
      const g = x.createLinearGradient(0, 0, W * 0.2, 0);
      g.addColorStop(0, 'hsla(40,30%,40%,0)'); g.addColorStop(0.4, 'hsla(40,30%,48%,0.9)'); g.addColorStop(1, 'hsla(40,30%,30%,0)');
      x.save(); x.translate(W * lerp(0, 0.2, R()), 0); x.rotate(0.15); x.fillStyle = g; x.fillRect(0, -H * 0.2, W * 0.2, H * 1.4); x.restore();
    });
    glints(out.glints, R, 40, { x: 0, y: 0, w: W, h: H }, { x: hot.x, y: hot.y, r: H * 0.3 }, 0.8);
    out.sun = hot; out.sway = 0.7; out.dark = true;
  },

  // an old keyboard with cress growing out of it
  keyboard: function (L, W, H, R, P, out) {
    const x = L.back, tilt = lerp(-0.18, -0.05, R()), key = H * lerp(0.17, 0.24, R());
    x.fillStyle = 'hsl(' + (P.h - 30) + ',8%,' + (30 + R() * 10) + '%)'; x.fillRect(0, 0, W, H);
    const rows = ['1234567890-=', 'QWERTYUIOP[]', 'ASDFGHJKL;\'', 'ZXCVBNM,./'], cap = 'hsl(' + (60 + R() * 40) + ',' + (6 + R() * 10) + '%,';
    const keys = {};
    x.save(); x.translate(W * 0.5, H * 0.5); x.rotate(tilt); x.translate(-W * 0.62, -H * 0.62);
    for (let r = -1; r < 6; r++) {
      const row = rows[(r + 4) % 4], off = ((r + 4) % 4) * key * 0.28;
      for (let i = -1; i < 16; i++) {
        const kx = off + i * key * 1.05, ky = r * key * 1.05;
        x.fillStyle = cap + '74%)'; x.fillRect(kx, ky, key * 0.95, key * 0.95);
        x.fillStyle = cap + '86%)'; x.fillRect(kx + key * 0.08, ky + key * 0.06, key * 0.78, key * 0.72);
        const ch = row[(i + 16) % row.length];
        x.fillStyle = 'rgba(60,64,58,0.8)'; x.font = Math.round(key * 0.24) + 'px "IBM Plex Mono", monospace';
        x.fillText(ch, kx + key * 0.18, ky + key * 0.36);
        // where the key ends up on screen, for typing into it
        const m = x.getTransform(), sx = m.a * (kx + key * 0.47) + m.c * (ky + key * 0.4) + m.e, sy = m.b * (kx + key * 0.47) + m.d * (ky + key * 0.4) + m.f;
        if (sx > 0 && sx < W && sy > 0 && sy < H && !keys[ch]) keys[ch.toLowerCase()] = { x: sx, y: sy };
      }
    }
    x.restore();
    // cress in the gaps
    const sprout = function (c, px, py, h, k) {
      const bend = (R() - 0.5) * h * 0.5;
      c.strokeStyle = 'hsla(' + (P.h - 8) + ',40%,' + (62 + R() * 18) + '%,0.95)'; c.lineWidth = 1.1 * k;
      c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + bend * 0.2, py - h * 0.6, px + bend, py - h); c.stroke();
      leaf(c, px + bend - 3 * k, py - h, 3.4 * k, -1.1, P.c(lerp(4, 18, R()), 10), 'oval', 0.8);
      leaf(c, px + bend + 3 * k, py - h, 3.4 * k, 1.1, P.c(lerp(4, 18, R()), 10), 'oval', 0.8);
    };
    for (let i = 0; i < 700; i++) sprout(L.mid, R() * W, R() * H * 1.1, 8 + R() * 26, 1 + R() * 0.6);
    soft(L.front, W, H, 6, function (c) { for (let i = 0; i < 30; i++) sprout(c, R() * W, H * (0.8 + R() * 0.4), 60 + R() * 90, 5 + R() * 4); });
    out.keys = keys; out.sway = 0.6; out.sun = { x: W * 0.2, y: 0 };
    glints(out.glints, R, 8, { x: 0, y: 0, w: W, h: H }, null);
  },

  // a machine on a wall, still humming, being taken by ivy
  machine: function (L, W, H, R, P, out) {
    const x = L.back;
    vgrad(x, W, 0, H, [[0, 'hsl(' + (195 + R() * 20) + ',' + (8 + R() * 12) + '%,72%)'], [1, 'hsl(' + (195 + R() * 20) + ',8%,60%)']]);
    for (let i = 0; i < 200; i++) { x.fillStyle = 'rgba(70,80,70,' + R() * 0.06 + ')'; x.fillRect(R() * W, R() * H, 4 + R() * 40, 1 + R() * 20); }
    x.fillStyle = 'hsl(200,10%,80%)'; x.fillRect(0, 0, W, H * 0.08);
    const bw = H * lerp(0.62, 0.8, R()), bh = bw * 0.68, bx = W * lerp(0.12, 0.42, R()), by = H * lerp(0.12, 0.25, R());
    const g = x.createLinearGradient(bx, by, bx + bw, by + bh); g.addColorStop(0, '#f2f4f0'); g.addColorStop(1, '#c9cdc6');
    x.fillStyle = g; x.fillRect(bx, by, bw, bh);
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(bx, by + bh, bw, H * 0.02);
    const fc = { x: bx + bh * 0.52, y: by + bh * 0.5, r: bh * 0.43 };
    x.fillStyle = '#2b2f2c'; x.beginPath(); x.arc(fc.x, fc.y, fc.r, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(230,232,225,0.55)'; x.lineWidth = 1;
    for (let k = 1; k < 9; k++) { x.beginPath(); x.arc(fc.x, fc.y, fc.r * k / 9, 0, TAU); x.stroke(); }
    x.fillStyle = 'rgba(80,90,80,0.7)'; x.font = Math.round(bh * 0.12) + 'px "IBM Plex Mono", monospace';
    x.fillText('aerō', bx + bw * 0.68, by + bh * 0.3);
    x.strokeStyle = '#d9dcd5'; x.lineWidth = 4; x.beginPath(); x.moveTo(bx + bw * 0.2, by + bh); x.bezierCurveTo(bx + bw * 0.2, H, bx - 40, H * 0.9, bx - 80, H + 10); x.stroke();
    // ivy climbing from the right and dropping from the top
    const vine = function (c, px, py, steps, dir, k) {
      let a = dir;
      c.lineWidth = 1.5 * k; c.strokeStyle = 'hsla(' + (P.h - 40) + ',30%,32%,0.9)';
      for (let i = 0; i < steps; i++) {
        const nx = px + Math.cos(a) * 9 * k, ny = py + Math.sin(a) * 9 * k;
        c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
        if (i % 2 === 0) leaf(c, nx + (R() - 0.5) * 10 * k, ny, (7 + R() * 9) * k, a + (R() - 0.5) * 2, P.c(lerp(-14, 16, R()), 0, (R() - 0.5) * 16, 0.97), 'ivy');
        px = nx; py = ny; a += (R() - 0.5) * 0.6;
      }
    };
    for (let i = 0; i < 9; i++) vine(L.mid, W * lerp(0.6, 1.05, R()), H * R(), 30 + R() * 40, Math.PI * (0.6 + R() * 0.8), 1 + R() * 0.5);
    for (let i = 0; i < 6; i++) vine(L.mid, W * R(), -5, 20 + R() * 30, Math.PI / 2 + (R() - 0.5), 1);
    soft(L.front, W, H, 5, function (c) { for (let i = 0; i < 4; i++) vine(c, W * (0.7 + R() * 0.4), H * R(), 14, Math.PI * (0.5 + R()), 3); });
    out.fan = fc; out.sway = 0.8; out.sun = { x: W, y: 0 };
    glints(out.glints, R, 6, { x: 0, y: 0, w: W, h: H }, null);
  },

  // an escalator that goes down into the trees
  escalator: function (L, W, H, R, P, out) {
    const x = L.back;
    x.fillStyle = P.c(-20); x.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) leaf(x, R() * W, R() * H, 6 + R() * 14, R() * TAU, P.c(lerp(-24, 14, R()), 0, (R() - 0.5) * 20, 0.9), R() < 0.5 ? 'ivy' : 'oval');
    const m = L.mid, flip = R() < 0.5 ? 1 : -1;
    m.save(); if (flip < 0) { m.translate(W, 0); m.scale(-1, 1); }
    const curve = function (t, o) { return { x: lerp(W * 0.05, W * 0.95, t) + o * 0.3, y: H * 0.18 + o + Math.pow(t, 1.6) * H * 0.5 + Math.sin(t * Math.PI) * -H * 0.1 }; };
    // the steps
    for (let i = 0; i < 60; i++) {
      const t = i / 60, a = curve(t, 40), b = curve(t, 110), w = 3 + t * 6;
      m.fillStyle = i % 2 ? 'rgba(170,175,168,0.9)' : 'rgba(120,126,120,0.9)';
      m.beginPath(); m.moveTo(a.x, a.y); m.lineTo(b.x, b.y); m.lineTo(b.x + w, b.y + w * 0.6); m.lineTo(a.x + w, a.y + w * 0.6); m.fill();
    }
    // glass side, then the two rails
    m.fillStyle = 'rgba(120,150,110,0.35)';
    m.beginPath(); for (let i = 0; i <= 40; i++) { const p = curve(i / 40, 110); i ? m.lineTo(p.x, p.y) : m.moveTo(p.x, p.y); } for (let i = 40; i >= 0; i--) { const p = curve(i / 40, 230); m.lineTo(p.x, p.y); } m.fill();
    [0, 110].forEach(function (o, k) {
      for (let w = 0; w < 3; w++) {
        m.strokeStyle = ['#1e2321', '#9aa3a0', '#f4f6f4'][w]; m.lineWidth = [10, 6, 2][w];
        m.beginPath(); for (let i = 0; i <= 50; i++) { const p = curve(i / 50, o - 6 + w * 2); i ? m.lineTo(p.x, p.y) : m.moveTo(p.x, p.y); } m.stroke();
      }
    });
    m.restore();
    for (let i = 0; i < 160; i++) leaf(L.mid, R() * W, H * lerp(0.55, 1.05, R()), 10 + R() * 14, R() * TAU, P.c(lerp(-10, 16, R()), 4), R() < 0.6 ? 'ivy' : 'maple');
    soft(L.front, W, H, 6, function (c) { for (let i = 0; i < 14; i++) leaf(c, R() * W, H * (0.7 + R() * 0.4), 40 + R() * 50, R() * TAU, P.c(-6, 8, 0, 0.95), 'ivy'); });
    out.sway = 0.6; out.sun = { x: W * 0.5, y: 0 };
    glints(out.glints, R, 30, { x: 0, y: 0, w: W, h: H }, null);
  },

  // an iron gate, curled, with the garden blazing behind it
  gate: function (L, W, H, R, P, out) {
    const sun = { x: W * lerp(0.05, 0.4, R()), y: H * lerp(0, 0.2, R()) };
    soft(L.back, W, H, 8, function (x) {
      x.fillStyle = P.c(-6); x.fillRect(0, 0, W, H);
      for (let i = 0; i < 300; i++) leaf(x, R() * W, R() * H, 12 + R() * 30, R() * TAU, P.c(lerp(-20, 26, R()), 0, (R() - 0.5) * 24, 0.85), 'oval');
      glow(x, sun.x, sun.y, H, P.sun, 1);
    });
    const m = L.mid, iron = 'hsl(' + (20 + R() * 20) + ',' + (10 + R() * 20) + '%,' + (18 + R() * 12) + '%)';
    m.strokeStyle = iron; m.lineCap = 'round';
    const spiral = function (cx, cy, r, dir, turns) {
      m.beginPath();
      for (let i = 0; i <= 60; i++) { const t = i / 60, a = dir * t * turns * TAU, rr = r * (1 - t * 0.85); const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; i ? m.lineTo(px, py) : m.moveTo(px, py); }
      m.stroke();
    };
    const gap = W / lerp(7, 11, R());
    m.lineWidth = 5;
    for (let x = gap / 2; x < W; x += gap) { m.beginPath(); m.moveTo(x, -10); m.lineTo(x, H + 10); m.stroke(); }
    m.lineWidth = 6; m.beginPath(); m.moveTo(0, H * 0.62); m.lineTo(W, H * 0.62); m.stroke();
    m.lineWidth = 4;
    for (let x = gap / 2; x < W; x += gap) for (let k = 0; k < 2; k++) {
      const cy = lerp(H * 0.12, H * 0.48, R()), r = gap * lerp(0.25, 0.45, R()), d = k ? 1 : -1;
      spiral(x + d * r, cy, r, d, 1.4); spiral(x + d * r * 0.7, cy + r * 1.6, r * 0.7, -d, 1.2);
    }
    for (let i = 0; i < 9; i++) {
      let px = R() * W, py = H + 5, a = -Math.PI / 2 + (R() - 0.5);
      m.lineWidth = 1.4; m.strokeStyle = P.c(-20, -10, -20);
      for (let k = 0; k < 40; k++) { const nx = px + Math.cos(a) * 8, ny = py + Math.sin(a) * 8; m.beginPath(); m.moveTo(px, py); m.lineTo(nx, ny); m.stroke(); if (k % 2) leaf(m, nx, ny, 6 + R() * 8, a + (R() - 0.5) * 2, P.c(lerp(-4, 24, R()), 10, 0, 0.95), R() < 0.5 ? 'maple' : 'ivy'); px = nx; py = ny; a += (R() - 0.5) * 0.7; }
    }
    shafts(m, W, H, R, P, 4, sun);
    out.sun = sun; out.sway = 0.4; out.expose = 0.6;
    glints(out.glints, R, 50, { x: 0, y: 0, w: W, h: H }, { x: sun.x, y: sun.y, r: H * 0.5 }, 0.6);
  }
};

// the rare ones
const RARE = {
  // a tree at night made of green dots, one light, wires
  night: function (L, W, H, R, P, out) {
    L.back.fillStyle = '#030805'; L.back.fillRect(0, 0, W, H);
    const cx = W * lerp(0.3, 0.6, R()), cy = H * 0.55, cell = 4;
    for (let y = 0; y < H; y += cell) for (let x = 0; x < W; x += cell) {
      const dx = (x - cx) / (W * 0.32), dy = (y - cy) / (H * 0.42), n = Math.sin(x * 0.05) * Math.cos(y * 0.07) * 0.3 + (R() - 0.5) * 0.5;
      if (dx * dx + dy * dy < 1 + n) { L.mid.fillStyle = 'hsla(' + (100 + R() * 25) + ',70%,' + lerp(18, 62, R() * (1 - dy * 0.5)) + '%,0.95)'; L.mid.fillRect(x, y, cell - 1, cell - 1); }
    }
    L.mid.strokeStyle = 'rgba(120,160,120,0.5)'; L.mid.lineWidth = 1;
    for (let i = 0; i < 4; i++) { L.mid.beginPath(); L.mid.moveTo(W * 0.4 + i * 30, -5); L.mid.lineTo(W + 5, H * 0.6 + i * 40); L.mid.stroke(); }
    out.lamp = { x: cx + W * 0.2, y: cy - H * 0.1 }; out.sway = 0.2; out.dark = true;
  },
  // a cat sits in the grass. nobody drew it. it is made of the letters lying around
  cat: function (L, W, H, R, P, out) {
    SCENES.grass(L, W, H, R, P, out);
    const art = ['   /\\_/\\  ', '  ( o.o ) ', '   > ^ <  ', '  /     \\ ', ' (  | |  )', '  \\_|_|_/ '];
    const sz = Math.round(H * 0.06), x0 = W * lerp(0.2, 0.6, R()), y0 = H * 0.45;
    L.mid.font = sz + 'px "IBM Plex Mono", monospace';
    art.forEach(function (row, i) { L.mid.fillStyle = 'rgba(10,30,12,0.75)'; L.mid.fillText(row, x0 + 2, y0 + i * sz * 1.15 + 2); L.mid.fillStyle = 'rgba(245,255,235,0.95)'; L.mid.fillText(row, x0, y0 + i * sz * 1.15); });
  }
};

/* ---------- things that can appear in any plot ---------- */
const OBJECTS = {
  // a chain-link fence right against the lens
  fence: function (L, W, H, R) {
    soft(L.front, W, H, 2, function (x) {
      const s = H * lerp(0.35, 0.6, R()), ox = R() * s;
      x.lineWidth = 8; x.lineCap = 'round';
      for (let k = -4; k < W / s + 4; k++) for (let d = -1; d <= 1; d += 2) {
        x.strokeStyle = 'rgba(70,72,74,0.9)'; x.beginPath(); x.moveTo(ox + k * s, -10); x.lineTo(ox + k * s + d * (H + 20), H + 10); x.stroke();
        x.strokeStyle = 'rgba(225,230,226,0.55)'; x.lineWidth = 3; x.beginPath(); x.moveTo(ox + k * s - 2, -10); x.lineTo(ox + k * s - 2 + d * (H + 20), H + 10); x.stroke(); x.lineWidth = 8;
      }
    });
  },
  // vines hanging from the top
  vines: function (L, W, H, R, P) {
    for (let i = 0; i < 12; i++) {
      let px = R() * W, py = -5;
      const len = H * lerp(0.2, 0.7, R());
      L.mid.strokeStyle = P.c(-24, -10, -30, 0.8); L.mid.lineWidth = 1.2;
      for (let k = 0; py < len; k++) {
        const nx = px + Math.sin(k * 0.6 + i) * 3, ny = py + 8;
        L.mid.beginPath(); L.mid.moveTo(px, py); L.mid.lineTo(nx, ny); L.mid.stroke();
        if (k % 2) leaf(L.mid, nx + (R() - 0.5) * 8, ny, 5 + R() * 6, Math.PI + (R() - 0.5) * 1.6, P.c(lerp(-6, 22, R()), 6, 0, 0.95), 'ivy');
        px = nx; py = ny;
      }
    }
  }
};

export const SCENE_NAMES = Object.keys(SCENES);
const WEIGHTS = { canopy: 3, grass: 3, field: 3, forest: 3, arches: 2, bamboo: 2, keyboard: 2, machine: 2, escalator: 1.5, gate: 2 };

// plot n: what grows there, in which green, seen through which camera
export function plan(n) {
  const R = rng(n * 7919 + 13);
  let scene;
  const roll = R();
  if (n > 3 && roll < 0.035) scene = 'night';
  else if (n > 3 && roll < 0.06) scene = 'cat';
  else {
    let total = 0; for (const k in WEIGHTS) total += WEIGHTS[k];
    let t = R() * total; scene = 'canopy';
    for (const k in WEIGHTS) { t -= WEIGHTS[k]; if (t <= 0) { scene = k; break; } }
  }
  return { n: n, scene: scene, seed: (n * 2654435761) >>> 0 };
}

// paint a plot into three sheets. variant > 0 keeps the place and changes its colours
export function paint(p, W, H, variant) {
  const R = rng(p.seed), P = palette(rng(p.seed + 101 * (variant || 0)));
  const mk = function () { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const L = { backC: mk(), midC: mk(), frontC: mk() };
  L.back = L.backC.getContext('2d'); L.mid = L.midC.getContext('2d'); L.front = L.frontC.getContext('2d');
  const out = { glints: [], objects: [], sway: 0.5, sun: { x: W / 2, y: 0 }, stamp: false, fish: false, expose: 0, dark: false, keys: null, fan: null, lamp: null, pal: P };
  (SCENES[p.scene] || RARE[p.scene])(L, W, H, R, P, out);
  out.objects.forEach(function (o) { OBJECTS[o](L, W, H, R, P); });
  out.back = L.backC; out.mid = L.midC; out.front = L.frontC;
  return out;
}
