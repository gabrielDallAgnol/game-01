// [play] Reactions as recipes: every elemental hit adds a pip (dot) to the machine; when three pips are full, their mix
// sets off a reaction (decided Oct 30 20:00): three of one element (intensify) or two of one and one of another (a pair,
// led by the majority). With more elements later, three different ones make a third kind of recipe. The grid has no
// empty cells: a missing recipe falls back to its pair's other lead, then to CLASH, so a mix is never silent.
// Effects are verbs from play/effects.js. Reactions never set off other reactions (chain depth 1).
export const REACTIONS = {
  blaze: { id: 'blaze', recipe: { fire: 3 },
    effects: [{ do: 'explode', r: 3, amount: 6 }, { do: 'spread', el: 'fire', r: 3.5 }, { do: 'ground', kind: 'fire', r: 2.5, t: 4 }],
    look: 'blaze', color: '#ff7a2a', desc: 'Three fire: a burst that sets everything near it burning, and the ground under it.', why: 'Rewards sticking to one element.' },
  soak: { id: 'soak', recipe: { water: 3 },
    effects: [{ do: 'apply', status: 'soaked' }, { do: 'ground', kind: 'wet', r: 3, t: 14 }],
    look: 'soak', color: '#6fb3e8', desc: 'Three water: soaked through, half speed; the ground round it soaked too.', why: 'A water build still gets a payoff, and wet ground stops fire.' },
  scald: { id: 'scald', recipe: { fire: 2, water: 1 },
    effects: [{ do: 'cloud', kind: 'steam', r: 4, t: 4, dps: 1.6 }, { do: 'damage', amount: 4 }],
    look: 'steam', color: '#f2e2d2', desc: 'Two fire, one water: scalding steam. Hurts everything in it, and they lose you.', why: 'The fire-led steam: offence that also hides you.' },
  fog: { id: 'fog', recipe: { water: 2, fire: 1 },
    effects: [{ do: 'cloud', kind: 'fog', r: 6.5, t: 7, dps: 0 }, { do: 'damage', amount: 1 }],
    look: 'fog', color: '#e8eef2', desc: 'Two water, one fire: a thick fog. A wide cloud they can\'t see you through.', why: 'The water-led steam: the escape. Gabriel\'s fire + water = smoke, enemy gets lost.' },
};
// the fallback for any mix without a recipe yet (a spark, a little damage, a sound)
export const CLASH = { id: 'clash', recipe: {}, effects: [{ do: 'damage', amount: 1 }], look: 'clash', color: '#d8d2c4', desc: 'The elements clash.', why: 'Never silent: a TODO in the grid still gives feedback.' };
const same = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => a[k] === b[k]); };
// three pips (element ids) → the reaction they make
export function recipeFor(pips) { const n = {}; for (const e of pips) n[e] = (n[e] || 0) + 1;
  const exact = Object.values(REACTIONS).find(r => same(r.recipe, n)); if (exact) return exact;
  const ks = Object.keys(n); if (ks.length === 2) { const flip = { [ks[0]]: n[ks[1]], [ks[1]]: n[ks[0]] }, other = Object.values(REACTIONS).find(r => same(r.recipe, flip)); if (other) return other; }
  return CLASH; }
