// [m6] The garage: the town's own garage site is a workbench; banked recipes are learned; building costs banked scrap and
// chips; parts change the bike (a racer engine is faster); upgrades are capped by Kai's level; a mod goes into a socket
// for good (over an old one, the old one is gone); one element per weapon; the weapon's level is its damage.
import '../tools/roam/headless.mjs';
import { test } from 'node:test';
import assert from 'node:assert';
import { RECIPES, STARTING } from '../src/play/recipes.js';
import { PARTS } from '../src/play/parts/bike.js';
import { SITES } from '../src/play/sites.js';
import { MODIFIERS } from '../src/play/modifiers.js';
const { buildTown } = await import('../src/roam/town.js');
const { createRoam, ROAM } = await import('../src/roam/sim.js');
const town = buildTown(7);
const fresh = () => { const sim = createRoam(town, 3), S = sim.state; S.dead.length = 0; return { sim, S }; };
const step = (sim, n = 1, inp = {}) => { for (let i = 0; i < n; i++) { sim.state.dead.length = 0; sim.step({ x: 0, y: 0, view: 21, ...inp }); sim.drain(); } };
const toGarage = (sim, S) => { const g = S.sites.find(q => q.kind === 'garage'); S.kai.x = S.bike.x = g.x; S.kai.y = S.bike.y = g.y; S.bike.speed = 0; step(sim); return g; };
test('every recipe, part and site explains itself and points at real things', () => {
  for (const r of Object.values(RECIPES)) { assert.ok(r.desc && r.why, r.id); if (r.kind === 'mod') assert.ok(MODIFIERS[r.mod], r.id); if (r.kind === 'part') assert.ok(PARTS[r.part], r.id); if (r.kind === 'weapon') assert.strictEqual(r.mods.length + r.sockets, { common: 0, tuned: 1, rare: 2, epic: 3 }[r.rarity], r.id); }
  for (const p of Object.values(PARTS)) assert.ok(p.desc && p.why, p.id); for (const s of Object.values(SITES)) assert.ok(s.desc && s.why, s.id);
  for (const id of STARTING) assert.ok(RECIPES[id], id); });
test('the garage stands on the town\'s own garage site and is a workbench; elsewhere you cannot build', () => { const { sim, S } = fresh();
  const g = S.sites.find(q => q.kind === 'garage'), site = town.W.sites.find(s => s.id === 'garage'); assert.ok(g); assert.ok(Math.hypot(g.x - site.x, g.y - site.y) < 30, 'on the garage site');
  S.bank.scrap = 999; assert.strictEqual(sim.build('scatter'), false, 'not at the camp'); toGarage(sim, S); assert.ok(sim.atBench()); assert.ok(sim.build('scatter')); });
test('banking learns carried recipes; building costs banked scrap and chips; a part changes the bike', () => { const { sim, S } = fresh(); toGarage(sim, S);
  S.carry.push('part_engine_racer'); step(sim); assert.ok(S.known.includes('part_engine_racer'), 'learned');
  S.bank.scrap = 50; S.bank.chips = 0; assert.strictEqual(sim.build('part_engine_racer'), false, 'too poor'); S.bank.scrap = 200; S.bank.chips = 4;
  assert.ok(sim.build('part_engine_racer')); assert.strictEqual(S.bank.scrap, 110); assert.strictEqual(S.bank.chips, 2);
  const it = S.stash.find(q => q.r === 'part_engine_racer'), top0 = sim.bikeStats().top; assert.ok(sim.equipItem(it.uid)); assert.ok(sim.bikeStats().top > top0, 'faster');
  assert.ok(S.stash.some(q => q.r === 'part_engine_stock'), 'the old engine went to the stash'); });
test('a plated frame raises the bike\'s health, keeping how hurt it is', () => { const { sim, S } = fresh(); toGarage(sim, S); S.known.push('part_frame_plated'); S.bank.scrap = 99; S.bank.chips = 9;
  S.bike.hp = 50; sim.build('part_frame_plated'); sim.equipItem(S.stash[0].uid); assert.strictEqual(S.bike.maxHp, 150); assert.ok(Math.abs(S.bike.hp - 75) < 1, `hp ${S.bike.hp}`); });
test('upgrades cost banked scrap and stop at the level cap; the weapon\'s level is its damage', () => { const { sim, S } = fresh(); toGarage(sim, S); S.bank.scrap = 9999;
  const cap = sim.levelCap(); assert.strictEqual(cap, ROAM.garage.capPerLevel); for (let i = 0; i < 10; i++) sim.upgrade('weapon');
  assert.strictEqual(S.gear.weapon.level, cap); assert.strictEqual(sim.upgrade('weapon'), false, 'capped');
  // the damage: fire once and read the pellet's damage
  S.kai.x = S.bike.x = town.start.x + 0.8; S.kai.y = S.bike.y = town.start.y + 6.2; S.shots.length = 0;
  // (off the garage lot: the gun is quiet there)
  for (let i = 0; i < 3 && !S.shots.length; i++) step(sim, 1, { fire: true, aim: 0 });
  const p = S.shots[0]; assert.ok(p && Math.abs(p.dmg - 1.4 * (1 + ROAM.garage.dmgPerLevel * (cap - 1))) < 1e-6, p && p.dmg); });
