// The ground: grid → world mapping (with plateau heights), what the hero has seen, the city build, and the
// territory / shroud repaint with the System's scan wave.
/* global THREE */
import { N, idx } from '../../sim/mapgen.js';
import { K, CFG } from '../kit.js';
import { buildCity } from '../city.js';

export function createTerrain(V) {
  const { game, map, S, C, world, vis } = V;
  const seenAt = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); return cx >= 0 && cy >= 0 && cx < N && cy < N && S.seen[idx(cx, cy)] === 1; };
  let elev = () => 0;   // ground height (plateaus), set once the city is built
  const W = (x, y, h = 0) => new THREE.Vector3(x - C, h + elev(x, y), y - C);
  const _wv = new THREE.Vector3(), Wv = (x, y, h = 0) => _wv.set(x - C, h + elev(x, y), y - C);   // scratch: copy it at once
  Object.assign(V, { seenAt, W, Wv });

  // ---------- the city ----------
  CFG.lite = true;
  const city = buildCity({ game, map, S, world, W: (x, y, h = 0) => new THREE.Vector3(x - C, h, y - C), C, rand: vis }); elev = city.heightAt;
  V.city = city;

  let seenV = -1, zoneV = -1, shroudT = 0, scanV = -1, scanT0 = -9, scanX = 0, scanZ = 0;
  /** once a frame: the scan wave, the shroud and territory refresh, and a repaint when buildings changed */
  function update(dt) {
    const time = V.time;
    // the System's scan: when the hero opens new ground, a cyan wave rolls out from them (0.6 s)
    if (S.seenVersion !== scanV) { scanV = S.seenVersion; if (time - scanT0 > 1.6 && time > 2) { scanT0 = time; scanX = S.hero.x - C; scanZ = S.hero.y - C; } }
    { const st = (time - scanT0) / 0.6; K.T.scan.value.set(scanX, scanZ, st * 13, st < 1 ? (1 - st) * (1 - st) : 0); }
    if ((S.seenVersion !== seenV || S.zoneVersion !== zoneV) && (shroudT -= dt) <= 0) { shroudT = 0.3; if (S.zoneVersion !== zoneV) V.repaint = true; seenV = S.seenVersion; zoneV = S.zoneVersion; city.setTerritory(); }
    if (V.repaint) { V.repaint = false; city.paint(); }
  }
  return { city, update };
}
