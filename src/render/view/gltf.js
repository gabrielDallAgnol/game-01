// [assets3] The GLTF test path (URL flag ?gltf=1, build with `node tools/build.mjs --gltf`): the hero drawn as the KayKit Knight
// and every hostile dead as the KayKit Skeleton Warrior recoloured to an Ash-Born (charcoal, glowing orange cracks). Both are
// skinned, animated GLBs (CC0, Kay Lousberg). Off by default; with the flag off none of this runs and nothing is loaded.
// Returns null when the flag is off. Until the GLBs have parsed, `V.gltf.ready` is false and the normal figures are drawn.
/* global THREE */
import { MOBS } from '../../content/mobs.js';

export function createGltf(V) {
  let on = false; try { on = new URLSearchParams(location.search).get('gltf') === '1'; } catch (e) { /* no location */ }
  if (!on || !THREE.GLTFLoader || !THREE.SkeletonUtils) return null;
  const G = { ready: false, drawn: 0 }, { world } = V;
  const loader = new THREE.GLTFLoader(), src = {}, time = { value: 0 };
  const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  const load = name => new Promise((res, rej) => {
    const b = window.__GLB && window.__GLB[name];
    if (b) loader.parse(b64(b), '', res, rej);
    else loader.load(`./assets/models/${name}.glb`, res, undefined, rej);   // the unbundled dev server
  });

  // ---------- the Ash-Born skin: the skeleton's own texture darkened to charcoal, cracks that glow from inside ----------
  const ashMat = (orig) => {
    const m = new THREE.MeshStandardMaterial({ map: orig.map || null, color: 0x2b2624, roughness: 0.9, metalness: 0, emissive: 0xff6a18, emissiveIntensity: 1, skinning: true });
    m.onBeforeCompile = sh => {
      sh.uniforms.uT = time;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; uniform float uT;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 p = vOP * 1.7;
          float a = abs(sin(p.x * 3.1 + 1.7 * sin(p.y * 2.3 + p.z * 1.9)));
          float b = abs(sin(p.z * 2.9 + 1.5 * sin(p.x * 2.1 - p.y * 2.7)));
          float c = abs(sin(p.y * 3.3 + 1.6 * sin(p.z * 2.5 + p.x * 1.7)));
          float crack = 1.0 - smoothstep(0.0, 0.07, min(a, min(b, c)));
          totalEmissiveRadiance *= crack * (1.15 + 0.35 * sin(uT * 2.6 + vOP.y * 4.0));
          diffuseColor.rgb *= 1.0 - 0.7 * crack; }`);
    };
    m.customProgramCacheKey = () => 'ashborn';
    return m;
  };
  const eyeMat = () => new THREE.MeshBasicMaterial({ color: 0xffa040, skinning: true });

  function prep(gltf, ash) {
    const root = gltf.scene; root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), h = box.max.y - box.min.y;
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.frustumCulled = false;
      if (ash) o.material = /glow|eye/i.test(o.material.name + o.name) ? eyeMat() : ashMat(o.material);
    });
    return { gltf, h, clips: Object.fromEntries(gltf.animations.map(c => [c.name, c])) };
  }
  Promise.all([load('knight'), load('skeleton')]).then(([k, s]) => { src.knight = prep(k, false); src.skel = prep(s, true); G.ready = true; }).catch(e => console.warn('gltf: load failed', e));

  // ---------- actors: a clone, a mixer and a current action ----------
  function actor(s, height) {
    const root = THREE.SkeletonUtils.clone(s.gltf.scene), g = new THREE.Group(); g.add(root);
    const mixer = new THREE.AnimationMixer(root), act = {};
    for (const n in s.clips) act[n] = mixer.clipAction(s.clips[n]);
    g.scale.setScalar(height / s.h); world.add(g);
    return { g, mixer, act, cur: null, once: false, phase: Math.random() * 3 };
  }
  function play(a, name, o = {}) {
    const n = a.act[name] ? name : 'Idle', next = a.act[n]; if (a.cur === next) return;
    next.reset(); next.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); next.clampWhenFinished = !!o.once; next.timeScale = o.speed || 1;
    next.time = o.once ? 0 : a.phase; next.play(); if (a.cur) a.cur.crossFadeTo(next, 0.15, false); a.cur = next;
  }
  const turn = (g, face, dt) => { let d = face - g.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; g.rotation.y += d * Math.min(1, dt * 12); };

  // ---------- the hero ----------
  let hero = null;
  /** true when the Knight drew the hero this frame (the caller then hides its own rig) */
  G.hero = (h, p, face, dt, frozen) => {
    if (!G.ready) return false;
    if (!hero) hero = actor(src.knight, 1.9);
    hero.g.visible = !h.dead; hero.g.position.copy(p);
    if (!frozen) {
      turn(hero.g, face, dt);
      if (h.dead) play(hero, 'Death_A', { once: true }); else if (h.swing > 0) play(hero, '1H_Melee_Attack_Slice_Horizontal', { speed: 1.6 }); else if (h.moving) play(hero, 'Running_A', { speed: 1.1 }); else play(hero, 'Idle');
      hero.mixer.update(dt);
    }
    return true;
  };

  // ---------- the dead ----------
  const pool = [], live = new Map(); let seen = new Set();
  G.begin = () => { seen = new Set(); time.value = V.time; G.drawn = 0; };
  /** draws a hostile dead as an Ash-Born; false for animals (they keep the old figure) or while loading */
  G.mob = (key, kind, p, face, size, st, dt) => {
    if (!G.ready || (MOBS[kind] && MOBS[kind].animal) || kind.startsWith('folk')) return false;
    seen.add(key); let a = live.get(key);
    if (!a) { a = pool.pop() || actor(src.skel, 1.35); a.g.visible = true; a.cur = null; live.set(key, a); }
    a.g.position.copy(p); a.g.scale.setScalar(size * 1.35 / src.skel.h); a.g.rotation.y = face;
    play(a, st === 'dead' ? 'Death_A' : st === 'hit' ? 'Hit_A' : st === 'attack' ? '1H_Melee_Attack_Chop' : st === 'run' ? 'Running_A' : 'Walking_D_Skeletons', { once: st === 'dead', speed: st === 'run' ? 1 : 0.9 });
    a.mixer.update(dt); G.drawn++; return true;
  };
  G.end = () => { for (const [k, a] of live) if (!seen.has(k)) { a.g.visible = false; live.delete(k); pool.push(a); } };
  return G;
}
