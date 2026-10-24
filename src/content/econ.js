// The Solar Flare economy's numbers (econ3): the construction queue, harvester carts and resource nodes, the trickle's
// new share, and the dawn Settlement report. Pure data: tune here. Every system can be switched off in ECON (the old
// rules come back: instant building, the full trickle, blessings, no settlement XP).

export const ECON = {
  queue: true,        // building takes time: blueprints go in a queue, crews raise them in order (sim/construct.js)
  carts: true,        // harvester carts haul scrap and timber from nodes that run dry (sim/haul.js)
  relics: true,       // blessings are gone: drops are relics, stat tomes and blueprints (sim/relics.js)
  flatTower: true,    // a tower always costs the same (no +25% per tower you have)
  settle: true,       // the dawn Settlement report pays XP for a well-run town
};

// ---------- construction ----------
// seconds of work by level (tech: one number). A crew works one job at a time; the queue runs top down, skipping a job
// whose site has the dead within `flee` (its crew runs; the job waits). Night does not stop it.
export const CONSTRUCT = {
  time: { house: [8, 12, 16], farm: [7, 10, 14], tower: [10, 13, 17], wall: [2, 3, 4], generator: [12, 16], workshop: [40], market: [35], cart: 14 },
  crews: pop => Math.min(4, 1 + Math.floor(pop / 7)),   // crews at work at once: 1, then one more for every 7 people (most 4)
  flee: 4.5,          // the dead this close to a site: its crew drops tools and runs
  hp0: 0.4,           // a scaffold starts at this share of the building's health and grows with the work
  maxJobs: 8,         // the longest queue you may hold
};

// ---------- harvester carts and resource nodes ----------
// Nodes are generated per map in three bands round the Camp. The near ones are small and run dry by day 3–4, so the
// carts' routes grow longer and more dangerous: the natural signal to move on.
export const HAUL = {
  start: 1,                       // carts at the start of a run
  max: [2, 3, 5],                 // carts the Camp can keep, by Camp level
  cost: 12,                       // scrap for a new cart (a construction job: CONSTRUCT.time.cart)
  cap: 2,                         // scrap a cart carries home a trip
  speed: 1.4,                     // cells a second (road ×1.3, woods ×0.65)
  load: 6,                        // seconds to fill up at a node
  unload: 1,                      // seconds to unload at the Camp
  hp: 20,                         // a cart's health; mended at dawn
  lure: 5,                        // the dead this close to a cart go for it
  alertEvery: 12,                 // seconds between "Harvester under attack!" for one cart
  hiveGap: 6,                     // no cart drives to a node this close to a living hive
  bands: [                        // [min r, max r, timber, scrap, amount lo, amount hi]
    [7, 14, 2, 2, 12, 16],
    [15, 26, 3, 3, 30, 45],
    [27, 46, 3, 3, 60, 90],
  ],
  gap: 6,                         // nodes stand at least this far apart
  foreman: 14,                    // the Foreman orders a cart when scrap beyond its price is at least this
};
// the trickle's share now the carts bring the scrap in (sim/income.js): the Camp's own base pay and what homes pay
export const TRICKLE = { base: 0.25, house: 0.5 };

// ---------- the dawn Settlement report ----------
// XP for a well-run town, so a governor levels too. Each line pays its base + per × the night just held.
export const SETTLE = {
  safe:  { base: 3, per: 0.5, name: 'No one lost' },           // no people rose or fell, the hero did not fall
  held:  { base: 3, per: 0.5, name: 'No breach' },             // no building fell in the night
  fed:   { base: 2, per: 0.34, name: 'Food to spare' },        // the town grew more food than it ate
  built: { each: 2, max: 8, name: 'Buildings finished' },      // every construction job finished since yesterday's dawn
};
