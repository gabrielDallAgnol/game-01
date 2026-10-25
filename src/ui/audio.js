// Sound: everything is synthesised with WebAudio (no files). Quiet by design: the bell, the guns,
// the dead and the wind carry the mood; nothing loops loudly. Starts on the first tap (browser rule).

export function createAudio(store) {
  let ctx = null, master = null, wind = null, windGain = null, noise = null;
  let muted = !!store.get('muted', false);
  const last = {};                       // rate limits per sound
  const ok = (k, gap) => { const t = ctx.currentTime; if (last[k] && t - last[k] < gap) return false; last[k] = t; return true; };

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.55;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); let b = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = i % 2 ? w : b * 3.5; }   // half white, half brown: rich enough for both hiss and rumble
    // night wind: brown-ish noise through a slowly wandering low-pass
    wind = ctx.createBufferSource(); wind.buffer = noise; wind.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.7;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.07; lfoG.gain.value = 160; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    windGain = ctx.createGain(); windGain.gain.value = 0;
    wind.connect(lp); lp.connect(windGain); windGain.connect(master); wind.start();
  }

  const env = (g, t, a, peak, dec) => { peak = Math.max(0.0002, peak || 0); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
  function tone(type, f, peak, dec, opts = {}) {
    const t = ctx.currentTime + (opts.at || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dec);
    env(g, t, opts.a || 0.004, peak, dec); o.connect(g);
    if (opts.lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = opts.lp; g.connect(f2); f2.connect(master); } else g.connect(master);
    o.start(t); o.stop(t + (opts.a || 0.004) + dec + 0.05);
  }
  function hiss(type, freq, q, peak, dec, opts = {}) {
    const t = ctx.currentTime + (opts.at || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; s.playbackRate.value = opts.rate || 1; f.type = type; f.frequency.setValueAtTime(freq, t); if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dec); f.Q.value = q;
    env(g, t, opts.a || 0.003, peak, dec); s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 1.5); s.stop(t + (opts.a || 0.003) + dec + 0.05);
  }

  const S = {
    bell() { // a cracked church bell: inharmonic partials, long tail, struck twice
      for (const at of [0, 1.6]) for (const [m, p, d] of [[0.5, 0.16, 4], [1, 0.12, 3], [1.19, 0.07, 2.2], [1.56, 0.05, 1.6], [2.0, 0.05, 1.2], [2.74, 0.03, 0.8]]) tone('sine', 196 * m, p, d, { at, a: 0.006 });
    },
    toll(v) { if (!ok('toll', 0.8)) return; for (const [m, p, d] of [[1, 0.06, 1.6], [2.4, 0.03, 1.0], [3.1, 0.02, 0.6]]) tone('sine', 330 * m, p * v, d, { a: 0.004 }); },   // [towers] the watch bell
    dawn() { tone('triangle', 660, 0.05, 0.5, { a: 0.02 }); tone('triangle', 990, 0.04, 0.7, { a: 0.02, at: 0.18 }); tone('triangle', 1320, 0.03, 0.9, { a: 0.02, at: 0.36 }); },
    shot(v) { if (!ok('shot', 0.05)) return; hiss('bandpass', 1900, 1.2, 0.14 * v, 0.07); tone('square', 140, 0.05 * v, 0.06, { to: 60, lp: 900 }); },
    bolt(v) { if (!ok('bolt', 0.1)) return; hiss('lowpass', 2400, 0.5, 0.25 * v, 0.22, { to: 300 }); tone('sawtooth', 90, 0.12 * v, 0.25, { to: 40, lp: 600 }); },
    spit(v) { if (!ok('spit', 0.15)) return; hiss('bandpass', 700, 3, 0.12 * v, 0.18, { to: 300 }); },
    swing() { if (!ok('swing', 0.12)) return; hiss('highpass', 900, 0.8, 0.08, 0.09, { to: 3000 }); },
    hit(v) { if (!ok('hit', 0.06)) return; hiss('lowpass', 500, 1, 0.16 * v, 0.08); tone('sine', 110, 0.08 * v, 0.08, { to: 60 }); },
    die(v) { if (!ok('die', 0.08)) return; hiss('lowpass', 900, 0.8, 0.14 * v, 0.2, { to: 200 }); },
    groan(v) { // the dead: a low wavering saw through a throat-like band-pass
      if (!ok('groan', 1.1) || v < 0.15) return;
      const t = ctx.currentTime, o = ctx.createOscillator(), vib = ctx.createOscillator(), vg = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      const f0 = 70 + Math.random() * 45; o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 0.8, t + 0.9);
      vib.frequency.value = 5 + Math.random() * 3; vg.gain.value = 6; vib.connect(vg); vg.connect(o.frequency);
      f.type = 'bandpass'; f.frequency.value = 420 + Math.random() * 200; f.Q.value = 4;
      env(g, t, 0.18, 0.09 * v, 0.8); o.connect(f); f.connect(g); g.connect(master);
      o.start(t); vib.start(t); o.stop(t + 1.1); vib.stop(t + 1.1);
    },
    gnaw(v) { if (!ok('gnaw', 0.25)) return; hiss('bandpass', 1300, 2, 0.06 * v, 0.06); tone('square', 220, 0.02 * v, 0.04, { lp: 1200 }); },
    build() { tone('sine', 95, 0.25, 0.22, { to: 55 }); hiss('lowpass', 700, 0.7, 0.12, 0.16); hiss('bandpass', 2200, 2, 0.04, 0.05, { at: 0.04 }); },
    crash(v) { hiss('lowpass', 1400, 0.6, 0.3 * v, 0.7, { to: 120 }); tone('sine', 60, 0.2 * v, 0.5, { to: 35 }); },
    explode(v) { hiss('lowpass', 900, 0.6, 0.3 * v, 0.45, { to: 150, rate: 0.6 }); tone('sine', 70, 0.22 * v, 0.35, { to: 30 }); },
    coin() { if (!ok('coin', 0.08)) return; tone('triangle', 1568, 0.05, 0.12); tone('triangle', 2093, 0.04, 0.18, { at: 0.05 }); },
    card() { if (!ok('card', 0.05)) return; hiss('bandpass', 3000, 1.5, 0.03, 0.05); },
    warcry() { tone('sawtooth', 160, 0.12, 0.5, { to: 120, lp: 1100, a: 0.03 }); hiss('bandpass', 600, 1, 0.06, 0.4); },
    claim() { for (const [f, at] of [[392, 0], [523, 0.15], [659, 0.3], [784, 0.45]]) tone('triangle', f, 0.05, 0.8, { at, a: 0.02 }); },
    thunder() { hiss('bandpass', 2600, 0.8, 0.12, 0.18); hiss('lowpass', 260, 0.7, 0.4, 2.6, { at: 0.12, a: 0.25, rate: 0.5, to: 90 }); },
    first() { // a low, wrong chord swelling out of nothing
      for (const [f, at] of [[55, 0], [58.3, 0.1], [82.4, 0.3], [116.5, 0.6]]) tone('sawtooth', f, 0.07, 3.2, { at, a: 1.2, lp: 500 });
      hiss('lowpass', 300, 0.6, 0.12, 3, { a: 1.5, rate: 0.4 });
    },
    bad() { tone('sine', 220, 0.06, 0.5, { to: 160, a: 0.02 }); },
    // the job change: the window opens (tier 1 a shimmer, 2 a crack and a low swell, 3 thunder and a rising chord)
    jobOpen(t = 1) { hiss('bandpass', 3200, 2, 0.05, 0.6, { a: 0.1 }); for (const [f, at] of [[523, 0.1], [784, 0.3]]) tone('triangle', f * (t >= 2 ? 0.5 : 1), 0.04, 1.2, { at, a: 0.05 }); if (t >= 2) { hiss('highpass', 1800, 1, 0.12, 0.25, { at: 0.05 }); tone('sawtooth', 65, 0.08, 2.4, { a: 0.6, lp: 400 }); } if (t >= 3) S.thunder(); },
    // the class is yours: a rising chord, bigger with each tier (the sting)
    classUp(t = 1) {
      const base = [[392, 0], [523, 0.12], [659, 0.24], [784, 0.36]], big = t >= 2 ? [...base, [1046, 0.5], [1318, 0.64]] : base;
      for (const [f, at] of big) tone('triangle', f, 0.06, 1.4, { at, a: 0.02 });
      if (t >= 2) { tone('sawtooth', 98, 0.1, 1.8, { a: 0.05, lp: 700 }); hiss('lowpass', 500, 0.7, 0.2, 1.2, { a: 0.02 }); }
      if (t >= 3) { S.thunder(); for (const [f, at] of [[196, 0.8], [262, 0.8], [392, 0.8], [523, 0.8]]) tone('sawtooth', f, 0.05, 2.6, { at, a: 0.3, lp: 1600 }); }
    },
  };

  /** turn sim events into sound; `from` gives the listener (the hero) for distance falloff */
  function onEvents(events, game) {
    if (!ctx || muted) return;
    const G = game.state, h = G.hero;
    const vol = (x, y) => (x === undefined ? 1 : Math.max(0, 1 - Math.hypot(x - h.x, y - h.y) / 24));
    const mob = id => G.mobs.find(m => m.id === id);
    for (const e of events) {
      switch (e.t) {
        case 'night': case 'bell': S.bell(); break;
        case 'dawn': S.dawn(); break;
        case 'shot': { if (e.src === 'spit') { const p = G.projectiles.find(q => q.id === e.id); S.spit(p ? vol(p.x, p.y) : 0.5); break; } const p = G.projectiles.find(q => q.id === e.id); S.shot(p ? vol(p.x, p.y) : 0.6); break; }
        case 'bolt': S.bolt(vol(e.x1, e.y1)); break;
        case 'swing': S.swing(); break;
        case 'hitM': { const m = mob(e.id); S.hit(m ? vol(m.x, m.y) * 0.7 : 0.4); break; }
        case 'die': S.die(vol(e.x, e.y)); break;
        case 'bite': { const m = mob(e.id); S.gnaw(m ? vol(m.x, m.y) : 0.4); break; }
        case 'build': S.build(); break;
        case 'ruin': S.crash(0.8); break;
        case 'explode': S.explode(vol(e.x, e.y)); break;
        // [towers] the specialised towers: a mortar's thump, the brazier's whoosh, the watch bell's toll
        case 'shell': if (vol(e.x, e.y) > 0.05 && Math.random() < 0.6) S.explode(vol(e.x, e.y) * 0.55); break;
        case 'flame': if (vol(e.x, e.y) > 0.1) S.spit(vol(e.x, e.y) * 0.8); break;
        case 'toll': if (vol(e.x, e.y) > 0.1) S.toll(vol(e.x, e.y)); break;
        case 'purseTaken': case 'chestOpen': case 'bountyGold': S.coin(); break;
        case 'bounty': S.claim(); break;
        case 'warcry': case 'volley': S.warcry(); break;
        case 'claim': case 'dropOpen': case 'landmark': S.claim(); break;
        case 'levelUp': case 'title': S.claim(); break;
        case 'evolve': break;   // the job-change sting plays on classUp (the UI's confirmation beat)
        case 'trialStart': S.first(); break;
        case 'eruptWarn': case 'breach': S.first(); break;
        case 'drop': S.thunder(); break;
        case 'heroDie': S.bad(); break;
        case 'firstDead': S.first(); break;
      }
    }
  }
  /** per frame: wind at night, groans while the dead are near */
  function tick(game, dt) {
    if (!ctx) return;
    const G = game.state, night = G.phase === 'night';
    windGain.gain.setTargetAtTime(muted ? 0 : night ? 0.16 : 0.035, ctx.currentTime, 1.2);
    if (muted || !night || !G.mobs.length || Math.random() > dt * 1.4) return;
    const h = G.hero; let best = null, bd = Infinity;
    for (let k = 0; k < 6; k++) { const m = G.mobs[Math.floor(Math.random() * G.mobs.length)]; const d = Math.hypot(m.x - h.x, m.y - h.y); if (d < bd) { bd = d; best = m; } }
    if (best && best.rise >= 1) S.groan(Math.max(0, 1 - bd / 18));
  }
  function setMuted(m) { muted = m; store.set('muted', m); if (master) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.05); }
  return { unlock, onEvents, tick, play: (k, v) => { if (ctx && !muted && S[k]) S[k](v ?? 1); }, setMuted, muted: () => muted };
}
