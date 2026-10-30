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
export const DROPS = {
  crawler: { scrap: [1, 2], weapon: 0.04, rarity: { common: 70, tuned: 25, rare: 5, epic: 0 },
    desc: 'A crawler: a little scrap.', why: 'The common kill feeds the common currency.' },
  skitter: { scrap: [1, 2], weapon: 0.04, rarity: { common: 70, tuned: 25, rare: 5, epic: 0 }, desc: 'A skitter: a little scrap.', why: 'Fast and weak: small reward.' },
  hound: { scrap: [2, 3], weapon: 0.08, rarity: { common: 60, tuned: 30, rare: 9, epic: 1 }, desc: 'A hound: some scrap, now and then a weapon.', why: 'It hunts you: a bit more for the risk.' },
  spitter: { scrap: [2, 3], weapon: 0.1, rarity: { common: 55, tuned: 32, rare: 11, epic: 2 }, desc: 'A spitter: some scrap, now and then a weapon.', why: 'Ranged and dangerous: worth chasing down.' },
  brute: { scrap: [4, 6], weapon: 0.6, rarity: { common: 35, tuned: 40, rare: 20, epic: 5 },
    desc: 'A brute: a pile of scrap, often a weapon.', why: 'The tougher machine is the loot piñata (M3: weapon drops from tougher machines).' },
  nest: { scrap: [8, 12], weapon: 1, chips: 2, rarity: { common: 0, tuned: 50, rare: 38, epic: 12 },
    desc: 'A nest: chips, and always a weapon (tuned or better).', why: 'Effort eventually wins: the big targets guarantee something good.' },
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
