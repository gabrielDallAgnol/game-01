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
  // [m2] the first off-hand: a pressure hose off the bike's coolant tank
  hose: {
    base: 'hose', slot: 'offhand', theme: 'spray',
    signature: { id: 'pressure', desc: 'The spray pushes small machines back.' },
    shot: { count: 1, spread: 0.06, speed: 18, dmg: 0.35, range: 10, rate: 7, size: 1, pierce: 1, element: 'water', closeBonus: 0, push: 1.2 },
    module: 'mount_hose', tags: ['metal'],
    desc: 'A coolant hose rigged to spray. Weak, but it soaks what it touches.',
    why: 'The setup weapon for combos: soak them, then fire for steam; three soaks slow them right down.',
  },
};
