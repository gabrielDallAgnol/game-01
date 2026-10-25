// The story layer: encounters with choices. The engine owns every effect; text here is the offline
// version (Claude can rewrite the words of any encounter, never its effects).
// Effects ({ op, ... }) are applied by src/sim/story.js. Costs are checked before a choice is allowed.

// The voice of the world: the Thermal Pioneer System. Terse, a little dry, in [brackets]. The hero absorbed the Solar Flare's
// charge and the System woke (the opening cards tell it; see content/solar.js).
export const SYSTEM = {
  intro: 'You **survived** night one. Pick a **gift** for it.',
  // night 1, hand-authored: the System speaks up when the first of the Ash-Born reaches you (Solo Leveling, episode 2)
  dayOne: 'Light the fire. **The heat draws them at dusk.**',
  arrival: ['[Thermal Pioneer System · online]', 'Pioneer · Lv 1 · HP {hp}', '[Skill acquired: Shove]', 'Push the Ash-Born back. Tap the round button.', '[Quest] Survive the night. A **gift** waits at dawn.'],
  arrivalTitle: 'The Thermal Pioneer System',
  firstLight: '[Title acquired: First Light]',
};

// The first gift: offered inside the System's arrival window on night one
export const GIFT = {
  title: 'Pick a gift',
  eyebrow: '[Reward: first night survived]',
  scene: 'You held the first night. One gift, **yours for good**.',
  choices: [
    { id: 'lantern', label: 'The Lantern of Dawn', hint: 'You hit 15% harder.', fx: [{ op: 'perk', key: 'heroDmgMult', mul: 1.15 }, { op: 'title', id: 'lantern' }] },
    { id: 'boots', label: 'The Quiet Boots', hint: 'The Ash-Born notice you later. A quieter Haven.', fx: [{ op: 'flag', key: 'quiet' }, { op: 'title', id: 'quiet' }] },
    { id: 'will', label: 'An Iron Will', hint: '+8 health for you. +30 for the Haven.', fx: [{ op: 'perk', key: 'keepHp', add: 30 }, { op: 'perk', key: 'heroHp', add: 8 }, { op: 'title', id: 'will' }] },
  ],
};

// Titles: earned by deeds, announced by the System. Flavour only: a title is a name the world calls you, never a stat.
export const TITLES = {
  lantern: { name: 'Lantern-Bearer', desc: 'Chose the light.' },
  quiet: { name: 'Soft-Step', desc: 'Chose silence.' },
  will: { name: 'Unbroken', desc: 'Chose to endure.' },
  firstLight: { name: 'First Light', desc: 'The first to see the window.' },
  gravedigger: { name: 'Gravedigger', desc: 'Put down 150 of the Ash-Born.' },
  hivebreaker: { name: 'Hive-Breaker', desc: 'Burned an Inferno Nest.' },
  pathfinder: { name: 'Pathfinder', desc: 'Walked into three districts.' },
  lamplighter: { name: 'Lamplighter', desc: 'Forgave the one who opened the gates.' },
  shepherd: { name: 'Shepherd of the Quiet', desc: 'Named one of the Ash-Born.' },
  warden: { name: 'Warden of the Young', desc: 'Brought every child home.' },
  ironGrid: { name: 'Iron Grid', desc: 'Survived a blackout.' },
  loud: { name: 'The Loudest Haven', desc: 'Burst an Inferno Nest. Lived anyway.' },
  called: { name: 'The Called', desc: 'Passed a Calling trial.' },
  ascended: { name: 'Ascended', desc: 'Passed the final trial.' },
  uniqueSlayer: { name: 'Light-Breaker', desc: 'Killed a monster with a name.' },
  diligent: { name: 'The Diligent', desc: 'Finished seven daily quests.' },
  penitent: { name: 'Penitent', desc: 'Paid off a penalty quest.' },
  contractor: { name: 'Contract-Keeper', desc: 'Won a season\'s contract.' },
};

// Calls to open a district: framed by why you would go. Options are built from the frontier.
export const DISTRICT_CALL = {
  title: 'Beyond the fence',
  eyebrow: '[New route]',
  scene: 'Pick **one route** to open today. Your scouts lead the way.',
  later: { id: 'later', label: 'Keep the fence shut', hint: 'No route today. +3 scrap.', fx: [{ op: 'gold', n: 3 }] },
};

