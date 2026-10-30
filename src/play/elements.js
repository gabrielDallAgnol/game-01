// [play] Elements: what a hit can carry. Each leaves a status on what it hits; a second element meeting that status
// makes a reaction (play/reactions.js). One element per weapon. See docs/design/play-atoms.md §3.
export const ELEMENTS = {
  fire: { id: 'fire', status: 'burning', color: '#ff8a3a', maxStacks: 3, desc: 'Sets machines burning.', why: 'The damage element: burns over time, stacks into a Blaze.' },
  water: { id: 'water', status: 'wet', color: '#6fb3e8', maxStacks: 3, desc: 'Soaks machines.', why: 'The setup element: little damage, but wet things react (steam with fire) and slow down.' },
};
