// [play] Weapon bases: the theme a weapon is built on, its signature and its base shot. A dropped weapon is
// { base, rarity, level, mods: [...], seed }; the fire pipeline (play/fire.js) turns base + mods into the shot.
// Every entry: desc (what the player reads) and why (what the designer meant). See docs/design/play-atoms.md §7.
export const WEAPONS = {
  scatter: {
    base: 'scatter', slot: 'weapon', theme: 'scatter',
    signature: { id: 'point_blank', desc: 'Pellets hit harder up close.' },
    shot: { count: 3, spread: 0.24, speed: 15, dmg: 1.4, range: 13, rate: 2.6, size: 1, pierce: 0, element: null, closeBonus: 0.5, delivery: 'pellet' },
    module: 'mount_scatter', tags: ['metal'],
    desc: 'A sawn-off scatter gun bolted to the handlebars. Three pellets a shot.',
    why: 'The first weapon: forgiving aim from a moving bike, strong when you dare to ride close (risk vs reward).',
  },
  // [atoms] delivery says what a shot does to the world (docs/design/atomic-engineering.md §delivery): a pellet touches only
  // what it hits; a splash lands its element on everything in its blast; a stream puts a little down wherever it reaches
  launcher: {
    base: 'launcher', slot: 'weapon', theme: 'blast',
    signature: { id: 'splash', desc: 'Rockets burst: everything near the blast takes the hit and the element.' },
    shot: { count: 1, spread: 0, speed: 8, accel: 45, vmax: 30, dmg: 3, range: 19, rate: 0.75, size: 1.6, pierce: 0, element: null, delivery: 'splash', splash: { r: 2.6, dmg: 4, power: 3 } },
    module: 'mount_tube', tags: ['metal', 'blast'],
    desc: 'A tube on the rack that throws a rocket. Slow, loud, and it sets the world off.',
    why: 'The first weapon that changes the town: a fire rocket lights a hedge, a car, a field. Power with a cost (noise, your own fires).',
  },
  thrower: {
    base: 'thrower', slot: 'weapon', theme: 'stream',
    signature: { id: 'stream', desc: 'A short, steady spray: whatever it carries soaks into everything it touches.' },
    shot: { count: 4, spread: 0.2, speed: 9, dmg: 0.35, range: 5.5, rate: 9, size: 1, pierce: 9, element: 'fire', delivery: 'stream', stream: { r: 0.9, power: 0.12 } },
    module: 'mount_nozzle', tags: ['metal'],
    desc: 'A nozzle and a tank. Fire by default; load water and it hoses instead.',
    why: 'Close and committed: it paints the ground with its element. Fire lights the grass under your own wheels; water puts it out.',
  },
};
