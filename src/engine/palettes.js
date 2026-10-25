// Colours are roles. An atom names a role (roof.warm, ground.base); each chapter palette maps
// roles to colours, so new atoms match every chapter and a new chapter is one table.

export const ROLES = [
  'ground.base', 'ground.alt', 'ground.field', 'ground.forest', 'ground.lawn', 'ground.gravel',
  'water.deep', 'water.ripple', 'water.bank',
  'road.asphalt', 'road.line', 'road.kerb', 'road.walk', 'road.lot', 'road.lotline',
  'roof.warm', 'roof.warm2', 'roof.sand', 'roof.sand2', 'roof.cream', 'roof.cream2', 'roof.sage', 'roof.sage2', 'roof.slate', 'roof.slate2',
  'wall.light', 'metal', 'fence', 'pool',
  'tree.a', 'tree.b', 'tree.c',
  'shadow', 'fog', 'night',
  'accent.hero', 'accent.scarf', 'accent.ember', 'accent.caution', 'accent.system', 'accent.glow', 'accent.fire',
  'ink', 'label',
];

export const PALETTES = {
  ch1: { name: 'late summer', season: 'chapter 1 · ashford hollow',
    'ground.base': '#C3D19C', 'ground.alt': '#B7C690', 'ground.field': '#D7CD9E', 'ground.forest': '#A9C086', 'ground.lawn': '#B4C985', 'ground.gravel': '#C9C2AE',
    'water.deep': '#8FB8C8', 'water.ripple': '#A9CBD8', 'water.bank': '#D7CD9E',
    'road.asphalt': '#4B4C55', 'road.line': '#E6D9A8', 'road.kerb': '#A7A79F', 'road.walk': '#D9D3C0', 'road.lot': '#A6A7A4', 'road.lotline': '#E8E4D3',
    'roof.warm': '#E07A5F', 'roof.warm2': '#C9664E', 'roof.sand': '#F2CC8F', 'roof.sand2': '#D9B46F', 'roof.cream': '#EDE6D6', 'roof.cream2': '#D3CBB8', 'roof.sage': '#81B29A', 'roof.sage2': '#6B9A83', 'roof.slate': '#5D6D7E', 'roof.slate2': '#4C5A69',
    'wall.light': '#EDE6D6', 'metal': '#8B95A1', 'fence': '#F2EDDF', 'pool': '#7FC8D8',
    'tree.a': '#6E9B5C', 'tree.b': '#5B8A4D', 'tree.c': '#8DB874',
    'shadow': 'rgba(36,40,58,0.24)', 'fog': '#EFE9D6', 'night': '#1B2440',
    'accent.hero': '#3D5A80', 'accent.scarf': '#D64545', 'accent.ember': '#FF8C42', 'accent.caution': '#E3B23C', 'accent.system': '#6FC3DF', 'accent.glow': '#FFD166', 'accent.fire': '#FF6B35',
    'ink': '#2B2D33', 'label': 'rgba(43,45,51,0.78)' },
  road: { name: 'long dusk', season: 'the road between',
    'ground.base': '#8C8B5C', 'ground.alt': '#827F52', 'ground.field': '#A0915C', 'ground.forest': '#6A764A', 'ground.lawn': '#7D8650', 'ground.gravel': '#857C66',
    'water.deep': '#45697B', 'water.ripple': '#5D8497', 'water.bank': '#9A8F5E',
    'road.asphalt': '#2F2E35', 'road.line': '#D8B474', 'road.kerb': '#605B52', 'road.walk': '#7E7766', 'road.lot': '#615E59', 'road.lotline': '#A69C84',
    'roof.warm': '#C0593F', 'roof.warm2': '#8E3F2E', 'roof.sand': '#D3A15E', 'roof.sand2': '#A57A42', 'roof.cream': '#A89A86', 'roof.cream2': '#7E7262', 'roof.sage': '#668C77', 'roof.sage2': '#4B6B5A', 'roof.slate': '#424A57', 'roof.slate2': '#343B46',
    'wall.light': '#CFC4AB', 'metal': '#6E7580', 'fence': '#B6AC92', 'pool': '#3F7E8F',
    'tree.a': '#4A6339', 'tree.b': '#3B522F', 'tree.c': '#6D8A4E',
    'shadow': 'rgba(28,22,52,0.40)', 'fog': '#2B2733', 'night': '#120F26',
    'accent.hero': '#3D5A80', 'accent.scarf': '#D64545', 'accent.ember': '#FF8C42', 'accent.caution': '#E3B23C', 'accent.system': '#6FC3DF', 'accent.glow': '#FFD166', 'accent.fire': '#FF6B35',
    'ink': '#2B2733', 'label': 'rgba(250,230,200,0.8)' },
  ch2: { name: 'ash & ember', season: 'chapter 2 · ironvale',
    'ground.base': '#D2D0CA', 'ground.alt': '#C8C6BF', 'ground.field': '#DCDAD3', 'ground.forest': '#C1BFB8', 'ground.lawn': '#C9C7C0', 'ground.gravel': '#BAB7B0',
    'water.deep': '#9EA7AD', 'water.ripple': '#B7BFC4', 'water.bank': '#DCDAD3',
    'road.asphalt': '#3F3F43', 'road.line': '#ECEAE4', 'road.kerb': '#B6B4AE', 'road.walk': '#E2E0DA', 'road.lot': '#BEBCB6', 'road.lotline': '#ECEAE4',
    'roof.warm': '#EDEBE5', 'roof.warm2': '#D0CDC6', 'roof.sand': '#A09E99', 'roof.sand2': '#878580', 'roof.cream': '#C4C2BC', 'roof.cream2': '#A9A7A1', 'roof.sage': '#9C9A95', 'roof.sage2': '#858380', 'roof.slate': '#4D4C4A', 'roof.slate2': '#3E3D3B',
    'wall.light': '#EDEBE5', 'metal': '#8E8E92', 'fence': '#F0EEE8', 'pool': '#B9C3C8',
    'tree.a': '#7F7D78', 'tree.b': '#686661', 'tree.c': '#9C9A95',
    'shadow': 'rgba(30,30,36,0.30)', 'fog': '#E9E7E1', 'night': '#15161C',
    'accent.hero': '#3E3E44', 'accent.scarf': '#E63946', 'accent.ember': '#FF7B25', 'accent.caution': '#E3B23C', 'accent.system': '#6FC3DF', 'accent.glow': '#FFD166', 'accent.fire': '#FF6B35',
    'ink': '#2B2B30', 'label': 'rgba(40,40,44,0.75)' },
};

