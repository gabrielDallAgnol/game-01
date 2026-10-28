// [medium] The One-medium look's shared core: is it on, the glyph ramp atlas, and the uniforms every material reads.
// The look itself is made of atoms (see docs/design/atoms.md): Glyph (solids as letters by their light; kit/territory.js),
// Strand (combed strokes: grass, crowns, hair, tentacles; kit/strand.js), Trample (where feet pressed the strands;
// view/medium.js), Spill (light out of windows at night; view/atoms.js) and Mark (the far map's letters).
// ?look=classic turns it off (the flat town as before). Render only.
/* global THREE */

export const MEDIUM = typeof location === 'undefined' || !/[?&]look=classic\b/.test(location.search);
export const RAMP = ' .,:-=+*%#@';

// the ramp drawn once at the cell's own pixel size and sampled nearest: a big atlas shrunk loses the letters' strokes
const atlas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const tGlyph = new THREE.CanvasTexture(atlas || undefined); tGlyph.minFilter = tGlyph.magFilter = THREE.NearestFilter; tGlyph.generateMipmaps = false;
let atlasPx = 0;
/** uniforms shared by every material the medium touches (territory() and the town's tiles) */
export const MU = {
  mOn: { value: MEDIUM ? 1 : 0 }, mGlyph: { value: tGlyph }, mCell: { value: 6 }, mPxM: { value: 20 },
  mTime: { value: 0 }, mNight: { value: 0 },
  mPress: { value: null }, mPressN: { value: 672 }, mPressO: { value: 336 },
  mPush: { value: Array.from({ length: 8 }, () => new THREE.Vector4(1e5, 1e5, 0, 0)) },
};
/** px: the glyph cell in render pixels */
export function setCell(px) {
  MU.mCell.value = px; if (!atlas || px === atlasPx) return; atlasPx = px;
  atlas.width = px * RAMP.length; atlas.height = px; const g = atlas.getContext('2d');
  g.clearRect(0, 0, atlas.width, atlas.height); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${Math.round(px * 1.05)}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
  for (let i = 0; i < RAMP.length; i++) g.fillText(RAMP[i], i * px + px / 2, px * 0.55);
  tGlyph.image = atlas; tGlyph.needsUpdate = true;
}
setCell(6);
