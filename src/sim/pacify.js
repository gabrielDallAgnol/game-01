// Pacified land, the home threat and the way home.
// 1. Pacified land: the Camp, every claimed region and the ground within PACIFY.r of what you built or hold. A hive
//    sleeping there never wakes (smothered): it shows on the map and can still be burned, but it sends no dead.
//    Every hive that wakes anywhere is put on the map with a System line, so no hive is ever hidden.
// 2. The home threat: after PACIFY.from nights the night's budget reads the wave curve (WAVES.budget, content/mobs.js)
//    at a "home night" instead of the calendar night: a slow plateau plus a load for each awake, unpacified hive
//    (more when it hears the Camp or sits at your door). Woods pacified: nights at home climb slowly and stay holdable.
//    Hives awake and loud: the old curve. It is a ratio layer only (homeK, applied in waves.js nightBudget): whatever
//    the curve itself becomes (fix-towers' late tuning), this reads that same curve at an earlier night; it never
//    raises a night (homeK ≤ 1), and leaves hp (WAVES.hpScale), blood moons, weather and the purge as they are.
// 3. The way home: by day, standing at a site you hold, far from the Camp and out of the fight, the
//    hero can Return to Camp (a short channel, broken by moving or being hit; a cooldown). A dusk warning comes once a
//    day when the walk home takes longer than the light left.
import { MOBS, TIDE, WAVES } from '../content/mobs.js';
import { ZONE } from './state.js';
import { N, idx } from './mapgen.js';

export const PACIFY = {
  r: 16,                 // cells of quiet ground beyond your base's edge (keep, buildings, held sites)
  from: 10,              // the home threat follows the calendar until this night
  slow: 0.35,            // then the quiet plateau climbs this many curve-nights a night
  hear: [0, 3, 4, 5],    // load (curve-nights) of an awake hive that hears the Camp, by ring
  door: [0, 2, 3, 3],    // load of an awake hive that does not hear the Camp but touches your land (ZONE.hiveReach)
  far: 0.5,              // load of an awake hive far off (its dead mostly fill the city)
  home: { channel: 2.5, cd: 45, far: 25, site: 6 },   // Return to Camp: channel s, cooldown s, min cells from the Camp, reach of a held site
  warn: { margin: 12, far: 30, speed: 1.3 },   // dusk warning: s of spare light, min cells from the Camp, path detour factor
};

