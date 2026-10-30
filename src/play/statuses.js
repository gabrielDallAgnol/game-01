// [play] What stays on a machine. Pips: each element's dot works while it lasts (`pip`: per pip). Statuses: what a
// reaction leaves (soaked, blind). The sim applies both each step; pips and statuses show above the machine.
export const PIPS = {
  fire: { life: 5, dps: 1.0, desc: 'Each fire pip burns it a little.', why: 'Fire keeps working after the shot.' },
  water: { life: 6, slow: 0.12, desc: 'Each water pip slows it a little.', why: 'Water sets up reactions and buys time.' },
};
export const STATUSES = {
  soaked: { id: 'soaked', dur: 6, slow: 0.55, desc: 'Waterlogged: half speed.', why: 'The payoff of three water.' },
  blind: { id: 'blind', dur: 1.2, desc: 'Lost track of you.', why: 'Steam and fog hide you: machines inside stop chasing, biting and spitting.' },
};
