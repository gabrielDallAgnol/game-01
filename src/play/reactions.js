// [play] Reactions: two elements meeting on one machine (a status already there + a new hit), or the same element three
// times (intensify). The grid has no empty cells: every pair, and every element with itself, is here; a missing one
// falls back to CLASH so a combination is never silent (decided Oct 30). Effects are verbs from play/effects.js.
// Reactions never set off other reactions (chain depth 1).
export const REACTIONS = {
  steam: { id: 'steam', pair: ['fire', 'water'], consumes: true,
    effects: [{ do: 'cloud', kind: 'steam', r: 4.5, t: 5, dps: 0.5 }, { do: 'damage', amount: 2 }],
    look: 'steam', color: '#e8eef2', desc: 'Fire meets water: a cloud of steam. Machines inside lose track of you.', why: 'Gabriel\'s example: fire + water = smoke, the enemy gets lost. A defensive combo.' },
  blaze: { id: 'blaze', pair: ['fire', 'fire'], stacks: 3, consumes: true,
    effects: [{ do: 'explode', r: 3, amount: 6 }, { do: 'spread', status: 'burning', r: 3.5 }],
    look: 'blaze', color: '#ff7a2a', desc: 'Three fire hits: a burst that sets everything near it burning.', why: 'Rewards sticking to one element.' },
  soak: { id: 'soak', pair: ['water', 'water'], stacks: 3, consumes: true,
    effects: [{ do: 'apply', status: 'soaked' }],
    look: 'soak', color: '#6fb3e8', desc: 'Three water hits: soaked through, half speed.', why: 'A water-only build still gets a payoff.' },
};
// the fallback for any pair without a reaction yet (a spark, a little damage, a sound)
export const CLASH = { id: 'clash', consumes: true, effects: [{ do: 'damage', amount: 1 }], look: 'clash', color: '#d8d2c4', desc: 'The elements clash.', why: 'Never silent: a TODO in the grid still gives feedback.' };
export const reactionFor = (a, b) => Object.values(REACTIONS).find(r => (r.pair[0] === a && r.pair[1] === b) || (r.pair[0] === b && r.pair[1] === a)) || null;
