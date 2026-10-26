// The world of "The Solar Flare": canon, the opening, the crew and the turn-of-day lines. Pure words (no numbers):
// the engine owns every number. Player-facing names live here and in the other content files; code ids
// (walker, hive, keep…) are never renamed. CANON is the world in a paragraph for writers.

export const GAME_TITLE = { kick: '[Thermal Pioneer System]', name: 'Hold', name2: 'Hollowmere', sub: 'The Solar Flare', pitch: 'The sky flared and the town burned. You took the charge. Now hold the Haven.' };

// the world in a paragraph, for new writers (never contains numbers)
export const CANON = `WORLD: A hot summer afternoon. At a suburban shipping depot the Solar Zenith Flare fried every electronic and left roughly four in ten people with Sudden Thermal Shock: they became the Ash-Born, charcoal-black husks with glowing orange cracks, frenzied, drawn to heat, fuel and living warmth (they are NOT rotting zombies; never write zombie, undead, walker or miasma). The hero is a quiet logistics worker who, trapped under a fallen rack shielding coworkers, absorbed the charge instead of burning; a blue System window woke ("THERMAL PIONEER SYSTEM", terse, in square brackets, with stat points). The base is the Haven Rig: a caution-yellow diesel flatbed hauler that survived the blast, armoured with scrap by the crew (outriggers, orange awnings, a humming solar pylon, halogen lights); the settlement around it is the Haven. When the suburbs run dry the Rig migrates along cracked highways toward cooler mountain valleys where a government bunker is rumoured to survive. Inferno Nests are Ash-Born gathered round heat sources (gas stations, substations, boilers); killing the core snuffs the fire and opens the road. Crew: Dee Okafor (auto mechanic, dry humour), Juno Reyes (high-school track athlete, scout, fast and cheerful), Gloria Pike (retail manager, runs the Haven, relentless optimist). Mobs: Cinder (basic), Flicker (fast), Ember Crawler, Slag Brute (big), Spark Spitter, Boiler Bloat (bursts), Siren (screams), Husk (risen), Inferno Warden and Cinder Lord (bosses). A bad night is a Flare Night. Acts: I The Depot Suburbs, II The Rail Yard.`;
export const TONE_WORLD = 'Tone: colourful, warm, hopeful-but-tense frontier adventure (World of Warcraft and Red Alert 2 colours, Shangri-La Frontier, Solo Leveling\'s System): vivid, concrete, short sentences; PG-13, no gore detail; never grim or hopeless; no real brands or real people; never mention AI or that this is a game. The System speaks only inside [square brackets], terse and a little dry.';

// ---------- the opening: skippable story cards, shown once ----------
// art: which drawing ui/intro.js paints. sys: the card types itself in the System's blue window.
export const INTRO_CARDS = [
  { id: 'depot', art: 'depot', kick: '[Parcel Depot 9 · 14:41]', lines: ['A hot summer afternoon.', 'The fans push warm air from one end of the warehouse to the other. You scan boxes, say little, and count the minutes to the end of shift.'] },
  { id: 'flare', art: 'flare', kick: '[14:52 · Solar Zenith Flare]', lines: ['The sun blinks.', 'Every screen dies at once. Then the heat arrives, and it is not weather. It is the sky.'] },
  { id: 'ash', art: 'ash', kick: '[Sudden Thermal Shock]', lines: ['Some of your coworkers just stand there, glowing.', 'Their skin goes to charcoal and the cracks turn orange. About four in ten people on Earth change that afternoon. They will be called the Ash-Born.'] },
  { id: 'rack', art: 'rack', kick: '[The loading bay]', lines: ['A rack comes down. You end up under it, arms over Dee, Juno and Gloria.', 'The charge that should have burned you goes in instead. You do not burn. You absorb.'] },
  { id: 'system', art: 'system', kick: '', sys: true, lines: ['[THERMAL PIONEER SYSTEM INITIALIZED]', 'Pioneer · Level 1', 'The Haven Rig is still running. Dee says it is a miracle. Gloria says it is a business opportunity.'], cta: 'Begin' },
];
export const INTRO_UI = { skip: 'Skip', next: 'Tap to continue', replay: 'Replay the opening' };

// ---------- the crew (names, roles, a signature line; barks.js has the rest) ----------
export const CREW_BIO = [
  { id: 'dee', name: 'Dee Okafor', role: 'Auto mechanic', blurb: 'Keeps the Rig alive with a socket set and spite.' },
  { id: 'juno', name: 'Juno Reyes', role: 'Track athlete', blurb: 'Seventeen, fast, first to the ridge and first to shout what she sees.' },
  { id: 'gloria', name: 'Gloria Pike', role: 'Retail manager', blurb: 'Runs the Haven like a store at Christmas. Everyone gets a shift and a snack.' },
];

// banners and lines for the turn of the day (picked by ui; any one is fine)
export const DUSK_TAGS = ['Dusk · the heat drains', 'Dusk · the long shadows', 'Dusk · the glow rises', 'Dusk · the sirens start'];
export const DAWN_LINES = ['The sun is back. So is your appetite.', 'Another dawn. The Haven is still standing.', 'Light on the Rig. Gloria is already making a list.', 'The sky is gold, not white. Take the win.'];
export const pickLine = (arr, n) => arr[Math.abs(n | 0) % arr.length];
