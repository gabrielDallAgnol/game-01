// [mech] The Haven Rig as the base: Kai's tow truck Hilde in the church square is the keep (S.keep), and it grows with
// modules bolted on (content/rig2.js MODULES): Bunks (beds for survivors), the Roof Turret (the Rig shoots), the
// Workshop (turret tiers, faster building), Floodlights (lit ground slows the dead, turrets hit harder), the Rig Radio
// (names the march at dusk) and Plating (Rig health). Installing one takes scrap, parts and a little time.
// S.rig: { lv: { id: level }, job: { id, lv, work, need } | null, cd, dusk, engine }
import { RIG2, MODULES, MODULE_ORDER, UNLOCK_NIGHT } from '../content/rig2.js';
import { MOBS } from '../content/mobs.js';

const BY = Object.fromEntries(MODULES.map(m => [m.id, m]));

export function createRig(G) {
  const { S, c, keep, ev, fail, toast } = G;
  const R = () => S.rig || (S.rig = { lv: {}, job: null, cd: 0, dusk: 0, engine: false });
  const rigLevel = id => R().lv[id] || 0;
  const rigHas = id => rigLevel(id) > 0;
  /** what a module does at a level: its fx, with the upgrade's fx laid over from Lv 2 */
  const fxOf = (m, lv) => (lv >= 2 && m.up ? { ...m.fx, ...m.up.fx } : m.fx);
  const costAt = (m, lv) => (lv >= 2 && m.up ? m.up.cost : m.cost);
  const stepOf = (m, lv) => (lv >= 2 && m.up && m.up.unlock) || m.unlock;
  /** has the story opened this step? the chapter's quest engine when it is there, else the night (rig2.js UNLOCK_NIGHT) */
  const opened = step => (G.questDone ? G.questDone(step) : S.night >= (UNLOCK_NIGHT[step] ?? 1));
  /** why this module cannot be installed (or raised a level) now ('' = it can) */
  function rigBlock(id) {
    const m = BY[id]; if (!m) return 'No such module.';
    const lv = rigLevel(id) + 1, cost = costAt(m, lv);
    if (lv > m.lv) return 'Fully fitted.';
    if (R().job) return `The crew is still fitting the ${BY[R().job.id].name}.`;
    if (keep.ruined) return 'The Rig is wrecked.';
    if (!opened(stepOf(m, lv))) return 'Not yet: nobody knows how.';
    if (m.needs && lv === 1 && G.hasSurvivor && !G.hasSurvivor(m.needs)) return `Needs ${m.needs === 'gus' ? 'Gus' : m.needs} at the Rig.`;
    if (S.gold < cost.scrap) return `Needs ${cost.scrap} scrap.`;
    if (S.parts < cost.parts) return `Needs ${cost.parts} parts.`;
    return '';
  }
  /** start fitting a module (or its next level): pays now, done after its build time */
  function rigBuild(id) {
    if (S.over) return false;
    const why = rigBlock(id); if (why) return fail(why);
    const m = BY[id], lv = rigLevel(id) + 1, cost = costAt(m, lv);
    S.gold -= cost.scrap; S.parts -= cost.parts; S.stats.goldSpent += cost.scrap; if (S.cur) S.cur.spent += cost.scrap;
    R().job = { id, lv, work: 0, need: m.build / rigBuildSpeed() };
    ev('rigJob', { id, lv, dur: R().job.need });
    toast(`[Fitting: ${m.name}${lv > 1 ? ` · Lv ${lv}` : ''}] ${Math.round(R().job.need)} s.`, 'good');
    return true;
  }
  const rigBuildSpeed = () => 1 + (rigHas('workshop') ? fxOf(BY.workshop, rigLevel('workshop')).buildFaster || 0 : 0);
  /** the modules for the Rig panel, in order */
  const rigModules = () => MODULE_ORDER.map(id => { const m = BY[id], lv = rigLevel(id), j = R().job; return { id, name: m.name, line: m.line, lv, max: m.lv, cost: lv < m.lv ? costAt(m, lv + 1) : null, fx: lv ? fxOf(m, lv) : null, next: lv < m.lv ? fxOf(m, lv + 1) : null, block: rigBlock(id), fitting: j && j.id === id ? j.work / j.need : null }; });

  // ---------- what the modules do ----------
  const rigBeds = () => (rigHas('bunks') ? fxOf(BY.bunks, rigLevel('bunks')).beds : 0);
  const rigHpMult = () => 1 + BY.plating.fx.hp * rigLevel('plating');
  /** the roof turret's gun (combat.js stepTowers fires it from the keep), or null: the bare Rig does not shoot */
  const rigGun = () => (rigHas('roofTurret') ? BY.roofTurret.fx : null);
  const FL = BY.floodlights.fx;
  const night = () => S.phase === 'night';
  /** floodlit ground near the Rig: the multiplier a turret standing there hits with (null: dark) */
  const rigLit = (x, y) => (rigHas('floodlights') && night() && Math.hypot(x - c, y - c) < FL.cone ? FL.turretDmg : null);

  function stepRig(dt) {
    const r = R(), j = r.job;
    if (j) { j.work += dt; if (j.work >= j.need) {
      r.lv[j.id] = j.lv; r.job = null; G.refreshMax(); if (j.id === 'plating') keep.hp = Math.min(keep.maxHp, keep.hp + keep.maxHp * BY.plating.fx.hp);
      ev('rigModule', { id: j.id, lv: j.lv }); toast(`[Module installed: ${BY[j.id].name}${j.lv > 1 ? ` · Lv ${j.lv}` : ''}]`, 'win');
    } }
    if (keep.ruined || S.over) return;
    // floodlights: the dead in the light walk slower
    if (rigHas('floodlights') && night()) for (const m of S.mobs) if (m.rise >= 1 && !MOBS[m.kind].animal && Math.abs(m.x - c) < FL.cone && Math.hypot(m.x - c, m.y - c) < FL.cone) { m.slowK = m.slowUntil > S.time ? Math.min(m.slowK || 1, FL.slow) : FL.slow; m.slowUntil = Math.max(m.slowUntil || 0, S.time + 0.25); }
    // the Rig Radio names the march at dusk
    if (S.phase === 'night' && r.dusk !== S.night) { r.dusk = S.night; if (rigHas('radio')) { const f = G.forecast(); toast(f.length ? `[Rig Radio] ${f.map(h => `${h.count} Ash-Born march from the ${G.compass(h.x, h.y)}`).join('. ')}.` : '[Rig Radio] No march tonight. Hold.', 'warn'); } }
  }
  /** the chapter's end (branch v2-ch1 drives it): the engine fixed, Hilde can drive */
  const rigFixEngine = () => { R().engine = true; ev('rigEngine'); return true; };
  const rigReady = () => !!R().engine && !keep.ruined;
  R();
  return { rigLevel, rigHas, rigBlock, rigBuild, rigModules, rigBeds, rigHpMult, rigGun, rigLit, rigBuildSpeed, stepRig, rigFixEngine, rigReady, RIG_HP: RIG2.hp };
}
