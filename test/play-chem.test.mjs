// [play] The chemistry: the grid has no empty cells, every entry explains itself, and the hit pipeline behaves
import { test } from 'node:test';
import assert from 'node:assert';
import { ELEMENTS } from '../src/play/elements.js';
import { STATUSES } from '../src/play/statuses.js';
import { REACTIONS, CLASH, reactionFor } from '../src/play/reactions.js';
import { EFFECTS } from '../src/play/effects.js';
import { TAGS } from '../src/play/tags.js';
import { hitElement } from '../src/play/hit.js';
const ids = Object.keys(ELEMENTS);
test('the element grid has no empty cells (every pair and every element with itself)', () => {
  const missing = []; for (const a of ids) for (const b of ids) if (!reactionFor(a, b)) missing.push(`${a}+${b}`); assert.deepStrictEqual(missing, []); });
test('same-element reactions are intensify (stacks) entries', () => { for (const a of ids) assert.ok(reactionFor(a, a).stacks >= 2, a); });
test('every entry explains itself and uses known verbs and statuses', () => {
  for (const t of [ELEMENTS, STATUSES, REACTIONS, TAGS]) for (const [k, v] of Object.entries(t)) assert.ok(v.desc && v.why, k);
  for (const e of Object.values(ELEMENTS)) assert.ok(STATUSES[e.status], e.id);
  for (const r of [...Object.values(REACTIONS), CLASH]) for (const e of r.effects) { assert.ok(EFFECTS[e.do], `${r.id}: ${e.do}`); if (e.status) assert.ok(STATUSES[e.status], `${r.id}: ${e.status}`); } });
const world = () => { const log = []; return { log, damage: (t, n) => log.push(['damage', n]), apply: (t, s) => { (t.st ||= {})[s] = { stacks: 1, left: STATUSES[s].dur, at: 0 }; log.push(['apply', s]); },
  near: () => [], push: () => {}, mark: k => log.push(['mark', k]), cloud: k => log.push(['cloud', k]), ground: k => log.push(['ground', k]), react: R => log.push(['react', R.id]) }; };
test('wet + fire = steam, and both statuses are used up', () => { const t = { x: 0, y: 0 }, W = world(); hitElement(t, 'water', 0, W); assert.ok(t.st.wet); assert.strictEqual(hitElement(t, 'fire', 1, W), 'steam'); assert.ok(!t.st.wet && !t.st.burning); assert.ok(W.log.some(l => l[0] === 'cloud')); });
test('burning + water = steam too (either order)', () => { const t = { x: 0, y: 0 }, W = world(); hitElement(t, 'fire', 0, W); assert.strictEqual(hitElement(t, 'water', 1, W), 'steam'); });
test('fire x3 = blaze; one volley counts once', () => { const t = { x: 0, y: 0 }, W = world();
  hitElement(t, 'fire', 0, W); hitElement(t, 'fire', 0.05, W); hitElement(t, 'fire', 0.1, W); assert.strictEqual(t.st.burning.stacks, 1, 'same volley');
  hitElement(t, 'fire', 0.5, W); assert.strictEqual(t.st.burning.stacks, 2); assert.strictEqual(hitElement(t, 'fire', 1, W), 'blaze'); assert.ok(!t.st.burning); });
test('water x3 = soaked', () => { const t = { x: 0, y: 0 }, W = world(); hitElement(t, 'water', 0, W); hitElement(t, 'water', 0.5, W); assert.strictEqual(hitElement(t, 'water', 1, W), 'soak'); assert.ok(t.st.soaked); });
