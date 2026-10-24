// Events → feedback: drains the sim's event stream into rings, particles, labels, hit-stop and shake.
// (An event's payload can never carry its own .t — the event type wins — so durations travel in .dur.)
import { N } from '../../sim/mapgen.js';
import { MOBS } from '../../content/mobs.js';
import { FOOT } from './shared.js';

export function createEvents(V) {
  const { S, map, C, look, fx2, Wv, seenAt, city } = V;
  // ---------- events ----------
  function handleEvents(events) {
    const time = V.time, hives = V.hives.hives, mobState = V.mobs.mobState, { sendWalkers } = V.folk, { bolt } = V.projectiles;
    const { burst, floatLabel, dust, hitStopFor, shake, mobOf } = V.feel, flares = V.flares;
    for (const e of events) {
      if (e.t === 'claim') { city.setTerritory(); V.repaint = true; const h = hives.get(e.region); if (h) { const n = map.regions[e.region].nest && V.hiveAt(e.region); burst(n.x, n.y, 4, '#d9843a'); h.cleared = true; } }
      if (e.t === 'trail') { city.clear(e.cells, true); for (const i of e.cells) { const p = Wv((i % N) + 0.5, ((i / N) | 0) + 0.5, 0.3); fx2.emit('dust', p.x, p.y, p.z, 6, { spread: 0.45, size: 0.9 }); } }   // [woods] the trees on a worn trail are gone
      if (e.t === 'clear') { city.clear(e.cells); for (const i of e.cells) burst((i % N) + 0.5, ((i / N) | 0) + 0.5, 0.5, '#b8ae9c'); }
      if (e.t === 'firstDead' && !V.cinema.active()) V.focus = { id: e.id, t: 5 };
      if (e.t === 'hitHive') { const n = map.regions[e.region].nest && V.hiveAt(e.region); burst(n.x, n.y, 1.4, '#9dff4a'); }
      if (e.t === 'bountyGold') burst(e.x, e.y, 0.6, '#f0c050');
      if (e.t === 'pickup') { burst(e.x, e.y, 0.5, e.kind === 'scrap' ? '#f0a040' : '#9fe08a'); floatLabel(e.x, e.y, `+${e.n || 1} ${e.kind === 'scrap' ? 'scrap' : 'food'}`, e.kind === 'scrap' ? '#ffc070' : '#b4f09a'); }
      if (e.t === 'trickle') { const b = e.id ? S.byId.get(e.id) : S.keep; if (b && !b.ruined) floatLabel(b.x, b.y, '+1', e.k === 'scrap' ? '#ffc070' : '#b4f09a'); }   // [income] a home or a farm pays in, now and then
      if (e.t === 'scavGo') sendWalkers(e.site, e.n, false);
      if (e.t === 'scavBack') sendWalkers(e.site, e.n, true);
      if (e.t === 'explode') burst(e.x, e.y, e.r, '#a3c65c');
      if (e.t === 'build' || e.t === 'remove' || e.t === 'ruin' || e.t === 'rebuild') V.repaint = true;
      if (e.t === 'volley') burst(e.x, e.y, e.r, '#d9843a');
      if (e.t === 'warcry') burst(e.x, e.y, e.r, '#d5513d');
      if (e.t === 'bell') { burst(C, C, 8, '#ffd27a'); burst(C, C, 5, '#ffd27a'); }
      if (e.t === 'bolt') bolt(e);
      // [towers] begin: the specialised towers (sim/towers.js)
      if (e.t === 'shell' && seenAt(e.x, e.y)) { burst(e.x, e.y, e.r, '#f09040'); const p = Wv(e.x, e.y, 0.3); fx2.emit('ember', p.x, p.y, p.z, 10, { spread: e.r * 0.5, speed: 1.6 }); fx2.emit('smoke', p.x, p.y + 0.3, p.z, 5, { spread: e.r * 0.4 }); if (Math.hypot(e.x - S.hero.x, e.y - S.hero.y) < 7) shake(0.08); }
      if (e.t === 'flame' && seenAt(e.x, e.y)) { const p = Wv(e.x, e.y, 0.25); fx2.ring(p.x, p.y, p.z, e.r, '#ff6a2a', 0.45); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + time, q = Wv(e.x + Math.cos(a) * e.r * 0.8, e.y + Math.sin(a) * e.r * 0.8, 0.3); fx2.emit('ember', q.x, q.y, q.z, 2, { spread: 0.3, speed: 1.4 }); } }
      if (e.t === 'toll' && seenAt(e.x, e.y)) { const p = Wv(e.x, e.y, 0.2); fx2.ring(p.x, p.y, p.z, e.r, '#ffd27a', 0.6); }
      // [towers] end
      if (e.t === 'purseTaken') burst(S.hero.x, S.hero.y, 0.8, '#d9843a');
      // ---- combat feedback ----
      if (e.t === 'hitM') { const m = mobOf(e.id), st = mobState.get(e.id); if (st) st.hitT = time; if (m && seenAt(m.x, m.y)) { const p = Wv(m.x, m.y, 0.75 * (st ? Math.max(1, st.size) : 1)); fx2.emit('ichor', p.x, p.y, p.z, 4, { size: st ? st.size : 1 }); if (Math.hypot(m.x - S.hero.x, m.y - S.hero.y) < 2.2) fx2.emit('spark', p.x, p.y, p.z, 3); } }
      if (e.t === 'die') { const big = (MOBS[e.kind] || {}).size >= 1.3, p = Wv(e.x, e.y, 0.2); if (seenAt(e.x, e.y)) { fx2.emit('dust', p.x, p.y, p.z, big ? 14 : 7, { spread: big ? 0.6 : 0.3, size: big ? 1.4 : 0.8 }); fx2.emit('ichor', p.x, p.y + 0.4, p.z, big ? 10 : 5); fx2.stain(p.x, p.y - 0.2, p.z, big ? 1.1 : 0.6); }
        if (big && !S.hero.dead && Math.hypot(e.x - S.hero.x, e.y - S.hero.y) < 2.8) { hitStopFor(0.06); shake(0.3); } }
      if (e.t === 'bite') { const m = mobOf(e.id); if (m && !S.hero.dead && Math.hypot(m.x - S.hero.x, m.y - S.hero.y) < 1.9) { shake(m.kind === 'brute' || m.kind === 'gravelord' || m.kind === 'guardian' ? 0.35 : 0.15); const p = Wv(S.hero.x, S.hero.y, 0.9); fx2.emit('blood', p.x, p.y, p.z, 5); } }
      if (e.t === 'hitH') look.fx.hit = Math.min(1, look.fx.hit + 0.55);
      if (e.t === 'heroDie') { shake(0.6); look.fx.hit = 1; }
      if (e.t === 'claim') { shake(0.5); const n = map.regions[e.region].nest && V.hiveAt(e.region); if (n) { const p = Wv(n.x, n.y, 0.6); fx2.emit('ember', p.x, p.y, p.z, 40, { spread: 2.2, speed: 2 }); fx2.emit('smoke', p.x, p.y + 0.5, p.z, 16, { spread: 2 }); burst(n.x, n.y, 6, '#f0a040'); } }
      // [nests] the guard claws out; each wave of rage throbs red and shakes the ground under you
      if (e.t === 'nestGuard') { const p = Wv(e.x, e.y, 0.4); fx2.emit('rot', p.x, p.y, p.z, 14, { spread: 1.6, speed: 1.6 }); burst(e.x, e.y, 3, '#b8d94a'); }
      if (e.t === 'nestRage') { const near = Math.hypot(e.x - S.hero.x, e.y - S.hero.y) < 14; if (near) shake(0.12 + 0.04 * Math.min(6, e.lv)); const p = Wv(e.x, e.y, 0.5); fx2.emit('rot', p.x, p.y, p.z, 10 + 4 * Math.min(6, e.lv), { spread: 1.8, speed: 2.2 }); burst(e.x, e.y, 2.5 + 0.5 * Math.min(6, e.lv), '#ff5a3a'); const h = hives.get(e.region); if (h) h.pulse = 1; }
      if (e.t === 'erupt') { shake(Math.hypot(e.x - S.hero.x, e.y - S.hero.y) < 25 ? 0.4 : 0.15); const p = Wv(e.x, e.y, 0.5); fx2.emit('rot', p.x, p.y, p.z, 30, { spread: 2, speed: 2.5 }); }
      // the flare carries its duration in .dur (the event type always wins over a payload .t)
      if (e.t === 'flare') { flares.push({ x: e.x, y: e.y, t0: time, t: e.dur || 8 }); const p = Wv(e.x, e.y, 0.5); fx2.emit('spark', p.x, p.y, p.z, 24, { speed: 1.4 }); fx2.emit('ember', p.x, p.y, p.z, 16, { spread: 0.4 }); }
      if (e.t === 'smoke') { const p = Wv(e.x, e.y, 0.3); fx2.emit('smoke', p.x, p.y, p.z, 40, { spread: 2.5, size: 1.6, life: 1.6 }); }
      if (e.t === 'levelUp') { const p = Wv(S.hero.x, S.hero.y, 0.4); fx2.emit('cyan', p.x, p.y, p.z, 30, { spread: 0.5 }); fx2.ring(p.x, p.y - 0.3, p.z, 2.2, '#5fd3ff', 0.8); fx2.label(p.x, p.y + 2.1, p.z, 'LEVEL UP', '#5fd3ff', { size: 0.42, life: 1.8 }); }
      if (e.t === 'built') { const b = S.byId.get(e.id); if (b) dust(b.x, b.y, FOOT[b.type] || 1); }
      if (e.t === 'ruin') { const b = S.byId.get(e.id); if (b) { dust(b.x, b.y, (FOOT[b.type] || 1) + 1); const p = Wv(b.x, b.y, 0.6); fx2.emit('smoke', p.x, p.y, p.z, 14, { spread: 0.8 }); fx2.emit('ember', p.x, p.y, p.z, 12, { spread: 0.8 }); if (Math.hypot(b.x - S.hero.x, b.y - S.hero.y) < 14) shake(0.25); } }
    }
  }
  return { handle: handleEvents };
}
