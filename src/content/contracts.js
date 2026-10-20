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
export const FINALE_NAMES = ['The Gravelord', 'The Toll-King', 'The Station Mother', 'The Frost Choir'];
export const FINALE_ADJ = ['Hollow', 'Weeping', 'Iron', 'Burning', 'Silent', 'Thousand-Handed', 'Pale', 'Drowned', 'Lantern-Eyed', 'Patient'];
export const FINALE_NOUN = ['Choir', 'Shepherd', 'Matron', 'Engine', 'Bride', 'Tide', 'Bellringer', 'Warden', 'Ferryman', 'Orchard'];

// scripted copy (used when the Chronicler is off, slow or wrong). {rule} {finale} {night} {hive} {hook}
export const CONTRACT_COPY = {
  eyebrow: '[Contract offered: Season {n}]',
  title: 'The System offers a contract',
  scene: 'Win the finale before the season ends and the city **forgets a little** of how hard it has become. Lose it and the run **ends with its name**.',
  names: {
    unique: ['The {finale} Contract', 'A Debt to {finale}', 'Night {night}: {finale}'],
    hive: ['Ashes of {hive}', 'Burn {hive}', 'The {hive} Job'],
  },
  frame: {
    unique: '{finale} walks on the blood moon of night {night}. Put it down before dawn.',
    hive: 'Burn {hive} to the ground by night {night}. It will not burn quietly.',
  },
  ruleFrame: { none: 'The finale is the whole test.' },
  twist: {
    companion: '"I have heard that name before," {hook} says, and will not say where.',
    thread: 'It goes back to {hook}. It always did.',
    place: 'Whatever {finale} is, it came out of {hook}.',
    marked: 'It already knows your face.',
    none: ['The System has offered this contract before. Nobody has finished it.', 'Someone signed this one before you. Their camp is the ruin by the road.', 'The window flickers when you read the name, as if it is afraid.'],
  },
  victory: {
    eyebrow: '[Contract complete: {name}]',
    title: 'Season {n} is yours',
    scene: 'The finale is down. The city **draws back a step**. Somewhere far off, something new **learns your name**.',
    next: 'Next time: a new contract, a new rule, and the dead remember who won the last one.',
    label: 'Take the reward',
  },
  lost: {
    eyebrow: '[Contract failed: {name}]',
    title: 'The season ends without you',
    scene: 'Night {night} came and went. {finale} is still out there. The System **closes the window** on this run.',
  },
};
