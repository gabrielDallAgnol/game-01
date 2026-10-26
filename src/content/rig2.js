// The Haven Rig V2: Kai's caution-yellow recovery truck ("Hilde"), stuck in Church Square with a cracked crankshaft.
// It does not move until the finale; it grows with modules bolted on. Pure data, a first pass to tune: a sim module
// (proposed: src/sim/rig2.js) applies it. unlock: buildable once that story1.js step has opened. cost: scrap and parts.

export const RIG2 = {
  hp: 120, regenDay: 4,               // Rig health, and what it mends each dawn (Field Repair on the Rig mends faster)
  pads: 4,                            // turret pads round the Rig on night 1 (more pads come with cleared ground)
  carry: { slow: 0.7 },               // the hero's speed while carrying the crankshaft home (story1.js q7.carry)
  engine: { fit: 20, item: 'crankshaft' },   // seconds of hold-to-fit at the Rig in the finale, while the last march comes
};

export const MODULES = [
  { id: 'bunks', name: 'Bunks', unlock: 'q2.light', cost: { scrap: 10, parts: 2 }, build: 10, lv: 2,
    fx: { beds: 2 }, up: { cost: { scrap: 8, parts: 2 }, fx: { beds: 3 } },
    line: 'Beds for survivors. A survivor only comes home if there is a bed.' },
  { id: 'roofTurret', name: 'Roof Turret', unlock: 'q3.roof', cost: { scrap: 14, parts: 3 }, build: 12, lv: 1,
    fx: { range: 9, dmg: 1.6, rate: 0.8, arc: 360 },
    line: 'A bolt gun on the crane mount. Fires on its own, even with Kai away. Does not count against turret slots.' },
  { id: 'workshop', name: 'Workshop', unlock: 'q4.garage', cost: { scrap: 18, parts: 4 }, build: 16, lv: 2,
    fx: { turretTier: 2, buildFaster: 0.25 }, up: { cost: { scrap: 12, parts: 6 }, unlock: 'q6.shed', fx: { turretTier: 3 } },
    line: 'Kai\'s bench, vice and welder from the garage. Bolt Drivers; at Lv 2, Rivet Cannons.' },
  { id: 'floodlights', name: 'Floodlights', unlock: 'q4.cinema', cost: { scrap: 12, parts: 2 }, build: 10, lv: 1,
    fx: { cone: 12, slow: 0.7, turretDmg: 1.2, noise: 1.5 },
    line: 'The cinema projector lamp, rewired. Lit ground round the Rig: the Ash-Born there walk slower and turrets hit harder. But light draws them.' },
  { id: 'radio', name: 'Rig Radio', unlock: 'q5.gus', cost: { scrap: 8, parts: 3 }, build: 8, lv: 1, needs: 'gus',
    fx: { forecast: true, broadcasts: true },
    line: 'Gus\'s set on the cab roof. At dusk it names the march and its size. The 3:00 voice plays here too.' },
  { id: 'plating', name: 'Plating', unlock: 'q2.hold', cost: { scrap: 10, parts: 1 }, build: 8, lv: 3,
    fx: { hp: 0.15 }, up: { cost: { scrap: 10, parts: 2 }, fx: { hp: 0.15 } },
    line: 'Car doors and bonnets welded on. +15% Rig health a level.' },
];
export const MODULE_ORDER = MODULES.map(m => m.id);

// what each survivor does at the Rig (story1.js SURVIVORS has who and where)
export const CREW2 = {
  lotte: { name: 'Lotte Brix', post: 'Lookout', fx: { routeAtDawn: true, carryHome: 0.5 }, line: 'Shouts the march route at dawn. Runs half your carried scrap home.' },
  benno: { name: 'Benno Scholz', post: 'Stores', fx: { searchFood: 1, partsDawn: 1 }, line: '+1 food a house you search. Files one spare part each dawn.' },
  gus: { name: 'Gus Lindner', post: 'Radio', fx: { radio: true, repairRig: 2 }, line: 'Runs the Rig Radio. Mends the Rig by 2 hp/s at night when it is hit.' },
};

// [mech] until the chapter-1 quest engine opens modules by its steps (a G.questDone(step) hook), a module unlocks on
// this night instead (the module's own `unlock` step, or its upgrade's). Bunks and the Roof Turret come first.
export const UNLOCK_NIGHT = { 'q2.light': 1, 'q3.roof': 1, 'q2.hold': 2, 'q4.garage': 2, 'q4.cinema': 3, 'q5.gus': 3, 'q6.shed': 4 };
