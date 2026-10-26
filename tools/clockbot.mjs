// V2 survival runs in the real (clock) mode: the engine town, hordes by night, the builders on from day 1 (balanced).
// The player is bot.mjs's V2 habits: the story's last affordable choice, searching houses by day near the camp, a dash
// away from a wound-up bite, the hero defending by night (or the autopilot with `auto`). One JSON line per seed.
// usage: node tools/clockbot.mjs [difficulty] [days] [seeds] [hero] [auto] [area]
import { createGame } from '../src/sim/game.js';
import { heroTick, storyTurn, dodge, searchTick } from './bot.mjs';

const diff = process.argv[2] || 'survivor', DAYS = +(process.argv[3] || 14), SEEDS = +(process.argv[4] || 4), hero = process.argv[5] || 'survivor';
const AUTO = process.argv[6] === 'auto', area = process.argv[7] || 'suburb';
const S0 = +(process.env.SEED_START || 0), STRIDE = +(process.env.SEED_STRIDE || 1);
for (let s = S0; s < SEEDS; s += STRIDE) {
  const t0 = Date.now();
  const g = createGame({ seed: 100 + s, mapSeed: 300 + s, hero, difficulty: diff, area }), S = g.state;
  S.builders = 'balanced'; if (AUTO) g.setAutopilot(true);
  let steps = 0, minKeep = 1, heroDeaths = 0, searched = 0;
  const nights = [];
  while (!S.over && S.night <= DAYS && steps < 60 * 60 * 60) {
    storyTurn(g);
    if (steps % 15 === 0) { dodge(g); if (!AUTO && !searchTick(g, 40)) heroTick(g, 'active'); }
    const n = S.night, ph = S.phase;
    g.step(); steps++;
    if (S.phase === 'night') minKeep = Math.min(minKeep, S.keep.hp / S.keep.maxHp);
    for (const e of S.events) { if (e.t === 'heroDie') heroDeaths++; if (e.t === 'search') searched++; }
    S.events.length = 0;
    if ((ph === 'night' && S.phase === 'day') || (S.over && ph === 'night')) {
      nights.push({ n, keep: +Math.max(0, minKeep).toFixed(2), march: (S.hordes.plan[n] ?? -1) >= 0, bld: S.buildings.length, pop: g.pop(), gold: S.gold, food: S.food, mobs: S.mobs.length });
      minKeep = 1;
    }
  }
  console.log(JSON.stringify({ seed: 100 + s, hero, diff, area, reached: S.night - 1, fell: !!S.over, kills: S.kills, lvl: S.lvl, heroDeaths, searched, nights, ms: Date.now() - t0 }));
}
