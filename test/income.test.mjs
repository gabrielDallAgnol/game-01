// Income as a trickle (sim/income.js): scrap and food come in by the second, the whole day and night pay what one
// dawn used to, a day cut short pays the rest at dusk, and the ledger says what came in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { TIDE } from '../src/content/mobs.js';

const clearStory = g => { const S = g.state; for (let k = 0; k < 9 && S.story.encounters.length; k++) { const e = S.story.encounters[0]; g.choose(e.choices[e.choices.length - 1].id); } };
const ring = (g, type) => { const t = g.map.town; for (let r = 3; r < 16; r++) for (let a = 0; a < 24; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace(type, x, y).ok) return { x, y }; } return null; };
/** a quiet town on day 3: two homes and a farm, finished, no dead, a keep that cannot fall */
function town() {
  const g = createGame({ seed: 4, hero: 'warrior' }), S = g.state;
  S.keep.hp = S.keep.maxHp = 1e6;
  for (let n = 0; n < 2; n++) { clearStory(g); g.startNight(); for (let k = 0; S.phase === 'night' && k < 60 * 400; k++) { S.mobs.length = 0; g.step(); } }
  clearStory(g); S.gold = 200; S.food = 30;
  for (const t of ['house', 'house', 'farm']) { const p = ring(g, t); assert.ok(p && g.build(t, p.x, p.y), `no ${t}`); }
  for (const b of S.buildings) b.built = 1;
  S.salvage = 0;
  return g;
}
const quietStep = (g, n) => { const S = g.state; for (let k = 0; k < n; k++) { S.mobs.length = 0; S.salvage = 0; clearStory(g); g.step(); } };

test('scrap and food trickle in by day, slower by night, and a whole cycle pays what one dawn used to', () => {
  const g = town(), S = g.state, per = g.incomePerCycle();
  assert.ok(per.gold > 0 && per.made > 0, 'the town earns nothing');
  quietStep(g, 20); const r = g.incomeRate(); assert.ok(r.gold > 0 && r.gold < 2, `rate ${r.gold}/s`);
  const g0 = S.gold, d0 = S.dawns, spent = () => S.stats.goldSpent;
  const s0 = spent();
  quietStep(g, 60 * 40);   // 40 s of day
  const mid = S.gold - g0 + (spent() - s0);
  assert.ok(mid > 0, 'no scrap came in by day'); assert.ok(mid < per.gold * 0.5, `the day paid a lump: ${mid} of ${per.gold}`);
  // the rest of the day and the night, to the dawn
  for (let k = 0; S.dawns === d0 && k < 60 * 600; k++) quietStep(g, 1);
  assert.equal(S.dawns, d0 + 1, 'no dawn');
  const got = S.gold - g0 + (spent() - s0);
  assert.ok(Math.abs(got - per.gold) <= 2, `a cycle paid ${got}, a dawn used to pay ${per.gold}`);
  const L = S.log[S.log.length - 1]; assert.ok(Math.abs(L.goldIn - per.gold) <= 2, `ledger says ${L.goldIn}`);
  assert.ok(Math.abs(L.foodIn - per.made) <= 1, `ledger food ${L.foodIn} vs ${per.made}`);
  // the night rate is the day's at TIDE.nightIncome
  clearStory(g); assert.ok(g.startNight(), 'no dusk'); quietStep(g, 1); const rn = g.incomeRate(); assert.ok(rn.night && Math.abs(rn.gold - r.gold * TIDE.nightIncome) < r.gold * 0.25, `night ${rn.gold} vs day ${r.gold}`);
});

test('a day cut short pays the rest of its share at dusk (bots and tests skip ahead)', () => {
  const g = town(), S = g.state, per = g.incomePerCycle();
  const g0 = S.gold + S.stats.goldSpent, d0 = S.dawns;
  quietStep(g, 60 * 5); clearStory(g); assert.ok(g.startNight(), 'no dusk');
  for (let k = 0; S.dawns === d0 && k < 60 * 600; k++) quietStep(g, 1);
  const got = S.gold + S.stats.goldSpent - g0;
  assert.ok(Math.abs(got - per.gold) <= 2, `a skipped day paid ${got} of ${per.gold}`);
});

test('the day is long, day 1 shorter but not rushed', () => {
  assert.ok(TIDE.dayLen >= 160 && TIDE.dayLen <= 180, `day ${TIDE.dayLen}`);
  assert.ok(TIDE.dayOne >= 50 && TIDE.dayOne < TIDE.dayLen, `day 1 ${TIDE.dayOne}`);
  assert.equal(TIDE.nightLen, 72, 'the night changed');
  const g = createGame({ seed: 2 }); assert.ok(Math.abs(g.duskIn() - TIDE.dayOne) < 1);
});
