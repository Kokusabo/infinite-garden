/* type.js - the words. Each scene's words are built from single letters, so they can
 * gather out of a blur as you arrive and come apart, letter by letter, as you leave.
 * Nothing here runs on a clock: it all follows the scroll, forwards and backwards. */
import { banner } from './ascii.js?v=4';

const GLYPHS = '.:;-=+*#%@/\\|<>~';
function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function ease(x) { x = clamp(x); return x * x * (3 - 2 * x); }

function letters(el, text) {
  const spans = [];
  text.split(' ').forEach(function (word, wi, all) {
    const w = document.createElement('span'); w.className = 'w';
    for (const ch of word) {
      const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; w.appendChild(s);
      spans.push({ el: s, r1: Math.random(), r2: Math.random() * 2 - 1, r3: Math.random() * 2 - 1, r4: Math.random() * 2 - 1 });
    }
    el.appendChild(w);
    if (wi < all.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return spans;
}

export function createType(root) {
  const live = new Map();
  function build(s) {
    const box = document.createElement('div');
    box.className = 'tx s-' + s.text.slot + (s.kind === 'ascii' ? ' on-dark' : '');
    const out = { box: box, chars: [], note: null, noteText: '', banner: null };
    if (s.text.banner) {
      const b = document.createElement('pre'); b.className = 'banner'; b.textContent = banner(s.text.banner, window.innerWidth < 700 ? 9 : 12);
      box.appendChild(b); out.banner = b;
    }
    if (s.text.line) {
      const l = document.createElement('div'); l.className = 'line';
      out.chars = letters(l, s.text.line);
      box.appendChild(l);
    }
    if (s.text.note) {
      const n = document.createElement('div'); n.className = 'note'; n.textContent = s.text.note;
      box.appendChild(n); out.note = n; out.noteText = s.text.note;
    }
    root.appendChild(box);
    return out;
  }
  // d: where the scroll is relative to this scene (-1 coming, 0 here, +1 gone)
  function draw(o, d, t) {
    const come = d < 0 ? ease(1 + d / 0.72) : 1, go = d > 0 ? ease(d / 0.72) : 0;
    o.box.style.visibility = come <= 0.001 || go >= 0.999 ? 'hidden' : 'visible';
    if (o.box.style.visibility === 'hidden') return;
    const n = o.chars.length;
    for (let i = 0; i < n; i++) {
      const c = o.chars[i], order = (i / Math.max(1, n - 1)) * 0.55 + c.r1 * 0.25;
      const a = clamp((come - order * 0.6) / 0.4), g = clamp((go - (1 - order) * 0.35) / 0.65);
      const lift = (1 - a) * 0.7, blur = (1 - a) * 9 + g * 7;
      const x = c.r2 * g * 160, y = lift * 40 + c.r3 * g * 120 - g * 50 + Math.sin(t * 0.8 + i * 0.4) * 1.2, rot = c.r4 * g * 70;
      c.el.style.opacity = (a * (1 - g)).toFixed(3);
      c.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + rot.toFixed(1) + 'deg)';
      c.el.style.filter = blur > 0.2 ? 'blur(' + blur.toFixed(1) + 'px)' : '';
    }
    if (o.note) {
      // the note settles out of noise, and turns back into it
      const k = Math.min(come, 1 - go);
      let s = '';
      for (let i = 0; i < o.noteText.length; i++) { const ch = o.noteText[i]; s += ch === ' ' || (i / o.noteText.length) < k * 1.25 - 0.15 ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]; }
      if (o.note.textContent !== s) o.note.textContent = s;
      o.note.style.opacity = (k * 0.9).toFixed(3);
    }
    if (o.banner) {
      const k = Math.min(come, 1 - go);
      o.banner.style.opacity = k.toFixed(3);
      o.banner.style.clipPath = 'inset(0 ' + ((1 - k) * 100).toFixed(1) + '% 0 0)';
      o.banner.style.transform = 'translateX(' + (go * -80).toFixed(1) + 'px) skewX(' + (go * -20).toFixed(1) + 'deg)';
    }
  }
  return {
    // keep the words of the scenes near the scroll, draw them, forget the rest
    update: function (pos, t, get) {
      const lo = Math.floor(pos) - 1, hi = Math.floor(pos) + 2;
      for (let i = Math.max(0, lo); i <= hi; i++) {
        const s = get(i);
        if (!s.text) continue;
        if (!live.has(i)) live.set(i, build(s));
        draw(live.get(i), pos - i, t);
      }
      live.forEach(function (o, i) { if (i < lo || i > hi) o.box.style.visibility = 'hidden'; if (i < lo - 1 || i > hi + 1) { o.box.remove(); live.delete(i); } });
    }
  };
}
