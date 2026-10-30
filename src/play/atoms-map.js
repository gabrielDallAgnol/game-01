// [play] Which atoms are made of what: the ground's chars (the char map's 2 m cells) and the city's placed atoms (by atom
// id) → a material in play/materials.js. Adding a burnable thing to the game = one line here (or a new material).
export const GROUND = { '"': 'dryGrass', ',': 'dryGrass', m: 'dryGrass', w: 'crop', b: 'crop', r: 'crop', s: 'crop', f: 'woodsFloor' };
export const PROPS = {
  car: 'fuelTank', bayCar: 'fuelTank', lorry: 'fuelTank', tractor: 'fuelTank', forklift: 'fuelTank', jerrycan: 'fuelTank', pump: 'fuelTank',
  bench: 'wood', fence: 'wood', gate: 'wood', pallet: 'wood', posts: 'wood', fencePost: 'wood', fenceDown: 'wood', scarecrow: 'wood', bikeshed: 'wood', shelter: 'wood', fallenTree: 'wood',
  bales: 'hay', baleRow: 'hay', baleStack: 'hay', tyres: 'oil',
};
// trees, hedges and buildings come from the town itself (town.trees, the land plan's hedges, town.buildings)
export const PLACED = { tree: 'tree', hedge: 'hedge', building: 'building', oil: 'oil' };
