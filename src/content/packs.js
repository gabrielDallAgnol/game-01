// Building packs (Islanders-style): every dawn you pick 1 of 2 packs and place them for free.
// Gold still buys upgrades, the keep, sellswords, rerolls and any extra building at a premium.

export const PACKS = [
  { id: 'homestead', kind: 'eco', name: 'Homestead', items: { house: 2, farm: 1 }, from: 1, weight: 3 },
  { id: 'fields',    kind: 'eco', name: 'Fields',    items: { farm: 2, house: 1 }, from: 1, weight: 2 },
  { id: 'village',   kind: 'eco', name: 'Village',   items: { house: 3 }, from: 3, weight: 2 },
  { id: 'township',  kind: 'eco', name: 'Township',  items: { house: 3, farm: 2 }, from: 7, weight: 2 },
  { id: 'watch',     kind: 'def', name: 'Watch post', items: { tower: 2 }, from: 1, weight: 3 },
  { id: 'stockade',  kind: 'def', name: 'Stockade',  items: { wall: 3, tower: 1 }, from: 1, weight: 2 },
  { id: 'bulwark',   kind: 'def', name: 'Bulwark',   items: { wall: 5 }, from: 3, weight: 1 },
  { id: 'garrison',  kind: 'def', name: 'Garrison',  items: { tower: 3, wall: 2 }, from: 6, weight: 2 },
  { id: 'crossroads',kind: 'mix', name: 'Crossroads', items: { house: 1, tower: 1, farm: 1 }, from: 2, weight: 2 },
];

export const PACK_RULES = {
  start: { tower: 1, house: 1, farm: 1 },   // what you hold before the first night, on top of the first pack
  premium: 2,                               // buying a building with gold costs this many times its price
  reroll: 5,                                // gold to show two other packs
};
