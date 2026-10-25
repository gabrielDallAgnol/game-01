// Validators: run after the stages. A fatal failure makes the pipeline retry with the
// next seed in its own stream, so a bad roll never ships. Each returns {name, ok, fatal, msg}.
import { obbOverlap, obbBox, segBox, distToPoly, toLocal } from './geom.js';
import { createHash } from './spatial.js';
import { gapFor } from './sockets.js';
import { SPEED, PACE } from './units.js';
import { reachFrom } from './stages/nav.js';

const solid = p => p.def.collide === 'box' && (p.def.kind === 'building' || p.def.kind === 'vehicle');

export const noOverlap = {
  name: 'no overlaps', fatal: true,
  run(W) {
    const S = W.placed.filter(solid), bad = [], H = createHash(24);
    S.forEach(p => H.add(p, obbBox(p)));   // the hash only skips pairs whose bounds cannot meet; pairs are still tested in order
    for (let i = 0; i < S.length; i++) { const a = S[i]; for (const j of H.near(obbBox(a))) { if (j <= i) continue; const b = S[j]; if (obbOverlap(a, b, -0.05)) bad.push(`${a.id}#${a.uid} × ${b.id}#${b.uid}`); } }
    const SB = createHash(24); W.streets.forEach(s => { for (let i = 0; i < s.pts.length - 1; i++) { const box = segBox(s.pts[i], s.pts[i + 1], s.w + 2 * s.walk); SB.add({ s, box }, obbBox(box)); } });
    S.filter(p => p.def.kind === 'building').forEach(p => SB.near(obbBox(p)).forEach(n => { const { s, box } = SB.item(n); if (obbOverlap(p, box)) bad.push(`${p.id}#${p.uid} × street ${s.id}`); }));
    S.filter(p => p.def.kind === 'building').forEach(p => W.water.forEach(wt => { if (distToPoly(p.x, p.y, wt.pts) < wt.w / 2 + Math.max(p.w, p.h) / 2) bad.push(`${p.id}#${p.uid} × ${wt.name}`); }));
    return { ok: !bad.length, msg: bad.length ? `${bad.length} overlaps: ${bad.slice(0, 3).join(', ')}` : `${S.length} solid atoms, none overlap`, count: bad.length };
  },
};

export const doorsReach = {
  name: 'every door reaches the camp', fatal: true,
  run(W) {
    const can = reachFrom(W, W.camp.x + 3, W.camp.y + 3), doors = W.placed.filter(p => p.door), miss = doors.filter(p => !can(p.door.x, p.door.y));
    return { ok: !miss.length, msg: miss.length ? `${miss.length} of ${doors.length} doors unreachable: ${miss.slice(0, 3).map(p => p.lot).join(', ')}` : `${doors.length} doors reachable on foot`, count: miss.length };
  },
};

export const lotsFaceStreets = {
  name: 'every built lot faces a street', fatal: true,
  run(W) { const bad = W.lots.filter(l => l.building && !l.street); return { ok: !bad.length, msg: bad.length ? `${bad.length} buildings without a street` : `${W.lots.filter(l => l.building).length} lots built, all on a street`, count: bad.length }; },
};

export const fencesSkipFronts = {
  name: 'no fence crosses a drive', fatal: false,
  run(W) {
    const D = createHash(24); W.lots.forEach(l => { if (l.drive) D.add(l.drive, obbBox(l.drive)); });
    const bad = W.fences.filter(f => { const b = segBox(f.a, f.b, 0.2); return D.some(obbBox(b), d => obbOverlap(d, b)); });
    return { ok: !bad.length, msg: bad.length ? `${bad.length} fence runs cross a drive` : `${W.fences.length} fence runs, drives clear`, count: bad.length };
  },
};

export const crossTime = {
  name: 'area crossing time', fatal: false,
  run(W) { const s = W.w / SPEED.walk; const [a, b] = PACE.crossArea; return { ok: s >= a && s <= b, msg: `${W.w} m at walking pace = ${s.toFixed(0)} s (target ${a}–${b} s)`, count: 0 }; },
};

// nothing solid sits on a railway; streets may only cross it at a level crossing
export const railsClear = {
  name: 'rails clear', fatal: true,
  run(W) {
    if (!W.rails.length) return { ok: true, msg: 'no rails here', count: 0 };
    const S = W.placed.filter(p => p.def.kind === 'building' && p.def.collide !== 'none'), bad = [];
    const H = createHash(24); S.forEach(p => H.add(p, obbBox(p)));
    W.rails.forEach(r => { const hit = new Set(); for (let i = 0; i < r.pts.length - 1; i++) { const sb = segBox(r.pts[i], r.pts[i + 1], 4.6); H.near(obbBox(sb)).forEach(n => { if (!hit.has(n) && obbOverlap(H.item(n), sb)) hit.add(n); }); } [...hit].sort((a, b) => a - b).forEach(n => { const p = H.item(n); bad.push(`${p.id}#${p.uid}`); }); });
    return { ok: !bad.length, msg: bad.length ? `${bad.length} on the tracks: ${bad.slice(0, 3).join(', ')}` : `${W.rails.length} lines, ${W.crossings.length} level crossings, tracks clear`, count: bad.length };
  },
};

// sockets as law: party walls touch their neighbour (gap 0), and runs keep the detached gap
export const partyWalls = {
  name: 'party walls join, runs keep apart', fatal: true,
  run(W) {
    if (!W.runs.length) return { ok: true, msg: 'no rowhouse runs here', count: 0 };
    const by = new Map(W.placed.map(p => [p.uid, p])), bad = []; let joins = 0;
    const edgeGap = (a, b) => { const l = toLocal(a, b.x, b.y); return Math.abs(l.x) - (a.w + b.w) / 2; };
    W.runs.forEach(run => { for (let i = 0; i < run.units.length - 1; i++) { const g = edgeGap(by.get(run.units[i]), by.get(run.units[i + 1])); joins++; if (Math.abs(g - gapFor('party.wall')) > 0.05) bad.push(`${run.id}:${i} gap ${g.toFixed(2)} m`); } });
    const sameStreet = new Map(); W.runs.forEach(r => (sameStreet.get(r.key) || sameStreet.set(r.key, []).get(r.key)).push(r));
    sameStreet.forEach(rs => { rs.sort((a, b) => a.from - b.from); for (let i = 0; i < rs.length - 1; i++) { const g = rs[i + 1].from - rs[i].to; if (g < gapFor('detached') - 0.05) bad.push(`${rs[i].id}→${rs[i + 1].id} alley ${g.toFixed(2)} m`); } });
    return { ok: !bad.length, msg: bad.length ? `${bad.length} bad joins: ${bad.slice(0, 3).join(', ')}` : `${joins} party walls flush, ${W.runs.length} runs with alleys ≥ ${gapFor('detached')} m`, count: bad.length };
  },
};

export const ALL_VALIDATORS = [noOverlap, doorsReach, lotsFaceStreets, fencesSkipFronts, crossTime, railsClear, partyWalls];
