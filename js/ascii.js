/* ascii.js - flowers made of letters, never the same one twice.
 * A flower is a few shapes (petals, a cup, bells, leaves, a stem) described as distances;
 * every cell of a character grid that lies on an edge gets the character whose stroke runs
 * the way the edge runs there: - | / \ _ . ' and so on. Then it grows in, and falls apart. */

const TAU = Math.PI * 2;
const AX = 0.6;    // a character cell is this wide for each unit of its height (IBM Plex Mono)

export function rng(seed) {
  let s = (seed >>> 0) + 0x9e3779b9;
  s = Math.imul(s ^ (s >>> 16), 0x85ebca6b); s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35); s = (s ^ (s >>> 16)) >>> 0 || 1;
  const f = function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < 5; i++) f();
  return f;
}

/* ---- a flower is first painted, softly, out of sight; then read back as letters ---- */
// the painting is done in white on nothing, a few pixels for every character;
// each character's patch of it decides the letter: how much is painted chooses from a ramp,
// and where a thin line runs through, the letter is the one that runs the same way.
const SX = 6, SY = 10;
const RAMPF = ' .:-=+*%#@';
const KINDS = ['daisy', 'cosmos', 'tulip', 'rose', 'poppy', 'lily', 'dandelion', 'bells', 'fern', 'daisy', 'dandelion', 'cosmos'];

function stemPath(x, bx, by, hx, hy, bend, w) {
  x.save();
  x.lineCap = 'round';
  const g = x.createLinearGradient(0, by, 0, hy);
  g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0.85)');
  x.strokeStyle = g; x.lineWidth = w;
  x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo(bx + bend, (by + hy) / 2, hx, hy); x.stroke();
  x.restore();
}
function stemPoint(bx, by, hx, hy, bend, t) {
  const cx = bx + bend, cy = (by + hy) / 2, u = 1 - t;
  return { x: u * u * bx + 2 * u * t * cx + t * t * hx, y: u * u * by + 2 * u * t * cy + t * t * hy };
}
// a leaf: two curves meeting at a point, a lighter edge and a vein down the middle
function leaf(x, px, py, len, wid, ang, a) {
  x.save(); x.translate(px, py); x.rotate(ang);
  const g = x.createLinearGradient(0, 0, len, 0);
  g.addColorStop(0, 'rgba(255,255,255,' + (a * 0.55) + ')'); g.addColorStop(0.6, 'rgba(255,255,255,' + a + ')'); g.addColorStop(1, 'rgba(255,255,255,' + (a * 0.7) + ')');
  x.fillStyle = g;
  x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(len * 0.3, -wid, len * 0.75, -wid * 0.8, len, 0); x.bezierCurveTo(len * 0.75, wid * 0.8, len * 0.3, wid, 0, 0); x.fill();
  x.globalCompositeOperation = 'destination-out'; x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = Math.max(1, wid * 0.12);
  x.beginPath(); x.moveTo(len * 0.05, 0); x.quadraticCurveTo(len * 0.5, -wid * 0.08, len * 0.92, 0); x.stroke();
  x.restore();
}
// a petal from the centre outwards, brighter at its tip
function petal(x, cx, cy, ang, len, wid, a0, a1, notch) {
  x.save(); x.translate(cx, cy); x.rotate(ang);
  const g = x.createLinearGradient(0, 0, len, 0);
  g.addColorStop(0, 'rgba(255,255,255,' + a0 + ')'); g.addColorStop(1, 'rgba(255,255,255,' + a1 + ')');
  x.fillStyle = g;
  x.beginPath(); x.moveTo(0, 0);
  x.bezierCurveTo(len * 0.3, -wid, len * 0.85, -wid * 1.05, len, -wid * 0.25);
  if (notch) { x.lineTo(len * 0.9, 0); }
  x.lineTo(len, wid * 0.25);
  x.bezierCurveTo(len * 0.85, wid * 1.05, len * 0.3, wid, 0, 0); x.fill();
  x.globalCompositeOperation = 'destination-out'; x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = Math.max(1, wid * 0.1);
  x.beginPath(); x.moveTo(len * 0.15, 0); x.lineTo(len * 0.85, 0); x.stroke();
  x.restore();
}
function dots(x, cx, cy, r, n, size, a, R) {
  x.fillStyle = 'rgba(255,255,255,' + a + ')';
  for (let i = 0; i < n; i++) { const t = Math.sqrt(R()) * r, q = R() * TAU; x.beginPath(); x.arc(cx + Math.cos(q) * t, cy + Math.sin(q) * t, size, 0, TAU); x.fill(); }
}

