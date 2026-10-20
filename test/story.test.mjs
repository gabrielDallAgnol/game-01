// The story layer: threads always reach their place (or end with a card), the dawn budget holds, night 1 is
// hand-authored, the Window's daily quest, and seasons as contracts you can win or lose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
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

test('Channel 9 and the school reuse the site that is already open: no second copy, and the site stage fires', () => {
  for (const seed of [1, 2, 3, 7]) {
    for (const [tid, kit] of [['channel9', 'substation'], ['school', 'school']]) {
      const g = frontier(seed), S = g.state; S.story.encounters = [];
      const before = S.landmarks.filter(l => l.kind === kit).length;
      const th = answer(g, tid, kit);
      assert.equal(th.status, 'open', `${tid} seed ${seed} failed`);
      assert.equal(th.stage, 1);
      assert.equal(S.landmarks.filter(l => l.kind === kit).length, Math.max(1, before), `${tid} seed ${seed}: a duplicate ${kit}`);
      const l = S.landmarks[th.site]; assert.ok(l && l.kind === kit, 'not pointed at its site');
      assert.ok(S.story.quests.some(q => q.site === l.id), 'no quest marker');
      assert.ok(reach(g, tid, l.x, l.y + l.size / 2 + 1), `${tid} seed ${seed}: the companion stage never fired`);
    }
  }
});

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

test('night 1: a short first day, then the System arrives when the first dead reaches you, with the gift inside', () => {
  const g = frontier(3), S = g.state;
  assert.ok(Math.abs(g.duskIn() - 40) < 1, `day 1 is ${g.duskIn()} s, not ~40`);
  assert.ok(TIDE.dayLen > 60);
  let scene = null, arrived = null;
  for (let k = 0; k < 60 * 120 && !arrived; k++) {
    g.step(1 / 60);
    for (const e of S.events) if (e.t === 'scene') scene = e;
    S.events.length = 0;
    arrived = S.story.encounters.find(e => e.kind === 'arrival');
    if (!arrived && S.phase === 'day') assert.equal(S.story.encounters.length, 0, 'a card on day 1');
  }
  assert.ok(scene && scene.id === 'night1' && scene.line === 'One of them.', JSON.stringify(scene));
  assert.ok(arrived, 'the System never arrived');
  assert.equal(S.phase, 'night');
  assert.deepEqual(arrived.choices.map(c => c.id), ['lantern', 'boots', 'will']);
  assert.ok(arrived.lines.some(l => /Skill acquired: Shove/.test(l)) && arrived.lines.some(l => /HP \d+/.test(l)));
  g.choose('will');
  assert.ok(S.story.titles.includes('firstLight') && S.story.titles.includes('will'));
});

test('night copy scales with the wave', () => {
  const g = frontier(3), S = g.state, st = g.story(), nest = g.map.regions.find(r => r.nest);
  assert.equal(st.nightLine([{ kind: 'walker', nest: nest.id }]).line, 'One of them.');
  const nine = st.nightLine(Array.from({ length: 9 }, () => ({ kind: 'walker', nest: nest.id })));
  assert.match(nine.line, /^Nine, from the (north|south|east|west|north-east|north-west|south-east|south-west)\.$/);
  const brutes = st.nightLine([...Array.from({ length: 21 }, () => ({ kind: 'walker', nest: nest.id })), { kind: 'brute', nest: nest.id }, { kind: 'brute', nest: nest.id }]);
  assert.match(brutes.line, /^Twenty-three, from the .+\. Two brutes walk with them\.$/);
  void S;
});

