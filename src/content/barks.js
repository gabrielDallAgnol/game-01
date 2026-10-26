// Short citizen and crew lines for the Haven (the crew: chapter 1's Lotte, Benno and Gus): a data file any module can use. Render/ui side only (it may use
// Math.random by default); sim code must pass its own rng function instead so runs stay deterministic.
//   pick('haul')              → "Good haul today!"
//   pick('haul', rng.next)    → deterministic (rng returns 0..1)
//   pickWho('rigHolds')       → { who: 'Gus', text: "Rig's holding!" }
// kinds: haul, rigHolds, heat, dawn, dusk, hurt, build, idle, nest, win, migrate, levelUp, scrap, danger, food, thanks

export const CREW = [
  { id: 'lotte', name: 'Lotte', role: 'courier', kinds: { danger: ['Shortcut! Trust me!', 'Big group on the ring street!'], dawn: ['Morning! I counted them all night. You owe me a pizza.', 'Sun\'s up! Who\'s hungry? I\'m hungry.'], idle: ['I could run to the tower and back before breakfast.'] } },
  { id: 'benno', name: 'Benno', role: 'clerk', kinds: { dawn: ['Night filed. Status: survived.', 'Good morning. Please queue for breakfast.'], haul: ['Received. Filed. Do not panic.'], thanks: ['I have a form for gratitude. Consider it stamped.'] } },
  { id: 'gus', name: 'Gus', role: 'radio tech', kinds: { dawn: ['Coffee first. Apocalypse second.', 'Rig held. Of course it held. I wired it.'], rigHolds: ['Hilde\'s purring. Don\'t tell her I said so.'] } },
];
// anyone in the Haven (unnamed citizens)
export const CITIZEN = {
  haul: ['Good haul today!', 'Look at all that timber!', 'Plenty of scrap in the cart.'],
  rigHolds: ["Rig's holding!", 'The Rig is humming. Good sign.', 'Feel that? Solid ground.'],
  heat: ['Heat\'s rising to the east...', 'It is getting warm out there.', 'The ash is still warm.'],
  dawn: ['We made it through.', 'Smells like coffee. Is that coffee?', 'Another sunrise. I will take it.'],
  dusk: ['Lamps on, everyone!', 'Back inside before dark.', 'Here they come. The cracks are glowing.'],
  hurt: ['Ow. Okay. Ow.', 'That one stung.', 'I need a minute.'],
  build: ['Nice work!', 'Another roof over our heads.', 'We are building something here.'],
  idle: ['Quiet day. Suspiciously quiet.', 'I miss air conditioning.', 'Anyone seen my other glove?'],
  nest: ['That Inferno Nest is glowing again.', 'Do not go near that building after dark.', 'Something is growing in there.'],
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
export function pickWho(kind, rng, ids = null) {   // ids: only these crew may speak (chapter 1: the ones brought home)
  const r = typeof rng === 'function' ? rng : Math.random, crew = CREW.filter(c => (c.kinds[kind] || []).length && (!ids || ids.includes(c.id)));
  if (crew.length && r() < 0.5) { const c = choose(crew, r); return { who: c.name, id: c.id, text: choose(c.kinds[kind], r) }; }
  const t = choose(CITIZEN[kind] || [''], r); return { who: 'A neighbour', id: 'citizen', text: t };
}
