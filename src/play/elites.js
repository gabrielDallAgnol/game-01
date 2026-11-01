// [play] Elite machines (M6b, Gabriel Nov 1): now and then a machine carries a mod, and it shows: a quick one runs you down,
// a twin one hits twice (a twin spitter spits two bolts), a glancing one shrugs off part of every shot, a burning one sets
// the ground alight where it walks, a soaking one leaves water behind it. It's tougher, and beating it gives you that mod
// straight away (carried until you bank it, like recipes), so the hardest fights pay in mods. `mod` is the mod it drops;
// `name` the word over it; the rest is what it changes.
// Every entry: desc (what the player reads) and why (what the designer meant).
export const ELITES = {
  faster: { mod: 'faster', name: 'Quick', spd: 1.45, desc: 'A quick machine: it runs you down. Beat it for a Quickfire mod.', why: 'The mod you get is the trait you fought.' },
  double_shot: { mod: 'double_shot', name: 'Twin', dmgMult: 1.8, twin: true, desc: 'A twin machine: it hits twice (a spitter spits two bolts). Beat it for a Double Shot mod.', why: 'Danger you can read, a reward that matches.' },
  ricochet: { mod: 'ricochet', name: 'Glancing', glance: 0.55, desc: 'A glancing machine: shots glance off its plating. Beat it for a Ricochet mod.', why: 'A sponge that pays in the mod that bounces.' },
  fire: { mod: 'fire', name: 'Burning', trail: 'fire', desc: 'A burning machine: the ground catches where it walks. Beat it for a Fire mod.', why: 'The atom world joins the fight: it lights your path, water puts it out.' },
  water: { mod: 'water', name: 'Soaking', trail: 'water', desc: 'A soaking machine: it leaves water behind it. Beat it for a Water mod.', why: 'Its trail is a setup for your fire, or a firebreak.' },
};
export const ELITE_IDS = Object.keys(ELITES);
