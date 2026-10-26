// The story layer: threads always reach their place (or end with a card), the dawn budget holds, night 1 is
// hand-authored, the Window's daily quest, the arrival tags, a save round trip and the objectives' priorities.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, SAVE_V } from '../src/sim/game.js';
import { mapChoices } from '../src/sim/mapgen.js';
import { SLOT } from '../src/sim/story.js';
import { TIDE } from '../src/content/mobs.js';
import { chooseStory } from '../tools/bot.mjs';

const frontier = (seed, o = {}) => { const ch = mapChoices(seed)[0]; return createGame({ seed, mapSeed: ch.seed, biome: ch.biome, hero: 'survivor', ...o }); };
/** put a thread's first card on screen and answer it */
function answer(g, tid, kit) {
  const S = g.state; S.story.threads[tid] = { stage: 0, status: 'open', cast: {}, since: S.night };
  S.story.encounters = [{ id: 900, kind: 'thread', thread: tid, stage: 0, title: 't', choices: [{ id: 'go', label: 'go', fx: [{ op: 'openFor', kit }, { op: 'advance' }] }] }];
  assert.ok(g.choose('go')); return S.story.threads[tid];
}
/** walk the hero to a point and step until a card for this thread's site stage appears */
function reach(g, tid, x, y) {
  const S = g.state; S.hero.x = x; S.hero.y = y; S.mobs.length = 0;
  for (let k = 0; k < 90; k++) { g.step(1 / 60); if (S.story.encounters.some(e => e.thread === tid && e.stage === 1)) return true; }
  return false;
}

test('a thread whose site is gone gets a beacon instead, and the beacon plays the stage', () => {
  const g = frontier(2), S = g.state; S.story.encounters = [];
  for (const l of S.landmarks) if (l.kind === 'substation') l.owned = true;   // the player already claimed it
  const th = answer(g, 'channel9', 'substation');
  assert.equal(th.status, 'open');
  const sp = S.story.spots.find(x => x.thread === 'channel9');
  if (!sp) { assert.ok(S.landmarks[th.site] && !S.landmarks[th.site].owned, 'neither a site nor a beacon'); return; }
  assert.ok(reach(g, 'channel9', sp.x, sp.y), 'the beacon did not play the site stage');
});

test('a thread never fails without a card', () => {
  const g = frontier(3), S = g.state, st = g.story(); S.story.encounters = [];
  // waited too long
  S.story.threads.channel9 = { stage: 0, status: 'waiting', cast: {}, since: 1, failAt: S.night };
  st.dawn(); st.flush();
  assert.equal(S.story.threads.channel9.status, 'failed');
  assert.ok(S.story.encounters.some(e => e.thread === 'channel9' && e.ended), 'it failed in silence');
  // no way through at all
  S.story.encounters = []; S.story.threads.school = { stage: 0, status: 'open', cast: {}, since: 1 };
  S.story.encounters = [{ id: 901, kind: 'thread', thread: 'school', stage: 0, title: 't', noRegion: true, choices: [{ id: 'go', label: 'go', fx: [{ op: 'advance' }] }] }];
  g.choose('go'); st.flush();
  assert.equal(S.story.threads.school.status, 'failed');
  assert.ok(S.story.encounters.some(e => e.thread === 'school' && e.ended), 'no card for a thread with no way through');
});

test('the dawn budget: at most one story card and one System window a dawn, nothing opens at night but the night', () => {
  for (const seed of [4]) {
    const g = frontier(seed, { difficulty: 'story' }), S = g.state; g.setAutopilot(true);
    const perDawn = {}; let night = 0, bad = [];
    for (let k = 0; k < 60 * 60 * 30 && S.night <= 9 && !S.over; k++) {
      g.step(1 / 60);
      for (const e of S.events) { if (e.t === 'window') g.story().offerWin(e); if (e.t === 'encounter') { const enc = S.story.encounters.find(x => x.id === e.id); if (S.phase === 'night' && enc && enc.kind !== 'arrival') bad.push(`${S.night} ${enc.kind}`); const d = perDawn[S.night] || (perDawn[S.night] = { story: 0, sys: 0 }); if (enc && enc.dawn === S.night) d[SLOT[enc.kind] || 'story']++; } }
      S.events.length = 0;
      if (S.story.encounters.length) chooseStory(g);
      night = S.night;
    }
    assert.ok(night >= 7, `seed ${seed} only reached night ${night}`);
    assert.deepEqual(bad, [], 'cards opened at night');
    for (const [d, c] of Object.entries(perDawn)) { assert.ok(c.story <= 1, `dawn ${d}: ${c.story} story cards`); assert.ok(c.sys <= 1, `dawn ${d}: ${c.sys} System windows`); }
  }
});

