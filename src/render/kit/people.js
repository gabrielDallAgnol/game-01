// Hollowmere city kit · The cast: hero props and rigs, townsfolk, the dead and beasts.
/* global THREE */
import { M } from './materials.js';
import { rng } from './rng.js';
import { B } from './builder.js';
import { glowSprite } from './helpers.js';
import { C, SKINS, mesh, pc, geo, rig } from './rig.js';

// props, built along the hand's -y (the way the fingers point)
function axe(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.85, 6), M(C.leather2), 0, -0.2, 0)); g.add(mesh(new THREE.BoxGeometry(0.04, 0.2, 0.2), M('steel'), 0, -0.56, 0.1)); g.add(mesh(new THREE.BoxGeometry(0.045, 0.22, 0.05), M('#d8dcdc'), 0, -0.56, 0.21)); g.add(mesh(new THREE.BoxGeometry(0.035, 0.08, 0.06), M('tyre'), 0, -0.56, -0.03)); g.rotation.x = -1.2; g.position.set(0, -0.05, 0.02); parts.hand.add(g); }
function crossbow(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.06, 0.07, 0.62), M(C.leather2), 0, 0, 0.18)); g.add(mesh(new THREE.BoxGeometry(0.66, 0.035, 0.05), M('#3a3836'), 0, 0.02, 0.44)); g.add(mesh(new THREE.BoxGeometry(0.05, 0.1, 0.16), M(C.leather), 0, -0.05, -0.08)); g.position.set(0, -0.06, 0.03); g.rotation.set(1.45, 0, 0); parts.hand.add(g); }
function crowbar(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.75, 5), M('#b8412e'), 0, -0.3, 0)); g.add(mesh(new THREE.BoxGeometry(0.03, 0.03, 0.12), M('#b8412e'), 0, -0.68, 0.05)); g.rotation.x = -0.4; parts.hand.add(g); }
function torch(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 6), M('dark'), 0, -0.05, 0.04)); g.rotation.x = -1.4; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 8), M('pale', { emissive: '#fff2cc', ei: 6 })); l.position.set(0, -0.16, 0.04); g.add(l); parts.handL.add(g); }
function sword(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.05, 0.62, 0.016), M('#c9cdcf'), 0, -0.42, 0)); g.add(mesh(new THREE.BoxGeometry(0.18, 0.035, 0.04), M(C.buckle), 0, -0.1, 0)); g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 5), M(C.leather), 0, -0.03, 0)); g.rotation.x = -1.1; parts.hand.add(g); }
function shield(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 8), M(C.tabard), 0, 0, 0)); g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 6), M('steel'), 0, 0.02, 0)); g.rotation.set(0, 0, Math.PI / 2); g.position.set(-0.05, -0.05, 0.04); parts.handL.add(g); }

