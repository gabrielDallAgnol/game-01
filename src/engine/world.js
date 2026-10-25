// The world container: everything a pipeline builds, in metres. Stages add to it; validators
// read it; the renderer draws it. Placed atoms keep the seed path that made them.
import { obbBox } from './geom.js';

export function createWorld(spec) {
  const W = {
    seed: spec.seed, chapter: spec.chapter || 'ch1', w: spec.w, h: spec.h,
    streets: [], nodes: [], water: [], bridges: [], lots: [], placed: [], fences: [], areas: [],
    camp: null, nav: null, log: [], uid: 0,
    place(reg, id, x, y, rot, extra) {
      const def = reg.get(id);
      const p = { uid: ++W.uid, id, def, x, y, rot: rot || 0, w: def.size[0], h: def.size[1], ...extra };
      W.placed.push(p);
      return p;
    },
    note(stage, msg) { W.log.push({ stage, msg }); },
    byTag: tag => W.placed.filter(p => p.def.tags.includes(tag)),
    box: p => obbBox(p),
  };
  return W;
}

// A stable hash of the built world, for determinism tests and the lab's report.
export function worldHash(W) {
  let h = 2166136261 >>> 0;
  const mix = v => { const s = String(Math.round(v * 100)); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } };
  W.streets.forEach(s => s.pts.forEach(p => { mix(p.x); mix(p.y); }));
  W.placed.forEach(p => { mix(p.x); mix(p.y); mix(p.rot); for (const c of p.id) mix(c.charCodeAt(0)); });
  W.fences.forEach(f => { mix(f.a.x); mix(f.a.y); mix(f.b.x); mix(f.b.y); });
  return (h >>> 0).toString(16).padStart(8, '0');
}