test('a mod goes into a socket for good; over an old one, the old one is destroyed; one element per weapon', () => { const { sim, S } = fresh(); toGarage(sim, S); S.bank.scrap = 999; S.bank.chips = 99;
  S.known.push('scatter_wide', 'mod_fire', 'mod_water', 'mod_ricochet'); sim.build('scatter_wide'); const w = S.stash.find(q => q.r === 'scatter_wide'); sim.equipItem(w.uid);
  sim.build('mod_fire'); sim.build('mod_water'); sim.build('mod_ricochet'); sim.build('mod_ricochet');
  assert.ok(sim.socket(w.uid, 0, 'fire')); assert.deepStrictEqual(S.gear.weapon.sockets, ['fire', null]); assert.deepStrictEqual(S.guns.main.mods, ['fire']);
  assert.strictEqual(sim.socket(w.uid, 1, 'water'), false, 'a second element is refused');
  assert.ok(sim.socket(w.uid, 1, 'ricochet')); assert.ok(sim.socket(w.uid, 0, 'ricochet'), 'over the fire mod'); assert.deepStrictEqual(S.gear.weapon.sockets, ['ricochet', 'ricochet']);
  assert.ok(!(S.mods.fire > 0), 'the fire mod is gone, not returned'); });
test('a recipe Kai carries goes into the death cache', () => { const { sim, S } = fresh(); let far = null;
  for (let r = 60; r < 300 && !far; r += 5) for (let a = 0; a < 6.28 && !far; a += 0.3) { const x = S.kai.x + Math.cos(a) * r, y = S.kai.y + Math.sin(a) * r; if (!town.blocked(x, y) && S.sites.every(q => Math.hypot(q.x - x, q.y - y) > 20)) far = { x, y }; }
  S.kai.x = S.bike.x = far.x; S.kai.y = S.bike.y = far.y; S.carry.push('hose'); S.kai.hp = 1; S.bike.hp = 0; S.bolts.push({ x: S.kai.x, y: S.kai.y, vx: 0, vy: 0, r: 0.4, dmg: 10, life: 1 });
  step(sim, 5); assert.ok(S.kai.dead > 0); assert.deepStrictEqual(S.cache.recipes, ['hose']); assert.strictEqual(S.carry.length, 0); });
test('the garage lot is safe ground: a machine is turned back at its edge and nothing is born on it', () => { const { sim, S } = fresh(); const g = toGarage(sim, S), L = g.lot;
  const d = sim.debug.spawn('crawler', g.x + 1.5, g.y); d.state = 'chase';
  for (let i = 0; i < 30; i++) { sim.step({ x: 0, y: 0, view: 21 }); sim.drain(); }
  const c = Math.cos(-L.rot), s = Math.sin(-L.rot), u = c * (d.x - L.x) - s * (d.y - L.y), v = s * (d.x - L.x) + c * (d.y - L.y);
  assert.ok(Math.abs(u) >= L.w / 2 || Math.abs(v) >= L.h / 2, 'outside the lot'); assert.notStrictEqual(d.state, 'chase');
  assert.strictEqual(g.dress.filter(q => q.k === 'lotlamp').length, 4, 'a lamp at each corner'); });
test('the drive-in: GARAGE rides the bike into the bay at the same angle every time, closing rides it out; no control meanwhile', () => { const { sim, S } = fresh(); const g = toGarage(sim, S);
  S.bike.ang = 2.2; assert.ok(sim.enterGarage()); const ev = []; for (let i = 0; i < 70; i++) { S.dead.length = 0; sim.step({ x: 1, y: 1, view: 21, fire: true }); ev.push(...sim.drain()); }
  assert.ok(ev.some(e => e.type === 'parked')); assert.strictEqual(S.garageRun.phase, 'parked'); assert.ok(Math.abs(S.bike.ang - ROAM.garage.bayAng) < 1e-6, 'the bay angle');
  assert.ok(Math.hypot(S.bike.x - g.bay.x, S.bike.y - g.bay.y) < 1e-6, 'in the bay'); assert.ok(!ev.some(e => e.type === 'shot'), 'no control while it rides in');
  assert.ok(sim.leaveGarage()); for (let i = 0; i < 160; i++) { S.dead.length = 0; sim.step({ x: 0, y: 0, view: 21 }); sim.drain(); }
  assert.strictEqual(S.garageRun, null); assert.ok(Math.hypot(S.bike.x - g.exit.x, S.bike.y - g.exit.y) < 3, 'rolled out'); });
test('the lot is fenced with one gate: shut it is a wall, it opens for the drive-in; GARAGE is at the gate', () => { const { sim, S } = fresh(); const g = S.sites.find(q => q.kind === 'garage'), G = g.gate;
  assert.ok(G && g.fence.length >= 4, 'a fence and a gate'); assert.ok(town.blocked(G.x, G.y), 'shut: a wall');
  S.kai.x = S.bike.x = g.entry.x; S.kai.y = S.bike.y = g.entry.y; sim.step({ x: 0, y: 0, view: 21 }); sim.drain(); assert.ok(sim.atGate(), 'GARAGE at the gate');
  assert.ok(sim.enterGarage()); let parked = false; for (let i = 0; i < 200 && !parked; i++) { S.dead.length = 0; sim.step({ x: 0, y: 0, view: 21 }); parked = sim.drain().some(e => e.type === 'parked'); if (i === 5) assert.ok(!town.blocked(G.x, G.y), 'open for the drive-in'); }
  assert.ok(parked, 'parked in the bay'); assert.ok(Math.hypot(S.bike.x - g.bay.x, S.bike.y - g.bay.y) < 1e-6); });
