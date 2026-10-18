// The story layer: encounters with choices. The engine owns every effect; text here is the offline
// version (Claude can rewrite the words of any encounter, never its effects).
// Effects ({ op, ... }) are applied by src/sim/story.js. Costs are checked before a choice is allowed.

// The voice of the world: terse, slightly cold, in [brackets]. The hero woke up in this city with a status window.
export const SYSTEM = {
  intro: '[Status window unlocked] You woke up in Hollowmere with a name you remember and a city you do not. The dead walk. A bus full of strangers calls you boss. Hold the town.',
};

// The first gift: one of three, before day 1 starts
export const GIFT = {
  title: 'The System offers a starting gift',
  eyebrow: '[Choose one]',
  scene: 'Blue light folds out of the air in front of you, like a window in a game you never played. Three lines blink, waiting.',
  choices: [
    { id: 'lantern', label: 'Lantern of Dawn', hint: 'Your hero hits 15% harder and sees further at night.', fx: [{ op: 'perk', key: 'heroDmgMult', mul: 1.15 }, { op: 'title', id: 'lantern' }] },
    { id: 'boots', label: 'Quiet Boots', hint: 'The town draws 15% less heat. The dead notice you later.', fx: [{ op: 'flag', key: 'quiet' }, { op: 'title', id: 'quiet' }] },
    { id: 'will', label: 'Iron Will', hint: 'The keep has 30 more health, and so do you (+8).', fx: [{ op: 'perk', key: 'keepHp', add: 30 }, { op: 'perk', key: 'heroHp', add: 8 }, { op: 'title', id: 'will' }] },
  ],
};

// Titles: earned by deeds, shown as System windows, each with a small edge
export const TITLES = {
  lantern: { name: 'Lantern-Bearer', desc: 'Chose the light.' },
  quiet: { name: 'Soft-Step', desc: 'Chose silence.' },
  will: { name: 'Unbroken', desc: 'Chose to endure.' },
  firstLight: { name: 'First Light', desc: 'Held the town through its first night. +10 keep health.', fx: [{ op: 'perk', key: 'keepHp', add: 10 }] },
  gravedigger: { name: 'Gravedigger', desc: 'Put down 150 dead. +0.5 hero damage.', fx: [{ op: 'perk', key: 'heroDmg', add: 0.5 }] },
  hivebreaker: { name: 'Hive-Breaker', desc: 'Burned a hive. Towers +5% damage.', fx: [{ op: 'perk', key: 'towerDmg', add: 0.05 }] },
  pathfinder: { name: 'Pathfinder', desc: 'Opened three districts. +1 pair of hands.', fx: [{ op: 'hands', n: 1 }] },
  lamplighter: { name: 'Lamplighter', desc: 'Brought the grid back. +2 power.', fx: [{ op: 'power', n: 2 }] },
  shepherd: { name: 'Shepherd of the Quiet', desc: 'Named one of the dead.' },
  warden: { name: 'Warden of the Young', desc: 'Brought the children home. +1 food each dawn from their garden.', fx: [{ op: 'flag', key: 'garden' }] },
  ironGrid: { name: 'Iron Grid', desc: 'Lived through a blackout.' },
  loud: { name: 'The Loudest Town', desc: 'A hive burst because of you, and you lived.' },
  uniqueSlayer: { name: 'Light-Breaker', desc: 'Killed a unique monster. +15% hero damage.', fx: [{ op: 'perk', key: 'heroDmgMult', mul: 1.15 }] },
};

// Calls to open a district: framed by why you would go. Options are built from the frontier.
export const DISTRICT_CALL = {
  title: 'Beyond the fence',
  eyebrow: '[New route]',
  scene: 'Your scouts are back from the quarantine fence. They point at the map. One route can be cut open today: the others stay sealed for now.',
  later: { id: 'later', label: 'Not yet', hint: 'Keep the fences shut today. Your scouts help with the building instead (+1 pair of hands today).', fx: [{ op: 'handsToday', n: 1 }] },
};

