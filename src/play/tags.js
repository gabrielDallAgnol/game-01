// [play] Tags: property words a thing has. Systems check tags, never names (docs/design/play-atoms.md §0, §2).
export const TAGS = {
  metal: { desc: 'Made of metal.', why: 'Shock will conduct through it (later); it doesn\'t burn on its own.' },
  chipped: { desc: 'Runs on a hostile chip.', why: 'EMP and chip loot care about it; never on Kai\'s vehicle.' },
  light: { desc: 'Easily pushed.', why: 'Knockback and wind throw it further.' },
  heavy: { desc: 'Barely moves when hit; stops a ramming vehicle.', why: 'Forces you to shoot it, not ram it.' },
  flammable: { desc: 'Catches fire.', why: 'Oil, wood, dry grass: fire spreads through the world, not just through hits.' },
  liquid: { desc: 'A puddle or spill.', why: 'Materials that react to elements on the ground.' },
};