function paintHead(x, kind, hx, hy, r, R) {
  if (kind === 'daisy' || kind === 'cosmos') {
    const cos = kind === 'cosmos', n = cos ? 8 : 16 + Math.floor(R() * 8), rot = R() * TAU;
    if (!cos) for (let i = 0; i < n; i++) petal(x, hx, hy, rot + (i + 0.5) / n * TAU, r * 0.88, r * 0.11, 0.25, 0.6, false);
    for (let i = 0; i < n; i++) petal(x, hx, hy, rot + i / n * TAU + (R() - 0.5) * 0.08, r * (0.95 + R() * 0.1), r * (cos ? 0.3 : 0.14), cos ? 0.35 : 0.45, 0.95, cos);
    const cr = r * (cos ? 0.2 : 0.26);
    const g = x.createRadialGradient(hx, hy, 0, hx, hy, cr);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0.75)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = 'rgba(0,0,0,1)'; x.beginPath(); x.arc(hx, hy, cr * 1.15, 0, TAU); x.fill();
    x.globalCompositeOperation = 'source-over'; x.fillStyle = g; x.beginPath(); x.arc(hx, hy, cr, 0, TAU); x.fill();
    x.globalCompositeOperation = 'destination-out'; dots(x, hx, hy, cr * 0.9, 26, cr * 0.09, 0.8, R); x.globalCompositeOperation = 'source-over';
  } else if (kind === 'tulip') {
    const w = r * 0.78, h = r * 1.25, by = hy + h * 0.45;
    const cup = function (ox, sk, a) {
      const g = x.createLinearGradient(0, by, 0, by - h);
      g.addColorStop(0, 'rgba(255,255,255,' + (a * 0.55) + ')'); g.addColorStop(1, 'rgba(255,255,255,' + a + ')');
      x.fillStyle = g; x.beginPath();
      x.moveTo(hx + ox, by);
      x.bezierCurveTo(hx + ox - w * 0.62, by - h * 0.15, hx + ox - w * 0.55 + sk, by - h * 0.85, hx + ox - w * 0.12 + sk, by - h);
      x.lineTo(hx + ox + sk * 0.3, by - h * 0.82);
      x.lineTo(hx + ox + w * 0.12 + sk, by - h);
      x.bezierCurveTo(hx + ox + w * 0.55 + sk, by - h * 0.85, hx + ox + w * 0.62, by - h * 0.15, hx + ox, by);
      x.fill();
    };
    cup(-w * 0.28, -w * 0.08, 0.6); cup(w * 0.28, w * 0.08, 0.6); cup(0, 0, 0.95);
    x.globalCompositeOperation = 'destination-out'; x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = Math.max(1, w * 0.04);
    [-0.2, 0.2].forEach(function (k) { x.beginPath(); x.moveTo(hx + w * k * 0.4, by - h * 0.05); x.quadraticCurveTo(hx + w * k, by - h * 0.5, hx + w * k * 1.3, by - h * 0.95); x.stroke(); });
    x.globalCompositeOperation = 'source-over';
  } else if (kind === 'rose') {
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + R() * 0.3; x.fillStyle = 'rgba(255,255,255,0.5)'; x.beginPath(); x.arc(hx + Math.cos(a) * r * 0.45, hy + Math.sin(a) * r * 0.4, r * 0.55, 0, TAU); x.fill(); }
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.arc(hx, hy, r * 0.62, 0, TAU); x.fill();
    x.globalCompositeOperation = 'source-over';
    x.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      const rr = r * (0.62 - k * 0.08), a0 = R() * TAU;
      x.strokeStyle = 'rgba(255,255,255,' + (0.5 + k * 0.07) + ')'; x.lineWidth = Math.max(1.5, r * 0.07);
      x.beginPath(); x.arc(hx + (R() - 0.5) * r * 0.06, hy + (R() - 0.5) * r * 0.06, Math.max(1, rr), a0, a0 + TAU * (0.55 + R() * 0.25)); x.stroke();
    }
  } else if (kind === 'poppy') {
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + R() * 0.4 + 0.3, cx = hx + Math.cos(a) * r * 0.42, cy = hy + Math.sin(a) * r * 0.36;
      x.fillStyle = 'rgba(255,255,255,' + (0.45 + i * 0.1) + ')'; x.beginPath();
      for (let k = 0; k <= 40; k++) { const q = k / 40 * TAU, rr = r * 0.6 * (1 + 0.06 * Math.sin(q * 9 + i)); const px = cx + Math.cos(q) * rr, py = cy + Math.sin(q) * rr * 0.85; k ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.fill();
    }
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = 'rgba(0,0,0,1)'; x.beginPath(); x.arc(hx, hy, r * 0.22, 0, TAU); x.fill();
    x.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(hx, hy); x.lineTo(hx + Math.cos(a) * r * 0.3, hy + Math.sin(a) * r * 0.3); x.stroke(); x.fillStyle = 'rgba(255,255,255,1)'; x.beginPath(); x.arc(hx + Math.cos(a) * r * 0.32, hy + Math.sin(a) * r * 0.32, r * 0.035, 0, TAU); x.fill(); }
    x.fillStyle = 'rgba(255,255,255,0.95)'; x.beginPath(); x.arc(hx, hy, r * 0.1, 0, TAU); x.fill();
  } else if (kind === 'lily') {
    const rot = -Math.PI / 2 + (R() - 0.5) * 0.3;
    for (let i = 0; i < 6; i++) {
      const a = rot + i / 6 * TAU;
      petal(x, hx, hy, a, r * 1.05, r * 0.2, 0.4, 0.95, false);
      x.fillStyle = 'rgba(0,0,0,0.6)'; x.globalCompositeOperation = 'destination-out';
      for (let k = 0; k < 5; k++) { const t = 0.25 + R() * 0.4; x.beginPath(); x.arc(hx + Math.cos(a) * r * t + (R() - 0.5) * r * 0.1, hy + Math.sin(a) * r * t + (R() - 0.5) * r * 0.1, r * 0.025, 0, TAU); x.fill(); }
      x.globalCompositeOperation = 'source-over';
    }
    for (let i = 0; i < 6; i++) {
      const a = rot + (i + 0.5) / 6 * TAU, ex = hx + Math.cos(a) * r * 0.6, ey = hy + Math.sin(a) * r * 0.6 - r * 0.2;
      x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(hx, hy); x.quadraticCurveTo(hx + Math.cos(a) * r * 0.3, hy - r * 0.3, ex, ey); x.stroke();
      x.fillStyle = '#fff'; x.beginPath(); x.ellipse(ex, ey, r * 0.06, r * 0.03, a, 0, TAU); x.fill();
    }
  } else if (kind === 'dandelion') {
    // a clock of seeds: fine rays from a small heart, each with a little parachute
    const n = 150;
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, z = R() * 2 - 1, rr = r * Math.sqrt(1 - z * z * 0.6) * (0.85 + R() * 0.15);
      const ex = hx + Math.cos(a) * rr, ey = hy + Math.sin(a) * rr;
      x.strokeStyle = 'rgba(255,255,255,' + (0.25 + R() * 0.3) + ')'; x.lineWidth = 0.8;
      x.beginPath(); x.moveTo(hx, hy); x.lineTo(ex, ey); x.stroke();
      x.fillStyle = 'rgba(255,255,255,' + (0.5 + R() * 0.5) + ')'; x.beginPath(); x.arc(ex, ey, 1.4 + R() * 1.6, 0, TAU); x.fill();
    }
    x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(hx, hy, r * 0.12, 0, TAU); x.fill();
    // a few already gone, drifting away
    for (let i = 0; i < 7; i++) { const sx = hx + r * (0.9 + R() * 1.4), sy = hy - r * (0.2 + R() * 1.2); x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx - 5, sy + 9); x.stroke(); x.beginPath(); x.arc(sx, sy, 2.4, 0, TAU); x.fill(); }
  }
}

