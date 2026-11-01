// [play] Loot (docs/design/new-direction.md, "Economy: loot and currency"): what machines drop, how rare it is, and what a
// dropped weapon carries. Rarity sets a weapon's modifier slots (common 0, tuned 1, rare 2, epic 3). Scrap is the common
// currency (every kill), chips the rare one (nests, salvaging rare parts). Pure data and rolls: the sim decides when.
// Every entry: desc (what the player reads) and why (what the designer meant).
export const RARITY = {
  common: { id: 'common', slots: 0, color: '#bdb6a6', glow: 0.25, scrap: 2, chips: 0, scanned: true,
    desc: 'Common: the base weapon, no modifiers.', why: 'Most drops; a new base to try, or scrap.' },
  tuned: { id: 'tuned', slots: 1, color: '#5aa8ff', glow: 0.6, scrap: 5, chips: 0, scanned: true,
    desc: 'Tuned: one modifier. A blue light.', why: 'The first real upgrade; readable at speed.' },
  rare: { id: 'rare', slots: 2, color: '#ffd23a', glow: 0.9, scrap: 10, chips: 1, scanned: false,
    desc: 'Rare: two modifiers. A yellow light; it lies unscanned until your lamp reaches it.', why: 'The turn-back moment: worth a detour; the scan is a small reveal.' },
  epic: { id: 'epic', slots: 3, color: '#b46bff', glow: 1.0, scrap: 18, chips: 2, scanned: false,
    desc: 'Epic: three modifiers. A violet light.', why: 'The build-maker: three modifiers stack into a new way to shoot.' },
};
export const RARITIES = ['common', 'tuned', 'rare', 'epic'];
// the modifiers a dropped weapon can roll (one element at most: a second element would replace the first)
export const MOD_POOL = [
  { id: 'double_shot', w: 3 }, { id: 'faster', w: 3 }, { id: 'ricochet', w: 2 }, { id: 'fire', w: 2, element: true }, { id: 'water', w: 2, element: true },
];
// the weapon bases that drop, by weight (the launcher and thrower change the world: rarer)
export const BASE_POOL = [{ id: 'scatter', w: 6 }, { id: 'launcher', w: 2 }, { id: 'thrower', w: 2 }];
// what each machine leaves: scrap pieces [min, max], the chance of a weapon, and its rarity weights
// [m6] machines drop recipes, not weapons (Gabriel, Nov 1: gear off a monster is confusing): `recipe` is the chance of
// one, `rarity` its weights (play/recipes.js rolls which). [m6b] fewer, and almost no epics (Gabriel: too much dropping to
// keep up with); the incremental start (scrap first, the first recipe from a mission) comes with M8
// [point] chip: the chance a machine's chip comes through its death whole (every machine runs on one; most crack). Burning
// when it dies, the chip burns with it (chance x chipBurnt): fire costs you chips. Chips build the freeing chip and upgrades
export const chipBurnt = 0.3;
export const DROPS = {
  crawler: { scrap: [1, 2], chip: 0.08, recipe: 0.012, rarity: { common: 80, tuned: 20, rare: 0, epic: 0 },
    desc: 'A crawler: a little scrap.', why: 'The common kill feeds the common currency.' },
  skitter: { scrap: [1, 2], chip: 0.08, recipe: 0.012, rarity: { common: 80, tuned: 20, rare: 0, epic: 0 }, desc: 'A skitter: a little scrap.', why: 'Fast and weak: small reward.' },
  hound: { scrap: [2, 3], chip: 0.12, recipe: 0.025, rarity: { common: 65, tuned: 30, rare: 5, epic: 0 }, desc: 'A hound: some scrap, now and then a recipe.', why: 'It hunts you: a bit more for the risk.' },
  spitter: { scrap: [2, 3], chip: 0.14, recipe: 0.03, rarity: { common: 60, tuned: 32, rare: 8, epic: 0 }, desc: 'A spitter: some scrap, now and then a recipe.', why: 'Ranged and dangerous: worth chasing down.' },
  brute: { scrap: [4, 6], chip: 0.6, recipe: 0.2, rarity: { common: 45, tuned: 45, rare: 10, epic: 0 },
    desc: 'A brute: a pile of scrap, often its chip, often a recipe.', why: 'The tougher machine is the loot piñata.' },
  walker: { scrap: [24, 32], recipe: 1, chips: 5, rarity: { common: 0, tuned: 60, rare: 35, epic: 5 },
    desc: 'A walker: a heap of scrap, chips, and a good recipe.', why: 'The area boss pays like one: the reward for a clean area.' },
};
const pickW = (rng, list) => { let t = 0; for (const e of list) t += e.w; let r = rng.range(0, t); for (const e of list) { if ((r -= e.w) < 0) return e; } return list[list.length - 1]; };
export function rollRarity(rng, weights) { return pickW(rng, RARITIES.map(id => ({ id, w: weights[id] || 0 }))).id; }
// a dropped weapon: { base, rarity, mods, seed }; modifiers may repeat (two double shots stack), one element at most
export function rollWeapon(rng, weights) {
  const rarity = rollRarity(rng, weights), base = pickW(rng, BASE_POOL).id, mods = []; let el = false;
  for (let i = 0; i < RARITY[rarity].slots; i++) { const pool = MOD_POOL.filter(m => !(m.element && el)), m = pickW(rng, pool); if (m.element) el = true; mods.push(m.id); }
  return { base, rarity, mods, seed: Math.floor(rng.range(0, 1e9)) };
}
// what salvaging a weapon pays
export const salvageOf = w => ({ scrap: RARITY[w.rarity].scrap + w.mods.length, chips: RARITY[w.rarity].chips });

// [m3b] a dropped weapon's name, Diablo-style: a prefix from its first modifier, a suffix from its second (the third
// shows in the bag). The base names come from the weapon parts. Words only; the colour is its rarity's.
export const PREFIX = { double_shot: 'Twin', faster: 'Quick', ricochet: 'Glancing', fire: 'Burning', water: 'Soaking' };
export const SUFFIX = { double_shot: 'of Plenty', faster: 'of Haste', ricochet: 'of Echoes', fire: 'of Embers', water: 'of the Flood' };
export const BASE_NAME = { scatter: 'Scatter Gun', launcher: 'Launcher', thrower: 'Thrower' };
export const NAMING = { desc: 'A weapon is named by its modifiers: Burning Launcher of Haste.', why: 'Diablo II: the name on the ground tells you what it is before you pick it up.' };
export function nameOf(w) { const [a, b] = w.mods; return [a && PREFIX[a], BASE_NAME[w.base] || w.base, b && SUFFIX[b]].filter(Boolean).join(' '); }
