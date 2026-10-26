// The folk build by themselves. The village reads its needs from the state it is in (homeless, hunger, fallen and
// silent towers, last night's losses, then comfort) and each day picks ONE small project from the top need: rebuild a
// ruin, a home, a farm, a sandbag wall on the side that was hit, or, when all is well, something that makes the camp a
// village (lanterns, flower beds, benches, fences, paths, a well, a stall, a shrine). They pay for it from the village
// fund: a share of the day's income (FOLK.share, content/folk.js), taken by the second while the sun is up.
// The player stays in charge: the folk build only on free ground outside every lot, never touch a player building,
// stop when "Let them build" is off (the fund goes back to the chest) and drop a project when it is vetoed (refund).
// Beauty pays back a little: the Camp heals the hero faster, and at a few marks a family walks in.
//
// Hooks (kept here so other branches merge cleanly):
// - the tithe follows the income RATE (api.goldPerDawn per day), not a lump: it works the same with a dawn payout or
//   an income trickle (sim/income.js on the pacing branch). Any other income code may also call G.folkTithe(n).
// - G.snapshot / G.restoreSnap are wrapped below to carry S.folk (no edit to save.js).
// - economy.js puts G.folkLedger() into the dawn ledger; combat.js asks G.folkGuard(b) for the sandbags' cover;
//   game.js calls G.stepFolk(dt) once a step (all bracketed with [folk]).
import { FOLK, NEEDS, PROPS, BEAUTY_ORDER, FOLK_TEXT } from '../content/folk.js';
import { BUILDINGS } from '../content/buildings.js';
import { TIDE } from '../content/mobs.js';
import { Rng, hashSeed } from './rng.js';
import { N, T, idx, inside } from './mapgen.js';
import { REGEN } from './state.js';

