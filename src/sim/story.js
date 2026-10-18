// The story engine: decides which encounter comes next and applies every effect. Deterministic (own RNG).
// Claude may rewrite an encounter's words (see ui/story-ai.js), never its choices' effects.
//
// S.story = { day, encounters (queue shown as cards), threads {id: {stage, status, cast, region, failAt}},
//   npcs [], titles [], chronicle [], flags {}, quests [], power, hands, visited {} }
import { GIFT, TITLES, DISTRICT_CALL, SITES, THREADS, ROLES, SYSTEM } from '../content/story.js';
import { RARITY } from '../content/districts.js';

export function createStory(ctx) {
  const { S, map, rng, toast, ev } = ctx;
  const ST = S.story = { day: 1, encounters: [], threads: {}, npcs: [], titles: [], chronicle: [], flags: {}, quests: [], power: 0, hands: 0, visited: {}, nextId: 1, lastOpen: 0 };
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
    const n = { id, role, name: c.names[rng.int(c.names.length)], epithet: c.epithet, persona: { ...c.persona }, secret: c.secret, bond: 1, alive: true, joined: false, named: false, thread: threadId, chatToday: 0, memory: [] };
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
      case 'food': S.food = Math.max(0, S.food + f.n); break;
      case 'survivors': S.survivors += f.n; break;
      case 'heat': ctx.addHeat(f.n); break;
      case 'power': ST.power += f.n; break;
      case 'hands': ST.hands += f.n; break;
      case 'handsToday': S.handsUsed -= f.n; break;
      case 'perk': if (f.mul) S.P[f.key] *= f.mul; else S.P[f.key] += f.add; ctx.refreshMax(); break;
      case 'flag': ST.flags[f.key] = true; break;
      case 'title': grant(f.id); break;
      case 'blessing': S.picks.push('chest'); ctx.syncPicks(); break;
      case 'openFor': {   // open (or point to) a district of this kind for the thread
        const r = districtFor(f.kit);
        if (r !== null) { S.kits[r] = S.kits[r] || f.kit; if (S.sealed[r]) ctx.openDistrict(r, `${THREADS[enc.thread].title}.`); if (th) th.region = r; const l = ctx.siteOf(r); if (l) addQuest(l, enc.thread); }
        break;
      }
      case 'open': ctx.openDistrict(f.region, f.why); ST.lastOpen = S.night; { const l = ctx.siteOf(f.region); if (l && !l.owned) addQuest(l, null); } break;
      case 'recruit': { const n = castFor(enc.thread, f.role); n.joined = true; toast(`[${n.name} joined] ${ROLES[n.role].post}: ${ROLES[n.role].bonus}.`, 'good'); chron(`${n.name} joined the town as its ${ROLES[n.role].post.toLowerCase()}.`, 4, [n.id]); ev('recruit', { id: n.id }); break; }
      case 'lose': { const n = th && npc(th.cast[f.role]); if (n) { n.alive = false; n.joined = false; chron(`${n.name} left the town.`, 4, [n.id]); } break; }
      case 'bond': { const n = th && npc(th.cast[f.role]); if (n) n.bond = Math.max(-3, Math.min(5, n.bond + f.n)); break; }
      case 'name': { const n = th && npc(th.cast[f.role]); if (n) { n.named = true; n.name = ctx.reviveName ? ctx.reviveName() : n.name; S.drained = S.night; toast(`[Naming complete] It answers to a name now. It feels stronger. You feel weaker tonight.`, 'good'); chron(`Named one of the dead: ${n.name}.`, 5, [n.id]); } break; }
      case 'claimHere': { const l = th && th.region !== undefined && ctx.siteOf(th.region); if (l && !l.owned) ctx.claimFree(l.id); break; }
      case 'risen': ctx.risen(f.n); break;
      case 'gamble': if (rng.next() >= f.p) for (const b of f.bad) apply(b, enc); else toast('The fever broke at dawn. He lives.', 'good'); break;
      case 'advance': if (th) { th.stage++; th.since = S.night; } break;
      case 'resolve': if (th) { th.status = 'done'; } break;
      case 'fail': if (th) { if (f.after) { th.status = 'waiting'; th.failAt = S.night + f.after; } else th.status = 'failed'; } break;
    }
  }
  function districtFor(kit) {
    const front = ctx.frontier();
    // a region already holding this kit, else an unassigned frontier region, else any frontier region
    const have = Object.keys(S.kits).map(Number).find(r => S.kits[r] === kit && S.sealed[r] && front.includes(r));
    if (have !== undefined) return have;
    const free = front.filter(r => !S.kits[r]); const pool = free.length ? free : front.filter(r => S.kits[r] !== 'signature');
    if (!pool.length) return null;
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
  function push(enc) { enc.id = ST.nextId++; enc.ai = enc.ai || null; ST.encounters.push(enc); ev('encounter', { id: enc.id, kind: enc.kind }); }
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
    const offers = rng.shuffle(front.map(r => ctx.districtOffer(r))).sort((a, b) => a.ring - b.ring).slice(0, Math.min(3, front.length));
    return { kind: 'district', eyebrow: DISTRICT_CALL.eyebrow, title: DISTRICT_CALL.title, scene: DISTRICT_CALL.scene, offers,
      choices: offers.map(o => ({ id: `d${o.region}`, label: o.name, rarity: o.rarity, hint: `${o.call} · ${o.dir}${o.nest ? ' · a hive nests there' : ''}`, fx: [{ op: 'open', region: o.region, why: '' }] })).concat([{ id: 'later', label: DISTRICT_CALL.later.label, hint: DISTRICT_CALL.later.hint, fx: DISTRICT_CALL.later.fx }]) };
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
    if (enc.kind === 'site') { ST.quests = ST.quests.filter(q => q.site !== enc.site || choiceId === 'leave'); if (choiceId === 'leave') ST.visited[enc.site] = false; }
    const line = enc.aiChron || `${enc.title}: ${c.label}.`;
    chron(line, enc.kind === 'thread' ? 4 : 2, enc.thread ? [enc.thread] : []);
    ST.encounters.shift(); ev('chosen', { enc: enc.id, choice: choiceId, kind: enc.kind });
    return true;
  }

  // ---------- the director: what comes at dawn ----------
  function dawn() {
    ST.day = S.night; deeds();
    for (const n of ST.npcs) n.chatToday = 0;
    if (ST.flags.caged && !(ST.threads.hummer && ST.threads.hummer.status === 'done')) S.food = Math.max(0, S.food - 1);
    if (ST.flags.garden) S.food += 1;
    // threads that waited too long fail with a cost
    for (const [tid, th] of Object.entries(ST.threads)) if (th.status === 'waiting' && S.night >= th.failAt) { th.status = 'failed'; toast(`[Quest failed: ${THREADS[tid].title}] Too late.`, 'bad'); chron(`Too late for ${THREADS[tid].title}.`, 3, [tid]); }
    let shown = 0;
    // a new thread starts on its day
    for (const [tid, T] of Object.entries(THREADS)) if (!ST.threads[tid] && S.night >= T.start.day && shown < 1) { ST.threads[tid] = { stage: 0, status: 'open', cast: {}, since: S.night }; push(threadEncounter(tid, 0)); shown++; }
    // dawn stages of running threads
    for (const [tid, th] of Object.entries(ST.threads)) {
      if (th.status !== 'open' || shown >= 2) continue;
      const st = THREADS[tid].stages[th.stage]; if (!st || st.at !== 'dawn' || th.stage === 0) continue;
      if (S.night - th.since < (st.after || 0)) continue;
      push(threadEncounter(tid, th.stage)); shown++;
    }
    // a route out of the fences every other day (and whenever none opened for three days)
    const front = ctx.frontier();
    if (front.length && S.night >= 2 && shown < 2 && (S.night % 2 === 0 || S.night - ST.lastOpen >= 3)) { const e = districtEncounter(); if (e) { push(e); shown++; } }
  }
  /** the hero walks up to a site: its story (or the thread waiting there) plays */
  function tick() {
    if (S.phase !== 'day' || ST.encounters.length || S.hero.dead) return;
    for (const l of S.landmarks) {
      if (l.owned || l.stripped || l.kind === 'unknown' || S.sealed[l.region] || ST.visited[l.id] || !ctx.landmarkReach(l)) continue;
      ST.visited[l.id] = true;
      const tid = Object.keys(ST.threads).find(t => ST.threads[t].status === 'open' && ST.threads[t].region === l.region && THREADS[t].stages[ST.threads[t].stage].at === 'site');
      push(tid ? threadEncounter(tid, ST.threads[tid].stage) : siteEncounter(l));
      return;
    }
  }
  function start() {
    push({ kind: 'gift', eyebrow: GIFT.eyebrow, title: GIFT.title, scene: `${SYSTEM.intro}\n\n${GIFT.scene}`, choices: GIFT.choices.map(c => ({ ...c })) });
    chron('Woke up in the fallen city with a status window and a bus full of strangers.', 5);
  }
  /** bonuses companions and story give the town */
  const bonus = {
    power: () => ST.power + ST.npcs.reduce((a, n) => a + (n.alive && n.joined && ROLES[n.role].power || 0), 0),
    hands: () => ST.hands + ST.npcs.reduce((a, n) => a + (n.alive && n.joined && ROLES[n.role].hands || 0), 0),
    lullaby: () => { const n = npcByRole('revenant'); return n && n.joined ? (n.named ? 0.65 : ROLES.revenant.lullaby) : 1; },
    heat: () => (ST.flags.quiet ? 0.85 : 1),
  };
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
  return { start, dawn, tick, choose, can, bonus, context, chron, npc, grant, rarityColor: r => (RARITY[r] || RARITY.common).color };
}
