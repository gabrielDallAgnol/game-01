// The village the folk raise by themselves (sim/folk-build.js): their props, instanced (one draw per kind), with a
// little pop as each one goes up; the scaffold on the site of today's project, rising with the work; a cheer when it
// is done. Reads S.folk only.
/* global THREE */
import { K } from '../kit.js';
import { N } from '../../sim/mapgen.js';
import { VILLAGE, scaffold } from '../kit/village.js';
import { FOOT } from './shared.js';

export function createVillage(V) {
  const { S, C, world, Wv } = V;
  const kinds = new Map(), born = new Map(), d0 = new THREE.Object3D();
  const CAP = { path: 96, lantern: 24, flowers: 24, sandbags: 24 };
  function kind(k) {
    let e = kinds.get(k); if (e) return e;
    const g = VILLAGE[k]({ seed: 7 }); let geo = null;
    g.traverse(o => { if (!geo && o.isMesh && o.material === K.VCM) geo = o.geometry; });
    if (!geo) { const f = K.flattenVC(g); f.traverse(o => { if (!geo && o.isMesh) geo = o.geometry; }); }
    const m = new THREE.InstancedMesh(geo, K.VCM, CAP[k] || 12); m.count = 0; m.frustumCulled = false; m.castShadow = k !== 'path'; m.receiveShadow = true; world.add(m);
    e = { m, cap: CAP[k] || 12 }; kinds.set(k, e); return e;
  }
  // which way a prop faces: sandbags and watch-posts look out from the hall; the rest square to the streets
  const faceOut = (x, y) => Math.atan2(x - C, y - C);
  let ver = -1, animating = false;
  function rebuild() {
    const f = S.folk; if (!f) return;
    const counts = new Map(); animating = false;
    for (const e of kinds.values()) e.m.count = 0;
    for (const p of f.props) {
      if (!born.has(p.id)) born.set(p.id, V.time);
      const age = V.time - born.get(p.id), k = Math.min(1, age / 0.45), pop = k < 1 ? Math.max(0.01, k < 0.7 ? 1.12 * Math.sin(k / 0.7 * Math.PI / 2) : 1.12 - 0.12 * (k - 0.7) / 0.3) : 1;
      if (k < 1) animating = true;
      const e = kind(p.kind);
      const list = p.kind === 'path' ? p.cells.map(i => [(i % N) + 0.5, ((i / N) | 0) + 0.5]) : [[p.x, p.y]];
      for (const [x, y] of list) {
        const n = counts.get(p.kind) || 0; if (n >= e.cap) break;
        d0.position.copy(Wv(x, y, p.kind === 'path' ? 0.01 : 0));
        d0.rotation.set(0, p.kind === 'sandbags' || p.kind === 'watch' ? faceOut(x, y) : (p.rot || 0) * Math.PI / 2 + (p.kind === 'path' ? ((x * 7 + y * 3) % 4) * Math.PI / 2 : 0), 0);
        d0.scale.set(1, pop, 1); d0.updateMatrix();
        e.m.setMatrixAt(n, d0.matrix); counts.set(p.kind, n + 1);
      }
    }
    for (const [k, e] of kinds) { e.m.count = counts.get(k) || 0; e.m.instanceMatrix.needsUpdate = true; }
  }
  // the scaffold: one per size, shown on the project's site
  const scaf = [1, 2, 3].map(n => { const g = scaffold(n); g.visible = false; world.add(g); return g; });
  let shown = null, jobKey = '';
  function updateScaffold(dt) {
    const j = S.folk && S.folk.job;
    if (shown && (!j || (j.kind === 'prop' && j.prop === 'path'))) { shown.visible = false; shown = null; }
    if (!j) { jobKey = ''; return; }
    const n = j.kind === 'prop' ? 1 : Math.min(3, FOOT[j.type] || 2), key = `${j.kind}|${j.x}|${j.y}`;
    const g = scaf[n - 1];
    if (shown !== g) { if (shown) shown.visible = false; shown = g; g.visible = true; }
    if (key !== jobKey) { jobKey = key; g.scale.set(1, 0.01, 1); if (V.feel) V.feel.dust(j.x, j.y, n * 0.6); }
    const pct = Math.min(1, j.work || 0), want = 0.35 + 0.65 * Math.min(1, pct * 1.4);
    g.position.copy(Wv(j.x, j.y)); g.scale.y += (want - g.scale.y) * Math.min(1, dt * 4);
  }
  const LABEL = { well: 'Well', stall: 'Market stall', shrine: 'Shrine', bench: 'Bench', lantern: 'Lantern', flowers: 'Flowers', fence: 'Fence', path: 'Path', sandbags: 'Sandbags', watch: 'Watch-post' };
  function onEvents(events) {
    for (const e of events || []) {
      if (e.t !== 'folkDone') continue;
      const { celebrate, burst } = V.feel;
      if (burst) burst(e.x, e.y, 1, '#ffd166');
      if (celebrate && e.kind === 'prop') celebrate(e.x, e.y, `+${LABEL[e.prop] || 'Village'}`);
    }
  }
  function update(dt, events) {
    onEvents(events);
    const f = S.folk; if (!f) return;
    if (f.ver !== ver || animating) { const first = ver < 0; ver = f.ver; if (first) { for (const p of f.props) born.set(p.id, -9); } rebuild(); }
    updateScaffold(dt);
  }
  return { update };
}
