// [roam] The rules of Hollowmere Roam (the composition root: the constants, the state, the loop; each system is a module in
// src/roam/sim/): Kai walks or rides the town, the dead sleep, wander and chase,
// nests breed them and have a heart to break, the day turns to night (more dead, faster, hungrier). No base, no
// building. Deterministic: one Rng stream, a fixed step; the renderer and the UI only read `state` and send `input`.
import { Rng, hashSeed } from '../sim/rng.js';
import { createFoes } from './sim/foes.js';
import { createNests } from './sim/nests.js';
import { createVehicle } from './sim/vehicle.js';
import { createKai } from './sim/kai.js';

const MODULES = [createFoes, createNests, createVehicle, createKai];

export const ROAM = {
  step: 1 / 30, day: 240, night: 120,
  kai: { hp: 100, speed: 4.4, reach: 1.8, dmg: 1.6, swing: 0.42, regen: 3, regenAfter: 4, respawn: 3 },
  dash: { dist: 4.2, time: 0.22, cd: 1.2 },
  bike: { top: 14, accel: 9, brake: 14, turn: 2.6, ram: 6, ramDmg: 4, enter: 2.6 },
  dead: { cinder: { hp: 4, speed: 1.15, dmg: 7 }, flicker: { hp: 2.5, speed: 2.1, dmg: 5 }, brute: { hp: 12, speed: 0.85, dmg: 14 },
    bite: 1.1, windup: 0.35, reach: 1.05, sense: [12, 20], nightSpeed: 1.3, cap: [30, 70], near: 70, far: 110 },
  nest: { hp: 40, guards: 7, every: 7, nightEvery: 3.5 },
};

export function createRoam(town, seed = 1) {
  const R = ROAM, rng = new Rng(hashSeed(seed, 'roam'));
  const S = {
    t: 0, clock: 40, clockRate: 1, night: false, kills: 0, nestsLeft: town.nests.length, won: false, events: [],
    kai: { x: town.start.x + 3, y: town.start.y + 5, vx: 0, vy: 0, face: 0, hp: R.kai.hp, maxHp: R.kai.hp, cd: 0, swing: 0, hurtT: -9, dead: 0, dash: 0, dashCd: 0, riding: false },
    bike: { x: town.start.x + 0.8, y: town.start.y + 6.2, ang: 0, speed: 0 },
    broken: new Set(),   // the small props the bike has smashed (their ids in town.breakables)
    dead: [], nests: town.nests.map((n, id) => ({ id, x: n.x, y: n.y, b: n.b, hp: R.nest.hp, maxHp: R.nest.hp, alive: true, spawnT: rng.range(0, 4), hit: -9 })),
  };
  const G = { R, S, rng, town, ev: (type, o) => S.events.push({ type, ...o }), dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y), view: 0 };
  // the systems, each a module; the order they are made in is fixed (append new ones at the end)
  for (const make of MODULES) make(G);
  // ---------- the loop ----------
  let popT = 0;
  function step(inp) {
    G.view = Math.min(160, inp.view || 0);
    const dt = R.step; S.t += dt; S.clock += dt * S.clockRate;   // the clock alone can run fast (a test control): the dead and Kai keep their pace
    const night = S.clock % (R.day + R.night) >= R.day; if (night !== S.night) { S.night = night; G.ev(night ? 'dusk' : 'dawn', {}); }
    G.stepKai(dt, inp); G.stepFoes(dt); G.stepNests(dt);
    if ((popT -= dt) <= 0) { popT = 1; G.populate(); }
  }
  for (let k = 0; k < 6; k++) G.populate();
  const setClockRate = r => { S.clockRate = Math.max(1, Math.min(60, r)); };
  return { state: S, step, setClockRate, drain: () => S.events.splice(0), dayPhase: () => { const c = S.clock % (R.day + R.night); return S.night ? { night: true, left: R.day + R.night - c } : { night: false, left: R.day - c }; } };
}
