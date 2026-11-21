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

/* ---- flowers drawn by hand, letter by letter, and put together differently every time ---- */
// heads: every row is centred on the stem, so they can be written plainly
const HEADS = {
  daisy: ['__   __', '_(  \\_/  )_', '(__  (@)  __)', '(_ /   \\ _)', '(_/ \\_)'],
  tulip: ['. . .', '/\\/ \\/\\', '|   |   |', '\\  |  /', "'-+-'"],
  rose: [".-'''-.", '/ .---. \\', '| ( (@) ) |', "\\ '---' /", "'-._.-'"],
  poppy: ['_.---._', ".'  . .  '.", '(   (_*_)   )', "'.  ' '  .'", "'-...-'"],
  dandelion: [".  '  .", "'  \\ | /  '", '. -- (*) -- .', "'  / | \\  '", "'  .  '"],
  cosmos: ['_   _', '( \\ / )', '_  \\ V /  _', "( '-(o)-' )", "'-' | '-'"],
  sunflower: ['\\ | /', "'. \\ | / .'", '-- (#@#) --', ".' / | \\ '.", '/ | \\'],
  bell: ['.-.', '/   \\', '(_____)', "' ' '"],
  bud: ['.', '(@)', '\\|/']
};
const HEAD_NAMES = Object.keys(HEADS);
const BIG = ['daisy', 'tulip', 'rose', 'poppy', 'dandelion', 'cosmos', 'sunflower'];
// leaves, written to sit just left (or right) of the stem
const LEAF_L = [['.-.  ', "\\  '-", " '-._"], ['  _  ', '/ `-.', "'-._ "], ['     ', ',_   ', "'-._ "]];
const LEAF_R = [['  .-.', "-'  /", "_.-' "], ['  _  ', ".-' \\", " _.-'"], ['     ', '   _,', " _.-'"]];
const CENTERS = ['@', '*', 'o', '#'];

function grid(w, h) { const g = []; for (let i = 0; i < h; i++) g.push(new Array(w).fill(null)); return g; }
function put(g, row, col, ch, ord) {
  if (row < 0 || row >= g.length || col < 0 || col >= g[0].length || ch === ' ') return;
  g[row][col] = { ch: ch, o: ord };
}

// one flower into the grid: its stem standing on (baseCol, last row), its height in rows
function oneFlower(g, R, baseCol, stemLen, name, petal) {
  const head = HEADS[name], rows = g.length;
  // the stem, from the ground up, leaning a little now and then
  let x = baseCol, lean = R() < 0.5 ? -1 : 1, sinceTurn = 0;
  const xs = [];
  for (let i = 0; i < stemLen; i++) {
    const row = rows - 1 - i;
    let ch = '|';
    if (sinceTurn > 2 && R() < 0.22) { x += lean; ch = lean > 0 ? '/' : '\\'; sinceTurn = 0; if (R() < 0.4) lean = -lean; } else sinceTurn++;
    xs.push(x);
    put(g, row, x, ch, (i / stemLen) * 0.42);
  }
  // leaves on the stem, never too high
  const nLeaves = stemLen > 5 ? 1 + Math.floor(R() * 2) : 0;
  let side = R() < 0.5 ? -1 : 1;
  for (let k = 0; k < nLeaves; k++) {
    const i = 1 + Math.floor(R() * Math.max(1, stemLen * 0.55 - 2)) + k * 2, row = rows - 1 - i - 2, sx = xs[Math.min(i, xs.length - 1)];
    const L = side < 0 ? LEAF_L[Math.floor(R() * LEAF_L.length)] : LEAF_R[Math.floor(R() * LEAF_R.length)];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) put(g, row + r, side < 0 ? sx - 5 + c : sx + 1 + c, L[r][c], (i / stemLen) * 0.42 + 0.04);
    side = -side;
  }
  // the head, centred on the top of the stem
  const top = rows - 1 - stemLen, hx = xs[xs.length - 1], hh = head.length, mid = (hh - 1) / 2;
  const centre = CENTERS[Math.floor(R() * CENTERS.length)];
  for (let r = 0; r < hh; r++) {
    const line = head[r], off = hx - Math.floor(line.length / 2), row = top - hh + 1 + r;
    for (let c = 0; c < line.length; c++) {
      let ch = line[c];
      if (ch === '@' || ch === '*' || ch === 'o' || ch === '#') ch = petal || (R() < 0.5 ? ch : centre);
      else if (petal && (ch === '.' || ch === "'") && R() < 0.5) ch = petal;
      const d = Math.hypot((c - line.length / 2) * 0.55, r - mid) / Math.max(2, hh * 0.8);
      put(g, row, off + c, ch, 0.45 + Math.min(1, d) * 0.5);
    }
  }
}

export function makeFlower(seed, opts) {
  opts = opts || {};
  const R = rng(seed);
  // a single flower, or two or three leaning together
  const n = opts.kind ? 1 : (R() < 0.62 ? 1 : R() < 0.7 ? 2 : 3);
  const names = [];
  for (let i = 0; i < n; i++) names.push(opts.kind || (i === 0 ? BIG[Math.floor(R() * BIG.length)] : HEAD_NAMES[Math.floor(R() * HEAD_NAMES.length)]));
  const tall = Math.max(7, Math.round((opts.size || 20) * 0.48));
  const stems = names.map(function (nm, i) { return Math.max(4, tall - i * (2 + Math.floor(R() * 3)) - (nm === 'bud' || nm === 'bell' ? 2 : 0)); });
  const W = 34 + n * 6, H = Math.max.apply(null, stems.map(function (s, i) { return s + HEADS[names[i]].length; })) + 2;
  const g = grid(W, H), base = Math.floor(W / 2);
  const spots = n === 1 ? [0] : n === 2 ? [-4, 5] : [-7, 0, 7];
  names.forEach(function (nm, i) { oneFlower(g, R, base + spots[i] + Math.round((R() - 0.5) * 2), stems[i], nm, opts.petal); });
  // a few specks of light round it
  for (let i = 0; i < 5; i++) { const r = Math.floor(R() * H * 0.6), c = Math.floor(R() * W); if (!g[r][c]) put(g, r, c, R() < 0.5 ? '.' : R() < 0.5 ? '*' : '+', 0.9); }
  // into rows of text, trimmed
  const rowsOut = g.map(function (row) { return row.map(function (c) { return c ? c.ch : ' '; }).join(''); });
  const order = g.map(function (row) { return row.map(function (c) { return c ? Math.min(1, c.o + (R() - 0.5) * 0.05) : -1; }); });
  let l = W, rgt = 0;
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
