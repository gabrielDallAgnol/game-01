// The hero: a live rig in its class colours (rebuilt on a class change, with an aura for legendary forms), its
// x-ray silhouette through buildings, its ring, the bounty ring and its bar.
/* global THREE */
import { CLASS_INFO } from '../../content/heroes.js';
import { liveRig, xrayMat } from '../figures.js';
import { lc, ringGeo, heroModel, HERO_OUTLINE, UNIT } from './shared.js';

export function createHero(V) {
  const { S, game, world, fx, Wv } = V, { makeBar, setBar } = V.bars;
  // x-ray: where a building hides the hero (or a companion), a soft silhouette shows through it (never over the figure itself)
  const xrayMats = {};
  function xray(g, col) {
    const mat = xrayMats[col] || (xrayMats[col] = xrayMat(lc(col)));
    const list = []; g.traverse(o => { if (o.isMesh && !o.userData.xray) list.push(o); });
    for (const o of list) { const x = new THREE.Mesh(o.geometry, mat); x.userData.xray = true; x.renderOrder = 30; x.castShadow = false; o.add(x); }
    return g;
  }
  let heroRig = liveRig(heroModel(S.heroClass, S.evo && S.evo.calling), HERO_OUTLINE, 1.2), rigClass = S.heroClass; xray(heroRig.g, '#7fd4ff'); world.add(heroRig.g);
  // a new class: a new rig in its colours (and, for a legendary form, an aura that breathes under the hero)
  function syncRig() {
    if (rigClass === S.heroClass) return;
    world.remove(heroRig.g); heroRig = liveRig(heroModel(S.heroClass, S.evo && S.evo.calling), HERO_OUTLINE, 1.2); xray(heroRig.g, '#7fd4ff'); world.add(heroRig.g);
    rigClass = S.heroClass; const I = CLASS_INFO[S.heroClass] || {};
    V.feel.burst(S.hero.x, S.hero.y, 2.2 + (I.tier || 1) * 0.8, I.glow || '#7fd4ff');
    if (heroAura) { fx.remove(heroAura); heroAura = null; }
    if (I.glow) { heroAura = new THREE.Mesh(ringGeo(0.55, 1.15), new THREE.MeshBasicMaterial({ color: lc(I.glow).multiplyScalar(1.6), transparent: true, opacity: 0.55, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); heroAura.rotation.x = -Math.PI / 2; fx.add(heroAura); }
  }
  let heroAura = null;
  const heroBar = makeBar('hero', 1.25);

  /** once a frame: pose (held during a hit-stop), the rings and the bar */
  function update(dt, frozen) {
    const time = V.time, animT = V.animT, h = S.hero, { heroRing, bountyRing } = V.markers;
    // hero
    // like Thronefall: people are drawn bigger than the buildings, so you can always pick them out
    syncRig(); heroRig.g.visible = !h.dead;
    if (!frozen) {
      heroRig.g.position.copy(Wv(h.x, h.y)); heroRig.g.scale.setScalar(UNIT.hero);
      let df = h.face - heroRig.g.rotation.y; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2; heroRig.g.rotation.y += df * Math.min(1, dt * 14);
      heroRig.pose(h.moving, animT * 10, h.swing > 0 ? 1 - h.swing / 0.25 : -1);
    }
    if (V.gltf) heroRig.g.visible = !V.gltf.hero(h, Wv(h.x, h.y), heroRig.g.rotation.y, dt, frozen) && !h.dead;   // [assets3] the Knight replaces the rig (?gltf=1)
    heroRing.visible = !h.dead; heroRing.position.copy(Wv(h.x, h.y, 0.05));
    if (heroAura) { heroAura.visible = !h.dead; heroAura.position.copy(Wv(h.x, h.y, 0.07)); heroAura.material.opacity = 0.4 + 0.2 * Math.sin(time * 3); heroAura.scale.setScalar(1 + 0.08 * Math.sin(time * 2)); }
    { const on = S.bountyT > 0 && !h.dead, R = (game.heroDef.ability && game.heroDef.ability.radius || 9) + S.P.bountyRadius; bountyRing.visible = on; if (on) { bountyRing.position.copy(Wv(h.x, h.y, 0.06)); bountyRing.scale.setScalar(R); bountyRing.material.opacity = 0.35 + Math.sin(time * 5) * 0.15; } }
    if (!h.dead) setBar(heroBar, h.x, 1.95, h.y, h.hp / h.maxHp, h.hp < h.maxHp * 0.999 || S.phase === 'night'); else heroBar.visible = false;
  }
  return { xray, update };
}
