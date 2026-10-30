// [roam] The rules of Hollowmere Roam (the composition root: the constants, the state, the loop; each system is a module in
// src/roam/sim/): Kai rides the town and guns down the machines,
// which sleep, wander and chase; nests breed them and have a heart to break, the day turns to night (more dead, faster, hungrier). No base, no
// building. Deterministic: one Rng stream, a fixed step; the renderer and the UI only read `state` and send `input`.
import { Rng, hashSeed } from '../sim/rng.js';
import { createFoes } from './sim/foes.js';
import { createNests } from './sim/nests.js';
import { createVehicle } from './sim/vehicle.js';
import { createKai } from './sim/kai.js';
import { createGuns } from './sim/guns.js';
import { createBolts } from './sim/bolts.js';
import { createHunts } from './sim/hunts.js';
import { createChem } from './sim/chem.js';
import { MACHINES } from '../play/machines.js';

const MODULES = [createFoes, createNests, createVehicle, createKai, createGuns, createBolts, createHunts, createChem];

export const ROAM = {
  step: 1 / 30, day: 240, night: 120,
  kai: { hp: 100, speed: 4.4, reach: 1.8, dmg: 1.6, swing: 0.42, regen: 1.5, regenAfter: 6, respawn: 3 },   // [m1] slow regen: a hit costs you
  dash: { dist: 4.2, time: 0.22, cd: 1.2 },
  bike: { top: 14, accel: 9, brake: 14, turn: 2.6, ram: 6, ramDmg: 4, enter: 2.6 },
  gun: { hitR: 0.6, heartR: 1.6, push: 2.2, noise: 30 },
  // the machines (code id `dead` kept from the Roam prototype; caps 42/75 > 24/46 after Gabriel's playtest: too crowded): the crawler is M1's one machine
  dead: { ...MACHINES,   // [m1] crawler, skitter, hound, spitter, brute (src/play/machines.js)
    bite: 1.1, windup: 0.35, reach: 1.05, rideReach: 1.6, sense: [16, 22], nightSpeed: 1.3, cap: [24, 46], alarm: 14, catchUp: 1.2, near: 70, far: 110 },
  hunt: { boil: 14, cool: 1.3, perShot: 1, size: [3, 5], nightExtra: 2, twoSides: 0.25 },   // [m1] gunfire heat → hunting packs
  chem: { stainR: 1.3, slick: 0.45, slickR: [1.1, 1.7], slickLife: 40, fireGrow: 0.8, fireTime: 6 },   // [m2] oil and fire on the ground
  nest: { hp: 120, guards: 7, every: 7, nightEvery: 3.5 },
};

export function createRoam(town, seed = 1) {
  const R = ROAM, rng = new Rng(hashSeed(seed, 'roam'));
  const S = {
    t: 0, clock: 40, clockRate: 1, night: false, kills: 0, nestsLeft: town.nests.length, won: false, events: [],
    kai: { x: town.start.x + 0.8, y: town.start.y + 6.2, vx: 0, vy: 0, face: 0, hp: R.kai.hp, maxHp: R.kai.hp, cd: 0, swing: 0, hurtT: -9, dead: 0, dash: 0, dashCd: 0, riding: true },   // she starts on the bike (on foot comes later)
    bike: { x: town.start.x + 0.8, y: town.start.y + 6.2, ang: 0, speed: 0 },
    broken: new Set(),   // the small props the bike has smashed (their ids in town.breakables)
    dead: [], nests: town.nests.map((n, id) => ({ id, x: n.x, y: n.y, b: n.b, hp: R.nest.hp, maxHp: R.nest.hp, alive: true, spawnT: rng.range(0, 4), hit: -9 })),
  };
  const G = { R, S, rng, town, seed, ev: (type, o) => S.events.push({ type, ...o }), dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y), view: 0 };
  // the systems, each a module; the order they are made in is fixed (append new ones at the end)
  for (const make of MODULES) make(G);
  // ---------- the loop ----------
  let popT = 0;
  function step(inp) {
    G.view = Math.min(160, inp.view || 0);
    const dt = R.step; S.t += dt; S.clock += dt * S.clockRate;   // the clock alone can run fast (a test control): the dead and Kai keep their pace
    const night = S.clock % (R.day + R.night) >= R.day; if (night !== S.night) { S.night = night; G.ev(night ? 'dusk' : 'dawn', {}); }
    G.stepKai(dt, inp); G.stepGuns(dt, inp); G.stepFoes(dt); G.stepBolts(dt); G.stepNests(dt); G.stepHunts(dt); G.stepChem(dt);
    if ((popT -= dt) <= 0) { popT = 1; G.populate(); }
  }
  for (let k = 0; k < 6; k++) G.populate();
  const setClockRate = r => { S.clockRate = Math.max(1, Math.min(60, r)); };
  const debug = { spawn: (kind, x, y, o) => G.spawn(kind, x, y, o) };   // for tests, labs and screenshots
  return { state: S, step, setClockRate, debug, drain: () => S.events.splice(0), dayPhase: () => { const c = S.clock % (R.day + R.night); return S.night ? { night: true, left: R.day + R.night - c } : { night: false, left: R.day - c }; } };
}
