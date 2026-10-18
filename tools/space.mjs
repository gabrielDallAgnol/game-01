// Space-use checker: how well do build slots use the buildable land?
//   node tools/space.mjs [seeds=20]
import { generateMap, BIOMES, N, idx, BUILDABLE } from '../src/sim/mapgen.js';

export function spaceStats(m) {
  const regions = m.regions.map(r => ({ id: r.id, ring: r.ring, buildable: 0, slots: r.slots.length, unused: 0, gaps: [] }));
  const slotsOf = r => m.slots.filter(s => s.region === r);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y), r = m.region[i];
    if (r < 0 || !BUILDABLE[m.terrain[i]] || !m.reach[i]) continue;
    const R = regions[r]; R.buildable++;
    // a buildable cell is "unused" when no slot footprint (3×3) or street (1 cell around it) covers it
    const near = m.slots.some(s => Math.abs(s.x - (x + 0.5)) <= 2.5 && Math.abs(s.y - (y + 0.5)) <= 2.5);
    if (!near) R.unused++;
  }
  for (const R of regions) {
    const ss = slotsOf(R.id);
    for (const s of ss) { const d = Math.min(...m.slots.filter(o => o !== s).map(o => Math.hypot(o.x - s.x, o.y - s.y))); R.gaps.push(d); }
  }
  const core = regions[0];
  const gaps = regions.flatMap(r => r.gaps);
  const keepRange = m.slots.filter(s => s.region === 0 && Math.hypot(s.x - m.town.x, s.y - m.town.y) <= 8).length;
  return {
    coreSlots: core.slots, coreBuildable: core.buildable, coreUnused: +(core.unused / Math.max(1, core.buildable)).toFixed(2),
    totalSlots: m.slots.length, unused: +(regions.reduce((a, r) => a + r.unused, 0) / regions.reduce((a, r) => a + r.buildable, 0)).toFixed(2),
    gapMedian: +gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)].toFixed(2), gapMax: +Math.max(...gaps).toFixed(1),
    coreInKeepRange: +(keepRange / Math.max(1, core.slots)).toFixed(2), gates: m.slots.filter(s => s.gate).length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const seeds = +(process.argv[2] || 20);
  for (const biome of Object.keys(BIOMES)) {
    const rows = []; for (let s = 1; s <= seeds; s++) rows.push(spaceStats(generateMap(s, biome)));
    const avg = k => +(rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(2);
    console.log(`${biome.padEnd(10)} core slots ${avg('coreSlots')} (buildable cells ${avg('coreBuildable')}, unused ${Math.round(avg('coreUnused') * 100)}%) · all slots ${avg('totalSlots')} · unused land ${Math.round(avg('unused') * 100)}% · gap median ${avg('gapMedian')} max ${avg('gapMax')} · core in keep range ${Math.round(avg('coreInKeepRange') * 100)}% · gate slots ${avg('gates')}`);
  }
}
