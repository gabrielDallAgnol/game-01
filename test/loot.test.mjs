// [m3] Loot: every entry explains itself; a rolled weapon has its rarity's slots and one element at most; a nest always
// drops a tuned-or-better weapon and chips; scrap slides to Kai and is banked; equip swaps (your old weapon is left on the
// ground); salvage pays; a ricochet pellet glances off a wall instead of stopping.
import '../tools/roam/headless.mjs';
import { test } from 'node:test';
import assert from 'node:assert';
import { RARITY, DROPS, MOD_POOL, rollWeapon, salvageOf } from '../src/play/loot.js';
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
test('a nest drops chips and a tuned-or-better weapon', () => { const sim = createRoam(town, 3), S = sim.state; S.dead.length = 0;
  const n = S.nests[0]; S.kai.x = S.bike.x = n.x + 40; S.kai.y = S.bike.y = n.y; const before = S.drops.length;
  n.hp = 0.1;   // one hit breaks it: stand by it and fire
  S.kai.x = S.bike.x = n.x + 6; S.kai.y = S.bike.y = n.y; for (let i = 0; i < 30 * 8 && n.alive; i++) { S.dead.length = 0; sim.step({ x: 0, y: 0, view: 21, fire: true }); sim.drain(); }
  assert.ok(!n.alive, 'nest down'); assert.ok(S.chips >= 2); const w = S.drops.filter(d => d.kind === 'weapon'); assert.ok(w.length >= 1 && w.every(d => d.w.rarity !== 'common')); assert.ok(S.drops.length > before); });
test('scrap slides to Kai and is banked; equip swaps; salvage pays', () => { const sim = createRoam(town, 3), S = sim.state; S.dead.length = 0; const k = S.kai;
  for (let i = 0; i < 5; i++) S.drops.push({ id: 5000 + i, kind: 'scrap', x: k.x + 2 + i * 0.3, y: k.y, v: 1, t: S.t });
  for (let i = 0; i < 60; i++) { S.dead.length = 0; sim.step({ x: 0, y: 0, view: 21 }); sim.drain(); } assert.strictEqual(S.scrap, 5);
  S.drops.push({ id: 6000, kind: 'weapon', x: k.x + 1, y: k.y, w: { base: 'launcher', rarity: 'rare', mods: ['double_shot', 'fire'], seed: 1 }, scanned: true, t: S.t });
  assert.ok(sim.equip(6000)); assert.strictEqual(S.guns.main.base, 'launcher'); assert.deepStrictEqual(S.guns.main.mods, ['double_shot', 'fire']);
  const old = S.drops.find(d => d.kind === 'weapon' && d.w.base === 'scatter'); assert.ok(old, 'the old weapon lies where the new one was');
  const p = salvageOf(old.w), s0 = S.scrap; assert.ok(sim.salvage(old.id)); assert.strictEqual(S.scrap, s0 + p.scrap); assert.ok(!S.drops.includes(old)); });
test('a ricochet pellet glances off a wall', () => { const sim = createRoam(town, 3), S = sim.state; S.dead.length = 0; sim.setLoadout({ base: 'scatter', mods: ['ricochet'] });
  // face a wall a few metres away: find a free spot with a wall 3 m east
  let spot = null; for (let r = 5; r < 200 && !spot; r += 2) for (let a = 0; a < 6.28 && !spot; a += 0.3) { const x = S.kai.x + Math.cos(a) * r, y = S.kai.y + Math.sin(a) * r; if (!town.blocked(x, y) && !town.blocked(x + 1.5, y) && town.blocked(x + 3.5, y)) spot = { x, y }; }
  S.kai.x = S.bike.x = spot.x; S.kai.y = S.bike.y = spot.y; let bounced = false; const nb = () => S.shots.some(p => p.vx < 0);
  for (let i = 0; i < 20 && !bounced; i++) { S.dead.length = 0; sim.step({ x: 0, y: 0, view: 21, fire: true, aim: 0 }); sim.drain(); bounced = nb(); }
  assert.ok(bounced, 'a pellet turned back off the wall'); });
