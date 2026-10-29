// [roam] Street kinds and how each is drawn and dressed. A profile is { width(st) → drawn width (m), bands: [[inset (m),
// inward level 0..255]] (the street map's b channel: the pavement is where inward < 0.48, so a kind with no pavement starts
// at 255 or above ~130), kind (the street map's g: 255 a road, 200 setts, 90 a footpath), pavement: bool (kerb, pavement
// and wall slots), parking: bool (parking slots), marks: bool (centre-line dashes) }.
export const STREET_KINDS = {
  local: { width: st => st.w * 1.6, bands: [[0, 80], [2.4, 170], [3.9, 255]], kind: 255, pavement: true, parking: true, marks: true },
  path: { width: st => st.w * 1.4, bands: [[0, 80], [2.4, 170], [3.9, 255]], kind: 90, pavement: false, parking: false, marks: false },
};
export const profileOf = st => STREET_KINDS[st.kind] || STREET_KINDS.local;
