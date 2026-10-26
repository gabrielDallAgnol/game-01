// [polish] What Kai carries in chapter 1, from above: the crankshaft (order 4471) as a flat steel bar across her
// shoulders, turned with her, with an orange order tag; and a "slow" cue while she carries it (a plate under her and
// short drag marks behind). Reads the API; never writes the game.
/* global THREE */
import { lc } from './shared.js';

export function createCarryView(V) {
  const { S, game, world, fx, Wv } = V;
  if (!game.chapter || !game.chapter()) return null;
  const flat = g => { g.rotateX(-Math.PI / 2); return g; };
  const mat = (c, o) => new THREE.MeshBasicMaterial({ color: lc(c), transparent: true, depthWrite: false, depthTest: false, ...o });
  // the crankshaft: a long bar with throws (the offsets) and a tag, in a group turned with Kai
  const bar = new THREE.Group(), add = (geo, m, x, z) => { const o = new THREE.Mesh(flat(geo), m); o.position.set(x, 0, z); o.renderOrder = 40; bar.add(o); return o; };
  add(new THREE.PlaneGeometry(3.7, 0.62), mat('#141016'), 0, 0);
  add(new THREE.PlaneGeometry(3.5, 0.38), mat('#c9d0d6'), 0, 0);
  for (const x of [-1.1, 0, 1.1]) { add(new THREE.PlaneGeometry(0.34, 0.66), mat('#141016'), x, 0.1); add(new THREE.PlaneGeometry(0.22, 0.54), mat('#8e979e'), x, 0.1); }
  add(new THREE.PlaneGeometry(0.5, 0.36), mat('#ff8a2a'), 1.55, -0.42);
  bar.visible = false; world.add(bar);
  function plate() {
    const c = document.createElement('canvas'); c.width = 360; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = 'rgba(40,20,8,0.85)'; x.beginPath(); x.roundRect(2, 2, 356, 60, 12); x.fill(); x.strokeStyle = '#ff9a3a'; x.lineWidth = 3; x.stroke();
    x.font = '700 28px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffd27a'; x.fillText('CRANKSHAFT · SLOW', 180, 34);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.renderOrder = 26; sp.visible = false; fx.add(sp); return sp;
  }
  const tag = plate();
  const drags = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(flat(new THREE.PlaneGeometry(0.16, 0.7)), mat('#ffb04a', { opacity: 0.6 })); m.renderOrder = 6; m.visible = false; world.add(m); return { m, x: 0, y: 0, a: 0, life: 0 }; });
  let dropT = 0, di = 0;
  function update(dt) {
    const C1 = game.chapter(), h = S.hero, on = !!(C1 && C1.item === 'crankshaft' && !h.dead && !C1.ended);
    bar.visible = tag.visible = on;
    const k = V.cam && V.cam.half ? Math.min(V.cam.half.w, V.cam.half.h) / 12 : 1;
    if (on) {
      bar.position.copy(Wv(h.x, h.y, 2.6)); bar.rotation.y = (h.face || 0);   // across the shoulders: square to where she walks
      const p = Wv(h.x, h.y, 4); p.z += 2.4 * k; tag.position.copy(p); tag.scale.set(8.4 * k, 1.5 * k, 1);
      if (h.moving && (dropT -= dt) <= 0) { dropT = 0.22; const d = drags[di++ % drags.length]; d.x = h.x - Math.sin(h.face || 0) * 0.9; d.y = h.y - Math.cos(h.face || 0) * 0.9; d.a = h.face || 0; d.life = 0.9; }
    }
    for (const d of drags) { d.life -= dt; d.m.visible = d.life > 0; if (!d.m.visible) continue; d.m.position.copy(Wv(d.x, d.y, 0.08)); d.m.rotation.y = d.a; d.m.material.opacity = 0.6 * d.life / 0.9; }
  }
  return { update };
}
