// [rig3] The Haven Rig: the keep is a hauler that anchors, grows and moves on. Its four systems (plating, guns, cargo,
// speed) rise for good as the town's building tiers rise (content/rig.js). When the act's road is open (sim/acts.js),
// "Pack up & roll" salvages every ground building into the cargo hold and the Rig drives off; sim/migrate.js then
// builds the next act's run and calls rigArrive() on it with what rode along. Events for the story: 'rigUp',
// 'rigRoad' (the road is open: the Rig can roll), 'rigMigrate' (packed, rolling), 'rigAnchor' and 'actStart' (anchored
// in the new act). The save gets a versioned `rig` block (wrapped snapshot/restore, no edit to save.js).
import { BUILDINGS } from '../content/buildings.js';
import { TIDE } from '../content/mobs.js';
import { heroKit } from '../content/heroes.js';
import { RIG, legOf, HERO_PLACE } from '../content/rig.js';
import { SPEC_COST } from '../content/towers.js';

const SYS = Object.keys(RIG.ups);
const freshRig = () => ({ v: RIG.v, leg: 1, mode: 'anchored', ups: { plating: 0, guns: 0, cargo: 0, speed: 0 }, cargo: null, rolls: 0, roadTold: false });

export function createRig(G) {
  const { S, keep, ev, toast } = G;
  S.rig = freshRig();
  let tickT = 0;

  // ---------- the town's tiers and the rig's systems ----------
  function tally() {
    const t = { homeUp: 0, farmUp: 0, towerUp: 0, spec: 0, allUp: 0, tech: 0, lvl3: 0, keepLvl: keep.level };
    for (const b of S.buildings) {
      if (b.ruined || (b.built !== undefined && b.built < 1)) continue;
      const up = Math.max(0, (b.level || 1) - 1);
      if (b.type === 'house') t.homeUp += up; else if (b.type === 'farm') t.farmUp += up; else if (b.type === 'tower') { t.towerUp += up; if (b.spec) t.spec += 2; }
      if (BUILDINGS[b.type] && BUILDINGS[b.type].tech) t.tech++;
      t.allUp += up; if ((b.level || 1) >= 3) t.lvl3++;
    }
    return t;
  }
  const levelFor = (sys, score) => RIG.ups[sys].at.filter(a => score >= a).length;
  /** what a system does now: hp and dmg are multipliers, shots is extra shots */
  function rigK(kind) {
    if (!RIG.on || !S.rig) return kind === 'shots' ? 0 : 1;
    const u = S.rig.ups;
    if (kind === 'hp') return 1 + RIG.hpPer * u.plating;
    if (kind === 'dmg') return 1 + RIG.dmgPer * u.guns;
    if (kind === 'shots') return u.guns >= 3 ? 1 : 0;
    return 1;
  }
  function refreshUps(quiet) {
    const t = tally(); let hp = false;
    for (const sys of SYS) {
      const lv = levelFor(sys, RIG.ups[sys].score(t));
      if (lv > S.rig.ups[sys]) {
        S.rig.ups[sys] = lv; if (sys === 'plating') hp = true;
        if (!quiet) { ev('rigUp', { sys, lvl: lv }); toast(`[Haven Rig] ${RIG.ups[sys].name} ${lv}: ${RIG.ups[sys].fx}.`, 'good'); }
      }
    }
    if (hp) G.refreshMax();
  }
  /** the GOV stat (hero3), when the hero has stats */
  const gov = () => (S.hero.stats && +S.hero.stats.GOV) || 0;
  /** the share of a building's cost that rides along */
  function salvagePct(b) {
    const s = RIG.salvage;
    const p = Math.min(s.max, s.base + s.perLevel * Math.max(0, (b.level || 1) - 1) + s.perCargo * S.rig.ups.cargo + s.perGov * gov());
    return b.ruined ? p * s.ruin : p;
  }
  /** what a building cost, by resource (base costs per level; a specialised tower's role too) */
  function paid(b) {
    const d = BUILDINGS[b.type] || {}, out = { scrap: 0 };
    for (let l = 0; l < (b.level || 1); l++) {
      const c = Array.isArray(d.cost) ? d.cost[l] : d.cost;
      if (typeof c === 'number') out.scrap += c;
      else if (c && typeof c === 'object') for (const k in c) out[k === 'gold' ? 'scrap' : k] = (out[k === 'gold' ? 'scrap' : k] || 0) + (+c[k] || 0);   // (a cost by resource)
    }
    if (b.spec) out.scrap += SPEC_COST;
    return out;
  }
  /** the cargo the town would make if it rolled now: { scrap, food, …, salvaged, people, pct } */
  function cargoNow() {
    const out = { scrap: Math.max(0, Math.floor(S.gold)), food: Math.max(0, Math.floor(S.food)), salvaged: 0, buildings: 0, people: 0, pct: 0 };
    for (const k of RIG.stock) if (typeof S[k] === 'number') out[k] = Math.max(0, Math.floor(S[k]));
    let cost = 0; const got = {};
    for (const b of S.buildings) {
      const p = paid(b), k = salvagePct(b);
      for (const r in p) { got[r] = (got[r] || 0) + p[r] * k; if (r === 'scrap') cost += p[r]; }
      out.buildings++;
      if (b.type === 'house') out.people += b.folk ?? 0;
    }
    for (const r in got) { const v = Math.floor(got[r] + 1e-6); out[r] = (out[r] || 0) + v; if (r === 'scrap') out.salvaged = v; }
    out.pct = cost ? Math.round((got.scrap || 0) / cost * 100) : Math.round(salvagePct({ level: 1 }) * 100);
    return out;
  }

  // ---------- packing up ----------
  /** '' when the Rig may roll now, else why not */
  function rigBlock() {
    if (!RIG.on) return 'The Rig is off.';
    if (S.over) return 'The run is over.';
    if (S.rig.mode !== 'anchored') return 'The Rig is already moving.';
    if (S.phase !== 'day') return 'Not at night: the Rig rolls by day.';
    if ((G.actNow ? G.actNow() : 2) < 2) { const g = G.actGoal && G.actGoal(); return g ? `The road is blocked: ${g.text} (${g.have}/${g.n}).` : 'The road is blocked.'; }
    return '';
  }
  /** salvage everything and roll: returns the cargo (null when blocked; the reason is a fail toast) */
  function rigPack() {
    const why = rigBlock(); if (why) { G.fail(why); return null; }
    const cargo = cargoNow();
    for (const b of [...S.buildings]) { if (b.type === 'house' && b.folk) S.homeless = (S.homeless || 0) + b.folk; G.removeBuilding(b); }
    if (G.dropCrew) G.dropCrew();
    S.gold = 0; S.food = 0; for (const k of RIG.stock) if (typeof S[k] === 'number') S[k] = 0;
    S.rig.cargo = cargo; S.rig.mode = 'rolling'; S.rig.rolls++;
    S.flowDirty = true; S.occVersion = (S.occVersion || 0) + 1;
    const next = legOf(S.rig.leg + 1);
    ev('rigMigrate', { leg: S.rig.leg, to: S.rig.leg + 1, name: next.name, scrap: cargo.scrap, food: cargo.food, pct: cargo.pct, buildings: cargo.buildings });
    toast(`[Haven Rig] Packed up: **${cargo.buildings}** buildings salvaged at **${cargo.pct}%**. Rolling for ${next.name}.`, 'sys');
    if (G.story && G.story.chron) G.story.chron(`Packed up the Haven Rig and rolled out of ${legOf(S.rig.leg).name}.`, 4, ['act', 'rig']);
    return cargo;
  }

  // ---------- arriving: the next act's run takes what rode along (sim/migrate.js builds `C`) ----------
  function rigArrive(C) {
    const n = C.S.night || 1;
    for (const [k, v] of Object.entries(C.S)) S[k] = v;
    for (const [k, v] of Object.entries(C.hero || {})) if (!HERO_PLACE.includes(k)) S.hero[k] = v;
    // the story: who you are and what you lived through rides along; this region's threads, quests and cards do not
    const keepStory = ['chronicle', 'titles', 'npcs', 'flags', 'n1', 'nextId', 'day', 'contract', 'rules', 'power', 'hands', 'arc', 'acts'];
    for (const k of keepStory) if (C.story && k in C.story) S.story[k] = C.story[k];
    S.story.encounters = []; S.story.later = [];
    // the cargo is the starting stock; the homeless ride along and want homes
    const cg = C.rig.cargo || {};
    S.gold = cg.scrap || 0; S.food = cg.food || 0;
    for (const k in cg) if (!['scrap', 'food', 'salvaged', 'buildings', 'people', 'pct'].includes(k) && typeof S[k] === 'number') S[k] = cg[k];
    S.homeless = C.homeless || 0;
    keep.level = C.keepLvl || 1; keep.r = 2.3 * (1 + 0.12 * (keep.level - 1));
    S.rig = { ...C.rig, v: RIG.v, leg: (C.rig.leg || 1) + 1, mode: 'arriving', roadTold: false, arrivedNight: n };
    // this region's hives wake on the same schedule, counted from tonight
    for (let i = 0; i < S.wake.length; i++) if (Number.isFinite(S.wake[i])) S.wake[i] += n - 1;
    S.dayT = TIDE.dayLen * RIG.arrive[Math.min(RIG.arrive.length - 1, S.rig.ups.speed || 0)];
    G.HC = heroKit(S.heroClass, S.evo && S.evo.calling);
    if (G.syncMastery) G.syncMastery();
    G.titlesRead && G.titlesRead((S.story.titles || []).length);
    G.refreshMax(); keep.hp = keep.maxHp; S.hero.hp = S.hero.maxHp;
    S.events.length = 0;
    for (const np of S.story.npcs || []) if (np.withHero && np.alive && np.joined) G.spawnCompanion(np);
    G.syncPicks(); G.rollOffer(); G.newLog();
    refreshUps(true);
    const L = legOf(S.rig.leg);
    ev('rigAnchor', { leg: S.rig.leg, name: L.name, scrap: S.gold, food: S.food });
    ev('actStart', { act: S.rig.leg, name: L.name, blurb: L.blurb });
    toast(`[Act ${S.rig.leg}: ${L.name}] The Rig anchors. Cargo unloaded: **${S.gold}** scrap, **${S.food}** food.`, 'sys');
    if (G.story && G.story.chron) G.story.chron(`The Haven Rig anchored in ${L.name}.`, 4, ['act', 'rig']);
  }

  // ---------- the clock ----------
  function stepRig(dt) {
    if (!RIG.on) return;
    if (S.rig.mode === 'arriving') { S.rig.unpackT = (S.rig.unpackT || 0) + dt; if (S.rig.unpackT >= RIG.anim.unpack) { S.rig.mode = 'anchored'; delete S.rig.unpackT; } }
    if ((tickT -= dt) > 0) return; tickT = 1;
    refreshUps(false);
    if (!S.rig.roadTold && S.rig.mode === 'anchored' && (G.actNow ? G.actNow() : 2) >= 2) {
      S.rig.roadTold = true;
      ev('rigRoad', { leg: S.rig.leg, next: legOf(S.rig.leg + 1).name });
      toast(`[Haven Rig] The road out is open. Pack up & roll when the town is ready: everything you built rides along as cargo.`, 'sys');
    }
  }

  function rigInfo() {
    const t = tally(), next = legOf(S.rig.leg + 1);
    return { on: RIG.on, leg: S.rig.leg, name: legOf(S.rig.leg).name, next: next.name, nextLeg: S.rig.leg + 1, mode: S.rig.mode, block: rigBlock(), cargo: cargoNow(), gov: gov(),
      ups: SYS.map(sys => { const u = RIG.ups[sys], score = u.score(t), lvl = S.rig.ups[sys]; return { id: sys, name: u.name, lvl, max: u.at.length, score, next: u.at[lvl] ?? null, src: u.src, fx: u.fx }; }),
      hp: rigK('hp'), dmg: rigK('dmg'), shots: rigK('shots'), arrive: RIG.arrive[Math.min(RIG.arrive.length - 1, S.rig.ups.speed)] };
  }

  // ---------- the save: a versioned `rig` block on the dawn snapshot ----------
  const baseSnap = G.snapshot, baseRestore = G.restoreSnap;
  function snapshot() {
    if (S.rig && S.rig.mode === 'rolling') return null;   // mid-drive: the last dawn save stands
    const s = baseSnap(); if (s && RIG.on) s.rig = { ...S.rig, v: RIG.v, mode: 'anchored' };
    return s;
  }
  function restoreSnap(R) {
    baseRestore(R);
    S.rig = R.rig && R.rig.v === RIG.v ? { ...freshRig(), ...R.rig, mode: 'anchored' } : freshRig();   // an older save: act 1, nothing bolted on
  }

  return { rigK, rigInfo, rigBlock, rigPack, rigArrive, stepRig, salvagePct, cargoNow, rigTally: tally, snapshot, restoreSnap };
}
