// Districts: every region of the city is a district behind a quarantine fence. You start with your own;
// the others open one at a time, through the story. What a district *is* gets decided when it is first offered
// (lazy identity): two runs on the same map grow different cities.
// `lm` is the site kind it gets (mapgen LANDMARKS) · `call` is why you would go there (the hook)

export const RARITY = {
  common: { name: 'Common', color: '#cfc7b6' },
  rare: { name: 'Rare', color: '#8ab8e8' },
  unique: { name: 'Unique', color: '#c58af0' },
  legendary: { name: 'Legendary', color: '#f0b04a' },
};
// odds of each rarity by ring (near districts are mostly common, far ones hold the rare finds)
export const RARITY_ODDS = { 1: { common: 55, rare: 40, unique: 5 }, 2: { common: 30, rare: 48, unique: 22 } };

export const KITS = {
  flats: { rarity: 'common', lm: 'flats', name: 'Tower Blocks', call: 'A torch blinks from a top-floor window across the fence. Three short, three long.', max: 3 },
  allotment: { rarity: 'common', lm: 'allotment', name: 'The Allotments', call: 'Someone kept the vegetable plots watered. You can see green over the wall.', max: 2 },
  market: { rarity: 'common', lm: 'market', name: 'High Street', call: 'The shutters on the high street are still down. Whatever is behind them, nobody took it.', max: 2 },
  police: { rarity: 'rare', lm: 'police', name: 'Police Quarter', call: 'The precinct armory had a steel door. It might still be shut.', max: 1 },
  clinic: { rarity: 'rare', lm: 'clinic', name: 'Clinic Row', call: 'A red cross painted fresh on a roof. Somebody is still treating people over there.', max: 1 },
  substation: { rarity: 'rare', lm: 'substation', name: 'The Substation', call: 'The streetlights on the far grid flickered on last night. For eleven seconds.', max: 1 },
  fuel: { rarity: 'rare', lm: 'fuel', name: 'Fuel Depot', call: 'Diesel. You can smell it on the wind: the depot tanks are not empty.', max: 1 },
  school: { rarity: 'rare', lm: 'school', name: 'The School', call: 'Children\'s drawings taped to the school windows. Some of them are new.', max: 1 },
  radio: { rarity: 'unique', lm: 'radio', name: 'Radio Station', call: 'A looped broadcast on 98.4: "...if you can hear this, we are still here..."', max: 1 },
};
