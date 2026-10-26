// The world of Hollowmere (the Ashfall; docs/story/story-bible.md): the title, canon, the opening, the crew and the
// turn-of-day lines. Pure words (no numbers):
// the engine owns every number. Player-facing names live here and in the other content files; code ids
// (walker, hive, keep…) are never renamed. CANON is the world in a paragraph for writers.

export const GAME_TITLE = { kick: '[Class granted: Mechanic]', name: 'Hold', name2: 'Hollowmere', sub: 'Chapter 1 · The Engine Works', pitch: 'The ash fell. The town went still. Kai has a wrench, a class and Hilde, her broken tow truck. Fix Hilde. Get everyone out.' };

// the world in a paragraph, for new writers (never contains numbers)
export const CANON = `WORLD: Hollowmere, a small round old town in its ring street. One evening warm grey ash fell from a clear sky for an hour (the Ashfall). About four in ten people went still and grey: by day they sleep like statues, at dusk the cracks in their skin glow orange and they move. They are the Ash-Born (never zombies, never rotting, no gore). A thin blue line appeared before everyone who stayed human: the System, terse, in square brackets, helpful about mechanics and silent about why. It gave almost everyone [Class pending]. Kai Brenner, 23, a cheerful stubborn mechanic from the garage on the Ring, got a real class: [Class granted: Mechanic]. Her caution-yellow tow truck Hilde died in the church square with a cracked crankshaft; the survivors call it the Haven Rig. Crew she can bring home: Lotte Brix (pizza courier, stuck on the water tower), Benno Scholz (town hall clerk, forms keep the world in order), Gus Lindner (retired radio tech at the masts, coffee first). Goal of chapter 1: find crankshaft order 4471 at the Engine Works, fit it, drive out north.`;
export const TONE_WORLD = 'Tone: colourful, warm, hopeful-but-tense frontier adventure (World of Warcraft and Red Alert 2 colours, a light anime adventure, Solo Leveling\'s System): vivid, concrete, short sentences; PG-13, no gore detail; never grim or hopeless; no real brands or real people; never mention AI or that this is a game. The System speaks only inside [square brackets], terse and a little dry.';

// ---------- the opening: skippable story cards, shown once ----------
// art: which drawing ui/intro.js paints. sys: the card types itself in the System's blue window.
export const INTRO_CARDS = [
  { id: 'depot', art: 'depot', kick: '[Brenner\'s Garage · 18:40]', lines: ['A warm evening on the Ring.', 'Kai Brenner is under a van, humming, wrench in hand. Hilde, her old tow truck, waits outside with a bad knock in her engine.'] },
  { id: 'flare', art: 'flare', kick: '[18:52 · The Ashfall]', lines: ['Warm grey ash falls from a clear sky.', 'For one hour it settles on roofs, cars and people. Then the street goes very quiet.'] },
  { id: 'ash', art: 'ash', kick: '[The Ash-Born]', lines: ['About four in ten people just stop, grey as statues.', 'At dusk the cracks in their skin glow orange, and they move. Nobody calls them zombies. Nobody knows what to call them.'] },
  { id: 'rack', art: 'rack', kick: '[The church square]', lines: ['Kai drives Hilde to the square to tow a dead bus. Hilde coughs, knocks, and dies too.', 'Cracked crankshaft. The new one is order 4471, still waiting at the Engine Works.'] },
  { id: 'system', art: 'system', kick: '', sys: true, lines: ['[Class granted: Mechanic]', 'Kai Brenner · Lv 1', 'Everyone else got [Class pending]. Kai got a wrench and a truck. "It\'s fine. It\'s mostly fine."'], cta: 'Begin' },
];
export const INTRO_UI = { skip: 'Skip', next: 'Tap to continue', replay: 'Replay the opening' };

// ---------- the crew (names, roles, a signature line; barks.js has the rest) ----------
export const CREW_BIO = [
  { id: 'lotte', name: 'Lotte Brix', role: 'Courier', blurb: 'Pizza rider from the Ring. Knows every shortcut, never stops talking.' },
  { id: 'benno', name: 'Benno Scholz', role: 'Clerk', blurb: 'Town hall, desk 4. Has a form for that.' },
  { id: 'gus', name: 'Gus Lindner', role: 'Radio tech', blurb: 'Thirty years at the masts. Coffee first, apocalypse second.' },
];

// banners and lines for the turn of the day (picked by ui; any one is fine)
export const DUSK_TAGS = ['Dusk · the cracks glow', 'Dusk · the long shadows', 'Dusk · the sleepers stir', 'Dusk · lights low'];
export const DAWN_LINES = ['The sun is back. So is your appetite.', 'Another dawn. The Haven is still standing.', 'Light on the Rig. Hilde is still in one piece.', 'The sky is gold, not white. Take the win.'];
export const pickLine = (arr, n) => arr[Math.abs(n | 0) % arr.length];