const HERO = { cape: C.cape, mantle: C.cape, scarf: C.scarf, belt: C.belt };
const heroes = {
  // the Survivor (and every fighter class): rolled sleeves, leather vest, red cape and scarf, a big axe
  // a class look (content/heroes.js CLASS_INFO.look) lays its accents over the base outfit
  brawler: (look = {}) => rig({ outfit: { ...HERO, top: C.shirt, sleeve: C.shirt, vest: C.leather, legs: C.olive, boots: C.leather, hair: C.hairBrown, hairStyle: 'quiff', beard: C.hairBrown, bareArms: true, gloves: C.leather, ...look }, bw: 1.1, pose: { lean: 0.08, twist: -0.15, sR: [-0.5, 0, 0.15], eR: -1.1, sL: [-0.35, 0, 0.12], eL: -0.9, hL: [-0.25], kL: 0.35, hR: [0.15], kR: 0.15, head: 0.05 }, props: axe }),
  ranger: (look = {}) => rig({ outfit: { ...HERO, cape: null, top: C.leather2, legs: C.khaki, hood: C.forest, coat: C.forest, coatIn: '#2a3a26', boots: C.leather, hair: C.hairAuburn, gloves: C.leather, ...look }, pose: { lean: 0.05, sR: [-1.25, 0, 0.0], eR: -0.25, sL: [-1.35, -0.3, -0.35], eL: -0.45, hL: [-0.3], kL: 0.3, hR: [0.12], kR: 0.1 }, props: crossbow }),
  scavver: (look = {}) => rig({ outfit: { ...HERO, cape: null, top: C.denim, legs: C.khaki, cap: '#56623a', pack: C.leather2, roll: C.olive, hair: C.hairDark, boots: C.leather, gloves: '#3a3836', ...look }, pose: { lean: 0.12, sL: [-0.25, 0, 0.05], eL: -0.7, sR: [0.15, 0, 0.0], eR: -0.25, hL: [0.25], kL: 0.2, hR: [-0.3], kR: 0.45 }, props: p => { crowbar(p); torch(p); } }),
  // sellswords and companions: helmet, amber tabard over mail, a sword and a round shield
  sellsword: () => rig({ outfit: { top: C.mail, sleeve: C.mail, tabard: C.tabard, belt: C.belt, legs: '#3c3a36', boots: C.leather, helmet: C.helm, hair: C.hairDark, gloves: C.leather }, bw: 1.05, pose: { sR: [-0.5, 0, 0.15], eR: -1.0, sL: [-0.3, 0, 0.1], eL: -0.8 }, props: p => { sword(p); shield(p); } }),
};
// townsfolk: a seeded mix of skin, hair, clothes and hats; crew = a scavenging crew member (pack, amber vest)
const FOLK_TOPS = ['#c98b4a', '#8a6a52', '#a8584a', '#d9c8a2', '#d8b04e', '#6d7f8f', '#b86a4a', '#9a7a52', '#c9a27a'];   // survivors: warm, earthy — never ash-violet or rot-green
const FOLK_LEGS = ['#3e5a78', '#5b4a3a', '#46464a', '#7a6a52', '#56603e'];
const FOLK_HAIR = [C.hairDark, C.hairBrown, C.hairAuburn, C.hairBlond, C.hairGrey, C.hairBlack];
function folk(seed = 1, o = {}) {
  const r = rng(seed * 7919 + 13), pick = a => a[Math.floor(r() * a.length)];
  const hairStyle = pick(['short', 'short', 'mop', 'long', 'bun', 'pony', 'bald']), hat = r();
  const F = { top: pick(FOLK_TOPS), legs: pick(FOLK_LEGS), skin: pick(SKINS), hair: pick(FOLK_HAIR), hairStyle, boots: pick([C.leather, '#2e2c2a', C.leather2]), belt: r() < 0.4 ? C.belt : null };
  if (hat < 0.14) F.cap = pick(['#d08a2e', '#4f6f8f', '#a8584a']); else if (hat < 0.24) F.beanie = pick(['#b8412e', '#5f8fa8', '#d8b04e']);
  if (r() < 0.25 && hairStyle !== 'long') F.beard = F.hair;
  if (r() < 0.3) F.vest = pick([C.leather, '#6b5d4c', '#3f4447']);
  else if (r() < 0.2) F.apron = pick(['#e2d6bc', C.leather2]);
  if (r() < 0.3) { F.pack = C.leather2; F.roll = pick([C.olive, '#a8584a', '#5f8fa8']); }
  if (r() < 0.3) F.bareArms = true;
  if (o.crew) Object.assign(F, { vest: '#c9702e', pack: C.leather2, roll: C.olive, apron: null, beanie: null, cap: '#8a8780' });
  const pose = o.sit ? { lean: 0.22, neck: 0.15, hL: [-1.45, 0.12], kL: 1.55, hR: [-1.45, 0.12], kR: 1.55, sL: [-0.75, 0, 0.12], eL: -1.15, sR: [-0.75, 0, 0.12], eR: -1.15 }
    : { sL: [0.15, 0, 0], sR: [-0.15, 0, 0], hL: [0.25], hR: [-0.25], kR: 0.2 };
  return rig({ outfit: F, bw: 0.92 + Math.floor(r() * 4) * 0.07, bh: 0.94 + Math.floor(r() * 3) * 0.05, pose });
}
// the dead: grey-green skin, torn and stained clothes, hunched, glowing eyes
// each kind of the dead has its own gear and accent, readable at the default zoom (rot-green stays for eyes and wounds):
// runner a red track hood · brute a hi-vis vest, hard hat and rebar · spitter a purple rain hood · bloater a yellow hazmat suit · screamer a white gown
const ZG = { runner: '#b8402e', bruteVest: '#e8762a', bruteHat: '#f0c02e', spitter: '#6a4a92', bloater: '#d4bc40', bloaterBelly: '#e6d888', screamer: '#ece8f0' };
const ZO = { top: C.zshirt, legs: C.zpants, skin: C.zskin, boots: '#34323a', hair: '#2c2a30', hairStyle: 'patchy', torn: true, wounds: C.wound, sole: false };
const dead = {
  walker: o => rig({ ...o, outfit: { ...ZO, ...(o && o.outfit) }, eyes: true, pose: { lean: 0.48, neck: 0.15, head: -0.05, headTilt: 0.25, sL: [-1.25, 0, -0.05], eL: -0.2, sR: [-0.95, 0, 0.1], eR: -0.35, hL: [-0.35], kL: 0.4, hR: [0.25], kR: 0.1 } }),
  runner: o => rig({ ...o, outfit: { ...ZO, top: ZG.runner, legs: C.zpants2, skin: C.zskin2, bareArms: true, hairStyle: 'short', hood: ZG.runner, hoodIn: '#3a1612' }, seed: 3, eyes: true, bw: 0.9, pose: { lean: 0.6, neck: -0.25, head: -0.3, sL: [-1.4, 0, -0.1], eL: -0.4, sR: [0.8, 0, 0.1], eR: -0.9, hL: [-0.9], kL: 1.1, hR: [0.5], kR: 0.6 } }),
  crawler: o => rig({ ...o, outfit: { ...ZO, top: '#5b5a50', skin: C.zrot, bareArms: true, hairStyle: 'bald' }, seed: 5, eyes: true, bw: 0.85, pose: { lean: 1.25, neck: -0.9, head: -0.4, sL: [-1.7, 0, -0.25], eL: 0.2, sR: [-1.2, 0, 0.3], eR: 0.1, hL: [-1.4], kL: 1.9, hR: [-0.6], kR: 1.6 } }),
  brute: o => rig({ ...o, outfit: { ...ZO, top: '#5e5466', sleeveless: true, hairStyle: 'bald', legs: '#38353f', skin: C.zrot, vest: ZG.bruteVest, helmet: ZG.bruteHat }, seed: 9, eyes: true, bw: 1.55, chestDepth: 1.2, scale: 1.4, pose: { lean: 0.22, neck: 0.4, head: 0.1, sL: [-0.4, 0, 0.25], eL: -0.5, sR: [-0.6, 0, 0.2], eR: -0.6, hL: [-0.2], kL: 0.25, hR: [0.15], kR: 0.1 }, props: p => { const g = new THREE.Group(); g.add(mesh(geo('rebar', () => new THREE.CylinderGeometry(0.035, 0.03, 0.95, 5)), M('#7a3f2a'), 0, -0.36, 0)); g.add(mesh(geo('rebarLump', () => new THREE.BoxGeometry(0.16, 0.2, 0.16)), M('#9a9690'), 0, -0.78, 0)); g.rotation.x = -0.25; p.hand.add(g); } }),
  spitter: o => { const r = rig({ ...o, outfit: { ...ZO, top: ZG.spitter, skin: C.zskin2, hood: ZG.spitter, hoodIn: '#1e1428' }, seed: 11, eyes: true, bw: 0.95, pose: { lean: -0.15, neck: -0.45, head: -0.35, sL: [0.2, 0, 0.35], eL: -0.3, sR: [0.15, 0, 0.35], eR: -0.3, hL: [0.1], hR: [-0.1] } }); const s = glowSprite('#b4ff4e', 0.5, 1.4); s.position.set(0, 1.6, 0.2); r.add(s); return r; },
  bloater: o => rig({ ...o, outfit: { ...ZO, top: ZG.bloater, legs: '#8f7f34', belly: ZG.bloaterBelly, hairStyle: 'bald', pack: '#7d848c', roll: '#5d646c', packFlap: '#5d646c' }, seed: 13, eyes: true, belly: 1.6, bw: 1.35, chestDepth: 1.4, scale: 1.1, pose: { lean: -0.05, neck: 0.2, sL: [-0.2, 0, 0.6], eL: -0.3, sR: [-0.2, 0, 0.6], eR: -0.3, hL: [0, 0.15], hR: [0, 0.15] } }),
  screamer: o => rig({ ...o, outfit: { ...ZO, top: ZG.screamer, legs: ZG.screamer, skin: C.zskin2, bareArms: true, hair: '#141218', hairStyle: 'long' }, seed: 17, eyes: true, bw: 0.85, pose: { lean: -0.3, neck: -0.5, head: -0.4, sL: [-2.7, 0, -0.35], eL: -0.3, sR: [-2.6, 0, -0.3], eR: -0.25, hL: [0.1], hR: [-0.1] } }),
  gravelord: o => rig({ ...o, outfit: { ...ZO, top: '#2e2b33', legs: '#26242b', sleeveless: true, skin: C.zrot, hairStyle: 'bald' }, seed: 19, eyes: true, eyesI: 10, bw: 1.7, chestDepth: 1.25, scale: 2.4, pose: { lean: 0.18, neck: 0.3, sL: [-0.35, 0, 0.35], eL: -0.4, sR: [-1.3, 0, 0.25], eR: -0.5, hL: [-0.15], kL: 0.2, hR: [0.15], kR: 0.1 }, props: p => { for (let k = 0; k < 7; k++) { const a = k * 0.9; pc(p.head, geo('crown', () => new THREE.BoxGeometry(0.05, 0.2, 0.03)), k % 2 ? 'slab' : 'rebar', Math.cos(a) * 0.12, 0.2 + (k % 3) * 0.03, Math.sin(a) * 0.12, { s: [1, 0.8 + (k % 3) * 0.3, 1], rx: Math.sin(a) * 0.4, rz: -Math.cos(a) * 0.4 }); } } }),
};
// the woods: simple four-legged game (two frames: legs swapped)
function beast(o, c) {
  const b = new B(), sw = o && o.alt ? -1 : 1, L = c.leg, top = L + c.body * 0.5;
  b.cbox(c.coat, c.body * 0.8, c.body, c.len, 0, top, 0, { r: 0.08 });
  b.cbox(c.belly, c.body * 0.7, c.body * 0.35, c.len * 0.8, 0, top - c.body * 0.35, 0, { r: 0.06 });
  for (const [lx, lz, ph] of [[-1, 1, 1], [1, 1, -1], [-1, -1, -1], [1, -1, 1]]) b.cbox(c.legc, 0.09, L, 0.09, lx * c.body * 0.28, L / 2, lz * c.len * 0.36, { r: 0.02, rx: 0.35 * ph * sw });
  b.cbox(c.coat, c.body * 0.38, c.neck, c.body * 0.38, 0, top + c.neck * 0.45, c.len * 0.5, { r: 0.05, rx: -0.5 });
  b.cbox(c.coat, c.body * 0.42, c.body * 0.38, c.head, 0, top + c.neck * 0.85, c.len * 0.5 + c.head * 0.55, { r: 0.05 });
  b.cbox(c.nose, c.body * 0.22, c.body * 0.2, 0.12, 0, top + c.neck * 0.8, c.len * 0.5 + c.head * 1.05, { r: 0.03 });
  b.cbox(c.coat, 0.08, 0.12 * c.ear, 0.05, -c.body * 0.15, top + c.neck * 0.85 + c.body * 0.25, c.len * 0.5 + c.head * 0.3, { r: 0.02, rz: -0.3 });
  b.cbox(c.coat, 0.08, 0.12 * c.ear, 0.05, c.body * 0.15, top + c.neck * 0.85 + c.body * 0.25, c.len * 0.5 + c.head * 0.3, { r: 0.02, rz: 0.3 });
  b.cbox(c.tail, 0.08, 0.08, c.tl, 0, top + c.body * 0.2, -c.len * 0.55, { r: 0.03, rx: c.tailUp });
  if (c.antlers) for (const sx of [-1, 1]) { b.cbox('bone', 0.04, 0.38, 0.04, sx * 0.1, top + c.neck * 0.85 + 0.35, c.len * 0.5 + c.head * 0.3, { r: 0.01, rz: sx * 0.35 }); b.cbox('bone', 0.03, 0.2, 0.03, sx * 0.2, top + c.neck * 0.85 + 0.5, c.len * 0.5 + c.head * 0.45, { r: 0.01, rx: 0.5 }); }
  const g = new THREE.Group(); g.add(b.build()); return g;
}
dead.deer = o => beast(o, { coat: '#8a5a34', belly: '#c9a77e', legc: '#6b4528', nose: '#2a2420', tail: '#e8dcc8', leg: 0.62, body: 0.36, len: 0.95, neck: 0.42, head: 0.3, ear: 1.2, tl: 0.12, tailUp: -0.6, antlers: true });
dead.wolf = o => beast(o, { coat: '#6d6a66', belly: '#a8a49c', legc: '#4c4946', nose: '#1d1c1b', tail: '#5e5b57', leg: 0.42, body: 0.34, len: 0.95, neck: 0.22, head: 0.36, ear: 1.4, tl: 0.42, tailUp: 0.5 });
const figure = rig;

export { heroes, folk, dead, figure };
