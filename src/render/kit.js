// Hollowmere city kit — refined low-poly modern ruins (ported from concept/kit.js).
// Composition root: every builder lives in src/render/kit/ (one module per prop family); this file only gathers them
// into the K namespace the renderer uses (K.apartment, K.M, K.T …) and re-exports the build switches (CFG).
// Units: metres. Every builder returns a THREE.Group with its origin at ground centre; front faces +z.
import { CFG } from './kit/config.js';
import { P, lin } from './kit/palette.js';
import { T, setMask, setMaskArrays, setFootprints, territory } from './kit/territory.js';
import { VCM, M, EMITW, WIN, LENS } from './kit/materials.js';
import { rng } from './kit/rng.js';
import { B, rboxGeo } from './kit/builder.js';
import { place, sign, textTex, glowDecal, glowSprite } from './kit/helpers.js';
import { weeds, apartment, rubble, streets, grass } from './kit/city.js';
import { car, bus, container, sandbags, jersey, lamp, trafficLight, busStop, tree, bush, barrelFire } from './kit/street.js';
import { townhouse } from './kit/houses.js';
import { post, tower, barricade, chainMat } from './kit/defences.js';
import { farm } from './kit/farm.js';
import { keep } from './kit/keep.js';
import { hall, home } from './kit/frontier.js';
import { hospital, metro, petrol, police, hollow, infest } from './kit/hives.js';
import { FIGMAT } from './kit/rig.js';
import { figure, heroes, dead, folk } from './kit/people.js';
import { beam, zoneCells, chevrons, ghost, ring } from './kit/overlays.js';
import { flattenVC, ruinOf, SWEEP } from './kit/flatten.js';

export { CFG };
export const K = { hall, home, VCM, flattenVC, ruinOf, SWEEP, P, M, T, setMask, setMaskArrays, setFootprints, territory, EMITW, WIN, LENS, lin, rng, B, weeds, beam, place, post, rboxGeo, sign, textTex, glowDecal, glowSprite, apartment, rubble, streets, grass, car, bus, container, sandbags, jersey, lamp, trafficLight, busStop, tree, bush, barrelFire, townhouse, tower, barricade, farm, keep, hospital, metro, petrol, police, hollow, infest, figure, heroes, dead, folk, FIGMAT, zoneCells, chevrons, ghost, ring, chainMat };
