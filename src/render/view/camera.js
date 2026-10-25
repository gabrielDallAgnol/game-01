// The camera: zoom, a critically damped spring that leads the hero a little in the direction they walk (or holds
// on the first dead), the dusk dolly, the end-of-game orbit and trauma shake on top; resize and quality.
/* global THREE */

export function createCamera(V) {
  const { S, C, canvas, camera, look, W, Wv, opts } = V;
  // ---------- camera ----------
  let zoom = 1, zoomCur = 1; const camTarget = new THREE.Vector3(0, 0, 3);
  V.camTarget = camTarget;
  const touch = matchMedia('(pointer: coarse)').matches;
  look.init(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, opts.quality || (touch ? 'medium' : 'high'));
  function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; look.resize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); window.addEventListener('resize', resize);
  let orbit = 0;
  // camera: a spring that leads the hero a little in the direction they walk; trauma shake on top
  const camVel = new THREE.Vector3(), camGoal = new THREE.Vector3(), lead = new THREE.Vector3(); let prevHx = null, prevHy = 0, dolly = 0;
  /** the light snapped to the time of day (tests, screenshots): the dolly jumps with it */
  function snapDolly(dayT) { dolly = S.phase === 'day' ? Math.max(0, Math.min(1, (dayT - 0.84) / 0.12)) : 0; }

  /** once a frame: returns the view radius R (world units) and the camera distance */
  function update(dt, dayT) {
    const time = V.time, { mobOf } = V.feel;
    // camera follows the hero
    zoomCur += (zoom - zoomCur) * Math.min(1, dt * 8);
    const narrow = camera.aspect < 1, vf = narrow ? 40 : 28;
    if (camera.fov !== vf) { camera.fov = vf; camera.updateProjectionMatrix(); }
    // the dusk dolly: as the light goes the camera eases in on the camp a little, and back out through the night
    dolly += ((S.phase === 'day' ? Math.max(0, Math.min(1, (dayT - 0.84) / 0.12)) : 0) - dolly) * Math.min(1, dt * (S.phase === 'day' ? 1.2 : 0.25));
    const vh = Math.tan(vf * Math.PI / 360), hh = vh * camera.aspect, R = (narrow ? 8.5 : 13) * zoomCur * (1 - 0.12 * dolly), dist = Math.max(R / hh, R / vh * 0.8);
    const h = S.hero, focus = V.focus;
    if (orbit > 0) {
      orbit += dt * 0.12; camTarget.lerp(W(C, C), Math.min(1, dt * 1.5));
      const od = dist * 1.1; camera.position.set(camTarget.x + Math.sin(orbit) * od * 0.6, camTarget.y + od * 0.7, camTarget.z + Math.cos(orbit) * od * 0.6);
    } else {
      const fm = focus && focus.t > 0 ? mobOf(focus.id) : null;
      if (prevHx === null || Math.hypot(h.x - prevHx, h.y - prevHy) > 3) { prevHx = h.x; prevHy = h.y; }
      if (dt > 0) { const vx = (h.x - prevHx) / dt, vy = (h.y - prevHy) / dt; lead.x += (Math.max(-6, Math.min(6, vx)) * 0.4 - lead.x) * Math.min(1, dt * 2.5); lead.z += (Math.max(-6, Math.min(6, vy)) * 0.4 - lead.z) * Math.min(1, dt * 2.5); }
      prevHx = h.x; prevHy = h.y;
      if (fm) { focus.t -= dt; camGoal.copy(Wv(fm.x, fm.y)); }
      else if (!h.dead) camGoal.copy(Wv(h.x, h.y)).add(lead);
      if (V.rigCam) camGoal.copy(V.rigCam);   // [rig3] the camera rides with the Haven Rig while it drives
      // [cinema] begin: the look-at shot eases the camera to a place and back on a fixed curve, no spring
      const cine = V.cinema, cb = cine ? cine.blend() : 0;
      if (cine && cine.active()) {
        const tg = cine.target(), zk = cine.zoomK(); camGoal.lerp(Wv(tg.x, tg.y), cb); camTarget.copy(camGoal); camVel.set(0, 0, 0);
        camera.position.set(camTarget.x, camTarget.y + dist * zk * (0.76 + 0.05 * dolly), camTarget.z + dist * zk * (0.65 - 0.06 * dolly));
        camera.lookAt(camTarget); camera.updateMatrixWorld(); return { R: R * zk, dist: dist * zk };
      }
      // [cinema] end
      // critically damped spring (ω ≈ 6)
      if (camTarget.distanceToSquared(camGoal) > 900) { camTarget.copy(camGoal); camVel.set(0, 0, 0); }
      const w2 = 36, dmp = 12; camVel.x += ((camGoal.x - camTarget.x) * w2 - camVel.x * dmp) * Math.min(dt, 0.05); camVel.y += ((camGoal.y - camTarget.y) * w2 - camVel.y * dmp) * Math.min(dt, 0.05); camVel.z += ((camGoal.z - camTarget.z) * w2 - camVel.z * dmp) * Math.min(dt, 0.05);
      camTarget.addScaledVector(camVel, Math.min(dt, 0.05));
      camera.position.set(camTarget.x, camTarget.y + dist * (0.76 + 0.05 * dolly), camTarget.z + dist * (0.65 - 0.06 * dolly));
    }
    camera.lookAt(camTarget);
    const trauma = V.feel.trauma();
    if (trauma > 0.001) { const t2 = trauma * trauma, q = time * 31; camera.position.x += (Math.sin(q) + Math.sin(q * 2.3 + 1)) * 0.5 * t2 * 0.55; camera.position.y += (Math.sin(q * 1.7 + 2) + Math.sin(q * 3.1)) * 0.5 * t2 * 0.4; camera.rotateZ((Math.sin(q * 1.3 + 4)) * t2 * 0.035); }
    camera.updateMatrixWorld();
    return { R, dist };
  }
  return {
    camTarget, resize, update, snapDolly,
    startOrbit: () => { orbit = 0.001; },
    setZoom: z => { zoom = Math.max(0.45, Math.min(1.8, z)); }, getZoom: () => zoom,
  };
}
