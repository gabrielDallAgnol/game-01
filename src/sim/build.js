// What the player does by day with scrap: build, palisade lines, upgrades, demolish, rebuild ruins,
// clear rubble, raise the keep.
import { BUILDINGS, KEEP, MAX_LEVEL, POWER, UNLOCKS } from '../content/buildings.js';
import { T, idx, inside } from './mapgen.js';
import { TENSION } from './state.js';

export function createBuild(G) {
  const { S, c, dropLive, earn, ev, fail, hasTech, houseCap, keep, map } = G;
  /** what a building cost to put up at its level (its rebuild price is half of this) */
  const investOf = b => { let s = 0; for (let l = 1; l <= b.level; l++) s += G.costOf(b.type, l); return s; };
  const rebuildCost = b => Math.max(1, Math.ceil(investOf(b) * TENSION.rebuild));

  // ---------- day actions ----------
  /** build(type, x, y, rot) — or the older form build(lotId, type) using a suggested lot from the map */
  function build(a, b, c2, rot) {
    let type, x, y;
    if (typeof a === 'number' && typeof b === 'string') { const lot = map.slots[a]; if (!lot) return fail('No such lot.'); type = b; x = lot.x; y = lot.y; rot = rot ?? lotRot(lot, type); }
    else { type = a; x = b; y = c2; }
    if (S.over) return false;
    const p = G.canPlace(type, x, y, rot || 0, { deep: true }); if (!p.ok) return fail(p.reason);
    if (G.handsFree() < 1) return G.useHand();
    if (!pay(type)) return false;
    S.handsUsed++;
    S.cur.built.push(type); S.stats.built++;
    G.placeBuilding(type, p.x, p.y, p.rot, 1);
    G.unstickHero();
    return true;
  }
  function pay(type) {
    if ((S.stock[type] || 0) > 0) { S.stock[type]--; return true; }
    const cost = G.buyCost(type); if (S.gold < cost) return fail(S.mode === 'packs' ? `None left in your packs. Buying one costs ${cost} scrap.` : 'Not enough scrap.');
    S.gold -= cost; S.cur.spent += cost; S.stats.goldSpent += cost; return true;
  }
  /** how many palisade posts you can still lay: stock first, then scrap */
  function wallBudget() { return (S.stock.wall || 0) + Math.floor(S.gold / G.buyCost('wall')); }
  /** lay a palisade line between two cells; skips cells that don't fit, stops when you run out. Returns posts laid. */
  function buildLine(x0, y0, x1, y1, max = Infinity) {
    if (S.over) return 0;
    if (G.handsFree() < 1) return G.useHand() && 0;   // a whole line is one job
    let n = 0;
    for (const [x, y] of G.lineCells(x0, y0, x1, y1)) {
      if (n >= max) break;
      const p = G.canPlace('wall', x + 0.5, y + 0.5, 0); if (!p.ok) continue;
      if ((S.stock.wall || 0) <= 0 && S.gold < G.buyCost('wall')) { if (!n) fail(`A barricade post costs ${G.buyCost('wall')} scrap.`); break; }
      pay('wall'); S.cur.built.push('wall'); S.stats.built++; G.placeBuilding('wall', p.x, p.y, 0, 1); n++;
    }
    if (n) { G.unstickHero(); S.handsUsed++; }
    return n;
  }
  /** the palisade posts joined to this one (same level), nearest first */
  function wallRun(id) {
    const b0 = S.byId.get(id); if (!b0 || b0.type !== 'wall') return [];
    const out = [b0], seen = new Set([b0.id]);
    for (let h = 0; h < out.length; h++) {
      const b = out[h], x = Math.floor(b.x), y = Math.floor(b.y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (!inside(x + dx, y + dy)) continue;
        const o = S.byId.get(S.occ[idx(x + dx, y + dy)]);
        if (o && o.type === 'wall' && !seen.has(o.id) && o.level === b0.level && !o.ruined) { seen.add(o.id); out.push(o); }
      }
    }
    return out;
  }
  /** upgrade a whole palisade line at once, as far as your scrap goes. Returns posts upgraded. */
  function upgradeWall(id) {
    if (S.over) return 0;
    const run = wallRun(id); if (!run.length) return fail('Cannot upgrade.') && 0;
    { const why = raiseBlock(run[0]); if (why) return fail(why) && 0; }
    if (G.handsFree() < 1) return G.useHand() && 0;
    let n = 0;
    for (const b of run) {
      const cost = G.upCostOf(b); if (S.gold < cost) break;
      S.gold -= cost; S.cur.spent += cost; S.stats.goldSpent += cost; S.stats.upgraded++; S.halfUpgrade = false; raise(b); n++;
    }
    if (n) { S.cur.upgraded.push(`wall${run[0].level + 1}×${n}`); S.handsUsed++; } else fail('Not enough scrap.');
    return n;
  }
  // a palisade on a suggested lot runs across the way to the keep
  function lotRot(lot, type) { if (type !== 'wall') return 0; const a = Math.atan2(lot.y - c, lot.x - c), q = ((Math.round(a / (Math.PI / 4)) % 4) + 4) % 4; return [1, 3, 0, 2][q]; }
  /** why this building cannot go up a level right now ('' = it can): the one rule for upgrades, wall lines and the Guild */
  function raiseBlock(b) {
    if (!b || b.type === 'keep' || b.level >= (BUILDINGS[b.type].maxLevel || MAX_LEVEL)) return 'Cannot upgrade.';
    if (b.ruined) return 'Rebuild it first.';
    if (b.level + 1 === 3 && UNLOCKS[b.type] && !hasTech(UNLOCKS[b.type])) return `Level 3 needs a ${BUILDINGS[UNLOCKS[b.type]].name}.`;
    if (b.level >= keep.level) return `Raise the Haven Rig first: nothing grows past the Haven Rig (level ${keep.level}).`;
    if (G.powerLive()) { const more = ((POWER.draw[b.type] || [])[b.level] || 0) - ((POWER.draw[b.type] || [])[b.level - 1] || 0); if (more > 0 && G.powerIn() - G.powerOut() < more) return `Not enough power: that needs ${more} more.`; }
    return '';
  }
  function upgrade(id) {
    if (S.over) return false;
    const b = S.byId.get(id); { const why = raiseBlock(b); if (why) return fail(why); }
    const cost = G.upCostOf(b); if (S.gold < cost) return fail('Not enough scrap.');
    if (!G.useHand()) return false;
    S.gold -= cost; S.halfUpgrade = false; S.cur.spent += cost; S.cur.upgraded.push(`${b.type}${b.level + 1}`); S.stats.upgraded++; S.stats.goldSpent += cost;
    raise(b); return true;
  }
  function raise(b) { G.removeBuilding(b); const nb = G.placeBuilding(b.type, b.x, b.y, b.rot, b.level + 1, b.id); nb.hp = Math.min(nb.maxHp, nb.hp); if (b.type === 'house') nb.folk = (b.folk ?? houseCap(b)) + houseCap(nb) - houseCap(b); return nb; }
  function demolish(id) {
    if (S.over) return false;
    const b = S.byId.get(id); if (!b || b.type === 'keep') return fail('Cannot demolish that.');
    if (!b.ruined) earn(Math.floor(G.costOf(b.type) / 2)); if (b.type === 'house' && b.folk) { S.homeless = (S.homeless || 0) + b.folk; G.dropCrew(); } G.removeBuilding(b); return true;   // clearing a ruin pays nothing; a pulled-down home's family moves to the Camp
  }
  // ---------- ruins: a fallen building stays on its lot (no income, no defence) until you rebuild it by hand ----------
  function rebuild(id) {
    if (S.over) return false;
    const b = S.byId.get(id); if (!b || !b.ruined || b.type === 'keep') return fail('Nothing to rebuild there.');
    if (S.phase === 'night') return fail('Rebuild by day: nobody lays bricks with the Ash-Born at the gate.');
    const cost = rebuildCost(b); if (S.gold < cost) return fail(`Rebuilding the ${BUILDINGS[b.type].name} costs ${cost} scrap.`);
    if (b.cells.some(i => S.occ[i] >= 0 && S.occ[i] !== b.id)) return fail('Something stands in the way.');
    if (!G.useHand()) return false;
    S.gold -= cost; S.cur.spent += cost; S.stats.goldSpent += cost; S.stats.rebuilt = (S.stats.rebuilt || 0) + 1; (S.cur.rebuilt || (S.cur.rebuilt = [])).push(b.type);
    b.ruined = false; b.fell = false; b.hp = b.maxHp; G.occupy(b); dropLive(); G.dropCrew(); G.unstickHero();
    if (b.type === 'house') { const k = Math.min(houseCap(b), S.homeless || 0); b.folk = (b.folk || 0) + k; S.homeless = (S.homeless || 0) - k; }   // the homeless move back in
    ev('rebuild', { id: b.id, cost }); return true;
  }
  const REBUILD_ORDER = { tower: 0, house: 1, farm: 2, workshop: 3, market: 3, wall: 4, generator: 5 };
  const ruins = () => S.buildings.filter(b => b.ruined).sort((p, q) => (REBUILD_ORDER[p.type] ?? 9) - (REBUILD_ORDER[q.type] ?? 9) || p.id - q.id);
  /** rebuild every ruin you can afford, towers first, then homes, farms, barricades. Returns how many. */
  function rebuildAll(max = Infinity) {
    let n = 0; const q = S.quiet; S.quiet = true;
    try { for (const b of ruins()) { if (n >= max) break; if (S.gold >= rebuildCost(b) && rebuild(b.id)) n++; } } finally { S.quiet = q; }
    return n;
  }
  // ---------- clearing the city: rubble is cheap; a ruined block costs scrap, a pair of hands and noise ----------
  // The town grows the way you want it to, at a price. The dead cross open ground faster.
  const RUBBLE_COST = 1, BLOCK_COST = 3;
  function rubbleAt(x, y) {
    const cx = Math.floor(x), cy = Math.floor(y), cells = [];
    let blocks = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = cx + dx, yy = cy + dy; if (!inside(xx, yy)) continue;
      const i = idx(xx, yy), r = map.region[i], t = map.terrain[i];
      if ((t === T.FOREST || t === T.ROCK) && r >= 0 && G.inZone(i) && S.occ[i] < 0 && map.lm[i] < 0) { cells.push(i); if (t === T.ROCK) blocks++; }
    }
    return { cells, blocks, cost: (cells.length - blocks) * RUBBLE_COST + blocks * BLOCK_COST, hands: blocks > 0 };
  }
  function clearRubble(x, y) {
    if (S.over) return false;
    const { cells, cost, blocks } = rubbleAt(x, y);
    if (!cells.length) return fail('Nothing to clear on your land here.');
    if (S.gold < cost) return fail(`Clearing this costs ${cost} scrap.`);
    if (blocks && !G.useHand()) return false;
    S.gold -= cost; S.cur.spent += cost; S.stats.goldSpent += cost;
    if (blocks) { G.addSpike(blocks * 1.5); S.stats.blocksDown = (S.stats.blocksDown || 0) + blocks; }
    for (const i of cells) map.terrain[i] = map.terrain[i] === T.ROCK ? T.DIRT : T.GRASS;
    (S.clearedIdx || (S.clearedIdx = [])).push(...cells);
    S.flowDirty = true; S.occVersion = (S.occVersion || 0) + 1; S.cleared = (S.cleared || 0) + cells.length;
    ev('clear', { cells });
    return cells.length;
  }
  function upgradeKeep() {
    if (S.over || keep.level >= 3) return fail('Cannot raise the Haven Rig.');
    { const miss = G.keepNeeds(); if (miss.length) return fail(`The town hall needs more first: ${miss.join(', ')}.`); }
    const cost = KEEP.cost[keep.level]; if (S.gold < cost) return fail('Not enough scrap.');
    if (!G.useHand()) return false;
    S.gold -= cost; S.food -= (KEEP.need[keep.level] || {}).food || 0; S.cur.spent += cost;   // (no level asks for food now; if one does, keepCost() says so) S.cur.upgraded.push(`keep${keep.level + 1}`); S.stats.goldSpent += cost;
    keep.level++; const m = G.keepMaxHp(); keep.hp += m - keep.maxHp; keep.maxHp = m; keep.r = 2.3 * (1 + 0.12 * (keep.level - 1));
    ev('keepUp'); G.checkFeatures(); return true;
  }
  return { investOf, rebuildCost, build, wallBudget, buildLine, wallRun, upgradeWall, raiseBlock, upgrade, raise, demolish, rebuild, ruins, rebuildAll, rubbleAt, clearRubble, upgradeKeep };
}
