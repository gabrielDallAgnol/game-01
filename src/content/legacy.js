// Legacy: fame earned by every run buys small permanent edges for the next ones (the "pearl" upgrades).
// Kept small on purpose: the live run is the game; legacy only makes the early nights a little kinder.
export const LEGACY = [
  { id: 'hands', name: 'Old Crew', desc: '+1 pair of hands every day.', cost: 120, max: 2 },
  { id: 'scrap', name: 'Buried Cache', desc: 'Start with 10 more scrap.', cost: 60, max: 3 },
  { id: 'dmg', name: 'Old Wounds', desc: 'Your hero deals 8% more damage.', cost: 100, max: 3 },
  { id: 'keep', name: 'Thicker Walls', desc: 'The town hall has 25 more health.', cost: 80, max: 3 },
  { id: 'food', name: 'Seed Bank', desc: 'Start with 6 more food.', cost: 50, max: 2 },
];
/** fame for a finished run */
export function fameOf(S) {
  const st = S.stats || {};
  return Math.round((S.night - 1) * 10 + (S.story ? S.story.titles.length * 15 + S.story.npcs.filter(n => n.joined).length * 20 : 0) + (st.districts || 0) * 10 + (st.regionsClaimed || 0) * 25 + (S.unique && S.unique.slain ? 50 : 0));
}