export function createFolkBuild(G) {
  const { S, c, map, ev, toast } = G;
  const rng = new Rng(hashSeed(G.seed, 'folk'));
  const fresh = () => ({ on: true, fund: 0, owed: 0, job: null, done: 0, veto: 0, props: [], nid: 1, beauty: 0, drawn: 0, took: 0, built: [], ver: 0, total: 0 });
  S.folk = fresh();
  const F = () => S.folk;
  const fill = (s, n) => s.replace(/\{(\w+)\}/g, (_, k) => n[k] ?? '');

  // ---------- where the folk may put things: free ground on your land, outside every lot ----------
  const propAt = new Map();   // cell → prop id (rebuilt when the props change)
  let propKey = -1;
  function indexProps() { const f = F(); if (propKey === f.ver) return; propKey = f.ver; propAt.clear(); for (const p of f.props) for (const i of p.cells) propAt.set(i, p.id); }
  function freeCell(i) {
    const t = map.terrain[i];
    if (S.occ[i] >= 0 || S.res[i] >= 0 || !(t === T.GRASS || t === T.DIRT) || map.ramp[i] || map.lm[i] >= 0 || (map.road && map.road[i])) return false;
    if (!G.inZone(i)) return false;
    const x = i % N, y = (i / N) | 0;
    if (Math.hypot(x + 0.5 - c, y + 0.5 - c) < 3.8) return false;   // the camp fire's circle stays clear
    indexProps(); return !propAt.has(i);
  }
  /** free cells round the hall, with a score (lower is better; null skips the cell) */
  function cells(score) {
    const out = [], R = FOLK.reach, x0 = Math.max(1, Math.floor(c - R)), x1 = Math.min(N - 2, Math.ceil(c + R));
    for (let y = x0; y <= x1; y++) for (let x = x0; x <= x1; x++) {
      const i = idx(x, y); if (!freeCell(i)) continue;
      const s = score(x + 0.5, y + 0.5); if (s === null || s === undefined) continue;
      out.push({ i, x: x + 0.5, y: y + 0.5, s });
    }
    return out.sort((a, b) => a.s - b.s || a.i - b.i);
  }
  const live = type => S.buildings.filter(b => b.type === type && !b.ruined);
  const nearest = (list, x, y) => { let d = Infinity, o = null; for (const b of list) { const e = Math.hypot(b.x - x, b.y - y); if (e < d) { d = e; o = b; } } return { d, b: o }; };
  const tooClose = (kind, x, y) => F().props.some(p => p.kind === kind && Math.hypot(p.x - x, p.y - y) < (PROPS[kind].gap || 0));
  function routePts() { const pts = []; try { for (const f of G.forecast()) for (let k = 0; k < f.path.length; k += 3) pts.push(f.path[k]); } catch (e) { /* no routes yet */ } return pts; }
  const dRoute = (x, y, pts) => { let d = 99; for (const q of pts) d = Math.min(d, Math.hypot(q[0] - x, q[1] - y)); return d; };

  // the side that was hit hardest: last night's fallen buildings, else where tonight's dead come from
  function hitSide() {
    const L = S.ledger && S.ledger.night === S.night - 1 ? S.ledger : null, fell = L ? L.fell.map(f => S.byId.get(f.id)).filter(Boolean) : [];
    let dx = 0, dy = 0;
    if (fell.length) for (const b of fell) { dx += b.x - c; dy += b.y - c; }
    else { try { const f = G.forecast()[0]; if (f) { dx = f.x - c; dy = f.y - c; } } catch (e) { /* no sources */ } }
    const L2 = Math.hypot(dx, dy); if (L2 < 0.01) return null;
    return { ux: dx / L2, uy: dy / L2, lost: fell.length };
  }
  /** the outermost building on that side (not a ruin): the one the sandbags shield */
  function frontBuilding(side) {
    let best = null, bs = -Infinity;
    for (const b of S.buildings) {
      if (b.ruined || b.type === 'wall') continue;
      const ox = b.x - c, oy = b.y - c, d = Math.hypot(ox, oy) || 1, dot = (ox * side.ux + oy * side.uy) / d;
      if (dot < 0.55) continue;
      const guards = F().props.filter(p => PROPS[p.kind].guard && Math.hypot(p.x - b.x, p.y - b.y) < 3).length;
      const s = d * dot - guards * 4; if (s > bs) { bs = s; best = b; }
    }
    return best;
  }

  // ---------- picking a spot for each kind of project ----------
  function propSpot(kind) {
    const P = PROPS[kind], jit = () => rng.next() * 0.6;
    if (kind === 'path') return pathSpot();
    let list;
    if (P.near === 'home' || P.near === 'farm') {
      const bs = live(P.near === 'home' ? 'house' : 'farm'); if (!bs.length) return null;
      list = cells((x, y) => { const n = nearest(bs, x, y); return n.d >= 1.6 && n.d <= 3.0 && !tooClose(kind, x, y) ? n.d + 0.03 * Math.hypot(x - c, y - c) : null; });
    } else if (P.near === 'keep') {
      list = cells((x, y) => { const d = Math.hypot(x - c, y - c); return d >= 4.2 && d <= 9 && !tooClose(kind, x, y) ? Math.abs(d - 5.5) : null; });
    } else if (P.near === 'quiet') {
      const pts = routePts();
      list = cells((x, y) => { const d = Math.hypot(x - c, y - c); return d >= 5 && d <= 11 && !tooClose(kind, x, y) ? -Math.min(dRoute(x, y, pts), 10) * 0.5 + Math.abs(d - 7) * 0.2 : null; });
    } else if (P.near === 'hit') {
      const side = hitSide(); if (!side) return null;
      const b = frontBuilding(side); if (!b) return null;
      list = cells((x, y) => { const d = Math.hypot(x - b.x, y - b.y), dot = ((x - b.x) * side.ux + (y - b.y) * side.uy) / (d || 1); return d >= 1.2 && d <= 2.6 && dot > 0.2 && !tooClose(kind, x, y) ? d - dot : null; });
    }
    if (!list || !list.length) return null;
    if (P.near !== 'hit') { for (const q of list) q.s -= 0.35 * tucked(q.x, q.y); list.sort((a, b) => a.s - b.s || a.i - b.i); }
    const top = list.slice(0, 4); for (const q of top) q.s += jit(); top.sort((a, b) => a.s - b.s);
    const q = top[0]; return { x: q.x, y: q.y, cells: [q.i] };
  }
  /** a path of flagstones between two homes: the free cells along the straight line between them */
  function pathSpot() {
    const hs = live('house'); if (hs.length < 2) return null;
    let best = null, bs = Infinity;
    for (let a = 0; a < hs.length; a++) for (let b = a + 1; b < hs.length; b++) {
      const d = Math.hypot(hs[a].x - hs[b].x, hs[a].y - hs[b].y); if (d < 3 || d > 10) continue;
      const line = G.lineCells(hs[a].x, hs[a].y, hs[b].x, hs[b].y).filter(([x, y]) => inside(x, y)).map(([x, y]) => idx(x, y)).filter(freeCell);
      if (line.length < 2) continue;
      const s = d - line.length * 0.8 + rng.next() * 0.5; if (s < bs) { bs = s; best = line.slice(0, 8); }
    }
    if (!best) return null;
    const xs = best.map(i => (i % N) + 0.5), ys = best.map(i => ((i / N) | 0) + 0.5);
    return { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length, cells: best };
  }
  /** a lot for a new home or farm: next to its own kind, out of the dead's way */
  function buildSpot(type) {
    const own = live(type), pts = routePts(), R = 14, out = [];
    for (let y = Math.floor(c - R); y <= Math.ceil(c + R); y++) for (let x = Math.floor(c - R); x <= Math.ceil(c + R); x++) {
      if (!inside(x, y)) continue; const i = idx(x, y); if (!G.inZone(i) || S.occ[i] >= 0 || S.res[i] >= 0) continue;
      const n = own.length ? nearest(own, x + 0.5, y + 0.5).d : Math.hypot(x + 0.5 - c, y + 0.5 - c), dk = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      out.push({ x: x + 0.5, y: y + 0.5, s: n + dk * (type === 'house' ? 0.4 : 0.2) - Math.min(dRoute(x, y, pts), type === 'farm' ? 8 : 6) * (type === 'farm' ? 0.6 : 0.4) });
    }
    out.sort((a, b) => a.s - b.s);
    let tried = 0;
    for (const q of out) {
      const p = G.canPlace(type, q.x, q.y, 0); if (!p.ok) continue;
      if (p.cells.some(i => propAt.has(i)) && tried < 30) { tried++; continue; }   // keep the folk's own props where they stand when there is other room
      if (!G.canPlace(type, q.x, q.y, 0, { deep: true }).ok) continue;
      return { x: p.x, y: p.y, cells: p.cells };
      // (deep: never seal off ground you could walk out of)
    }
    return null;
  }

  // ---------- the needs, read from the state ----------
  function needs() {
    const out = [], fs = S.buildings.filter(b => b.ruined && b.type !== 'wall' && b.type !== 'keep');
    const homeless = S.homeless || 0, deficit = Math.max(0, G.foodNeed() - G.foodPerDawn());
    const cr = G.crewing(), silent = S.buildings.filter(b => b.type === 'tower' && !b.ruined).length - cr.manned.size;
    for (const b of fs) {
      const need = b.type === 'tower' ? 'defence' : b.type === 'house' ? 'housing' : b.type === 'farm' ? 'food' : 'defence';
      const sc = b.type === 'tower' ? 85 : b.type === 'house' && homeless > 0 ? 80 : b.type === 'farm' && deficit > 0 ? 75 : 45;
      out.push({ need, s: sc - b.id * 1e-4, job: () => ({ kind: 'rebuild', id: b.id, type: b.type, x: b.x, y: b.y, cost: G.rebuildCost(b), cells: [] }) });
    }
    if (homeless > 0) out.push({ need: 'housing', s: 70 + 3 * homeless, job: () => newBuilding('house') });
    if (deficit > 0) out.push({ need: 'food', s: 60 + 6 * deficit, job: () => newBuilding('farm') });
    if (silent > 0 && cr.need > cr.people) out.push({ need: 'crew', s: 50 + 8 * silent, job: () => newBuilding('house') });
    const side = S.night >= 3 ? hitSide() : null, risky = side && (side.lost > 0 || (G.hordeMarch ? G.hordeMarch(S.night).length > 0 : false));   // a horde marches tonight
    if (risky) for (const k of ['watch', 'sandbags']) if (ok(k)) out.push({ need: 'defence', s: 40 + 4 * side.lost + (k === 'sandbags' ? 1 : count('watch') ? 0 : 2), job: () => newProp(k) });
    out.push({ need: 'beauty', s: 10, job: () => beautyJob() });
    return out.sort((a, b) => b.s - a.s);
  }
  const count = k => F().props.filter(p => p.kind === k).length;
  const ok = k => count(k) < PROPS[k].max && S.night >= (PROPS[k].from || 0);
  function newBuilding(type) { const p = buildSpot(type); return p ? { kind: 'build', type, x: p.x, y: p.y, cost: G.newCost(type), cells: p.cells } : null; }
  function newProp(k) { const p = propSpot(k); return p ? { kind: 'prop', prop: k, x: p.x, y: p.y, cost: PROPS[k].cost, cells: p.cells } : null; }
  /** the comfort pick: what the village has least of, landmarks once it can afford to wait for them */
  function beautyJob() {
    const opts = BEAUTY_ORDER.filter(ok), w = opts.map(k => (PROPS[k].beauty + 1) / (1 + count(k)) * (PROPS[k].max === 1 || PROPS[k].max === 2 ? 1.6 : 1));
    for (let tries = 0; tries < 4 && opts.length; tries++) {
      const k = rng.weighted(w), j = newProp(opts[k]); if (j) return j;
      opts.splice(k, 1); w.splice(k, 1);
    }
    return null;
  }
  const nameOf = j => (j.kind === 'prop' ? PROPS[j.prop].one : j.kind === 'rebuild' ? `the fallen ${BUILDINGS[j.type].name.toLowerCase()}` : j.type === 'house' ? 'a home' : 'a farm');
  function pick() {
    const f = F();
    for (const n of needs()) { const j = n.job(); if (!j) continue; Object.assign(j, { need: n.need, paid: 0, work: 0, name: nameOf(j), day: S.night }); f.job = j; f.ver++; ev('folkJob', { kind: j.kind, x: j.x, y: j.y }); return j; }
    f.done = S.night;   // nothing the folk can do today
    return null;
  }

  // ---------- is the project still possible? ----------
  function valid(j) {
    if (j.kind === 'rebuild') { const b = S.byId.get(j.id); return !!(b && b.ruined && !b.cells.some(i => S.occ[i] >= 0 && S.occ[i] !== b.id)); }
    if (j.kind === 'build') return G.canPlace(j.type, j.x, j.y, 0).ok;
    return j.cells.every(i => { const t = map.terrain[i]; return S.occ[i] < 0 && S.res[i] < 0 && (t === T.GRASS || t === T.DIRT) && G.inZone(i); });
  }
  /** the site was taken (you built there, or a ruin was rebuilt by hand): move the project, or drop it back into the fund */
  function resite(j) {
    const f = F(), n = j.kind === 'build' ? newBuilding(j.type) : j.kind === 'prop' ? newProp(j.prop) : null;
    if (n) { Object.assign(j, { x: n.x, y: n.y, cells: n.cells }); f.ver++; return true; }
    f.fund += j.paid; f.job = null; f.ver++; return false;   // the day is not spent: the folk pick again
  }

  // ---------- finishing ----------
  function finish(j) {
    const f = F(); let line = '';
    if (j.kind === 'rebuild') {
      const b = S.byId.get(j.id);
      b.ruined = false; b.fell = false; b.hp = b.maxHp; G.occupy(b); G.dropLive(); G.dropCrew(); G.unstickHero();
      if (b.type === 'house') { const k = Math.min(G.houseCap(b), S.homeless || 0); b.folk = (b.folk || 0) + k; S.homeless = (S.homeless || 0) - k; }   // the homeless move back in
      ev('rebuild', { id: b.id, cost: 0, folk: true });
      line = fill(FOLK_TEXT.rebuilt, { name: BUILDINGS[b.type].name.toLowerCase() });
    } else if (j.kind === 'build') {
      const p = G.canPlace(j.type, j.x, j.y, 0, { deep: true });
      if (!p.ok) { if (resite(j)) { j.work = Math.min(j.work, 0.9); } return; }
      const homeless = S.homeless || 0, b = G.placeBuilding(j.type, p.x, p.y, 0, 1); b.byFolk = true;
      if (j.type === 'house' && homeless > 0) { const k = Math.min(G.houseCap(b), homeless); b.folk = k; S.homeless = homeless - k; }   // the homeless move in (no new family)
      G.dropCrew(); G.unstickHero();
      line = fill(FOLK_TEXT.built, { one: j.type === 'house' ? 'a home' : 'a farm', why: NEEDS[j.need] || '' });
    } else {
      f.props.push({ id: f.nid++, kind: j.prop, x: +j.x.toFixed(2), y: +j.y.toFixed(2), cells: j.cells.slice(), rot: Math.floor(rng.next() * 4) });
      line = fill(FOLK_TEXT.done, { one: PROPS[j.prop].one });
    }
    f.job = null; f.done = S.night; f.ver++; f.built.push(j.name); f.total++;
    S.stats.folkBuilt = (S.stats.folkBuilt || 0) + 1;
    refreshBeauty();
    ev('folkDone', { kind: j.kind, prop: j.prop || null, type: j.type || null, x: j.x, y: j.y, name: j.name });
    toast(line, 'good');
  }
  function refreshBeauty() {
    const f = F(); f.beauty = f.props.reduce((a, p) => a + (PROPS[p.kind].beauty || 0), 0);
    while (f.drawn < FOLK.draw.length && f.beauty >= FOLK.draw[f.drawn]) {
      f.drawn++; S.survivors += FOLK.drawN; G.dropCrew();
      ev('folkDrawn', { n: FOLK.drawN }); toast(fill(FOLK_TEXT.drawn, { n: FOLK.drawN }), 'good');
    }
  }
  // a prop under a new lot moves out of your way (yours always wins): the folk carry it to the next good spot, or it
  // goes when there is none; a path keeps the stones that are still free
  let occSeen = -1;
  function tidy() {
    if (occSeen === S.occVersion) return; occSeen = S.occVersion;
    const f = F(); let changed = false;
    for (const p of [...f.props]) {
      const keep = p.cells.filter(i => S.occ[i] < 0 && S.res[i] < 0);
      if (keep.length === p.cells.length) continue;
      changed = true;
      if (p.kind === 'path') { if (keep.length) p.cells = keep; else f.props.splice(f.props.indexOf(p), 1); continue; }
      f.props.splice(f.props.indexOf(p), 1); f.ver++;
      const q = propSpot(p.kind);
      if (q) { p.x = +q.x.toFixed(2); p.y = +q.y.toFixed(2); p.cells = q.cells; f.props.push(p); ev('folkMoved', { id: p.id }); }
    }
    if (changed) { f.ver++; refreshBeauty(); }
  }
  /** how many of a cell's four neighbours are lots or buildings: props tuck into the gaps the town leaves */
  const tucked = (x, y) => { let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = Math.floor(x) + dx, yy = Math.floor(y) + dy; if (inside(xx, yy) && (S.res[idx(xx, yy)] >= 0 || S.occ[idx(xx, yy)] >= 0)) n++; } return n; };

  // ---------- the fund: a share of the day's income, by the second ----------
  let incT = -1, inc = 0;
  const income = () => { if (S.time - incT >= 1 || incT < 0) { incT = S.time; inc = Math.max(0, G.api && G.api.goldPerDawn ? G.api.goldPerDawn() : 0); } return inc; };
  /** scrap into the fund from anywhere (another income system may call this); returns what the fund took */
  function folkTithe(n) { const f = F(); if (!f.on) return 0; const k = Math.max(0, Math.min(n, S.gold, FOLK.fundCap - f.fund)); S.gold -= k; f.fund += k; f.took += k; return k; }
  function tithe(dt) {
    const f = F(); if (S.night < (FOLK.from || 1)) return;
    if (f.fund + (f.job ? f.job.paid : 0) >= FOLK.fundCap) { f.owed = 0; return; }
    f.owed = Math.min(3, f.owed + FOLK.share * income() * dt / (S.tide || TIDE).dayLen);
    while (f.owed >= 1 && S.gold >= 1) { f.owed -= 1; folkTithe(1); }
  }

  // ---------- once a step ----------
  let chkT = 0;
  function stepFolk(dt) {
    const f = F(); if (S.over) return;
    tidy();
    beautyRegen(dt);
    if (!f.on || S.phase !== 'day') return;
    tithe(dt);
    if ((chkT -= dt) > 0 && f.job) return work(f.job, dt);
    chkT = 0.5;
    if (!f.job) { if (f.done === S.night || f.veto === S.night || S.night < (FOLK.from || 1)) return; pick(); return; }
    if (!valid(f.job) && !resite(f.job)) return;
    work(f.job, dt);
  }
  function work(j, dt) {
    const f = F(), give = Math.min(f.fund, j.cost - j.paid); if (give > 0) { f.fund -= give; j.paid += give; }
    j.work = Math.min(j.work + dt / FOLK.buildT, j.cost > 0 ? j.paid / j.cost : 1);
    if (j.work >= 1 - 1e-9) finish(j);
  }
  /** beauty: the Camp heals the hero a little faster */
  function beautyRegen(dt) {
    const h = S.hero, k = Math.min(FOLK.regenMax, F().beauty * FOLK.regen);
    if (k <= 0 || h.dead || h.rest !== 'camp' || h.hp >= h.maxHp) return;
    h.hp = Math.min(h.maxHp, h.hp + dt * (S.phase === 'day' ? REGEN.camp : REGEN.campNight) * k); h.hpSeen = h.hp;
  }

  // ---------- sandbags and watch-posts: buildings near them take less damage ----------
  let guardKey = '', guard = new Map();
  function folkGuard(b) {
    const f = F(); if (!f.props.length || b.type === 'keep') return 1;
    const key = `${f.ver}|${S.occVersion}`;
    if (key !== guardKey) {
      guardKey = key; guard = new Map();
      for (const p of f.props) { const P = PROPS[p.kind]; if (!P.guard) continue; for (const o of S.buildings) if (Math.hypot(o.x - p.x, o.y - p.y) <= P.r) guard.set(o.id, Math.max(guard.get(o.id) || 0, P.guard)); }
    }
    return 1 - (guard.get(b.id) || 0);
  }

  // ---------- the player's say ----------
  function folkVeto() {
    const f = F(), j = f.job; if (!j) return 0;
    const n = Math.floor(j.paid); S.gold += n; f.fund += j.paid - n; f.job = null; f.veto = S.night; f.ver++;
    ev('folkVeto', { x: j.x, y: j.y }); toast(fill(FOLK_TEXT.veto, { n }), 'good'); return n;
  }
  function setFolkBuild(on) {
    const f = F(); on = !!on; if (f.on === on) return 0;
    f.on = on; f.ver++;
    if (on) { toast(FOLK_TEXT.on); return 0; }
    const n = Math.floor(f.fund + (f.job ? f.job.paid : 0)); S.gold += n; f.fund = 0; f.owed = 0; f.job = null;
    toast(fill(FOLK_TEXT.off, { n })); return n;
  }
  function folkInfo() {
    const f = F(), j = f.job;
    return { on: f.on, fund: Math.floor(f.fund), beauty: f.beauty, props: f.props, total: f.total, regen: Math.round(Math.min(FOLK.regenMax, f.beauty * FOLK.regen) * 100), share: FOLK.share, ver: f.ver,
      nextDraw: FOLK.draw[f.drawn] ?? null,
      job: j ? { kind: j.kind, type: j.type || null, prop: j.prop || null, name: j.name, short: j.kind === 'prop' ? PROPS[j.prop].name : j.kind === 'rebuild' ? `Rebuild ${BUILDINGS[j.type].name.toLowerCase()}` : BUILDINGS[j.type].name, need: j.need, why: NEEDS[j.need] || '', x: j.x, y: j.y, cells: j.cells, cost: j.cost, paid: Math.floor(j.paid), pct: Math.round(100 * Math.min(1, j.work)), waiting: j.paid < j.cost && j.work >= j.paid / Math.max(1, j.cost) - 1e-6 } : null };
  }
  /** the dawn ledger's line: what the folk kept and built since the last dawn (then the counters restart) */
  function folkLedger() { const f = F(), out = { folk: { took: f.took, built: f.built.slice(), fund: Math.floor(f.fund), on: f.on } }; f.took = 0; f.built = []; return out; }

  // ---------- saves: S.folk rides along in the dawn snapshot ----------
  const snap0 = G.snapshot, restore0 = G.restoreSnap;
  const snapshot = () => { const o = snap0(); if (o) o.folk = JSON.parse(JSON.stringify(S.folk)); return o; };
  const restoreSnap = R => { restore0(R); S.folk = Object.assign(fresh(), R.folk || {}); S.folk.ver++; propKey = -1; occSeen = -1; refreshBeauty(); };

  return { stepFolk, folkGuard, folkTithe, folkVeto, setFolkBuild, folkInfo, folkLedger, snapshot, restoreSnap };
}