// What you find when you first walk up to a district's site. Claim = the building's bonus for good.
export const SITES = {
  default: {
    scene: 'The doors give. Inside it is dark, dry, and nobody has been here since it fell.',
    claim: 'Make it ours', strip: 'Strip it for scrap', leave: 'Not now',
  },
  flats: { scene: 'Stairwell barricades, fourteen floors up. A family of five and two old men, out of water, still alive.', claim: 'Bring them home and hold the block', strip: 'Take the water tanks and go' },
  allotment: { scene: 'Rows of beans and potatoes under nets. A hand-painted sign: TAKE WHAT YOU NEED. LEAVE WHAT YOU CAN.', claim: 'Fence it and farm it', strip: 'Harvest it all now' },
  market: { scene: 'The shutters roll up on rows of shops nobody looted. Tins, tools, batteries, a pharmacy behind glass.', claim: 'Run it as a market', strip: 'Take everything now' },
  police: { scene: 'The armory door held. Rifles in racks, a few boxes of rounds, and a duty log that stops on the night the city fell.', claim: 'Arm the towers from here', strip: 'Sell the guns for scrap' },
  clinic: { scene: 'Clean beds. A nurse with a fire axe and very tired eyes. "If you are bitten, say so now."', claim: 'Make it the town clinic', strip: 'Take the medicine and go' },
  substation: { scene: 'Transformers humming under a tarp. Someone kept this alive. A note taped to the panel: "DON\'T FLIP THE RED ONE."', claim: 'Bring the grid back', strip: 'Pull the copper for scrap' },
  fuel: { scene: 'The tanks are half full. The pumps still work, and they are loud: every dead in the district will hear them run.', claim: 'Run the depot', strip: 'Drain what you can carry' },
  school: { scene: 'Desks stacked at the doors. Behind them, eleven children and a teacher holding a broom like a spear.', claim: 'Take them all in', strip: 'Leave them food and go' },
  radio: { scene: 'The studio light is red: ON AIR. The loop has been playing for weeks. The microphone is still warm.', claim: 'Take over the broadcast', strip: 'Pull the transmitter for parts' },
};

