// Validators: run after the stages. A fatal failure makes the pipeline retry with the
// next seed in its own stream, so a bad roll never ships. Each returns {name, ok, fatal, msg}.
import { obbOverlap, segBox, distToPoly } from './geom.js';
import { SPEED, PACE } from './units.js';
import { reachFrom } from './stages/nav.js';

const solid = p => p.def.collide === 'box' && (p.def.kind === 'building' || p.def.kind === 'vehicle');

export const noOverlap = {
  name: 'no overlaps', fatal: true,
  run(W) {
    const S = W.placed.filter(solid), bad = [];
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) { const a = S[i], b = S[j]; if (Math.abs(a.x - b.x) > 60 || Math.abs(a.y - b.y) > 60) continue; if (obbOverlap(a, b)) bad.push(`${a.id}#${a.uid} × ${b.id}#${b.uid}`); }
    const streetBoxes = []; W.streets.forEach(s => { for (let i = 0; i < s.pts.length - 1; i++) streetBoxes.push({ s, box: segBox(s.pts[i], s.pts[i + 1], s.w + 2 * s.walk) }); });
    S.filter(p => p.def.kind === 'building').forEach(p => streetBoxes.forEach(({ s, box }) => { if (Math.abs(p.x - box.x) < box.w / 2 + 40 && Math.abs(p.y - box.y) < box.w / 2 + 40 && obbOverlap(p, box)) bad.push(`${p.id}#${p.uid} × street ${s.id}`); }));
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
    const drives = W.lots.filter(l => l.drive).map(l => l.drive), bad = W.fences.filter(f => drives.some(d => obbOverlap(d, segBox(f.a, f.b, 0.2))));
    return { ok: !bad.length, msg: bad.length ? `${bad.length} fence runs cross a drive` : `${W.fences.length} fence runs, drives clear`, count: bad.length };
  },
};

export const crossTime = {
  name: 'area crossing time', fatal: false,
  run(W) { const s = W.w / SPEED.walk; const [a, b] = PACE.crossArea; return { ok: s >= a && s <= b, msg: `${W.w} m at walking pace = ${s.toFixed(0)} s (target ${a}–${b} s)`, count: 0 }; },
};

export const ALL_VALIDATORS = [noOverlap, doorsReach, lotsFaceStreets, fencesSkipFronts, crossTime];
