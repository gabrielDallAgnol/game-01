// Balance gates: a small bot matrix must land inside the target bands.
// Slower than the unit tests (about a minute). Run with: npm run test:balance
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { playRun } from '../tools/bot.mjs';

const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const runs = (opts, seeds) => seeds.map(seed => playRun(createGame, { path: 'any', maxNights: 40, ...opts, seed, biome: ['riverbend', 'highland', 'lakeshore'][seed % 3] }));

test('a solid tower build survives roughly 15–35 nights', () => {
  const r = runs({ hero: 'archer', strat: 'towers', expansion: 'careful' }, [1, 2, 3, 4, 5, 6]);
  const m = median(r.map(x => x.nights));
  assert.ok(m >= 15 && m <= 35, `median ${m}`);
});

test('a town with no defences falls early', () => {
  const r = runs({ hero: 'merchant', strat: 'economy', expansion: 'never', heroMode: 'idle' }, [1, 2, 3, 4]);
  assert.ok(median(r.map(x => x.nights)) <= 10);
});

test('endless mode always ends: nobody passes night 40', () => {
  const r = runs({ hero: 'warrior', strat: 'towers', expansion: 'bold' }, [7, 8, 9]);
  for (const x of r) assert.ok(x.over, 'a run survived the whole test window');
});

test('rating Easy means the run almost never ends that night', () => {
  const r = runs({ hero: 'archer', strat: 'balanced', expansion: 'careful' }, [11, 12, 13, 14, 15, 16]);
  const easy = r.flatMap(x => x.log.filter(l => l.ratio !== undefined && l.ratio < 0.3));
  const ended = easy.filter(l => l.result === 'lost').length;
  assert.ok(easy.length > 20, 'too few easy nights to judge');
  assert.ok(ended / easy.length <= 0.05, `${ended}/${easy.length} easy nights ended the run`);
});
