// [ch1] The chapter-1 quest engine: runs story1.js STEPS in Hollowmere. A step opens when its trigger fires (start,
// dusk or dawn of a night, an earlier step done, a place entered, a house searched in a district, a sim event), shows
// itself only as a short [bracketed] System line over Kai, and closes when its goal is met (salvage, build, survive,
// reach, repair, break a pack, destroy a nest, carry, leave); then it pays its reward. Jobs that need Kai's hands (a
// repair, the bench, the gate, the crankshaft fit) are work spots: stand at one and it fills. Day and night lengths
// follow the chapter's pacing (S.tide). State lives in S.ch (saved at dawn). Deterministic: its own Rng stream.
// The other chapter modules (places, worldtext, survivors, chnests) hang off it through G; nothing runs outside Hollowmere.
import { Rng, hashSeed } from './rng.js';
import { STEPS, SYS1 } from '../content/story1.js';
import { PACE, WORK, PACKS, NEST1, FINALE } from '../content/ch1tune.js';
import { TIDE } from '../content/mobs.js';

const BYID = Object.fromEntries(STEPS.map(s => [s.id, s]));
// what a goal reads as over Kai (the step's own sys line wins)
const PLACE_WORD = { watertower: 'the water tower', townhall: 'the town hall', shed: 'the goods shed', garage: 'your garage', hut: 'the hut at Mast Two', rig: 'the Rig', works: 'the Engine Works', cinema: 'the cinema' };
export function goalText(s) {
  const g = s.goal;
  switch (g.op) {
    case 'salvage': return g.what === 'car' ? `Salvage ${g.n} vehicles.` : g.what === 'bench' ? 'Strip your bench at the garage.' : g.what === 'gate' ? 'Break open the Works gate.' : `Salvage the ${g.what}.`;
    case 'build': return g.what === 'nail' ? 'Build a scrap turret.' : g.what === 'bunks' ? 'Build bunks at the Rig.' : g.what === 'roofTurret' ? 'Build the roof turret.' : `Build the ${g.what}.`;
    case 'survive': return 'Survive the night.';
    case 'reach': return `Reach ${PLACE_WORD[g.place] || g.place}.`;
    case 'repair': return g.place === 'watertower' ? 'Fix the ladder.' : g.place === 'hut' ? 'Fix the generator.' : g.place === 'rig' ? 'Fit the crankshaft. Hold on.' : 'Repair it.';
    case 'break': return g.horde === 'works' ? 'Clear the three halls.' : 'Break the sleepers on the steps.';
    case 'destroy': return g.nest === 'works' ? 'Break the Ash Heart.' : `Break the heart of ${PLACE_WORD[g.nest] || g.nest}.`;
    case 'carry': return 'Carry the crankshaft to the Rig.';
    case 'leave': return 'Drive out north.';
    default: return '';
  }
}
export const tideFor = n => { const k = Math.max(0, Math.min(PACE.day.length - 1, n - 1)); return { ...TIDE, n, dayLen: PACE.day[k], nightLen: PACE.night[k], dayOne: PACE.day[0] }; };

