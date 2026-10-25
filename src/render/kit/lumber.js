// [gemini3] The Logger's Hut: a timber shed with a sloped roof, a saw table with its round blade and a stack of logs
// (Gemini's model, Oct 24). Built at the kit's metre scale on a 2×2 lot (BSCALE 1).
import { B } from './builder.js';

export function loggersHut() {
  const b = new B();
  b.cbox('stone', 1.9, 0.08, 1.9, 0, 0, 0, { r: 0.02 });
  b.cbox('wood', 1.1, 0.9, 1.2, -0.35, 0.08, -0.2, { r: 0.03 });
  b.cbox('amberDeep', 1.25, 0.14, 1.35, -0.35, 0.98, -0.2, { r: 0.02, rz: -0.18 });
  b.cbox('wood', 0.7, 0.42, 0.9, 0.45, 0.08, -0.1, { r: 0.02 });
  b.cyl('steel', 0.28, 0.28, 0.04, 0.45, 0.56, -0.1, { rz: Math.PI / 2, seg: 14 });
  for (let row = 0; row < 2; row++) for (let k = 0; k < 3 - row; k++) b.cyl('amberDeep', 0.11, 0.11, 0.85, -0.35 + k * 0.23 + row * 0.11, 0.18 + row * 0.19, 0.62, { rz: Math.PI / 2, seg: 8 });
  return b.build();
}
