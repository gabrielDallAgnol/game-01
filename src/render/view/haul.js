// [econ3] The Solar Flare economy, drawn: resource nodes (timber stands: log piles and stumps; scrap heaps: wrecks and
// drums) that shrink as the carts pick them clean; the harvester carts (a small caution-yellow box truck, its load on
// the bed, a health bar when hurt, a puff of dust when it unloads); and a scaffold on every blueprint in the
// construction queue (the building itself rises with the work, view/buildings.js). Reads S.econ only. Simple shapes
// from the kit builder (look3 restyles later).
/* global THREE */
import { K } from '../kit.js';
import { scaffold } from '../kit/village.js';
import { FOOT } from './shared.js';

function cartModel() {
  const b = new K.B();
  b.cbox('#3b3631', 0.86, 0.08, 0.46, 0, 0.13, 0, { r: 0.02 });                          // chassis
  b.cbox('#f2b632', 0.3, 0.32, 0.46, 0.3, 0.33, 0, { r: 0.05 });                          // cab, caution yellow
  b.cbox('#cfe3ea', 0.04, 0.14, 0.38, 0.45, 0.4, 0, { r: 0.01 });                         // windscreen
  b.cbox('#e0a020', 0.54, 0.06, 0.48, -0.14, 0.2, 0, { r: 0.01 });                        // bed
  for (const z of [-0.23, 0.23]) b.cbox('#2d2a27', 0.54, 0.12, 0.03, -0.14, 0.28, z, { r: 0.005 });   // bed rails
  b.cbox('#1f1d1b', 0.04, 0.16, 0.48, -0.42, 0.28, 0, { r: 0.005 });
  for (const [x, z] of [[0.28, 0.25], [0.28, -0.25], [-0.26, 0.25], [-0.26, -0.25]]) b.cbox('#1c1a19', 0.18, 0.18, 0.08, x, 0.09, z, { r: 0.07 });   // wheels
  b.cbox('#ff8a3c', 0.05, 0.05, 0.06, 0.46, 0.22, 0.17, { r: 0.01 }); b.cbox('#ff8a3c', 0.05, 0.05, 0.06, 0.46, 0.22, -0.17, { r: 0.01 });
  b.cbox('#9a9286', 0.04, 0.2, 0.04, 0.2, 0.55, -0.15, { r: 0.01 });                      // exhaust stack
  return b.build({ ao: 0.5, aoMin: 0.7 });
}
function loadModel(kind) {
  const b = new K.B();
  if (kind === 'timber') for (let k = 0; k < 3; k++) b.cbox('#8a5a34', 0.5, 0.09, 0.09, 0, 0.05 + (k === 2 ? 0.08 : 0), k === 2 ? 0 : (k ? 0.06 : -0.06), { r: 0.04 });
  else { b.cbox('#8f8a80', 0.2, 0.14, 0.18, -0.08, 0.07, 0.05, { r: 0.02, ry: 0.3 }); b.cbox('#a2512e', 0.18, 0.1, 0.16, 0.12, 0.05, -0.06, { r: 0.02 }); b.cbox('#6b7078', 0.12, 0.18, 0.12, 0.02, 0.09, -0.12, { r: 0.05 }); }
  return b.build({ ao: 0.4, aoMin: 0.7 });
}
function nodeModel(kind) {
  const b = new K.B();
  if (kind === 'timber') {
    for (let k = 0; k < 5; k++) b.cbox('#8a5a34', 0.95, 0.15, 0.15, 0, 0.08 + (k > 2 ? 0.13 : 0), (k > 2 ? k - 3.5 : k - 1) * 0.16, { r: 0.07 });
    for (let k = 0; k < 5; k++) b.cbox('#e2c08a', 0.02, 0.12, 0.12, 0.48, 0.08 + (k > 2 ? 0.13 : 0), (k > 2 ? k - 3.5 : k - 1) * 0.16, { r: 0.05 });   // cut ends
    for (const [x, z] of [[-0.6, 0.45], [0.55, -0.5], [-0.2, -0.6]]) b.cbox('#6b4a2e', 0.2, 0.16, 0.2, x, 0.08, z, { r: 0.08 });             // stumps
    b.cbox('#5d7a3a', 0.14, 0.02, 0.14, 0.4, 0.17, 0.42, { r: 0.04 });
  } else {
    b.cbox('#7d7468', 0.7, 0.26, 0.42, -0.1, 0.13, 0.05, { r: 0.05, ry: 0.4 });            // a crushed car body
    b.cbox('#a2512e', 0.36, 0.2, 0.3, 0.32, 0.1, -0.3, { r: 0.03, ry: -0.3 });             // rusted panel
    for (const [x, z, c] of [[0.42, 0.3, '#3d6b9a'], [0.55, 0.12, '#c8553d']]) b.cbox(c, 0.16, 0.26, 0.16, x, 0.13, z, { r: 0.07 });   // drums
    b.cbox('#55585e', 0.5, 0.06, 0.12, -0.35, 0.3, -0.25, { r: 0.01, rz: 0.4 });           // a girder
    b.cbox('#2b2724', 0.2, 0.2, 0.08, -0.48, 0.1, 0.35, { r: 0.08 });                       // a tyre
  }
  return b.build({ ao: 0.6, aoMin: 0.6 });
}

