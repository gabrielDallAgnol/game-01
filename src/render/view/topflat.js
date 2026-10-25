// [top] The flat look's light, once a frame after the sky is set: one colour for every territory material
// (day white, dawn/dusk warm, night navy, blood-moon red), no rim, no mist, no contact shadow, a lighter wild by
// night (it must read from above), and the ink hull
// kept ~1.5 px wide at any ortho zoom; no sun shadow pass. Null unless ?top=1.
/* global THREE */
import { K } from '../kit.js';
import { OUTLINE, OUTLINE_ORTHO } from '../figures.js';
import { TOP } from '../top.js';
import { lc } from './shared.js';

const DAY = lc('#ffffff').multiplyScalar(1.12), NIGHT = lc('#8e9fd0'), WARM = lc('#ffd6b0');

export function createTopFlat(V) {
  if (!TOP.on) return null;
  const { S, game, canvas, look } = V, c = new THREE.Color();
  V.renderer.shadowMap.enabled = false;   // the flat path never reads the sun's shadow: skip the shadow pass (the blob shadows stay)
  function update() {
    const sky = look.sky(), dark = V.dark;
    c.copy(DAY).lerp(WARM, 0.5 * (sky.tw || 0) * (1 - dark)).lerp(NIGHT, dark);
    K.T.flat.value.copy(c);
    K.T.rim.value.w = 0; K.T.mist.value.w = 0; K.T.ao.value = 0; K.T.dark.value = Math.max(K.T.dark.value, 0.8);   // the wild stays readable at night
    const hPx = canvas.clientHeight || innerHeight;
    OUTLINE_ORTHO.value = 1.5 * (2 * V.cam.half.h / hPx) / OUTLINE.px;
  }
  return { update };
}
