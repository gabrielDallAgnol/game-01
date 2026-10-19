// The story engine: decides which encounter comes next and applies every effect. Deterministic (own RNG).
// Claude may rewrite an encounter's words (see ui/story-ai.js), never its choices' effects.
//
// S.story = { day, encounters (queue shown as cards), threads {id: {stage, status, cast, region, failAt}},
//   npcs [], titles [], chronicle [], flags {}, quests [], power, hands, visited {} }
import { GIFT, TITLES, DISTRICT_CALL, SITES, THREADS, ROLES, SYSTEM, AMBIENT, TIPS, STREET, STREET_GEN, QUEST_TEMPLATES } from '../content/story.js';
import { RARITY } from '../content/districts.js';
import { EPISODES, seasonEnd } from '../content/season.js';

const FAM_NAME = { hero: 'Brawn', ranger: 'Aim', scavver: 'Wits', heart: 'Heart', bow: 'Bow', stone: 'Stone', harvest: 'Harvest' };
export function createStory(ctx) {
  const { S, map, rng, toast, ev } = ctx;
  const ST = S.story = { spots: [], day: 1, encounters: [], threads: {}, npcs: [], titles: [], chronicle: [], flags: {}, quests: [], power: 0, hands: 0, visited: {}, nextId: 1, lastOpen: 0 };
  const LM = ctx.LANDMARKS;

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

  // ---------- titles ----------
  function grant(id) {
    if (ST.titles.includes(id) || !TITLES[id]) return;
    const T = TITLES[id]; ST.titles.push(id);
    for (const f of T.fx || []) apply(f, null);
    toast(`[Title acquired: ${T.name}] ${T.desc}`, 'good'); ev('title', { id }); chron(`Earned the title ${T.name}.`, 3, ['title']);
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
      case 'food': S.food = Math.max(0, S.food + (f.n > 0 && S.season && S.season.rule === 'hunger' ? f.n * 2 : f.n)); break;
      case 'survivors': S.survivors += f.n; break;
      case 'trial': startTrial(f, enc); break;
      case 'recruitNew': { const d = enc && enc.npc; if (!d) break; const n = { id: `n${ST.nextId++}`, role: d.role, name: d.name, epithet: d.epithet, persona: { traits: d.traits, quirk: d.quirk, want: d.want, fear: d.fear }, secret: d.secret, bond: 1, alive: true, joined: true, named: false, thread: null, chatToday: 0, memory: [], made: 'chronicler' };
        ST.npcs.push(n); toast(`[${n.name} joined] ${ROLES[n.role].post}: ${ROLES[n.role].bonus}.`, 'good'); chron(`${n.name}, ${n.epithet}, joined the town as its ${ROLES[n.role].post.toLowerCase()}.`, 4, [n.id]); ev('recruit', { id: n.id }); break; }
      case 'heat': ctx.addHeat(f.n); break;
      case 'power': ST.power += f.n; break;
      case 'hands': ST.hands += f.n; break;
      case 'handsToday': S.handsUsed -= f.n; break;
      case 'perk': if (f.mul) S.P[f.key] *= f.mul; else S.P[f.key] += f.add; ctx.refreshMax(); break;
      case 'flag': if (f.key === 'garden') ST.garden = (ST.garden || 0) + 1; else if (f.key === 'beacon') ST.beacon = (ST.beacon || 0) + 1; else ST.flags[f.key] = true; break;
      case 'title': grant(f.id); break;
      case 'blessing': S.picks.push('chest'); ctx.syncPicks(); break;
      case 'openFor': {   // open (or point to) a district of this kind for the thread
        const r = districtFor(f.kit);
        if (r === null) { if (enc) enc.noRegion = true; toast('[Signal lost] There is no way through to them any more.', 'bad'); break; }
        if (r !== null) { S.kits[r] = S.kits[r] || f.kit; if (S.sealed[r]) ctx.openDistrict(r, `${THREADS[enc.thread].title}.`); if (th) th.region = r; const l = ctx.siteOf(r); if (l) addQuest(l, enc.thread); }
        break;
      }
      case 'open': ctx.openDistrict(f.region, f.why); ST.lastOpen = S.night; { const l = ctx.siteOf(f.region); if (l && !l.owned) addQuest(l, null); } break;
      case 'recruit': { const n = castFor(enc.thread, f.role); n.joined = true; toast(`[${n.name} joined] ${ROLES[n.role].post}: ${ROLES[n.role].bonus}.`, 'good'); chron(`${n.name} joined the town as its ${ROLES[n.role].post.toLowerCase()}.`, 4, [n.id]); ev('recruit', { id: n.id }); break; }
      case 'lose': { const n = th && npc(th.cast[f.role]); if (n) { n.alive = false; n.joined = false; n.withHero = false; chron(`${n.name} left the town.`, 4, [n.id]); } break; }
      case 'bond': { const n = th && npc(th.cast[f.role]); if (n) n.bond = Math.max(-3, Math.min(5, n.bond + f.n)); break; }
      case 'name': { const n = th && npc(th.cast[f.role]); if (n) { n.named = true; n.name = ctx.reviveName ? ctx.reviveName() : n.name; S.drained = S.night; toast(`[Naming complete] It answers to a name now. It feels stronger. You feel weaker tonight.`, 'good'); chron(`Named one of the dead: ${n.name}.`, 5, [n.id]); } break; }
      case 'claimHere': { const l = th && th.region !== undefined && ctx.siteOf(th.region); if (l && !l.owned) ctx.claimFree(l.id); break; }
      case 'risen': ctx.risen(f.n); break;
      case 'gamble': if (rng.next() >= f.p) { for (const b of f.bad) apply(b, enc); } else if (f.good) { for (const b of f.good) apply(b, enc); } else toast('The fever broke at dawn. He lives.', 'good'); break;
      case 'hurt': ctx.hurtHero(f.n); break;
      case 'unique': S.unique = { name: f.name, mult: f.mult, night: S.night + (f.later || 0) - (S.night % 5 === 0 && !f.later ? 0 : 0), thread: enc && enc.thread }; if (f.later) S.unique.night = nextMoon(S.night + 1); else S.unique.night = nextMoon(S.night); break;
      case 'evolve': if (S.heroClass === f.from) { ctx.evolve(f.cls); chron(`Became a ${ctx.heroes[f.cls].name}.`, 5, ['hero']); ST.encounters = ST.encounters.filter(e => e === enc || e.kind !== 'evolve' || e.from === S.heroClass); if (ST.evoLater && ST.evoLater.from !== S.heroClass) ST.evoLater = null; } break;
      case 'evolveLater': ST.evoLater = { from: f.from, enc: { ...enc, id: undefined, ai: null } }; break;
      case 'advance': if (th) { if (enc && enc.noRegion) th.status = 'failed'; else { th.stage++; th.since = S.night; } } break;
      case 'resolve': if (th) { th.status = 'done'; } break;
      case 'fail': if (th) { if (f.after) { th.status = 'waiting'; th.failAt = S.night + f.after; } else th.status = 'failed'; } break;
    }
  }
  const nextMoon = n => { let k = n; while (k % 5) k++; return k; };
  function districtFor(kit) {
    let front = ctx.frontier();
    // a region already holding this kit, else an unassigned frontier region, else any frontier region
    const ok = r => { const l = ctx.siteOf(r); return l && !l.owned && !l.stripped; };   // a quest needs a building to walk into
    const have = Object.keys(S.kits).map(Number).find(r => S.kits[r] === kit && S.sealed[r] && front.includes(r) && ok(r));
    if (have !== undefined) return have;
    front = front.filter(ok);
    const free = front.filter(r => !S.kits[r]); let pool = free.length ? free : front.filter(r => S.kits[r] !== 'signature');
    if (!pool.length) return null;
    const near = Math.min(...pool.map(r => map.regions[r].ring)); pool = pool.filter(r => map.regions[r].ring === near);
    const r = pool[rng.int(pool.length)]; S.kits[r] = kit; return r;
  }
  function addQuest(l, thread) { if (!ST.quests.some(q => q.site === l.id)) ST.quests.push({ site: l.id, thread, x: l.x, y: l.y }); }

  // ---------- encounters ----------
  const can = c => { const k = costOf(c); return S.gold >= (k.gold || 0) && S.food >= (k.food || 0); };
  function costOf(c) {
    if (!c.cost) return {};
    const clinic = S.landmarks.some(l => l.owned && l.kind === 'clinic');
    if (c.clinicFree && clinic) return {};
    if (c.clinicHalf && clinic) return { gold: Math.ceil((c.cost.gold || 0) / 2), food: Math.ceil((c.cost.food || 0) / 2) };
    return c.cost;
  }
  // before the heat system arrives, choices do not talk about it
  const stripHeat = h => { if (!h || !/heat/i.test(h)) return h; const t = h.replace(/\s*The radio burst is loud:?/i, '').replace(/[,;]?\s*\(?[+-]\d+ heat( now)?\)?/gi, '').replace(/\bHeat -\d+( now)?(\s+and\s+)?/g, '').replace(/\s+([.,:])/g, '$1').replace(/([.:])\s*\./g, '$1').replace(/:\s*$/, '.').trim(); return t ? t[0].toUpperCase() + t.slice(1) : t; };
  function push(enc) { enc.id = ST.nextId++; enc.ai = enc.ai || null; if (!S.feat.heat) for (const c of enc.choices || []) c.hint = stripHeat(c.hint); ST.encounters.push(enc); ev('encounter', { id: enc.id, kind: enc.kind }); }
  function threadEncounter(tid, stage) {
    const T = THREADS[tid], st = T.stages[stage], th = ST.threads[tid];
    for (const role of Object.keys(T.cast)) castFor(tid, role);
    const speaker = st.speaker ? npc(th.cast[st.speaker]) : null;
    return { kind: 'thread', thread: tid, stage, eyebrow: fill(st.eyebrow, th), title: fill(st.title, th), scene: fill(st.scene, th), speaker: speaker ? { id: speaker.id, name: speaker.name, line: fill(st.line, th) } : null,
      choices: st.choices.map(c => ({ id: c.id, label: fill(c.label, th), hint: fill(c.hint, th), cost: costOf(c), fx: c.fx })) };
  }
  function districtEncounter() {
    const front = ctx.frontier().filter(r => S.kits[r] !== 'signature' || S.night >= 6); if (!front.length) return null;
    // two or three routes: prefer variety in rarity, nearest rings first
    const extra = ST.flags.scout ? 1 : 0; ST.flags.scout = false;
    const offers = rng.shuffle(front.map(r => ctx.districtOffer(r))).sort((a, b) => a.ring - b.ring).slice(0, Math.min(3 + extra, front.length));
    const price = o => (o.ring >= 2 ? { gold: 8 + S.night / 2 | 0, food: 4 } : { gold: 5 });
    return { kind: 'district', eyebrow: DISTRICT_CALL.eyebrow, title: DISTRICT_CALL.title, scene: DISTRICT_CALL.scene, offers,
      choices: offers.map(o => ({ id: `d${o.region}`, label: o.name, rarity: o.rarity, cost: price(o), hint: `${o.call}${o.lm && LM[o.lm] ? ` Inside: ${LM[o.lm].name} (${LM[o.lm].desc.split(':')[0].toLowerCase()}).` : ''} · ${o.dir}${o.ring >= 2 ? ' · far: a big district' : ''}${o.nest ? ' · a hive nests there' : ''}`, fx: [{ op: 'open', region: o.region, why: '' }] })).concat([{ id: 'later', label: DISTRICT_CALL.later.label, hint: DISTRICT_CALL.later.hint, fx: DISTRICT_CALL.later.fx }]) };
  }
  function siteEncounter(l) {
    const T = SITES[l.kind] || SITES.default, D = SITES.default, L = LM[l.kind], strip = 6 + 2 * (L.cost || 6);
    return { kind: 'site', site: l.id, eyebrow: `[${L.name}]`, title: L.name, scene: T.scene || D.scene,
      choices: [
        { id: 'claim', label: T.claim || D.claim, hint: `${L.desc}${L.manual ? ` Inside: a field manual (${FAM_NAME[L.manual]} blessings).` : ''}${L.cost ? ` Costs ${L.cost} scrap.` : ''}`, cost: { gold: L.cost || 0 }, fx: [{ op: 'claimSite', site: l.id }] },
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
    const ln = ['district', 'chapter', 'season', 'evolve', 'system'].includes(enc.kind) && !(enc.kind === 'district' && choiceId !== 'later') ? null : leanOf(c);
    if (ln && ctx.addPath) ctx.addPath(ln, enc.kind === 'thread' ? 1.5 : 1);
    if (enc.kind === 'district' && choiceId !== 'later' && ctx.addPath) ctx.addPath('ranger', 0.4);
    if (enc.kind === 'site') { ST.quests = ST.quests.filter(q => q.site !== enc.site || choiceId === 'leave'); if (choiceId === 'leave') ST.visited[enc.site] = S.night; }
    if (ctx.gainXp) ctx.gainXp(enc.kind === 'thread' ? 25 : enc.kind === 'street' ? 12 : enc.kind === 'site' ? 0 : 5);
    const line = enc.aiChron || `${enc.title}: "${c.label.replace(/[[\]]/g, '')}"`;
    chron(line, enc.kind === 'thread' ? 4 : 2, enc.thread ? [enc.thread] : []);
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

  // ---------- the trial: a class is earned out in the city, not picked from a menu ----------
  const FAMN = { hero: 'Brawn', ranger: 'Aim', scavver: 'Wits', heart: 'Heart' };
  function pathText() { const P = S.path, tot = Object.values(P).reduce((a, b) => a + b, 0) || 1; return Object.keys(P).sort((a, b) => P[b] - P[a]).filter(k => P[k] > 0).map(k => `${FAMN[k]} ${Math.round(P[k] / tot * 100)}%`).join(', ') || 'unwritten'; }
  function offerTrial(opts, from) {
    const fin = !!opts[0].second, desc = H => `${H.attack ? (H.attack.kind === 'melee' ? 'Fights up close' : 'Fights from range') : 'Never fights'} · ability: ${H.ability.name} · ${H.hp} health`;
    push({ kind: 'evolve', from, eyebrow: fin ? '[Final class quest]' : '[Job change quest]', title: fin ? 'The last door' : 'The System has been watching',
      scene: `${fin ? 'Your Calling has grown into something else.' : 'Every choice you made was written down.'} Your path: **${pathText()}**. ${fin ? 'One door is left. Behind it, your final class.' : 'The System knows what you are becoming.'} It wants proof: **a trial waits in the city.**`,
      choices: opts.map(o => { const H = ctx.heroes[o.cls]; return { id: `trial-${o.cls}`, label: `Trial of the ${H.name}`, hint: `${H.blurb} ${desc(H)}. A marked place in the city: walk there and win the fight.`, fx: [{ op: 'trial', cls: o.cls, from, second: o.second || null }] }; })
        .concat([{ id: 'wait', label: 'Not yet', hint: 'The window waits. It comes back at dawn.', fx: [{ op: 'evolveLater', from }] }]) });
  }
  function startTrial(f) {
    if (S.heroClass !== f.from) return;
    const spot = ctx.findSpot();
    ST.encounters = ST.encounters.filter(e => e.kind !== 'evolve'); ST.evoLater = null;
    if (!spot) { trialWon({ cls: f.cls, from: f.from, second: f.second }); return; }
    const H = ctx.heroes[f.cls];
    ST.trial = { cls: f.cls, from: f.from, second: f.second, x: spot.x, y: spot.y, day: S.night, started: false, done: false, name: `Trial of the ${H.name}` };
    toast(`[Trial accepted: ${H.name}] A **red marker** shows where. Walk there by day and win the fight.`, 'win');
  }
  function trialWon(t) {
    if (ST.trial) ST.trial.done = true;
    if (S.heroClass !== t.from) return;
    if (t.second) S.evo.second = t.second;
    apply({ op: 'evolve', cls: t.cls, from: t.from }, null);
    grant(t.second ? 'ascended' : 'called');
  }
  function seasonCard(def, n, rule) {
    ST.seasons = ST.seasons || []; ST.seasons.push({ n, name: def.name, day: S.night });
    chron(`Season ${n} began: ${def.name}.`, 4, ['season']);
    push({ kind: 'season', eyebrow: `[Season ${n}]`, title: def.name, scene: def.blurb,
      choices: [{ id: 'begin', label: 'Begin the season', hint: `${rule ? `New rule: **${rule.name}**. ${rule.desc} ` : ''}Finale on night ${seasonEnd(n)}: **${def.finale}**.`, fx: [] }] });
  }

  // ---------- the director: what comes at dawn ----------
  function dawn() {
    ST.day = S.night; deeds();
    // the System wakes up after the first night (the darkest moment), with its gift
    if (S.night === 2 && !ST.gifted) { ST.gifted = true; push({ kind: 'gift', eyebrow: GIFT.eyebrow, title: GIFT.title, scene: `${SYSTEM.intro} ${GIFT.scene}`, choices: GIFT.choices.map(c => ({ ...c })) }); chron('The status window opened.', 4); }
    for (const n of ST.npcs) n.chatToday = 0;
    if (ST.threads.hummer && ST.threads.hummer.status === 'open' && ST.threads.hummer.stage === 1) S.food = Math.max(0, S.food - 1);   // the caged one eats
    S.food += (ST.garden || 0) + (ST.flags.garden ? 1 : 0) + bonus.food();
    // threads that waited too long fail with a cost
    for (const [tid, th] of Object.entries(ST.threads)) if (th.status === 'waiting' && S.night >= th.failAt) { th.status = 'failed'; toast(`[Quest failed: ${THREADS[tid].title}] Too late.`, 'bad'); chron(`Too late for ${THREADS[tid].title}.`, 3, [tid]); }
    let shown = 0;
    // after each blood moon: the chapter closes, told back to you
    if (S.night > 2 && (S.night - 1) % 5 === 0) {
      const ch = (S.night - 1) / 5, lines = ST.chronicle.filter(c => c.day > S.night - 6 && c.imp >= 3).map(c => `Day ${c.day}: ${c.text}`);
      const text = lines.length ? lines.slice(-6).join(' · ') : 'Five days of walls, smoke and small mercies.';
      ST.saga = ST.saga || []; ST.saga.push({ chapter: ch, day: S.night, text });
      push({ kind: 'chapter', eyebrow: `[Chapter ${ch} complete]`, title: `Chapter ${ch}: ${['First Light', 'The Grid', 'Under the City', 'The Long Road', 'Hollowmere Rising'][Math.min(4, ch - 1)]}`, scene: `The blood moon sets. The System scrolls back through the last five days. ${text}`,
        choices: [{ id: 'turn', label: 'Turn the page', hint: 'The next chapter begins.', fx: [] }] });
    }
    if (ST.evoLater && S.heroClass === ST.evoLater.from) { const e = ST.evoLater; ST.evoLater = null; push(e.enc); }   // does not take a story slot
    else if (ST.evoLater) ST.evoLater = null;
    // a new thread starts on its day
    const startOk = T => S.night >= T.start.day && (!T.start.feat || S.feat[T.start.feat] || S.night >= T.start.day + 4);
    for (const [tid, T] of Object.entries(THREADS)) if (!ST.threads[tid] && startOk(T) && shown < 1) { ST.threads[tid] = { stage: 0, status: 'open', cast: {}, since: S.night }; push(threadEncounter(tid, 0)); shown++; }
    // dawn stages of running threads
    for (const [tid, th] of Object.entries(ST.threads)) {
      if (th.status !== 'open' || shown >= 2) continue;
      const st = THREADS[tid].stages[th.stage]; if (!st || st.at !== 'dawn' || th.stage === 0) continue;
      if (S.night - th.since < (st.after || 0)) continue;
      if (st.needs === 'uniqueDone' && !(S.unique && S.unique.slain)) { if (S.unique && S.unique.escaped) { S.unique.escaped = false; S.unique.night = nextMoon(S.night); toast(`[Unique Monster: ${S.unique.name}] It got away. It will be back on the next blood moon.`, 'bad'); } continue; }
      push(threadEncounter(tid, th.stage)); shown++;
    }
    if (S.unique && S.unique.season && S.unique.escaped && !S.unique.slain) { S.unique.escaped = false; S.unique.night = nextMoon(S.night); toast(`[Unique Monster: ${S.unique.name}] It got away. It will be back on the next blood moon.`, 'bad'); }
    if (ST.beacon || ST.flags.beacon) { const n = (ST.beacon || 0) + (ST.flags.beacon ? 1 : 0); ST.beacon = 0; ST.flags.beacon = false; S.survivors += n; toast(`Strangers walked in under your flag. +${n} people.`, 'good'); }
    placeSpots();
    // quiet dawns: a small moment, once each
    if (!shown && S.night >= 3 && rng.next() < 0.6) { ST.ambient = ST.ambient || []; const pool = AMBIENT.filter(a => !ST.ambient.includes(a.id) && a.when(S)); if (pool.length) { const a = pool[rng.int(pool.length)]; ST.ambient.push(a.id); push({ kind: 'ambient', eyebrow: a.eyebrow, title: a.title, scene: a.scene, choices: a.choices.map(c => ({ ...c })) }); shown++; } }
    // a route out of the fences every other day (and whenever none opened for three days)
    const front = ctx.frontier();
    if (front.length && S.feat.routes && shown < 2 && (S.night % 2 === 0 || S.night - ST.lastOpen >= 3)) { const e = districtEncounter(); if (e) { push(e); shown++; } }
    episode();
  }
  // every day is an episode: a title card at dawn, like an anime
  function episode() {
    const sn = S.season ? S.season.n : 1, k = S.night - (sn > 1 ? seasonEnd(sn - 1) : 0);
    const first = ST.encounters.find(e => e.kind === 'thread' || e.kind === 'season' || e.kind === 'ambient');
    const title = (sn === 1 && EPISODES[k - 1]) || (first && first.title.replace(/[[\]]/g, '')) || ['Smoke on the Horizon', 'Another Wall', 'Small Mercies', 'The Long Afternoon', 'Quiet Before', 'Footsteps'][S.night % 6];
    ST.episode = { season: sn, n: k, title }; ST.episodes = ST.episodes || []; ST.episodes.push({ day: S.night, title }); if (ST.episodes.length > 60) ST.episodes.shift();
    ev('episode', { season: sn, n: k, title });
  }
  /** the hero walks up to a site: its story (or the thread waiting there) plays */
  // ---------- street encounters: markers in the open districts, found by walking there ----------
  function placeSpots() {
    ST.spots = ST.spots.filter(sp => S.night - sp.day < 3);
    ST.streetUsed = ST.streetUsed || [];
    const want = Math.min(S.night < 2 ? 1 : 2, map.regions.filter(r => r.ring > 0 && !S.sealed[r.id]).length);
    for (let k = ST.spots.length; k < want; k++) {
      const pool = STREET.filter(e => !ST.streetUsed.includes(e.id));
      const spot = ctx.findSpot(); if (!spot) return;
      let kind;
      if (pool.length) { const e = pool[rng.int(pool.length)]; ST.streetUsed.push(e.id); kind = e.id; }
      else { kind = `gen${ST.nextId}`; ST.gen = ST.gen || {}; ST.gen[kind] = genStreet(); }
      ST.spots.push({ id: ST.nextId++, kind, x: spot.x, y: spot.y, day: S.night });
      ctx.guard(spot.x, spot.y, Math.min(5, 2 + Math.floor(S.night / 4)));
    }
  }
  // a made-up find: who, where, and what they need (numbers scale a little with the day)
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
      ST.spots.splice(ST.spots.indexOf(sp), 1);
      const e = STREET.find(x => x.id === sp.kind) || (ST.gen && ST.gen[sp.kind]); if (!e) return false;
      push({ kind: 'street', eyebrow: e.eyebrow, title: e.title, scene: e.scene, choices: e.choices.map(c => ({ ...c })), npc: e.npc || undefined, ai: e.made ? { title: e.title, beats: e.beats, scene: e.scene, labels: {}, line: null, chronicle: null } : null });
      if (ST.gen) delete ST.gen[sp.kind];
      return true;
    }
    return false;
  }
  let tipT = 0;
  function tips() {
    if ((tipT -= 0.25) > 0) return; ST.tips = ST.tips || [];
    for (const t of TIPS) if (!ST.tips.includes(t.id) && (S.night >= 2 || t.day1) && t.when(S, ctx.api())) { ST.tips.push(t.id); toast(t.text, t.day1 ? 'sys' : 'win'); tipT = 20; return; }
  }
  function tick() {
    tips();
    const tr = ST.trial;
    if (tr && !tr.done && !tr.started && !S.hero.dead && Math.hypot(S.hero.x - tr.x, S.hero.y - tr.y) < 3) { tr.started = true; ctx.spawnTrial(tr); toast(`[${tr.name}] Defeat the **trial warden**. It will not follow you home.`, 'bad'); }
    if (S.phase !== 'day' || ST.encounters.length || S.hero.dead) return;
    if (spotTick()) return;
    for (const l of S.landmarks) if (typeof ST.visited[l.id] === 'number' && ST.visited[l.id] < S.night && !ctx.landmarkReach(l)) ST.visited[l.id] = false;   // left yesterday: it can ask again
    for (const l of S.landmarks) {
      if (l.owned || l.stripped || l.kind === 'unknown' || S.sealed[l.region] || ST.visited[l.id] || !ctx.landmarkReach(l)) continue;
      ST.visited[l.id] = true;
      const tid = Object.keys(ST.threads).find(t => ST.threads[t].status === 'open' && ST.threads[t].region === l.region && THREADS[t].stages[ST.threads[t].stage].at === 'site');
      push(tid ? threadEncounter(tid, ST.threads[tid].stage) : siteEncounter(l));
      return;
    }
  }
  function start() {
    chron('Woke up in the fallen city with a bus full of strangers.', 5);
    placeSpots(); episode();
  }
  /** bonuses companions and story give the town */
  const bonus = {
    power: () => ST.power + ST.npcs.reduce((a, n) => a + (n.alive && n.joined && !n.withHero && ROLES[n.role].power || 0), 0),
    hands: () => ST.hands + ST.npcs.reduce((a, n) => a + (n.alive && n.joined && !n.withHero && ROLES[n.role].hands || 0), 0),
    towers: () => ST.npcs.reduce((a, n) => a + (n.alive && n.joined && !n.withHero && ROLES[n.role].towers || 0), 0),
    lullaby: () => { const n = npcByRole('revenant'); return n && n.joined && !n.withHero ? (n.named ? 0.65 : ROLES.revenant.lullaby) : 1; },
    heat: () => (ST.flags.quiet ? 0.85 : 1),
    food: () => ST.npcs.reduce((a, n) => a + (n.alive && n.joined && !n.withHero && ROLES[n.role].food || 0), 0),
    regen: () => ST.npcs.reduce((a, n) => a + (n.alive && n.joined && ROLES[n.role].regen || 0), 0),
  };
  // ---------- side quests the Chronicler invents: Claude picks a template and writes it; the engine owns the effects ----------
  const NEW_ROLES = ['scout', 'medic', 'cook', 'mechanic', 'gunner'];
  const sgn = n => (n > 0 ? `+${n}` : `${n}`);
  function describe(fx, npcData) {
    const out = [];
    for (const f of fx) {
      if (f.op === 'survivors') out.push(`${sgn(f.n)} people`); else if (f.op === 'food') out.push(`${sgn(f.n)} food`); else if (f.op === 'gold') out.push(`${sgn(f.n)} scrap`);
      else if (f.op === 'heat' && S.feat.heat) out.push(`${sgn(f.n)} heat`); else if (f.op === 'flag' && f.key === 'beacon') out.push('+1 person at dawn');
      else if (f.op === 'blessing') out.push('a rare blessing'); else if (f.op === 'hurt') out.push('you get hurt'); else if (f.op === 'hands') out.push(`${sgn(f.n)} pair of hands for good`);
      else if (f.op === 'perk' && f.key === 'heroDmg') out.push(`+${f.add} hero damage`); else if (f.op === 'recruitNew' && npcData) out.push(`${npcData.name.split(' ')[0]} joins as your ${ROLES[npcData.role].post.toLowerCase()}: ${ROLES[npcData.role].bonus}`);
    }
    return out.length ? `${out.join(', ')}.` : 'Nothing changes.';
  }
  const clip = (v, n) => String(v ?? '').replace(/[<>[\]{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  /** a quest from the Chronicler: validated, given engine-owned effects, placed as a beacon in the city */
  function invent(q) {
    if (!q || typeof q !== 'object' || ST.inventDay === S.night) return false;
    const T = QUEST_TEMPLATES[q.template]; if (!T) return false;
    let npc = null;
    if (T.who) {
      const c = q.character || {}; const role = q.template === 'recruit' ? (NEW_ROLES.includes(c.role) ? c.role : NEW_ROLES[rng.int(NEW_ROLES.length)]) : null;
      const traits = (Array.isArray(c.traits) ? c.traits : []).map(t => clip(t, 18)).filter(Boolean).slice(0, 3);
      npc = { name: clip(c.name, 28) || 'A stranger', epithet: clip(c.epithet, 32) || 'a stranger', traits: traits.length ? traits : ['wary'], quirk: clip(c.quirk, 60) || 'keeps to themselves', want: clip(c.want, 60) || 'to live', fear: clip(c.fear, 60) || 'the dark', secret: clip(c.secret, 120) || 'nothing they will say', role: role || 'scout' };
      if (ST.npcs.some(n => n.name === npc.name)) npc.name = `${npc.name.split(' ')[0]} the Second`;
    }
    const beats = (Array.isArray(q.beats) ? q.beats : []).map(b => clip(String(b).replace(/\*\*/g, '§'), 200).replace(/§(.+?)§/g, '**$1**').replace(/§/g, '')).filter(b => b.length >= 8).slice(0, 3);
    if (!beats.length) return false;
    const labels = {}; for (const c of Array.isArray(q.choices) ? q.choices : []) if (c && T.choices.some(t => t.id === c.id)) labels[c.id] = clip(c.label, 44);
    const choices = T.choices.map(t => { const fx = t.fx(S.night); return { id: t.id, label: labels[t.id] || t.label, hint: describe(fx, npc), cost: t.cost ? t.cost(S.night) : undefined, fx }; });
    const spot = ctx.findSpot(); if (!spot) return false;
    const kind = `ai${ST.nextId++}`; ST.gen = ST.gen || {};
    ST.gen[kind] = { eyebrow: clip(q.eyebrow, 40) ? `[${clip(q.eyebrow, 40)}]` : '[Side quest]', title: clip(q.title, 48) || 'A side quest', scene: beats.join(' '), beats, choices, npc, made: true, callback: clip(q.callback, 120) };
    ST.spots.push({ id: ST.nextId++, kind, x: spot.x, y: spot.y, day: S.night, made: true });
    ctx.guard(spot.x, spot.y, Math.min(5, 2 + Math.floor(S.night / 4)));
    ST.inventDay = S.night; ST.invented = (ST.invented || 0) + 1;
    toast(`[New side quest: ${ST.gen[kind].title}] A **blue beacon** marks it in the city.`, 'sys');
    return true;
  }
  // what the AI needs to write an encounter in this run's voice
  function context() {
    const owned = S.landmarks.filter(l => l.owned).map(l => LM[l.kind].name);
    return {
      city: map.name, day: S.night, phase: S.phase, people: ctx.pop(), heat: Math.round(S.heat), keepLevel: S.keep.level,
      districtsOpen: map.regions.filter(r => !S.sealed[r.id]).length, sites: owned, titles: ST.titles.map(t => TITLES[t].name),
      companions: ST.npcs.filter(n => n.alive && n.joined).map(n => ({ name: n.name, role: ROLES[n.role].post, bond: n.bond, traits: n.persona.traits.join(', '), quirk: n.persona.quirk })),
      chronicle: ST.chronicle.slice(-10).map(c => `day ${c.day}: ${c.text}`),
    };
  }
  /** everything the Chronicler needs to invent the next quest: the whole run so far */
  function fullContext() {
    const base = context();
    return { ...base, chronicle: ST.chronicle.slice(-40).map(c => `day ${c.day}: ${c.text}`), season: S.season ? `${S.season.n}: ${S.season.name}` : '1',
      hero: { class: ctx.heroes[S.heroClass].name, level: S.lvl, path: pathText() },
      threads: Object.entries(ST.threads).map(([id, t]) => `${THREADS[id].title}: ${t.status}`),
      districts: map.regions.filter(r => r.ring > 0 && !S.sealed[r.id]).map(r => { const l = ctx.siteOf(r.id); return l ? LM[l.kind].name : 'streets'; }),
      people: ST.npcs.filter(n => n.alive).map(n => `${n.name} (${n.joined ? ROLES[n.role].post : 'met'})`),
      episode: ST.episode ? ST.episode.title : null };
  }
  return { invent, fullContext, offerTrial, trialWon, seasonCard, pathText, start, dawn, tick, choose, can, bonus, context, chron, npc, grant, rarityColor: r => (RARITY[r] || RARITY.common).color };
}
