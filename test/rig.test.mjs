// [rig3] The Haven Rig (sim/rig.js, sim/migrate.js, sim/legmap.js): salvage shares, systems that rise with building
// tiers, packing up, the next act keeping the hero and the cargo, new seeds, the act theme, and the save across a move.
// Run with: node --test test/rig.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { migrateRun } from '../src/sim/migrate.js';
import { RIG } from '../src/content/rig.js';
import { BUILDINGS } from '../src/content/buildings.js';

const ready = () => { const g = createGame({ seed: 7, mapSeed: 307, biome: 'riverbend', hero: 'survivor' }); const S = g.state; S.handsExtra = 99; S.gold = 600; S.survivors = 30; return g; };
const spot = (g, type) => { const t = g.map.town; for (let r = 4; r < 18; r++) for (let a = 0; a < 32; a++) { const x = Math.floor(t.x + Math.cos(a / 32 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 32 * 6.28) * r) + 0.5; if (g.canPlace(type, x, y).ok) return { x, y }; } return null; };
const put = (g, type, level = 1) => { const p = spot(g, type); assert.ok(p, `no room for a ${type}`); assert.ok(g.build(type, p.x, p.y)); const b = g.state.buildings[g.state.buildings.length - 1]; b.level = level; b.built = 1; return b; };
const run = (g, sec) => { for (let k = 0; k < sec * 60; k++) g.step(); };
const openRoad = g => { g.state.act = 2; };
// one packed + migrated run, shared by the tests below (map generation is slow)
let moved = null;
function move() {
  if (moved) return moved;
  const g = ready(), S = g.state;
  S.lvl = 7; S.xp = 3; S.kills = 42; S.hero.stats = { STR: 4, AGI: 2, INT: 0, GOV: 10 }; S.hero.unspent = 2;
  put(g, 'house', 2); put(g, 'tower', 3); put(g, 'farm', 1);
  openRoad(g); run(g, 2);
  const before = { scrap: S.gold, food: S.food, preview: g.rigInfo().cargo };
  const cargo = g.rigPack();
  const g2 = migrateRun(g);
  moved = { g, g2, cargo, before };
  return moved;
}

test('salvage: 80% at level 1, more with tiers, Cargo and GOV, capped at 100%; a ruin gives half', () => {
  const g = ready(), S = g.state, s = RIG.salvage;
  const b1 = put(g, 'house', 1), b3 = put(g, 'house', 3);
  assert.equal(g.salvagePct(b1.id), s.base);
  assert.ok(Math.abs(g.salvagePct(b3.id) - (s.base + 2 * s.perLevel)) < 1e-9);
  S.rig.ups.cargo = 3; S.hero.stats = { GOV: 20 };
  assert.ok(Math.abs(g.salvagePct(b1.id) - Math.min(1, s.base + 3 * s.perCargo + 20 * s.perGov)) < 1e-9);
  S.hero.stats = { GOV: 500 }; assert.equal(g.salvagePct(b3.id), 1, 'salvage went past 100%');
  S.hero.stats = {}; S.rig.ups.cargo = 0; b1.ruined = true;
  assert.ok(Math.abs(g.salvagePct(b1.id) - s.base * s.ruin) < 1e-9);
  for (const id of [b1.id, b3.id]) { const p = g.salvagePct(id); assert.ok(p > 0 && p <= 1); }
});

test('the Rig grows with building tiers and never shrinks; plating and guns reach the keep', () => {
  const g = ready(), S = g.state, hp0 = S.keep.maxHp;
  assert.deepEqual(S.rig.ups, { plating: 0, guns: 0, cargo: 0, speed: 0 });
  for (let k = 0; k < 3; k++) put(g, 'house', 2);
  put(g, 'tower', 3);
  run(g, 1.5);
  assert.ok(S.rig.ups.plating >= 1, 'plating did not rise'); assert.ok(S.rig.ups.guns >= 1, 'guns did not rise');
  assert.equal(S.keep.maxHp, Math.round(hp0 * (1 + RIG.hpPer * S.rig.ups.plating)));
  const ups = { ...S.rig.ups };
  for (const b of [...S.buildings]) g.demolish(b.id);
  run(g, 1.5);
  assert.deepEqual(S.rig.ups, ups, 'the Rig lost an upgrade');
  const info = g.rigInfo(); assert.equal(info.ups.length, 4);
  for (const u of info.ups) assert.ok(u.name && u.src && u.fx && u.max === 3);
});

