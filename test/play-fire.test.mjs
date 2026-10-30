// [play] The fire pipeline: modifiers apply stage by stage in a fixed order, stack, and stop at their caps
import { test } from 'node:test';
import assert from 'node:assert';
import { buildShot, STAGES } from '../src/play/fire.js';
import { WEAPONS } from '../src/play/parts/weapons.js';
import { MODIFIERS } from '../src/play/modifiers.js';
const base = WEAPONS.scatter;
test('no modifiers: the base shot, copied', () => { const s = buildShot(base); assert.deepStrictEqual(s, base.shot); assert.notStrictEqual(s, base.shot); });
test('double shot stacks and caps', () => { assert.strictEqual(buildShot(base, ['double_shot']).count, 4); assert.strictEqual(buildShot(base, Array(9).fill('double_shot')).count, 7); });
test('order of mods in the list does not matter, the stages do', () => { const a = buildShot(base, ['faster', 'double_shot']), b = buildShot(base, ['double_shot', 'faster']); assert.deepStrictEqual(a, b); });
test('faster caps at 8 shots a second', () => { assert.ok(buildShot(base, Array(20).fill('faster')).rate <= 8); });
test('every modifier names a known stage and explains itself', () => { for (const m of Object.values(MODIFIERS)) { assert.ok(STAGES.includes(m.stage), m.id); assert.ok(m.desc && m.why, m.id); } });
test('every weapon explains itself', () => { for (const w of Object.values(WEAPONS)) assert.ok(w.desc && w.why && w.shot, w.base); });
