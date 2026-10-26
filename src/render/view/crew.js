// [polish] Chapter 1's survivors from above: a small flat figure (shoulders in their colours, a head, a dark edge) with a
// name plate, instead of a coloured token. Waiting at their place they wave inside a pulsing ring (Lotte up on the water
// tower). Once rescued they walk home to the Rig on the street grid (a path searched once on the town's walkable
// cells), bobbing, a blue escort ring under them and "→ Rig" on the plate; they do not jump. Visual only: the sim has
// them home at once. Reads the API and the map; never writes the game.
/* global THREE */
import { N, PASSABLE, idx } from '../../sim/mapgen.js';
import { lc } from './shared.js';

const LOOK = {
  lotte: { body: '#e8402a', trim: '#ffffff', hair: '#f2f2f2', name: '#ff9a3a' },   // red delivery jacket, white helmet
  benno: { body: '#8a6a48', trim: '#d8c8a8', hair: '#b8b8b8', name: '#7fc4ff' },   // cardigan, grey hair
  gus: { body: '#5f7044', trim: '#2a2a2a', hair: '#e0d6c8', name: '#b6ff6a' },     // olive coat, big headphones
};
const SPEED = 3.0, SIZE = 2.1;   // walk speed home (m/s, about Kai's), figure size (m; people are drawn big from above)

