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
import { createWorld } from './sim/world.js';
import { createLoot } from './sim/loot.js';
import { createAreas } from './sim/areas.js';
import { MACHINES } from '../play/machines.js';

const MODULES = [createFoes, createNests, createVehicle, createKai, createGuns, createBolts, createHunts, createWorld, createChem, createLoot, createAreas];

export const ROAM = {
  step: 1 / 30, day: 240, night: 120,
  kai: { hp: 100, speed: 4.4, reach: 1.8, dmg: 1.6, swing: 0.42, regen: 1.5, regenAfter: 6, respawn: 3 },   // [m1] slow regen: a hit costs you
  dash: { dist: 4.2, time: 0.22, cd: 1.2 },
  // bounce/slide: what's left of the speed into / along a wall when the bike hits it; lock: seconds the stick can't steer it
  // straight back into the wall after a bounce
  bike: { top: 14, accel: 9, brake: 14, turn: 2.6, ram: 6, ramDmg: 4, enter: 2.6, bounce: 0.45, slide: 0.8, lock: 0.18 },
  // hitR: a shot's own radius (added to the machine's body, below); home: how far off your aim (rad) a rocket looks for its
  // machine, homeR how far, homeTurn how fast it turns (rad/s); fuse: a rocket bursts this close to a machine's body
  gun: { hitR: 0.35, heartR: 1.6, push: 3.2, noise: 30, jump: 7, home: 0.7, homeR: 20, homeTurn: 4.5, fuse: 0.9 },
  // [m3e] each machine's body radius for hits, matching how big it's drawn (figures are drawn larger than life)
  // [m4] areas: a level every levelEvery metres from the start (machines +hpPerLevel each); walkers act within simR of Kai,
  // notice her within notice m, stomp every stompEvery s; drop a crawler every spawnEvery s (spawnNight at night), at
  // most brood alive; plant a nest every nestEvery s, at most nestsMax (nestHp each); the bare core takes coreMult damage
  areas: { minPts: 25, grid: 8, levelEvery: 260, hpPerLevel: 0.3, simR: 160, notice: 22, stompEvery: 2.2, spawnEvery: 9, spawnNight: 5, brood: 8, nestEvery: 150, nestsMax: 2, nestHp: 80, coreMult: 1.4,
    // [m4b] its defences: pods (podHp each) fire a volley every volleyEvery s within volleyR after podWindup; the tank (tankHp)
    // blows for tankBite of its core; in a fight it broods every spawnFight s up to broodFight; partSlop: how near a part a hit counts
    podHp: 30, tankHp: 16, volleyEvery: 3.2, volleyR: 34, podWindup: 0.7, boltSpeed: 9, boltDmg: 7, tankBite: 0.3, spawnFight: 3, broodFight: 14, partSlop: 1.2 },
  body: { walker: 6, crawler: 0.75, skitter: 0.6, hound: 0.8, spitter: 0.75, brute: 1.25 },
  // the machines (code id `dead` kept from the Roam prototype; caps 42/75 > 24/46 after Gabriel's playtest: too crowded): the crawler is M1's one machine
  dead: { ...MACHINES,   // [m1] crawler, skitter, hound, spitter, brute (src/play/machines.js)
    bite: 1.1, windup: 0.35, reach: 1.05, rideReach: 1.6, sense: [16, 22], nightSpeed: 1.3, cap: [24, 46], alarm: 14, catchUp: 1.2, near: 70, far: 110 },
  hunt: { boil: 14, cool: 1.3, perShot: 1, size: [3, 5], nightExtra: 2, twoSides: 0.25 },   // [m1] gunfire heat → hunting packs
  // [m2] elements on machines (pips, clouds, oil they leak)
  chem: { slick: 0.45, slickR: [1.1, 1.7], slickLife: 40, groundGap: 0.9 },
  // [atoms] the atom world (docs/design/atomic-engineering.md): heat and water between atoms; hop: the strength a fire
  // passes on to what it lights (minPw: below this nothing catches; so a fire runs out ~10 hops from its start); numbers per material live in
  // src/play/materials.js. tick: how often heat moves; simR: fires further than this from Kai wait; boil: water a unit of
  // heat boils off; cool: heat lost per second; downwind/upwind: the wind's push; fireHeat/blastHeat: what a delivered
  // fire or a plain explosion puts in; kaiBurn/kaiBlast: how much fire and blasts hurt Kai
  atoms: { hop: 0.85, minPw: 0.2, tick: 0.25, simR: 140, maxBurn: 300, boil: 0.9, cool: 0.18, downwind: 0.9, upwind: 0.3, wind: { x: 0.731, y: 0.682 }, fireHeat: 2.6, blastHeat: 1.2, stainR: 1.3, wetShow: 14, kaiBurn: 1, kaiBlast: 0.7, hardWet: 12 },
  // [m3] loot: scrap settles for settle seconds, then flies to Kai from within pull metres (fly0 → flyMax m/s, speeding up
  // by flyAcc), banked within grab; a weapon goes in the bag (bag slots) when she passes within take (takeRide on the
  // bike); rare drops scan within scan; scrap left lying scrapLife seconds goes; at most max drops on the ground
  loot: { pull: 14, settle: 0.45, fly0: 3, flyAcc: 40, flyMax: 30, grab: 0.8, take: 1.3, takeRide: 1.9, bag: 12, scan: 9, scrapLife: 90, max: 220 },
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
    G.stepKai(dt, inp); G.stepGuns(dt, inp); G.stepFoes(dt); G.stepBolts(dt); G.stepNests(dt); G.stepHunts(dt); G.stepWorld(dt); G.stepChem(dt); G.stepLoot(dt); G.stepAreas(dt);
    if ((popT -= dt) <= 0) { popT = 1; G.populate(); }
  }
  for (let k = 0; k < 6; k++) G.populate();
  const setClockRate = r => { S.clockRate = Math.max(1, Math.min(60, r)); };
  const debug = { spawn: (kind, x, y, o) => G.spawn(kind, x, y, o) };   // for tests, labs and screenshots
  return { state: S, step, setClockRate, debug, setLoadout: o => G.setLoadout(o), deliver: (el, x, y, r, p) => G.deliver(el, x, y, r, p), equip: id => G.equip(id), salvage: id => G.salvage(id), drain: () => S.events.splice(0), dayPhase: () => { const c = S.clock % (R.day + R.night); return S.night ? { night: true, left: R.day + R.night - c } : { night: false, left: R.day - c }; } };
}
