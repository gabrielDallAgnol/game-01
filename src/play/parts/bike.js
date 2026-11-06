// [play] The bike's parts besides the gun (M6): engine, frame, lamp, tyres. Each changes how the bike plays, not only a
// number (docs/design/play-atoms.md §7): a punchy engine or a fast one, a heavy frame or a light one, a lamp that reads far
// or one that dazzles, tyres that grip or bounce. `stats` are what the part sets (anything it leaves out stays the stock
// value); `grow` names the stats a level raises and by how much per level; `module` is its look (a module on the bike's
// socket of that type, src/roam/bikelook.js), the same module a house socket could take later.
// Every entry: desc (what the player reads) and why (what the designer meant).
export const STOCK = {
  engine: { top: 14, accel: 9, ramMult: 1, ramKeep: false },
  frame: { hp: 100, soak: 0.7, topMult: 1, turnMult: 1, ramHeavy: false },
  lamp: { pull: 14, scan: 9, dazzle: 0 },
  tyres: { turn: 2.6, bounce: 0.45, slide: 0.8, lock: 0.18, crashMult: 1, smashKeep: false },
};
export const PART_SLOTS = ['engine', 'frame', 'lamp', 'tyres'];
export const PARTS = {
  // ---------- engines ----------
  engine_stock: { id: 'engine_stock', slot: 'engine', name: 'Stock Engine', stats: {}, grow: { top: 0.025, accel: 0.025 }, module: 'engine_stock',
    desc: 'The engine it came with. Honest.', why: 'The baseline every other engine is a trade against.' },
  engine_torque: { id: 'engine_torque', slot: 'engine', name: 'Torque Engine', stats: { top: 13, accel: 15 }, grow: { top: 0.02, accel: 0.03 }, module: 'engine_torque',
    desc: 'Punches out of every corner; a little less top speed.', why: 'For riders who stop and go in narrow streets: acceleration over speed.' },
  engine_racer: { id: 'engine_racer', slot: 'engine', name: 'Racer Engine', stats: { top: 17.5, accel: 8 }, grow: { top: 0.025, accel: 0.02 }, module: 'engine_racer',
    desc: 'Slow to wind up, very fast once it does.', why: 'Speed is safety in the open; a liability in the old town.' },
  engine_charger: { id: 'engine_charger', slot: 'engine', name: 'Charger Engine', stats: { accel: 10, ramMult: 1.6, ramKeep: true }, grow: { accel: 0.025, ramMult: 0.03 }, module: 'engine_charger',
    desc: 'Rams hit harder and the bike keeps its speed through them.', why: 'Turns ramming from a risk into a way to fight.' },
  // ---------- frames ----------
  frame_stock: { id: 'frame_stock', slot: 'frame', name: 'Stock Frame', stats: {}, grow: { hp: 0.08 }, module: 'frame_stock',
    desc: 'A plain tube frame.', why: 'The baseline.' },
  frame_plated: { id: 'frame_plated', slot: 'frame', name: 'Plated Frame', stats: { hp: 150, soak: 0.8, topMult: 0.92 }, grow: { hp: 0.08 }, module: 'frame_plated',
    desc: 'Steel plates on both sides: much tougher, a bit slower.', why: 'The tank choice: take the hits so Kai doesn\'t.' },
  frame_light: { id: 'frame_light', slot: 'frame', name: 'Light Frame', stats: { hp: 75, soak: 0.6, turnMult: 1.18 }, grow: { hp: 0.08 }, module: 'frame_light',
    desc: 'Drilled and stripped: it turns on a coin, and breaks sooner.', why: 'For dodging instead of soaking.' },
  frame_bullbar: { id: 'frame_bullbar', slot: 'frame', name: 'Bull-bar Frame', stats: { hp: 115, ramMult: 2.2, ramHeavy: true }, grow: { hp: 0.07, ramMult: 0.03 }, module: 'frame_bullbar',
    desc: 'A steel bar across the front: rams hurt, and even a brute won\'t stop you dead.', why: 'Pairs with the charger engine into a ramming build.' },
  // ---------- lamps ----------
  lamp_stock: { id: 'lamp_stock', slot: 'lamp', name: 'Stock Lamp', stats: {}, grow: { pull: 0.04, scan: 0.04 }, module: 'lamp_stock',
    desc: 'One headlight.', why: 'The baseline.' },
  lamp_wide: { id: 'lamp_wide', slot: 'lamp', name: 'Twin Lamps', stats: { pull: 20, scan: 12 }, grow: { pull: 0.04, scan: 0.04 }, module: 'lamp_wide',
    desc: 'Two lamps: scrap comes to you from further away.', why: 'A comfort part for collectors.' },
  lamp_scanner: { id: 'lamp_scanner', slot: 'lamp', name: 'Scanner Lamp', stats: { scan: 24 }, grow: { scan: 0.05 }, module: 'lamp_scanner',
    desc: 'A lamp on a stalk that reads rare recipes from far off.', why: 'Rarity you can see sooner is a reason to turn back.' },
  lamp_dazzle: { id: 'lamp_dazzle', slot: 'lamp', name: 'Dazzle Lamp', stats: { pull: 12, dazzle: 9 }, grow: { dazzle: 0.04 }, module: 'lamp_dazzle',
    desc: 'A blinding lamp: machines in its beam slow down.', why: 'A defensive lamp: what\'s ahead of you can\'t catch you.' },
  // ---------- tyres ----------
  tyres_stock: { id: 'tyres_stock', slot: 'tyres', name: 'Stock Tyres', stats: {}, grow: { turn: 0.02 }, module: 'tyres_stock',
    desc: 'Worn road tyres.', why: 'The baseline.' },
  tyres_grip: { id: 'tyres_grip', slot: 'tyres', name: 'Grip Tyres', stats: { turn: 3.3 }, grow: { turn: 0.02 }, module: 'tyres_grip',
    desc: 'Soft and wide: much tighter turns.', why: 'The handling part.' },
  tyres_bouncy: { id: 'tyres_bouncy', slot: 'tyres', name: 'Bouncers', stats: { bounce: 0.75, slide: 0.92, lock: 0.08, crashMult: 0.5 }, grow: { turn: 0.02 }, module: 'tyres_bouncy',
    desc: 'Fat and springy: walls throw you back out, and crashes hurt half as much.', why: 'Makes the wall bounce a move.' },
  tyres_knobbly: { id: 'tyres_knobbly', slot: 'tyres', name: 'Knobblies', stats: { turn: 2.9, crashMult: 0.3, smashKeep: true }, grow: { turn: 0.02 }, module: 'tyres_knobbly',
    desc: 'Studded: fences and bins don\'t slow you, crashes barely dent the bike.', why: 'For riding through the town instead of round it.' },
};
