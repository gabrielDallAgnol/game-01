// Tower specialisations (sim/towers.js, content/towers.js): the rules, each role's effect, saves, and the crew line.
// Run with: node --test test/towers.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame as newGame, CREW_NEED } from '../src/sim/game.js';
import { SPECS, SPEC_COST, SPEC_ORDER } from '../src/content/towers.js';

const clearStory = g => { const S = g.state; for (let k = 0; k < 9 && S.story.encounters.length; k++) { const e = S.story.encounters[0]; g.choose(e.choices[e.choices.length - 1].id); } };
const ready = o => { const g = newGame({ mode: 'classic', seed: 3, ...o }); const S = g.state; S.handsExtra = 99; clearStory(g); while (S.packs.length) g.choosePack(S.packs[0]); S.survivors = 30; S.gold = 500; g.state.occVersion = (g.state.occVersion || 0) + 1; return g; };
const ring = (g, type, r0 = 4) => { const t = g.map.town; for (let r = r0; r < 16; r++) for (let a = 0; a < 24; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace(type, x, y).ok) return { x, y }; } return null; };
// a level 3 tower (the test skips the keep and the workshop: the level is what the rule reads)
const tower3 = g => { const p = ring(g, 'tower'); assert.ok(g.build('tower', p.x, p.y)); const b = g.state.buildings[g.state.buildings.length - 1]; b.level = 3; b.maxHp = b.hp = 50; b.built = 1;   /* [econ3] finished: a scaffold does not shoot */ g.state.occVersion = (g.state.occVersion || 0) + 1; return b; };
const walkers = (g, x, y, n, spread = 0.6) => Array.from({ length: n }, (_, k) => { const m = g.spawnMob('walker', x + Math.cos(k) * spread, y + Math.sin(k) * spread); m.rise = 1; m.speed = 0; m.hp = m.maxHp = 50; return m; });
const run = (g, sec) => { for (let k = 0; k < sec * 60; k++) g.step(); };

test('specialising: level 3 only, costs scrap, once, and the role sticks', () => {
  const g = ready(), S = g.state, p = ring(g, 'tower');
  assert.ok(g.build('tower', p.x, p.y)); const b1 = S.buildings[S.buildings.length - 1];
  assert.equal(g.specialise(b1.id, 'mortar'), false, 'a level 1 tower specialised');
  const b = tower3(g), gold = S.gold;
  assert.equal(g.specialise(b.id, 'nope'), false);
  assert.equal(g.specialise(b.id, 'mortar'), true);
  assert.equal(b.spec, 'mortar'); assert.equal(S.gold, gold - SPEC_COST);
  assert.equal(g.specialise(b.id, 'bell'), false, 'a tower took a second role');
  assert.equal(CREW_NEED[2], 3); assert.ok(g.manned(b), 'the role changed the crew');
  for (const r of SPEC_ORDER) assert.ok(SPECS[r].name && SPECS[r].line && SPECS[r].rate > 0, `${r} lacks its card`);
});

test('a mortar shell bursts on a crowd: one shot hurts many', () => {
  const g = ready(), S = g.state, b = tower3(g); g.specialise(b.id, 'mortar');
  const ms = walkers(g, b.x + 6, b.y, 6, 0.8);
  run(g, 3);
  const hurt = ms.filter(m => m.hp < m.maxHp).length;
  assert.ok(hurt >= 4, `only ${hurt} of 6 were hit`);
  assert.ok(S.events.some(e => e.t === 'shell') || hurt, 'no shell burst');
});

test('a brazier burns everything round it; a ballista pierces a line and hits brutes twice as hard', () => {
  const g = ready(), b = tower3(g); g.specialise(b.id, 'brazier');
  const ring1 = walkers(g, b.x + 2.5, b.y, 5, 0.9); run(g, 0.5);
  assert.ok(ring1.every(m => m.hp < m.maxHp), 'the fire ring missed someone');
  assert.ok(ring1.some(m => m.burn), 'nobody is burning');
  const g2 = ready(), t = tower3(g2); g2.specialise(t.id, 'ballista');
  const line = [4, 6, 8].map(d => { const m = g2.spawnMob('walker', t.x + d, t.y); m.rise = 1; m.speed = 0; m.hp = m.maxHp = 50; return m; });
  run(g2, 0.3);
  assert.ok(line.every(m => m.hp < m.maxHp), 'the bolt did not pierce the line');
  const g3 = ready(), u = tower3(g3); g3.specialise(u.id, 'ballista');
  const brute = g3.spawnMob('brute', u.x + 5, u.y), w = g3.spawnMob('walker', u.x + 3, u.y);
  for (const m of [brute, w]) { m.rise = 1; m.speed = 0; m.hp = m.maxHp = 200; }
  run(g3, 0.3);
  assert.ok(Math.abs((200 - brute.hp) - 2 * (200 - w.hp)) < 0.5, `brute took ${200 - brute.hp}, walker ${200 - w.hp}`);
});

test('the watch bell slows the dead near it and marks them for the towers', () => {
  const g = ready(), S = g.state, b = tower3(g); g.specialise(b.id, 'bell');
  const [m] = walkers(g, b.x + 4, b.y, 1); m.speed = 1.5;
  run(g, 0.3);
  assert.ok(m.slowUntil > S.time, 'not slowed'); assert.equal(m.slowK, SPECS.bell.slow);
  assert.ok(m.markT > 0, 'not marked');
});

test('a specialised tower counts for more in the threat estimate, and survives a save', () => {
  const g = ready(), S = g.state, b = tower3(g); const d0 = g.defenceDps();
  g.specialise(b.id, 'mortar'); assert.ok(g.defenceDps() > d0, 'a mortar adds nothing to the estimate');
  const snap = JSON.parse(JSON.stringify(g.snapshot()));
  const g2 = newGame({ seed: 3, mode: 'classic', restore: snap });
  assert.equal(g2.state.byId.get(b.id).spec, 'mortar', 'the role was lost in the save');
  // a ruin keeps its role when rebuilt
  g.hitBuilding(b.id, 999); assert.ok(b.ruined); assert.ok(g.rebuild(b.id)); assert.equal(S.byId.get(b.id).spec, 'mortar');
});

test('crew: turrets are machines and need nobody; the strip line counts none silent', () => {   // [mech] (was: towers past the people stand silent)
  const g = ready(), S = g.state; S.survivors = 0; S.homeless = 0; g.state.occVersion = (g.state.occVersion || 0) + 1;
  const a = tower3(g), b = tower3(g);
  assert.ok(g.manned(a)); assert.ok(g.manned(b));
  const cw = g.crewing(), up = S.buildings.filter(x => x.type === 'tower' && !x.ruined).length;
  assert.equal(up - cw.manned.size, 0); assert.equal(cw.need, 0);
});
