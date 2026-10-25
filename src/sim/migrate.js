// [rig3] Moving the run to the next act: after the Haven Rig packed up (api.rigPack), build the next act's game: a new
// seed and map seed, the act's theme (sim/legmap.js), and everything that rides along (who you are, what you hold, the
// story so far). The UI swaps its game and view for the result; bots and tests just carry on with it.
// Separate from game.js so game.js never imports it (no import cycle).
import { createGame } from './game.js';
import { generateMap, validateMap } from './mapgen.js';
import { hashSeed } from './rng.js';
import { themeMap } from './legmap.js';
import { RIG_CARRY } from '../content/rig.js';

// what of S rides along (JSON-safe: the same fields a save holds)
const CARRY = ['night', 'dawns', 'kills', 'lvl', 'xp', 'evo', 'path', 'P', 'picks', 'chestsHeld', 'reroll', 'halfUpgrade', 'stats', 'feat', 'season', 'diffNight', 'tools', 'autopilot', 'builders', 'buildersWas', 'foreman', 'survivors', 'mourned', 'log', 'legacy'];
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** the next act's map: the first of a few seeds whose themed map passes validateMap (else the first); { seed, map } */
export function nextMap(mapSeed, biome, leg) {
  let first = null;
  for (let tries = 0; tries < 6; tries++) {
    const s = hashSeed(mapSeed, 'act', leg, tries) % 1000000, m = themeMap(generateMap(s, biome), leg);
    if (!first) first = { seed: s, map: m };
    if (!validateMap(m).length) return { seed: s, map: m };
  }
  return first;
}

/** what rides along from a packed run (api.rigPack() must have run: S.rig.mode is 'rolling') */
export function packCarry(api) {
  const S = api.state, C = { S: {}, hero: {} };
  for (const k of CARRY.concat(RIG_CARRY)) if (S[k] !== undefined) C.S[k] = clone(S[k]);
  for (const k of Object.keys(S.hero)) { const v = S.hero[k]; if (typeof v !== 'function') C.hero[k] = clone(v); }
  C.story = clone(S.story); C.rig = clone(S.rig); C.homeless = S.homeless || 0; C.keepLvl = S.keep.level;
  return C;
}

/** the next act's game. `opts`: { seed, mapSeed } to force them (tests) */
export function migrateRun(api, opts = {}) {
  const S = api.state;
  if (!S.rig || S.rig.mode !== 'rolling') throw new Error('migrateRun: pack the Rig first (api.rigPack)');
  const leg = (S.rig.leg || 1) + 1, carry = packCarry(api), biome = api.map.biome;
  const seed = opts.seed ?? hashSeed(S.seed, 'act', leg) % 1000000;
  const nm = opts.mapSeed !== undefined ? { seed: opts.mapSeed, map: null } : nextMap(api.map.seed, biome, leg);
  return createGame({ seed, mapSeed: nm.seed, biome, hero: S.heroClass, mode: S.mode, clock: S.clock, difficulty: S.difficulty, legacy: S.legacy, carry, leg, premap: nm.map });
}
