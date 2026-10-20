// Resting: when the hero heals at the Camp (sim/hero.js sets hero.rest), a small "+ RESTING" tag rides over his bar
// and a few soft green motes rise; mid-fight or by a hive there is no tag, because he does not heal there.
/* global THREE */
import { K } from '../kit.js';

export function createRest(V) {
  const { S, fx, fx2, Wv } = V;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.textTex('+ RESTING', { w: 256, h: 64, size: 40, bg: 'rgba(10,14,12,0.72)', fg: '#9fe86a', font: "'IBM Plex Mono', monospace", weight: 700 }), transparent: true, depthTest: false, fog: false }));
  tag.scale.set(1.5, 0.375, 1); tag.renderOrder = 22; tag.visible = false; fx.add(tag);
  let a = 0, moteT = 0;
  /** once a frame, after the hero */
  function update(dt) {
    const h = S.hero, on = !h.dead && h.rest === 'camp';
    a += ((on ? 1 : 0) - a) * Math.min(1, dt * (on ? 4 : 6));
    tag.visible = a > 0.02; if (!tag.visible) return;
    tag.position.copy(Wv(h.x, h.y, 2.45 + 0.04 * Math.sin(V.time * 3))); tag.material.opacity = a;
    if (on && (moteT -= dt) <= 0) { moteT = 0.35; const p = Wv(h.x, h.y, 0.6); fx2.emit('rot', p.x, p.y, p.z, 2, { color: '#a8f07a', spread: 0.5, speed: 0.5 }); }
  }
  return { update };
}
