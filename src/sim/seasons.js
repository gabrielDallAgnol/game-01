// Seasons and contracts (engine side): rules, weather from rules, the finale, a won contract's step back,
// the features that arrive one at a time (System windows), titles' stat effects undone, difficulty changes.
import { CUT, DIFFICULTY, RULE_FX } from './state.js';
import { FEATURES, PARTY, RULES, SEASONS, SEASON_POOL, seasonEnd } from '../content/season.js';
import { PASSABLE, idx, inside } from './mapgen.js';
import { Rng, hashSeed } from './rng.js';
import { TITLES } from '../content/story.js';
import { WEATHER } from '../content/weather.js';

export function createSeasons(G) {
  const { S, c, ev, isBloodMoon, keep, map, rng, rule, seed } = G;
  // weather for tonight, rolled at dawn on its own random stream (never on blood moons)
  const weatherRng = new Rng(hashSeed(seed, 'weather'));
  const W8 = () => WEATHER[S.weather] || WEATHER.clear;
  const weatherFor = n => (n === S.night ? W8() : WEATHER.clear);
  // CUT.weather: nothing is rolled; a season rule (storm, still) sets every night's weather instead
  const ruleWeather = () => { for (const id of Object.keys(RULE_FX)) if (RULE_FX[id].weather && rule(id)) return RULE_FX[id].weather; return 'clear'; };
  function rollWeather(n) {
    if (CUT.weather) return ruleWeather();
    if (n < 3 || isBloodMoon(n)) return 'clear';
    const ids = Object.keys(WEATHER); return ids[weatherRng.weighted(ids.map(k => WEATHER[k].odds))];
  }

  // ---------- pacing: the systems arrive one at a time, each with its own System window ----------
  function checkFeatures() {
    for (const [k, F] of Object.entries(FEATURES)) if (!S.feat[k] && !(k === 'power' && CUT.power) && F.when(S, G.api)) { S.feat[k] = true; ev('window', { ...F.win, feat: k }); }
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
  const ADJ = ['Hollow', 'Weeping', 'Iron', 'Burning', 'Silent', 'Thousand-Handed', 'Pale', 'Drowned'], NOUN = ['Choir', 'Shepherd', 'Matron', 'Engine', 'Bride', 'Tide', 'Bellringer', 'Warden'];
  function startSeason(n) {
    const seasonRng = new Rng(hashSeed(seed, 'season', n));
    const def = SEASONS[n - 1] || { id: `gen${n}`, name: SEASON_POOL.names[seasonRng.int(SEASON_POOL.names.length)], blurb: 'The city changes again. Something new learned your name.', rule: SEASON_POOL.rules[seasonRng.int(SEASON_POOL.rules.length)], finale: `The ${ADJ[seasonRng.int(ADJ.length)]} ${NOUN[seasonRng.int(NOUN.length)]}` };
    const kept = S.season && S.season.won ? (S.season.rules || []) : [];   // a won contract's rules stay with you
    const rules = [...new Set([...kept, ...(def.rule ? [def.rule] : [])])];
    S.season = { n, id: def.id, name: def.name, rule: def.rule || null, rules, finale: def.finale, end: seasonEnd(n), start: S.night, won: false };
    if (n >= 2 && !(S.unique && !S.unique.slain && !S.unique.escaped)) S.unique = { name: def.finale, mult: 1.5 + 0.25 * (n - 1), night: seasonEnd(n), season: n };
    S.weather = rollWeather(S.night);
    if (G.story) G.story.seasonCard(def, n, def.rule ? RULES[def.rule] : null);
  }
  // ---------- contracts (engine side; the offer, card and words live in sim/contracts.js) ----------
  /** the season's finale is decided: its unique died (or its finale hive burned) in time, or the season ran out */
  function finale(won) {
    if (!S.season || S.season.finaleDone) return;
    S.season.finaleDone = true; S.season.won = !!won;
    ev('finale', { won: !!won, season: S.season.n, name: S.season.finale, night: S.night });
    if (won) contractWon();
  }
  /** a won contract: the difficulty curve steps back ~40% of the nights this season ran (night N then plays like
   *  N − 0.4×(N − season start)); the rules you chose stay. Idempotent per season. */
  function contractWon(share = 0.4) {
    if (!S.season || S.season.contractWon) return false;
    S.season.contractWon = true; S.season.won = true;
    const back = +(Math.max(0, Math.min(1, +share || 0)) * Math.max(0, S.night - (S.season.start || 1))).toFixed(2);
    S.diffNight = +((S.diffNight || 0) + back).toFixed(2);
    ev('contractWon', { season: S.season.n, back, diffNight: S.diffNight });
    return true;
  }
  /** contracts.js sets the rules it offered (and the player chose); they stack with the ones a won contract kept */
  function setSeasonRules(rules = []) {
    const list = [...new Set(rules.filter(Boolean))];
    S.season.rules = list; S.season.rule = list[list.length - 1] || null; S.weather = rollWeather(S.night); G.dropFloor();
    return list;
  }
  /** contracts.js names the finale: { kind: 'unique', name, mult } (the season's last blood moon) or { kind: 'hive', region } */
  function setFinale(f = {}) {
    if (f.kind === 'hive' && map.regions[f.region] && map.regions[f.region].nest) { S.season.finaleHive = f.region; if (f.name) S.season.finale = f.name; return true; }
    if (f.kind === 'unique') { S.season.finaleHive = undefined; S.season.finale = f.name || S.season.finale; S.unique = { name: S.season.finale, mult: f.mult || (S.unique && S.unique.mult) || 1.5, night: f.night || S.season.end, season: S.season.n }; return true; }
    return false;
  }
  function metroSpot() {
    for (let t = 0; t < 30; t++) { const a = rng.range(0, Math.PI * 2), d = rng.range(6.5, 10), x = c + Math.cos(a) * d, y = c + Math.sin(a) * d, cx = Math.floor(x), cy = Math.floor(y); if (inside(cx, cy) && PASSABLE[map.terrain[idx(cx, cy)]] && map.reach[idx(cx, cy)] && S.occ[idx(cx, cy)] < 0) return { x: cx + 0.5, y: cy + 0.5 }; }
    return null;
  }
  const partySize = () => PARTY.base + (keep.level >= 3 && !CUT.secondCompanion ? PARTY.keep3 : 0);   // the second companion slot is parked
  /** retune the live run (never mutates the shared DIFFICULTY table) */
  function setDifficulty(key) {
    if (!DIFFICULTY[key]) return false;
    G.DIFF = DIFFICULTY[key]; S.difficulty = key; G.dropFloor(); return true;
  }
  return { W8, weatherFor, rollWeather, checkFeatures, titlesRead, untitle, startSeason, finale, contractWon, setSeasonRules, setFinale, metroSpot, partySize, setDifficulty };
}
