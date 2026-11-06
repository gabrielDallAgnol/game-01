// [roam] Mending a broken bridge (the Point, Nov 1: docs/design/the-point.md §5). Cause and consequence:
// - A broken deck's gap is a shut gate over water (town.js): nothing on wheels or feet crosses it.
// - While a big machine is wedged in the gap, nobody can mend it. Freed, it climbs out (sim/freeing.js).
// - Then Kai can mend it: she brings R.bridges.scrap scrap (carried: it is at risk on the way) to its end, MEND, and the
//   people of the town work while she guards them: the deck grows over R.bridges.time s while she stays within R.bridges.near
//   of it (away, the work waits). Done, the gate opens for good: the road runs on, and what walks beyond can come over too.
// Offers G.canMend(), G.mend(), G.stepBridges(dt). S.bridges: [{ name, x, y, ux, uy, half, gap, state, prog }].
export function createBridges(G) {
  const { R, S, ev, town } = G, B = R.bridges;
  const gateOf = b => (town.gates || []).find(g => g.deck === b.name);
  S.bridges = (town.decks || []).filter(D => D.gap).map(D => ({ name: D.name, x: D.x, y: D.y, ux: D.ux, uy: D.uy, half: D.half, gap: D.gap.r, a: D.a, b: D.b, state: 'broken', prog: 0 }));
  for (const b of S.bridges) { const g = gateOf(b); if (g) g.open = false; }   // a new run starts with every gap shut (the gates live on the town)
  const wedged = b => S.dead.some(d => d.boss && Math.hypot(d.x - b.x, d.y - b.y) < 10) || (S.guardians || []).some(g => Math.hypot(g.x - b.x, g.y - b.y) < 9);
  const atEnd = b => { const k = S.kai; return !k.dead && Math.min(Math.hypot(k.x - b.a.x, k.y - b.a.y), Math.hypot(k.x - b.b.x, k.y - b.b.y)) < B.reach; };
  const here = () => S.bridges.find(b => b.state === 'broken' && atEnd(b));
  function canMend() { const b = here(); return !!(b && !wedged(b)); }
  function mend() { const b = here(); if (!b) return false; if (wedged(b)) { ev('mendNo', { why: 'wedged' }); return false; }
    if (S.scrap < B.scrap) { ev('mendNo', { why: 'scrap', need: B.scrap, have: S.scrap }); return false; }
    S.scrap -= B.scrap; b.state = 'mending'; ev('mendStart', { name: b.name, x: b.x, y: b.y }); return true; }
  function stepBridges(dt) { const k = S.kai;
    for (const b of S.bridges) { if (b.state !== 'mending') continue; const near = !k.dead && Math.hypot(k.x - b.x, k.y - b.y) < B.near;
      if (!near) { if (!b.away) { b.away = true; ev('mendWait', { name: b.name }); } continue; } b.away = false;
      const p0 = b.prog; b.prog = Math.min(1, b.prog + dt / B.time); if (Math.floor(p0 * 4) !== Math.floor(b.prog * 4) && b.prog < 1) ev('mendStep', { name: b.name, prog: b.prog });
      if (b.prog >= 1) { b.state = 'mended'; const g = gateOf(b); if (g) g.open = true; ev('mended', { name: b.name, x: b.x, y: b.y }); } } }
  Object.assign(G, { canMend, mend, stepBridges });
}
