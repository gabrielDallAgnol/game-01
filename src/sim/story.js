// The story engine: decides which encounter comes next and applies every effect. Deterministic (own RNG).
// Claude may rewrite an encounter's words (see ui/story-ai.js), never its choices' effects.
//
// S.story = { day, encounters (the cards on screen now), later (cards waiting for a dawn), threads {id: {stage, status,
//   cast, region, site, spot, failAt}}, npcs [], titles [], chronicle [], flags {}, quests [], daily {}, contract {}, … }
//
// The dawn budget: at most ONE story card and ONE System window a dawn. Everything else waits in `later` for a
// later dawn (cards that only make sense today expire). Nothing opens at night unless it is about the night.
import { GIFT, TITLES, DISTRICT_CALL, SITES, THREADS, ROLES, SYSTEM, AMBIENT, TIPS, STREET, STREET_GEN, QUEST_TEMPLATES, DAILY, DAILY_TEXT, NUMBER, NIGHT_TEXT } from '../content/story.js';
import { RARITY, KITS } from '../content/districts.js';
import { EPISODES, seasonEnd } from '../content/season.js';
import { TIDE } from '../content/mobs.js';
import { PERKS, MASTERIES } from '../content/perks.js';
import { createContracts } from './contracts.js';
import { CLASS_TIERS, CLASS_INFO, CALLINGS } from '../content/heroes.js';

export const DAY_ONE = 40;   // seconds: day 1 is short (TIDE.dayLen stays the rule for every other day: the story gives day 1 a head start)
// which slot each kind of card takes in the dawn budget
export const SLOT = { thread: 'story', ambient: 'story', district: 'story', street: 'story', site: 'story', chapter: 'sys', season: 'sys', contract: 'sys', evolve: 'sys', skill: 'sys', window: 'sys', difficulty: 'sys', victory: 'sys', gift: 'sys', arrival: 'sys' };
// what may open at night: only what is about the night
const NIGHT_OK = new Set(['arrival']);
const DIFF_OFFER = [
  { id: 'keep', label: 'Keep it as it is', hint: 'Fair but hard. The way it is meant to be played.' },
  { id: 'story', label: 'Gentler', hint: 'Fewer dead, richer homes. For the story.' },
  { id: 'veteran', label: 'Harder', hint: 'More dead, thinner supplies. Mistakes cost buildings.' },
];
const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

