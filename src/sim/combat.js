// Damage and death: tower stats and crews, defence and hero dps, hits on buildings and the dead,
// ruins, kills and their loot, explosions, the hero going down and coming back, projectiles, towers and the keep shooting.
import { BIG, CREW_NEED, CUT, HEAT, LEVEL, PRESENCE, TENSION } from './state.js';
import { BUILDINGS, KEEP, START } from '../content/buildings.js';
import { MERC, PURSE } from '../content/heroes.js';
import { MOBS } from '../content/mobs.js';
import { idx } from './mapgen.js';

export function createCombat(G) {
  const {
    S, c, combo, compass, dropLive, earn, ev, has, houseCap, keep, live, map, mastery, mobById, near, owns, pop, rng, rule, syncPicks,
    toast
  } = G;
  const towerMult = () => (1 + S.P.towerDmg + (G.sc && !CUT.crew ? G.sc.towerBonus() : 0) + (owns('police') ? 0.15 : 0) + (G.story ? G.story.bonus.towers() : 0)) * (mastery('deadeye') ? 1.4 : 1);
  const keepMult = () => (1 + S.P.keepDmg) * (mastery('deadeye') ? 1.4 : 1);
  function towerStats(b) {
    const B = BUILDINGS.tower, l = b.level - 1;
    const h = S.hero, hd = h.dead ? Infinity : Math.hypot(h.x - b.x, h.y - b.y);
    // the hero's presence (everyone, from day 1): towers near you shoot faster and further. Rallying Cry widens and deepens it.
    const presR = PRESENCE.r + (has('rally') ? 3 : 0), near = hd < presR || (combo('rally', 'watch') && b.paired && !h.dead);
    let range = (B.range[l] + S.P.towerRange + (owns('eiffel') ? 1.5 : 0) + (has('watch') && b.paired ? 2 : 0) + (map.high[idx(Math.floor(b.x), Math.floor(b.y))] ? 2 : 0) + (near ? PRESENCE.range : 0) - (rule('fog') && S.phase === 'night' ? 2 : 0)) * (S.phase === 'night' ? G.W8().range : 1);
    let dmg = B.dmg[l] * towerMult() * (has('bastion') && b.walled ? 1.4 : 1);
    let rate = B.rate[l] / S.P.towerRate;
    if (S.P.kingpin && S.bountyT > 0 && hd < 9) rate /= 1.4;
    if (G.HC.marshal && hd < 6) rate /= G.HC.marshal;
    if (near) rate /= PRESENCE.rate * (has('rally') ? 1.15 : 1);
    if (G.attrTower) rate /= G.attrTower(b, near);   // [hero3] INT near the hero, Rally Cry, Skirmish Commander
    if (h.dead) rate /= TENSION.downRate;   // the hero is down: the town loses heart (25% slower)
    return { range, dmg, rate, shots: has('volley') && b.level === 3 ? 2 : 1, presence: near };
  }
  // towers are manned by people from your homes, oldest tower first; a tower without its full crew stays silent
  let crewKey = -1, crewCache = null;
  const dropCrew = () => { crewCache = null; };   // people or towers changed: re-man the towers
  function crewing() {
    const key = (S.occVersion || 0) * 1000 + (S.phase === 'night' ? 1 : 0);
    if (S.phase === 'night' && crewCache && crewCache.night === S.night) return crewCache;   // posts are fixed for the night
    if (key === crewKey && crewCache) return crewCache;
    let free = pop(); const manned = new Set(); let need = 0;
    for (const b of S.buildings.filter(x => x.type === 'tower' && !x.ruined).sort((a, c) => a.id - c.id)) { const n = CREW_NEED[b.level - 1]; need += n; if (free >= n) { manned.add(b.id); free -= n; } }
    crewKey = key; crewCache = { manned, free, need, people: pop(), night: S.phase === 'night' ? S.night : null };
    return crewCache;
  }
  const manned = b => crewing().manned.has(b.id);
  function cacheNeighbours() {
    for (const b of S.buildings) if (b.type === 'tower') { b.paired = near(b, 'tower', 4); b.walled = near(b, 'wall', 3); }
  }
  function defenceDps() {
    cacheNeighbours();
    let d = 0;
    for (const b of live()) if (b.type === 'tower' && manned(b) && G.powered(b)) { const t = towerStats(b); d += b.spec ? G.specDps(b, t) : t.dmg * t.shots / t.rate; }   // [towers] a specialised tower: sim/towers.js
    if (!keep.ruined) d += KEEP.dmg[keep.level - 1] * keepMult() * S.P.keepRate / KEEP.rate * KEEP.shots[keep.level - 1] + (has('ballista') ? 8 / 3 * 2 : 0);
    return d;
  }
  function heroDmg() { return G.HC.attack ? (G.HC.attack.dmg + S.P.heroDmg + (mastery('whirlwind') ? 1 : 0)) * S.P.heroDmgMult * (1 + LEVEL.dmg * (S.lvl - 1)) * (S.drained === S.night ? 0.75 : 1) * (G.HC.dmgMult || 1) * (G.attrDmg ? G.attrDmg() : 1) : 0; }   // [hero3] attrDmg: STR and the powers
  function heroRate() { return G.HC.attack ? G.HC.attack.rate / S.P.heroRate / (mastery('champion') ? 1.3 : 1) / (G.attrRate ? G.attrRate() : 1) : 1; }   // [hero3] attrRate: AGI and the powers
  function heroDps() {
    if (!G.HC.attack) return G.HC.ability && G.HC.ability.id === 'hire' ? Math.min(4, Math.floor(S.gold / 15)) * MERC.dmg / MERC.rate : 0;
    return heroDmg() / heroRate() * (mastery('whirlwind') ? 1.6 : has('wardance') ? 1.25 : 1);
  }

  // ---------- combat ----------
  function damageBuilding(b, d, by) {
    if (b.ruined || d <= 0) return;
    if (b.type === 'keep') {   // the hall falls over ~30 s, not in a blink: at most 3% of its health a second, half that with the hero on its steps
      if (S.time - (b.winT || 0) >= 1) { b.winT = S.time; b.winD = 0; }
      const guarded = !S.hero.dead && Math.hypot(S.hero.x - b.x, S.hero.y - b.y) < b.r + TENSION.guardR;
      d = Math.min(d, Math.max(0, b.maxHp * TENSION.hallCap * (guarded ? TENSION.hallGuard : 1) - (b.winD || 0))); b.winD = (b.winD || 0) + d; if (d <= 0) return;
    }
    if (G.HC.ward && !S.hero.dead && Math.hypot(S.hero.x - b.x, S.hero.y - b.y) < 5) d *= G.HC.ward;
    if (G.folkGuard) d *= G.folkGuard(b);   // [folk] sandbags and watch-posts the folk raised
    if (G.attrWard) d *= G.attrWard(b);   // [hero3] Iron Warden
    S.cur.taken[b.type] = (S.cur.taken[b.type] || 0) + Math.min(d, b.hp);
    b.hp -= d; ev('hitB', { id: b.id });
    if (b.type === 'wall' && by && mastery('fortress')) hitMob(by, d * 0.5, 'thorns');
    if (b.hp <= 0) ruin(b);
  }
  function ruin(b) {
    if (b.type === 'keep' && has('bell') && !S.P.bellUsed) {
      S.P.bellUsed = true; b.hp = Math.round(b.maxHp * 0.3);
      for (const m of [...S.mobs]) if (Math.hypot(m.x - b.x, m.y - b.y) < 8) hitMob(m, 20, 'keep');
      ev('bell'); toast('The Bell of Last Light rings. The keep holds.', 'good'); return;
    }
    b.ruined = true; b.fell = true; b.hp = 0; G.vacate(b, true); dropLive(); ev('ruin', { id: b.id });
    if (b.type === 'keep') { G.endRun(false); return; }
    S.cur.lost.push(b.type); S.stats.buildingsLost++; (S.cur.fellB || (S.cur.fellB = [])).push({ id: b.id, type: b.type, level: b.level });
    if (rule('raiders') && S.phase === 'night') S.gold = Math.max(0, S.gold - 2);
    if (S.phase === 'night' && !S.nightFlags.breach && b.type !== 'wall') { S.nightFlags.breach = true; ev('breach', { x: b.x, y: b.y }); toast(`[Breach: ${compass(b.x, b.y)}] The dead are inside. Get there!`, 'bad'); }
    // Salvage: a quarter of what the building cost (never a barricade post: no profit in losing things)
    if (has('salvage') && b.type !== 'wall') earn(Math.max(1, Math.floor(G.investOf(b) * (combo('salvage', 'mortar') ? 0.4 : 0.25))));
    if (b.type === 'house' && S.P.shelter) { S.stats.housesLost++; toast('A home fell. Its families hid in the safe room.', 'bad'); }
    else if (b.type === 'house') {
      // a fallen home: half its people rise with the dead (lost for good), the rest flee to the Camp (homeless until it is rebuilt)
      const folk = b.folk ?? houseCap(b), n = Math.round(folk / 2), people = n, fled = folk - n; S.mourned = (S.mourned || 0) + people;
      b.folk = 0; S.homeless = (S.homeless || 0) + fled; S.stats.fled = (S.stats.fled || 0) + fled;
      S.cur.risen += n; S.stats.risen += n; S.stats.housesLost++; S.stats.peopleLost = (S.stats.peopleLost || 0) + people;
      (S.cur.rose || (S.cur.rose = [])).push({ id: b.id, n, people, fled });
      for (let k = 0; k < n; k++) { const m = G.spawnMob('risen', b.x + rng.range(-1, 1), b.y + rng.range(-1, 1), { instant: false }); m.rise = 0.4; }
      dropCrew();
      toast(n ? `A home fell. ${n === 1 ? 'One of its people rises' : `${n} of its people rise`} with the dead${fled ? `; ${fled} fled to the Camp` : ''}.` : `A home fell${fled ? `; ${fled} fled to the Camp` : ''}. Rebuild it to take them in.`, 'bad');
    } else toast(`${BUILDINGS[b.type].name} destroyed. Rebuild it by hand.`, 'bad');
  }
  function hitMob(m, d, src) {
    if (m.hp <= 0) return;
    if (G.attrHit) d *= G.attrHit(m, src);   // [hero3] GOV allies, the hawk's mark, Smoke Step
    if (src === 'hero' && has('execute') && (m.hp - d) / m.maxHp < 0.25) d = m.hp;
    // Marked: whatever the hero hits takes more from the towers for a few seconds (the Marked blessing makes it longer and deeper)
    if (src === 'hero') m.markT = PRESENCE.markT * (S.P.mark ? 2 : 1);
    if (src === 'tower' && m.markT > 0) d *= S.P.mark ? 1.6 : PRESENCE.mark;
    S.cur.dmg[src] = (S.cur.dmg[src] || 0) + Math.min(d, m.hp);
    m.hp -= d; m.lastHit = d; ev('hitM', { id: m.id, src, dmg: +d.toFixed(2) });
    if (m.hp <= 0) { S.cur.kills[src] = (S.cur.kills[src] || 0) + 1; S.stats.killsBy[src] = (S.stats.killsBy[src] || 0) + 1; killMob(m, src); }
  }
  function killMob(m, src) {
    const i = S.mobs.indexOf(m); if (i < 0) return;
    if (MOBS[m.kind].animal) { S.mobs.splice(i, 1); mobById.delete(m.id); ev('die', { id: m.id, kind: m.kind, x: m.x, y: m.y, src: src || null, dmg: +(m.lastHit || 0).toFixed(2) }); S.food += MOBS[m.kind].food; S.stats.hunted = (S.stats.hunted || 0) + 1; ev('pickup', { id: m.id, kind: 'food', x: m.x, y: m.y, n: MOBS[m.kind].food }); if (src === 'hero') G.gainXp(1); return; }
    S.mobs.splice(i, 1); mobById.delete(m.id); S.kills++; ev('die', { id: m.id, kind: m.kind, x: m.x, y: m.y, src: src || null, dmg: +(m.lastHit || 0).toFixed(2) }); G.addSpike(HEAT.kill); S.salvage = (S.salvage || 0) + START.salvage * (MOBS[m.kind].size >= BIG ? 4 : 1);
    const bountyOn = S.bountyT > 0 && G.HC.ability && G.HC.ability.id === 'bounty' && !S.hero.dead && Math.hypot(m.x - S.hero.x, m.y - S.hero.y) <= (G.HC.quarter ? 99 : G.HC.ability.radius) + S.P.bountyRadius;
    if (bountyOn) {
      const big = MOBS[m.kind].size >= BIG, pay = (big ? G.HC.ability.bigGold * (mastery('warband') ? 3 : 1) : G.HC.ability.gold) + S.P.bountyGold;
      earn(pay); S.stats.bountyGold = (S.stats.bountyGold || 0) + pay; ev('bountyGold', { x: m.x, y: m.y, gold: pay });
    }
    // ability twists follow the ability you kept from your Calling: War Cry / Volley, or Bounty for a Scavver
    if (G.HC.cryPays && ((S.hero.guardT > 0 && Math.hypot(m.x - S.hero.x, m.y - S.hero.y) < 7) || bountyOn)) { earn(G.HC.cryPays); ev('bountyGold', { x: m.x, y: m.y, gold: G.HC.cryPays }); }
    if (G.HC.volleyPays && (src === 'volley' || bountyOn)) { earn(G.HC.volleyPays); ev('bountyGold', { x: m.x, y: m.y, gold: G.HC.volleyPays }); }
    S.stats.killsByKind[m.kind] = (S.stats.killsByKind[m.kind] || 0) + 1;
    if (m.kind === 'guardian' || m.kind === 'gravelord') S.stats.bosses++;
    if (m.finale === S.season.n || (m.unique && S.unique && S.unique.season === S.season.n && S.night <= S.season.end)) G.finale(true);   // the season's finale monster
    if (m.unique && S.unique) { S.unique.slain = true; S.picks.push('nest'); syncPicks(); toast(`[Unique Monster slain: ${m.unique}] A legendary blessing waits at dawn.`, 'good'); if (G.story) { G.story.chron(`Killed ${m.unique}, the unique monster.`, 5, ['unique']); G.story.grant('uniqueSlayer'); } }
    const D = MOBS[m.kind];
    if (S.P.lifesteal && !S.hero.dead && Math.hypot(m.x - S.hero.x, m.y - S.hero.y) < 6) S.hero.hp = Math.min(S.hero.maxHp, S.hero.hp + S.P.lifesteal);
    if (S.P.bounty && S.kills % 3 === 0) earn(1);
    if (src === 'hero' || src === 'volley' || src === 'merc') G.gainXp(MOBS[m.kind].size >= BIG ? 6 : 1);
    if (m.trial && G.story) G.story.trialWon(m.trial);
    if (src === 'hero' && combo('blood', 'bounty')) earn(1);
    if (D.burst) { dropLive(); explode(m.x, m.y, D.burst); }
    if (D.dropsChest && rng.chance(D.dropsChest)) { const ch = { id: S.nextId++, x: m.x, y: m.y }; S.chests.push(ch); ev('chest', { id: ch.id }); toast('Something dropped a chest. Walk over it.', 'good'); }
    if (G.HC.collects && m.kind !== 'risen') {
      const big = PURSE.value[m.kind];
      if (big || rng.chance(PURSE.chance * S.P.purseChance)) { const p = { id: S.nextId++, x: m.x, y: m.y, life: PURSE.life, value: ((big || PURSE.value.default) + S.P.purseBonus) * (mastery('tycoon') ? 2 : 1) }; S.purses.push(p); ev('purse', { id: p.id }); }
    }
  }
  function explode(x, y, burst) {
    ev('explode', { x, y, r: burst.radius });
    const dmg = burst.dmg * Math.sqrt(G.hpS(S.night));
    for (const b of live().concat(keep.ruined ? [] : [keep])) if (Math.hypot(b.x - x, b.y - y) < burst.radius + b.r) damageBuilding(b, dmg);
    if (!S.hero.dead && Math.hypot(S.hero.x - x, S.hero.y - y) < burst.radius) hurtHero(dmg * 0.5);
    for (const a of S.allies) if (Math.hypot(a.x - x, a.y - y) < burst.radius) a.hp -= dmg;
  }
  function hurtHero(d) {
    const h = S.hero; if (h.dead) return;
    if (h.guardT > 0) d *= 1 - G.HC.ability.guard;
    if (G.attrHurt) { d = G.attrHurt(d); if (d <= 0) return; }   // [hero3] AGI's dodge, Unbreakable
    if (has('last') && !S.nightFlags.lastUsed && h.hp - d < h.maxHp * 0.3) { S.nightFlags.lastUsed = true; S.nightFlags.lastT = 4; ev('lastStand'); toast('Last Stand!', 'good'); }
    S.cur.taken.hero = (S.cur.taken.hero || 0) + d; h.hp -= d; ev('hitH');
    if (S.nightFlags.lastT > 0 && h.hp < 1) h.hp = 1;
    if (h.hp <= 0) heroDown();
  }
  // death costs the night: back at dawn or after 30 s (whichever comes first), the towers shoot slower meanwhile,
  // and whatever you were carrying stays where you fell
  function heroDown() {
    const h = S.hero; h.dead = true; h.respawn = mastery('lifeline') ? TENSION.respawn / 3 : TENSION.respawn; h.target = null; h.path = null;
    S.cur.heroDeaths++; S.stats.heroDeaths++;
    const cs = h.carry.scrap, cf = h.carry.food, dropped = [];
    if (cs > 0) { const p = { id: S.nextId++, x: h.x, y: h.y, kind: 'scrap', n: cs, dropped: true }; S.pickups.push(p); dropped.push(`${cs} scrap`); }
    if (cf > 0) { const p = { id: S.nextId++, x: h.x + 0.5, y: h.y, kind: 'food', n: cf, dropped: true }; S.pickups.push(p); dropped.push(`${cf} food`); }
    h.carry.scrap = 0; h.carry.food = 0;
    ev('heroDie', { x: h.x, y: h.y, respawn: h.respawn, dropped: { scrap: cs, food: cf } });
    toast(`You fell. Back at the hall in ${Math.round(h.respawn)} seconds (or at dawn); the towers shoot slower without you.${dropped.length ? ` You dropped ${dropped.join(' and ')} where you fell.` : ''}`, 'bad');
  }
  function heroBack() {
    const h = S.hero; h.dead = false; h.respawn = 0; h.hp = h.maxHp; h.x = c; h.y = c + 3.5; G.unstickHero(); ev('heroBack');
  }
  function fire(from, x0, y0, target, dmg, src, speed = 18, extra = {}) {
    if (src !== 'hero' && has('hunter') && MOBS[target.kind] && MOBS[target.kind].size >= BIG) dmg *= 1.6;
    const p = { id: S.nextId++, x: x0, y: y0, z: from, target: target.id, tx: target.x, ty: target.y, dmg, src, speed, life: 2, enemy: false, ...extra };
    S.projectiles.push(p); ev('shot', { id: p.id, src }); if (src !== 'hero') G.addSpike(HEAT.shot);
  }
  function spit(m, target) {
    const tid = target === S.hero ? 'hero' : target.ally ? `a${target.id}` : target.id;
    const p = { id: S.nextId++, x: m.x, y: m.y, z: 1, target: tid, tx: target.x, ty: target.y, dmg: MOBS.spitter.dmg, src: 'spit', speed: 9, life: 2, enemy: true };
    S.projectiles.push(p); ev('shot', { id: p.id, src: 'spit' });
  }

  function nearestMobs(x, y, range, k) {
    const out = [];
    for (const m of S.mobs) { if (m.rise < 1) continue; const d = Math.hypot(m.x - x, m.y - y); if (d < range) out.push([d, m]); }
    out.sort((a, b) => a[0] - b[0]); return out.slice(0, k).map(q => q[1]);
  }
  function stepTowers(dt) {
    for (const b of live()) {
      if (b.type !== 'tower' || !manned(b) || !G.powered(b)) continue;
      const t = towerStats(b);
      if (mastery('rain')) { b.rainT += dt; if (b.rainT >= 6) { b.rainT = 0; for (const m of nearestMobs(b.x, b.y, t.range, 3)) fire(3, b.x, b.y, m, t.dmg, 'tower'); } }
      // [towers] begin: a specialised tower fires its own way (sim/towers.js)
      if (b.spec) { G.stepSpec(b, t, dt); continue; }
      // [towers] end
      b.cd -= dt; if (b.cd > 0) continue;
      const near2 = nearestMobs(b.x, b.y, t.range, 2); if (!near2.length) continue;
      for (let k = 0; k < t.shots; k++) {
        b.shotN++;
        fire(3, b.x, b.y, near2[k % near2.length], t.dmg, 'tower', 18, has('fire') && b.shotN % 5 === 0 ? { burn: true } : {});
      }
      b.cd = t.rate;
    }
    if (!keep.ruined) {
      const l = keep.level - 1, range = (KEEP.range[l] + S.P.towerRange) * G.W8().range, dmg = KEEP.dmg[l] * keepMult();
      keep.cd -= dt;
      if (keep.cd <= 0) { const ms = nearestMobs(c, c, range, 2); if (ms.length) { for (let k = 0; k < KEEP.shots[l]; k++) fire(4, c, c, ms[k % ms.length], dmg, 'keep'); keep.cd = KEEP.rate / S.P.keepRate; } }
      if (has('ballista')) {
        keep.boltT -= dt;
        if (keep.boltT <= 0) {
          const tgt = nearestMobs(c, c, 12, 1)[0];
          if (tgt) {
            keep.boltT = 3; const dx = tgt.x - c, dy = tgt.y - c, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, ex = c + ux * 12, ey = c + uy * 12;
            for (const m of [...S.mobs]) { const px = m.x - c, py = m.y - c, along = px * ux + py * uy; if (along < 0 || along > 12) continue; if (Math.abs(px * uy - py * ux) < 0.6) hitMob(m, 8, 'keep'); }
            ev('bolt', { x0: c, y0: c, x1: ex, y1: ey });
          }
        }
      }
    }
  }
  function stepProjectiles(dt) {
    for (const p of [...S.projectiles]) {
      let tgt;
      if (p.target === 'hero') tgt = S.hero.dead ? null : S.hero;
      else if (typeof p.target === 'string' && p.target[0] === 'a') tgt = S.allies.find(a => `a${a.id}` === p.target) || null;
      else tgt = p.enemy ? S.byId.get(p.target) : mobById.get(p.target);
      if (tgt) { p.tx = tgt.x; p.ty = tgt.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy); p.life -= dt;
      if (d < 0.4 || p.life <= 0) {
        // [towers] begin: a mortar shell bursts where it lands
        if (p.shell) { if (d < 0.8) G.shellBurst(p); S.projectiles.splice(S.projectiles.indexOf(p), 1); ev('shotEnd', { id: p.id }); continue; }
        // [towers] end
        if (tgt && d < 0.8) {
          if (p.enemy) { if (tgt === S.hero) hurtHero(p.dmg); else if (tgt.ally) tgt.hp -= p.dmg; else damageBuilding(tgt, p.dmg); }
          else { if (p.burn) tgt.burn = { t: 4, dps: 1 }; hitMob(tgt, p.dmg, p.src); }
        }
        S.projectiles.splice(S.projectiles.indexOf(p), 1); ev('shotEnd', { id: p.id }); continue;
      }
      const s = Math.min(d, p.speed * dt); p.x += dx / d * s; p.y += dy / d * s;
    }
  }
  return { towerStats, dropCrew, crewing, manned, cacheNeighbours, defenceDps, heroDmg, heroRate, heroDps, damageBuilding, hitMob, killMob, hurtHero, heroBack, fire, spit, stepTowers, stepProjectiles };
}