// District looks: roles only, so every chapter palette tints them. `tint` washes the district's ground at `alpha`;
// `roofs` remaps building roles there (old town: red tile; the works: slate and soot). The renderer reads them
// from W.districts[i].palette; recipes without districts are untouched.
export const DISTRICT_LOOKS = {
  oldtown: { tint: 'ground.gravel', alpha: 0.3, roofs: { 'roof.sage': 'roof.warm2', 'roof.sage2': 'roof.warm', 'roof.cream': 'roof.sand', 'roof.cream2': 'roof.sand2' } },
  suburb: { tint: 'ground.lawn', alpha: 0.14, roofs: {} },
  rail: { tint: 'ground.gravel', alpha: 0.45, roofs: { 'roof.warm': 'roof.slate', 'roof.warm2': 'roof.slate2', 'roof.sand': 'roof.cream2' } },
  industry: { tint: 'road.lot', alpha: 0.32, roofs: { 'roof.warm': 'roof.slate', 'roof.warm2': 'roof.slate2', 'roof.sand': 'roof.slate', 'roof.sand2': 'roof.slate2', 'roof.sage': 'roof.slate2', 'roof.sage2': 'roof.slate', 'roof.cream': 'roof.cream2' } },
  park: { tint: 'ground.forest', alpha: 0.4, roofs: {} },
  barns: { tint: 'ground.field', alpha: 0.5, roofs: { 'roof.sage': 'roof.warm2', 'roof.cream': 'roof.sand2' } },
  field: { tint: 'ground.field', alpha: 0.4, roofs: {} },
};

export function resolve(chapter, role) {
  const p = PALETTES[chapter] || PALETTES.ch1;
  if (!(role in p)) throw new Error(`palette ${chapter} has no role ${role}`);
  return p[role];
}

export function missingRoles(chapter) { const p = PALETTES[chapter]; return ROLES.filter(r => !(r in p)); }
