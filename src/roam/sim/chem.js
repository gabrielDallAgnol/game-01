// [roam] Elements on machines: elemental hits add pips (play/hit.js); fire pips burn, water pips slow; three pips set off
// their recipe; reactions leave statuses (soaked, blind) and clouds (scald, fog) that blind what's inside. A machine
// standing in fire picks up fire pips; standing on soaked ground puts them out. A reaction that touches the ground hands
// it to the atom world (G.deliver). Machines leak oil when they die. Its own Rng stream.
// Offers G.hitElement(d, el), G.stepChem(dt).
import { Rng, hashSeed } from '../../sim/rng.js';
import { addPip, addStatus } from '../../play/hit.js';
import { PIPS } from '../../play/statuses.js';
export function createChem(G) {
  const { R, S, ev } = G, C = R.chem, rng = new Rng(hashSeed(G.seed, 'chem'));
  S.clouds = [];
  const alive = d => S.dead.includes(d);
  const W = {
    damage: (t, n) => { if (alive(t)) G.hurtFoe(t, n, 'chem'); },
    apply: (t, s) => { if (alive(t)) addStatus(t, s); },
    pip: (t, el) => { if (alive(t)) addPip(t, el, S.t + 0.001, W); },
    near: (x, y, r) => S.dead.filter(d => Math.hypot(d.x - x, d.y - y) < r),
    push: (o, x, y, f) => { const a = Math.atan2(o.y - y, o.x - x); o.vx += Math.cos(a) * f; o.vy += Math.sin(a) * f; },
    mark: (kind, x, y, r) => ev('burst', { kind, x, y, r }),
    cloud: (kind, x, y, r, t, dps) => { S.clouds.push({ kind, x, y, r, left: t, dur: t, dps }); },
    ground: (kind, x, y, r, t) => G.deliver(kind === 'wet' ? 'water' : 'fire', x, y, r, 1),
    react: (Rx, t) => ev('reaction', { id: Rx.id, x: t.x, y: t.y }),
  };
  const hitEl = (d, el) => alive(d) ? addPip(d, el, S.t, W) : null;
  (G.onDie ||= []).push(d => { if (rng.chance(C.slick)) G.addOil(d.x, d.y, rng.range(C.slickR[0], C.slickR[1]), C.slickLife); });
  function stepChem(dt) {
    for (const d of [...S.dead]) {
      const wet = G.onWet(d); if (wet && d.pips && d.pips.length) d.pips = d.pips.filter(p => p.el !== 'fire');
      if (d.pips && d.pips.length) { let fire = 0; for (let i = d.pips.length - 1; i >= 0; i--) { const p = d.pips[i]; p.left -= dt; if (p.left <= 0) d.pips.splice(i, 1); else if (p.el === 'fire') fire++; } if (fire) G.hurtFoe(d, PIPS.fire.dps * fire * dt, 'burn'); }
      if (d.st) for (const id of Object.keys(d.st)) if ((d.st[id].left -= dt) <= 0) delete d.st[id];
      if (alive(d) && (d.groundAt ?? -9) <= S.t - C.groundGap && G.inFire(d.x, d.y)) { d.groundAt = S.t; hitEl(d, 'fire'); } }
    for (let i = S.clouds.length - 1; i >= 0; i--) { const c = S.clouds[i]; c.left -= dt; if (c.left <= 0) { S.clouds.splice(i, 1); continue; }
      for (const d of [...S.dead]) if (Math.hypot(d.x - c.x, d.y - c.y) < c.r) { addStatus(d, 'blind'); if (c.dps) G.hurtFoe(d, c.dps * dt, 'chem'); } }
  }
  Object.assign(G, { hitElement: hitEl, stepChem });
}
