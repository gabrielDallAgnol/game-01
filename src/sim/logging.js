// [gemini3] Felling trees on your land as a job, and the Logger's Hut (numbers and the why: content/logging.js).
// Wraps G.rubbleAt / G.clearRubble (build.js) before the API is made, so the API, the panel and the bots get the new
// rule: a patch of trees costs nothing and pays timber, but takes time. By hand the hero must stand by it (the job
// waits while he is away); with a hut the crew does it from anywhere. A patch with rock in it is the old paid clearing.
// One job at a time (S.chop; not saved: a reload forgets a half-felled patch). Wired in game.js: MODULES + step().
import { LOGGING } from '../content/logging.js';
import { LOT_PAD, SIZE } from './state.js';
import { N, T } from './mapgen.js';

SIZE.lumbermill = 2; LOT_PAD.lumbermill = 1;   // a 2×2 shed on a lot with its path

export function createLogging(G) {
  const { S, map, ev, earn, hasTech, owns, toast } = G;
  const oldAt = G.rubbleAt, oldClear = G.clearRubble;
  const loggers = () => hasTech('lumbermill') || owns('lumber');   // a held Lumber Camp lends its saws too
  function rubbleAt(x, y) {
    const r = oldAt(x, y);
    if (!LOGGING.on || r.blocks || !r.cells.length) return r;
    const crew = loggers();
    return { ...r, cost: 0, trees: true, loggers: crew, dur: crew ? LOGGING.crew : LOGGING.hand, pay: crew ? LOGGING.pay.crew : LOGGING.pay.hand,
      job: S.chop && S.chop.cells.some(i => r.cells.includes(i)) ? jobInfo() : null };
  }
  function clearRubble(x, y) {
    const r = rubbleAt(x, y);
    if (!r.trees) return oldClear(x, y);
    if (S.over) return false;
    if (S.chop && S.chop.cells.some(i => r.cells.includes(i))) { if (!S.chop.crew && G.api) G.api.heroTo(S.chop.x, S.chop.y); return r.cells.length; }   // the same patch: walk back to it
    S.chop = { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5, cells: r.cells, crew: r.loggers, dur: r.dur, pay: r.pay, done: 0, swingT: 0 };
    if (!r.loggers && G.api) G.api.heroTo(S.chop.x, S.chop.y + 1.2);
    ev('chopStart', { x: S.chop.x, y: S.chop.y, crew: r.loggers, dur: r.dur });
    return r.cells.length;
  }
  const near = () => !S.hero.dead && Math.hypot(S.hero.x - S.chop.x, S.hero.y - S.chop.y) <= LOGGING.reach;
  function jobInfo() { const j = S.chop; return j && { x: j.x, y: j.y, crew: j.crew, progress: j.done / j.dur, left: Math.max(0, j.dur - j.done), working: j.crew || near() }; }
  function fell(cells, pay) {
    const ok = cells.filter(i => map.terrain[i] === T.FOREST && S.occ[i] < 0);
    if (!ok.length) return 0;
    for (const i of ok) map.terrain[i] = T.GRASS;
    (S.clearedIdx || (S.clearedIdx = [])).push(...ok);   // saved like any clearing (save.js `cleared`)
    S.flowDirty = true; S.occVersion = (S.occVersion || 0) + 1; S.cleared = (S.cleared || 0) + ok.length;
    if (pay) earn(pay);
    ev('clear', { cells: ok, timber: pay });
    return ok.length;
  }
  let autoT = 0, dawns = null;   // (read on the first step: a restore sets S.dawns after this module is made)
  function stepLogging(dt) {
    if (!LOGGING.on) return;
    const j = S.chop;
    if (j) {
      if (j.crew || near()) {
        j.done += dt;
        if (!j.crew && (j.swingT -= dt) <= 0) { j.swingT = LOGGING.swing; const h = S.hero; h.swing = 0.25; h.face = Math.atan2(j.x - h.x, j.y - h.y); ev('chop', { x: j.x, y: j.y }); }
      }
      if (j.done >= j.dur) { S.chop = null; const n = fell(j.cells, j.pay); if (n) toast(`${n} ${n === 1 ? 'tree' : 'trees'} down · **+${j.pay} timber** (scrap).`, 'good'); }
    }
    // the hut's crew: by day, now and then, the tree on your land nearest the Camp; and a little timber at dawn
    if (dawns === null) dawns = S.dawns;
    if (S.dawns !== dawns) { dawns = S.dawns; if (hasTech('lumbermill')) earn(LOGGING.dawn); }
    if (S.phase !== 'day' || !hasTech('lumbermill')) return;
    if ((autoT += dt) < LOGGING.auto.every) return; autoT = 0;
    const z = G.zone(), c = G.c; let best = -1, bd = Infinity;
    for (let i = 0; i < z.length; i++) {
      if (!z[i] || map.terrain[i] !== T.FOREST || S.occ[i] >= 0 || map.lm[i] >= 0 || map.region[i] < 0) continue;
      const d = Math.hypot(i % N - c, Math.floor(i / N) - c); if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0) fell([best], LOGGING.auto.pay);
  }
  G.rubbleAt = rubbleAt; G.clearRubble = clearRubble;
  Object.assign(G.g3api || (G.g3api = {}), { chopJob: () => jobInfo(), loggers, cancelChop: () => { S.chop = null; return true; } });   // added to the API in game.js
  return { rubbleAt, clearRubble, stepLogging, chopJob: jobInfo };
}
