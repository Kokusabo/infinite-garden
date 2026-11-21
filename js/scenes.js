/* scenes.js - what comes next, for ever. Every step of the scroll is a scene: a photograph,
 * an old 3d place, a photograph remembered as letters, or a page, like a page torn out
 * of a book about a garden. Each has its own green, its own words, and its own way of
 * turning into the next one. The same visit always unfolds the same way. */
import { rng } from './ascii.js?v=5';

export const LINES = [
  'it was brighter than this', 'don\'t look straight at it', 'the grass grew over the sound', 'somebody planted you here',
  'you were smaller. the leaves were the same', 'it keeps growing while you blink', 'every green is a different day',
  'the light is coming from inside it', 'nobody waters it. it grows anyway', 'there was a window here',
  'hold still. it is almost in focus', 'you have been here before', 'the sun is too close today', 'it remembers your hands',
  'one more minute', 'close your eyes. it is still there', 'the garden does not end. it only turns', 'the stairs go up into the leaves',
  'a television is on somewhere in the grass', 'it smells like after rain', 'summer, recorded over', 'this is the part you forget',
  'the pool is full of grass now', 'listen. it is growing', 'everything here is a little too bright', 'you are not dreaming. you are remembering',
  'the green gets in your eyes', 'it was always afternoon', 'the seeds go where the wind says', 'you left the window open',
  'someone is mowing a lawn, far away', 'the photograph is warmer than the day was', 'don\'t wake up yet', 'it is greener on the inside',
  'the light stays after you look away', 'walk slower. it is not going anywhere', 'all of this fits in one breath',
  'petals and letters are the same thing here', 'it was here before the house', 'a white chair, facing nothing', 'the leaves are counting you',
  'it goes on behind your eyelids', 'too bright to be a memory', 'you can\'t keep any of it', 'the wind turns the pages',
  'nothing here has a name yet', 'it was green when you left', 'the ivy has your handwriting', 'everything you planted came back',
  'the afternoon lasted for years', 'you hear it before you see it', 'the dandelions remember the wind', 'it opens when you stop looking'
];
const NOTES = [
  'fig. %n — light, again', 'recorded over: summer', 'time: always afternoon', 'location: unknown, green', 'exposure: too much',
  'focus: never', 'the %nth green', 'tape %n, side b', 'found in the grass', 'do not adjust your eyes', 'seed count: %n',
  'temperature: warm', 'from the window, %n years ago', 'the same leaf, %n times', 'wind: from nowhere', 'distance: one breath',
  'a garden, %n m²', 'not a photograph', 'this happened, probably', 'plate %n', 'still growing', 'the light came from the left',
  'sun: closer than it looks', 'nobody was there', 'chlorophyll, %n%', 'humidity: high', 'last seen: here'
];
const WORDS = ['again', 'green', 'stay', 'grow', 'here', 'bloom', 'light', 'wake', 'dream', 'still', 'sun', 'leaf', 'afternoon', 'echo', 'soft'];
const GREEN_NAMES = [
  'after rain', 'under a leaf', 'old glass', 'pool water', 'first cut grass', 'the shade at noon', 'moss on steps', 'a bottle in the sun',
  'unripe', 'wet fern', 'the inside of a stem', 'a lamp through leaves', 'tv at night', 'mint', 'lichen', 'a dream you forgot',
  'the back of an ivy leaf', 'pond', 'young birch', 'sleep', 'the light at five', 'a window left open', 'pollen', 'early june'
];
// which slots on the screen a scene's words can take
const SLOTS = ['tl', 'br', 'c', 'bl', 'tr', 'v'];
export const PAGES = ['word', 'contact', 'greens', 'banner'];
const TRANS = ['fall', 'strips', 'squares', 'grow', 'burn', 'smear', 'eye', 'kaleidoscope', 'blinds', 'letters'];

function fill(s, R) { return s.replace('%n', String(2 + Math.floor(R() * 97))); }
function hex(h, s, l) {
  l /= 100; const a = s * Math.min(l, 1 - l) / 100;
  const f = function (n) { const k = (n + h / 30) % 12, c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); return Math.round(255 * c).toString(16).padStart(2, '0'); };
  return '#' + f(0) + f(8) + f(4);
}

