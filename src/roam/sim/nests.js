// [roam] The nests: each breeds guards (faster at night) and has a heart to break; the last heart down wins the run.
// Offers G.hitNest, G.stepNests.
export function createNests(G) {
  const { R, S, rng, ev, dist, town } = G, { blocked } = town;
  function hitNest(nest, n) { nest.hp -= n; nest.hit = S.t; ev('nestHit', { id: nest.id }); if (nest.hp <= 0) { nest.alive = false; S.nestsLeft--; for (const f of G.onNestDown || []) f(nest); ev('nestDown', { id: nest.id, x: nest.x, y: nest.y }); if (!S.nestsLeft) { S.won = true; ev('won', {}); } } }
  function stepNests(dt) {
    for (const n of S.nests) { if (!n.alive) continue; if ((n.spawnT -= dt) > 0) continue; n.spawnT = S.night ? R.nest.nightEvery : R.nest.every;
      const guards = S.dead.filter(d => d.nest === n.id).length; if (guards >= R.nest.guards || dist(n, S.kai) > 140) continue;
      for (let k = 0; k < 8; k++) { const a = rng.range(0, 6.28), x = n.x + Math.cos(a) * rng.range(1.5, 4), y = n.y + Math.sin(a) * rng.range(1.5, 4); if (!blocked(x, y)) { G.spawn(G.kindRoll(), x, y, { nest: n.id, state: 'wander', wx: x, wy: y }); ev('breed', { id: n.id }); break; } } }
  }
  Object.assign(G, { hitNest, stepNests });
}
