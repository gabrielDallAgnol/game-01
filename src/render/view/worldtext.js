// [ch1] Chapter 1's words drawn in the world, legible from straight above: graffiti sprayed on the pavement by their
// walls (painted once into a canvas decal, lit like the ground), radio broadcasts as a line that floats over the radio
// that plays them (a car radio, the Rig), and the System's short [bracketed] lines stacked over Kai. Text sprites keep
// their screen size as the camera zooms. Reads the API and the drained events; never writes the game.
/* global THREE */
import { K } from '../kit.js';

const SPRAY = ['#f2f2ee', '#ffd23a', '#ff6a4a', '#7fe3ff', '#b6ff6a'];
export function createWorldTextView(V) {
  const { S, game, world, fx, Wv } = V;
  if (!game.chapter || !game.chapter()) return null;
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  // ---------- graffiti: words split into lines, sprayed onto a ground decal ----------
  function wrap(text, n) { const out = []; let line = ''; for (const w of text.split(' ')) { if ((line + ' ' + w).trim().length > n && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); } if (line) out.push(line); return out; }
  // [polish] a short, fitted tag: lines of ~11 letters (2–3 lines), letters ~0.55 m tall, the decal sized to its words
  // (nothing clipped), sprayed: a soft overspray halo, a dark edge that reads on pale paving, a bright fill for asphalt
  const LETTER = 0.66, FPX = 72;
  function decal(g) {
    let lines = wrap(g.text, 11); if (lines.length > 3) lines = wrap(g.text, Math.ceil(g.text.length / 3) + 2);
    const col = SPRAY[hash(g.id) % SPRAY.length], font = `900 ${FPX}px "Permanent Marker", "Arial Black", Impact, sans-serif`;
    const probe = document.createElement('canvas').getContext('2d'); probe.font = font;
    const tw = Math.max(...lines.map(l => probe.measureText(l).width)), LH = FPX * 1.02, pad = 40;
    const W = Math.ceil(tw + pad * 2), H = Math.ceil(LH * lines.length + pad * 2);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    x.translate(W / 2, H / 2); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.font = font;
    lines.forEach((l, k) => { const y = (k - (lines.length - 1) / 2) * LH;
      x.save(); x.shadowColor = col; x.shadowBlur = 10; x.globalAlpha = 0.3; x.fillStyle = col; x.fillText(l, 0, y); x.restore();   // overspray
      x.lineWidth = 10; x.strokeStyle = 'rgba(12,10,14,0.9)'; x.strokeText(l, 0, y); x.fillStyle = col; x.fillText(l, 0, y);
      x.globalAlpha = 0.5; x.fillStyle = col; for (let d = 0; d < 4; d++) { const dx = ((hash(g.id + l + d) % 1000) / 1000 - 0.5) * tw * 0.9, dy = y + FPX * 0.42 + (hash(l + d) % 10); x.fillRect(dx, dy, 4, 8 + (hash(l + g.id + d) % 20)); } x.globalAlpha = 1; });   // drips
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, color: new THREE.Color(1, 1, 1) });   // on the pavement: roofs and trees cover it
    const k = LETTER / FPX, geo = new THREE.PlaneGeometry(W * k, H * k); geo.rotateX(-Math.PI / 2); geo.rotateY(-g.rot);
    const m = new THREE.Mesh(geo, mat); m.position.copy(Wv(g.x, g.y, 0.1)); m.userData.at = { x: g.x, y: g.y }; m.renderOrder = 4; world.add(m);
    return m;
  }
  const decals = new Map(); let gT = 0;
  // ---------- text sprites (radio lines, System lines): a canvas card that keeps its size on screen ----------
  function card(text, o) {
    const lines = wrap(text, o.wrap || 34), fs = 30, W = 720, H = 26 + lines.length * (fs + 8) + (o.head ? fs : 0);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    x.fillStyle = o.bg; x.beginPath(); x.roundRect(4, 4, W - 8, H - 8, 14); x.fill(); if (o.edge) { x.strokeStyle = o.edge; x.lineWidth = 3; x.stroke(); }
    x.textAlign = 'center'; x.textBaseline = 'top'; let y = 14;
    if (o.head) { x.font = `600 ${fs * 0.72}px "IBM Plex Mono", monospace`; x.fillStyle = o.headCol; x.fillText(o.head, W / 2, y); y += fs; }
    x.font = `${o.weight || 600} ${fs}px ${o.font || '"IBM Plex Mono", monospace'}`; x.fillStyle = o.col; for (const l of lines) { x.fillText(l, W / 2, y); y += fs + 8; }
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })); sp.renderOrder = 30; sp.userData.aspect = H / W; fx.add(sp);
    return sp;
  }
  const floats = [];   // { sp, x, y, life, t, follow, k }
  function float(text, x, y, o) { const sp = card(text, o); floats.push({ sp, x, y, life: o.life, t: 0, follow: o.follow, w: o.w || 9, lift: o.lift || 0 }); }
  const sysQ = []; let sysT = 0;
  const said = new Map(), recent = text => { const t0 = said.get(text); said.set(text, V.time); return t0 !== undefined && V.time - t0 < 3; };   // [polish] the same line twice within 3 s shows once
  function onEvents(events) {
    for (const e of events) {
      if (e.t === 'radio') float(e.text, e.x, e.y, { head: `(( ${e.from} ))`, headCol: '#9fdcff', col: '#f4f1e6', bg: 'rgba(14,22,30,0.82)', edge: 'rgba(127,227,255,0.55)', life: Math.min(16, 6 + e.text.length / 12), w: 19, lift: 2.2 });
      if (e.t === 'sys1') { if (recent(e.text)) continue; sysQ.push(e); if (sysQ.length > 3) sysQ.splice(0, sysQ.length - 3); }   // a burst keeps its last three
      if (e.t === 'toast' && /^\[[^\]]+\]$/.test(e.msg || '') && !recent(e.msg)) { sysQ.push({ text: e.msg, kind: e.kind === 'bad' ? 'bad' : 'sys' }); if (sysQ.length > 3) sysQ.splice(0, sysQ.length - 3); }   // [polish] a bare [System] toast is a line over Kai (ui/app.js skips its pill)
    }
  }
  function update(dt, events) {
    if (events && events.length) onEvents(events);
    // graffiti appear from their night on
    if ((gT -= dt) <= 0) { gT = 0.5; const list = game.graffiti(), want = new Set(list.map(g => g.id)); for (const g of list) if (!decals.has(g.id)) decals.set(g.id, decal(g)); for (const [id, m] of decals) if (!want.has(id)) { world.remove(m); decals.delete(id); } }
    const flat = K.T && K.T.flat ? K.T.flat.value : null;
    for (const m of decals.values()) { if (flat) m.material.color.copy(flat).multiplyScalar(1.15); m.visible = V.seenAt ? V.seenAt(m.userData.at.x, m.userData.at.y) : true; }
    // the System's lines over Kai, one at a time, a beat apart
    if ((sysT -= dt) <= 0 && sysQ.length) { const e = sysQ.shift(); sysT = 1.1; float(e.text, 0, 0, { col: e.kind === 'bad' ? '#ffb4a0' : e.kind === 'win' ? '#ffe08a' : '#bfefff', bg: 'rgba(8,20,34,0.72)', edge: 'rgba(127,227,255,0.7)', life: 3.8, follow: true, w: 18, wrap: 30, lift: 3.4 }); }   // [polish] wider (18 m): the old 12 m read ~5 px a letter on a phone
    const half = V.cam && V.cam.half ? Math.min(V.cam.half.w, V.cam.half.h) : 12, k = half / 12;
    let stack = 0, follows = 0;
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.t += dt; if (f.t > f.life) { fx.remove(f.sp); f.sp.material.map.dispose(); f.sp.material.dispose(); floats.splice(i, 1); continue; }
      const a = Math.min(1, f.t / 0.25) * Math.min(1, (f.life - f.t) / 0.6), w = f.w * k, hgt = w * f.sp.userData.aspect;
      f.sp.scale.set(w, hgt, 1); f.sp.material.opacity = a;
      const x = f.follow ? S.hero.x : f.x, y = f.follow ? S.hero.y : f.y;
      const p = Wv(x, y, 4); p.z -= (f.lift + (f.follow ? stack : 0)) * k + f.t * 0.15 * k; f.sp.position.copy(p);   // screen-up is world −z from straight above
      if (f.follow) { if (++follows > 2) f.life = Math.min(f.life, f.t + 0.3); stack += hgt * 1.05; }   // [polish] two System lines at most: they covered the Rig
    }
  }
  return { update };
}