// What you find when you first walk up to a district's site. Claim = the building's bonus for good.
export const SITES = {
  default: {
    scene: 'An empty building. **Claim it** for its bonus, or **strip it** for scrap.',
    claim: 'Make it ours', strip: 'Strip it for scrap', leave: 'Leave it for now',
  },
  flats: { scene: 'A family is trapped up here. **Out of water.** Take them in?', claim: 'Bring them to the Haven', strip: 'Take the water, go' },
  farmstead: { scene: 'A working farm, **abandoned this week**. Farm it, or take the stores.', claim: 'Work the fields', strip: 'Take the stores' },
  lumber: { scene: 'A lumber camp. **Timber and a saw**, nobody here.', claim: 'Run the camp', strip: 'Haul the timber home' },
  quarry: { scene: 'A quarry. A crew is **camped on the ledge**.', claim: 'Bring the crew in', strip: 'Take the tools' },
  lodge: { scene: 'A hunting lodge. **Snares, smoke racks**, a cold stove.', claim: 'Make it a hunting post', strip: 'Take the meat and traps' },
  cabin: { scene: 'A ranger cabin. Someone inside asks: **"Who sent you?"**', claim: 'Bring them to the Haven', strip: 'Take their supplies' },
  allotment: { scene: 'A garden with a sign: **TAKE WHAT YOU NEED.**', claim: 'Fence it and farm it', strip: 'Harvest it all now' },
  market: { scene: 'A market **nobody looted**. Tins, tools, a pharmacy.', claim: 'Run it as a market', strip: 'Take everything now' },
  police: { scene: 'A police station. **The armory is full.**', claim: 'Arm the towers', strip: 'Sell the guns for scrap' },
  clinic: { scene: 'A clinic with clean beds. The nurse asks: **"Bitten?"**', claim: 'Make it our clinic', strip: 'Take the medicine, go' },
  substation: { scene: 'A power substation, **still humming**. It can light the Haven.', claim: 'Bring the grid back', strip: 'Pull the copper' },
  fuel: { scene: 'A fuel depot, **half full**. The pumps are **loud**.', claim: 'Run the depot', strip: 'Drain what you can' },
  school: { scene: '**Eleven children** and a teacher, hiding behind desks.', claim: 'Take them all in', strip: 'Leave food and go' },
  radio: { scene: 'A radio station, **still on air**. The mic is warm.', claim: 'Take the broadcast', strip: 'Pull the transmitter' },
};

