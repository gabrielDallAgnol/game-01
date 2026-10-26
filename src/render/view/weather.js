// Weather and ambience: storm rain in a box that follows the camera, fog thickening the night air, lightning,
// and the ambient particles (embers and smoke off the camp fire, fireflies by night, pollen by day).
/* global THREE */
import { K } from '../kit.js';
// [top]

export function createWeather(V) {
  const { S, fx, fx2, scene, look, vis, opts, camTarget } = V;
  // rain for thunderstorms: streaks falling in a box that follows the camera
  const RAIN = 700, rainGeo = new THREE.BoxGeometry(0.012, 0.5, 0.012);
  const rain = new THREE.InstancedMesh(rainGeo, new THREE.MeshBasicMaterial({ color: K.lin('#9fb3c8'), transparent: true, opacity: 0.35, depthWrite: false }), RAIN);
  rain.frustumCulled = false; rain.visible = false; fx.add(rain);
  const drops = Array.from({ length: RAIN }, () => ({ x: (Math.random() - 0.5) * 40, y: Math.random() * 14, z: (Math.random() - 0.5) * 30, v: 16 + Math.random() * 6 }));
  const rd2 = new THREE.Object3D(); let rainK = 0;
  function stepRain(dt) {
    rainK += ((S.weather === 'storm' && S.phase === 'night' ? 1 : 0) - rainK) * Math.min(1, dt * 0.7);
    rain.visible = rainK > 0.02; if (!rain.visible) return;
    rain.material.opacity = 0.35 * rainK;
    const n = Math.floor(RAIN * rainK);
    for (let k = 0; k < n; k++) {
      const d = drops[k]; d.y -= d.v * dt; d.x -= d.v * dt * 0.18;
      if (d.y < 0) { d.y = 12 + Math.random() * 2; d.x = (Math.random() - 0.5) * 40; d.z = (Math.random() - 0.5) * 30; }
      rd2.position.set(camTarget.x + d.x, d.y, camTarget.z + d.z); rd2.rotation.set(0, 0, 0.18); rd2.updateMatrix(); rain.setMatrixAt(k, rd2.matrix);
    }
    rain.count = n; rain.instanceMatrix.needsUpdate = true;
  }
  let wxFog = 0, flash = 0, flashN = 0, nextFlash = 4; const fogCol = K.lin('#5d6670');

  /** the fog's reach for this camera distance (thicker on a foggy night) */
  function fog(dt, dist) {
    const dark = V.dark;
    const wx = S.weather, fogK = (wx === 'fog' ? 1 : 0) * dark; wxFog += (fogK - wxFog) * Math.min(1, dt * 0.8);
    scene.fog.near = dist + 14 - wxFog * (dist + 8); scene.fog.far = dist + 95 - wxFog * 70;
    { scene.fog.near = 1e4; scene.fog.far = 2e4; }   // [top] no fog seen from above (every pixel is the same depth)
  }
  /** after the sky has set the light: fog colour, and a storm throws lightning */
  function storm(dt) {
    // weather: fog thickens the night air; a storm throws lightning
    if (wxFog > 0.01) { scene.fog.color.lerp(fogCol, wxFog * 0.35); scene.background.copy(scene.fog.color); }
    if (S.weather === 'storm' && S.phase === 'night') { nextFlash -= dt; if (nextFlash <= 0) { flash = 1; flashN = 1; nextFlash = 3 + vis() * 8; if (opts.onFlash) opts.onFlash(); } }
    if (flash > 0.01) { look.hemi.intensity += flash * 1.4; look.sun.intensity += flash * 2.2; flash *= Math.exp(-dt * (flash > 0.5 ? 9 : 4)); if (flash < 0.33 && flashN > 0) { flashN--; flash = 0.8; } }
  }

  let emberT = 0;
  /** ambient particles: embers off the camp fire and fireflies in the woods by night, pollen drifting by day */
  function ambient(dt, frozen, R) {
    const dark = V.dark, keepFires = V.keep.fires, keepSmoke = V.keep.smoke;
    emberT -= dt;
    if (emberT <= 0 && !frozen) {
      emberT = 0.12;
      if (keepFires.length && !S.keep.ruined) { const [fx0, fz0] = keepFires[vis() * keepFires.length | 0]; fx2.emit('ember', fx0, 0.5, fz0, 1, { spread: 0.2 }); if (vis() < 0.25) fx2.emit('smoke', fx0, 0.9, fz0, 1, { size: 0.5, speed: 0.8 }); }
      for (const [sx0, sz0, , sy0] of keepSmoke) if (vis() < 0.4) fx2.emit('smoke', sx0, sy0, sz0, 1, { size: 0.7 });
      const rx = camTarget.x + (vis() - 0.5) * R * 2.4, rz = camTarget.z + (vis() - 0.7) * R * 3;
      if (dark > 0.6 && vis() < 0.5) fx2.emit('firefly', rx, 0.4 + vis() * 1.2, rz, 1);
      else if (dark < 0.3 && vis() < 0.35) fx2.emit('pollen', rx, 0.3 + vis() * 1.5, rz, 1);
    }
  }
  return { stepRain, fog, storm, ambient };
}
