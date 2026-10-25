// The seed tree. One world seed splits into named children (chapter → area → block → lot → atom),
// each with its own Rng stream, so changing one branch never reshuffles another and the
// same seed always builds the same world.
import { Rng, hashSeed } from '../sim/rng.js';

export function seedNode(seed, path = 'world') {
  const s = hashSeed(seed, path);
  const node = {
    seed, path, value: s,
    rng: () => new Rng(s),
    child: name => seedNode(seed, `${path}/${name}`),
  };
  return node;
}

export function seedTree(worldSeed) { return seedNode(worldSeed >>> 0, 'world'); }
