// The keep (the Haven Rig truck at the heart of the camp): rebuilt on level up; its fires and smoke feed the light pools,
// the embers and the camp-fire circle.
/* global THREE */
import { K } from '../kit.js';

export function createKeep(V) {
  const { S, C, world, Wv } = V, { makeBar, setBar } = V.bars;
  // the keep's fires and chimney smoke, in world coordinates: [x, z, light radius, y]
  const KP = { g: null, fires: [], smoke: [], lampGlow: [] };
  let keepLevel = 0;
  function syncKeep() {
    if (keepLevel === S.keep.level && KP.g) return;
    if (KP.g) world.remove(KP.g); KP.lampGlow.length = 0;
    keepLevel = S.keep.level;
    // the keep is drawn as the Haven Rig truck (kit/haven.js), parked and anchored; the V2 Rig (modules, driving off) comes later
    KP.g = K.haven({ level: S.keep.level, guns: 0, plating: 0, cargo: 0 }); K.setHaven(KP.g, 1); KP.g.scale.setScalar(0.3); KP.rebuilt = (KP.rebuilt || 0) + 1;
    KP.g.position.copy(Wv(C, C)); KP.g.rotation.y = Math.PI; world.add(KP.g);
    KP.g.updateMatrixWorld(true);
    const toW = ([x, y, z, r]) => { const v = new THREE.Vector3(x, y, z).applyMatrix4(KP.g.matrixWorld); return [v.x, v.z, (r || 4.5) * 0.27 * 3, v.y]; };
    KP.fires = (KP.g.userData.fires || []).map(toW); KP.smoke = (KP.g.userData.smoke || []).map(toW);
  }
  syncKeep();
  const keepBar = makeBar('b', 2.2);
  /** once a frame (after the buildings): hidden when ruined, flames flicker, the bar */
  function update() {
    const animT = V.animT;
    KP.g.visible = !S.keep.ruined;
    const u = KP.g.userData;   // the beacon shows at night, the pylon hums
    if (u.beacon) { u.beacon.visible = V.dark > 0.3; u.beacon.material.opacity = 0.5; }
    if (u.hum && u.hum.visible) u.hum.material.opacity = 0.55 + 0.25 * Math.sin(V.time * 3);
    if (KP.g.userData.flames) KP.g.userData.flames.forEach((f, k) => { f.scale.set(1, 0.85 + 0.25 * Math.abs(Math.sin(animT * (9 + k) + k)), 1); f.rotation.y = animT * (1 + k * 0.3); });
    setBar(keepBar, C, 4.6, C, S.keep.hp / S.keep.maxHp);
  }
  return Object.assign(KP, { sync: syncKeep, update });
}
