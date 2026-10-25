// The pipeline: runs the registered stages in order on a fresh world, then every validator.
// A fatal failure retries the whole build with the next seed branch (try:1, try:2…), so the
// same seed still always gives the same world, and a bad roll never ships.
import { seedTree } from './seeds.js';
import { createWorld, worldHash } from './world.js';

export function buildWorld(reg, spec, maxTries = 5) {
  let last = null;
  for (let t = 0; t < maxTries; t++) {
    const root = seedTree(spec.seed).child(spec.chapter || 'ch1').child(t ? `try:${t}` : 'main');
    const W = createWorld(spec), times = [];
    for (const st of reg.stages()) { const t0 = now(); st.run(W, root.child(st.name), reg); times.push({ stage: st.name, ms: +(now() - t0).toFixed(1) }); }
    const results = reg.validators().map(v => ({ name: v.name, fatal: v.fatal, ...v.run(W, reg) }));
    last = { W, results, attempts: t + 1, times, hash: worldHash(W) };
    if (!results.some(r => r.fatal && !r.ok)) return last;
  }
  return last;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