// Threads: stories that come back. Each stage is one encounter; `when` decides when it can show.
// stage.at: 'dawn' (on a dawn after `after` days) or 'site' (when the hero reaches the thread's site).
// `failed`: the card that closes the thread when it ends badly (a thread never ends without a card).
export const THREADS = {
  channel9: {
    title: 'The Voice on Channel 9',
    cast: { engineer: { role: 'engineer', names: ['Mara Voss', 'Lena Brandt', 'Sofia Reyes', 'Ada Kowal'], epithet: 'the Wire Witch', persona: { traits: ['blunt', 'restless', 'proud'], quirk: 'counts in volts when she is nervous', want: 'to see the city lights come back', fear: 'the dark under the city' }, secret: 'She opened the metro gates the night the city fell, to let people shelter. The Ash-Born came up instead.' } },
    start: { day: 7 },
    failed: { eyebrow: '[Quest failed]', title: 'Channel 9 goes quiet', scene: 'Channel 9 is **silent**. She didn\'t make it.', label: 'Turn the dial off' },
    stages: [
      {
        id: 'signal', at: 'dawn', eyebrow: '[Signal intercepted]', title: 'Static on Channel 9',
        scene: 'A woman on the radio is **trapped** at the substation. Help her?',
        choices: [
          { id: 'answer', label: 'Answer her', hint: 'A marker shows where she is. +10 noise.', fx: [{ op: 'heat', n: 10 }, { op: 'openFor', kit: 'substation' }, { op: 'advance' }] },
          { id: 'triangulate', label: 'Trace her quietly', hint: 'Costs 4 scrap. No noise. A marker shows where she is.', cost: { gold: 4 }, fx: [{ op: 'openFor', kit: 'substation' }, { op: 'advance' }] },
          { id: 'ignore', label: 'Turn it off', hint: 'The Haven isn\'t ready. She may not last.', fx: [{ op: 'fail', after: 3 }] },
        ],
      },
      {
        id: 'rescue', at: 'site', eyebrow: '[Quest: The Voice on Channel 9]', title: 'The control room',
        speaker: 'engineer', line: '"You actually came. Mind the **red switch**."',
        scene: 'You found her: an **engineer** with a crowbar. Bring her home?',
        choices: [
          { id: 'bring', label: 'Bring her to the Haven', hint: '{name} joins: she rigs lamps on your towers (+8% damage) while she lives.', fx: [{ op: 'recruit', role: 'engineer' }, { op: 'advance' }] },
          { id: 'trade', label: 'Ask her to stay', hint: 'She keeps this place running and gives it to you. She won\'t join.', fx: [{ op: 'claimHere' }, { op: 'resolve' }] },
        ],
      },
      {
        id: 'secret', at: 'dawn', after: 2, eyebrow: '[Quest updated]', title: 'What {name} opened',
        speaker: 'engineer', line: '"The metro gates. **It was me.** I wanted them to hide."',
        scene: '{name} confesses: she **opened the metro gates**. The Ash-Born came up.',
        choices: [
          { id: 'forgive', label: 'Forgive her', hint: '+1 bond. She lights the towers for good: +5% damage.', fx: [{ op: 'bond', role: 'engineer', n: 1 }, { op: 'perk', key: 'towerDmg', add: 0.05 }, { op: 'title', id: 'lamplighter' }, { op: 'resolve' }] },
          { id: 'work', label: 'Make her work it off', hint: 'Day and night at the lamps: towers +10% damage, but -1 bond.', fx: [{ op: 'bond', role: 'engineer', n: -1 }, { op: 'perk', key: 'towerDmg', add: 0.1 }, { op: 'resolve' }] },
          { id: 'exile', label: 'Send her away', hint: 'She leaves and takes her lamps. She pays you +12 scrap to go quietly.', fx: [{ op: 'lose', role: 'engineer' }, { op: 'gold', n: 12 }, { op: 'resolve' }] },
        ],
      },
    ],
  },
  hummer: {
    title: 'The One Who Hums',
    cast: { revenant: { role: 'revenant', names: ['The Hummer'], epithet: 'one of the Ash-Born', persona: { traits: ['silent', 'gentle', 'watchful'], quirk: 'hums the same four notes', want: 'to remember its own name', fear: 'fire' }, secret: 'It was the bandleader at the old concert hall. The four notes are the first bar of its last song.' } },
    start: { day: 12 },
    failed: { eyebrow: '[Quest closed]', title: 'Four notes, further away', scene: 'The humming one is **gone**. You still hear it, far off.', label: 'Let it go' },
    stages: [
      {
        id: 'sighting', at: 'dawn', eyebrow: '[Anomaly: infected, non-hostile?]', title: 'The one who hums',
        scene: 'One of the Ash-Born hums at the fence. It **doesn\'t attack**. What now?',
        choices: [
          { id: 'cage', label: 'Cage it at the Haven', hint: 'Eats 1 food a dawn. The Ash-Born slow near it. Something more?', fx: [{ op: 'flag', key: 'caged' }, { op: 'advance' }] },
          { id: 'kill', label: 'Put it down', hint: 'Safe. Lesson learned: +0.5 hero damage.', fx: [{ op: 'perk', key: 'heroDmg', add: 0.5 }, { op: 'fail', quiet: true }] },
          { id: 'watch', label: 'Leave it be', hint: 'It wanders off. Maybe it comes back.', fx: [{ op: 'fail' }] },
        ],
      },
      {
        id: 'cure', at: 'dawn', after: 2, eyebrow: '[Quest: The One Who Hums]', title: 'Four notes',
        scene: 'The caged one **slows the Ash-Born** near it. You could try to **cure** it.',
        choices: [
          { id: 'cure', label: 'Try to bring it back', hint: 'Costs 6 food, 6 scrap (half with a clinic). It joins: the Ash-Born slow near the Haven.', cost: { gold: 6, food: 6 }, clinicHalf: true, fx: [{ op: 'recruit', role: 'revenant' }, { op: 'advance' }] },
          { id: 'release', label: 'Open the cage', hint: 'It walks off, humming. +3 scrap from the cage.', fx: [{ op: 'gold', n: 3 }, { op: 'fail' }] },
        ],
      },
      {
        id: 'name', at: 'dawn', after: 1, eyebrow: '[Naming]', title: 'Name the quiet one',
        speaker: 'revenant', line: '(four notes, softer now)',
        scene: 'Give it a name? Named, it **gets stronger**. **Tonight you get weaker.**',
        choices: [
          { id: 'name', label: 'Give it a name', hint: 'It becomes a Named Revenant: the Ash-Born slow much more. Tonight: hero -25% damage.', fx: [{ op: 'name', role: 'revenant' }, { op: 'title', id: 'shepherd' }, { op: 'resolve' }] },
          { id: 'noname', label: 'Leave it nameless', hint: 'It stays as it is.', fx: [{ op: 'resolve' }] },
        ],
      },
    ],
  },
  school: {
    title: 'Drawings on the Glass',
    cast: { teacher: { role: 'teacher', names: ['Ines Moreau', 'Clara Weiss', 'Beatriz Lima', 'Hanna Sund'], epithet: 'the Teacher', persona: { traits: ['calm', 'stubborn', 'dry-humoured'], quirk: 'corrects everyone\'s grammar, even now', want: 'every child fed and counted', fear: 'losing count' }, secret: 'One of the children is bitten. She has been hiding it for four days.' } },
    start: { day: 4 },
    failed: { eyebrow: '[Quest failed]', title: 'The drawings stopped', scene: 'The drawings **stopped**. You waited too long.', label: 'Look away' },
    stages: [
      {
        id: 'drawings', at: 'dawn', eyebrow: '[Signal: children]', title: 'Drawings on the glass',
        scene: '**Children** are drawing your flag in a school window. Go get them?',
        choices: [
          { id: 'go', label: 'Go and get them', hint: 'A marker shows the school. Go yourself.', fx: [{ op: 'openFor', kit: 'school' }, { op: 'advance' }] },
          { id: 'wait', label: 'Refuse more mouths', hint: 'Not now. Someday the drawings will stop.', fx: [{ op: 'fail', after: 4 }] },
        ],
      },
      {
        id: 'rescue', at: 'site', eyebrow: '[Quest: Drawings on the Glass]', title: 'Eleven and a teacher',
        speaker: 'teacher', line: '"Single file. Nobody runs. **Nobody screams.** We practiced."',
        scene: '**Eleven children** and their teacher. How many can you feed?',
        choices: [
          { id: 'all', label: 'Bring everyone to the Haven', hint: '+5 people. {name} joins (+1 food a day). Their garden: +1 food a day. -6 food now.', cost: { food: 6 }, fx: [{ op: 'survivors', n: 5 }, { op: 'recruit', role: 'teacher' }, { op: 'flag', key: 'garden' }, { op: 'title', id: 'warden' }, { op: 'advance' }] },
          { id: 'few', label: 'Take teacher and oldest', hint: '+2 people. {name} joins. The rest stay: -3 food left for them.', fx: [{ op: 'food', n: -3 }, { op: 'survivors', n: 2 }, { op: 'recruit', role: 'teacher' }, { op: 'advance' }] },
        ],
      },
      {
        id: 'bitten', at: 'dawn', after: 2, eyebrow: '[Warning: infection]', title: 'What {name} hid',
        speaker: 'teacher', line: '"He\'s eight. It\'s a **fever**. That\'s all. That\'s all."',
        scene: '{name} hid it: a boy was **bitten**. He has a **fever** now.',
        choices: [
          { id: 'treat', label: 'Treat him', hint: 'Costs 8 scrap (free with a clinic). He lives. +1 bond.', cost: { gold: 8 }, clinicFree: true, fx: [{ op: 'bond', role: 'teacher', n: 1 }, { op: 'resolve' }] },
          { id: 'isolate', label: 'Isolate him and wait', hint: 'Coin toss. If he turns, a house falls tonight.', fx: [{ op: 'gamble', p: 0.5, bad: [{ op: 'risen', n: 3 }, { op: 'bond', role: 'teacher', n: -1 }] }, { op: 'resolve' }] },
          { id: 'mercy', lean: 'hero', label: 'Do what must be done', hint: 'No one else gets bitten. {name} never forgives you: -2 bond.', fx: [{ op: 'bond', role: 'teacher', n: -2 }, { op: 'resolve' }] },
        ],
      },
    ],
  },
};

