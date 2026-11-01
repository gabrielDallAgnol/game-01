// [roam] A design lab for the bike's look (Nov 1, Gabriel: "you need a very good eye to tell one armour from another").
// Three directions to compare against the current look (bikelook.js), drawn with the same glyph solids, only for the
// bike review (tools/roam/bike-review.cjs sets lab.bikeStyle); the game doesn't use them yet.
//   A  silhouette: every slot owns a part of the outline and its parts stick out past the rider; the tall ones (exhaust
//      stacks, the scanner's dish, a roll bar) stand higher than her head, so they draw over her from above
//   B  light: today's shapes, but each part carries its own light (running lights along plates, a hot exhaust, lit rims,
//      a headlight bar), in its rarity's colour: only light shouts, so parts read by their lights, near and far
//   C  the robot (the story idea: the machine that turned friendly is the hero; no rider): the bike is its body; the lamp
//      slot is its amber eye(s) (amber is yours, red is theirs), the engine its glowing core, the frame its armour, the
//      tyres its wheels
const RAR = M => ({ common: M.steel, tuned: M.carBlue, rare: M.lamp, epic: M.carRed });
export function bikeLookLab(style, b, K, t, night, riding, gear, FIGM) {
  const { sphere, capsule, box, M } = K, S = FIGM * 0.9, a = b.ang, ca = Math.cos(a), sa = Math.sin(a), P = (lx, ly) => [b.x + (lx * ca - ly * sa) * S, b.y + (lx * sa + ly * ca) * S];
  const part = slot => (gear && gear[slot] && gear[slot].part) || slot + '_stock', rar = slot => (gear && gear[slot] && gear[slot].rarity) || 'common', tint = slot => RAR(M)[rar(slot)];
  const BOX = (lx, ly, z, hx, hy, hz, r, m, em = 0, rot = 0) => { const [x, y] = P(lx, ly); box(x, y, z * S, hx * S, hy * S, hz * S, r * S, a + rot, m, em); };
  const CAP = (lx0, ly0, z0, lx1, ly1, z1, r, m, em = 0) => { const [x0, y0] = P(lx0, ly0), [x1, y1] = P(lx1, ly1); capsule(x0, y0, z0 * S, x1, y1, z1 * S, r * S, m, em); };
  const SPH = (lx, ly, z, r, m, em = 0) => { const [x, y] = P(lx, ly); sphere(x, y, z * S, r * S, m, em); };
  const lit = night > 0.3 || riding ? 1 : 0.4, en = part('engine'), fr = part('frame'), lp = part('lamp'), ty = part('tyres');
  // ---------- wheels: shared by A and C (bigger, and the variants stick out sideways) ----------
  const wheels = big => { for (const lx of [0.66, -0.62]) {
    if (ty === 'tyres_bouncy') SPH(lx, 0, 0.36 * big, 0.36 * big, M.rubber);
    else if (ty === 'tyres_grip') BOX(lx, 0, 0.32 * big, 0.32 * big, 0.22, 0.32 * big, 0.1, M.rubber);
    else if (ty === 'tyres_knobbly') { BOX(lx, 0, 0.36 * big, 0.36 * big, 0.15, 0.36 * big, 0.06, M.rubber); for (const s of [-1, 1]) for (const d of [-0.22, 0.22]) SPH(lx + d, s * 0.17, 0.3, 0.07, M.steel); }
    else BOX(lx, 0, 0.3 * big, 0.3 * big, 0.11, 0.3 * big, 0.08, M.dark); } };
  if (style === 'A') {
    wheels(1.1);
    CAP(-0.6, 0, 0.5, 0.6, 0, 0.56, 0.15, fr === 'frame_light' ? M.steel : M.rust);
    // frame: owns the sides
    if (fr === 'frame_plated') for (const s of [-1, 1]) { BOX(-0.05, s * 0.42, 0.55, 0.5, 0.06, 0.2, 0.03, tint('frame')); for (const d of [-0.35, 0, 0.35]) SPH(-0.05 + d, s * 0.47, 0.6, 0.04, M.steel); }
    if (fr === 'frame_light') for (const s of [-1, 1]) CAP(-0.55, s * 0.2, 0.45, 0.55, s * 0.2, 0.5, 0.035, M.steel);
    if (fr === 'frame_bullbar') { CAP(0.98, -0.5, 0.45, 0.98, 0.5, 0.45, 0.07, tint('frame')); for (const s of [-1, 1]) CAP(0.98, s * 0.5, 0.45, 0.6, s * 0.15, 0.55, 0.05, tint('frame')); }
    // engine: owns the back (and the tall stacks stand over the rider's head)
    BOX(0.02, 0, 0.42, 0.18, 0.15, 0.13, 0.05, M.dark);
    if (en === 'engine_torque') for (const s of [-1, 1]) { CAP(-0.15, s * 0.2, 0.5, -0.55, s * 0.24, 1.75, 0.07, M.steel); SPH(-0.55, s * 0.24, 1.8, 0.08, M.crackHot, 0.8); }
    if (en === 'engine_racer') { CAP(-0.1, 0, 0.66, 1.15, 0, 0.55, 0.18, tint('engine')); BOX(-0.95, 0, 1.25, 0.12, 0.03, 0.35, 0.02, tint('engine')); }
    if (en === 'engine_charger') { BOX(1.0, 0, 0.35, 0.08, 0.36, 0.2, 0.03, tint('engine')); for (const s of [-1, 1]) CAP(1.0, s * 0.36, 0.35, 1.18, s * 0.42, 0.3, 0.05, tint('engine')); }
    if (en !== 'engine_racer') BOX(0.2, 0, 0.72, 0.22, 0.17, 0.12, 0.1, M.paint);
    CAP(0.48, -0.34, 0.88, 0.48, 0.34, 0.88, 0.04, M.steel);
    // a roll bar over the rider: every bike has it, so the gun's mount and the lamp mast read above her
    CAP(-0.3, -0.25, 0.55, -0.3, -0.25, 1.6, 0.04, M.steel); CAP(-0.3, 0.25, 0.55, -0.3, 0.25, 1.6, 0.04, M.steel); CAP(-0.3, -0.25, 1.6, -0.3, 0.25, 1.6, 0.045, M.steel);
    // lamp: owns the front
    if (lp === 'lamp_wide') for (const s of [-1, 1]) { CAP(0.7, 0, 0.6, 0.86, s * 0.34, 0.62, 0.03, M.steel); SPH(0.88, s * 0.34, 0.62, 0.1, M.lamp, lit); }
    else if (lp === 'lamp_scanner') { CAP(0.4, 0, 0.9, 0.4, 0, 2.0, 0.03, M.steel); SPH(0.4, 0, 2.05, 0.2, M.glass, 0.5); SPH(0.75, 0, 0.62, 0.08, M.lamp, lit); }
    else if (lp === 'lamp_dazzle') { BOX(0.86, 0, 0.64, 0.06, 0.36, 0.1, 0.03, M.dark); BOX(0.9, 0, 0.64, 0.03, 0.33, 0.07, 0.02, M.lamp, Math.max(lit, 0.8)); }
    else SPH(0.75, 0, 0.62, 0.09, M.lamp, lit);
    return; }
  if (style === 'B') {
    // B: today's look plus each part's own light, in its rarity's colour
    const L = tint, glow = 0.9;
    if (fr === 'frame_plated') for (const s of [-1, 1]) for (let i = 0; i < 4; i++) SPH(-0.35 + i * 0.22, s * 0.26, 0.6, 0.045, L('frame'), glow);
    if (fr === 'frame_light') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) SPH(-0.4 + i * 0.4, s * 0.2, 0.5, 0.035, L('frame'), glow);
    if (fr === 'frame_bullbar') for (let i = -2; i <= 2; i++) SPH(0.86, i * 0.15, 0.45, 0.05, L('frame'), glow);
    if (en === 'engine_torque') for (const s of [-1, 1]) for (let i = 0; i < 4; i++) SPH(-0.75 - i * 0.15, s * 0.2, 0.36, 0.06 - i * 0.01, M.crackHot, 1 - i * 0.2);
    if (en === 'engine_racer') for (let i = 0; i < 6; i++) SPH(-0.75 - i * 0.14, 0, 0.5, 0.06 - i * 0.008, L('engine'), 1 - i * 0.14);
    if (en === 'engine_charger') for (const s of [-1, 1]) SPH(0.8, s * 0.24, 0.32, 0.06, L('engine'), glow);
    if (ty !== 'tyres_stock') for (const lx of [0.62, -0.58]) for (const s of [-1, 1]) SPH(lx, s * 0.15, 0.3, 0.04, L('tyres'), glow);
    if (lp === 'lamp_dazzle') BOX(0.8, 0, 0.66, 0.03, 0.3, 0.05, 0.02, M.lamp, 1);
    return 'base'; }
  if (style === 'C') {
    // C: the robot, no rider. Its body along the bike, its head at the front, the amber eye(s) are the lamp slot
    wheels(1.15);
    BOX(-0.1, 0, 0.55, 0.55, 0.17, 0.18, 0.08, M.steel); BOX(-0.1, 0, 0.75, 0.45, 0.12, 0.06, 0.05, M.dark);
    for (let i = 0; i < 4; i++) BOX(-0.5 + i * 0.25, 0, 0.82, 0.08, 0.14, 0.03, 0.02, M.steel);
    // the core (engine): a light in its back that shows what drives it
    const coreM = en === 'engine_torque' ? M.crackHot : en === 'engine_racer' ? M.glass : en === 'engine_charger' ? M.lamp : M.lamp;
    SPH(-0.15, 0, 0.9, 0.12, coreM, 0.95);
    if (en === 'engine_torque') for (const s of [-1, 1]) { CAP(-0.35, s * 0.15, 0.8, -0.75, s * 0.2, 1.5, 0.06, M.steel); SPH(-0.75, s * 0.2, 1.55, 0.07, M.crackHot, 0.8); }
    if (en === 'engine_racer') { CAP(-0.65, 0, 0.75, 0.2, 0, 0.95, 0.13, tint('engine')); BOX(-0.85, 0, 1.15, 0.1, 0.03, 0.3, 0.02, tint('engine')); }
    if (en === 'engine_charger') { for (const s of [-1, 1]) CAP(0.85, s * 0.12, 0.85, 1.15, s * 0.3, 1.05, 0.05, tint('engine')); }
    // armour (frame): shoulder plates that stand out either side
    if (fr === 'frame_plated') for (const s of [-1, 1]) { BOX(0.15, s * 0.36, 0.9, 0.3, 0.12, 0.08, 0.06, tint('frame')); BOX(-0.35, s * 0.3, 0.75, 0.22, 0.08, 0.06, 0.05, tint('frame')); }
    if (fr === 'frame_light') for (const s of [-1, 1]) for (let i = 0; i < 4; i++) CAP(-0.45 + i * 0.25, 0, 0.82, -0.45 + i * 0.25, s * 0.25, 0.6, 0.025, M.steel);
    if (fr === 'frame_bullbar') { BOX(0.98, 0, 0.45, 0.08, 0.42, 0.18, 0.04, tint('frame')); for (let i = -2; i <= 2; i++) BOX(1.06, i * 0.16, 0.38, 0.06, 0.03, 0.12, 0.01, M.steel); }
    // the head, and its eye(s)
    BOX(0.68, 0, 0.85, 0.16, 0.16, 0.14, 0.07, M.dark);
    if (lp === 'lamp_wide') for (const s of [-1, 1]) SPH(0.82, s * 0.08, 0.88, 0.06, M.lamp, 1);
    else if (lp === 'lamp_scanner') { CAP(0.6, 0, 0.95, 0.55, 0, 1.6, 0.03, M.steel); SPH(0.55, 0, 1.65, 0.1, M.lamp, 1); SPH(0.83, 0, 0.88, 0.05, M.lamp, 0.8); }
    else if (lp === 'lamp_dazzle') BOX(0.83, 0, 0.88, 0.03, 0.14, 0.04, 0.02, M.lamp, 1);
    else SPH(0.83, 0, 0.88, 0.08, M.lamp, 1);
    return; }
}
