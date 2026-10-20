// Class tiers stack: every path (Calling × advanced class) keeps what the Calling gave, and the advanced class is a
// clear power spike. Run with: node --test test/classes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { HEROES, FINALS, FINAL_KIT, LEGEND_OF, finalDelta, heroKit } from '../src/content/heroes.js';
import { FINAL_LVL, LEGEND_LVL } from '../src/content/season.js';

const PATHS = Object.entries(FINALS).flatMap(([pair, adv]) => pair.split('+').map(calling => ({ adv, calling })));
const levelTo = (g, lv) => { while (g.state.lvl < lv) g.gainXp(g.xpNext() - g.state.xp); };
// what a Calling gives that must survive every later tier
const passives = H => ({ collects: !!H.collects, trader: !!H.trader, discount: H.discount || 0, extraOffer: H.extraOffer || 0, speed: H.speed, hp: H.hp,
  ability: H.ability && H.ability.id, kind: H.attack && H.attack.kind, reach: H.attack ? H.attack.reach : 0 });
function noLoss(from, to, label) {
  const a = passives(from), b = passives(to);
  for (const k of ['collects', 'trader']) assert.ok(!a[k] || b[k], `${label}: lost ${k}`);
  for (const k of ['discount', 'extraOffer', 'speed', 'hp', 'reach']) assert.ok(b[k] >= a[k], `${label}: ${k} ${a[k]} → ${b[k]}`);
  assert.equal(b.kind, a.kind, `${label}: weapon changed`);
}

test('every path: the advanced class keeps every passive of the Calling', () => {
  assert.equal(PATHS.length, 12);
  for (const { adv, calling } of PATHS) {
    const K = FINAL_KIT[adv][calling]; assert.ok(K, `${calling} → ${adv}: no kit`);
    noLoss(HEROES[calling], K, `${calling} → ${adv}`);
    assert.equal(K.ability.id, HEROES[calling].ability.id, `${calling} → ${adv}: the Calling's ability was swapped`);
  }
});

test('every path: the legendary form keeps everything the advanced class had', () => {
  for (const { adv, calling } of PATHS) {
    const id = LEGEND_OF[adv][calling], L = HEROES[id], K = FINAL_KIT[adv][calling];
    noLoss(K, L, `${adv} (${calling}) → ${id}`);
    for (const t of ['twin', 'cryPays', 'ward', 'marshal', 'quarter', 'volleyPays', 'pierce', 'bruteCrit']) assert.equal(L[t], K[t], `${id}: twist ${t}`);
    assert.equal(L.ability.id, K.ability.id, `${id}: ability family changed`);
  }
});

test('every path in play: Lv29 Calling → Lv30 advanced class loses nothing and hits ~50% harder', () => {
  for (const { adv, calling } of PATHS) for (const perks of [{}, { heroDmg: 1.5, heroDmgMult: 1.15 }]) {
    const g = createGame({ seed: 4, hero: 'survivor' }), S = g.state;
    g.evolve(calling); Object.assign(S.P, perks); levelTo(g, FINAL_LVL - 1);
    const before = passives(g.heroDef), dps0 = g.heroDps(), cost0 = g.costOf('tower');
    levelTo(g, FINAL_LVL); g.evolve(adv);
    assert.equal(S.evo.calling, calling); assert.equal(S.evo.final, adv);
    noLoss({ ...HEROES[calling], ...{} }, g.heroDef, `${calling} → ${adv} in play`);
    assert.deepEqual([g.heroDef.ability.id, !!g.heroDef.collects], [before.ability, before.collects]);
    assert.ok(g.costOf('tower') <= cost0, `${calling} → ${adv}: buildings cost more`);
    const r = g.heroDps() / dps0;
    assert.ok(r >= 1.4 && r <= 1.6, `${calling} → ${adv} ${JSON.stringify(perks)}: heroDps ×${r.toFixed(2)}`);
  }
});

test("Gabriel's path: Scavver → Deadeye keeps scrap pickup, Bounty and the discount, and gains pierce and brute crits", () => {
  const g = createGame({ seed: 3, hero: 'survivor' }), S = g.state;
  g.evolve('merchant'); levelTo(g, FINAL_LVL); g.evolve('deadeye');
  const H = g.heroDef;
  assert.ok(H.collects && H.trader && H.discount === 0.1 && H.extraOffer === 1, 'lost a Scavver passive');
  assert.equal(H.ability.id, 'bounty'); assert.equal(H.attack.reach, 8); assert.equal(H.pierce, 2); assert.equal(H.bruteCrit, 2);
  // a save brings the stacked kit back
  const snap = JSON.parse(JSON.stringify(g.snapshot())), g2 = createGame({ seed: 3, hero: snap.hero, restore: snap });
  assert.ok(g2.heroDef.collects && g2.heroDef.dmgMult === 1.5 && g2.heroDef.ability.id === 'bounty', 'the restored Deadeye lost its Calling');
  // and the card says so
  const D = finalDelta('deadeye', 'merchant');
  assert.equal(D.gain[0], '+50% damage');
  assert.ok(D.keep.includes('Scrap pickup from the dead') && D.keep.includes('Bounty'), JSON.stringify(D.keep));
  assert.ok(D.gain.some(x => /pierce/i.test(x)) && D.gain.some(x => /brutes/i.test(x)), JSON.stringify(D.gain));
});

test('a Deadeye shot pierces into the dead behind, and brutes take double', () => {
  const g = createGame({ seed: 3, hero: 'survivor' }), S = g.state;
  g.evolve('archer'); levelTo(g, FINAL_LVL); g.evolve('deadeye');
  const h = S.hero; S.mobs.length = 0; g.setAutopilot && g.setAutopilot(false); S.autopilot = false;
  const mk = (kind, dx) => g.spawnMob(kind, h.x + dx, h.y, { hp: 999, maxHp: 999, rise: 1, cd: 99, speed: 0 });
  const line = [mk('walker', 3), mk('walker', 4.2), mk('walker', 5.4), mk('walker', 6.6)];
  h.cd = 0; for (let k = 0; k < 40 && !h.attacks; k++) g.step();
  for (let k = 0; k < 60; k++) g.step();   // let the bolts land
  const hurt = line.filter(m => m.hp < 999);
  assert.ok(hurt.length >= 3, `one shot hit ${hurt.length} dead`);
  // brutes: the same shot deals double
  for (const m of line) { const i = S.mobs.indexOf(m); if (i >= 0) S.mobs.splice(i, 1); }
  const b = mk('brute', 3), dmg = g.heroDps() * g.heroDef.attack.rate;
  for (let k = 0; k < 600 && b.hp === 999; k++) g.step();
  assert.ok(Math.abs(b.lastHit / dmg - 2) < 0.01, `brute hit ${b.lastHit} vs shot ${dmg}`);
});

test('the job-change card at Lv30 lists what you keep and what you gain', () => {
  for (const { adv, calling } of PATHS) {
    const D = finalDelta(adv, calling);
    assert.ok(D.keep.length >= 2 && D.gain.length >= 2, `${calling} → ${adv}`);
    assert.match(D.gain[0], /^\+\d+% damage$/);
    assert.equal(D.keepFrom, HEROES[calling].name);
  }
  assert.equal(heroKit('survivor'), HEROES.survivor); assert.equal(heroKit('merchant'), HEROES.merchant);
  void LEGEND_LVL;
});