export function createScenes(seed, nPhotos, worlds) {
  const R = rng(seed), list = [];
  let order = [], oi = 0, sinceWorld = 0, sincePage = 0, sinceAscii = 0, lastSlot = '', lastTrans = '';
  const usedLines = [];
  function photo() {
    if (oi >= order.length) { order = []; for (let i = 0; i < nPhotos; i++) order.push(i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const k = order[i]; order[i] = order[j]; order[j] = k; } oi = 0; }
    return order[oi++];
  }
  function line() {
    let l = LINES[Math.floor(R() * LINES.length)], tries = 0;
    while (usedLines.indexOf(l) >= 0 && tries++ < 8) l = LINES[Math.floor(R() * LINES.length)];
    usedLines.push(l); if (usedLines.length > 24) usedLines.shift();
    return l;
  }
  function slot() { let s = SLOTS[Math.floor(R() * SLOTS.length)]; if (s === lastSlot) s = SLOTS[(SLOTS.indexOf(s) + 1) % SLOTS.length]; lastSlot = s; return s; }
  function make(i) {
    let kind = 'photo';
    if (i > 1) {
      if ((sincePage >= 4 && R() < 0.4) || sincePage >= 7) kind = 'page';
      else if ((sinceWorld >= 4 && R() < 0.35) || sinceWorld >= 9) kind = 'world';
      else if (sinceAscii >= 4 && R() < 0.3) kind = 'ascii';
    }
    sincePage = kind === 'page' ? 0 : sincePage + 1;
    sinceWorld = kind === 'world' ? 0 : sinceWorld + 1;
    sinceAscii = kind === 'ascii' ? 0 : sinceAscii + 1;
    const s = {
      i: i, kind: kind, photo: photo(),
      world: kind === 'world' ? worlds[Math.floor(R() * worlds.length)] : null,
      grade: [R() < 0.2 ? 0 : (R() - 0.55) * 0.62, 0.7 + R() * 0.5, R() * 2 - 1],
      z0: 1.02 + R() * 0.14, z1: 1.0 + R() * 0.2, px: (R() - 0.5) * 1.4, py: (R() - 0.5) * 1.4, dx: (R() - 0.5) * 0.8, dy: (R() - 0.5) * 0.8,
      tape: kind === 'photo' && R() < 0.15,
      sun: kind === 'photo' && R() < 0.14,
      center: [0.3 + R() * 0.4, 0.3 + R() * 0.4],
      seed: R(),
      text: null, page: null
    };
    // how it is seen: mostly clear, sometimes soft, now and then smeared by astigmatism (and always so when the sun is in the eyes)
    const fr = R();
    s.focus = s.sun ? 'astig' : kind === 'ascii' || kind === 'page' ? 'sharp' : kind === 'world' ? (fr < 0.6 ? 'soft' : 'sharp') : s.tape ? (fr < 0.5 ? 'soft' : 'sharp') : fr < 0.62 ? 'sharp' : fr < 0.9 ? 'soft' : 'astig';
    if (s.tape) {
      const y = 1996 + Math.floor(R() * 30), m = 1 + Math.floor(R() * 12), d = 1 + Math.floor(R() * 28), h = 6 + Math.floor(R() * 14), mi = Math.floor(R() * 60);
      const p2 = function (v) { return String(v).padStart(2, '0'); };
      s.date = p2(m) + '/' + p2(d) + '/' + y + '  ' + p2(h) + ':' + p2(mi);
    }
    // words: most scenes say something; some say it in big letters made of letters
    if (kind === 'page') {
      const pk = PAGES[Math.floor(R() * PAGES.length)];
      s.page = { kind: pk, word: WORDS[Math.floor(R() * WORDS.length)], line: line(), note: fill(NOTES[Math.floor(R() * NOTES.length)], R), photos: [photo(), photo(), photo()], bg: Math.floor(R() * 4), reveal: ['iris', 'wipe', 'split', 'diag'][Math.floor(R() * 4)], flower: Math.floor(R() * 1e9) };
      if (pk === 'greens') {
        s.page.greens = [];
        for (let k = 0; k < 9; k++) { const h = 70 + R() * 85, sat = 25 + R() * 55, l = 35 + R() * 50; s.page.greens.push({ hex: hex(h, sat, l), name: GREEN_NAMES[Math.floor(R() * GREEN_NAMES.length)] }); }
      }
    } else {
      s.text = {
        line: R() < 0.88 || kind === 'world' ? line() : '',
        note: R() < 0.7 ? fill(NOTES[Math.floor(R() * NOTES.length)], R) : '',
        banner: kind !== 'ascii' && R() < 0.14 ? WORDS[Math.floor(R() * WORDS.length)] : '',
        slot: slot()
      };
    }
    // how this one turns into the next
    let t = TRANS[Math.floor(R() * TRANS.length)];
    if (t === lastTrans) t = TRANS[(TRANS.indexOf(t) + 3) % TRANS.length];
    lastTrans = t;
    s.trans = t;
    return s;
  }
  return {
    get: function (i) { while (list.length <= i) list.push(make(list.length)); return list[i]; }
  };
}
