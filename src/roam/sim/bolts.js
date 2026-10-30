// [roam] The machines' shots: a spitter spits a slow glowing bolt where Kai will be (a little lead, never perfect); it
// flies straight, pops on walls, hurts her if it reaches her. Slow on purpose: you see it coming and can steer out of it.
// Offers G.foeShoot(d), G.stepBolts(dt).
export function createBolts(G) {
  const { R, S, ev, town } = G, { blocked } = town;
  S.bolts = []; let bid = 1;
  function foeShoot(d) {
    const K = R.dead[d.kind], B = K.bolt, k = S.kai, r = Math.hypot(k.x - d.x, k.y - d.y), lead = Math.min(0.8, r / B.speed) * 0.9;
    const tx = k.x + k.vx * lead, ty = k.y + k.vy * lead, a = Math.atan2(ty - d.y, tx - d.x);
    S.bolts.push({ id: bid++, x: d.x + Math.cos(a) * 0.6, y: d.y + Math.sin(a) * 0.6, vx: Math.cos(a) * B.speed, vy: Math.sin(a) * B.speed, life: B.life, dmg: K.dmg, r: B.r, from: d.id });
    ev('spit', { id: d.id, x: d.x, y: d.y, ang: a });
  }
  function stepBolts(dt) {
    const k = S.kai;
    for (let i = S.bolts.length - 1; i >= 0; i--) { const b = S.bolts[i]; b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
      let gone = b.life <= 0;
      if (!gone && blocked(b.x, b.y)) { gone = true; ev('boltPop', { x: b.x, y: b.y }); }
      if (!gone && !k.dead && Math.hypot(b.x - k.x, b.y - k.y) < b.r + (k.riding ? 0.5 : 0.3)) { gone = true; G.hurtKai(b.dmg); ev('boltHit', { x: b.x, y: b.y }); }
      if (gone) S.bolts.splice(i, 1); }
  }
  Object.assign(G, { foeShoot, stepBolts });
}
