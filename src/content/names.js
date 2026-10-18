// Cosmetic names for regions, picked per map seed.
import { Rng, hashSeed } from '../sim/rng.js';

const FIRST = ['Ashen', 'Crow', 'Hollow', 'Gallows', 'Bramble', 'Widow', 'Mire', 'Lantern', 'Thorn', 'Grey', 'Raven', 'Sorrow', 'Bone', 'Elder', 'Mourn', 'Cinder', 'Wolf', 'Candle', 'Briar', 'Tallow'];
const SECOND = ['Fields', 'Hollow', 'Reach', 'Moor', 'Glen', 'Copse', 'Ford', 'Barrow', 'Meadow', 'Rise', 'Dell', 'Wood', 'Heath', 'Crossing', 'Fen', 'Knoll'];

export function regionNames(seed, count) {
  const rng = new Rng(hashSeed(seed, 'names'));
  const used = new Set(), out = ['Hollowmere'];
  while (out.length < count) {
    const n = `${rng.pick(FIRST)} ${rng.pick(SECOND)}`;
    if (!used.has(n) && !n.startsWith('Hollow Hollow')) { used.add(n); out.push(n); }
  }
  return out;
}
