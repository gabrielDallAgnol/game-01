// The season's rules (season 1's, in S.season), weather from rules, titles' stat effects undone, difficulty changes.
// (Contracts, finales and later seasons were cut on Oct 25.)
import { CUT, DIFFICULTY, RULE_FX } from './state.js';
import { PARTY } from '../content/season.js';
import { PASSABLE, idx, inside } from './mapgen.js';
import { Rng, hashSeed } from './rng.js';
import { TITLES } from '../content/story.js';
import { WEATHER } from '../content/weather.js';

export function createSeasons(G) {
  const { S, c, ev, keep, map, rng, rule, seed } = G;
  // weather for tonight, rolled at dawn on its own random stream (never on Flare Nights)
  const weatherRng = new Rng(hashSeed(seed, 'weather'));
  const W8 = () => WEATHER[S.weather] || WEATHER.clear;
  const weatherFor = n => (n === S.night ? W8() : WEATHER.clear);
  // CUT.weather: nothing is rolled; a season rule (storm, still) sets every night's weather instead
  const ruleWeather = () => { for (const id of Object.keys(RULE_FX)) if (RULE_FX[id].weather && rule(id)) return RULE_FX[id].weather; return 'clear'; };
  function rollWeather(n) {
    if (CUT.weather) return ruleWeather();
    if (n < 3) return 'clear';
    const ids = Object.keys(WEATHER); return ids[weatherRng.weighted(ids.map(k => WEATHER[k].odds))];
  }

  // CUT.titleStats: titles stay as flavour; their stat effects (applied by the story) are undone here
  let titlesSeen = 0;
  const titlesRead = n => { titlesSeen = n; };   // (a restored run has read its titles already)
  function untitle() {
    const T = S.story && S.story.titles; if (!CUT.titleStats || !T || T.length === titlesSeen) return;
    let changed = false;
    for (; titlesSeen < T.length; titlesSeen++) for (const f of (TITLES[T[titlesSeen]] || {}).fx || []) {
      if (f.op === 'perk') { if (f.mul) S.P[f.key] /= f.mul; else S.P[f.key] -= f.add; changed = true; }
      else if (f.op === 'power') S.story.power -= f.n;
      else if (f.op === 'hands') S.story.hands -= f.n;
      // ('flag': the children's garden is the thread's reward, not the title's stat: it stays)
    }
    if (changed) G.refreshMax();
  }
  function metroSpot() {
    for (let t = 0; t < 30; t++) { const a = rng.range(0, Math.PI * 2), d = rng.range(6.5, 10), x = c + Math.cos(a) * d, y = c + Math.sin(a) * d, cx = Math.floor(x), cy = Math.floor(y); if (inside(cx, cy) && PASSABLE[map.terrain[idx(cx, cy)]] && map.reach[idx(cx, cy)] && S.occ[idx(cx, cy)] < 0) return { x: cx + 0.5, y: cy + 0.5 }; }
    return null;
  }
  const partySize = () => PARTY.base + (keep.level >= 3 && !CUT.secondCompanion ? PARTY.keep3 : 0);   // the second companion slot is parked
  /** retune the live run (never mutates the shared DIFFICULTY table) */
  function setDifficulty(key) {
    if (!DIFFICULTY[key]) return false;
    G.DIFF = DIFFICULTY[key]; S.difficulty = key; return true;
  }
  return { W8, weatherFor, rollWeather, titlesRead, untitle, metroSpot, partySize, setDifficulty };
}
