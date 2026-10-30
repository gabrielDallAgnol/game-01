// [play] Effects: the small verbs that change the game. Every reaction (and later talents, uniques and machine mods) is
// built from these. Each runs against a world adapter `W` that the game supplies (damage, statuses, clouds, ground...),
// so this file holds no game state. Adding a verb is code: write it once here, with a test.
export const EFFECTS = {
  damage: (e, at, W) => W.damage(at.target, e.amount),
  apply: (e, at, W) => W.apply(at.target, e.status),
  explode: (e, at, W) => { for (const o of W.near(at.x, at.y, e.r)) { W.damage(o, e.amount * (o === at.target ? 1 : 0.7)); W.push(o, at.x, at.y, 3); } W.mark('explode', at.x, at.y, e.r); },
  spread: (e, at, W) => { for (const o of W.near(at.x, at.y, e.r)) if (o !== at.target) W.apply(o, e.status); },
  cloud: (e, at, W) => W.cloud(e.kind, at.x, at.y, e.r, e.t, e.dps || 0),
  ground: (e, at, W) => W.ground(e.kind, at.x, at.y, e.r, e.t),
};