// The unique monsters: each run's Flare Nights bring one with a name and a story. Kill it for a legendary blessing.
THREADS.lantern = {
  title: 'The Lantern-Eater',
  cast: {},
  start: { day: 3 },
  stages: [
    {
      id: 'mark', at: 'dawn', eyebrow: '[You have been Marked]', title: 'The light that went out',
      scene: 'Something tall put out the lamps. It **marked you**. It comes back on a **Flare Night**.',
      choices: [{ id: 'note', label: 'Remember it', hint: 'You keep your distance. Leans you toward **Aim**.', lean: 'ranger', fx: [{ op: 'advance' }] }, { id: 'stare', label: 'Stare into the dark', hint: 'You face it head on. Leans you toward **Brawn**.', lean: 'hero', fx: [{ op: 'advance' }] }],
    },
    {
      id: 'sighting', at: 'dawn', after: 7, eyebrow: '[Unique Monster: The Lantern-Eater]', title: 'Something eats the light',
      scene: '**The Lantern-Eater** comes on the Flare Night. Fight it tonight, or hide?',
      choices: [
        { id: 'bait', label: 'Light every lamp', hint: 'It comes tonight, tough and slow. Kill it: a legendary blessing. +15 noise.', fx: [{ op: 'heat', n: 15 }, { op: 'unique', name: 'The Lantern-Eater', mult: 1.5 }, { op: 'advance' }] },
        { id: 'dark', label: 'Douse the lights, hide', hint: 'A normal Flare Night tonight. It returns next time, angrier.', fx: [{ op: 'unique', name: 'The Lantern-Eater', mult: 1.6, later: 5 }, { op: 'advance' }] },
      ],
    },
    {
      id: 'aftermath', at: 'dawn', after: 1, needs: 'uniqueDone', eyebrow: '[Slain: The Lantern-Eater]', title: 'The thing on the road',
      scene: 'The Lantern-Eater is **down**. What do you do with it?',
      choices: [
        { id: 'skull', label: 'Mount the lamp-skull', hint: 'Towers +10% damage for good. The Ash-Born fear the light.', fx: [{ op: 'perk', key: 'towerDmg', add: 0.1 }, { op: 'resolve' }] },
        { id: 'burn', label: 'Burn it by the fire', hint: '-25 noise, and +1 food a day: people sleep again.', fx: [{ op: 'heat', n: -25 }, { op: 'flag', key: 'garden' }, { op: 'resolve' }] },
      ],
    },
  ],
};

// A faction: people are dangerous too
THREADS.toll = {
  title: 'The Bridge Crew',
  cast: { boss: { role: 'raider', names: ['Dario Kent', 'Mags Okoro', 'Viktor Hale', 'Rosa Quint'], epithet: 'the Toll-Keeper', persona: { traits: ['charming', 'greedy', 'loyal to their own'], quirk: 'flips a coin before every answer', want: 'their crew fed through winter', fear: 'being the last one left' }, secret: 'Their crew is half the size they claim. They are starving too.' } },
  start: { day: 9 },
  failed: { eyebrow: '[Faction lost]', title: 'The bridge stands empty', scene: 'The Bridge Crew **left**. The road is quiet.', label: 'Leave the coin' },
  stages: [
    {
      id: 'demand', at: 'dawn', eyebrow: '[Faction: The Bridge Crew]', title: 'A toll for the road',
      speaker: 'boss', line: '"Heads, you pay. Tails, we **ring every bell** in the woods."',
      scene: 'Six armed strangers want **scrap** for a quiet road. Pay?',
      choices: [
        { id: 'pay', label: 'Pay the toll', hint: '-10 scrap. They remember you kept your word. -10 noise now.', cost: { gold: 10 }, fx: [{ op: 'heat', n: -10 }, { op: 'flag', key: 'paid' }, { op: 'advance' }] },
        { id: 'refuse', label: 'Tell them to try', hint: 'They ring the bells. They will be back. +25 noise now.', fx: [{ op: 'heat', n: 25 }, { op: 'flag', key: 'refused' }, { op: 'advance' }] },
        { id: 'offer', label: 'Offer them a place', hint: '-6 food. If they say yes, their guns are yours. Answer in two days.', cost: { food: 6 }, fx: [{ op: 'flag', key: 'offered' }, { op: 'advance' }] },
      ],
    },
    {
      id: 'answer', at: 'dawn', after: 2, eyebrow: '[Quest: The Bridge Crew]', title: 'The coin comes down',
      speaker: 'boss', line: '"I flipped it. Didn\'t look. **I\'m asking you** instead."',
      scene: 'The Bridge Crew is back, **starving**. Take them in?',
      choices: [
        { id: 'join', label: 'Bring the crew in', hint: '{name} leads the watch (towers +10%). +3 people. -4 food.', fx: [{ op: 'food', n: -4 }, { op: 'survivors', n: 3 }, { op: 'recruit', role: 'boss' }, { op: 'resolve' }] },
        { id: 'trade', label: 'Trade, keep the fence shut', hint: 'They sell salvage: +14 scrap now. Then they go.', fx: [{ op: 'gold', n: 14 }, { op: 'resolve' }] },
        { id: 'away', label: 'Send them on', hint: 'They leave the woods. Nothing changes.', fx: [{ op: 'resolve' }] },
      ],
    },
  ],
};