export function createChapter(G) {
  const { S, map, c, keep, seed, ev, toast } = G;
  const on = !!(map.area && map.area.id === 'hollowmere') && G.chapter !== false;
  if (!on) return { stepChapter: () => {}, chapterStart: () => {}, chapterInfo: () => null, chapterOn: () => false };
  S.tide = tideFor(1);
  const rng = new Rng(hashSeed(seed, 'ch1'));
  const ch = () => S.ch;
  const evq = []; G.onEv = e => { evq.push(e); };   // every sim event, read once a step (core.js calls this)
  const sys = (text, kind = 'sys') => { if (text) ev('sys1', { text, kind }); };
  const P = () => G.places() || {};
  const isOpen = id => ch().open.includes(id), isDone = id => ch().done.includes(id);
  const hero = () => S.hero;

  // ---------- work spots: stand at one and it fills (a repair, the bench, a car to strip) ----------
  function addWork(o) { const w = { id: `${o.step}:${ch().work.length}`, t: 0, ...o }; ch().work.push(w); return w; }
  function stepWork(dt) {
    const h = hero(), W1 = ch().work; if (!W1.length) return;
    const hurt = h.hp < (ch().hpWas ?? h.hp) - 1e-6; ch().hpWas = h.hp; if (hurt) ch().pauseT = WORK.hurtPause;
    if ((ch().pauseT = Math.max(0, (ch().pauseT || 0) - dt)) > 0 || h.dead) { ch().at = null; return; }
    let at = null; for (const w of W1) if (!w.done && Math.hypot(w.x - h.x, w.y - h.y) < WORK.reach) { at = w; break; }
    if (!at) { ch().at = null; return; }
    if (ch().at !== at.id) { ch().at = at.id; ev('workStart', { id: at.id, x: at.x, y: at.y, dur: at.time, label: at.label || '' }); }
    if (at.cost && at.t === 0 && !can(at.cost)) { if (!at.told) { at.told = true; sys(`[Requires: ${at.cost.scrap || 0} scrap${at.cost.parts ? `, ${at.cost.parts} parts` : ''}]`, 'bad'); } return; }
    at.t += dt; if (at.t < at.time) return;
    if (at.cost) pay(at.cost);
    at.done = true; ch().at = null; ev('workDone', { id: at.id, x: at.x, y: at.y, step: at.step });
    G.noise && G.noise(at.x, at.y);
    if (at.car) { G.earn(WORK.carScrap); ev('salvage', { what: 'car', x: at.x, y: at.y, scrap: WORK.carScrap, src: 'ch1' }); }
    else bump(at.step, at.n || 1);
    ch().work = W1.filter(w => !w.done);
  }
  const parts = () => (G.partsHave ? G.partsHave() : Infinity);
  const can = cost => S.gold >= (cost.scrap || 0) && parts() >= (cost.parts || 0);
  const pay = cost => { S.gold -= cost.scrap || 0; S.stats.goldSpent += cost.scrap || 0; if (cost.parts && G.addParts) G.addParts(-cost.parts); };

  // ---------- packs: a group of the dead awake round a spot by day (the town hall steps, the Works' halls) ----------
  const kindsFor = () => NEST1.kinds(S.night);
  function spawnPack(id, x, y, n, opts = {}) {
    const ids = [], K = kindsFor();
    for (let k = 0; k < n; k++) { const kind = opts.kind || K[rng.weighted(K.map(q => q[1]))][0], a = rng.range(0, Math.PI * 2), d = rng.range(0.5, PACKS.spread);
      const m = G.spawnMob(kind, x + Math.cos(a) * d, y + Math.sin(a) * d, { instant: true }); m.roam = { x, y, region: -1 }; m.chPack = id; ids.push(m.id); }
    ch().packs[id] = { x, y, ids, left: n, kind: opts.kind || null };
    return ids;
  }
  const packLeft = id => { const p = ch().packs[id]; return p ? p.ids.filter(i => G.mobById.has(i)).length : 0; };

  // ---------- opening and closing steps ----------
  function open(id) {
    const s = BYID[id]; if (!s || isOpen(id) || isDone(id)) return;
    ch().open.push(id); ch().prog[id] = 0; ch().openedAt[id] = S.night;
    ev('chStep', { id, state: 'open', night: S.night });
    sys(s.goal.op === 'survive' ? '' : `[Objective] ${goalText(s)}`);
    const g = s.goal, p = P();
    if (g.op === 'salvage' && g.what === 'car' && !G.salvage) {   // no Mechanic salvage yet (another branch): the cars round the square are jobs
      const cars = map.area.W.placed.filter(q => q.def.kind === 'vehicle' && q.def.id.startsWith('car.')).map(q => G.groundNear(q.x + map.area.ox, q.y + map.area.oy, 4)).filter(q => Math.hypot(q.x - c, q.y - c) > 6).sort((a, b) => Math.hypot(a.x - c, a.y - c) - Math.hypot(b.x - c, b.y - c));
      cars.slice(0, g.n + 2).forEach(q => addWork({ step: id, x: q.x, y: q.y, time: WORK.carSalvage, car: true, label: 'car' }));
    }
    if (g.op === 'salvage' && g.place && p[g.place]) addWork({ step: id, x: p[g.place].at.x, y: p[g.place].at.y, time: g.what === 'gate' ? WORK.gate : WORK.bench, label: g.what, n: g.n || 1 });
    if (g.op === 'repair' && p[g.place]) addWork({ step: id, x: p[g.place].at.x, y: p[g.place].at.y, time: g.place === 'rig' ? FINALE.fit : g.time, cost: g.cost, label: g.place });
    if (g.op === 'break' && g.horde === 'townhall' && p.townhall) spawnPack('townhall', p.townhall.at.x, p.townhall.at.y, PACKS.townhall);
    if (g.op === 'destroy' || (g.op === 'break' && g.horde === 'works')) G.nestWake(g.nest || 'works', id);
    if (g.op === 'carry') { ch().item = g.item; S.P.heroSpeed *= FINALE.slow; ch().slowed = true; }
    if (g.op === 'repair' && g.place === 'rig') { const w = p.works; if (w) for (let k = 0; k < FINALE.chase; k++) { const a = rng.range(0, Math.PI * 2); const m = G.spawnMob(kindsFor()[rng.weighted(kindsFor().map(q => q[1]))][0], w.at.x + Math.cos(a) * 3, w.at.y + Math.sin(a) * 3, { instant: true }); m.chPack = 'chase'; } ev('hordeMarch', { horde: -1, x: w ? w.at.x : c, y: w ? w.at.y : c, n: FINALE.chase }); sys(SYS1.march('north')); }
    if (g.op === 'leave') { ch().roll = FINALE.roll; ev('rigRoll', { dur: FINALE.roll }); }
    if (g.op === 'build') checkBuild(s);
  }
  function close(id) {
    const s = BYID[id]; if (!isOpen(id)) return;
    ch().open = ch().open.filter(x => x !== id); ch().done.push(id); ch().work = ch().work.filter(w => w.step !== id);
    ev('chStep', { id, state: 'done', night: S.night });
    if (s.sys && s.goal.op !== 'reach') sys(s.sys.startsWith('[Objective]') ? `[Objective complete] ${goalText(s)}` : s.sys, 'win'); else if (s.goal.op !== 'survive') sys(SYS1.done(goalText(s).replace(/\.$/, '')), 'win');
    reward(s.reward || {});
    for (const t of STEPS) if (t.trigger.on === 'done' && t.trigger.step === id) open(t.id);
  }
  function reward(r) {
    if (r.scrap) G.earn(r.scrap);
    if (r.parts) { if (G.addParts) G.addParts(r.parts); else G.earn(r.parts); }
    if (r.xp) G.gainXp(r.xp);
    for (const u of r.unlock || []) { ch().unlocks.push(u); ev('unlock', { id: u }); if (G.rigUnlock) G.rigUnlock(u); }
    if (r.survivor) G.rescue(r.survivor);
    if (r.item) { ch().item = r.item; sys(SYS1.item, 'win'); }
    for (const o of r.open || []) ch().opened.push(o);
    if (r.end) finish();
  }
  const bump = (id, n) => { if (!isOpen(id)) return; ch().prog[id] = (ch().prog[id] || 0) + n; };

  // ---------- goals ----------
  const TURRET = /tower|nail|turret|spitter|bolt|rivet/;
  function checkBuild(s) {
    const w = s.goal.what;
    if (w === 'nail') { if (S.buildings.some(b => TURRET.test(b.type) && b.built >= 1 && !b.ruined)) close(s.id); return; }
    if (!G.rigHas || G.rigHas(w)) close(s.id);   // the Rig's modules come from another branch: without them the step passes
  }
  function checkGoals() {
    const h = hero();
    for (const id of [...ch().open]) {
      const s = BYID[id], g = s.goal;
      if (g.op === 'salvage' && (ch().prog[id] || 0) >= (g.n || 1)) close(id);
      else if (g.op === 'build') checkBuild(s);
      else if (g.op === 'reach' && !h.dead && G.atPlace(g.place, h.x, h.y)) close(id);
      else if (g.op === 'repair' && (ch().prog[id] || 0) >= 1) close(id);
      else if (g.op === 'break' && g.horde === 'townhall' && ch().packs.townhall && !packLeft('townhall')) close(id);
      else if (g.op === 'break' && g.horde === 'works' && G.nestHalls('works') === 0) close(id);
      else if (g.op === 'destroy' && G.nestBroken(g.nest)) close(id);
      else if (g.op === 'carry' && !h.dead && Math.hypot(h.x - c, h.y - c) < 6) { if (ch().slowed) { S.P.heroSpeed /= FINALE.slow; ch().slowed = false; } ch().item = null; close(id); }
      else if (g.op === 'leave' && ch().roll <= 0) close(id);
    }
  }
  // ---------- triggers ----------
  const gateOk = s => S.night >= (s.night || 1) - 1;
  function onEvent(e) {
    G.onSurvivorEvent(e);
    if (e.t === 'night') { for (const s of STEPS) if (s.trigger.on === 'dusk' && s.trigger.night === e.n) open(s.id); if (S.night === 1) firstOne(); G.radioDusk(); }
    else if (e.t === 'dawn') {
      for (const id of [...ch().open]) if (BYID[id].goal.op === 'survive' && S.night > ch().openedAt[id]) close(id);
      if (ch().marchNight && !S.over) { ch().marches++; ch().marchNight = false; for (const s of STEPS) if (s.trigger.on === 'event' && s.trigger.event === 'marchSurvived' && ch().marches >= (s.trigger.n || 1)) open(s.id); }
      for (const s of STEPS) if (s.trigger.on === 'dawn' && s.trigger.night === S.night) open(s.id);
      G.nestDawn();
    }
    else if (e.t === 'hordeMarch') ch().marchNight = true;
    else if (e.t === 'search' && G.searchHomes) {
      const o = G.searchHomes()[e.id]; if (!o) return; const d = G.districtOf(o.x, o.y);
      ch().searched[d] = (ch().searched[d] || 0) + 1;
      for (const s of STEPS) if (s.trigger.on === 'search' && s.trigger.district === d && gateOk(s) && ch().searched[d] >= (s.trigger.n || 1)) open(s.id);
      G.noteOnSearch(o, d);
    }
    else if (e.t === 'radio') { for (const s of STEPS) if (s.trigger.on === 'event' && s.trigger.event === 'carRadio' && (!s.trigger.night || s.trigger.night === S.night) && e.src !== 'rig') open(s.id); }
    else if (e.t === 'salvage') { if (!ch().carRadio || ch().carRadio !== S.night) { ch().carRadio = S.night; G.radioAt(e.x, e.y, 'car'); } for (const id of ch().open) if (BYID[id].goal.op === 'salvage' && BYID[id].goal.what === 'car' && (e.what === undefined || /car|van|bus|tractor/.test(e.what))) bump(id, 1); }
    else if (e.t === 'built') { for (const id of [...ch().open]) if (BYID[id].goal.op === 'build') checkBuild(BYID[id]); }
  }
  // night 1: one slow Ash-Born walks to the Rig at dusk (the design's first-night beat)
  function firstOne() { if (ch().first) return; ch().first = true; const a = rng.range(0, Math.PI * 2), m = G.spawnMob('walker', c + Math.cos(a) * 34, c + Math.sin(a) * 34, { instant: true }); m.speed *= 0.7; }
  function enterTick() {
    const h = hero(); if (h.dead) return; const at = G.placeAt(h.x, h.y);
    if (at) G.noteAtPlace(at);
    if (at !== ch().inPlace) { ch().inPlace = at; if (at) { ev('placeEnter', { id: at }); for (const s of STEPS) if (s.trigger.on === 'enter' && s.trigger.place === at && gateOk(s)) open(s.id); } }
    else if (at) for (const s of STEPS) if (s.trigger.on === 'enter' && s.trigger.place === at && gateOk(s) && !isOpen(s.id) && !isDone(s.id)) open(s.id);   // a step whose night came while Kai stood there
    const d = G.districtOf(h.x, h.y); if (d !== ch().district) { ch().district = d; ev('district', { id: d, name: G.districtName(h.x, h.y) }); }
  }
  // ---------- the end ----------
  function finish() {
    if (ch().ended) return; ch().ended = true;
    ch().stats = { nights: S.night, time: Math.round(S.time), kills: S.kills, searched: S.stats.searched || 0, notes: ch().notes.length, survivors: Object.values(ch().surv).filter(v => v.state === 'home').length, lvl: S.lvl };
    for (const l of SYS1.end) sys(l, 'win');
    ev('chapterEnd', { ...ch().stats });
    G.endRun(true, 'ch1');
  }

  function chapterStart() {
    if (!S.ch) S.ch = { open: [], done: [], prog: {}, openedAt: {}, work: [], packs: {}, unlocks: [], opened: [], notes: [], heard: [], searched: {}, surv: {}, nests: {}, marches: 0, item: null, roll: -1, inPlace: null, district: null };
    G.survivorsInit(); G.nestsInit();
    // the old card engine is quiet in chapter 1: the story is told in the world
    G.story.tick = () => {}; G.story.dawn = () => {};
    for (let i = S.events.length - 1; i >= 0; i--) if (S.events[i].t === 'episode') S.events.splice(i, 1);
    if (!S.restored) { S.dayT = 0; for (const l of SYS1.wake) sys(l); for (const s of STEPS) if (s.trigger.on === 'start') open(s.id); }
    else { for (const [id, p] of Object.entries(ch().packs)) if (id !== 'chase' && p.left) { const left = p.left; delete ch().packs[id]; spawnPack(id, p.x, p.y, left, { kind: p.kind }); } }
  }
  function stepChapter(dt) {
    if (!S.ch || S.over) { evq.length = 0; return; }
    if (S.tide.n !== S.night) S.tide = tideFor(S.night);
    while (evq.length) onEvent(evq.shift());
    for (const p of Object.values(ch().packs)) p.left = p.ids.filter(i => G.mobById.has(i)).length;
    if ((ch().tickT = (ch().tickT || 0) - dt) <= 0) { ch().tickT = 0.25; enterTick(); G.radioTick(); }
    stepWork(dt);
    G.stepSurvivors(dt); G.stepNests(dt);
    if (ch().roll > 0) ch().roll -= dt;
    checkGoals();
  }
  const objective = () => { const o = ch() && ch().open.map(id => BYID[id]).filter(s => !s.optional && s.goal.op !== 'survive'); const s = o && o[o.length - 1]; if (!s) return null; const g = s.goal, p = P(), pl = p[g.place || g.nest || (g.horde === 'townhall' ? 'townhall' : g.horde === 'works' ? 'works' : g.op === 'carry' ? 'rig' : '')]; const w = ch().work.find(q => q.step === s.id); return { id: s.id, text: goalText(s), x: w ? w.x : pl ? pl.at.x : null, y: w ? w.y : pl ? pl.at.y : null, n: g.n || 0, have: ch().prog[s.id] || 0 }; };
  const chapterInfo = () => (S.ch ? { open: ch().open.slice(), done: ch().done.slice(), objective: objective(), work: ch().work.map(w => ({ id: w.id, x: w.x, y: w.y, t: w.t, time: w.time, label: w.label, at: ch().at === w.id })), item: ch().item, roll: ch().roll, district: ch().district, ended: !!ch().ended, stats: ch().stats || null } : null);
  return { stepChapter, chapterStart, chapterInfo, chapterOn: () => true, chOpen: open, chClose: close, chIsOpen: isOpen, chIsDone: isDone, spawnPack, packLeft, chSys: sys, chRng: rng };
}
