// The dead's minds and feet: roamers and animals in the wild, scent and hunting (aggro, think), ambushes,
// the per-frame mob step (stepMobs), separation, and walking around buildings.
import { BRAIN, MOBS, TIDE } from '../content/mobs.js';
import { N, PASSABLE, T, idx, inside } from './mapgen.js';

export function createBrain(G) {
  const { S, c, combo, ev, has, keep, live, map, mastery, mobById, rng, rule } = G;
  function spawnRoamers() {
    if (!S.clock) return;
    const R = TIDE.roam, have = new Map();
    for (const m of S.mobs) if (m.roam && !MOBS[m.kind].animal) have.set(m.roam.region, (have.get(m.roam.region) || 0) + 1);
    let total = S.mobs.filter(m => m.roam && !MOBS[m.kind].animal).length;
    for (const reg of map.regions) {
      if (S.claimed.has(reg.id) || reg.ring < 1) continue;
      const ring = Math.min(2, reg.ring), want = Math.round(R.perRing[ring] * Math.min(1, 0.4 + S.night / 10)) + Math.floor(S.night / (ring >= 2 ? 3 : 8));   // the streets fill up as the nights go on
      for (let k = have.get(reg.id) || 0; k < want && total < R.cap; k++) {
        let spot = null;
        for (let t = 0; t < 20 && !spot; t++) {
          const sp = ring >= 2 ? 9 : 7, x = reg.x + rng.range(-sp, sp), y = reg.y + rng.range(-sp, sp), cx = Math.floor(x), cy = Math.floor(y);
          if (inside(cx, cy) && PASSABLE[map.terrain[idx(cx, cy)]] && map.reach[idx(cx, cy)] && map.region[idx(cx, cy)] === reg.id && S.occ[idx(cx, cy)] < 0 && G.baseDist(x, y) > 8 && !G.nearHive(x, y, R.hiveGap)) spot = { x, y };   // never in a walled-in yard, nor a crowd at a hive's door
        }
        if (!spot) break;
        const kind = ring >= 2 ? rng.pick(S.night >= 6 ? ['walker', 'runner', 'walker', 'brute'] : ['walker', 'runner', 'walker']) : rng.next() < 0.22 ? 'runner' : 'walker';
        const m = G.spawnMob(kind, spot.x, spot.y, { instant: true });
        const tough = 1 + 0.6 * (ring - 1); m.hp = m.maxHp = Math.ceil(m.maxHp * tough);
        m.roam = { x: spot.x, y: spot.y, region: reg.id }; total++;
      }
    }
  }
  // the woods: herds of deer, a few boar, and from the second night wolves (all are food). Each kind is spread over the
  // open woods (the emptiest region first) and grows back slowly: a full stock at the start, a few groups each dawn.
  function spawnAnimals() {
    const A = TIDE.roam.animals, wild = map.regions.filter(r => r.ring === 1);
    if (!wild.length) return;
    const have = k => S.mobs.filter(m => m.kind === k).length, first = !S.animalsInit; S.animalsInit = true;
    const herd = (kind, size) => {
      const n = new Map(); for (const m of S.mobs) if (MOBS[m.kind].animal && m.roam) n.set(m.roam.region, (n.get(m.roam.region) || 0) + 1);
      const order = wild.map(r => [r, (n.get(r.id) || 0) + rng.next()]).sort((p, q) => p[1] - q[1]).map(p => p[0]);
      for (let t = 0; t < 30; t++) {
        const reg = order[t % Math.min(3, order.length)], x = reg.x + rng.range(-9, 9), y = reg.y + rng.range(-9, 9), cx = Math.floor(x), cy = Math.floor(y);
        if (!inside(cx, cy) || !PASSABLE[map.terrain[idx(cx, cy)]] || !map.reach[idx(cx, cy)] || map.region[idx(cx, cy)] !== reg.id || Math.hypot(x - c, y - c) < 16 || S.occ[idx(cx, cy)] >= 0) continue;   // away from the camp (claimed sites don't count)
        for (let k = 0; k < size; k++) { const m = G.spawnMob(kind, x + rng.range(-1, 1), y + rng.range(-1, 1), { instant: true }); m.roam = { x, y, region: reg.id }; }
        return true;
      }
      return false;
    };
    for (const kind of ['deer', 'boar', 'wolf']) {
      const a = A[kind]; if (S.night < (a.from || 0)) continue;
      const want = first ? Math.max(a.start, a.regrow ? 1 : 0) : a.cap;
      for (let g = 0; g < (first ? 12 : a.regrow) && have(kind) < want; g++) if (!herd(kind, a.herd[0] + rng.int(a.herd[1] - a.herd[0] + 1))) break;
    }
  }
  function clearRoamers(region) {
    for (const m of S.mobs.filter(q => q.roam && q.roam.region === region && !MOBS[q.kind].animal)) { S.mobs.splice(S.mobs.indexOf(m), 1); mobById.delete(m.id); ev('die', { id: m.id, kind: m.kind, x: m.x, y: m.y, src: 'cleared', dmg: 0 }); }
  }
  /** a roamer wanders near home, chases the hero who comes close, and never walks on the town */
  function stepRoamer(m, dt, speed) {
    const R = TIDE.roam, h = S.hero, home = m.roam, rank = rankOf(m);
    if (m.smoke > 0) m.smoke -= dt;
    if (m.lure) { m.lure.t -= dt; if (m.lure.t <= 0) m.lure = null; else { if (Math.hypot(m.lure.x - m.x, m.lure.y - m.y) > 1) moveToward(m, m.lure.x, m.lure.y, speed * dt); return; } }
    if (m.kind === 'deer') {   // deer graze, and bolt when you come close
      const hd = h.dead ? Infinity : Math.hypot(h.x - m.x, h.y - m.y);
      if (hd < 6) m.flee = 1.6;
      if (m.flee > 0) { m.flee -= dt; const ox = m.x, oy = m.y; moveToward(m, m.x + (m.x - h.x) * 4, m.y + (m.y - h.y) * 4, speed * 1.2 * dt); if (!standable(m, m.x, m.y)) { m.x = ox; m.y = oy; m.wp = null; } return; }
    }
    if (m.lost && Math.hypot(m.x - c, m.y - c) < 26 && !(rng.next() < 0.995)) { m.roam = null; m.lost = false; return; }   // a straggler from the night that wanders near the town again
    // now and then a roamer next to your land drifts in and walks on the town
    if (!MOBS[m.kind].animal && S.clock && (S.night >= 2 || (G.dayDeadOk && G.dayDeadOk())) /* [gemini3] day 1 too */ && home.region >= 0 && G.baseDist(home.x, home.y) < 12 && rng.next() < TIDE.drift * (S.phase === 'day' ? TIDE.dayRef / TIDE.dayLen : 1) * Math.min(1, S.night / 6) * (rule('fog') ? 1.5 : 1) * dt) { m.roam = null; ev('drift', { id: m.id }); return; }
    const fromHome = Math.hypot(m.x - home.x, m.y - home.y);
    const hd = h.dead ? Infinity : Math.hypot(h.x - m.x, h.y - m.y), heroHome = G.inZone(idx(Math.floor(h.x), Math.floor(h.y)));
    // once a roamer has your scent it hunts you: it follows you home and joins the attack on the town
    const sight = Math.max(R.sight, BRAIN.sense[rank]) * senseMult(m), lose = Math.max(R.lose, sight * BRAIN.forget[rank]);
    if (m.kind !== 'deer' && !m.hunt && !h.dead && !(m.giveUp > S.time) && hd < (MOBS[m.kind].sight ? (m.markT > 0 ? 14 : MOBS[m.kind].sight) : sight) - (S.story.flags.quiet ? 1.5 : 0) && !heroHome && (m.warden || huntN < huntCap()) && (!m.warden || Math.hypot(h.x - home.x, h.y - home.y) < R.leash)) { aggro(m); if (G.huntCommit) G.huntCommit(m); }   // [gemini3] it commits
    if (m.hunt && (h.dead || (hd > lose && !(G.committed && G.committed(m))) || Math.hypot(m.x - home.x, m.y - home.y) > (m.warden ? R.leash + 4 : 30))) { m.hunt = false; m.giveUp = S.time + (G.giveUpT ? G.giveUpT() : 8);   /* [gemini3] no leash line to dance on */ m.wp = { x: home.x, y: home.y }; }   // nobody follows you more than 30 cells from its ground (and it walks home before it tries again)
    if (m.hunt && !m.warden && heroHome && G.baseDist(m.x, m.y) < 4) { if (S.night < 4 || MOBS[m.kind].animal || rng.next() < 0.7) { m.hunt = false; m.wp = { x: home.x, y: home.y }; } else { m.roam = null; m.hunt = false; ev('drift', { id: m.id }); return; } }
    if (m.hunt || (m.tauntT > 0 && !h.dead)) {
      m.face = Math.atan2(h.x - m.x, h.y - m.y);
      if (G.v2combat && G.melee2(m, hd, dt)) return;   // [combat2] a hunting roamer winds up too
      if (hd > 0.9) G.walkTo(m, h.x, h.y, speed * (R.chase[m.kind] || 1.2) * dt); else { m.attacking = true; if (m.cd <= 0) { m.cd = 1; G.hurtHero(MOBS[m.kind].dmg * (m.dmgK || 1)); ev('bite', { id: m.id }); } }
      return;
    }
    if (fromHome > R.leash) { m.wp = { x: home.x, y: home.y }; }
    // a hive's guard that lost you walks back to its door and goes in: no crowd waits outside a hive for nothing
    if (m.guard !== undefined && !m.hunt && fromHome < 1.2 && !(hd < sight)) { S.mobs.splice(S.mobs.indexOf(m), 1); mobById.delete(m.id); ev('nestHome', { id: m.id, region: m.guard }); return; }
    if (m.guard !== undefined && !m.hunt) m.wp = { x: home.x, y: home.y };
    if (!m.wp || Math.hypot(m.wp.x - m.x, m.wp.y - m.y) < 0.3) {
      if (m.idleT > 0) { m.idleT -= dt; return; }
      m.wp = { x: home.x, y: home.y };   // a few tries for open ground round home (a city block leaves little), else home itself
      for (let k = 0; k < 4; k++) {
        const a = rng.range(0, Math.PI * 2), d = rng.range(0.5, R.radius), x = home.x + Math.cos(a) * d, y = home.y + Math.sin(a) * d, cx = Math.floor(x), cy = Math.floor(y);
        if (inside(cx, cy) && PASSABLE[map.terrain[idx(cx, cy)]] && map.reach[idx(cx, cy)] && S.occ[idx(cx, cy)] < 0) { m.wp = { x, y }; break; }
      }
      m.idleT = rng.range(1, 4);
    }
    const ox = m.x, oy = m.y; G.walkTo(m, m.wp.x, m.wp.y, speed * 0.4 * dt);
    // no way on toward that spot (a cliff, a block, a jam of its own kind): after a few seconds without getting closer, pick another
    { const wd = Math.hypot(m.wp.x - m.x, m.wp.y - m.y); if (m.wp !== m.wpOf || wd < m.wpBest - 0.05) { m.wpOf = m.wp; m.wpBest = wd; m.wpStall = 0; } else if ((m.wpStall += dt) > 3) { m.wp = null; m.wpOf = null; m.idleT = 0; } }
    const cx = Math.floor(m.x), cy = Math.floor(m.y); if (!inside(cx, cy) || !PASSABLE[map.terrain[idx(cx, cy)]] || S.occ[idx(cx, cy)] >= 0) { m.x = ox; m.y = oy; m.wp = null; }
  }

  // ---------- the brain: hunt you, search where you were, wait on your road home, or march on the noise ----------
  let speedK = 1, huntN = 0, aggroT = -1, aggroN = 0;
  // a dead that picks up your scent: the 'aggro' event fires on that change only, at most once per dead per 10 s
  // and at most 6 a second in all (it used to fire thousands of times a trip)
  function aggro(m) {
    m.hunt = true; huntN++;
    if (S.time - (m.aggroAt ?? -1e9) < 10) return; m.aggroAt = S.time;
    if (S.time - aggroT >= 1) { aggroT = S.time; aggroN = 0; }
    if (aggroN++ < 6) ev('aggro', { id: m.id });
  }
  const huntCap = () => 8 + Math.floor(S.night / 4);
  const rankOf = m => (m.unique ? 4 : BRAIN.rank[m.kind] ?? 1);
  const senseMult = m => (S.hero.noiseT > 0 ? 1.4 : 1) * (m.smoke > 0 ? 0.3 : 1) * (S.phase === 'night' ? 1.15 : 1) * (S.story.flags.quiet ? 0.85 : 1);
  function think(m, hd, dt) {
    const h = S.hero, rank = rankOf(m);
    if (m.smoke > 0) m.smoke -= dt;
    if (m.lure) { m.lure.t -= dt; if (m.lure.t <= 0 || hd < 1.5) m.lure = null; else return Math.hypot(m.lure.x - m.x, m.lure.y - m.y) < 1 ? { wait: true } : m.lure; }
    if (MOBS[m.kind].burst || m.kind === 'gravelord') return null;
    const heroHome = !h.dead && G.inZone(idx(Math.floor(h.x), Math.floor(h.y)));
    const sense = BRAIN.sense[rank] * senseMult(m);
    if (!m.hunt && !h.dead && (hd < sense && !heroHome && huntN < huntCap() && !(m.giveUp > S.time) || hd < 3 || m.tauntT > 0)) { aggro(m); m.ambushAt = null; }
    if (m.hunt) {
      const lost = h.dead || (hd > Math.max(4, sense * BRAIN.forget[rank]) && m.tauntT <= 0);
      if (lost || (heroHome && G.baseDist(m.x, m.y) < 8 && hd > 3)) {   // you got home: most give up and wander off; a few stay for the town
        m.hunt = false;
        if (!lost && rng.next() < 0.7) { m.roam = { x: m.x + (m.x - c) * 0.6, y: m.y + (m.y - c) * 0.6, region: -1 }; m.lost = true; return null; }
        if (lost && !h.dead && BRAIN.remember[rank]) m.last = { x: h.x, y: h.y, t: BRAIN.remember[rank] };
      } else return h;
    }
    if (m.last) { m.last.t -= dt; if (m.last.t <= 0 || Math.hypot(m.last.x - m.x, m.last.y - m.y) < 1) m.last = null; else return m.last; }
    // the clever ones read where you will go: out in the wilds, they wait on the way home
    if (m.ambush === undefined) m.ambush = rng.next() < BRAIN.ambush[rank];
    if (m.ambush && !h.dead && !heroHome && G.baseDist(h.x, h.y) > 16 && hd < 45) {
      const k = 0.45, ax = c + (h.x - c) * k, ay = c + (h.y - c) * k;
      if (!m.ambushAt || Math.hypot(m.ambushAt.x - ax, m.ambushAt.y - ay) > 6) m.ambushAt = { x: ax, y: ay };
      return Math.hypot(m.ambushAt.x - m.x, m.ambushAt.y - m.y) < 1.2 ? { wait: true } : m.ambushAt;
    }
    m.ambushAt = null;
    return null;
  }

  // spatial hash for mob separation and auras
  const bucket = new Map();
  function stepMobs(dt) {
    const h = S.hero;
    bucket.clear();
    for (const m of S.mobs) { const k = (Math.floor(m.x / 2) << 8) | Math.floor(m.y / 2); let a = bucket.get(k); if (!a) bucket.set(k, a = []); a.push(m); m.boost = 1; }
    huntN = 0; for (const m of S.mobs) if (m.hunt) huntN++;
    for (const s of S.mobs) {
      const au = MOBS[s.kind].aura; if (!au || s.rise < 1) continue;
      const bx = Math.floor(s.x / 2), by = Math.floor(s.y / 2), rr = Math.ceil(au.radius / 2);   // (auras)
      for (let ox = -rr; ox <= rr; ox++) for (let oy = -rr; oy <= rr; oy++) { const a = bucket.get(((bx + ox) << 8) | (by + oy)); if (a) for (const m of a) if (m !== s && Math.abs(m.x - s.x) < au.radius && Math.abs(m.y - s.y) < au.radius) m.boost = au.speed; }
    }
    const targets = live().concat(keep.ruined ? [] : [keep]);
    const walls = has('tar') ? live().filter(b => b.type === 'wall') : [];
    const climbOk = !mastery('fortress');
    for (const m of [...S.mobs]) {
      if (m.hp <= 0) continue;
      const D = MOBS[m.kind];
      if (m.rise < 1) { m.rise = Math.min(1, m.rise + dt * 1.2); continue; }
      if (m.markT > 0) m.markT -= dt;
      const inTar = walls.length && walls.some(w => Math.hypot(w.x - m.x, w.y - m.y) < 3.2);
      if (m.burn) { m.burn.t -= dt; G.hitMob(m, m.burn.dps * dt * (inTar && combo('tar', 'fire') ? 2 : 1), 'fire'); if (m.burn && m.burn.t <= 0) m.burn = null; if (m.hp <= 0) continue; }
      if (D.summon) { m.summonT -= dt; if (m.summonT <= 0) { m.summonT = D.summon.every; for (let k = 0; k < D.summon.count; k++) G.spawnMob(D.summon.kind, m.x + rng.range(-1.5, 1.5), m.y + rng.range(-1.5, 1.5)); ev('summon', { id: m.id }); } }
      m.cd -= dt; m.attacking = false; m.tauntT = Math.max(0, m.tauntT - dt);
      const ci = idx(Math.floor(m.x), Math.floor(m.y));
      const lull = G.story && Math.abs(m.x - c) < 7 && Math.abs(m.y - c) < 7 ? G.story.bonus.lullaby() : 1;
      const speed = (rule('winter') ? 0.9 : 1) * lull * m.speed * m.boost * G.W8().speed * (inTar ? 0.6 : 1) * (m.slowUntil > S.time ? m.slowK : 1) / (map.terrain[ci] === T.FOREST ? 1.4 : map.terrain[ci] === T.FORD ? 1.8 : 1);
      if (G.v2combat && m.windT > 0 && G.melee2(m, h.dead ? Infinity : Math.hypot(h.x - m.x, h.y - m.y), dt)) continue;   // [combat2] a wind-up once begun ends in a bite or a whiff, whatever it thinks next
      if (m.roam) { stepRoamer(m, dt, speed); continue; }
      const hd = h.dead ? Infinity : Math.hypot(h.x - m.x, h.y - m.y);
      const goal = think(m, hd, dt);
      if (goal && !(goal === h && D.range && hd < D.range)) {
        const far = hd > 30 && Math.hypot(m.x - c, m.y - c) > 40 ? BRAIN.farSpeed : 1;
        if (goal === h) {
          m.face = Math.atan2(h.x - m.x, h.y - m.y);
          if (G.v2combat && G.melee2(m, hd, dt)) continue;   // [combat2] a telegraphed bite holds it still through the wind-up
          if (hd > 0.9) G.walkTo(m, h.x, h.y, speed * (TIDE.roam.chase[m.kind] || 1.2) * dt);
          else { m.attacking = true; if (m.cd <= 0) { m.cd = 1; G.hurtHero(D.dmg * (m.dmgK || 1)); ev('bite', { id: m.id }); } }
        } else if (goal.wait) { m.face = Math.atan2(h.x - m.x, h.y - m.y); }
        else G.walkTo(m, goal.x, goal.y, speed * far * dt);
        continue;
      }
      if (hd > 30 && Math.hypot(m.x - c, m.y - c) > 40) speedK = BRAIN.farSpeed; else speedK = 1;
      // nearest sellsword
      let ally = null, ad = Infinity;
      for (const a of S.allies) { const d = Math.hypot(a.x - m.x, a.y - m.y); if (d < ad) { ad = d; ally = a; } }
      // spitters stop and spit at the first thing in range
      if (D.range) {
        let tgt = null, td = D.range;
        if (hd < td) { tgt = h; td = hd; }
        if (ad < td) { tgt = ally; td = ad; }
        for (const b of targets) { if (b.ruined) continue; const d = Math.hypot(b.x - m.x, b.y - m.y) - b.r; if (d < td) { td = d; tgt = b; } }
        if (tgt) { m.attacking = true; m.face = Math.atan2(tgt.x - m.x, tgt.y - m.y); if (m.cd <= 0) { m.cd = D.rate; G.spit(m, tgt); } continue; }
      }
      // taunted, or close to the hero or a sellsword: turn on them
      const foe = ad < 2.5 ? ally : null;
      if (foe && !D.burst && m.kind !== 'gravelord') {
        const fd = Math.hypot(foe.x - m.x, foe.y - m.y);
        m.face = Math.atan2(foe.x - m.x, foe.y - m.y);
        if (fd > 0.9) moveToward(m, foe.x, foe.y, speed * dt);
        else { m.attacking = true; if (m.cd <= 0) { m.cd = 1; if (foe === h) G.hurtHero(D.dmg); else foe.hp -= D.dmg; ev('bite', { id: m.id }); } }
        continue;
      }
      const climbs = D.climbs && climbOk;
      const field = climbs ? S.climb : S.flow, next = climbs ? S.climbNext : S.flowNext;
      let attackB = null;
      if (field[ci] === 0 || !Number.isFinite(field[ci])) attackB = adjacentBuilding(m);
      const nj = next[ci];
      if (!attackB && nj >= 0 && S.occ[nj] >= 0 && !climbs) attackB = S.byId.get(S.occ[nj]); // a palisade stands in the way
      if (attackB && !attackB.ruined) {
        m.attacking = true; m.face = Math.atan2(attackB.x - m.x, attackB.y - m.y);
        if (D.burst) { m.hp = 0; G.killMob(m); continue; }
        if (m.cd <= 0) {
          m.cd = 1; G.damageBuilding(attackB, D.dmg, m); ev('bite', { id: m.id });
          if (attackB.type === 'wall' && S.P.thorns) G.hitMob(m, S.P.thorns, 'thorns');
        }
        continue;
      }
      if (nj >= 0) { const tx = (nj % N) + 0.5, ty = ((nj / N) | 0) + 0.5; moveToward(m, tx, ty, speed * speedK * dt); }
      else moveToward(m, c, c, speed * speedK * dt);
    }
    // separation
    for (const arr of bucket.values()) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), mn = 0.3 * (MOBS[a.kind].size + MOBS[b.kind].size);
      if (d < mn && d > 1e-4) { const p = (mn - d) / 2; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; }
    }
    // never stand inside a building or impassable cell
    for (const m of S.mobs) {
      if (!standable(m, m.x, m.y)) {
        if (m.px !== undefined && standable(m, m.px, m.py)) { m.x = m.px; m.y = m.py; }
        else unstick(m);
      }
      m.px = m.x; m.py = m.y;
    }
  }
  function standable(m, x, y) {
    const cx = Math.floor(x), cy = Math.floor(y); if (!inside(cx, cy)) return false;
    const i = idx(cx, cy);
    return PASSABLE[map.terrain[i]] && (S.occ[i] < 0 || (MOBS[m.kind].climbs && !mastery('fortress') && G.isWall(S.occ[i])));
  }
  function unstick(m) {
    const cx = Math.floor(m.x), cy = Math.floor(m.y);
    for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx + 0.5, y = cy + dy + 0.5;
      if (standable(m, x, y) && Number.isFinite(S.flow[idx(cx + dx, cy + dy)])) { m.x = x; m.y = y; return; }
    }
  }
  function moveToward(m, tx, ty, s) { const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy); if (d < 1e-4) return; m.x += dx / d * Math.min(s, d); m.y += dy / d * Math.min(s, d); m.face = Math.atan2(dx, dy); }
  function adjacentBuilding(m) {
    const x = Math.floor(m.x), y = Math.floor(m.y); let best = null, bd = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!inside(x + dx, y + dy)) continue; const o = S.occ[idx(x + dx, y + dy)];
      if (o >= 0) { const b = S.byId.get(o); if (b && !b.ruined) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = b; } } }
    }
    return best;
  }
  return { spawnRoamers, spawnAnimals, clearRoamers, rankOf, senseMult, stepMobs, standable, moveToward };
}
