// Seasons as contracts you can win. The engine builds each offer (rule + finale + reward, every number), checks the
// finale, pays the reward or ends the run. Words come from content/contracts.js or, when on, the Chronicler: the AI
// patch is validated by ui/story-ai.js parseContract and may only change names, framing and the twist.
//
// S.story.contract = { n, id, name, rule, finale: { kind: 'unique'|'hive', name, night, region?, mult? }, reward, won, lost, told }
// S.story.rules = every rule chosen so far (they stack); mirrored into S.season.rules and S.season.rule (the newest).
import { CONTRACT, CONTRACT_RULES, CONTRACT_COPY, FINALE_NAMES, FINALE_ADJ, FINALE_NOUN } from '../content/contracts.js';
import { RULES, SEASONS, seasonEnd } from '../content/season.js';
import { hiveName } from '../content/names.js';

const fillT = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined ? v[k] : ''));

export function createContracts(ctx) {
  const { S, map, rng, toast, ev } = ctx;
  const ST = () => S.story;

  // a hive the hero could plausibly burn this season: alive, open (not behind the old fence), ring by season
  function hiveFor(n, avoid = []) {
    const c = map.town.x, maxRing = n <= 1 ? 1 : 2;
    const cands = map.regions.filter(r => r.nest && S.nestAlive[r.id] && !S.claimed.has(r.id) && !S.sealed[r.id] && r.ring >= 1 && r.ring <= maxRing && !avoid.includes(r.id));
    if (!cands.length) return null;
    cands.sort((a, b) => Math.hypot(a.nest.x - c, a.nest.y - c) - Math.hypot(b.nest.x - c, b.nest.y - c));
    return cands[Math.min(cands.length - 1, n <= 1 ? 1 : 0)] || cands[0];
  }
  function monsterName(n, k) {
    if (k === 0 && FINALE_NAMES[n - 1]) return FINALE_NAMES[n - 1];
    return `The ${FINALE_ADJ[rng.int(FINALE_ADJ.length)]} ${FINALE_NOUN[rng.int(FINALE_NOUN.length)]}`;
  }
  /** the offer for season n: 2–3 options, all numbers decided here */
  function build(n) {
    const st = ST(), have = st.rules || [];
    const night = seasonEnd(n);
    const fresh = rng.shuffle(CONTRACT_RULES.filter(r => !have.includes(r)));
    const ruleAt = k => (n <= 1 && k === 0 ? null : fresh[k] || null);   // season 1 can be won with no new rule
    const opts = [];
    const m1 = monsterName(n, 0);
    opts.push({ id: 'c1', rule: ruleAt(0), finale: { kind: 'unique', name: m1, night, mult: +CONTRACT.mult(n).toFixed(2) }, reward: CONTRACT.reward(n) });
    const hv = hiveFor(n);
    if (hv) opts.push({ id: 'c2', rule: ruleAt(1), finale: { kind: 'hive', name: hiveName(map.seed, hv.id), region: hv.id, night }, reward: CONTRACT.reward(n) });
    let m2 = monsterName(n, 1); for (let t = 0; t < 5 && m2 === m1; t++) m2 = monsterName(n, 1);
    opts.push({ id: 'c3', rule: ruleAt(2) || ruleAt(1) || fresh[0] || null, finale: { kind: 'unique', name: m2, night, mult: +CONTRACT.bigMult(n).toFixed(2) }, reward: CONTRACT.bigReward(n), big: true });
    for (const o of opts) o.name = scriptName(o, n);
    return opts.slice(0, CONTRACT.options);
  }
  function scriptName(o, n) {
    const L = CONTRACT_COPY.names[o.finale.kind];
    return fillT(L[(n + o.id.charCodeAt(1)) % L.length], { finale: o.finale.name.replace(/^The /, ''), hive: o.finale.name, night: o.finale.night });
  }
  /** a scripted twist hung on the most recent thing the run has: a companion, a thread, a place, the Mark */
  function scriptTwist(o, hooks) {
    const T = CONTRACT_COPY.twist, h = hooks || {};
    const v = { finale: o.finale.name };
    if (o.id === 'c1' && h.companion) return fillT(T.companion, { ...v, hook: h.companion });
    if (o.id === 'c2' && h.place) return fillT(T.place, { ...v, hook: h.place });
    if (o.id === 'c3' && h.marked) return T.marked;
    if (h.thread) return fillT(T.thread, { ...v, hook: h.thread });
    return T.none[(o.id.charCodeAt(1) - 49) % T.none.length];
  }
  const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  const dirOf = (x, y) => DIRS[((Math.round(Math.atan2(y - map.town.y, x - map.town.x) / (Math.PI / 4)) % 8) + 8) % 8];
  /** where a finale is: a hive has a place on the map; a monster comes to the Camp */
  function placeOf(f) { if (f.kind !== 'hive') return null; const r = map.regions[f.region], n = r && r.nest; return n ? { x: n.x, y: n.y, dir: dirOf(n.x, n.y) } : null; }
  /** plain-text terms the card shows (engine-owned; the AI never writes these): goal, catch, reward, in that order */
  function terms(o) {
    const r = o.rule ? RULES[o.rule] : null, R = o.reward, Cc = CONTRACT_COPY, pl = placeOf(o.finale);
    const v = { finale: o.finale.name.replace(/^The /, 'the '), hive: o.finale.name, night: o.finale.night, dir: pl ? pl.dir : '' };
    const catches = [r ? (r.catch || r.desc) : null, o.big ? Cc.tough : null].filter(Boolean);
    return {
      tier: Cc.tiers[o.id] || Cc.tiers.c2,
      goal: fillT(Cc.goal[o.finale.kind], v),
      where: fillT(Cc.where[o.finale.kind], v),
      catch: catches.length ? catches.join(' ') : Cc.noCatch,
      gain: fillT(Cc.reward, { scrap: R.scrap }),
      legacy: fillT(Cc.legacy, { fame: R.fame }),
      rule: r ? { name: r.name, desc: r.desc } : { name: 'No new rule', desc: Cc.ruleFrame.none },
      finale: o.finale.kind === 'unique' ? `${o.finale.name} · night ${o.finale.night}` : `Burn ${o.finale.name} · by night ${o.finale.night}`,
      reward: `+${R.scrap} scrap · a rare blessing · easier nights · +${R.fame} Legacy`,
    };
  }
  /** the strip after signing: the objective and the nights left; where it is, if it has a place */
  function stripLine() {
    const k = ST().contract; if (!k || k.won || k.lost) return null;
    const left = Math.max(0, k.finale.night - S.night), pl = placeOf(k.finale);
    const short = k.finale.name.replace(/^The /, '');
    return { tag: '[Contract]', text: fillT(CONTRACT_COPY.strip[k.finale.kind], { finale: k.finale.name, hive: k.finale.name, night: k.finale.night, dir: pl ? pl.dir : '' }),
      extra: `Contract · ${left ? `${left} night${left === 1 ? '' : 's'}` : 'tonight'} · ${k.finale.kind === 'hive' ? `burn ${k.finale.name}` : `${k.finale.name.replace(/^The /, 'the ')} comes to the Camp`}`, place: pl, left, name: k.finale.name, kind: k.finale.kind };
  }
  function encounter(n, hooks) {
    const opts = build(n);
    return {
      kind: 'contract', season: n, eyebrow: fillT(CONTRACT_COPY.eyebrow, { n }), title: CONTRACT_COPY.title, scene: fillT(CONTRACT_COPY.scene, { night: seasonEnd(n) }),
      offers: opts.map(o => ({ ...o, frame: fillT(CONTRACT_COPY.frame[o.finale.kind], { finale: o.finale.name, hive: o.finale.name, night: o.finale.night }), twist: scriptTwist(o, hooks), terms: terms(o) })),
      choices: opts.map(o => ({ id: o.id, label: o.name, hint: `${terms(o).goal}. Catch: ${terms(o).catch}`, fx: [{ op: 'contract', id: o.id }] })),
    };
  }
  /** the player signs one */
  function sign(enc, id) {
    const o = enc.offers.find(x => x.id === id); if (!o) return false;
    const st = ST(), n = enc.season;
    const name = (enc.ai && enc.ai.names && enc.ai.names[id]) || o.name;
    st.rules = st.rules || [];
    if (o.rule && !st.rules.includes(o.rule)) st.rules.push(o.rule);
    // the engine owns the effects: the stacked rules and the finale go through game.js
    const a = ctx.api();
    if (a && a.setSeasonRules) a.setSeasonRules(st.rules); else { S.season.rules = st.rules.slice(); S.season.rule = st.rules[st.rules.length - 1] || null; }
    st.contract = { n, id, name, rule: o.rule, finale: { ...o.finale }, reward: { ...o.reward }, won: false, lost: false, told: false, twist: (enc.ai && enc.ai.twists && enc.ai.twists[id]) || o.twist, day: S.night };
    armFinale();
    ctx.chron(`Signed the contract "${name}": ${o.finale.kind === 'unique' ? `${o.finale.name} by night ${o.finale.night}` : `burn ${o.finale.name} by night ${o.finale.night}`}.`, 5, ['contract']);
    toast(`[Contract signed] ${terms(o).goal}.`, 'sys');
    ev('contract', { id, n, name });
    return true;
  }
  /** the contract's monster takes the finale night's unique slot (a story monster due that night moves to the next moon) */
  function armFinale() {
    const k = ST().contract; if (!k || k.won || k.lost) return;
    const a = ctx.api(); if (!a || !a.setFinale || !S.season || S.season.n !== k.n) return;
    if (k.finale.kind === 'hive') {
      if (S.season.finaleHive !== k.finale.region) a.setFinale({ kind: 'hive', region: k.finale.region, name: k.finale.name });
      if (S.unique && S.unique.season === k.n && !S.unique.contract && !S.unique.slain) S.unique = null;   // the season's default monster steps aside
      return;
    }
    const U = S.unique;
    if (U && U.contract && U.name === k.finale.name) return;
    if (U && !U.slain && !U.contract && !U.season && U.night !== k.finale.night) ST().uniqueLater = { ...U };
    a.setFinale({ kind: 'unique', name: k.finale.name, mult: k.finale.mult, night: k.finale.night });
    if (S.unique) S.unique.contract = true;
  }
  const won = () => { const k = ST().contract; if (!k || k.lost) return false; if (k.won) return true;
    return !!(S.season && S.season.n === k.n && S.season.won); };   // game.js decides the finale ('finale' event)
  /** checked a few times a second: the finale is won the moment it happens (the card waits for dawn) */
  function check() {
    const k = ST().contract; if (!k || k.won || k.lost) return null;
    if (!won()) return null;
    k.won = true; k.wonDay = S.night;
    ctx.chron(`Won the contract "${k.name}".`, 5, ['contract']);
    toast(`[Contract complete: ${k.name}] The reward waits at dawn.`, 'sys');
    ev('contractWon', { name: k.name });
    return k;
  }
  /** pay the reward (from the victory card) */
  function pay() {
    const k = ST().contract; if (!k || !k.won || k.paid) return;
    k.paid = true; ctx.earn(k.reward.scrap);
    if (k.reward.blessing) { S.picks.push('nest'); ctx.syncPicks(); }
    st().wins = (st().wins || 0) + 1; st().fame = (st().fame || 0) + k.reward.fame;
    const api = ctx.api();
    if (api && api.contractWon) api.contractWon(CONTRACT.reset);   // idempotent: the finale already stepped the curve back
    ctx.grant('contractor');
  }
  const st = ST;
  /** the dawn after the season's last night: a contract still open is lost, and the run ends with its name */
  function settle() {
    const k = ST().contract; if (!k || k.won || k.lost) return null;
    if (S.night <= k.finale.night) return null;
    if (won()) { check(); return null; }
    k.lost = true; ctx.chron(`Lost the contract "${k.name}".`, 5, ['contract']);
    return k;
  }
  return { encounter, sign, check, pay, settle, armFinale, terms, won, stripLine, placeOf, current: () => ST().contract || null, firstSeasonDay: CONTRACT.firstDay, SEASONS };
}
