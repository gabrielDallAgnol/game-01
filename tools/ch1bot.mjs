// [ch1] A scripted chapter-1 player for tests and tools: it walks (teleports) Kai to each objective, works each job,
// breaks packs and hearts (killMob on the chapter's own dead), builds a turret when asked and sleeps through the nights
// with the camp held. Not a balance bot (tools/clockbot.mjs is): it proves the chain runs end to end, deterministically.
//   import { playChapter } from './ch1bot.mjs'; playChapter(game, { log }) → { ended, night, steps, done, notes, heard, ... }
const near = (a, b, r) => Math.hypot(a.x - b.x, a.y - b.y) < r;

export function playChapter(g, { log = null, cap = 60 * 60 * 120, gus = true, hold = true } = {}) {
  const S = g.state, c = g.map.town.x; let n = 0;
  const say = (...a) => { if (log) log(...a); };
  const tp = (x, y) => { S.hero.x = x; S.hero.y = y; S.hero.target = null; S.hero.path = null; };
  const tick = () => { g.step(); n++; g.drainEvents(); };
  const wait = s => { for (let k = 0; k < s * 60 && !S.over; k++) tick(); };
  let built = false;
  while (!S.over && n < cap) {
    const C = g.chapter(); if (!C) break;
    S.gold = Math.max(S.gold, 40); if (g.addParts && g.parts() < 10) g.addParts(10);   // the bot is not here to earn: every job is affordable
    if (hold && S.phase === 'night') { S.keep.hp = S.keep.maxHp; for (const m of S.mobs.filter(q => Math.hypot(q.x - c, q.y - c) < 12 && q.kind !== 'heart')) g.killMob(m, 'tower'); }
    if (S.hero.dead) { wait(1); continue; }
    // the chapter's own dead (packs, halls, the Warden, the heart once open) fall to the bot
    const mine = S.mobs.filter(m => m.chPack !== undefined && m.chPack !== 'chase' || (m.kind === 'guardian'));
    const nests = g.chNests().filter(o => o.state === 'live');
    if (mine.length && C.open.some(id => /q3.steps|q4.cinema|q6.shed|q7.halls|q7.heart/.test(id))) { for (const m of mine.slice(0, 4)) g.killMob(m, 'hero'); wait(0.3); continue; }
    const heartStep = C.open.find(id => /q4.cinema|q6.shed|q7.heart/.test(id));
    if (heartStep) { const o = nests.find(q => !q.sealed && (heartStep === 'q4.cinema' ? q.id === 'cinema' : heartStep === 'q6.shed' ? q.id === 'shed' : q.id === 'works')); const h = o && S.mobs.find(m => m.kind === 'heart' && m.chNest === o.id); if (h) { tp(o.at.x, o.at.y + 1); g.killMob(h, 'hero'); wait(0.5); continue; } }
    // open jobs: stand on one until it fills
    const opt = gus ? C.work : C.work.filter(w => !/hut/.test(w.label));
    const w = opt.find(q => C.objective && C.open.some(id => q.id.startsWith(id + ':')) && q.id.startsWith(C.objective.id + ':')) || opt[0];
    if (w) { tp(w.x, w.y); wait(Math.min(25, w.time + 0.6)); continue; }
    // the Rig's modules the chain asks for (sim/rig.js), paid for
    const mod = C.open.map(id => ({ 'q2.bunks': 'bunks', 'q3.roof': 'roofTurret' })[id]).find(Boolean);
    if (mod && g.rigBuild && g.rigBuild(mod)) { if (g.addParts) g.addParts(10); wait(15); continue; }
    if ((C.open.includes('q5.gus') || g.survivors().some(v => v.state === 'wait')) && g.rigLevel && g.rigLevel('bunks') < 2 && !(S.rig && S.rig.job) && g.rigBuild('bunks')) { wait(15); continue; }
    if (C.open.includes('q1.turret') && !built) { built = true; for (const l of g.map.slots) if (g.build(l.id, 'tower')) { say('built a tower'); break; } wait(1); continue; }
    const o = C.objective;
    if (o && o.id === 'q1.salvage' && o.x !== null) { tp(o.x, o.y); wait(4); continue; }
    if (o && o.x !== null && !near(S.hero, o, 1.2) && o.id !== 'q7.roll') { tp(o.x, o.y); wait(0.6); continue; }
    if (o && o.id === 'q7.carry') { tp(c, c + 3.5); wait(0.5); continue; }
    // the steps that open on entering a place come from walking the town: visit the places the night's beats need
    const P = g.places(), visit = { 2: ['watertower'], 3: ['townhall'], 4: ['cinema', 'garage'], 5: ['shed', ...(gus ? ['hut'] : [])], 6: ['shed'], 7: ['works'] }[S.night] || [];
    const todo = visit.filter(id => P[id] && !C.done.some(d => (id === 'watertower' && d === 'q2.bunks') || (id === 'townhall' && d === 'q3.steps') || (id === 'cinema' && d === 'q4.cinema') || (id === 'shed' && d === 'q6.shed') || (id === 'hut' && d === 'q5.gus') || (id === 'garage' && d === 'q4.garage') || (id === 'works' && d === 'q7.gate')) && !(S.visited || (S.visited = {}))[`${S.night}:${id}`]);
    if (S.phase === 'day' && todo.length) { S.visited[`${S.night}:${todo[0]}`] = 1; tp(P[todo[0]].at.x, P[todo[0]].at.y); wait(1); continue; }
    // a house on Main Street, once, for Benno's forms
    if (S.night >= 3 && S.phase === 'day' && !C.open.includes('q3.stamps') && !C.done.includes('q3.stamps')) { const h = g.searchHomes().find(q => g.districtOf(q.x, q.y) === 'main' && !g.searched(q.id)); if (h) { tp(h.x, h.y); wait(2); continue; } }
    if (C.open.includes('q7.roll') || C.open.includes('q7.fit')) { tp(c, c + 3.5); wait(1); continue; }
    // nothing to do by day: home, then the night
    if (S.phase === 'day') { tp(c, c + 3.5); g.startNight(); say(`night ${S.night}: open ${C.open.join(',')} done ${C.done.length}`); continue; }
    if (hold) { S.keep.hp = S.keep.maxHp; for (const m of S.mobs.filter(q => Math.hypot(q.x - c, q.y - c) < 9)) g.killMob(m, 'tower'); }
    wait(1);
  }
  const C = g.chapter();
  return { ended: !!(C && C.ended), won: !!S.won, night: S.night, steps: n, done: C ? C.done : [], open: C ? C.open : [], notes: g.notes(), heard: g.heard(), survivors: g.survivors().map(s => `${s.id}:${s.state}`), stats: C && C.stats };
}
