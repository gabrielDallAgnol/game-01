// Cosmetic villagers: tiny townsfolk who walk between buildings by day, pretend to work,
// and hide indoors at night. Renderer-only: reads game state, never changes it.
import { N, PASSABLE, idx } from '../sim/mapgen.js';

const SPEED = 1.2;
const CLOTHES = [0x7a5a3e, 0x5e6a4a, 0x6a5560, 0x8a7a5a, 0x4e5a66, 0x7a4a3a];
const SKINS = [0xe2b48c, 0xc99a72, 0x9a6e4c, 0xf0caa4];

export function createVillagers({ THREE, world, game, W, map, figure }) {
  const S = game.state;
  const group = new THREE.Group(); world.add(group);

  // shared geometry and materials: created once, reused by every villager
  const geo = {
    body: new THREE.BoxGeometry(0.34, 0.42, 0.24),
    head: new THREE.BoxGeometry(0.24, 0.24, 0.24),
    leg: new THREE.BoxGeometry(0.11, 0.3, 0.11),
    sack: new THREE.BoxGeometry(0.2, 0.2, 0.16),
  };
  geo.leg.translate(0, -0.15, 0); // pivot at the hip
  const mats = new Map();
  const mat = c => { if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95 })); return mats.get(c); };
  const legMat = mat(0x3b2f26), sackMat = mat(0xb39a6a);

  const walkable = (x, y) => {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= N || cy >= N) return false;
    const i = idx(cx, cy);
    return PASSABLE[map.terrain[i]] && S.occ[i] < 0;
  };
  // a free cell next to a building (its "door"), nearest to where the villager stands
  function doorOf(bx, by, fromX, fromY, reach = 3) {
    let best = null, bd = Infinity;
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const x = Math.floor(bx) + dx + 0.5, y = Math.floor(by) + dy + 0.5;
      if (!walkable(x, y)) continue;
      const d = Math.hypot(x - fromX, y - fromY) + Math.hypot(x - bx, y - by) * 2;
      if (d < bd) { bd = d; best = { x, y }; }
    }
    return best;
  }
  const keepPt = () => ({ x: map.town.x, y: map.town.y, type: 'keep', id: 0 });
  const houses = () => S.buildings.filter(b => b.type === 'house' && !b.ruined);

  function makeMesh() {
    if (figure) { const f = figure(); return { g: f.g, body: f.body, frames: f.frames, legs: null, sack: null }; }
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const cloth = mat(CLOTHES[Math.floor(Math.random() * CLOTHES.length)]), skin = mat(SKINS[Math.floor(Math.random() * SKINS.length)]);
    const torso = new THREE.Mesh(geo.body, cloth); torso.position.y = 0.51; torso.castShadow = true; body.add(torso);
    const head = new THREE.Mesh(geo.head, skin); head.position.y = 0.84; head.castShadow = true; body.add(head);
    const l1 = new THREE.Mesh(geo.leg, legMat); l1.position.set(-0.08, 0.3, 0); body.add(l1);
    const l2 = new THREE.Mesh(geo.leg, legMat); l2.position.set(0.08, 0.3, 0); body.add(l2);
    let sack = null;
    if (Math.random() < 0.4) { sack = new THREE.Mesh(geo.sack, sackMat); sack.position.set(0, 0.62, -0.2); body.add(sack); }
    g.scale.setScalar(0.95 + Math.random() * 0.15);
    return { g, body, legs: [l1, l2], sack };
  }

  const folk = [];
  function spawn() {
    const hs = houses(); if (!hs.length) return;
    const h = hs[Math.floor(Math.random() * hs.length)];
    const d = doorOf(h.x, h.y, h.x, h.y + 2); if (!d) return;
    const m = makeMesh(); group.add(m.g);
    const v = { ...m, x: d.x, y: d.y, face: 0, state: 'idle', wait: Math.random() * 2, target: null, phase: Math.random() * 6, stuck: 0, detour: null, leaving: false, home: h.id };
    m.g.position.copy(W(v.x, v.y, 0));
    folk.push(v);
  }
  function remove(v) { group.remove(v.g); folk.splice(folk.indexOf(v), 1); }

  function pickJob(v) {
    const pool = S.buildings.filter(b => !b.ruined && b.type !== 'wall');
    const weights = pool.map(b => (b.type === 'farm' ? 4 : b.type === 'house' ? 1.5 : b.type === 'tower' ? 1 : 1));
    pool.push(keepPt()); weights.push(1.5);
    const tot = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot, k = 0; while (k < pool.length - 1 && r > weights[k]) { r -= weights[k]; k++; }
    const b = pool[k], d = doorOf(b.x, b.y, v.x, v.y, b.type === 'keep' ? 4 : 3);
    if (!d) return null;
    return { x: d.x, y: d.y, kind: b.type, bx: b.x, by: b.y, id: b.id };
  }
  function goHome(v) {
    const hs = houses();
    let best = null, bd = Infinity;
    for (const h of hs) { const d = Math.hypot(h.x - v.x, h.y - v.y); if (d < bd) { bd = d; best = h; } }
    const b = best || keepPt(), d = doorOf(b.x, b.y, v.x, v.y, b.type === 'keep' ? 4 : 3) || { x: v.x, y: v.y };
    return { x: d.x, y: d.y, kind: 'home', bx: b.x, by: b.y, id: b.id };
  }

  // steer toward a point: straight if possible, else slide on an axis, else detour to a random free cell
  function stepToward(v, tx, ty, dt) {
    const dx = tx - v.x, dy = ty - v.y, dist = Math.hypot(dx, dy);
    if (dist < 0.15) return true;
    const s = Math.min(dist, SPEED * dt), ux = dx / dist, uy = dy / dist;
    let moved = false;
    if (walkable(v.x + ux * s, v.y + uy * s)) { v.x += ux * s; v.y += uy * s; moved = true; }
    else if (Math.abs(ux) > 0.05 && walkable(v.x + Math.sign(ux) * s, v.y)) { v.x += Math.sign(ux) * s; moved = true; }
    else if (Math.abs(uy) > 0.05 && walkable(v.x, v.y + Math.sign(uy) * s)) { v.y += Math.sign(uy) * s; moved = true; }
    if (moved) { v.face = Math.atan2(dx, dy); v.stuck = 0; } else v.stuck += dt;
    if (v.stuck > 0.8 && !v.detour) {
      for (let k = 0; k < 12; k++) {
        const x = Math.floor(v.x) + Math.round((Math.random() - 0.5) * 6) + 0.5, y = Math.floor(v.y) + Math.round((Math.random() - 0.5) * 6) + 0.5;
        if (walkable(x, y)) { v.detour = { x, y, t: 1.5 }; break; }
      }
      v.stuck = 0;
    }
    return false;
  }

  function update(dt, time, dark) {
    const night = S.phase === 'night' || S.phase === 'over' || dark > 0.5;
    // population: about one villager per two citizens
    const hs = houses();
    const want = hs.length ? Math.max(2, Math.min(24, Math.round(game.pop() / 2))) : 0;
    const alive = folk.filter(v => !v.leaving).length;
    if (!night && alive < want && Math.random() < dt * 2) spawn();
    if (alive > want) { const v = folk.find(q => !q.leaving); if (v) { v.leaving = true; v.target = goHome(v); v.state = 'walk'; } }

    for (const v of [...folk]) {
      // the house this villager lives in may have fallen
      if (night) {
        if (v.state !== 'hidden' && v.state !== 'homing') { v.target = goHome(v); v.state = 'homing'; v.detour = null; }
      } else if (v.state === 'hidden') { v.state = 'idle'; v.wait = Math.random() * 3; v.g.visible = true; }

      if (v.state === 'idle') {
        v.wait -= dt;
        if (v.wait <= 0) { v.target = pickJob(v); v.state = v.target ? 'walk' : 'idle'; v.wait = 1 + Math.random() * 2; }
      } else if (v.state === 'walk' || v.state === 'homing') {
        let arrived;
        if (v.detour) { if (stepToward(v, v.detour.x, v.detour.y, dt) || (v.detour.t -= dt) <= 0) v.detour = null; arrived = false; }
        else arrived = stepToward(v, v.target.x, v.target.y, dt);
        if (arrived) {
          if (v.state === 'homing' || v.leaving) {
            if (v.leaving) { remove(v); continue; }
            v.state = 'hidden'; v.g.visible = false;
          } else { v.state = 'work'; v.wait = 3 + Math.random() * 5; v.face = Math.atan2(v.target.bx - v.x, v.target.by - v.y); }
        }
      } else if (v.state === 'work') {
        v.wait -= dt;
        if (v.wait <= 0) { v.state = 'idle'; v.wait = 0.5 + Math.random() * 1.5; }
      }

      // pose
      v.phase += dt * 9;
      const walking = v.state === 'walk' || v.state === 'homing';
      const swing = walking ? Math.sin(v.phase) * 0.6 : 0;
      if (v.frames) { const second = walking && Math.sin(v.phase) < 0; v.frames[0].visible = !second; v.frames[1].visible = second; }
      else { v.legs[0].rotation.x = swing; v.legs[1].rotation.x = -swing; }
      if (v.state === 'work' && v.target && v.target.kind === 'farm') {
        v.body.rotation.x = 0.45 + Math.max(0, Math.sin(time * 4 + v.phase)) * 0.25; // hoeing
        v.body.position.y = 0;
      } else {
        v.body.rotation.x = 0;
        v.body.position.y = walking ? Math.abs(Math.sin(v.phase)) * 0.05 : 0;
      }
      let df = v.face - v.g.rotation.y; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2;
      v.g.rotation.y += df * Math.min(1, dt * 10);
      v.g.position.copy(W(v.x, v.y, 0));
    }
  }

  /** each(fn(v, g)): the renderer draws every villager itself (instanced), from these */
  function each(fn) { for (const v of folk) fn(v, v.g); }
  return { update, each, count: () => folk.length, dispose: () => { world.remove(group); } };
}
