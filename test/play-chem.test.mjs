// [play] The chemistry: every mix of three pips has a recipe, every entry explains itself, and the pipeline behaves
import { test } from 'node:test';
import assert from 'node:assert';
import { ELEMENTS } from '../src/play/elements.js';
import { PIPS, STATUSES } from '../src/play/statuses.js';
import { REACTIONS, CLASH, recipeFor } from '../src/play/reactions.js';
import { EFFECTS } from '../src/play/effects.js';
import { TAGS } from '../src/play/tags.js';
import { addPip } from '../src/play/hit.js';
const ids = Object.keys(ELEMENTS);
test('every mix of three pips has its own recipe (no clash in the grid)', () => { const missing = [];
  for (let a = 0; a < ids.length; a++) for (let b = a; b < ids.length; b++) for (let c = b; c < ids.length; c++) { const mix = [ids[a], ids[b], ids[c]]; if (new Set(mix).size === 3) continue; if (recipeFor(mix) === CLASH) missing.push(mix.join('+')); }
  assert.deepStrictEqual(missing, []); });
test('every entry explains itself and uses known verbs, statuses and elements', () => {
  for (const t of [ELEMENTS, PIPS, STATUSES, REACTIONS, TAGS]) for (const [k, v] of Object.entries(t)) assert.ok(v.desc && v.why, k);
  for (const e of ids) assert.ok(PIPS[e], `pip for ${e}`);
  for (const r of [...Object.values(REACTIONS), CLASH]) { for (const k of Object.keys(r.recipe)) assert.ok(ELEMENTS[k], `${r.id}: ${k}`);
    for (const e of r.effects) { assert.ok(EFFECTS[e.do], `${r.id}: ${e.do}`); if (e.status) assert.ok(STATUSES[e.status], `${r.id}: ${e.status}`); if (e.el) assert.ok(ELEMENTS[e.el], `${r.id}: ${e.el}`); } } });
const world = () => { const log = []; return { log, damage: (t, n) => log.push(['damage', n]), apply: (t, s) => log.push(['apply', s]), pip: (t, e) => log.push(['pip', e]),
  near: () => [], push: () => {}, mark: k => log.push(['mark', k]), cloud: k => log.push(['cloud', k]), ground: k => log.push(['ground', k]), react: R => log.push(['react', R.id]) }; };
const run = (els) => { const t = { x: 0, y: 0 }, W = world(); let out = null; els.forEach((e, i) => { out = addPip(t, e, i, W) || out; }); return { out, t, W }; };
test('fire x3 = blaze, water x3 = soak', () => { assert.strictEqual(run(['fire', 'fire', 'fire']).out, 'blaze'); assert.strictEqual(run(['water', 'water', 'water']).out, 'soak'); });
test('two fire + one water = scald, two water + one fire = fog (any order)', () => { assert.strictEqual(run(['fire', 'water', 'fire']).out, 'scald'); assert.strictEqual(run(['water', 'fire', 'water']).out, 'fog'); });
test('the reaction clears the pips; one volley counts once', () => { const r = run(['fire', 'fire', 'fire']); assert.strictEqual(r.t.pips.length, 0);
  const t = { x: 0, y: 0 }, W = world(); addPip(t, 'fire', 0, W); addPip(t, 'fire', 0.05, W); addPip(t, 'fire', 0.1, W); assert.strictEqual(t.pips.length, 1); });
