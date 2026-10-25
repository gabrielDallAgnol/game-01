// Sites and districts: claiming a landmark, the sealed districts the story opens one at a time, their kits.
import { KITS, RARITY_ODDS } from '../content/districts.js';
import { LANDMARKS } from './mapgen.js';
import { Rng, hashSeed } from './rng.js';

export function createDistricts(G) {
  const { S, compass, ev, fail, map, reveal, revealRegion, seed, toast } = G;
  // ---------- landmarks: walk up to one and pay to claim it ----------
  function landmarkReach(l) { return Math.hypot(S.hero.x - l.x, S.hero.y - l.y) <= l.size / 2 + 2.6; }
  function claimLandmark(id) {
    const l = S.landmarks[id]; if (!l || l.owned) return false;
    const L = LANDMARKS[l.kind];
    if (S.over) return false;
    if (S.hero.dead || !landmarkReach(l)) return fail(`Walk up to the ${L.name} to claim it.`);
    if (l.kind === 'unknown' || S.sealed[l.region]) return fail('That district is still sealed.');
    if (S.gold < L.cost) return fail(`Claiming the ${L.name} costs ${L.cost} scrap.`);
    S.gold -= L.cost; S.cur.spent += L.cost; S.stats.goldSpent += L.cost;
    return takeSite(l);
  }
  function takeSite(l) {
    const L = LANDMARKS[l.kind], id = l.id;
    l.owned = true; S.occVersion = (S.occVersion || 0) + 1;
    if (l.kind === 'tvtower' || L.reveal) { S.seen.fill(1); S.seenVersion++; } else reveal(l.x, l.y, l.kind === 'eiffel' ? 22 : 9);
    if (L.survivors) S.survivors += L.survivors;
    G.gainXp(15);   // (the path leans on choices only: claiming a site no longer leans Wits)
    S.stats.sites = (S.stats.sites || 0) + 1;
    ev('landmark', { id }); toast(`[Site claimed: ${L.name}] ${L.desc}`, 'good');
    if (G.story) { S.story.quests = S.story.quests.filter(q => q.site !== id); G.story.chron(`Claimed the ${L.name}.`, 3); }
    return true;
  }
  // ---------- districts: sealed behind quarantine fences; the story opens them one at a time ----------
  const distRng = new Rng(hashSeed(seed, 'districts'));
  const siteOf = r => S.landmarks.find(l => l.region === r);
  /** what a district is: decided the first time it is offered */
  function kitFor(r, force) {
    if (S.kits[r]) return S.kits[r];
    const reg = map.regions[r], odds = RARITY_ODDS[Math.min(2, Math.max(1, reg.ring))];
    const used = {}; for (const k of Object.values(S.kits)) used[k] = (used[k] || 0) + 1;
    const ok = id => (used[id] || 0) < (KITS[id].max || 9);
    const rars = Object.keys(odds); let rar = force || rars[distRng.weighted(rars.map(k => odds[k]))];
    let pool = Object.keys(KITS).filter(id => KITS[id].rarity === rar && ok(id));
    if (!pool.length) pool = Object.keys(KITS).filter(ok);
    if (!pool.length) pool = ['flats'];
    return (S.kits[r] = pool[distRng.int(pool.length)]);
  }
  const kitInfo = r => { const k = kitFor(r); if (k === 'signature') { const l = siteOf(r); return { id: k, name: LANDMARKS[l.kind].name, rarity: 'legendary', lm: l.kind, call: 'It stands over the whole city. From up there you could see everything.' }; } return { id: k, ...KITS[k] }; };
  /** sealed districts that touch one you hold */
  function frontier() {
    if (G.v2) return [];   // [v2] sealed districts are no goal: no routes, no offers
    return map.regions.filter(r => S.sealed[r.id] && r.neighbors.some(n => !S.sealed[n])).map(r => r.id); }
  function districtOffer(r) { const k = kitInfo(r), reg = map.regions[r]; return { region: r, kit: k.id, name: k.name, rarity: k.rarity, call: k.call, lm: k.lm, dir: compass(reg.x, reg.y), nest: !!(reg.nest && S.nestAlive[r]), ring: reg.ring }; }
  function openDistrict(r, why) {
    if (!S.sealed[r]) return false;
    const k = kitInfo(r), l = siteOf(r);
    S.sealed[r] = 0; S.sealVersion++; S.flowDirty = true; S.occVersion = (S.occVersion || 0) + 1;
    if (l && l.kind === 'unknown') l.kind = k.lm;
    revealRegion(r);
    S.stats.districts = (S.stats.districts || 0) + 1; G.gainXp(10);
    ev('district', { region: r, kit: k.id });
    toast(`[District opened: ${k.name}] ${why || ''}${map.regions[r].nest && S.nestAlive[r] ? ' A hive nests there: it will pour out its dead now.' : ''}`.trim(), 'good');
    G.spawnRoamers();
    return true;
  }
  return { landmarkReach, claimLandmark, takeSite, siteOf, kitFor, frontier, districtOffer, openDistrict };
}
