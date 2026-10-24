// Short citizen and crew lines for the Haven: a data file any module can use. Render/ui side only (it may use
// Math.random by default); sim code must pass its own rng function instead so runs stay deterministic.
//   pick('haul')              → "Good haul today!"
//   pick('haul', rng.next)    → deterministic (rng returns 0..1)
//   pickWho('rigHolds')       → { who: 'Dee Okafor', text: "Rig's holding!" }
// kinds: haul, rigHolds, heat, dawn, dusk, hurt, build, idle, nest, win, migrate, levelUp, scrap, danger, food, thanks

export const CREW = [
  { id: 'dee', name: 'Dee Okafor', role: 'mechanic', kinds: { rigHolds: ['Rig is holding. Do not touch the manifold.', 'She is running hot, but she is running.', 'One more bolt and she purrs.'], build: ['Measure twice. Weld once. Shout always.', 'That wall is load-bearing now. Congratulations.'], hurt: ['Plating is cooked. Bring me scrap.', 'Do not look at the hydraulics. Just do not.'] } },
  { id: 'juno', name: 'Juno Reyes', role: 'scout', kinds: { heat: ['Heat is rising to the east...', 'I can see shimmer on the ridge.', 'Smoke at two o\'clock. Maybe three.'], danger: ['Contact! Cinders on the road!', 'Something big is coming. Like, Slag big.'], win: ['Did you see that? Did you SEE that?', 'New personal best.'], idle: ['I could run to the ridge and back before breakfast.', 'Race you to the fence. No? Okay.'] } },
  { id: 'gloria', name: 'Gloria Pike', role: 'manager', kinds: { haul: ['Good haul today!', 'Inventory is up. Morale is up. Everyone gets a snack.', 'That is what I call a restock.'], food: ['Rations are on the table. Be nice about it.', 'Soup. Do not ask what is in it.'], dawn: ['Sun is up. Shifts start now.', 'Rise and shine, Haven. We open at six.'], thanks: ['Thank you for today. I mean it.', 'You are the best hire I never made.'] } },
];
// anyone in the Haven (unnamed citizens)
export const CITIZEN = {
  haul: ['Good haul today!', 'Look at all that timber!', 'Plenty of scrap in the cart.'],
  rigHolds: ["Rig's holding!", 'The Rig is humming. Good sign.', 'Feel that? Solid ground.'],
  heat: ['Heat\'s rising to the east...', 'It is getting warm out there.', 'Sun feels wrong today.'],
  dawn: ['We made it through.', 'Smells like coffee. Is that coffee?', 'Another sunrise. I will take it.'],
  dusk: ['Lamps on, everyone!', 'Back inside before dark.', 'Here they come, the glow on the horizon.'],
  hurt: ['Ow. Okay. Ow.', 'That one stung.', 'I need a minute.'],
  build: ['Nice work!', 'Another roof over our heads.', 'We are building something here.'],
  idle: ['Quiet day. Suspiciously quiet.', 'I miss air conditioning.', 'Anyone seen my other glove?'],
  nest: ['That Inferno Nest is glowing again.', 'Do not go near the fire pit on the road.', 'Hot spot on the horizon.'],
  win: ['That is how it is done!', 'They did not even slow us down.', 'Hero! Hero! Hero!'],
  migrate: ['Packing up! Keep your boots on.', 'Where are we going next? Somewhere cold, I hope.', 'Leave nothing but footprints.'],
  levelUp: ['You look stronger!', 'Feels like the whole Haven stood up straighter.'],
  scrap: ['More scrap for the Rig!', 'Every bolt counts.'],
  danger: ['Ash-Born at the gate!', 'Get behind the Rig!', 'Torches up!'],
  food: ['Dinner is on!', 'Full bellies, steady hands.'],
  thanks: ['Thank you.', 'We owe you.', 'Glad you are here.'],
};
export const KINDS = Object.keys(CITIZEN);
const choose = (a, r) => a[Math.min(a.length - 1, Math.floor((typeof r === 'function' ? r() : Math.random()) * a.length))];
/** one line for a kind (any citizen or crew member); unknown kinds give '' */
export function pick(kind, rng) {
  const pool = [...(CITIZEN[kind] || [])]; for (const c of CREW) pool.push(...(c.kinds[kind] || []));
  return pool.length ? choose(pool, rng) : '';
}
/** a line plus who says it: crew when they have one for the kind (about half the time), otherwise a citizen */
export function pickWho(kind, rng) {
  const r = typeof rng === 'function' ? rng : Math.random, crew = CREW.filter(c => (c.kinds[kind] || []).length);
  if (crew.length && r() < 0.5) { const c = choose(crew, r); return { who: c.name, id: c.id, text: choose(c.kinds[kind], r) }; }
  const t = choose(CITIZEN[kind] || [''], r); return { who: 'A neighbour', id: 'citizen', text: t };
}