// Threads: stories that come back. Each stage is one encounter; `when` decides when it can show.
// stage.at: 'dawn' (on a dawn after `after` days) or 'site' (when the hero reaches the thread's site).
export const THREADS = {
  channel9: {
    title: 'The Voice on Channel 9',
    cast: { engineer: { role: 'engineer', names: ['Mara Voss', 'Lena Brandt', 'Sofia Reyes', 'Ada Kowal'], epithet: 'the Wire Witch', persona: { traits: ['blunt', 'restless', 'proud'], quirk: 'counts in volts when she is nervous', want: 'to see the city lights come back', fear: 'the dark under the city' }, secret: 'She opened the metro gates the night the city fell, to let people shelter. The dead came up instead.' } },
    start: { day: 2 },
    stages: [
      {
        id: 'signal', at: 'dawn', eyebrow: '[Signal intercepted]', title: 'Static on Channel 9',
        scene: 'The keep\'s old radio coughs at dawn. A woman\'s voice, close to the mic: "...anyone on this band... I can get the grid up. I just can\'t get out. Substation. They\'re at the doors..."',
        choices: [
          { id: 'answer', label: 'Answer her', hint: 'Cut a way to her district today. The radio burst is loud: +10 heat.', fx: [{ op: 'heat', n: 10 }, { op: 'openFor', kit: 'substation' }, { op: 'advance' }] },
          { id: 'triangulate', label: 'Triangulate quietly', hint: 'Costs 4 scrap in batteries, no noise. Opens her district.', cost: { gold: 4 }, fx: [{ op: 'openFor', kit: 'substation' }, { op: 'advance' }] },
          { id: 'ignore', label: 'Turn it off', hint: 'The town is not ready. She may not last.', fx: [{ op: 'fail', after: 3 }] },
        ],
      },
      {
        id: 'rescue', at: 'site', eyebrow: '[Quest: The Voice on Channel 9]', title: 'The control room',
        speaker: 'engineer', line: '"You came. You actually came. Mind the red switch."',
        scene: 'Steel door, scratch marks waist-high. Behind it a woman with grease to the elbows and a crowbar, sitting on a crate of fuses. She has been counting the days on the wall in volts.',
        choices: [
          { id: 'bring', label: 'Bring her home', hint: '{name} joins as your engineer: +3 power while she lives. The substation is yours to claim.', fx: [{ op: 'recruit', role: 'engineer' }, { op: 'advance' }] },
          { id: 'trade', label: 'Ask her to stay and keep the grid', hint: 'She stays here: claim the substation for free, but she does not join you.', fx: [{ op: 'claimHere' }, { op: 'resolve' }] },
        ],
      },
      {
        id: 'secret', at: 'dawn', after: 2, eyebrow: '[Quest updated]', title: 'What {name} opened',
        speaker: 'engineer', line: '"The metro gates. It was me. I thought people could hide down there."',
        scene: '{name} finds you before sunrise, wiring half-finished in her hands. She talks fast, like if she stops she won\'t finish. The night the city fell she opened the metro gates for shelter. The dead came up the stairs instead.',
        choices: [
          { id: 'forgive', label: 'Tell her it was not her fault', hint: '+1 bond. She rigs searchlights on the keep: +2 power for good.', fx: [{ op: 'bond', role: 'engineer', n: 1 }, { op: 'power', n: 2 }, { op: 'title', id: 'lamplighter' }, { op: 'resolve' }] },
          { id: 'work', label: 'Then she works it off', hint: 'She runs the generators day and night: +4 power, but -1 bond.', fx: [{ op: 'bond', role: 'engineer', n: -1 }, { op: 'power', n: 4 }, { op: 'resolve' }] },
          { id: 'exile', label: 'Send her away', hint: 'She leaves with what she built. You lose her (-3 power) and gain 12 scrap.', fx: [{ op: 'lose', role: 'engineer' }, { op: 'gold', n: 12 }, { op: 'resolve' }] },
        ],
      },
    ],
  },
  hummer: {
    title: 'The One Who Hums',
    cast: { revenant: { role: 'revenant', names: ['The Hummer'], epithet: 'one of the dead', persona: { traits: ['silent', 'gentle', 'watchful'], quirk: 'hums the same four notes', want: 'to remember its own name', fear: 'fire' }, secret: 'It was the bandleader at the old concert hall. The four notes are the first bar of its last song.' } },
    start: { day: 3 },
    stages: [
      {
        id: 'sighting', at: 'dawn', eyebrow: '[Anomaly detected: infected, non-hostile?]', title: 'The one who hums',
        scene: 'At the fence line stands one of the dead. It does not reach for anyone. It sways, and it hums: four notes, over and over. The walkers near it have stopped moving.',
        choices: [
          { id: 'cage', label: 'Cage it at the keep', hint: 'It eats 1 food a dawn. The dead slow down near it. Something might come of this.', fx: [{ op: 'flag', key: 'caged' }, { op: 'advance' }] },
          { id: 'kill', label: 'Put it down', hint: 'Clean and safe. +0.5 hero damage from the lesson.', fx: [{ op: 'perk', key: 'heroDmg', add: 0.5 }, { op: 'fail' }] },
          { id: 'watch', label: 'Leave it be', hint: 'It wanders off. Maybe it comes back.', fx: [{ op: 'fail' }] },
        ],
      },
      {
        id: 'cure', at: 'dawn', after: 2, eyebrow: '[Quest: The One Who Hums]', title: 'Four notes',
        scene: 'Two nights in the cage. When the dead come, the ones nearest it slow, as if listening. Its eyes follow you. The clinic could try to bring something back, or you could let it go.',
        choices: [
          { id: 'cure', label: 'Try to bring it back', hint: 'Costs 6 food and 6 scrap (half with a clinic). It joins you as a Revenant: the dead slow near the keep.', cost: { gold: 6, food: 6 }, clinicHalf: true, fx: [{ op: 'recruit', role: 'revenant' }, { op: 'advance' }] },
          { id: 'release', label: 'Open the cage', hint: 'It walks into the city, humming. Some day you may hear it again.', fx: [{ op: 'gold', n: 3 }, { op: 'fail' }] },
        ],
      },
      {
        id: 'name', at: 'dawn', after: 1, eyebrow: '[Naming]', title: 'A name for the quiet one',
        speaker: 'revenant', line: '(four notes, softer now)',
        scene: 'It sits by the fire with the others now, not quite one of them. A child asks what it is called. Everyone looks at you. [Naming a monster binds it to you. It will grow stronger. You will feel the cost tonight.]',
        choices: [
          { id: 'name', label: 'Give it a name', hint: 'It evolves into a Named Revenant: the dead slow much more near the keep. Tonight your hero is drained: -25% damage.', fx: [{ op: 'name', role: 'revenant' }, { op: 'title', id: 'shepherd' }, { op: 'resolve' }] },
          { id: 'noname', label: 'Some things should stay nameless', hint: 'It stays as it is.', fx: [{ op: 'resolve' }] },
        ],
      },
    ],
  },
  school: {
    title: 'Drawings on the Glass',
    cast: { teacher: { role: 'teacher', names: ['Ines Moreau', 'Clara Weiss', 'Beatriz Lima', 'Hanna Sund'], epithet: 'the Teacher', persona: { traits: ['calm', 'stubborn', 'dry-humoured'], quirk: 'corrects everyone\'s grammar, even now', want: 'every child fed and counted', fear: 'losing count' }, secret: 'One of the children is bitten. She has been hiding it for four days.' } },
    start: { day: 4 },
    stages: [
      {
        id: 'drawings', at: 'dawn', eyebrow: '[Signal: children]', title: 'Drawings on the glass',
        scene: 'From the water tower your lookout swears there are new drawings in the school windows two blocks out. Suns, houses, a big orange flag. Your flag.',
        choices: [
          { id: 'go', label: 'Cut a way to the school', hint: 'Opens its district today. Go there yourself.', fx: [{ op: 'openFor', kit: 'school' }, { op: 'advance' }] },
          { id: 'wait', label: 'We cannot feed more mouths', hint: 'Not now. The drawings will stop someday.', fx: [{ op: 'fail', after: 4 }] },
        ],
      },
      {
        id: 'rescue', at: 'site', eyebrow: '[Quest: Drawings on the Glass]', title: 'Eleven and a teacher',
        speaker: 'teacher', line: '"Single file. Nobody runs. Nobody screams. We practiced this."',
        scene: 'The teacher holds a broom like a spear and counts the children twice before she lets you in. They are thin, and very quiet, and every one of them has a drawing of your flag.',
        choices: [
          { id: 'all', label: 'Everyone comes home', hint: '+5 people and {name} joins (+1 pair of hands). -6 food now.', cost: { food: 6 }, fx: [{ op: 'food', n: -6 }, { op: 'survivors', n: 5 }, { op: 'recruit', role: 'teacher' }, { op: 'title', id: 'warden' }, { op: 'advance' }] },
          { id: 'few', label: 'The teacher and the oldest', hint: '+2 people and {name} joins. The rest stay with food you leave (-3 food).', fx: [{ op: 'food', n: -3 }, { op: 'survivors', n: 2 }, { op: 'recruit', role: 'teacher' }, { op: 'advance' }] },
        ],
      },
      {
        id: 'bitten', at: 'dawn', after: 2, eyebrow: '[Warning: infection]', title: 'What {name} hid',
        speaker: 'teacher', line: '"He is eight. He has a fever. That is all it is. That is all it is."',
        scene: '{name} meets you away from the fire. One of the boys was bitten four days ago. She kept it secret. He is burning up now, and the others sleep next to him.',
        choices: [
          { id: 'treat', label: 'Treat him', hint: 'Costs 8 scrap (free with a clinic). He lives. +1 bond.', cost: { gold: 8 }, clinicFree: true, fx: [{ op: 'bond', role: 'teacher', n: 1 }, { op: 'resolve' }] },
          { id: 'isolate', label: 'Isolate him and wait', hint: 'A coin toss. If he turns, a house falls tonight.', fx: [{ op: 'gamble', p: 0.5, bad: [{ op: 'risen', n: 3 }, { op: 'bond', role: 'teacher', n: -1 }] }, { op: 'resolve' }] },
          { id: 'mercy', label: 'Do what has to be done', hint: 'Nobody else gets bitten. {name} will never forgive you (-2 bond).', fx: [{ op: 'bond', role: 'teacher', n: -2 }, { op: 'resolve' }] },
        ],
      },
    ],
  },
};

