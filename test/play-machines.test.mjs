// [play] Every machine is complete data: how it fights, its numbers, its tags, a name and its desc/why
import { test } from 'node:test';
import assert from 'node:assert';
import { MACHINES } from '../src/play/machines.js';
const AIS = ['melee', 'hound', 'ranged', 'walker'];
test('each machine is complete', () => { for (const [id, m] of Object.entries(MACHINES)) {
  assert.ok(AIS.includes(m.ai), `${id}: ai`); assert.ok(m.hp > 0 && m.speed > 0 && m.dmg > 0, `${id}: numbers`);
  assert.ok(Array.isArray(m.tags) && m.tags.includes('metal'), `${id}: tags`); assert.ok(m.name && m.desc && m.why, `${id}: words`);
  if (m.boss) assert.ok(m.plates > 0 && m.plateHp > 0 && m.reach > 0, `${id}: boss fields`); else assert.ok(Array.isArray(m.weight) && m.weight.length === 2, `${id}: day/night weight`);   // a boss is never rolled
  if (m.ai === 'ranged') assert.ok(m.keep && m.range && m.every && m.windup && m.bolt, `${id}: ranged fields`);
  if (m.ai === 'hound') assert.ok(m.lunge && m.forget, `${id}: hound fields`); } });