export function createPacify(G) {
  const { S, map, c, ev, toast, reveal, compass } = G;
  const live = r => map.regions[r].nest && S.nestAlive[r] && !S.claimed.has(r) && !S.sealed[r];

  // ---------- pacified ground ----------
  let pkey = '', pmap = null;
  /** one byte a cell: 1 = pacified (cached; rebuilt when the base, claims or seals change) */
  function pacifyMap() {
    G.zone();   // keeps S.zoneVersion current
    const awake = map.regions.filter(r => live(r.id) && S.wake[r.id] <= S.night && !S.smother[r.id]);
    const key = `${S.zoneVersion}|${S.claimed.size}|${S.sealVersion}|${awake.map(r => r.id).join(',')}`;
    if (key === pkey && pmap) return pmap;
    const z = new Uint8Array(N * N), src = [{ x: c, y: c, r: ZONE.keep }];
    for (const b of S.buildings) if (b.type !== 'wall') src.push({ x: b.x, y: b.y, r: ZONE.building });
    for (const l of S.landmarks || []) if (l.owned) src.push({ x: l.x, y: l.y, r: ZONE.landmark });
    for (const q of src) {
      const R = q.r + PACIFY.r, r2 = R * R;
      for (let y = Math.max(0, Math.floor(q.y - R)); y <= Math.min(N - 1, Math.ceil(q.y + R)); y++) for (let x = Math.max(0, Math.floor(q.x - R)); x <= Math.min(N - 1, Math.ceil(q.x + R)); x++)
        if ((x + 0.5 - q.x) ** 2 + (y + 0.5 - q.y) ** 2 <= r2) z[idx(x, y)] = 1;
    }
    for (let i = 0; i < N * N; i++) { const r = map.region[i]; if (r >= 0 && S.claimed.has(r)) z[i] = 1; else if (z[i] && (r < 0 || S.sealed[r])) z[i] = 0; }
    // an awake hive keeps the ground around it contested: no quiet land within its reach until it burns
    for (const reg of awake) { const n = reg.nest, R = ZONE.hiveReach;
      for (let y = Math.max(0, Math.floor(n.y - R)); y <= Math.min(N - 1, Math.ceil(n.y + R)); y++) for (let x = Math.max(0, Math.floor(n.x - R)); x <= Math.min(N - 1, Math.ceil(n.x + R)); x++)
        if ((x + 0.5 - n.x) ** 2 + (y + 0.5 - n.y) ** 2 <= R * R) z[idx(x, y)] = 0; }
    pkey = key; pmap = z; S.pacifyVersion = (S.pacifyVersion || 0) + 1;
    return z;
  }
  const pacifiedAt = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); return cx >= 0 && cy >= 0 && cx < N && cy < N && pacifyMap()[idx(cx, cy)] === 1; };
  // A hive found asleep on pacified ground is smothered (S.smother): it stays asleep while the ground stays yours (its
  // wake is pushed on each check, so a save keeps it asleep too). Act 1's forest hollows are the act's quest: left alone.
  // A hive already awake when the land around it is pacified stays awake: it is on your map and can be burned.
  S.smother = S.smother || {};
  const canSmother = r => { const reg = map.regions[r]; return live(r) && S.wake[r] > S.night && !(reg.ring <= 1 && G.actNow && G.actNow() < 2) && pacifiedAt(reg.nest.x, reg.nest.y); };
  const smothered = r => !!S.smother[r] && live(r) && pacifiedAt(map.regions[r].nest.x, map.regions[r].nest.y);
  /** a region counts as pacified when it is claimed or its middle lies on pacified ground */
  const regionPacified = r => !S.sealed[r] && (S.claimed.has(r) || pacifiedAt(map.regions[r].x, map.regions[r].y));

  // ---------- the home threat ----------
  /** curve-nights an awake, unpacified hive adds tonight */
  function hiveLoad(r) {
    const reg = map.regions[r], ring = Math.min(3, reg.ring);
    return G.hears(r) ? PACIFY.hear[ring] : G.baseDist(reg.nest.x, reg.nest.y) <= ZONE.hiveReach ? PACIFY.door[ring] : PACIFY.far;
  }
  /** the night the home threat reads the curve at (never later than n itself) */
  function homeNight(n = S.night) {
    if (n <= PACIFY.from) return n;
    const load = G.activeNests(n).reduce((a, r) => a + hiveLoad(r), 0);
    return Math.min(n, PACIFY.from + PACIFY.slow * (n - PACIFY.from) + load);
  }
  /** the multiplier on the night's budget (≤ 1): the curve at the home night over the curve at the real night */
  function homeK(n = S.night) {
    const h = homeNight(n); if (h >= n) return 1;
    const d = S.diffNight || 0;
    return WAVES.budget(Math.max(1, h - d)) / WAVES.budget(Math.max(1, n - d));
  }
  function threatInfo(n = S.night) {
    const act = G.activeNests(n);
    return { night: n, home: +homeNight(n).toFixed(1), k: +homeK(n).toFixed(2), awake: act.length, loud: act.filter(r => hiveLoad(r) > PACIFY.far).length,
      smothered: map.regions.filter(r => r.nest && smothered(r.id)).map(r => r.id), pacified: map.regions.filter(r => regionPacified(r.id)).map(r => r.id) };
  }

  // ---------- watching the land: wakes, smothered hives, newly pacified regions ----------
  const told = { awake: new Set(), smother: new Set(), land: new Set() };
  let first = true, watchT = 0, warnDay = -1;
  function watch() {
    const quiet = first; first = false;
    const newLand = [];
    for (const reg of map.regions) {
      const r = reg.id;
      if (regionPacified(r) && !told.land.has(r)) { told.land.add(r); if (!S.claimed.has(r) && r !== 0) newLand.push(reg); }
      if (!reg.nest) continue;
      // a hive awake anywhere is on your map: never a hidden one
      if (S.smother[r] && !smothered(r)) delete S.smother[r];   // the ground was lost: it wakes on its own night
      if (!S.smother[r] && canSmother(r)) S.smother[r] = 1;
      if (smothered(r)) S.wake[r] = Math.max(S.wake[r], S.night + 1);
      if (live(r) && S.wake[r] <= S.night && !smothered(r) && !told.awake.has(r)) {
        told.awake.add(r); reveal(reg.nest.x, reg.nest.y, 5);
        ev('hiveAwake', { region: r, x: reg.nest.x, y: reg.nest.y });
        if (!quiet && S.night > 1) toast(`[Inferno Nest awake] A ${reg.ring <= 1 ? 'forest hollow' : 'city hive'} to the **${compass(reg.nest.x, reg.nest.y)}** wakes. It is on your map.`, 'bad');
      }
      if (smothered(r) && !told.smother.has(r)) {
        told.smother.add(r); reveal(reg.nest.x, reg.nest.y, 5);
        ev('hiveSmothered', { region: r, x: reg.nest.x, y: reg.nest.y });
        if (!quiet) toast(`[Pacified] A sleeping Inferno Nest to the **${compass(reg.nest.x, reg.nest.y)}** lies on your ground. It will not wake while you hold it.`, 'good');
      }
    }
    if (newLand.length && !quiet) {
      ev('pacified', { regions: newLand.map(r => r.id) });
      toast(`[Land pacified] The ground to the **${compass(newLand[0].x, newLand[0].y)}** is quiet now. No Inferno Nest wakes on your land.`, 'sys');
    }
  }

  // ---------- the way home ----------
  const H = S.homeward = { cd: 0, ch: 0, hp: 0 };
  const campDist = () => Math.hypot(S.hero.x - c, S.hero.y - c - 3.5);
  /** where the hero may set out for home from: a site you hold (null when neither is near) */
  function homeFrom() {
    const h = S.hero;
    for (const l of S.landmarks) if (l.owned && Math.hypot(l.x - h.x, l.y - h.y) < (l.size || 4) / 2 + PACIFY.home.site) return { kind: 'site', id: l.id };
    return null;
  }
  const mobsOn = () => S.mobs.some(m => !m.dying && !(MOBS[m.kind] && MOBS[m.kind].animal) && (m.hunt || !m.roam) && Math.hypot(m.x - S.hero.x, m.y - S.hero.y) < 7);
  /** seconds to walk home (a straight line with a detour factor: cheap, and good enough for a warning) */
  const walkHome = () => campDist() * PACIFY.warn.speed / Math.max(0.5, G.HC.speed * (S.P.heroSpeed || 1));
  /** what the HUD shows: can the hero go home now, why not, the channel's progress and the walk */
  function homeInfo() {
    const h = S.hero, far = campDist() > PACIFY.home.far, from = homeFrom();
    let why = null;
    if (S.over || h.dead) why = 'dead';
    else if (!far) why = 'home';
    else if (S.phase !== 'day') why = 'night';
    else if (!from) why = 'nowhere';
    else if (H.cd > 0) why = 'cooldown';
    else if (h.fightT > 0 || mobsOn()) why = 'fight';
    return { ok: !why, why, from, cd: Math.ceil(H.cd), cdMax: PACIFY.home.cd, channel: H.ch > 0 ? +(1 - H.ch / PACIFY.home.channel).toFixed(2) : 0, walk: Math.round(walkHome()), far };
  }
  /** start the channel (by day, from a held site, out of the fight) */
  function returnHome() {
    const i = homeInfo();
    if (!i.ok) {
      const msg = { night: 'Only by day: at night the paths belong to the Ash-Born.', nowhere: 'Go home from a lit fire on the road or a site you hold.', cooldown: `The way home is ready in ${i.cd} s.`, fight: 'Not with the Ash-Born on you.' }[i.why];
      return msg ? G.fail(msg) : false;
    }
    if (H.ch > 0) return true;
    H.ch = PACIFY.home.channel; H.hp = S.hero.hp; S.hero.target = null; S.hero.path = null;
    ev('homeStart', { x: S.hero.x, y: S.hero.y, dur: PACIFY.home.channel });
    return true;
  }
  function cancelReturn(why) { if (H.ch <= 0) return; H.ch = 0; ev('homeCancel', {}); if (why) toast(`[Return broken] ${why}`, 'bad'); }
  function stepHome(dt) {
    if (H.cd > 0) H.cd = Math.max(0, H.cd - dt);
    if (H.ch <= 0) return;
    const h = S.hero;
    if (h.dead || S.over || S.phase !== 'day') return cancelReturn();
    if (h.input.x || h.input.y || h.target) return cancelReturn('You moved.');
    if (h.hp < H.hp - 1e-6) return cancelReturn('You were hit.');
    if ((H.ch -= dt) > 0) return;
    H.ch = 0; H.cd = PACIFY.home.cd;
    const fx = h.x, fy = h.y;
    h.x = c; h.y = c + 3.5; h.target = null; h.path = null; G.unstickHero();
    for (const a of S.allies) if (a.comp !== undefined) { a.x = h.x + 1; a.y = h.y + 0.5; }   // companions walk the old paths with you
    G.reveal(h.x, h.y, 8);
    ev('homeward', { fx, fy, x: h.x, y: h.y });
    toast('[Return to Haven] You take the old paths home. **The Haven.**', 'good');
  }
  /** once a day: dusk comes before the walk home is done */
  function duskWarn() {
    if (S.phase !== 'day' || !S.clock || warnDay === S.night || S.hero.dead) return;
    if (campDist() < PACIFY.warn.far) return;
    const left = Math.max(0, TIDE.dayLen - S.dayT), walk = walkHome();
    if (left > walk + PACIFY.warn.margin) return;
    warnDay = S.night;
    const t = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    ev('duskWarn', { left: Math.round(left), walk: Math.round(walk) });
    toast(`[Dusk in ${t(left)}] The Haven is **${t(walk)}** away.${homeFrom() ? ' **Return to Camp** from here.' : ' A lit fire or a site you hold takes you home.'}`, 'bad');
  }

  /** once a step (game.js): the land watch (4× a second), the way home, the dusk warning */
  function stepPacify(dt) {
    if (S.over) return;
    stepHome(dt);
    if ((watchT -= dt) <= 0) { watchT = 0.25; if (!G.v2) watch(); duskWarn(); }   // [v2] no hive wakes on the map, no pacified-land lines
  }
  return { pacifyMap, pacifiedAt, smothered, regionPacified, homeNight, homeK, threatInfo, homeInfo, returnHome, cancelReturn, stepPacify };
}
