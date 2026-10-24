// [rig3] The Haven Rig in motion: poses the keep model (view/keep.js builds K.haven) between packed and anchored,
// and plays the act change. Rolling out: fold up (outriggers, awnings, pylon), then drive off down the road with the
// camera following (V.rigCam, read by view/camera.js). Arriving in a new act: drive in from the road, then unfold.
// Wall-clock timings (content/rig.js RIG.anim); the sim waits (the UI pauses it) while the Rig rolls.
/* global THREE */
import { K } from '../kit.js';
import { RIG } from '../../content/rig.js';

export function createHaven(V) {
  const { S, C, map, Wv, fx2 } = V;
  const A = RIG.anim;
  let a = S.rig && S.rig.mode === 'arriving' ? 0 : 1, phase = 'still', t = 0, smokeT = 0;
  // the route: the camp, then out along the road toward the city (map.feature.road: every 8th road point)
  const road = ((map.feature && map.feature.road) || []).slice(0, 10);
  const path = [[C, C]].concat(road.length ? road : [[C + 40, C]]);
  const lens = [0]; for (let k = 1; k < path.length; k++) lens.push(lens[k - 1] + Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]));
  const along = d => { d = Math.max(0, Math.min(lens[lens.length - 1], d)); let k = 1; while (k < lens.length - 1 && lens[k] < d) k++; const f = (d - lens[k - 1]) / Math.max(1e-6, lens[k] - lens[k - 1]), p = path[k - 1], q = path[k]; return { x: p[0] + (q[0] - p[0]) * f, y: p[1] + (q[1] - p[1]) * f, h: Math.atan2(q[1] - p[1], q[0] - p[0]) }; };
  const DRIVE = Math.min(lens[lens.length - 1], 60), INTO = Math.min(lens[lens.length - 1], 26);
  const camV = new THREE.Vector3(); V.rigCam = null;
  if (S.rig && S.rig.mode === 'arriving') { phase = 'in'; t = 0; }
  const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

  function place(g, x, y, heading, bob) {
    g.position.copy(Wv(x, y)); g.position.y += bob;
    g.rotation.y = heading === null ? Math.PI : -heading;   // parked: the porch to the camera; driving: the cab leads
  }
  function exhaust(g, n) {
    const u = g.userData; if (!u.smoke || !u.smoke.length) return;
    g.updateMatrixWorld(true);
    for (const s of u.smoke) { const v = new THREE.Vector3(s[0], s[1], s[2]).applyMatrix4(g.matrixWorld); fx2.emit('smoke', v.x, v.y, v.z, n, { spread: 0.15 }); }
  }
  /** once a frame (after keep.update) */
  function update(dt) {
    const g = V.keep && V.keep.g; if (!g || !RIG.on || !S.rig) return;
    const mode = S.rig.mode;
    if (mode === 'rolling' && phase !== 'fold' && phase !== 'drive' && phase !== 'gone') { phase = 'fold'; t = 0; }
    t += dt;
    let x = C, y = C, heading = null, bob = 0;
    if (phase === 'fold') { a = Math.max(0, 1 - t / A.pack); bob = Math.sin(t * 40) * 0.015; if (t >= A.pack) { phase = 'drive'; t = 0; } }
    else if (phase === 'drive') {
      a = 0; const d = DRIVE * smooth(t / A.drive) * (0.6 + 0.4 * Math.min(1, t / A.drive)), p = along(d);
      x = p.x; y = p.y; heading = p.h; bob = Math.sin(t * 22) * 0.03;
      if (t >= A.drive) phase = 'gone';
    } else if (phase === 'gone') { const p = along(DRIVE); x = p.x; y = p.y; heading = p.h; g.visible = false; }
    else if (phase === 'in') {
      a = 0; const k = smooth(t / A.drive * 1.4), p = along(INTO * (1 - k));
      x = p.x; y = p.y; heading = k >= 1 ? null : p.h + Math.PI; bob = Math.sin(t * 22) * 0.03 * (1 - k);
      if (k >= 1) { phase = 'unfold'; t = 0; }
    } else if (phase === 'unfold') { a = Math.min(1, t / A.unpack); bob = Math.sin(t * 30) * 0.012 * (1 - a); if (a >= 1) phase = 'still'; if (t < 0.1) V.feel.dust(C, C, 3); }
    else a = mode === 'anchored' || mode === 'arriving' ? 1 : 0;
    if (phase !== 'gone') place(g, x, y, heading, bob);
    K.setHaven(g, a);
    // the beacon turns while the Rig moves; the pylon hums when anchored
    const u = g.userData, moving = phase === 'fold' || phase === 'drive' || phase === 'in' || phase === 'unfold';
    if (u.beacon) { u.beacon.visible = moving || V.dark > 0.3; u.beacon.material.opacity = moving ? 0.6 + 0.4 * Math.abs(Math.sin(V.time * 6)) : 0.5; }
    if (u.hum && u.hum.visible) u.hum.material.opacity = 0.55 + 0.25 * Math.sin(V.time * 3);
    if (moving && (smokeT -= dt) <= 0) { smokeT = phase === 'drive' || phase === 'in' ? 0.16 : 0.35; exhaust(g, 1); }
    // the camera follows the Rig while it drives
    if (phase === 'drive' || phase === 'gone' || phase === 'in') V.rigCam = camV.copy(Wv(x, y)); else V.rigCam = null;
  }
  /** a tap skips the drive: rolling out jumps to gone, driving in jumps to unfolding */
  function skip() { if (phase === 'fold' || phase === 'drive') { phase = 'gone'; t = 0; } else if (phase === 'in') { phase = 'unfold'; t = 0; } }
  return { update, skip, phase: () => phase, done: () => phase === 'gone', busy: () => phase !== 'still' };
}