// Small moments: one-shot storylets that fill quiet dawns. `when` must hold; each happens once per run.
export const AMBIENT = [
  { id: 'dog', when: S => S.night >= 3, eyebrow: '[Event]', title: 'A dog at the gate',
    scene: 'A stray dog **followed you home**. Keep it?',
    choices: [{ id: 'keep', label: 'Let it in', hint: 'Barks at the Ash-Born: hero 8% faster. The Haven sleeps better: +1 food a day.', fx: [{ op: 'perk', key: 'heroSpeed', mul: 1.08 }, { op: 'flag', key: 'garden' }] }, { id: 'shoo', label: 'Shoo it away', hint: 'One more mouth is too many.', fx: [] }] },
  { id: 'flag', when: S => S.night >= 4, eyebrow: '[Event]', title: 'Your flag on the old road',
    scene: 'Someone painted **your flag** on the road. **Strangers** will find you. **So will the Ash-Born.**',
    choices: [{ id: 'leave', label: 'Leave it up', hint: 'Survivors find you: +2 people next dawn. +10 noise.', fx: [{ op: 'heat', n: 10 }, { op: 'flag', key: 'beacon' }, { op: 'flag', key: 'beacon' }] }, { id: 'paint', label: 'Paint over it', hint: 'The road forgets you. -10 noise.', fx: [{ op: 'heat', n: -10 }] }] },
  { id: 'fever', when: S => S.night >= 4, eyebrow: '[Warning]', title: 'Fever in the bunks',
    scene: '**Fever** in the bunks. Four people are sick. Spend food on them?',
    choices: [{ id: 'care', label: 'Nurse them', hint: '-5 food. Everyone pulls through.', cost: { food: 5 }, fx: [] }, { id: 'rest', label: 'Let them rest', hint: 'One of them doesn\'t wake up: -1 person.', fx: [{ op: 'survivors', n: -1 }] }] },
  { id: 'wedding', when: S => S.night >= 6, eyebrow: '[Event]', title: 'A wedding at the fire',
    scene: 'Two of your people want to **marry tonight**. Hold the wedding?',
    choices: [{ id: 'yes', label: 'Hold the wedding', hint: '-4 food. Spirits soar: they work till dark, +6 scrap.', cost: { food: 4 }, fx: [{ op: 'gold', n: 6 }] }, { id: 'no', label: 'Wait until after the war', hint: 'Nothing changes.', fx: [] }] },
  { id: 'thief', when: S => S.night >= 5, eyebrow: '[Event]', title: 'The fuel thief',
    scene: 'You caught a girl **stealing lamp oil**. What do you do?',
    choices: [{ id: 'hire', label: 'Put her to work', hint: '+1 person. She knows where the oil is: +3 scrap.', fx: [{ op: 'survivors', n: 1 }, { op: 'gold', n: 3 }] }, { id: 'chase', label: 'Chase her off', hint: 'She runs off, yelling. +8 noise.', fx: [{ op: 'heat', n: 8 }] }] },
  { id: 'window', when: S => S.night >= 8, eyebrow: '[Hidden scenario discovered]', title: 'A quest you never accepted',
    scene: '[Hidden quest: find the **backwards clock**.] Accept it?',
    choices: [{ id: 'accept', label: '[Accept]', hint: 'A rare blessing now. The System will remember.', fx: [{ op: 'blessing' }, { op: 'flag', key: 'clockQuest' }] }, { id: 'decline', label: '[Decline]', hint: 'The window flickers out. For now.', fx: [] }] },
];

