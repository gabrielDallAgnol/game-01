// Scavenge runs: ruins around the town hold supplies. By day you send survivors out to a site;
// they come back at dawn (if they come back). The further from your land, the richer and the deadlier.
// Pure sim, own random stream so it never shifts the rest of the run.
import { N, T, idx } from './mapgen.js';
import { Rng, hashSeed } from './rng.js';
import { CREW, TRAITS, START_TRAITS, NAMES, RUN, RISK, TREAT } from '../content/scavenge.js';

const WALK = new Set([T.GRASS, T.DIRT, T.FOREST, T.FORD]);

export function createScavenge({ S, map, seed, ev, toast, earn, activeNests, isBloodMoon, spawnMob, fail }) {
  const rng = new Rng(hashSeed(seed, 'scavenge'));
  const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? T.VOID : map.terrain[idx(x, y)]);

  // ---------- sites: a doorway into a ruined block, one or two per region ----------
  const sites = [];
  {
    const byRegion = new Map();
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      const i = idx(x, y), r = map.region[i];
      if (r <= 0 || !WALK.has(map.terrain[i])) continue;
      let rock = null;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(x + dx, y + dy) === T.ROCK) { rock = [dx, dy]; break; }
      if (!rock) continue;
      const reg = map.regions[r];
      if (reg.nest && Math.hypot(x + 0.5 - reg.nest.x, y + 0.5 - reg.nest.y) < 4) continue;
      if (!byRegion.has(r)) byRegion.set(r, []);
      byRegion.get(r).push({ x, y, face: Math.atan2(rock[0], rock[1]) });
    }
    // regions with no ruin doorway still get a cache: the open spot nearest their middle (a wrecked van, a kiosk)
    for (const reg of map.regions) {
      if (reg.id === 0 || byRegion.has(reg.id)) continue;
      let best = null, bd = Infinity;
      for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
        const i = idx(x, y); if (map.region[i] !== reg.id || !WALK.has(map.terrain[i])) continue;
        if (reg.nest && Math.hypot(x + 0.5 - reg.nest.x, y + 0.5 - reg.nest.y) < 4) continue;
        const d = Math.hypot(x + 0.5 - reg.x, y + 0.5 - reg.y); if (d < bd) { bd = d; best = { x, y, face: 0 }; }
      }
      if (best) byRegion.set(reg.id, [best]);
    }
    for (const [r, cands] of [...byRegion.entries()].sort((a, b) => a[0] - b[0])) {
      const want = 1, picked = [];
      rng.shuffle(cands);
      for (const c of cands) { if (picked.length >= want) break; if (picked.every(p => Math.hypot(p.x - c.x, p.y - c.y) > 6)) picked.push(c); }
      for (const p of picked) sites.push({ id: sites.length, region: r, x: p.x + 0.5, y: p.y + 0.5, face: p.face, used: 0 });
    }
  }

  // ---------- crew ----------
  const names = rng.shuffle([...NAMES]);
  let nameK = 0, nextId = 1;
  const person = trait => ({ id: nextId++, name: names[nameK++ % names.length], trait, out: null, bitten: false });
  const startTraits = rng.shuffle([...START_TRAITS]);
  const crew = Array.from({ length: CREW.start }, (_, k) => person(startTraits[k]));
  const runs = [];               // { site, ids, hops }
  const scav = { sites, crew, runs, lost: 0, found: 0, trips: 0 };

  /** regions → steps from your land (0 = yours) */
  function hopsMap() {
    const d = map.regions.map(() => Infinity), q = [];
    for (const r of S.claimed) { d[r] = 0; q.push(r); }
    while (q.length) { const r = q.shift(); for (const nb of map.regions[r].neighbors) if (d[nb] > d[r] + 1) { d[nb] = d[r] + 1; q.push(nb); } }
    return d;
  }
  const home = () => crew.filter(c => !c.out);
  const byId = id => crew.find(c => c.id === id);

  function siteInfo(id, n = 1) {
    const s = sites[id]; if (!s) return null;
    const hops = hopsMap()[s.region];
    const R = RUN[Math.min(2, hops)] || null;
    const awake = activeNests().includes(s.region) && S.nestAlive[s.region];
    const run = runs.find(r => r.site === id);
    const left = R ? R.uses - s.used : 0;
    const reachable = hops <= 2;
    const die = R ? Math.min(0.6, R.die + (awake ? RISK.awakeHive : 0) + (isBloodMoon(S.night) && hops > 0 ? RISK.bloodMoon : 0)) : 0;
    return { site: s, hops, R, awake, run, left, reachable, visible: reachable && left > 0, die, bite: R ? R.bite : 0, kit: R ? R.kit * n : 0, label: R ? R.label : 'Too far' };
  }

  function send(siteId, ids) {
    if (S.over) return false;
    const info = siteInfo(siteId); if (!info || !info.reachable) return fail('Too far. Claim more land first.');
    if (info.left <= 0) return fail('This ruin has been picked clean.');
    if (info.run) return fail('A crew is already heading there.');
    const team = ids.map(byId).filter(c => c && !c.out && !c.bitten);
    if (!team.length) return fail('Pick at least one survivor who is home and unhurt.');
    const kit = info.R.kit * team.length;
    if (S.gold < kit) return fail(`Supplies for this run cost ${kit} gold.`);
    S.gold -= kit; S.cur.spent += kit; S.stats.goldSpent += kit;
    for (const c of team) c.out = siteId;
    runs.push({ site: siteId, ids: team.map(c => c.id), hops: info.hops, kit });
    ev('scavSend', { site: siteId, n: team.length });
    return true;
  }
  function recall(siteId) {
    const k = runs.findIndex(r => r.site === siteId); if (k < 0) return false;
    const r = runs[k]; runs.splice(k, 1);
    for (const id of r.ids) { const c = byId(id); if (c) c.out = null; }
    S.gold += r.kit; S.cur.spent -= r.kit; S.stats.goldSpent -= r.kit;
    return true;
  }
  function treat(id, how = 'food') {
    const c = byId(id); if (!c || !c.bitten) return false;
    if (how === 'food') { if (S.food < TREAT.food) return fail(`Treating a bite takes ${TREAT.food} food.`); S.food -= TREAT.food; }
    else { if (S.gold < TREAT.gold) return fail(`Treating a bite takes ${TREAT.gold} gold.`); S.gold -= TREAT.gold; S.stats.goldSpent += TREAT.gold; }
    c.bitten = false; toast(`${c.name} is treated and will pull through.`, 'good');
    return true;
  }
  function exile(id) {
    const c = byId(id); if (!c || c.out) return false;
    crew.splice(crew.indexOf(c), 1); toast(`${c.name} is turned out of town.`);
    return true;
  }

  // night bonuses for those at home
  const homeCount = t => crew.filter(c => c.trait === t && !c.out).length;
  const towerBonus = () => homeCount('marksman') * 0.06;

  /** nightfall: bites left untreated turn inside the town */
  function nightfall(keep) {
    for (const r of runs) ev('scavGo', { site: r.site, n: r.ids.length });
    for (const c of [...crew]) if (c.bitten && !c.out) {
      crew.splice(crew.indexOf(c), 1); scav.lost++;
      spawnMob('runner', keep.x + (rng.next() - 0.5), keep.y + 3.5, { instant: true });
      toast(`${c.name} turned. One of the dead is inside the town.`, 'bad');
    }
  }

  /** dawn: cooks feed the town; crews come home with what they found. Returns food from cooks. */
  function dawnFood() { return homeCount('cook') * 2; }
  function dawn(bloodMoonNight) {
    const report = [];
    for (const r of runs.splice(0)) {
      const s = sites[r.site], R = RUN[Math.min(2, r.hops)];
      const team = r.ids.map(byId).filter(Boolean);
      const scout = team.some(c => c.trait === 'scout'), medic = team.some(c => c.trait === 'medic'), tinker = team.some(c => c.trait === 'tinker');
      const awake = activeNests(S.night).includes(s.region) && S.nestAlive[s.region];
      const pDie = Math.min(0.6, R.die + (awake ? RISK.awakeHive : 0) + (bloodMoonNight && r.hops > 0 ? RISK.bloodMoon : 0)) * (scout ? 0.5 : 1);
      let gold = 0, food = 0; const dead = [], bitten = [], extras = [];
      for (const c of team) {
        c.out = null;
        if (c.trait !== 'coward' && rng.next() < pDie) { dead.push(c); continue; }
        const share = c.trait === 'coward' ? 0.5 : 1;
        gold += Math.round(rng.range(R.gold[0], R.gold[1] + 1) * share);
        food += Math.round(rng.range(R.food[0], R.food[1] + 1) * share * (c.trait === 'mule' ? 2 : 1));
        if (!medic && rng.next() < R.bite) bitten.push(c);
      }
      for (const c of dead) { crew.splice(crew.indexOf(c), 1); scav.lost++; }
      for (const c of bitten) c.bitten = true;
      const alive = team.length - dead.length;
      if (alive > 0) {
        if (rng.next() < R.blueprint * (tinker ? 1.6 : 1)) {
          const t = rng.pick(['house', 'farm', 'tower', 'wall', 'wall']), n = t === 'wall' ? 4 : 1;
          S.stock[t] = (S.stock[t] || 0) + n; extras.push(n > 1 ? `${n} barricade posts` : `a free ${t === 'house' ? 'home' : t}`);
        }
        if (crew.length < CREW.max && rng.next() < R.find) {
          const p = person(rng.pick(Object.keys(TRAITS))); crew.push(p); scav.found++; extras.push(`a survivor, ${p.name} the ${TRAITS[p.trait].name}`);
        }
        if (rng.next() < R.relic) { S.picks.push('chest'); extras.push('a sealed cache (a rare blessing)'); }
      }
      if (alive > 0) ev('scavBack', { site: r.site, n: alive });
      s.used++; scav.trips++;
      earn(gold); S.food += food;
      report.push({ site: r.site, sent: team.length, dead: dead.map(c => c.name), bitten: bitten.map(c => c.name), gold, food, extras });
      const who = team.length === 1 ? team[0].name : `The crew of ${team.length}`;
      let msg = alive ? `${who} came back: +${gold} gold, +${food} food${extras.length ? ', ' + extras.join(', ') : ''}.` : `${who} never came back.`;
      if (alive && dead.length) msg += ` Lost: ${dead.map(c => c.name).join(', ')}.`;
      toast(msg, alive && !dead.length ? 'good' : 'bad');
      if (bitten.length) toast(`${bitten.map(c => c.name).join(' and ')} ${bitten.length === 1 ? 'was' : 'were'} bitten. Treat them before nightfall (Crew), or they turn.`, 'bad');
    }
    return report;
  }

  return { scav, sites, crew, runs, hopsMap, siteInfo, send, recall, treat, exile, towerBonus, nightfall, dawn, dawnFood };
}
