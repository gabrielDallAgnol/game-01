// [roam] Every city atom, family by family. A family is one file exporting an array of atoms; add it here with one import
// and one spread at the end of ATOMS (append, never reorder: order is placement priority).
import { STREET, MARKS } from './street.js';
import { PROPS } from './props.js';
import { LIFE, LITTER } from './life.js';
import { STRANDS } from './strands.js';
import { GROUND_MARKS } from './marks.js';
import { SITE_ATOMS } from './sites.js';
import { FARM } from './farm.js';
import { PLUMES } from './plume.js';
export const ATOMS = [
  ...STREET,
  ...MARKS,
  ...PROPS,
  ...LIFE,
  ...LITTER,
  ...STRANDS,
  ...GROUND_MARKS,
  ...SITE_ATOMS,
  ...FARM,
  ...PLUMES,   // last: plumes attach to atoms already placed
];
