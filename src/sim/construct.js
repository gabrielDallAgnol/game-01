// [econ3] The construction queue: building takes time. A placed building is a blueprint on its lot (a scaffold that
// holds the ground and can be attacked); upgrades and new carts are jobs too. Crews (1 + one per 5 people) work the
// queue top down; a job whose site has the dead close by waits (its crew runs) and the crew takes the next one. Night
// does not stop the queue. A building under construction does not work: no shots, no pay, no food, no family yet.
// The player reorders and cancels jobs (a cancel refunds what was paid); a scaffold torn down by the dead is lost.
// S.econ.q: [{ id, kind: 'build'|'up'|'cart', bid, type, level, paid, stock, work, need, x, y, fled }]
import { BUILDINGS } from '../content/buildings.js';
import { CONSTRUCT, ECON } from '../content/econ.js';
import { MOBS } from '../content/mobs.js';

export function createConstruct(G) {
  const { S, ev, fail, toast, keep } = G;
  const E = () => S.econ || (S.econ = {});
  const Q = () => E().q || (E().q = []);
  const on = () => ECON.queue && !S.instantBuild;
  const timeOf = (type, level) => { const t = CONSTRUCT.time[type]; return (Array.isArray(t) ? t[level - 1] ?? t[t.length - 1] : t) || 8; };
  const speed = () => (E().mods && E().mods.buildSpeed) || 1;
  const crews = () => CONSTRUCT.crews(G.pop()) + ((E().mods && E().mods.crews) || 0);
  const nameOf = j => (j.kind === 'cart' ? 'Harvester cart' : `${(BUILDINGS[j.type] || {}).name || j.type}${j.kind === 'up' ? ` → level ${j.level}` : ''}`);
  const full = () => Q().length >= CONSTRUCT.maxJobs;
  function add(j) { j.id = E().nextJob = (E().nextJob || 0) + 1; j.work = 0; j.need = j.kind === 'cart' ? timeOf('cart') : timeOf(j.type, j.level); j.fled = false; Q().push(j); ev('queue', { id: j.id }); return j; }

  /** a new building just placed (build.js): it becomes a blueprint in the queue */
  function queueNew(b, paid, stock) {
    if (!on() || b.type === 'wall') return;
    b.built = 0; b.cq = 1; b.hp = Math.max(1, Math.ceil(b.maxHp * CONSTRUCT.hp0));
    if (b.type === 'house') { b.folkDue = b.folk; b.folk = 0; }   // the family moves in when the roof is on
    add({ kind: 'build', bid: b.id, type: b.type, level: b.level, paid, stock: !!stock, x: b.x, y: b.y });
  }
  /** an upgrade (build.js): the building keeps working at its level until the job is done */
  function queueUp(b, paid) {
    if (!on()) return false;
    add({ kind: 'up', bid: b.id, type: b.type, level: b.level + 1, paid, x: b.x, y: b.y });
    return true;
  }
  const upQueued = id => Q().some(j => j.kind === 'up' && j.bid === id);
  /** a new harvester cart (haul.js decides whether one may be ordered) */
  function queueCart(paid) {
    if (full()) return fail('The work queue is full.');
    const d = G.cartDock ? G.cartDock() : { x: keep.x, y: keep.y + 3 };
    return add({ kind: 'cart', type: 'cart', level: 1, paid, x: d.x, y: d.y });
  }

  // ---------- the work ----------
  const danger = (x, y) => S.mobs.some(m => m.rise >= 1 && !m.dying && !MOBS[m.kind].animal && !m.roam && Math.hypot(m.x - x, m.y - y) < CONSTRUCT.flee)
    || S.mobs.some(m => m.rise >= 1 && m.hunt && Math.hypot(m.x - x, m.y - y) < CONSTRUCT.flee);
  function finish(j) {
    Q().splice(Q().indexOf(j), 1);
    E().done = (E().done || 0) + 1;
    if (j.kind === 'cart') { if (G.addCart) G.addCart(); toast('A new **harvester cart** rolls out of the yard.', 'good'); ev('built', { id: 0, cart: true }); return; }
    const b = S.byId.get(j.bid); if (!b) return;
    if (j.kind === 'up') {
      const nb = G.raise(b); ev('built', { id: nb.id, up: true });
      toast(`The ${BUILDINGS[nb.type].name} is now level ${nb.level}. ${BUILDINGS[nb.type].desc[nb.level - 1] || ''}`, 'good'); return;
    }
    b.built = 1; delete b.cq; b.hp = b.maxHp;
    if (b.type === 'house') { b.folk = b.folkDue ?? G.houseCap(b); delete b.folkDue; }
    G.dropLive(); S.occVersion = (S.occVersion || 0) + 1;
    ev('built', { id: b.id });
    toast(`The ${BUILDINGS[b.type].name} is finished. ${BUILDINGS[b.type].desc[b.level - 1] || BUILDINGS[b.type].desc[0]}`, 'good');
  }
  function stepConstruct(dt) {
    const q = S.econ && S.econ.q; if (!q || !q.length || S.over) return;
    let free = crews();
    for (const j of [...q]) {
      if (free <= 0) { j.active = false; continue; }
      const b = j.bid !== undefined ? S.byId.get(j.bid) : null;
      if (j.kind !== 'cart' && (!b || (b.ruined && j.kind === 'up'))) { q.splice(q.indexOf(j), 1); if (j.kind === 'up') { G.earn(j.paid); toast(`The upgrade was called off: ${j.paid} scrap back.`); } continue; }
      if (j.kind === 'build' && b.built >= 1) { j.work = 1; finish(j); continue; }   // finished by other hands (a story gift, a test)
      j.fled = danger(j.x, j.y); j.active = !j.fled;
      if (j.fled) continue;
      free--;
      const k = dt * speed() / j.need; j.work = Math.min(1, j.work + k);
      if (j.kind === 'build' && b) { b.built = Math.min(0.999, j.work); b.hp = Math.min(b.maxHp, b.hp + b.maxHp * (1 - CONSTRUCT.hp0) * k); }
      if (j.work >= 1) finish(j);
    }
  }

  // ---------- the player's hand on the queue ----------
  function queueMove(id, dir) {
    const q = Q(), i = q.findIndex(j => j.id === id); if (i < 0) return false;
    const to = dir === 'top' ? 0 : Math.max(0, Math.min(q.length - 1, i + (dir < 0 ? -1 : 1)));
    if (to === i) return false;
    const [j] = q.splice(i, 1); q.splice(to, 0, j); ev('queue', { id }); return true;
  }
  function queueCancel(id) {
    const q = Q(), j = q.find(x => x.id === id); if (!j) return fail('No such job.');
    q.splice(q.indexOf(j), 1);
    if (j.stock) S.stock[j.type] = (S.stock[j.type] || 0) + 1; else if (j.paid) { S.gold += j.paid; S.cur.spent -= j.paid; S.stats.goldSpent -= j.paid; }
    if (j.kind === 'build') { const b = S.byId.get(j.bid); if (b) G.removeBuilding(b); S.stats.built = Math.max(0, S.stats.built - 1); }
    ev('queue', { id }); toast(`${nameOf(j)} called off${j.paid ? `: **+${j.paid}** scrap back` : ''}.`);
    return true;
  }
  const cancelFor = bid => { const j = Q().find(x => x.kind === 'build' && x.bid === bid); return j ? queueCancel(j.id) : false; };
  /** the dead tore a scaffold down (combat.js ruin): it is gone, and so is what it cost */
  function scaffoldFell(b) {
    const q = Q(), j = q.find(x => x.kind === 'build' && x.bid === b.id); if (j) q.splice(q.indexOf(j), 1);
    S.cur.lost.push(b.type); S.stats.buildingsLost++;
    G.removeBuilding(b);
    toast(`The dead tore down the ${BUILDINGS[b.type].name}'s scaffold.`, 'bad');
    ev('scaffoldFell', { x: b.x, y: b.y });
  }
  function queueInfo() {
    let free = crews();
    return Q().map(j => { const act = !j.fled && free > 0; if (act) free--; return { id: j.id, kind: j.kind, type: j.type, level: j.level, bid: j.bid, name: nameOf(j), pct: Math.floor(j.work * 100), left: Math.max(0, Math.ceil((1 - j.work) * j.need / speed())), paid: j.paid, stock: j.stock, active: act && !!j.active, fled: !!j.fled, x: j.x, y: j.y }; });
  }
  /** a restored save: buildings come back whole; the queue's blueprints become scaffolds again */
  function constructRestore() {
    for (const j of Q()) if (j.kind === 'build') { const b = S.byId.get(j.bid); if (b) { b.built = Math.min(0.999, j.work); b.cq = 1; if (b.type === 'house') { b.folkDue = b.folkDue || b.folk || G.houseCap(b); b.folk = 0; } } }
  }
  return { cancelFor, queueNew, queueUp, upQueued, queueCart, stepConstruct, queueMove, queueCancel, queueInfo, scaffoldFell, constructRestore, queueOn: on, queueFull: full, crews };
}
