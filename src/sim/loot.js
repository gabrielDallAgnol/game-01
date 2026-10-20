// Things to pick up: finds in the streets (carried home), supply drops after big nights, chests' cousins.
import { CUT, DROPS } from './state.js';
import { N, PASSABLE, idx, inside } from './mapgen.js';

export function createLoot(G) {
  const { S, c, compass, earn, ev, map, reveal, rng, syncPicks, toast } = G;

  // ---------- pickups: little finds in the open streets, worth a detour while you explore ----------
  const PICKUP = { start: 18, perDawn: 4, max: 26, apart: 12 };   // a find now and then, not every few steps
  function scatterPickups(n) {
    for (let k = 0, tries = 0; k < n && tries < n * 30 && S.pickups.length < PICKUP.max; tries++) {
      const x = rng.int(N), y = rng.int(N), i = idx(x, y), r = map.region[i];
      if (r < 0 || S.sealed[r] || !PASSABLE[map.terrain[i]] || !map.reach[i] || S.occ[i] >= 0 || G.inZone(i) || map.lm[i] >= 0) continue;
      if (S.pickups.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) < PICKUP.apart)) continue;
      S.pickups.push({ id: S.nextId++, x: x + 0.5, y: y + 0.5, kind: rng.next() < 0.55 ? 'scrap' : 'food' }); k++;
    }
  }
  // finds out in the wild are carried: they count once you are back on your land (and stay where you fall if you die)
  function stepPickups() {
    const h = S.hero; if (h.dead) return;
    const home = G.inZone(idx(Math.floor(h.x), Math.floor(h.y)));
    for (const p of [...S.pickups]) if (Math.abs(p.x - h.x) < 0.9 && Math.abs(p.y - h.y) < 0.9) {
      S.pickups.splice(S.pickups.indexOf(p), 1);
      const v = p.n || 2 + Math.floor(S.night / 4); p.n = v;
      if (home) { if (p.kind === 'scrap') earn(v); else S.food += v; } else h.carry[p.kind] += v;
      if (!p.dropped) S.stats.pickups = (S.stats.pickups || 0) + 1;
      ev('pickup', { id: p.id, kind: p.kind, x: p.x, y: p.y, n: p.n, carried: !home });
    }
    if (home) depositCarry();
  }
  function depositCarry() {
    const h = S.hero, cs = h.carry.scrap, cf = h.carry.food; if (!cs && !cf) return;
    earn(cs); S.food += cf; h.carry.scrap = 0; h.carry.food = 0;
    ev('deposit', { scrap: cs, food: cf }); toast(`Home with **${[cs ? `${cs} scrap` : '', cf ? `${cf} food` : ''].filter(Boolean).join(' and ')}**.`, 'good');
  }
  function dropSupply(why) {
    if (!S.clock) return;
    let spot = null;
    for (let t = 0; t < 60 && !spot; t++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(22, 50), x = c + Math.cos(a) * d, y = c + Math.sin(a) * d, cx = Math.floor(x), cy = Math.floor(y);
      if (!inside(cx, cy)) continue; const i = idx(cx, cy);
      if (!PASSABLE[map.terrain[i]] || !map.reach[i] || S.occ[i] >= 0 || G.inZone(i) || G.baseDist(x, y) < 7 || S.sealed[map.region[i]]) continue;
      if (map.regions.some(r => r.nest && S.nestAlive[r.id] && Math.hypot(r.nest.x - x, r.nest.y - y) < 5)) continue;
      spot = { x: cx + 0.5, y: cy + 0.5 };
    }
    if (!spot) return;
    const n = S.night, kinds = ['blueprint', 'cache', 'blessing', 'survivors'];
    const d = { id: S.nextId++, x: spot.x, y: spot.y, reward: kinds[rng.int(kinds.length)], ttl: DROPS.life, prog: 0 };
    S.drops.push(d); reveal(d.x, d.y, 2.5);
    // its guards: tougher than the roamers around them
    const guards = Math.min(7, 3 + Math.floor(n / 4));
    for (let k = 0, tries = 0; k < guards && tries < 60; tries++) {
      const kind = n >= 6 && k === 0 ? 'brute' : rng.pick(n >= 3 ? ['walker', 'runner', 'walker'] : ['walker']);
      const a = rng.range(0, Math.PI * 2), x = d.x + Math.cos(a) * rng.range(0.8, 2.6), y = d.y + Math.sin(a) * rng.range(0.8, 2.6), cx = Math.floor(x), cy = Math.floor(y);
      if (!inside(cx, cy) || !PASSABLE[map.terrain[idx(cx, cy)]] || S.occ[idx(cx, cy)] >= 0) continue;
      k++;
      const m = G.spawnMob(kind, x, y, { instant: true }); m.hp = m.maxHp = Math.ceil(m.maxHp * 1.5); m.roam = { x: d.x, y: d.y, region: -1 };
    }
    ev('drop', { id: d.id, x: d.x, y: d.y }); toast(`${why} [Supply drop: ${compass(d.x, d.y)}] Stand by it 3 s to open it.`, 'good');
  }
  function openDrop(d) {
    S.drops.splice(S.drops.indexOf(d), 1);
    let msg;
    if (d.reward === 'blueprint') { S.stock.tower = (S.stock.tower || 0) + 1; S.stock.house = (S.stock.house || 0) + 1; if (CUT.walls) { earn(8); msg = 'Plans and parts: a free tower, a free home and 8 scrap of fittings.'; } else { S.stock.wall = (S.stock.wall || 0) + 6; msg = 'Plans and parts: a free tower, a free home and 6 barricade posts.'; } }
    else if (d.reward === 'cache') { const g = 10 + 2 * S.night; S.hero.carry.scrap += g; msg = `A cash box: **${g} scrap** to carry home.`; }
    else if (d.reward === 'blessing') { S.picks.push('chest'); syncPicks(); if (S.picks.length === 1) G.rollOffer(); msg = 'A sealed case: a rare blessing.'; }
    else { S.survivors += 3; msg = 'Three survivors hiding in the crate join your town (+3 people).'; }
    ev('dropOpen', { id: d.id, x: d.x, y: d.y }); toast(msg, 'good');
  }
  function stepDrops(dt) {
    const h = S.hero;
    for (const d of [...S.drops]) {
      if (!h.dead && Math.hypot(h.x - d.x, h.y - d.y) < DROPS.reach) { d.prog += dt; if (d.prog >= DROPS.channel) openDrop(d); }
      else d.prog = Math.max(0, d.prog - dt * 2);
    }
  }
  return { PICKUP, scatterPickups, stepPickups, dropSupply, stepDrops };
}
