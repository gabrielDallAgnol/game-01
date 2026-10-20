// Hives: the landmarks the dead pour out of. Live ones glow and breathe, sleeping ones near your land stay dark,
// a hive about to erupt swells red; a hollow (forest burrow) watches with blinking eyes until it burns. A hollow that took
// a building (a wild landmark beside it) is drawn as the rot on that building: roots, green windows, eyes in the door.
/* global THREE */
import { K, CFG } from '../kit.js';
import { lc, HIVES } from './shared.js';

export function createHives(V) {
  const { S, map, C, game, world, Wv, seenAt } = V;
  // ---------- hives: landmarks the dead pour out of ----------
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  V.glowTex = glowTex;
  function hiveModel(kind) {
    CFG.hiveGlow = 0;
    let g;
    if (kind === 'hollow') {   // a forest hollow: earth, roots and a burrow (no building); its burnt twin waits hidden
      g = K.hollow({ seed: 41 }); CFG.hiveGlow = 1; g.scale.multiplyScalar(1.35);
      const burnt = K.hollow({ seed: 41, cleared: true, burnt: true }); burnt.visible = false; g.add(burnt); g.userData.burnt = burnt; return g;
    }
    if (kind === 'metro') { g = K.metro({}); g.scale.setScalar(0.42); }
    else if (kind === 'petrol') { g = K.petrol({}); g.scale.setScalar(0.24); }
    else {
      // a hospital ambulance bay: canopy, sign wall, wrecked ambulances
      g = new THREE.Group(); const b = new K.B();
      b.cbox('pale', 8, 0.35, 4, 0, 3.0, 0, { r: 0.08 }); for (const x of [-3.6, 3.6]) b.box('pale', 0.3, 2.85, 0.3, x, 0, 1.7, { r: 0.04 });
      b.box('pale', 9, 2.4, 0.5, 0, 0, -2.2, { r: 0.05 }); b.cbox('danger', 1.4, 0.45, 0.1, -3, 1.5, -1.92, { r: 0.02 }); b.cbox('danger', 0.45, 1.4, 0.1, -3, 1.5, -1.92, { r: 0.02 });
      g.add(b.build());
      const s = K.sign('HOSPITAL', 4.5, 0.8, { bg: '#e7e1d3', fg: '#3c4a2f', size: 84 }); s.position.set(1.4, 1.6, -1.93); g.add(s);
      for (const [x, ry] of [[-2, 0.3], [2.6, -0.5]]) { const am = K.car({ color: 'pale', wreck: true, seed: 3 }); am.scale.set(1.25, 1.4, 1.15); am.position.set(x, 0, 3.2); am.rotation.y = ry; g.add(am); }
      g.scale.setScalar(0.3);
    }
    CFG.hiveGlow = 1;
    g.scale.multiplyScalar(1.35);   // fewer hives, so each one is a landmark
    const pale = K.M('pale'), stone = K.M('stone');
    g.traverse(o => { if (o.isMesh && o.material === pale) o.material = stone; });
    return g;
  }
  const hives = new Map(); let nestKey = '', nearNests = new Set();
  const rageCol = new THREE.Color(), greenCol = lc('#8fff3a').clone(), redCol = lc('#ff4a2a').clone();   // [nests]
  // [nests] a hollow that took a building: the rot goes on the building (landmarks.js draws it), centred on its footprint
  const bodyOf = r => r.nest.body || r.nest;
  V.hiveAt = r => bodyOf(map.regions[r]);
  function infestModel(r) { CFG.hiveGlow = 1; const g = K.infest({ w: r.nest.body.half * 2 * 0.92, h: 3.4, seed: 43 + r.id }); return g; }
  for (const r of map.regions) if (r.nest) {
    const b = bodyOf(r), inB = !!r.nest.body;
    const kind = r.ring === 1 ? 'hollow' : HIVES[r.id % HIVES.length], g = new THREE.Group(); g.position.copy(Wv(b.x, b.y)); g.rotation.y = r.nest.back ? Math.atan2(-r.nest.back[0], -r.nest.back[1]) : Math.atan2(C - b.x, C - b.y);
    g.add(inB ? infestModel(r) : hiveModel(kind));
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(inB ? 7 : 6, inB ? 7 : 6), new THREE.MeshBasicMaterial({ map: glowTex, color: lc('#8fff3a'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    decal.rotation.x = -Math.PI / 2; decal.position.y = 0.05; decal.renderOrder = 3; g.add(decal);
    const haze = [];
    for (let k = 0; k < 5; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: lc('#9dff4a'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(1.6 + k * 0.4); sp.position.set(Math.cos(k * 2.1) * 0.8, 0.6 + k * 0.45, Math.sin(k * 2.1) * 0.8); g.add(sp); haze.push(sp); }
    const model = g.children[0];
    if (inB) haze.forEach((sp, k) => sp.position.y += 2.2);   // over the roof, not inside the walls
    world.add(g); hives.set(r.id, { g, decal, haze, glow: 0, cleared: !S.nestAlive[r.id], model, burnt: model.userData.burnt || null, eyes: model.userData.eyes || null, pit: model.userData.pit || null, wins: model.userData.wins || null, inB });
  }

  /** once a frame (after the buildings and the contract marker) */
  function update(dt) {
    const time = V.time, dark = V.dark, { makeBar, setBar } = V.bars;
    // hives: live ones glow and breathe; sleeping ones next to your land stay dark; far ones stay hidden in the ruins
    const active = new Set(S.phase === 'night' ? game.activeNests() : game.activeNests(S.night));
    const nk = `${S.claimed.size}|${S.night}|${S.phase}`;
    if (nk !== nestKey) { nestKey = nk; nearNests = new Set(S.phase === 'day' ? [...hives.keys()].filter(r => game.canPurge(r)) : []); }
    for (const [r, hv] of hives) {
      { const hp = game.hiveHealth(r), n = bodyOf(map.regions[r]); if (!hv.bar) hv.bar = makeBar('boss', 2.4); if (hp > 0 && hp < 1) setBar(hv.bar, n.x, hv.inB ? 4.8 : 3.4, n.y, hp); else hv.bar.visible = false; }
      const live = (active.has(r) || S.purge === r) && !hv.cleared;
      hv.g.visible = seenAt(bodyOf(map.regions[r]).x, bodyOf(map.regions[r]).y) || live;
      const swell = S.eruption && S.eruption.region === r;   // a hive about to burst swells and throbs red
      // [nests] a hive you stand next to wakes and rages: it glows, reddens and throbs faster as the next wave nears
      const rg = !hv.cleared && S.nestRage ? S.nestRage[r] : null, hot = rg ? Math.min(1, rg.lv / 6 + 0.25 * rg.rage + (rg.near ? 0.15 : 0)) : 0;
      hv.pulse = Math.max(0, (hv.pulse || 0) - dt * 1.5);
      const want = hv.cleared ? 0 : swell ? 1.6 + Math.sin(time * (10 - S.eruption.t / 5)) * 0.5 : rg ? 1 + hot * (0.6 + 0.4 * Math.sin(time * (3 + 9 * rg.rage))) + hv.pulse : live ? 1 : nearNests.has(r) ? 0.15 : 0;
      hv.glow += (want - hv.glow) * Math.min(1, dt * (swell ? 8 : 2));
      if (swell) hv.g.visible = true;
      hv.g.scale.setScalar(swell ? 1 + 0.04 * Math.sin(time * 9) + 0.08 * (1 - S.eruption.t / 40) : rg ? 1 + hot * 0.035 * Math.sin(time * (3 + 9 * rg.rage)) + 0.06 * hv.pulse : 1);
      if (rg) hv.g.visible = true;
      const siege = S.purge === r, colr = swell ? lc('#ff5a3a') : siege ? lc('#e3a54a') : rg ? rageCol.copy(greenCol).lerp(redCol, hot) : lc('#8fff3a');
      hv.decal.material.color.copy(colr); hv.decal.material.opacity = hv.glow * (0.35 + dark * 0.55);
      if (hv.burnt && hv.burnt.visible !== !!hv.cleared) { hv.burnt.visible = !!hv.cleared; for (const ch of hv.model.children) if (ch !== hv.burnt) ch.visible = !hv.cleared; }
      if (hv.eyes) {   // a hollow's eyes: always watching (dim by day), blinking pair by pair; gone once it burns
        for (const e of hv.eyes) { const p = e.userData.pair, blink = Math.sin(time * 0.9 + p * 2.3 + r) > 0.96 ? 0.05 : 1; e.visible = !hv.cleared; e.material.opacity = (0.35 + 0.65 * dark) * (0.55 + 0.45 * Math.min(1, hv.glow)) * blink; }
        hv.pit.visible = !hv.cleared; hv.pit.material.opacity = (0.25 + 0.75 * dark) * (0.5 + 0.5 * Math.min(1, hv.glow));
      }
      hv.haze.forEach((s, k) => { s.material.color.copy(colr); s.material.opacity = hv.glow * (0.12 + dark * 0.22) * (0.8 + 0.2 * Math.sin(time * 1.5 + k)); s.position.y = (hv.inB ? 2.8 : 0.6) + k * 0.45 + Math.sin(time * 0.7 + k) * 0.1; });
      if (hv.wins) { hv.wins.color.copy(colr).multiplyScalar(1.2); hv.wins.opacity = hv.cleared ? 0 : (0.35 + 0.55 * dark) * (0.6 + 0.4 * Math.min(1.5, hv.glow)) * (0.85 + 0.15 * Math.sin(time * 2.3 + r)); }   // the windows breathe with the hive
    }
  }
  return { hives, update };
}