// The unique monsters: each run's blood moons bring one with a name and a story. Kill it for a legendary blessing.
THREADS.lantern = {
  title: 'The Lantern-Eater',
  cast: {},
  start: { day: 5 },
  stages: [
    {
      id: 'sighting', at: 'dawn', eyebrow: '[Unique Monster sighted: The Lantern-Eater]', title: 'Something eats the light',
      scene: 'Last night the lamp on the north corner went out. Then the next one, and the next, a line of darkness walking toward the keep. In the morning the bulbs are gone, and so are the poles. Tonight is a blood moon. [There is only one of it in the whole world.]',
      choices: [
        { id: 'bait', label: 'Light every lamp and draw it in', hint: 'It walks into your towers tonight instead of a guardian: tougher, slower, worth a legendary blessing and a title. +15 heat.', fx: [{ op: 'heat', n: 15 }, { op: 'unique', name: 'The Lantern-Eater', mult: 1.7 }, { op: 'advance' }] },
        { id: 'dark', label: 'Douse the lights and hide', hint: 'Tonight is a normal blood moon. It will come back, angrier, on the next one.', fx: [{ op: 'unique', name: 'The Lantern-Eater', mult: 2.2, later: 5 }, { op: 'advance' }] },
      ],
    },
    {
      id: 'aftermath', at: 'dawn', after: 1, needs: 'uniqueDone', eyebrow: '[Unique Monster slain: The Lantern-Eater]', title: 'The thing on the street',
      scene: 'In daylight it is smaller than it looked, and somehow sadder: a tangle of cables and bulbs grown into something that was a man. Your people stand around it and nobody speaks.',
      choices: [
        { id: 'skull', label: 'Mount its lamp-skull on the keep', hint: 'Towers +10% damage for good. The dead fear the light now.', fx: [{ op: 'perk', key: 'towerDmg', add: 0.1 }, { op: 'resolve' }] },
        { id: 'burn', label: 'Burn it in the square', hint: 'Heat -25 and +1 food every dawn: people sleep better.', fx: [{ op: 'heat', n: -25 }, { op: 'flag', key: 'garden' }, { op: 'resolve' }] },
      ],
    },
  ],
};