// Companion roles: what they give while they live, and what they can do at your side
export const ROLES = {
  engineer: { post: 'Engineer', bonus: 'towers +8% damage', towers: 0.08 },
  teacher: { post: 'Quartermaster', bonus: '+1 food a day', food: 1 },
  revenant: { post: 'Revenant', bonus: 'the Ash-Born slow near the Haven', lullaby: 0.8 },
  raider: { post: 'Captain of the Watch', bonus: 'towers +10% damage', towers: 0.1 },
  // roles for the people Claude (or the woods) makes up
  scout: { post: 'Scout', bonus: '+2 scrap a day', gold: 2 },
  medic: { post: 'Medic', bonus: 'you heal 1 health a second', regen: 1 },
  cook: { post: 'Cook', bonus: '+2 food a day', food: 2 },
  mechanic: { post: 'Mechanic', bonus: 'towers +5% damage', towers: 0.05 },
  gunner: { post: 'Gunner', bonus: 'towers +6% damage', towers: 0.06 },
};

// Offline chat: what companions say when Claude is not connected (topic buttons)
export const BARKS = {
  self: ['"{want}. That is all I want."', '"Ask me again when the sun is up."', '"You want the truth? {fear}. Every night."'],
  city: ['"{district} was quiet last night. Too quiet."', '"The noise is at {heat}. They can hear us."', '"We have {pop} people now. I remember when it was three."'],
  you: ['"You walk like someone who has done this before. Have you?"', '"I trust you. Mostly."', '"You talk to that blue window when you think nobody is looking."'],
};

// One new idea at a time: inline callouts anchored to the HUD element they explain (never modals, never on day 1).
// `at`: the HUD element the callout points to (see ui/app.js ANCHORS). Dismissed on tap.
export const TIPS = [
  { id: 'noise', at: 'noise', when: (S, g) => S.night >= 2 && S.phase === 'day' && (S.noise ?? S.heat ?? 0) > 20, text: 'Noise: the louder the Haven, the more Ash-Born come.' },
  { id: 'forecast', at: 'forecast', when: S => S.night >= 2 && S.phase === 'day', text: 'Tonight\'s forecast: what may fall tonight.' },
  { id: 'quest', at: 'strip', when: S => S.night >= 2 && S.phase === 'day' && S.dayT > 4 && !!(S.story.daily && S.story.daily.state === 'active'), text: 'Your daily quest. It ends at dawn.' },
  { id: 'street', at: 'map', when: S => S.night >= 2 && S.story.spots.length > 0 && S.phase === 'day', text: 'Blue beacon: someone needs you. A few Ash-Born guard it.' },
  { id: 'evolve', at: 'strip', when: S => S.lvl >= 8, text: 'Your choices shape your class. It unlocks at level 15.' },
  { id: 'roam', at: 'camp', when: S => S.night >= 2 && S.mobs.some(m => m.hunt), text: 'The Ash-Born follow you home. Lead them into your towers.' },
  { id: 'clear', at: 'build', when: S => S.night >= 3 && S.phase === 'day', text: 'Tap rubble on your land to clear it.' },
];

// Out in the open districts: people and places you stumble on. A marker appears; walk there to see what it is.
// They are guarded by a few dead. Each happens once per run; the Chronicler rewrites them to fit your story.
export const STREET = [
  { id: 'carroof', eyebrow: '[Survivor detected]', title: 'Stranded on a bus roof',
    scene: 'A courier is **stuck on a bus roof**. **Very thirsty.**',
    choices: [{ id: 'take', label: 'Bring him home', hint: '+1 person. Knows the streets: next scout call shows one more route.', fx: [{ op: 'survivors', n: 1 }, { op: 'flag', key: 'scout' }] }, { id: 'water', label: 'Give water and directions', hint: '-2 food. He spreads the word: +1 person at dawn. +8 noise.', fx: [{ op: 'food', n: -2 }, { op: 'heat', n: 8 }, { op: 'flag', key: 'beacon' }] }] },
  { id: 'pharmacy', eyebrow: '[Location discovered]', title: 'The jammed pharmacy',
    scene: 'A locked pharmacy. **Something is breathing** behind the door.',
    choices: [{ id: 'open', label: 'Force the door', hint: 'Coin toss: +12 scrap of medicine, or an Ash-Born pharmacist (you get hurt).', fx: [{ op: 'gamble', p: 0.5, good: [{ op: 'gold', n: 12 }], bad: [{ op: 'hurt', n: 10 }, { op: 'gold', n: 4 }] }] }, { id: 'front', label: 'Take what is out front', hint: '+5 scrap. No risk.', fx: [{ op: 'gold', n: 5 }] }] },
  { id: 'radio', eyebrow: '[Signal]', title: 'Sparrow on the radio',
    scene: 'A **child** on a walkie-talkie: "This is **Sparrow**. Anyone?"',
    choices: [{ id: 'answer', label: 'Answer Sparrow', hint: 'Sparrow and two others reach you: +3 people. +10 noise.', fx: [{ op: 'heat', n: 10 }, { op: 'survivors', n: 3 }] }, { id: 'keep', label: 'Keep it and listen', hint: 'Learn their patrol routes: the Ash-Born notice you later.', fx: [{ op: 'flag', key: 'quiet' }] }] },
  { id: 'church', eyebrow: '[Location discovered]', title: 'Candles in the chapel',
    scene: 'A chapel with **forty names** on the wall. Fresh candles.',
    choices: [{ id: 'add', label: 'Add your own Ash-Born', hint: 'Your people take heart: +1 food a day. -15 noise.', fx: [{ op: 'heat', n: -15 }, { op: 'flag', key: 'garden' }] }, { id: 'take', label: 'Take the candles', hint: '+4 scrap. Light is light.', fx: [{ op: 'gold', n: 4 }] }] },
  { id: 'market', eyebrow: '[Encounter]', title: 'A trader with a trolley',
    scene: 'A trader with **tins and batteries**. "I trade. I don\'t give."',
    choices: [{ id: 'food', label: 'Trade scrap for food', hint: '-6 scrap, +8 food.', cost: { gold: 6 }, fx: [{ op: 'food', n: 8 }] }, { id: 'tip', label: 'Ask what she has seen', hint: 'Free. She knows an Inferno Nest\'s weak spot: hero +15% damage to Inferno Nests.', fx: [{ op: 'flag', key: 'hiveTip' }] }] },
  { id: 'dog2', eyebrow: '[Encounter]', title: 'The dog at the door',
    scene: 'A dog guards a basement door. **Someone is inside.**',
    choices: [{ id: 'food', label: 'Throw it some food', hint: '-2 food. It lets you in: a family of three joins (+3 people).', cost: { food: 2 }, fx: [{ op: 'survivors', n: 3 }] }, { id: 'leave', label: 'Leave them be', hint: 'Not everyone wants to be found.', fx: [] }] },
  { id: 'cache', eyebrow: '[Location discovered]', title: 'A prepper\'s cache',
    scene: 'A **prepper\'s cache** under a skip. The owner never came back.',
    choices: [{ id: 'all', label: 'Take everything', hint: '+10 scrap, +5 food.', fx: [{ op: 'gold', n: 10 }, { op: 'food', n: 5 }] }, { id: 'half', label: 'Take half, leave a note', hint: '+5 scrap. Whoever reads it may find you: +1 person at dawn.', fx: [{ op: 'gold', n: 5 }, { op: 'flag', key: 'beacon' }] }] },
  { id: 'statue', eyebrow: '[Hidden scenario]', title: 'The statue that turned',
    scene: 'A statue **turned around** overnight. [A **blessing** is near.]',
    choices: [{ id: 'touch', label: 'Touch the plinth', hint: 'A rare blessing, right now.', fx: [{ op: 'blessing' }] }, { id: 'walk', label: 'Walk on, fast', hint: 'Some windows are better left closed.', fx: [] }] },
];

