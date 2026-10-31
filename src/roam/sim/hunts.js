// [roam] Hunts: gunfire builds heat; each time it boils over, a hunting pack comes for Kai from out of sight, from one
// or two sides, already on her trail. Holding the trigger in one place draws wave after wave; riding on and firing in
// bursts keeps the heat down. Heat cools on its own. Offers G.heatUp(n), G.stepHunts(dt).
export function createHunts(G) {
  const { R, S, rng, ev, town } = G, { blocked } = town, H = R.hunt;
  S.heat = 0; S.hunts = 0;
  const heatUp = n => { S.heat += n; };
  function spawnPack() {
    const k = S.kai, sides = 1 + (rng.chance(H.twoSides) ? 1 : 0), n = H.size[0] + rng.int(H.size[1] - H.size[0] + 1) + (S.night ? H.nightExtra : 0), r0 = Math.max(26, G.view + 6);
    for (let s = 0; s < sides; s++) { const a = rng.range(0, 6.28);
      for (let i = 0; i < Math.ceil(n / sides); i++) for (let t = 0; t < 10; t++) { const aa = a + rng.range(-0.5, 0.5), rr = r0 + rng.range(0, 14), x = k.x + Math.cos(aa) * rr, y = k.y + Math.sin(aa) * rr;
        if (!blocked(x, y) && !(G.isClean && G.isClean(x, y))) { G.spawn(G.kindRoll(), x, y, { state: 'chase', hunt: true }); break; } } }
    S.hunts++; ev('hunt', { n, sides });
  }
  function stepHunts(dt) { S.heat = Math.max(0, S.heat - H.cool * dt); if (S.heat >= H.boil && !S.kai.dead) { S.heat -= H.boil; spawnPack(); } }
  Object.assign(G, { heatUp, stepHunts });
}
