// [roam] The world: Hollowmere and the land round it. buildRegion(seed) returns one W in the engine's shape (streets,
// nodes, placed, plaza, water, districts, districtAt, camp) for the whole world, in world metres from (0, 0), plus:
//   land:  [{ kind, poly: [{ x, y }…], dir?, … }]   what covers the ground outside lots and streets (see world/land.js)
//   sites: [{ id, x, y, rot, … }]                   the special places laid out by world/sites.js (gas station, farm…)
// Street kinds: 'local' (a town street with pavements), 'path', and any kind in world/streets.js (country lanes, the
// bypass): the painting and the slots read the kind's profile there.
// STUB (the world agent replaces it): the engine's town alone, as before.
import { RECIPES, recipeRegistry, buildArea } from '../../engine/recipes.js';
export function buildRegion(seed = 7) {
  const W = buildArea('hollowmere', seed, recipeRegistry('hollowmere'), RECIPES.hollowmere.game).W;
  W.land = []; W.sites = [];
  return W;
}
