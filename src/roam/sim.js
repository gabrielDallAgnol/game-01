// [roam] The rules of Hollowmere Roam (the composition root: the constants, the state, the loop; each system is a module in
// src/roam/sim/): Kai rides the town and guns down the machines,
// which sleep, wander and chase; each area's walker breeds them and has to be broken, the day turns to night (more dead, faster, hungrier). No base, no
// building. Deterministic: one Rng stream, a fixed step; the renderer and the UI only read `state` and send `input`.
import { Rng, hashSeed } from '../sim/rng.js';
import { createFoes } from './sim/foes.js';
import { createVehicle } from './sim/vehicle.js';
import { createKai } from './sim/kai.js';
import { createGuns } from './sim/guns.js';
import { createBolts } from './sim/bolts.js';
import { createHunts } from './sim/hunts.js';
import { createChem } from './sim/chem.js';
import { createWorld } from './sim/world.js';
import { createLoot } from './sim/loot.js';
import { createAreas } from './sim/areas.js';
import { createRisk } from './sim/risk.js';
import { createGarage } from './sim/garage.js';
import { createElites } from './sim/elites.js';
import { createFreeing } from './sim/freeing.js';
import { MACHINES } from '../play/machines.js';

const MODULES = [createFoes, createVehicle, createKai, createGuns, createBolts, createHunts, createWorld, createChem, createLoot, createAreas, createRisk, createGarage, createElites, createFreeing];

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
  // most brood alive; the bare core takes coreMult damage
  areas: { minPts: 25, grid: 8, levelEvery: 260, hpPerLevel: 0.3, simR: 160, notice: 22, stompEvery: 2.2, spawnEvery: 9, spawnNight: 5, brood: 8, coreMult: 1.4,
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
  // [m5] risk: the bike's health; soak: the share of a hit it takes while Kai rides; below low it is worn (top speed x worn),
  // wrecked it limps (x limp); a crash faster than crashMin m/s into a wall dents it crashDmg per m/s over; a field repair
  // mends fixRate hp/s, a bank bankFix, one scrap per fixPer hp, only with no machine within safeR; bankR: how close a bank
  // takes what she carries; cacheR: how close takes the cache back; backHp: the least the bike comes back with after a death
  risk: { bikeHp: 100, soak: 0.7, low: 0.3, worn: 0.8, limp: 0.55, crashMin: 6, crashDmg: 1.2, fixRate: 8, bankFix: 30, fixPer: 4, safeR: 10, bankR: 7, cacheR: 1.9, backHp: 0.25 },
  // [m6] the garage: a weapon's damage +dmgPerLevel per level; items reach capPerLevel x Kai's level (areas cleaned + 1 until
  // M7); an upgrade costs weaponCost (partCost for a part) x its level in banked scrap; salvage gives back salvage of what
  // it cost; a dazzle lamp keeps dazzleSlow of a machine's speed each step it's in the beam; door: how far out from the
  // garage's roller doors its forecourt (the service spot) is; lotMargin: how far past the lot's edge machines are kept;
  // [m6e/m6f] the drive-in: the bay bay m out from the doors, the bike always at bayAng there; it rides at drive m/s from
  // gateOut m outside the gate, through it, gateIn m inside, to the bay (turning to bayAng over the last settle m); out the
  // same way to exitOut m past the entry, leaving at rollOut m/s. GARAGE shows within gateReach of the entry; the gate opens
  // by itself for Kai inside the lot within gateAuto of it
  garage: { lotMargin: 1, door: 6, bay: 6.5, bayAng: 0, exitOut: 5, rollOut: 3, gateOut: 3, gateIn: 3, gateReach: 6, gateAuto: 9, drive: 7, settle: 4, dmgPerLevel: 0.1, capPerLevel: 3, weaponCost: 6, partCost: 4, salvage: 0.4, dazzleSlow: 0.85 },
  // [m6b] elites: the chance a machine is one (+perLevel per area level above 1, x night at night), how much tougher, and
  // the trail a burning or soaking one leaves (every trailEvery s, trailR m, trailPower of the element)
  elites: { chance: 0.03, perLevel: 0.012, night: 1.5, hp: 2.6, trailEvery: 1.2, trailR: 1.2, trailPower: 0.5 },
  // [point] freeing a big machine (sim/freeing.js): its core stops at floor (of its health); within linkR of its edge Kai
  // links with a freeing chip; its pulse comes every pulse s, a tap within window s of one lands; need landed taps free
  // it; a miss costs one and locks the link for lock s. Freed, it walks to its post at guardSpeed m/s
  free: { floor: 0.15, linkR: 12, body: 6, pulse: 1.3, window: 0.36, need: 5, lock: 0.6, guardSpeed: 2.4 },
};

