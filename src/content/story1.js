// Chapter 1, "The Engine Works": Hollowmere's beats and quest chain as plain data. No code runs here: a sim module
// (proposed: src/sim/chapter.js) reads it. The story is told only in the world (notes, graffiti, radio; see notes.js):
// a step names what the player can find, never a popup. The System speaks only through SYS lines, in [brackets].
//
// trigger: { on, ... } when a step opens
//   on: 'start' | 'dawn' | 'dusk' | 'done' (an earlier step) | 'enter' (a district or building) | 'search' (a house
//   searched) | 'event' (a sim event by name) | 'have' (a stock or module). night: the earliest night it may open.
// world: ids from notes.js (notes, graffiti, radio) and light cues the renderer shows while the step is open.
// goal: { op, ... } what finishes it
//   op: 'salvage' n | 'build' (module or turret) | 'survive' | 'reach' (building) | 'repair' (hold, costs) |
//   'break' (a horde) | 'destroy' (a nest core) | 'carry' (an item home) | 'search' n (in a district) | 'leave' (drive the Rig out).
// reward: { scrap, parts, xp, unlock: [module/turret/skill ids], survivor, item, open: [district/building ids] }

export const CH1 = { id: 'ch1', name: 'The Engine Works', town: 'Hollowmere', nights: 6, finaleDay: 7, saveAt: 'dawn' };

// the town (shaped like Nauen: a round old town, a ring street, the church square in the middle)
export const DISTRICTS = {
  square: { name: 'Church Square', where: 'centre', blurb: 'St. Marien, the fountain, the cobbles. The Rig is parked here.' },
  ring: { name: 'The Ring', where: 'round the old town', blurb: 'The ring street on the old wall line. Shops below, flats above. Kai\'s garage is on the east side.' },
  main: { name: 'Main Street', where: 'south', blurb: 'The long street south, the town hall, the bakery, the bank.' },
  tower: { name: 'Water Tower Hill', where: 'north-west', blurb: 'The brick water tower and the allotment gardens round it.' },
  north: { name: 'Station and Works', where: 'north', blurb: 'The station, the goods shed, the rails, and the Hollowmere Engine Works.' },
  masts: { name: 'The Mast Field', where: 'south-west', blurb: 'Tall radio masts in a wet field. A hut at the foot of Mast Two.' },
  east: { name: 'East Estates', where: 'east', blurb: 'Rows of family houses, a school, a supermarket.' },
  west: { name: 'West Gardens', where: 'west', blurb: 'Allotments, sheds, a closed cinema on the edge of the Ring.' },
};

// the places the chain uses (kind = what the map must place; district = where)
export const PLACES = {
  rig: { kind: 'rig', district: 'square', name: 'the Haven Rig' },
  church: { kind: 'church', district: 'square', name: 'St. Marien' },
  garage: { kind: 'garage', district: 'ring', name: 'Brenner\'s Garage' },
  pizzeria: { kind: 'shop', district: 'ring', name: 'Pizza Rapido' },
  watertower: { kind: 'watertower', district: 'tower', name: 'the water tower' },
  townhall: { kind: 'townhall', district: 'main', name: 'the town hall' },
  cinema: { kind: 'cinema', district: 'west', name: 'the Lichtspiel cinema', nest: true },
  shed: { kind: 'shed', district: 'north', name: 'the goods shed', nest: true },
  works: { kind: 'factory', district: 'north', name: 'the Hollowmere Engine Works', nest: true, finale: true },
  hut: { kind: 'hut', district: 'masts', name: 'the hut at Mast Two' },
};

// the nests: infested buildings. Their dead stay awake inside (inside it is always night). Break the core to clear one.
export const NESTS = [
  { id: 'cinema', place: 'cinema', opens: 3, core: { hp: 40 }, halls: [6, 8], reward: { scrap: 14, parts: 4 } },
  { id: 'shed', place: 'shed', opens: 5, core: { hp: 50 }, halls: [7, 9], reward: { scrap: 16, parts: 5, open: ['works'] } },
  { id: 'works', place: 'works', opens: 7, core: { hp: 80 }, halls: [6, 8, 10], boss: 'guardian', reward: { item: 'crankshaft' } },
];

