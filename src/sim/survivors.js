// [ch1] The chapter's survivors (story1.js SURVIVORS, rig2.js CREW2): Lotte on the water tower, Benno in the town
// hall, Gus at the hut by Mast Two. Each waits at her or his place until the step that rescues them closes, then lives
// at the Rig if a bed is free (the Rig's bunks come from another branch: G.rigBeds, else CREW.beds), or waits there for
// one. At the Rig each does a job: Lotte runs half your carry home while you are out, Benno adds food to every house
// you search and files a part each dawn, Gus mends the Rig at night and names the march at dusk. State: S.ch.surv.
import { SURVIVORS, SYS1 } from '../content/story1.js';
import { CREW } from '../content/ch1tune.js';

export function createSurvivors(G) {
  const { S, c, keep } = G;
  const SV = () => S.ch.surv;
  const HOME = [[-4.2, 2.6], [4.2, 2.6], [0, 5.4]];   // where they stand round the Rig
  function survivorsInit() { for (const id of Object.keys(SURVIVORS)) if (!SV()[id]) SV()[id] = { state: 'away' }; }
  const beds = () => (G.rigBeds ? G.rigBeds() : CREW.beds);
  const home = () => Object.values(SV()).filter(v => v.state === 'home').length;
  const party = () => 1 + home();
  /** a rescue: home to the Rig if there is a bed, else she waits at the Rig door for one */
  function rescue(id) {
    const v = SV()[id]; if (!v || v.state === 'home') return;
    if (home() < beds()) { v.state = 'home'; G.chSys(SYS1.party(party()), 'win'); G.ev('survivorHome', { id, name: SURVIVORS[id].name }); }
    else { v.state = 'wait'; G.chSys('[Party: no free bed]', 'bad'); }
  }
  const at = id => { const v = SV()[id], P = G.places() || {}; if (v.state === 'away') { const p = P[SURVIVORS[id].found]; return p ? { x: p.at.x + 0.8, y: p.at.y - 0.6, up: id === 'lotte' } : null; } const k = Object.keys(SURVIVORS).indexOf(id), o = HOME[k % HOME.length]; return { x: c + o[0], y: c + o[1] }; };
  let carryT = 0, fixT = 0;
  function stepSurvivors(dt) {
    for (const [id, v] of Object.entries(SV())) if (v.state === 'wait' && home() < beds()) rescue(id);
    const h = S.hero, out = Math.hypot(h.x - c, h.y - c) > 14;
    // Lotte: half your carry runs home while you are out in the town
    if (SV().lotte && SV().lotte.state === 'home' && out && !h.dead && (h.carry.scrap || h.carry.food)) {
      if ((carryT += dt) >= CREW.carryEvery) { carryT = 0; const s = Math.floor(h.carry.scrap / 2), f = Math.floor(h.carry.food / 2); if (s || f) { h.carry.scrap -= s; h.carry.food -= f; G.earn(s); S.food += f; G.ev('crewRun', { id: 'lotte', scrap: s, food: f }); } }
    } else carryT = 0;
    // Gus: the Rig mends at night when it is hit
    if (SV().gus && SV().gus.state === 'home' && S.phase === 'night' && !keep.ruined && keep.hp < keep.maxHp) keep.hp = Math.min(keep.maxHp, keep.hp + CREW.repairRig * dt);
    fixT += dt;
  }
  function onSurvivorEvent(e) {
    if (e.t === 'search' && SV().benno && SV().benno.state === 'home') S.hero.carry.food += CREW.searchFood;
    if (e.t === 'dawn' && SV().benno && SV().benno.state === 'home') { if (G.addParts) G.addParts(CREW.partsDawn); else G.earn(CREW.partsAsScrap); }
    if (e.t === 'night' && SV().gus && SV().gus.state === 'home') { const f = G.forecast ? G.forecast() : []; if (f.length) G.chSys(`[Movement: ${G.compass(f[0].x, f[0].y)} · ${f[0].count}]`, 'bad'); }
    if (e.t === 'dawn' && SV().lotte && SV().lotte.state === 'home') { const f = G.hordeMarch ? G.hordeMarch(S.night) : []; if (f.length) G.chSys(`[Lotte: they come from the ${G.compass(f[0].x, f[0].y)}]`, 'bad'); }
  }
  const survivors = () => (S.ch ? Object.keys(SURVIVORS).map(id => ({ id, name: SURVIVORS[id].name, state: SV()[id].state, ...(at(id) || {}) })) : []);
  return { survivorsInit, rescue, stepSurvivors, onSurvivorEvent, survivors, partyCount: party };
}
