// Acts: the run opens in the woods. Act 1: burn every forest hollow round the Camp (the ring-1 nests). Until then the
// road past the woods and the whole city sit behind the quarantine fence (sealed in S.sealed, listed in S.actGate),
// the scouts offer no routes, and the System's main goal is "Burn the hollows". When the last hollow burns the System
// says so ("The road is open"), the fences come down and act 2 begins: the road, its stations, the city, the routes.
// Off when CUT.earlyRoad is false (everything open from day 1, as before). Wired in game.js (`// [acts]` blocks).
import { CUT } from './state.js';

export const ACT = { woodsR: 60 };   // ring-1 regions this far out (by their middle) are the road's, not the woods'

export function createActs(G) {
  const { S, map, c, ev, toast } = G;
  const hollows = () => map.regions.filter(r => r.ring === 1 && r.nest);
  /** the regions act 1 keeps behind the fence: the road past the woods and the city (the old core is sealed anyway) */
  const gated = () => map.regions.filter(r => r.ring === 2 || (r.ring === 1 && Math.hypot(r.x - c, r.y - c) >= ACT.woodsR)).map(r => r.id);
  const left = () => hollows().filter(r => S.nestAlive[r.id] && !S.claimed.has(r.id));
  const actNow = () => S.act || 2;
  function seal() {
    S.actGate = gated();
    for (const r of S.actGate) S.sealed[r] = 1;
    S.sealVersion++; S.flowDirty = true; S.occVersion = (S.occVersion || 0) + 1;
  }
  /** start of the run: act 1, unless acts are cut or this map has no hollows */
  function actSetup() {
    S.act = 2; S.actGate = [];
    if (!CUT.earlyRoad || !hollows().length || !left().length) return;
    S.act = 1; seal();
  }
  /** a restored save: the act follows from what burned (an old save without acts is re-fenced if hollows still stand) */
  function actRestore() {
    if (!CUT.earlyRoad || !hollows().length) { S.act = 2; S.actGate = []; return; }
    if (!left().length) { S.act = 2; S.actGate = []; S.actOpened = S.actOpened || S.night; return; }
    S.act = 1; seal();
  }
  /** called when a hive burns: the last hollow opens the road */
  function actCheck() {
    if (actNow() >= 2 || left().length) return false;
    S.act = 2; S.actOpened = S.night;
    for (const r of S.actGate || []) S.sealed[r] = 0;
    S.actGate = []; S.sealVersion++; S.flowDirty = true; S.occVersion = (S.occVersion || 0) + 1;
    G.spawnRoamers();
    ev('actOpen', { act: 2 });
    toast('[The road is open] The hollows are ash. The fences come down.', 'sys');
    const win = { eyebrow: '[Act 2]', title: 'The road is open', feat: 'road', ok: 'Walk the road',
      lines: ['The woods are **clear**. The quarantine fences are **down**.', 'The **old road** runs to the city: light its **fires** and hold them.', 'Beyond it, **the city**. Its hives are bigger.'] };
    if (G.story && G.story.windowNow) G.story.windowNow(win); else ev('window', win);
    if (G.story) G.story.chron('Burned the last hollow. The road opened.', 4, ['act']);
    return true;
  }
  /** the System's main goal while act 1 lasts (null after) */
  function actGoal() {
    if (actNow() >= 2) return null;
    const all = hollows(), rest = left(), near = rest.slice().sort((a, b) => Math.hypot(a.nest.x - c, a.nest.y - c) - Math.hypot(b.nest.x - c, b.nest.y - c))[0];
    return { tag: '[Main]', have: all.length - rest.length, n: all.length, text: 'Burn the hollows', extra: near ? `Nearest: ${G.compass(near.nest.x, near.nest.y)}` : '', act: 1 };   // (a contract's countdown takes the second line)
  }
  /** a region held back by act 1 (the UI hides it) */
  const actGated = r => actNow() < 2 && !!S.actGate && S.actGate.includes(r);
  return { actSetup, actRestore, actCheck, actGoal, actGated, actNow };
}
