// [combat2] What a telegraphed bite and the dash look like (?v2combat=1): a red ring on the ground under a dead
// that is winding up, with a red disc growing inside it to the rim as the bite nears; a quick white flash where a
// bite whiffs; a pale streak along the hero's dash. Flat on the ground and laid on it, under the units, so it reads from straight
// above (?top=1) as well as from the usual camera. Reads the state and drained events only; null without the flag.
/* global THREE */
import { WINDUP } from '../../content/combat2.js';

export function createTelegraph(V) {
  const { game, S, fx, fx2, Wv } = V;
  if (!game.combat2 || !game.combat2()) return null;
  const R = WINDUP.reach + WINDUP.grace, NP = 24, H = 0.07;
  const flat = g => { g.rotateX(-Math.PI / 2); return g; };
  const rimGeo = flat(new THREE.RingGeometry(0.8, 1, 48)), edgeGeo = flat(new THREE.RingGeometry(0.74, 1.08, 48)), discGeo = flat(new THREE.CircleGeometry(1, 40)), streakGeo = flat(new THREE.PlaneGeometry(1, 1));
  const mat = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false, toneMapped: false });   // on the ground, under the units
  // one rim + disc per winding dead, pooled
  const pool = [];
  for (let k = 0; k < NP; k++) {
    const g = new THREE.Group(), edge = new THREE.Mesh(edgeGeo, mat('#2a0400', 0.45)), rim = new THREE.Mesh(rimGeo, mat('#ff2414', 0.95)), disc = new THREE.Mesh(discGeo, mat('#ff1a0a', 0.5));
    edge.renderOrder = 10; rim.renderOrder = 12; disc.renderOrder = 11; g.add(edge, disc, rim); g.visible = false; fx.add(g); pool.push({ g, rim, disc });   // the dark edge under the red reads on pale sand and dark grass alike
  }
  // the dash streaks: from where it began to where the hero is now, fading out
  const streaks = [];
  for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(streakGeo, mat('#e8f6ff', 0)); m.renderOrder = 11; m.visible = false; fx.add(m); streaks.push({ m, x0: 0, y0: 0, life: 0, max: 0.4 }); }
  let si = 0;
  const at = (x, y, h = H) => Wv(x, y, h).clone();
  const mobOf = id => (V.feel && V.feel.mobOf ? V.feel.mobOf(id) : S.mobs.find(m => m.id === id));

  function update(dt, events) {
    for (const e of events || []) {
      if (e.t === 'whiff') { const m = mobOf(e.id); if (m) { const p = at(m.x, m.y, 0.15); fx2.ring(p.x, p.y, p.z, R * 1.1, '#ffffff', 0.28); fx2.emit('spark', p.x, p.y + 0.5, p.z, 8, { spread: 0.5 }); } }
      if (e.t === 'dash') { const s = streaks[si]; si = (si + 1) % streaks.length; s.x0 = e.x; s.y0 = e.y; s.life = s.max; const p = at(e.x, e.y, 0.2); fx2.emit('smoke', p.x, p.y, p.z, 8, { spread: 0.4, size: 0.6, life: 0.6 }); fx2.ring(p.x, p.y, p.z, 0.9, '#cfefff', 0.3); }
    }
    // the wind-ups in play, nearest the hero first when there are more than the pool holds
    let n = 0;
    const h = S.hero, wind = S.mobs.filter(m => m.windT > 0 && m.attacking && m.hp > 0);
    if (wind.length > NP) wind.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    for (const m of wind) {
      if (n >= NP) break;
      const P = pool[n++], f = Math.min(1, Math.max(0, 1 - m.windT / (m.windDur || 0.45))), p = at(m.x, m.y);
      P.g.visible = true; P.g.position.copy(p); P.g.scale.setScalar(R);
      const s = 0.2 + 0.8 * f; P.disc.scale.set(s, 1, s);
      P.disc.material.opacity = 0.3 + 0.35 * f; P.rim.material.opacity = 0.85 + 0.15 * f;
      P.rim.material.color.set(f > 0.8 ? '#fff0e8' : '#ff2414');   // the last beat goes hot: now or never
    }
    for (let k = n; k < NP; k++) pool[k].g.visible = false;
    for (const s of streaks) {
      if (s.life <= 0) { s.m.visible = false; continue; }
      s.life -= dt; const a = Math.max(0, s.life / s.max), dx = h.x - s.x0, dy = h.y - s.y0, l = Math.hypot(dx, dy);
      if (l < 0.05) { s.m.visible = false; continue; }
      const p = at(s.x0 + dx / 2, s.y0 + dy / 2, 0.12);
      s.m.visible = true; s.m.position.copy(p); s.m.rotation.set(0, Math.atan2(dx, dy), 0); s.m.scale.set(0.55 * (0.4 + 0.6 * a), 1, l); s.m.material.opacity = 0.75 * a;
    }
  }
  return { update };
}
