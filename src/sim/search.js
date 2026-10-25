// [area] Searching the town's houses: stand at a house's door for a moment and the hero turns it over. Once a day
// per house; what it gives comes from what its atom offers (homes: food, shops: scrap), carried like any find and
// counted once you are back on your land. Only an engine-built area has houses; without one this module does nothing.
export const SEARCH = { reach: 1.6, time: 1.4 };

export function createSearch(G) {
  const { S, map, ev, toast } = G;
  const homes = (map.area && map.area.homes) || [];
  const st = () => S.search || (S.search = { done: {}, at: -1, t: 0 });
  const searched = id => st().done[id] === S.night;
  function stepSearch(dt) {
    if (!homes.length) return;
    const h = S.hero, s = st(); if (h.dead || S.over) { s.at = -1; s.t = 0; return; }
    let near = -1, bd = SEARCH.reach;
    for (const o of homes) { const d = Math.abs(o.x - h.x) + Math.abs(o.y - h.y); if (d < bd * 1.5 && Math.hypot(o.x - h.x, o.y - h.y) < bd && !searched(o.id)) { bd = Math.hypot(o.x - h.x, o.y - h.y); near = o.id; } }
    if (near !== s.at) { s.at = near; s.t = 0; if (near >= 0) ev('searchStart', { id: near, x: homes[near].x, y: homes[near].y, dur: SEARCH.time }); }
    if (near < 0) return;
    s.t += dt; if (s.t < SEARCH.time) return;
    const o = homes[near], n = o.base + Math.floor(S.night / 4);
    s.done[o.id] = S.night; s.at = -1; s.t = 0;
    h.carry[o.kind] += n; S.stats.searched = (S.stats.searched || 0) + 1;
    ev('search', { id: o.id, kind: o.kind, n, x: o.x, y: o.y });
    toast(`[Searched] ${o.name}: **+${n} ${o.kind}**. Carry it home.`, 'good');
  }
  return { stepSearch, searched, searchHomes: () => homes, searchAt: () => st().at };
}
