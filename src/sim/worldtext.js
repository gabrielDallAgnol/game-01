// [ch1] The story's words in the world (notes.js): notes found when Kai searches a house in their district or walks
// into the place they belong to (the Rig, the town hall, the Works…), graffiti on walls from their night on (each has a
// fixed spot by its wall: the fountain rim, the tower base, a house in its district), and radio broadcasts that play
// from radios in the world (car radios round the square, the Rig's once Gus is home) when Kai comes close, or when a
// car is stripped. A line belongs to a quest step plays only once that step is open. Deterministic: picks by its own
// Rng and by hashes, never by the clock. Found notes and heard broadcasts live in S.ch (notes, heard).
import { NOTES, GRAFFITI, RADIO } from '../content/notes.js';
import { STEPS } from '../content/story1.js';
import { PASSABLE, idx, inside } from './mapgen.js';

const PLACE_KIND = { rig: 'rig', church: 'church', townhall: 'townhall', works: 'factory', garage: 'garage', school: 'school', shed: 'shed', watertower: 'shed', hut: 'shed', cinema: 'house', pizzeria: 'shop' };
const AT_PLACE = new Set(['rig', 'church', 'townhall', 'factory', 'garage', 'school']);
const stepOf = {}; for (const s of STEPS) for (const k of ['notes', 'graffiti', 'radio']) for (const id of (s.world && s.world[k]) || []) stepOf[id] = s;
const GSPACE = [[2, 11], [1, 9], [1, 6], [0, 4]];   // [polish] graffiti: clear room round a tag (cells), gap to the next tag (m), tried in turn
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