test('night 1: a short first day, then the System arrives when the first dead reaches you; the gift waits for dawn 2', () => {
  const g = frontier(3), S = g.state;
  assert.ok(Math.abs(g.duskIn() - TIDE.dayOne) < 1, `day 1 is ${g.duskIn()} s, not ~${TIDE.dayOne}`);
  assert.ok(TIDE.dayOne >= 50 && TIDE.dayLen >= 160, 'days are a rush again');
  let scene = null, arrived = null;
  for (let k = 0; k < 60 * 120 && !arrived; k++) {
    g.step(1 / 60);
    for (const e of S.events) if (e.t === 'scene') scene = e;
    S.events.length = 0;
    arrived = S.story.encounters.find(e => e.kind === 'arrival');
    if (!arrived && S.phase === 'day') assert.equal(S.story.encounters.length, 0, 'a card on day 1');
  }
  assert.ok(arrived, 'the System never arrived');
  assert.equal(S.phase, 'night');
  assert.deepEqual(arrived.choices.map(c => c.id), ['fight'], 'a decision in the middle of the first fight');
  assert.ok(arrived.lines.some(l => /Skill acquired: Shove/.test(l)) && arrived.lines.some(l => /HP \d+/.test(l)));
  g.choose('fight'); assert.ok(S.story.titles.includes('firstLight'));
  // dawn 2: the gift, as the reward for surviving
  S.night = 2; S.phase = 'day'; g.story().dawn(); g.story().flush();
  const gift = S.story.encounters.find(e => e.kind === 'gift'); assert.ok(gift, 'no gift at dawn 2');
  assert.deepEqual(gift.choices.map(c => c.id), ['lantern', 'boots', 'will']);
  S.story.encounters = [gift]; g.choose('will'); assert.ok(S.story.titles.includes('will'));
});

