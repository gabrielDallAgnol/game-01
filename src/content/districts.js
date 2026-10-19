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
  flats: { rarity: 'common', lm: 'flats', name: 'Tower Blocks', call: 'A torch blinks from a top floor. Three short, three long.', max: 3 },
  allotment: { rarity: 'common', lm: 'allotment', name: 'The Allotments', call: 'Green over the wall. Someone kept the plots watered.', max: 2 },
  market: { rarity: 'common', lm: 'market', name: 'High Street', call: 'The high street shutters are still down. Nobody looted it.', max: 2 },
  police: { rarity: 'rare', lm: 'police', name: 'Police Quarter', call: 'The armory had a steel door. It might still be shut.', max: 1 },
  clinic: { rarity: 'rare', lm: 'clinic', name: 'Clinic Row', call: 'A fresh red cross on a roof. Someone is still treating people.', max: 1 },
  substation: { rarity: 'rare', lm: 'substation', name: 'The Substation', call: 'The far grid lit up last night. For eleven seconds.', max: 1 },
  fuel: { rarity: 'rare', lm: 'fuel', name: 'Fuel Depot', call: 'Diesel on the wind. The depot tanks are not empty.', max: 1 },
  school: { rarity: 'rare', lm: 'school', name: 'The School', call: 'New children\'s drawings in the school windows.', max: 1 },
  radio: { rarity: 'unique', lm: 'radio', name: 'Radio Station', call: 'A loop on 98.4: "...if you can hear this, we are still here..."', max: 1 },
};