// A faction: people are dangerous too
THREADS.toll = {
  title: 'The Bridge Crew',
  cast: { boss: { role: 'raider', names: ['Dario Kent', 'Mags Okoro', 'Viktor Hale', 'Rosa Quint'], epithet: 'the Toll-Keeper', persona: { traits: ['charming', 'greedy', 'loyal to their own'], quirk: 'flips a coin before every answer', want: 'their crew fed through winter', fear: 'being the last one left' }, secret: 'Their crew is half the size they claim. They are starving too.' } },
  start: { day: 7 },
  stages: [
    {
      id: 'demand', at: 'dawn', eyebrow: '[Faction encountered: The Bridge Crew]', title: 'A toll for the road',
      speaker: 'boss', line: '"Heads, you pay and we keep the dead off your west road. Tails, we ring every bell in the city."',
      scene: 'Six of them at your fence at sunrise, armed, clean, rested. Their leader flips a coin and catches it without looking. They want scrap to keep the west road quiet.',
      choices: [
        { id: 'pay', label: 'Pay the toll', hint: '-10 scrap. Quiet roads (heat -10 now), and they remember you kept your word.', cost: { gold: 10 }, fx: [{ op: 'heat', n: -10 }, { op: 'flag', key: 'paid' }, { op: 'advance' }] },
        { id: 'refuse', label: 'Tell them to try it', hint: 'They ring the bells: +25 heat now. They will be back.', fx: [{ op: 'heat', n: 25 }, { op: 'flag', key: 'refused' }, { op: 'advance' }] },
        { id: 'offer', label: 'Offer them a place instead', hint: '-6 food. If they say yes, their guns are yours. Their leader decides in two days.', cost: { food: 6 }, fx: [{ op: 'flag', key: 'offered' }, { op: 'advance' }] },
      ],
    },
    {
      id: 'answer', at: 'dawn', after: 2, eyebrow: '[Quest: The Bridge Crew]', title: 'The coin comes down',
      speaker: 'boss', line: '"I flipped it. I didn\'t look. I\'m asking you instead."',
      scene: 'They are back, fewer than before. The leader admits it: half their crew is gone, the rest are hungry. They do not want to be the last ones left out there.',
      choices: [
        { id: 'join', label: 'Bring the crew in', hint: '{name} joins as captain of the watch (towers +10%), +3 people. -4 food.', fx: [{ op: 'food', n: -4 }, { op: 'survivors', n: 3 }, { op: 'recruit', role: 'boss' }, { op: 'resolve' }] },
        { id: 'trade', label: 'Trade, but keep the fence shut', hint: 'They sell you salvage: +14 scrap now, and they go.', fx: [{ op: 'gold', n: 14 }, { op: 'resolve' }] },
        { id: 'away', label: 'Send them on', hint: 'They leave the city. Nothing changes.', fx: [{ op: 'resolve' }] },
      ],
    },
  ],
};

