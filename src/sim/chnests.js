// [ch1] Nests as infested buildings (story1.js NESTS): the cinema, the goods shed and, for the finale, the Engine
// Works. A nest wakes at the dawn of its night (or when the step that breaks it opens): its Ash Heart (a still body,
// MOBS.heart) sits at the door and its halls come out one after another as packs awake by day; the heart is sealed
// (it mends) while a hall or the boss stands. Kai and any turret in range hit the heart like any dead; break it for
// quest progress and loot. The Works waits behind its gate (q7.halls) and keeps the Inferno Warden for last; its Heart
// breaking stirs the town and brings dusk early. State in S.ch.nests; the mobs are respawned from it after a restore.
import { NESTS, SYS1 } from '../content/story1.js';
import { NEST1, FINALE } from '../content/ch1tune.js';

export function createChNests(G) {
  const { S } = G;
  const N1 = () => S.ch.nests, def = id => NESTS.find(n => n.id === id);
  const halls = n => n.halls.map(k => Math.max(3, Math.round(k * NEST1.hall)));
  function nestsInit() {
    const P = G.places() || {};
    for (const n of NESTS) if (P[n.place] && !N1()[n.id]) N1()[n.id] = { state: 'sleep', hall: 0, guards: [], heart: null, hp: n.core.hp, boss: null, bossDone: !n.boss, go: n.id !== 'works' };
    if (S.restored) for (const [id, o] of Object.entries(N1())) if (o.state === 'live') { o.heart = null; o.boss = null; o.guards = []; if (o.hall > 0 && !o.cleared) o.hall--; spawnHeart(id); }
  }
  const at = id => (G.places() || {})[def(id).place];
  function spawnHeart(id) {
    const o = N1()[id], p = at(id); if (!p) return;
    const m = G.spawnMob('heart', p.at.x, p.at.y, { instant: true }); m.hp = Math.min(m.maxHp = def(id).core.hp, o.hp); m.roam = { x: m.x, y: m.y, region: -1 }; m.chNest = id; o.heart = m.id;
  }
  /** wake a nest: its heart at the door, its first hall out (the Works' halls wait for its gate step) */
  function nestWake(id, step) {
    const o = N1()[id]; if (!o) return;
    if (step === 'q7.halls' || step === 'q4.cinema' || step === 'q6.shed') o.go = true;
    if (step === 'q7.heart') o.heartGo = true;
    if (o.state !== 'sleep') return;
    o.state = 'live'; spawnHeart(id); G.chSys(SYS1.nest, 'bad'); G.ev('nestWake', { id, x: at(id).at.x, y: at(id).at.y });
  }
  function nestDawn() { for (const n of NESTS) { const o = N1()[n.id]; if (o && o.state === 'sleep' && S.night >= n.opens) nestWake(n.id); } }
  const alive = ids => ids.filter(i => G.mobById.has(i));
  function stepNests() {
    for (const n of NESTS) {
      const o = N1()[n.id]; if (!o || o.state !== 'live') continue;
      const H = halls(n), p = at(n.id);
      o.guards = alive(o.guards);
      if (!o.guards.length && o.go && o.hall < H.length) {   // the next hall comes out
        const k = o.hall++, side = (k - (H.length - 1) / 2) * Math.min(10, p.w / 3), ang = (p.rot || 0);
        o.guards = G.spawnPack(`${n.id}:${k}`, p.at.x + Math.cos(ang) * side, p.at.y + Math.sin(ang) * side, H[k]);
        G.ev('hallOpen', { id: n.id, hall: k, n: H[k] });
      }
      if (!o.guards.length && o.hall >= H.length) o.cleared = true;
      if (o.cleared && !o.bossDone && o.heartGo && !o.boss) { const m = G.spawnMob(n.boss, p.at.x + 2, p.at.y + 2, { instant: true }); m.hp = m.maxHp = NEST1.wardenHp; m.roam = { x: p.at.x, y: p.at.y, region: -1 }; o.boss = m.id; G.chSys('[Unique: Inferno Warden]', 'bad'); }
      if (o.boss && !G.mobById.has(o.boss)) { o.boss = null; o.bossDone = true; }
      const hm = G.mobById.get(o.heart);
      if (hm) { const sealed = !o.cleared || !o.bossDone || (n.boss && !o.heartGo); if (sealed && NEST1.heal) hm.hp = hm.maxHp; o.hp = hm.hp; o.sealed = sealed; }
      else if (o.heart !== null) broken(n, o);
      else spawnHeart(n.id);
    }
  }
  function broken(n, o) {
    o.state = 'broken'; o.heart = null; o.hp = 0;
    const r = n.reward || {}; if (r.scrap) G.earn(r.scrap); if (r.parts) { if (G.addParts) G.addParts(r.parts); else G.earn(r.parts); }
    G.ev('nestBroken', { id: n.id, x: at(n.id).at.x, y: at(n.id).at.y, scrap: r.scrap || 0 });
    G.chSys(SYS1.core, 'win');
    if (n.id === 'works') {   // the twist: every sleeper stirs, dusk comes early
      S.dayT = Math.max(S.dayT, (S.tide ? S.tide.dayLen : 0) - FINALE.duskLeft);
      G.chSys('[Ash activity: all sectors]', 'bad'); G.ev('heartBroken', {});
    }
  }
  const nestHalls = id => { const o = N1() && N1()[id], n = def(id); if (!o || !n) return -1; if (o.state === 'sleep') return halls(n).length; return halls(n).length - o.hall + (alive(o.guards).length ? 1 : 0); };
  const nestBroken = id => !!(N1() && N1()[id] && N1()[id].state === 'broken');
  const chNests = () => (S.ch ? NESTS.filter(n => N1()[n.id]).map(n => { const o = N1()[n.id], p = at(n.id); return { id: n.id, x: p.x, y: p.y, at: p.at, w: p.w, h: p.h, rot: p.rot, r: Math.max(p.w, p.h) / 2, state: o.state, sealed: !!o.sealed, hp: o.hp, max: n.core.hp, hall: o.hall, halls: halls(n).length }; }) : []);
  return { nestsInit, nestWake, nestDawn, stepNests, nestHalls, nestBroken, chNests };
}
