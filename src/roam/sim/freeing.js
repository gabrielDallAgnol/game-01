// [roam] Freeing a big machine (the Point, Nov 1: docs/design/the-point.md §2, §4). Cause and consequence:
// - In an area marked free, its walker can't be destroyed: shot down, its core stops at a floor and lies open (weak).
// - Kai builds a freeing chip at the garage (chips + scrap). With one, near a weak big machine, Kai links to it: its pulse
//   comes every R.free.pulse s, and a tap (inp.link) in time with a pulse lands; a miss costs one and locks the link a
//   moment. R.free.need landed taps free it. Riding away, or going down, breaks the link (no chip is lost).
// - Freed, it stops being a machine that fights: it leaves the fight list (S.dead) for S.guardians, its eyes turn amber,
//   the small machines it bred power down with it (they were its own: they drop what they carry), the chip is spent,
//   and its area is clean (the colour sweeps back from where it stood: the glow-up). Wedged in a bridge, it climbs out
//   to a post on the bank beside it, so the bridge can be mended (sim/bridges.js).
// Offers G.canLink(), G.stepFreeing(dt, inp). Events: weak (areas.js), linkStart, linkHit, linkMiss, linkBreak, freed.
export function createFreeing(G) {
  const { R, S, ev, town } = G, F = R.free;
  S.link = null; S.guardians = [];
  // where a free area exists, Kai knows how to build a freeing chip from the start: it is the first thing she makes
  if (S.areas.some(a => a.free) && G.learn) G.learn(['link_chip']);
  const near = (d, k) => Math.hypot(k.x - d.x, k.y - d.y) < F.linkR + F.body;
  const weakBoss = () => S.dead.find(d => d.boss && d.free && d.weak);
  function canLink() { const k = S.kai, d = weakBoss(); return !!(d && !k.dead && (S.keys.link || 0) > 0 && !S.link && near(d, k)); }
  // a freed machine's post: wedged in a broken bridge, it climbs out onto the bank on the town's side, off the road
  function postOf(d) { const D = (town.decks || []).find(q => q.gap && Math.hypot(q.x - d.x, q.y - d.y) < 8);
    if (!D) return { x: d.x, y: d.y };
    for (const side of [1, -1]) for (const back of [12, 18, 24]) { const x = D.a.x - D.ux * back - D.uy * side * 15, y = D.a.y - D.uy * back + D.ux * side * 15; if (!town.blocked(x, y)) return { x, y }; }
    return { x: D.a.x - D.ux * 16, y: D.a.y - D.uy * 16 }; }
  function free(d) { const a = S.areas[d.area];
    S.keys.link--; S.link = null; S.dead.splice(S.dead.indexOf(d), 1);
    for (const q of S.dead.slice()) if (q.mother === d.id) { ev('powerDown', { id: q.id, x: q.x, y: q.y }); G.killFoe(q, 'link'); }
    S.guardians.push({ id: d.id, kind: 'walker', x: d.x, y: d.y, fa: d.fa || 0, vx: 0, vy: 0, plates: d.plates, parts: d.parts, area: d.area, friend: true, post: postOf(d), t0: S.t });
    ev('freed', { id: d.id, x: d.x, y: d.y, area: a ? a.i : -1, name: a ? a.name : '' });
    G.cleanArea(a, d.x, d.y); }
  function stepFreeing(dt, inp) { const k = S.kai, tap = !!inp.link; if (tap) inp.link = false;
    if (S.link) { const L = S.link, d = S.dead.find(q => q.id === L.id);
      if (!d || k.dead || !near(d, k)) { S.link = null; ev('linkBreak', {}); }
      else { L.t += dt; L.lock = Math.max(0, L.lock - dt);
        if (tap && L.lock <= 0) { const ph = L.t % F.pulse, off = Math.min(ph, F.pulse - ph);
          if (off < F.window / 2) { L.prog++; ev('linkHit', { prog: L.prog, need: F.need }); if (L.prog >= F.need) free(d); }
          else { L.prog = Math.max(0, L.prog - 1); L.lock = F.lock; ev('linkMiss', { prog: L.prog }); } } } }
    else if (tap && canLink()) { const d = weakBoss(); S.link = { id: d.id, t: 0, prog: 0, lock: 0 }; ev('linkStart', { id: d.id, need: F.need, pulse: F.pulse }); }
    // the freed walk to their posts and stand there, facing the water they came out of
    for (const g of S.guardians) { const dx = g.post.x - g.x, dy = g.post.y - g.y, L = Math.hypot(dx, dy);
      if (L > 0.3) { const sp = Math.min(L, F.guardSpeed * dt); g.x += dx / L * sp; g.y += dy / L * sp; g.vx = dx / L * F.guardSpeed; g.vy = dy / L * F.guardSpeed; g.fa = Math.atan2(dy, dx); }
      else if (g.vx || g.vy) { g.vx = g.vy = 0; ev('guardPost', { id: g.id, x: g.x, y: g.y }); } } }
  Object.assign(G, { canLink, stepFreeing });
}
