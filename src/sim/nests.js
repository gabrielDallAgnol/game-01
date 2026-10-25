// Where a hive's body stands and what is near one: the hero heals nowhere near a living hive (sim/hero.js regen).
// (Guard packs, rage, strikes and locked sites were cut on Oct 25: V2's night is the hordes.)
export function createNests(G) {
  const { S, map } = G;
  /** where the hive's body stands (the building's middle for a hive in a building) */
  const nestBody = reg => reg.nest.body || reg.nest;
  /** is a point within d of a living hive's body (centre to point)? (the hero rests nowhere near one) */
  const nearHive = (x, y, d) => map.regions.some(r => r.nest && S.nestAlive[r.id] && !S.sealed[r.id] && Math.hypot(x - nestBody(r).x, y - nestBody(r).y) < d);
  return { nestBody, nearHive };
}
