// [roam] Care: how kept each place still is, 0 (ruin) to 1 (tended). Every dressing atom reads it to decide whether it
// belongs (a pretty suburb has trimmed gardens and parked cars, not wrecks; the blocks round a nest are burnt and bare).
//   from: the district's kind (suburbs tended, the old town lived-in, the works and the station worn), the nests (the
//   blight spreads ~90 m round each), the ruins (~20 m), and slow noise so streets differ within a district.
// band(c): 'tended' (> 0.62), 'worn' (> 0.32), 'ruined'. Stories may override a place (see stories.js).
const BASE = { suburb: 0.78, oldtown: 0.58, park: 0.66, rail: 0.36, industry: 0.26, field: 0.46, barns: 0.5 };
export const BANDS = { tended: 0.62, worn: 0.32 };
export const band = c => c > BANDS.tended ? 'tended' : c > BANDS.worn ? 'worn' : 'ruined';
const ss = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const h2 = (x, y, s) => { let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const vn = (x, y, s) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (h2(i, j, s) * (1 - u) + h2(i + 1, j, s) * u) * (1 - v) + (h2(i, j + 1, s) * (1 - u) + h2(i + 1, j + 1, s) * u) * v; };

export function makeCare({ W, nests, buildings, seed }) {
  const G = 4, nx = Math.ceil(W.w / G) + 1, ny = Math.ceil(W.h / G) + 1, grid = new Float32Array(nx * ny);
  const ruins = buildings.filter(p => p.def.tags.includes('ruin') || p.def.look === 'ruin');
  const dkind = (x, y) => { const d = W.districtAt(x, y); return d ? (W.districts.find(q => q.id === d.id) || d).kind : 'field'; };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = i * G, y = j * G;
    let c = BASE[dkind(x, y)] ?? 0.5;
    for (const n of nests) c -= 0.62 * (1 - ss(22, 95, Math.hypot(n.x - x, n.y - y)));
    for (const r of ruins) c -= 0.45 * (1 - ss(6, 24, Math.hypot(r.x - x, r.y - y)));
    c += (vn(x / 70, y / 70, seed) - 0.5) * 0.34 + (vn(x / 18, y / 18, seed + 7) - 0.5) * 0.1;
    grid[j * nx + i] = Math.max(0, Math.min(1, c)); }
  const at = (x, y) => { const fx = Math.max(0, Math.min(nx - 1.001, x / G)), fy = Math.max(0, Math.min(ny - 1.001, y / G)), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, g = (a, b) => grid[b * nx + a];
    return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v; };
  return { at, band: (x, y) => band(at(x, y)), district: (x, y) => { const d = W.districtAt(x, y); return d ? d.id : null; } };
}