// Small moments: one-shot storylets that fill quiet dawns. `when` must hold; each happens once per run.
export const AMBIENT = [
  { id: 'dog', when: S => S.night >= 3, eyebrow: '[Event]', title: 'A dog at the gate',
    scene: 'A grey dog has followed you home from the ruins: ribs showing, one ear torn, tail going like mad. It will not leave the gate.',
    choices: [{ id: 'keep', label: 'Let it in', hint: 'It barks when the dead come close: your hero moves 8% faster and the town sleeps better (+1 food each dawn).', fx: [{ op: 'perk', key: 'heroSpeed', mul: 1.08 }, { op: 'flag', key: 'garden' }] }, { id: 'shoo', label: 'Shoo it away', hint: 'One more mouth is one too many.', fx: [] }] },
  { id: 'flag', when: S => S.night >= 4, eyebrow: '[Event]', title: 'Your flag on the overpass',
    scene: 'Someone painted your orange flag on the motorway overpass, three metres tall. It can be seen for miles. So can you.',
    choices: [{ id: 'leave', label: 'Leave it: let them find us', hint: '+2 people at the next dawn. +10 heat.', fx: [{ op: 'heat', n: 10 }, { op: 'flag', key: 'beacon' }] }, { id: 'paint', label: 'Paint over it', hint: 'Heat -10.', fx: [{ op: 'heat', n: -10 }] }] },
  { id: 'fever', when: S => S.night >= 4, eyebrow: '[Warning]', title: 'Fever in the bunks',
    scene: 'Four of your people are coughing and burning up. Not bitten: just sick, the ordinary kind that used to be nothing.',
    choices: [{ id: 'care', label: 'Nurse them', hint: '-5 food. Everyone pulls through.', cost: { food: 5 }, fx: [{ op: 'food', n: -5 }] }, { id: 'rest', label: 'Let them rest and hope', hint: 'One of them does not make it (-1 person). The rest are weak: -1 pair of hands today.', fx: [{ op: 'survivors', n: -1 }, { op: 'handsToday', n: -1 }] }] },
  { id: 'wedding', when: S => S.night >= 6, eyebrow: '[Event]', title: 'A wedding at the keep',
    scene: 'Two of your people want to get married on the keep steps, tonight, before the bell. Someone found a suit. Someone found a cake, somehow.',
    choices: [{ id: 'yes', label: 'Hold the wedding', hint: '-4 food. Everyone works harder: +2 pairs of hands today.', cost: { food: 4 }, fx: [{ op: 'food', n: -4 }, { op: 'handsToday', n: 2 }] }, { id: 'no', label: 'Not now. Maybe after the war', hint: 'Nothing changes.', fx: [] }] },
  { id: 'thief', when: S => S.buildings.some(b => b.type === 'generator'), eyebrow: '[Event]', title: 'Diesel thief',
    scene: 'Somebody has been siphoning the generator at night. Tonight you catch her: a girl, maybe fifteen, with a jerrycan bigger than she is.',
    choices: [{ id: 'hire', label: 'Put her to work on the generator', hint: '+1 person and +1 power.', fx: [{ op: 'survivors', n: 1 }, { op: 'power', n: 1 }] }, { id: 'chase', label: 'Chase her off', hint: 'She runs, yelling. +8 heat.', fx: [{ op: 'heat', n: 8 }] }] },
  { id: 'window', when: S => S.night >= 8, eyebrow: '[Hidden scenario discovered]', title: 'A quest you never accepted',
    scene: '[Quest: Find the clock that runs backwards. Recommended level: 40.] The window will not close. Somewhere in this city a clock runs the wrong way, and the System wants you to find it.',
    choices: [{ id: 'accept', label: '[Accept]', hint: 'A rare blessing now. The System will remember.', fx: [{ op: 'blessing' }, { op: 'flag', key: 'clockQuest' }] }, { id: 'decline', label: '[Decline]', hint: 'The window flickers and goes away. For now.', fx: [] }] },
];

