// The small helpers every part of the rules uses: events (ev, toast, fail), blessings owned (has, combo, mastery),
// scrap in (earn), people (pop, houseCap), season rules (rule), the live-building cache, compass words, the shroud (reveal).
// Created first: every other module destructures these from G. Part of createGame (see game.js).
import { BUILDINGS } from '../content/buildings.js';
import { N, idx } from './mapgen.js';

export function createCore(G) {
  const { S, c, map } = G;

  // ---------- helpers ----------
  const ev = (t, o = {}) => { const e = { ...o, t }, n = S.events.push(e); if (G.onEv) G.onEv(e); return n; };   // the type always wins over a payload field · [ch1] G.onEv: a listener (the chapter)
  const toast = (msg, kind) => ev('toast', { msg, kind });
  const has = id => (S.P.taken[id] || 0) > 0;
  const combo = (a, b) => has(a) && has(b);
  let mastSet = new Set();
  const mastery = id => mastSet.has(id);
  const syncMastery = () => { mastSet = new Set(Object.values(S.P.mastery)); };
  const mastered = f => !!S.P.mastery[f];
  const isDef = t => t === 'tower' || t === 'wall';
  const earn = g => { S.gold += g; S.stats.goldEarned += Math.max(0, g); };
  // people: survivors, the families in the homes (b.folk) and the homeless who fled a fallen home to the Camp.
  // A fallen home loses half its people (they rise with the dead, for good); the rest flee to the Camp and move back in
  // when you rebuild it. New homes and upgrades bring new people; convoys, rescues and lit outposts bring people back.
  const houseCap = b => BUILDINGS.house.pop[b.level - 1];
  const pop = () => Math.max(0, S.survivors + (S.homeless || 0) + S.buildings.reduce((s, b) => s + (b.type === 'house' ? (b.folk ?? houseCap(b)) : 0), 0));
  const near = (b, type, r) => S.buildings.some(o => o !== b && o.type === type && !o.ruined && Math.hypot(o.x - b.x, o.y - b.y) <= r);
  const hasTech = t => S.buildings.some(b => b.type === t && !b.ruined && b.built >= 1);
  const claimedCount = () => S.claimed.size;
  let liveCache = null, liveTick = -1;
  const dropLive = () => { liveTick = -1; };   // buildings changed: live() re-reads them
  const live = () => { if (liveTick !== S.time) { liveCache = S.buildings.filter(b => !b.ruined); liveTick = S.time; } return liveCache; };
  const owns = k => S.landmarks.some(l => l.owned && l.kind === k);
  const syncPicks = () => { S.pendingPicks = S.picks.length; };
  // picks: what the old rules handed out as blessing cards (a chest, a level, a hive). V2 has no blessings: every pick is dropped
  function rollOffer() { S.picks.length = 0; S.offer = []; S.offerSource = null; syncPicks(); }

  // ---------- the shroud: the city starts dark; you, your buildings and your land reveal it ----------
  function reveal(x, y, r) {
    const r2 = r * r; let changed = false;
    for (let yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(N - 1, Math.ceil(y + r)); yy++) for (let xx = Math.max(0, Math.floor(x - r)); xx <= Math.min(N - 1, Math.ceil(x + r)); xx++) {
      const i = idx(xx, yy); if (S.seen[i]) continue;
      if ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= r2) { S.seen[i] = 1; changed = true; }
    }
    if (changed) S.seenVersion++;
  }
  function revealRegion(r) { for (let i = 0; i < N * N; i++) if (map.region[i] === r) S.seen[i] = 1; S.seenVersion++; }
  /** a refused action: a 'fail' event the UI shows (silent while S.quiet, e.g. rebuildAll); returns false */
  function fail(msg) { if (!S.quiet) ev('fail', { msg }); return false; }
  // ---------- compass words for toasts: 'north-east' ----------
  const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  function compass(x, y) { const a = Math.atan2(x - c, -(y - c)); return DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; }
  // ---------- season rules (seasons.js owns the season itself) ----------
  // a season's rules live in S.season.rules (a won contract's rules stack); S.season.rule is the newest, for old readers
  const RULE_ALIAS = {};
  const rule = id => { if (!S.season) return false; const list = S.season.rules || [], a = RULE_ALIAS[id] || id; return list.some(r => (RULE_ALIAS[r] || r) === a) || (RULE_ALIAS[S.season.rule] || S.season.rule) === a; };
  return { ev, toast, has, combo, mastery, syncMastery, mastered, isDef, earn, houseCap, pop, near, hasTech, claimedCount, dropLive, live, owns, syncPicks, rollOffer, reveal, revealRegion, fail, compass, rule };
}
