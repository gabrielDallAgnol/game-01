// Saving: a dawn snapshot (what you built, chose and met; the dead are not saved) and restoring it.
// The format is SAVE_V (state.js); the road adds its own block (road.js attach).
import { N, T } from './mapgen.js';
import { SAVE_V } from './state.js';
import { heroKit } from '../content/heroes.js';

export function createSave(G) {
  const { S, biome, dropLive, houseCap, keep, map, mapSeed, mobById, pop, seed, syncMastery, syncPicks } = G;

  // ---------- saving: a dawn snapshot (what you built, chose and met; the dead are not saved) ----------
  const b64 = u8 => { let s2 = ''; for (let i = 0; i < u8.length; i += 8) { let v = 0; for (let k = 0; k < 8; k++) if (u8[i + k]) v |= 1 << k; s2 += String.fromCharCode(v); } return btoa(s2); };
  const unb64 = (str, n) => { const bin = atob(str), out = new Uint8Array(n); for (let i = 0; i < bin.length; i++) { const v = bin.charCodeAt(i); for (let k = 0; k < 8; k++) if (v & (1 << k) && i * 8 + k < n) out[i * 8 + k] = 1; } return out; };
  function snapshot() {
    if (S.phase !== 'day' || S.over) return null;
    return { v: SAVE_V, seed, mapSeed: mapSeed ?? seed, biome, hero: S.heroClass, mode: S.mode, difficulty: S.difficulty, clock: S.clock, city: map.name, savedAt: Date.now(),
      legacy: S.legacy, night: S.night, gold: S.gold, food: S.food, kills: S.kills, stock: S.stock, survivors: S.survivors, heat: S.heat, foreman: S.foreman, builders: S.builders, autopilot: !!S.autopilot,
      inferno: G.inferno ? G.inferno.save() : null, sealed: [...S.sealed], kits: S.kits, claimed: [...S.claimed], nestAlive: S.nestAlive, wake: S.wake.map(w => (Number.isFinite(w) ? w : -1)),
      P: S.P, picks: S.picks, chestsHeld: S.chestsHeld, dawns: S.dawns, weather: S.weather, reroll: S.reroll, halfUpgrade: S.halfUpgrade,
      landmarks: S.landmarks.map(l => [l.owned ? 1 : 0, l.kind, l.stripped ? 1 : 0]), seen: b64(S.seen), stats: S.stats, log: S.log.slice(-30),
      evo: S.evo, path: S.path, feat: S.feat, noiseChoice: S.noiseChoice || 0, mourned: S.mourned || 0, diffNight: S.diffNight || 0, tools: S.tools, carry: S.hero.carry, ledger: S.ledger || null, pickups: S.pickups, season: S.season, buildersWas: S.buildersWas ?? null, story: S.story, lvl: S.lvl, xp: S.xp, unique: S.unique || null, eruption: S.eruption, heatCool: S.heatCool, sawBlackout: !!S.sawBlackout, trade: S.trade, drained: S.drained, salvage: S.salvage, cleared: S.clearedIdx || [], trails: S.trails || [], nextId: S.nextId, handsUsed: S.handsUsed, dayT: S.dayT, inc: S.inc || null,
      buildings: S.buildings.map(b => [b.id, b.type, b.level, +b.x.toFixed(2), +b.y.toFixed(2), b.rot || 0, b.ruined ? 1 : 0, b.type === 'house' ? (b.folk ?? -1) : -1, b.spec || 0]), homeless: S.homeless || 0, keep: [keep.level, Math.ceil(keep.hp)], heroAt: [Math.ceil(S.hero.hp), +S.hero.x.toFixed(2), +S.hero.y.toFixed(2)], econ: S.econ ? JSON.parse(JSON.stringify(S.econ)) : null };   // [econ3] queue, carts, nodes, relics
  }
  function restoreSnap(R) {
    Object.assign(S, { night: R.night, gold: R.gold, food: R.food, kills: R.kills, stock: R.stock, survivors: R.survivors, heat: R.heat, foreman: R.foreman, builders: R.builders, autopilot: R.autopilot,
      kits: R.kits, claimed: new Set(R.claimed), nestAlive: R.nestAlive, wake: R.wake.map(w => (w < 0 ? Infinity : w)), P: R.P, picks: R.picks, chestsHeld: R.chestsHeld, dawns: R.dawns,
      weather: R.weather, reroll: R.reroll, halfUpgrade: R.halfUpgrade, stats: R.stats, log: R.log || [], evo: R.evo, pickups: R.pickups || [], path: R.path || S.path, feat: R.feat || {}, season: R.season || S.season, buildersWas: R.buildersWas ?? undefined, lvl: R.lvl || 1, xp: R.xp || 0, unique: R.unique || undefined, eruption: R.eruption || null, heatCool: R.heatCool || 0, sawBlackout: !!R.sawBlackout, trade: R.trade || null, drained: R.drained, salvage: R.salvage, clearedIdx: R.cleared, handsUsed: R.handsUsed, dayT: R.dayT, inc: R.inc || undefined });
    G.HC = heroKit(S.heroClass, S.evo && S.evo.calling);   // an advanced class is built on the Calling you took
    if (G.inferno) G.inferno.restore(R.inferno || {});   // [nest3] broken segments stay broken
    S.sealed = Uint8Array.from(R.sealed); S.sealVersion++;
    syncMastery();
    R.landmarks.forEach(([o, k, st], i) => { const l = S.landmarks[i]; if (l) { l.owned = !!o; l.kind = k; l.stripped = !!st; } });
    S.seen = unb64(R.seen, N * N); S.seenVersion++;
    for (const k of Object.keys(S.story)) delete S.story[k]; Object.assign(S.story, R.story);
    for (const e of S.story.encounters) if (!e.ai || typeof e.ai !== 'object') e.ai = null;
    for (const i of R.cleared || []) map.terrain[i] = map.terrain[i] === T.ROCK ? T.DIRT : T.GRASS;
    S.trails = G.makeTrail(R.trails || []); S.trailTold = S.trails.length > 0;   // [woods] worn trails
    for (const b of [...S.buildings]) G.removeBuilding(b);
    let oldFolk = false;
    for (const [id, type, level, x, y, rot, ru, folk, spec] of R.buildings) { const b = G.placeBuilding(type, x, y, rot, level, id); if (spec) b.spec = spec; if (ru) { b.ruined = true; b.hp = 0; G.vacate(b, true); } if (type === 'house') { if (folk === undefined) oldFolk = true; b.folk = folk >= 0 ? folk : ru ? 0 : houseCap(b); } }
    S.homeless = R.homeless || 0;
    if (oldFolk) {   // a save from before homes had families of their own: keep its head count (homes' capacity − the mourned)
      const was = S.survivors + S.buildings.reduce((a, b) => a + (b.type === 'house' ? houseCap(b) : 0), 0) - (R.mourned || 0), now = pop();
      if (was > now) S.homeless += was - now; else S.survivors = Math.max(0, S.survivors - (now - was));
    }
    Object.assign(S, { noiseChoice: R.noiseChoice || 0, mourned: R.mourned || 0, diffNight: R.diffNight || 0, tools: R.tools || { flare: 0, smoke: 0 }, ledger: R.ledger || null });
    if (R.carry) S.hero.carry = { scrap: R.carry.scrap || 0, food: R.carry.food || 0 };
    if (!S.season.rules) S.season.rules = S.season.rule ? [S.season.rule] : [];
    G.titlesRead((S.story.titles || []).length);
    S.nextId = Math.max(R.nextId, S.nextId);
    keep.level = R.keep[0]; keep.r = 2.3 * (1 + 0.12 * (keep.level - 1)); G.refreshMax(); keep.hp = Math.min(keep.maxHp, R.keep[1]);
    G.refreshMax(); S.hero.hp = Math.min(S.hero.maxHp, R.heroAt[0]); S.hero.x = R.heroAt[1]; S.hero.y = R.heroAt[2]; G.unstickHero();
    for (const m of S.mobs) mobById.delete(m.id); S.mobs.length = 0; S.animalsInit = false; S.projectiles.length = 0; S.drops = []; S.chests = []; S.purses = [];
    S.flowDirty = true; S.occVersion = (S.occVersion || 0) + 1; dropLive(); G.dropCrew();
    for (const n of S.story.npcs) if (n.withHero && n.alive && n.joined) G.spawnCompanion(n);   // a travelling companion comes back with you
    if (R.econ) { S.econ = R.econ; G.constructRestore(); G.haulRestore(); }   // [econ3]
    G.spawnRoamers(); G.spawnAnimals(); syncPicks(); G.rollOffer(); G.newLog(); S.events.length = 0; S.restored = true;
  }
  return { snapshot, restoreSnap };
}