// Companion roles: what they give while they live, and what they can do at your side
export const ROLES = {
  engineer: { post: 'Engineer', bonus: '+3 power', power: 3 },
  teacher: { post: 'Quartermaster', bonus: '+1 pair of hands every day', hands: 1 },
  revenant: { post: 'Revenant', bonus: 'the dead slow near the keep', lullaby: 0.8 },
  raider: { post: 'Captain of the Watch', bonus: 'towers +10% damage', towers: 0.1 },
};

// Offline chat: what companions say when Claude is not connected (topic buttons)
export const BARKS = {
  self: ['"{want}. That is all I want."', '"Ask me again when the sun is up."', '"You want the truth? {fear}. Every night."'],
  city: ['"{district} was quiet last night. Too quiet."', '"The heat is at {heat}. They can hear us."', '"We have {pop} people now. I remember when it was three."'],
  you: ['"You walk like someone who has done this before. Have you?"', '"I trust you. Mostly."', '"You talk to that blue window when you think nobody is looking."'],
};

// One new idea at a time: System tips that appear the first time something matters
export const TIPS = [
  { id: 'hands', when: (S, g) => S.handsUsed > 0, text: '[Tip: Hands] Every build or upgrade takes a free pair of hands for the day. More people, more hands. They rest at dawn.' },
  { id: 'night', when: S => S.phase === 'night' && S.night === 1, text: '[Tip: The first night] Something is coming from the dark. Your towers shoot on their own; you can fight too.' },
  { id: 'heat', when: S => S.heat >= 30, text: '[Tip: Heat] Your town makes noise: people, guns, generators. Past the first mark the dead drift in; at the red mark a hive bursts.' },
  { id: 'power', when: (S, g) => g.powerOut() > 0, text: '[Tip: Power] Upgraded towers and tech need power. Short of it, they all switch off. Generators are loud; substations out in the city are quiet.' },
  { id: 'stream', when: S => S.mobs.some(m => m.stream !== undefined && !m.roam), text: '[Tip: The stream] Awake hives never stop sending their dead, day or night. Burn a hive to stop it, but hitting one makes it rage.' },
  { id: 'street', when: S => S.story.spots.length > 0 && S.phase === 'day', text: '[Tip: Encounters] Blue beacons in the open districts are people and places worth a look. A few dead guard each one.' },
  { id: 'district', when: S => S.story.quests.length > 0, text: '[Tip: Quests] A blue arrow points to your quest. Walk there yourself: the town will hold for a while.' },
  { id: 'evolve', when: S => S.P.fam.hero + S.P.fam.ranger + S.P.fam.scavver >= 1, text: '[Tip: Evolution] Two blessings of one hero family (Brawn, Aim, Wits) unlock its Calling. A second family later makes your final class.' },
  { id: 'foreman', when: S => S.foreman, text: '[Tip: Foreman] Your people now build on their own. Set their focus in the build menu, or turn on Auto in the ⋯ menu and just make the big choices.' },
];