// the System: terse, cold-helpful, never explains. Shown as a thin blue line over the hero (the hero sees it; no window)
export const SYS1 = {
  wake: ['[Class granted: Mechanic]', '[Skill: Salvage · Lv 1]', '[Skill: Scrap Turret · Lv 1]'],
  level: lv => `[Mechanic · Lv ${lv}]`,
  skill: (name, lv) => `[Skill: ${name} · Lv ${lv}]`,
  slots: n => `[Turret slots: ${n}]`,
  party: n => `[Party: ${n}]`,
  pending: '[Class pending]',            // what a survivor's line reads when the hero looks at them
  quest: t => `[Objective] ${t}`,
  done: t => `[Objective complete] ${t}`,
  nest: '[Infestation detected]',
  core: '[Infestation cleared]',
  dusk: '[Ash activity rising]',
  dawn: '[Ash activity falling]',
  march: dir => `[Movement: ${dir}]`,
  refuse: ['[Query not recognised]', '[Information restricted]', '[Not applicable]'],   // when the hero taps the line twice
  item: '[Item: Crankshaft, order 4471]',
  end: ['[Region complete: Hollowmere]', '[Next region: unlocked]'],
};

// night by night: what the beat is, what the threat is (numbers for this live in mechanic.js BALANCE)
export const BEATS = [
  { night: 1, id: 'wake', title: 'Wrench in hand', beat: 'Kai wakes under the Rig. Salvage the cars round the square, build the first turret, hold the night.' },
  { night: 2, id: 'tower', title: 'The light on the tower', beat: 'A torch blinks from the water tower. Build bunks, fix the ladder, bring Lotte home. The first march comes.' },
  { night: 3, id: 'stamped', title: 'Stamped and filed', beat: 'Notes stamped by the town hall. Break the sleepers on its steps and bring Benno home. Roof turret. The cinema starts to glow.' },
  { night: 4, id: 'garage', title: 'Back by one', beat: 'Kai\'s own garage: the workshop comes home. Clear the cinema nest. A voice on a car radio from the Mast Field.' },
  { night: 5, id: 'masts', title: 'Mast Two', beat: 'Gus at the masts (optional). Benno finds order 4471: the part is in the Engine Works. The goods shed is a nest.' },
  { night: 6, id: 'long', title: 'The Long Night', beat: 'Clear the goods shed and open the road north. Two hordes march at once.' },
  { night: 7, id: 'works', title: 'The Engine Works', beat: 'By day, storm the Works, break the Ash Heart, carry the crankshaft home, fit it while the last horde comes. The Rig rolls.' },
];

