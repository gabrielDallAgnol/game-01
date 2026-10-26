// The dead and the crowd: one instanced crowd draws the dead, the dying, the townsfolk and the survivors round
// the camp fire; bars, boss tags and the flames on burning dead.
/* global THREE */
import { MOBS } from '../../content/mobs.js';
import { flameMesh } from '../meshes.js';
import { createCrowd } from '../figures.js';
import { K } from '../kit.js';
import { UNIT } from './shared.js';

export function createMobs(V) {
  const { S, game, world, fx, fx2, Wv, seenAt, vis } = V;
  const mobState = new Map(), dying = [];
  const crowd = createCrowd(world); crowd.warm(['walker', 'runner']);
  V.crowd = crowd;

  // a boss's name plate: the text is measured, so a long name gets a wider plate (and only then a smaller font)
  const camUp = new THREE.Vector3(), TAG_H = 0.72, TAG_GAP = 0.23 + 0.16;   // the boss bar's half-height with its frame, then a gap
  function bossTag(name) {
    const text = name.toUpperCase(), H = 72, c = document.createElement('canvas'), x = c.getContext('2d');
    let size = 38; const font = s => `700 ${s}px Arial Narrow, Arial, sans-serif`;
    x.font = font(size); if ('letterSpacing' in x) x.letterSpacing = '3px';
    let w = x.measureText(text).width; const MAXW = 760; if (w > MAXW - 40) { size = Math.max(22, Math.floor(size * (MAXW - 40) / w)); x.font = font(size); w = x.measureText(text).width; }
    c.width = Math.min(1024, Math.ceil(w + 44)); c.height = H;
    x.fillStyle = '#2a0a10'; x.fillRect(0, 0, c.width, H); x.strokeStyle = 'rgba(255,138,106,.55)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, c.width - 3, H - 3);
    x.fillStyle = '#ff8a6a'; x.font = font(size); if ('letterSpacing' in x) x.letterSpacing = '3px'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, c.width / 2, H / 2 + 2);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(TAG_H * c.width / H, TAG_H, 1); sp.renderOrder = 22; return sp;
  }
  function syncMobs() {
    const time = V.time, { makeBar } = V.bars;
    const seen = new Set();
    for (const m of S.mobs) {
      seen.add(m.id);
      if (!mobState.has(m.id)) {
        const size = MOBS[m.kind].size * (m.unique ? 1.35 : m.bossTier ? 1.2 + 0.2 * m.bossTier : 1);
        const boss = m.kind === 'gravelord' || m.kind === 'guardian' || !!m.unique || !!m.bossName, st = { bar: makeBar(boss ? 'boss' : 'z', boss ? Math.max(1.8, 0.8 * size) : 0.75 * Math.max(1, size), boss ? 0.34 : size > 1.2 ? 0.26 : 0.2), phase: vis() * 6, face: m.face || 0, size, kind: m.kind, x: m.x, y: m.y };
        if (m.unique || m.bossName) { st.tag = bossTag(m.unique || m.bossName); fx.add(st.tag); st.glow = K.glowSprite('#ffd27a', 2.6, 1.6); fx.add(st.glow); }
        mobState.set(m.id, st);
      }
      const st = mobState.get(m.id); if (st.tag) { st.glow.position.copy(Wv(m.x, m.y, 2.4)); st.glow.material.opacity = 0.6 + Math.sin(time * 6) * 0.3; }
    }
    for (const [id, e] of mobState) if (!seen.has(id)) { fx.remove(e.bar); if (e.tag) { fx.remove(e.tag); fx.remove(e.glow); } if (!MOBS[e.kind].still) dying.push({ id, kind: e.kind, x: e.x, y: e.y, face: e.face, t: 0 }); mobState.delete(id); }
  }

  const flames = []; const flameFor = new Map();
  /** a flame over every burning dead (pooled) */
  function updateFlames() {
    const time = V.time;
    for (const m of S.mobs) {
      let f = flameFor.get(m.id);
      if (m.burn && !f) { f = flames.pop() || flameMesh(); fx.add(f); flameFor.set(m.id, f); }
      if (f) { if (!m.burn) { fx.remove(f); flames.push(f); flameFor.delete(m.id); } else { f.position.copy(Wv(m.x, m.y, 1.1 + Math.sin(time * 20) * 0.04)); f.scale.setScalar(0.7 + Math.sin(time * 17 + m.id) * 0.15); } }
    }
    for (const [id, f] of flameFor) if (!mobState.has(id)) { fx.remove(f); flames.push(f); flameFor.delete(id); }
  }

  /** the dead (and the townsfolk): instanced; while a hit-stop holds, last frame's poses stay on screen */
  function draw(dt, frozen) {
    const time = V.time, dark = V.dark, h = S.hero, { setBar } = V.bars, villagers = V.folk.villagers, keepFires = V.keep.fires;
    fx2.blobs.begin();
    if (!h.dead) { const p = Wv(h.x, h.y); fx2.blobs.add(p.x, p.y, p.z, 0.5, 0.42); }
    for (const a of S.allies) { const p = Wv(a.x, a.y); fx2.blobs.add(p.x, p.y, p.z, 0.42, 0.36); }
    if (!frozen) {
      crowd.begin(); const gl = V.gltf; if (gl) gl.begin();   // [assets3]
      for (const m of S.mobs) {
        const e = mobState.get(m.id); if (!e) continue;
        e.x = m.x; e.y = m.y;
        if (!seenAt(m.x, m.y)) { e.bar.visible = false; if (e.tag) e.tag.visible = false; continue; }   // the dead in unexplored streets stay hidden
        let d = (m.face || 0) - e.face; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; e.face += d * Math.min(1, dt * 6);
        e.phase += dt * (m.speed || 1.5) * 3.2;
        const fr = m.attacking ? 0 : (Math.sin(e.phase) > 0 ? 0 : 1);
        const lunge = m.attacking ? Math.max(0, Math.sin(time * 6 + e.phase)) * 0.25 : 0;
        const fl = e.hitT ? Math.max(0, 1 - (time - e.hitT) / 0.07) : 0;
        const p = Wv(m.x, m.y, (m.rise - 1) * 1.1 + (m.attacking ? 0 : Math.abs(Math.sin(e.phase)) * 0.03));
        if (MOBS[m.kind].still) { setBar(e.bar, m.x, 2.4, m.y, m.hp / m.maxHp, false); continue; }   // [ch1] a nest's heart: view/chapter.js draws it, the crowd only its bar
        if (!(gl && gl.mob(m.id, m.kind, p, e.face, e.size, fl > 0.2 ? 'hit' : m.attacking ? 'attack' : m.speed > 2.4 ? 'run' : 'walk', dt)))   // [assets3]
          crowd.add(m.kind, fr, p.x, p.y, p.z, e.face, lunge, Math.sin(e.phase * 0.5) * 0.06, (m.unique ? 1.35 : m.bossTier ? 1.2 + 0.2 * m.bossTier : 1) * UNIT.dead, fl);
        if (m.rise >= 1) fx2.blobs.add(p.x, p.y, p.z, 0.36 * e.size, 0.32 * e.size);
        setBar(e.bar, m.x, 1.45 * Math.max(1, e.size) + 0.15, m.y, m.hp / m.maxHp, !!e.tag);
        if (e.tag) { camUp.set(0, 1, 0).applyQuaternion(V.camera.quaternion); e.tag.position.copy(e.bar.position).addScaledVector(camUp, TAG_GAP + e.tag.scale.y / 2); e.tag.visible = true; }   // the name sits above the bar, never on it
      }
      for (let k = dying.length - 1; k >= 0; k--) {
        const dd = dying[k]; dd.t += dt; const p = Wv(dd.x, dd.y, -Math.max(0, dd.t - 0.55) * 1.0);
        // tip over: a quick fall with a small bounce, then sink into the ground
        const f = Math.min(1, dd.t / 0.32), fall = f < 1 ? f * f : 1 + Math.sin(Math.min(1, (dd.t - 0.32) / 0.18) * Math.PI) * 0.06;
        if (!(gl && gl.mob('d' + dd.id, dd.kind, p, dd.face, 1, 'dead', dt)))   // [assets3]
          crowd.add(dd.kind, 0, p.x, p.y, p.z, dd.face, -1.42 * fall, 0, UNIT.dead, Math.max(0, 1 - dd.t / 0.1));
        if (dd.t > 1.3) dying.splice(k, 1);
      }
      // townsfolk by day; at night the survivors sit round the camp fire
      villagers.each((v, g) => { if (!g.visible) return; const p = Wv(v.x, v.y); crowd.add('folk' + (g.userData.folk || 0), v.frames[1].visible ? 1 : 0, p.x, p.y, p.z, g.rotation.y, v.body.rotation.x, 0, 1); fx2.blobs.add(p.x, p.y, p.z, 0.3, 0.26); });
      if (dark > 0.55 && !S.keep.ruined && keepFires.length) {
        const [fx0, fz0] = keepFires[0], n = Math.min(7, Math.max(2, Math.round(game.pop() / 3)));
        for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + 0.4, x = fx0 + Math.cos(a) * 1.05, z = fz0 + Math.sin(a) * 1.05; crowd.add('folk' + (k % 6) + 's', 0, x, 0, z, Math.atan2(fx0 - x, fz0 - z), 0, 0, 1); fx2.blobs.add(x, 0, z, 0.3, 0.26); }
      }
      crowd.end(); if (gl) gl.end();   // [assets3]
    }
  }
  return { mobState, crowd, sync: syncMobs, updateFlames, draw };
}
