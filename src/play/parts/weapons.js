// [play] Weapon bases: the theme a weapon is built on, its signature and its base shot. A dropped weapon is
// { base, rarity, level, mods: [...], seed }; the fire pipeline (play/fire.js) turns base + mods into the shot.
// Every entry: desc (what the player reads) and why (what the designer meant). See docs/design/play-atoms.md §7.
export const WEAPONS = {
  scatter: {
    base: 'scatter', slot: 'weapon', theme: 'scatter',
    signature: { id: 'point_blank', desc: 'Pellets hit harder up close.' },
    shot: { count: 3, spread: 0.24, speed: 30, dmg: 1.4, range: 13, rate: 2.6, size: 1, pierce: 0, element: null, closeBonus: 0.5 },
    module: 'mount_scatter', tags: ['metal'],
    desc: 'A sawn-off scatter gun bolted to the handlebars. Three pellets a shot.',
    why: 'The first weapon: forgiving aim from a moving bike, strong when you dare to ride close (risk vs reward).',
  },
};