test('the road must be open, and only by day', () => {
  const g = ready(), S = g.state;
  if (g.act() < 2) { assert.match(g.rigBlock(), /road/i); assert.equal(g.rigPack(), null); }
  openRoad(g); S.phase = 'night'; assert.match(g.rigBlock(), /night/i);
  S.phase = 'day'; assert.equal(g.rigBlock(), '');
});

test('packing up: every building salvaged into the cargo, families ride along', () => {
  const { g, cargo, before } = move(), S = g.state;
  assert.equal(S.buildings.length, 0); assert.equal(S.rig.mode, 'rolling');
  const cost = (t, l) => BUILDINGS[t].cost.slice(0, l).reduce((a, b) => a + b, 0), total = cost('house', 2) + cost('tower', 3) + cost('farm', 1);
  assert.ok(cargo.salvaged >= Math.floor(total * 0.8) && cargo.salvaged <= total, `salvaged ${cargo.salvaged} of ${total}`);
  assert.equal(cargo.scrap, before.scrap + cargo.salvaged); assert.equal(cargo.food, before.food);
  assert.ok(S.homeless >= BUILDINGS.house.pop[0], "the family stayed behind");
  assert.ok(S.events.some(e => e.t === 'rigMigrate'));
});

test('migration: a new act with new seeds and theme; the hero, stats and cargo ride along', () => {
  const { g, g2, cargo } = move(), S = g.state, S2 = g2.state;
  assert.notEqual(g2.map.seed, g.map.seed); assert.notEqual(S2.seed, S.seed);
  assert.equal(S2.rig.leg, 2); assert.equal(g2.map.leg, 2); assert.ok(g2.map.decor.length > 0, 'the rail yard has no props'); assert.ok(g2.map.rail);
  assert.equal(S2.lvl, 7); assert.equal(S2.kills, 42); assert.deepEqual(S2.hero.stats, { STR: 4, AGI: 2, INT: 0, GOV: 10 }); assert.equal(S2.hero.unspent, 2);
  assert.equal(S2.gold, cargo.scrap); assert.equal(S2.food, cargo.food); assert.equal(S2.night, S.night);
  assert.equal(S2.buildings.length, 0); assert.equal(S2.phase, 'day');
  assert.ok(S2.rig.mode === 'arriving' || S2.rig.mode === 'anchored');
  const evs = S2.events.map(e => e.t); assert.ok(evs.includes('rigAnchor') && evs.includes('actStart'));
  assert.equal(S2.story.encounters.length, 0);
  run(g2, RIG.anim.unpack + 0.5); assert.equal(S2.rig.mode, 'anchored');
  assert.ok(!S2.over);
});

test('a moved run saves and loads: the same act, map and cargo', () => {
  const { g2 } = move(), S2 = g2.state;
  const snap = g2.snapshot(); assert.ok(snap); assert.equal(snap.rig.v, RIG.v); assert.equal(snap.rig.leg, 2);
  const json = JSON.parse(JSON.stringify(snap));
  const g3 = createGame({ seed: json.seed, mapSeed: json.mapSeed, biome: json.biome, hero: json.hero, difficulty: json.difficulty, restore: json, legacy: json.legacy });
  const S3 = g3.state;
  assert.equal(S3.rig.leg, 2); assert.equal(g3.map.leg, 2); assert.equal(g3.map.decor.length, g2.map.decor.length);
  assert.equal(S3.gold, S2.gold); assert.equal(S3.lvl, S2.lvl); assert.deepEqual(S3.rig.ups, S2.rig.ups);
  // an old save (no rig block) loads as act 1
  const old = { ...json }; delete old.rig;
  const g4 = createGame({ seed: old.seed, mapSeed: old.mapSeed, biome: old.biome, hero: old.hero, restore: old });
  assert.equal(g4.state.rig.leg, 1);
});
