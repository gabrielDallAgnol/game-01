// Hollowmere city kit · Shared materials: night-lit windows, lenses, bulbs, lanterns, the vertex-coloured material, and the M() palette cache.
/* global THREE */
import { lin, P } from './palette.js';
import { territory } from './territory.js';

// shared materials the renderer animates by night: lit windows and searchlight lenses
const WIN = new THREE.MeshStandardMaterial({ color: lin('#3c454a'), roughness: 0.4, emissive: lin('#ffb45c'), emissiveIntensity: 0 });
const LENS = new THREE.MeshStandardMaterial({ color: lin('#d8d1c2'), roughness: 0.3, emissive: lin('#fff1d0'), emissiveIntensity: 0.2 });
// bulbs and lanterns follow the windows: their glow is read straight from WIN at render time (no per-frame work)
const glowWith = (m, k, base) => Object.defineProperty(m, 'emissiveIntensity', { get: () => base + WIN.emissiveIntensity * k, set() {}, configurable: true });
const BULB = glowWith(new THREE.MeshStandardMaterial({ color: lin('#f6e6bd'), roughness: 0.4, emissive: lin('#ffc468') }), 1.6, 0.12);
const LANTERN = glowWith(new THREE.MeshStandardMaterial({ color: lin('#7d6c50'), roughness: 0.5, emissive: lin('#ff9038') }), 0.5, 0);
const VCM = territory(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }), { emit: true });
// how strongly each night-lit material glows once merged into a vertex-coloured model
const EMITW = new Map([[WIN, 1.0], [LANTERN, 0.6], [BULB, 1.7], [LENS, 1.3]]);
const mats = new Map();
function M(key, o = {}) {
  const id = key + JSON.stringify(o);
  if (mats.has(id)) return mats.get(id);
  const hex = P[key] || key;
  const m = new THREE.MeshStandardMaterial({ color: lin(hex), roughness: o.rough ?? 0.86, metalness: o.metal ?? 0, flatShading: !!o.flat, transparent: !!o.opacity, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true });
  if (o.emissive) { m.emissive = lin(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
  if (!o.emissive) territory(m);
  mats.set(id, m); return m;
}

export { WIN, LENS, BULB, LANTERN, VCM, EMITW, M };
