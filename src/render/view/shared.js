// The view's shared constants: scales, footprints, the hero's rig by class, colour tables, ring geometry.
/* global THREE */
import { K } from '../kit.js';
import { HEROES, CLASS_INFO } from '../../content/heroes.js';

export const lc = hex => new THREE.Color(hex).convertSRGBToLinear();
export const BSCALE = { house: 0.3, farm: 0.21, tower: 0.3, wall: 1 / 2.2, workshop: 1, market: 1, generator: 1 };
export const FOOT = { house: 2, farm: 2, tower: 1, workshop: 3, market: 3, generator: 2 };   // cells each building covers   // world units per metre of each kit model
export const HERO_OUTLINE = '#e89512';   // the hero's edge: amber, the colour of the hero ring and the hero's bar
/** the hero's model: the rig of its family, in its class colours (an advanced class keeps its Calling's weapon, so a
 *  Ranger who became a Vanguard still carries the crossbow: the rig follows the weapon) */
export function heroModel(cls, calling) { const H = HEROES[cls] || {}, base = H.legendOf || cls, C = HEROES[calling], keepsGun = H.base && C && C.attack && HEROES[base] && HEROES[base].attack && C.attack.kind !== HEROES[base].attack.kind, rig = (keepsGun && HERO_RIG[calling]) || HERO_RIG[base] || HERO_RIG[H.base] || 'brawler', I = CLASS_INFO[cls] || CLASS_INFO[base] || {}; return K.heroes[rig](I.look || {}); }
export const HERO_RIG = { warrior: 'brawler', archer: 'ranger', merchant: 'scavver', steward: 'scavver', survivor: 'brawler', vanguard: 'brawler', warlord: 'brawler', deadeye: 'ranger', medic: 'scavver', warden: 'brawler', marshal: 'ranger', quartermaster: 'scavver' };
export const UNIT = { hero: 1.7, companion: 1.45, ally: 1.3, dead: 1.25 };   // people read bigger than the buildings (Thronefall-style scale)
// your homes by level: 1 bare scrap (the kit's own drab woods and tin), 2 one coat of muted paint, 3 bright paint and a coloured roof
// (index i of each list goes together: wall, roof and, at level 3, the shutters and door)
export const HOUSE_COLORS = { 2: ['#a39783', '#8e9886', '#8b95a0', '#ad9a7c'], 3: ['#f2d27a', '#ee9a7a', '#9fd6c9', '#f4ead2', '#f2d27a', '#f4ead2', '#ee9a7a', '#9fd6c9'] };
export const ROOF_COLORS = { 2: ['#6e4a3e', '#4f585b', '#6b5a48', '#5d4a44'], 3: ['#c8553d', '#2f8f88', '#c8553d', '#3d6b9a', '#3d6b9a', '#2f8f88', '#3d6b9a', '#d9843a'] };
export const ACCENTS = ['#2f8f88', '#3d6b9a', '#3d6b9a', '#c8553d', '#c8553d', '#d9843a', '#2f8f88', '#2f8f88'];
export const HIVES = ['metro', 'petrol', 'hospital'];
export const ringGeo = (a, b) => new THREE.RingGeometry(a, b, 48);
