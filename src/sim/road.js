// The road: four stations with fires you can light (outposts), convoys of rescued people who walk home behind
// you while the dead hunt them, ambushes on a long trip, and trip planning ("round trip 2:10 · dusk in 1:40").
// Deterministic: no Math.random, its own RNG. Created inside createGame (see the `// [road]` hook blocks in game.js),
// it reaches the game's internals only through `ctx`.
import { N, T, PASSABLE, idx, inside } from './mapgen.js';
import { MOBS, BRAIN, TIDE } from '../content/mobs.js';
import { STATIONS, ROAD, CONVOY, AMBUSH, STATION_SCENES } from '../content/road.js';
import { createMissions } from './missions.js';

const BIG = 1.6;
const DIRS8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0]; this.top = k[0]; const lk = k.pop(), lv = v.pop(), n = k.length;
    if (n) {
      let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = -1, mk = lk; if (l < n && k[l] < mk) { m = l; mk = k[l]; } if (r < n && k[r] < mk) { m = r; mk = k[r]; } if (m < 0) break; k[i] = k[m]; v[i] = v[m]; i = m; }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}
export const fmtTime = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** where the stations stand on this map (deterministic from the map); clears their glades out of the trees */
export function placeStations(map) {
  const c = map.town.x, a = map.feature.angle, ux = Math.cos(a), uy = Math.sin(a), pts = map.feature.road;
  const nests = map.regions.filter(r => r.nest).map(r => r.nest);
  const along = p => (p[0] - c) * ux + (p[1] - c) * uy;
  const okCell = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); if (!inside(cx, cy)) return false; const i = idx(cx, cy), t = map.terrain[i]; return (t === T.GRASS || t === T.FOREST || t === T.DIRT) && map.lm[i] < 0 && !map.road[i]; };
  const out = [];
  for (const def of STATIONS) {
    const order = pts.map((p, k) => [Math.abs(along(p) - def.at), k]).sort((p, q) => p[0] - q[0]).slice(0, 7).map(q => q[1]);
    let best = null;
    for (const k of order) {
      const p = pts[k], p0 = pts[Math.max(0, k - 1)], p1 = pts[Math.min(pts.length - 1, k + 1)];
      let tx = p1[0] - p0[0], ty = p1[1] - p0[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      for (const side of [1, -1]) {
        const nx = -ty * side, ny = tx * side, x = p[0] + nx * ROAD.side, y = p[1] + ny * ROAD.side;
        if (!okCell(x, y) || nests.some(n => Math.hypot(n.x - x, n.y - y) < 9) || map.landmarks.some(l => Math.hypot(l.x - x, l.y - y) < l.size / 2 + ROAD.clear + 1.5)) continue;
        let score = Math.abs(along(p) - def.at); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!okCell(x + dx, y + dy) && !(inside(Math.floor(x + dx), Math.floor(y + dy)) && map.road[idx(Math.floor(x + dx), Math.floor(y + dy))])) score += 1.5;
        if (!best || score < best.score) best = { score, x, y, nx, ny, tx, ty, rx: p[0], ry: p[1] };
      }
      if (best && best.score < 2) break;
    }
    if (!best) continue;
    const fx = Math.floor(best.x) + 0.5, fy = Math.floor(best.y) + 0.5;
    // the glade: trees cleared round the fire, joined to the road
    const cells = [];
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = Math.floor(fx) + dx, y = Math.floor(fy) + dy; if (!inside(x, y) || Math.hypot(x + 0.5 - fx, y + 0.5 - fy) > ROAD.clear) continue;
      const i = idx(x, y); if (map.lm[i] >= 0) continue;
      if (map.terrain[i] === T.FOREST) map.terrain[i] = T.GRASS;
      if (PASSABLE[map.terrain[i]]) cells.push(i);
    }
    for (let k = 0; k <= Math.ceil(ROAD.side); k++) { const x = Math.floor(best.rx + best.nx * k), y = Math.floor(best.ry + best.ny * k); if (inside(x, y) && map.terrain[idx(x, y)] === T.FOREST) map.terrain[idx(x, y)] = T.GRASS; if (inside(x, y) && PASSABLE[map.terrain[idx(x, y)]]) cells.push(idx(x, y)); }
    for (let pass = 0; pass < 6; pass++) for (const i of cells) if (!map.reach[i]) { const x = i % N, y = (i / N) | 0; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) && map.reach[idx(x + dx, y + dy)])) map.reach[i] = 1; }
    // two pads for forward towers, either side of the fire along the road; the prop sits behind the fire
    const pads = [-1, 1].map(s => ({ x: Math.floor(fx + best.tx * 2.4 * s + best.nx * 0.6) + 0.5, y: Math.floor(fy + best.ty * 2.4 * s + best.ny * 0.6) + 0.5 }));
    out.push({ id: def.id, kind: def.kind, name: def.name, blurb: def.blurb, at: def.at, x: fx, y: fy, region: map.region[idx(Math.floor(fx), Math.floor(fy))],
      prop: { x: fx + best.nx * 2.1, y: fy + best.ny * 2.1, face: Math.atan2(best.tx, best.ty) }, normal: { x: best.nx, y: best.ny }, pads, road: { x: best.rx, y: best.ry } });
  }
  return out;
}

