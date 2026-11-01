// [roam] Loot (M3): what dies leaves things on the ground. Scrap pieces from every machine (more from the big ones),
// now and then a weapon (a brute often, a walker always, with chips). Scrap settles for a moment, then flies to Kai on its
// own from anywhere near and is banked (the reward you watch arrive). A weapon lies with its name over it in its rarity's
// colour (Diablo II); ride or walk over it and it goes in the bag. A rare or better one lies unscanned until the lamp
// reaches it. From the bag: equip (your old weapon goes in the bag) or salvage for scrap (and chips if rare).
// Its own Rng stream. Offers G.equip(id), G.salvage(id), G.stepLoot(dt), G.dropWeapon, G.wield.
import { Rng, hashSeed } from '../../sim/rng.js';
import { DROPS, RARITY, rollWeapon, salvageOf } from '../../play/loot.js';
export function createLoot(G) {
  const { R, S, ev, town } = G, L = R.loot, rng = new Rng(hashSeed(G.seed, 'loot'));
  S.drops = []; S.bag = []; S.scrap = 0; S.chips = 0;
  S.guns.main.weapon = { base: S.guns.main.base, rarity: 'common', mods: [], seed: 0 };
  let did = 1;
  // a place near (x, y) that isn't inside a wall
  const spot = (x, y, r) => { for (let k = 0; k < 6; k++) { const a = rng.range(0, 6.283), d = rng.range(0.3, r), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (!town.blocked(px, py)) return [px, py]; } return [x, y]; };
  function dropScrap(x, y, n) { for (let i = 0; i < n; i++) { const [px, py] = spot(x, y, 1.6); S.drops.push({ id: did++, kind: 'scrap', x: px, y: py, v: 1, t: S.t, fly: 0 }); } }
  function dropWeapon(x, y, w) { const [px, py] = spot(x, y, 1.2); const d = { id: did++, kind: 'weapon', x: px, y: py, w, scanned: RARITY[w.rarity].scanned, t: S.t }; S.drops.push(d); ev('drop', { id: d.id, x: px, y: py, rarity: w.rarity }); return d; }
  function roll(table, x, y) { const D = DROPS[table]; if (!D) return; dropScrap(x, y, Math.floor(rng.range(D.scrap[0], D.scrap[1] + 1)));
    if (D.chips) { S.chips += D.chips; ev('chips', { n: D.chips, x, y }); }
    if (rng.chance(D.weapon)) dropWeapon(x, y, rollWeapon(rng, D.rarity)); }
  (G.onDie ||= []).push(d => roll(d.kind, d.x, d.y));
  // the weapon in hand changes: the gun takes its base and modifiers
  function wield(w) { const g = S.guns.main; g.weapon = w; g.base = w.base; g.mods = w.mods.slice(); g.cd = 0; ev('equip', { base: w.base, rarity: w.rarity, mods: w.mods.join(',') }); }
  const inBag = id => S.bag.findIndex(b => b.id === id);
  function equip(id) { const i = inBag(id); if (i < 0) return false; const b = S.bag[i], old = S.guns.main.weapon; S.bag.splice(i, 1, { id: did++, w: old }); wield(b.w); return true; }
  function salvage(id) { const i = inBag(id); if (i < 0) return false; const b = S.bag[i], p = salvageOf(b.w);
    S.bag.splice(i, 1); S.scrap += p.scrap; S.chips += p.chips; ev('salvage', { x: S.kai.x, y: S.kai.y, scrap: p.scrap, chips: p.chips, rarity: b.w.rarity }); return true; }
  let fullAt = -99;
  function stepLoot(dt) {
    const k = S.kai; if (k.dead) return;
    const take = k.riding ? L.takeRide : L.take;
    for (let i = S.drops.length - 1; i >= 0; i--) { const d = S.drops[i], dx = k.x - d.x, dy = k.y - d.y, r = Math.hypot(dx, dy);
      if (d.kind === 'scrap') {
        // it settles, then flies to her, faster and faster; banked when it reaches her
        if (r < L.grab) { S.scrap += d.v; S.drops.splice(i, 1); ev('pickup', { x: d.x, y: d.y, v: d.v }); continue; }
        if (d.fly > 0 || (r < L.pull && S.t - d.t > L.settle)) { d.fly = Math.min(L.flyMax, (d.fly || L.fly0) + L.flyAcc * dt); const sp = d.fly * dt; d.x += dx / r * Math.min(r, sp); d.y += dy / r * Math.min(r, sp); }
        else if (S.t - d.t > L.scrapLife) S.drops.splice(i, 1); }   // left lying a long time: the town takes it back
      else { if (!d.scanned && r < L.scan) { d.scanned = true; ev('scan', { id: d.id, x: d.x, y: d.y, rarity: d.w.rarity }); }
        if (r < take) { if (S.bag.length >= L.bag) { if (S.t - fullAt > 4) { fullAt = S.t; ev('bagFull', {}); } continue; }
          S.drops.splice(i, 1); S.bag.push({ id: d.id, w: d.w }); ev('loot', { id: d.id, rarity: d.w.rarity, base: d.w.base, x: d.x, y: d.y }); } } }
    if (S.drops.length > L.max) S.drops.splice(0, S.drops.length - L.max);
  }
  Object.assign(G, { equip, salvage, stepLoot, dropWeapon, wield });
}
