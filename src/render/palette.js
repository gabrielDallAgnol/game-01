// The storybook palette: ONE place for the colour tokens that drive the light (look.js), the ground (city.js), the
// ink lines (ink.js) and the Ash-Born (kit/rig.js). Warm late-summer afternoon by day, deep blue night with ember glow.
// Plain data (sRGB hex strings), no three.js: tests and tools can import it. Change a token here, the whole look moves.
export const PAL = {
  // sky and air
  day: { bg: '#c8c3a8', hemiSky: '#bcd2e4', hemiGnd: '#80623e', sun: '#ffe6bc', haze: '#e4d6b2' },
  night: { bg: '#09132a', hemiSky: '#2f4f92', hemiGnd: '#0a0c14', sun: '#7f9fd6', haze: '#0d1a36' },
  blood: { bg: '#1a0a10', hemiSky: '#5a2a3c', hemiGnd: '#100608', sun: '#e0706a', haze: '#260c14' },
  dawn: { bg: '#cdb9c4', hemiSky: '#e0c6d0', haze: '#dccacd' },
  dusk: { bg: '#b08876', hemiSky: '#d9a08c', haze: '#c49a98' },
  // the ground: warm olive-gold grass, honey paths, sun-baked lots
  ground: {
    open: '#7a7160', paved: '#82796a', meadow: '#68914d', meadowOwn: '#75a057', plaza: '#b09468', rubble: '#6e685b', rock: '#4f4a42',
    ford: '#93897a', cliff: '#7e776a', voidc: '#3a3a36', bed: '#3d5a5c', forestFloor: '#52703f', forestOwn: '#5f7d48', trail: '#b4946a',
    trailOwn: '#bf9d70', bank: '#70704f', lot: '#a58b62', street: '#b49a6e', road: '#5e5d5b', roadOwn: '#63625f', walk: '#928a7a',
    park: '#6f8f52', deck: '#968f80', deckOwn: '#a29a8a', ramp: '#928a7a',
  },
  // identity colours
  caution: '#ffc21a',   // the Rig, hi-vis, the hero's edge
  ember: '#ff6a1a',     // Ash-Born cracks, fires, heat sources
  emberHot: '#ffb347',  // Ash-Born eyes
  system: '#4aa8ff',    // the System's blue
  ink: '#1d130d',       // the warm ink every outline is drawn in
  ash: { skin: '#34302f', skin2: '#413a38', rot: '#2a2727' },   // charcoal-black Ash-Born skin
};
