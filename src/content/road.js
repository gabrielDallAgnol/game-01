// The road and the night missions: numbers and words. The rules live in src/sim/road.js and src/sim/missions.js.

// Four stations on the old road, nearest first. `at` is the distance from the camp along the road's axis.
export const STATIONS = [
  { id: 'bus', kind: 'bus', name: 'The Stalled Bus', short: 'Bus stop', at: 46, blurb: 'A school bus died on the verge. Somebody kept a fire going in a drum beside it.' },
  { id: 'ranger', kind: 'ranger', name: 'The Ranger Tower', short: 'Lookout', at: 78, blurb: 'A fire lookout over the trees. The stairs are still sound.' },
  { id: 'toll', kind: 'toll', name: 'The Toll Gate', short: 'Toll gate', at: 108, blurb: 'A toll booth at the old bridge, its barrier down across the road.' },
  { id: 'substation', kind: 'substation', name: 'The Substation', short: 'Substation', at: 136, blurb: 'Transformers humming behind a chain fence, right where the city begins.' },
];

export const ROAD = {
  side: 3.6,          // how far the clearing sits beside the road
  clear: 3.2,         // radius of the clearing cut out of the trees
  reach: 2.2,         // stand this close to the fire to light it
  lightTime: 3,       // seconds by the fire
  lightCost: 5,       // scrap for kindling and fuel (each relight too)
  hp: n => 40 + 8 * n,          // the fire's health on night n
  ring: 6,            // the lit ring at full health (it shrinks as the fire is beaten down, never under 3)
  ringMin: 3,
  rest: 5,            // hero health a second while resting inside a lit ring
  restPeople: 2,      // a convoy's people heal this much a second by the fire
  siegeR: 9,          // at night, marching dead this close to a lit outpost go for its fire
  siegeShare: 0.65,   // ...this share of them
  bigK: 3,            // a big one inside the ring hits the fire this many times harder
  towers: 2,          // forward towers an outpost takes
  revealR: 11,
  beacon: 1,          // while the camp has lost people, each lit outpost brings one back at dawn
  out: 26,            // past this distance from the camp, you are "out"
};

// Convoys: rescued people walking home behind the hero. The dead hunt them.
export const CONVOY = {
  speed: 1.5, cartSpeed: 1.3, road: 1.15,   // cells a second; the old road is a little quicker for them too
  hp: 12, cartHp: 26,
  gap: 1.05,          // spacing in the column
  sense: 1.4,         // the dead notice a convoy this much further away than they notice you
  cap: n => 10 + Math.floor(n / 2),         // dead hunting the convoy at once
  straggle: 13,       // a member this far behind the hero is a straggler (edge arrow)
  home: 9,            // within this distance of the keep they are home
  min: 2,             // fewer people than this just come straight in
  names: ['Mara', 'Tomas', 'Ines', 'Old Pell', 'Rui', 'Hanne', 'Dov', 'Lise', 'Bo', 'Nadia', 'Kofi', 'Jun', 'Sabe', 'Oren', 'Tilde', 'Yusuf', 'Wren', 'Ada', 'Piet', 'Lucia'],
};

// Road danger: if you stay out, the clever dead wait on your road home.
export const AMBUSH = { after: 40, every: 55, ahead: 18, minNight: 2, warn: '[Movement on the road ahead]', wait: 90 };

