// [mech] The Mechanic, the only class: the wrench (a weak auto-hit), the System's lines as Kai levels, Salvage (cars and
// machines in the engine town give scrap and parts, once a day each), the parts stock, and what the scrap turret line
// needs from the rules: slots by level, tiers gated on the Rig's Workshop and paid in parts, building out in the town,
// no crew, Field Repair, Overclock and the Rivet Cannon's pierce. The numbers live in content/mechanic.js.
import { WRENCH, SALVAGE, TURRETS, SLOTS, XP, LEVELS, SKILLS } from '../content/mechanic.js';
import { MOBS } from '../content/mobs.js';
import { BIG, REGEN } from './state.js';
import { Rng, hashSeed } from './rng.js';
import { N, idx, inside } from './mapgen.js';
import { pointInObb } from '../engine/geom.js';

// a turret may also go up out in the town: on open ground the hero has seen, this close to where Kai stands
export const FIELD = { r: 7 };

// what an engine atom gives when stripped (null: not salvage)
function kindOf(d) {
  const t = d.tags;
  if (d.kind === 'vehicle') return t.includes('camp') || t.includes('rig') ? null : t.includes('railcar') ? 'machine' : t.includes('bus') ? 'bus' : t.includes('van') ? 'van' : t.includes('tractor') ? 'tractor' : 'car';
  if (d.kind !== 'building') return null;
  if (d.offers.includes('fuel') || t.includes('industrial')) return 'machine';   // pumps, lathes, the depot floor
  if (d.id.startsWith('shed.')) return 'bench';   // a garden shed: somebody's tools
  return null;
}

