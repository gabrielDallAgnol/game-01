// The woods underfoot: worn trails. Every time the hero walks into a patch of woods off your land it remembers the
// pass; after WOODS.passes passes (at least WOODS.gap seconds apart, so it takes a few trips over a few days) the
// trees there are gone and the cell is a dirt trail: full speed for the hero, and for the dead too (MOVE_COST dirt 1).
// The trees vanish at once; the dead's flow fields catch up at the next dusk or dawn (a refresh is expensive).
// Saved in the snapshot as S.trails (save.js `[woods]`). Wired in game.js: createWoods in MODULES, stepWoods in step().
import { WOODS } from '../content/woods.js';
import { T, idx, inside } from './mapgen.js';

export function createWoods(G) {
  const { S, map, ev, toast } = G;
  const wear = new Map();   // cell → { n: passes, at: time of the last pass } (not saved: a reload forgets half-worn ground)
  let cell = -1, phase = '', flowLate = false;
  const wearable = i => map.terrain[i] === T.FOREST && map.lm[i] < 0 && S.occ[i] < 0 && !G.inZone(i);
  /** turn cells into trail (also used by restore); returns the cells that changed */
  function makeTrail(cells) {
    const out = [];
    for (const i of cells) if (map.terrain[i] === T.FOREST) { map.terrain[i] = T.DIRT; out.push(i); }
    return out;
  }
  function stepWoods() {
    const h = S.hero;
    if (S.phase !== phase) { phase = S.phase; if (flowLate) { flowLate = false; S.flowDirty = true; } }
    if (h.dead || !h.moving) return;
    const cx = Math.floor(h.x), cy = Math.floor(h.y); if (!inside(cx, cy)) return;
    const i = idx(cx, cy); if (i === cell) return; cell = i;
    if (!wearable(i)) return;
    let w = wear.get(i); if (!w) wear.set(i, w = { n: 0, at: -1e9 });
    if (S.time - w.at < WOODS.gap) return;
    w.n++; w.at = S.time;
    if (w.n < WOODS.passes) return;
    wear.delete(i);
    const cells = makeTrail([i]); if (!cells.length) return;
    (S.trails || (S.trails = [])).push(...cells); flowLate = true;
    ev('trail', { cells });
    if (!S.trailTold) { S.trailTold = true; toast(WOODS.told, 'sys'); }
  }
  return { stepWoods, makeTrail };
}