export function makeFlower(seed, opts) {
  opts = opts || {};
  const R = rng(seed);
  const kind = opts.kind || KINDS[Math.floor(R() * KINDS.length)];
  const rows = Math.max(10, Math.round(opts.size || (22 + R() * 12)));
  const cols = Math.round(rows * (kind === 'bells' || kind === 'fern' ? 1.05 : 0.95) / AX);
  const W = cols * SX, H = rows * SY;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  const bx = W * (0.45 + R() * 0.1), by = H + 2, r = Math.min(W * 0.36, H * 0.24);
  let hx = W * (0.4 + R() * 0.2), hy = H * (0.28 + R() * 0.06);
  const bend = (R() - 0.5) * W * 0.4;
  if (kind === 'bells') {
    // an arch with bells hanging from it, and one broad leaf behind
    leaf(x, bx, H * 0.98, H * 0.75, W * 0.14, -Math.PI / 2 - 0.25, 0.45);
    const tx = W * 0.82, ty = H * 0.5;
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = SX * 0.9; x.lineCap = 'round';
    x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo(bx - W * 0.05, H * 0.15, tx, ty); x.stroke();
    const n = 5 + Math.floor(R() * 2);
    for (let i = 0; i < n; i++) {
      const t = 0.42 + i / n * 0.55, u = 1 - t, px = u * u * bx + 2 * u * t * (bx - W * 0.05) + t * t * tx, py = u * u * by + 2 * u * t * (H * 0.15) + t * t * ty;
      const s = H * (0.05 + 0.025 * (1 - i / n)), cy = py + s * 1.6;
      x.lineWidth = 1.2; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + s * 0.4, py + s * 0.5, px, cy - s); x.stroke();
      const g = x.createLinearGradient(0, cy - s, 0, cy + s);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0.55)');
      x.fillStyle = g; x.beginPath();
      x.moveTo(px - s * 0.6, cy - s * 0.3); x.quadraticCurveTo(px - s * 0.7, cy - s * 1.1, px, cy - s * 1.05); x.quadraticCurveTo(px + s * 0.7, cy - s * 1.1, px + s * 0.6, cy - s * 0.3);
      for (let k = 0; k <= 6; k++) { const q = k / 6; x.lineTo(px + s * (0.75 - q * 1.5), cy + s * (k % 2 ? 0.55 : 0.25)); }
      x.closePath(); x.fill();
    }
    hx = W * 0.5; hy = H * 0.4;
  } else if (kind === 'fern') {
    // a frond unrolling: leaflets getting smaller towards the curled tip
    const pts = [];
    for (let i = 0; i <= 60; i++) { const t = i / 60; pts.push({ x: bx + Math.sin(t * 2.2) * W * 0.18 + t * t * W * 0.12, y: by - t * H * 0.88 }); }
    x.strokeStyle = 'rgba(255,255,255,0.75)'; x.lineWidth = SX * 0.7; x.lineCap = 'round';
    x.beginPath(); pts.forEach(function (p, i) { i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y); }); x.stroke();
    for (let i = 4; i < 58; i += 3) {
      const t = i / 60, p = pts[i], q = pts[i + 1], a = Math.atan2(q.y - p.y, q.x - p.x), len = W * 0.26 * (1 - t * 0.85);
      leaf(x, p.x, p.y, len, len * 0.22, a - 1.25, 0.75); leaf(x, p.x, p.y, len, len * 0.22, a + 1.25, 0.75);
    }
    const tip = pts[60];
    x.beginPath(); x.arc(tip.x + 6, tip.y + 6, 8, Math.PI, TAU * 1.1); x.stroke();
    hx = tip.x; hy = tip.y;
  } else {
    // stem, two leaves, and the head
    stemPath(x, bx, by, hx, hy + r * 0.2, bend, SX * 0.95);
    const nl = kind === 'dandelion' ? 1 : 2;
    for (let i = 0; i < nl; i++) {
      const t = 0.18 + i * 0.22 + R() * 0.08, p = stemPoint(bx, by, hx, hy + r * 0.2, bend, t), side = i % 2 ? 1 : -1;
      leaf(x, p.x, p.y, H * (0.22 + R() * 0.08), H * 0.045, side > 0 ? -0.55 - R() * 0.4 : Math.PI + 0.55 + R() * 0.4, 0.7);
    }
    paintHead(x, kind, hx, hy, r, R);
  }
  // read the painting back, one character at a time
  const d = x.getImageData(0, 0, W, H).data, A = function (px, py) { return d[(py * W + px) * 4 + 3] / 255; };
  const rowsOut = [], order = [];
  for (let rr = 0; rr < rows; rr++) {
    let line = '';
    const ord = [];
    for (let cc = 0; cc < cols; cc++) {
      let sum = 0, jxx = 0, jyy = 0, jxy = 0, my = 0;
      for (let yy = 0; yy < SY; yy++) for (let xx = 0; xx < SX; xx++) {
        const px = cc * SX + xx, py = rr * SY + yy, a = A(px, py);
        sum += a; my += a * (yy - SY / 2);
        if (px > 0 && px < W - 1 && py > 0 && py < H - 1) {
          const gx = A(px + 1, py) - A(px - 1, py), gy = A(px, py + 1) - A(px, py - 1);
          jxx += gx * gx; jyy += gy * gy; jxy += gx * gy;
        }
      }
      const v = sum / (SX * SY);
      let ch = ' ';
      if (v > 0.07) {
        const tr = jxx + jyy, coh = tr > 1e-4 ? Math.sqrt((jxx - jyy) * (jxx - jyy) + 4 * jxy * jxy) / tr : 0;
        if (coh > 0.55 && v < 0.5) {
          // a line runs through here: pick the letter that runs the same way
          const ga = 0.5 * Math.atan2(2 * jxy, jxx - jyy), ea = ((ga * 180 / Math.PI + 90) % 180 + 180) % 180;
          if (ea < 22 || ea > 158) ch = my / (sum || 1) > 1.5 ? '_' : '-';
          else if (ea < 68) ch = '\\';
          else if (ea < 112) ch = '|';
          else ch = '/';
        } else ch = RAMPF[Math.min(RAMPF.length - 1, 1 + Math.floor((v - 0.07) / 0.93 * (RAMPF.length - 1)))];
      }
      // the stem grows first, from the ground; then the flower opens from its middle
      const cx = (cc + 0.5) * SX, cy = (rr + 0.5) * SY, dh = Math.hypot(cx - hx, cy - hy) / (r * 1.3);
      if (opts.petal && ch !== ' ' && dh < 1 && R() < 0.4) ch = opts.petal;   // what you typed, grown into it
      line += ch;
      const o = dh < 1 ? 0.45 + dh * 0.5 : Math.max(0, Math.min(0.45, (by - cy) / Math.max(1, by - hy) * 0.45));
      ord.push(ch === ' ' ? -1 : Math.min(1, o + (R() - 0.5) * 0.06));
    }
    rowsOut.push(line); order.push(ord);
  }
  // trim empty columns at the sides and empty rows at the top
  let l = cols, rgt = 0;
  rowsOut.forEach(function (s) { const a = s.search(/\S/); if (a >= 0) { l = Math.min(l, a); rgt = Math.max(rgt, s.replace(/\s+$/, '').length); } });
  let top = 0; while (top < rowsOut.length - 1 && !rowsOut[top].trim()) top++;
  return { rows: rowsOut.slice(top).map(function (s) { return s.slice(l, rgt); }), order: order.slice(top).map(function (o) { return o.slice(l, rgt); }) };
}

