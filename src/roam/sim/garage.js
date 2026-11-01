// [roam] The garage (M6, docs/design/implementation-plan.md): the town's own garage site becomes a service site (play/sites.js)
// with a workbench and a stash. Kai's gear lives here:
// - recipes she has banked are known for good (S.known); building from one costs banked scrap and chips: a weapon or a part
//   goes in the stash, a mod into her mods.
// - five slots on the bike: weapon, engine, frame, lamp, tyres. Equip from the stash (the old one goes back), salvage what
//   she doesn't want. Only at a workbench.
// - a weapon has built-in mods and empty sockets; a mod goes into a socket for good (WoW gems, Gabriel Nov 1): it can't
//   come out, and socketing over it destroys the old one. One element per weapon.
// - every item has a level: upgrading costs banked scrap and is capped by Kai's level (areas cleaned + 1 until M7). The
//   weapon's level is its damage (the recipe never sets damage); a part's level raises the stats it `grow`s.
// The bike's numbers come from its parts (G.bikeStats), so vehicle, risk and loot read them at call time. A dazzle lamp
// slows machines in its beam. No randomness here.
// Offers G.learn(ids), G.build(id), G.equipItem(uid), G.salvageItem(uid), G.upgrade(slot), G.socket(uid, i, mod),
// G.bikeStats(), G.bikeStat(k), G.gunMult(), G.levelCap(), G.atBench(), G.stepGarage(dt).
import { RECIPES, STARTING, ELEMENT_MODS, costOf } from '../../play/recipes.js';
import { PARTS, STOCK, PART_SLOTS } from '../../play/parts/bike.js';
import { SITES, offers } from '../../play/sites.js';
export const GEAR_SLOTS = ['weapon', ...PART_SLOTS];
export function createGarage(G) {
  const { R, S, ev, town } = G, K = R.garage;
  S.known = STARTING.slice(); S.stash = []; S.mods = {}; S.gear = {};
  let uid = 1;
  // ---------- the garage site: the town's own garage (world/sites.js), the forecourt in front of its roller doors ----------
  { const gs = ((town.W && town.W.sites) || []).find(s => s.id === 'garage');
    if (gs) { const rollers = gs.anchors.filter(a => a.use === 'roller'), mx = rollers.length ? rollers.reduce((q, a) => q + a.x, 0) / rollers.length : gs.x, my = rollers.length ? rollers.reduce((q, a) => q + a.y, 0) / rollers.length : gs.y;
      // the doors run along the wall (their angle); the forecourt is out from the wall, on the side that isn't the building
      const ang = (rollers[0] ? rollers[0].ang : gs.rot || 0) + Math.PI / 2; let p = null;
      for (const sg of [1, -1]) { const nx = Math.cos(ang) * sg, ny = Math.sin(ang) * sg, x = mx + nx * K.door, y = my + ny * K.door; if (!town.blocked(x, y) && town.blocked(mx - nx * 3, my - ny * 3) && !p) p = { x, y }; }
      if (!p) { let bd = 1e9; for (const a of gs.anchors) if (a.kind === 'apron' && a.zone === 'garage' && !town.blocked(a.x, a.y)) { const q = Math.hypot(a.x - mx, a.y - my); if (q < bd) { bd = q; p = a; } } }
      p = p || { x: gs.x, y: gs.y }; const q = G.addSite('garage', p.x, p.y);
      // [m6c] its dressing (play/sites.js), set out in front of the doors; what would land in a wall is left out
      const ox = p.x - mx, oy = p.y - my, ol = Math.hypot(ox, oy) || 1, nx = ox / ol, ny = oy / ol, wx = -ny, wy = nx;
      q.dress = []; for (const D of SITES.garage.dress || []) { const x = mx + wx * D.u + nx * D.v, y = my + wy * D.u + ny * D.v; if (!town.blocked(x, y)) q.dress.push({ k: D.k, x, y, a: Math.atan2(wy, wx) }); } }
    else { const camp = S.sites[0]; for (const s of ['stash', 'workbench']) if (!camp.services.includes(s)) camp.services.push(s); } }   // a map without a garage: the camp does it
  // ---------- items ----------
  function make(rid) { const r = RECIPES[rid];
    if (r.kind === 'weapon') return { uid: uid++, kind: 'weapon', r: rid, slot: 'weapon', base: r.base, rarity: r.rarity, mods: r.mods.slice(), sockets: Array(r.sockets).fill(null), level: 1 };
    return { uid: uid++, kind: 'part', r: rid, slot: r.slot, part: r.part, rarity: r.rarity, level: 1 }; }
  for (const rid of STARTING) { const it = make(rid); S.gear[it.slot] = it; }
  const weaponOf = it => ({ base: it.base, rarity: it.rarity, mods: [...it.mods, ...it.sockets.filter(Boolean)], seed: it.uid, level: it.level });
  // ---------- the bike's numbers, from its parts and their levels ----------
  let stats = null;
  function bikeStats() { if (stats) return stats;
    const v = {}; for (const slot of PART_SLOTS) { const it = S.gear[slot], P = PARTS[it.part], o = { ...STOCK[slot], ...P.stats };
      for (const k in P.grow) if (typeof o[k] === 'number') o[k] *= 1 + P.grow[k] * (it.level - 1); v[slot] = o; }
    const E = v.engine, F = v.frame, L = v.lamp, T = v.tyres;
    stats = { ...R.bike, top: E.top * F.topMult, accel: E.accel, turn: T.turn * F.turnMult, bounce: T.bounce, slide: T.slide, lock: T.lock, crashMult: T.crashMult, smashKeep: T.smashKeep,
      ramMult: E.ramMult * (F.ramMult || 1), ramKeep: E.ramKeep, ramHeavy: F.ramHeavy, hp: Math.round(F.hp), soak: F.soak, pull: L.pull, scan: L.scan, dazzle: L.dazzle };
    return stats; }
  const bikeStat = k => bikeStats()[k];
  // the bike's health follows the frame (keeping how hurt it is)
  function refit() { stats = null; const b = S.bike, f = b.maxHp ? b.hp / b.maxHp : 1; b.maxHp = bikeStat('hp'); b.hp = Math.round(b.maxHp * f * 100) / 100; }
  refit(); S.bike.hp = S.bike.maxHp;
  const gunMult = () => 1 + K.dmgPerLevel * (S.gear.weapon.level - 1);
  const cleaned = () => (S.areas || []).filter(a => a.root === undefined && a.state === 'clean').length;
  const levelCap = () => K.capPerLevel * (cleaned() + 1);
  const upCost = it => Math.round((it.slot === 'weapon' ? K.weaponCost : K.partCost) * it.level);
  const atBench = () => { const k = S.kai; if (k.dead) return null; for (const q of S.sites) if (offers(q, 'workbench') && Math.hypot(q.x - k.x, q.y - k.y) < R.risk.bankR) return q; return null; };
  const no = why => { ev('garageNo', { why }); return false; };
  // ---------- the workbench ----------
  function learn(ids) { for (const r of ids) if (!S.known.includes(r)) { S.known.push(r); ev('learn', { r }); } S.known.sort(); }
  function build(rid) { const r = RECIPES[rid]; if (!r) return no('unknown'); if (!atBench()) return no('bench'); if (!S.known.includes(rid)) return no('unknown');
    const c = costOf(r); if (S.bank.scrap < c.scrap || S.bank.chips < c.chips) return no('funds');
    S.bank.scrap -= c.scrap; S.bank.chips -= c.chips;
    if (r.kind === 'mod') S.mods[r.mod] = (S.mods[r.mod] || 0) + 1; else S.stash.push(make(rid));
    ev('built', { r: rid, rarity: r.rarity, kind: r.kind }); return true; }
  function equipItem(id) { if (!atBench()) return no('bench'); const i = S.stash.findIndex(it => it.uid === id); if (i < 0) return no('missing');
    const it = S.stash[i], old = S.gear[it.slot]; S.stash.splice(i, 1, old); S.gear[it.slot] = it;
    if (it.slot === 'weapon') G.wield(weaponOf(it)); else refit();
    ev('fit', { r: it.r, slot: it.slot }); return true; }
  function salvageItem(id) { if (!atBench()) return no('bench'); const i = S.stash.findIndex(it => it.uid === id); if (i < 0) return no('missing');
    const it = S.stash[i], c = costOf(RECIPES[it.r]), sc = Math.round(c.scrap * K.salvage + upCostSpent(it) * K.salvage), ch = Math.floor(c.chips * K.salvage);
    S.stash.splice(i, 1); S.bank.scrap += sc; S.bank.chips += ch; ev('salvaged', { r: it.r, scrap: sc, chips: ch }); return true; }
  // what upgrading an item has cost so far (salvage gives part of it back)
  const upCostSpent = it => { let t = 0; for (let l = 1; l < it.level; l++) t += Math.round((it.slot === 'weapon' ? K.weaponCost : K.partCost) * l); return t; };
  function upgrade(slot) { const it = S.gear[slot]; if (!it) return no('missing'); if (!atBench()) return no('bench'); if (it.level >= levelCap()) return no('cap');
    const c = upCost(it); if (S.bank.scrap < c) return no('funds'); S.bank.scrap -= c; it.level++;
    if (slot === 'weapon') G.wield(weaponOf(it)); else refit();
    ev('upgraded', { slot, level: it.level, scrap: c }); return true; }
  // a mod into a socket, for good; over an old one, the old one is destroyed
  function socket(id, i, mod) { if (!atBench()) return no('bench'); const it = S.gear.weapon.uid === id ? S.gear.weapon : S.stash.find(q => q.uid === id);
    if (!it || it.kind !== 'weapon' || !(i >= 0 && i < it.sockets.length)) return no('missing'); if (!(S.mods[mod] > 0)) return no('nomod');
    if (ELEMENT_MODS.has(mod) && [...it.mods, ...it.sockets.filter((m, j) => j !== i && m)].some(m => ELEMENT_MODS.has(m))) return no('element');
    const lost = it.sockets[i]; S.mods[mod]--; it.sockets[i] = mod;
    if (it === S.gear.weapon) G.wield(weaponOf(it));
    ev('socketed', { r: it.r, mod, lost: lost || '' }); return true; }
  // ---------- each step: the dazzle lamp ----------
  function stepGarage() { const k = S.kai, dz = bikeStat('dazzle'); if (!dz || !k.riding || k.dead) return; const b = S.bike, ca = Math.cos(b.ang), sa = Math.sin(b.ang);
    for (const d of S.dead) { if (d.boss) continue; const dx = d.x - b.x, dy = d.y - b.y, r = Math.hypot(dx, dy); if (r > dz || r < 0.5) continue; if ((dx * ca + dy * sa) / r < 0.88) continue; d.vx *= K.dazzleSlow; d.vy *= K.dazzleSlow; } }
  Object.assign(G, { learn, build, equipItem, salvageItem, upgrade, socket, bikeStats, bikeStat, gunMult, levelCap, atBench, stepGarage, weaponOf, upCost });
}
