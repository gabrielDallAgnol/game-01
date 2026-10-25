// [v2] Where the hordes sleep: by day a dark ring and a count over each horde's spot (red and pulsing for the one that
// marches tonight), so the key places read from above; at night the dead themselves are the marker. Reads S.hordes.
/* global THREE */
import { K } from '../kit.js';

export function createHordeMarks(V) {
  const { S, world, C } = V;   // draws only when the run has hordes (S.hordes: v2)
  const ringGeo = new THREE.RingGeometry(3.2, 3.8, 40), mat = c => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).convertSRGBToLinear(), transparent: true, opacity: 0.75, depthWrite: false, depthTest: false });
  const calm = mat('#3a2a2a'), hot = mat('#e0503a'), marks = new Map(), texCache = {};
  const tex = (n, march) => { const k = `${n}|${march}`; return texCache[k] || (texCache[k] = new THREE.SpriteMaterial({ map: K.textTex(`☠ ${n}`, { w: 128, h: 64, size: 40, bg: march ? '#5a1410' : '#16181c', fg: march ? '#ffd2c0' : '#e8dccb' }), transparent: true, depthWrite: false, depthTest: false })); };
  // ring and label sit above the town's planes (view/atoms.js)
  function mark(h) {
    let m = marks.get(h.id); if (m) return m;
    const g = new THREE.Group(), ring = new THREE.Mesh(ringGeo, calm), label = new THREE.Sprite(tex(h.dead, false));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.3; ring.renderOrder = 8; label.scale.set(5, 2.5, 1); label.position.y = 5; label.renderOrder = 9; g.add(ring, label); g.position.set(h.x - C, 0, h.y - C); world.add(g);
    m = { g, ring, label, n: -1, march: null }; marks.set(h.id, m); return m;
  }
  function update() {
    const st = S.hordes; if (!st) return;
    const march = st.plan[S.night] ?? -1, day = S.phase === 'day';
    for (const h of st.spots) {
      const m = mark(h), on = day && h.dead > 0 && V.seenAt(h.x, h.y), isM = h.id === march;
      m.g.visible = on; if (!on) continue;
      if (m.n !== h.dead || m.march !== isM) { m.label.material = tex(h.dead, isM); m.ring.material = isM ? hot : calm; m.n = h.dead; m.march = isM; }
      if (isM) m.ring.scale.setScalar(1 + 0.06 * Math.sin(V.time * 4));
    }
  }
  return { update };
}
