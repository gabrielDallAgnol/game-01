// [roam] The chemistry in the world: elemental hits on machines (play/hit.js), statuses ticking (burning hurts, wet and
// soaked slow, blind loses you), steam clouds, fire on the ground, and oil: the town's old oil stains and the slicks a
// machine leaks when it dies. Fire on oil lights it; a fire patch lights the oil next to it. Kai is never hurt by her own
// reactions. Its own Rng stream. Offers G.hitElement(d, el), G.igniteNear(x0, y0, x1, y1), G.stepChem(dt).
import { Rng, hashSeed } from '../../sim/rng.js';
import { hitElement, addStatus } from '../../play/hit.js';
import { STATUSES } from '../../play/statuses.js';
export function createChem(G) {
  const { R, S, ev, town } = G, C = R.chem, rng = new Rng(hashSeed(G.seed, 'chem'));
  S.clouds = []; S.grounds = []; let oid = 1;
  // the oil: the town's stains (where cars stood for years), each a small flammable puddle
  S.oil = (town.dress ? town.dress.list : []).filter(i => i.atom.id === 'oil').map(i => ({ id: oid++, x: i.x, y: i.y, r: C.stainR }));
  const alive = d => S.dead.includes(d);
  const W = {
    damage: (t, n) => { if (alive(t)) G.hurtFoe(t, n, 'chem'); },
    apply: (t, s) => { if (alive(t)) addStatus(t, s, S.t); },
    near: (x, y, r) => S.dead.filter(d => Math.hypot(d.x - x, d.y - y) < r),
    push: (o, x, y, f) => { const a = Math.atan2(o.y - y, o.x - x); o.vx += Math.cos(a) * f; o.vy += Math.sin(a) * f; },
    mark: (kind, x, y, r) => ev('burst', { kind, x, y, r }),
    cloud: (kind, x, y, r, t, dps) => { S.clouds.push({ kind, x, y, r, left: t, dur: t, dps }); },
    ground: (kind, x, y, r, t) => { S.grounds.push({ kind, x, y, r, left: t, dur: t }); },
    react: (Rx, t) => ev('reaction', { id: Rx.id, x: t.x, y: t.y }),
  };
  const hitEl = (d, el) => alive(d) ? hitElement(d, el, S.t, W) : null;
  // fire passing over oil (a pellet's path from (x0, y0) to (x1, y1), or a fire patch) lights it
  function igniteNear(x0, y0, x1, y1, pad = 0.3) { for (let i = S.oil.length - 1; i >= 0; i--) { const o = S.oil[i], ex = x1 - x0, ey = y1 - y0, L2 = ex * ex + ey * ey || 1e-9, u = Math.max(0, Math.min(1, ((o.x - x0) * ex + (o.y - y0) * ey) / L2));
    if (Math.hypot(o.x - x0 - ex * u, o.y - y0 - ey * u) < o.r + pad) { S.oil.splice(i, 1); W.ground('fire', o.x, o.y, o.r + C.fireGrow, C.fireTime); ev('ignite', { x: o.x, y: o.y }); } } }
  // a machine bleeds oil when it dies: sometimes a slick stays on the street (and fights move through the slicks)
  (G.onDie ||= []).push(d => { if (rng.chance(C.slick)) S.oil.push({ id: oid++, x: d.x, y: d.y, r: rng.range(C.slickR[0], C.slickR[1]), left: C.slickLife }); });
  function stepChem(dt) {
    for (const d of S.dead) { if (!d.st) continue;   // statuses tick down; burning hurts
      for (const id of Object.keys(d.st)) { const s = d.st[id], D = STATUSES[id]; s.left -= dt; if (s.left <= 0) { delete d.st[id]; continue; }
        if (D.dps) G.hurtFoe(d, D.dps[s.stacks - 1] * dt, 'burn'); } }
    for (let i = S.clouds.length - 1; i >= 0; i--) { const c = S.clouds[i]; c.left -= dt; if (c.left <= 0) { S.clouds.splice(i, 1); continue; }
      for (const d of S.dead) if (Math.hypot(d.x - c.x, d.y - c.y) < c.r) { addStatus(d, 'blind', S.t); if (c.dps) G.hurtFoe(d, c.dps * dt, 'chem'); } }
    for (let i = S.grounds.length - 1; i >= 0; i--) { const g = S.grounds[i]; g.left -= dt; if (g.left <= 0) { S.grounds.splice(i, 1); continue; }
      if (g.kind === 'fire') { for (const d of [...S.dead]) if (Math.hypot(d.x - g.x, d.y - g.y) < g.r) hitEl(d, 'fire'); igniteNear(g.x, g.y, g.x, g.y, g.r); } }
    for (let i = S.oil.length - 1; i >= 0; i--) { const o = S.oil[i]; if (o.left !== undefined && (o.left -= dt) <= 0) S.oil.splice(i, 1); }
  }
  Object.assign(G, { hitElement: hitEl, igniteNear, stepChem });
}
