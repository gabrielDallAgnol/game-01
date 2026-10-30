// [roam] Kai: getting on and off the vehicle, walking, the dash, the wrench (on its own, at the nearest foe or nest heart
// in reach), being hurt, going down and coming back. Offers G.hurtKai, G.stepKai(dt, inp).
export function createKai(G) {
  const { R, S, ev, dist, town } = G, { blocked } = town;
  function hurtKai(n) { const k = S.kai; if (k.dead || k.dash > 0) return; k.hp -= n; k.hurtT = S.t; ev('hurt', { n }); if (k.hp <= 0) { k.hp = 0; k.dead = R.kai.respawn; k.riding = false; ev('down', {}); } }
  function stepKai(dt, inp) {
    const k = S.kai, b = S.bike;
    if (k.dead > 0) { k.dead -= dt; if (k.dead <= 0) { k.dead = 0; k.hp = k.maxHp; k.x = town.start.x + 3; k.y = town.start.y + 5; ev('back', {}); } return; }
    if (inp.ride) { inp.ride = false; if (k.riding) { k.riding = false; const s = Math.sin(b.ang), c = Math.cos(b.ang); for (const off of [1.6, -1.6]) { const x = b.x - s * off, y = b.y + c * off; if (!blocked(x, y)) { k.x = x; k.y = y; break; } } b.speed = 0; ev('dismount', {}); }
      else if (dist(k, b) < R.bike.enter) { k.riding = true; ev('mount', {}); } }
    if (k.riding) G.stepVehicle(dt, inp);
    else {
      if (inp.dash && k.dashCd <= 0) { k.dash = R.dash.time; k.dashCd = R.dash.cd; ev('dash', { x: k.x, y: k.y }); } inp.dash = false;
      const sp = k.dash > 0 ? R.dash.dist / R.dash.time : R.kai.speed, m = Math.hypot(inp.x, inp.y);
      let tx = 0, ty = 0; if (m > 0.05) { tx = inp.x / Math.max(1, m); ty = inp.y / Math.max(1, m); } else if (k.dash > 0) { tx = Math.cos(k.face); ty = Math.sin(k.face); }
      k.vx += (tx * sp - k.vx) * Math.min(1, dt * (k.dash > 0 ? 30 : 10)); k.vy += (ty * sp - k.vy) * Math.min(1, dt * (k.dash > 0 ? 30 : 10));
      const nx = k.x + k.vx * dt, ny = k.y + k.vy * dt; if (!blocked(nx, k.y)) k.x = nx; if (!blocked(k.x, ny)) k.y = ny;
      if (Math.hypot(k.vx, k.vy) > 0.3) k.face = Math.atan2(k.vy, k.vx);
      k.dash = Math.max(0, k.dash - dt);
      // the wrench: hits the nearest foe (or a nest's heart) in reach, on its own
      k.cd -= dt; k.swing = Math.max(0, k.swing - dt);
      if (k.cd <= 0) {
        let tgt = null, td = R.kai.reach; for (const d of S.dead) { const r = dist(d, k); if (r < td) { td = r; tgt = d; } }
        let nest = null; if (!tgt) for (const n of S.nests) if (n.alive && dist(n, k) < R.kai.reach + 0.8) nest = n;
        if (tgt || nest) { const o = tgt || nest; k.cd = R.kai.swing; k.swing = 0.25; if (m < 0.1) k.face = Math.atan2(o.y - k.y, o.x - k.x); ev('swing', {});
          if (tgt) G.hurtFoe(tgt, R.kai.dmg, 'kai'); else G.hitNest(nest, R.kai.dmg); }
      }
    }
    k.dashCd = Math.max(0, k.dashCd - dt);
    if (S.t - k.hurtT > R.kai.regenAfter) k.hp = Math.min(k.maxHp, k.hp + R.kai.regen * dt);
  }
  Object.assign(G, { hurtKai, stepKai });
}
