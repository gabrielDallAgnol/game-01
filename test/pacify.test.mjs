// Pacify (sim/pacify.js): the way home from a held site, and the dusk warning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, STEP } from '../src/sim/game.js';
import { PACIFY } from '../src/sim/pacify.js';
import { TIDE } from '../src/content/mobs.js';

const clearStory = g => { const S = g.state; for (let k = 0; k < 9 && S.story.encounters.length; k++) { const e = S.story.encounters[0]; g.choose(e.choices[e.choices.length - 1].id); } };
const run = (g, s) => { for (let k = 0; k < Math.round(s / STEP); k++) g.step(); };

test('Return to Camp: by day from a held site, a channel broken by moving, then a cooldown; never at night', () => {
  const g = createGame({ seed: 3 }), S = g.state, c = g.map.town.x; clearStory(g);
  const l = S.landmarks.filter(q => Math.hypot(q.x - c, q.y - c) > 40).sort((a, b) => Math.hypot(a.x - c, a.y - c) - Math.hypot(b.x - c, b.y - c))[0];
  l.owned = true; S.occVersion = (S.occVersion || 0) + 1;
  const h = S.hero; S.mobs.length = 0;
  const atSite = () => { h.x = l.x; h.y = l.y + l.size / 2 + 1.2; h.target = null; h.path = null; h.fightT = 0; };
  atSite(); g.step();
  let i = g.homeInfo(); assert.ok(i.ok, `cannot go home from a held site: ${i.why}`); assert.equal(i.from.kind, 'site');
  // moving breaks the channel
  assert.ok(g.returnHome()); g.setHeroInput(1, 0); g.step(); g.setHeroInput(0, 0);
  assert.equal(g.homeInfo().channel, 0); assert.ok(Math.hypot(h.x - c, h.y - c) > 30);
  // standing still: home
  atSite(); S.mobs.length = 0; assert.ok(g.returnHome()); run(g, PACIFY.home.channel + 0.3);
  assert.ok(Math.hypot(h.x - c, h.y - c) < 6, 'the hero is at the Camp');
  assert.ok(S.events.some(e => e.t === 'homeward'));
  // cooldown
  atSite(); assert.equal(g.homeInfo().why, 'cooldown'); assert.equal(g.returnHome(), false);
  // never at night
  S.homeward.cd = 0; S.phase = 'night'; assert.equal(g.homeInfo().why, 'night'); S.phase = 'day';
  // not from the open woods
  h.x = l.x + 40; h.y = l.y; assert.equal(g.homeInfo().why, 'nowhere');
});

test('the dusk warning: once a day, when the walk home is longer than the light left', () => {
  const g = createGame({ seed: 3 }), S = g.state, c = g.map.town.x; clearStory(g);
  const h = S.hero; h.x = c + 70; h.y = c; g.step();
  S.night = 2; S.dayT = TIDE.dayLen - 10; S.events.length = 0; S.mobs.length = 0;
  for (let k = 0; k < Math.round(1 / STEP); k++) { h.x = c + 70; h.y = c; g.step(); }
  const w = S.events.filter(e => e.t === 'duskWarn');
  assert.equal(w.length, 1); assert.ok(w[0].walk > w[0].left);
});
