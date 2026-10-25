// Stage: camp. Wherever the layout put W.camp, the camp is set from atoms by tag: the fire
// at the centre, the dead rig, three tarps. Any recipe gets the same camp.
export const campStage = {
  name: 'camp',
  run(W, seed, reg) {
    const cp = W.camp; if (!cp) { W.note('camp', 'no camp spot'); return; }
    const rng = seed.rng(), one = tag => reg.withTag(tag)[0];
    const fire = one('camp.fire'), rig = one('camp.rig'), tarp = one('camp.tarp');
    if (fire) W.place(reg, fire.id, cp.x, cp.y, 0);
    if (rig) W.place(reg, rig.id, cp.x + 5, cp.y + 9, -0.35);
    if (tarp) [[-7, -4, 0.3], [7, -5, -0.2], [-2, 7, 0.1]].forEach(([dx, dy, r], i) => W.place(reg, tarp.id, cp.x + dx, cp.y + dy, r + rng.range(-0.1, 0.1), { tone: i }));
    W.note('camp', `camp at ${cp.x.toFixed(0)}, ${cp.y.toFixed(0)}`);
  },
};
