// [roam] Street kinds and how each is drawn and dressed. A profile is { width(st) → drawn width (m), bands: [[inset (m),
// inward level 0..255]] (the street map's b channel: the pavement is where inward < 0.48, so a kind with no pavement starts
// at 255 or above ~130), kind (the street map's g: 255 a road, 200 setts, 90 a footpath), pavement: bool (kerb, pavement
// and wall slots), parking: bool (parking slots), marks: bool (centre-line dashes) }.
// Out of town (the world, region.js): no pavements, the verge grass comes to the tarmac; the edge band starts just above
// the pavement's level, so the outer metre or so takes the dust and the kerb weeds (worn edges), never slabs.
//   highway  the bypass: one carriageway of a dual (two lanes, the dashes between them), a grass strip to the other one
//   road     a country main road: two lanes, a centre line, verges
//   lane     a country lane: one track wide, no line, grass to the edge
//   service  the industrial estate's loop: wide, plain, no line
export const STREET_KINDS = {
  local: { width: st => st.w * 1.6, bands: [[0, 80], [2.4, 170], [3.9, 255]], kind: 255, pavement: true, parking: true, marks: true },
  path: { width: st => st.w * 1.4, bands: [[0, 80], [2.4, 170], [3.9, 255]], kind: 90, pavement: false, parking: false, marks: false },
  highway: { width: st => st.w * 1.6, bands: [[0, 140], [1.2, 215], [2.6, 255]], kind: 255, pavement: false, parking: false, marks: true },
  road: { width: st => st.w * 1.5, bands: [[0, 136], [1.1, 205], [2.4, 255]], kind: 255, pavement: false, parking: false, marks: true },
  lane: { width: st => st.w * 1.5, bands: [[0, 132], [0.9, 190], [2.0, 245]], kind: 255, pavement: false, parking: false, marks: false },
  service: { width: st => st.w * 1.6, bands: [[0, 140], [1.4, 220], [3.0, 255]], kind: 255, pavement: false, parking: false, marks: false },
};
export const profileOf = st => STREET_KINDS[st.kind] || STREET_KINDS.local;
