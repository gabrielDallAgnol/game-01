// [roam] The vehicle (the bike for now): throttle along the stick, steer toward it, crash into walls, smash small props,
// ram foes at speed. Kai rides it. Offers G.stepVehicle(dt, inp).
export function createVehicle(G) {
  const { R, S, ev, dist, town } = G, { blocked } = town;
  // the breakables on a 10 m grid, for the smash test
  const BG = 10, bgrid = new Map(); for (const p of town.breakables || []) { const k = Math.floor(p.x / BG) * 4096 + Math.floor(p.y / BG); if (!bgrid.has(k)) bgrid.set(k, []); bgrid.get(k).push(p); }
  function stepVehicle(dt, inp) {
    const k = S.kai, b = S.bike;
    const want = Math.hypot(inp.x, inp.y) > 0.15 ? Math.atan2(inp.y, inp.x) : null;
    if (b.turnLock > 0) b.turnLock -= dt;
    if (want !== null && !(b.turnLock > 0)) { let d = want - b.ang; d = Math.atan2(Math.sin(d), Math.cos(d)); b.ang += Math.max(-1, Math.min(1, d * 2.5)) * R.bike.turn * dt * Math.min(1, 0.3 + b.speed / 6);
      const throttle = Math.min(1, Math.hypot(inp.x, inp.y)) * (Math.abs(d) > 2.2 ? 0.2 : 1); b.speed = Math.min(R.bike.top * throttle, b.speed + R.bike.accel * dt); }
    else b.speed = Math.max(0, b.speed - R.bike.brake * 0.5 * dt * (want === null ? 1 : 0.3));
    const nx = b.x + Math.cos(b.ang) * b.speed * dt, ny = b.y + Math.sin(b.ang) * b.speed * dt;
    // [m3d] a wall turns the bike instead of stopping it: the part of its speed into the wall bounces back (restitution
    // R.bike.bounce), the part along it slides on (R.bike.slide), and the bike turns to where it is now going. A glancing
    // hit just steers it along the wall; a head-on one throws it back out, already turned away
    if (blocked(nx, ny)) { const hx = blocked(nx, b.y), hy = blocked(b.x, ny); let mx = hx ? -Math.sign(nx - b.x) : 0, my = hy ? -Math.sign(ny - b.y) : 0;
      if (!mx && !my) { mx = -Math.cos(b.ang); my = -Math.sin(b.ang); } const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
      const vx = Math.cos(b.ang) * b.speed, vy = Math.sin(b.ang) * b.speed, into = vx * mx + vy * my;
      if (into < 0) { const tx = vx - into * mx, ty = vy - into * my, ox = tx * R.bike.slide - into * R.bike.bounce * mx, oy = ty * R.bike.slide - into * R.bike.bounce * my;
        if (-into > 6) ev('crash', { x: b.x, y: b.y }); b.speed = Math.hypot(ox, oy); if (b.speed > 0.05) b.ang = Math.atan2(oy, ox); b.turnLock = R.bike.lock; }
      else b.speed *= 0.5;
      if (!blocked(b.x + mx * 0.08, b.y + my * 0.08)) { b.x += mx * 0.08; b.y += my * 0.08; } }
    else { b.x = nx; b.y = ny; }
    // a small prop in the way breaks (the bike loses a little speed); it stays broken
    if (Math.abs(b.speed) > 1.5) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const p of bgrid.get((Math.floor(b.x / BG) + i) * 4096 + Math.floor(b.y / BG) + j) || [])
      if (!S.broken.has(p.id) && Math.hypot(p.x - b.x, p.y - b.y) < p.r + 1.1) { S.broken.add(p.id); b.speed *= 0.82; ev('smash', { id: p.id, x: p.x, y: p.y, ang: b.ang }); }
    if (b.speed > R.bike.ram) for (const d of [...S.dead]) if (dist(d, b) < 1.3) { if (R.dead[d.kind].heavy) { G.hurtFoe(d, 1, 'bike'); b.speed *= -0.3; G.hurtKai(4); ev('crash', { x: b.x, y: b.y }); break; }   // a brute stops the bike dead
      G.hurtFoe(d, R.bike.ramDmg * b.speed / R.bike.top, 'bike'); b.speed *= 0.8; const a = Math.atan2(d.y - b.y, d.x - b.x); d.vx += Math.cos(a) * 6; d.vy += Math.sin(a) * 6; ev('ram', { x: d.x, y: d.y }); }
    k.x = b.x; k.y = b.y; k.vx = Math.cos(b.ang) * b.speed; k.vy = Math.sin(b.ang) * b.speed; k.face = b.ang;
  }
  Object.assign(G, { stepVehicle });
}