/* ---- a flower on the screen: it grows in, stays, and comes apart ---- */
export function bloom(container, f, x, y, sizePx, life) {
  const pre = document.createElement('pre');
  pre.className = 'bloom';
  pre.setAttribute('aria-hidden', 'true');
  pre.style.fontSize = sizePx + 'px';
  container.appendChild(pre);
  const w = f.rows[0] ? f.rows[0].length : 0, h = f.rows.length;
  const left = Math.round(x - w * sizePx * AX / 2), top = Math.round(y - h * sizePx);
  pre.style.left = left + 'px';
  pre.style.top = top + 'px';
  const born = performance.now() / 1000, grow = 2.6, fall = 2.4;
  const noise = f.rows.map(function (s) { return Array.prototype.map.call(s, function () { return Math.random(); }); });
  let last = '';
  return {
    el: pre, x: left, y: top, w: w * sizePx * AX, h: h * sizePx, born: born, life: life,
    // returns false when it has gone
    tick: function (now) {
      const t = now - born;
      if (t > life + fall) { pre.remove(); return false; }
      const g = Math.min(1, t / grow), k = t > life ? (t - life) / fall : 0;
      let out = '';
      for (let r = 0; r < h; r++) {
        const s = f.rows[r], o = f.order[r];
        for (let c = 0; c < s.length; c++) {
          const ch = s[c];
          if (ch === ' ' || o[c] > g) { out += ' '; continue; }
          if (k > 0) { const n = noise[r][c]; out += n < k * 0.6 ? ' ' : n < k ? '.' : ch; continue; }
          out += ch;
        }
        out += '\n';
      }
      if (out !== last) { pre.textContent = out; last = out; }
      return true;
    }
  };
}

