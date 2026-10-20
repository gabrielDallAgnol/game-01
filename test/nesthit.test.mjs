// The hero against a hive: he strikes it from its edge (never from inside the model), a hollow beside a wild building
// lives in that building, and he heals only when the fight is over and he is away from a hive (quickest at the Camp).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, NEST, REGEN } from '../src/sim/game.js';
import { PASSABLE, idx } from '../src/sim/mapgen.js';

const clearStory = g => { const S = g.state; for (let k = 0; k < 9 && S.story.encounters.length; k++) { const e = S.story.encounters[0]; g.choose(e.choices[e.choices.length - 1].id); } };
const readyDay = g => { const S = g.state; S.handsExtra = 99; clearStory(g); while (S.pendingPicks) g.choosePerk(S.offer[0]); while (S.packs.length) g.choosePack(S.packs[0]); };

test('a hollow beside a wild building nests in it: its door is open ground, its body is the building', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const g = createGame({ seed }), m = g.map;
    for (const r of m.regions.filter(q => q.nest && q.ring === 1)) {
      const n = r.nest; if (n.site === undefined) continue;
      const l = g.state.landmarks[n.site];
      assert.equal(l.region, r.id); assert.deepEqual([n.body.x, n.body.y], [l.x, l.y], 'the body is the building');
      assert.ok(PASSABLE[m.terrain[idx(Math.floor(n.x), Math.floor(n.y))]] && m.lm[idx(Math.floor(n.x), Math.floor(n.y))] < 0, `seed ${seed}: the door is inside a wall`);
      assert.ok(Math.max(Math.abs(n.x - l.x), Math.abs(n.y - l.y)) < l.size / 2 + 1, 'the door is not at the building');
    }
    assert.ok(m.regions.some(q => q.nest && q.nest.site !== undefined), `seed ${seed}: no hollow moved into its building`);
  }
});

test('the hero strikes a hive from its edge, melee and ranged, and never from out of reach', () => {
  for (const hero of ['warrior', 'archer']) {
    const g = createGame({ seed: 3, hero }), S = g.state; readyDay(g);
    const reach = g.heroDef.attack.reach;
    for (const reg of g.map.regions.filter(r => r.nest && r.ring === 1)) {
      const b = reg.nest.body || reg.nest, rad = reg.nest.body ? reg.nest.body.half : NEST.body.hollow;
      S.mobs.length = 0; const h = S.hero; h.hp = h.maxHp = 1e6;
      const at = d => { h.x = b.x + rad + d; h.y = b.y; h.target = null; h.cd = 0; };
      at(reach - 0.3); S.events.length = 0; g.step();
      assert.ok(S.events.some(e => e.t === 'hitHive' && e.region === reg.id), `${hero} could not strike hive ${reg.id} from ${(reach - 0.3).toFixed(1)} off its edge`);
      at(reach + 0.4); S.events.length = 0; g.step();
      assert.ok(!S.events.some(e => e.t === 'hitHive'), `${hero} struck hive ${reg.id} from out of reach`);
    }
  }
});

test('healing: none mid-fight or by a hive, slow in the field, quick at the Camp', () => {
  const g = createGame({ seed: 3, hero: 'warrior' }), S = g.state, c = g.map.town.x; readyDay(g); S.mobs.length = 0;
  const h = S.hero, run = (x, y, secs, hurt) => { const hp0 = h.hp; for (let k = 0; k < secs * 60; k++) { h.x = x; h.y = y; h.target = null; if (hurt && k % 60 === 0) h.hp -= 0.5; S.dayT = 10; S.mobs.length = 0; g.step(); } return h.hp - hp0; };
  h.hp = h.maxHp * 0.3;
  const camp = run(c, c + 3.5, 2); assert.ok(camp > REGEN.camp * 1.5, `the Camp heals ${camp.toFixed(1)} in 2 s`); assert.equal(h.rest, 'camp');
  h.hp = h.maxHp * 0.3; const fight = run(c, c + 3.5, 3, true); assert.ok(fight < 0, `healed ${fight.toFixed(1)} while being hit`);
  const reg = g.map.regions.filter(r => r.nest && r.ring === 1)[0], b = reg.nest.body || reg.nest;
  h.hp = h.maxHp * 0.3; run(b.x + 6, b.y, REGEN.combat + 1); const hive = run(b.x + 6, b.y, 5); assert.equal(hive, 0, 'healed next to a hive');
  const d = Math.hypot(c - b.x, c - b.y), fx = b.x + (c - b.x) / d * (REGEN.hive + 2), fy = b.y + (c - b.y) / d * (REGEN.hive + 2);
  h.hp = h.maxHp * 0.3; const field = run(fx, fy, 4); assert.ok(field > 0 && field < REGEN.camp * 2, `the field heals ${field.toFixed(1)} in 4 s`);
});

test('a day-1 warrior who stands at a hollow without burning it cannot outlast it', () => {
  const g = createGame({ seed: 5, hero: 'warrior' }), S = g.state, c = g.map.town.x; readyDay(g);
  const reg = g.map.regions.filter(r => r.nest && r.ring === 1).sort((a, b) => Math.hypot(a.nest.x - c, a.nest.y - c) - Math.hypot(b.nest.x - c, b.nest.y - c))[0];
  const b = reg.nest.body || reg.nest, d = Math.hypot(c - b.x, c - b.y), spot = { x: b.x + (c - b.x) / d * 5.5, y: b.y + (c - b.y) / d * 5.5 }, h = S.hero;
  h.x = spot.x; h.y = spot.y; let t = 0;
  for (; t < 300 * 60 && !h.dead; t++) { if (Math.hypot(h.x - spot.x, h.y - spot.y) > 0.6) { h.target = null; g.heroTo(spot.x, spot.y); } S.dayT = Math.min(S.dayT, 10); g.step(); }
  assert.ok(h.dead, `he stood at the hollow for 300 s and lived (${Math.round(h.hp)} / ${h.maxHp})`);
  assert.ok(S.nestAlive[reg.id], 'the hollow burned (he was not meant to strike it)');
});
