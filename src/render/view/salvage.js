// [mech] Salvage marks: a steel-blue ring round each car or machine near Kai that she has not stripped today (it fills
// while she works), the +scrap/+parts label when one is stripped, and with Scrap Sense the ones with parts glint.
/* global THREE */
export function createSalvageMarks(V) {
  const { S, C, world, game } = V;
  const spots = game.salvageSpots ? game.salvageSpots() : []; if (!spots.length) return null;
  const col = new THREE.Color('#7fc4ff').convertSRGBToLinear().multiplyScalar(1.3);
  const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false }), fillMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false });
  const ringGeo = new THREE.RingGeometry(0.86, 1, 32), fillGeo = new THREE.CircleGeometry(1, 32);
  const pool = Array.from({ length: 12 }, () => { const g = new THREE.Group(), r = new THREE.Mesh(ringGeo, mat), f = new THREE.Mesh(fillGeo, fillMat); r.rotation.x = f.rotation.x = -Math.PI / 2; g.add(r, f); g.visible = false; g.renderOrder = 6; world.add(g); return { g, f }; });
  let need = 2.4;
  function update(events) {
    for (const e of events || []) if (e.t === 'salvageStart') need = e.dur || need;
    const h = S.hero, at = game.salvageAt(), near = h.dead ? [] : spots.filter(o => Math.abs(o.x - h.x) < 24 && Math.abs(o.y - h.y) < 24 && !game.salvaged(o.id));
    near.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    pool.forEach((p, k) => { const o = near[k]; p.g.visible = !!o; if (!o) return;
      const R = Math.max(o.w, o.h) / 2 + 0.5; p.g.position.set(o.x - C, 0.1, o.y - C); p.g.scale.setScalar(R * (1 + 0.05 * Math.sin(V.time * 4 + o.id)));
      const s = o.id === at ? Math.min(1, game.salvageT() / need) : 0; p.f.scale.setScalar(Math.max(0.001, s)); p.f.visible = s > 0; });
    for (const e of events || []) if (e.t === 'salvage' && V.feel) { V.feel.burst(e.x, e.y, 0.8, '#7fc4ff'); V.feel.floatLabel(e.x, e.y, `+${e.n} scrap${e.parts ? ` +${e.parts} part${e.parts > 1 ? 's' : ''}` : ''}`, '#bfe2ff'); }
  }
  return { update };
}
