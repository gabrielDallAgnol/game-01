// [top] The top-down camera: an orthographic camera straight above the hero, screen-up = world −z (so the
// joystick's screen dx/dy already map to world x/z). Same interface as view/camera.js (resize, update, zoom,
// snapDolly, startOrbit); the follow spring, lead, dusk dolly, cinema and shake are the same ideas, flattened.
/* global THREE */

// the half span of the screen's SHORT side in metres at zoom 1 (1 cell ≈ 1 m): a phone shows ~24 m across, a
// desktop ~32 m top to bottom; zoom runs 0.45 … 4 (pull back to ~100 m across)
const SPAN_PORTRAIT = 12, SPAN_LANDSCAPE = 16, ZMIN = 0.45, ZMAX = 4, HEIGHT = 80;
const ZSTART = 1.25;   // [toppop] the opening view: ~30 m across a phone (pinch out to ~100 m)

export function createTopCamera(V) {
  const { S, C, canvas, camera, look, W, Wv, opts } = V;
  let zoom = ZSTART, zoomCur = ZSTART, aspect = 1; const camTarget = new THREE.Vector3(0, 0, 3);
  V.camTarget = camTarget;
  const half = { w: 10, h: 10 };   // the frustum's half extents in metres this frame (view.js streams props to it)
  const touch = matchMedia('(pointer: coarse)').matches;
  look.init(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, opts.quality || (touch ? 'medium' : 'high'));
  function frustum(R) {
    // R = the half span of the short side; the long side follows the aspect
    if (aspect < 1) { half.w = R; half.h = R / aspect; } else { half.h = R; half.w = R * aspect; }
    camera.left = -half.w; camera.right = half.w; camera.top = half.h; camera.bottom = -half.h; camera.updateProjectionMatrix();
  }
  function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; look.resize(w, h); aspect = w / h; frustum((aspect < 1 ? SPAN_PORTRAIT : SPAN_LANDSCAPE) * zoomCur); }
  resize(); window.addEventListener('resize', resize);
  let orbit = 0;
  const camVel = new THREE.Vector3(), camGoal = new THREE.Vector3(), lead = new THREE.Vector3(); let prevHx = null, prevHy = 0, dolly = 0;
  function snapDolly(dayT) { dolly = S.phase === 'day' ? Math.max(0, Math.min(1, (dayT - 0.84) / 0.12)) : 0; }
  const place = () => { camera.position.set(camTarget.x, camTarget.y + HEIGHT, camTarget.z); camera.lookAt(camTarget); };

  /** once a frame: returns R (a radius that covers the whole screen, for shadows and ambience) and dist (the depth to the ground) */
  function update(dt, dayT) {
    const time = V.time, { mobOf } = V.feel;
    zoomCur += (zoom - zoomCur) * Math.min(1, dt * 8);
    dolly += ((S.phase === 'day' ? Math.max(0, Math.min(1, (dayT - 0.84) / 0.12)) : 0) - dolly) * Math.min(1, dt * (S.phase === 'day' ? 1.2 : 0.25));
    let R = (aspect < 1 ? SPAN_PORTRAIT : SPAN_LANDSCAPE) * zoomCur * (1 - 0.12 * dolly);
    const h = S.hero, focus = V.focus;
    camera.up.set(0, 0, -1);
    if (orbit > 0) {   // the end of the game: the map turns slowly under a still camera
      orbit += dt * 0.12; camTarget.lerp(W(C, C), Math.min(1, dt * 1.5)); camera.up.set(Math.sin(orbit), 0, -Math.cos(orbit)); R *= 1.1;
    } else {
      const fm = focus && focus.t > 0 ? mobOf(focus.id) : null;
      if (prevHx === null || Math.hypot(h.x - prevHx, h.y - prevHy) > 3) { prevHx = h.x; prevHy = h.y; }
      if (dt > 0) { const vx = (h.x - prevHx) / dt, vy = (h.y - prevHy) / dt; lead.x += (Math.max(-6, Math.min(6, vx)) * 0.4 - lead.x) * Math.min(1, dt * 2.5); lead.z += (Math.max(-6, Math.min(6, vy)) * 0.4 - lead.z) * Math.min(1, dt * 2.5); }
      prevHx = h.x; prevHy = h.y;
      if (fm) { focus.t -= dt; camGoal.copy(Wv(fm.x, fm.y)); }
      else if (!h.dead) camGoal.copy(Wv(h.x, h.y)).add(lead);
      if (V.rigCam) camGoal.copy(V.rigCam);
      const cine = V.cinema, cb = cine ? cine.blend() : 0;
      if (cine && cine.active()) {
        const tg = cine.target(); camGoal.lerp(Wv(tg.x, tg.y), cb); camTarget.copy(camGoal); camVel.set(0, 0, 0); R *= cine.zoomK();
      } else {
        if (camTarget.distanceToSquared(camGoal) > 900) { camTarget.copy(camGoal); camVel.set(0, 0, 0); }
        const w2 = 36, dmp = 12, k = Math.min(dt, 0.05); camVel.x += ((camGoal.x - camTarget.x) * w2 - camVel.x * dmp) * k; camVel.y += ((camGoal.y - camTarget.y) * w2 - camVel.y * dmp) * k; camVel.z += ((camGoal.z - camTarget.z) * w2 - camVel.z * dmp) * k;
        camTarget.addScaledVector(camVel, k);
      }
    }
    frustum(R); place();
    const trauma = V.feel.trauma();
    if (trauma > 0.001) { const t2 = trauma * trauma, q = time * 31; camera.position.x += (Math.sin(q) + Math.sin(q * 2.3 + 1)) * 0.5 * t2 * 0.55; camera.position.z += (Math.sin(q * 1.7 + 2) + Math.sin(q * 3.1)) * 0.5 * t2 * 0.4; camera.rotateZ((Math.sin(q * 1.3 + 4)) * t2 * 0.035); }
    camera.updateMatrixWorld();
    return { R: Math.hypot(half.w, half.h), dist: HEIGHT };
  }
  return {
    camTarget, resize, update, snapDolly, half,
    startOrbit: () => { orbit = 0.001; },
    setZoom: z => { zoom = Math.max(ZMIN, Math.min(ZMAX, z)); }, getZoom: () => zoom,
  };
}