test('the daily quest: offered only when calm, Accept or Not now; no means no cost; an accepted one left undone costs what it said, at dawn', () => {
  const g = frontier(5), S = g.state, st = g.story();
  const clear = () => { for (let k = 0; k < 9 && S.story.encounters.length; k++) { const e = S.story.encounters[0]; if (e.kind === 'daily') return e; g.choose(e.choices.at(-1).id); } return S.story.encounters.find(e => e.kind === 'daily') || null; };
  const day = (n, foe) => {   // eslint-disable-line no-param-reassign   // a fresh day n: everything else answered, then up to 20 s by day (a foe kept beside the hero, or none)
    S.night = n; S.phase = 'day'; S.dayT = 0; st.dawn(); st.flush(); clear(); S.story.later = [];
    for (let k = 0; k < 60 * 20; k++) { S.mobs = S.mobs.filter(m => foe && m === foe && !m.dying); if (foe && !S.mobs.length) { foe = g.spawnMob('walker', S.hero.x + 2, S.hero.y); foe.rise = 1; } if (foe) { foe.x = S.hero.x + 2; foe.y = S.hero.y; foe.hp = foe.maxHp; } S.hero.hp = S.hero.maxHp; S.dayT = 10; g.step(1 / 60); const e = clear(); if (e) return e; }
    return null;
  };
  S.story.threads = {}; S.story.spots = [];
  // mid-fight: nothing is offered
  { S.story.daily = null; assert.equal(day(2, true), null, 'a quest offered mid-fight'); S.mobs.length = 0; }
  // calm: the card, Accept / Not now, the terms on it
  S.story.daily = null; S.story.spots = []; const c1 = day(2); assert.ok(c1, 'no daily quest offered on a calm day 2');
  assert.deepEqual(c1.choices.map(c => c.id), ['accept', 'later']);
  assert.match(c1.choices[0].hint, /dawn.*−\d+ scrap/, 'the cost of failing is not on the card');
  assert.match(c1.choices[1].hint, /No cost/);
  // Not now: no objective, and the next dawn costs nothing
  S.story.encounters = [c1]; g.choose('later');
  assert.ok(!g.story().objectives().some(o => o.kind === 'daily'), 'a declined quest is on the objectives');
  S.gold = 50; S.food = 20; const toasts0 = S.events.length;
  const c2 = day(3); assert.equal(S.gold, 50, 'declining cost scrap'); assert.ok(!S.events.slice(toasts0).some(e => e.t === 'toast' && /failed/.test(e.msg)), 'a declined quest failed');
  // Accept: a MAIN objective with its progress; doing it pays
  assert.ok(c2, 'no quest on day 3'); S.story.encounters = [c2]; g.choose('accept');
  const q = S.story.daily; assert.equal(q.state, 'active');
  const ob = g.story().objectives().find(o => o.kind === 'daily'); assert.ok(ob && ob.priority === 'main' && /0\/\d+ · ends at dawn/.test(ob.sub), `objective: ${ob && ob.sub}`);
  S.story.daily = { ...q, id: 'cull', title: 'Strength Training', goal: 'Put down 3 of the dead', n: 3, base: S.kills };
  const xp0 = S.xp + S.lvl * 1000; S.kills += 3; for (let k = 0; k < 30; k++) g.step(1 / 60);
  assert.equal(S.story.daily.state, 'done'); assert.ok(S.xp + S.lvl * 1000 > xp0, 'no xp'); assert.equal(st.dailyProgress().have, 3);
  // Accept and leave it: the dawn takes exactly what the card said, never before
  const c4 = day(4); assert.ok(c4, 'no quest on day 4'); S.story.encounters = [c4]; g.choose('accept');
  const fail = S.story.daily.fail; S.story.daily.id = 'hunt'; S.story.daily.base = 1e9;   // a quest that cannot be done
  S.gold = 50; S.phase = 'night'; for (let k = 0; k < 60 * 5; k++) { S.qT = 1; g.step(1 / 60); }
  assert.ok(S.gold >= 50, 'it cost something at night'); S.gold = 50;
  S.night = 5; S.phase = 'day'; st.dawn();
  assert.equal(S.gold, 50 - fail, 'the failed quest did not cost what it said');
});

test('every choice that adds people says how they arrive, and the tag matches what happens', () => {
  const g = frontier(3), S = g.state, st = g.story(), t = g.map.town;
  const enc = { kind: 'street', title: 't', choices: [] };
  const ch = (fx, extra = {}) => ({ id: 'x', label: 'x', fx, ...extra });
  S.hero.x = t.x + 2; S.hero.y = t.y + 2;
  assert.equal(st.arrivalOf(enc, ch([{ op: 'gold', n: 3 }])), null, 'a tag on a choice with no people');
  assert.equal(st.arrivalOf(enc, ch([{ op: 'survivors', n: 3 }])).mode, 'now');
  assert.equal(st.arrivalOf(enc, ch([{ op: 'flag', key: 'beacon' }])).mode, 'dawn');
  assert.match(st.arrivalOf(enc, ch([{ op: 'flag', key: 'beacon' }])).text, /on their own.*dawn/);
  assert.equal(st.arrivalOf(enc, ch([{ op: 'recruitNew' }], { npcName: 'Mara joins' })).text, 'Mara is at the Haven now.');
  // far from the Camp they come in too (the road's escorted convoys are gone)
  S.hero.x = t.x + 40; S.hero.y = t.y;
  assert.equal(st.arrivalOf(enc, ch([{ op: 'survivors', n: 3 }])).mode, 'now');
  S.hero.x = t.x + 2; S.hero.y = t.y + 2; const n1 = S.survivors;
  S.story.encounters = [{ id: 951, kind: 'street', title: 'Roof', choices: [ch([{ op: 'survivors', n: 3 }], { id: 'bring' })] }];
  assert.equal(st.arrivalOf(S.story.encounters[0], S.story.encounters[0].choices[0]).mode, 'now'); g.choose('bring'); assert.equal(S.survivors, n1 + 3, 'not at the Camp now');
});

