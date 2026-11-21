/* pages.js - now and then the garden is interrupted by a page, as if torn from a book
 * about it: one word as large as the screen; a contact sheet of three sharp photographs
 * with their captions; a list of greens, each with a name; a word drawn in letters on
 * dark green. A page opens over the picture as you scroll into it, and closes as you leave. */
import { makeFlower, banner } from './ascii.js?v=4';

const BGS = [
  { bg: '#f3f8ea', ink: '#24452c', soft: '#6f8f72' },
  { bg: '#d7eac3', ink: '#1f3f26', soft: '#5d7f60' },
  { bg: '#0f2717', ink: '#dff5cf', soft: '#86a98a' },
  { bg: '#fbfdf6', ink: '#2f5c38', soft: '#88a68b' }
];
function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function ease(x) { x = clamp(x); return x * x * (3 - 2 * x); }

// a little noise to lay over paper
let grainURL = '';
function grain() {
  if (grainURL) return grainURL;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), d = x.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 22; }
  x.putImageData(d, 0, 0); grainURL = c.toDataURL('image/png');
  return grainURL;
}

export function createPages(root, footage) {
  const live = new Map();
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function build(s) {
    const P = s.page, col = BGS[P.kind === 'banner' ? 2 : P.bg % 4 === 2 && P.kind === 'contact' ? 0 : P.bg % 4];
    const page = el('div', 'page p-' + P.kind);
    page.style.setProperty('--bg', col.bg); page.style.setProperty('--ink', col.ink); page.style.setProperty('--soft', col.soft);
    page.style.backgroundImage = 'url(' + grain() + ')';
    const inner = el('div', 'page-in'); page.appendChild(inner);
    const f = makeFlower(P.flower, { size: 16 });
    if (P.kind === 'word') {
      inner.appendChild(el('p', 'pg-note', P.note));
      inner.appendChild(el('h2', 'pg-word', P.word));
      inner.appendChild(el('p', 'pg-line', P.line));
      inner.appendChild(el('pre', 'pg-flower', f.rows.join('\n')));
    } else if (P.kind === 'contact') {
      inner.appendChild(el('p', 'pg-note', 'contact sheet — ' + P.note));
      const row = el('div', 'pg-sheet');
      P.photos.forEach(function (n, k) {
        const fig = el('figure', 'pg-fig');
        const img = el('img'); img.src = footage(n); img.alt = ''; img.decoding = 'async'; img.loading = 'lazy';
        fig.appendChild(img); fig.appendChild(el('figcaption', '', 'fig. ' + (s.i * 3 + k + 1) + ' — ' + ['light', 'again', 'the same leaf', 'afternoon', 'here', 'green'][(n + k) % 6]));
        row.appendChild(fig);
      });
      inner.appendChild(row);
      inner.appendChild(el('p', 'pg-line', P.line));
    } else if (P.kind === 'greens') {
      inner.appendChild(el('h2', 'pg-title', 'every green, so far'));
      const list = el('ol', 'pg-greens');
      P.greens.forEach(function (g) { const li = el('li'); const sw = el('span', 'sw'); sw.style.background = g.hex; li.appendChild(sw); li.appendChild(el('span', 'hx', g.hex)); li.appendChild(el('span', 'nm', g.name)); list.appendChild(li); });
      inner.appendChild(list);
      inner.appendChild(el('p', 'pg-note', 'and it keeps making more'));
    } else {
      inner.appendChild(el('pre', 'pg-banner', banner(P.word, window.innerWidth < 700 ? 11 : 16)));
      inner.appendChild(el('p', 'pg-line', P.line));
      inner.appendChild(el('p', 'pg-note', P.note));
    }
    root.appendChild(page);
    return { page: page, inner: inner, reveal: P.reveal, cx: s.center[0] * 100, cy: s.center[1] * 100 };
  }
  // the clip that opens the page: k = 0 closed, 1 open
  function clip(o, k) {
    if (k >= 0.999) return 'none';
    const p = (k * 100).toFixed(2);
    if (o.reveal === 'iris') return 'circle(' + (k * 75).toFixed(2) + '% at ' + o.cx + '% ' + o.cy + '%)';
    if (o.reveal === 'wipe') return 'inset(' + (100 - k * 100).toFixed(2) + '% 0 0 0)';
    if (o.reveal === 'split') return 'inset(0 ' + (50 - k * 50).toFixed(2) + '% 0 ' + (50 - k * 50).toFixed(2) + '%)';
    return 'polygon(0 0, ' + (k * 200).toFixed(2) + '% 0, 0 ' + (k * 200).toFixed(2) + '%)';
    void p;
  }
  return {
    // returns how much of the screen a page covers right now (to skip drawing what is hidden)
    update: function (pos, t, get) {
      let cover = 0;
      const lo = Math.floor(pos) - 1, hi = Math.floor(pos) + 2;
      for (let i = Math.max(0, lo); i <= hi; i++) {
        const s = get(i);
        if (s.kind !== 'page') continue;
        if (!live.has(i)) live.set(i, build(s));
        const o = live.get(i), d = pos - i;
        const come = d < 0 ? ease((1 + d) / 0.8) : 1, go = d > 0 ? ease(d / 0.8) : 0;
        const k = d < 0 ? come : 1 - go;
        o.page.style.visibility = k <= 0.001 ? 'hidden' : 'visible';
        o.page.style.clipPath = d < 0 ? clip(o, come) : (go > 0 ? 'inset(' + (go * 50).toFixed(2) + '% 0 ' + (go * 50).toFixed(2) + '% 0)' : 'none');
        o.inner.style.transform = 'translate3d(0,' + (d * -70).toFixed(1) + 'px,0) scale(' + (1 + Math.abs(d) * 0.06).toFixed(4) + ')';
        o.inner.style.filter = Math.abs(d) > 0.02 ? 'blur(' + (Math.abs(d) * 6).toFixed(1) + 'px)' : '';
        if (k > 0.999) cover = 1;
      }
      live.forEach(function (o, i) { if (i < lo - 1 || i > hi + 1) { o.page.remove(); live.delete(i); } });
      return cover;
    }
  };
}
