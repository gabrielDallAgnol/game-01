// Hollowmere city kit · Palette: one dusty-concrete family, one warm accent, one toxic accent; sRGB → linear helper.
/* global THREE */

const lin = hex => new THREE.Color(hex).convertSRGBToLinear();

// ---------- palette: one dusty-concrete family, one warm accent, one toxic accent ----------
const P = {
  asphalt: '#393836', asphalt2: '#3d3c39', paint: '#aaa392', sidewalk: '#6f6b63', curb: '#878277', tile: '#625e57', wildwalk: '#5f5d53',
  bone: '#cbc3b2', sand: '#b3aa97', stone: '#9a917f', pale: '#d8d1c2', grey: '#8a8780', dark: '#5f5b53',
  slab: '#8d8678', rebar: '#4a423a', soot: '#34312c', glass: '#3c454a', frame: '#6c665b', shutter: '#7b7d79',
  roof: '#6c675e', roof2: '#5b564e', tar: '#4c4a45', gravel: '#77726a',
  olive: '#6c7350', olive2: '#545b3d', moss: '#7c7f55', dry: '#88836a', bark: '#5b4a3a',
  rust: '#6f5545', metal: '#6e7173', steel: '#8d9194', tyre: '#2b2a28', bag: '#a7976d', wood: '#94714e', wood2: '#7a5c40',
  amber: '#c9702e', amberDeep: '#9e5426', canvas: '#d9c9a3', lit: '#ffc070',
  skin: '#c99b7a', cloth1: '#55606a', cloth2: '#6b5d4c', cloth3: '#3f4447',
  zskin: '#8e957c', zcloth: '#5e5f58', zcloth2: '#6e675b', toxic: '#b4ff4e', hive: '#8fff3a', danger: '#d5513d', blood: '#5a3a30',
};

export { lin, P };
