// Seasons are contracts you can win. At the start of each season the System offers 2–3 contracts: a rule for the
// season (from the season pool), a finale (a monster with a name, or a named hive to burn by a night) and a reward.
// The engine (src/sim/contracts.js) owns every number here. The Chronicler (Claude) may only name, frame and twist
// an offer, and the twist may only hang on someone or something this run already has (see story.fullContext()).
import { RULES } from './season.js';

export const CONTRACT = {
  firstDay: 3,                 // season 1's contract is offered on this dawn (day 1 is quiet; dawn 2 the System measures you)
  options: 3,
  // what a win pays: legacy fame, scrap now, a legendary blessing, and the city forgets a part of how hard it was
  reward: n => ({ fame: 50 + 25 * n, scrap: 15 + 10 * n, blessing: true }),
  bigReward: n => ({ fame: 90 + 30 * n, scrap: 25 + 12 * n, blessing: true }),
  reset: 0.4,                  // share of the difficulty exponent a win takes back (api.contractWon in game.js)
  mult: n => 1.4 + 0.25 * (n - 1),       // a contract monster's health multiplier
  bigMult: n => 1.75 + 0.3 * (n - 1),
};

// the rules a contract can carry: ids the game reads with rule(id); the names and words are the System's
export const CONTRACT_RULES = ['raiders', 'metro', 'winter', 'fog', 'hunger', 'storm'].filter(id => RULES[id]);

// authored finales first, then made from these
export const FINALE_NAMES = ['The Cinder Lord', 'The Toll-King', 'The Station Mother', 'The Frost Choir'];
export const FINALE_ADJ = ['Hollow', 'Weeping', 'Iron', 'Burning', 'Silent', 'Thousand-Handed', 'Pale', 'Drowned', 'Lantern-Eyed', 'Patient'];
export const FINALE_NOUN = ['Choir', 'Shepherd', 'Matron', 'Engine', 'Bride', 'Tide', 'Bellringer', 'Warden', 'Ferryman', 'Orchard'];

// scripted copy (used when the Chronicler is off, slow or wrong). {rule} {finale} {night} {hive} {hook}
// Every card answers in its first line: WHAT you do, WHAT it costs, WHAT you get. Plain words, ≤ 12 a line.
export const CONTRACT_COPY = {
  eyebrow: '[Contract · Season {n}]',
  title: 'Pick a challenge for this season',
  scene: 'Beat the boss by **night {night}**: the nights get **easier**. Fail: the run **ends**.',
  // how much each option asks: the tag and pips the card shows
  tiers: { c1: { tag: 'Safe', pips: 1 }, c2: { tag: 'Risky', pips: 2 }, c3: { tag: 'All-in', pips: 3 } },
  goal: { unique: 'Kill {finale} by night {night}', hive: 'Burn {hive} by night {night}' },
  where: { unique: 'It comes to the Haven on night {night}.', hive: 'Its Inferno Nest is {dir} of the Haven. Walk there and burn it.' },
  noCatch: 'No catch. Just the boss.',
  tough: 'The boss is much tougher.',
  reward: 'Easier nights · +{scrap} scrap · a rare blessing',
  legacy: '+{fame} Legacy',
  legacyNote: '**Legacy** stays after this run: spend it on the start screen.',
  sign: 'Sign: {goal}',   // the button names what you commit to
  pick: 'Pick one',
  // the strip after signing
  strip: { unique: '{finale} comes to the Haven on night {night}', hive: 'Burn {hive} by night {night} · {dir}' },
  names: {
    unique: ['The {finale} Contract', 'A Debt to {finale}', 'Night {night}: {finale}'],
    hive: ['Ashes of {hive}', 'Burn {hive}', 'The {hive} Job'],
  },
  frame: {
    unique: '{finale} comes to the Haven on night {night}. Kill it.',
    hive: 'Burn {hive} by night {night}.',
  },
  ruleFrame: { none: 'No catch. Just the boss.' },
  twist: {
    companion: '{hook} knows that name, and won\'t say how.',
    thread: 'It goes back to {hook}. It always did.',
    place: '{finale} came out of {hook}.',
    marked: 'It already knows your face.',
    none: ['Others signed this before you. None finished it.', 'Someone signed this once. Their camp is the ruin by the road.', 'The window flickers when you read the name.'],
  },
  victory: {
    eyebrow: '[Contract complete: {name}]',
    title: 'Season {n} is yours',
    scene: 'The boss is down. From tonight, **the nights get easier**.',
    next: 'Next: a new challenge. The Ash-Born remember who won.',
    label: 'Take the reward',
  },
  lost: {
    eyebrow: '[Contract failed: {name}]',
    title: 'The season ends without you',
    scene: 'Night {night} came and went. {finale} is still out there. The run **ends here**.',
  },
};
