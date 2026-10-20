// Pacified land (sim/pacify.js): a sleeping hive on your ground never wakes, every hive that wakes is on the map and
// can be reached and burned, the home threat plateaus once the land is quiet, and the way home from a held site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, STEP } from '../src/sim/game.js';
import { PACIFY } from '../src/sim/pacify.js';
import { PASSABLE, idx } from '../src/sim/mapgen.js';
import { MAX_LEVEL } from '../src/content/buildings.js';

const clearStory = g => { const S = g.state; for (let k = 0; k < 9 && S.story.encounters.length; k++) { const e = S.story.encounters[0]; g.choose(e.choices[e.choices.length - 1].id); } };
const run = (g, s) => { for (let k = 0; k < Math.round(s / STEP); k++) g.step(); };
/** burn every forest hollow (act 2 opens) and clear the dead it raised */
function burnHollows(g) {
  const S = g.state;
  for (const r of g.map.regions) if (r.ring === 1 && r.nest && S.nestAlive[r.id]) g.hitHive(r.id, 1e9);
  S.mobs.length = 0; clearStory(g);
}

test('a sleeping hive on pacified ground never wakes, is on the map and stays burnable', () => {
  let tried = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const g = createGame({ seed }), S = g.state; burnHollows(g);
    assert.equal(g.act(), 2, `seed ${seed}: act 2 after the hollows`);
    // a city hive still asleep, and a site you hold right beside it
    const reg = g.map.regions.find(r => r.ring === 2 && r.nest && S.nestAlive[r.id] && !S.sealed[r.id] && S.landmarks.some(l => l.region === r.id));
    if (!reg) continue; tried++;
    S.wake[reg.id] = S.night + 2;
    const l = S.landmarks.filter(q => q.region === reg.id).sort((a, b) => Math.hypot(a.x - reg.nest.x, a.y - reg.nest.y) - Math.hypot(b.x - reg.nest.x, b.y - reg.nest.y))[0];
    if (Math.hypot(l.x - reg.nest.x, l.y - reg.nest.y) > PACIFY.r) { l.x = reg.nest.x + 8; l.y = reg.nest.y; }
    l.owned = true; S.occVersion = (S.occVersion || 0) + 1;
    S.events.length = 0; run(g, 0.5);
    assert.ok(g.pacifiedAt(reg.nest.x, reg.nest.y), `seed ${seed}: the hive's ground is pacified`);
    assert.ok(g.smothered(reg.id), `seed ${seed}: the hive is smothered`);
    assert.equal(S.seen[idx(Math.floor(reg.nest.x), Math.floor(reg.nest.y))], 1, `seed ${seed}: a smothered hive is on the map`);
    assert.ok(S.events.some(e => e.t === 'hiveSmothered' && e.region === reg.id));
    // its night comes and goes: it stays asleep and sends nothing
    S.night += 4; run(g, 0.5);
    assert.ok(!g.activeNests().includes(reg.id), `seed ${seed}: a smothered hive woke`);
    assert.ok(S.wake[reg.id] > S.night, 'its wake is pushed (a save keeps it asleep)');
    // the land is lost: it wakes on its own
    l.owned = false; S.occVersion++; run(g, 0.5);
    assert.ok(!g.smothered(reg.id));
  }
  assert.ok(tried >= 2, 'too few maps had a city hive with a site');
});

test('never an un-killable hive: every hive that wakes is on the map, unsealed, on reachable ground, with a keep that can be raised', () => {
  for (let seed = 1; seed <= 8; seed++) {
    for (const rule of [null, 'fog']) {
      const g = createGame({ seed }), S = g.state, m = g.map;
      if (rule) g.setSeasonRules([rule]);
      burnHollows(g);
      // every city hive wakes now (the city's schedule, compressed); the old core opens like a district would
      for (const r of m.regions) if (r.nest && S.nestAlive[r.id]) { S.wake[r.id] = S.night; if (S.sealed[r.id]) g.openDistrict(r.id); }
      S.events.length = 0; run(g, 0.5);
      const awake = g.activeNests();
      assert.ok(awake.length, `seed ${seed}: no hive woke`);
      for (const r of awake) {
        const reg = m.regions[r], n = reg.nest, i = idx(Math.floor(n.x), Math.floor(n.y));
        assert.equal(S.seen[i], 1, `seed ${seed} ${rule}: awake hive ${r} is hidden`);
        assert.ok(!S.sealed[r] && !g.actGated(r), `seed ${seed}: awake hive ${r} is behind a fence`);
        assert.ok(m.reach[i] && PASSABLE[m.terrain[i]], `seed ${seed}: awake hive ${r} stands off the reachable ground`);
        assert.ok(g.keepForRing(reg.ring) <= MAX_LEVEL, `seed ${seed}: hive ${r} needs a keep that cannot be built`);
        assert.ok(S.events.some(e => e.t === 'hiveAwake' && e.region === r), `seed ${seed}: hive ${r} woke without a word`);
      }
      // and one can be burned once the keep is high enough
      S.keep.level = MAX_LEVEL; const r0 = awake[0];
      assert.ok(g.hitHive(r0, 1e9) && !S.nestAlive[r0], `seed ${seed}: hive ${r0} could not be burned`);
    }
  }
});

