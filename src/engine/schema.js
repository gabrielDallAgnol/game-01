// The atom schema: one shape for every thing in the world. An atom is data, never code.
// validateAtom returns a list of problems (empty = valid), so agents get a precise report.
import { SOCKETS } from './sockets.js';
import { ROLES } from './palettes.js';

export const LAYERS = ['ground', 'water', 'road', 'mark', 'drive', 'shadow', 'low', 'figure', 'roof', 'canopy', 'fog', 'light'];
export const KINDS = ['building', 'prop', 'tree', 'vehicle', 'street', 'water', 'lot', 'figure', 'item', 'rig'];
export const COLLIDE = ['box', 'circle', 'segment', 'none'];
// How the flat renderer draws an atom. A look is a drawing grammar shared by many atoms,
// so a new atom picks a look and roles, and needs no drawing code.
export const LOOKS = ['gable', 'flat', 'canopy', 'tarp', 'rig', 'car', 'lamp', 'ring', 'pool', 'tree', 'deadtree', 'ruin', 'railcar', 'tower', 'crater', 'nest', 'pylon', 'none'];

export function validateAtom(a) {
  const err = [];
  const need = (cond, msg) => { if (!cond) err.push(msg); };
  need(a && typeof a.id === 'string' && /^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(a.id), 'id: dotted lower-case, e.g. house.suburban.a');
  if (!a) return err;
  need(KINDS.includes(a.kind), `kind: one of ${KINDS.join(', ')}`);
  need(Array.isArray(a.size) && a.size.length === 2 && a.size.every(n => typeof n === 'number' && n > 0 && n < 400), 'size: [width, depth] in metres');
  need(typeof a.height === 'number' && a.height >= 0 && a.height < 120, 'height: metres, used for shadows');
  need(LAYERS.includes(a.layer), `layer: one of ${LAYERS.join(', ')}`);
  need(COLLIDE.includes(a.collide), `collide: one of ${COLLIDE.join(', ')}`);
  need(LOOKS.includes(a.look), `look: one of ${LOOKS.join(', ')}`);
  need(Array.isArray(a.roles) && a.roles.length > 0, 'roles: at least one palette role');
  (a.roles || []).forEach(r => need(ROLES.includes(r), `roles: unknown role ${r}`));
  (a.sockets || []).forEach((s, i) => {
    need(SOCKETS[s.type], `sockets[${i}].type: unknown socket ${s.type}`);
    need(['front', 'back', 'left', 'right', 'center'].includes(s.at), `sockets[${i}].at: front/back/left/right/center`);
  });
  need(!a.needs || Array.isArray(a.needs), 'needs: array of tags');
  need(!a.offers || Array.isArray(a.offers), 'offers: array of tags');
  need(!a.tags || Array.isArray(a.tags), 'tags: array');
  need(a.light === undefined || (typeof a.light === 'number' && a.light >= 0 && a.light <= 1), 'light: 0..1 chance it is lit at night');
  return err;
}
