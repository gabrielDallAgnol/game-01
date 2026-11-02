// [roam] The people of Wendbridge (the Point: docs/design/the-point.md §1, §5). Humans are afraid of machines first, then
// friends; what they do follows what you did (cause and consequence), read from the state:
// - while their area is dark (the boss holds it) they hide indoors: you see only their lit windows at night;
// - once it is clean (the boss freed) they come out to their doors, but shy: when the robot comes close they step back in;
// - while Wend Bridge is mended, some of them work at its end in hi-vis vests, the rest watch;
// - once it stands, they trust the robot: they stay out, turn to it, and wave as it passes.
// Render only: the folk list is the town's houses with doors (main.js); each one's ease in or out is render state.
const COATS = ['carBlue', 'carGreen', 'cloth', 'carCream', 'carRed', 'tarp'];
const hp = (a, b) => { let n = Math.imul(a * 73856093 ^ b * 19349663, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
let lastT = 0;
export function peopleVolumes(v, K, on, sn) {
  const S = v.risk, folk = v.folk; if (!S || !folk || !folk.length) return; const { sphere, capsule, box, M } = K, t = v.t, dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
  const area = S.areas.find(a => a.pin) || S.areas.find(a => !a.home), clean = area && area.state === 'clean', B = (S.bridges || [])[0], trust = B && B.state === 'mended', bike = v.bike;
  const person = (x, y, face, coat, wave, bob, hi, hair) => drawPerson(K, t, x, y, face, coat, wave, bob, hi, hair);
  // the workers at the bridge while it is mended (four, hi-vis), at its town end
  if (B && B.state === 'mending' && on(B.x, B.y)) for (let i = 0; i < 4; i++) { const s = -B.gap - 3 - (i % 2) * 2.5, o = (i < 2 ? -1 : 1) * (2 + hp(i, 3) * 2), x = B.x + B.ux * s - B.uy * o, y = B.y + B.uy * s + B.ux * o;
    person(sn(x), sn(y), Math.atan2(B.uy, B.ux) + (hp(i, 5) - 0.5), COATS[i % COATS.length], 0, 0.06 * Math.max(0, Math.sin(t * 5 + i * 1.7)), true); }
  for (const f of folk) { const near = Math.hypot(bike.x - f.x, bike.y - f.y);
    const out = clean && !(B && B.state === 'mending' && f.worker) && (trust || near > 14) ? 1 : 0; f.k = (f.k || 0) + Math.sign(out - (f.k || 0)) * Math.min(Math.abs(out - (f.k || 0)), dt * 1.4);
    if (f.k < 0.05 || !on(f.x, f.y)) continue; const x = f.x + f.ox * (0.8 + 1.6 * f.k), y = f.y + f.oy * (0.8 + 1.6 * f.k), face = near < 30 ? Math.atan2(bike.y - y, bike.x - x) : Math.atan2(f.oy, f.ox) + f.turn;
    person(sn(x), sn(y), face, f.coat, trust && near < 16 ? 1 : 0, 0, false, f.hair); }
}
// one person, standing: legs, a coat (a hi-vis band if `hi`), arms (the right one up and waving if `wave`), a head of hair
export function drawPerson(K, t, x, y, face, coat, wave = 0, bob = 0, hi = false, hair = 'hair') { const { sphere, capsule, box, M } = K, Sc = 2.6, ca = Math.cos(face), sa = Math.sin(face), P = (lx, ly) => [x + (lx * ca - ly * sa) * Sc, y + (lx * sa + ly * ca) * Sc];
  for (const s of [-1, 1]) { const [x0, y0] = P(0, s * 0.08), [x1, y1] = P(0, s * 0.09); capsule(x0, y0, 0.75 * Sc, x1, y1, 0.1 * Sc, 0.07 * Sc, M.pants); }
  { const [bx, by] = P(0, 0); box(bx, by, (1.02 + bob) * Sc, 0.12 * Sc, 0.2 * Sc, 0.28 * Sc, 0.1 * Sc, face, M[coat]); if (hi) box(bx, by, (1.05 + bob) * Sc, 0.125 * Sc, 0.205 * Sc, 0.06 * Sc, 0.02 * Sc, face, M.hivis); }
  for (const s of [-1, 1]) { const up = s > 0 && wave > 0, [x0, y0] = P(0.02, s * 0.2), [x1, y1] = P(up ? 0.06 : 0.04, s * (up ? 0.3 : 0.23)); capsule(x0, y0, (1.22 + bob) * Sc, x1, y1, (up ? 1.7 + 0.08 * Math.sin(t * 9) : 0.95 + bob) * Sc, 0.06 * Sc, M[coat]); }
  { const [hx, hy] = P(0.02, 0); sphere(hx, hy, (1.42 + bob) * Sc, 0.14 * Sc, M[hair]); } }
// the folk: one person at the door of some houses of a town (hashed: about one house in three), facing out of the door
export function folkOf(buildings, district) { const out = [];
  for (const p of buildings) { if (p.district !== district || !p.door || hp(p.uid, 1) > 0.36) continue; const dx = p.door.x - p.x, dy = p.door.y - p.y, L = Math.hypot(dx, dy) || 1;
    out.push({ x: p.door.x, y: p.door.y, ox: dx / L, oy: dy / L, coat: COATS[Math.floor(hp(p.uid, 2) * COATS.length)], turn: (hp(p.uid, 4) - 0.5) * 1.2, worker: hp(p.uid, 6) < 0.3, hair: hp(p.uid, 7) < 0.4 ? 'sack' : hp(p.uid, 7) < 0.6 ? 'rust' : 'hair', k: 0 }); }
  return out; }
