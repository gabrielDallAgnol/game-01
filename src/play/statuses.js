// [play] Statuses: what an element leaves on a machine for a while. Their numbers live here; the sim applies them each
// step (burn damage, slows). Stacks show as pips above the machine.
export const STATUSES = {
  burning: { id: 'burning', element: 'fire', dur: 4, dps: [1.2, 1.8, 2.4], desc: 'Takes damage over time (more per stack).', why: 'Fire keeps working after the shot.' },
  wet: { id: 'wet', element: 'water', dur: 6, slow: [0.12, 0.2, 0.28], desc: 'Slowed a little (more per stack).', why: 'Water sets up reactions and buys time.' },
  soaked: { id: 'soaked', element: null, dur: 6, slow: [0.55], desc: 'Waterlogged: half speed.', why: 'The payoff of three water hits.' },
  blind: { id: 'blind', element: null, dur: 1.2, desc: 'Lost track of you.', why: 'Steam hides you: machines inside a cloud stop chasing, biting and spitting.' },
};
