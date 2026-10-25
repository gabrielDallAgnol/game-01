// Chapter 1 wiring: the atoms, the stages in order and the validators that Ashford Hollow
// is built from. The order of stages is part of the result (each draws from its own seed branch).
import { createRegistry } from './registry.js';
import { CH1_ATOMS } from '../atoms/ch1.js';
import { terrainStage } from './stages/terrain.js';
import { waterStage } from './stages/water.js';
import { roadsStage } from './stages/roads.js';
import { lotsStage } from './stages/lots.js';
import { buildingsStage } from './stages/buildings.js';
import { bridgesStage } from './stages/bridges.js';
import { propsStage } from './stages/props.js';
import { forestStage } from './stages/forest.js';
import { navStage } from './stages/nav.js';
import { ALL_VALIDATORS } from './validators.js';
import { buildWorld } from './pipeline.js';

export const CH1_SIZE = { w: 370, h: 300 };

export function chapter1Registry() {
  const R = createRegistry().atoms(CH1_ATOMS);
  [terrainStage, waterStage, roadsStage, lotsStage, buildingsStage, bridgesStage, propsStage, forestStage, navStage].forEach(s => R.stage(s));
  ALL_VALIDATORS.forEach(v => R.validator(v));
  return R;
}

export function buildChapter1(seed, reg = chapter1Registry()) { return buildWorld(reg, { seed, chapter: 'ch1', ...CH1_SIZE }); }
