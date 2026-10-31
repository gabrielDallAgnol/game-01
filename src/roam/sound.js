// [roam] Sound (render-side; it reads the sim's events and never touches the rules): every sound is synthesized with
// WebAudio from noise and oscillators, no files. Each weapon has its own voice (the scatter gun's boom and thump, the
// launcher's whoosh and the blast, the thrower's roar while it's held, a hose's hiss), hits tick, a dying machine
// crunches, scrap pinging in climbs a little scale, a dropped weapon chimes by rarity, and fire near Kai crackles.
// Starts on the first tap (browsers need a gesture).
export function createSound() {
  let ac = null, out = null, noiseBuf = null, roar = null, crackle = null;
  function start() { if (ac) { if (ac.state === 'suspended') ac.resume(); return; } const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ac = new AC();
    out = ac.createDynamicsCompressor(); out.threshold.value = -14; out.ratio.value = 4; const master = ac.createGain(); master.gain.value = 0.7; out.connect(master); master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    roar = loop('lowpass', 700, 0); crackle = loop('bandpass', 2400, 0); }
  const now = () => ac.currentTime;
  function loop(type, f, g) { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const gn = ac.createGain(); gn.gain.value = g; s.connect(fl); fl.connect(gn); gn.connect(out); s.start(); return { fl, gn }; }
  // a burst of filtered noise: type, frequency (→ f1 over the burst), length, volume
  function noise(type, f0, f1, len, vol, q = 0.8, at = 0) { const t = now() + at, s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.9 + Math.random() * 0.2;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + len);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + len + 0.05); }
  // a tone that slides f0 → f1
  function tone(type, f0, f1, len, vol, at = 0) { const t = now() + at, o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + len); o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.05); }
  const VOICE = {
    scatter: () => { noise('lowpass', 2600, 300, 0.22, 0.9, 0.7); tone('sine', 110, 38, 0.2, 0.9); noise('highpass', 5000, 3000, 0.05, 0.25); },
    launcher: () => { noise('bandpass', 400, 2200, 0.45, 0.5, 1.2); tone('sine', 70, 140, 0.25, 0.4); },
    thrower: () => {},
  };
  const RCH = { common: null, tuned: [660, 990], rare: [784, 1175, 1568], epic: [523, 784, 1047, 1568] };
  let pingN = 0, pingT = 0, hitT = 0;
  function events(evs, S) { if (!ac) return; const t = now();
    for (const e of evs) {
      if (e.type === 'shot') (VOICE[e.base] || VOICE.scatter)();
      else if (e.type === 'hit' && t - hitT > 0.04) { hitT = t; tone('square', 1500 + Math.random() * 300, 900, 0.035, 0.12); }
      else if (e.type === 'die') { noise('lowpass', 1800, 120, 0.35, 0.6); tone('square', 220, 50, 0.25, 0.15); }
      else if (e.type === 'blast') { const big = e.r > 4; noise('lowpass', big ? 900 : 1400, 40, big ? 1.6 : 0.9, 1.0, 0.5); tone('sine', 60, 25, big ? 0.9 : 0.5, 1.0); noise('highpass', 3000, 800, 0.3, 0.3); }
      else if (e.type === 'pickup') { pingN = t - pingT < 0.5 ? pingN + 1 : 0; pingT = t; const f = 880 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14, 16][Math.min(7, pingN)] / 12); tone('triangle', f, f * 1.01, 0.09, 0.18); }
      else if (e.type === 'drop' && RCH[e.rarity]) RCH[e.rarity].forEach((f, i) => tone('triangle', f, f, 0.5, 0.22, i * 0.09));
      else if (e.type === 'loot') { noise('bandpass', 1200, 4000, 0.18, 0.25, 2); tone('triangle', 1175, 1760, 0.18, 0.2, 0.05); }
      else if (e.type === 'scan') tone('sine', 1568, 2093, 0.25, 0.15);
      else if (e.type === 'ricochet') tone('sawtooth', 2400, 900, 0.08, 0.08);
      else if (e.type === 'hurt') { tone('sine', 90, 45, 0.25, 0.7); noise('lowpass', 900, 200, 0.15, 0.4); }
      else if (e.type === 'catch') noise('bandpass', 600, 1800, 0.5, 0.25, 1);
      // [m4] the walker: a deep stomp, a plate's clang, a low groan as it rears; the area going clean: a rising chord
      else if (e.type === 'stomp') { tone('sine', 55, 22, 0.9, 1.0); noise('lowpass', 500, 40, 0.8, 0.8, 0.5); }
      else if (e.type === 'plate') { tone('square', 320, 180, 0.4, 0.25); tone('triangle', 960, 700, 0.5, 0.2); noise('highpass', 3000, 1500, 0.2, 0.3); }
      else if (e.type === 'rear') tone('sawtooth', 70, 110, 0.7, 0.18);
      else if (e.type === 'clean') [392, 494, 587, 784, 988].forEach((f, i) => tone('triangle', f, f, 1.6, 0.18, i * 0.12));
      else if (e.type === 'doused') noise('highpass', 3000, 6000, 0.6, 0.18); } }
  // held and ambient: the thrower's roar (a hiss for water) while firing; crackle by how much burns near Kai
  function frame(S, input) { if (!ac) return; const t = now(), g = S.guns && S.guns.main, el = g && (g.el || (g.mods || []).find(m => m === 'fire' || m === 'water'));
    const on = input.fire && !S.kai.dead && g && g.base === 'thrower', wet = el === 'water';
    roar.fl.type = wet ? 'highpass' : 'lowpass'; roar.fl.frequency.setTargetAtTime(wet ? 2600 : 650 + 250 * Math.random(), t, 0.05); roar.gn.gain.setTargetAtTime(on ? (wet ? 0.25 : 0.55) : 0, t, on ? 0.04 : 0.12);
    let n = 0; if (S.cells) for (const [c, s] of S.cells) if (s.burn) { n++; if (n > 60) break; }
    if (S.atoms) for (const a of S.atoms) if (a.state === 'burning' && Math.abs(a.x - S.kai.x) < 30 && Math.abs(a.y - S.kai.y) < 30) n += 4;
    crackle.gn.gain.setTargetAtTime(Math.min(0.35, n * 0.006) * (0.4 + 0.6 * Math.random()), t, 0.03); }
  return { start, events, frame };
}
