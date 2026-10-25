// The Solar Flare economy's numbers (econ3): the construction queue and the dawn Settlement report. Pure data: tune
// here. ECON switches: queue off = instant building; settle off = no settlement XP. (Carts, nodes and relics were cut.)

export const ECON = {
  queue: true,        // building takes time: blueprints go in a queue, crews raise them in order (sim/construct.js)
  flatTower: true,    // a tower always costs the same (no +25% per tower you have)
  settle: true,       // the dawn Settlement report pays XP for a well-run town
};

// ---------- construction ----------
// seconds of work by level (tech: one number). A crew works one job at a time; the queue runs top down, skipping a job
// whose site has the dead within `flee` (its crew runs; the job waits). Night does not stop it.
export const CONSTRUCT = {
  time: { house: [6, 9, 12], farm: [5, 8, 11], tower: [7, 10, 13], wall: [2, 3, 4], workshop: [40], market: [35] },
  crews: pop => Math.min(4, 1 + Math.floor(pop / 5)),   // crews at work at once: 1, then one more for every 5 people (most 4)
  flee: 4.5,          // the dead this close to a site: its crew drops tools and runs
  hp0: 0.4,           // a scaffold starts at this share of the building's health and grows with the work
  maxJobs: 8,         // the longest queue you may hold
};

// ---------- the dawn Settlement report ----------
// XP for a well-run town, so a governor levels too. Each line pays its base + per × the night just held.
export const SETTLE = {
  safe:  { base: 3, per: 0.5, name: 'No one lost' },           // no people rose or fell, the hero did not fall
  held:  { base: 3, per: 0.5, name: 'No breach' },             // no building fell in the night
  fed:   { base: 2, per: 0.34, name: 'Food to spare' },        // the town grew more food than it ate
  built: { each: 2, max: 8, name: 'Buildings finished' },      // every construction job finished since yesterday's dawn
};
