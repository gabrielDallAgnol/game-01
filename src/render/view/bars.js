// Health bars: camera-facing, drawn over everything, coloured and sized by kind.
/* global THREE */
import { lc } from './shared.js';

export function createBars(V) {
  const { fx, camera, Wv } = V;
  // ---------- health bars ----------
  // a dark frame one notch bigger than the fill, so a bar reads on grass, on snow and at night; thickness by kind
  // (hero amber like its outline; the dead a warm red, never rot-green; the big dead and bosses thicker and longer)
  const barGeo = new THREE.PlaneGeometry(1, 1), barFg = new THREE.PlaneGeometry(1, 1); barFg.translate(0.5, 0, 0);
  const barBg = new THREE.MeshBasicMaterial({ color: lc('#050506'), transparent: true, opacity: 0.94, depthTest: false, fog: false });
  const barM = { b: new THREE.MeshBasicMaterial({ color: lc('#d9843a'), depthTest: false, fog: false, transparent: true }), z: new THREE.MeshBasicMaterial({ color: lc('#ff5a40').multiplyScalar(2.4), depthTest: false, fog: false, transparent: true }), hero: new THREE.MeshBasicMaterial({ color: lc('#ffc24a').multiplyScalar(2.4), depthTest: false, fog: false, transparent: true }), h: new THREE.MeshBasicMaterial({ color: lc('#f3e6c8').multiplyScalar(1.8), depthTest: false, fog: false, transparent: true }), boss: new THREE.MeshBasicMaterial({ color: lc('#ff2a4a').multiplyScalar(2.6), depthTest: false, fog: false, transparent: true }) };
  const BAR_H = { hero: 0.24, z: 0.2, boss: 0.34, b: 0.16, h: 0.18 };
  function makeBar(kind, w, th) {
    const h = th || BAR_H[kind] || 0.16, pad = Math.max(0.06, h * 0.35), g = new THREE.Group(), bg = new THREE.Mesh(barGeo, barBg), fg = new THREE.Mesh(barFg, barM[kind] || barM.z);
    bg.scale.set(w + pad, h + pad, 1); fg.scale.set(w, h, 1); fg.position.set(-w / 2, 0, 0.001); bg.renderOrder = 20; fg.renderOrder = 21; g.add(bg, fg); g.visible = false; g.userData.fg = fg; g.userData.w = w; fx.add(g); return g;
  }
  function setBar(bar, x, y, z, f, always = false) { if ((f >= 0.999 && !always) || f <= 0) { bar.visible = false; return; } bar.visible = true; bar.position.copy(Wv(x, z, y)); bar.quaternion.copy(camera.quaternion); bar.userData.fg.scale.x = Math.min(1, f) * bar.userData.w; if (V.topMarks) V.topMarks.bar(bar, y); }   // [top] from above: toward screen-up, not up
  return { makeBar, setBar };
}
