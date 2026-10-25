// The registry: every capability the engine has — atoms, stages, validators, palettes —
// registers here in one shape. The game, bots, tests, the lab and agents all read the same list.
import { validateAtom } from './schema.js';

export function createRegistry() {
  const atoms = new Map(), stages = [], validators = [];
  const R = {
    atom(def) {
      const err = validateAtom(def);
      if (err.length) throw new Error(`atom ${def && def.id}: ${err.join('; ')}`);
      if (atoms.has(def.id)) throw new Error(`atom ${def.id} registered twice`);
      atoms.set(def.id, Object.freeze({ sockets: [], needs: [], offers: [], tags: [], ...def }));
      return R;
    },
    atoms(list) { list.forEach(d => R.atom(d)); return R; },
    get(id) { const a = atoms.get(id); if (!a) throw new Error(`no atom ${id}`); return a; },
    has: id => atoms.has(id),
    list: () => [...atoms.values()],
    find: pred => [...atoms.values()].filter(pred),
    withTag: tag => [...atoms.values()].filter(a => a.tags.includes(tag)),
    offering: tag => [...atoms.values()].filter(a => a.offers.includes(tag)),
    needing: tag => [...atoms.values()].filter(a => a.needs.includes(tag)),
    stage(s) { stages.push(s); return R; },
    stages: () => stages.slice(),
    validator(v) { validators.push(v); return R; },
    validators: () => validators.slice(),
    describe: () => ({ atoms: atoms.size, stages: stages.map(s => s.name), validators: validators.map(v => v.name) }),
  };
  return R;
}
