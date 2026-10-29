// [roam] Site atoms: the things that make a gas station, a supermarket, a yard or a farm read as one (world/sites.js lays
// the places out and leaves anchors for these). Fixtures stand where the site put them (a pump island, a silo, a dock)
// and only their look follows care; loose things (trolleys, pallets, bales, cars in bays) choose their anchors by care.
// Slots (from the sites' anchors, see dress/slots.js [sites]):
//   fixture  a fixed piece of a site: `use` names the atom (pump, pylon, silo…), `len` its run along a wall, `role`
//   bay      a parking bay (ang along it, nose in): `bay` 'shop' | 'staff' | 'wait' | 'dock'
//   apron    open hard ground: `zone` 'pumps' | 'front' | 'park' | 'dock' | 'yard' | 'stack' | 'garden' | 'farmyard' |
//            'shed' | 'bales' | 'wall' | 'garage'
//   mark     a painted layout: `use` 'bays' | 'arrow' | 'forecourt' | 'walk' | 'court' | 'pitch'
//   roof     (the roof slot) with `spot` and `plant` 'hvac' | 'vent' | 'sky': rooftop plant on a big flat roof
// Tended: whole, square, stocked; worn: dusty, open, a door up; ruined: smashed, burnt, tipped, down.
import { M } from '../dress/mats.js';
import { hash } from '../dress/place.js';
import { PROPS } from './props.js';

const S = 1.3;
const band = c => c > 0.62 ? 2 : c > 0.32 ? 1 : 0;
const by = (c, t, w, r) => [r, w, t][band(c)];                       // a weight by band (tended, worn, ruined)
const fix = id => (c, s) => s.use === id ? 1 : 0;                     // a fixture: its site put the anchor there for it
const hz = (i, k) => hash(i.h, k, 7.7);
// a local frame in life metres (u along the facing, w to its left, z up), scaled into the world by S (as props.js)
const kit = (i, K, a, ox = 0, oy = 0, s = S) => { const c = Math.cos(a), sn = Math.sin(a), X = (u, w) => i.x + ox + (u * c - w * sn) * s, Y = (u, w) => i.y + oy + (u * sn + w * c) * s;
  return { box: (u, w, z, hx, hy, hzz, r, rot, m, em) => K.box(X(u, w), Y(u, w), z * s, hx * s, hy * s, hzz * s, r * s, a + rot, m, em),
    cap: (u0, w0, z0, u1, w1, z1, r, m, em) => K.capsule(X(u0, w0), Y(u0, w0), z0 * s, X(u1, w1), Y(u1, w1), z1 * s, r * s, m, em),
    ball: (u, w, z, r, m, em) => K.sphere(X(u, w), Y(u, w), z * s, r * s, m, em) }; };
// paint helpers (decal map: r pale paint, g dark, b water), in the instance's own frame, world metres
const R = a => `rgb(${a | 0},0,0)`, D = a => `rgb(0,${a | 0},0)`;
const wear = c => Math.max(0, Math.min(1, (0.72 - c) / 0.5));
const frame = (g, i) => { g.translate(i.x, i.y); g.rotate(i.ang); };
// worn paint: a bar cut into patches, some gone with neglect (one strength a bar: the shader cuts at half the local peak)
const bar = (g, i, k, u0, v0, u1, v1, w) => { const a = 225 * (1 - 0.65 * w), n = Math.max(1, Math.round(Math.max(Math.abs(u1 - u0), Math.abs(v1 - v0)) / 1.2)), alongU = Math.abs(u1 - u0) >= Math.abs(v1 - v0);
  g.fillStyle = R(a); for (let j = 0; j < n; j++) { if (hash(i.h, k, j) < w * 0.6) continue; const f0 = j / n, f1 = (j + 1) / n;
    if (alongU) g.fillRect(Math.min(u0, u1) + Math.abs(u1 - u0) * f0, Math.min(v0, v1), Math.abs(u1 - u0) * (f1 - f0), Math.abs(v1 - v0));
    else g.fillRect(Math.min(u0, u1), Math.min(v0, v1) + Math.abs(v1 - v0) * f0, Math.abs(u1 - u0), Math.abs(v1 - v0) * (f1 - f0)); } };
