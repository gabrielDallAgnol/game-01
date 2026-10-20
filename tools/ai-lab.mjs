// AI lab: plays a run with the bot and records the exact prompts the Chronicler would get (encounter rewrites,
// one invented side quest per dawn, a "previously on" recap). Agents answer them offline; tools/ai-lab-check.mjs
// then runs the game's own parsers on the answers.  usage: node tools/ai-lab.mjs <seed> <nights> <out.json>
import { writeFileSync } from 'node:fs';
import { createGame } from '../src/sim/game.js';
import { chooseStory } from './bot.mjs';
import { rewritePrompt, inventPrompt, recapPrompt, contractPrompt, obituaryPrompt } from '../src/ui/story-ai.js';
import { QUEST_TEMPLATES } from '../src/content/story.js';

const seed = +(process.argv[2] || 1), NIGHTS = +(process.argv[3] || 10), out = process.argv[4] || 'ai-lab.json';
const g = createGame({ seed: 500 + seed, mapSeed: 700 + seed, biome: ['riverbend', 'highland', 'lakeshore'][seed % 3], hero: 'survivor', difficulty: 'story' });
const S = g.state; g.setAutopilot(true);
const items = []; let lastDawn = 0, steps = 0;
const seen = new Set();
while (!S.over && S.night <= NIGHTS && steps < 60 * 60 * 40) {
  while (S.pendingPicks > 0 && S.offer.length) g.choosePerk(S.offer[0]);
  for (const e of S.story.encounters) if (!seen.has(e.id) && e.kind === 'contract') { seen.add(e.id); const ctx = g.story().fullContext(); items.push({ type: 'contract', day: S.night, offers: e.offers.map(o => ({ id: o.id })), hooks: ctx.hooks, prompt: contractPrompt(ctx, e) }); }
  for (const e of S.story.encounters) if (!seen.has(e.id) && !['gift', 'evolve', 'season', 'chapter', 'district', 'contract', 'arrival', 'skill', 'window', 'difficulty', 'victory'].includes(e.kind)) { seen.add(e.id); items.push({ type: 'rewrite', day: S.night, kind: e.kind, id: e.id, enc: { choices: e.choices.map(c => ({ id: c.id })), speaker: !!e.speaker, title: e.title }, prompt: rewritePrompt(e, g.story().context()) }); }
  if (S.story.encounters.length) chooseStory(g);
  if (S.phase === 'day' && S.night !== lastDawn && S.night >= 2) { lastDawn = S.night; items.push({ type: 'invent', day: S.night, prompt: inventPrompt(g.story().fullContext(), QUEST_TEMPLATES) }); }
  g.step(); steps++; S.events.length = 0;
}
items.push({ type: 'recap', day: S.night, prompt: recapPrompt(g.story().fullContext()) });
items.push({ type: 'obituary', day: S.night, prompt: obituaryPrompt(g.story().fullContext(), `the Camp fell on night ${S.night}`) });
writeFileSync(out, JSON.stringify({ seed, nights: S.night, over: S.over, chronicle: S.story.chronicle, items }, null, 1));
console.log(`${items.length} prompts (${items.filter(i => i.type === 'rewrite').length} rewrites, ${items.filter(i => i.type === 'invent').length} quests) over ${S.night} nights → ${out}`);
