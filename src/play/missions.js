// [play] Chapter 1's missions (the Point, Nov 2: Gabriel). One chain where each step is caused by the one before and causes
// the next; data only (the rules are src/roam/sim/missions.js). A step: { id, title, giver, start (what they say when it
// begins), line (the objective, {n}/{need} filled in), done (what they say when it's done), goal, reward, desc, why }.
// goal types: bank (scrap banked at a site), protect (clear a wave round someone before time runs out), hold (stay near
// home, out of the lot, while waves come: time), fetch (pick an item up at a place and bank it), key (build a key item),
// freed (free the area's big machine), mended (mend the bridge).
// goal hold: `at` a named place (else home); rewards: clean (an area turns clean: the colour comes back), recipes (machines' recipes start to drop: Kai can read them now), recipe (one recipe), learn (a recipe), turret
// (a defender's turret at the garage), mods (elites and mod recipes appear: the late game's toys).
export const CHAPTER1 = [
  { id: 'scrap', title: 'Scrap for the bench', giver: 'KAI',
    start: 'I want to open one of their chips and see what\'s in it. My bench is bare: bring me scrap, 30 will do.',
    line: 'Bring Kai 30 scrap: bank it at the Point. ⚙ {n}/{need}', done: 'Good. Now I can take one apart. And I can read what they carry, too: keep any recipe you find.',
    goal: { type: 'bank', scrap: 30 }, reward: { recipes: true },
    desc: 'The first errand: scrap, the common currency, into Kai\'s bench.', why: 'The first minute teaches fighting and banking; it gives the bench its first use.' },
  { id: 'tomas', title: 'The welder', giver: 'KAI',
    start: 'Someone\'s signalling from Wendbridge: a lamp at the first house off the lane. Tomas, the welder. Machines are at his door.',
    line: 'Clear the machines at Tomas\'s door before they break in. {n} left', done: 'TOMAS: You\'re one of them... and you saved me. Tell Kai I\'ll weld her something that bites. A turret.',
    goal: { type: 'protect', who: 'tomas', wave: 6, time: 60, near: 45 }, reward: { recipe: 'launcher', turret: 'tomas' },
    desc: 'A person in the grey town, saved: the first human who trusts the robot.', why: 'Protecting someone gives you a defender for the next fight: the chain\'s first payoff.' },
  { id: 'test', title: 'The loud chip', giver: 'KAI',
    start: 'I\'ve wired a chip to my bench. It works... and it screams. Every machine on the Point can hear it. Hold them off while it runs.',
    line: 'Hold the Point while Kai\'s chip runs: stay near the garage, out of the lot. {n}s left', done: 'It held. But it leaks: the signal needs a shield coil. The pump works will have one.',
    goal: { type: 'hold', time: 60, r: 70, every: 7 }, reward: {},
    desc: 'Kai\'s test calls the machines to the Point: a defence with Tomas\'s turret.', why: 'Noise has a cause; the turret you earned proves itself.' },
  { id: 'scrubber', title: 'The scrubber', giver: 'KAI',
    start: 'The pump works, down Lume lane, has an old scrubber tower: it washed the air when the works ran. Start it, and keep them off it while it spins up.',
    line: 'Restart the scrubber at the pump works: stay by it while it spins up. {n}s left', done: 'Look at that: green, all down the Lume side! And the scrubber runs on shield coils. There\'s a spare in the big shed.',
    goal: { type: 'hold', at: 'scrubber', time: 40, r: 14, every: 6 }, reward: { clean: 'lumeside' },
    desc: 'A machine of the old world, restarted: the first colour comes back before the boss.', why: 'The reward you\'re fighting for, felt halfway: the Lume side turns green.' },
  { id: 'coil', title: 'The pump works', giver: 'KAI',
    start: 'The spare shield coil, in the big shed. Something big guards it.',
    line: 'Take a shield coil from the pump works and bank it at the Point', done: 'That\'s the one. Now I can build a chip that wakes them, not just screams. Bring me six of their chips.',
    goal: { type: 'fetch', item: 'coil', at: 'coil', guard: ['brute', 'crawler', 'crawler', 'crawler', 'hound'] }, reward: { learn: 'link_chip' },
    desc: 'A part from a nearby place, fetched and carried home at risk.', why: 'The freeing chip is built from a real part with a real reason.' },
  { id: 'chip', title: 'The freeing chip', giver: 'KAI',
    start: 'Six chips and some scrap, and I\'ll build it at the garage. Mind the fire: a burnt chip is no use to me.',
    line: 'Build a freeing chip at the garage (40 ⚙, 6 ◆). ◆ {n}/{need}', done: 'Here. It\'s yours. The big one in the bridge is waiting.',
    goal: { type: 'key', key: 'link', chips: 6 }, reward: {},
    desc: 'The chips farmed and the chip built.', why: 'Farming has a purpose you can see.' },
  { id: 'free', title: 'The big one', giver: 'KAI',
    start: 'Break its armour until its core lies open. Then LINK, in time with its pulse.',
    line: 'Free the big machine in Wend Bridge: break it open, then LINK in time with its pulse.', done: '',
    goal: { type: 'freed' }, reward: {},
    desc: 'The first boss, freed.', why: 'The colour comes back from where it stood.' },
  { id: 'mend', title: 'Wend Bridge', giver: 'KAI',
    start: 'Tomas has the steel. Carry 60 scrap to the bridge and they\'ll start; guard them while they work.',
    line: 'Mend Wend Bridge: carry 60 scrap to its end. You carry ⚙ {n}', done: '',
    goal: { type: 'mended' }, reward: { mods: true },
    desc: 'The bridge mended with the town\'s help.', why: 'The chapter ends with the way out, and the next toys (mods) open.' },
];

// when a step's gathering is done and only the trip back is left (the HUD says so loudly): null if the step isn't like that
export function readyOf(S, st) { const g = st.goal;
  if (g.type === 'bank') return S.scrap + S.bank.scrap >= g.scrap ? { what: `${g.scrap} SCRAP`, then: 'Ride back to Kai\'s garage and bank it.' } : null;
  if (g.type === 'key') return S.chips + S.bank.chips >= g.chips && !(S.keys && S.keys[g.key]) ? { what: `${g.chips} CHIPS`, then: 'Ride back to the garage: BUILD THE FREEING CHIP.' } : null;
  if (g.type === 'fetch') return (S.carryItems || []).includes(g.item) ? { what: 'THE SHIELD COIL', then: 'Bring it home to Kai\'s garage.' } : null;
  if (g.type === 'mended') return S.scrap >= 60 && !(S.bridges || []).some(b => b.state !== 'broken') ? { what: '60 SCRAP', then: 'Take it to the end of Wend Bridge.' } : null;
  return null; }