// When the hand-written street finds run out, the city keeps making them: people, places, and a reason to care.
// Slots are filled from these lists; the Chronicler (if on) rewrites the result in your run's voice.
export const STREET_GEN = {
  who: [
    { name: 'a bus driver', trait: 'still wears the cap' }, { name: 'two sisters', trait: 'finish each other\'s sentences' }, { name: 'a retired boxer', trait: 'one broken hand, one good one' },
    { name: 'a nurse', trait: 'counts everyone twice' }, { name: 'a chef', trait: 'never puts down the knife roll' }, { name: 'a street musician', trait: 'won\'t leave the guitar' },
    { name: 'an electrician', trait: 'talks to cables' }, { name: 'a postwoman', trait: 'still delivers letters nobody reads' }, { name: 'a teenager', trait: 'filmed everything on a dead phone' },
    { name: 'a priest', trait: 'lost the faith, kept the collar' }, { name: 'a gardener', trait: 'has seeds sewn into his coat' }, { name: 'a taxi driver', trait: 'knows every back road' },
  ],
  where: [['on the roof of a laundromat', 'on the laundromat roof'], ['in a bank vault with the door wedged', 'in the bank vault'], ['up a scaffold on a half-built block', 'up the scaffold'], ['in the back of an ice-cream van', 'in the ice-cream van'], ['behind the counter of a kebab shop', 'in the kebab shop'], ['in a stalled tram', 'in the stalled tram'], ['in a church bell tower', 'in the bell tower'], ['on a footbridge with both ends full of Ash-Born', 'on the footbridge']],
  ask: [
    { id: 'rescue', line: 'They wave a sheet. They **can\'t get down** alone.', choices: [
      { id: 'bring', label: 'Get them down', hint: '+{n} people (they were not alone). -{f} food.', fx: [{ op: 'survivors', n: '{n}' }, { op: 'food', n: '-{f}' }] },
      { id: 'supplies', label: 'Toss up supplies, a map', hint: '-2 food. They find their own way: +1 person at dawn.', fx: [{ op: 'food', n: -2 }, { op: 'flag', key: 'beacon' }] } ] },
    { id: 'trade', line: 'They want to **trade**. Something for something.', choices: [
      { id: 'buy', label: 'Trade scrap for goods', hint: '-{g} scrap, +{h} food.', cost: { gold: '{g}' }, fx: [{ op: 'food', n: '{h}' }] },
      { id: 'invite', label: 'Offer them a place', hint: '+1 person, plus their pack: +{h2} food.', fx: [{ op: 'survivors', n: 1 }, { op: 'food', n: '{h2}' }] } ] },
    { id: 'skill', line: 'They have a **skill** the Haven needs.', choices: [
      { id: 'hire', label: 'Put them to work', hint: '+1 person. They earn their keep: +{g} scrap.', fx: [{ op: 'survivors', n: 1 }, { op: 'gold', n: '{g}' }] },
      { id: 'learn', label: 'Learn from them', hint: 'Your hero picks it up: +0.4 damage.', fx: [{ op: 'perk', key: 'heroDmg', add: 0.4 }] } ] },
    { id: 'warning', line: 'They saw something. **You need to hear it.**', choices: [
      { id: 'listen', label: 'Listen, bring them in', hint: '+1 person. Better route at the next scout call.', fx: [{ op: 'survivors', n: 1 }, { op: 'flag', key: 'scout' }] },
      { id: 'pay', label: 'Pay and part ways', hint: '-4 scrap. You learn the quiet streets: -10 noise.', cost: { gold: 4 }, fx: [{ op: 'heat', n: -10 }] } ] },
  ],
};

