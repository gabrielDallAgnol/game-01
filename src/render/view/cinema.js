// The look-at shot: the camera eases out to a place (a hive that just woke), holds on it with a beam, a ring and a
// name tag, then eases back to the hero. The camera reads `blend()` and `zoomK()`; the UI starts it and may skip it.
/* global THREE */
import { K } from '../kit.js';
import { lc } from './shared.js';

const GO = 1.2, HOLD = 1.0, BACK = 1.2;
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };   // ease-in-out cubic

export function createCinema(V) {
  const { fx, Wv } = V;
  let shot = null;   // { x, y, t, hold, color, tag }
  let beam = null, ring = null, glow = null, tag = null, tagText = '';
  function build() {
    const bg = new THREE.CylinderGeometry(0.45, 0.9, 26, 20, 1, true); bg.translate(0, 13, 0);
    const bm = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: lc('#7fe3ff') }, uA: { value: 0 } },
      vertexShader: 'varying float vH; void main(){ vH = position.y / 26.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uCol; uniform float uA; varying float vH; void main(){ float a = uA * (1.0 - vH) * (1.0 - vH) * 0.85; gl_FragColor = vec4(uCol * a * 2.0, 0.0); }',
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, side: THREE.DoubleSide, fog: false,
    });
    beam = new THREE.Mesh(bg, bm); beam.renderOrder = 23; beam.frustumCulled = false; beam.visible = false; fx.add(beam);
    const rg = new THREE.RingGeometry(2.6, 3.0, 64); rg.rotateX(-Math.PI / 2);
    ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: lc('#7fe3ff').multiplyScalar(2), transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
    ring.renderOrder = 23; ring.visible = false; fx.add(ring);
    glow = K.glowSprite('#7fe3ff', 7, 1.4); glow.material.depthTest = false; glow.renderOrder = 22; glow.visible = false; fx.add(glow);
  }
  function setTag(text) {
    if (tag && tagText === text) return; if (tag) { fx.remove(tag); tag.material.map.dispose(); tag.material.dispose(); }
    tagText = text;
    tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.textTex(text, { w: 512, h: 72, size: 34, bg: '#061826', fg: '#bff0ff', spacing: '3px' }), transparent: true, depthTest: false }));
    tag.scale.set(6.6, 0.93, 1); tag.renderOrder = 24; tag.visible = false; fx.add(tag);
  }
  const total = s => GO + s.hold + BACK;
  /** start a shot at grid (x, y); o: { color, tag, hold } */
  function look(x, y, o = {}) {
    if (!beam) build();
    shot = { x, y, t: 0, hold: o.hold || HOLD, color: o.color || '#7fe3ff' };
    beam.material.uniforms.uCol.value.copy(lc(shot.color)); ring.material.color.copy(lc(shot.color)).multiplyScalar(2); glow.material.color.copy(lc(shot.color)).multiplyScalar(1.4);
    if (o.tag) setTag(o.tag); else if (tag) tag.visible = false;
    shot.tagOn = !!o.tag;
  }
  /** jump to the way back, from where the camera is now (no snap) */
  function skip() {
    if (!shot) return; const T = shot.t;
    if (T < GO) shot.t = GO + shot.hold + BACK * (1 - smoothInv(smooth(T / GO)));
    else if (T < GO + shot.hold) shot.t = GO + shot.hold;
  }
  // the inverse of smooth on [0, 1] (bisection: a skip happens once)
  function smoothInv(v) { let a = 0, b = 1; for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (smooth(m) < v) a = m; else b = m; } return (a + b) / 2; }
  /** 0 = on the hero, 1 = on the shot */
  function blend() {
    if (!shot) return 0; const T = shot.t;
    return T < GO ? smooth(T / GO) : T < GO + shot.hold ? 1 : smooth(1 - (T - GO - shot.hold) / BACK);
  }
  /** a slight pull-back while travelling, so the way between camp and hive reads */
  function zoomK() { if (!shot) return 1; const T = shot.t, k = T < GO ? T / GO : T < GO + shot.hold ? 1 : 1 - (T - GO - shot.hold) / BACK; return 1 + 0.35 * Math.sin(Math.PI * Math.max(0, Math.min(1, k))) * (T < GO || T > GO + shot.hold ? 1 : 0); }
  function update(dt) {
    if (!shot) return;
    shot.t += dt; const T = shot.t, end = total(shot);
    // the marks: in as the camera arrives, out on the way back
    const a = T < GO * 0.6 ? 0 : T < GO + shot.hold ? Math.min(1, (T - GO * 0.6) / (GO * 0.4 + 0.2)) : Math.max(0, 1 - (T - GO - shot.hold) / (BACK * 0.6));
    const p = Wv(shot.x, shot.y, 0.12), pulse = 0.5 + 0.5 * Math.sin(V.time * 6);
    beam.visible = ring.visible = glow.visible = a > 0.01; beam.position.copy(Wv(shot.x, shot.y, 0)); beam.material.uniforms.uA.value = a * (0.75 + 0.25 * pulse);
    ring.position.copy(p); ring.material.opacity = a * (0.6 + 0.4 * pulse); ring.scale.setScalar(1 + 0.12 * pulse);
    glow.position.copy(Wv(shot.x, shot.y, 1.2)); glow.material.opacity = a * 0.7;
    if (tag) { tag.visible = shot.tagOn && a > 0.01; tag.position.copy(Wv(shot.x, shot.y, 5.4)); tag.material.opacity = a; }
    if (V.topMarks) V.topMarks.cinema(beam, tag);   // [top]
    if (T >= end) { shot = null; beam.visible = ring.visible = glow.visible = false; if (tag) tag.visible = false; }
  }
  return { look, skip, blend, zoomK, update, target: () => shot && { x: shot.x, y: shot.y }, active: () => !!shot };
}