test('save mid-run and reload: ruins and story queues come back; old saves are ignored', () => {
  const g = frontier(3), S = g.state, st = g.story();
  for (let n = 2; n <= 3; n++) { S.night = n; st.dawn(); }
  S.gold = 200; S.food = 60;
  for (const t of ['house', 'tower', 'farm']) assert.ok(g.planner.place(t), `could not place a ${t}`);
  for (const x of S.buildings) x.built = 1;   // [econ3] finished (a scaffold torn down is gone, not a ruin)
  g.step();
  const b = S.buildings.find(x => x.type === 'house'); g.hitBuilding(b.id, 1e6); assert.ok(b.ruined, 'no ruin');
  S.story.later.push({ enc: { id: 999, kind: 'window', slot: 'sys', title: 'later', choices: [] }, pri: 1, until: S.night + 3, seq: 999 });
  const snap = JSON.parse(JSON.stringify(g.snapshot())); assert.ok(snap, 'no snapshot by day');
  const h = createGame({ seed: snap.seed, mapSeed: snap.mapSeed, biome: snap.biome, hero: snap.hero, difficulty: snap.difficulty, restore: snap, legacy: snap.legacy || {} }), T = h.state;
  assert.equal(T.night, S.night); assert.equal(T.gold, S.gold); assert.equal(T.food, S.food);
  assert.deepEqual(T.season.rules, S.season.rules);
  assert.deepEqual(h.ruins().map(r => r.id), g.ruins().map(r => r.id)); assert.ok(h.rebuildCost(b.id) > 0);
  assert.ok(T.story.later.some(x => x.enc.id === 999), 'a waiting card was lost');
  // the restored run plays on: a night and a dawn without throwing
  h.startNight(); for (let k = 0; k < 60 * 200 && T.phase === 'night' && !T.over; k++) { h.step(); T.story.encounters.length = 0; }
  assert.ok(T.phase === 'day' || T.over);
  assert.equal(snap.v, SAVE_V, 'the save format changed: bump SAVE_V so old saves are ignored');
});

test('objectives: one priority each; story quests are main and come first, beacons, sites and drops are optional', () => {
  const g = frontier(3), S = g.state, ST = S.story, st = g.story(), c = g.map.town;
  ST.spots.push({ id: ST.nextId++, kind: 'gen1', x: c.x - 5, y: c.y, day: S.night });
  ST.threads.t1 = { stage: 0, status: 'open' }; ST.spots.push({ id: ST.nextId++, kind: 'thread:t1', thread: 't1', x: c.x, y: c.y + 30, day: S.night });
  ST.quests.push({ site: 0, x: S.landmarks[0].x, y: S.landmarks[0].y });
  S.drops.push({ id: 77, x: c.x + 3, y: c.y + 3, prog: 0 });
  const list = st.objectives();
  assert.ok(list.every(q => q.priority === 'main' || q.priority === 'optional'));
  const kinds = p => list.filter(q => q.priority === p).map(q => q.kind).sort();
  assert.deepEqual(kinds('main'), ['thread']);
  assert.deepEqual(kinds('optional'), ['beacon', 'drop', 'site']);
  const firstOpt = list.findIndex(q => q.priority === 'optional');
  assert.ok(list.slice(firstOpt).every(q => q.priority === 'optional'), 'main first');
  assert.ok(list.every(q => typeof q.title === 'string' && q.title && typeof q.label === 'string'));
  // the gate's own lists carry the same priority
  for (const q of st.activeQuests()) assert.ok(q.priority === 'main' || q.priority === 'optional');
  assert.equal(st.activeQuests().find(q => q.kind === 'beacon').priority, 'optional');
});
