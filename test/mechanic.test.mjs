// [mech] The Mechanic and the Haven Rig (sim/mechanic.js, sim/rig.js): salvage once a day, a turret tier that kills in
// range, the Rig's modules (cost and effect), the wrench too weak to hold a night alone, determinism.
// Run with: node --test test/mechanic.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { TURRETS, WRENCH, SALVAGE } from '../src/content/mechanic.js';
import { MODULES, RIG2 } from '../src/content/rig2.js';

const clearStory = g => { const S = g.state; for (let k = 0; k < 9 && S.story.encounters.length; k++) { const e = S.story.encounters[0]; g.choose(e.choices[e.choices.length - 1].id); } };
const fresh = (seed = 5) => { const g = createGame({ seed }); clearStory(g); return g; };
const run = (g, sec) => { for (let k = 0; k < sec * 60; k++) g.step(); };
const ring = (g, type, r0 = 4) => { const t = g.map.town; for (let r = r0; r < 16; r++) for (let a = 0; a < 24; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace(type, x, y).ok) return { x, y }; } return null; };

test('the Mechanic is the only class: a weak wrench, the System grants the class', () => {
  const g = createGame({ seed: 2, hero: 'archer' }), S = g.state;
  assert.equal(S.heroClass, 'mechanic');
  assert.ok(Math.abs(g.heroDps() - WRENCH.dmg / WRENCH.rate) < 1e-9, `wrench dps ${g.heroDps()}`);
  run(g, 1);
  assert.ok(S.events.some(e => e.t === 'toast' && e.msg === '[Class granted: Mechanic]'));
  assert.equal(g.defenceDps(), 0, 'the bare Rig shoots');
});

test('salvage: a car gives scrap (and maybe parts) once a day, then again the next day', () => {
  const g = fresh(), S = g.state, spots = g.salvageSpots();
  assert.ok(spots.length > 5, `only ${spots.length} salvage spots`);
  S.hero.hp = S.hero.maxHp = 1e6; S.keep.hp = S.keep.maxHp = 1e6;
  const car = spots.filter(o => o.kind === 'car').sort((a, b) => Math.hypot(a.x - S.hero.x, a.y - S.hero.y) - Math.hypot(b.x - S.hero.x, b.y - S.hero.y))[0];
  // stand beside it: step out from its middle until the cell is walkable
  const place = () => { for (let r = 1; r < 4; r += 0.25) for (let a = 0; a < 16; a++) { const x = car.x + Math.cos(a / 16 * 6.28) * r, y = car.y + Math.sin(a / 16 * 6.28) * r; S.hero.x = x; S.hero.y = y; S.hero.target = null; g.step(); if (Math.abs(S.hero.x - x) < 1e-6 && g.salvageAt() === car.id) return true; } return false; };
  assert.ok(place(), 'could not stand at the car');
  const carry = S.hero.carry.scrap, parts = S.parts;
  run(g, SALVAGE.kinds.car.time + 0.2);
  assert.ok(g.salvaged(car.id), 'not salvaged');
  assert.equal(S.hero.carry.scrap - carry, SALVAGE.kinds.car.scrap);
  const p1 = S.parts - parts;
  assert.ok(p1 >= 0 && p1 <= 1);
  run(g, SALVAGE.kinds.car.time + 1);
  assert.equal(S.hero.carry.scrap - carry, SALVAGE.kinds.car.scrap, 'a car gave twice in a day');
  S.night++;   // the next day
  assert.ok(!g.salvaged(car.id), 'still stripped the next day');
});

test('parts: the API adds and reads them; a tier 2 turret needs the Workshop and 2 parts', () => {
  const g = fresh(6), S = g.state; S.gold = 500;
  assert.equal(g.parts(), 0); g.addParts(3); assert.equal(g.parts(), 3);
  const p = ring(g, 'tower'); assert.ok(g.build('tower', p.x, p.y));
  const b = S.buildings[S.buildings.length - 1]; run(g, 12); assert.equal(b.built, 1, 'the turret never finished');
  assert.match(g.raiseBlock(b.id), /Workshop/);
  S.rig.lv.workshop = 1;
  assert.equal(g.raiseBlock(b.id), '');
  assert.ok(g.upgrade(b.id)); assert.equal(g.parts(), 3 - TURRETS[1].cost.parts);
});

test('turret slots: three at level 1, the fourth is refused', () => {
  const g = fresh(7), S = g.state; S.gold = 500;
  for (let k = 0; k < 3; k++) { const p = ring(g, 'tower'); assert.ok(p && g.build('tower', p.x, p.y), `turret ${k + 1}`); }
  assert.deepEqual(g.turretSlots(), { used: 3, max: 3 });
  assert.match(g.canPlace('tower', S.keep.x + 6, S.keep.y + 6).reason, /Turret slots/);
});

