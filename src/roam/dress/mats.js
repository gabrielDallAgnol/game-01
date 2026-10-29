// [roam] The materials: one palette for everything solid (Kai, the dead, the bike, nests and every city atom), so they all
// come out of one renderer in one voice. A material is an id (1–31; the cell pass stores id / 32); its colour tints the
// glyphs. City colours are muted and a little grey (the ash settled on everything); only lights, embers and safety
// orange are allowed to shout. Add a material at the end, never renumber.
export const M = { suit: 1, bandana: 2, hair: 3, steel: 4, hivis: 5, pants: 6, stone: 7, crack: 8, crackHot: 9, paint: 10, truck: 11, dark: 12, tarp: 13, rust: 14, flash: 15, lamp: 16,
  wood: 17, glass: 18, carRed: 19, carBlue: 20, carCream: 21, carGreen: 22, burnt: 23, cone: 24, rubber: 25, brick: 26, binGreen: 27, cloth: 28, feather: 29, sack: 30, leaf: 31 };
const COL = [null, [0.98, 0.72, 0.16], [0.96, 0.24, 0.2], [0.5, 0.38, 0.28], [0.88, 0.9, 0.92], [0.95, 0.97, 0.95], [0.42, 0.36, 0.26], [0.74, 0.72, 0.68], 'crack', 'crack',
  [1.0, 0.78, 0.2], [0.72, 0.75, 0.78], [0.3, 0.31, 0.33], [0.58, 0.66, 0.5], [0.82, 0.44, 0.26], [1, 1, 1], [1.0, 0.8, 0.45],
  [0.52, 0.4, 0.28], [0.55, 0.65, 0.7], [0.62, 0.24, 0.2], [0.28, 0.38, 0.5], [0.82, 0.78, 0.66], [0.34, 0.45, 0.35], [0.17, 0.15, 0.14], [0.96, 0.46, 0.16],
  [0.13, 0.13, 0.14], [0.56, 0.33, 0.27], [0.3, 0.42, 0.32], [0.9, 0.88, 0.82], [0.11, 0.11, 0.13], [0.66, 0.6, 0.46], [0.42, 0.52, 0.3]];
const v3 = c => `vec3(${c.map(x => x.toFixed(3)).join(', ')})`;
// the GLSL body of matCol(m, em): a chain of thresholds (the cracks glow with em)
export const MATCOL = COL.map((c, i) => i === 0 ? '' : c === 'crack' ? (i === 8 ? `      if (m < 9.5) return mix(vec3(0.24, 0.22, 0.2), vec3(1.0, 0.6, 0.25), em);\n` : '') : `      if (m < ${i}.5) return ${v3(c)};\n`).join('') + '      return vec3(1.0); }\n';
