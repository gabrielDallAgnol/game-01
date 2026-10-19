// The balance model (tools/model.mjs): deterministic, rule-based, the game's own tables. These checks fail when a
// tuning change makes a stretch of nights unwinnable for a sensible town, or trivially easy.
// ratio = what the night brings / what the town can deal over the night (≥ 1 means the town cannot hold).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { model } from '../tools/model.mjs';

const at = (rows, n) => rows.find(r => r.night === n);
test('Survivor: winnable through the first season, never trivial after night 3', () => {
  const rows = model('survivor', 16);
  for (const r of rows.filter(q => q.night <= 14)) assert.ok(r.ratio < (r.moon ? 1 : 0.9), `night ${r.night}: ratio ${r.ratio}`);
  for (const r of rows.filter(q => q.night >= 4 && q.night <= 14)) assert.ok(r.ratio > 0.12, `night ${r.night} is trivial: ratio ${r.ratio}`);
});
test('the town hall is earned, but within reach', () => {
  const rows = model('survivor', 16);
  const k2 = rows.find(r => r.keep >= 2), k3 = rows.find(r => r.keep >= 3);
  assert.ok(k2 && k2.night >= 3 && k2.night <= 7, `level 2 on night ${k2 && k2.night}`);
  assert.ok(k3 && k3.night >= 8 && k3.night <= 14, `level 3 on night ${k3 && k3.night}`);
});
test('difficulties are ordered: Story < Survivor < Veteran < Nightmare at nights 8 and 12', () => {
  const R = Object.fromEntries(['story', 'survivor', 'veteran', 'nightmare'].map(d => [d, model(d, 12)]));
  for (const n of [8, 12]) {
    const v = ['story', 'survivor', 'veteran', 'nightmare'].map(d => at(R[d], n).ratio);
    for (let k = 1; k < v.length; k++) assert.ok(v[k] > v[k - 1], `night ${n}: ${v.join(' ≤ ')}`);
  }
  for (const r of R.story) assert.ok(r.ratio < 0.6, `Story night ${r.night}: ratio ${r.ratio}`);
});
test('endless runs always end: the threat outgrows any town by night 25', () => {
  assert.ok(at(model('survivor', 25), 25).ratio > 1.5);
});
