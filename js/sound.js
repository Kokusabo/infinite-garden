/* sound.js - the garden heard through a tape: warm hiss, leaves moving, a bird now and
 * then, and a soft chord that wavers the way an old cassette does. Everything is made
 * from noise and sine waves; nothing is a recording. It begins at the first touch. */

export function createSound() {
  let ac = null, master = null, verb = null, noiseBuf = null, on = false, wow = null, birdT = 0;
  const G = {};
  function gain(v) { const g = ac.createGain(); g.gain.value = v; return g; }
  function filter(type, f, q) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q || 0.7; return b; }
  function noise() {
    if (noiseBuf) return noiseBuf;
    const n = ac.sampleRate * 3; noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function loopNoise(off) { const s = ac.createBufferSource(); s.buffer = noise(); s.loop = true; s.start(0, off || 0); return s; }

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = gain(0);
    const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
    verb = gain(1);
    const d1 = ac.createDelay(2), d2 = ac.createDelay(2), fb = gain(0.5), lp = filter('lowpass', 2600), wet = gain(0.45);
    d1.delayTime.value = 0.29; d2.delayTime.value = 0.53;
    verb.connect(d1); d1.connect(lp); lp.connect(d2); d2.connect(fb); fb.connect(d1); d2.connect(wet); d1.connect(wet); wet.connect(master);
    // tape hiss
    G.hiss = gain(0.05); loopNoise(0).connect(filter('highpass', 3200)).connect(G.hiss); G.hiss.connect(master);
    // leaves: a band of noise that breathes
    G.leaves = gain(0.14);
    const ls = loopNoise(1.3), lb = filter('bandpass', 2200, 0.8), la = gain(0.5);
    ls.connect(lb); lb.connect(la); la.connect(G.leaves); G.leaves.connect(master);
    const ll = ac.createOscillator(), llg = gain(0.45); ll.frequency.value = 0.13; ll.connect(llg); llg.connect(la.gain); ll.start();
    // the chord, pulled slightly out of tune by the tape
    wow = ac.createOscillator(); wow.frequency.value = 0.6;
    const wowG = gain(9); wow.connect(wowG); wow.start();
    G.pad = gain(0.0);
    [261.63, 329.63, 392.0, 493.88, 587.33].forEach(function (f, i) {
      const o = ac.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = (i - 2) * 3;
      wowG.connect(o.detune);
      const g = gain(0.07 / (1 + i * 0.25)), tr = ac.createOscillator(), tg = gain(0.035);
      tr.frequency.value = 0.05 + i * 0.023; tr.connect(tg); tg.connect(g.gain); tr.start();
      o.connect(filter('lowpass', 1800)).connect(g); g.connect(G.pad); o.start();
    });
    G.pad.connect(master); G.pad.connect(verb);
    return true;
  }
  function blip(dur, fill, vol, wetToo) {
    if (!ac || !on) return;
    const sr = ac.sampleRate, n = Math.max(1, Math.round(dur * sr)), b = ac.createBuffer(1, n, sr), d = b.getChannelData(0);
    fill(d, sr, n);
    const f = Math.min(n, Math.round(sr * 0.004)); for (let i = 0; i < f; i++) { d[i] *= i / f; d[n - 1 - i] *= i / f; }
    const s = ac.createBufferSource(), g = gain(vol); s.buffer = b; s.connect(g); g.connect(master); if (wetToo) g.connect(verb); s.start();
  }
  // a small bird somewhere: two or three quick falling whistles
  function bird() {
    const f0 = 2600 + Math.random() * 1800, k = 2 + ((Math.random() * 3) | 0);
    blip(0.12 * k + 0.1, function (d, sr) {
      for (let i = 0; i < d.length; i++) {
        const t = i / sr, j = Math.floor(t / 0.12), u = t - j * 0.12;
        d[i] = j < k && u < 0.08 ? Math.sin(2 * Math.PI * f0 * (1 - u * 2.5) * u) * Math.sin(Math.PI * u / 0.08) : 0;
      }
    }, 0.05 + Math.random() * 0.04, true);
  }
  // the tape skipping: a scrape of chopped noise and a pitch drop
  function skip(k) {
    blip(0.12 + k * 0.25, function (d, sr) {
      let v = 0, ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / d.length; if (i % 6 === 0) v = Math.random() * 2 - 1;
        ph += (500 - t * 420) / sr; d[i] = v * 0.5 * (1 - t) + Math.sin(ph * 6.283) * 0.4 * (1 - t);
      }
    }, 0.12 + k * 0.1, false);
    if (ac && wow) { const p = ac.currentTime; G.pad.gain.cancelScheduledValues(p); G.pad.gain.setValueAtTime(0.25, p); G.pad.gain.setTargetAtTime(1, p + 0.3, 0.4); }
  }
  // a click of the play button, and a soft three-note rise
  function play() {
    if (!ac || !on) return;
    blip(0.05, function (d, sr) { for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / sr * 90); }, 0.3, false);
    [523.25, 659.25, 783.99].forEach(function (f, i) {
      const t0 = ac.currentTime + 0.12 + i * 0.22, o = ac.createOscillator(), g = gain(0);
      o.frequency.value = f; o.connect(g); g.connect(master); g.connect(verb);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.12, t0 + 0.015); g.gain.setTargetAtTime(0, t0 + 0.03, 0.45);
      o.start(t0); o.stop(t0 + 2.5);
    });
  }
  // an iPhone on silent mutes page sound unless the page says it plays on purpose
  let unlocked = false, trying = false;
  function unlockPhone() {
    if (unlocked || trying) return;
    trying = true;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older phones */ }
    try {
      const sr = 8000, n = 800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const str = function (o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
      v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
      const el = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
      el.setAttribute('playsinline', '');
      const pr = el.play();
      if (pr && pr.then) pr.then(function () { unlocked = true; trying = false; }, function () { trying = false; });
      else unlocked = true;
    } catch (e) { unlocked = true; }
  }
  function setOn(v) {
    if (v) unlockPhone();
    if (!ac && !build()) return false;
    if (ac.state !== 'running') ac.resume();
    on = v;
    master.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, 0.4);
    if (on) G.pad.gain.setTargetAtTime(1, ac.currentTime, 1.2);
    return on;
  }
  return {
    start: function () { if (!ac || ac.state !== 'running' || !on) setOn(true); },
    toggle: function () { return setOn(!on); },
    isOn: function () { return on; },
    play: play, skip: skip,
    // how worn the tape is right now, and how much of the garden is in the air
    mood: function (tape, t) {
      if (!ac || !on) return;
      const now = ac.currentTime;
      G.hiss.gain.setTargetAtTime(0.03 + tape * 0.09, now, 0.3);
      wow.frequency.setTargetAtTime(0.5 + tape * 1.6, now, 0.5);
      if (t > birdT) { if (birdT > 0) bird(); birdT = t + 4 + Math.random() * 11; }
    }
  };
}
