// [roam] The bike's look from its parts (M6): the bike declares sockets (wheel front and back, frame, engine with its
// vents, lamp) and each part's module fills its socket (play-atoms §8: one module, many places; a house socket can take
// the same plate or lamp later). Built from the medium's glyph solids like everything else; a part's accent takes its
// rarity's paint (common steel, tuned blue, rare yellow, epic red). Without gear it draws the stock bike.
const TINT = M => ({ common: M.steel, tuned: M.carBlue, rare: M.paint, epic: M.carRed });
export function bikeLook(b, K, t, night, riding, gear, FIGM) {
  const { sphere, capsule, box, M } = K, S = FIGM * 0.9, a = b.ang, ca = Math.cos(a), sa = Math.sin(a), P = (lx, ly) => [b.x + (lx * ca - ly * sa) * S, b.y + (lx * sa + ly * ca) * S];
  const part = slot => (gear && gear[slot] && gear[slot].part) || slot + '_stock', tint = slot => TINT(M)[(gear && gear[slot] && gear[slot].rarity) || 'common'];
  const lit = night > 0.3 || riding ? 1 : 0.15;
  // ---------- wheels (socket: wheel) ----------
  const ty = part('tyres');
  for (const lx of [0.62, -0.58]) { const [x, y] = P(lx, 0);
    if (ty === 'tyres_bouncy') sphere(x, y, 0.3 * S, 0.3 * S, M.rubber);
    else if (ty === 'tyres_grip') box(x, y, 0.3 * S, 0.3 * S, 0.16 * S, 0.3 * S, 0.1 * S, a, M.rubber);
    else if (ty === 'tyres_knobbly') { box(x, y, 0.32 * S, 0.32 * S, 0.12 * S, 0.32 * S, 0.06 * S, a, M.rubber); for (const s of [-1, 1]) { const [sx, sy] = P(lx + s * 0.3, 0); sphere(sx, sy, 0.3 * S, 0.06 * S, M.dark); } }
    else box(x, y, 0.3 * S, 0.3 * S, 0.1 * S, 0.3 * S, 0.08 * S, a, M.dark); }
  // ---------- frame (socket: frame, with plate points either side) ----------
  const fr = part('frame');
  { const [x0, y0] = P(-0.55, 0), [x1, y1] = P(0.55, 0); capsule(x0, y0, 0.48 * S, x1, y1, 0.55 * S, (fr === 'frame_light' ? 0.1 : 0.16) * S, fr === 'frame_light' ? M.steel : M.rust); }
  if (fr === 'frame_plated') for (const s of [-1, 1]) { const [x, y] = P(-0.05, s * 0.2); box(x, y, 0.5 * S, 0.32 * S, 0.03 * S, 0.14 * S, 0.02 * S, a, tint('frame')); }
  if (fr === 'frame_bullbar') { const [x0, y0] = P(0.86, -0.34), [x1, y1] = P(0.86, 0.34); capsule(x0, y0, 0.42 * S, x1, y1, 0.42 * S, 0.05 * S, tint('frame')); for (const s of [-1, 1]) { const [px, py] = P(0.86, s * 0.34), [qx, qy] = P(0.55, s * 0.12); capsule(px, py, 0.42 * S, qx, qy, 0.55 * S, 0.035 * S, M.steel); } }
  // ---------- engine (socket: engine, vents behind) ----------
  const en = part('engine');
  if (en === 'engine_racer') { const [x0, y0] = P(-0.1, 0), [x1, y1] = P(0.6, 0); capsule(x0, y0, 0.66 * S, x1, y1, 0.6 * S, 0.17 * S, tint('engine')); }
  else { const big = en === 'engine_torque' ? 1.35 : 1; const [x, y] = P(0.02, 0); box(x, y, 0.42 * S, 0.17 * S * big, 0.14 * S * big, 0.12 * S, 0.05 * S, a, M.dark); }
  if (en === 'engine_torque') for (const s of [-1, 1]) { const [x0, y0] = P(-0.05, s * 0.16), [x1, y1] = P(-0.7, s * 0.2); capsule(x0, y0, 0.36 * S, x1, y1, 0.42 * S, 0.045 * S, M.steel); }
  if (en === 'engine_charger') { const [x, y] = P(0.78, 0); box(x, y, 0.3 * S, 0.06 * S, 0.26 * S, 0.12 * S, 0.03 * S, a, tint('engine')); }
  // ---------- the tank and seat (part of the stock bike) ----------
  if (en !== 'engine_racer') { const [x, y] = P(0.18, 0); box(x, y, 0.7 * S, 0.22 * S, 0.17 * S, 0.12 * S, 0.1 * S, a, M.paint); }
  { const [x, y] = P(-0.27, 0); box(x, y, 0.66 * S, 0.26 * S, 0.14 * S, 0.07 * S, 0.06 * S, a, M.dark); }
  { const [x0, y0] = P(0.48, -0.32), [x1, y1] = P(0.48, 0.32); capsule(x0, y0, 0.86 * S, x1, y1, 0.86 * S, 0.035 * S, M.steel); }
  // ---------- lamp (socket: lamp) ----------
  const lp = part('lamp');
  if (lp === 'lamp_wide') for (const s of [-1, 1]) { const [x, y] = P(0.72, s * 0.17); sphere(x, y, 0.62 * S, 0.075 * S, M.lamp, lit); }
  else if (lp === 'lamp_scanner') { const [x0, y0] = P(0.5, 0), [x1, y1] = P(0.6, 0); capsule(x0, y0, 0.86 * S, x1, y1, 1.25 * S, 0.03 * S, M.steel); sphere(x1, y1, 1.27 * S, 0.07 * S, M.lamp, lit); const [x, y] = P(0.72, 0); sphere(x, y, 0.62 * S, 0.06 * S, M.lamp, lit); }
  else if (lp === 'lamp_dazzle') { const [x, y] = P(0.76, 0); sphere(x, y, 0.64 * S, 0.13 * S, M.lamp, Math.max(lit, 0.6)); box(x, y, 0.64 * S, 0.03 * S, 0.17 * S, 0.17 * S, 0.02 * S, a, tint('lamp')); }
  else { const [x, y] = P(0.72, 0); sphere(x, y, 0.62 * S, 0.08 * S, M.lamp, lit); }
}
