// Blessings: the offer (dawn, chest, hive, mastery, field manual), whether a blessing is any use, rerolls,
// taking one.
import { FAMILIES, MASTERIES, NEEDS, NEST_POOL, ODDS, PERKS, REROLL, SYNERGIES } from '../content/perks.js';
import { HEROES } from '../content/heroes.js';

export function createBlessings(G) {
  const { S, fail, has, keep, mastery, perkRng, syncMastery, syncPicks, toast } = G;

  // ---------- blessings ----------
  function rollOffer() {
    syncPicks();
    if (!S.picks.length) { S.offer = []; S.offerSource = null; return; }
    const source = S.picks[0];
    S.offerSource = source;
    if (source.startsWith('mastery:')) { const fam = source.split(':')[1], ms = MASTERIES[fam].filter(m => perkOk(m.id)); S.offer = (ms.length ? ms : MASTERIES[fam]).map(m => `m:${m.id}`); return; }
    const manual = source.startsWith('manual:') ? source.split(':')[1] : null;   // a field manual found in a site: blessings of one family
    const usable = p => perkOk(p.id);   // filtered by what you have: walls, weapon, ability, companions
    // a burned hive: three of the curated run-changers you can use
    if (source === 'nest') {
      const nest = NEST_POOL.map(id => PERKS.find(p => p.id === id)).filter(p => p && (S.P.taken[p.id] || 0) < p.max && usable(p));
      const out = [], legs = nest.filter(p => p.rarity === 'legendary');
      if (legs.length) { const p = legs[perkRng.int(legs.length)]; out.push(p.id); nest.splice(nest.indexOf(p), 1); }   // a burned hive always holds a legendary
      while (out.length < 3 && nest.length) out.push(nest.splice(perkRng.int(nest.length), 1)[0].id);
      if (out.length >= 2) { S.offer = out; return; }
    }
    let pool = PERKS.filter(p => (S.P.taken[p.id] || 0) < p.max && usable(p) && (manual ? p.fam === manual && !p.pact : famOk(p.fam)));   // one kind of blessing; only special moments bring one
    if (manual && !pool.length) pool = PERKS.filter(p => (S.P.taken[p.id] || 0) < p.max && famOk(p.fam));
    const n = 3 + (source === 'dawn' ? (G.HC.extraOffer || 0) : 0);
    const odds = ODDS[manual ? 'chest' : source] || ODDS.dawn, out = [];
    const want = [];
    for (let k = 0; k < n; k++) {
      let r = perkRng.weighted(odds);
      if (r === 2 && source === 'dawn' && S.night < 10) r = 1;
      want.push(['common', 'rare', 'legendary'][r]);
    }
    if (source === 'chest' && !want.some(r => r !== 'common')) want[0] = 'rare';
    if (source === 'nest' && !want.includes('legendary')) want[0] = 'legendary';
    if (mastery('patronage') && !want.some(r => r !== 'common')) want[0] = 'rare';
    let pacts = 0;
    for (const rar of want) {
      let cands = pool.filter(p => !out.includes(p.id) && p.rarity === rar && !(p.pact && pacts));
      if (!cands.length) cands = pool.filter(p => !out.includes(p.id) && !(p.pact && pacts));
      if (!cands.length) break;
      const pk = cands[perkRng.weighted(cands.map(p => (1 + S.P.fam[p.fam] * 0.6) * famWeight(p.fam)))];
      if (pk.pact) pacts++;
      out.push(pk.id);
    }
    S.offer = out;
    if (!out.length) { S.picks.shift(); rollOffer(); }
  }
  /** is this blessing any use to you right now? (see NEEDS in content/perks.js) */
  function perkOk(id) {
    const need = NEEDS[id]; if (!need) return true;
    const A = G.HC.attack, ab = G.HC.ability && G.HC.ability.id;
    switch (need) {
      case 'walls': return S.buildings.filter(b => b.type === 'wall' && !b.ruined).length >= 4;
      case 'ranged': return !!A && A.kind === 'ranged';
      case 'melee': return !!A && A.kind === 'melee';
      case 'attack': return !!A;
      case 'warcry': case 'volley': case 'patch': case 'bounty': return ab === need;
      case 'purses': return !!G.HC.collects;
      case 'companion': return !!(S.story && S.story.npcs && S.story.npcs.some(n => n.joined && n.alive));
      case 'homes': return S.buildings.filter(b => b.type === 'house').length >= 4;
      case 'noise': return !!S.feat.heat;
      default: return true;
    }
  }
  // hero families: a Survivor sees all three; a Calling sees its own (and, rarer, the others: a second one makes the final class);
  // a final class sees its two
  function famOk(f) {
    const F = FAMILIES[f]; if (!F.hero) return true;
    const cls = S.heroClass, H = HEROES[cls];
    if (cls === 'survivor' || !H.base && !S.evo.final) return true;
    return [H.base || cls, S.evo.second].includes(F.hero);
  }
  function famWeight(f) {
    const F = FAMILIES[f]; if (!F.hero) return f === 'bow' ? 0.7 : 1;
    const cls = S.heroClass; if (cls === 'survivor') return 1.3;
    return F.hero === (HEROES[cls].base || cls) ? 2 : 0.6;
  }
  function reroll() {
    if (!S.offer.length || S.offerSource.startsWith('mastery:')) return false;
    const cost = S.reroll.free > 0 ? 0 : S.reroll.cost;
    if (S.gold < cost) return fail(`A reroll costs ${cost} scrap.`);
    if (S.reroll.free > 0) S.reroll.free--; else { S.gold -= cost; S.reroll.cost += REROLL.step; }
    rollOffer(); return true;
  }
  function choosePerk(id) {
    if (!S.offer.includes(id)) return fail('That blessing is not on offer.');
    if (id.startsWith('m:')) {
      const mid = id.slice(2), fam = S.offerSource.split(':')[1];
      S.P.mastery[fam] = mid; syncMastery(); S.cur.perks.push(id);
      if (mid === 'champion') S.P.heroRate *= 1;
      toast(`${MASTERIES[fam].find(m => m.id === mid).name}!`, 'good');
    } else {
      const pk = PERKS.find(p => p.id === id);
      pk.fx(S.P); S.P.taken[id] = (S.P.taken[id] || 0) + 1; S.P.fam[pk.fam]++; S.cur.perks.push(id); S.stats.blessings++;
      for (const sy of SYNERGIES) if ((sy.a === id && has(sy.b)) || (sy.b === id && has(sy.a))) toast(`Combo! ${sy.text}`, 'good');
      if (S.P.fam[pk.fam] === 3 && !S.P.mastery[pk.fam] && !(pk.fam === 'hero' && !G.HC.attack)) S.picks.splice(1, 0, `mastery:${pk.fam}`);
      if (G.PATH_FAMS.includes(pk.fam)) G.addPath(pk.fam, 0.5);
      G.checkEvolution();
    }
    for (const b of S.buildings) { const m = G.maxHpOf(b.type, b.level); if (!b.ruined) b.hp += m - b.maxHp; b.maxHp = m; }
    const km = G.keepMaxHp(); keep.hp = Math.min(km, keep.hp + Math.max(0, km - keep.maxHp)); keep.maxHp = km;
    const hm = G.heroMax(); S.hero.hp = Math.min(hm, S.hero.hp + Math.max(0, hm - S.hero.maxHp)); S.hero.maxHp = hm;
    S.picks.shift(); rollOffer(); return true;
  }
  return { rollOffer, perkOk, reroll, choosePerk };
}
