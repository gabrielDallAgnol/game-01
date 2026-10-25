// Inferno Nests (sim/inferno.js): three permanent phases, a counter-surge per break, never healing, saved, cleansed at the end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';

const clearStory = g => { const S = g.state; for (let k = 0; k < 9 && S.story.encounters.length; k++) { const e = S.story.encounters[0]; g.choose(e.choices[e.choices.length - 1].id); } };
const ready = g => { const S = g.state; S.handsExtra = 99; clearStory(g); while (S.pendingPicks) g.choosePerk(S.offer[0]); while (S.packs.length) g.choosePack(S.packs[0]); };
const setup = (seed = 3) => {
  const g = createGame({ seed }), S = g.state; ready(g);
  const reg = g.map.regions.filter(r => r.nest && r.ring === 1)[0];
  return { g, S, reg };
};
const strike = (g, reg, d) => { g.state.mobs.length = 0; return g.hitHive(reg.id, d); };
/** swing in chunks (a huge hit of the whole hive is a scripted kill) until the current phase breaks */
const breakPhase = (g, reg, big = 0.5) => { const S = g.state, ph = S.inferno[reg.id].ph, mx = S.inferno[reg.id].max; for (let k = 0; k < 40 && S.nestAlive[reg.id] && S.inferno[reg.id].ph === ph; k++) strike(g, reg, mx * big * 0.2); };

test('every nest is a heat source with a building for a body', () => {
  for (const seed of [1, 3, 5]) {
    const g = createGame({ seed });
    for (const r of g.map.regions.filter(q => q.nest)) {
      assert.ok(['petrol', 'substation', 'boiler', 'tanker'].includes(r.nest.heat), 'heat kind');
      if (r.ring >= 2 && r.nest.back) assert.ok(r.nest.vis && r.nest.vis.half > 0, 'a city nest has its heat-source model on the ruin behind its door');
    }
  }
});

test('three phases: each break fires a counter-surge, segments stay broken, the core cleanses', () => {
  const { g, S, reg } = setup(), r = reg.id;
  const events = []; const drain = () => { for (const e of S.events.splice(0)) events.push(e); };
  assert.equal(g.infernoInfo(r).segments.length, 3);
  assert.ok(strike(g, reg, 1));
  const max = S.inferno[r].max, seg = g.infernoInfo(r);
  assert.equal(seg.phase, 0); assert.equal(seg.broken, 0);
  // a big swing (but not the whole hive) still breaks only one segment: the surplus is lost
  strike(g, reg, max * 0.5); drain();
  assert.equal(S.inferno[r].ph, 1, 'only the barricade broke'); assert.equal(events.filter(e => e.t === 'infernoBreak').length, 1);
  assert.ok(S.mobs.length >= 3, 'the surge spawned'); assert.ok(S.mobs.some(m => m.horde === r && m.hunt), 'some hunt the hero'); assert.ok(S.mobs.some(m => m.stream === r), 'some run for the town');
  assert.equal(g.infernoInfo(r).segments[0].broken, true); assert.equal(g.infernoInfo(r).segments[1].broken, false);
  strike(g, reg, max * 0.5); drain();
  assert.equal(S.inferno[r].ph, 2); assert.equal(events.filter(e => e.t === 'infernoBreak').length, 2);
  assert.ok(S.nestAlive[r], 'still burning: the core is up');
  strike(g, reg, max * 0.9); drain();
  assert.ok(!S.nestAlive[r], 'the core is snuffed'); assert.ok(S.claimed.has(r), 'the land is yours');
  const cl = events.filter(e => e.t === 'nestCleansed'); assert.equal(cl.length, 1); assert.equal(cl[0].id, r);
  assert.equal(g.pacifiedAt(reg.nest.x, reg.nest.y), true, 'the corridor is pacified');
});

test('a broken segment never heals: time and nights do not repair it', () => {
  const { g, S, reg } = setup(), r = reg.id;
  strike(g, reg, 1); const max = S.inferno[r].max; strike(g, reg, max * 0.3);
  assert.equal(S.inferno[r].ph, 1);
  const dmg = S.hiveDmg[r];
  for (let k = 0; k < 60 * 120; k++) g.step();
  assert.equal(S.inferno[r].ph, 1); assert.ok(S.hiveDmg[r] >= dmg, 'damage only grows'); assert.equal(S.inferno[r].max, max, 'the hp is fixed once struck');
});

test('the siege survives a save and a restore', () => {
  const { g, S, reg } = setup(), r = reg.id;
  strike(g, reg, 1); const max = S.inferno[r].max; strike(g, reg, max * 0.5); strike(g, reg, 5);
  const ph = S.inferno[r].ph, dmg = S.hiveDmg[r]; assert.ok(ph >= 1);
  const snap = JSON.parse(JSON.stringify(g.snapshot()));
  const g2 = createGame({ seed: 3, restore: snap });
  assert.equal(g2.state.inferno[r].ph, ph); assert.equal(g2.state.hiveDmg[r], dmg); assert.equal(g2.infernoInfo(r).segments[0].broken, true);
});

test('the nest hitbox is the building: no strike lands through another wall, and its open edge can be struck', () => {
  let tried = 0;
  for (const seed of [3, 5, 8]) {
    const g = createGame({ seed }), m = g.map;
    for (const reg of m.regions.filter(q => q.nest && q.nest.body)) {
      const b = reg.nest.body;
      assert.equal(g.hiveEdge(reg.id, b.x, b.y), 0, 'inside the building is 0 from its edge');
      // stand 2.3 cells off its east wall: a strike lands; drop a wall cell between and it does not
      const px = b.x + b.half + 2.3, py = Math.floor(b.y) + 0.5, cx = Math.floor(b.x + b.half + 1.2), cy = Math.floor(py), i = cy * m.N + cx, old = m.terrain[i], oldLm = m.lm[i];
      if (m.lm[Math.floor(py) * m.N + Math.floor(px)] >= 0 || old === 2) continue;
      assert.equal(g.hiveInReach(px, py, 3), reg.id, `seed ${seed}: nest ${reg.id} cannot be struck from its open wall`);
      m.terrain[i] = 2;
      assert.equal(g.hiveInReach(px, py, 3), -1, `seed ${seed}: nest ${reg.id} struck through a wall`);
      m.terrain[i] = old; m.lm[i] = oldLm; tried++;
    }
  }
  assert.ok(tried >= 3, `only ${tried} nests tried`);
});
