// Stage: landmarks. Puts each of the town's set pieces on its site, asking the registry by site need (never by id):
// St Jacobi on the church square with the school across its north side, the town hall at the south gate, the
// station between the station road and the line, the sugar works on a siding in the works quarter (the 'finale'
// variant if the recipe has it), the water tower by the north-west gate, the masts and the transmitter hall at the
// end of the mast lane, the barns along the barn road. Writes W.sites, W.finale, W.sitesMissing, the siding and
// the level crossings, and a scorch mask round the finale.
import { toWorld, dist, catmull, segIntersect, makeNoise } from '../geom.js';
import { createClearance, siteOn, cutLots } from '../frontage.js';

export const landmarksStage = {
  name: 'landmarks',
  run(W, seed, reg) {
    const T = W.town; if (!T) return;
    const rng = seed.rng(), { F, at, loc, P } = T, [px, py] = P.plaza, sites = W.sites = {}, missing = W.sitesMissing = [];
    const need = n => { const l = reg.needing(n); return l.find(a => a.tags.includes('finale')) || l[0] || null; };
    const mid = s => { const m = { x: (s.pts[0].x + s.pts[1].x) / 2, y: (s.pts[0].y + s.pts[1].y) / 2 }; return loc(m.x, m.y); };
    const side = (s, pred) => { const [a, b] = s.pts, th = Math.atan2(b.y - a.y, b.x - a.x), n = loc(F.x - Math.sin(th), F.y + Math.cos(th)); return pred(n.x, n.y) ? 1 : -1; };
    const role = r => W.streets.filter(s => s.role === r);
    const put = (key, def, lot, lx, sb, kind = 'civic') => { const c = toWorld(lot, lx || 0, -lot.h / 2 + sb + def.size[1] / 2), p = W.place(reg, def.id, c.x, c.y, lot.rot, { lot: lot.id, seedPath: `site:${key}` });
      if (def.sockets.some(s => s.type === 'door')) p.door = toWorld(p, 0, -p.h / 2 - 1.2); lot.kind = kind; lot.building = p.uid; W.lots.push(lot); sites[key] = p; return p; };
    let C = createClearance(W);
    const onStreet = (key, n, pieces, pred, t0, sb = 1, allow) => { const def = need(n); if (!def) return null; const w = def.size[0] + 2, h = def.size[1] + sb + 1;
      for (const s of pieces) { const lot = siteOn(W, C, s, side(s, pred), t0(s), w, h, allow); if (lot) { lot.id = `site:${key}`; const p = put(key, def, lot, 0, sb); C.take(lot); return p; } }
      missing.push(key); return null; };
    // St Jacobi stands in the north half of the square, its door to the south (the camp is in the south half)
    { const def = need('site.church'), north = role('plaza').filter(s => mid(s).y < -py + 1).sort((a, b) => mid(a).x - mid(b).x);
      if (def && north.length) { const c = at(0, -py + 4 + 2.5 + 1.5 + def.size[1] / 2), lot = { id: 'site:church', street: north[0].id, x: c.x, y: c.y, w: def.size[0] + 2, h: def.size[1] + 2, rot: F.rot + Math.PI };
        put('church', def, lot, 0, 1); C.take(lot); } else if (def) missing.push('church'); }
    // the school across the square's north side, east of the main street
    onStreet('school', 'site.school', role('plaza').filter(s => mid(s).y < -py + 1 && mid(s).x > 0), (u, v) => v < 0, () => 0.6);
    // the town hall just inside the south gate, east side of the main street
    onStreet('townhall', 'site.townhall', role('main').filter(s => mid(s).y > 0).sort((a, b) => mid(b).y - mid(a).y), (u, v) => u > 0, s => (loc(s.pts[1].x, s.pts[1].y).y > loc(s.pts[0].x, s.pts[0].y).y ? 0.68 : 0.32));
    // the station faces the forecourt where the main street meets the station road; its platform roof runs by the line
    { const def = need('site.station'), rr = role('railroad').sort((a, b) => Math.abs(mid(a).x) - Math.abs(mid(b).x));
      if (def && rr.length) { const c = at(0, T.vs - 4 - 2 - 0.5 - def.size[1] / 2), lot = { id: 'site:station', street: rr[0].id, x: c.x, y: c.y, w: def.size[0] + 2, h: def.size[1] + 1, rot: F.rot + Math.PI };
        put('station', def, lot, 0, 0.5); C.take(lot); } else if (def) missing.push('station');
      const pf = need('site.platform'); if (pf) { const q = at(0, T.vr + 2.3 + 0.6 + pf.size[1] / 2); sites.platform = W.place(reg, pf.id, q.x, q.y, F.rot); } }
    // the sugar works: a big yard south of the station road in the works quarter, a siding curving in from the line
    { const def = need('site.factory'), inWorks = lot => [...[0, 1, 2, 3].map(k => toWorld(lot, (k & 1 ? 1 : -1) * lot.w / 2, (k & 2 ? 1 : -1) * lot.h / 2)), lot].every(q => T.zoneAt(q.x, q.y) === 'industry');
      const rr = role('railroad').filter(s => mid(s).x > T.Z.industry.u).sort((a, b) => mid(a).x - mid(b).x); let lot = null, s0 = null;
      if (def) for (const s of rr) { lot = siteOn(W, C, s, side(s, (u, v) => v > 0), 0.35, def.size[0] + 32, def.size[1] + 28, inWorks); if (lot) { s0 = s; break; } }
      if (def && lot) {
        lot.id = 'site:works'; const p = put('works', def, lot, lot.w / 2 - def.size[0] / 2 - 4, 9, 'industrial'); p.k = rng.float(); C.take(lot);
        if (def.tags.includes('finale')) W.finale = { uid: p.uid, id: p.id, x: p.x, y: p.y, r: Math.hypot(p.w, p.h) / 2, lot: lot.id };
        const xT = -lot.w / 2 + 7, back = toWorld(lot, xT, lot.h / 2 - 5), u = loc(back.x, back.y).x, vb = loc(back.x, back.y).y, vr = T.vr;
        const pts = catmull([at(u - 52, vr), at(u - 32, vr + 1.2), at(u - 15, vr + 6), at(u - 3, vr + 15), at(u, vr + 27), at(u, vb)], 3);
        W.rails.push({ id: 'siding', name: 'works siding', pts, ends: [pts[pts.length - 1]], sockets: ['rail.switch', 'rail.buffer'] });
        const car = reg.withTag('railcar')[0]; if (car) for (let i = 0; i < 2; i++) { const q = toWorld(lot, xT, lot.h / 2 - 9 - car.size[0] / 2 - i * (car.size[0] + 1)); W.place(reg, car.id, q.x, q.y, lot.rot + Math.PI / 2, { tone: rng.int(3), rail: 'siding' }); }
        const silo = need('site.factory-yard'); if (silo) { const q = toWorld(lot, xT + 13, lot.h / 2 - 8); W.place(reg, silo.id, q.x, q.y, 0, { lot: lot.id }); }
        const n = makeNoise(rng), fc = { x: p.x, y: p.y }; W.terrain.scorch = (x, y) => { const d = Math.hypot(x - fc.x, y - fc.y); return Math.max(0, 1 - d / 78) * 1.1 + (n(x / 24, y / 24) - 0.5) * 0.3; };
      } else if (def) missing.push('works');
      C = createClearance(W);   // the siding is in now: later lots keep off it
      // the rest of the works quarter: goods halls and workshops on lots along the station road and the north-east road
      [...rr, ...role('road').filter(s => T.zoneAt(...Object.values(at(mid(s).x, mid(s).y))) === 'industry')].forEach(s => [1, -1].forEach(sd => cutLots(W, C, s, sd, { kind: 'industrial', width: [36, 42], depth: 30, gap: 4, rng: seed.child(`ind:${s.id}:${sd}`).rng(), allow: inWorks }))); }
    // the water tower by the north-west gate, just outside the promenade
    { const def = need('site.lookout'); let ok = false;
      if (def) for (let i = 0; i < 6 && !ok; i++) for (let j = -2; j <= 2 && !ok; j++) { const q = T.ell(T.A.NW - 0.2 + j * 0.05, 1.22 + i * 0.04), box = { x: q.x, y: q.y, w: def.size[0] + 4, h: def.size[1] + 4, rot: 0 };
        if (!C.blocked(box, null)) { sites.watertower = W.place(reg, def.id, q.x, q.y, 0, { seedPath: 'site:watertower' }); C.take(box); ok = true; } }
      if (def && !ok) missing.push('watertower'); }
    // the transmitter field: the hall at the end of the mast lane, facing the town; the masts beyond it on their guys
    { const M = T.M, L = Math.hypot(F.x - M.x, F.y - M.y), d = { x: (F.x - M.x) / L, y: (F.y - M.y) / L }, pp = { x: -d.y, y: d.x }, lane = role('mastlane')[0];
      const hall = need('site.transmitter'); if (hall && lane) { const c = { x: M.x + d.x * 30, y: M.y + d.y * 30 }, rot = Math.atan2(d.x, -d.y), lot = { id: 'site:transmitter', street: lane.id, x: c.x, y: c.y, w: hall.size[0] + 2, h: hall.size[1] + 2, rot };
        put('transmitter', hall, lot, 0, 1); C.take(lot); } else if (hall) missing.push('transmitter');
      const mast = need('site.mast'); sites.masts = [];
      if (mast) [-1, 0, 1].forEach(k => { const g = mast.guy || 0; let q = { x: M.x - d.x * 8 + pp.x * k * 46, y: M.y - d.y * 8 + pp.y * k * 46 }; q = { x: Math.max(g + 4, Math.min(W.w - g - 4, q.x)), y: Math.max(g + 4, Math.min(W.h - g - 4, q.y)) };
        sites.masts.push(W.place(reg, mast.id, q.x, q.y, Math.atan2(d.y, d.x), { seedPath: `site:mast:${k}`, k: rng.float() })); });
      if (mast && !sites.masts.length) missing.push('masts'); }
    // the barn quarter: big barns gable-on to the barn road
    { const barnZone = lot => [0, 1, 2, 3].map(k => toWorld(lot, (k & 1 ? 1 : -1) * lot.w / 2, (k & 2 ? 1 : -1) * lot.h / 2)).every(q => T.zoneAt(q.x, q.y) === 'barns');
      role('barnroad').forEach(s => [1, -1].forEach(sd => cutLots(W, C, s, sd, { kind: 'barn', width: [24, 28], depth: 19, gap: 3, rng: seed.child(`barn:${s.id}:${sd}`).rng(), allow: barnZone }))); }
    // level crossings wherever a street meets a rail
    W.streets.forEach(s => W.rails.forEach(r => { for (let i = 0; i < r.pts.length - 1; i++) { const h = segIntersect(s.pts[0], s.pts[1], r.pts[i], r.pts[i + 1]); if (h) W.crossings.push({ x: h.x, y: h.y, rot: Math.atan2(r.pts[i + 1].y - r.pts[i].y, r.pts[i + 1].x - r.pts[i].x), len: s.w + 2 * s.walk, street: s.id, rail: r.id }); } }));
    W.note('landmarks', `${Object.keys(sites).length} sites${missing.length ? `, missing ${missing.join(', ')}` : ''}; ${W.lots.filter(l => l.kind === 'barn').length} barn lots, ${W.lots.filter(l => l.kind === 'industrial').length} works lots, ${W.crossings.length} level crossings`);
  },
};