/* ---- a picture remembered as letters ---- */
const RAMP = " .'`,:;-~=+*o%#@";
const SHADES = 7;
// letters are cut once from a strip of glyphs in a few greens, then stamped: fast enough to redraw often
export function createLetters(canvas) {
  const ctx = canvas.getContext('2d');
  let atlas = null, apx = 0, adpr = 0, cw = 0;
  const probe = document.createElement('canvas'), px2 = probe.getContext('2d', { willReadFrequently: true });
  function build(px, dpr) {
    apx = px; adpr = dpr; cw = Math.ceil(px * AX * dpr);
    const ch = Math.ceil(px * dpr);
    atlas = document.createElement('canvas'); atlas.width = cw * RAMP.length; atlas.height = ch * SHADES;
    const x = atlas.getContext('2d');
    x.font = '400 ' + (px * dpr) + 'px "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace'; x.textBaseline = 'top';
    for (let s = 0; s < SHADES; s++) {
      const v = s / (SHADES - 1);
      x.fillStyle = 'hsl(' + (112 - v * 30).toFixed(0) + ',' + (62 - v * 42).toFixed(0) + '%,' + (56 + v * 42).toFixed(0) + '%)';
      for (let k = 1; k < RAMP.length; k++) x.fillText(RAMP[k], k * cw, s * ch);
    }
  }
  return {
    // img: an image; crop: the part on screen; W, H: css size; px: cell height; jitter: how many cells flicker
    paint: function (img, crop, W, H, px, jitter) {
      const dpr = canvas.width / W;
      if (!atlas || apx !== px || adpr !== dpr) build(px, dpr);
      const cols = Math.ceil(W / (px * AX)), rows = Math.ceil(H / px);
      probe.width = cols; probe.height = rows;
      px2.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, cols, rows);
      const d = px2.getImageData(0, 0, cols, rows).data;
      let lo = 1, hi = 0;
      const L = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) { const l = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.55 + d[i * 4 + 2] * 0.15) / 255; L[i] = l; if (l < lo) lo = l; if (l > hi) hi = l; }
      const span = Math.max(0.15, hi - lo), ch = Math.ceil(px * adpr), dw = cw / adpr, dh = ch / adpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
        let v = (L[r * cols + q] - lo) / span;
        if (jitter && Math.random() < jitter) v = Math.min(1, v + (Math.random() - 0.3) * 0.5);
        const k = Math.min(RAMP.length - 1, Math.floor(v * RAMP.length));
        if (k <= 0) continue;
        const sh = Math.min(SHADES - 1, Math.floor(v * SHADES));
        ctx.drawImage(atlas, k * cw, sh * ch, cw, ch, Math.round(q * px * AX * adpr), Math.round(r * px * adpr), cw, ch);
      }
      void dw; void dh;
    },
    clear: function () { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  };
}

/* ---- a word written large, out of small letters ---- */
const INK = " .:-=+*#%@";
export function banner(word, rows) {
  const font = 'italic 400 100px "Instrument Serif", Georgia, serif';
  const m = document.createElement('canvas').getContext('2d'); m.font = font;
  const tw = m.measureText(word).width, th = 100;
  const cols = Math.max(8, Math.round(rows * (tw / th) / AX * 1.05));
  const c = document.createElement('canvas'); c.width = cols; c.height = rows;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.font = 'italic 400 ' + (rows * 1.05) + 'px "Instrument Serif", Georgia, serif';
  x.textBaseline = 'middle'; x.fillStyle = '#fff';
  x.save(); x.scale(cols / (tw * rows / th * 1.0 + 1e-3) * 0.97, 1); x.fillText(word, 0, rows * 0.55); x.restore();
  const d = x.getImageData(0, 0, cols, rows).data, out = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let q = 0; q < cols; q++) { const a = d[(r * cols + q) * 4 + 3] / 255; line += INK[Math.min(INK.length - 1, Math.floor(a * INK.length))]; }
    out.push(line.replace(/\s+$/, ''));
  }
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out.join('\n');
}
