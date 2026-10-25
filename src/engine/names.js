// Street names per recipe: words only (the stages name streets from their own seed branch, so names never move a
// building). Agents add names here.
export const STREET_NAMES = {
  suburb: ['Maple', 'Birch', 'Elm', 'Cedar', 'Willow', 'Aspen', 'Linden', 'Hazel', 'Rowan', 'Alder', 'Juniper', 'Poplar', 'Sycamore', 'Laurel', 'Chestnut', 'Hawthorn', 'Larch', 'Magnolia', 'Spruce', 'Beech', 'Clover', 'Orchard', 'Meadow', 'Fern', 'Holly', 'Ivy', 'Sumac', 'Tamarack'],
  milltown: ['Foundry', 'Kiln', 'Coal', 'Slag', 'Cinder', 'Forge', 'Anvil', 'Bellows', 'Furnace', 'Ingot', 'Rivet', 'Smelter'],
};
export const STREET_KINDS = { suburb: ['Street', 'Avenue', 'Lane', 'Drive', 'Court'], milltown: ['Row', 'Street', 'Terrace'] };
export function nameStreets(W, rng, recipe) {
  const names = rng.shuffle(STREET_NAMES[recipe].slice()), kinds = STREET_KINDS[recipe]; let k = 0;
  W.streets.forEach(s => { if (!s.name && s.kind === 'local') s.name = `${names[k++ % names.length]} ${kinds[rng.int(kinds.length)]}`; });
}
