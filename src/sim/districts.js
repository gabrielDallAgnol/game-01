// Sites: walking up to a landmark and claiming it.
import { LANDMARKS } from './mapgen.js';

export function createDistricts(G) {
  const { S, ev, fail, reveal, toast } = G;
  // ---------- landmarks: walk up to one and pay to claim it ----------
  function landmarkReach(l) { return Math.hypot(S.hero.x - l.x, S.hero.y - l.y) <= l.size / 2 + 2.6; }
  function claimLandmark(id) {
    const l = S.landmarks[id]; if (!l || l.owned) return false;
    const L = LANDMARKS[l.kind];
    if (S.over) return false;
    if (S.hero.dead || !landmarkReach(l)) return fail(`Walk up to the ${L.name} to claim it.`);
    if (S.gold < L.cost) return fail(`Claiming the ${L.name} costs ${L.cost} scrap.`);
    S.gold -= L.cost; S.cur.spent += L.cost; S.stats.goldSpent += L.cost;
    return takeSite(l);
  }
  function takeSite(l) {
    const L = LANDMARKS[l.kind], id = l.id;
    l.owned = true; S.occVersion = (S.occVersion || 0) + 1;
    if (L.reveal) { S.seen.fill(1); S.seenVersion++; } else reveal(l.x, l.y, 9);
    if (L.survivors) S.survivors += L.survivors;
    G.gainXp(15);   // (the path leans on choices only: claiming a site no longer leans Wits)
    S.stats.sites = (S.stats.sites || 0) + 1;
    ev('landmark', { id }); toast(`[Site claimed: ${L.name}] ${L.desc}`, 'good');
    if (G.story) { S.story.quests = S.story.quests.filter(q => q.site !== id); G.story.chron(`Claimed the ${L.name}.`, 3); }
    return true;
  }
  const siteOf = r => S.landmarks.find(l => l.region === r);
  return { landmarkReach, claimLandmark, takeSite, siteOf };
}