export function createStory(ctx) {
  const { S, map, rng, toast, ev } = ctx;
  const ST = S.story = { spots: [], day: 1, encounters: [], later: [], threads: {}, npcs: [], titles: [], chronicle: [], flags: {}, quests: [], power: 0, hands: 0, visited: {}, nextId: 1, lastOpen: 0, rules: [], n1: {} };
  const LM = ctx.LANDMARKS;
  const api = () => (ctx.api ? ctx.api() : null);
  const noiseOn = () => S.noise !== undefined || !!S.feat.heat;

  // ---------- chronicle: everything that matters, in one line each (feeds the AI and the end screen) ----------
  function chron(text, imp = 2, tags = []) { ST.chronicle.push({ day: S.night, text, imp, tags }); if (ST.chronicle.length > 80) ST.chronicle.splice(0, ST.chronicle.length - 80); }

  // ---------- npcs ----------
  const npcByRole = role => ST.npcs.find(n => n.role === role && n.alive);
  const npc = id => ST.npcs.find(n => n.id === id);
  function castFor(threadId, role) {
    const T = THREADS[threadId], c = T.cast[role], th = ST.threads[threadId];
    if (th.cast[role]) return npc(th.cast[role]);
    const id = `n${ST.nextId++}`;
    const n = { id, role: c.role || role, name: c.names[rng.int(c.names.length)], epithet: c.epithet, persona: { ...c.persona }, secret: c.secret, bond: 1, alive: true, joined: false, named: false, thread: threadId, chatToday: 0, memory: [] };
    ST.npcs.push(n); th.cast[role] = id; return n;
  }
  const fill = (s, th) => { if (!s) return s; const n = th && Object.values(th.cast).map(npc).find(Boolean); return s.replace(/\{name\}/g, n ? n.name.split(' ')[0] : 'they'); };

  // ---------- titles: flavour only, announced in the System strip ----------
  function grant(id) {
    if (ST.titles.includes(id) || !TITLES[id]) return;
    const T = TITLES[id]; ST.titles.push(id);
    toast(`[Title acquired: ${T.name}] ${T.desc}`, 'sys'); ev('title', { id, name: T.name }); chron(`Earned the title ${T.name}.`, 3, ['title']);
  }
  /** deeds the System notices on its own */
  function deeds() {
    if (S.night >= 2) grant('firstLight');
    if (S.kills >= 150) grant('gravedigger');
    if (S.stats.regionsClaimed > 0) grant('hivebreaker');
    if ((S.stats.districts || 0) >= 3) grant('pathfinder');
    if ((S.stats.eruptions || 0) > 0) grant('loud');
  }

  // ---------- effects: the only things a choice can do ----------
  function apply(f, enc) {
    const th = enc && enc.thread ? ST.threads[enc.thread] : null;
    switch (f.op) {
      case 'gold': ctx.earn(f.n); break;
      case 'food': S.food = Math.max(0, S.food + (f.n > 0 && hasRule('hunger') ? f.n * 2 : f.n)); break;
      case 'survivors': S.survivors = Math.max(0, S.survivors + f.n); break;
      case 'xp': if (ctx.gainXp) ctx.gainXp(f.n); break;
      case 'lean': if (ctx.addPath) ctx.addPath(f.fam, f.n); break;
      case 'trial': startTrial(f, enc); break;
      case 'recruitNew': { const d = enc && enc.npc; if (!d) break; const n = { id: `n${ST.nextId++}`, role: d.role, name: d.name, epithet: d.epithet, persona: { traits: d.traits, quirk: d.quirk, want: d.want, fear: d.fear }, secret: d.secret, bond: 1, alive: true, joined: true, named: false, thread: null, chatToday: 0, memory: [], made: 'chronicler' };
        ST.npcs.push(n); toast(`[${n.name} joined] ${ROLES[n.role].post}: ${ROLES[n.role].bonus}.`, 'sys'); chron(`${n.name}, ${n.epithet}, joined the Camp as its ${ROLES[n.role].post.toLowerCase()}.`, 4, [n.id]); ev('recruit', { id: n.id }); break; }
      case 'heat': if (ctx.addHeat) ctx.addHeat(f.n); break;
      case 'power': ST.power += f.n; break;
      case 'hands': ST.hands += f.n; break;
      case 'handsToday': S.handsUsed -= f.n; break;
      case 'perk': if (f.mul) S.P[f.key] *= f.mul; else S.P[f.key] += f.add; ctx.refreshMax(); break;
      case 'flag': if (f.key === 'garden') ST.garden = (ST.garden || 0) + 1; else if (f.key === 'beacon') ST.beacon = (ST.beacon || 0) + 1; else ST.flags[f.key] = true; break;
      case 'title': grant(f.id); break;
      case 'blessing': S.picks.push('chest'); ctx.syncPicks(); break;
      case 'skill': takeSkill(enc); break;
      case 'difficulty': setDifficulty(f.key); break;
      case 'contract': contracts.sign(enc, f.id); break;
      case 'reward': contracts.pay(); break;
      case 'openFor': { if (!th) break; const p = placeFor(f.kit, enc.thread); if (!p) { enc.noRegion = true; break; } pointThread(enc.thread, p); break; }
      case 'open': ctx.openDistrict(f.region, f.why); ST.lastOpen = S.night; { const l = ctx.siteOf(f.region); if (l && !l.owned) addQuest(l, null); } break;
      case 'recruit': { const n = castFor(enc.thread, f.role); n.joined = true; toast(`[${n.name} joined] ${ROLES[n.role].post}: ${ROLES[n.role].bonus}.`, 'sys'); chron(`${n.name} joined the Camp as its ${ROLES[n.role].post.toLowerCase()}.`, 4, [n.id]); ev('recruit', { id: n.id }); break; }
      case 'lose': { const n = th && npc(th.cast[f.role]); if (n) { n.alive = false; n.joined = false; n.withHero = false; n.lost = S.night; chron(`${n.name} left the Camp.`, 4, [n.id]); } break; }
      case 'bond': { const n = th && npc(th.cast[f.role]); if (n) n.bond = Math.max(-3, Math.min(5, n.bond + f.n)); break; }
      case 'name': { const n = th && npc(th.cast[f.role]); if (n) { n.named = true; n.name = ctx.reviveName ? ctx.reviveName() : n.name; S.drained = S.night; toast('[Named] It is stronger now. You are weaker tonight.', 'sys'); chron(`Named one of the dead: ${n.name}.`, 5, [n.id]); } break; }
      case 'claimHere': { const l = th && th.site !== undefined ? S.landmarks[th.site] : th && th.region !== undefined && ctx.siteOf(th.region); if (l && !l.owned) ctx.claimFree(l.id); else ctx.earn(8); break; }
      case 'risen': ctx.risen(f.n); break;
      case 'gamble': if (rng.next() >= f.p) { for (const b of f.bad) apply(b, enc); } else if (f.good) { for (const b of f.good) apply(b, enc); } else toast('The fever broke at dawn. He lives.', 'good'); break;
      case 'hurt': ctx.hurtHero(f.n); break;
      case 'unique': S.unique = { name: f.name, mult: f.mult, night: f.later ? nextMoon(S.night + 1) : nextMoon(S.night), thread: enc && enc.thread }; contracts.armFinale(); break;
      case 'evolve': if (S.heroClass === f.from) { ctx.evolve(f.cls); chron(`Became a ${ctx.heroes[f.cls].name}.`, 5, ['hero']); ST.encounters = ST.encounters.filter(e => e === enc || e.kind !== 'evolve' || e.from === S.heroClass); ST.later = ST.later.filter(x => x.enc.kind !== 'evolve' || x.enc.from === S.heroClass); if (ST.evoLater && ST.evoLater.from !== S.heroClass) ST.evoLater = null; ev('classUp', { cls: f.cls, tier: f.tier || 1, name: ctx.heroes[f.cls].name }); } break;
      case 'evolveLater': ST.evoLater = { from: f.from, enc: { ...enc, id: undefined, ai: null } }; break;
      case 'advance': if (th) { if (enc && enc.noRegion) endThread(enc.thread, 'no way through'); else { th.stage++; th.since = S.night; } } break;
      case 'resolve': if (th) { th.status = 'done'; } break;
      case 'fail': if (th) { if (f.after) { th.status = 'waiting'; th.failAt = S.night + f.after; } else { th.status = 'failed'; th.closed = S.night; } } break;
    }
  }
  const hasRule = id => { const a = api(); return a && a.rule ? a.rule(id) : !!(S.season && (S.season.rules || []).includes(id)); };
  const nextMoon = n => { let k = n; while (k % 5) k++; return k; };

  // ---------- where a thread happens: reuse a site that is already open, else open one, else mark the place ----------
  // (the frontier map has the substation and the school in open districts: opening a new district for them made a
  // second copy, or found none and the quest died without a word)
  function placeFor(kit, tid) {
    const lm = (KITS[kit] && KITS[kit].lm) || kit, c = map.town.x;
    const taken = id => Object.entries(ST.threads).some(([t, x]) => t !== tid && x.status === 'open' && x.site === id);
    const open = S.landmarks.filter(l => l.kind === lm && !l.owned && !l.stripped && !S.sealed[l.region] && !taken(l.id))
      .sort((a, b) => Math.hypot(a.x - c, a.y - c) - Math.hypot(b.x - c, b.y - c));
    if (open.length) return { site: open[0].id };
    const r = districtFor(kit, lm);
    if (r !== null) return { region: r };
    const spot = ctx.findSpot();
    return spot ? { spot } : null;
  }
  function districtFor(kit, lm) {
    const front = ctx.frontier();
    const ok = r => { const l = ctx.siteOf(r); return l && !l.owned && !l.stripped; };   // a quest needs a building to walk into
    const have = Object.keys(S.kits).map(Number).find(r => S.kits[r] === kit && S.sealed[r] && front.includes(r) && ok(r));
    if (have !== undefined) return have;
    if (S.landmarks.some(l => l.kind === lm)) return null;   // one of its kind exists already: never make a second
    let pool = front.filter(r => ok(r) && !S.kits[r]);
    if (!pool.length) return null;
    const near = Math.min(...pool.map(r => map.regions[r].ring)); pool = pool.filter(r => map.regions[r].ring === near);
    const r = pool[rng.int(pool.length)]; S.kits[r] = kit; return r;
  }
  function pointThread(tid, p) {
    const th = ST.threads[tid]; if (!th) return;
    if (p.site !== undefined) { const l = S.landmarks[p.site]; th.site = l.id; th.region = l.region; ST.visited[l.id] = false; addQuest(l, tid); return; }
    if (p.region !== undefined) {
      if (S.sealed[p.region]) ctx.openDistrict(p.region, `${THREADS[tid].title}.`);
      const l = ctx.siteOf(p.region); th.region = p.region; if (l) { th.site = l.id; ST.visited[l.id] = false; addQuest(l, tid); }
      return;
    }
    const sp = { id: ST.nextId++, kind: `thread:${tid}`, thread: tid, x: p.spot.x, y: p.spot.y, day: S.night };
    ST.spots.push(sp); th.spot = sp.id; ctx.guard(sp.x, sp.y, Math.min(4, 2 + Math.floor(S.night / 5)));
  }
  function addQuest(l, thread) { if (!ST.quests.some(q => q.site === l.id)) ST.quests.push({ site: l.id, thread, x: l.x, y: l.y }); }
  /** a thread that ends badly closes with a card, never in silence */
  function endThread(tid, why) {
    const th = ST.threads[tid], T = THREADS[tid]; if (!th || th.status === 'failed' || th.status === 'done') return;
    th.status = 'failed'; th.closed = S.night;
    ST.quests = ST.quests.filter(q => q.thread !== tid); ST.spots = ST.spots.filter(sp => sp.thread !== tid);
    chron(`${T.title} ended: ${why}.`, 3, [tid]);
    const F = T.failed || { eyebrow: '[Quest failed]', title: T.title, scene: 'Too late. The trail goes cold.', label: 'Let it go' };
    offer({ kind: 'thread', thread: tid, ended: true, eyebrow: F.eyebrow, title: fill(F.title, th), scene: fill(F.scene, th), choices: [{ id: 'ok', label: F.label, hint: 'The story ends here.', fx: [] }] }, 9, 9);
  }

  // ---------- encounters ----------
  const can = c => { const k = costOf(c); return S.gold >= (k.gold || 0) && S.food >= (k.food || 0); };
  function costOf(c) {
    if (!c.cost) return {};
    const clinic = S.landmarks.some(l => l.owned && l.kind === 'clinic');
    if (c.clinicFree && clinic) return {};
    if (c.clinicHalf && clinic) return { gold: Math.ceil((c.cost.gold || 0) / 2), food: Math.ceil((c.cost.food || 0) / 2) };
    return c.cost;
  }
  // before the noise meter is shown, choices do not talk about it
  const stripHeat = h => { if (!h || !/heat|noise/i.test(h)) return h; const t = h.replace(/\s*The radio burst is loud:?/i, '').replace(/[,;]?\s*\(?[+-]\d+ (heat|noise)( now)?\)?/gi, '').replace(/\b(Heat|Noise) -\d+( now)?(\s+and\s+)?/g, '').replace(/,?\s*and\s*\.$/, '.').replace(/\s+([.,:])/g, '$1').replace(/([.:])\s*\./g, '$1').replace(/:\s*$/, '.').trim(); return t && t.length > 2 ? t[0].toUpperCase() + t.slice(1) : 'It costs nothing you can see.'; };
  function push(enc) {
    if (S.phase === 'night' && !NIGHT_OK.has(enc.kind) && !S.over) { offer(enc, 5, 3); return; }
    enc.id = ST.nextId++; enc.ai = enc.ai || null; enc.slot = enc.slot || SLOT[enc.kind] || 'story';
    if (!noiseOn()) for (const c of enc.choices || []) c.hint = stripHeat(c.hint);
    ST.encounters.push(enc); ev('encounter', { id: enc.id, kind: enc.kind });
  }
  /** a card for a later dawn: priority decides which one shows when two want the same slot; ttl = dawns it may wait */
  function offer(enc, pri = 5, ttl = 3) {
    enc.slot = enc.slot || SLOT[enc.kind] || 'story';
    ST.later.push({ enc, pri, until: S.night + ttl, seq: ST.nextId++ });
  }
  const queued = pred => ST.encounters.some(pred) || ST.later.some(x => pred(x.enc));

  // ---------- the quest gate: one quest at a time on days 1-5, two after; the next one shows when one is done ----------
  // Counted: the trial, a thread pointing at a place (or a story card about to), a blue beacon, today's daily quest.
  // Not counted: a site you opened yourself (shown only when there is room) and the season's contract (on the strip).
  const questCap = () => (S.night <= 5 ? 1 : 2);
  const pointsOut = e => e && e.kind === 'thread' && !e.ended && (e.choices || []).some(c => (c.fx || []).some(f => f.op === 'openFor'));
  const threadAtSite = tid => { const th = ST.threads[tid], st = th && THREADS[tid] && THREADS[tid].stages[th.stage]; return !!(th && th.status === 'open' && st && st.at === 'site'); };
  function activeQuests() {
    const out = [];
    const tr = ST.trial; if (tr && !tr.done) out.push({ kind: 'trial', x: tr.x, y: tr.y, label: 'Trial', key: 'trial' });
    for (const q of ST.quests) if (q.thread && threadAtSite(q.thread)) out.push({ kind: 'thread', x: q.x, y: q.y, site: q.site, label: 'Quest', key: `q${q.site}` });
    for (const sp of ST.spots) out.push({ kind: sp.thread ? 'thread' : 'beacon', x: sp.x, y: sp.y, spot: sp.id, label: sp.thread ? 'Quest' : '!', key: `s${sp.id}` });
    if (queued(pointsOut)) out.push({ kind: 'pending', key: 'pending' });
    const d = ST.daily; if (d && d.day === S.night && !d.done) out.push({ kind: 'daily', key: 'daily' });
    return out;
  }
  const roomForQuest = () => activeQuests().length < questCap();
  /** what the map and the edge arrows show: the counted quests (up to the cap), then sites you opened if there is room */
  function shownQuests() {
    const out = activeQuests().filter(q => q.x !== undefined).slice(0, Math.max(questCap(), 1));
    const room = questCap() - activeQuests().length;
    if (room > 0) for (const q of ST.quests.filter(q => !q.thread).slice(0, room)) out.push({ kind: 'site', x: q.x, y: q.y, site: q.site, label: 'Site', key: `q${q.site}` });
    return out;
  }
  /** markers whose story moved on (the thread is past its site stage) stop being quests */
  function tidyQuests() { ST.quests = ST.quests.filter(q => !q.thread || threadAtSite(q.thread)); }
  /** at dawn: one story card and one System window, by priority; the rest keep waiting (or expire) */
  function release() {
    ST.later = ST.later.filter(x => x.until >= S.night);
    for (const slot of ['story', 'sys']) {
      if ((slot === 'story' ? ST.dawnStory : ST.dawnSys) === S.night) continue;
      if (ST.encounters.some(e => e.slot === slot && e.dawn === S.night)) continue;
      const pool = ST.later.filter(x => x.enc.slot === slot).sort((a, b) => b.pri - a.pri || a.seq - b.seq);
      const pick = pool[0]; if (!pick) continue;
      ST.later.splice(ST.later.indexOf(pick), 1); pick.enc.dawn = S.night;
      if (slot === 'story') ST.dawnStory = S.night; else ST.dawnSys = S.night;
      push(pick.enc);
    }
    ST.encounters.sort((a, b) => (a.slot === 'story' ? 0 : 1) - (b.slot === 'story' ? 0 : 1));
  }
  /** tests and bots: everything waiting, now */
  function flush() { const all = ST.later.sort((a, b) => b.pri - a.pri || a.seq - b.seq); ST.later = []; for (const x of all) { x.enc.dawn = S.night; push(x.enc); } }

  function threadEncounter(tid, stage) {
    const T = THREADS[tid], st = T.stages[stage], th = ST.threads[tid];
    for (const role of Object.keys(T.cast)) castFor(tid, role);
    const speaker = st.speaker ? npc(th.cast[st.speaker]) : null;
    return { kind: 'thread', thread: tid, stage, eyebrow: fill(st.eyebrow, th), title: fill(st.title, th), scene: fill(st.scene, th), speaker: speaker ? { id: speaker.id, name: speaker.name, line: fill(st.line, th) } : null,
      choices: st.choices.map(c => { const rc = c.fx.find(f => f.op === 'recruit'), who = rc && th.cast[rc.role] && npc(th.cast[rc.role]); return { id: c.id, label: fill(c.label, th), hint: fill(c.hint, th), cost: costOf(c), fx: c.fx, lean: c.lean, npcName: who ? `${who.name.split(' ')[0]} joins` : undefined }; }) };
  }
  function districtEncounter() {
    const front = ctx.frontier().filter(r => S.kits[r] !== 'signature' || S.night >= 6); if (!front.length) return null;
    const extra = ST.flags.scout ? 1 : 0; ST.flags.scout = false;
    const offers = rng.shuffle(front.map(r => ctx.districtOffer(r))).sort((a, b) => a.ring - b.ring).slice(0, Math.min(3 + extra, front.length));
    const price = o => (o.ring >= 2 ? { gold: 8 + S.night / 2 | 0, food: 4 } : { gold: 5 });
    return { kind: 'district', eyebrow: DISTRICT_CALL.eyebrow, title: DISTRICT_CALL.title, scene: DISTRICT_CALL.scene, offers,
      choices: offers.map(o => ({ id: `d${o.region}`, label: o.name, rarity: o.rarity, cost: price(o), hint: `${o.call}${o.lm && LM[o.lm] ? ` Inside: ${LM[o.lm].name} (${LM[o.lm].desc.split(':')[0].toLowerCase()}).` : ''} · ${o.dir}${o.ring >= 2 ? ' · far: a big district' : ''}${o.nest ? ' · a hive nests there' : ''}`, fx: [{ op: 'open', region: o.region, why: '' }] })).concat([{ ...DISTRICT_CALL.later }]) };
  }
  function siteEncounter(l) {
    const T = SITES[l.kind] || SITES.default, D = SITES.default, L = LM[l.kind], strip = 6 + 2 * (L.cost || 6);
    return { kind: 'site', site: l.id, eyebrow: `[${L.name}]`, title: L.name, scene: T.scene || D.scene,
      choices: [
        { id: 'claim', label: T.claim || D.claim, hint: `${L.desc}${L.cost ? ` Costs ${L.cost} scrap.` : ''}`, cost: { gold: L.cost || 0 }, fx: [{ op: 'claimSite', site: l.id }] },
        { id: 'strip', label: T.strip || D.strip, hint: `+${strip} scrap now. The building is gone for good.`, fx: [{ op: 'stripSite', site: l.id, n: strip }] },
        { id: 'leave', label: D.leave, hint: 'Come back any time. Tap it to claim it later.', fx: [] },
      ] };
  }

  /** the player picks a choice of the current encounter */
  function choose(choiceId) {
    const enc = ST.encounters[0]; if (!enc) return false;
    const c = enc.choices.find(x => x.id === choiceId); if (!c) return false;
    if (c.cost && !can(c)) { toast('You cannot afford that.', 'bad'); return false; }
    if (c.cost) { S.gold -= c.cost.gold || 0; S.food -= c.cost.food || 0; }
    for (const f of c.fx) {
      if (f.op === 'claimSite') { ctx.claimFree(f.site); continue; }
      if (f.op === 'stripSite') { const l = S.landmarks[f.site]; ctx.earn(f.n); l.stripped = true; ST.quests = ST.quests.filter(q => q.site !== l.id); chron(`Stripped the ${LM[l.kind].name} for parts.`, 2); continue; }
      apply(f, enc);
    }
    const sysKind = ['district', 'chapter', 'season', 'evolve', 'system', 'contract', 'skill', 'window', 'difficulty', 'victory', 'arrival', 'gift'].includes(enc.kind);
    const ln = sysKind && !(enc.kind === 'district' && choiceId === 'later') ? null : leanOf(c);
    if (ln && ctx.addPath) ctx.addPath(ln, enc.kind === 'thread' ? 1.5 : 1);
    if (enc.kind === 'district' && choiceId !== 'later' && ctx.addPath) ctx.addPath('ranger', 0.4);
    if (enc.kind === 'site') { ST.quests = ST.quests.filter(q => q.site !== enc.site || choiceId === 'leave'); if (choiceId === 'leave') ST.visited[enc.site] = S.night; }
    if (enc.kind === 'street') ST.streetDone = (ST.streetDone || 0) + 1;
    if (ctx.gainXp && !sysKind) ctx.gainXp(enc.kind === 'thread' ? 25 : enc.kind === 'street' ? 12 : enc.kind === 'site' ? 0 : 5);
    if (!['skill', 'window', 'difficulty'].includes(enc.kind) && !enc.ended) {
      const line = enc.aiChron || `${enc.title}: "${String(c.label || '').replace(/[[\]]/g, '')}"`;
      chron(line, enc.kind === 'thread' ? 4 : enc.kind === 'contract' ? 0 : 2, enc.thread ? [enc.thread] : []);
      if (enc.kind === 'contract') ST.chronicle.pop();
    }
    ST.encounters.shift(); ev('chosen', { enc: enc.id, choice: choiceId, kind: enc.kind });
    return true;
  }

  // what a decision says about you: Heart saves people, Brawn meets things head on, Aim scouts and keeps quiet, Wits deals
  function leanOf(c) {
    if (c.lean) return c.lean;
    const sc = { hero: 0, ranger: 0, scavver: 0, heart: 0 };
    for (const f of c.fx || []) {
      if ((f.op === 'survivors' && f.n > 0) || f.op === 'recruit' || (f.op === 'bond' && f.n > 0) || (f.op === 'flag' && (f.key === 'beacon' || f.key === 'garden'))) sc.heart += 1;
      if (f.op === 'food' && f.n < 0) sc.heart += 0.5;
      if ((f.op === 'gold' && f.n > 0) || f.op === 'stripSite' || f.op === 'claimSite') sc.scavver += 1;
      if (f.op === 'food' && f.n > 0 && c.cost && c.cost.gold) sc.scavver += 1;
      if (f.op === 'hurt' || (f.op === 'perk' && /hero(Dmg|Hp)|keepHp/.test(f.key)) || (f.op === 'heat' && f.n > 0) || f.op === 'unique' || f.op === 'lose' || (f.op === 'bond' && f.n < 0)) sc.hero += f.op === 'lose' || f.op === 'bond' ? 0.5 : 1;
      if ((f.op === 'heat' && f.n < 0) || (f.op === 'flag' && ['scout', 'hiveTip', 'quiet'].includes(f.key)) || f.op === 'hands' || f.op === 'openFor' || (f.op === 'perk' && f.key === 'heroSpeed')) sc.ranger += 1;
    }
    if (c.cost && c.cost.food) sc.heart += 0.5;
    const best = Object.keys(sc).sort((a, b) => sc[b] - sc[a])[0];
    return sc[best] >= 1 ? best : null;
  }

  // ---------- the trial: a class is earned out in the woods, not picked from a menu ----------
  const FAMN = { hero: 'Brawn', ranger: 'Aim', scavver: 'Wits', heart: 'Heart' };
  function pathText() { const P = S.path, tot = Object.values(P).reduce((a, b) => a + b, 0) || 1; return Object.keys(P).sort((a, b) => P[b] - P[a]).filter(k => P[k] > 0).map(k => `${FAMN[k]} ${Math.round(P[k] / tot * 100)}%`).join(', ') || 'unwritten'; }
  /** the job change: tier 1 the Calling, 2 the advanced class, 3 the legendary form; each option is a trial (a named boss) */
  const famOfCls = cls => { const H = ctx.heroes[cls]; const c = (H && H.calling) || (H && H.base) || cls; return Object.keys(CALLINGS).find(f => CALLINGS[f] === c) || null; };
  function offerTrial(opts, from) {
    const tier = opts[0].legend ? 3 : opts[0].second ? 2 : 1, T = CLASS_TIERS[tier - 1];
    const P = S.path, tot = Object.values(P).reduce((a, b) => a + b, 0) || 1, pct = f => Math.round(((P[f] || 0) / tot) * 100);
    const lead = Object.keys(P).sort((a, b) => P[b] - P[a])[0];
    const jobs = opts.map(o => { const H = ctx.heroes[o.cls], I = CLASS_INFO[o.cls] || {}, fam = tier === 2 ? famOfCls(o.second) : famOfCls(o.cls);
      return { cls: o.cls, name: H.name, who: I.who || H.blurb, perks: (I.perks || []).slice(0, 3), icon: I.icon || null, fam, famName: fam ? FAMN[fam] : null, pct: fam ? pct(fam) : 0, yours: fam === lead }; });
    const boss = T.boss;
    offer({ kind: 'evolve', from, tier, jobs, boss, path: pathText(), eyebrow: T.eyebrow, title: T.title,
      scene: tier === 1 ? 'Your choices picked a side. **Choose your class.** Then beat its trial.' : tier === 2 ? 'Your class can **grow**. Pick what it becomes. Then beat its trial.' : 'One last form. **Legendary.** Beat the trial to take it.',
      choices: jobs.map(J => ({ id: `trial-${J.cls}`, label: `Become a ${J.name}`, hint: `${J.who} Trial: beat ${boss}.`, fx: [{ op: 'trial', cls: J.cls, from, second: (opts.find(o => o.cls === J.cls) || {}).second || null, tier, boss }] }))
        .concat([{ id: 'wait', label: 'Not yet', hint: 'It asks again next dawn.', fx: [{ op: 'evolveLater', from }] }]) }, 8, 30);
  }
  function startTrial(f) {
    if (S.heroClass !== f.from) return;
    const spot = ctx.findSpot();
    ST.encounters = ST.encounters.filter(e => e.kind !== 'evolve'); ST.later = ST.later.filter(x => x.enc.kind !== 'evolve'); ST.evoLater = null;
    if (!spot) { trialWon({ cls: f.cls, from: f.from, second: f.second, tier: f.tier }); return; }
    const H = ctx.heroes[f.cls], tier = f.tier || 1;
    ST.trial = { cls: f.cls, from: f.from, second: f.second, x: spot.x, y: spot.y, day: S.night, started: false, done: false, tier, boss: f.boss || CLASS_TIERS[tier - 1].boss, name: `Trial of the ${H.name}` };
    toast(`[Trial accepted] Beat **${ST.trial.boss}** at the **red marker**, by day.`, 'sys');
    ev('trialAccepted', { cls: f.cls, tier, boss: ST.trial.boss });
  }
  function trialWon(t) {
    if (ST.trial) ST.trial.done = true;
    if (S.heroClass !== t.from) return;
    if (t.second) S.evo.second = t.second;
    apply({ op: 'evolve', cls: t.cls, from: t.from, tier: t.tier || (ST.trial && ST.trial.tier) || 1 }, null);
    grant(t.second ? 'ascended' : 'called');
  }

  // ---------- seasons are contracts ----------
  const contracts = createContracts({ S, map, rng, toast, ev, chron, grant, earn: ctx.earn, syncPicks: ctx.syncPicks, api });
  function seasonCard(def, n) {
    ST.seasons = ST.seasons || []; ST.seasons.push({ n, name: def.name, day: S.night });
    // the season that just ended: was its contract won?
    const lost = contracts.settle();
    if (lost) { loseRun(lost); return; }
    chron(`Season ${n} began: ${def.name}.`, 4, ['season']);
    { const a = api(); if (a && a.setSeasonRules) a.setSeasonRules(ST.rules || []); }   // only the rules the player signed stack
    offerContract(n);
  }
  function offerContract(n) {
    if (queued(e => e.kind === 'contract')) return;
    const k = contracts.encounter(n, hooks());
    offer(k, 10, 30);
  }
  /** a lost contract ends the run with its name */
  function loseRun(k) {
    ST.lostContract = { name: k.name, finale: k.finale.name, night: k.finale.night };
    const a = api();
    a.endRun(false, k.name);
  }
  function victoryCard(k) {
    const C = { name: k.name, n: k.n };
    offer({ kind: 'victory', season: k.n, contract: k.name, eyebrow: `[Contract complete: ${k.name}]`, title: `Season ${k.n} is yours`,
      scene: 'The boss is down. From tonight, **the nights get easier**.',
      next: 'Next: a new challenge. The dead remember who won.',
      reward: k.reward, choices: [{ id: 'take', label: 'Take the reward', hint: `+${k.reward.scrap} scrap · a rare blessing · easier nights · +${k.reward.fame} Legacy (kept after this run).`, fx: [{ op: 'reward' }] }], ...C }, 11, 30);
  }

  // ---------- the skill window: a blessing arrives as a skill, one a dawn ----------
  function skillOf(id) {
    if (!id) return null;
    if (id.startsWith('m:')) { const mid = id.slice(2); for (const L of Object.values(MASTERIES)) { const m = L.find(x => x.id === mid); if (m) return { id, name: m.name, desc: m.desc, mastery: true }; } return null; }
    const p = PERKS.find(x => x.id === id); return p ? { id, name: p.name, desc: p.desc, fam: p.fam, pact: !!p.pact } : null;
  }
  function pickSkill() {
    const ids = S.offer || []; const good = ids.map(skillOf).filter(Boolean);
    return good.find(p => !p.pact) || good[0] || null;
  }
  function offerSkill() {
    if (!(S.pendingPicks > 0) || !(S.offer && S.offer.length) || queued(e => e.kind === 'skill')) return;
    const p = pickSkill(); if (!p) return;
    offer({ kind: 'skill', skill: p.id, eyebrow: `[Skill acquired: ${p.name}]`, title: p.name, scene: p.desc, lines: [p.desc], icon: p.mastery ? 'star' : (p.fam || 'skill'), choices: [{ id: 'take', label: 'Take it', hint: p.desc, fx: [{ op: 'skill' }] }] }, 5, 0);
  }
  function takeSkill(enc) {
    const a = api(); if (!a) return;
    const want = enc && enc.skill && (S.offer || []).includes(enc.skill) ? enc.skill : (pickSkill() || {}).id;
    if (want) { a.choosePerk(want); const p = skillOf(want); if (p) { chron(`Learned ${p.name}.`, 2, ['skill']); ev('skill', { id: want, name: p.name }); } }
  }
  function setDifficulty(key) {
    if (!key || key === 'keep') return;
    const a = api();
    if (a && typeof a.setDifficulty === 'function') { a.setDifficulty(key); return; }
    S.difficulty = key; S.difficultyWanted = key; ev('difficulty', { key });   // without api.setDifficulty the page applies it (one game per page)
    toast(`[Difficulty set: ${DIFF_OFFER.find(d => d.id === key).label}] The System adjusts the dead.`, 'sys');
  }

  // ---------- the director: what comes at dawn ----------
  function dawn() {
    ST.day = S.night; deeds();
    ST.later = ST.later.filter(x => x.until >= S.night);
    if (S.night >= 2 && !ST.gifted) { const fresh = !ST.n1.arrived; ST.gifted = true; ST.n1.arrived = true; offer({ kind: 'gift', eyebrow: GIFT.eyebrow, title: GIFT.title, scene: fresh ? `${SYSTEM.intro} ${GIFT.scene}` : GIFT.scene, choices: GIFT.choices.map(c => ({ ...c })) }, 12, 9); if (fresh) chron('The status window opened.', 4); }
    for (const n of ST.npcs) n.chatToday = 0;
    if (ST.threads.hummer && ST.threads.hummer.status === 'open' && ST.threads.hummer.stage === 1) S.food = Math.max(0, S.food - 1);   // the caged one eats
    S.food += (ST.garden || 0) + (ST.flags.garden ? 1 : 0) + bonus.food();
    { const g = bonus.gold(); if (g) ctx.earn(g); }
    if (ST.uniqueLater && (!S.unique || S.unique.slain || S.unique.escaped)) { S.unique = { ...ST.uniqueLater, night: nextMoon(S.night + 1) }; ST.uniqueLater = null; }
    // threads that waited too long close, with a card
    for (const [tid, th] of Object.entries(ST.threads)) if (th.status === 'waiting' && S.night >= th.failAt) endThread(tid, 'too late');
    // the System measures you after the first night, then offers season 1's contract
    if (S.night === 2 && !ST.diffOffered) { ST.diffOffered = true; offer({ kind: 'difficulty', eyebrow: '[The System has measured you]', title: 'How hard should it be?', scene: 'One night survived. The System can **change how many dead** it sends. You can ask again later on the status window.', choices: DIFF_OFFER.map(d => ({ id: d.id, label: d.label, hint: d.hint, fx: [{ op: 'difficulty', key: d.id }] })) }, 9, 3); }
    if (S.night >= contracts.firstSeasonDay && !ST.contract && !ST.contractOffered && (!S.season || S.season.n === 1)) { ST.contractOffered = true; offerContract(1); }
    { const k = contracts.current(); if (k && k.won && !k.told) { k.told = true; victoryCard(k); } }
    contracts.armFinale();
    // after each blood moon: the chapter closes, told back to you (only when nothing bigger wants the window)
    if (S.night > 2 && (S.night - 1) % 5 === 0) {
      const ch = (S.night - 1) / 5, lines = ST.chronicle.filter(c => c.day > S.night - 6 && c.imp >= 3).map(c => `Day ${c.day}: ${c.text}`);
      const text = lines.length ? lines.slice(-4) : ['Five days of walls, smoke and small mercies.'];
      ST.saga = ST.saga || []; ST.saga.push({ chapter: ch, day: S.night, text: text.join(' · ') });
      offer({ kind: 'chapter', eyebrow: `[Chapter ${ch} complete]`, title: `Chapter ${ch}: ${['First Light', 'The Road', 'Under the City', 'The Long Road', 'Hollowmere Rising'][Math.min(4, ch - 1)]}`, scene: text.join(' '), lines: text,
        choices: [{ id: 'turn', label: 'Turn the page', hint: 'The next chapter begins.', fx: [] }] }, 3, 0);
    }
    if (ST.evoLater && S.heroClass === ST.evoLater.from) { const e = ST.evoLater; ST.evoLater = null; offer(e.enc, 8, 30); }
    else if (ST.evoLater) ST.evoLater = null;
    // a new thread starts on its day (one at a time)
    const startOk = T => S.night >= T.start.day && (!T.start.feat || S.feat[T.start.feat] || S.night >= T.start.day + 4);
    tidyQuests();
    const storyBusy = activeQuests().some(q => q.kind === 'thread' || q.kind === 'trial' || q.kind === 'pending');
    if (!storyBusy && !queued(e => e.kind === 'thread' && e.stage === 0 && !e.ended)) for (const [tid, T] of Object.entries(THREADS)) if (!ST.threads[tid] && startOk(T)) { ST.threads[tid] = { stage: 0, status: 'open', cast: {}, since: S.night }; offer(threadEncounter(tid, 0), 6, 9); break; }
    // dawn stages of running threads
    for (const [tid, th] of Object.entries(ST.threads)) {
      if (th.status !== 'open' || queued(e => e.thread === tid)) continue;
      const st = THREADS[tid].stages[th.stage]; if (!st || st.at !== 'dawn' || th.stage === 0) continue;
      if (S.night - th.since < (st.after || 0)) continue;
      if (st.needs === 'uniqueDone' && !(S.unique && S.unique.slain)) { if (S.unique && S.unique.escaped && !S.unique.contract) { S.unique.escaped = false; S.unique.night = nextMoon(S.night); toast(`[${S.unique.name}] It got away. Back on the next blood moon.`, 'bad'); } continue; }
      offer(threadEncounter(tid, th.stage), 7, 9);
    }
    if (S.unique && S.unique.season && !S.unique.contract && S.unique.escaped && !S.unique.slain) { S.unique.escaped = false; S.unique.night = nextMoon(S.night); toast(`[${S.unique.name}] It got away. Back on the next blood moon.`, 'bad'); }
    if (ST.beacon || ST.flags.beacon) { const n = (ST.beacon || 0) + (ST.flags.beacon ? 1 : 0); ST.beacon = 0; ST.flags.beacon = false; S.survivors += n; toast(`Strangers walked in under your flag. +${n} ${n === 1 ? 'person' : 'people'}.`, 'good'); }
    // a new dawn: yesterday's beacons fade first if the story needs the room (the story outranks a beacon)
    ST.spots = ST.spots.filter(sp => sp.thread || S.night - sp.day < 2);
    while (activeQuests().length > questCap() && ST.spots.some(sp => !sp.thread)) { const i = ST.spots.map(sp => !sp.thread).lastIndexOf(true); ST.spots.splice(i, 1); }
    // quiet dawns: a small moment, once each
    if (S.night >= 3 && rng.next() < 0.6 && !queued(e => e.slot === 'story')) { ST.ambient = ST.ambient || []; const pool = AMBIENT.filter(a => !ST.ambient.includes(a.id) && a.when(S)); if (pool.length) { const a = pool[rng.int(pool.length)]; ST.ambient.push(a.id); offer({ kind: 'ambient', eyebrow: a.eyebrow, title: a.title, scene: a.scene, choices: a.choices.map(c => ({ ...c })) }, 2, 0); } }
    // a route out of the fences every other day
    const front = ctx.frontier();
    if (front.length && S.feat.routes && S.night - (ST.lastRoute || 0) >= 2 && !queued(e => e.kind === 'district')) { const e = districtEncounter(); if (e) { offer(e, 4, 1); ST.lastRoute = S.night; } }
    offerSkill();
    issueDaily();
    release();
    episode();
  }
  // every day is an episode: a title card at dawn, like an anime
  function episode() {
    const sn = S.season ? S.season.n : 1, k = S.night - (sn > 1 ? seasonEnd(sn - 1) : 0);
    const first = ST.encounters.find(e => e.kind === 'thread' || e.kind === 'contract' || e.kind === 'ambient');
    const title = (sn === 1 && EPISODES[k - 1]) || (first && first.title.replace(/[[\]]/g, '')) || ['Smoke on the Horizon', 'Another Wall', 'Small Mercies', 'The Long Afternoon', 'Quiet Before', 'Footsteps'][S.night % 6];
    ST.episode = { season: sn, n: k, title }; ST.episodes = ST.episodes || []; ST.episodes.push({ day: S.night, title }); if (ST.episodes.length > 60) ST.episodes.shift();
    ev('episode', { season: sn, n: k, title });
  }

  // ---------- the daily quest ----------
  function openSites() { return S.landmarks.filter(l => !l.owned && !l.stripped && l.kind !== 'unknown' && !S.sealed[l.region]).length; }
  function issueDaily(midday = false) {
    if (S.night < 2) return;
    const prev = ST.daily;
    if (!midday && prev && !prev.done && prev.day < S.night) {   // ignored: a penalty quest, or (a second time) the Camp pays
      if (prev.penalty) {
        const cost = Math.min(S.food, 3 + Math.floor(S.night / 3)), what = cost ? `-${cost} food` : `-${Math.min(S.gold, 5)} scrap`;
        if (cost) S.food -= cost; else S.gold = Math.max(0, S.gold - 5);
        toast(DAILY_TEXT.paid.replace('{cost}', what), 'bad'); ST.penalty = false; chron('Paid for an ignored penalty quest.', 2);
      } else ST.penalty = true;
    }
    if (prev && prev.day === S.night) return;
    if (!ST.penalty && !roomForQuest()) return;   // the gate: it comes when the quest before it is done
    if (midday && ST.penalty) return;
    const pool = DAILY.filter(q => (!q.when || q.when(S, openSites())) && (!prev || q.id !== prev.id));
    const T = ST.penalty && prev ? (DAILY.find(q => q.id === prev.id) || pool[0]) : pool[rng.int(pool.length)];
    if (!T) return;
    const pen = !!ST.penalty, n0 = T.n(S.night), n = pen && n0 > 1 ? Math.ceil(n0 * 1.5) : n0;
    ST.daily = { id: T.id, title: T.title, goal: T.goal.replace('{n}', n), n, base: T.stat(S, ST), done: false, penalty: pen, day: S.night, far: 0, back: false };
    toast(`${(pen ? DAILY_TEXT.penalty : DAILY_TEXT.issued).replace('{title}', T.title)} ${ST.daily.goal}.${!ST.dailyWarned ? ` ${DAILY_TEXT.warn}` : ''}`, 'sys');
    ST.dailyWarned = true; ev('daily', { id: T.id });
  }
  /** what the strip shows: "Put down 12 of the dead · 4/12" */
  function dailyProgress() {
    const q = ST.daily; if (!q || q.day !== S.night) return null;
    const T = DAILY.find(x => x.id === q.id); if (!T) return null;
    const have = T.far ? (q.back ? q.n : Math.min(q.n, Math.round(q.far))) : Math.max(0, Math.min(q.n, T.stat(S, ST) - q.base));
    return { title: q.title, goal: q.goal, have, n: q.n, done: q.done, penalty: q.penalty };
  }
  /** the one line the strip shows: the active quest, in plain words */
  function questLine() {
    const qs = activeQuests(), d = dailyProgress();
    const tr = qs.find(q => q.kind === 'trial');
    if (tr) return withContract({ tag: '[Trial]', text: `${ST.trial.name.replace(/^Trial of (the )?/, '')} · ${dirOf(tr.x, tr.y)}` });
    const th = qs.find(q => q.kind === 'thread');
    if (th) { const tid = th.site !== undefined ? (ST.quests.find(q => q.site === th.site) || {}).thread : (ST.spots.find(sp => sp.id === th.spot) || {}).thread; const T = tid && THREADS[tid]; return withContract({ tag: '[Quest]', text: `${T ? T.title : 'Story'}: go ${dirOf(th.x, th.y)}` }); }
    if (d && !d.done) return withContract({ tag: d.penalty ? '[Penalty]' : '[Daily]', have: d.have, n: d.n, text: d.goal });
    const b = qs.find(q => q.kind === 'beacon');
    if (b) return withContract({ tag: '[Quest]', text: `Reach the blue beacon · ${dirOf(b.x, b.y)}` });
    if (d && d.done) return withContract({ tag: '[Daily]', done: true, text: d.goal });
    const K = contracts.stripLine(); if (K) return { ...K, extra: K.left ? `${K.left} night${K.left === 1 ? '' : 's'} left` : 'Tonight' };
    return null;
  }
  /** the contract's countdown rides along every quest line: "Gravelord: 7 nights" */
  function withContract(q) { const K = contracts.stripLine(); return K ? { ...q, extra: K.extra } : q; }
  function dailyTick() {
    const q = ST.daily; if (!q || q.done || q.day !== S.night || S.over) return;
    const T = DAILY.find(x => x.id === q.id); if (!T) return;
    if (T.far && !S.hero.dead) { const d = Math.hypot(S.hero.x - map.town.x, S.hero.y - map.town.y); if (d > q.far) q.far = d; if (q.far >= q.n && d < 9) q.back = true; }
    if (S.phase === 'night' && !q.failedSaid) { q.failedSaid = true; toast(DAILY_TEXT.failed, 'bad'); return; }
    if (S.phase !== 'day') return;
    if (T.stat(S, ST) - q.base < q.n) return;
    q.done = true; ST.dailies = (ST.dailies || 0) + 1;
    const fx = T.reward(S.night).map(f => (q.penalty && f.op !== 'lean' ? { ...f, n: Math.ceil(f.n / 2) } : f));
    for (const f of fx) apply(f, null);
    const say = fx.filter(f => f.op !== 'lean').map(f => (f.op === 'xp' ? `+${f.n} xp` : f.op === 'gold' ? `+${f.n} scrap` : f.op === 'food' ? `+${f.n} food` : '')).filter(Boolean).join(' · ');
    toast(`${DAILY_TEXT.done.replace('{title}', q.title)} ${say}.`, 'sys'); ev('dailyDone', { id: q.id });
    chron(`Finished the daily quest ${q.title}.`, 1);
    if (q.penalty) { ST.penalty = false; grant('penitent'); }
    if (ST.dailies === 7) grant('diligent');
  }

  // ---------- the night: one line that scales with the wave, the System's arrival on night 1 ----------
  const dirOf = (x, y) => DIRS[((Math.round(Math.atan2(y - map.town.y, x - map.town.x) / (Math.PI / 4)) % 8) + 8) % 8];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'], TEEN = ['Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const word = n => (n < NUMBER.length ? NUMBER[n] : n < 20 ? TEEN[n - 13] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? `-${NUMBER[n % 10].toLowerCase()}` : '') : String(n));
  /** "One of them." / "Nine, from the east." — from the dead actually queued for tonight */
  function nightLine(q = S.queue || []) {
    const sides = new Map(); let brutes = 0, total = 0, unique = null;
    for (const e of q) {
      const reg = map.regions[e.nest], p = reg && reg.nest ? reg.nest : map.town; const d = dirOf(p.x, p.y);
      sides.set(d, (sides.get(d) || 0) + 1); total++;
      if (e.kind === 'brute') brutes++; if (e.unique && S.unique) unique = S.unique.name;
    }
    const T = NIGHT_TEXT, ord = [...sides.entries()].sort((a, b) => b[1] - a[1]);
    let line;
    if (total <= 1) line = T.one;
    else if (ord.length === 1) line = T.side.replace('{N}', word(total)).replace('{dir}', ord[0][0]);
    else if (ord.length === 2) line = T.two.replace('{N}', word(ord[0][1])).replace('{dir}', ord[0][0]).replace('{M}', word(ord[1][1])).replace('{dir2}', ord[1][0]);
    else line = T.many.replace('{N}', word(total));
    if (brutes === 1) line += T.brute; else if (brutes > 1) line += T.brutes.replace('{B}', word(brutes));
    if (unique) line += T.unique.replace('{name}', unique);
    if (S.night % 5 === 0) line = T.blood + line;
    return { line, total, brutes, sides: ord.map(([dir, n]) => ({ dir, n })) };
  }
  function nightTick() {
    if (S.phase === 'night' && ST.duskSaid !== S.night) {
      ST.duskSaid = S.night; const L = nightLine();
      ev('scene', { id: S.night === 1 ? 'night1' : 'dusk', night: S.night, line: L.line, total: L.total, brutes: L.brutes, intro: S.night === 1 ? SYSTEM.dayOne : null });
    }
    // night 1: when the first of the dead reaches you, the System types itself into the air
    if (S.night === 1 && S.phase === 'night' && !ST.n1.arrived && !S.hero.dead) {
      const first = S.mobs.find(m => m.first), h = S.hero;
      const near = first && Math.hypot(first.x - h.x, first.y - h.y) < 7;   // in sight: it is coming for you
      if (near || (!first && S.qT > 10) || S.qT > 22) arrival();
    }
  }
  function arrival() {
    ST.n1.arrived = true;   // the gift comes at dawn 2, as the reward for surviving: no decision in the middle of the first fight
    const lines = SYSTEM.arrival.map(l => l.replace('{hp}', Math.ceil(S.hero.maxHp)));
    push({ kind: 'arrival', eyebrow: '[Status window]', title: SYSTEM.arrivalTitle, scene: lines.join(' '), lines, after: SYSTEM.firstLight,
      choices: [{ id: 'fight', label: 'Fight', hint: 'Shove: the round button.', fx: [{ op: 'title', id: 'firstLight' }] }] });
    chron('The status window opened in the air as the first of the dead reached you.', 5);
    ev('arrival', {});
  }

  // ---------- street encounters: markers in the open districts, found by walking there ----------
  /** one blue beacon, only when the gate has room (the next one comes after this one is answered) */
  function placeSpots() {
    ST.streetUsed = ST.streetUsed || [];
    if (S.night < 2 || !roomForQuest() || ST.spots.some(sp => !sp.thread)) return;
    if (!map.regions.some(r => r.ring > 0 && !S.sealed[r.id])) return;
    for (let k = 0; k < 1; k++) {
      const pool = STREET.filter(e => !ST.streetUsed.includes(e.id));
      const spot = ctx.findSpot(); if (!spot) return;
      let kind;
      if (pool.length) { const e = pool[rng.int(pool.length)]; ST.streetUsed.push(e.id); kind = e.id; }
      else { kind = `gen${ST.nextId}`; ST.gen = ST.gen || {}; ST.gen[kind] = genStreet(); }
      ST.spots.push({ id: ST.nextId++, kind, x: spot.x, y: spot.y, day: S.night });
      ctx.guard(spot.x, spot.y, Math.min(5, 2 + Math.floor(S.night / 4)));
      toast(`[New quest] A **blue beacon**: someone out ${dirOf(spot.x, spot.y)} needs you.`, 'sys'); ev('questNew', { kind: 'beacon' });
    }
  }
  // the gate by day: when a quest is done, the next one shows a few seconds later (the daily first, then a beacon)
  let gateT = 4, lastCount = -1;
  function gateTick(dt) {
    if (S.phase !== 'day' || S.night < 2 || S.over) return;
    const n = activeQuests().length;
    if (n < lastCount) gateT = Math.max(gateT, 6);   // one just finished: a breath before the next
    lastCount = n;
    if ((gateT -= dt) > 0 || n >= questCap()) return;
    gateT = 2;
    const left = TIDE.dayLen - (S.dayT || 0);
    if ((!ST.daily || ST.daily.day < S.night) && left > TIDE.dayLen * 0.45) { issueDaily(true); if (ST.daily && ST.daily.day === S.night) return; }
    if (left > 30) placeSpots();
  }
  function genStreet() {
    const G = STREET_GEN, who = G.who[rng.int(G.who.length)], where = G.where[rng.int(G.where.length)], ask = G.ask[rng.int(G.ask.length)];
    const v = { n: 1 + rng.int(3), f: 2 + rng.int(3), g: 4 + rng.int(4) + Math.floor(S.night / 4), h: 5 + rng.int(4), h2: 2 + rng.int(3) };
    const sub = x => (typeof x === 'string' ? x.replace(/\{(\w+)\}/g, (_, k) => v[k]) : x);
    const num = x => (typeof x === 'string' && /^-?\{/.test(x) ? Number(sub(x)) : x);
    const Who = who.name[0].toUpperCase() + who.name.slice(1);
    return { eyebrow: '[Survivor detected]', title: `${Who} ${where[1]}`, scene: `${Who}, ${where[0]}. ${who.trait[0].toUpperCase() + who.trait.slice(1)}. ${ask.line}`,
      choices: ask.choices.map(c => ({ id: c.id, label: c.label, hint: sub(c.hint), cost: c.cost ? { gold: num(c.cost.gold) } : undefined, fx: c.fx.map(f => ({ ...f, n: num(f.n) })) })) };
  }
  function spotTick() {
    const h = S.hero;
    for (const sp of ST.spots) if (Math.hypot(h.x - sp.x, h.y - sp.y) < 1.8) {
      if (sp.thread) {
        const th = ST.threads[sp.thread], st = th && THREADS[sp.thread].stages[th.stage];
        if (!th || th.status !== 'open' || !st || st.at !== 'site') { ST.spots.splice(ST.spots.indexOf(sp), 1); return false; }
        ST.spots.splice(ST.spots.indexOf(sp), 1); th.spot = null;
        push(threadEncounter(sp.thread, th.stage)); return true;
      }
      ST.spots.splice(ST.spots.indexOf(sp), 1);
      const e = STREET.find(x => x.id === sp.kind) || (ST.gen && ST.gen[sp.kind]); if (!e) return false;
      push({ kind: 'street', eyebrow: e.eyebrow, title: e.title, scene: e.scene, choices: e.choices.map(c => ({ ...c })), npc: e.npc || undefined, ai: e.made ? { title: e.title, beats: e.beats, scene: e.scene, labels: {}, line: null, chronicle: null } : null });
      if (ST.gen) delete ST.gen[sp.kind];
      return true;
    }
    return false;
  }
  // tips: inline callouts the UI anchors to the HUD (never on day 1, never a modal)
  let tipT = 0;
  function tips() {
    if ((tipT -= 0.25) > 0 || S.night < 2 || S.phase !== 'day') return; ST.tips = ST.tips || [];
    for (const t of TIPS) if (!ST.tips.includes(t.id) && t.when(S, api())) { ST.tips.push(t.id); ev('tip', { id: t.id, at: t.at, text: t.text }); tipT = 45; return; }
  }
  function tick(dt = 1 / 60) {
    tips(); nightTick(); dailyTick(); gateTick(dt);
    contracts.check();
    const tr = ST.trial;
    if (tr && !tr.done && !tr.started && !S.hero.dead && Math.hypot(S.hero.x - tr.x, S.hero.y - tr.y) < 3) { tr.started = true; ctx.spawnTrial(tr); const w = S.mobs.find(m => m.trial && !m.bossName); if (w) { const k = [1, 1.6, 2.4][(tr.tier || 1) - 1]; w.bossName = tr.boss || 'The Warden'; w.bossTier = tr.tier || 1; w.hp = w.maxHp = Math.round(w.maxHp * k); } toast(`[${tr.boss || tr.name}] Kill it. It won't follow you home.`, 'bad'); ev('trialStart', { boss: tr.boss, tier: tr.tier || 1 }); }
    if (ST.encounters.length || S.hero.dead || S.phase !== 'day') return;   // places speak by day: at night they wait for you
    if (spotTick()) return;
    for (const l of S.landmarks) if (typeof ST.visited[l.id] === 'number' && ST.visited[l.id] < S.night && !ctx.landmarkReach(l)) ST.visited[l.id] = false;   // left yesterday: it can ask again
    for (const l of S.landmarks) {
      if (l.owned || l.stripped || l.kind === 'unknown' || S.sealed[l.region] || ST.visited[l.id] || !ctx.landmarkReach(l)) continue;
      ST.visited[l.id] = true;
      const tid = Object.keys(ST.threads).find(t => { const th = ST.threads[t]; return th.status === 'open' && (th.site === l.id || (th.site === undefined && th.region === l.region)) && THREADS[t].stages[th.stage] && THREADS[t].stages[th.stage].at === 'site'; });
      push(tid ? threadEncounter(tid, ST.threads[tid].stage) : siteEncounter(l));
      return;
    }
  }
  function start() {
    chron('Woke up in the woods outside the fallen city, with a bus full of strangers.', 5);
    if (S.clock && S.night === 1 && !S.dayT) S.dayT = Math.max(0, TIDE.dayLen - DAY_ONE);   // a short first day: light the fire, the night is close
    episode();   // day 1 has no quest: the System has not arrived yet
  }
  /** bonuses companions and story give the Camp */
  const comp = key => ST.npcs.reduce((a, n) => a + (n.alive && n.joined && !n.withHero && ROLES[n.role] && ROLES[n.role][key] || 0), 0);
  const bonus = {
    power: () => ST.power + comp('power'),
    hands: () => ST.hands + comp('hands'),
    towers: () => comp('towers'),
    lullaby: () => { const n = npcByRole('revenant'); return n && n.joined && !n.withHero ? (n.named ? 0.65 : ROLES.revenant.lullaby) : 1; },
    heat: () => (ST.flags.quiet ? 0.85 : 1),
    food: () => comp('food'),
    gold: () => comp('gold'),
    regen: () => ST.npcs.reduce((a, n) => a + (n.alive && n.joined && ROLES[n.role] && ROLES[n.role].regen || 0), 0),
  };
  // ---------- side quests the Chronicler invents: Claude picks a template and writes it; the engine owns the effects ----------
  const NEW_ROLES = ['scout', 'medic', 'cook', 'mechanic', 'gunner'];
  const sgn = n => (n > 0 ? `+${n}` : `${n}`);
  function describe(fx, npcData) {
    const out = [];
    for (const f of fx) {
      if (f.op === 'survivors') out.push(`${sgn(f.n)} people`); else if (f.op === 'food') out.push(`${sgn(f.n)} food`); else if (f.op === 'gold') out.push(`${sgn(f.n)} scrap`);
      else if (f.op === 'heat' && noiseOn()) out.push(`${sgn(f.n)} noise`); else if (f.op === 'flag' && f.key === 'beacon') out.push('+1 person at dawn');
      else if (f.op === 'blessing') out.push('a rare blessing'); else if (f.op === 'hurt') out.push('you get hurt');
      else if (f.op === 'perk' && f.key === 'heroDmg') out.push(`+${f.add} hero damage`); else if (f.op === 'recruitNew' && npcData) out.push(`${npcData.name.split(' ')[0]} joins as your ${ROLES[npcData.role].post.toLowerCase()}: ${ROLES[npcData.role].bonus}`);
    }
    return out.length ? `${out.join(', ')}.` : 'Nothing changes.';
  }
  const clip = (v, n) => String(v ?? '').replace(/[<>[\]{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  /** a quest from the Chronicler: validated, given engine-owned effects, placed as a beacon */
  function invent(q) {
    if (!q || typeof q !== 'object' || ST.inventDay === S.night || !roomForQuest()) return false;
    const T = QUEST_TEMPLATES[q.template]; if (!T) return false;
    let who = null;
    if (T.who) {
      const c = q.character || {}; const role = q.template === 'recruit' ? (NEW_ROLES.includes(c.role) ? c.role : NEW_ROLES[rng.int(NEW_ROLES.length)]) : null;
      const traits = (Array.isArray(c.traits) ? c.traits : []).map(t => clip(t, 18)).filter(Boolean).slice(0, 3);
      who = { name: clip(c.name, 28) || 'A stranger', epithet: clip(c.epithet, 32) || 'a stranger', traits: traits.length ? traits : ['wary'], quirk: clip(c.quirk, 60) || 'keeps to themselves', want: clip(c.want, 60) || 'to live', fear: clip(c.fear, 60) || 'the dark', secret: clip(c.secret, 120) || 'nothing they will say', role: role || 'scout' };
      if (ST.npcs.some(n => n.name === who.name)) who.name = `${who.name.split(' ')[0]} the Second`;
    }
    const beats = (Array.isArray(q.beats) ? q.beats : []).map(b => clip(String(b).replace(/\*\*/g, '§'), 200).replace(/§(.+?)§/g, '**$1**').replace(/§/g, '')).filter(b => b.length >= 8).slice(0, 3);
    if (!beats.length) return false;
    const labels = {}; for (const c of Array.isArray(q.choices) ? q.choices : []) if (c && T.choices.some(t => t.id === c.id)) labels[c.id] = clip(c.label, 44);
    const choices = T.choices.map(t => { const fx = t.fx(S.night); return { id: t.id, label: labels[t.id] || t.label, hint: describe(fx, who), cost: t.cost ? t.cost(S.night) : undefined, fx, npcName: who && fx.some(f => f.op === 'recruitNew') ? `${who.name.split(' ')[0]} joins` : undefined }; });
    const spot = ctx.findSpot(); if (!spot) return false;
    const kind = `ai${ST.nextId++}`; ST.gen = ST.gen || {};
    ST.gen[kind] = { eyebrow: clip(q.eyebrow, 40) ? `[${clip(q.eyebrow, 40)}]` : '[Side quest]', title: clip(q.title, 48) || 'A side quest', scene: beats.join(' '), beats, choices, npc: who, made: true, callback: clip(q.callback, 120) };
    ST.spots.push({ id: ST.nextId++, kind, x: spot.x, y: spot.y, day: S.night, made: true });
    ctx.guard(spot.x, spot.y, Math.min(5, 2 + Math.floor(S.night / 4)));
    ST.inventDay = S.night; ST.invented = (ST.invented || 0) + 1;
    toast(`[New side quest: ${ST.gen[kind].title}] A **blue beacon** marks it.`, 'sys');
    return true;
  }
  // what the AI needs to write an encounter in this run's voice
  function context() {
    const owned = S.landmarks.filter(l => l.owned).map(l => LM[l.kind].name);
    return {
      city: map.name, day: S.night, phase: S.phase, people: ctx.pop(), heat: Math.round(S.noise ?? S.heat ?? 0), keepLevel: S.keep ? S.keep.level : 1,
      districtsOpen: map.regions.filter(r => !S.sealed[r.id]).length, sites: owned, titles: ST.titles.map(t => TITLES[t].name),
      companions: ST.npcs.filter(n => n.alive && n.joined).map(n => ({ name: n.name, role: ROLES[n.role].post, bond: n.bond, traits: n.persona.traits.join(', '), quirk: n.persona.quirk })),
      chronicle: ST.chronicle.slice(-10).map(c => `day ${c.day}: ${c.text}`),
    };
  }
  /** the things a twist may hang on: real people, places and threads of this run (most recent first) */
  function hooks() {
    const comps = ST.npcs.filter(n => n.alive && n.joined).sort((a, b) => b.bond - a.bond);
    const met = ST.npcs.filter(n => !n.joined || !n.alive);
    const places = S.landmarks.filter(l => l.owned).map(l => LM[l.kind].name);
    const threads = Object.entries(ST.threads).filter(([, t]) => t.status !== 'open').map(([id]) => THREADS[id].title);
    return {
      companion: comps[0] ? comps[0].name : met[0] ? met[0].name : null, place: places[places.length - 1] || null, thread: threads[threads.length - 1] || null,
      marked: !!ST.threads.lantern, all: [...new Set([...comps.map(n => n.name), ...met.map(n => n.name), ...places, ...Object.keys(ST.threads).map(id => THREADS[id].title), ...(S.unique ? [S.unique.name] : []),
        ...ST.chronicle.map(c => /^(.+?): "/.exec(c.text)).filter(Boolean).map(m => m[1]).filter(t => !/window only you|System|Contract/i.test(t)).slice(-8)])].filter(Boolean),
    };
  }
  /** everything the Chronicler needs: the whole run so far */
  function fullContext() {
    const base = context();
    return { ...base, chronicle: ST.chronicle.slice(-40).map(c => `day ${c.day}: ${c.text}`), season: S.season ? `${S.season.n}: ${S.season.name}` : '1',
      hero: { class: ctx.heroes[S.heroClass].name, level: S.lvl, path: pathText() },
      companions: ST.npcs.filter(n => n.alive && n.joined).map(n => ({ name: n.name, epithet: n.epithet, role: ROLES[n.role].post, bond: n.bond, traits: n.persona.traits.join(', '), quirk: n.persona.quirk, want: n.persona.want, fear: n.persona.fear })),
      threads: Object.entries(ST.threads).map(([id, t]) => `${THREADS[id].title}: ${t.status === 'open' ? 'open' : t.status === 'done' ? 'closed (resolved)' : t.status === 'waiting' ? 'waiting on you' : 'closed (failed)'}`),
      losses: [...ST.npcs.filter(n => !n.alive).map(n => `${n.name} (gone, day ${n.lost || '?'})`), ...(S.stats.buildingsLost ? [`${S.stats.buildingsLost} buildings lost`] : []), ...(S.stats.heroDeaths ? [`the hero fell ${S.stats.heroDeaths} times`] : [])],
      choices: ST.chronicle.filter(c => /: "/.test(c.text)).slice(-12).map(c => `day ${c.day}: ${c.text}`),
      titles: ST.titles.map(t => TITLES[t].name),
      districts: map.regions.filter(r => r.ring > 0 && !S.sealed[r.id]).map(r => { const l = ctx.siteOf(r.id); return l ? LM[l.kind].name : 'the woods'; }),
      people: ST.npcs.filter(n => n.alive).map(n => `${n.name} (${n.joined ? ROLES[n.role].post : 'met'})`),
      contract: ST.contract ? { name: ST.contract.name, finale: ST.contract.finale.name, won: ST.contract.won } : null,
      hooks: hooks().all,
      episode: ST.episode ? ST.episode.title : null };
  }
  return { activeQuests, shownQuests, questCap, roomForQuest, invent, fullContext, hooks, offerTrial, trialWon, seasonCard, pathText, start, dawn, tick, choose, can, bonus, context, chron, npc, grant,
    offerWin: w => offer({ kind: 'window', eyebrow: w.eyebrow || '[System]', title: w.title || '', lines: w.lines || [], scene: (w.lines || []).join(' '), feat: w.feat, choices: [{ id: 'ok', label: 'Got it', hint: '', fx: [] }] }, w.pri || 6, 30),
    release, flush, dailyProgress, questLine, nightLine, contracts, skillOf, endThread,
    rarityColor: r => (RARITY[r] || RARITY.common).color };
}