test('a Nail Spitter shoots and kills in range, without a crew; nothing out of range', () => {
  const g = fresh(8), S = g.state; S.gold = 500; S.survivors = 0;
  const p = ring(g, 'tower'); assert.ok(g.build('tower', p.x, p.y)); const b = S.buildings[S.buildings.length - 1]; run(g, 10);
  assert.equal(b.built, 1); assert.ok(g.manned(b), 'a turret wants a crew');
  const T = TURRETS[0], st = g.towerStats(b);
  const inR = g.spawnMob('walker', b.x + T.range - 1.5, b.y); inR.rise = 1; inR.speed = 0;
  const far = g.spawnMob('walker', b.x + T.range + 6, b.y + 6); far.rise = 1; far.speed = 0;
  const kills = S.kills; run(g, 6);
  assert.ok(!S.mobs.includes(inR), `the walker in range lived (dmg ${st.dmg}, rate ${st.rate})`);
  assert.ok(S.kills > kills);
  assert.ok(S.mobs.includes(far) ? far.hp === far.maxHp : true, 'it shot past its range');
});

test('the Rig: modules cost scrap and parts, take time, and take effect', () => {
  const g = fresh(9), S = g.state; S.gold = 200; g.addParts(20);
  const B = MODULES.find(m => m.id === 'bunks'), RT = MODULES.find(m => m.id === 'roofTurret');
  assert.equal(g.rigBeds(), 0); assert.equal(g.rigHas('bunks'), false);
  assert.ok(g.rigBuild('bunks')); assert.equal(S.gold, 200 - B.cost.scrap); assert.equal(g.parts(), 20 - B.cost.parts);
  assert.equal(g.rigBuild('roofTurret'), false, 'two jobs at once');
  assert.equal(g.rigHas('bunks'), false, 'installed at once');
  run(g, B.build + 0.5);
  assert.ok(g.rigHas('bunks')); assert.equal(g.rigBeds(), B.fx.beds);
  assert.ok(g.rigBuild('roofTurret')); run(g, RT.build + 0.5);
  assert.ok(g.rigHas('roofTurret')); assert.ok(g.defenceDps() > 0, 'the roof turret adds no defence');
  const m = g.spawnMob('walker', S.keep.x + RT.fx.range - 1, S.keep.y); m.rise = 1; m.speed = 0;
  run(g, 4); assert.ok(!S.mobs.includes(m), 'the roof turret did not kill');
  // plating: +15% Rig health a level (from night 2 without the quest engine)
  S.night = 2; const hp0 = S.keep.maxHp; assert.equal(hp0, RIG2.hp);
  assert.ok(g.rigBuild('plating')); run(g, 9); assert.equal(S.keep.maxHp, Math.round(RIG2.hp * 1.15));
  // the save keeps the modules and the parts
  S.phase = 'day'; const snap = JSON.parse(JSON.stringify(g.snapshot()));
  const g2 = createGame({ seed: 9, restore: snap });
  assert.ok(g2.rigHas('bunks') && g2.rigHas('roofTurret') && g2.rigLevel('plating') === 1); assert.equal(g2.parts(), g.parts()); assert.equal(g2.state.keep.maxHp, S.keep.maxHp);
});

test('balance: the wrench alone cannot hold a march; two Nail Spitters and the roof turret can', () => {
  const night = (setup, seed = 11) => {
    const g = fresh(seed), S = g.state; S.gold = 500; g.addParts(20); S.hero.hp = S.hero.maxHp = 1e6;
    setup(g); run(g, 20);
    // a march of 8 Cinders and 2 Flickers walks onto the Rig from 14 m out; Kai stands at the Rig and swings
    const ms = []; for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28, m = g.spawnMob(k < 8 ? 'walker' : 'runner', S.keep.x + Math.cos(a) * 14, S.keep.y + Math.sin(a) * 14); m.rise = 1; m.hunt = true; ms.push(m); }
    S.hero.x = S.keep.x; S.hero.y = S.keep.y + 3;
    const hp = S.keep.hp; for (let k = 0; k < 60 * 40; k++) { S.hero.x = S.keep.x; S.hero.y = S.keep.y + 3; g.step(); }
    return { left: ms.filter(m => S.mobs.includes(m)).length, lost: hp - S.keep.hp };
  };
  const bare = night(() => {});
  const held = night(g => { for (let k = 0; k < 2; k++) { const p = ring(g, 'tower', 3); g.build('tower', p.x, p.y); } g.rigBuild('roofTurret'); });
  assert.ok(bare.left > 0 || bare.lost > 10, `the wrench alone held: ${JSON.stringify(bare)}`);
  assert.ok(held.left === 0, `two turrets and the roof turret did not hold: ${JSON.stringify(held)}`);
});

test('deterministic: the same seed and inputs salvage the same parts', () => {
  const play = () => { const g = fresh(12), S = g.state; S.hero.hp = S.hero.maxHp = 1e6; const out = []; for (const o of g.salvageSpots().slice(0, 20)) { for (let k = 0; k < 60 * 6; k++) { S.hero.x = o.x; S.hero.y = o.y; g.step(); } out.push(`${S.parts}:${S.hero.carry.scrap}`); } return out.join(','); };
  assert.equal(play(), play());
});
