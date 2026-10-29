// [roam] Sites: the special places of a town and its land (a gas station, a supermarket and its car park, a farm), each
// a template that lays out its own buildings, ground and atoms round a point. The world (region.js) decides where.
//   SITES[id] = { size: [w, h] (its footprint, m, facing +y = its road side), build(site, ctx) }
//   build(site, ctx): site = { id, x, y, rot, h (0..1) }; ctx.place(building) adds a building in the engine's shape
//   ({ x, y, w, h, rot, def: { kind: 'building', look, tags, light, height, size } , door? }), ctx.land(poly, kind)
//   covers ground (see land.js), ctx.street(pts, kind, w) adds a drive or lot lane.
// Roof looks beyond gable and flat are painted by roofLook(look, X, p) (into the roof map: rgb = slope axis, which side,
// gable flag; a = roof), or fall back to flat.
// The ids the world places (fixed, so the world and the buildings can be built apart): gas, supermarket, diy, warehouse,
// farm, garage, school. A building with def.collide 'none' (a canopy) is not a wall.
// STUB (the buildings agent fills it in).
export const SITES = {};
export function roofLook(look, X, p) { return false; }
