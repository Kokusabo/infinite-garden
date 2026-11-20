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

/* ---- distances ---- */
function ellipse(px, py, cx, cy, rx, ry, a) {
  const c = Math.cos(a), s = Math.sin(a), x = (px - cx) * c + (py - cy) * s, y = -(px - cx) * s + (py - cy) * c;
  const k = Math.hypot(x / rx, y / ry);
  return (k - 1) * Math.min(rx, ry);
}
function circle(px, py, cx, cy, r) { return Math.hypot(px - cx, py - cy) - r; }
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return [Math.hypot(px - ax - vx * t, py - ay - vy * t), t];
}

// a flower: parts are { d(x, y) -> distance, edge: true for outlines, fill: char or null, order(x, y) -> 0..1 }
export function makeFlower(seed, opts) {
  opts = opts || {};
  const R = rng(seed);
  const kind = opts.kind || ['daisy', 'daisy', 'tulip', 'bells', 'poppy', 'sprig', 'lily', 'star'][Math.floor(R() * 8)];
  const H = Math.round((opts.size || (18 + R() * 14)));       // rows
  const Wd = Math.round(H * (0.9 + R() * 0.5) / AX);         // columns
  const cx = Wd * AX / 2 + (R() - 0.5) * 2, top = H * (0.08 + R() * 0.06);
  const parts = [];
  // the stem: a gentle curve from the ground to the head
  const head = { x: cx + (R() - 0.5) * H * 0.25, y: top + H * (kind === 'bells' ? 0.18 : 0.26) };
  const base = { x: cx + (R() - 0.5) * 2, y: H - 0.6 };
  const bend = (R() - 0.5) * H * 0.35;
  const stemPts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    stemPts.push({ x: base.x + (head.x - base.x) * t + Math.sin(t * Math.PI) * bend * 0.4, y: base.y + (head.y - base.y) * t });
  }
  const stemD = function (x, y) {
    let best = 1e9, bt = 0;
    for (let i = 0; i < stemPts.length - 1; i++) { const r = segDist(x, y, stemPts[i].x, stemPts[i].y, stemPts[i + 1].x, stemPts[i + 1].y); if (r[0] < best) { best = r[0]; bt = (i + r[1]) / (stemPts.length - 1); } }
    return [best, bt];
  };
  parts.push({ g: 'stem', stem: true, d: function (x, y) { return stemD(x, y)[0]; }, order: function (x, y) { return stemD(x, y)[1] * 0.45; } });
  // leaves along the stem
  const nLeaves = kind === 'sprig' ? 4 + Math.floor(R() * 2) : Math.floor(R() * 3);
  for (let i = 0; i < nLeaves; i++) {
    const t = kind === 'sprig' ? 0.12 + i / nLeaves * 0.8 : 0.15 + R() * 0.4, p = stemPts[Math.floor(t * 24)], side = (i % 2 ? 1 : -1) * (R() < 0.85 ? 1 : -1);
    const len = H * (kind === 'sprig' ? 0.14 + R() * 0.06 : 0.16 + R() * 0.08), a = side * (0.5 + R() * 0.5) - Math.PI / 2 * 0;
    const lx = p.x + Math.cos(-Math.PI / 2 + side * (0.9 + R() * 0.4)) * len * 0.55 * (side), ly = p.y - len * 0.25;
    const ang = side > 0 ? -0.5 - R() * 0.4 : 0.5 + R() * 0.4;
    parts.push({ g: 'leaf' + i, d: function (x, y) { return ellipse(x, y, p.x + side * len * 0.5, p.y - len * 0.22, len * 0.5, len * 0.26, ang); }, order: function () { return t * 0.45 + 0.05; } });
    void lx; void ly; void a;
  }
  const hx = head.x, hy = head.y;
  const radial = function (x, y, r) { return 0.45 + Math.min(1, Math.hypot(x - hx, y - hy) / r) * 0.55; };
  if (kind === 'daisy' || kind === 'star') {
    const n = kind === 'star' ? 5 + Math.floor(R() * 2) : 7 + Math.floor(R() * 6), r = H * (0.17 + R() * 0.07), w = r * (kind === 'star' ? 0.3 : 0.22 + R() * 0.1), rot = R() * TAU;
    for (let i = 0; i < n; i++) {
      const a = rot + i / n * TAU;
      parts.push({ g: 'head', d: function (x, y) { return ellipse(x, y, hx + Math.cos(a) * r * 0.62, hy + Math.sin(a) * r * 0.62, r * 0.5, w, a); }, order: function (x, y) { return radial(x, y, r * 1.2); } });
    }
    const cr = r * (0.22 + R() * 0.1);
    parts.push({ fill: R() < 0.5 ? '@' : 'o', solid: true, d: function (x, y) { return circle(x, y, hx, hy, cr); }, order: function () { return 0.45; } });
  } else if (kind === 'tulip' || kind === 'lily') {
    const r = H * (0.16 + R() * 0.06), lily = kind === 'lily';
    const petals = lily ? [[-1.1, 0.9], [-0.4, 0.95], [0.4, 0.95], [1.1, 0.9], [0, 1]] : [[-0.55, 1], [0.55, 1], [0, 1.05]];
    petals.forEach(function (pp) {
      const a = -Math.PI / 2 + pp[0] * (lily ? 0.75 : 0.35);
      parts.push({ g: lily ? 'head' + pp[0] : 'head', d: function (x, y) { return ellipse(x, y, hx + Math.cos(a) * r * 0.55, hy - r * 0.15 + Math.sin(a) * r * 0.55 * pp[1], r * (lily ? 0.62 : 0.52), r * (lily ? 0.2 : 0.34), a); }, order: function (x, y) { return radial(x, y, r * 1.3); } });
    });
    if (lily) parts.push({ fill: "'", solid: true, d: function (x, y) { return circle(x, y, hx, hy - r * 0.1, r * 0.12); }, order: function () { return 0.5; } });
  } else if (kind === 'bells') {
    // bells hanging from an arch
    const n = 3 + Math.floor(R() * 3), r = H * 0.07, span = H * 0.5 / AX * AX;
    const arch = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; arch.push({ x: hx + t * span * 0.9, y: hy - Math.sin(t * Math.PI * 0.9) * H * 0.12 + t * t * H * 0.1 }); }
    parts.push({ g: 'arch', stem: true, d: function (x, y) { let b = 1e9; for (let i = 0; i < 20; i++) b = Math.min(b, segDist(x, y, arch[i].x, arch[i].y, arch[i + 1].x, arch[i + 1].y)[0]); return b; }, order: function (x) { return 0.45 + (x - hx) / span * 0.3; } });
    for (let i = 0; i < n; i++) {
      const p = arch[Math.floor((i + 1) / (n + 1) * 20)], by = p.y + r * 2.2;
      parts.push({ g: 'bell' + i, d: function (x, y) { return Math.max(circle(x, y, p.x, by, r * 1.15), -(y - by - r * 0.35)); }, order: function () { return 0.6 + i / n * 0.35; } });
      parts.push({ g: 'thread' + i, stem: true, d: function (x, y) { return segDist(x, y, p.x, p.y, p.x, by - r)[0]; }, order: function () { return 0.55 + i / n * 0.35; } });
    }
  } else if (kind === 'poppy') {
    const r = H * (0.15 + R() * 0.05), n = 4 + Math.floor(R() * 2), rot = R() * TAU;
    for (let i = 0; i < n; i++) {
      const a = rot + i / n * TAU;
      parts.push({ g: 'head', d: function (x, y) { return circle(x, y, hx + Math.cos(a) * r * 0.5, hy + Math.sin(a) * r * 0.42, r * 0.62); }, order: function (x, y) { return radial(x, y, r * 1.3); } });
    }
    parts.push({ fill: '*', solid: true, d: function (x, y) { return circle(x, y, hx, hy, r * 0.22); }, order: function () { return 0.45; } });
  } else if (kind === 'sprig') {
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.6, len = H * 0.12;
      parts.push({ g: 'tip' + i, d: function (x, y) { return ellipse(x, y, hx + Math.cos(a) * len, hy + Math.sin(a) * len, len, len * 0.32, a); }, order: function () { return 0.6 + i * 0.1; } });
    }
  }
  return render(parts, Wd, H, R, opts.petal);
}