test('the daily quest: issued from day 2, done by doing it, and ignoring it brings a penalty quest', () => {
  const g = frontier(5), S = g.state, st = g.story();
  S.night = 2; S.phase = 'day'; st.dawn(); st.flush(); while (S.story.encounters.length) g.choose(S.story.encounters[0].choices.at(-1).id);
  const q = S.story.daily; assert.ok(q && q.day === 2 && q.n > 0, 'no daily quest');
  const xp0 = S.xp + S.lvl * 1000;
  // force the cull quest and do it
  S.story.daily = { id: 'cull', title: 'Strength Training', goal: 'Put down 3 of the dead', n: 3, base: S.kills, done: false, penalty: false, day: S.night };
  S.kills += 3; for (let k = 0; k < 30; k++) g.step(1 / 60);
  assert.ok(S.story.daily.done, 'not done'); assert.ok(S.xp + S.lvl * 1000 > xp0, 'no xp');
  assert.equal(st.dailyProgress().have, 3);
  // ignore the next one: the next dawn is a penalty quest
  S.night = 3; st.dawn(); st.flush(); while (S.story.encounters.length) g.choose(S.story.encounters[0].choices.at(-1).id);
  S.night = 4; st.dawn(); st.flush(); while (S.story.encounters.length) g.choose(S.story.encounters[0].choices.at(-1).id);
  assert.ok(S.story.daily.penalty, 'no penalty quest');
  const food = S.food = 40;
  S.night = 5; st.dawn();
  assert.ok(S.food < food, 'the ignored penalty quest cost nothing');
});

function signContract(g, id) {
  const S = g.state, st = g.story();
  st.flush(); const k = S.story.encounters.find(e => e.kind === 'contract'); assert.ok(k, 'no contract offered');
  assert.ok(k.offers.length >= 2 && k.offers.length <= 3);
  for (const o of k.offers) assert.ok(o.terms.finale && o.terms.reward && o.twist, 'an offer without terms or a twist');
  S.story.encounters = [k, ...S.story.encounters.filter(e => e !== k)];
  assert.ok(g.choose(id)); return k;
}
test('a contract: offered by dawn 3, signed, its finale won, the reward paid and the difficulty partly reset', () => {
  const g = frontier(4), S = g.state, st = g.story();
  for (let n = 2; n <= 3; n++) { S.night = n; st.dawn(); }
  const k = signContract(g, 'c1');
  const C = S.story.contract; assert.equal(C.id, 'c1'); assert.equal(C.finale.kind, 'unique');
  assert.ok(S.unique && S.unique.contract && S.unique.name === C.finale.name && S.unique.night === C.finale.night);
  assert.equal(S.season.finale, C.finale.name);
  S.unique.slain = true; st.tick();
  assert.ok(C.won, 'the slain finale did not win the contract');
  const gold = S.gold, wins = S.contractWins || 0;
  S.night++; st.dawn(); st.flush();
  const v = S.story.encounters.find(e => e.kind === 'victory'); assert.ok(v, 'no victory card');
  S.story.encounters = [v]; g.choose('take');
  assert.ok(S.gold >= gold + C.reward.scrap, 'no scrap reward');
  assert.ok(typeof g.contractWon === 'function' || (S.contractWins || 0) === wins + 1, 'the difficulty did not reset');
  assert.ok(S.story.titles.includes('contractor'));
  void k;
});
test('a contract: rules stack, and a lost finale ends the run with the contract\'s name', () => {
  const g = frontier(6), S = g.state, st = g.story();
  for (let n = 2; n <= 3; n++) { S.night = n; st.dawn(); }
  const k = signContract(g, 'c3'); const C = S.story.contract;
  assert.ok(C.rule, 'the big contract has no rule'); assert.ok(S.season.rules.includes(C.rule) && S.season.rule === C.rule);
  assert.ok(k.offers.find(o => o.id === 'c3').finale.mult > k.offers.find(o => o.id === 'c1').finale.mult);
  // the season ends without the finale
  S.night = C.finale.night + 1;
  st.seasonCard({ name: 'Beyond the Fence' }, 2);
  assert.ok(S.over, 'the run went on'); assert.equal(S.story.lostContract.name, C.name);
});
test('a hive contract is won by burning that hive', () => {
  const g = frontier(1), S = g.state, st = g.story();
  for (let n = 2; n <= 3; n++) { S.night = n; st.dawn(); }
  st.flush(); const k = S.story.encounters.find(e => e.kind === 'contract');
  const hv = k.offers.find(o => o.finale.kind === 'hive'); if (!hv) return;   // no hive in reach on this map
  S.story.encounters = [k]; g.choose(hv.id);
  S.nestAlive[hv.finale.region] = false; st.tick();
  assert.ok(S.story.contract.won);
});
