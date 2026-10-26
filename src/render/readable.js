// [toppop] The readability colours of the top-down view: what moves or matters must pop against the engine town
// (src/engine/palettes.js). Plain data, no THREE, so test/readability.test.mjs checks them against every palette role.
// hero: a violet-magenta no roof or lawn uses; mine: cream pads under signal-blue roofs and edges; the dead: ash
// bodies, ember-crimson eyes and rims (hotter and pinker than the salmon roofs), an ink edge.
export const READ = {
  hero: '#E040FB', heroInk: '#1A1020', heroGlow: '#FFF3C4',
  own: '#1F5BFF', ownEdge: '#1F5BFF', ownPad: '#F3E6CB', ownInk: '#0E2A78',
  dead: '#1E1819', deadEmber: '#FF1744', deadInk: '#0B0605', deadHalo: '#FFC2CB',   // [clarity] the halo: a light hairline so the token reads on dark streets too
  rot: '#2B2326', rot2: '#3A2E30', crack: '#FF5A1F', core: '#FFD27A', smoke: '#4A4446',
};
// the town colours a signal is read against: the ground, the streets, the roofs, the walls, water and trees
export const TERRAIN_ROLES = /^(ground|road|roof|wall|fence|pool|water|tree|metal)/;
