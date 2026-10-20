// Loot on the ground: chests, purses, and little street finds (a scrap crate or a food sack), bobbing gently.
import { chestMesh, purseMesh } from '../meshes.js';
import { K } from '../kit.js';

export function createLoot(V) {
  const { S, world, Wv, seenAt } = V;
  const cMeshes = new Map(), puMeshes = new Map();
  function syncChests() {
    const seen = new Set();
    for (const ch of S.chests) { seen.add(ch.id); if (!cMeshes.has(ch.id)) { const g = chestMesh(); g.scale.setScalar(0.75); g.position.copy(Wv(ch.x, ch.y)); world.add(g); cMeshes.set(ch.id, g); } }
    for (const [id, g] of cMeshes) if (!seen.has(id)) { world.remove(g); cMeshes.delete(id); }
  }
  // little finds in the streets: a scrap crate (amber glint) or a food sack (green), bobbing gently
  const pkMeshes = new Map();
  const pkModel = kind => { const b = new K.B(); if (kind === 'scrap') { b.cbox('#7a6a55', 0.36, 0.24, 0.28, 0, 0, 0, { r: 0.03 }); b.cbox('#f0a040', 0.38, 0.05, 0.3, 0, 0.12, 0, { r: 0.01 }); } else { b.sph('#8aa860', 0.2, 0, 0.18, 0, { detail: 1, sy: 0.85 }); b.cbox('#c9b36a', 0.08, 0.08, 0.08, 0, 0.34, 0, { r: 0.02 }); } const g = b.build(); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; };
  function syncPickups(t) {
    const seen = new Set();
    for (const p of S.pickups || []) {
      seen.add(p.id); let g = pkMeshes.get(p.id);
      if (!g) { g = pkModel(p.kind); g.position.copy(Wv(p.x, p.y)); world.add(g); pkMeshes.set(p.id, g); }
      g.visible = seenAt(p.x, p.y); g.position.y = 0.05 + Math.sin(t * 2.4 + p.id) * 0.05; g.rotation.y = t * 0.6 + p.id;
    }
    for (const [id, g] of pkMeshes) if (!seen.has(id)) { world.remove(g); pkMeshes.delete(id); }
  }
  function syncPurses() {
    const seen = new Set();
    for (const p of S.purses) { seen.add(p.id); if (!puMeshes.has(p.id)) { const g = purseMesh(); g.scale.setScalar(0.7); g.position.copy(Wv(p.x, p.y)); world.add(g); puMeshes.set(p.id, g); } }
    for (const [id, g] of puMeshes) if (!seen.has(id)) { world.remove(g); puMeshes.delete(id); }
  }
  /** purses spin and hop */
  function bobPurses(dt) { const time = V.time; for (const g of puMeshes.values()) { g.rotation.y += dt * 2; g.position.y = 0.05 + Math.abs(Math.sin(time * 4)) * 0.1; } }
  /** chests turn and bounce */
  function bobChests(dt) { const time = V.time; for (const g of cMeshes.values()) { g.rotation.y += dt; g.position.y = 0.08 + Math.abs(Math.sin(time * 3)) * 0.12; } }
  return { syncChests, syncPickups, syncPurses, bobPurses, bobChests };
}
