// AI playtest harness: a Claude agent plays a real run, one decision point at a time, headless and fast.
// The game is deterministic, so every call replays the logged actions from the start, applies the new ones and
// runs on (hero on autopilot for the fighting) until the next decision: a new day, a story card or a blessing.
//
//   node tools/ai-play.mjs new <dir> [seed] [difficulty]      start a run, print the first decision
//   node tools/ai-play.mjs act <dir> '<json>'                 apply actions, run to the next decision, print it
//   node tools/ai-play.mjs show <dir>                         print the current decision again
//
// Actions (JSON object, any subset, applied in this order):
//   {"choose":"<choice id>"}            answer the story card on screen
//   {"perk":"<blessing id>"}            take a blessing on offer
//   {"keep":true}                       raise the town hall (if its needs are met)
//   {"build":{"house":2,"tower":1}}     build (the harness picks good spots, like the in-game Foreman)
//   {"upgrade":{"tower":2,"house":1}}   upgrade the lowest-level buildings of a type
//   {"walls":1}                         lay a barricade line across the main route in
//   {"hero":"defend"|"explore"}         hero stays home, or also walks to quests, beacons and the trial by day
//   {"wait":true}                       nothing; run on
//   {"note":"why you did this"}         saved in the journal with the decision
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { createGame, HEAT } from '../src/sim/game.js';
import { BUILDINGS, KEEP } from '../src/content/buildings.js';
import { PERKS, FAMILIES } from '../src/content/perks.js';
import { TIDE } from '../src/content/mobs.js';

const [cmd, dir, a1, a2] = process.argv.slice(2);
const file = `${dir}/run.json`;
const MAX_STEPS = 60 * 60 * 6;   // safety: at most ~6 game minutes between decisions

