// [roam] Loot (M3; recipes since M6): what dies leaves things on the ground. Scrap pieces from every machine (more from the
// big ones), chips from the big ones, and now and then a recipe (a brute often, a walker always). Scrap settles for a
// moment, then flies to Kai on its own from anywhere near. A recipe lies with its name over it in its rarity's colour
// (Diablo II); ride or walk over it and Kai carries it (at risk until a bank: see risk.js); a rare or better one lies
// unscanned until the lamp reaches it. A recipe she already knows or carries turns into chips on the spot.
// Its own Rng stream. Offers G.stepLoot(dt), G.dropRecipe(x, y, id), G.wield(w), G.lootStat(key).
import { Rng, hashSeed } from '../../sim/rng.js';
import { DROPS, RARITY } from '../../play/loot.js';
import { RECIPES, rollRecipe, dupeChips } from '../../play/recipes.js';
export function createLoot(G) {
  const { R, S, ev, town } = G, L = R.loot, rng = new Rng(hashSeed(G.seed, 'loot'));
  S.drops = []; S.carry = []; S.scrap = 0; S.chips = 0;
  S.guns.main.weapon = { base: S.guns.main.base, rarity: 'common', mods: [], seed: 0 };
  let did = 1;
  // a place near (x, y) that isn't inside a wall
  const spot = (x, y, r) => { for (let k = 0; k < 6; k++) { const a = rng.range(0, 6.283), d = rng.range(0.3, r), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (!town.blocked(px, py)) return [px, py]; } return [x, y]; };
  function dropScrap(x, y, n) { for (let i = 0; i < n; i++) { const [px, py] = spot(x, y, 1.6); S.drops.push({ id: did++, kind: 'scrap', x: px, y: py, v: 1, t: S.t, fly: 0 }); } }
  function dropRecipe(x, y, r) { const [px, py] = spot(x, y, 1.2), rr = RECIPES[r]; const d = { id: did++, kind: 'recipe', r, x: px, y: py, w: { rarity: rr.rarity }, name: rr.name, scanned: RARITY[rr.rarity].scanned, t: S.t }; S.drops.push(d); ev('drop', { id: d.id, x: px, y: py, rarity: rr.rarity }); return d; }
  function roll(table, x, y) { const D = DROPS[table]; if (!D) return; dropScrap(x, y, Math.floor(rng.range(D.scrap[0], D.scrap[1] + 1)));
    if (D.chips) { S.chips += D.chips; ev('chips', { n: D.chips, x, y }); }
    if (rng.chance(D.recipe)) dropRecipe(x, y, rollRecipe(rng, D.rarity)); }
  (G.onDie ||= []).push(d => roll(d.kind, d.x, d.y));
  // the weapon in hand changes: the gun takes its base and modifiers
  function wield(w) { const g = S.guns.main; g.weapon = w; g.base = w.base; g.mods = w.mods.slice(); g.cd = 0; ev('equip', { base: w.base, rarity: w.rarity, mods: w.mods.join(',') }); }
  // the lamp's reach comes from the lamp part when the garage is in (G.bikeStat), else the defaults
  const lootStat = k => G.bikeStat ? G.bikeStat(k) : L[k];
  function stepLoot(dt) {
    const k = S.kai; if (k.dead) return;
    const take = k.riding ? L.takeRide : L.take, pull = lootStat('pull'), scan = lootStat('scan');
    for (let i = S.drops.length - 1; i >= 0; i--) { const d = S.drops[i], dx = k.x - d.x, dy = k.y - d.y, r = Math.hypot(dx, dy);
      if (d.kind === 'scrap') {
        // it settles, then flies to her, faster and faster; hers when it reaches her
        if (r < L.grab) { S.scrap += d.v; S.drops.splice(i, 1); ev('pickup', { x: d.x, y: d.y, v: d.v }); continue; }
        if (d.fly > 0 || (r < pull && S.t - d.t > L.settle)) { d.fly = Math.min(L.flyMax, (d.fly || L.fly0) + L.flyAcc * dt); const sp = d.fly * dt; d.x += dx / r * Math.min(r, sp); d.y += dy / r * Math.min(r, sp); }
        else if (S.t - d.t > L.scrapLife) S.drops.splice(i, 1); }   // left lying a long time: the town takes it back
      else { if (!d.scanned && r < scan) { d.scanned = true; ev('scan', { id: d.id, x: d.x, y: d.y, rarity: d.w.rarity }); }
        if (r < take) { S.drops.splice(i, 1); const rr = RECIPES[d.r];
          if ((S.known || []).includes(d.r) || S.carry.includes(d.r)) { const n = dupeChips(rr); S.chips += n; ev('dupe', { r: d.r, chips: n, x: d.x, y: d.y, rarity: rr.rarity }); }
          else { S.carry.push(d.r); ev('loot', { id: d.id, r: d.r, rarity: rr.rarity, x: d.x, y: d.y }); } } } }
    if (S.drops.length > L.max) S.drops.splice(0, S.drops.length - L.max);
  }
  Object.assign(G, { stepLoot, dropRecipe, wield, lootStat });
}
