// [roam] Stories: small scenes with a reason. They are why a pretty street can hold a wreck, or a burnt block a tended
// garden. Each is { id, slot, count, apart (m between two of a kind), r (the ground it claims, m), where(care, slot,
// flags) → weight (0 = never), build(slot, put, h, flags) }. put(atomId, along, across, { variant, turn }) places an atom
// relative to the slot (metres along its facing, and to its left); an atom no family defines yet is skipped.
// Stories may also mark houses in `flags` (flags.survivor: a house someone still keeps), read by the lights and gardens.
export const STORIES = [
  // a crash: two cars met at a junction's mouth and nobody came. Anywhere, rarely where it's tended (that's what made it news)
  { id: 'crash', slot: 'crossing', count: 6, apart: 60, r: 9, where: c => 0.35 + 0.65 * (1 - c),
    build(s, put, h) { put('car', -3.5, 0.8, { variant: 'crashed', turn: 0.5 + h }); put('car', 1.5, -1.2, { variant: h < 0.5 ? 'burnt' : 'crashed', turn: -1.2 - h });
      put('skid', -9, 0.5, { turn: 0.15 }); put('debris', -0.8, 0, {}); put('debris', 2.6, 1.6, {}); if (h < 0.6) put('cone', -7.5, 2.2, {}); } },
  // a barricade across a street: the town tried to hold here. Only where the blight reached (worn or ruined)
  { id: 'barricade', slot: 'roadway', count: 4, apart: 110, r: 10, where: c => c < 0.45 ? 1 - c : 0,
    build(s, put, h) { const w = (s.w || 6) / 2; for (let k = -1; k <= 1; k++) put('barrier', 0, k * w * 0.6, { turn: Math.PI / 2 + (hashish(h, k) - 0.5) * 0.4 });
      put('car', 3.5, w * 0.35, { variant: 'burnt', turn: Math.PI / 2 + 0.3 }); put('sandbags', -1.6, -w * 0.7, { turn: Math.PI / 2 }); put('debris', -3, 0.5, {}); } },
  // a survivor's house: in the ruins, one door still kept. Its garden is tended, its window lit, washing out to dry
  { id: 'survivor', slot: 'door', count: 5, apart: 90, r: 7, where: c => c < 0.34 ? 1 : 0,
    build(s, put, h, flags) { (flags.survivor ||= new Set()).add(s.uid); put('laundry', -2.5, 3, { turn: Math.PI / 2 }); put('bin', 1.2, 2.2, { variant: 'tidy' }); } },
  // a fallen tree across a road after the storm that came with the ash: in worn places
  { id: 'fallen', slot: 'roadway', count: 3, apart: 140, r: 7, where: c => c > 0.25 && c < 0.6 ? 0.8 : 0,
    build(s, put, h) { put('fallenTree', 0, 0, { turn: Math.PI / 2 + (h - 0.5) * 0.7 }); put('leaves', 1.5, 1, {}); put('leaves', -2, -1.5, {}); } },
];
const hashish = (h, k) => { const x = Math.sin((h + k * 0.37) * 9999.1) * 43758.5453; return x - Math.floor(x); };
