// The keep (the hall at the heart of the camp): rebuilt on level up; its fires and smoke feed the light pools,
// the embers and the camp-fire circle.
/* global THREE */
import { K } from '../kit.js';
// [rig3] the keep is the Haven Rig
import { RIG } from '../../content/rig.js';

export function createKeep(V) {
  const { S, C, world, Wv } = V, { makeBar, setBar } = V.bars;
  // the keep's fires and chimney smoke, in world coordinates: [x, z, light radius, y]
  const KP = { g: null, fires: [], smoke: [], lampGlow: [] };
  let keepLevel = 0;
  // [rig3] begin: the keep is the Haven Rig (rebuilt when its level or systems change; view/haven.js poses and drives it)
  const rigKey = () => (RIG.on && S.rig ? `${S.keep.level}|${S.rig.ups.guns}|${S.rig.ups.plating}|${S.rig.ups.cargo}` : S.keep.level);
  // [rig3] end
  function syncKeep() {
    if (keepLevel === rigKey() && KP.g) return;
    if (KP.g) world.remove(KP.g); KP.lampGlow.length = 0;
    keepLevel = rigKey();
    if (RIG.on && S.rig) { const u = S.rig.ups; KP.g = K.haven({ level: S.keep.level, guns: u.guns, plating: u.plating, cargo: u.cargo }); KP.g.scale.setScalar(0.3); KP.rebuilt = (KP.rebuilt || 0) + 1; }   // [rig3]
    else KP.g = K.hall({ level: S.keep.level });
    if (!(RIG.on && S.rig)) KP.g.scale.setScalar(0.27); KP.g.position.copy(Wv(C, C)); KP.g.rotation.y = Math.PI; world.add(KP.g);
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
    if (KP.g.userData.flames) KP.g.userData.flames.forEach((f, k) => { f.scale.set(1, 0.85 + 0.25 * Math.abs(Math.sin(animT * (9 + k) + k)), 1); f.rotation.y = animT * (1 + k * 0.3); });
    setBar(keepBar, C, 4.6, C, S.keep.hp / S.keep.maxHp);
  }
  return Object.assign(KP, { sync: syncKeep, update });
}