export function createWorldText(G) {
  const { S, map, c } = G;
  const CH = () => S.ch, found = id => CH().notes.includes(id);
  const stepLive = s => !s || G.chIsOpen(s.id) || G.chIsDone(s.id);
  const P = () => G.places() || {};
  function give(n, x, y) { if (found(n.id)) return false; CH().notes.push(n.id); G.ev('note', { id: n.id, from: n.from, x, y }); G.chSys(`[Note found: ${n.from}]`); return true; }
  /** a house searched: the open step's note for this district first, else now and then a note of the district */
  function noteOnSearch(o, d) {
    const kind = o.kind === 'scrap' ? 'shop' : 'house';
    const pool = NOTES.filter(n => n.district === d && !found(n.id) && !AT_PLACE.has(n.kind) && n.night <= S.night + 1);
    const quest = pool.filter(n => n.step && stepLive(STEPS.find(s => s.id === n.step)));
    const pick = quest.find(n => n.kind === kind) || quest[0];
    if (pick) return give(pick, o.x, o.y);
    const flav = pool.filter(n => !n.step && n.night <= S.night), pref = flav.filter(n => n.kind === kind), list = pref.length ? pref : flav;
    if (list.length && G.chRng.next() < 0.5) give(list[G.chRng.int(list.length)], o.x, o.y);
  }
  /** standing in a place: its own notes (the tow ticket on the Rig, the shift board at the Works) once their step is open */
  function noteAtPlace(pid) {
    const p = P()[pid]; if (!p) return; const d = G.districtOf(p.x, p.y), k = PLACE_KIND[pid];
    for (const n of NOTES) {
      if (found(n.id) || n.night > S.night + 1) continue;
      const s = n.step && STEPS.find(q => q.id === n.step);
      const mine = (n.kind === k && n.district === d) || (s && (s.goal.place === pid || s.trigger.place === pid || s.goal.nest === pid));
      if (!mine || (n.step && !stepLive(s)) || (!n.step && !AT_PLACE.has(n.kind))) continue;
      give(n, p.at.x, p.at.y);
    }
  }
  // ---------- graffiti: a spot by each one's wall, picked once ----------
  const GP = {};
  const open1 = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); if (!inside(cx, cy)) return false; const i = idx(cx, cy); return PASSABLE[map.terrain[i]] && map.reach[i] && S.occ[i] < 0; };
  const roomy = (x, y, r) => { for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) if (dx * dx + dy * dy <= r * r + 0.01 && !open1(x + dx, y + dy)) return false; return true; };
  const apart = (x, y, d) => Object.values(GP).every(o => Math.hypot(o.x - x, o.y - y) >= d);
  function clearSpot(x, y) {
    for (const [room, gap] of GSPACE) for (let d = 0; d <= 14; d++) for (let a = 0; a < (d ? 16 : 1); a++) {
      const px = Math.floor(x + Math.cos(a * Math.PI / 8) * d) + 0.5, py = Math.floor(y + Math.sin(a * Math.PI / 8) * d) + 0.5;
      if (open1(px, py) && roomy(px, py, room) && apart(px, py, gap)) return { x: px, y: py };
    }
    return G.groundNear(x, y, 8);
  }
  function spotFor(g) {
    const p = P(), w = g.where.toLowerCase(), W = map.area.W, plaza = W.plaza ? { x: W.plaza.x + map.area.ox, y: W.plaza.y + map.area.oy } : { x: c, y: c };
    const by = id => p[id] && { x: p[id].at.x, y: p[id].at.y, side: true };
    let q = /where the rig stood/.test(w) ? { x: c, y: c + 4.5 } : /fountain/.test(w) ? { x: plaza.x + 7, y: plaza.y - 5 } : /church/.test(w) ? by('church') : /bus shelter/.test(w) ? { x: plaza.x - 14, y: plaza.y + 9 }
      : /water tower/.test(w) ? by('watertower') : /town hall/.test(w) ? by('townhall') : /cinema/.test(w) ? by('cinema') : /garage shutter|brenner/.test(w) ? by('garage') : /pizza/.test(w) ? by('pizzeria')
      : /goods shed/.test(w) ? by('shed') : /works gate/.test(w) ? by('works') : /mast two|mast one/.test(w) ? by('hut') : /station/.test(w) ? by('station') : /school/.test(w) ? by('school') : null;
    if (!q) { const homes = (G.searchHomes ? G.searchHomes() : []).filter(o => G.districtOf(o.x, o.y) === g.district); const o = homes.length ? homes[hash(g.id) % homes.length] : { x: c + 10, y: c + 10 }; q = { x: o.x, y: o.y, side: true }; }
    if (q.side) { const a = (hash(g.id) % 2 ? 1 : -1) * 2.4; q = { x: q.x + a, y: q.y + 0.4 }; }
    // [polish] open pavement with room for the tag (nothing over it from above) and well apart from the tags already
    // placed: rings out from its wall; the rules relax only if the town gives no such spot
    const at = clearSpot(q.x, q.y);
    return { x: at.x, y: at.y, rot: ((hash(g.id) % 21) - 10) * 0.012 };
  }
  const gVisible = g => (g.night >= 7 && g.step ? G.chIsOpen(g.step) || G.chIsDone(g.step) : S.night >= g.night);   // the last ones wait for their step
  let gDone = false;
  const graffiti = () => { if (!S.ch) return []; if (!gDone) { gDone = true; for (const g of GRAFFITI) GP[g.id] = { id: g.id, text: g.text, ...spotFor(g) }; } return GRAFFITI.filter(gVisible).map(g => GP[g.id]); };   // every spot picked once, in order, so they never move
  // ---------- radios: car radios round the square, and the Rig ----------
  let radios = null;
  function radioList() {
    if (radios) return radios;
    const A = map.area, cars = A.W.placed.filter(q => q.def.kind === 'vehicle' && q.def.id.startsWith('car.')).map(q => ({ x: q.x + A.ox, y: q.y + A.oy, h: hash(`${q.uid}`) }))
      .filter(q => { const d = Math.hypot(q.x - c, q.y - c); return d > 18 && d < 110 && inside(Math.floor(q.x), Math.floor(q.y)); }).sort((a, b) => a.h - b.h);
    const pick = []; for (const q of cars) { if (pick.length >= 6) break; if (pick.some(o => Math.hypot(o.x - q.x, o.y - q.y) < 30)) continue; pick.push(q); }
    radios = pick.map((q, k) => ({ id: `car${k}`, src: 'car', x: q.x, y: q.y })).concat([{ id: 'rig', src: 'rig', x: c, y: c }]);
    return radios;
  }
  const rigRadio = () => (S.ch.surv.gus && S.ch.surv.gus.state === 'home') || (G.rigHas && G.rigHas('radio'));
  function due(src) {
    return RADIO.filter(r => !CH().heard.includes(r.id) && r.night === S.night && (r.src === src || r.src === 'any' || (r.id === 'r.12' && src === 'rig')) && (src !== 'rig' || r.src !== 'rig' || rigRadio() || r.id === 'r.12')).filter(r => {
      const s = stepOf[r.id]; if (!s) return true; if (s.trigger.on === 'event' && s.trigger.event === 'carRadio') return true; return stepLive(s);
    })[0];
  }
  function play(r, o) { CH().heard.push(r.id); G.ev('radio', { id: r.id, src: o.src, x: o.x, y: o.y, from: r.from, text: r.text }); }
  function radioTick() {
    const h = S.hero; if (h.dead) return;
    for (const o of radioList()) if (Math.hypot(o.x - h.x, o.y - h.y) < (o.src === 'rig' ? 7 : 8)) { const r = due(o.src); if (r) { play(r, o); return; } }
  }
  const radioAt = (x, y, src = 'car') => { const r = due(src); if (r) play(r, { src, x, y }); };
  /** dusk: tonight's first broadcast not yet heard crackles from the car radio nearest the Rig (or the Rig's own) */
  function radioDusk() { const L = radioList(), car = L.filter(o => o.src === 'car').sort((a, b) => Math.hypot(a.x - c, a.y - c) - Math.hypot(b.x - c, b.y - c))[0]; const r = due('car'); if (r && car) { play(r, car); return; } const q = due('rig'); if (q) play(q, L[L.length - 1]); }
  return { noteOnSearch, noteAtPlace, graffiti, radios: () => (S.ch ? radioList() : []), radioTick, radioAt, radioDusk, radioDue: src => (S.ch ? !!due(src) : false) };
}