export function createRoam(town, seed = 1) {
  const R = ROAM, rng = new Rng(hashSeed(seed, 'roam'));
  const S = {
    t: 0, clock: 40, clockRate: 1, night: false, kills: 0, won: false, events: [],
    kai: { x: town.start.x + 0.8, y: town.start.y + 6.2, vx: 0, vy: 0, face: 0, hp: R.kai.hp, maxHp: R.kai.hp, cd: 0, swing: 0, hurtT: -9, dead: 0, dash: 0, dashCd: 0, riding: true },   // she starts on the bike (on foot comes later)
    bike: { x: town.start.x + 0.8, y: town.start.y + 6.2, ang: 0, speed: 0 },
    broken: new Set(),   // the small props the bike has smashed (their ids in town.breakables)
    dead: [], nests: [],   // [m4c] nests are gone: the walkers are the areas' only source (kept empty for old readers)
  };
  const G = { R, S, rng, town, seed, ev: (type, o) => S.events.push({ type, ...o }), dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y), view: 0 };
  // the systems, each a module; the order they are made in is fixed (append new ones at the end)
  for (const make of MODULES) make(G);
  // ---------- the loop ----------
  let popT = 0;
  function step(inp) {
    G.view = Math.min(160, inp.view || 0);
    if (S.garageRun) inp = { view: inp.view, x: 0, y: 0 };   // [m6e] the bike rides itself in and out of the garage: no control meanwhile
    const dt = R.step; S.t += dt; S.clock += dt * S.clockRate;   // the clock alone can run fast (a test control): the dead and Kai keep their pace
    const night = S.clock % (R.day + R.night) >= R.day; if (night !== S.night) { S.night = night; G.ev(night ? 'dusk' : 'dawn', {}); }
    G.stepKai(dt, inp); G.stepGuns(dt, inp); G.stepFoes(dt); G.stepBolts(dt); G.stepHunts(dt); G.stepWorld(dt); G.stepChem(dt); G.stepLoot(dt); G.stepAreas(dt); G.stepRisk(dt, inp); G.stepGarage(dt); G.stepElites(dt); G.stepFreeing(dt, inp);
    if ((popT -= dt) <= 0) { popT = 1; G.populate(); }
  }
  for (let k = 0; k < 6; k++) G.populate();
  const setClockRate = r => { S.clockRate = Math.max(1, Math.min(60, r)); };
  const debug = { spawn: (kind, x, y, o) => G.spawn(kind, x, y, o) };   // for tests, labs and screenshots
  return { state: S, step, setClockRate, debug, setLoadout: o => G.setLoadout(o), deliver: (el, x, y, r, p) => G.deliver(el, x, y, r, p), repair: () => G.startFix(), build: id => G.build(id), equipItem: uid => G.equipItem(uid), salvageItem: uid => G.salvageItem(uid), upgrade: slot => G.upgrade(slot), enterGarage: () => G.enterGarage(), leaveGarage: () => G.leaveGarage(), socket: (uid, i, mod) => G.socket(uid, i, mod), levelCap: () => G.levelCap(), upCost: slot => G.upCost(S.gear[slot]), atBench: () => !!G.atBench(), atGate: () => !!G.atGate(), canLink: () => G.canLink(), bikeStats: () => G.bikeStats(), drain: () => S.events.splice(0), dayPhase: () => { const c = S.clock % (R.day + R.night); return S.night ? { night: true, left: R.day + R.night - c } : { night: false, left: R.day - c }; } };
}
