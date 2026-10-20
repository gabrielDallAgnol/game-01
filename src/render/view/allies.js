// Sellswords and companions: live rigs with bars (companions get a name tag and an x-ray silhouette).
/* global THREE */
import { liveRig } from '../figures.js';
import { K } from '../kit.js';
import { UNIT } from './shared.js';

export function createAllies(V) {
  const { S, world, fx, Wv, vis } = V;
  // ---------- sellswords ----------
  const aMeshes = new Map();
  const mercRig = () => K.heroes.sellsword();
  function syncAllies() {
    const { makeBar } = V.bars, { burst } = V.feel, { xray } = V.hero;
    const seen = new Set();
    for (const a of S.allies) {
      seen.add(a.id);
      if (!aMeshes.has(a.id)) {
        const r = liveRig(mercRig(), a.comp ? '#2a1606' : '#1c120a', a.comp ? 1.2 : 1); if (a.comp) xray(r.g, '#f0b060'); world.add(r.g); const e = { ...r, bar: makeBar('h', 0.7), phase: vis() * 6 };
        if (a.comp) { e.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.textTex(a.name.toUpperCase(), { w: 256, h: 64, size: 36, bg: '#2a1a0c', fg: '#f0b060', spacing: '2px' }), transparent: true, depthTest: false })); e.tag.scale.set(1.3, 0.32, 1); e.tag.renderOrder = 21; fx.add(e.tag); }
        aMeshes.set(a.id, e); burst(a.x, a.y, 0.8, a.comp ? '#f0b060' : '#d9843a');
      }
      const e = aMeshes.get(a.id); if (e.tag) e.tag.position.copy(Wv(a.x, a.y, 1.9));
    }
    for (const [id, e] of aMeshes) if (!seen.has(id)) { fx.remove(e.bar); if (e.tag) fx.remove(e.tag); world.remove(e.g); aMeshes.delete(id); }
  }
  /** once a frame: place, pose and bar */
  function update(dt) {
    const time = V.time, { setBar } = V.bars;
    for (const a of S.allies) {
      const e = aMeshes.get(a.id); if (!e) continue;
      e.g.position.copy(Wv(a.x, a.y)); e.g.rotation.y = a.face || 0; e.g.scale.setScalar(a.comp ? UNIT.companion : UNIT.ally);
      e.phase += dt * 8; e.pose(!a.attacking, e.phase, a.attacking ? (Math.sin(time * 10) * 0.5 + 0.5) : -1);
      setBar(e.bar, a.x, 1.25, a.y, a.hp / a.maxHp);
    }
  }
  return { sync: syncAllies, update };
}