export function createRoad(ctx) {
  const { S, map, ev, toast, rng } = ctx, c = map.town.x;
  const stations = placeStations(map);
  for (const st of stations) Object.assign(st, { lit: false, fell: false, met: false, hp: 0, maxHp: ROAD.hp(1), prog: 0, towers: [], litN: 0 });
  const R = S.road = { stations, convoys: [], outT: 0, ambushCd: AMBUSH.every * 0.5, ambushes: [], trail: [], nextId: 1, lastSurv: S.survivors, lastDawns: S.dawns, evAt: 0, phase: S.phase, lit: 0, rescued: 0, lost: 0, home: 0 };
  let api = null;
  const missions = createMissions(ctx, () => road);
  const hero = () => S.hero;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const night = () => S.phase === 'night';
  const ringOf = st => (st.lit ? ROAD.ringMin + (ROAD.ring - ROAD.ringMin) * Math.max(0, st.hp) / st.maxHp : 0);
  const litStations = () => stations.filter(s => s.lit);
  const onRoad = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); return inside(cx, cy) && map.road[idx(cx, cy)] === 1; };
  const walk = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); if (!inside(cx, cy)) return false; const i = idx(cx, cy); return PASSABLE[map.terrain[i]] && (S.occ[i] < 0 || ctx.isWall(S.occ[i])); };
  const members = () => { const out = []; for (const cv of R.convoys) for (const m of cv.members) out.push(m); return out; };
  const memberById = id => { for (const cv of R.convoys) for (const m of cv.members) if (m.id === id) return m; return null; };
  const inLitRing = (x, y, pad = 0) => stations.find(st => st.lit && Math.hypot(st.x - x, st.y - y) < ringOf(st) + pad) || null;
  /** every change to S.survivors made here goes through this, so the convoy watcher never reads our own changes */
  const addPeople = n => { S.survivors += n; R.lastSurv = S.survivors; };

  // ---------- stations ----------
  function lightCost() { return ROAD.lightCost; }
  function light(st, free = false) {
    if (!free) { if (S.gold < lightCost()) { ctx.fail(`Lighting the fire takes ${lightCost()} scrap of fuel.`); st.prog = 0; return false; } S.gold -= lightCost(); S.stats.goldSpent += lightCost(); }
    st.lit = true; st.fell = false; st.maxHp = ROAD.hp(S.night); st.hp = st.maxHp; st.prog = 0; st.litN++; R.lit++;
    ctx.reveal(st.x, st.y, ROAD.revealR); ctx.gainXp(st.litN === 1 ? 10 : 3);
    ev('outpost', { id: st.id, x: st.x, y: st.y });
    toast(`[Outpost: ${st.name}] The fire takes. **The dead keep out of its light**, you can rest here, and it holds **${ROAD.towers} towers**. At night the dead come for it.`, 'sys');
    const story = ctx.story(); if (story && st.litN === 1) story.chron(`Lit the fire at ${st.name}.`, 3, ['road', st.id]);
    return true;
  }
  function fall(st) {
    st.lit = false; st.fell = true; st.hp = 0; st.prog = 0;
    for (const m of S.mobs) if (m.siege === st.id) m.siege = null;
    ev('outpostLost', { id: st.id, x: st.x, y: st.y });
    toast(`[Outpost lost: ${st.name}] The fire went out. Relight it by day.`, 'bad');
    const story = ctx.story(); if (story) story.chron(`The fire at ${st.name} went out.`, 2, ['road', st.id]);
  }
  /** a forward tower on one of the outpost's two pads */
  function buildTower(id) {
    const st = stations.find(s => s.id === id); if (!st) return false;
    if (!st.lit) return ctx.fail('Light the fire first: an outpost takes towers.');
    st.towers = st.towers.filter(t => S.byId.get(t));
    if (st.towers.length >= ROAD.towers) return ctx.fail(`${st.name} holds ${ROAD.towers} towers.`);
    const pad = st.pads.find(p => { const i = idx(Math.floor(p.x), Math.floor(p.y)); return S.occ[i] < 0 && PASSABLE[map.terrain[i]]; });
    if (!pad) return ctx.fail('No room for a tower here.');
    const cost = api ? api.buyCost('tower') : 10;
    if ((S.stock.tower || 0) > 0) S.stock.tower--; else { if (S.gold < cost) return ctx.fail(`A tower costs ${cost} scrap.`); S.gold -= cost; S.stats.goldSpent += cost; S.cur.spent += cost; }
    { const i = idx(Math.floor(pad.x), Math.floor(pad.y)); if (map.terrain[i] === T.FOREST) map.terrain[i] = T.GRASS; }
    const b = ctx.placeBuilding('tower', pad.x, pad.y, 0, 1); b.outpost = st.id; st.towers.push(b.id);
    S.cur.built.push('tower'); S.stats.built++;
    toast(`[Outpost tower] A tower stands at ${st.name}. It needs a crew of 1 from your people.`, 'good');
    return true;
  }
  /** the forward zone round an outpost takes towers and barricades only, two towers at most */
  function placeRule(type, x, y) {
    if (Math.hypot(x - c, y - c) < 40) return null;
    const st = stations.find(s => Math.hypot(s.x - x, s.y - y) < 12); if (!st) return null;
    if (type !== 'tower' && type !== 'wall') return 'An outpost takes towers and barricades only.';
    if (type === 'tower' && !st.lit) return 'Light the fire first.';
    if (type === 'tower' && S.buildings.filter(b => b.type === 'tower' && !b.ruined && Math.hypot(b.x - st.x, b.y - st.y) < 12).length >= ROAD.towers) return `${st.name} holds ${ROAD.towers} towers.`;
    return null;
  }
  function stationScene(st) {
    const sc = STATION_SCENES[st.id]; if (!sc) return;
    const ST = S.story; if (!ST) return;
    const enc = { kind: 'street', road: st.id, eyebrow: sc.eyebrow, title: sc.title, scene: sc.scene, choices: sc.choices.map(ch => ({ id: ch.id, label: ch.label, hint: ch.hint, fx: ch.fx.map(f => ({ ...f })) })) };
    enc.id = ST.nextId++; enc.ai = null; ST.encounters.push(enc); ev('encounter', { id: enc.id, kind: enc.kind });
  }
  function onChoice(enc, choiceId) {
    const st = stations.find(s => s.id === enc.road), sc = STATION_SCENES[enc.road]; if (!st || !sc) return;
    const ch = sc.choices.find(x => x.id === choiceId); if (!ch || !ch.road) { syncPeople(); return; }
    if (ch.road.cart) R.cart = { ...ch.road.cart };
    if (ch.road.light && !st.lit) light(st, true);
    syncPeople();
  }
  function stepStations(dt) {
    const h = hero();
    for (const st of stations) {
      const d = h.dead ? Infinity : dist(h, st);
      if (!st.met && d < 5 && S.phase === 'day' && !S.over) { st.met = true; stationScene(st); }
      if (!st.lit) { if (d < ROAD.reach && !h.moving) { const was = st.prog; st.prog += dt; if (was === 0) ev('kindle', { id: st.id }); if (st.prog >= ROAD.lightTime) light(st); } else st.prog = Math.max(0, st.prog - dt * 2); continue; }
      const r = ringOf(st);
      if (d < r) { if (h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + ROAD.rest * dt); }
      for (const m of members()) if (Math.hypot(m.x - st.x, m.y - st.y) < r) m.hp = Math.min(m.maxHp, m.hp + ROAD.restPeople * dt);
      if (st.hp <= 0) fall(st);
    }
  }

  // ---------- convoys ----------
  function makeConvoy(n, why) {
    const h = hero(), cart = R.cart; R.cart = null;
    const cv = { id: R.nextId++, members: [], why: why || '', size: n, lost: 0, turnedToast: false, cart: !!cart };
    for (let k = 0; k < n + (cart ? 1 : 0); k++) {
      const isCart = cart && k === n;
      let x = h.x, y = h.y;
      for (let t = 0; t < 12; t++) { const a = rng.range(0, Math.PI * 2), r = rng.range(0.6, 1.8), xx = h.x + Math.cos(a) * r, yy = h.y + Math.sin(a) * r; if (walk(xx, yy)) { x = xx; y = yy; break; } }
      cv.members.push({ id: R.nextId++, cv: cv.id, name: isCart ? 'the cart' : CONVOY.names[rng.int(CONVOY.names.length)], cart: isCart ? { scrap: cart.scrap || 0, food: cart.food || 0 } : null, x, y, face: 0, hp: isCart ? CONVOY.cartHp : CONVOY.hp, maxHp: isCart ? CONVOY.cartHp : CONVOY.hp, ti: R.trail.length - 1, state: 'follow', moving: false, hurtT: 0 });
    }
    if (!R.trail.length) R.trail.push({ x: h.x, y: h.y });
    for (const m of cv.members) m.ti = R.trail.length - 1;
    R.convoys.push(cv); R.rescued += n;
    ev('convoy', { id: cv.id, n, x: h.x, y: h.y });
    toast(`[Convoy: ${n} ${n === 1 ? 'person' : 'people'}${cart ? ' and a cart' : ''}] They walk home behind you, **slower than the dead**. Keep them alive: they count once they reach the camp.`, 'sys');
    return cv;
  }
  /** people the story or a site gave you while you are far from the camp walk home with you instead of appearing there */
  function syncPeople() {
    const h = hero();
    if (S.dawns !== R.lastDawns) { R.lastDawns = S.dawns; R.lastSurv = S.survivors; return; }
    const delta = S.survivors - R.lastSurv;
    if (delta > 0 && !h.dead && !S.autopilot && Math.hypot(h.x - c, h.y - c) > ROAD.out && delta >= CONVOY.min - (R.cart ? 1 : 0)) { S.survivors -= delta; makeConvoy(delta); }
    else if (delta > 0 && R.cart) { const cart = R.cart; R.cart = null; if (cart.scrap) ctx.earn(cart.scrap); if (cart.food) S.food += cart.food; }
    R.lastSurv = S.survivors;
  }
  function stepTrail() {
    const h = hero(), tr = R.trail;
    if (!R.convoys.length) { if (tr.length) tr.length = 0; return; }
    if (h.dead) return;
    const last = tr[tr.length - 1];
    if (!last || Math.hypot(h.x - last.x, h.y - last.y) > 0.35) { tr.push({ x: h.x, y: h.y }); if (tr.length > 700) { const cut = tr.length - 700; tr.splice(0, cut); for (const m of members()) m.ti = Math.max(0, m.ti - cut); } }
  }
  /** Go with a convoy is an escort: the hero's auto-walk waits for the rear of the column (the stick always takes over) */
  function stepEscort() {
    const h = hero();
    if (h.input.x || h.input.y || h.dead || !R.convoys.length) { h.held = null; h.defend = null; return; }
    const mem = members().filter(m => m.state === 'follow'); if (!mem.length) return;
    // escorting: turn on whatever is biting your people, then pick the walk up again
    if (h.tripTo && (h.target || h.held)) {
      let foe = null, fd = 11;
      for (const z of S.mobs) if (z.cv && z.rise >= 1) { const d = Math.hypot(z.x - h.x, z.y - h.y); if (d < fd) { fd = d; foe = z; } }
      if (foe) { if (!h.held) h.held = { target: h.target, path: h.path }; h.defend = foe.id; h.target = { x: foe.x, y: foe.y }; h.path = null; return; }
      if (h.defend) { h.defend = null; h.target = null; h.path = null; }
    }
    const rear = Math.max(...mem.map(m => Math.hypot(m.x - h.x, m.y - h.y))), col = CONVOY.gap * Math.min(mem.length, 8);
    if (h.target && h.tripTo && rear > col + 5) { h.held = { target: h.target, path: h.path }; h.target = null; h.path = null; ev('escortWait', {}); }
    else if (h.held && !h.target && rear < col + 2) { h.target = h.held.target; h.path = h.held.path; h.held = null; }
  }
  function stepConvoys(dt) {
    const h = hero(), tr = R.trail;
    for (const cv of [...R.convoys]) {
      cv.members.forEach((m, k) => {
        m.hurtT = Math.max(0, m.hurtT - dt); m.moving = false;
        const hd = h.dead ? Infinity : Math.hypot(h.x - m.x, h.y - m.y);
        const ring = inLitRing(m.x, m.y);
        // they hold where they are when you fall, and shelter at a lit outpost when you go on without them
        if (m.state === 'follow' && (h.dead || cv.hold || (ring && night() && hd > 11))) { m.state = 'wait'; ev('convoyWait', { id: m.id }); }
        if (m.state === 'wait') { if (!h.dead && !cv.hold && hd < 6) { m.state = 'follow'; m.ti = Math.max(0, tr.length - 1); } else return; }
        // walk the hero's own trail, keeping a place in the column
        const slot = Math.max(0, tr.length - 1 - Math.round((CONVOY.gap * (k + 1) + 0.6) / 0.35));
        if (m.ti > slot && hd < CONVOY.gap * (k + 1) + 0.8) return;
        const w = tr[Math.min(m.ti, tr.length - 1)]; if (!w) return;
        const sp = (m.cart ? CONVOY.cartSpeed : CONVOY.speed) * (onRoad(m.x, m.y) ? CONVOY.road : 1) * (map.terrain[idx(Math.floor(m.x), Math.floor(m.y))] === T.FOREST ? 0.85 : 1) * dt;
        const dx = w.x - m.x, dy = w.y - m.y, d = Math.hypot(dx, dy);
        if (d < 0.3) { if (m.ti < tr.length - 1 && m.ti < slot) m.ti++; return; }
        const nx = m.x + dx / d * Math.min(sp, d), ny = m.y + dy / d * Math.min(sp, d);
        if (walk(nx, ny)) { m.x = nx; m.y = ny; } else if (walk(nx, m.y)) m.x = nx; else if (walk(m.x, ny)) m.y = ny; else m.ti = Math.min(tr.length - 1, m.ti + 1);
        m.face = Math.atan2(dx, dy); m.moving = true;
      });
      // home: inside the camp
      for (const m of [...cv.members]) if (Math.hypot(m.x - c, m.y - c) < CONVOY.home) arrive(cv, m);
      if (!cv.members.length) finish(cv);
    }
  }
  function arrive(cv, m) {
    cv.members.splice(cv.members.indexOf(m), 1); cv.home = (cv.home || 0) + (m.cart ? 0 : 1);
    if (m.cart) { if (m.cart.scrap) ctx.earn(m.cart.scrap); if (m.cart.food) S.food += m.cart.food; cv.cartIn = m.cart; }
    else { addPeople(1); R.home++; }
    for (const z of S.mobs) if (z.cv === m.id) z.cv = null;
    ev('convoyHome', { id: m.id, x: m.x, y: m.y, cart: !!m.cart });
  }
  function finish(cv) {
    R.convoys.splice(R.convoys.indexOf(cv), 1);
    const home = cv.home || 0, ci = cv.cartIn;
    if (home || ci) {
      const bits = [home ? `+${home} ${home === 1 ? 'person' : 'people'}` : '', ci && ci.scrap ? `+${ci.scrap} scrap` : '', ci && ci.food ? `+${ci.food} food` : ''].filter(Boolean).join(', ');
      toast(`[Convoy home] ${home} of ${cv.size} made it${cv.lost ? `; ${cv.lost} did not` : ''}. ${bits}.`, home === cv.size ? 'win' : 'good');
      const story = ctx.story(); if (story) story.chron(`Brought ${home} of ${cv.size} survivors home down the road${cv.lost ? `; ${cv.lost} were lost` : ''}.`, cv.lost ? 3 : 2, ['road']);
      ctx.gainXp(4 * home);
    } else toast(`[Convoy lost] None of the ${cv.size} reached the camp.`, 'bad');
    ev('convoyDone', { id: cv.id, home, lost: cv.lost });
  }
  function hurtMember(m, d, by) {
    if (m.hp <= 0) return;
    m.hp -= d; m.hurtT = 0.3; ev('convoyHit', { id: m.id });
    if (m.hp > 0) return;
    const cv = R.convoys.find(q => q.id === m.cv); if (!cv) return;
    cv.members.splice(cv.members.indexOf(m), 1); R.lost++;
    for (const z of S.mobs) if (z.cv === m.id) z.cv = null;
    if (m.cart) { ev('cartLost', { id: m.id, x: m.x, y: m.y }); toast('[Convoy] The cart is overturned. Its load is gone.', 'bad'); }
    else {
      cv.lost++;
      const z = ctx.spawnMob('risen', m.x, m.y, { instant: false }); z.rise = 0.4; z.stream = -1;
      ev('convoyTurned', { id: m.id, x: m.x, y: m.y, name: m.name });
      if (!cv.turnedToast) { cv.turnedToast = true; toast(`[Convoy] ${m.name} is caught. **A family rises with the dead.**`, 'bad'); }
      else toast(`[Convoy] ${m.name} is gone.`, 'bad');
    }
    if (!cv.members.length) finish(cv);
  }

  // ---------- road danger: the clever dead wait on your road home ----------
  const axis = { x: Math.cos(map.feature.angle), y: Math.sin(map.feature.angle) };
  const along = (x, y) => (x - c) * axis.x + (y - c) * axis.y;
  function nearestRoadPt(x, y) { let best = null, bd = Infinity; for (const p of map.feature.road) { const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = p; } } return { p: best, d: bd }; }
  function stepAmbush(dt) {
    const h = hero(), out = !h.dead && Math.hypot(h.x - c, h.y - c) > ROAD.out;
    R.outT = out ? R.outT + dt : 0; R.ambushCd -= dt;
    for (const a of [...R.ambushes]) { a.t -= dt; if (a.t <= 0 || !S.mobs.some(m => m.roadAmbush && m.roadAmbush.id === a.id)) R.ambushes.splice(R.ambushes.indexOf(a), 1); }
    if (!out || R.outT < AMBUSH.after || R.ambushCd > 0 || S.night < AMBUSH.minNight || S.over || R.ambushes.length || !h.moving || inLitRing(h.x, h.y, 3)) return;
    const near = nearestRoadPt(h.x, h.y); if (near.d > 8) return;
    // a spot on the road between you and the camp, out of sight
    const s0 = along(h.x, h.y), want = s0 - AMBUSH.ahead; let spot = null;
    if (want > 42) { let bd = Infinity; for (const p of map.feature.road) { const e = Math.abs(along(p[0], p[1]) - want); if (e < bd && walk(p[0], p[1])) { bd = e; spot = { x: p[0], y: p[1] }; } } }
    if (!spot) { const L = Math.hypot(h.x - c, h.y - c), k = AMBUSH.ahead / L; const x = h.x + (c - h.x) * k, y = h.y + (c - h.y) * k; if (walk(x, y)) spot = { x, y }; }
    if (!spot || Math.hypot(spot.x - h.x, spot.y - h.y) < 13 || inLitRing(spot.x, spot.y, 2) || Math.hypot(spot.x - c, spot.y - c) < ROAD.out) { R.ambushCd = 8; return; }
    R.ambushCd = AMBUSH.every;
    const n = S.night, list = [n >= 3 ? 'brute' : 'runner', 'runner', ...(n >= 5 ? ['runner'] : []), ...(n >= 8 ? ['brute'] : [])];
    const a = { id: R.nextId++, x: spot.x, y: spot.y, t: AMBUSH.wait, n: list.length };
    for (const kind of list) {
      let x = spot.x, y = spot.y; for (let t = 0; t < 10; t++) { const xx = spot.x + rng.range(-1.6, 1.6), yy = spot.y + rng.range(-1.6, 1.6); if (walk(xx, yy)) { x = xx; y = yy; break; } }
      const m = ctx.spawnMob(kind, x, y, { instant: true });
      if (kind === 'brute' && n < 7) { m.hp = m.maxHp = Math.ceil(m.maxHp * 0.6); }
      m.roadAmbush = { id: a.id, x, y }; m.ambush = false; m.stream = -1;
    }
    R.ambushes.push(a); ctx.reveal(spot.x, spot.y, 2);
    ev('roadAmbush', { id: a.id, x: spot.x, y: spot.y, n: list.length });
    toast(`${AMBUSH.warn} Something is **waiting on the road home**, to the ${ctx.compass(spot.x, spot.y)}. ${list.includes('brute') ? 'A big one, with company.' : 'A pack of runners.'}`, 'sys');
  }

  // ---------- the brain, extended: the dead go for the nearest of you and the convoy; they gnaw at lit fires ----------
  let cvHunters = 0;
  const chaseK = m => (TIDE.roam.chase[m.kind] || 1.2);
  function bite(m, D, hitFn) { m.attacking = true; if (m.cd <= 0) { m.cd = 1; hitFn(D.dmg * (m.dmgK || 1)); ev('bite', { id: m.id }); } }
  function repel(m, D) {
    if (D.size >= BIG || m.rise < 1) return;
    for (const st of stations) {
      if (!st.lit) continue;
      const r = ringOf(st), dx = m.x - st.x, dy = m.y - st.y, d = Math.hypot(dx, dy);
      if (d >= r || d < 1e-4) continue;
      const nx = st.x + dx / d * r, ny = st.y + dy / d * r;
      if (ctx.standable(m, nx, ny)) { m.x = nx; m.y = ny; }
    }
  }
  /** called for every awake mob before its own brain; returns true when the road moved it this step */
  function drive(m, dt, speed) {
    const D = MOBS[m.kind];
    if (D.animal) return false;
    if (R.convoys.length || R.lit) repel(m, D);
    if (m.lure || m.smoke > 0) { if (m.cv) m.cv = null; return false; }
    const h = hero(), hd = h.dead ? Infinity : Math.hypot(h.x - m.x, h.y - m.y), road = onRoad(m.x, m.y) ? 1.4 : 1;
    // 1. waiting on the road home
    if (m.roadAmbush) {
      const sense = BRAIN.sense[ctx.rankOf(m)] * ctx.senseMult(m);
      const prey = members().find(q => Math.hypot(q.x - m.x, q.y - m.y) < 5);
      if (hd < sense || hd < 5 || prey) { const a = m.roadAmbush; m.roadAmbush = null; for (const o of S.mobs) if (o.roadAmbush && o.roadAmbush.id === a.id) { o.roadAmbush = null; if (!prey) o.hunt = true; else o.cv = prey.id; } if (prey) m.cv = prey.id; else m.hunt = true; ev('ambushSprung', { id: a.id, x: m.x, y: m.y }); return false; }
      const a = R.ambushes.find(q => q.id === m.roadAmbush.id);
      if (!a) { m.roadAmbush = null; m.roam = { x: m.x, y: m.y, region: -1 }; m.lost = true; return false; }
      if (Math.hypot(m.roadAmbush.x - m.x, m.roadAmbush.y - m.y) > 0.4) ctx.moveToward(m, m.roadAmbush.x, m.roadAmbush.y, speed * dt);
      else m.face = Math.atan2(h.x - m.x, h.y - m.y);
      return true;
    }
    // 2. the horn: they come for you (missions.js)
    if (m.piped) return missions.drivePiped(m, D, dt, speed, hd, road);
    // 3. the convoy: nearest of you and them
    if (R.convoys.length && !m.warden) {
      let tgt = m.cv ? memberById(m.cv) : null;
      const sense = BRAIN.sense[ctx.rankOf(m)] * CONVOY.sense * (night() ? 1.15 : 1);
      if (tgt && (Math.hypot(tgt.x - m.x, tgt.y - m.y) > Math.max(5, sense * BRAIN.forget[ctx.rankOf(m)]) || (inLitRing(tgt.x, tgt.y) && D.size < BIG && Math.hypot(tgt.x - m.x, tgt.y - m.y) > 3))) { m.cv = null; tgt = null; }
      if (!tgt) {
        let best = null, bd = sense;
        for (const q of members()) { const d = Math.hypot(q.x - m.x, q.y - m.y); if (d < bd && !(inLitRing(q.x, q.y) && D.size < BIG)) { bd = d; best = q; } }
        if (best && (bd < hd || !m.hunt) && (cvHunters < CONVOY.cap(S.night) || m.hunt)) { tgt = best; m.cv = best.id; if (m.hunt) m.hunt = false; cvHunters++; ev('convoyAggro', { id: m.id, member: best.id }); }
      }
      if (tgt) {
        const d = Math.hypot(tgt.x - m.x, tgt.y - m.y);
        if (m.hunt && hd < d) { m.cv = null; return false; }   // you are nearer: you again
        m.face = Math.atan2(tgt.x - m.x, tgt.y - m.y);
        if (D.burst && d < 1) { blast(m, D); return true; }
        if (d > 0.8) ctx.moveToward(m, tgt.x, tgt.y, speed * chaseK(m) * road * dt);
        else bite(m, D, n => hurtMember(tgt, n, m));
        return true;
      }
    }
    // 4. the night's dead gnaw at a lit fire on their way
    if (night() && R.lit && !m.roam && !m.hunt) {
      let st = m.siege ? stations.find(s => s.id === m.siege && s.lit) : null;
      if (!st && m.siege !== false) {
        const near = stations.find(s => s.lit && Math.hypot(s.x - m.x, s.y - m.y) < ROAD.siegeR);
        if (near) { m.siege = ((m.id * 2654435761) >>> 0) % 100 < ROAD.siegeShare * 100 ? near.id : false; if (m.siege) st = near; }
      }
      if (st) {
        const d = Math.hypot(st.x - m.x, st.y - m.y), r = ringOf(st), big = D.size >= BIG;
        m.face = Math.atan2(st.x - m.x, st.y - m.y);
        if (big ? d > 1.1 : d > r + 0.35) { ctx.moveToward(m, st.x, st.y, speed * dt); return true; }
        if (D.burst) { blast(m, D); st.hp -= 10; ev('fireHit', { id: st.id }); return true; }
        bite(m, D, n => { st.hp -= n * (big ? ROAD.bigK : 1); ev('fireHit', { id: st.id }); if (st.hp <= 0) fall(st); });
        return true;
      }
    }
    // 5. the old road is quick for the dead too, when they have your scent
    if ((m.hunt || (m.roam && m.hunt)) && road > 1 && hd > 1.2 && !m.lure) ctx.moveToward(m, h.x, h.y, speed * chaseK(m) * (road - 1) * dt);
    return false;
  }
  /** a bloater bursts against the convoy or a fire */
  function blast(m, D) {
    const r = D.burst.radius;
    for (const q of members()) if (Math.hypot(q.x - m.x, q.y - m.y) < r) hurtMember(q, D.burst.dmg * 0.8, m);
    m.hp = 0; ctx.killMob(m, 'fire');
  }
  /** how the dead perceive the hero's distance (the lantern) */
  const perceive = (m, hd) => missions.perceive(m, hd);
  const unseen = (hd, sight) => missions.unseen(hd, sight);
  const preferHive = (best, reach) => missions.preferHive(best, reach);

  // ---------- trip planning ----------
  /** fastest walk from the hero to (x, y): the old road is quick, the woods slow. Returns seconds and the path. */
  let PC = null, PP = null, PG = null, gen = 0;
  function plan(x, y, from) {
    const h = from || hero(), sp = ctx.heroSpeed();
    const s = idx(Math.floor(h.x), Math.floor(h.y)), goal = idx(Math.floor(x), Math.floor(y));
    if (!inside(Math.floor(x), Math.floor(y))) return null;
    if (!PC) { PC = new Float32Array(N * N); PP = new Int32Array(N * N); PG = new Uint32Array(N * N); }
    gen++; const open = new Heap(), Z = ctx.zone();
    const tx = Math.floor(x), ty = Math.floor(y), fast = 1 / (sp * 1.0);   // a slightly greedy guess: fast enough for a tap on a phone
    const hcost = i => Math.hypot((i % N) - tx, ((i / N) | 0) - ty) * fast;
    const get = i => (PG[i] === gen ? PC[i] : Infinity);
    PG[s] = gen; PC[s] = 0; PP[s] = -1; open.push(hcost(s), s);
    let best = s, bd = Infinity, n = 0;
    while (open.size && n++ < 120000) {
      if (n === 119999) R.planCap = (R.planCap || 0) + 1;
      const i = open.pop(); const cx = i % N, cy = (i / N) | 0, ci = PC[i];
      if (open.top > ci + hcost(i) + 1e-6) continue;
      const dg = Math.hypot(cx - tx, cy - ty); if (dg < bd) { bd = dg; best = i; }
      if (i === goal) break;
      const g = map.road[i] ? 1.4 : map.terrain[i] === T.FOREST && !Z[i] ? 0.72 : 1;
      for (const [dx, dy, len] of DIRS8) {
        const xx = cx + dx, yy = cy + dy; if (!inside(xx, yy)) continue; const j = idx(xx, yy);
        if (!ctx.heroOk(j)) continue;
        if (dx && dy && (!ctx.heroOk(idx(cx + dx, cy)) || !ctx.heroOk(idx(cx, cy + dy)))) continue;
        const nc = ci + len / (sp * g);
        if (nc < get(j)) { PG[j] = gen; PC[j] = nc; PP[j] = i; open.push(nc + hcost(j), j); }
      }
    }
    const end = best; const pts = [];
    for (let i = end; i !== s && i >= 0; i = PP[i]) pts.push({ x: (i % N) + 0.5, y: ((i / N) | 0) + 0.5 });
    pts.reverse();
    // drop points on straight runs
    const path = []; for (let k = 0; k < pts.length; k++) { const a = path[path.length - 1], b = pts[k], nx = pts[k + 1]; if (a && nx && Math.abs((b.x - a.x) * (nx.y - b.y) - (b.y - a.y) * (nx.x - b.x)) < 1e-6 && (b.x - a.x) * (nx.x - b.x) + (b.y - a.y) * (nx.y - b.y) > 0) continue; path.push(b); }
    return { secs: PC[end], reached: end === goal || bd < 2.5, path, dist: pts.length };
  }
  function tripInfo(x, y) {
    const p = plan(x, y); if (!p) return null;
    const back = Math.hypot(x - c, y - c) < 12 ? 0 : (plan(c, c + 3.5, { x, y }) || { secs: p.secs }).secs;
    const day = S.phase === 'day', left = api ? (day ? api.duskIn() : Math.max(0, (1 - api.nightFrac()) * 70)) : 0;
    const round = p.secs + back, campOnly = back === 0;
    const label = `${campOnly ? 'walk' : 'round trip'} ${fmtTime(campOnly ? p.secs : round)} · ${day ? 'dusk' : 'dawn'} in ${fmtTime(left)}`;
    return { secs: p.secs, back, round, left, day, label, late: day && !campOnly && round > left, risky: day && !campOnly && round > left * 0.8, campHolds: missions.forecast(), path: p.path, reached: p.reached };
  }
  /** walk there along the fastest way (the player takes over by touching the joystick) */
  function go(x, y) {
    const h = hero(), p = plan(x, y); if (!p || !p.path.length || h.dead) return false;
    h.target = { x: p.path[p.path.length - 1].x, y: p.path[p.path.length - 1].y }; h.path = p.path; h.tripTo = { x, y }; h.held = null;
    ev('trip', { x, y, secs: p.secs }); return true;
  }
  /** places the map and the trip planner know about */
  function places() {
    const seen = (x, y) => S.seen[idx(Math.floor(x), Math.floor(y))] === 1, out = [];
    for (const st of stations) out.push({ kind: 'station', id: st.id, name: st.name, x: st.x, y: st.y, lit: st.lit });
    for (const l of S.landmarks) if (seen(l.x, l.y) && l.kind !== 'unknown') out.push({ kind: 'site', id: l.id, name: ctx.LANDMARKS[l.kind].name, x: l.x, y: l.y + l.size / 2 + 1, owned: l.owned });
    for (const r of map.regions) if (r.nest && S.nestAlive[r.id] && seen(r.nest.x, r.nest.y)) out.push({ kind: 'hive', id: r.id, name: r.ring === 1 ? 'Forest hollow' : 'City hive', x: r.nest.x, y: r.nest.y + 2.5 });
    out.push({ kind: 'city', name: 'The city', x: map.city.x, y: map.city.y }, { kind: 'camp', name: 'Camp', x: c, y: c + 3.5 });
    return out;
  }

  // ---------- tick, dawn, saving ----------
  function scanEvents() {
    if (S.events.length < R.evAt) R.evAt = 0;
    for (let k = R.evAt; k < S.events.length; k++) missions.onEvent(S.events[k]);
    R.evAt = S.events.length;
  }
  function tick(dt) {
    if (S.over) return;
    if (R.phase !== S.phase) { const was = R.phase; R.phase = S.phase; if (S.phase === 'night') { missions.nightfall(); for (const st of stations) if (st.lit) { st.maxHp = ROAD.hp(S.night); st.hp = Math.max(st.hp, st.maxHp); } } else if (was === 'night') syncPeople(); }
    cvHunters = 0; for (const m of S.mobs) if (m.cv) cvHunters++;
    syncPeople(); stepTrail(); stepEscort(); stepConvoys(dt); stepStations(dt); stepAmbush(dt);
    missions.tick(dt); scanEvents();
  }
  function dawn() { missions.dawn(); for (const st of stations) if (st.lit) st.hp = st.maxHp; R.outT = 0; }
  function hiveMult(r) { return missions.hiveMult(r); }
  function attach(a) {
    api = a; missions.attach(a);
    const snap = a.snapshot, choose = a.choose;
    a.snapshot = () => { const o = snap(); if (o) o.road = save(); return o; };
    a.choose = id => { const enc = S.story.encounters[0], ok = choose(id); if (ok && enc && enc.road) onChoice(enc, id); else if (ok) syncPeople(); return ok; };
    a.road = road;
  }
  function save() {
    return { v: 1, stations: stations.map(s => ({ id: s.id, lit: s.lit, fell: s.fell, met: s.met, hp: s.hp, maxHp: s.maxHp, towers: s.towers, litN: s.litN })),
      convoys: R.convoys.map(cv => ({ ...cv, members: cv.members.map(m => ({ ...m, state: 'wait' })) })), nextId: R.nextId, lit: R.lit, rescued: R.rescued, lost: R.lost, home: R.home, mission: missions.save() };
  }
  function load(o) {
    if (!o || o.v !== 1) return;
    for (const d of o.stations || []) { const st = stations.find(s => s.id === d.id); if (st) Object.assign(st, d, { prog: 0 }); }
    R.convoys = (o.convoys || []).map(cv => ({ ...cv, members: cv.members.map(m => ({ ...m })) }));
    Object.assign(R, { nextId: o.nextId || R.nextId, lit: stations.filter(s => s.lit).length, rescued: o.rescued || 0, lost: o.lost || 0, home: o.home || 0, lastSurv: S.survivors, lastDawns: S.dawns, trail: [], evAt: S.events.length, phase: S.phase });
    missions.load(o.mission);
  }
  const road = {
    state: R, stations, missions, drive, perceive, unseen, preferHive, tick, dawn, hiveMult, attach, save, load,
    light: id => { const st = stations.find(s => s.id === id); return st && !st.lit ? light(st) : false; },
    buildTower, placeRule, plan, tripInfo, go, places, ringOf, members, inLitRing, lightCost,
    /** tell a convoy to wait where it stands (best by a lit fire), or to follow again */
    hold: on => { for (const cv of R.convoys) cv.hold = !!on; ev('convoyHold', { on: !!on }); return true; },
    convoys: () => R.convoys, makeConvoy: (n, cart) => { if (cart) R.cart = cart; return makeConvoy(n); },
    stragglers: () => { const h = hero(); return members().filter(m => Math.hypot(m.x - h.x, m.y - h.y) > CONVOY.straggle); },
    setMission: id => missions.choose(id), horn: () => missions.horn(), setLantern: on => missions.setLantern(on), forecast: () => missions.forecast(),
    get mission() { return missions.state; },
  };
  return road;
}