export function createCrewView(V) {
  const { game, map, world, fx, Wv } = V;
  if (!game.chapter || !game.chapter() || !game.survivors) return null;
  const C = map.town.x;
  function figTex(L, wave) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), ink = '#141016';
    x.translate(64, 64); x.scale(1.4, 1.4); x.lineWidth = 6; x.strokeStyle = ink; x.lineJoin = 'round';
    // arms (one up when waving)
    x.fillStyle = L.body; for (const s of [-1, 1]) { x.save(); x.translate(s * 30, wave && s > 0 ? -18 : 6); x.rotate(wave && s > 0 ? -0.5 : 0); x.beginPath(); x.ellipse(0, 0, 9, 18, 0, 0, Math.PI * 2); x.stroke(); x.fill(); x.restore(); }
    // shoulders
    x.beginPath(); x.ellipse(0, 6, 32, 20, 0, 0, Math.PI * 2); x.stroke(); x.fill();
    x.fillStyle = L.trim; x.fillRect(-4, -8, 8, 30);
    // head
    x.beginPath(); x.arc(0, -4, 17, 0, Math.PI * 2); x.fillStyle = '#f0c8a0'; x.stroke(); x.fill();
    x.beginPath(); x.arc(0, -8, 15, Math.PI, Math.PI * 2.0); x.fillStyle = L.hair; x.fill();
    if (L === LOOK.gus) { x.fillStyle = L.trim; x.fillRect(-21, -10, 8, 14); x.fillRect(13, -10, 8, 14); }   // headphones
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
  }
  function plate(text, col) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 72; const x = c.getContext('2d');
    x.fillStyle = 'rgba(12,12,16,0.82)'; x.beginPath(); x.roundRect(2, 2, 316, 68, 14); x.fill(); x.strokeStyle = col; x.lineWidth = 3; x.stroke();
    x.font = '700 34px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(text, 160, 38);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.renderOrder = 25; fx.add(sp); return sp;
  }
  const flat = g => { g.rotateX(-Math.PI / 2); return g; };
  const basic = (col, o) => new THREE.MeshBasicMaterial({ color: lc(col), transparent: true, depthWrite: false, depthTest: false, ...o });
  const folk = new Map();
  function make(s) {
    const L = LOOK[s.id] || LOOK.benno, name = s.name.split(' ')[0].replace(/"/g, '');
    const texIdle = figTex(L, false), texWave = figTex(L, true);
    const fig = new THREE.Mesh(flat(new THREE.PlaneGeometry(SIZE, SIZE)), new THREE.MeshBasicMaterial({ map: texIdle, transparent: true, depthWrite: false, depthTest: false }));
    fig.renderOrder = 13; world.add(fig);
    const help = new THREE.Mesh(flat(new THREE.RingGeometry(1.4, 1.7, 28)), basic(L.name, { opacity: 0.6 })); help.renderOrder = 11; world.add(help);
    const esc = new THREE.Mesh(flat(new THREE.RingGeometry(1.1, 1.35, 24)), basic('#1F5BFF', { opacity: 0.85 })); esc.renderOrder = 12; world.add(esc);
    const o = { fig, help, esc, texIdle, texWave, name, col: L.name, tag: plate(name, L.name), tagWalk: plate(name + ' → Rig', L.name), state: s.state, x: s.x, y: s.y, path: null, k: 0, face: 0, walked: 0 };
    folk.set(s.id, o); return o;
  }
  const walk = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); if (cx < 0 || cy < 0 || cx >= N || cy >= N) return false; const i = idx(cx, cy); return PASSABLE[map.terrain[i]] && map.reach[i]; };
  /** a street path from (x0, y0) to near the Rig: a breadth-first search on walkable cells, thinned to waypoints */
  function pathHome(x0, y0, hx, hy) {
    const s = idx(Math.floor(x0), Math.floor(y0)), prev = new Int32Array(N * N).fill(-2), q = new Int32Array(N * N); let h = 0, t = 0, goal = -1;
    prev[s] = -1; q[t++] = s;
    while (h < t) { const i = q[h++], x = i % N, y = (i / N) | 0; if (Math.hypot(x + 0.5 - C, y + 0.5 - C) < 7) { goal = i; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const j = idx(xx, yy); if (prev[j] !== -2 || !walk(xx + 0.5, yy + 0.5)) continue; prev[j] = i; q[t++] = j; } }
    const pts = []; if (goal >= 0) { for (let i = goal; i >= 0; i = prev[i]) pts.push({ x: i % N + 0.5, y: ((i / N) | 0) + 0.5 }); pts.reverse(); }
    const way = pts.filter((_, k) => k % 3 === 0); way.push({ x: hx, y: hy }); return way;
  }
  function update(dt) {
    const time = V.time, k = V.cam && V.cam.half ? Math.min(V.cam.half.w, V.cam.half.h) / 12 : 1;
    for (const s of game.survivors()) {
      if (s.x === undefined) continue; const o = folk.get(s.id) || make(s);
      if (o.state === 'away' && s.state !== 'away') { o.path = pathHome(o.x, o.y, s.x, s.y); o.k = 0; o.walked = 0; o.up = false; }   // rescued: walk home
      o.state = s.state;
      if (o.path) {
        o.tx = s.x; o.ty = s.y; o.path[o.path.length - 1] = { x: s.x, y: s.y };
        let step = SPEED * dt; while (step > 0 && o.k < o.path.length) { const p = o.path[o.k], dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy); if (d <= step) { o.x = p.x; o.y = p.y; o.k++; step -= d; } else { o.x += dx / d * step; o.y += dy / d * step; o.face = Math.atan2(dx, dy); step = 0; } }
        o.walked += dt; if (o.k >= o.path.length) o.path = null;
      } else if (s.state === 'away') { o.x = s.x; o.y = s.y; o.up = !!s.up; }
      else { o.x = s.x; o.y = s.y; }
      const walking = !!o.path, bob = walking ? Math.abs(Math.sin(time * 9)) * 0.08 : 0, p = Wv(o.x, o.y, o.up ? 4 : 0.25);
      o.fig.position.copy(p); o.fig.rotation.y = walking ? o.face + Math.PI : 0; o.fig.scale.setScalar(1 + bob);
      o.fig.material.map = s.state === 'away' && Math.floor(time * 2) % 2 ? o.texWave : o.texIdle;
      o.help.position.copy(p); o.help.visible = s.state === 'away'; o.help.scale.setScalar(1 + 0.15 * Math.sin(time * 3));
      o.esc.position.copy(p); o.esc.visible = walking; o.esc.scale.setScalar(1 + 0.1 * Math.sin(time * 6));
      const seen = V.seenAt(o.x, o.y), tp = Wv(o.x, o.y, 4.2); tp.z += 1.7 * k;   // under the figure: the System's lines stack above
      o.tag.visible = seen && !walking; o.tagWalk.visible = seen && walking;
      for (const tg of [o.tag, o.tagWalk]) { tg.position.copy(tp); tg.scale.set((tg === o.tag ? 5.4 : 8.4) * k, 1.22 * k, 1); }
      o.fig.visible = seen;
    }
  }
  return { update };
}