export function createMechanic(G) {
  const { S, map, ev, fail, toast } = G;
  const rng = new Rng(hashSeed(G.seed, 'salvage'));   // its own stream: salvaging never moves the run's draws
  const M = () => S.mech || (S.mech = { done: {}, at: -1, t: 0, told: 0 });
  if (S.parts === undefined) S.parts = 0;
  M();

  // ---------- the salvage spots: the engine town's cars and machines ----------
  const A = map.area, spots = [];
  if (A) A.W.placed.forEach(p => { const k = kindOf(p.def); if (!k) return; const x = p.x + A.ox, y = p.y + A.oy; if (!inside(Math.floor(x), Math.floor(y)) || !A.mask[idx(Math.floor(x), Math.floor(y))]) return;
    spots.push({ id: spots.length, kind: k, name: SALVAGE.kinds[k].name, x, y, w: p.w, h: p.h, rot: p.rot || 0, ex: p.x, ey: p.y }); });
  const touch = (o, x, y) => pointInObb({ x: o.ex, y: o.ey, w: o.w, h: o.h, rot: o.rot }, x - A.ox, y - A.oy, SALVAGE.reach);
  const salvaged = id => M().done[id] === S.night;

  // ---------- levels: what the Mechanic has at this level ----------
  const gets = (lv = S.lvl) => LEVELS.filter(L => L.lv <= lv).flatMap(L => L.gets);
  const skill = id => gets().includes(id);
  const salvageLv = () => Math.max(1, ...gets().filter(g => g.startsWith('salvage:')).map(g => +g.split(':')[1]));
  const slots = () => SLOTS[Math.min(SLOTS.length, S.lvl) - 1];
  const turrets = () => S.buildings.filter(b => b.type === 'tower').length;
  /** the System's lines for a new level (hero.js gainXp) */
  function levelUp(lv) { const L = LEVELS.find(q => q.lv === lv); for (const line of (L ? L.sys : [`[Mechanic · Lv ${lv}]`])) toast(line, 'good'); ev('skill', { id: `mechanic${lv}` }); }
  /** xp for a kill (combat.js killMob): the wrench a little, turrets less */
  const killXp = (m, src) => (src === 'hero' || src === 'merc' || src === 'volley' ? XP.kill : src === 'tower' || src === 'keep' ? XP.turretKill : 0) * (MOBS[m.kind].size >= BIG ? 5 : 1);

  // ---------- the wrench: hits the nearest Ash-Born in reach by itself (hero.js stepHero) ----------
  function wrench(moving) {
    const h = S.hero; if (h.cd > 0) return;
    const reach = WRENCH.reach + S.P.heroRange; let best = null, bd = reach;
    for (const m of S.mobs) { if (m.rise < 1) continue; const d = Math.hypot(m.x - h.x, m.y - h.y) - 0.3 * MOBS[m.kind].size; if (d < bd) { bd = d; best = m; } }
    if (!best) return;
    h.cd = G.heroRate(); h.swing = 0.25; h.attacks++; h.noiseT = 3; h.fightT = REGEN.combat; if (!moving) h.face = Math.atan2(best.x - h.x, best.y - h.y);
    G.hitMob(best, G.heroDmg(), 'hero');
    if (best.hp > 0 && MOBS[best.kind].size < BIG) {   // a clang that shoves it back a step
      const dx = best.x - h.x, dy = best.y - h.y, L = Math.hypot(dx, dy) || 1, nx = best.x + dx / L * WRENCH.knock, ny = best.y + dy / L * WRENCH.knock;
      if (G.standable(best, nx, ny)) { best.x = nx; best.y = ny; }
    }
    ev('swing');
  }

  // ---------- salvage: stand at a car or machine for a moment, once a day each ----------
  function stepSalvage(dt) {
    const s = M();
    if (!s.told && S.time > 0.5) { s.told = 1; for (const line of LEVELS[0].sys) toast(line, 'good'); }   // [Class granted: Mechanic]
    if (!spots.length) return;
    const h = S.hero; if (h.dead || S.over) { s.at = -1; s.t = 0; return; }
    let near = -1, bd = Infinity;
    for (const o of spots) { const d = Math.abs(o.x - h.x) + Math.abs(o.y - h.y); if (d < bd && d < 12 && !salvaged(o.id) && touch(o, h.x, h.y)) { bd = d; near = o.id; } }
    const o = spots[near], need = o ? Math.max(SALVAGE.minTime, SALVAGE.kinds[o.kind].time - SALVAGE.faster * (salvageLv() - 1)) : 0;
    if (near !== s.at) { s.at = near; s.t = 0; if (o) ev('salvageStart', { id: near, x: o.x, y: o.y, dur: need }); }
    if (!o) return;
    s.t += dt; h.noiseT = Math.max(h.noiseT || 0, SALVAGE.noise);   // loud work: roamers nearby notice
    if (s.t < need) return;
    const K = SALVAGE.kinds[o.kind], lv = salvageLv(), scrap = K.scrap + SALVAGE.scrapUp * (lv - 1), chance = Math.min(2, K.part + SALVAGE.partUp * (lv - 1));
    const parts = Math.floor(chance) + (rng.chance(chance - Math.floor(chance)) ? 1 : 0);
    s.done[o.id] = S.night; s.at = -1; s.t = 0;
    h.carry.scrap += scrap; S.parts += parts; S.stats.salvaged = (S.stats.salvaged || 0) + 1;
    ev('salvage', { id: o.id, kind: o.kind, n: scrap, parts, x: o.x, y: o.y });
    toast(`[Salvaged] A ${K.name}: **+${scrap} scrap**${parts ? ` · **+${parts} ${parts === 1 ? 'part' : 'parts'}**` : ''}.`, 'good');
    G.gainXp(XP.salvage);
  }
  // ---------- skills that act every step: Field Repair (stand at a hurt turret) ----------
  function stepSkills(dt) {
    const h = S.hero; if (h.dead || h.moving || !skill('repair')) return;
    const R = SKILLS.repair, b = S.buildings.find(q => q.type === 'tower' && !q.ruined && q.built >= 1 && q.hp < q.maxHp && Math.hypot(q.x - h.x, q.y - h.y) < R.reach + 0.8);
    if (b) b.hp = Math.min(b.maxHp, b.hp + R.hps * dt);
  }

  // ---------- the turret line's rules (hooks in buildings.js, build.js, combat.js) ----------
  const partsFor = (type, level) => (type === 'tower' ? (TURRETS[level - 1] || { cost: { parts: 0 } }).cost.parts : 0);
  /** why a new turret cannot go up ('' = it can): the slots the System allows at this level */
  const slotBlock = type => (type === 'tower' && turrets() >= slots() ? `[Turret slots: ${slots()}] All in use. Level up for more.` : '');
  /** why a turret cannot go up a tier ('' = it can): the Workshop, then parts */
  function turretBlock(b) {
    const next = TURRETS[b.level]; if (!next) return 'Cannot upgrade.';
    if (b.ruined) return 'Rebuild it first.';
    if (next.needs === 'workshop' && !G.rigHas('workshop')) return `The ${next.name} needs the Rig's Workshop.`;
    if (next.needs === 'workshop2' && G.rigLevel('workshop') < 2) return `The ${next.name} needs the Workshop at Lv 2.`;
    if (S.parts < next.cost.parts) return `The ${next.name} needs ${next.cost.parts} parts.`;
    return '';
  }
  /** a turret out in the town: open ground Kai has seen, near where she stands (buildings.js canPlace) */
  const turretField = i => { const h = S.hero, x = i % N, y = (i / N) | 0; return !h.dead && S.seen[i] === 1 && Math.hypot(x + 0.5 - h.x, y + 0.5 - h.y) < FIELD.r; };
  /** turrets are machines: no crew (combat.js crewing) */
  const turretCrew = () => 0;
  /** what the Mechanic and the Rig add to a turret's shot (combat.js towerStats): Overclock near Kai, floodlit ground */
  function turretMod(b) {
    const h = S.hero, O = SKILLS.overclock;
    const rate = skill('overclock') && !h.dead && Math.hypot(h.x - b.x, h.y - b.y) < O.r ? O.rate : 1;
    return { rate, dmg: G.rigLit && G.rigLit(b.x, b.y) ? G.rigLit(b.x, b.y) : 1 };
  }
  /** the Rivet Cannon's rivet goes on into the next dead behind (combat.js stepTowers) */
  function turretShot(b, target, t) {
    const T = TURRETS[b.level - 1]; if (!T || !T.pierce) return;
    let from = target; const hit = [target];
    for (let k = 1; k < T.pierce; k++) { let nx = null, nd = 1.8; for (const o of S.mobs) { if (o.rise < 1 || hit.includes(o) || MOBS[o.kind].animal) continue; const d = Math.hypot(o.x - from.x, o.y - from.y); if (d < nd && Math.hypot(o.x - b.x, o.y - b.y) >= Math.hypot(from.x - b.x, from.y - b.y) - 0.3) { nd = d; nx = o; } } if (!nx) break; hit.push(nx); G.fire(3, b.x, b.y, nx, t.dmg, 'tower'); from = nx; }
  }

  // ---------- parts ----------
  const parts = () => S.parts;
  const addParts = n => { S.parts = Math.max(0, S.parts + n); return S.parts; };
  const payParts = n => { if (S.parts < n) return fail(`Not enough parts (${n} needed).`); S.parts -= n; return true; };
  /** the Mechanic's sheet for the UI */
  const mechInfo = () => ({ lvl: S.lvl, xp: S.xp, need: XP.need(S.lvl), salvage: salvageLv(), slots: slots(), turrets: turrets(), skills: gets().filter(g => SKILLS[g]).map(g => SKILLS[g].name), parts: S.parts, wrench: { dmg: G.heroDmg(), rate: G.heroRate(), reach: WRENCH.reach } });
  const turretInfo = level => { const T = TURRETS[level - 1]; return T ? { ...T } : null; };

  return { wrench, levelUp, killXp, stepSalvage, stepSkills, salvaged, salvageSpots: () => spots, salvageAt: () => M().at, salvageT: () => M().t, salvageLv,
    partsFor, slotBlock, turretBlock, turretField, turretCrew, turretMod, turretShot, parts, addParts, payParts, mechInfo, turretInfo, mechSkill: skill, turretSlots: () => ({ used: turrets(), max: slots() }) };
}