// the chain: each step opens when its trigger fires and closes when its goal is met
export const STEPS = [
  // ---- night 1: wrench in hand ----
  { id: 'q1.salvage', night: 1, trigger: { on: 'start' }, world: { notes: ['n.rig.1'], graffiti: ['g.square.1'], cue: 'cars round the square glint' },
    goal: { op: 'salvage', n: 3, what: 'car' }, reward: { xp: 3 }, sys: '[Objective] Salvage 3 vehicles.' },
  { id: 'q1.turret', night: 1, trigger: { on: 'done', step: 'q1.salvage' }, world: { cue: 'turret pads show round the Rig' },
    goal: { op: 'build', what: 'nail', n: 1 }, reward: { xp: 2, unlock: ['slots:3'] }, sys: '[Objective] Build a scrap turret.' },
  { id: 'q1.hold', night: 1, trigger: { on: 'dusk', night: 1 }, world: { radio: ['r.1'] },
    goal: { op: 'survive' }, reward: { scrap: 4, xp: 4 } },

  // ---- night 2: the light on the tower ----
  { id: 'q2.light', night: 2, trigger: { on: 'dusk', night: 1 }, world: { cue: 'a torch blinks three times from the water tower, every half minute of the night' },
    goal: { op: 'reach', place: 'watertower' }, reward: { xp: 2, unlock: ['bunks'] } },
  { id: 'q2.bunks', night: 2, trigger: { on: 'enter', place: 'watertower' }, world: { notes: ['n.tower.1', 'n.tower.2'], graffiti: ['g.tower.1'] },
    goal: { op: 'build', what: 'bunks' }, reward: { xp: 2 } },
  { id: 'q2.ladder', night: 2, trigger: { on: 'done', step: 'q2.bunks' }, world: { cue: 'the fallen ladder at the tower foot sparks' },
    goal: { op: 'repair', place: 'watertower', time: 5, cost: { scrap: 4 } }, reward: { survivor: 'lotte', xp: 4 }, sys: '[Party: 2]' },
  { id: 'q2.hold', night: 2, trigger: { on: 'dusk', night: 2 }, world: { radio: ['r.2'] }, goal: { op: 'survive' }, reward: { scrap: 5, xp: 5 } },

  // ---- night 3: stamped and filed ----
  { id: 'q3.stamps', night: 3, trigger: { on: 'search', district: 'main', n: 1 }, world: { notes: ['n.main.1', 'n.main.2', 'n.main.3'], graffiti: ['g.main.1'] },
    goal: { op: 'reach', place: 'townhall' }, reward: { xp: 2 } },
  { id: 'q3.steps', night: 3, trigger: { on: 'enter', place: 'townhall' }, world: { cue: 'a horde sleeps on the town hall steps; a blind twitches upstairs' },
    goal: { op: 'break', horde: 'townhall', size: 6 }, reward: { survivor: 'benno', scrap: 6, xp: 5 }, sys: '[Party: 3]' },
  { id: 'q3.roof', night: 3, trigger: { on: 'event', event: 'marchSurvived', n: 1 }, world: { notes: ['n.rig.2'] },
    goal: { op: 'build', what: 'roofTurret' }, reward: { xp: 3 } },
  { id: 'q3.glow', night: 3, trigger: { on: 'dusk', night: 3 }, world: { graffiti: ['g.west.1'], radio: ['r.3'], cue: 'the cinema sign flickers orange all night' },
    goal: { op: 'survive' }, reward: { scrap: 6, xp: 5 } },

  // ---- night 4: back by one ----
  { id: 'q4.garage', night: 4, trigger: { on: 'dawn', night: 4 }, world: { notes: ['n.ring.1'], graffiti: ['g.ring.1'], cue: 'the garage shutter is half up' },
    goal: { op: 'salvage', what: 'bench', place: 'garage', n: 3 }, reward: { unlock: ['workshop'], parts: 2, xp: 4 } },
  { id: 'q4.cinema', night: 4, trigger: { on: 'enter', place: 'cinema' }, world: { notes: ['n.west.1', 'n.west.2'], graffiti: ['g.west.2'] },
    goal: { op: 'destroy', nest: 'cinema' }, reward: { xp: 8, unlock: ['floodlights'] }, sys: '[Infestation cleared]' },
  { id: 'q4.voice', night: 4, trigger: { on: 'event', event: 'carRadio', night: 4 }, world: { radio: ['r.4'] },
    goal: { op: 'survive' }, reward: { scrap: 7, xp: 6 } },

  // ---- night 5: mast two (Gus is optional; the chain does not wait for him) ----
  { id: 'q5.gus', night: 5, optional: true, trigger: { on: 'done', step: 'q4.voice' }, world: { notes: ['n.masts.1', 'n.masts.2'], graffiti: ['g.masts.1'], radio: ['r.5'] },
    goal: { op: 'repair', place: 'hut', time: 6, cost: { scrap: 6, parts: 2 } }, reward: { survivor: 'gus', unlock: ['radio'], xp: 5 }, sys: '[Party: 4]' },
  { id: 'q5.order', night: 5, trigger: { on: 'dawn', night: 5 }, world: { notes: ['n.main.9'], cue: 'Benno waves a yellow form at the Rig door' },
    goal: { op: 'reach', place: 'shed' }, reward: { xp: 2 } },
  { id: 'q5.hold', night: 5, trigger: { on: 'dusk', night: 5 }, world: { radio: ['r.6', 'r.7'] }, goal: { op: 'survive' }, reward: { scrap: 8, xp: 7 } },

  // ---- night 6: the long night ----
  { id: 'q6.shed', night: 6, trigger: { on: 'enter', place: 'shed' }, world: { notes: ['n.north.1', 'n.north.2'], graffiti: ['g.north.1'] },
    goal: { op: 'destroy', nest: 'shed' }, reward: { xp: 9, unlock: ['workshop2'], open: ['works'] }, sys: '[Infestation cleared]' },
  { id: 'q6.hold', night: 6, trigger: { on: 'dusk', night: 6 }, world: { radio: ['r.8', 'r.9'], cue: 'two red routes by day' },
    goal: { op: 'survive' }, reward: { scrap: 10, xp: 8 } },

  // ---- day 7: the Engine Works (the finale) ----
  { id: 'q7.gate', night: 7, trigger: { on: 'dawn', night: 7 }, world: { graffiti: ['g.north.2'], radio: ['r.10'] },
    goal: { op: 'salvage', what: 'gate', place: 'works', n: 1 }, reward: { xp: 2 } },
  { id: 'q7.halls', night: 7, trigger: { on: 'done', step: 'q7.gate' }, world: { notes: ['n.works.1', 'n.works.2', 'n.works.3'] },
    goal: { op: 'break', horde: 'works', halls: 3 }, reward: { xp: 8, parts: 4 } },
  { id: 'q7.heart', night: 7, trigger: { on: 'done', step: 'q7.halls' }, world: { notes: ['n.works.4'], cue: 'the press line glows; the Ash Heart beats' },
    goal: { op: 'destroy', nest: 'works' }, reward: { item: 'crankshaft', xp: 10 }, sys: '[Item: Crankshaft, order 4471]' },
  { id: 'q7.carry', night: 7, trigger: { on: 'done', step: 'q7.heart' }, world: { cue: 'every sleeping horde stirs as the Heart dies; dusk comes early' },
    goal: { op: 'carry', item: 'crankshaft', to: 'rig', slow: 0.7 }, reward: { xp: 2 } },
  { id: 'q7.fit', night: 7, trigger: { on: 'done', step: 'q7.carry' }, world: { radio: ['r.11'] },
    goal: { op: 'repair', place: 'rig', time: 20, defend: true }, reward: { xp: 6 }, sys: '[Objective complete] Engine restored.' },
  { id: 'q7.roll', night: 7, trigger: { on: 'done', step: 'q7.fit' }, world: { radio: ['r.12'], graffiti: ['g.square.4'] },
    goal: { op: 'leave', road: 'north' }, reward: { end: 'ch1' }, sys: '[Region complete: Hollowmere]' },
];

