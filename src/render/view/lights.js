// Light: one continuous time-of-day clock (and the blood moon), the night's light pools painted around the camera
// (fires, homes, towers, hives, flares, the hero's lantern), windows and lenses, rim and mist, blackouts.
/* global THREE */
import { K } from '../kit.js';
import { skyAt } from '../look.js';
import { lc } from './shared.js';

export function createLights(V) {
  const { S, map, C, game, fx2, Wv, heroLight, opts } = V;
  let todV = -1, bloodK = 0, snapT = 0;
  // ---------- the night's light pools: every warm (and rot-green) source near the camera paints the light texture ----------
  const AMBER = lc('#ffa64d'), WARM = lc('#ffc070'), ROT = lc('#9dff4a'), REDL = lc('#ff5a3a'), FLARE = lc('#ff7a3a'), SIEGE = lc('#e3a54a'), LANT = lc('#ffc890');
  function paintLights(k, lit) {
    const time = V.time, camTarget = V.camTarget, keepFires = V.keep.fires, hives = V.hives.hives, flares = V.flares, roadView = V.roadView;
    fx2.pools.begin(camTarget.x, camTarget.z - 6, 76);
    if (k > 0.001) {
      const fl = id => 0.88 + 0.12 * Math.sin(time * 11 + id * 1.7) * Math.sin(time * 7.3 + id);
      if (!S.keep.ruined) for (const [fx0, fz0, r0] of keepFires) fx2.pools.light(fx0, fz0, r0, AMBER, 1.5 * fl(1), 0.6);
      for (const b of S.buildings) {
        if (b.ruined || b.built < 1) continue;
        const p = Wv(b.x, b.y);
        if (b.type === 'house') fx2.pools.light(p.x, p.z, 1.8 + b.level * 0.6, WARM, (0.35 + 0.3 * b.level) * lit * fl(b.id), 0.2);
        else if (b.type === 'tower') fx2.pools.light(p.x, p.z, 2.2 + b.level * 0.5, AMBER, (0.35 + 0.25 * b.level) * fl(b.id));
        else if (b.level >= 2 && b.type !== 'wall') fx2.pools.light(p.x, p.z, 1.8, WARM, 0.3 * lit);
      }
      for (const [r, hv] of hives) if (hv.glow > 0.05 && hv.g.visible) { const n = map.regions[r].nest; fx2.pools.light(n.x - C, n.y - C, 6, S.eruption && S.eruption.region === r ? REDL : S.purge === r ? SIEGE : ROT, hv.glow * 0.9, 0.3); }
      for (const m of S.mobs) if (m.burn) fx2.pools.light(m.x - C, m.y - C, 2.2, AMBER, 0.8 * fl(m.id));
      for (let i = flares.length - 1; i >= 0; i--) { const f = flares[i], a = (time - f.t0) / f.t; if (a > 1) { flares.splice(i, 1); continue; } fx2.pools.light(f.x - C, f.y - C, 8, FLARE, 2.2 * (1 - a * a) * fl(i + 5), 0.8); }
      for (const p of S.projectiles) if (p.enemy) fx2.pools.light(p.x - C, p.y - C, 1.2, ROT, 0.7);
      for (const d of S.drops) fx2.pools.light(d.x - C, d.y - C, 2.4, REDL, 0.5);
      const h = S.hero; if (!h.dead) fx2.pools.light(h.x - C, h.y - C, 4.2, LANT, 0.55 * fl(0), 0.25);
      if (opts.lights) opts.lights(fx2.pools, k);   // [road] stations and convoys can add their fires here
      // [road] begin: lit station fires paint into the night light texture
      if (roadView) for (const l of roadView.lights()) fx2.pools.light(l.x - C, l.y - C, l.d * 0.7, AMBER, 1.6 * fl(l.x | 0));
      // [road] end
    }
    fx2.pools.end(k);
  }
  const RIM_DAY = lc('#ffdcae'), RIM_NIGHT = lc('#8fb4ff'), MIST_DAWN = lc('#e6d2cc'), MIST_DUSK = lc('#a796b4'), MIST_NIGHT = lc('#30406a'), _rc = new THREE.Color();
  let boK = 0;

  /**
   * the time of day: ONE continuous clock (game.timeOfDay: 0 sunrise … dayShare dusk … 1 sunrise) drives every light.
   * The shown clock eases toward the sim's (always forward, round the wrap), so a phase flip can never snap the light.
   * Sets V.dark; returns the sky for this moment.
   */
  function clock(dt, dayT) {
    { const goal = game.timeOfDay(); if (todV < 0) todV = goal; let d = goal - todV; if (d > 0.5) d -= 1; else if (d < -0.5) d += 1;
      todV = (todV + (Math.abs(d) > 0.25 ? d : d * Math.min(1, dt * 2.5)) + 1) % 1; }
    const blood = game.isBloodMoon(S.night) ? 1 : 0; bloodK += (blood - bloodK) * Math.min(1, dt * 0.6);
    if (snapT > 0) { snapT--; todV = game.timeOfDay(); bloodK = blood; V.cam.snapDolly(dayT); }
    const skyNow = skyAt(todV, game.dayShare()); V.dark = skyNow.dark;
    return skyNow;
  }
  /** the sky, sun and fog for this moment (after the camera has moved) */
  function cycle(R) { V.look.cycle(todV, game.dayShare(), bloodK, V.camTarget, Math.max(22, R * 1.7)); }

  /** night: windows, lenses, the light pool, the hero's lantern, rim and mist */
  function night(dt, skyNow) {
    const time = V.time, dark = V.dark, h = S.hero, lampGlow = V.keep.lampGlow;
    // night: windows, lenses, the light pool, the hero's lantern, the searchlight
    // a blackout kills the town's lights, with a dying flicker
    const boT = S.blackout ? 1 : 0; boK += (boT - boK) * Math.min(1, dt * (S.blackout ? 2.5 : 1.2));
    const lit = (1 - boK) * (boK > 0.05 && boK < 0.95 ? (Math.sin(time * 37) > 0 ? 1 : 0.3) : 1);
    for (const sp of lampGlow) sp.material.opacity = dark * 0.9 * lit;
    K.WIN.emissiveIntensity = dark * 2.4 * (0.25 + 0.75 * lit); K.LENS.emissiveIntensity = 0.2 + dark * 6 * lit;
    K.T.emitK.value = dark * 2.6 * (0.25 + 0.75 * lit);
    heroLight.intensity = dark * 1.6; heroLight.position.copy(Wv(h.x, h.y, 1.6));
    paintLights(dark, lit);
    // rim on figures: warm by day, moon-blue by night; mist at dawn and dusk (and a little all night)
    _rc.copy(RIM_DAY).lerp(RIM_NIGHT, dark); K.T.rim.value.set(_rc.r, _rc.g, _rc.b, 0.15 + 0.45 * dark);
    _rc.copy(skyNow.side === 'dawn' ? MIST_DAWN : MIST_DUSK).lerp(MIST_NIGHT, dark); K.T.mist.value.set(_rc.r, _rc.g, _rc.b, 0.24 * Math.max(skyNow.tw, 0.5 * dark));
    K.T.night.value = dark;
  }
  return { clock, cycle, night, snap: () => { snapT = 3; } };
}
