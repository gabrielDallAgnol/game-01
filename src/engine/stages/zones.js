// Stage: zones. The last word on districts: every placed atom, lot and street learns which district it stands in
// (p.district = index into W.districts, l.district / s.district = district id), and each district counts its
// buildings and homes, so the game can tint, name and balance by district without geometry of its own.
export const zonesStage = {
  name: 'zones',
  run(W) {
    if (!W.districts || !W.districtAt) return;
    const at = (x, y) => W.districtAt(x, y);
    W.districts.forEach(d => { d.buildings = 0; d.homes = 0; d.offers = {}; });
    W.placed.forEach(p => { const d = at(p.x, p.y); if (!d) return; p.district = d.i; if (p.def.kind !== 'building') return; d.buildings++;
      p.def.offers.forEach(o => { const m = /^home:(\d+)$/.exec(o); if (m) d.homes += +m[1]; else d.offers[o] = (d.offers[o] || 0) + 1; }); });
    W.lots.forEach(l => { const d = at(l.x, l.y); if (d) l.district = d.id; });
    W.streets.forEach(s => { const a = s.pts[0], b = s.pts[s.pts.length - 1], d = at((a.x + b.x) / 2, (a.y + b.y) / 2); if (d) s.district = d.id; });
    W.note('zones', W.districts.map(d => `${d.id} ${d.buildings}b/${d.homes}h`).join(' '));
  },
};
