// Scavenging: survivors, their traits, and what the ruins hold.
// Runs go out by day and come back at dawn. Distance is counted in regions from your land:
//   0 = inside your land (safe, thin pickings) · 1 = next door · 2 = deep in the city (rich, deadly)

export const CREW = { start: 0, max: 8 };   // scavenging is retired: supply drops replace it

export const TRAITS = {
  scout:    { name: 'Scout',    desc: 'Knows the back alleys. Everyone on their run is half as likely to die.' },
  medic:    { name: 'Medic',    desc: 'Patches up bites on the way home. Their run comes back clean.' },
  mule:     { name: 'Mule',     desc: 'Carries double the food.' },
  tinker:   { name: 'Tinker',   desc: 'Spots usable parts: their run finds a free building more often.' },
  marksman: { name: 'Marksman', desc: 'At home at night, towers deal 6% more damage.' },
  cook:     { name: 'Cook',     desc: 'At home at night, +2 food at dawn.' },
  coward:   { name: 'Coward',   desc: 'Never dies out there. Brings back half as much.' },
};
export const TRAIT_ORDER = Object.keys(TRAITS);
export const START_TRAITS = ['scout', 'mule', 'cook', 'tinker', 'marksman'];

export const NAMES = ['Ada', 'Bruno', 'Cleo', 'Dario', 'Esme', 'Femi', 'Goran', 'Hana', 'Ivo', 'Jun', 'Kemal', 'Lena', 'Marta', 'Nico', 'Omar', 'Pia',
  'Quinn', 'Rui', 'Sana', 'Tomas', 'Uma', 'Vik', 'Wren', 'Yara', 'Zeno', 'Ines', 'Malik', 'Noor', 'Otto', 'Rosa'];

// per survivor sent, by distance. kit = gold spent on supplies before they leave.
export const RUN = [
  { label: 'Inside your land', kit: 1, gold: [2, 4], food: [1, 3], die: 0.0, bite: 0.0, find: 0.12, blueprint: 0.15, relic: 0.0, uses: 2 },
  { label: 'Next door',        kit: 3, gold: [3, 7], food: [2, 4], die: 0.08, bite: 0.1, find: 0.22, blueprint: 0.3, relic: 0.08, uses: 3 },
  { label: 'Deep in the city', kit: 5, gold: [6, 12], food: [3, 6], die: 0.18, bite: 0.15, find: 0.35, blueprint: 0.45, relic: 0.2, uses: 3 },
];
export const RISK = { awakeHive: 0.1 };
export const TREAT = { food: 4, gold: 6 };
