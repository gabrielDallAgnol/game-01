// The hero: levels and xp, walking and pathing, the autopilot,
// attacking, companions and sellswords, max health.
import { DIRS8, LEVEL, MinHeap, REGEN } from './state.js';
import { MERC } from '../content/heroes.js';
import { MOBS, TIDE } from '../content/mobs.js';
import { N, T, idx, inside } from './mapgen.js';

export function createHero(G) {
  const { S, c, earn, ev, has, keep, map, mastery, owns, rule, syncPicks, toast } = G;
  const heroMax = () => Math.round((G.HC.hp + S.P.heroHp + LEVEL.hp * ((S.lvl || 1) - 1) + (mastery('champion') ? 25 : 0)) * S.P.heroHpMult);
  function gainXp(n) {
    if (S.lvl >= LEVEL.max) return; S.xp += n;
    while (S.lvl < LEVEL.max && S.xp >= LEVEL.xp(S.lvl)) { S.xp -= LEVEL.xp(S.lvl); S.lvl++; refreshMax(); S.hero.hp = Math.min(S.hero.maxHp, S.hero.hp + LEVEL.hp * 2); ev('levelUp', { lvl: S.lvl }); G.levelUp(S.lvl); }   // [mech] the System's lines (sim/mechanic.js)
  }

  // ---------- walking: the hero's ground and paths round buildings ----------
  const walkable = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); if (!inside(cx, cy)) return false; return G.heroOk(idx(cx, cy)); };
  /** shortest walk to a point, around buildings (8 directions, no squeezing past corners) */
  function heroPath(tx, ty) {
    const h = S.hero, s = idx(Math.floor(h.x), Math.floor(h.y));
    let goal = idx(Math.floor(tx), Math.floor(ty));
    if (!inside(Math.floor(tx), Math.floor(ty))) return null;
    // a clear straight walk needs no planning
    const L = Math.hypot(tx - h.x, ty - h.y), steps = Math.ceil(L / 0.3);
    let clear = true; for (let k = 1; k <= steps && clear; k++) if (!walkable(h.x + (tx - h.x) * k / steps, h.y + (ty - h.y) * k / steps)) clear = false;
    if (clear) return [{ x: tx, y: ty }];
    const dist = new Float32Array(N * N).fill(Infinity), prev = new Int32Array(N * N).fill(-1), open = new MinHeap(); open.push(0, s); dist[s] = 0;
    // A* on the grid; the goal may be a building cell: stop at the closest reachable cell
    let best = s, bestD = Math.hypot(tx - h.x, ty - h.y);
    while (open.size) {
      const i = open.pop(); if (open.lastKey > dist[i] + Math.hypot((i % N) + 0.5 - tx, ((i / N) | 0) + 0.5 - ty) + 1e-6) continue;
      const x = i % N, y = (i / N) | 0, dg = Math.hypot(x + 0.5 - tx, y + 0.5 - ty);
      if (dg < bestD) { bestD = dg; best = i; }
      if (i === goal || dist[i] > 300) break;
      for (const [dx, dy, len] of DIRS8) {
        const xx = x + dx, yy = y + dy; if (!inside(xx, yy)) continue;
        const j = idx(xx, yy); if (!G.heroOk(j)) continue;
        if (dx && dy && (!G.heroOk(idx(x + dx, y)) || !G.heroOk(idx(x, y + dy)))) continue;
        const nd = dist[i] + len; if (nd < dist[j]) { dist[j] = nd; prev[j] = i; open.push(nd + Math.hypot((j % N) + 0.5 - tx, ((j / N) | 0) + 0.5 - ty), j); }
      }
    }
    const path = []; for (let i = best; i !== s && i >= 0; i = prev[i]) path.push({ x: (i % N) + 0.5, y: ((i / N) | 0) + 0.5 });
    path.reverse();
    if (best === goal && G.heroOk(goal)) path[path.length - 1] = { x: tx, y: ty };
    return path;
  }
  // ---------- companions at your side: one at a time, and their post stands empty while they travel with you ----------
  function spawnCompanion(n) {
    const h = S.hero, k = S.P.compBuff || 1, hp = Math.round((24 + n.bond * 4 + (n.named ? 14 : 0)) * k);
    const a = { id: S.nextId++, ally: true, comp: n.id, name: n.name.split(' ')[0], x: h.x + 0.6, y: h.y + 0.6, hp, maxHp: hp, dmg: (2.5 + n.bond * 0.4 + (n.named ? 2 : 0)) * k, cd: 0, face: 0, attacking: false };
    S.allies.push(a); ev('ally', { id: a.id });
  }
  function companionFollow(id, on) {
    const n = S.story.npcs.find(q => q.id === id); if (!n || !n.alive || !n.joined) return false;
    if (on) { const others = S.story.npcs.filter(o => o !== n && o.withHero); while (others.length >= G.partySize()) companionFollow(others.shift().id, false); n.withHero = true; if (!S.allies.some(a => a.comp === n.id)) spawnCompanion(n); toast(`${n.name} travels with you. Their post stands empty until they return.`, 'good'); }
    else { n.withHero = false; for (const a of S.allies.filter(q => q.comp === n.id)) { S.allies.splice(S.allies.indexOf(a), 1); ev('allyGone', { id: a.id }); } }
    return true;
  }
  // ---------- autopilot: the hero plays by itself (defends the town, fetches crates, rests when hurt) ----------
  let autoT = 0, handT = 0;
  function autoHero(dt) {
    const h = S.hero; if (h.dead || (handT -= dt) > 0 || (autoT -= dt) > 0) return; autoT = 0.3;
    const home = { x: c, y: c + 3.5 };
    if (h.hp < h.maxHp * 0.35) { G.api.heroTo(home.x, home.y); return; }
    const threats = S.mobs.filter(m => m.rise >= 1 && (!m.roam || Math.hypot(m.x - c, m.y - c) < 12) && Math.hypot(m.x - c, m.y - c) < 15);
    if (threats.length && G.HC.attack) {
      threats.sort((a, b) => Math.hypot(a.x - c, a.y - c) - Math.hypot(b.x - c, b.y - c));
      const m = threats[0], reach = G.HC.attack.reach * 0.8;
      if (Math.hypot(m.x - h.x, m.y - h.y) > reach) G.api.heroTo(m.x, m.y);
      return;
    }
    const loot = S.chests[0] || (S.phase === 'day' && h.hp > h.maxHp * 0.7 && S.drops.find(d => Math.hypot(d.x - c, d.y - c) < 55));
    if (loot) { G.api.heroTo(loot.x, loot.y); return; }
    // by day, with time and health to spare: quests, then beacons
    if (S.phase === 'day' && !S.autoStay && h.hp > h.maxHp * 0.7 && TIDE.dayLen - S.dayT > 25) {
      const ST = S.story;
      const goal = ST.quests[0] || ST.spots.slice().sort((a, b) => Math.hypot(a.x - c, a.y - c) - Math.hypot(b.x - c, b.y - c))[0];
      if (goal) { G.api.heroTo(goal.x, goal.y + (goal.site !== undefined ? 2.5 : 0)); return; }
    }
    if (Math.hypot(h.x - home.x, h.y - home.y) > 2) G.api.heroTo(home.x, home.y);
  }
  function setHeroInput(x, y) { S.hero.input.x = x; S.hero.input.y = y; if (x || y) handT = 2; }
  function unstickHero() {
    const h = S.hero; if (walkable(h.x, h.y)) return;
    for (let r = 1; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = Math.floor(h.x) + dx + 0.5, y = Math.floor(h.y) + dy + 0.5; if (walkable(x, y)) { h.x = x; h.y = y; return; }
    }
  }
  /** the hero heals only when the fight is over: never mid-fight (hit or hitting in the last REGEN.combat s), never next
   *  to a living hive; slowly out in the field by day, quickly at the Camp. h.rest tells the view: 'camp' | 'field' | '' */
  function regen(dt) {
    const h = S.hero;
    if (h.hp < (h.hpSeen ?? h.hp) - 1e-6) h.fightT = REGEN.combat;   // took a hit since the last step
    h.fightT = Math.max(0, (h.fightT || 0) - dt);
    const hive = G.nearHive(h.x, h.y, REGEN.hive), day = S.phase === 'day';
    const camp = Math.hypot(h.x - c, h.y - c) < REGEN.campR || G.inZone(idx(Math.floor(h.x), Math.floor(h.y)));
    const base = hive || h.fightT > 0 ? 0 : camp ? (day ? (S.P.noDayHeal ? 0 : REGEN.camp) : REGEN.campNight) : day && !S.P.noDayHeal ? REGEN.field : 0;
    const bonus = hive ? 0 : (day ? 0 : S.P.heroRegen) + (owns('clinic') ? 2 : 0) + (G.story ? G.story.bonus.regen() : 0);   // perks, the Clinic, companions: as their words say (not by a hive)
    h.rest = h.hp < h.maxHp && base > 0 ? (camp ? 'camp' : 'field') : '';
    h.hp = Math.min(h.maxHp, h.hp + dt * (base + bonus)); h.hpSeen = h.hp;
  }
  function stepHero(dt) {
    const h = S.hero;
    if (h.dead) { h.respawn -= dt; if (h.respawn <= 0) G.heroBack(); return; }
    h.noiseT = Math.max(0, (h.noiseT || 0) - dt);
    if (S.nightFlags.lastT > 0) S.nightFlags.lastT -= dt;
    let dx = h.input.x, dy = h.input.y, moving = false;
    if (dx || dy) { h.target = null; const l = Math.hypot(dx, dy); dx /= l; dy /= l; moving = true; }
    else if (h.target) {
      // follow the planned path; the next waypoint is skipped once we reach it
      if (h.path && h.path.length) { const w = h.path[0]; if (Math.hypot(w.x - h.x, w.y - h.y) < 0.2) h.path.shift(); }
      const w = h.path && h.path.length ? h.path[0] : (h.path ? null : h.target);
      if (!w) { h.target = null; h.path = null; }
      else { dx = w.x - h.x; dy = w.y - h.y; const l = Math.hypot(dx, dy); if (l < 0.15 && !(h.path && h.path.length > 1)) { h.target = null; h.path = null; dx = dy = 0; } else if (l > 1e-4) { dx /= l; dy /= l; moving = true; } }
    }
    if (moving) {
      const ti = idx(Math.floor(h.x), Math.floor(h.y)), ground = map.road[ti] ? 1.4 : map.terrain[ti] === T.FOREST && !G.inZone(ti) ? 0.72 : 1;   // the old road is quick; the woods are slow
      const sp = G.HC.speed * S.P.heroSpeed * ground * (rule('winter') ? 0.92 : 1) * dt;
      if (S.P.runHeal) h.hp = Math.min(h.maxHp, h.hp + S.P.runHeal * dt);
      const tryMove = (nx, ny) => { if (!walkable(nx, ny)) return false; h.x = nx; h.y = ny; return true; };
      if (!tryMove(h.x + dx * sp, h.y + dy * sp)) { if (!tryMove(h.x + dx * sp, h.y)) if (!tryMove(h.x, h.y + dy * sp)) { h.target = null; h.path = null; } }
      h.face = Math.atan2(dx, dy); h.moving = true;
    } else h.moving = false;
    h.cd -= dt; h.swing = Math.max(0, h.swing - dt);
    G.wrench(moving);   // [mech] the wrench hits by itself (sim/mechanic.js)
    regen(dt);
    for (const ch of [...S.chests]) {
      if (Math.hypot(ch.x - h.x, ch.y - h.y) > 1.3) continue;
      S.chests.splice(S.chests.indexOf(ch), 1); ev('chestOpen', { id: ch.id }); S.stats.chests++;
      if ((S.chestsToday = (S.chestsToday || 0) + 1) > 1) { earn(5); toast('Another chest: **+5 scrap** (one chest blessing a day is the most).', 'good'); continue; }
      S.picks.push('chest'); syncPicks(); if (S.picks.length === 1) G.rollOffer();
    }
    if (G.HC.collects) for (const p of [...S.purses]) {
      if (Math.hypot(p.x - h.x, p.y - h.y) > 1.2) continue;
      S.purses.splice(S.purses.indexOf(p), 1); earn(p.value); S.stats.pursesGold += p.value; ev('purseTaken', { id: p.id, value: p.value });
    }
  }
  function stepAllies(dt) {
    const h = S.hero;
    for (const a of [...S.allies]) {
      if (a.hp <= 0 && a.comp && mastery('lifeline')) { a.hp = a.maxHp; continue; }
      if (a.hp <= 0) { S.allies.splice(S.allies.indexOf(a), 1); ev('allyGone', { id: a.id, died: true }); if (a.comp) toast(`${a.name} is down. They will be back on their feet at dawn.`, 'bad'); continue; }
      a.cd -= dt; a.attacking = false;
      let best = null, bd = Infinity;
      for (const m of S.mobs) { if (m.rise < 1) continue; if (Math.hypot(m.x - h.x, m.y - h.y) > MERC.leash + 2) continue; const d = Math.hypot(m.x - a.x, m.y - a.y); if (d < bd) { bd = d; best = m; } }
      if (best) {
        if (bd > MERC.reach) moveAlly(a, best.x, best.y, MERC.speed * dt);
        else { a.attacking = true; a.face = Math.atan2(best.x - a.x, best.y - a.y); if (a.cd <= 0) { a.cd = MERC.rate; G.hitMob(best, (a.dmg || MERC.dmg) + S.P.mercDmg, 'merc'); ev('swingAlly', { id: a.id }); } }
      } else if (Math.hypot(h.x - a.x, h.y - a.y) > 2) moveAlly(a, h.x, h.y, MERC.speed * dt);
    }
  }
  function moveAlly(a, tx, ty, s) {
    const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 1e-4) return;
    const nx = a.x + dx / d * Math.min(s, d), ny = a.y + dy / d * Math.min(s, d);
    if (walkable(nx, ny)) { a.x = nx; a.y = ny; } else if (walkable(nx, a.y)) a.x = nx; else if (walkable(a.x, ny)) a.y = ny;
    a.face = Math.atan2(dx, dy);
  }
  const refreshMax = () => {
    for (const b of S.buildings) { const m = G.maxHpOf(b.type, b.level); if (!b.ruined) b.hp += m - b.maxHp; b.maxHp = m; }
    const km = G.keepMaxHp(); keep.hp = Math.min(km, keep.hp + Math.max(0, km - keep.maxHp)); keep.maxHp = km;
    const hm = heroMax(); S.hero.hp = Math.min(hm, S.hero.hp + Math.max(0, hm - S.hero.maxHp)); S.hero.maxHp = hm;
  };
  return { heroMax, gainXp, heroPath, spawnCompanion, companionFollow, autoHero, setHeroInput, unstickHero, stepHero, stepAllies, refreshMax };
}