test('the home threat: the calendar until night 10, then a plateau when the woods are quiet, the old curve when hives hear the Camp', () => {
  const g = createGame({ seed: 3 }), S = g.state;
  for (let n = 1; n <= PACIFY.from; n++) assert.equal(g.homeK(n), 1);
  // the hollows awake and loud: no relief
  for (const r of g.map.regions) if (r.ring === 1 && r.nest) S.wake[r.id] = 1;
  assert.equal(g.homeK(16), 1, 'awake hollows that hear the Camp keep the old curve');
  // the woods burned, the city asleep: the plateau
  burnHollows(g);
  for (const r of g.map.regions) if (r.nest && S.nestAlive[r.id]) S.wake[r.id] = Infinity;
  const quiet = [12, 16, 20, 25].map(n => g.homeK(n));
  assert.ok(quiet.every((k, j) => k < 1 && (j === 0 || k < quiet[j - 1])), `quiet woods: ${quiet}`);
  assert.ok(g.homeThreat(25).home < 17, 'night 25 at home reads like night ~15');
  // one city hive wakes: a little more; at the door of your land: more again
  const city = g.map.regions.find(r => r.ring === 2 && r.nest && S.nestAlive[r.id]);
  S.wake[city.id] = 1; const far = g.homeK(20);
  assert.ok(far > quiet[2], `a far city hive adds a little: ${far} vs ${quiet[2]}`);
  S.noise = 100; const loud = g.homeK(20);   // a loud Camp is heard further off
  assert.ok(loud >= far, `noise never lowers the threat: ${loud} vs ${far}`);
});

test('Return to Camp: by day from a held site, a channel broken by moving, then a cooldown; never at night', () => {
  const g = createGame({ seed: 3 }), S = g.state, c = g.map.town.x; clearStory(g);
  const l = S.landmarks.filter(q => Math.hypot(q.x - c, q.y - c) > 40).sort((a, b) => Math.hypot(a.x - c, a.y - c) - Math.hypot(b.x - c, b.y - c))[0];
  l.owned = true; S.occVersion = (S.occVersion || 0) + 1;
  const h = S.hero; S.mobs.length = 0;
  const atSite = () => { h.x = l.x; h.y = l.y + l.size / 2 + 1.2; h.target = null; h.path = null; h.fightT = 0; };
  atSite(); g.step();
  let i = g.homeInfo(); assert.ok(i.ok, `cannot go home from a held site: ${i.why}`); assert.equal(i.from.kind, 'site');
  // moving breaks the channel
  assert.ok(g.returnHome()); g.setHeroInput(1, 0); g.step(); g.setHeroInput(0, 0);
  assert.equal(g.homeInfo().channel, 0); assert.ok(Math.hypot(h.x - c, h.y - c) > 30);
  // standing still: home
  atSite(); S.mobs.length = 0; assert.ok(g.returnHome()); run(g, PACIFY.home.channel + 0.3);
  assert.ok(Math.hypot(h.x - c, h.y - c) < 6, 'the hero is at the Camp');
  assert.ok(S.events.some(e => e.t === 'homeward'));
  // cooldown
  atSite(); assert.equal(g.homeInfo().why, 'cooldown'); assert.equal(g.returnHome(), false);
  // never at night
  S.homeward.cd = 0; S.phase = 'night'; assert.equal(g.homeInfo().why, 'night'); S.phase = 'day';
  // not from the open woods
  h.x = l.x + 40; h.y = l.y; assert.equal(g.homeInfo().why, 'nowhere');
});

test('the dusk warning: once a day, when the walk home is longer than the light left', () => {
  const g = createGame({ seed: 3 }), S = g.state, c = g.map.town.x; clearStory(g);
  const h = S.hero; h.x = c + 70; h.y = c; g.step();
  S.dayT = 99 - 10; S.events.length = 0; S.mobs.length = 0;
  for (let k = 0; k < Math.round(1 / STEP); k++) { h.x = c + 70; h.y = c; g.step(); }
  const w = S.events.filter(e => e.t === 'duskWarn');
  assert.equal(w.length, 1); assert.ok(w[0].walk > w[0].left);
});