const blot = (g, x, y, r, a, k = D) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, k(a)); gr.addColorStop(0.6, k(a * 0.7)); gr.addColorStop(1, k(0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
const CAR = PROPS.find(a => a.id === 'car');
const LIVERY = [M.carCream, M.carBlue, M.truck, M.carRed, M.carGreen];

export const SITE_ATOMS = [
  // ---------------- fixtures (the site's own pieces) ----------------
  // a pump island under the canopy: the kerbed plinth, two pumps with their hoses, the canopy's posts at its ends.
  // Worn: dusty, a hose dropped; ruined: one pump knocked flat, the other gutted; burnt (the forecourt fire story)
  { id: 'pump', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, space: 0.5, fit: fix('pump'), collide: { w: 4.6, h: 1.4 },
    variant: c => ['ruined', 'worn', 'whole'][band(c)],
    volumes(i, K) { const q = kit(i, K, i.ang), v = i.variant, burnt = v === 'burnt', body = burnt ? M.burnt : v === 'worn' ? M.stone : M.cloth;
      q.box(0, 0, 0.08, 1.75, 0.5, 0.08, 0.06, 0, burnt ? M.dark : M.stone);                     // the plinth
      for (const e of [-1, 1]) q.cap(e * 1.95, 0, 0, e * 1.95, 0, 4.3, 0.13, M.steel);             // the canopy's posts
      for (const e of [-1, 1]) { const u = e * 0.85;
        if (v === 'ruined' && e > 0) { q.box(u + 0.3, 1.0, 0.25, 0.75, 0.3, 0.25, 0.05, 0.35, M.stone); continue; }   // knocked off its plinth
        q.box(u, 0, 0.95, 0.34, 0.27, 0.78, 0.06, 0, body); q.box(u, 0, 1.78, 0.37, 0.3, 0.06, 0.04, 0, burnt ? M.dark : M.carRed);   // the body, its brand cap
        if (!burnt && v !== 'ruined') q.cap(u + 0.36 * e, 0.28, 1.2, u + 0.5 * e, v === 'worn' && e < 0 ? 1.4 : 0.45, v === 'worn' && e < 0 ? 0.05 : 1.0, 0.05, M.rubber); } } },
  // the price pylon by the road: two legs, the board, the brand's cap. Ruined: the board is down in the verge
  { id: 'pylon', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, space: 0.5, fit: fix('pylon'), collide: { w: 2.8, h: 0.8 },
    variant: (c, h) => band(c) === 0 && h < 0.6 ? 'down' : 'up',
    volumes(i, K) { const q = kit(i, K, i.ang);
      if (i.variant === 'down') { for (const e of [-1, 1]) q.box(e * 0.8, 0, 0.3, 0.1, 0.1, 0.3, 0.03, 0, M.steel); q.box(0.3, 1.5, 0.12, 1.0, 0.7, 0.12, 0.05, 0.25, M.dark); q.box(0.3, 2.2, 0.15, 1.0, 0.1, 0.1, 0.04, 0.25, M.carRed); return; }
      for (const e of [-1, 1]) q.box(e * 0.8, 0, 1.5, 0.1, 0.1, 1.5, 0.03, 0, M.steel);
      q.box(0, 0, 3.6, 1.0, 0.22, 0.8, 0.06, 0, M.dark); q.box(0, 0, 4.48, 1.05, 0.26, 0.1, 0.05, 0, M.carRed);
      for (let k = 0; k < 3; k++) q.box(0, 0.24, 3.9 - k * 0.42, 0.7, 0.03, 0.14, 0.01, 0, M.cloth); } },   // the price rows (seen as it stands, edge-on from above: the cap reads)
  // the air and water point by the kiosk: a post, the gauge, a hose coiled on it
  { id: 'air', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, fit: fix('air'), breakable: true, collide: { w: 0.8, h: 0.8 },
    volumes(i, K) { const q = kit(i, K, i.ang); q.box(0, 0, 0.6, 0.2, 0.17, 0.6, 0.04, 0, band(i.care) ? M.carBlue : M.rust); q.box(0, 0, 1.26, 0.24, 0.2, 0.08, 0.04, 0, M.dark);
      if (band(i.care) > 0) q.cap(0.22, -0.12, 0.9, 0.22, 0.12, 0.9, 0.09, M.rubber); else q.cap(0.3, 0, 0.05, 1.4, 0.5, 0.05, 0.05, M.rubber); } },
  // a shop's glass front along its wall (`len`): tended, whole glass and the stand of gas bottles; worn, dusty, the cage
  // open; smashed, the panes gone (dark gaps), glass on the ground
  { id: 'shopfront', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, fit: fix('shopfront'),
    variant: c => ['smashed', 'worn', 'whole'][band(c)],
    volumes(i, K) { const q = kit(i, K, i.ang), L = (i.slot.len || 8) / S / 2, v = i.variant, n = Math.max(2, Math.min(6, Math.round(L / 1.2)));
      for (let k = 0; k < n; k++) { const u0 = -L + (2 * L) * k / n, u1 = -L + (2 * L) * (k + 1) / n;
        if (v === 'smashed' && hz(i, k) < 0.6) { q.box((u0 + u1) / 2, 0, 0.2, (u1 - u0) / 2 - 0.05, 0.1, 0.2, 0.02, 0, M.dark); continue; }   // a sill and nothing above it
        q.box((u0 + u1) / 2, 0, 1.0, (u1 - u0) / 2 - 0.06, 0.1, 1.0, 0.02, 0, v === 'worn' ? M.stone : M.glass); }
      if (i.slot.role !== 'entrance') { const cu = L + 0.7; if (v === 'smashed') q.box(cu, 0.9, 0.3, 0.45, 0.35, 0.3, 0.04, 0.9, M.steel); else q.box(cu, 0.5, 0.55, 0.42, 0.38, 0.55, 0.04, 0, M.steel); } },   // the gas bottle cage
    paint(g, i) { if (i.variant !== 'smashed') return; frame(g, i); const L = (i.slot.len || 8) / 2; g.fillStyle = R(170);
      for (let k = 0; k < 60; k++) g.fillRect((hz(i, k + 10) - 0.5) * 2 * L, 0.3 + hz(i, k + 90) ** 2 * 2.8, 0.08, 0.08); } },   // glass in the sun
  // a trolley shelter in a car park: posts, its glass roof, the trolleys nested in a row. Worn: half of them gone;
  // ruined: the roof fallen in, empty
  { id: 'shelter', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, space: 0.5, fit: fix('shelter'), collide: { w: 5.6, h: 1.9 },
    variant: c => ['ruined', 'worn', 'whole'][band(c)],
    volumes(i, K) { const q = kit(i, K, i.ang), v = i.variant;
      for (const a of [-1, 1]) for (const b of [-1, 1]) q.cap(a * 2.0, b * 0.62, 0, a * 2.0, b * 0.62, 2.1, 0.06, M.steel);
      if (v === 'ruined') q.box(-0.8, 0.2, 1.0, 1.4, 0.62, 0.05, 0.03, 0.2, M.glass); else q.box(0, 0, 2.15, 2.15, 0.74, 0.05, 0.04, 0, M.glass);
      const n = v === 'whole' ? 3.4 : v === 'worn' ? 1.6 : 0; if (n) q.box(-1.8 + n / 2 + 0.1, 0, 0.6, n / 2, 0.3, 0.3, 0.08, 0, M.steel); } },
  // a car park's lamp: a tall post, two heads on a T. Dead like the town's; where it's ruined, bent or down
  { id: 'lotlamp', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, space: 0.5, fit: fix('lotlamp'), breakable: true, collide: { w: 0.6, h: 0.6 },
    variant: (c, h) => band(c) === 0 && h < 0.55 ? (h < 0.25 ? 'down' : 'bent') : 'up',
    volumes(i, K) { const q = kit(i, K, i.ang), v = i.variant;
      if (v === 'down') { const q2 = kit(i, K, i.ang + i.h * 6); q2.cap(0, 0, 0.1, 5.2, 0, 0.14, 0.1, M.steel); q2.box(5.3, 0, 0.15, 0.2, 1.1, 0.1, 0.05, 0, M.dark); return; }
      const lean = v === 'bent' ? 0.9 : 0; q.cap(0, 0, 0, lean, 0, 5.2, 0.1, M.steel); q.box(lean, 0, 5.25, 0.1, 1.2, 0.06, 0.04, 0, M.steel);
      for (const e of [-1, 1]) q.box(lean, e * 1.15, 5.18, 0.24, 0.16, 0.08, 0.05, 0, M.dark); } },
  // a loading dock on a back wall: the leveller plate, black bumpers, the door's edge; the yellow lip
  { id: 'dock', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, fit: fix('dock'),
    variant: c => ['torn', 'open', 'shut'][band(c)],
    volumes(i, K) { const q = kit(i, K, i.ang), v = i.variant;
      q.box(0, 0.55, 0.06, 1.3, 0.55, 0.06, 0.03, 0, M.steel); q.box(0, 1.08, 0.08, 1.3, 0.05, 0.07, 0.02, 0, M.paint);
      for (const e of [-1, 1]) q.box(e * 1.45, 0.15, 0.8, 0.12, 0.15, 0.3, 0.04, 0, M.rubber);
      q.box(0, -0.05, 1.3, 1.3, 0.08, 1.3, 0.02, 0, v === 'shut' ? M.truck : M.dark); if (v === 'torn') q.box(0.4, 1.6, 0.08, 1.0, 0.5, 0.06, 0.03, 0.4, M.truck); } },   // a torn door lies in the yard
  // a roller door's threshold (`len` wide): the slab in its frame, yellow bollards, a dark band of tyre wear. Worn: half
  // up; torn: the slab down on the apron
  { id: 'roller', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, fit: fix('roller'),
    variant: c => ['torn', 'half', 'shut'][band(c)],
    volumes(i, K) { const q = kit(i, K, i.ang), L = (i.slot.len || 4.5) / S / 2, v = i.variant;
      q.box(0, 0, 1.6, L, 0.1, v === 'half' ? 0.7 : 1.6, 0.02, 0, v === 'torn' ? M.dark : M.truck);
      if (v === 'half') q.box(0, 0, 0.45, L, 0.1, 0.45, 0.02, 0, M.dark);
      if (v === 'torn') q.box(0.2, 1.4, 0.06, L * 0.9, 0.9, 0.05, 0.02, 0.12, M.truck);
      for (const e of [-1, 1]) q.cap(e * (L + 0.35), 0.45, 0, e * (L + 0.35), 0.45, 0.8, 0.1, M.paint); },
    paint(g, i) { frame(g, i); const L = (i.slot.len || 4.5) / 2; g.fillStyle = D(45 + 50 * (1 - i.care)); g.fillRect(-L * 0.9, 0.3, L * 1.8, 2.6); } },
  // a grain silo: a steel drum and its cap, the ladder up its side, the auger pipe down to the yard. Worn: dull; ruined:
  // rusted, the auger fallen. Its own size in the world (it is architecture, not a prop)
  { id: 'silo', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, space: 0.5, fit: fix('silo'), collide: { w: 4.6, h: 4.6 },
    volumes(i, K) { const b = band(i.care), m = b === 2 ? M.truck : b === 1 ? M.stone : M.rust, r = 2.1, H = 6.4, c = Math.cos(i.ang), s = Math.sin(i.ang);
      K.capsule(i.x, i.y, 0, i.x, i.y, H - r * 0.6, r, m); K.sphere(i.x, i.y, H - r * 0.2, r * 0.55, M.steel);
      K.box(i.x + c * (r + 0.1), i.y + s * (r + 0.1), H / 2, 0.14, 0.24, H / 2, 0.03, i.ang, M.dark);   // the ladder
      if (b > 0) K.capsule(i.x - s * r * 0.6, i.y + c * r * 0.6, H - 0.4, i.x - s * (r + 3.2), i.y + c * (r + 3.2), 1.2, 0.18, M.rust);
      else K.capsule(i.x - s * (r + 0.2), i.y + c * (r + 0.2), 0.2, i.x - s * (r + 4.2) + c, i.y + c * (r + 4.2) + s, 0.2, 0.18, M.rust); } },
  // goal posts at a pitch's end (facing in along the slot): white posts and bar, the net's back stanchions
  { id: 'goal', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, fit: fix('goal'),
    volumes(i, K) { const q = kit(i, K, i.ang), down = band(i.care) === 0 && i.h < 0.5;
      if (down) { q.cap(0, -2.6, 0.1, 0.4, 2.6, 0.1, 0.07, M.cloth); q.cap(0, -2.6, 0, 0, -2.6, 1.8, 0.07, M.cloth); return; }
      for (const e of [-1, 1]) { q.cap(0, e * 2.6, 0, 0, e * 2.6, 1.9, 0.07, M.cloth); q.cap(0, e * 2.6, 1.9, -1.2, e * 2.6, 0, 0.04, M.steel); }
      q.cap(0, -2.6, 1.9, 0, 2.6, 1.9, 0.07, M.cloth); } },
  // a bike shed by a school door: the roof on its back posts, the racks, a few bikes still chained (tended), one left
  { id: 'bikeshed', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, space: 0.5, fit: fix('bikeshed'), collide: { w: 5.6, h: 2.3 },
    volumes(i, K) { const q = kit(i, K, i.ang), b = band(i.care);
      for (const e of [-1, 1]) q.cap(e * 1.9, -0.75, 0, e * 1.9, -0.75, 2.0, 0.07, M.steel);
      if (b > 0) q.box(0, -0.1, 2.0, 2.1, 0.85, 0.05, 0.03, 0, M.tarp); else q.box(0.4, 0.2, 0.9, 1.6, 0.8, 0.05, 0.03, 0.25, M.tarp);   // the roof, or what fell of it
      const n = b === 2 ? 3 : b === 1 ? 2 : 1; for (let k = 0; k < n; k++) q.cap(-1.4 + k * 1.05, -0.6, 0.45, -1.4 + k * 1.05 + (b ? 0 : 0.6), 0.9, 0.45, 0.09, M.dark); } },
  // a garage's drive-on ramps: two steel tracks rising to a platform, end stops
  { id: 'ramp', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, space: 0.5, fit: fix('ramp'), collide: { w: 4.8, h: 2.4 },
    volumes(i, K) { const q = kit(i, K, i.ang), m = band(i.care) ? M.carBlue : M.rust;
      for (const e of [-1, 1]) { q.cap(-1.7, e * 0.6, 0.12, 0.6, e * 0.6, 0.7, 0.2, m); q.box(1.2, e * 0.6, 0.6, 0.6, 0.22, 0.1, 0.04, 0, m); q.box(1.75, e * 0.6, 0.35, 0.06, 0.24, 0.35, 0.02, 0, M.steel); } } },
  // a farm's muck heap: a dark slumped mound, straw in it, the stain spreading round
  { id: 'muck', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, space: 0.5, fit: fix('muck'), collide: { w: 6.2, h: 4.4 },
    volumes(i, K) { const q = kit(i, K, i.ang), lo = band(i.care) ? 1 : 0.7;
      q.ball(0, 0, -0.6 * lo, 1.9, M.pants); q.ball(1.3, 0.4, -0.7, 1.4, M.dark); q.ball(-1.2, -0.3, -0.8, 1.5, M.pants); q.ball(0.4, -0.8, -0.5, 1.0, M.sack); },
    paint(g, i) { blot(g, i.x, i.y, 6.5, 120); } },
  // posts along an open shed's front (`len`)
  { id: 'posts', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, fit: fix('posts'),
    volumes(i, K) { const L = (i.slot.len || 20) / S / 2, q = kit(i, K, i.ang), n = Math.max(2, Math.min(6, Math.round(L * 2 / 5) + 1));
      for (let k = 0; k < n; k++) { const u = -L + 2 * L * k / (n - 1); q.box(u, 0, 1.9, 0.12, 0.12, 1.9, 0.02, 0, M.wood); } } },
  // a 6 m run of fence: posts and the mesh. Standing where it is kept or worn; where ruined some runs are down
  { id: 'fence', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, space: 0.4, collide: { w: 6.0, h: 0.4 },
    fit: (c, s) => s.use !== 'fence' ? 0 : c > 0.32 ? 1 : 0.5,
    volumes(i, K) { const q = kit(i, K, i.ang, 0, 0, 1), m = i.slot.style === 'rail' ? M.binGreen : M.steel, sag = band(i.care) === 1 && i.h < 0.3 ? 0.25 : 0;
      for (let k = 0; k < 4; k++) q.box(-3 + k * 2, 0, 0.95, 0.07, 0.07, 0.95, 0.02, 0, M.dark);
      q.box(0, 0, 1.0 - sag, 2.95, 0.04, 0.85 - sag, 0.01, 0, m); q.box(0, 0, 1.85 - sag * 2, 2.95, 0.06, 0.04, 0.02, 0, m); } },
  { id: 'fenceDown', family: 'sites', slot: 'fixture', every: 0.1, chance: 1, space: 0.4, fit: (c, s) => s.use === 'fence' && c <= 0.32 ? 1 : 0,
    volumes(i, K) { const q = kit(i, K, i.ang, 0, 0, 1), f = i.h < 0.5 ? 1 : -1; q.box(-3, 0, 0.5, 0.07, 0.07, 0.5, 0.02, 0, M.dark); q.box(3, 0, 0.4, 0.07, 0.07, 0.4, 0.02, 0, M.dark);
      q.box(0, f * 0.9, 0.04, 2.9, 0.85, 0.03, 0.01, f * 0.06, i.slot.style === 'rail' ? M.binGreen : M.steel); } },

  // ---------------- cars and lorries in bays ----------------
  // a car left in a bay: few where it was kept (the ones who never came back), more and worse where it fell; a garage's
  // cars still wait for their repairs. Nose in, sometimes reversed in; square where tended, askew and burnt in the ruins
  { id: 'bayCar', family: 'sites', slot: 'bay', every: 2.5, chance: 1, space: 1.2, collide: { w: 6.1, h: 2.6 },
    fit: (c, s) => s.bay === 'dock' ? 0 : s.bay === 'wait' ? by(c, 0.8, 0.7, 0.55) : s.bay === 'staff' ? by(c, 0.35, 0.3, 0.25) : by(c, 0.1, 0.2, 0.3),
    variant(c, h, s, i) { const b = band(c), r = hash(h, 1), r2 = hash(h, 2); if (i && r2 < 0.4) i.ang += Math.PI;
      if (b === 2) { if (i) i.ang += (r - 0.5) * 0.05; return 'parked'; }
      if (i) i.ang += (r - 0.5) * 0.25; if (b === 1) return r < 0.35 ? 'open' : r < 0.6 ? 'flat' : 'dusty';
      if (i) i.ang += (r - 0.5) * 0.5; return r < 0.7 ? 'burnt' : r < 0.85 ? 'open' : 'flat'; },
    volumes: (i, K) => CAR.volumes(i, K), paint: (g, i) => CAR.paint(g, i) },
  // a box lorry backed onto a dock, never unloaded (where it fell, burnt out)
  { id: 'lorry', family: 'sites', slot: 'bay', every: 4, chance: 1, space: 1.2, collide: { w: 10.6, h: 3.3 },
    fit: (c, s) => s.bay === 'dock' ? by(c, 0.55, 0.45, 0.45) : 0, variant: c => band(c) === 0 ? 'burnt' : band(c) === 1 ? 'dusty' : 'kept',
    volumes(i, K) { const q = kit(i, K, i.ang), v = i.variant, burnt = v === 'burnt', cab = burnt ? M.burnt : LIVERY[Math.floor(hz(i, 1) * LIVERY.length)];
      q.box(-1.0, 0, 1.75, 2.75, 1.2, 1.3, 0.08, 0, burnt ? M.burnt : v === 'dusty' ? M.stone : M.truck);   // the box
      q.box(2.75, 0, 1.25, 0.85, 1.12, 0.95, 0.2, 0, cab); q.box(3.1, 0, 1.75, 0.35, 1.0, 0.45, 0.12, 0, burnt ? M.dark : M.glass);   // the cab, its glass
      for (const u of [-2.6, -1.6, 2.7]) for (const e of [-1, 1]) q.box(u, e * 1.1, burnt ? 0.25 : 0.4, 0.42, 0.16, burnt ? 0.25 : 0.4, 0.12, 0, burnt ? M.rust : M.rubber); },
    paint(g, i) { if (i.variant === 'burnt') { blot(g, i.x, i.y, 6, 160); } } },
  // ---------------- loose things (they choose where by care) ----------------
  // a shopping trolley: in a kept car park they're all in the shelters; worn, a few left in the bays and aisles;
  // ruined (looted), everywhere, many tipped
  ...['apron', 'bay'].map(slot => ({ id: slot === 'bay' ? 'trolleyBay' : 'trolley', family: 'sites', slot, every: 2.6, chance: 1, space: 0.6, breakable: true, collide: { w: 1.2, h: 0.8 },
    fit: (c, s) => (s.site !== 'supermarket' && s.site !== 'diy') || s.bay === 'dock' || (slot === 'apron' && s.zone !== 'park' && s.zone !== 'front') ? 0 : slot === 'bay' ? by(c, 0, 0.07, 0.2) : by(c, 0.03, 0.22, 0.6),
    variant: (c, h) => band(c) === 0 && h < 0.5 ? 'tipped' : 'up',
    volumes(i, K) { const a = i.ang + hz(i, 3) * 6.28, q = kit(i, K, a, (hz(i, 4) - 0.5) * 1.2, (hz(i, 5) - 0.5) * 1.2);
      if (i.variant === 'tipped') { q.box(0, 0, 0.32, 0.45, 0.32, 0.3, 0.05, 0, M.steel); q.cap(-0.55, -0.3, 0.1, -0.55, 0.3, 0.1, 0.05, M.carRed); q.box(0.2, 0.42, 0.06, 0.4, 0.05, 0.06, 0.02, 0, M.dark); return; }
      q.box(0.05, 0, 0.72, 0.46, 0.3, 0.22, 0.05, 0, M.steel); q.box(0, 0, 0.12, 0.42, 0.26, 0.06, 0.03, 0, M.dark); q.cap(-0.5, -0.3, 0.98, -0.5, 0.3, 0.98, 0.05, M.carRed); } })),
  // jerry cans: where the fuel ran out, people came with cans; the looted forecourts are strewn with them
  { id: 'jerrycan', family: 'sites', slot: 'apron', every: 5, chance: 1, breakable: true, collide: { w: 0.8, h: 0.8 },
    fit: (c, s) => s.site !== 'gas' && s.site !== 'garage' ? 0 : by(c, 0, 0.05, 0.25),
    volumes(i, K) { const q = kit(i, K, i.ang + i.h * 6), m = i.h < 0.5 ? M.carRed : M.carGreen;
      q.box(0, 0, 0.22, 0.24, 0.1, 0.22, 0.04, 0, m); if (i.h < 0.7) q.box(0.6, 0.35, 0.1, 0.24, 0.22, 0.1, 0.04, 0.7, i.h < 0.3 ? M.carGreen : m); } },
  // pallets: stacked and wrapped where a yard was kept, the loads under tarps when worn, broken and scattered when ruined
  { id: 'pallet', family: 'sites', slot: 'apron', every: 4.5, chance: 1, space: 0.8, breakable: true, collide: { w: 1.6, h: 1.6 },
    fit: (c, s) => s.zone === 'garden' ? by(c, 0.4, 0.35, 0.3) : s.zone === 'dock' || s.zone === 'yard' ? by(c, 0.22, 0.22, 0.2) : 0,
    volumes(i, K) { const q = kit(i, K, i.ang + Math.round(i.h * 4) * Math.PI / 2 + (band(i.care) ? 0 : i.h)), b = band(i.care);
      if (b === 0) { for (let k = 0; k < 3; k++) q.box((hz(i, k) - 0.5) * 1.4, (hz(i, k + 5) - 0.5) * 1.4, 0.05, 0.55, 0.1, 0.05, 0.02, hz(i, k + 9) * 3, M.wood); return; }
      q.box(0, 0, 0.08, 0.6, 0.5, 0.08, 0.02, 0, M.wood); const n = 1 + Math.floor(hz(i, 1) * 2);
      if (i.slot.zone === 'garden' && hz(i, 2) < 0.5) { for (let k = 0; k < 4; k++) q.box((k % 2 - 0.5) * 0.55, (Math.floor(k / 2) - 0.5) * 0.48, 0.3, 0.27, 0.22, 0.14, 0.1, 0, M.sack); return; }   // compost sacks
      for (let k = 0; k < n; k++) q.box(0, 0, 0.45 + k * 0.62, 0.56, 0.46, 0.3, 0.06, 0, b === 2 ? M.cloth : M.tarp); } },
  // a garden centre's plants: a bench of pots, green where someone still waters, brown and knocked over where not
  { id: 'plants', family: 'sites', slot: 'apron', every: 3.4, chance: 1, space: 0.8, breakable: true, collide: { w: 2.2, h: 1.2 },
    fit: (c, s) => s.zone === 'garden' ? 0.5 : 0,
    volumes(i, K) { const q = kit(i, K, i.ang), b = band(i.care), leaf = b === 2 ? M.leaf : b === 1 ? M.tarp : M.pants;
      q.box(0, 0, 0.4, 0.85, 0.36, 0.04, 0.02, 0, M.wood);
      for (let k = 0; k < 4; k++) { const u = -0.6 + k * 0.4, w = (hz(i, k) - 0.5) * 0.2; if (b === 0 && hz(i, k + 4) < 0.5) { q.ball(u + 0.3, 0.7 + w, 0.1, 0.16, M.rust); continue; }
        q.ball(u, w, 0.62, (b === 0 ? 0.12 : 0.2) + 0.06 * hz(i, k + 8), leaf); } } },
  // a shipping container in a yard: stacked two high now and then; the doors hang open where it was looted
  { id: 'container', family: 'sites', slot: 'apron', every: 3.2, chance: 1, space: 1.2, collide: { w: 8.2, h: 3.3 },
    fit: (c, s) => s.zone === 'stack' ? 0.85 : 0,
    volumes(i, K) { const q = kit(i, K, i.ang), col = [M.rust, M.carBlue, M.binGreen, M.carRed, M.truck][Math.floor(hz(i, 1) * 5)], two = hz(i, 2) < 0.4, open = band(i.care) === 0 && hz(i, 3) < 0.6;
      q.box(0, 0, 1.25, 3.0, 1.2, 1.25, 0.05, 0, col); q.box(-3.02, 0, 1.25, 0.04, 1.1, 1.15, 0.02, 0, M.dark);
      if (open) for (const e of [-1, 1]) q.box(-3.6, e * 1.55, 1.2, 0.6, 0.04, 1.1, 0.02, e * 0.9, col);
      if (two) { const c2 = [M.carBlue, M.rust, M.truck, M.binGreen][Math.floor(hz(i, 4) * 4)]; q.box(0.1, 0, 3.75, 3.0, 1.2, 1.25, 0.05, (hz(i, 5) - 0.5) * 0.04, c2); } } },
  // a forklift left in the yard, forks down (a pallet still on them where it was kept)
  { id: 'forklift', family: 'sites', slot: 'apron', every: 45, chance: 1, space: 1, collide: { w: 3.8, h: 1.8 },
    fit: (c, s) => s.zone === 'yard' || s.zone === 'dock' ? by(c, 0.2, 0.25, 0.25) : 0,
    volumes(i, K) { const q = kit(i, K, i.ang), b = band(i.care), body = b ? M.paint : M.burnt;
      q.box(-0.2, 0, 0.6, 0.9, 0.55, 0.4, 0.12, 0, body); q.box(-1.0, 0, 0.75, 0.25, 0.55, 0.45, 0.1, 0, M.dark);   // body, counterweight
      q.box(-0.2, 0, 2.1, 0.75, 0.55, 0.04, 0.03, 0, M.dark);                                                       // the guard over the seat
      for (const e of [-1, 1]) { q.cap(0.75, e * 0.35, 0, 0.75, e * 0.35, 2.3, 0.06, M.dark); q.box(1.4, e * 0.25, 0.06, 0.6, 0.06, 0.04, 0.02, 0, M.steel); }
      if (b === 2) q.box(1.4, 0, 0.45, 0.6, 0.55, 0.3, 0.05, 0, M.cloth); } },
  // a skip or a big bin at the back: lid shut where kept, open and spilling where not, burnt in the ruins
  { id: 'dumpster', family: 'sites', slot: 'apron', every: 22, chance: 1, space: 1, collide: { w: 2.6, h: 1.7 },
    fit: (c, s) => s.zone === 'dock' || s.zone === 'yard' ? by(c, 0.3, 0.3, 0.3) : 0,
    volumes(i, K) { const q = kit(i, K, i.ang), b = band(i.care); q.box(0, 0, 0.6, 0.95, 0.6, 0.55, 0.08, 0, b ? (i.h < 0.5 ? M.binGreen : M.carBlue) : M.burnt);
      if (b === 2) q.box(0, 0, 1.18, 0.98, 0.62, 0.04, 0.03, 0, M.dark); else { q.box(0, 0, 1.12, 0.85, 0.5, 0.02, 0.02, 0, M.dark); q.box(0, -0.85, 1.4, 0.98, 0.04, 0.4, 0.02, 0, M.dark); } },
    paint(g, i) { if (band(i.care) === 2) return; frame(g, i); g.fillStyle = R(110); for (let k = 0; k < 9; k++) g.fillRect(-1 + hz(i, k) * 2.4, 1 + hz(i, k + 20) * 1.6, 0.16, 0.12); } },
  // a tractor: in the open shed where kept, out in the yard otherwise; burnt on its rims where the farm fell
  { id: 'tractor', family: 'sites', slot: 'apron', every: 60, chance: 1, space: 1.2, collide: { w: 5.4, h: 3.0 },
    fit: (c, s) => s.zone === 'shed' ? 0.9 : s.zone === 'farmyard' ? 0.25 : 0,
    volumes(i, K) { const q = kit(i, K, i.ang), b = band(i.care), col = b ? (i.h < 0.5 ? M.carGreen : M.carRed) : M.burnt, tyre = b ? M.rubber : M.rust;
      for (const e of [-1, 1]) { q.box(-0.75, e * 0.95, 0.75, 0.72, 0.28, 0.72, 0.3, 0, tyre); q.box(1.35, e * 0.8, 0.45, 0.45, 0.2, 0.45, 0.18, 0, tyre); }
      q.box(0.75, 0, 0.95, 0.85, 0.45, 0.35, 0.12, 0, col); q.box(-0.6, 0, 1.6, 0.6, 0.62, 0.55, 0.08, 0, b ? M.glass : M.dark); q.box(-0.6, 0, 2.2, 0.68, 0.7, 0.05, 0.04, 0, col);
      q.cap(0.9, 0.3, 1.2, 0.9, 0.3, 2.3, 0.06, M.dark); } },
  // a farm trailer: a tipper on two wheels, its drawbar; bales or muck in it where it was in use
  { id: 'trailer', family: 'sites', slot: 'apron', every: 30, chance: 1, space: 1.2, collide: { w: 6.2, h: 3.0 },
    fit: (c, s) => s.zone === 'shed' ? 0.6 : s.zone === 'farmyard' ? 0.25 : 0,
    volumes(i, K) { const q = kit(i, K, i.ang), b = band(i.care), col = b ? M.rust : M.burnt;
      q.box(0, 0, 0.95, 1.9, 0.95, 0.35, 0.05, 0, col); q.box(0, 0, 1.15, 1.75, 0.82, 0.2, 0.03, 0, M.dark);
      for (const e of [-1, 1]) q.box(0, e * 1.0, 0.45, 0.45, 0.16, 0.45, 0.16, 0, b ? M.rubber : M.rust); q.cap(1.9, 0, 0.7, 2.9, 0, 0.45, 0.07, M.dark);
      if (b === 2) for (const u of [-1.0, 0.25]) q.cap(u, -0.5, 1.75, u, 0.5, 1.75, 0.52, M.sack); else if (b === 1) q.ball(0, 0, 0.8, 0.95, M.pants); } },
  // round bales: a stack by the barn where it was worked (some wrapped black), a few left in the yard; rotten and
  // slumped where it went to ruin
  { id: 'bales', family: 'sites', slot: 'apron', every: 4.8, chance: 1, space: 1, collide: { w: 4.4, h: 2.2 },
    fit: (c, s) => s.zone === 'bales' ? 0.9 : s.zone === 'farmyard' ? 0.12 : 0,
    volumes(i, K) { const q = kit(i, K, i.ang), b = band(i.care), wrap = hz(i, 1) < 0.4, m = b ? (wrap ? M.dark : M.sack) : M.pants, r = b ? 0.6 : 0.5, n = 2 + Math.floor(hz(i, 2) * 2);
      for (let k = 0; k < n; k++) { const u = (k - (n - 1) / 2) * 1.3; q.cap(u, -0.45, r, u, 0.45, r * (b ? 1 : 0.8), r, m); }
      if (b === 2 && n === 3) q.cap(-0.65, -0.45, 1.75 * r + 0.4, -0.65, 0.45, 1.75 * r + 0.4, r, m); } },
  // tyres stacked against a garage's walls: tidy columns where kept, toppled where not (burnt in the ruins)
  { id: 'tyres', family: 'sites', slot: 'apron', every: 2.4, chance: 1, space: 0.6, breakable: true, collide: { w: 1.2, h: 1.2 },
    fit: (c, s) => s.zone === 'wall' ? by(c, 0.7, 0.75, 0.6) : s.zone === 'garage' ? by(c, 0, 0.1, 0.2) : 0,
    volumes(i, K) { const q = kit(i, K, i.ang), b = band(i.care), n = b ? 2 + Math.floor(hz(i, 1) * 3) : 1;
      if (b === 0) { for (let k = 0; k < 3; k++) q.cap((hz(i, k) - 0.5) * 1.2, (hz(i, k + 3) - 0.5) * 1.2, 0.14, (hz(i, k) - 0.5) * 1.2 + 0.05, (hz(i, k + 3) - 0.5) * 1.2, 0.15, 0.32, i.h < 0.5 ? M.burnt : M.rubber); return; }
      q.cap(0, 0, 0, 0, 0, n * 0.22, 0.34, M.rubber); q.box(0, 0, n * 0.22 + 0.3, 0.13, 0.13, 0.02, 0.12, 0, M.dark);
      if (hz(i, 2) < 0.5) { q.cap(0.72, 0.1, 0, 0.72, 0.1, 0.44, 0.34, M.rubber); q.box(0.72, 0.1, 0.76, 0.13, 0.13, 0.02, 0.12, 0, M.dark); } } },
  // ---------------- rooftop plant (on a big flat roof's spots) ----------------
  // HVAC units: a grey box, its fans; rusted and gutted where it fell
  { id: 'hvac', family: 'sites', slot: 'roof', every: 0.1, chance: 1, fit: (c, s) => s.spot && s.plant === 'hvac' ? 1 : 0,
    volumes(i, K) { const q = kit(i, K, i.ang), b = band(i.care), two = hz(i, 1) < 0.5;
      q.box(0, 0, 0.5, 1.1, 0.75, 0.5, 0.06, 0, b ? M.truck : M.rust);
      for (const e of two ? [-1, 1] : [0]) q.ball(e * 0.5, 0, 0.62, 0.42, b === 0 && e > 0 ? M.dark : M.steel);
      q.cap(-1.1, 0.3, 0.3, -2.2, 0.3, 0.3, 0.18, M.steel); } },
  // vents: a pair of mushroom cowls
  { id: 'vent', family: 'sites', slot: 'roof', every: 0.1, chance: 1, fit: (c, s) => s.spot && s.plant === 'vent' ? 1 : 0,
    volumes(i, K) { const q = kit(i, K, i.ang); for (const u of [-0.5, 0.6]) { q.cap(u, 0, 0, u, 0, 0.5, 0.14, M.steel); q.ball(u, 0, 0.4, 0.26, M.steel); } } },
  // a skylight strip (`len`): glazing in a low frame; panes broken through where it went to ruin
  { id: 'sky', family: 'sites', slot: 'roof', every: 0.1, chance: 1, fit: (c, s) => s.spot && s.plant === 'sky' ? 1 : 0,
    volumes(i, K) { const L = (i.slot.len || 10) / 2, q = kit(i, K, i.ang, 0, 0, 1), b = band(i.care), n = 4;
      for (let k = 0; k < n; k++) { const u0 = -L + 2 * L * k / n, hl = L / n - 0.12; q.box(u0 + L / n, 0, 0.18, hl, 0.8, 0.12, 0.03, 0, b === 0 && hz(i, k) < 0.5 ? M.dark : M.glass); } } },

  // ---------------- marks (painted once) ----------------
  // parking bays: n bays a side of `bw` × `bd` (two: a double row, nose to nose over the middle line); the paint wears
  // with care. Dock bays (style 'dock') in yellow-pale wide lines with hatched ends
  { id: 'lotBays', family: 'sites', slot: 'mark', every: 0.1, chance: 1, fit: (c, s) => s.use === 'bays' ? 1 : 0,
    paint(g, i) { const s = i.slot, n = s.n || 6, bw = s.bw || 3.2, bd = s.bd || 6.6, w = wear(i.care), lw = s.style === 'dock' ? 0.3 : 0.16; frame(g, i);
      for (const side of s.two ? [-1, 1] : [1]) { const v0 = s.two ? 0 : -bd / 2, v1 = s.two ? side * bd : bd / 2;
        for (let k = 0; k <= n; k++) { const u = (k - n / 2) * bw; bar(g, i, k + side * 40, u - lw / 2, Math.min(v0, v1) + 0.2, u + lw / 2, Math.max(v0, v1) - (s.two ? 0 : 0.2), w); } }
      if (s.two) bar(g, i, 99, -n * bw / 2, -lw / 2, n * bw / 2, lw / 2, w);
      else bar(g, i, 98, -n * bw / 2, -bd / 2, n * bw / 2, -bd / 2 + lw, w); } },
  // a lane arrow on a car park's or a yard's aisle
  { id: 'lotArrow', family: 'sites', slot: 'mark', every: 0.1, chance: 1, fit: (c, s) => s.use === 'arrow' ? 1 : 0,
    paint(g, i) { const w = wear(i.care); if (hz(i, 1) < w * 0.7) return; frame(g, i); g.fillStyle = R(215 * (1 - 0.6 * w));
      g.fillRect(-2.2, -0.13, 2.6, 0.26); g.beginPath(); g.moveTo(0.3, -0.65); g.lineTo(1.7, 0); g.lineTo(0.3, 0.65); g.closePath(); g.fill(); } },
  // a forecourt's paint: the lanes either side of the pump islands (dashed), arrows in and out at the ends
  { id: 'forecourtMarks', family: 'sites', slot: 'mark', every: 0.1, chance: 1, fit: (c, s) => s.use === 'forecourt' ? 1 : 0,
    paint(g, i) { const s = i.slot, L = (s.len || 26) / 2, w = wear(i.care); frame(g, i);
      for (const e of [-1, 1]) for (let k = 0; k < Math.floor(L * 2 / 2.4); k++) { const u = -L + 0.4 + k * 2.4; bar(g, i, k + e * 30, u, e * 6.3 - 0.08, u + 1.3, e * 6.3 + 0.08, w); }
      for (const e of [-1, 1]) { g.fillStyle = R(210 * (1 - 0.6 * w)); if (hz(i, e + 2) < w * 0.6) continue; g.save(); g.translate(e * (L + 1.6), e * 2.4); g.scale(e, 1);
        g.fillRect(-1.6, -0.12, 2.0, 0.24); g.beginPath(); g.moveTo(0.4, -0.55); g.lineTo(1.5, 0); g.lineTo(0.4, 0.55); g.closePath(); g.fill(); g.restore(); } } },
  // a zebra walk across an aisle (to a store's door): bars along the traffic, `w` across
  { id: 'walk', family: 'sites', slot: 'mark', every: 0.1, chance: 1, fit: (c, s) => s.use === 'walk' ? 1 : 0,
    paint(g, i) { const hw = (i.slot.w || 7) / 2, w = wear(i.care); frame(g, i); for (let k = 0; k * 1.1 < 2 * hw - 0.4; k++) { const v = -hw + 0.3 + k * 1.1; bar(g, i, k, -1.4, v, 1.4, v + 0.55, w); } } },
  // a playground court (`w` × `h`): the outline, the half line, the centre circle, a key at each end
  { id: 'court', family: 'sites', slot: 'mark', every: 0.1, chance: 1, fit: (c, s) => s.use === 'court' ? 1 : 0,
    paint(g, i) { const hw = (i.slot.w || 24) / 2, hh = (i.slot.h || 13) / 2, w = wear(i.care), a = 220 * (1 - 0.6 * w); frame(g, i); g.strokeStyle = R(a); g.lineWidth = 0.14;
      if (hz(i, 1) < w * 0.5) g.setLineDash([2.5, 1.2]);
      g.strokeRect(-hw, -hh, hw * 2, hh * 2); g.beginPath(); g.moveTo(0, -hh); g.lineTo(0, hh); g.stroke(); g.beginPath(); g.arc(0, 0, 1.9, 0, 7); g.stroke();
      for (const e of [-1, 1]) { g.strokeRect(e > 0 ? hw - 5.2 : -hw, -2.4, 5.2, 4.8); g.beginPath(); g.arc(e * (hw - 5.2), 0, 1.9, e > 0 ? Math.PI / 2 : -Math.PI / 2, e > 0 ? Math.PI * 1.5 : Math.PI / 2); g.stroke(); } } },
  // half a pitch on the grass (the anchor at the half's middle, side ±1 from the half-way line): touch and goal lines, the box, the centre circle's half
  { id: 'pitch', family: 'sites', slot: 'mark', every: 0.1, chance: 1, fit: (c, s) => s.use === 'pitch' ? 1 : 0,
    paint(g, i) { const L = (i.slot.w || 16), hh = (i.slot.h || 22) / 2, e = i.slot.side || 1, w = wear(i.care); frame(g, i); g.scale(e, 1); g.translate(-L / 2, 0); g.strokeStyle = R(215 * (1 - 0.45 * w)); g.lineWidth = 0.2;
      if (w > 0.4) g.setLineDash([1.8, 1.0 + w * 2]);
      g.beginPath(); g.moveTo(0, -hh); g.lineTo(L, -hh); g.lineTo(L, hh); g.lineTo(0, hh); g.lineTo(0, -hh); g.stroke();
      g.beginPath(); g.arc(0, 0, 4, -Math.PI / 2, Math.PI / 2); g.stroke(); g.strokeRect(L - 6, -6, 6, 12); g.strokeRect(L - 2.2, -3.2, 2.2, 6.4); } },
  // fuel or oil spilt: a wide dark blot with a dull sheen. Worn and ruined forecourts, garages, docks
  { id: 'spill', family: 'sites', slot: 'apron', every: 9, chance: 1, fit: (c, s) => ['pumps', 'garage', 'dock', 'yard'].includes(s.zone) ? by(c, 0.03, 0.12, 0.25) : 0,
    paint(g, i) { const r = 0.9 + 1.2 * hz(i, 1); blot(g, i.x, i.y, r, 150); blot(g, i.x + r * 0.6, i.y - r * 0.3, r * 0.5, 120); g.fillStyle = 'rgb(0,0,70)'; g.beginPath(); g.arc(i.x - r * 0.15, i.y, r * 0.4, 0, 7); g.fill(); } },
  // char (story-only: the forecourt fire): black at the heart, a ragged soot ring
  { id: 'burn', family: 'sites', fit: () => 0,
    paint(g, i) { blot(g, i.x, i.y, 4.2, 200); for (let k = 0; k < 7; k++) { const a = hz(i, k) * 6.28, d = 2 + hz(i, k + 9) * 2.6; blot(g, i.x + Math.cos(a) * d, i.y + Math.sin(a) * d, 1 + hz(i, k + 3), 140); }
      g.fillStyle = R(80); for (let k = 0; k < 10; k++) { const a = hz(i, k + 20) * 6.28, d = hz(i, k + 30) * 2.4; g.beginPath(); g.arc(i.x + Math.cos(a) * d, i.y + Math.sin(a) * d, 0.18, 0, 7); g.fill(); } } },
];
