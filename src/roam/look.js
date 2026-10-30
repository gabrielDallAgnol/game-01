// [roam] The renderer: the town's ground as one full-screen shader (src/roam/ground.js through the One-medium swaps in
// src/roam/medium.js), the disturbance field that parts and presses the grass, and the solids' glyph pass. Each frame
// takes the camera and the state; draws to the GL canvas. The soft overlay (strands, ash, symbols) is medium.draw().
/* global THREE */
import { HEAD, GROUND, DIST, NS } from './ground.js';
import { createMedium } from './medium.js';
import { createAtomLook } from './atomlook.js';

export function createLook(canvas, town) {
  const { tiles, size } = town, WIN = tiles.WIN, T = n => tiles.byName[n].tex;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  // the field (push, press): a ring like the data maps, WIN metres at 0.25 m a texel, sampled with repeat wrapping
  const DR = 2048, rtOpt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping };
  const rts = [new THREE.WebGLRenderTarget(DR, DR, rtOpt), new THREE.WebGLRenderTarget(DR, DR, rtOpt)];
  renderer.setClearColor(new THREE.Color(0.5, 0.5, 0), 0); for (const r of rts) { renderer.setRenderTarget(r); renderer.clear(); } renderer.setRenderTarget(null);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadGeo = new THREE.PlaneGeometry(2, 2);
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const stampA = Array.from({ length: NS }, () => new THREE.Vector4()), stampB = Array.from({ length: NS }, () => new THREE.Vector4());
  const U = {
    tRoof: { value: T('roof') }, tStreet: { value: T('street') }, tMisc: { value: T('misc') }, tTreeH: { value: T('trees') }, tLight: { value: T('light') }, tLDir: { value: T('ldir') }, tDecal: { value: T('decal') }, tLand: { value: T('land') }, uWorld: { value: new THREE.Vector2(size.w, size.h) },
    uFire: { value: new THREE.Vector2(-1e4, -1e4) }, tDist: { value: rts[0].texture }, tPrev: { value: rts[0].texture },
    uCam: { value: new THREE.Vector2() }, uView: { value: new THREE.Vector2(40, 80) }, uOrigin: { value: new THREE.Vector2(0, 0) }, uS: { value: WIN },
    uTime: { value: 0 }, uPpm: { value: 20 }, uGrid: { value: 20 },  uSun: { value: new THREE.Vector4(-0.6, -0.8, 1.8, 0) }, uHead: { value: new THREE.Vector4() }, uNight: { value: 0 }, uKai: { value: new THREE.Vector2() },
    uA: { value: stampA }, uB: { value: stampB }, uN: { value: 0 }, uDecayPush: { value: 0 }, uDecayPress: { value: 0 }, uDecayFlat: { value: 0 },
  };
  const atoms = createAtomLook({ U, town });   // [atoms-look] the atom world's state as maps the ground shader reads
  const mat = frag => new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: HEAD + frag, depthTest: false, depthWrite: false });
  const medium = createMedium({ renderer, U, mat, VERT, quadGeo, quadCam, ASH3F: GROUND });
  const scene = new THREE.Scene(), quad = new THREE.Mesh(quadGeo, medium.material); quad.frustumCulled = false; scene.add(quad);
  const dScene = new THREE.Scene(), dQuad = new THREE.Mesh(quadGeo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: DIST, depthTest: false, depthWrite: false })); dQuad.frustumCulled = false; dScene.add(dQuad);
  let ping = 0, decayAcc = 0, flatAcc = 0;
  /** what parts and presses the grass this frame: Kai (or the bike), the nearest dead, the falls */
  // only the part of the field around the view is stepped (a scissor): the whole town's field is 2048² texels, each
  // looping over the stamps, which a phone cannot afford every frame. Trails off screen simply wait.
  function stepDist(dt, S, falls, cam, cssW, cssH) {
    const hw = cssW / cam.ppm / 2 + 8, hh = cssH / cam.ppm / 2 + 8, inV = (x, y) => Math.abs(x - cam.x) < hw && Math.abs(y - cam.y) < hh;
    const tx0 = Math.floor((cam.x - hw) / WIN * DR), tx1 = Math.ceil((cam.x + hw) / WIN * DR), ty0 = Math.floor((cam.y - hh) / WIN * DR), ty1 = Math.ceil((cam.y + hh) / WIN * DR);
    // f: how hard it lays tall plants down (only what moves: a wheel or a stride, not a standing figure)
    // lr: the laid track's half-width (a tyre's track, a foot's: much narrower than the parting)
    let n = 0; const put = (x, y, vx, vy, r, p, f = 0, lr = 0) => { if (n >= NS) return; stampA[n].set(x, y, vx, vy); stampB[n].set(Math.max(r, lr), p, f, lr); n++; };
    const k = S.kai, ks = Math.hypot(k.vx, k.vy); if (!k.dead) put(k.x, k.y, k.vx, k.vy, k.riding ? 2.2 : 1.6, k.riding ? 0.7 : 0.3, k.riding ? Math.min(1, ks / 3) : Math.min(0.55, ks / 6), k.riding ? 0.6 : 0.4);
    if (!k.riding) put(S.bike.x, S.bike.y, 0, 0, 1.4, 0.4);
    for (const f of falls) if (f.stamp) { put(f.x, f.y, 0, 0, 1.4, 1); f.stamp = false; }
    const byNear = S.dead.filter(d => inV(d.x, d.y)).sort((a, b) => Math.hypot(a.x - k.x, a.y - k.y) - Math.hypot(b.x - k.x, b.y - k.y));
    for (const d of byNear) { const sp = Math.hypot(d.vx, d.vy); put(d.x, d.y, d.vx, d.vy, 0.8, sp > 0.2 ? 1 : 0.6, Math.min(0.4, sp / 4), 0.35); }
    U.uN.value = n;
    decayAcc += dt; if (decayAcc >= 0.2) { U.uDecayPush.value = decayAcc * 0.35; U.uDecayPress.value = decayAcc / 22; U.uDecayFlat.value = Math.max(1, Math.round(decayAcc / 240 * 255)) / 255 * (decayAcc > 0.9 ? 1 : 0); flatAcc += decayAcc; decayAcc = 0; } else { U.uDecayPush.value = 0; U.uDecayPress.value = 0; U.uDecayFlat.value = 0; }
    if (flatAcc >= 0.94) { U.uDecayFlat.value = 1 / 255; flatAcc = 0; }   // a laid crop rises over ~4 minutes: one step every second (8-bit channel)
    // the view's patch of the ring, split where it wraps (up to four scissored passes into the same target)
    const out = rts[1 - ping]; U.tPrev.value = rts[ping].texture; out.scissorTest = true;
    for (const [x0, x1] of wrapSpan(tx0, tx1)) for (const [y0, y1] of wrapSpan(ty0, ty1)) { out.scissor.set(x0, y0, x1 - x0, y1 - y0); renderer.setRenderTarget(out); renderer.render(dScene, quadCam); }
    renderer.setRenderTarget(null);
    ping = 1 - ping; U.tDist.value = rts[ping].texture;
  }
  // the zoom the grass is laid for: it moves in steps, and only when the zoom has moved well away (a pinch), so the strands
  // never crawl while the camera breathes with the bike's speed
  let grid = 0; const gridFor = ppm => { if (!grid || Math.abs(Math.log2(ppm / grid)) > 0.4) grid = Math.pow(2, Math.round(Math.log2(ppm) * 2) / 2); return grid; };
  const wrapSpan = (a, b) => { if (b - a >= DR) return [[0, DR]]; const m = v => ((v % DR) + DR) % DR, A = m(a), B = A + (b - a); return B <= DR ? [[A, B]] : [[A, DR], [0, B - DR]]; };
  // a tile freshly painted into a slot: its patch of the field starts flat (it held some other place's trails)
  const flat = new THREE.Color(0.5, 0.5, 0);
  function clearPatch(i, j) { const S = tiles.TILE / WIN * DR, x = (((i * S) % DR) + DR) % DR, y = (((j * S) % DR) + DR) % DR, c = new THREE.Color(), a = renderer.getClearAlpha(); renderer.getClearColor(c); renderer.setClearColor(flat, 0);
    for (const r of rts) { r.scissor.set(x, y, S, S); r.scissorTest = true; renderer.setRenderTarget(r); renderer.clear(true, false, false); } renderer.setRenderTarget(null); renderer.setClearColor(c, a); }
  // streaming: paint what the camera will need (all of it at the start, then a few ms a frame) and upload it
  tiles.update(town.start.x, town.start.y, Infinity);
  function stream(cam, vx, vy) { tiles.update(cam.x + vx * 3, cam.y + vy * 3, 5, clearPatch); tiles.upload(renderer); }
  function resize(w, h, dpr) { renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  /** v: { cam, cssW, cssH, dpr, S, falls, t, night, dt } */
  function render(v) {
    const { cam, cssW, cssH, dpr, S, t, night, sun } = v;
    U.uGrid.value = gridFor((cam.base || cam.ppm) * dpr);   // the stepped zoom the ground's blade strokes and the hedges are laid for (the grass itself is world-sized)
    U.uSun.value.set(sun.x, sun.y, sun.climb, sun.warm);
    stream(cam, S.kai.vx, S.kai.vy);
    { const b = S.bike, a = b.ang, f = 0.72 * 0.9 * 2.6; U.uHead.value.set(b.x + Math.cos(a) * f, b.y + Math.sin(a) * f, a, S.kai.riding ? 0.25 + 0.75 * night : 0); }
    U.uCam.value.set(cam.x, cam.y); U.uView.value.set(cssW / cam.ppm, cssH / cam.ppm); U.uPpm.value = cam.ppm * dpr; U.uTime.value = t; U.uNight.value = night; U.uKai.value.set(S.kai.x, S.kai.y);
    stepDist(v.dt, S, v.falls, cam, cssW, cssH); atoms.update(S, cam, v.dt);
    medium.render({ cam, cssW, cssH, dpr, kai: S.kai, dead: S.dead, deaths: v.falls, bike: S.bike, nests: S.nests, t, night, props: town.dress.volumes, broken: S.broken, drops: S.drops });
    renderer.render(scene, quadCam);
  }
  return { render, resize, draw: medium.draw, U, atoms };
}
