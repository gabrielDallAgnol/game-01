// [hero3] The abilities your stats unlock (content/abilities.js), run: the actives (Heavy Cleave, Blink Strike,
// Aether Burst, Rally Cry, Wild Shape, Raise the Fallen), the passives (Unbreakable, Smoke Step, Spirit Hawk, Hired
// Crew, Whirlwind, Radiant Blade, Iron Warden, Skirmish Commander), their cooldowns, the autopilot's use of them, and
// the multipliers sim/stats.js folds into its hooks (powDmg, powRate, powSpeed, powHurt, powHit, powWard, powTower).
// Ported from this week's class signatures (fix-classes2: Shockwave, Berserk, Smoke Step, Hawk, Rain, Crew, Arise, the
// Druid's wolf). State: S.pow. Every hit goes in as the hero's ('hero': it pays xp and Marks for the towers).
import { ABILITIES, ABILITY_CD_K } from '../content/abilities.js';
import { MOBS } from '../content/mobs.js';
import { BIG } from './state.js';
import { idx, inside } from './mapgen.js';
import { defOf } from './stats.js';

export function createPowers(G) {
  const { S, ev, toast, fail } = G;
  const fresh = () => ({ cd: {}, wildT: 0, unbreakT: 0, unbreakCd: 0, smokeT: 0, rally: null, hawk: null, corpses: [], phase: S.phase, seen: 0, rainQ: [] });
  S.pow = fresh();
  const seenDie = new WeakSet();   // death events already read (the UI drains S.events once a frame, many steps later)
  const P = () => S.pow;
  const has = id => G.hasAb(id);
  const D = id => defOf(S.attr, id);
  const H = () => G.heroDmg();
  const hostile = m => m.rise >= 1 && m.hp > 0 && !(MOBS[m.kind] && MOBS[m.kind].animal);
  const near = (x, y, r) => { let n = 0; for (const m of S.mobs) if (hostile(m) && Math.abs(m.x - x) < r && Math.abs(m.y - y) < r && Math.hypot(m.x - x, m.y - y) < r) n++; return n; };
  const walkable = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); return inside(cx, cy) && G.heroOk(idx(cx, cy)); };
  /** throw a dead back from (x, y) by k cells (big ones fly less; never into a wall) */
  function push(m, x, y, k) {
    if (m.kind === 'gravelord' || m.unique) return;
    const d = Math.hypot(m.x - x, m.y - y) || 1, s = k / Math.max(0.6, MOBS[m.kind].size), nx = m.x + (m.x - x) / d * s, ny = m.y + (m.y - y) / d * s;
    if (G.standable(m, nx, ny)) { m.x = nx; m.y = ny; }
  }
  /** the thickest crowd within reach of (x, y): { x, y, n } */
  function crowd(x, y, reach, r) {
    let best = null, bn = 0; const cand = S.mobs.filter(m => hostile(m) && Math.hypot(m.x - x, m.y - y) <= reach);
    for (const m of cand) { let n = 0; for (const o of cand) if (Math.hypot(o.x - m.x, o.y - m.y) < r) n++; if (n > bn) { bn = n; best = m; } }
    return best ? { x: best.x, y: best.y, n: bn } : null;
  }
  const power = () => G.abilityPower();

  // ---------- the actives ----------
  const ACT = {
    cleave() {
      const A = D('cleave'), h = S.hero; if (!near(h.x, h.y, A.r + 0.5)) return fail('No dead in reach.');
      for (const m of [...S.mobs]) { const d = Math.hypot(m.x - h.x, m.y - h.y); if (d > A.r || !hostile(m)) continue; push(m, h.x, h.y, A.push * (1 - d / A.r * 0.5)); m.cd = Math.max(m.cd || 0, A.stun); G.hitMob(m, H() * A.dmg * power(), 'hero'); }
      ev('powCleave', { x: h.x, y: h.y, r: A.r }); return true;
    },
    blink() {
      const A = D('blink'), h = S.hero, hit = [];
      let from = h, left = 1 + (A.chain || 0);
      while (left-- > 0) {
        let best = null, bs = -1;
        for (const m of S.mobs) { if (!hostile(m) || hit.includes(m)) continue; const d = Math.hypot(m.x - from.x, m.y - from.y); if (d > A.reach) continue; const sc = m.maxHp * 10 - d; if (sc > bs) { bs = sc; best = m; } }
        if (!best) break;
        // land beside it, on ground you can stand on
        const ang = Math.atan2(h.y - best.y, h.x - best.x); let land = null;
        for (let k = 0; k < 8 && !land; k++) { const a = ang + k * Math.PI / 4, x = best.x + Math.cos(a) * 0.9, y = best.y + Math.sin(a) * 0.9; if (walkable(x, y)) land = { x, y }; }
        if (!land) { hit.push(best); continue; }
        const x0 = h.x, y0 = h.y; h.x = land.x; h.y = land.y; h.target = null; h.path = null; h.face = Math.atan2(best.x - h.x, best.y - h.y);
        G.hitMob(best, H() * A.dmg * power(), 'hero');
        for (const o of [...S.mobs]) if (o !== best && hostile(o) && Math.hypot(o.x - best.x, o.y - best.y) < A.splash) G.hitMob(o, H() * A.splashK * power(), 'hero');
        ev('powBlink', { x0, y0, x: h.x, y: h.y }); hit.push(best); from = best;
      }
      if (!hit.length) return fail('No dead in reach.');
      if (has('smoke')) { const Sm = ABILITIES.smoke, p = P(); p.smokeT = Sm.dur; for (const m of S.mobs) if (hostile(m) && Math.hypot(m.x - h.x, m.y - h.y) < Sm.r) { m.smoke = Sm.dur; m.hunt = false; m.last = null; } ev('powSmoke', { x: h.x, y: h.y, dur: Sm.dur }); }
      return true;
    },
    burst() {
      const A = D('burst'), h = S.hero, t = crowd(h.x, h.y, A.reach, A.r); if (!t) return fail('No dead in range.');
      P().rainQ.push({ x: t.x, y: t.y, r: A.r, left: A.waves, every: 0.5, at: 0, dmg: H() * A.dmg * power() });
      ev('powBurst', { x: t.x, y: t.y, r: A.r, waves: A.waves }); return true;
    },
    rally() {
      const A = D('rally'), h = S.hero, k = power();
      P().rally = { x: h.x, y: h.y, r: A.r, left: A.dur, tower: 1 + (A.tower - 1) * k };
      h.hp = Math.min(h.maxHp, h.hp + h.maxHp * A.heal); for (const a of S.allies) if (Math.hypot(a.x - h.x, a.y - h.y) < A.r) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * A.heal);
      for (const b of G.live().concat(G.keep.ruined ? [] : [G.keep])) if (Math.hypot(b.x - h.x, b.y - h.y) < A.r) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * A.mend);
      ev('powRally', { x: h.x, y: h.y, r: A.r, dur: A.dur }); toast(`[${A.name}] Towers near you fire faster for ${A.dur} s.`, 'good'); return true;
    },
    wild() {
      const A = D('wild'); P().wildT = A.dur; ev('powWild', { dur: A.dur }); return true;
    },
    arise() {
      const A = D('arise'), h = S.hero, p = P();
      const room = A.cap - S.allies.filter(a => a.risen).length; if (room <= 0) return fail('Your risen are at full strength.');
      const list = p.corpses.filter(c => S.time - c.at <= A.window && Math.hypot(c.x - h.x, c.y - h.y) <= A.r).reverse().slice(0, room);
      if (!list.length) return fail('No fallen dead near you.');
      for (const c of list) { summon(c.x, c.y, A.hp * (c.big ? 2 : 1), A.dmg * (c.big ? 1.5 : 1), { risen: true }); p.corpses.splice(p.corpses.indexOf(c), 1); }
      ev('powArise', { x: h.x, y: h.y, n: list.length }); toast(`[Raise the Fallen] **${list.length}** of the dead rise for you, till dawn.`, 'good'); return true;
    },
  };
  /** press an ability: '' when it fired, else why not */
  function usePower(id) {
    const A = ABILITIES[id]; if (!A || A.kind !== 'active') return false;
    if (!has(id)) return fail(`${A.name} is still locked.`);
    if (S.over || S.hero.dead) return false;
    const p = P(); if ((p.cd[id] || 0) > 0) return fail(`${D(id).name} is ready in ${Math.ceil(p.cd[id])} s.`);
    if (!ACT[id]()) return false;
    p.cd[id] = D(id).cd * ABILITY_CD_K * G.cdCut() * (S.P.abilityCd || 1); ev('powUse', { id }); return true;
  }

  // ---------- allies: the crew and the risen walk in S.allies (hero.js stepAllies moves them) ----------
  function summon(x, y, hpK, dmgK, extra) {
    let p = { x, y }; for (let k = 0; k < 6; k++) { const a = k * 1.05, nx = x + Math.cos(a) * 0.6, ny = y + Math.sin(a) * 0.6; if (walkable(nx, ny)) { p = { x: nx, y: ny }; break; } }
    const hp = Math.max(6, Math.round(S.hero.maxHp * hpK));
    const a = { id: S.nextId++, ally: true, x: p.x, y: p.y, hp, maxHp: hp, cd: 0, face: 0, attacking: false, dmgK, dmg: H() * dmgK, ...extra };
    S.allies.push(a); ev('ally', { id: a.id }); return a;
  }
  function dismiss(pred) { for (const a of S.allies.filter(pred)) { S.allies.splice(S.allies.indexOf(a), 1); ev('allyGone', { id: a.id }); } }
  function ensureCrew() {
    if (!has('crew')) return;
    const C = ABILITIES.crew; for (let k = S.allies.filter(a => a.crew).length; k < C.n; k++) summon(S.hero.x, S.hero.y, C.hp, C.dmg, { crew: true });
  }

  // ---------- once a step ----------
  function stepPowers(dt) {
    const p = P(), h = S.hero;
    for (const k in p.cd) if (p.cd[k] > 0) p.cd[k] = Math.max(0, p.cd[k] - dt);
    if (p.phase === 'night' && S.phase === 'day') onDawn();
    p.phase = S.phase;
    if (p.wildT > 0) { p.wildT = h.dead ? 0 : Math.max(0, p.wildT - dt); if (p.wildT <= 0) ev('powWildEnd', {}); }
    if (p.smokeT > 0) p.smokeT = h.dead ? 0 : Math.max(0, p.smokeT - dt);
    if (p.unbreakT > 0) { p.unbreakT = h.dead ? 0 : Math.max(0, p.unbreakT - dt); if (p.unbreakT <= 0) ev('powUnbreakEnd', {}); }
    if (p.unbreakCd > 0) p.unbreakCd = Math.max(0, p.unbreakCd - dt);
    if (p.rally && (p.rally.left -= dt) <= 0) p.rally = null;
    for (const R of [...p.rainQ]) { if ((R.at -= dt) > 0) continue; R.at = R.every; R.left--; for (const m of [...S.mobs]) if (hostile(m) && Math.hypot(m.x - R.x, m.y - R.y) < R.r) G.hitMob(m, R.dmg, 'hero'); ev('powPulse', { x: R.x, y: R.y, r: R.r }); if (R.left <= 0) p.rainQ.splice(p.rainQ.indexOf(R), 1); }
    // the crew's and the risen's hits follow yours
    if ((p.allyT = (p.allyT || 0) - dt) <= 0) { p.allyT = 1; const hd = H(); for (const a of S.allies) if (a.dmgK) a.dmg = hd * a.dmgK; ensureCrew(); }
    // swings: Whirlwind and Radiant Blade ride on the hero's own attacks (h.attacks counts them)
    if (h.attacks !== p.seen) {
      const n = h.attacks - p.seen; p.seen = h.attacks;
      if (n > 0 && !h.dead) for (let k = h.attacks - n + 1; k <= h.attacks; k++) {
        const reach = (G.HC.attack ? G.HC.attack.reach : 2) + S.P.heroRange;
        if (has('whirl') && k % ABILITIES.whirl.every === 0) { const ms = S.mobs.filter(m => hostile(m) && Math.hypot(m.x - h.x, m.y - h.y) - 0.3 * MOBS[m.kind].size < reach); for (const m of ms.slice(1)) G.hitMob(m, H() * 0.8, 'hero'); if (ms.length > 1) ev('powWhirl', { x: h.x, y: h.y, r: reach }); }
        if (has('radiant') && k % ABILITIES.radiant.every === 0) { const R = ABILITIES.radiant; let t = null, bd = reach + 0.5; for (const m of S.mobs) { if (!hostile(m)) continue; const d = Math.hypot(m.x - h.x, m.y - h.y); if (d < bd) { bd = d; t = m; } } if (t) { const tx = t.x, ty = t.y; for (const m of [...S.mobs]) if (hostile(m) && Math.hypot(m.x - tx, m.y - ty) < R.r) G.hitMob(m, H() * R.dmg * power(), 'hero'); ev('powRadiant', { x: tx, y: ty, r: R.r }); } }
      }
    }
    if (has('hawk')) hawkStep(dt);
    if (p.corpses.length && S.time - p.corpses[0].at > 30) p.corpses = p.corpses.filter(c => S.time - c.at <= 30);
    // remember the dead that fell near you (Raise the Fallen reads them): a death drops an event this step
    if (has('arise')) for (const e of S.events) if (e.t === 'die' && e.src !== 'sun' && Math.hypot(e.x - h.x, e.y - h.y) < 12 && !(MOBS[e.kind] && MOBS[e.kind].animal) && !seenDie.has(e)) { seenDie.add(e); p.corpses.push({ x: e.x, y: e.y, big: MOBS[e.kind] && MOBS[e.kind].size >= BIG, at: S.time }); if (p.corpses.length > 40) p.corpses.shift(); }
  }
  function onDawn() {
    const p = P(); p.cd = {}; p.rainQ = []; p.corpses = []; p.rally = null; p.wildT = 0;
    dismiss(a => a.risen);   // the risen crumble at first light
    for (const a of S.allies) if (a.crew) a.hp = a.maxHp;
    ensureCrew();
  }
  function hawkStep(dt) {
    const p = P(), h = S.hero, A = ABILITIES.hawk, k = p.hawk || (p.hawk = { tgt: -1, markT: 0, pickT: 0 });
    k.markT = Math.max(0, k.markT - dt); k.pickT -= dt;
    let m = k.tgt >= 0 ? G.mobById.get(k.tgt) : null;
    if (m && (m.hp <= 0 || Math.hypot(m.x - h.x, m.y - h.y) > A.r + 4)) m = null;
    if ((!m || k.markT <= 0) && k.pickT <= 0 && !h.dead) {
      let best = null, bs = -1;
      for (const o of S.mobs) { if (!hostile(o)) continue; const d = Math.hypot(o.x - h.x, o.y - h.y); if (d > A.r) continue; const sc = o.maxHp * 10 - d; if (sc > bs) { bs = sc; best = o; } }
      k.pickT = best ? A.every : 0.5;
      if (best) { m = best; k.tgt = best.id; k.markT = A.markT; ev('powMark', { id: best.id }); }
    }
    if (!m) { k.tgt = -1; k.markT = 0; }
  }

  // ---------- the multipliers sim/stats.js folds into its hooks ----------
  const powDmg = () => (P().wildT > 0 ? ABILITIES.wild.dmgK : 1) * (P().unbreakT > 0 ? ABILITIES.unbreak.dmgK : 1);
  const powRate = () => (P().wildT > 0 ? ABILITIES.wild.rate : 1) * (P().unbreakT > 0 ? ABILITIES.unbreak.rate : 1);
  const powSpeed = () => (P().wildT > 0 ? ABILITIES.wild.speed : 1);
  function powHurt(d) {
    const p = P(), h = S.hero, U = ABILITIES.unbreak;
    if (p.unbreakT <= 0 && p.unbreakCd <= 0 && has('unbreak') && h.hp - d < h.maxHp * U.below) { p.unbreakT = U.dur; p.unbreakCd = U.every; ev('powUnbreak', { dur: U.dur }); toast('[Unbreakable] Nothing brings you down for 8 s.', 'good'); }
    if (p.unbreakT > 0 && h.hp - d < 1) d = Math.max(0, h.hp - 1);
    return d;
  }
  function powHit(m, src, ally) {
    const p = P(), k = p.hawk;
    return (k && k.tgt === m.id && k.markT > 0 ? ABILITIES.hawk.mark : 1) * (p.smokeT > 0 && src === 'hero' ? ABILITIES.smoke.dmgK : 1) * (ally && has('skirm') ? ABILITIES.skirm.ally : 1);
  }
  const powWard = b => (has('iron') && !S.hero.dead && Math.hypot(S.hero.x - b.x, S.hero.y - b.y) < ABILITIES.iron.r ? ABILITIES.iron.ward : 1);
  function powTower(b, nearHero) {
    const R = P().rally;
    return (R && Math.hypot(b.x - R.x, b.y - R.y) < R.r ? R.tower : 1) * (nearHero && has('skirm') ? ABILITIES.skirm.tower : 1);
  }
  const hidden = () => P().smokeT > 0;

  // ---------- the autopilot and the bots: each active when it pays ----------
  function powersAuto() {
    const h = S.hero, p = P(); if (h.dead || S.over || !G.statsOn()) return false;
    const ready = id => has(id) && !((p.cd[id] || 0) > 0);
    const c = G.c, nightNear = S.phase === 'night' && near(c, c, 14) >= 6;
    let used = false;
    if (ready('cleave') && near(h.x, h.y, D('cleave').r) >= 3) used = usePower('cleave') || used;
    if (ready('burst') && (crowd(h.x, h.y, D('burst').reach, D('burst').r) || { n: 0 }).n >= 4) used = usePower('burst') || used;
    if (ready('blink') && h.hp > h.maxHp * 0.45 && near(h.x, h.y, D('blink').reach) >= 2 && Math.hypot(h.x - c, h.y - c) < 16) used = usePower('blink') || used;
    if (ready('rally') && nightNear) used = usePower('rally') || used;
    if (ready('wild') && (nightNear || near(h.x, h.y, 8) >= 4)) used = usePower('wild') || used;
    if (ready('arise') && p.corpses.filter(q => S.time - q.at <= ABILITIES.arise.window && Math.hypot(q.x - h.x, q.y - h.y) <= ABILITIES.arise.r).length >= 3) used = usePower('arise') || used;
    return used;
  }
  /** what the ability bar shows: the actives you hold, their cooldowns and live states */
  function powersInfo() {
    const p = P();
    return { actives: Object.keys(ACT).filter(id => has(id)).map(id => { const d = D(id); return { id, name: d.name, icon: d.icon, cd: p.cd[id] || 0, cdMax: d.cd * ABILITY_CD_K * G.cdCut() * (S.P.abilityCd || 1) }; }),
      wild: p.wildT, unbreak: p.unbreakT, smoke: p.smokeT, rally: p.rally ? p.rally.left : 0, mark: p.hawk && p.hawk.markT > 0 ? p.hawk.tgt : -1 };
  }
  const powSave = () => ({ crew: S.allies.filter(a => a.crew).length });
  function powLoad() { S.pow = fresh(); dismiss(a => a.crew || a.risen); ensureCrew(); }
  return { usePower, stepPowers, powersAuto, powersInfo, powDmg, powRate, powSpeed, powHurt, powHit, powWard, powTower, powSave, powLoad, powHidden: hidden };
}
