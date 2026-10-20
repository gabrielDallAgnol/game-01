// Tower specialisations: a level 3 tower takes one role for good (Mortar, Brazier, Ballista, Watch Bell). Choosing
// one, how each role fires, the mortar shell's burst, and what a specialised tower adds to the threat estimate.
// The numbers live in content/towers.js. Area damage is the point: it scales with how thick the crowd is.
import { BIG } from './state.js';
import { BUILDINGS } from '../content/buildings.js';
import { MOBS } from '../content/mobs.js';
import { SPECS, SPEC_COST } from '../content/towers.js';

export function createTowers(G) {
  const { S, ev, fail, has } = G;
  const T3 = { dmg: BUILDINGS.tower.dmg[2], rate: BUILDINGS.tower.rate[2], range: BUILDINGS.tower.range[2] };
  const big = m => MOBS[m.kind] && MOBS[m.kind].size >= BIG;
  const live = m => m.rise >= 1 && m.hp > 0 && !(MOBS[m.kind] && MOBS[m.kind].animal);

  /** why this tower cannot specialise ('' = it can) */
  function specBlock(b, role) {
    if (!b || b.type !== 'tower') return 'Only towers specialise.';
    if (b.ruined) return 'Rebuild it first.';
    if (b.spec) return `It is already a ${SPECS[b.spec].name}.`;
    if (b.level < 3) return 'Specialise at level 3.';
    if (role !== undefined && !SPECS[role]) return 'No such role.';
    return '';
  }
  function specialise(id, role) {
    if (S.over) return false;
    const b = S.byId.get(id); { const why = specBlock(b, role); if (why) return fail(why); }
    if (S.gold < SPEC_COST) return fail(`Specialising costs ${SPEC_COST} scrap.`);
    if (!G.useHand()) return false;
    S.gold -= SPEC_COST; S.cur.spent += SPEC_COST; S.stats.goldSpent += SPEC_COST; S.stats.upgraded++; S.cur.upgraded.push(`tower:${role}`);
    b.spec = role; S.occVersion = (S.occVersion || 0) + 1;
    ev('spec', { id: b.id, role });
    return true;
  }

  // the tower's own bonuses (blessings, presence, the deadeye, the hero down) carry over as ratios of a plain level 3
  function scale(t) { return { k: t.dmg / T3.dmg, rk: t.rate / T3.rate, add: t.range - T3.range, shots: 1 + 0.5 * ((t.shots || 1) - 1) }; }
  function around(x, y, r) { const out = []; for (const m of S.mobs) if (live(m) && Math.abs(m.x - x) < r && Math.abs(m.y - y) < r && Math.hypot(m.x - x, m.y - y) < r) out.push(m); return out; }

  /** one specialised tower's turn (called from stepTowers instead of the plain arrow) */
  function stepSpec(b, t, dt) {
    b.cd -= dt; if (b.cd > 0) return;
    const D = SPECS[b.spec], s = scale(t);
    let fired = false;
    if (b.spec === 'mortar') {
      // the thickest knot of the dead in range (past the minimum): count neighbours round the 14 nearest
      const R = D.range + s.add, cand = around(b.x, b.y, R).filter(m => Math.hypot(m.x - b.x, m.y - b.y) >= D.min)
        .sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y) || p.id - q.id).slice(0, 14);
      let best = null, bn = 0;
      for (const m of cand) { let n = 0; for (const o of cand) if (Math.hypot(o.x - m.x, o.y - m.y) < D.splash) n += big(o) ? 2 : 1; if (n > bn) { bn = n; best = m; } }
      if (best) { G.fire(5, b.x, b.y, best, D.dmg * s.k * s.shots, 'tower', 10, { shell: D.splash, target: -1, life: 3, spec: 'mortar' }); fired = true; }
    } else if (b.spec === 'brazier') {
      const R = D.r + Math.max(0, s.add) * 0.3, ms = around(b.x, b.y, R);
      if (ms.length) {
        for (const m of ms) { G.hitMob(m, D.dmg * s.k * s.shots, 'tower'); if (m.hp > 0) m.burn = { t: D.burn.t, dps: Math.max(m.burn ? m.burn.dps : 0, D.burn.dps * s.k) }; }
        ev('flame', { id: b.id, x: b.x, y: b.y, r: R }); fired = true;
      }
    } else if (b.spec === 'ballista') {
      const R = D.range + s.add, ms = around(b.x, b.y, R);
      if (ms.length) {
        // a brute or a boss first, else the nearest
        const tgt = ms.filter(big).sort((p, q) => q.hp - p.hp || p.id - q.id)[0] || ms.sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y) || p.id - q.id)[0];
        const dx = tgt.x - b.x, dy = tgt.y - b.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
        for (const m of around(b.x, b.y, R + 1)) { const px = m.x - b.x, py = m.y - b.y, along = px * ux + py * uy; if (along < 0 || along > R) continue; if (Math.abs(px * uy - py * ux) < D.width) G.hitMob(m, D.dmg * s.k * s.shots * (big(m) ? D.big * (has('hunter') ? 1.3 : 1) : 1), 'tower'); }
        ev('bolt', { x0: b.x, y0: b.y, x1: b.x + ux * R, y1: b.y + uy * R, spec: 'ballista' }); fired = true;
      }
    } else if (b.spec === 'bell') {
      const R = D.r + Math.max(0, s.add) * 0.5, ms = around(b.x, b.y, R);
      if (ms.length) {
        for (const m of ms) { m.slowUntil = S.time + D.t; m.slowK = D.slow; m.markT = Math.max(m.markT || 0, D.t); G.hitMob(m, D.dmg * s.k, 'tower'); }
        ev('toll', { id: b.id, x: b.x, y: b.y, r: R }); fired = true;
      }
    }
    b.cd = fired ? D.rate * s.rk : 0.2;   // nothing in reach: look again shortly
  }
  /** a mortar shell lands: everything within its splash takes the hit */
  function shellBurst(p) {
    for (const m of around(p.tx, p.ty, p.shell)) G.hitMob(m, p.dmg, p.src);
    ev('shell', { x: p.tx, y: p.ty, r: p.shell });
  }
  /** what a specialised tower adds to the threat estimate: one target's dps × the dead it reaches in an average crowd */
  function specDps(b, t) {
    const D = SPECS[b.spec], s = scale(t), per = D.dmg * s.k * s.shots / (D.rate * s.rk);
    return per * D.est + (b.spec === 'brazier' ? D.burn.dps * s.k * D.est : 0) + (b.spec === 'bell' ? 3 : 0);   // the bell's marks: roughly +30% on a tower's worth nearby
  }
  /** how far the role reaches (the range ring the UI draws) */
  function specRange(b) { const D = SPECS[b.spec], s = scale(G.towerStats(b)); return D.range ? D.range + s.add : D.r + Math.max(0, s.add) * (b.spec === 'bell' ? 0.5 : 0.3); }
  return { specialise, specBlock, stepSpec, shellBurst, specDps, specRange, SPEC_COST };
}