export function createHaul(V) {
  const { S, world, Wv } = V;
  const nodeG = new Map(), cartG = new Map(), scafG = new Map();
  const protos = { timber: nodeModel('timber'), scrap: nodeModel('scrap') }, cartProto = cartModel(), loads = { timber: loadModel('timber'), scrap: loadModel('scrap') };
  function syncNodes() {
    for (const n of (S.econ && S.econ.nodes) || []) {
      let g = nodeG.get(n.id);
      if (!g) { g = protos[n.kind].clone(); g.rotation.y = (n.id * 2.39) % 6.28; world.add(g); nodeG.set(n.id, g); g.position.copy(Wv(n.x, n.y)); }
      const k = n.amt <= 0 ? 0 : 0.45 + 0.55 * n.amt / n.max;
      g.visible = k > 0; if (k > 0) g.scale.setScalar(k * 1.1);
    }
  }
  function syncCarts(dt) {
    const list = (S.econ && S.econ.carts) || [], live = new Set();
    for (const c of list) {
      live.add(c.id);
      let e = cartG.get(c.id);
      if (!e) {
        const g = cartProto.clone(); world.add(g);
        const ld = { timber: loads.timber.clone(), scrap: loads.scrap.clone() }; for (const l of Object.values(ld)) { l.position.set(-0.14, 0.23, 0); g.add(l); }
        e = { g, ld, bar: V.bars.makeBar('b', 0.8), x: c.x, y: c.y, face: c.face || 0, wasLoad: 0 }; cartG.set(c.id, e);
      }
      e.x += (c.x - e.x) * Math.min(1, dt * 12); e.y += (c.y - e.y) * Math.min(1, dt * 12);
      const want = (c.face || 0) - Math.PI / 2; let d = want - e.face; d = Math.atan2(Math.sin(d), Math.cos(d)); e.face += d * Math.min(1, dt * 8);
      e.g.position.copy(Wv(e.x, e.y)); e.g.rotation.y = e.face;
      const moving = c.state === 'out' || c.state === 'back'; e.g.position.y += moving ? Math.abs(Math.sin(V.time * 14 + c.id)) * 0.02 : 0;
      e.ld.timber.visible = c.load > 0 && c.kind === 'timber'; e.ld.scrap.visible = c.load > 0 && c.kind !== 'timber';
      if (e.wasLoad > 0 && !c.load && V.feel) V.feel.burst(c.x, c.y, 0.6, '#ffc24a');
      e.wasLoad = c.load;
      V.bars.setBar(e.bar, e.x, 0.95, e.y, c.hp / c.maxHp);
    }
    for (const [id, e] of cartG) if (!live.has(id)) { world.remove(e.g); e.bar.visible = false; if (V.feel) V.feel.dust(e.x, e.y, 1); cartG.delete(id); }
  }
  function syncScaffolds() {
    const live = new Set();
    for (const j of (S.econ && S.econ.q) || []) {
      if (j.kind !== 'build') continue;
      const b = S.byId.get(j.bid); if (!b) continue;
      live.add(j.id);
      let g = scafG.get(j.id);
      if (!g) { g = scaffold(Math.min(3, FOOT[b.type] || 1)); world.add(g); scafG.set(j.id, g); g.position.copy(Wv(b.x, b.y)); }
      g.scale.y = 0.4 + 0.6 * Math.min(1, j.work * 1.5);
    }
    for (const [id, g] of scafG) if (!live.has(id)) { world.remove(g); scafG.delete(id); }
  }
  function update(dt) { if (!S.econ) return; syncNodes(); syncCarts(dt); syncScaffolds(); }
  return { update };
}
