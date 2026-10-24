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

test('every nest is a heat source with a building for a body', () => {
  for (const seed of [1, 3, 5]) {
    const g = createGame({ seed });
    for (const r of g.map.regions.filter(q => q.nest)) {
      assert.ok(['petrol', 'substation', 'boiler', 'tanker'].includes(r.nest.heat), 'heat kind');
      if (r.ring >= 2 && r.nest.back) { assert.ok(r.nest.body && r.nest.body.half > 0, 'city nest has a building body'); assert.ok(g.hiveEdge(r.id, r.nest.body.x, r.nest.body.y) === 0, 'inside the body is 0 away'); }
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
  // one huge hit still breaks only one segment
  strike(g, reg, max * 5); drain();
  assert.equal(S.inferno[r].ph, 1, 'only the barricade broke'); assert.equal(events.filter(e => e.t === 'infernoBreak').length, 1);
  assert.ok(S.mobs.length >= 3, 'the surge spawned'); assert.ok(S.mobs.some(m => m.horde === r && m.hunt), 'some hunt the hero'); assert.ok(S.mobs.some(m => m.stream === r), 'some run for the town');
  assert.equal(g.infernoInfo(r).segments[0].broken, true); assert.equal(g.infernoInfo(r).segments[1].broken, false);
  strike(g, reg, max * 5); drain();
  assert.equal(S.inferno[r].ph, 2); assert.equal(events.filter(e => e.t === 'infernoBreak').length, 2);
  assert.ok(S.nestAlive[r], 'still burning: the core is up');
  strike(g, reg, max * 5); drain();
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

test('the nest hitbox is the building: no strike lands through another wall, and every open edge can be struck', () => {
  let walls = 0, open = 0;
  for (const seed of [3, 5, 8]) {
    const g = createGame({ seed }), m = g.map;
    for (const reg of m.regions.filter(q => q.nest && q.nest.body)) {
      const b = reg.nest.body, own = (cx, cy) => Math.abs(cx + 0.5 - b.x) < b.half + 0.01 && Math.abs(cy + 0.5 - b.y) < b.half + 0.01;
      assert.equal(g.hiveEdge(reg.id, b.x, b.y), 0, 'inside the building is 0 from its edge');
      for (let y = Math.floor(b.y - b.half - 3); y <= b.y + b.half + 3; y++) for (let x = Math.floor(b.x - b.half - 3); x <= b.x + b.half + 3; x++) {
        const px = x + 0.5, py = y + 0.5, e = g.hiveEdge(reg.id, px, py); if (e <= 0 || e > 2.2 || own(x, y)) continue;
        const nx = Math.max(b.x - b.half, Math.min(b.x + b.half, px)), ny = Math.max(b.y - b.half, Math.min(b.y + b.half, py));
        let blocked = false; for (let s2 = 1; s2 <= 40 && !blocked; s2++) { const cx = Math.floor(px + (nx - px) * s2 / 40), cy = Math.floor(py + (ny - py) * s2 / 40); if (!own(cx, cy) && (m.terrain[cy * m.N + cx] === 2 || m.lm[cy * m.N + cx] >= 0)) blocked = true; }
        const hit = g.hiveInReach(px, py, 2.3) === reg.id;
        if (blocked) { walls++; assert.ok(!hit, `seed ${seed}: struck nest ${reg.id} through a wall from ${px},${py}`); } else open++;
      }
    }
  }
  assert.ok(walls > 0 && open > 0, `sampled ${walls} walled and ${open} open cells`);
});
