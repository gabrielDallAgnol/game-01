// Balance runs in the real (clock) mode: continuous stream, heat eruptions, power, hands.
// A competent player: builders on from day 1 (balanced), the hero defends the town, first blessing offered.
// usage: node tools/clockbot.mjs [difficulty] [days] [seeds] [hero]
import { createGame } from '../src/sim/game.js';
import { heroTick, chooseStory } from './bot.mjs';

const diff = process.argv[2] || 'survivor', DAYS = +(process.argv[3] || 14), SEEDS = +(process.argv[4] || 4), hero = process.argv[5] || 'warrior', AUTO = process.argv[6] === 'auto';
const biomes = ['riverbend', 'highland', 'lakeshore', 'vale'];
const out = [];
for (let s = 0; s < SEEDS; s++) {
  const t0 = Date.now();
  const g = createGame({ seed: 100 + s, mapSeed: 300 + s, biome: biomes[s % 4], hero, difficulty: diff });
  const S = g.state; S.builders = 'balanced'; if (AUTO) g.setAutopilot(true);
  let steps = 0, heatSum = 0, heatN = 0, peakHeat = 0, blackoutT = 0, minKeep = 1;
  const nightLog = [], feats = {}, classes = [];
  while (!S.over && S.night <= DAYS && steps < 60 * 60 * 60) {
    while (S.pendingPicks > 0 && S.offer.length) g.choosePerk(S.offer[0]);
    if (S.story.encounters.length) chooseStory(g);
    if (!AUTO && steps % 15 === 0) heroTick(g, 'active');
    const n = S.night, ph = S.phase;
    g.step(); steps++;
    if (steps % 60 === 0) { heatSum += S.heat; heatN++; peakHeat = Math.max(peakHeat, S.heat); if (S.blackout) blackoutT++; }
    if (S.phase === 'night') minKeep = Math.min(minKeep, S.keep.hp / S.keep.maxHp);
    if (ph === 'night' && S.phase === 'day') { nightLog.push({ n, keep: +minKeep.toFixed(2), bld: S.buildings.length, pop: g.pop(), mobs: S.mobs.length }); minKeep = 1; }
    for (const k of Object.keys(S.feat)) if (!(k in feats)) feats[k] = S.night;
    if (classes[classes.length - 2] !== S.heroClass) classes.push(S.heroClass, `@${S.night}`);
    S.events.length = 0;
  }
  const r = { seed: s, biome: biomes[s % 4], diff, hero, reached: S.over ? S.night : S.night, fell: S.over, avgHeat: Math.round(heatSum / Math.max(1, heatN)), peakHeat: Math.round(peakHeat), eruptions: S.stats.eruptions || 0, blackoutSec: blackoutT, buildings: S.buildings.length, keepLvl: S.keep.level, pop: g.pop(), kills: S.kills, lvl: S.lvl, feats: JSON.stringify(feats), cls: classes.join(' '), path: Object.entries(S.path).map(([k, v]) => k[0] + Math.round(v)).join(''), seasons: S.season.n, trial: S.story.trial ? `${S.story.trial.cls}:${S.story.trial.started ? 's' : ''}${S.story.trial.done ? 'd' : ''}@${S.story.trial.day}` : '-', offered: JSON.stringify(S.evo.offered), sec: Math.round((Date.now() - t0) / 1000), nights: nightLog.map(l => `${l.n}:${l.keep}`).join(' ') };
  out.push(r); console.log(JSON.stringify(r));
}
const fell = out.filter(r => r.fell);
console.log(`${diff}: ${fell.length}/${out.length} fell · reached ${out.map(r => r.reached).join(',')} · eruptions ${out.map(r => r.eruptions).join(',')} · avgHeat ${out.map(r => r.avgHeat).join(',')}`);
