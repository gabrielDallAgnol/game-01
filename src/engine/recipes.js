// Recipes: an area variant is a list of atoms, stages in order, validators and params. Every
// variant of the opening area is one entry here, built by the same pipeline, so a new variant
// is a new recipe (and maybe a stage or two), never a change to the engine.
import { createRegistry } from './registry.js';
import { CH1_ATOMS } from '../atoms/ch1.js';
import { MILL_ATOMS } from '../atoms/milltown.js';
import { DOWNTOWN_ATOMS } from '../atoms/downtown.js';
import { terrainStage } from './stages/terrain.js';
import { waterStage } from './stages/water.js';
import { roadsStage } from './stages/roads.js';
import { lotsStage } from './stages/lots.js';
import { buildingsStage } from './stages/buildings.js';
import { campStage } from './stages/camp.js';
import { bridgesStage } from './stages/bridges.js';
import { propsStage } from './stages/props.js';
import { forestStage } from './stages/forest.js';
import { navStage } from './stages/nav.js';
import { railStage } from './stages/rail.js';
import { millStreetsStage } from './stages/millstreets.js';
import { millStage } from './stages/mill.js';
import { nestStage } from './stages/nest.js';
import { terracesStage } from './stages/terraces.js';
import { gridStreetsStage } from './stages/gridstreets.js';
import { civicStage } from './stages/civic.js';
import { ALL_VALIDATORS } from './validators.js';
import { buildWorld } from './pipeline.js';

// atoms every variant shares: the camp, lamps, cars, fences and the living woods
const shared = CH1_ATOMS.filter(a => ['camp', 'lamp', 'car', 'forest', 'fence'].some(t => a.tags.includes(t)));

export const RECIPES = {
  suburb: { name: 'suburb', blurb: 'Ashford Hollow: a grid of houses, Route 9, Hollow Creek', palette: 'ch1', size: { w: 370, h: 300 },
    atoms: CH1_ATOMS, stages: [terrainStage, waterStage, roadsStage, lotsStage, buildingsStage, campStage, bridgesStage, propsStage, forestStage, navStage], params: {},
    game: { camp: 'square' } },   // in the game the camp is the town square, so the whole town fits round the keep
  milltown: { name: 'mill town', blurb: 'Ironvale: rowhouses by the tracks, a mill, ruins near the nest', palette: 'ch1', size: { w: 360, h: 300 },
    atoms: [...shared, ...MILL_ATOMS], stages: [terrainStage, railStage, millStreetsStage, millStage, nestStage, terracesStage, campStage, propsStage, forestStage, navStage],
    params: { terrain: { north: 0.24, west: 0.1, south: 0.12 }, props: { streetTrees: 0, kerbCars: 0.5 } },
    game: { camp: 'middle' } },   // in the game the camp is a clearing off the middle of the high street
  downtown: { name: 'city centre', blurb: 'The old core: tall shopfront rows round square blocks, a plaza, a canal', palette: 'ch1', size: { w: 360, h: 300 },
    atoms: [...shared, ...CH1_ATOMS.filter(a => a.id === 'tree.street.a' || a.id === 'tree.yard.a' || a.id === 'bridge.road.a'), ...DOWNTOWN_ATOMS],
    stages: [terrainStage, waterStage, gridStreetsStage, civicStage, terracesStage, campStage, bridgesStage, propsStage, forestStage, navStage],
    params: { terrain: { north: 0.1, west: 0.05, south: 0.1, east: 0.1 }, water: { x: [0.17, 0.2], w: 8, name: 'the cut', wiggle: 0.25 },
      terrace: { yard: 0, front: 0.4, runMin: 6, runSpan: 8, alleyExtra: 0.5, ruin: 0, swap: 0.3 }, props: { streetTrees: 0.35, kerbCars: 0.6 } },
    game: { camp: 'square' } },   // the camp is the plaza
};

export function recipeRegistry(id) {
  const r = RECIPES[id]; if (!r) throw new Error(`no recipe ${id}`);
  const R = createRegistry().atoms(r.atoms);
  r.stages.forEach(s => R.stage(s)); ALL_VALIDATORS.forEach(v => R.validator(v));
  return R;
}

/** build one recipe; `extra` params override the recipe's (the game passes RECIPES[id].game) */
export function buildArea(id, seed, reg = recipeRegistry(id), extra = null) { const r = RECIPES[id]; return buildWorld(reg, { seed, area: id, chapter: r.palette, params: extra ? { ...r.params, ...extra } : r.params, ...r.size }); }
