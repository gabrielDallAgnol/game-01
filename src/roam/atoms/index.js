// [roam] Every city atom, family by family. A family is one file exporting an array of atoms; add it here with one import
// and one spread at the end of ATOMS (append, never reorder: order is placement priority).
import { STREET, MARKS } from './street.js';
<<<<<<< HEAD
import { PROPS } from './props.js';
export const ATOMS = [
  ...STREET,
  ...MARKS,
  ...PROPS,
=======
import { LIFE, LITTER } from './life.js';
export const ATOMS = [
  ...STREET,
  ...MARKS,
  ...LIFE,
  ...LITTER,
>>>>>>> v2-atoms-life
];