// Night missions: one choice at dusk. On a Pied Piper night a flare is a pitch flare: it burns where it lands (`traps.pyre*`).
export const MISSIONS = {
  hold: { name: 'Hold the Camp', icon: 'shield', line: 'Stand with your towers. The classic night.' },
  hunt: { name: 'The Hunt', icon: 'flame', line: 'The hives empty as their dead march. Sneak out and burn one. Lantern off: unseen but slow.' },
  piper: { name: 'The Pied Piper', icon: 'horn', line: 'Sound the horn and the dead come for you, not the camp. Lead them into a trap.' },
};
export const MISSION = {
  pick: 6,            // seconds to choose before Hold is chosen for you
  from: 2,            // the first night with a choice (night 1 is the System's arrival: you hold)
  hunt: { hiveK: 0.4, sneak: 2, pay: 1.5, horde: 0.6, sense: 0.5, speed: 0.85 },   // hives at 40% while their dead are out (strikes ×2 more while nothing hunts you in the dark); pays ×1.5; lantern off: sense ×0.5, you ×0.85
  // the horn: a share of the dead within r turn on you (for t seconds, or until you lose them past `lose`); for `call`
  // seconds after a blow the dead walking up into earshot hear it too. Louder with Horn levels (a Piper night that killed
  // `lvNeed` of what it led, `lvKills` at least) and with the camp's Noise. Each one that falls out of the camp pays at dawn.
  horn: { r: 36, share: 0.7, shareMax: 0.95, noiseShare: 0.002, lvR: 4, lvShare: 0.05, lvCap: 6, lvMax: 3, lvNeed: 0.6, lvKills: 8,
    cap: n => 6 + Math.round(1.5 * n), follow: 0.8, noise: 3, cd: 24, call: 14, t: 120, lose: 48, pay: 0.5, payBig: 2 },
  embers: { r: 5, t: 40, burn: 3, dps: 3 },   // a burned hollow smoulders (through the next night): the dead walking through it catch fire
  traps: { outpostPad: 1.6, outpostDps: 3, fordR: 3, fordDps: 3.2, slow: 0.4, burnT: 1.2, revealFord: 64, pyreR: 3.6, pyreDps: 2.6 },   // dps × the night's hp scale; `slow`: the led dead wade a ford or an ember field at this speed
  chainK: 0.8,        // out in the wilds a bloater's blast hurts the dead around it too
  captain: 0.15,      // towers +15% with a companion at home
};

// One short scripted scene per station, the first time you reach it by day.
// fx use the story engine's own ops; `road` effects are applied by the road (cart, a free fire).
export const STATION_SCENES = {
  bus: { eyebrow: '[Location discovered]', title: 'The Stalled Bus',
    scene: 'Inside the school bus, chalk on the windows: **WE ARE STILL HERE**. A mother, two kids and their grandfather, out of water for a day.',
    choices: [
      { id: 'home', label: 'Walk them home', hint: '+4 people, if you get them to the camp. The dead will smell them.', fx: [{ op: 'survivors', n: 4 }] },
      { id: 'fuel', label: 'Drain the tank and move on', hint: '+6 scrap.', fx: [{ op: 'gold', n: 6 }] },
    ] },
  ranger: { eyebrow: '[Survivor detected]', title: 'The Ranger Tower',
    scene: 'A ranger called **Ilse** has watched the road from up here for a month. She counts the dead going by like weather.',
    choices: [
      { id: 'home', label: 'Bring her and her stores home', hint: '+1 person and a cart of +8 food, if you get them to the camp.', fx: [{ op: 'survivors', n: 1 }], road: { cart: { food: 8 } } },
      { id: 'watch', label: 'She keeps the fire lit', hint: 'The tower\'s fire is lit for free. +1 hero damage from her sighting tips.', fx: [{ op: 'perk', key: 'heroDmg', add: 1 }], road: { light: true } },
    ] },
  toll: { eyebrow: '[Location discovered]', title: 'The Toll Gate',
    scene: 'A booth, a barrier, a ledger. Someone has been **charging the living** to cross. Three travellers wait behind the gate with a handcart.',
    choices: [
      { id: 'home', label: 'Open the gate for them', hint: '+3 people and a cart of +12 scrap, if you get them home.', fx: [{ op: 'survivors', n: 3 }], road: { cart: { scrap: 12 } } },
      { id: 'ledger', label: 'Take the toll box', hint: '+10 scrap. The travellers go their own way.', fx: [{ op: 'gold', n: 10 }] },
    ] },
  substation: { eyebrow: '[Location discovered]', title: 'The Substation',
    scene: 'Linemen in orange vests, five of them, holed up behind the transformers. **The city is right there.** They want out.',
    choices: [
      { id: 'home', label: 'Lead them out of the city', hint: '+5 people and a cart of +15 scrap. It is a long way home.', fx: [{ op: 'survivors', n: 5 }], road: { cart: { scrap: 15 } } },
      { id: 'copper', label: 'Strip the copper', hint: '+12 scrap. They stay, and wish you luck.', fx: [{ op: 'gold', n: 12 }] },
    ] },
};
