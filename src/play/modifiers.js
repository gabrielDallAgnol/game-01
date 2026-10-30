// [play] Modifiers: Archero-style traits that edit a shot at one stage of the fire pipeline (count → path → size → rate →
// element). Stacking is predictable because the stages always run in that order; caps keep stacks from running away.
// See docs/design/play-atoms.md §7 and §10.
export const MODIFIERS = {
  double_shot: { id: 'double_shot', stage: 'count', fits: ['weapon', 'offhand'], stack: 'add', cap: { count: 7 },
    edit: s => ({ ...s, count: s.count + 1, spread: s.spread + 0.08 }),
    desc: '+1 projectile.', why: 'Archero staple and the biggest feel upgrade; capped so it can\'t run away.' },
  faster: { id: 'faster', stage: 'rate', fits: ['weapon', 'offhand'], stack: 'add', cap: { rate: 8 },
    edit: s => ({ ...s, rate: s.rate * 1.25 }),
    desc: '+25% fire rate.', why: 'Simple, always useful; stacks multiply but cap at 8 shots a second.' },
};
// [m2] element modifiers: the last stage; one element per weapon (a second replaces the first)
MODIFIERS.fire = { id: 'fire', stage: 'element', fits: ['weapon', 'offhand'], stack: 'replace', edit: s => ({ ...s, element: 'fire' }),
  desc: 'Hits set machines burning.', why: 'Element modifiers are how the two weapons combo.' };
MODIFIERS.water = { id: 'water', stage: 'element', fits: ['weapon', 'offhand'], stack: 'replace', edit: s => ({ ...s, element: 'water' }),
  desc: 'Hits soak machines.', why: 'The setup element: steam with fire.' };