// the survivors: where found, when, and what each adds at the Rig (rig2.js has the module numbers)
export const SURVIVORS = {
  lotte: { name: 'Lotte Brix', job: 'Pizza courier', found: 'watertower', night: 2, step: 'q2.ladder', needs: 'bunks',
    adds: { scout: true, routeEarly: true, carryHome: 1 }, rig: 'Calls out the march route at dawn and runs half your carried scrap home.' },
  benno: { name: 'Benno Scholz', job: 'Town hall clerk', found: 'townhall', night: 3, step: 'q3.steps', needs: 'bunks',
    adds: { searchFood: 1, records: true }, rig: 'Knows who lived where: +1 food from every house you search. Finds order 4471.' },
  gus: { name: 'Augusta "Gus" Lindner', job: 'Radio technician', found: 'hut', night: 5, step: 'q5.gus', needs: 'bunks2', optional: true,
    adds: { radio: true, forecast: true }, rig: 'Runs the Rig radio: hear the night\'s march at dusk; broadcasts play on the Rig.' },
};

// the last thing heard before the credits, and the hook for chapter 2 (radio r.12 carries the words)
export const HOOK = { next: 'ch2', road: 'north-east, to Reedwater Lock', mystery: 'the masts read a registry: one Mechanic, and the classes it is still seeking' };