// which character draws an edge running at this angle, at this height in the cell
function strokeChar(nx, ny, off) {
  // tangent angle on screen (y grows downwards), folded into [0, 180)
  let a = Math.atan2(nx, -ny) * 180 / Math.PI;
  a = ((a % 180) + 180) % 180;
  if (a < 20 || a > 160) return off > 0.18 ? '_' : off < -0.22 ? "'" : '-';
  if (a < 70) return '\\';
  if (a < 110) return '|';
  return '/';
}

function render(parts, W, H, R, petalChar) {
  // shapes of one group melt into one outline
  const groups = {};
  parts.forEach(function (P) { if (!P.solid) (groups[P.g] = groups[P.g] || []).push(P); });
  const gl = Object.keys(groups).map(function (k) {
    const list = groups[k];
    return {
      stem: list[0].stem,
      d: function (x, y) { let m = 1e9; for (let i = 0; i < list.length; i++) m = Math.min(m, list[i].d(x, y)); return m; },
      order: function (x, y) { let m = 1e9, o = 0; for (let i = 0; i < list.length; i++) { const d = list[i].d(x, y); if (d < m) { m = d; o = list[i].order(x, y); } } return o; }
    };
  });
  const solids = parts.filter(function (P) { return P.solid; });
  const rows = [], order = [];
  for (let r = 0; r < H; r++) {
    let line = '';
    const ord = [];
    for (let c = 0; c < W; c++) {
      const x = (c + 0.5) * AX, y = r + 0.5;
      let ch = ' ', o = 1, best = 1e9;
      for (let k = 0; k < solids.length; k++) {
        const P = solids[k];
        if (P.d(x, y) < 0.1) { best = -1; ch = (c + r) % 2 ? P.fill : (P.fill === '@' ? 'o' : P.fill); o = P.order(x, y); }
      }
      if (best < 0) { line += ch; ord.push(o); continue; }
      for (let k = 0; k < gl.length; k++) {
        const P = gl[k], d = P.d(x, y);
        if (Math.abs(d) > 1.2) continue;
        const e = 0.05, gx = (P.d(x + e, y) - P.d(x - e, y)) / (2 * e), gy = (P.d(x, y + e) - P.d(x, y - e)) / (2 * e), g = Math.hypot(gx, gy) || 1;
        const nx = gx / g, ny = gy / g;
        // does the edge actually pass through this cell?
        const reach = 0.5 * Math.max(Math.abs(nx) * AX, Math.abs(ny)) * 1.04;
        const dd = P.stem ? d - 0.0 : d;
        if (Math.abs(dd) <= reach && Math.abs(dd) < best) {
          best = Math.abs(dd);
          const off = -dd * ny;
          ch = !P.stem && petalChar && R() < 0.3 ? petalChar : strokeChar(nx, ny, P.stem ? 0 : off);
          o = P.order(x, y);
        }
      }
      line += ch; ord.push(ch === ' ' ? -1 : Math.min(1, Math.max(0, o + (R() - 0.5) * 0.08)));
    }
    rows.push(line); order.push(ord);
  }
  // a few specks of light round it
  for (let i = 0; i < 6; i++) {
    const r = Math.floor(R() * H * 0.7), c = Math.floor(R() * W);
    if (rows[r][c] === ' ') { rows[r] = rows[r].slice(0, c) + (R() < 0.5 ? '.' : R() < 0.5 ? '*' : '+') + rows[r].slice(c + 1); order[r][c] = 0.85 + R() * 0.15; }
  }
  // trim empty columns at the sides
  let l = W, rr = 0;
  rows.forEach(function (s) { const a = s.search(/\S/); if (a >= 0) { l = Math.min(l, a); rr = Math.max(rr, s.replace(/\s+$/, '').length); } });
  return { rows: rows.map(function (s) { return s.slice(l, rr); }), order: order.map(function (o) { return o.slice(l, rr); }) };
}

/* ---- a flower on the screen: it grows in, stays, and comes apart ---- */
export function bloom(container, f, x, y, sizePx, life) {
  const pre = document.createElement('pre');
  pre.className = 'bloom';
  pre.setAttribute('aria-hidden', 'true');
  pre.style.fontSize = sizePx + 'px';
  container.appendChild(pre);
  const w = f.rows[0] ? f.rows[0].length : 0, h = f.rows.length;
  pre.style.left = Math.round(x - w * sizePx * AX / 2) + 'px';
  pre.style.top = Math.round(y - h * sizePx * 1.0) + 'px';
  const born = performance.now() / 1000, grow = 2.6, fall = 2.4;
  const noise = f.rows.map(function (s) { return Array.prototype.map.call(s, function () { return Math.random(); }); });
  let last = '';
  return {
    el: pre,
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