function make(run) {
  const g = createGame({ seed: run.seed, mapSeed: run.seed + 7, biome: run.biome, hero: 'survivor', difficulty: run.difficulty });
  g.setAutopilot(true); g.state.builders = 'off';   // the hero fights by itself; the agent decides what is built
  return g;
}
function apply(g, act, out) {
  const S = g.state, say = m => out && out.push(m);
  if (act.hero) S.autoStay = act.hero === 'defend';
  if (act.choose) say(g.choose(act.choose) ? `chose ${act.choose}` : `could not choose ${act.choose}`);
  if (act.perk) say(g.choosePerk(act.perk) ? `took blessing ${act.perk}` : `could not take ${act.perk}`);
  if (act.keep) say(g.upgradeKeep() ? `raised the town hall to ${g.keepLevel()}` : `town hall not raised (${g.keepNeeds().join(', ') || 'scrap or hands'})`);
  for (const [t, n] of Object.entries(act.build || {})) { let k = 0; for (; k < n; k++) if (!g.planner.place(t)) break; say(`built ${k}/${n} ${t}`); }
  for (const [t, n] of Object.entries(act.upgrade || {})) { let k = 0; for (; k < n; k++) if (!g.planner.upgradeOne(t)) break; say(`upgraded ${k}/${n} ${t}`); }
  for (let k = 0; k < (act.walls || 0); k++) say(g.planner.wallLine() ? 'laid a barricade line' : 'no barricade line laid');
}
// run until something needs a decision
function runOn(g, sinceStep) {
  const S = g.state; let steps = 0; const start = { night: S.night, phase: S.phase };
  const msgs = [];
  while (!S.over && steps < MAX_STEPS) {
    if (S.phase === 'day' && (S.story.encounters.length || (S.pendingPicks > 0 && S.offer.length))) break;
    if (S.phase === 'day' && steps > 0 && S.night !== start.night && S.dayT > 0.5) break;   // a new day
    g.step(); steps++;
    for (const e of S.events) if (e.t === 'toast' && /\[|bad/.test(`${e.msg}${e.kind}`)) msgs.push(e.msg.replace(/\*\*/g, ''));
    S.events.length = 0;
  }
  return { steps, msgs: msgs.slice(-8) };
}
function replay(run) {
  const g = make(run); let msgs = [];
  for (const d of run.log) { const r = runOn(g); msgs = r.msgs; apply(g, d.act, null); }
  return { g, msgs };
}
const pct = (a, b) => `${Math.round(a / Math.max(1, b) * 100)}%`;
function summary(g, extra = []) {
  const S = g.state, ST = S.story, L = S.log[S.log.length - 1];
  const count = {}; for (const b of S.buildings) { const k = `${b.type}${b.level}`; count[k] = (count[k] || 0) + 1; }
  const fc = g.forecast(), dead = fc.reduce((a, r) => a + r.count, 0);
  const lines = [];
  lines.push(`=== Day ${S.night} · ${S.over ? 'THE KEEP FELL' : S.phase} · ${g.map.name} · ${S.difficulty} · season ${S.season.n} ${S.season.name}${ST.episode ? ` · episode "${ST.episode.title}"` : ''}`);
  if (L && L.night === S.night - 1) lines.push(`Last night (${L.night}): keep ended at ${pct(L.keepEnd, L.keepMax)}, lost ${L.lost.length} buildings${L.risen ? `, ${L.risen} rose` : ''}; kills hero ${L.kills.hero || 0} towers ${L.kills.tower || 0} keep ${L.kills.keep || 0}; dawn income +${L.goldIn ?? '?'} scrap, +${L.foodIn ?? '?'} food`);
  lines.push(`Scrap ${S.gold} (+${g.goldPerDawn()}/dawn) · Food ${S.food} (+${g.foodPerDawn()} −${g.foodNeed()}) · People ${g.pop()} (${g.crewing().free} free for towers) · Hands ${g.handsFree()}/${g.handsMax()} today${S.feat.power ? ` · Power ${g.powerIn()}/${g.powerOut()}${S.blackout ? ' BLACKOUT' : ''}` : ''}${S.feat.heat ? ` · Heat ${Math.round(S.heat)} (drift ${HEAT.stir}, burst ${HEAT.erupt})` : ''}`);
  lines.push(`Town hall ${g.keepLevel()} (${Math.ceil(S.keep.hp)}/${S.keep.maxHp})${g.keepLevel() < 3 ? ` · next: ${KEEP.cost[g.keepLevel()]} scrap${g.keepNeeds().length ? ` + needs ${g.keepNeeds().join(', ')}` : ' (needs met)'}` : ''} · Buildings ${JSON.stringify(count)}`);
  lines.push(`Prices now: ${['house', 'farm', 'tower', 'wall'].concat(S.feat.power ? ['generator'] : []).map(t => `${t} ${g.buyCost(t)}`).join(', ')} · upgrades: ${['house', 'farm', 'tower'].map(t => { const b = S.buildings.filter(x => x.type === t && x.level < g.keepLevel()).sort((p, q) => p.level - q.level)[0]; return b ? `${t}→${b.level + 1} ${g.upCostOf(b)}` : null; }).filter(Boolean).join(', ') || 'none (raise the town hall)'}`);
  lines.push(`Tonight: ~${dead} dead from ${fc.length} ${fc.length === 1 ? 'hive' : 'hives'} · rating ${g.ratingOf(g.threatRatio())}${g.isBloodMoon(S.night) ? ' · BLOOD MOON' : ''} · tower dps ${g.defenceDps().toFixed(1)} · hero dps ${g.heroDps().toFixed(1)} · loose dead now ${S.mobs.filter(m => !m.roam).length}, roaming outside ${S.mobs.filter(m => m.roam).length}`);
  lines.push(`Hero: ${g.heroDef.name} level ${S.lvl} (${S.xp}/${g.xpNext()} xp) · hp ${Math.ceil(S.hero.hp)}/${S.hero.maxHp} · path ${ST && g.story().pathText ? g.story().pathText() : ''} · mode ${S.autoStay ? 'defend' : 'explore'}${ST.trial && !ST.trial.done ? ` · TRIAL waiting: ${ST.trial.name}` : ''}`);
  const comp = ST.npcs.filter(n => n.joined && n.alive).map(n => n.name); if (comp.length) lines.push(`Companions: ${comp.join(', ')}`);
  if (ST.quests.length || ST.spots.length) lines.push(`Out in the city: ${ST.quests.length} quest(s), ${ST.spots.length} beacon(s) (the hero visits them in explore mode)`);
  if (extra.length) lines.push(`Since last decision: ${extra.join(' | ')}`);
  const e = ST.encounters[0];
  if (S.phase === 'day' && e) {
    lines.push(`\nSTORY CARD [${e.kind}] ${e.eyebrow || ''} ${e.title}\n  ${String(e.scene).replace(/\*\*/g, '').replace(/\s+/g, ' ').slice(0, 420)}`);
    for (const c of e.choices) lines.push(`  - choose "${c.id}": ${c.label} — ${c.hint || ''}${c.cost ? ` (costs ${JSON.stringify(c.cost)})` : ''}${g.story().can(c) ? '' : ' [CANNOT AFFORD]'}`);
  } else if (S.phase === 'day' && S.pendingPicks > 0 && S.offer.length) {
    lines.push(`\nBLESSING (${S.offerSource}) pick one:`);
    for (const id of S.offer) { const p = PERKS.find(q => q.id === id); lines.push(p ? `  - perk "${id}": ${p.name} [${FAMILIES[p.fam].name}, ${p.rarity}] ${p.desc}` : `  - perk "${id}"`); }
  } else if (!S.over) lines.push(`\nA NEW DAY. Plan it: build / upgrade / keep / walls / hero. Dusk falls by itself after ${TIDE.dayLen}s of day.`);
  return lines.join('\n');
}

if (cmd === 'new') {
  mkdirSync(dir, { recursive: true });
  const run = { seed: +(a1 || 1), difficulty: a2 || 'survivor', biome: ['riverbend', 'highland', 'lakeshore', 'vale'][(+(a1 || 1)) % 4], log: [] };
  writeFileSync(file, JSON.stringify(run));
  const { g } = replay(run); const r = runOn(g); console.log(summary(g, r.msgs));
} else if (cmd === 'act' || cmd === 'show') {
  const run = JSON.parse(readFileSync(file, 'utf8'));
  const { g } = replay(run); runOn(g);
  if (cmd === 'show') { console.log(summary(g)); process.exit(0); }
  const act = JSON.parse(a1 || '{}'), out = [];
  const S = g.state, before = { day: S.night, card: S.story.encounters[0] && S.story.encounters[0].title };
  apply(g, act, out);
  run.log.push({ day: before.day, card: before.card || null, act }); writeFileSync(file, JSON.stringify(run));
  appendFileSync(`${dir}/journal.md`, `- day ${before.day}${before.card ? ` · card "${before.card}"` : ''}: ${JSON.stringify(Object.fromEntries(Object.entries(act).filter(([k]) => k !== 'note')))}${act.note ? ` — ${act.note}` : ''}\n`);
  const r = runOn(g);
  console.log(out.length ? `Done: ${out.join('; ')}\n` : '');
  console.log(summary(g, r.msgs));
} else { console.log('usage: node tools/ai-play.mjs new|act|show <dir> ...'); }
