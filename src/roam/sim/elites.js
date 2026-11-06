// [roam] Elite machines (M6b): a machine born out of sight may carry a mod (play/elites.js): more often in harder areas and
// at night. It's tougher and acts its mod (speed, a double hit or two bolts, glancing plating, a burning or soaking trail);
// when it dies it drops that mod on the ground, which Kai carries (at risk) until a bank sends it to the garage.
// Its own Rng stream. Offers G.stepElites(dt).
import { Rng, hashSeed } from '../../sim/rng.js';
import { ELITES, ELITE_IDS } from '../../play/elites.js';
import { MOD_NAME } from '../../play/recipes.js';
export function createElites(G) {
  const { R, S, ev, town } = G, E = R.elites, rng = new Rng(hashSeed(G.seed, 'elites'));
  let did = 900000;   // drop ids of their own (never meet loot's)
  // [missions] elites carry mods: none until the chapter opens them (S.modsLocked)
  (G.onSpawn ||= []).push(d => { if (d.boss || S.modsLocked) return; const lv = G.levelAt ? G.levelAt(d.x, d.y) : 1, p = (E.chance + E.perLevel * (lv - 1)) * (S.night ? E.night : 1);
    if (!rng.chance(p)) return; const id = ELITE_IDS[rng.int(ELITE_IDS.length)], X = ELITES[id];
    d.elite = id; d.hp *= E.hp; d.maxHp *= E.hp; if (X.spd) d.spd = X.spd; if (X.dmgMult) d.dmgMult = X.dmgMult; if (X.twin) d.twin = true; if (X.glance) d.glance = X.glance; d.trailT = 0; });
  (G.onDie ||= []).push(d => { if (!d.elite) return; const X = ELITES[d.elite];
    let x = d.x, y = d.y; for (let k = 0; k < 6 && town.blocked(x, y); k++) { x = d.x + rng.range(-1, 1); y = d.y + rng.range(-1, 1); }
    S.drops.push({ id: did++, kind: 'mod', m: X.mod, x, y, w: { rarity: 'rare' }, name: MOD_NAME[X.mod] + ' Mod', scanned: true, t: S.t }); ev('drop', { x, y, rarity: 'rare', mod: X.mod }); });
  function stepElites(dt) { for (const d of S.dead) { if (!d.elite) continue; const X = ELITES[d.elite]; if (!X.trail || Math.hypot(d.vx, d.vy) < 0.3) continue;
    if ((d.trailT -= dt) <= 0) { d.trailT = E.trailEvery; G.deliver(X.trail, d.x, d.y, E.trailR, E.trailPower); } } }
  Object.assign(G, { stepElites });
}
