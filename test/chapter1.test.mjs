// [ch1] Chapter 1 in Hollowmere: the quest chain opens and closes on scripted play, the survivors come home, the
// finale is reachable and ends the run won, a dawn save carries the chapter, and the same seed plays the same way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { STEPS } from '../src/content/story1.js';
import { playChapter } from '../tools/ch1bot.mjs';

const make = (seed = 3, o = {}) => createGame({ seed, area: 'hollowmere', hero: 'survivor', ...o });
const run = (g, s) => { for (let k = 0; k < s * 60; k++) g.step(); };

test('the opening: the tow ticket, the first objective, three cars, a turret, dusk opens the tower light', () => {
  const g = make(), S = g.state, C = () => g.chapter();
  assert.ok(C(), 'chapter 1 runs in Hollowmere');
  assert.equal(S.tide.dayLen, 300, 'day 1 is 300 s'); assert.equal(S.dayT, 0, 'the first day starts at dawn');
  run(g, 1);
  assert.deepEqual(C().open, ['q1.salvage']); assert.ok(g.notes().includes('n.rig.1'), 'the tow ticket on the Rig');
  const evs = g.drainEvents(); assert.ok(evs.some(e => e.t === 'sys1' && /Class granted: Mechanic/.test(e.text)), 'the System wakes over Kai');
  assert.ok(!evs.some(e => e.t === 'episode'), 'no old episode banner');
  for (let k = 0; k < 6 && !C().done.includes('q1.salvage'); k++) { const o = C().objective; S.hero.x = o.x; S.hero.y = o.y; run(g, 4); }   // the Mechanic's salvage: the objective points at the nearest car
  assert.ok(C().done.includes('q1.salvage') && C().open.includes('q1.turret'), 'three cars stripped: the turret step');
  assert.ok(g.map.slots.some(l => g.build(l.id, 'tower'))); run(g, 30);
  assert.ok(C().done.includes('q1.turret'), 'a turret built');
  g.startNight(); run(g, 0.5);
  assert.ok(C().open.includes('q1.hold') && C().open.includes('q2.light'), 'dusk 1: hold, and the light on the tower');
  assert.ok(g.heard().includes('r.1'), 'a car radio at dusk');
  assert.equal(S.tide.nightLen, 150);
});

test('the whole chapter plays through: every step, three survivors, notes and radio, the Rig rolls north', () => {
  const g = make(3), r = playChapter(g);
  assert.ok(r.ended && r.won, `ended and won (stuck with ${r.open.join(',')})`);
  assert.equal(g.state.endReason, 'ch1');
  for (const s of STEPS) assert.ok(r.done.includes(s.id), `${s.id} done`);
  assert.deepEqual(r.survivors, ['lotte:home', 'benno:home', 'gus:home']);
  assert.ok(r.notes.length >= 15, `${r.notes.length} notes found`); assert.equal(r.heard.length, 12, 'every broadcast heard');
  assert.ok(g.chNests().every(n => n.state === 'broken'), 'the cinema, the shed and the Works are broken');
  assert.ok(g.graffiti().some(x => x.id === 'g.square.4'), 'chalk where the Rig stood');
});

test('Gus is optional: the chain ends without the hut', () => {
  const r = playChapter(make(5), { gus: false });
  assert.ok(r.ended && r.won, `ended (open: ${r.open.join(',')})`);
  assert.ok(!r.done.includes('q5.gus'));
});

test('a dawn save carries the chapter: steps, notes, survivors, a live nest', () => {
  const g = make(4), S = g.state;
  playChapter(g, { cap: 1 });   // nothing: just the opening
  const until = n => { const st = { n: 0 }; while (S.night < n && st.n++ < 60 * 60 * 60) playChapter(g, { cap: 600 }); };
  until(4);
  // at the dawn of night 4 the cinema is awake
  let snap = null; for (let k = 0; k < 600 && !snap; k++) { snap = g.snapshot(); if (!snap) g.step(); }
  assert.ok(snap && snap.ch, 'the save has the chapter');
  const h = createGame({ seed: snap.seed, mapSeed: snap.mapSeed, hero: snap.hero, difficulty: snap.difficulty, restore: snap, area: snap.area });
  assert.deepEqual(h.chapter().done, g.chapter().done); assert.deepEqual(h.notes(), g.notes());
  assert.deepEqual(h.survivors().map(s => s.state), g.survivors().map(s => s.state));
  const live = h.chNests().filter(n => n.state === 'live');
  for (const n of live) assert.ok(h.state.mobs.some(m => m.kind === 'heart' && m.chNest === n.id), `${n.id}'s heart is back`);
  const r = playChapter(h); assert.ok(r.ended && r.won, 'the restored run still reaches the end');
});

test('deterministic: the same seed plays the same chapter', () => {
  const sig = () => { const g = make(6), r = playChapter(g, { cap: 60 * 60 * 25 }); return JSON.stringify([r.done, r.notes, r.heard, g.state.kills, g.state.gold, g.state.time.toFixed(3), g.state.mobs.length]); };
  assert.equal(sig(), sig());
});

test('outside Hollowmere there is no chapter', () => {
  const g = createGame({ seed: 2, area: 'suburb' });
  assert.equal(g.chapter(), null); assert.equal(g.state.tide, undefined); assert.deepEqual(g.graffiti(), []);
});
