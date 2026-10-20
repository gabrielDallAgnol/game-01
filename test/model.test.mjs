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
test('endless runs always end: the threat outgrows any town by night 28', () => {
  // (Oct 20: the dead toughen slowly now, ≈1.035ⁿ, so a fully built town holds a few nights longer than before)
  assert.ok(at(model('survivor', 28), 28).ratio > 1.5);
});

// ---------- growth must help (Oct 20) ----------
import { WAVES } from '../src/content/mobs.js';
import { NOISE } from '../src/sim/game.js';
test('growth helps: the noise multiplier is capped at ×1.5 and the dead toughen slowly (≈1.035ⁿ)', () => {
  for (const r of model('survivor', 30)) assert.ok(r.draw <= 1 + NOISE.mult + 1e-9 && 1 + NOISE.mult <= 1.5, `night ${r.night}: draw ×${r.draw}`);
  for (const n of [5, 10, 15, 20]) assert.ok(Math.abs(WAVES.hpScale(n) / Math.pow(1.035, n) - 1) < 0.05, `hpScale(${n}) = ${WAVES.hpScale(n)}`);
  // a bigger town is a stronger town: from night 6 the model town deals more every night than three nights before
  const rows = model('survivor', 20);
  for (const r of rows.filter(q => q.night >= 9)) assert.ok(r.dps >= at(rows, r.night - 3).dps, `night ${r.night}: dps fell to ${r.dps}`);
});
// The bot band. Calibration (tools/sweep.mjs survivor 16 12 survivor, Oct 20): the clock bot's runs end on nights
// 11–14, median 13 (was 8–12, median 9), with no single-night collapse from ≥90% hall. In the model, that town sits in this band: still
// holding on nights 12–14 (ratio well under 1) but no longer trivial, and clearly losing by night 25.
test('the bot band: nights 12–14 are hard but holdable; night 22 is not trivial', () => {
  const rows = model('survivor', 25);
  for (const n of [12, 13, 14]) { const r = at(rows, n).ratio; assert.ok(r >= 0.2 && r <= 0.6, `night ${n}: ratio ${r} outside the band 0.2–0.6`); }
  assert.ok(at(rows, 22).ratio >= 0.6, `night 22 too easy: ${at(rows, 22).ratio}`);
});
