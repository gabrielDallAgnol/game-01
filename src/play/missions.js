// [play] Chapter 1's quests (the Point; Gabriel, Nov 2: "more WoW: several quests at once, people giving them"). Data
// only; the rules are src/roam/sim/missions.js. A quest: { id, title, giver, main (the story's chain: offered by radio as
// soon as `after` is done) or a side quest (its giver shows "!" when it's available and "?" when you can hand it in),
// after (quests that must be done first), start, line ({n}/{need} filled in), done, goal, reward, turnIn (hand it in
// to the giver in person), desc, why }.
// goals: bank (scrap banked), protect (clear a wave at someone's door in time), hold (stay by a place, out of the safe lot,
// while waves come), fetch (take an item at a place, bank it or hand it in), collect (pick up n things lying about),
// kill (the n machines it sets at a place), salvage (n wrecks salvaged), key (build a key item), freed, mended.
// rewards: recipes (machines' recipes start to drop), recipe, learn, turrets (at named places), clean (an area turns
// clean), mods (elites and mod recipes appear), scrap, chips, repair (the giver mends the bike at their door), turretDmg.
export const QUESTS = [
  { id: 'scrap', main: true, title: 'Scrap for the bench', giver: 'KAI', after: [],
    start: 'I want to open one of their chips and see what\'s in it. My bench is bare: bring me scrap, 30 will do.',
    line: 'Bring Kai 30 scrap: bank it at the garage. ⚙ {n}/{need}', done: 'Good. Now I can take one apart. And I can read what they carry, too: keep any recipe you find.',
    goal: { type: 'bank', scrap: 30 }, reward: { recipes: true }, desc: 'The first errand.', why: 'Teaches fighting and banking; opens the bench.' },
  { id: 'tomas', main: true, title: 'The welder\'s house', giver: 'KAI', after: ['scrap'],
    start: 'Someone\'s signalling from Wendbridge: a lamp at the first house off the lane. Tomas, the welder. Machines are at his door.',
    line: 'Protect Tomas\'s house: clear the machines at his door. {n} left', done: 'TOMAS: You\'re one of them... and you saved my house. I\'ll weld you a turret. Two: one for my door, one for Kai\'s.',
    goal: { type: 'protect', who: 'tomas', wave: 6, time: 60, near: 45 }, reward: { recipe: 'launcher', turrets: ['tomas', 'garage'] },
    desc: 'The first human who trusts the robot.', why: 'Protecting someone gives you defenders: his house and Kai\'s are guarded from now on.' },
  { id: 'scrubber', main: true, title: 'The scrubber in the workshop', giver: 'TOMAS', after: ['tomas'],
    start: 'TOMAS: My workshop has an old air scrubber. It washed the welding smoke out. Help me start it: it\'s loud, they\'ll come.',
    line: 'Start Tomas\'s scrubber: stay by his workshop while it spins up. {n}s left', done: 'TOMAS: Look at that. Green, all down my row! It eats shield coils, though. Kai will want one too.',
    goal: { type: 'hold', at: 'scrubber', time: 40, r: 16, every: 6 }, reward: { clean: 'tomasrow' },
    desc: 'The first colour, at the first friend\'s house.', why: 'The reward you fight for, felt early: Tomas\'s row turns green, guarded by his turret.' },
  { id: 'test', main: true, title: 'The loud chip', giver: 'KAI', after: ['scrubber'],
    start: 'I\'ve wired a chip to my bench. It works... and it screams. Every machine on the Point can hear it. Hold them off while it runs: Tomas\'s turret will help.',
    line: 'Hold the Point while Kai\'s chip runs: stay near the garage, out of the lot. {n}s left', done: 'It held. But it leaks: the signal needs a shield coil, like Tomas\'s scrubber. The pump works has spares.',
    goal: { type: 'hold', time: 50, r: 70, every: 7 }, reward: {}, desc: 'A defence with your turret.', why: 'Noise has a cause; the turret you earned proves itself.' },
  { id: 'coil', main: true, title: 'The pump works', giver: 'KAI', after: ['test'],
    start: 'The pump works, down Lume lane. A shield coil from the big shed. Something big guards it.',
    line: 'Take a shield coil from the pump works and bank it at the garage', done: 'That\'s the one. Now I can build a chip that wakes them, not just screams. Bring me six of their chips.',
    goal: { type: 'fetch', item: 'coil', at: 'coil', guard: ['brute', 'crawler', 'crawler', 'crawler', 'hound'] }, reward: { learn: 'link_chip' },
    desc: 'A part from a nearby place, carried home at risk.', why: 'The freeing chip is built from a real part.' },
  { id: 'chip', main: true, title: 'The freeing chip', giver: 'KAI', after: ['coil'],
    start: 'Six chips and some scrap, and I\'ll build it at the garage. Mind the fire: a burnt chip is no use to me.',
    line: 'Build a freeing chip at the garage (40 ⚙, 6 ◆). ◆ {n}/{need}', done: 'Here. It\'s yours. The big one in the bridge is waiting.',
    goal: { type: 'key', key: 'link', chips: 6 }, reward: {}, desc: 'The chips farmed and the chip built.', why: 'Farming has a purpose you can see.' },
  { id: 'free', main: true, title: 'The big one', giver: 'KAI', after: ['chip'],
    start: 'Break its armour until its core lies open. Then LINK, in time with its pulse.',
    line: 'Free the big machine in Wend Bridge: break it open, then LINK in time with its pulse.', done: '',
    goal: { type: 'freed' }, reward: {}, desc: 'The first boss, freed.', why: 'The colour comes back from where it stood.' },
  { id: 'mend', main: true, title: 'Wend Bridge', giver: 'KAI', after: ['free'],
    start: 'Tomas has the steel. Carry 60 scrap to the bridge and they\'ll start; guard them while they work.',
    line: 'Mend Wend Bridge: carry 60 scrap to its end. You carry ⚙ {n}', done: '',
    goal: { type: 'mended' }, reward: { mods: true }, desc: 'The bridge mended with the town\'s help.', why: 'The chapter ends with the way out; mods open.' },
  // ---------- side quests: people getting to know the robot ----------
  { id: 'toys', title: 'Jonah\'s cars', giver: 'MILA', after: ['scrap'], turnIn: true,
    start: 'MILA: Jonah dropped his toy cars when we ran, all across the fields. Five. He won\'t say it, but he cries for them.',
    line: 'Find Jonah\'s toy cars in the fields: {n}/{need}. Bring them to Mila.', done: 'MILA: All five! Jonah, look! ...He said thank you. To you. He never says thank you.',
    goal: { type: 'collect', what: 'toys', n: 5 }, reward: { scrap: 15 }, desc: 'A child\'s errand across the open fields.', why: 'Gives the empty fields a reason; the kids start to trust the robot.' },
  { id: 'barn', title: 'Reyes\'s barn', giver: 'REYES', after: ['tomas'], turnIn: true,
    start: 'REYES: You\'re the machine that saved Tomas? Then save my barn. Five of them sleep in it. My cows are gone; I want my barn.',
    line: 'Clear the machines in Reyes\'s barn: {n} left. Then tell Reyes.', done: 'REYES: Quiet at last. Here: chips I pulled off the ones that died on my fence. You\'ll know what to do with them.',
    goal: { type: 'kill', at: 'reyes', kinds: ['crawler', 'crawler', 'hound', 'crawler', 'spitter'] }, reward: { chips: 2, scrap: 10 },
    desc: 'A farmer\'s barn back.', why: 'A fight with a reward that feeds the main chain (chips).' },
  { id: 'medicine', title: 'The pharmacy van', giver: 'INES', after: ['tomas'], turnIn: true,
    start: 'INES: The pharmacy van went off the cut lane that night. If the medicine box is still in it... bring it to me?',
    line: 'Bring the medicine box from the crashed van on the cut lane to Ines.', done: 'INES: Insulin, antibiotics... you\'ve no idea. Come by when you\'re hurt: I fix people, I can fix you.',
    goal: { type: 'fetch', item: 'medicine', at: 'van', handIn: true, guard: ['crawler', 'crawler', 'hound'] }, reward: { repair: 'ines' },
    desc: 'A nurse helped, and a place to mend.', why: 'The reward changes the map: a repair spot in Wendbridge.' },
  { id: 'wrecks', title: 'Steel for the turrets', giver: 'TOMAS', after: ['scrubber'], turnIn: true,
    start: 'TOMAS: My turrets could bite harder with better steel. The wrecks along the lanes have it: salvage three.',
    line: 'Salvage wrecks (stop by one a moment): {n}/{need}. Then see Tomas.', done: 'TOMAS: Good steel. Your turrets hit harder now: both of them.',
    goal: { type: 'salvage', n: 3 }, reward: { turretDmg: 1.5 }, desc: 'The wrecks in the way become steel.', why: 'Travel has stops worth making.' },
];
export const QUEST = Object.fromEntries(QUESTS.map(q => [q.id, q]));
export const CHAPTER1 = QUESTS;   // (older code reads it by index)
// when a quest's gathering is done and only the trip back is left (the HUD says so loudly): null if it isn't like that
export function readyOf(S, st) { const g = st.goal, q = (S.quests && S.quests.active || []).find(o => o.id === st.id) || {};
  if (g.type === 'bank') return S.scrap + S.bank.scrap >= g.scrap ? { what: `${g.scrap} SCRAP`, then: 'Ride back to Kai\'s garage and bank it.' } : null;
  if (g.type === 'key') return S.chips + S.bank.chips >= g.chips && !(S.keys && S.keys[g.key]) ? { what: `${g.chips} CHIPS`, then: 'Ride back to the garage: BUILD THE FREEING CHIP.' } : null;
  if (g.type === 'fetch') return (S.carryItems || []).includes(g.item) ? { what: g.item === 'coil' ? 'THE SHIELD COIL' : 'THE MEDICINE', then: g.handIn ? `Bring it to ${st.giver[0] + st.giver.slice(1).toLowerCase()}.` : 'Bring it home to Kai\'s garage.' } : null;
  if (g.type === 'mended') return S.scrap >= 60 && !(S.bridges || []).some(b => b.state !== 'broken') ? { what: '60 SCRAP', then: 'Take it to the end of Wend Bridge.' } : null;
  if (q.met && st.turnIn) return { what: st.title.toUpperCase(), then: `Go back to ${st.giver[0] + st.giver.slice(1).toLowerCase()}.` };
  return null; }
