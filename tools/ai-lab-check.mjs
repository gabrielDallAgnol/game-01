// Runs the game's own parsers on agent-written Chronicler answers and reports what would reach the player.
// usage: node tools/ai-lab-check.mjs run.json run.answers.json
import { readFileSync } from 'node:fs';
import { parseRewrite, parseInvent, parseRecap } from '../src/ui/story-ai.js';
import { QUEST_TEMPLATES } from '../src/content/story.js';
import { createGame } from '../src/sim/game.js';

const run = JSON.parse(readFileSync(process.argv[2], 'utf8')), ans = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const byI = new Map(ans.map(a => [a.i, a.answer]));
const words = s => String(s || '').split(/\s+/).filter(Boolean).length;
const stat = { rewrite: { n: 0, ok: 0, words: [], beats: [] }, invent: { n: 0, ok: 0, placed: 0, templates: {}, names: [] }, recap: { n: 0, ok: 0 } };
const g = createGame({ seed: 1, hero: 'survivor' }); g.state.story.encounters = []; g.state.picks = []; g.state.pendingPicks = 0;
run.items.forEach((it, i) => {
  const a = byI.get(i), S = stat[it.type]; S.n++;
  if (it.type === 'rewrite') { const p = parseRewrite(a, { choices: it.enc.choices, speaker: it.enc.speaker, title: it.enc.title }); if (p) { S.ok++; S.words.push(words(p.scene)); S.beats.push(p.beats.length); } }
  if (it.type === 'invent') { const q = parseInvent(a, QUEST_TEMPLATES); if (q) { S.ok++; S.templates[q.template] = (S.templates[q.template] || 0) + 1; if (q.character) S.names.push(q.character.name); g.state.night = it.day; g.state.story.inventDay = -1; if (g.story().invent(q)) S.placed++; } }
  if (it.type === 'recap') { if (parseRecap(a)) S.ok++; }
});
const avg = a => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-');
console.log(`rewrites ${stat.rewrite.ok}/${stat.rewrite.n} valid · avg ${avg(stat.rewrite.words)} words · max ${Math.max(0, ...stat.rewrite.words)} · avg beats ${avg(stat.rewrite.beats)}`);
console.log(`quests ${stat.invent.ok}/${stat.invent.n} valid · ${stat.invent.placed} placed · templates ${JSON.stringify(stat.invent.templates)} · names ${stat.invent.names.join(', ')}`);
console.log(`recap ${stat.recap.ok}/${stat.recap.n} valid`);
