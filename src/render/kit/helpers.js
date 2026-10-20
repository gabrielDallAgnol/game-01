// Hollowmere city kit · Small helpers: place(), text textures and signs, glow decals and sprites.
/* global THREE */
import { lin } from './palette.js';

// ---------- small helpers ----------
function place(obj, x, y, z, ry = 0, s = 1) { obj.position.set(x, y, z); obj.rotation.y = ry; obj.scale.setScalar(s); return obj; }
function textTex(text, o = {}) {
  const c = document.createElement('canvas'); c.width = o.w || 512; c.height = o.h || 128;
  const x = c.getContext('2d'); x.fillStyle = o.bg || '#2a2a28'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = o.fg || '#d8d1c2'; x.font = `${o.weight || 700} ${o.size || 72}px ${o.font || 'Arial Narrow, Arial, sans-serif'}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  if (o.spacing) x.letterSpacing = o.spacing;
  x.fillText(text, c.width / 2, c.height / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
function sign(text, w, h, o = {}) {
  const m = new THREE.MeshStandardMaterial({ map: textTex(text, o), roughness: 0.8 });
  if (o.glow) { m.emissive = lin(o.glow); m.emissiveMap = m.map; m.emissiveIntensity = o.ei ?? 1.5; }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.castShadow = false; mesh.receiveShadow = true; return mesh;
}
function radialTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const glowTex = radialTex();
function glowDecal(color, r, intensity = 1) {
  const m = new THREE.MeshBasicMaterial({ map: glowTex, color: lin(color).multiplyScalar(intensity), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), m); mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 3; return mesh;
}
function glowSprite(color, size, intensity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: lin(color).multiplyScalar(intensity), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1); return s;
}

export { place, textTex, sign, glowDecal, glowSprite };
