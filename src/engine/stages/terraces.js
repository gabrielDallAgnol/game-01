// Stage: terraces. Rowhouses line both sides of every local street in runs. The atoms' sockets
// set the spacing: party.wall sides touch (gap 0), a run ends with the detached gap (an alley).
// A run keeps one house type, so a street reads as one build. Near the nest some houses are
// ruins: the same footprint, no roof, walls as segment atoms with a gap where the door was.
import { STREET, TERRACE } from '../units.js';
import { toWorld, segBox, obbOverlap, obbBox, obbCorners, dist, distToPoly } from '../geom.js';
import { createHash } from '../spatial.js';
import { gapFor } from '../sockets.js';

export const terracesStage = {
  name: 'terraces',
  run(W, seed, reg) {
    const rng = seed.rng(), houses = reg.needing('lot.terrace').filter(a => !a.tags.includes('ruin')), ruin = reg.needing('lot.terrace').find(a => a.tags.includes('ruin'));
    const ruinWall = reg.withTag('wall').find(a => !a.tags.includes('yard-wall')), yardWall = reg.withTag('yard-wall')[0];
    const JOIN = gapFor('party.wall'), ALLEY = gapFor('detached');
    // a recipe tunes the rows with params.terrace; the lot depth follows the deepest house atom
    const P = { yard: TERRACE.yard, front: TERRACE.front, runMin: 4, runSpan: 6, alleyExtra: 2, ruin: 0.06, swap: 0.12, ...(W.params.terrace || {}) };
    const DEPTH = Math.max(TERRACE.depth, ...houses.map(h => h.size[1])), YD = DEPTH + P.yard;
    // streets, rails and taken lots sit in spatial hashes: a lot only tests what is near it (same answers as a full scan)
    const boxes = createHash(32); W.streets.forEach(s => { const b = segBox(s.pts[0], s.pts[1], s.w + 2 * s.walk + 1); boxes.add({ s, b }, obbBox(b)); });
    W.rails.forEach(r => { for (let i = 0; i < r.pts.length - 1; i++) { const b = segBox(r.pts[i], r.pts[i + 1], 4.6 + 6); boxes.add({ s: { id: r.id }, b }, obbBox(b)); } });
    const taken = createHash(32); W.lots.forEach(o => taken.add(o, obbBox(o)));
    const inMap = o => obbCorners(o).every(q => q.x > 2 && q.y > 2 && q.x < W.w - 2 && q.y < W.h - 2);
    const blocked = (lot, sid) => { if (!inMap(lot)) return true; const lb = obbBox(lot); return boxes.some(lb, ({ s, b }) => s.id !== sid && obbOverlap(lot, b, -0.05)) || taken.some(lb, o => Math.abs(o.x - lot.x) < 40 && Math.abs(o.y - lot.y) < 40 && obbOverlap(lot, o, -0.05)) || blockedRest(lot); };
    const blockedRest = lot => (W.camp && dist(lot, W.camp) < W.camp.r + 10 + Math.max(lot.w, lot.h) / 2) || (W.nest && dist(lot, W.nest) < W.nest.r + 14 + lot.h / 2) || (W.plaza && obbOverlap(lot, W.plaza, -0.05)) || W.nodes.some(n => dist(n, lot) < 10) || W.water.some(wt => distToPoly(lot.x, lot.y, wt.pts) < wt.w / 2 + 2 + Math.hypot(lot.w, lot.h) / 2);
    const wall = (def, a, b, lot) => { if (def) W.fences.push({ a, b, atom: def.id, def, lot }); };
    let units = 0, ruins = 0;
    W.streets.filter(s => s.kind === 'local').forEach(s => {
      const [a, b] = s.pts, L = dist(a, b), th = Math.atan2(b.y - a.y, b.x - a.x), front = s.w / 2 + s.walk + P.front;
      for (const side of [1, -1]) {
        const key = `${s.id}:${side}`, nx = -Math.sin(th) * side, ny = Math.cos(th) * side, rot = side > 0 ? th : th + Math.PI;
        // a lot's local x runs with the street on side +1 and against it on side -1
        const slot = (u, w, h) => { const c = { x: a.x + Math.cos(th) * u + nx * (front + h / 2), y: a.y + Math.sin(th) * u + ny * (front + h / 2) }; return { x: c.x, y: c.y, w, h, rot }; };
        let u = 4 + rng.range(0, 3), run = null, k = 0;
        const close = () => { if (!run) return; if (run.units.length) { W.runs.push(run); const first = W.placed.find(p => p.uid === run.units[0]), last = W.placed.find(p => p.uid === run.units[run.units.length - 1]);
            // the yard wall behind the run, and the alley walls at both ends
            const yd = YD, bl = toWorld(first.lotRef, -side * first.w / 2, yd / 2), br = toWorld(last.lotRef, side * last.w / 2, yd / 2);
            if (P.yard > 0) { wall(yardWall, bl, br, run.id); wall(yardWall, toWorld(first.lotRef, -side * first.w / 2, -yd / 2 + DEPTH), bl, run.id); wall(yardWall, toWorld(last.lotRef, side * last.w / 2, -yd / 2 + DEPTH), br, run.id); } }
          run = null; };
        while (u < L - 4) {
          if (!run) { const def = rng.pick(houses); run = { id: `run:${key}:${k++}`, key, def, left: P.runMin + rng.int(P.runSpan), units: [], from: u, to: u }; }
          const def = rng.chance(P.swap) ? rng.pick(houses) : run.def, w = def.size[0], yd = YD;
          const lot = { id: `ter:${key}:${Math.round(u * 10)}`, kind: 'terrace', street: s.id, ...slot(u + w / 2, w, yd) };
          if (blocked(lot, s.id)) { if (run.units.length) { close(); u += ALLEY; } else { run = null; u += 1; } continue; }
          const heat = W.terrain.scorch ? Math.max(0, W.terrain.scorch(lot.x, lot.y)) : 0, burnt = ruin && rng.chance(P.ruin + heat * 0.55);
          const bc = toWorld(lot, 0, -yd / 2 + def.size[1] / 2), atom = burnt ? ruin : def;
          const p = W.place(reg, atom.id, bc.x, bc.y, rot, { lot: lot.id, w, h: def.size[1], k: rng.float(), embers: burnt && rng.chance(0.4 + heat * 0.4), chimney: rng.chance(0.5), seedPath: `${key}:${units}` });
          p.lotRef = lot; p.door = toWorld(p, 0, -p.h / 2 - 1.2);
          lot.building = p.uid; W.lots.push(lot); taken.add(lot, obbBox(lot)); run.units.push(p.uid); run.to = u + w; units++;
          if (burnt) { ruins++; const q = obbCorners(p), g = 0.7, mid = (A, B, t) => ({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t }); // corners: 0 front-left, 1 front-right, 2 back-right, 3 back-left
            wall(ruinWall, q[0], mid(q[0], q[1], 0.5 - g / p.w), lot.id); wall(ruinWall, mid(q[0], q[1], 0.5 + g / p.w), q[1], lot.id); wall(ruinWall, q[1], q[2], lot.id); wall(ruinWall, q[2], mid(q[2], q[3], 0.35), lot.id); wall(ruinWall, mid(q[2], q[3], 0.6), q[3], lot.id); wall(ruinWall, q[3], q[0], lot.id); }
          u += w + JOIN;
          if (--run.left <= 0) { close(); u += ALLEY + rng.range(0, P.alleyExtra); }
        }
        close();
      }
    });
    W.note('terraces', `${units} rowhouses in ${W.runs.length} runs, ${ruins} burnt out`);
  },
};
