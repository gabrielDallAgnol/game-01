// [roam] Risk and repair (M5, docs/design/implementation-plan.md): the bike has a body of its own and dying costs something.
// - The bike takes the hits first while Kai rides it (soak), and hard crashes dent it. Low, it runs slower and smokes;
//   wrecked, it limps along at half speed and every hit goes to Kai. It never mends by itself.
// - Repair costs scrap: in the field Kai stops and works on it with the wrench (slow, only with no machine near, stopped
//   by a hit or the stick); at a bank it is fixed fast from banked scrap.
// - Scrap and chips Kai carries are at risk. Riding into a bank (the garage on the square where she starts, and a beacon
//   where each area's walker fell) banks them for good.
// - Going down drops what she carries as a cache where she fell; ride over it to take it back. A second death before
//   that loses the first cache.
// Offers G.hurtBike(n, why), G.bikeTop(), G.startFix(), G.stepRisk(dt, inp). Wraps G.hurtKai (the bike soaks first).
export function createRisk(G) {
  const { R, S, ev, town } = G, K = R.risk, b = S.bike, k = S.kai;
  b.hp = K.bikeHp; b.maxHp = K.bikeHp; b.fixing = false; b.fixDebt = 0;
  S.bank = { scrap: 0, chips: 0 }; S.cache = null;
  S.banks = [{ x: town.start.x, y: town.start.y, kind: 'garage', name: 'the garage' }];
  function hurtBike(n, why) { if (n <= 0 || b.hp <= 0) return; const f0 = b.hp / b.maxHp; b.hp = Math.max(0, b.hp - n);
    ev('bikeHurt', { n, why: why || 'hit', x: b.x, y: b.y });
    if (b.hp <= 0) ev('bikeWreck', { x: b.x, y: b.y }); else if (f0 >= K.low && b.hp / b.maxHp < K.low) ev('bikeLow', { x: b.x, y: b.y }); }
  // the top speed the bike can make now: worn below K.low, limping when wrecked
  const bikeTop = () => b.hp <= 0 ? K.limp : b.hp / b.maxHp < K.low ? K.worn : 1;
  // the bike soaks a share of every hit while she rides it and it still has a body
  const hurt0 = G.hurtKai;
  function hurtKai(n) { if (k.dead || k.dash > 0) return;
    if (b.fixing) stopFix('hit');
    if (k.riding && b.hp > 0) { const s = Math.min(b.hp, n * K.soak); hurtBike(s, 'hit'); n -= s; }
    hurt0(n); if (k.dead) down(); }
  // she went down: what she carried stays where she fell
  function down() { stopFix(); if (!(S.scrap > 0 || S.chips > 0)) return;
    if (S.cache) ev('cacheLost', { scrap: S.cache.scrap, chips: S.cache.chips });
    S.cache = { x: k.x, y: k.y, scrap: S.scrap, chips: S.chips, t: S.t }; ev('cache', { x: k.x, y: k.y, scrap: S.scrap, chips: S.chips });
    S.scrap = 0; S.chips = 0; }
  // a walker's fall becomes a beacon: a bank out in the area it cleaned
  (G.onDie ||= []).push(d => { if (!d.boss) return; const a = G.areaAt && G.areaAt(d.x, d.y);
    S.banks.push({ x: d.x, y: d.y, kind: 'beacon', name: (a ? a.name : 'the') + ' beacon' }); ev('beacon', { x: d.x, y: d.y }); });
  const machineNear = r => { for (const d of S.dead) if (d.state === 'chase' || d.boss) { if (Math.hypot(d.x - b.x, d.y - b.y) < r) return true; } return false; };
  const atBank = () => { for (const q of S.banks) if (Math.hypot(q.x - k.x, q.y - k.y) < K.bankR) return q; return null; };
  function startFix() {
    const why = k.dead ? 'down' : b.hp >= b.maxHp ? 'whole' : !(S.scrap > 0) ? 'scrap' : machineNear(K.safeR) ? 'machines' : (!k.riding && Math.hypot(b.x - k.x, b.y - k.y) > R.bike.enter) ? 'far' : '';
    if (why) { ev('fixNo', { why }); return false; }
    b.fixing = true; b.speed = 0; ev('fixStart', { x: b.x, y: b.y }); return true; }
  function stopFix(why) { if (!b.fixing) return; b.fixing = false; b.fixDebt = 0; ev('fixStop', { why: why || 'done', x: b.x, y: b.y }); }
  // mend the bike by hp at rate, paying from purse ('scrap' carried or the bank): one scrap per K.fixPer health
  function mend(rate, dt, purse) { const p = purse === 'bank' ? S.bank : S, gain = Math.min(rate * dt, b.maxHp - b.hp);
    b.fixDebt += gain / K.fixPer;
    while (b.fixDebt >= 1) { if (!(p.scrap > 0)) return false; p.scrap--; b.fixDebt--; ev('fixTick', { x: b.x, y: b.y, from: purse }); }
    b.hp = Math.min(b.maxHp, b.hp + gain); return true; }
  let wasDead = false;
  function stepRisk(dt, inp) {
    if (wasDead && !k.dead) { b.hp = Math.max(b.hp, b.maxHp * K.backHp); ev('towed', { hp: b.hp }); }   // back at the square: the bike was towed in, patched up enough to ride
    wasDead = k.dead > 0; if (k.dead) return;
    if (inp && inp.repair) { inp.repair = false; if (b.fixing) stopFix('stopped'); else startFix(); }
    // the cache: ride or walk over it
    const c = S.cache; if (c && Math.hypot(c.x - k.x, c.y - k.y) < K.cacheR) { S.scrap += c.scrap; S.chips += c.chips; S.cache = null; ev('cacheBack', { x: c.x, y: c.y, scrap: c.scrap, chips: c.chips }); }
    const q = atBank();
    if (q) {
      if (S.scrap > 0 || S.chips > 0) { ev('bank', { x: q.x, y: q.y, scrap: S.scrap, chips: S.chips, kind: q.kind }); S.bank.scrap += S.scrap; S.bank.chips += S.chips; S.scrap = 0; S.chips = 0; }
      if (b.fixing) stopFix('bank');
      if (k.riding && b.hp < b.maxHp && S.bank.scrap > 0) { const was = b.hp; mend(K.bankFix, dt, 'bank'); if (b.hp >= b.maxHp && was < b.maxHp) ev('fixed', { x: b.x, y: b.y, at: q.kind }); }
      return; }
    if (!b.fixing) return;
    // a field repair: still, safe and paid for, or it stops
    if (inp && Math.hypot(inp.x || 0, inp.y || 0) > 0.3) return stopFix('moved');
    if (machineNear(K.safeR)) return stopFix('machines');
    b.speed = 0;
    if (!mend(K.fixRate, dt, 'scrap')) return stopFix('scrap');
    if (b.hp >= b.maxHp) { stopFix('done'); ev('fixed', { x: b.x, y: b.y, at: 'field' }); }
  }
  Object.assign(G, { hurtBike, bikeTop, startFix, stepRisk, hurtKai });
}