// Out in the open districts: people and places you stumble on. A marker appears; walk there to see what it is.
// They are guarded by a few dead. Each happens once per run; the Chronicler rewrites them to fit your story.
export const STREET = [
  { id: 'carroof', eyebrow: '[Survivor detected]', title: 'On the roof of a bus',
    scene: 'A man in a delivery uniform on the roof of a burnt-out bus, the dead you just cut down still under him. He has been up there two days. He has a crowbar and a very dry throat.',
    choices: [{ id: 'take', label: 'Bring him home', hint: '+1 person. He knows the streets: the next route your scouts offer shows one more option.', fx: [{ op: 'survivors', n: 1 }, { op: 'flag', key: 'scout' }] }, { id: 'water', label: 'Give him water and directions', hint: '-2 food. He goes his own way, and tells others about you (+8 heat, +1 person at dawn).', fx: [{ op: 'food', n: -2 }, { op: 'heat', n: 8 }, { op: 'flag', key: 'beacon' }] }] },
  { id: 'pharmacy', eyebrow: '[Location discovered]', title: 'The pharmacy with the shutter down',
    scene: 'The shutter is jammed half-open. Inside: shelves mostly bare, but the back room is locked, and something behind the door is breathing.',
    choices: [{ id: 'open', label: 'Force the door', hint: 'A coin toss: +12 scrap of medicine, or a dead that was a pharmacist (your hero takes a hit).', fx: [{ op: 'gamble', p: 0.5, good: [{ op: 'gold', n: 12 }], bad: [{ op: 'hurt', n: 10 }, { op: 'gold', n: 4 }] }] }, { id: 'front', label: 'Take what is out front', hint: '+5 scrap, no risk.', fx: [{ op: 'gold', n: 5 }] }] },
  { id: 'radio', eyebrow: '[Signal]', title: 'A walkie-talkie in a dead hand',
    scene: 'It crackles as you pick it up. A child\'s voice, calm, practised: "Base, this is Sparrow. Still nobody. Over." Then silence.',
    choices: [{ id: 'answer', label: 'Answer Sparrow', hint: 'Sparrow and two others find their way to you over the next dawns (+3 people). +10 heat.', fx: [{ op: 'heat', n: 10 }, { op: 'survivors', n: 3 }] }, { id: 'keep', label: 'Keep it and listen', hint: 'You learn their patrol routes: +1 pair of hands for good.', fx: [{ op: 'hands', n: 1 }] }] },
  { id: 'church', eyebrow: '[Location discovered]', title: 'Candles in the chapel',
    scene: 'Fresh candles on the altar of a tiny chapel, and forty names written on the wall in marker. The last one is dated yesterday.',
    choices: [{ id: 'add', label: 'Add the names of your dead', hint: 'Your people take heart: heat -15 and +1 food each dawn.', fx: [{ op: 'heat', n: -15 }, { op: 'flag', key: 'garden' }] }, { id: 'take', label: 'Take the candles', hint: '+4 scrap. Light is light.', fx: [{ op: 'gold', n: 4 }] }] },
  { id: 'market', eyebrow: '[Encounter]', title: 'A trader with a shopping trolley',
    scene: 'An old woman pushing a trolley full of tins and batteries, a rifle laid across the top. "I trade. I don\'t give. What have you got?"',
    choices: [{ id: 'food', label: 'Scrap for food', hint: '-6 scrap, +8 food.', cost: { gold: 6 }, fx: [{ op: 'gold', n: -6 }, { op: 'food', n: 8 }] }, { id: 'tip', label: 'Ask what she has seen', hint: 'Free. She tells you where a hive is weak: your hero deals +15% damage to hives.', fx: [{ op: 'flag', key: 'hiveTip' }] }] },
  { id: 'dog2', eyebrow: '[Encounter]', title: 'The dog that guards a door',
    scene: 'A big dog, ribs showing, guarding a basement door. It growls at you, then at the dead, then at you again. Someone is behind that door.',
    choices: [{ id: 'food', label: 'Throw it some food', hint: '-2 food. The dog lets you in: a family of three comes home with you (+3 people).', cost: { food: 2 }, fx: [{ op: 'food', n: -2 }, { op: 'survivors', n: 3 }] }, { id: 'leave', label: 'Leave them be', hint: 'Not everyone wants to be found.', fx: [] }] },
  { id: 'cache', eyebrow: '[Location discovered]', title: 'A prepper\'s cache',
    scene: 'A hatch under a skip, padlocked from the inside. Somebody planned for this. Somebody did not make it back to use it.',
    choices: [{ id: 'all', label: 'Take everything', hint: '+10 scrap, +5 food.', fx: [{ op: 'gold', n: 10 }, { op: 'food', n: 5 }] }, { id: 'half', label: 'Take half, leave a note', hint: '+5 scrap. Whoever finds the rest may come looking for the writer (+1 person at dawn).', fx: [{ op: 'gold', n: 5 }, { op: 'flag', key: 'beacon' }] }] },
  { id: 'statue', eyebrow: '[Hidden scenario]', title: 'The statue that turned its head',
    scene: 'A bronze statue in the square, a general on a horse. You are sure its head faced north this morning. [Something in the System hums. A blessing is near.]',
    choices: [{ id: 'touch', label: 'Touch the plinth', hint: 'A rare blessing at once.', fx: [{ op: 'blessing' }] }, { id: 'walk', label: 'Walk on, fast', hint: 'Some windows are better left closed.', fx: [] }] },
];
