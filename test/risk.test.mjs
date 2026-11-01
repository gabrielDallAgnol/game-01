// [m5] Risk and repair: the bike soaks hits while Kai rides and never mends by itself; scrap mends it (slowly in the field,
// only when it's safe; fast at a bank); a bank keeps what she carries; going down drops it as a cache she can take back.
import '../tools/roam/headless.mjs';
import { test } from 'node:test';
import assert from 'node:assert';
const { buildTown } = await import('../src/roam/town.js');
const { createRoam, ROAM } = await import('../src/roam/sim.js');
const town = buildTown(7);
const fresh = () => { const sim = createRoam(town, 3), S = sim.state; S.dead.length = 0; return { sim, S }; };
const quiet = S => { S.dead.length = 0; };
const run = (sim, s, inp = {}) => { const evs = []; for (let i = 0; i < s * 30; i++) { quiet(sim.state); sim.step({ x: 0, y: 0, view: 21, ...inp }); evs.push(...sim.drain()); } return evs; };
// a clear spot away from the garage
const away = S => { for (let r = 40; r < 200; r += 5) for (let a = 0; a < 6.28; a += 0.3) { const x = S.kai.x + Math.cos(a) * r, y = S.kai.y + Math.sin(a) * r; if (!town.blocked(x, y) && !town.blocked(x + 1, y) && !town.blocked(x - 1, y)) return { x, y }; } };
const put = (S, p) => { S.kai.x = S.bike.x = p.x; S.kai.y = S.bike.y = p.y; S.bike.speed = 0; };

test('the bike takes most of a hit while Kai rides, and does not mend by itself', () => { const { sim, S } = fresh(); put(S, away(S));
  S.kai.hp = 100; const k0 = S.kai.hp;
  S.kai.riding = true; const b0 = S.bike.hp;
  // a machine's bolt right on her (the rules' own hurt path)
  S.bolts.push({ x: S.kai.x, y: S.kai.y, vx: 0, vy: 0, r: 0.4, dmg: 10, life: 1 });
  run(sim, 0.2); assert.ok(S.bike.hp < b0, 'bike took it'); assert.ok(b0 - S.bike.hp >= 6.9, `bike took ${b0 - S.bike.hp}`); assert.ok(S.kai.hp >= k0 - 3.1, 'Kai took the rest');
  const b1 = S.bike.hp; run(sim, 20); assert.strictEqual(S.bike.hp, b1, 'no self-repair'); });

test('a wrecked bike limps', () => { const { sim, S } = fresh(); put(S, away(S)); S.bike.hp = 0;
  let top = 0; for (let i = 0; i < 30 * 4; i++) { quiet(S); sim.step({ x: 1, y: 0, view: 21 }); sim.drain(); top = Math.max(top, S.bike.speed); }
  assert.ok(top <= ROAM.bike.top * ROAM.risk.limp + 1e-6, `top ${top}`); });

test('a field repair costs scrap, stops when the stick moves, and finishes the job', () => { const { sim, S } = fresh(); put(S, away(S));
  S.bike.hp = 50; S.scrap = 5; assert.ok(sim.repair(), 'started'); run(sim, 1); assert.ok(S.bike.hp > 50 && S.scrap < 5, 'mending, paying');
  run(sim, 0.2, { x: 1 }); assert.strictEqual(S.bike.fixing, false, 'the stick stops it');
  S.bike.speed = 0; S.bike.hp = 90; S.scrap = 10; sim.repair(); const evs = run(sim, 3); assert.strictEqual(S.bike.hp, 100); assert.ok(evs.some(e => e.type === 'fixed')); assert.ok(S.scrap >= 7, `paid ${10 - S.scrap}`);
  S.bike.hp = 40; S.scrap = 0; assert.strictEqual(sim.repair(), false, 'no scrap, no repair'); });

test('no field repair with a machine close', () => { const { sim, S } = fresh(); put(S, away(S)); S.bike.hp = 40; S.scrap = 20;
  const d = sim.debug.spawn('crawler', S.kai.x + 4, S.kai.y); if (d) d.state = 'chase'; assert.strictEqual(sim.repair(), false); });

test('a bank keeps what she carries and mends the bike from the bank', () => { const { sim, S } = fresh(); S.scrap = 30; S.chips = 2; S.bike.hp = 60;
  put(S, { x: town.start.x + 1, y: town.start.y + 1 }); run(sim, 2);
  assert.strictEqual(S.scrap, 0); assert.strictEqual(S.bank.chips, 2); assert.strictEqual(S.bike.hp, 100); assert.strictEqual(S.bank.scrap, 30 - 10); });

test('going down drops a cache; riding over it takes it back; a second death loses the first', () => { const { sim, S } = fresh(); const p = away(S); put(S, p);
  S.scrap = 12; S.chips = 1; S.bike.hp = 0; S.kai.hp = 1;
  S.bolts.push({ x: S.kai.x, y: S.kai.y, vx: 0, vy: 0, r: 0.4, dmg: 10, life: 1 });
  run(sim, 0.2); assert.ok(S.kai.dead > 0, 'down'); assert.ok(S.cache && S.cache.scrap === 12 && S.cache.chips === 1); assert.strictEqual(S.scrap, 0);
  run(sim, 4); assert.ok(!S.kai.dead, 'back'); assert.ok(S.bike.hp >= 25, 'towed in, patched');
  put(S, p); run(sim, 0.2); assert.strictEqual(S.cache, null); assert.strictEqual(S.scrap, 12);
  // two deaths: the first cache is lost
  S.kai.hp = 1; S.bike.hp = 0; S.bolts.push({ x: S.kai.x, y: S.kai.y, vx: 0, vy: 0, r: 0.4, dmg: 10, life: 1 }); run(sim, 4.5);
  const q = away({ kai: { x: p.x + 30, y: p.y } }) || p; put(S, q); S.scrap = 3; S.kai.hp = 1; S.bike.hp = 0; S.bolts.push({ x: S.kai.x, y: S.kai.y, vx: 0, vy: 0, r: 0.4, dmg: 10, life: 1 });
  const evs = run(sim, 0.2); assert.ok(evs.some(e => e.type === 'cacheLost')); assert.strictEqual(S.cache.scrap, 3); });
