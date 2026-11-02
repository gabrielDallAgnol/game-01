// [play] Talking to Kai (Gabriel, Nov 2: "ask Kai things: why her house is green, how the kids are"). Topics the robot
// can raise at her garage; each has `when(S)` (shown only when it makes sense) and her answer, one or more lines. The
// robot asks in light; the question shown is what it means. Data only: src/roam/talkui.js shows them.
const freed = S => (S.guardians || []).length > 0, mended = S => (S.bridges || []).some(b => b.state === 'mended'), step = S => S.mission ? S.mission.i : 99;
export const KAI_TALK = [
  { id: 'green', ask: 'Why is it green here, and grey out there?', when: () => true,
    say: S => freed(S) ? ['Because the big one breathes the ash in now, not out. Rain does the rest.', 'Every place you free will look like this.'] : ['Ash. It settles where the machines gather and burn, and they\'ve never held the Point.', 'The big one in the bridge breathes most of it. Free it, and Wendbridge turns green too.'] },
  { id: 'kids', ask: 'How are the kids?', when: () => true,
    say: S => mended(S) ? ['Mila wants to ride you across the bridge. Jonah says he\'s coming too. He waved at you yesterday.'] : step(S) > 2 ? ['Mila drew you again. Jonah still hides when you come in, but he watches you from the window.'] : ['Asleep, finally. Mila asked if you have a name. Jonah won\'t come near you yet. Give him time.'] },
  { id: 'work', ask: 'What are you working on?', when: S => !!S.mission,
    say: S => { const i = step(S); return i === 0 ? ['Nothing, until I have scrap. I want to open one of their chips and see how it thinks.'] : i === 1 ? ['Tomas first. He\'s the only welder left on the Point, and he\'s a good man.'] : i === 2 ? ['A chip that talks to them. It\'s loud. Too loud.'] : i === 3 ? ['The signal leaks. A shield coil would hold it in: the pump works has them.'] : i === 4 ? ['The freeing chip. Six of their chips, whole ones. Fire cooks them, so go easy with it.'] : i === 5 ? ['Nothing. I\'m watching the bridge with you.'] : ['Steel for the bridge, with Tomas. Bring the scrap.']; } },
  { id: 'night', ask: 'What happened that night?', when: () => true,
    say: () => ['Every machine with a chip turned at once. Cars, cranes, the lot. They came for anything that moved.', 'You were one of them. You had Mila in your grip... and you stopped. I still don\'t know why.'] },
  { id: 'you', ask: 'Who are you, Kai?', when: () => true,
    say: () => ['A mechanic. Brenner Recovery, two trucks and a crane. Now it\'s one garage and a robot.', 'Their dad drove the other truck. He was out on a job that night.'] },
  { id: 'tomas', ask: 'About Tomas...', when: S => step(S) > 1,
    say: S => mended(S) ? ['Tomas hasn\'t stopped grinning since the bridge. He says you\'re the best apprentice he\'s had.'] : ['He welded that turret in an afternoon. He used to build railings for the church. Now he builds teeth.'] },
  { id: 'bigone', ask: 'The big one in the bridge?', when: S => step(S) >= 3 && !freed(S),
    say: () => ['It fell through the deck the first night and wedged itself in. It can\'t get out.', 'It\'s not angry, I think. It\'s stuck. Like you were.'] },
];
