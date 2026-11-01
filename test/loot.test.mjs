// [m3] Loot: every entry explains itself; a rolled weapon has its rarity's slots and one element at most;  scrap flies to Kai and is banked; weapons go in the bag on contact; equip
// from the bag (your old one goes in it); salvage pays; a ricochet pellet glances off a wall instead of stopping.
import '../tools/roam/headless.mjs';
import { test } from 'node:test';
import assert from 'node:assert';
import { RARITY, DROPS, MOD_POOL, rollWeapon, salvageOf, nameOf } from '../src/play/loot.js';
import { MODIFIERS } from '../src/play/modifiers.js';
import { WEAPONS } from '../src/play/parts/weapons.js';
import { Rng } from '../src/sim/rng.js';
const { buildTown } = await import('../src/roam/town.js');
const { createRoam } = await import('../src/roam/sim.js');
const town = buildTown(7);
test('every loot entry explains itself and points at real modifiers and bases', () => {
  for (const t of [RARITY, DROPS]) for (const [k, v] of Object.entries(t)) assert.ok(v.desc && v.why, k);
  for (const m of MOD_POOL) assert.ok(MODIFIERS[m.id], m.id);
  for (const id of ['scatter', 'launcher', 'thrower']) assert.ok(WEAPONS[id], id); });
test('a rolled weapon has its rarity\'s slots and one element at most', () => { const rng = new Rng(5);
  for (let i = 0; i < 400; i++) { const w = rollWeapon(rng, { common: 1, tuned: 1, rare: 1, epic: 1 }); assert.strictEqual(w.mods.length, RARITY[w.rarity].slots);
    assert.ok(w.mods.filter(m => MOD_POOL.find(p => p.id === m).element).length <= 1, w.mods.join()); } });
test('scrap flies to Kai and is banked; a weapon goes in the bag when she passes over it; equip and salvage from the bag', () => { const sim = createRoam(town, 3), S = sim.state; S.dead.length = 0; const k = S.kai;
  for (let i = 0; i < 5; i++) S.drops.push({ id: 5000 + i, kind: 'scrap', x: k.x + 4 + i, y: k.y, v: 1, t: S.t, fly: 0 });
  for (let i = 0; i < 60; i++) { S.dead.length = 0; sim.step({ x: 0, y: 0, view: 21 }); sim.drain(); } assert.strictEqual(S.scrap, 5, 'all five flew in');
  S.drops.push({ id: 6000, kind: 'weapon', x: k.x + 0.5, y: k.y, w: { base: 'launcher', rarity: 'rare', mods: ['double_shot', 'fire'], seed: 1 }, scanned: true, t: S.t });
  sim.step({ x: 0, y: 0, view: 21 }); assert.ok(S.bag.some(b => b.id === 6000), 'picked up into the bag');
  assert.ok(sim.equip(6000)); assert.strictEqual(S.guns.main.base, 'launcher'); assert.deepStrictEqual(S.guns.main.mods, ['double_shot', 'fire']);
  const old = S.bag.find(b => b.w.base === 'scatter'); assert.ok(old, 'the old weapon went in the bag');
  const p = salvageOf(old.w), s0 = S.scrap; assert.ok(sim.salvage(old.id)); assert.strictEqual(S.scrap, s0 + p.scrap); assert.ok(!S.bag.includes(old)); });
test('weapon names read prefix, base, suffix', () => { assert.strictEqual(nameOf({ base: 'launcher', mods: ['fire', 'faster'] }), 'Burning Launcher of Haste'); assert.strictEqual(nameOf({ base: 'scatter', mods: [] }), 'Scatter Gun'); });
test('a ricochet pellet glances off a wall', () => { const sim = createRoam(town, 3), S = sim.state; S.dead.length = 0; sim.setLoadout({ base: 'scatter', mods: ['ricochet'] });
  // face a wall a few metres away: find a free spot with a wall 3 m east
  let spot = null; for (let r = 5; r < 200 && !spot; r += 2) for (let a = 0; a < 6.28 && !spot; a += 0.3) { const x = S.kai.x + Math.cos(a) * r, y = S.kai.y + Math.sin(a) * r; if (!town.blocked(x, y) && !town.blocked(x + 1.5, y) && town.blocked(x + 3.5, y)) spot = { x, y }; }
  S.kai.x = S.bike.x = spot.x; S.kai.y = S.bike.y = spot.y; let bounced = false; const nb = () => S.shots.some(p => p.vx < 0);
  for (let i = 0; i < 20 && !bounced; i++) { S.dead.length = 0; sim.step({ x: 0, y: 0, view: 21, fire: true, aim: 0 }); sim.drain(); bounced = nb(); }
  assert.ok(bounced, 'a pellet turned back off the wall'); });
