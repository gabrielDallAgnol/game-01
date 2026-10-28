// [roam] The renderer: the town's ground as one full-screen shader (src/roam/ground.js through the One-medium swaps in
// src/roam/medium.js), the disturbance field that parts and presses the grass, and the solids' glyph pass. Each frame
// takes the camera and the state; draws to the GL canvas. The soft overlay (strands, ash, symbols) is medium.draw().
/* global THREE */
import { HEAD, GROUND, DIST, NS } from './ground.js';
import { createMedium } from './medium.js';

export function createLook(canvas, town) {
  const { SPAN, O, canvases: C, start } = town;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  const tex = c => { const t = new THREE.CanvasTexture(c); t.encoding = THREE.LinearEncoding; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; };
  const mtex = c => { const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
  // the field (push, press) over the whole town at ~0.42 m a texel
  const DR = Math.min(2048, Math.ceil(SPAN / 0.42)), rtOpt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false };
  const rts = [new THREE.WebGLRenderTarget(DR, DR, rtOpt), new THREE.WebGLRenderTarget(DR, DR, rtOpt)];
  renderer.setClearColor(new THREE.Color(0.5, 0.5, 0), 1); for (const r of rts) { renderer.setRenderTarget(r); renderer.clear(); } renderer.setRenderTarget(null);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadGeo = new THREE.PlaneGeometry(2, 2);
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const stampA = Array.from({ length: NS }, () => new THREE.Vector4()), stampB = Array.from({ length: NS }, () => new THREE.Vector4());
  const U = {
    tTown: { value: tex(C.gC) }, tOver: { value: tex(C.oC) }, tMach: { value: tex(C.mC) }, tRoof: { value: mtex(C.rC) }, tStreet: { value: mtex(C.sC) }, tMisc: { value: mtex(C.xC) }, tTreeH: { value: mtex(C.hC) }, tLight: { value: mtex(C.lC) }, tLDir: { value: mtex(C.dC) },
    uFire: { value: new THREE.Vector2(-1e4, -1e4) }, tDist: { value: rts[0].texture }, tPrev: { value: rts[0].texture },
    uCam: { value: new THREE.Vector2() }, uView: { value: new THREE.Vector2(40, 80) }, uOrigin: { value: new THREE.Vector2(O.x, O.y) }, uS: { value: SPAN },
    uTime: { value: 0 }, uPpm: { value: 20 }, uGrid: { value: 20 }, uSun: { value: new THREE.Vector4(-0.6, -0.8, 1.8, 0) }, uHead: { value: new THREE.Vector4() }, uNight: { value: 0 }, uKai: { value: new THREE.Vector2() },
    uA: { value: stampA }, uB: { value: stampB }, uN: { value: 0 }, uDecayPush: { value: 0 }, uDecayPress: { value: 0 },
  };
  const mat = frag => new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: HEAD + frag, depthTest: false, depthWrite: false });
  const medium = createMedium({ renderer, U, mat, VERT, quadGeo, quadCam, ASH3F: GROUND });
  const scene = new THREE.Scene(), quad = new THREE.Mesh(quadGeo, medium.material); quad.frustumCulled = false; scene.add(quad);
  const dScene = new THREE.Scene(), dQuad = new THREE.Mesh(quadGeo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: DIST, depthTest: false, depthWrite: false })); dQuad.frustumCulled = false; dScene.add(dQuad);
  let ping = 0, decayAcc = 0;
  /** what parts and presses the grass this frame: Kai (or the bike), the nearest dead, the falls */
  // only the part of the field around the view is stepped (a scissor): the whole town's field is 2048² texels, each
  // looping over the stamps, which a phone cannot afford every frame. Trails off screen simply wait.
  function stepDist(dt, S, falls, cam, cssW, cssH) {
    const hw = cssW / cam.ppm / 2 + 8, hh = cssH / cam.ppm / 2 + 8, inV = (x, y) => Math.abs(x - cam.x) < hw && Math.abs(y - cam.y) < hh;
    const tx0 = Math.max(0, Math.floor((cam.x - hw - O.x) / SPAN * DR)), tx1 = Math.min(DR, Math.ceil((cam.x + hw - O.x) / SPAN * DR));
    const ty0 = Math.max(0, Math.floor((1 - (cam.y + hh - O.y) / SPAN) * DR)), ty1 = Math.min(DR, Math.ceil((1 - (cam.y - hh - O.y) / SPAN) * DR));
    let n = 0; const put = (x, y, vx, vy, r, p) => { if (n >= NS) return; stampA[n].set(x, y, vx, vy); stampB[n].set(r, p, 0, 0); n++; };
    const k = S.kai; if (!k.dead) put(k.x, k.y, k.vx, k.vy, k.riding ? 2.2 : 1.6, k.riding ? 0.7 : 0.3);
    if (!k.riding) put(S.bike.x, S.bike.y, 0, 0, 1.4, 0.4);
    for (const f of falls) if (f.stamp) { put(f.x, f.y, 0, 0, 1.4, 1); f.stamp = false; }
    const byNear = S.dead.filter(d => inV(d.x, d.y)).sort((a, b) => Math.hypot(a.x - k.x, a.y - k.y) - Math.hypot(b.x - k.x, b.y - k.y));
    for (const d of byNear) put(d.x, d.y, d.vx, d.vy, 0.8, Math.hypot(d.vx, d.vy) > 0.2 ? 1 : 0.6);
    U.uN.value = n;
    decayAcc += dt; if (decayAcc >= 0.2) { U.uDecayPush.value = decayAcc * 0.35; U.uDecayPress.value = decayAcc / 22; decayAcc = 0; } else { U.uDecayPush.value = 0; U.uDecayPress.value = 0; }
    const out = rts[1 - ping]; out.scissor.set(tx0, ty0, Math.max(1, tx1 - tx0), Math.max(1, ty1 - ty0)); out.scissorTest = true;
    U.tPrev.value = rts[ping].texture; renderer.setRenderTarget(out); renderer.render(dScene, quadCam); renderer.setRenderTarget(null);
    ping = 1 - ping; U.tDist.value = rts[ping].texture;
  }
  // the zoom the grass is laid for: it moves in steps, and only when the zoom has moved well away (a pinch), so the strands
  // never crawl while the camera breathes with the bike's speed
  let grid = 0; const gridFor = ppm => { if (!grid || Math.abs(Math.log2(ppm / grid)) > 0.4) grid = Math.pow(2, Math.round(Math.log2(ppm) * 2) / 2); return grid; };
  function resize(w, h, dpr) { renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  /** v: { cam, cssW, cssH, dpr, S, falls, t, night, dt } */
  function render(v) {
    const { cam, cssW, cssH, dpr, S, t, night, sun } = v;
    U.uGrid.value = gridFor((cam.base || cam.ppm) * dpr); U.uSun.value.set(sun.x, sun.y, sun.climb, sun.warm);
    { const b = S.bike, a = b.ang, f = 0.72 * 0.9 * 2.6; U.uHead.value.set(b.x + Math.cos(a) * f, b.y + Math.sin(a) * f, a, S.kai.riding ? 0.25 + 0.75 * night : 0); }
    U.uCam.value.set(cam.x, cam.y); U.uView.value.set(cssW / cam.ppm, cssH / cam.ppm); U.uPpm.value = cam.ppm * dpr; U.uTime.value = t; U.uNight.value = night; U.uKai.value.set(S.kai.x, S.kai.y);
    stepDist(v.dt, S, v.falls, cam, cssW, cssH);
    medium.render({ cam, cssW, cssH, dpr, kai: S.kai, dead: S.dead, deaths: v.falls, bike: S.bike, nests: S.nests, t, night });
    renderer.render(scene, quadCam);
  }
  return { render, resize, draw: medium.draw, U };
}
