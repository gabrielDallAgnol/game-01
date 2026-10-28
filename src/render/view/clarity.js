// [clarity] Read the fight at a glance from straight above. Three things a phone player must never have to hunt for:
//  · a turret is a gun: a steel disc with your blue rim and a yellow head whose twin barrels swing to the dead it shoots,
//    a flash at the muzzle on each shot, white pips for its tier, and a red rim when it is hurt;
//  · a building going up shows its progress as a ring that fills;
//  · nothing else: the dead's tokens live in toppop.js, the edge arrows in ui/threats.js.
// Flat unlit shapes drawn over the models (depth test off), sized with the zoom like the other marks. Render only.
/* global THREE */
import { BUILDINGS } from '../../content/buildings.js';
import { READ } from '../readable.js';
import { lc } from './shared.js';
// [medium] the One-medium look draws the guns as glyphs: no tokens
import { MEDIUM } from '../medium.js';

const Y = 4.2;   // over a turret's roof, under the labels
export function createClarity(V) {
  const { S, world, Wv } = V;
  const k = () => (V.topMarks ? V.topMarks.k() : 1);
  /** a flat vertex-coloured geometry from [shape-maker, hex] pairs, lying on the ground plane */
  const paint = (g, hex) => { const c = lc(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); if (g.index) g = g.toNonIndexed(); return g; };
  const flat = list => { const g = THREE.BufferGeometryUtils.mergeBufferGeometries(list.map(([geo, hex]) => paint(geo, hex)), false); g.rotateX(-Math.PI / 2); return g; };
  const ring = (a, b, s = 40) => new THREE.RingGeometry(a, b, s), disc = (r, s = 40) => new THREE.CircleGeometry(r, s);
  const rect = (w, h, x = 0, y = 0) => { const g = new THREE.PlaneGeometry(w, h); g.translate(x, y, 0); return g; };
  const rrect = (w, h, r, x = 0, y = 0) => { const s = new THREE.Shape(), a = w / 2, b = h / 2; s.moveTo(-a + r, -b); s.lineTo(a - r, -b); s.quadraticCurveTo(a, -b, a, -b + r); s.lineTo(a, b - r); s.quadraticCurveTo(a, b, a - r, b); s.lineTo(-a + r, b); s.quadraticCurveTo(-a, b, -a, b - r); s.lineTo(-a, -b + r); s.quadraticCurveTo(-a, -b, -a + r, -b); const g = new THREE.ShapeGeometry(s, 4); g.translate(x, y, 0); return g; };
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, depthWrite: false, fog: false });
  const tint = hex => new THREE.MeshBasicMaterial({ color: lc(hex), transparent: true, depthTest: false, depthWrite: false, fog: false });

  // ---------- the turret token: base (shadow, ink, blue rim, steel), head (ink hull, yellow body, barrels), pips ----------
  const STEEL = '#3B4148', HEAD = '#FFC531', BARREL = '#22262B';
  const shadowGeo = disc(1.25, 32); shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = tint('#000000'); shadowMat.opacity = 0.28;
  const baseOnly = flat([[ring(0.86, 1.0), READ.ownInk], [ring(0.7, 0.86), READ.own], [disc(0.7), STEEL], [ring(0.32, 0.36), '#596169']]);
  // (the head is an Object3D, not a Group: a nested Group resets three's group render order and the disc covered it)
  // the head points along +x (the barrels), built in the shape plane: x right, y up (→ -z after the lie-down)
  const headGeo = flat([
    [rrect(1.02, 0.92, 0.22, -0.05, 0), '#120F0A'], [rect(0.86, 0.17, 0.62, 0.17), '#120F0A'], [rect(0.86, 0.17, 0.62, -0.17), '#120F0A'],
    [rect(0.76, 0.09, 0.62, 0.17), BARREL], [rect(0.76, 0.09, 0.62, -0.17), BARREL],
    [rrect(0.88, 0.78, 0.17, -0.05, 0), HEAD], [rect(0.5, 0.12, -0.12, 0.2), '#FFE08A'], [disc(0.13, 16), '#8A5A00'],
  ]);
  const pipGeo = flat([[disc(0.12, 12), '#0B0D10'], [disc(0.085, 12), '#FFFFFF']]);
  const flashGeo = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.55, 0.18); s.lineTo(0.42, 0); s.lineTo(0.55, -0.18); s.closePath(); const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g; })();
  const flashMat = tint('#FFF2B0'); flashMat.blending = THREE.AdditiveBlending;
  const hurtGeo = ring(1.0, 1.12, 40); hurtGeo.rotateX(-Math.PI / 2);
  const hurtMat = tint(READ.deadEmber);
  // a building still going up: a ring that fills clockwise (rebuilt in steps of 1/24, cached)
  const progGeo = new Map(), progOf = f => { const q = Math.max(1, Math.round(f * 24)); let g = progGeo.get(q); if (!g) { g = new THREE.RingGeometry(1.02, 1.2, 40, 1, Math.PI / 2, -q / 24 * Math.PI * 2); g.rotateX(-Math.PI / 2); progGeo.set(q, g); } return g; };
  const progMat = tint('#FFFFFF'), progBack = (() => { const g = ring(1.02, 1.2, 40); g.rotateX(-Math.PI / 2); return g; })(), progBackMat = tint('#0E2A78'); progBackMat.opacity = 0.75;

  const tokens = new Map();
  function make(b) {
    const g = new THREE.Group(); g.renderOrder = 9;
    const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.position.set(0.12, -0.02, 0.16); sh.renderOrder = 9;
    const base = new THREE.Mesh(baseOnly, mat); base.renderOrder = 10;
    const head = new THREE.Object3D(); const hm = new THREE.Mesh(headGeo, mat); hm.renderOrder = 12; head.add(hm); head.position.y = 0.02;
    const flash = new THREE.Mesh(flashGeo, flashMat); flash.position.set(1.0, 0.03, 0); flash.renderOrder = 13; flash.visible = false; head.add(flash);
    const pips = []; for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(pipGeo, mat); p.renderOrder = 11; g.add(p); pips.push(p); }
    const hurt = new THREE.Mesh(hurtGeo, hurtMat); hurt.renderOrder = 11;
    const pb = new THREE.Mesh(progBack, progBackMat), pf = new THREE.Mesh(progOf(0), progMat); pb.renderOrder = 11; pf.renderOrder = 12; pf.position.y = 0.01;
    g.add(sh, base, head, hurt, pb, pf); world.add(g);
    const t = { g, head, flash, pips, hurt, pb, pf, aim: b.id * 1.7, flashT: 0, lv: 0 };
    tokens.set(b.id, t); return t;
  }
  const rangeOf = b => { const R = BUILDINGS.tower.range; return (R[Math.max(0, Math.min(R.length - 1, b.level - 1))] || 8) * 1.15; };

  function update(dt, events) {
    if (MEDIUM) { for (const t of tokens.values()) t.g.visible = false; return; }   // [medium]
    const kk = k(), sc = Math.min(1.9, 1.05 + 0.32 * kk), time = V.time;
    // a tower's shot: flash the muzzle of the turret it left from
    if (events) for (const e of events) if (e.type === 'shot' && e.src === 'tower') {
      const p = S.projectiles.find(q => q.id === e.id); if (!p) continue;
      let best = null, bd = 2.2; for (const b of S.buildings) if (b.type === 'tower') { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < bd) { bd = d; best = b; } }
      const t = best && tokens.get(best.id); if (t) { t.flashT = 0.09; const want = Math.atan2(-(p.ty - best.y), p.tx - best.x); t.aim = want; }
    }
    const seen = new Set();
    for (const b of S.buildings) {
      if (b.type !== 'tower') continue;
      seen.add(b.id); const t = tokens.get(b.id) || make(b);
      t.g.visible = !b.ruined; if (b.ruined) continue;
      t.g.position.copy(Wv(b.x, b.y, Y)); t.g.scale.setScalar(sc);
      // aim: the nearest risen dead in range, else a slow idle sweep
      const R = rangeOf(b); let best = null, bd = R;
      for (const m of S.mobs) { if ((m.rise ?? 1) < 1 || m.hp <= 0) continue; const d = Math.hypot(m.x - b.x, m.y - b.y); if (d < bd) { bd = d; best = m; } }
      const want = best ? Math.atan2(-(best.y - b.y), best.x - b.x) : t.aim + dt * 0.35;
      if (!best) t.aim = want;
      let d = want - t.head.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); t.head.rotation.y += d * Math.min(1, dt * (best ? 14 : 2));
      t.flashT = Math.max(0, t.flashT - dt); t.flash.visible = t.flashT > 0; if (t.flash.visible) t.flash.scale.setScalar(0.8 + 3 * t.flashT);
      // tier pips round the rim, at the back of the token
      for (let i = 0; i < 3; i++) { const on = i < b.level; t.pips[i].visible = on; if (on) { const a = Math.PI / 2 + (i - (b.level - 1) / 2) * 0.42; t.pips[i].position.set(Math.cos(a) * 0.78, 0.04, Math.sin(a) * 0.78); } }
      const going = b.built !== undefined && b.built < 1, hpF = b.hp / b.maxHp; t.hurt.visible = !going && hpF < 0.5;   // (health rises with the build: no alarm while it goes up) if (t.hurt.visible) t.hurt.material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(time * (hpF < 0.25 ? 9 : 5)));
      t.pb.visible = t.pf.visible = going; if (going) t.pf.geometry = progOf(b.built);
    }
    for (const [id, t] of tokens) if (!seen.has(id)) { world.remove(t.g); tokens.delete(id); }
  }
  return { update, count: () => tokens.size };
}
