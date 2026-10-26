// [ch1] Chapter 1's things in the world, from above: the jobs Kai can work (a ring that fills while she works it), the
// nests' Ash Hearts at their doors (a beating core, a cage ring while sealed), the survivors (a token with a name; Lotte
// up on the water tower), the radios that have a broadcast waiting (a blinking pip), the torch that blinks three times
// from the tower on the night it calls, the objective's beacon, and the Rig rolling north out of the square at the end.
// Reads the API; never writes the game.
/* global THREE */
import { lc } from './shared.js';

const NAME_COL = { lotte: '#ff9a3a', benno: '#7fc4ff', gus: '#b6ff6a' };
export function createChapterView(V) {
  const { S, game, world, fx, Wv, glowTex } = V;
  if (!game.chapter || !game.chapter()) return null;
  const flatGeo = (g) => { g.rotateX(-Math.PI / 2); return g; };
  const add = (geo, mat, order = 7) => { const m = new THREE.Mesh(geo, mat); m.renderOrder = order; world.add(m); return m; };
  const basic = (col, o = {}) => new THREE.MeshBasicMaterial({ color: lc(col), transparent: true, depthWrite: false, depthTest: false, ...o });
  // ---------- jobs: a ring at each, filled while worked ----------
  const ringG = flatGeo(new THREE.RingGeometry(0.75, 1.0, 32)), discG = flatGeo(new THREE.CircleGeometry(0.72, 32));
  const jobs = Array.from({ length: 8 }, () => { const r = add(ringG, basic('#7fe3ff', { opacity: 0.85 })), f = add(discG, basic('#7fe3ff', { opacity: 0.5 })); r.visible = f.visible = false; return { r, f }; });
  // ---------- hearts ----------
  const coreM = () => new THREE.MeshBasicMaterial({ map: glowTex, color: lc('#ff5a1c').multiplyScalar(1.6), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const hearts = new Map();
  function heart(id) {
    if (hearts.has(id)) return hearts.get(id);
    const core = add(flatGeo(new THREE.PlaneGeometry(1, 1)), coreM(), 9), body = add(flatGeo(new THREE.CircleGeometry(0.85, 24)), basic('#3a0e10', { opacity: 0.95 }), 8), cage = add(flatGeo(new THREE.RingGeometry(1.25, 1.45, 6)), basic('#ffb04a', { opacity: 0.7 }), 9);
    const o = { core, body, cage }; hearts.set(id, o); return o;
  }
  // ---------- survivors: a token and a name plate ----------
  const plate = (name, col) => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = 'rgba(12,12,16,0.78)'; x.beginPath(); x.roundRect(2, 2, 252, 60, 12); x.fill(); x.font = '700 30px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(name, 128, 34); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.renderOrder = 25; fx.add(sp); return sp; };
  const folk = new Map();
  function token(s) {
    if (folk.has(s.id)) return folk.get(s.id);
    const col = NAME_COL[s.id] || '#ffffff', body = add(flatGeo(new THREE.CircleGeometry(0.42, 20)), basic(col, { opacity: 1 }), 12), rim = add(flatGeo(new THREE.RingGeometry(0.42, 0.56, 20)), basic('#141016', { opacity: 1 }), 12);
    const help = add(flatGeo(new THREE.RingGeometry(1.1, 1.35, 28)), basic(col, { opacity: 0.6 }), 11), tag = plate(s.name.split(' ')[0].replace(/"/g, ''), col);
    const o = { body, rim, help, tag }; folk.set(s.id, o); return o;
  }
  // ---------- radios with a broadcast waiting, the tower's torch, the objective beacon ----------
  const pips = Array.from({ length: 8 }, () => { const m = add(flatGeo(new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: glowTex, color: lc('#7fe3ff').multiplyScalar(1.5), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }), 10); m.visible = false; return m; });
  const torch = add(flatGeo(new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: glowTex, color: lc('#fff2b0').multiplyScalar(2), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }), 10);
  const beacon = add(flatGeo(new THREE.RingGeometry(1.6, 2.0, 40)), basic('#ffd27a', { opacity: 0.8 }), 9), beacon2 = add(flatGeo(new THREE.RingGeometry(0.2, 0.42, 20)), basic('#ffd27a', { opacity: 0.9 }), 9);
  let rollT = 0, rollFrom = null;

  function update(dt) {
    const C1 = game.chapter(); if (!C1) return;
    const time = V.time, k = V.cam && V.cam.half ? Math.min(V.cam.half.w, V.cam.half.h) / 12 : 1;
    // jobs
    jobs.forEach((j, i) => { const w = C1.work[i]; j.r.visible = j.f.visible = !!w; if (!w) return; const p = Wv(w.x, w.y, 0.12); j.r.position.copy(p); j.f.position.copy(p); const s = 1.1 + 0.08 * Math.sin(time * 4 + i); j.r.scale.setScalar(s); const f = w.t / w.time; j.f.scale.setScalar(Math.max(0.001, f * s)); j.f.visible = f > 0; j.r.material.color.set(w.at ? '#ffe08a' : '#7fe3ff').convertSRGBToLinear(); });
    // hearts
    const seen = new Set();
    for (const n of game.chNests()) {
      if (n.state !== 'live') continue; seen.add(n.id); const o = heart(n.id), p = Wv(n.at.x, n.at.y, 3.6), beat = 0.5 + 0.5 * Math.max(Math.sin(time * 5.2), Math.sin(time * 5.2 + 0.9));
      o.core.position.copy(p); o.body.position.copy(p); o.cage.position.copy(p); o.core.scale.setScalar(3.2 + 1.4 * beat); o.body.scale.setScalar(0.9 + 0.12 * beat);
      o.cage.visible = n.sealed; o.cage.rotation.y = time * 0.6; o.core.material.opacity = 0.6 + 0.4 * beat;
    }
    for (const [id, o] of hearts) { const vis = seen.has(id); o.core.visible = o.body.visible = vis; if (!vis) o.cage.visible = false; }
    // survivors ([polish] drawn by view/crew.js as figures that walk home; the old tokens stay off)
    if (!V.crew) for (const s of game.survivors()) {
      if (s.x === undefined) continue; const o = token(s), up = s.state === 'away' && s.up, p = Wv(s.x, s.y, up ? 4 : 0.2);
      o.body.position.copy(p); o.rim.position.copy(p); o.help.position.copy(p); o.help.visible = s.state === 'away'; o.help.scale.setScalar(1 + 0.15 * Math.sin(time * 3));
      const tp = Wv(s.x, s.y, 4.2); tp.z -= 1.3 * k; o.tag.position.copy(tp); o.tag.scale.set(3.2 * k, 0.8 * k, 1);
      o.tag.visible = o.body.visible = o.rim.visible = V.seenAt(s.x, s.y);
    }
    // radios with a broadcast waiting blink (cyan, twice a second)
    const due = game.radioDue && game.radioDue('car') ? game.radios().filter(r => r.src === 'car') : [];
    pips.forEach((m, i) => { const r = due[i]; m.visible = !!(r && V.seenAt(r.x, r.y) && C1.open.length); if (!m.visible) return; m.position.copy(Wv(r.x, r.y, 3.7)); m.scale.setScalar(1.4 + 0.5 * Math.abs(Math.sin(time * 3 + i))); m.material.opacity = 0.35 + 0.35 * Math.abs(Math.sin(time * 3 + i)); });
    // the torch on the water tower: three blinks every eight seconds, on the night Lotte calls
    const P = game.places(), wt = P && P.watertower;
    torch.visible = !!(wt && V.dark > 0.3 && C1.open.includes('q2.light'));
    if (torch.visible) { const u = time % 8, on = u < 1.5 && (u % 0.5) < 0.28; torch.position.copy(Wv(wt.x, wt.y, 5)); torch.scale.setScalar(on ? 9 : 0.01); }
    // the objective's beacon
    const ob = C1.objective; beacon.visible = beacon2.visible = !!(ob && ob.x !== null);
    if (beacon.visible) { const p = Wv(ob.x, ob.y, 0.1); beacon.position.copy(p); beacon2.position.copy(p); beacon.scale.setScalar(1 + 0.25 * ((time * 0.8) % 1)); beacon.material.opacity = 0.8 * (1 - (time * 0.8) % 1); }
    // the end: the Rig rolls north out of the square
    if (C1.roll > 0 || C1.ended) { const g = V.keep && V.keep.g; if (g) { if (!rollFrom) rollFrom = g.position.clone(); rollT += dt; const d = Math.min(60, rollT * rollT * 0.9); g.position.set(rollFrom.x, rollFrom.y, rollFrom.z - d); } }
  }
  return { update };
}