// ---------- the Window's daily quest (Solo Leveling register) ----------
// One a day from day 2, offered when you are calm (Accept / Not now: sim/daily.js). `stat(S, ST)` is a counter that only goes up; the quest is done when it has grown by `n`.
// Rewards use only what the engine already has: xp, a lean on the path, scrap, food (and a title, as flavour).
// Ignore it and the next dawn brings a penalty quest; ignore that too and the Camp pays.
export const DAILY = [
  { id: 'cull', title: 'Strength Training', goal: 'Put down {n} of the Ash-Born', n: d => Math.min(30, 6 + 2 * d), stat: S => S.kills,
    reward: d => [{ op: 'xp', n: 15 + 4 * d }] },
  { id: 'salvage', title: 'The Gatherer\'s Round', goal: 'Carry {n} salvage home', n: d => Math.min(8, 3 + Math.floor(d / 3)), stat: S => (S.stats.pickups || 0),
    reward: d => [{ op: 'xp', n: 10 + 3 * d }, { op: 'gold', n: 4 + Math.floor(d / 2) }] },
  { id: 'hunt', title: 'Hunting Rights', goal: 'Hunt {n} deer or wolves', n: d => Math.min(3, 1 + Math.floor(d / 5)), stat: S => (S.stats.hunted || 0), when: S => S.night >= 2,
    reward: d => [{ op: 'xp', n: 10 + 3 * d }, { op: 'food', n: 4 + Math.floor(d / 2) }] },
  { id: 'raise', title: 'Foundations', goal: 'Raise {n} buildings', n: d => Math.min(4, 2 + Math.floor(d / 5)), stat: S => (S.stats.built || 0),
    reward: d => [{ op: 'xp', n: 10 + 3 * d }, { op: 'gold', n: 5 + Math.floor(d / 2) }] },
  { id: 'range', title: 'The Long Walk', goal: 'Walk {n} paces out, then come home', n: d => Math.min(70, 30 + 3 * d), stat: (S, ST) => (ST.daily && ST.daily.back ? 1e6 : 0), far: true,
    reward: d => [{ op: 'xp', n: 15 + 4 * d }] },
  { id: 'beacon', title: 'A Light in the Woods', goal: 'Reach a blue beacon', n: () => 1, stat: (S, ST) => (ST.streetDone || 0), when: S => S.story.spots.length > 0,
    reward: d => [{ op: 'xp', n: 15 + 3 * d }, { op: 'food', n: 3 }] },
  { id: 'claim', title: 'Claim and Hold', goal: 'Claim a site', n: () => 1, stat: S => (S.stats.sites || 0), when: (S, open) => open > 0,
    reward: d => [{ op: 'xp', n: 15 + 3 * d }, { op: 'gold', n: 6 }] },
];
export const DAILY_TEXT = {
  offer: '[Daily quest offered]',
  scene: '**{goal}**. Take it on, or let it go: saying no costs nothing.',
  accept: 'Accept',
  terms: 'Ends at dawn. Reward: {reward}. If it is not done by dawn: −{fail} scrap.',
  later: 'Not now',
  laterHint: 'No cost. Another one comes tomorrow.',
  issued: '[Daily quest: {title}]',
  ends: 'It ends at dawn.',
  endsShort: 'ends at dawn',
  remind: '[Daily: {title}] {have}/{n}. Dusk soon; it ends at dawn.',
  done: '[Quest complete: {title}]',
  failed: '[Daily quest failed: {title}] {cost}.',
};

// ---------- the night, in one line (scales with the wave) ----------
export const NUMBER = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
export const NIGHT_TEXT = {
  one: 'One of them.',
  side: '{N}, from the {dir}.',
  two: '{N} from the {dir}. {M} from the {dir2}.',
  three: '{N}, from the {dir}, the {dir2} and the {dir3}.',
  many: '{N}. From every side.',
  brute: ' A Slag Brute walks with them.',
  brutes: ' {B} Slag Brutes walk with them.',
  blood: 'Flare Night. ',
  unique: ' {name} comes with them.',
};

// ---------- how people arrive: every choice that adds people says it plainly (the engine adds this line, never the AI) ----------
export const ARRIVE = {
  now: { icon: 'camp', tag: 'At the Haven now', text: 'They\'re at the Haven now.' },
  convoy: { icon: 'route', tag: 'Escort · convoy', text: 'You must escort them home from here ({dir}, {d} m out). The Ash-Born hunt them.' },
  dawn: { icon: 'clock', tag: 'On their own', text: 'They walk to the Haven on their own (arrive by dawn).' },
  join: { icon: 'camp', tag: 'At the Haven now', text: '{who} is at the Haven now.' },
  more: ' +{n} more walk in on their own by dawn.',
};
