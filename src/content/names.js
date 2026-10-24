// Names for the city's districts and its Inferno Nests, picked per map seed. Modern, a little worn.
import { Rng, hashSeed } from '../sim/rng.js';

const FIRST = ['Ashford', 'Kingsgate', 'Marrow', 'Northwall', 'Saltmarket', 'Greyfield', 'Vine', 'Cannery', 'Harbour', 'Old Mill', 'Bellmont', 'Tanner', 'Foundry', 'Linden', 'Crown', 'Weaver', 'Rook', 'Station', 'Chapel', 'Copper'];
const SECOND = ['Quarter', 'Row', 'Heights', 'Yards', 'Square', 'Estate', 'Docks', 'Park', 'Gardens', 'Cross', 'End', 'Terrace', 'Hill', 'Lane'];
const LINES = ['Red', 'Orange', 'Circle', 'Harbour', 'Night', 'Green', 'Silver'];
const SAINTS = ['Agnes', 'Brigid', 'Lucia', 'Anselm', 'Cyprian', 'Margaret', 'Jude'];
const PUMPS = ['Ninth Street', 'Crossroads', 'Ringway', 'Old Toll', 'Westway', 'Bypass'];
export const HIVE_KINDS = ['metro', 'petrol', 'hospital'];

export function regionNames(seed, count) {
  const rng = new Rng(hashSeed(seed, 'names'));
  const used = new Set(), out = ['Hollowmere'];
  while (out.length < count) {
    const n = `${rng.pick(FIRST)} ${rng.pick(SECOND)}`;
    if (!used.has(n)) { used.add(n); out.push(n); }
  }
  return out;
}
/** an Inferno Nest is a building that went bad: it keeps its old name */
export function hiveName(seed, region) {
  const rng = new Rng(hashSeed(seed, 'hive', region)), kind = HIVE_KINDS[region % HIVE_KINDS.length];
  if (kind === 'metro') return `${rng.pick(LINES)} Line Substation`;
  if (kind === 'petrol') return `${rng.pick(PUMPS)} Gas Station`;
  return `St. ${rng.pick(SAINTS)}'s Boiler Works`;
}
