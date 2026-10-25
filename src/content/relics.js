// [econ3] Loot after the blessings: relics and charms (passive, found, never picked from three cards), stat tomes and
// blueprints. Pure data. A relic either carries an old blessing's effect (`perk`: the same rule, so has(id) still
// works) or its own (`econ`: carts, crews, the yard). Rarity: c common · r rare · l legendary (a burned Inferno Nest).

export const RELICS = [
  // the hero
  { id: 'gloves',   rarity: 'c', name: "Lineman's Gloves",    perk: 'steel',   desc: 'Your strikes hit +1 harder.' },
  { id: 'cola',     rarity: 'c', name: 'Warm Cola Can',       perk: 'hymn',    desc: 'You attack 20% faster.' },
  { id: 'vest',     rarity: 'c', name: 'Hi-Vis Vest',         perk: 'skin',    desc: '+12 max health; mend 1 a second at night.' },
  { id: 'thermos',  rarity: 'c', name: 'Dented Thermos',      perk: 'bandage', desc: 'Mend 1.5 health a second at night.' },
  { id: 'sneakers', rarity: 'r', name: 'Track Spikes',        perk: 'nimble',  desc: 'Run 20% faster and mend while running.' },
  { id: 'cleaver',  rarity: 'r', name: 'Butcher Cleaver',     perk: 'execute', desc: 'Your hits finish Ash-Born left below 25%.' },
  // the towers and the walls
  { id: 'scope',    rarity: 'c', name: 'Cracked Rifle Scope', perk: 'eyes',    desc: 'Towers and the Haven Rig reach 1.5 further.' },
  { id: 'feathers', rarity: 'c', name: 'Bundle of Fletching', perk: 'fletch',  desc: 'Towers hit 20% harder.' },
  { id: 'crank',    rarity: 'c', name: 'Greased Crank',       perk: 'draw',    desc: 'Towers shoot 15% faster.' },
  { id: 'mortar',   rarity: 'c', name: 'Bag of Quick-Set',    perk: 'mortar',  desc: 'Buildings +20% health, the Haven Rig +20.' },
  { id: 'flint',    rarity: 'r', name: 'Road Flare Bundle',   perk: 'fire',    desc: 'Every 5th tower bolt sets its target burning.' },
  { id: 'tusk',     rarity: 'r', name: 'Brute Tooth',         perk: 'hunter',  desc: 'Towers hit brutes and bosses 60% harder.' },
  // the town
  { id: 'ledger',   rarity: 'c', name: "Depot Clerk's Ledger", perk: 'market', desc: 'Every home pays 1 more scrap a day.' },
  { id: 'seeds',    rarity: 'c', name: 'Seed Tin',            perk: 'soil',    desc: 'Every farm grows 2 more food.' },
  { id: 'jack',     rarity: 'c', name: 'Hydraulic Jack',      econ: { cartCap: 1 }, desc: 'Carts carry 1 more a trip.' },
  { id: 'spark',    rarity: 'c', name: 'Spare Spark Plugs',   econ: { cartSpeed: 1.2 }, desc: 'Carts drive 20% faster.' },
  { id: 'level',    rarity: 'c', name: 'Bubble Level',        econ: { buildSpeed: 1.2 }, desc: 'Crews build 20% faster.' },
  { id: 'radio',    rarity: 'r', name: 'Hand-Crank Radio',    econ: { crews: 1 }, desc: 'One more crew works the queue.' },
  { id: 'plating',  rarity: 'r', name: 'Bolt-On Plating',     econ: { cartHp: 1.6 }, desc: 'Carts have 60% more health.' },
  { id: 'shelter',  rarity: 'r', name: 'Fallout Shelter Key', perk: 'shelter', desc: 'When a home falls its families hide instead of rising.' },
  // a burned Inferno Nest: run-changers
  { id: 'core',     rarity: 'l', name: 'Cooled Nest Core',    perk: 'ballista', desc: 'Every 3 s the Haven Rig fires a bolt through a whole line: 8 damage, range 12.' },
  { id: 'bell',     rarity: 'l', name: 'Last Siren',          perk: 'bell',     desc: 'Once a run the Haven Rig holds at 30% when it would fall, and blasts the Ash-Born near it.' },
  { id: 'heart',    rarity: 'l', name: 'Ember Heart',         perk: 'sanct',    desc: 'The Haven Rig mends 2 health a second at night.' },
  { id: 'crown',    rarity: 'l', name: "Foreman's Hard Hat",  perk: 'guild',    desc: 'Every dawn a tower is raised free for each 4 homes.' },
  { id: 'saw',      rarity: 'l', name: 'Molten Chainsaw',     perk: 'last',     desc: 'Once a night below 30% health: double damage, and you cannot fall for 4 s.' },
];
// stat tomes: one free stat point (the hero's Status window spends it)
export const TOME = { name: 'Stat Tome', desc: '+1 stat point.', xp: 25 };   // xp: what it gives when stat points are not in this build
// blueprints: unlock a variant for the rest of the run (the carts and the crews read them)
export const BLUEPRINTS = [
  { id: 'hauler', name: 'Heavy Hauler blueprint', desc: 'Armoured carts: +1 load, double health, and the yard holds one more.', econ: { cartCap: 1, cartHp: 2, maxCarts: 1 } },
  { id: 'prefab', name: 'Prefab Frames blueprint', desc: 'Crews build 35% faster.', econ: { buildSpeed: 1.35 } },
  { id: 'rigs',   name: 'Tow Rig blueprint', desc: 'Carts drive 35% faster.', econ: { cartSpeed: 1.35 } },
];
// what a find is, by source: [relic, tome, blueprint] weights; and the relic's rarity [common, rare, legendary]
export const LOOT = {
  chest: { what: [65, 20, 15], rarity: [70, 30, 0] },
  dawn:  { what: [80, 15, 5], rarity: [85, 15, 0] },
  nest:  { what: [100, 0, 0], rarity: [0, 0, 100], tome: 1 },   // a burned nest: a legendary relic and a stat tome
};
