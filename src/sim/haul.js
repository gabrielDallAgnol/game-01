// [econ3] Harvester carts and resource nodes (Red Alert 2 style). Timber stands and scrap heaps lie round the Camp in
// three bands; each holds a finite amount and runs dry. Carts drive from the Camp's yard (wherever the keep stands:
// the Haven Rig) to the nearest node that still has something, load up, drive back and unload: that scrap is the
// town's main income now (the trickle keeps a small share, content/econ.js TRICKLE). The near nodes run dry by day
// 3–4, so the routes grow long and lead past the dead: the dead go for a cart that passes close ("Harvester under
// attack!") and a cart can be lost. More carts: a job in the construction queue, up to HAUL.max by Camp level. At
// night the carts drive home and wait for the sun. Its own seeded stream (node layout) — no draw from the shared ones.
import { HAUL, TRICKLE, ECON } from '../content/econ.js';
import { MOBS } from '../content/mobs.js';
import { N, PASSABLE, T, idx, inside } from './mapgen.js';
import { Rng, hashSeed } from './rng.js';
import { MinHeap, DIRS8 } from './state.js';

export function createHaul(G) {
  const { S, map, c, keep, ev, toast, fail, seed } = G;
  const E = () => S.econ || (S.econ = {});
  const mods = () => E().mods || (E().mods = {});
  const on = () => ECON.carts;

  // ---------- nodes ----------
  function genNodes() {
    const rng = new Rng(hashSeed(map.seed ?? seed, 'econ-nodes')), out = [];
    const hiveNear = (x, y, r) => map.regions.some(reg => reg.nest && Math.hypot(reg.nest.x - x, reg.nest.y - y) < r);
    const lmNear = (x, y) => (map.landmarks || []).some(l => Math.hypot(l.x - x, l.y - y) < 4);
    const ok = (x, y) => { if (!inside(x, y)) return false; const i = idx(x, y), t = map.terrain[i]; return map.reach[i] && (t === T.GRASS || t === T.DIRT) && map.lm[i] < 0 && map.region[i] >= 0; };
    const woodsBy = (x, y) => { let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(x + dx, y + dy) && map.terrain[idx(x + dx, y + dy)] === T.FOREST) n++; return n; };
    HAUL.bands.forEach(([r0, r1, nT, nS, lo, hi], band) => {
      for (const [kind, want] of [['timber', nT], ['scrap', nS]]) {
        let got = 0;
        for (let tries = 0; tries < 400 && got < want; tries++) {
          const a = rng.range(0, Math.PI * 2), r = rng.range(r0, r1), x = Math.floor(c + Math.cos(a) * r), y = Math.floor(c + Math.sin(a) * r);
          if (!ok(x, y) || hiveNear(x + 0.5, y + 0.5, HAUL.hiveGap + 1) || lmNear(x + 0.5, y + 0.5)) continue;
          if (kind === 'timber' ? woodsBy(x, y) < 2 : (woodsBy(x, y) > 3 && !map.road[idx(x, y)])) continue;
          if (out.some(n => Math.hypot(n.x - x - 0.5, n.y - y - 0.5) < HAUL.gap)) continue;
          const amt = Math.round(rng.range(lo, hi));
          out.push({ id: out.length, kind, x: x + 0.5, y: y + 0.5, amt, max: amt, band }); got++;
        }
      }
    });
    return out;
  }
  const nodes = () => E().nodes || (E().nodes = genNodes());
  /** a building may not stand on a node (canPlace) */
  function nodeBlock(cells) {
    if (!on()) return '';
    for (const n of nodes()) if (n.amt > 0 && cells.includes(idx(Math.floor(n.x), Math.floor(n.y)))) return `A ${n.kind === 'timber' ? 'timber stand' : 'scrap heap'} is here: the carts harvest it.`;
    return '';
  }
  const hiveBy = n => map.regions.some(reg => reg.nest && G.nestAlive(reg.id) && Math.hypot(reg.nest.x - n.x, reg.nest.y - n.y) < HAUL.hiveGap);
  const open = n => { const r = map.region[idx(Math.floor(n.x), Math.floor(n.y))]; return n.amt - (n.res || 0) > 0 && !(r >= 0 && S.sealed[r]) && !hiveBy(n); };

  // ---------- the yard: where the carts park (beside the keep, wherever it stands) ----------
  let dockKey = '', dockAt = null;
  function cartDock() {
    const key = `${S.occVersion || 0}|${keep.x}|${keep.y}`; if (key === dockKey && dockAt) return dockAt;
    const free = (x, y) => inside(x, y) && PASSABLE[map.terrain[idx(x, y)]] && S.occ[idx(x, y)] < 0;
    let best = null, bd = Infinity;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const x = Math.floor(keep.x) + dx, y = Math.floor(keep.y) + dy; if (!free(x, y)) continue;
      const d = Math.hypot(x + 0.5 - keep.x, y + 0.5 - (keep.y + 3.5)); if (d < bd) { bd = d; best = { x: x + 0.5, y: y + 0.5 }; }
    }
    dockKey = key; dockAt = best || { x: keep.x, y: keep.y + 3.5 }; return dockAt;
  }

  // ---------- driving: a grid path (roads quick, woods slow), planned once a trip and again when blocked ----------
  const cellOk = i => PASSABLE[map.terrain[i]] && S.occ[i] < 0;
  function plan(x0, y0, x1, y1) {
    const sx = Math.floor(x0), sy = Math.floor(y0), gx = Math.floor(x1), gy = Math.floor(y1), pad = 10;
    const bx0 = Math.max(0, Math.min(sx, gx) - pad), by0 = Math.max(0, Math.min(sy, gy) - pad), bx1 = Math.min(N - 1, Math.max(sx, gx) + pad), by1 = Math.min(N - 1, Math.max(sy, gy) + pad);
    const w = bx1 - bx0 + 1, h = by1 - by0 + 1, dist = new Float32Array(w * h).fill(Infinity), prev = new Int32Array(w * h).fill(-1), heap = new MinHeap();
    const L = (x, y) => (y - by0) * w + (x - bx0), s = L(sx, sy); dist[s] = 0; heap.push(0, s);
    let best = s, bestD = Math.hypot(gx - sx, gy - sy);
    while (heap.size) {
      const i = heap.pop(), x = (i % w) + bx0, y = ((i / w) | 0) + by0, dg = Math.hypot(gx - x, gy - y);
      if (heap.lastKey > dist[i] + dg + 1e-6) continue;
      if (dg < bestD) { bestD = dg; best = i; }
      if (x === gx && y === gy) break;
      for (const [dx, dy, len] of DIRS8) {
        const xx = x + dx, yy = y + dy; if (xx < bx0 || yy < by0 || xx > bx1 || yy > by1) continue;
        const j = idx(xx, yy); if (!cellOk(j) && !(xx === gx && yy === gy && PASSABLE[map.terrain[j]])) continue;
        if (dx && dy && (!cellOk(idx(x + dx, y)) || !cellOk(idx(x, y + dy)))) continue;
        const k = map.road[j] ? 0.75 : map.terrain[j] === T.FOREST ? 1.5 : 1, nd = dist[i] + len * k, q = L(xx, yy);
        if (nd < dist[q]) { dist[q] = nd; prev[q] = i; heap.push(nd + Math.hypot(gx - xx, gy - yy), q); }
      }
    }
    const pts = []; for (let i = best; i !== s && i >= 0; i = prev[i]) pts.push({ x: (i % w) + bx0 + 0.5, y: ((i / w) | 0) + by0 + 0.5 });
    pts.reverse(); if (pts.length && bestD < 1.5) pts[pts.length - 1] = { x: x1, y: y1 }; else if (!pts.length) pts.push({ x: x1, y: y1 });
    return pts;
  }
  function drive(cart, dt) {
    if (!cart.path || !cart.path.length) return true;
    const ti = idx(Math.floor(cart.x), Math.floor(cart.y)), ground = map.road[ti] ? 1.3 : map.terrain[ti] === T.FOREST ? 0.65 : 1;
    let s = HAUL.speed * (mods().cartSpeed || 1) * ground * dt;
    while (s > 0 && cart.path.length) {
      const w = cart.path[0], dx = w.x - cart.x, dy = w.y - cart.y, d = Math.hypot(dx, dy);
      const wi = idx(Math.floor(w.x), Math.floor(w.y));
      if (S.occ[wi] >= 0 && cart.path.length > 1) { cart.path = null; return false; }   // something was built on the way: plan again
      if (d <= s) { cart.x = w.x; cart.y = w.y; cart.path.shift(); s -= d; continue; }
      cart.x += dx / d * s; cart.y += dy / d * s; cart.face = Math.atan2(dx, dy); s = 0;
    }
    return !cart.path.length;
  }

  // ---------- carts ----------
  const carts = () => E().carts || (E().carts = []);
  const maxCarts = () => HAUL.max[Math.min(HAUL.max.length, keep.level) - 1] + (mods().maxCarts || 0);
  const cartsOrdered = () => (E().q || []).filter(j => j.kind === 'cart').length;
  const capOf = () => HAUL.cap + (mods().cartCap || 0);
  const hpOf = () => Math.round(HAUL.hp * (mods().cartHp || 1));
  function addCart() {
    const d = cartDock(), cart = { id: E().nextCart = (E().nextCart || 0) + 1, x: d.x, y: d.y, hp: hpOf(), maxHp: hpOf(), state: 'home', node: -1, load: 0, path: null, t: 0, face: 0, alertT: 0 };
    carts().push(cart); ev('cart', { id: cart.id }); return cart;
  }
  function buyCart() {
    if (!on()) return fail('No carts in this run.');
    if (carts().length + cartsOrdered() >= maxCarts()) return fail(keep.level < HAUL.max.length ? `The yard holds ${maxCarts()} carts. Raise the Camp for more.` : 'The yard is full.');
    if (S.gold < HAUL.cost) return fail(`A cart costs ${HAUL.cost} scrap.`);
    if (G.queueOn && G.queueOn() && G.queueFull()) return fail('The work queue is full.');
    S.gold -= HAUL.cost; S.cur.spent += HAUL.cost; S.stats.goldSpent += HAUL.cost;
    if (G.queueOn && G.queueOn()) G.queueCart(HAUL.cost); else addCart();
    return true;
  }
  function pickNode(cart) {
    let best = null, bd = Infinity;
    for (const n of nodes()) { if (!open(n)) continue; const d = Math.hypot(n.x - cart.x, n.y - cart.y); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  function release(cart) { const n = nodes()[cart.node]; if (n && cart.res) { n.res = Math.max(0, (n.res || 0) - cart.res); } cart.res = 0; }
  function goHome(cart) { release(cart); cart.state = 'back'; const d = cartDock(); cart.path = plan(cart.x, cart.y, d.x, d.y); }
  function stepCart(cart, dt) {
    const day = S.phase === 'day';
    cart.alertT = Math.max(0, cart.alertT - dt);
    if (cart.state === 'home') {
      if (cart.hp < cart.maxHp) cart.hp = Math.min(cart.maxHp, cart.hp + dt * 2);   // mended in the yard
      if (!day || (cart.t -= dt) > 0) return;
      const n = pickNode(cart); if (!n) { cart.t = 3; return; }
      cart.node = n.id; cart.res = Math.min(capOf(), n.amt - (n.res || 0)); n.res = (n.res || 0) + cart.res;
      cart.state = 'out'; cart.path = plan(cart.x, cart.y, n.x, n.y); return;
    }
    if (!day && (cart.state === 'out' || cart.state === 'load')) { goHome(cart); return; }   // dusk: back to the yard
    if (cart.state === 'out') {
      const n = nodes()[cart.node]; if (!n || n.amt <= 0) { goHome(cart); return; }
      if (!cart.path) cart.path = plan(cart.x, cart.y, n.x, n.y);
      if (drive(cart, dt) && Math.hypot(n.x - cart.x, n.y - cart.y) < 1.6) { cart.state = 'load'; cart.t = HAUL.load; }
      else if (cart.path && !cart.path.length) cart.path = null;
      return;
    }
    if (cart.state === 'load') {
      if ((cart.t -= dt) > 0) return;
      const n = nodes()[cart.node], take = n ? Math.min(cart.res || capOf(), n.amt) : 0;
      if (n) { n.amt -= take; n.res = Math.max(0, (n.res || 0) - (cart.res || 0)); if (n.amt <= 0) { n.amt = 0; ev('nodeDry', { id: n.id, x: n.x, y: n.y }); toast(`The ${n.kind === 'timber' ? 'timber stand' : 'scrap heap'} to the ${G.compass(n.x, n.y)} is picked clean. The carts go further now.`, n.band ? '' : 'bad'); } }
      cart.res = 0; cart.load = take; cart.kind = n ? n.kind : 'scrap'; goHome(cart); return;
    }
    if (cart.state === 'back') {
      const d = cartDock();
      if (!cart.path) cart.path = plan(cart.x, cart.y, d.x, d.y);
      if (drive(cart, dt) && Math.hypot(d.x - cart.x, d.y - cart.y) < 1.6) { cart.state = 'unload'; cart.t = HAUL.unload; }
      else if (cart.path && !cart.path.length) cart.path = null;
      return;
    }
    if (cart.state === 'unload') {
      if ((cart.t -= dt) > 0) return;
      if (cart.load > 0) { G.earn(cart.load); E().hauled = (E().hauled || 0) + cart.load; E().hauledToday = (E().hauledToday || 0) + cart.load; ev('haul', { id: cart.id, n: cart.load, kind: cart.kind, x: cart.x, y: cart.y }); }
      cart.load = 0; cart.state = 'home'; cart.t = 0.5; cart.path = null;
    }
  }
  /** the dead near a cart go for it, and bite when they reach it */
  function threat(dt) {
    const list = carts(); if (!list.length) return;
    const h = S.hero;
    for (const m of S.mobs) {
      if (m.rise < 1 || m.dying || MOBS[m.kind].animal || !MOBS[m.kind].dmg) continue;
      let best = null, bd = HAUL.lure;
      for (const cart of list) { if (cart.state === 'home') continue; const d = Math.hypot(cart.x - m.x, cart.y - m.y); if (d < bd) { bd = d; best = cart; } }
      if (!best) continue;
      if (!h.dead && Math.hypot(h.x - m.x, h.y - m.y) < bd) continue;   // the hero is closer: it wants the hero
      m.lure = { x: best.x, y: best.y, t: 0.3 };
      if (bd < 0.95 && (m.cartCd = (m.cartCd || 0) - dt) <= 0) { m.cartCd = 1; hitCart(best, MOBS[m.kind].dmg * (m.dmgK || 1)); }
    }
  }
  function hitCart(cart, d) {
    cart.hp -= d; ev('cartHit', { id: cart.id, x: cart.x, y: cart.y });
    if (cart.hp > 0 && cart.alertT <= 0) { cart.alertT = HAUL.alertEvery; toast(`[Harvester under attack!] A cart to the ${G.compass(cart.x, cart.y)} is being torn at.`, 'bad'); }
    if (cart.hp <= 0) {
      release(cart); carts().splice(carts().indexOf(cart), 1); E().lost = (E().lost || 0) + 1;
      ev('cartLost', { id: cart.id, x: cart.x, y: cart.y }); toast(`[Harvester lost] The dead wrecked a cart to the ${G.compass(cart.x, cart.y)}${cart.load ? ` and its ${cart.load} scrap` : ''}.`, 'bad');
    }
  }
  function stepHaul(dt) {
    if (!on() || S.over) return;
    if (!E().init) { E().init = 1; nodes(); for (let k = 0; k < HAUL.start; k++) addCart(); }
    for (const cart of [...carts()]) stepCart(cart, dt);
    threat(dt);
    // the Foreman orders carts too, when there is scrap to spare
    if (S.builders && S.builders !== 'off' && S.phase === 'day' && carts().length + cartsOrdered() < maxCarts() && S.gold >= HAUL.cost + HAUL.foreman && (S.econT = (S.econT || 0) - dt) <= 0) { S.econT = 5; const q = S.quiet; S.quiet = true; buyCart(); S.quiet = q; }
  }
  /** at dawn: the carts are mended; what they hauled since yesterday goes to the ledger */
  function haulDawn() { for (const cart of carts()) cart.hp = cart.maxHp; const n = E().hauledToday || 0; E().hauledToday = 0; return n; }
  const trickleK = () => (on() ? TRICKLE : { base: 1, house: 1 });
  const haulInfo = () => ({ carts: carts().map(k => ({ id: k.id, x: k.x, y: k.y, state: k.state, load: k.load, hp: k.hp, maxHp: k.maxHp })), max: maxCarts(), ordered: cartsOrdered(), cost: HAUL.cost, hauled: E().hauled || 0,
    nodes: nodes().map(n => ({ id: n.id, kind: n.kind, x: n.x, y: n.y, amt: n.amt, max: n.max })), left: nodes().reduce((a, n) => a + n.amt, 0) });
  function haulRestore() { for (const cart of carts()) { cart.path = null; if (cart.state !== 'home') { const d = cartDock(); cart.x = d.x; cart.y = d.y; cart.state = 'home'; cart.load = 0; } cart.res = 0; } for (const n of nodes()) n.res = 0; }
  return { stepHaul, buyCart, addCart, cartDock, nodeBlock, haulInfo, haulDawn, haulRestore, trickleK, maxCarts, cartPlan: plan };
}
