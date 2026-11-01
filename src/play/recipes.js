// [play] Recipes (M6, Gabriel Nov 1): machines drop recipes, not gear; traders and missions will hand them out too. A recipe
// is learned for good once banked; building from it in the garage costs scrap and chips. One shape for everything:
// `needs` (scrap, chips; later parts) and what it makes, so the garage's builds and, later, missions ("build this house a
// turret") read the same data.
// - weapon recipes: a base, a rarity, the mods built in and how many sockets are left (built-in + sockets = the rarity's
//   slots; some recipes have it all built in, others are mostly sockets). Damage never comes from the recipe: it comes
//   from the weapon's level (the garage's upgrade), so an early recipe never turns into junk.
// - mod recipes: one mod (WoW gems): goes into a socket for good.
// - part recipes: an engine, frame, lamp or tyres (play/parts/bike.js).
// Every entry: desc (what the player reads) and why (what the designer meant).
import { RARITY, RARITIES, rollRarity } from './loot.js';
import { MODIFIERS } from './modifiers.js';
import { PARTS } from './parts/bike.js';
export const MOD_NAME = { double_shot: 'Double Shot', faster: 'Quickfire', ricochet: 'Ricochet', fire: 'Fire', water: 'Water', fire_charge: 'Fire Charge', water_charge: 'Water Charge' };
export const ELEMENT_MODS = new Set(['fire', 'water', 'fire_charge', 'water_charge']);
// what building costs, by rarity (mods are cheaper than weapons and parts)
// (chips only from rare up: a headless 10 min run banks ~400 scrap but only a few chips, from brutes, walkers and duplicates)
export const COST = { gear: { common: [15, 0], tuned: [40, 0], rare: [90, 2], epic: [160, 5] }, mod: { common: [10, 0], tuned: [25, 0], rare: [50, 1], epic: [90, 3] } };
const W = (id, name, base, rarity, mods, sockets, desc, why) => ({ id, kind: 'weapon', name, base, rarity, mods, sockets, desc, why });
const MD = (mod, rarity, why) => ({ id: 'mod_' + mod, kind: 'mod', name: MOD_NAME[mod] + ' Mod', mod, rarity, desc: MODIFIERS[mod].desc + ' Goes into a socket for good.', why });
const PT = (part, rarity) => ({ id: 'part_' + part, kind: 'part', name: PARTS[part].name, part, slot: PARTS[part].slot, rarity, desc: PARTS[part].desc, why: PARTS[part].why });
const LIST = [
  W('scatter', 'Scatter Gun', 'scatter', 'common', [], 0, 'The scatter gun you started with.', 'Known from the start: the fallback build.'),
  W('scatter_open', 'Socketed Scatter', 'scatter', 'tuned', [], 1, 'A scatter gun with one empty socket.', 'The first socket: your first real decision.'),
  W('scatter_twin', 'Twin Scatter', 'scatter', 'tuned', ['double_shot'], 0, 'Four pellets a shot, built in.', 'A fixed upgrade for people who don\'t want to choose.'),
  W('scatter_glance', 'Glancing Scatter', 'scatter', 'rare', ['ricochet'], 1, 'Pellets ricochet; one socket free.', 'A path change plus a choice.'),
  W('scatter_wide', 'Open Scatter', 'scatter', 'rare', [], 2, 'Two empty sockets.', 'The blank gun for builders.'),
  W('scatter_inferno', 'Inferno Scatter', 'scatter', 'epic', ['double_shot', 'ricochet', 'fire'], 0, 'Burning pellets that ricochet, four a shot. All built in.', 'A signature gun: no sockets, a fixed identity.'),
  W('launcher', 'Launcher', 'launcher', 'tuned', [], 1, 'A rocket tube with one socket.', 'The launcher changes the town; one socket to shape it.'),
  W('launcher_fire', 'Fire Launcher', 'launcher', 'rare', ['fire'], 1, 'Fire rockets; one socket free.', 'Lights hedges, cars, fields: power with a cost.'),
  W('launcher_open', 'Open Launcher', 'launcher', 'epic', [], 3, 'Three empty sockets.', 'The big build-maker.'),
  W('thrower', 'Flamethrower', 'thrower', 'tuned', ['fire'], 0, 'A short jet of fire.', 'Close and committed.'),
  W('hose', 'Water Hose', 'thrower', 'tuned', ['water'], 0, 'A short jet of water: soaks machines, puts fires out.', 'The setup weapon; and the town\'s fire brigade.'),
  W('thrower_open', 'Open Thrower', 'thrower', 'rare', [], 2, 'A thrower with two empty sockets (water if you socket it).', 'Build the jet you want.'),
  MD('faster', 'common', 'A cheap, always-useful mod.'), MD('water', 'common', 'The setup element.'), MD('fire_charge', 'common', 'The off-hand enchant, now a mod.'), MD('water_charge', 'common', 'Mixes pips from one gun.'),
  MD('double_shot', 'tuned', 'The biggest feel upgrade.'), MD('ricochet', 'tuned', 'Narrow streets become a strength.'), MD('fire', 'tuned', 'Sets machines and the world burning.'),
  PT('engine_stock', 'common'), PT('frame_stock', 'common'), PT('lamp_stock', 'common'), PT('tyres_stock', 'common'),
  PT('engine_torque', 'tuned'), PT('frame_plated', 'tuned'), PT('frame_light', 'tuned'), PT('lamp_wide', 'tuned'), PT('tyres_grip', 'tuned'), PT('tyres_bouncy', 'tuned'),
  PT('engine_racer', 'rare'), PT('engine_charger', 'rare'), PT('frame_bullbar', 'rare'), PT('lamp_scanner', 'rare'), PT('lamp_dazzle', 'rare'), PT('tyres_knobbly', 'rare'),
];
// [point] key items: built, never dropped (the rolls below skip them). The freeing chip: Kai's copy of whatever woke the
// robot up, built for one big machine; it is spent when that machine is freed
const KEYS = [{ id: 'link_chip', kind: 'key', key: 'link', name: 'Freeing Chip', rarity: 'rare', cost: [40, 6], desc: 'Kai\'s copy of whatever woke you up. Link it to a weakened big machine to free it. Spent when it works.', why: 'Big machines are freed, not destroyed: freed, one filters the ash and the colour comes back. Chips from machines are what it is made of.' }];
export const RECIPES = Object.fromEntries(LIST.concat(KEYS).map(r => [r.id, r]));
// known from the start: the gun and the stock parts Kai rides out with
export const STARTING = ['scatter', 'part_engine_stock', 'part_frame_stock', 'part_lamp_stock', 'part_tyres_stock'];
export const costOf = r => { const c = r.cost || COST[r.kind === 'mod' ? 'mod' : 'gear'][r.rarity]; return { scrap: c[0], chips: c[1] }; };
export const recipeName = id => (RECIPES[id] ? RECIPES[id].name : id) + ' recipe';
// what a recipe you already know is worth instead
export const dupeChips = r => ({ common: 1, tuned: 1, rare: 2, epic: 3 })[r.rarity];
// a recipe drop: a rarity by the machine's weights, then any recipe of that rarity (not the starting ones). If none has
// that rarity the next rarer one down is used
export function rollRecipe(rng, weights) {
  let rarity = rollRarity(rng, weights);
  for (let i = RARITIES.indexOf(rarity); i >= 0; i--) { const pool = LIST.filter(r => r.rarity === RARITIES[i] && !STARTING.includes(r.id)); if (pool.length) return pool[Math.floor(rng.range(0, pool.length)) % pool.length].id; }
  return LIST[0].id;
}
export { RARITY };
