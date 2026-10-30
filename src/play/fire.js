// [play] The fire pipeline: a weapon base plus its modifiers → the shot it fires. Modifiers run stage by stage in a fixed
// order (count, path, size, rate, element), so "double shot + ricochet" always means two pellets that each ricochet.
// Pure data in, data out: the sim fires what this returns.
import { MODIFIERS } from './modifiers.js';
export const STAGES = ['count', 'path', 'size', 'rate', 'element'];
export function buildShot(base, mods = [], table = MODIFIERS) {
  let s = { ...base.shot };
  for (const stage of STAGES) for (const id of mods) { const m = table[id]; if (!m || m.stage !== stage) continue;
    s = m.edit(s); if (m.cap) for (const k in m.cap) s[k] = Math.min(s[k], m.cap[k]); }
  return s;
}
