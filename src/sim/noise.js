// Noise: one meter (0–100). Loud choices set its floor, fighting spikes it, story choices hold it for nights.
// (Old names kept: heat, addHeat.)
import { HEAT, NOISE } from './state.js';
import { LANDMARKS } from './mapgen.js';

export function createNoise(G) {
  const { S } = G;
  // ---------- noise: one meter (see NOISE). Loud choices set its floor; fighting spikes it; story choices hold for nights ----------
  let floorKey = '', floorCache = 0;
  const dropFloor = () => { floorKey = ''; };   // rules or difficulty changed: re-read the floor
  function noiseFloor() {
    const key = `${S.occVersion || 0}|${S.landmarks.filter(l => l.owned).length}`;
    if (key === floorKey) return floorCache;
    let f = 0;
    for (const b of S.buildings) { if (b.ruined) continue; const v = NOISE[b.type]; f += Array.isArray(v) ? (v[b.level - 1] || 0) : (v || 0); }
    f += S.landmarks.reduce((a, l) => a + (l.owned && LANDMARKS[l.kind].noise || 0) * NOISE.site, 0);
    floorKey = key; floorCache = f; return f;
  }
  const noiseCalm = () => G.DIFF.heat * (G.story ? G.story.bonus.heat() : 1) * (S.P.calm || 1);
  const noiseBase = () => noiseFloor() * noiseCalm() + (S.noiseChoice || 0);
  const noise = () => Math.round(S.noise || 0);
  // the louder the camp, the more dead come: ×1 when silent, ×1.5 at 100
  const townDraw = () => 1 + NOISE.mult * Math.min(100, S.noise || 0) / 100;

  // ---------- noise: a loud camp draws the dead; past the limit a hive bursts ----------
  // (kept the old names: heatFloor, addHeat, S.heat mirrors S.noise for old readers)
  const heatFloor = () => Math.min(100, Math.max(0, noiseBase()));
  /** a story choice (or any lasting deed): moves the meter for nights, fading a fifth each dawn */
  function addHeat(v) {
    if (!S.clock || S.over || !S.feat.heat || !v) return;
    const k = v > 0 ? noiseCalm() : 1;
    S.noiseChoice = Math.max(-NOISE.choiceMax, Math.min(NOISE.choiceMax, (S.noiseChoice || 0) + v * k));
    S.noise = Math.max(0, Math.min(100, noiseBase() + S.noiseSpike)); S.heat = S.noise;
  }
  /** fighting: a spike that fades in seconds; fighting alone never pushes the meter past HEAT.combatMax */
  function addSpike(v) {
    if (!S.clock || S.over || !S.feat.heat) return;
    S.noiseSpike = Math.max(0, Math.min((S.noiseSpike || 0) + v * noiseCalm(), HEAT.combatMax - noiseBase()));
  }
  const hiveOpen = r => !S.sealed || !S.sealed[r];
  function stepHeat(dt) {
    if (!S.clock || !S.feat.heat) { S.noise = S.heat = 0; S.noiseSpike = 0; return; }
    S.noiseSpike = Math.max(0, (S.noiseSpike || 0) * (1 - HEAT.decay * dt));
    S.noise = Math.max(0, Math.min(100, noiseBase() + S.noiseSpike)); S.heat = S.noise;
  }
  return { dropFloor, noiseFloor, noiseCalm, noise, townDraw, heatFloor, addHeat, addSpike, stepHeat };
}
