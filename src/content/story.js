// The story layer: encounters with choices. The engine owns every effect; text here is the offline
// version (Claude can rewrite the words of any encounter, never its effects).
// Effects ({ op, ... }) are applied by src/sim/story.js. Costs are checked before a choice is allowed.

// The voice of the world: terse, slightly cold, in [brackets]. The hero woke up in this city with a status window.
export const SYSTEM = {
  intro: '[Status window unlocked] You **survived** night one. At dawn, a **blue window** opens in the air.',
};

// The first gift: one of three, before day 1 starts
export const GIFT = {
  title: 'Choose your starting gift',
  eyebrow: '[Choose one]',
  scene: 'Three gifts blink. **Pick one.**',
  choices: [
    { id: 'lantern', label: 'Take the Lantern of Dawn', hint: 'Hero hits 15% harder. Sees further at night.', fx: [{ op: 'perk', key: 'heroDmgMult', mul: 1.15 }, { op: 'title', id: 'lantern' }] },
    { id: 'boots', label: 'Wear the Quiet Boots', hint: 'The dead spot you later. Your town draws less attention.', fx: [{ op: 'flag', key: 'quiet' }, { op: 'title', id: 'quiet' }] },
    { id: 'will', label: 'Forge an Iron Will', hint: 'Keep +30 health. Hero +8 health.', fx: [{ op: 'perk', key: 'keepHp', add: 30 }, { op: 'perk', key: 'heroHp', add: 8 }, { op: 'title', id: 'will' }] },
  ],
};

// Titles: earned by deeds, shown as System windows, each with a small edge
export const TITLES = {
  lantern: { name: 'Lantern-Bearer', desc: 'Chose the light.' },
  quiet: { name: 'Soft-Step', desc: 'Chose silence.' },
  will: { name: 'Unbroken', desc: 'Chose to endure.' },
  firstLight: { name: 'First Light', desc: 'Survived night one. +10 keep health.', fx: [{ op: 'perk', key: 'keepHp', add: 10 }] },
  gravedigger: { name: 'Gravedigger', desc: 'Put down 150 dead. +0.5 hero damage.', fx: [{ op: 'perk', key: 'heroDmg', add: 0.5 }] },
  hivebreaker: { name: 'Hive-Breaker', desc: 'Burned a hive. Towers +5% damage.', fx: [{ op: 'perk', key: 'towerDmg', add: 0.05 }] },
  pathfinder: { name: 'Pathfinder', desc: 'Opened 3 districts. +1 pair of hands.', fx: [{ op: 'hands', n: 1 }] },
  lamplighter: { name: 'Lamplighter', desc: 'The grid is back. +2 power.', fx: [{ op: 'power', n: 2 }] },
  shepherd: { name: 'Shepherd of the Quiet', desc: 'Named one of the dead.' },
  warden: { name: 'Warden of the Young', desc: 'Saved the children. Their garden: +1 food each dawn.', fx: [{ op: 'flag', key: 'garden' }] },
  ironGrid: { name: 'Iron Grid', desc: 'Survived a blackout.' },
  loud: { name: 'The Loudest Town', desc: 'Burst a hive. Lived anyway.' },
  called: { name: 'The Called', desc: 'Passed a Calling trial. +10 health.', fx: [{ op: 'perk', key: 'heroHp', add: 10 }] },
  ascended: { name: 'Ascended', desc: 'Passed the final trial. +10% hero damage.', fx: [{ op: 'perk', key: 'heroDmgMult', mul: 1.1 }] },
  uniqueSlayer: { name: 'Light-Breaker', desc: 'Killed a unique monster. +15% hero damage.', fx: [{ op: 'perk', key: 'heroDmgMult', mul: 1.15 }] },
};

// Calls to open a district: framed by why you would go. Options are built from the frontier.
export const DISTRICT_CALL = {
  title: 'Beyond the fence',
  eyebrow: '[New route]',
  scene: 'Scouts are back from the fence. **One route** can open today. The rest stay **sealed**.',
  later: { id: 'later', label: 'Keep the fences shut', hint: 'Scouts build instead: +1 pair of hands today.', fx: [{ op: 'handsToday', n: 1 }] },
};

// What you find when you first walk up to a district's site. Claim = the building's bonus for good.
export const SITES = {
  default: {
    scene: 'The doors give. **Dark, dry, untouched** since the fall.',
    claim: 'Make it ours', strip: 'Strip it for scrap', leave: 'Leave it for now',
  },
  flats: { scene: 'Barricades, **fourteen floors up**. A family of five, two old men. **Out of water.** Still alive.', claim: 'Bring them home', strip: 'Take the water, go' },
  allotment: { scene: 'Beans and potatoes under nets. A painted sign: **TAKE WHAT YOU NEED. LEAVE WHAT YOU CAN.**', claim: 'Fence it and farm it', strip: 'Harvest it all now' },
  market: { scene: 'Shutters up. **Nobody looted this.** Tins, tools, batteries, a **pharmacy** behind glass.', claim: 'Run it as a market', strip: 'Take everything now' },
  police: { scene: 'The armory held. **Rifles in racks.** The duty log stops the night the **city fell**.', claim: 'Arm the towers', strip: 'Sell the guns for scrap' },
  clinic: { scene: 'Clean beds. A nurse with a **fire axe**. "**Bitten?** Say so now."', claim: 'Make it our clinic', strip: 'Take the medicine, go' },
  substation: { scene: 'Transformers **humming** under a tarp. A note on the panel: "**DON\'T FLIP THE RED ONE.**"', claim: 'Bring the grid back', strip: 'Pull the copper' },
  fuel: { scene: 'Tanks **half full**. The pumps work, and they are **loud**. Every dead nearby will hear.', claim: 'Run the depot', strip: 'Drain what you can' },
  school: { scene: 'Desks stacked at the doors. Behind them: **eleven children** and a teacher with a broom.', claim: 'Take them all in', strip: 'Leave food and go' },
  radio: { scene: 'The light reads **ON AIR**. The loop has run for weeks. The mic is **still warm**.', claim: 'Take the broadcast', strip: 'Pull the transmitter' },
};

// Threads: stories that come back. Each stage is one encounter; `when` decides when it can show.
// stage.at: 'dawn' (on a dawn after `after` days) or 'site' (when the hero reaches the thread's site).
export const THREADS = {
  channel9: {
    title: 'The Voice on Channel 9',
    cast: { engineer: { role: 'engineer', names: ['Mara Voss', 'Lena Brandt', 'Sofia Reyes', 'Ada Kowal'], epithet: 'the Wire Witch', persona: { traits: ['blunt', 'restless', 'proud'], quirk: 'counts in volts when she is nervous', want: 'to see the city lights come back', fear: 'the dark under the city' }, secret: 'She opened the metro gates the night the city fell, to let people shelter. The dead came up instead.' } },
    start: { day: 7, feat: 'power' },
    stages: [
      {
        id: 'signal', at: 'dawn', eyebrow: '[Signal intercepted]', title: 'Static on Channel 9',
        scene: 'Dawn. The old radio crackles. A woman\'s voice: "...I can get the **grid** up... I can\'t get out... they\'re at the **doors**..."',
        choices: [
          { id: 'answer', label: 'Answer her', hint: 'Opens her district today. +10 heat.', fx: [{ op: 'heat', n: 10 }, { op: 'openFor', kit: 'substation' }, { op: 'advance' }] },
          { id: 'triangulate', label: 'Trace her quietly', hint: 'Costs 4 scrap. No noise. Opens her district.', cost: { gold: 4 }, fx: [{ op: 'openFor', kit: 'substation' }, { op: 'advance' }] },
          { id: 'ignore', label: 'Turn it off', hint: 'The town isn\'t ready. She may not last.', fx: [{ op: 'fail', after: 3 }] },
        ],
      },
      {
        id: 'rescue', at: 'site', eyebrow: '[Quest: The Voice on Channel 9]', title: 'The control room',
        speaker: 'engineer', line: '"You actually came. Mind the **red switch**."',
        scene: 'A steel door with **claw marks**. Behind it: a woman, a crowbar, a crate of fuses. Days counted on the wall **in volts**.',
        choices: [
          { id: 'bring', label: 'Bring her home', hint: '{name} joins: +3 power while she lives. Substation: yours to claim.', fx: [{ op: 'recruit', role: 'engineer' }, { op: 'advance' }] },
          { id: 'trade', label: 'Ask her to stay', hint: 'She keeps the grid: free substation. She won\'t join you.', fx: [{ op: 'claimHere' }, { op: 'resolve' }] },
        ],
      },
      {
        id: 'secret', at: 'dawn', after: 2, eyebrow: '[Quest updated]', title: 'What {name} opened',
        speaker: 'engineer', line: '"The metro gates. **It was me.** I wanted them to hide."',
        scene: 'Before sunrise. {name}, wires in hand, talking fast. The night the city fell, she **opened the metro gates**. The dead **came up**.',
        choices: [
          { id: 'forgive', label: 'Forgive her', hint: '+1 bond. She rigs searchlights: +2 power for good.', fx: [{ op: 'bond', role: 'engineer', n: 1 }, { op: 'power', n: 2 }, { op: 'title', id: 'lamplighter' }, { op: 'resolve' }] },
          { id: 'work', label: 'Make her work it off', hint: 'Generators day and night: +4 power, but -1 bond.', fx: [{ op: 'bond', role: 'engineer', n: -1 }, { op: 'power', n: 4 }, { op: 'resolve' }] },
          { id: 'exile', label: 'Send her away', hint: 'She leaves with her work: -3 power, +12 scrap.', fx: [{ op: 'lose', role: 'engineer' }, { op: 'gold', n: 12 }, { op: 'resolve' }] },
        ],
      },
    ],
  },
  hummer: {
    title: 'The One Who Hums',
    cast: { revenant: { role: 'revenant', names: ['The Hummer'], epithet: 'one of the dead', persona: { traits: ['silent', 'gentle', 'watchful'], quirk: 'hums the same four notes', want: 'to remember its own name', fear: 'fire' }, secret: 'It was the bandleader at the old concert hall. The four notes are the first bar of its last song.' } },
    start: { day: 12 },
    stages: [
      {
        id: 'sighting', at: 'dawn', eyebrow: '[Anomaly: infected, non-hostile?]', title: 'The one who hums',
        scene: 'One of the dead at the fence. It **doesn\'t attack**. It hums **four notes**, over and over. The walkers near it **stop**.',
        choices: [
          { id: 'cage', label: 'Cage it at the keep', hint: 'Eats 1 food a dawn. The dead slow near it. Something more?', fx: [{ op: 'flag', key: 'caged' }, { op: 'advance' }] },
          { id: 'kill', label: 'Put it down', hint: 'Safe. Lesson learned: +0.5 hero damage.', fx: [{ op: 'perk', key: 'heroDmg', add: 0.5 }, { op: 'fail' }] },
          { id: 'watch', label: 'Leave it be', hint: 'It wanders off. Maybe it comes back.', fx: [{ op: 'fail' }] },
        ],
      },
      {
        id: 'cure', at: 'dawn', after: 2, eyebrow: '[Quest: The One Who Hums]', title: 'Four notes',
        scene: 'Two nights caged. When the dead come, the ones near it **slow down, listening**. Its eyes **follow you**.',
        choices: [
          { id: 'cure', label: 'Try to bring it back', hint: 'Costs 6 food, 6 scrap (half with a clinic). Revenant joins: the dead slow near the keep.', cost: { gold: 6, food: 6 }, clinicHalf: true, fx: [{ op: 'recruit', role: 'revenant' }, { op: 'advance' }] },
          { id: 'release', label: 'Open the cage', hint: 'It walks off, humming. You may hear it again.', fx: [{ op: 'gold', n: 3 }, { op: 'fail' }] },
        ],
      },
      {
        id: 'name', at: 'dawn', after: 1, eyebrow: '[Naming]', title: 'Name the quiet one',
        speaker: 'revenant', line: '(four notes, softer now)',
        scene: 'By the fire, a child asks: **what is it called?** Everyone looks at you. [Naming binds a monster to you. It grows **stronger**. Tonight, **you pay**.]',
        choices: [
          { id: 'name', label: 'Give it a name', hint: 'It becomes a Named Revenant: the dead slow much more. Tonight: hero -25% damage.', fx: [{ op: 'name', role: 'revenant' }, { op: 'title', id: 'shepherd' }, { op: 'resolve' }] },
          { id: 'noname', label: 'Leave it nameless', hint: 'It stays as it is.', fx: [{ op: 'resolve' }] },
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
        scene: 'New drawings in the **school windows**, two blocks out. Suns. Houses. A big orange flag. **Your flag.**',
        choices: [
          { id: 'go', label: 'Cut a way through', hint: 'Opens the school district today. Go yourself.', fx: [{ op: 'openFor', kit: 'school' }, { op: 'advance' }] },
          { id: 'wait', label: 'Refuse more mouths', hint: 'Not now. Someday the drawings will stop.', fx: [{ op: 'fail', after: 4 }] },
        ],
      },
      {
        id: 'rescue', at: 'site', eyebrow: '[Quest: Drawings on the Glass]', title: 'Eleven and a teacher',
        speaker: 'teacher', line: '"Single file. Nobody runs. **Nobody screams.** We practiced."',
        scene: 'Eleven **children** and a teacher with a broom. Thin. Quiet. They have been **waiting for your flag**.',
        choices: [
          { id: 'all', label: 'Bring everyone home', hint: '+5 people. {name} joins (+1 pair of hands). -6 food now.', cost: { food: 6 }, fx: [{ op: 'survivors', n: 5 }, { op: 'recruit', role: 'teacher' }, { op: 'title', id: 'warden' }, { op: 'advance' }] },
          { id: 'few', label: 'Take teacher and oldest', hint: '+2 people. {name} joins. The rest stay: -3 food left for them.', fx: [{ op: 'food', n: -3 }, { op: 'survivors', n: 2 }, { op: 'recruit', role: 'teacher' }, { op: 'advance' }] },
        ],
      },
      {
        id: 'bitten', at: 'dawn', after: 2, eyebrow: '[Warning: infection]', title: 'What {name} hid',
        speaker: 'teacher', line: '"He\'s eight. It\'s a **fever**. That\'s all. That\'s all."',
        scene: '{name} finds you away from the fire. A boy was **bitten four days ago**. She hid it. Now he\'s **burning up**, asleep beside the others.',
        choices: [
          { id: 'treat', label: 'Treat him', hint: 'Costs 8 scrap (free with a clinic). He lives. +1 bond.', cost: { gold: 8 }, clinicFree: true, fx: [{ op: 'bond', role: 'teacher', n: 1 }, { op: 'resolve' }] },
          { id: 'isolate', label: 'Isolate him and wait', hint: 'Coin toss. If he turns, a house falls tonight.', fx: [{ op: 'gamble', p: 0.5, bad: [{ op: 'risen', n: 3 }, { op: 'bond', role: 'teacher', n: -1 }] }, { op: 'resolve' }] },
          { id: 'mercy', lean: 'hero', label: 'Do what must be done', hint: 'No one else gets bitten. {name} never forgives you: -2 bond.', fx: [{ op: 'bond', role: 'teacher', n: -2 }, { op: 'resolve' }] },
        ],
      },
    ],
  },
};

// The unique monsters: each run's blood moons bring one with a name and a story. Kill it for a legendary blessing.
THREADS.lantern = {
  title: 'The Lantern-Eater',
  cast: {},
  start: { day: 3 },
  stages: [
    {
      id: 'mark', at: 'dawn', eyebrow: '[You have been Marked]', title: 'The light that went out',
      scene: 'The north road lamps die **one by one**. At the last, something tall **looks at you**. Your status window: **[Marked by: ???]**',
      choices: [{ id: 'note', label: 'Remember it', hint: 'It knows your face. It returns on a **blood moon**.', lean: 'ranger', fx: [{ op: 'advance' }] }, { id: 'stare', label: 'Stare into the dark', hint: 'Let it come. You will be ready.', lean: 'hero', fx: [{ op: 'advance' }] }],
    },
    {
      id: 'sighting', at: 'dawn', after: 7, eyebrow: '[Unique Monster: The Lantern-Eater]', title: 'Something eats the light',
      scene: 'Lamp by lamp, **darkness walks toward the keep**. By morning the poles are gone. Tonight: **blood moon**. [Only one of it exists.]',
      choices: [
        { id: 'bait', label: 'Light every lamp', hint: 'It comes tonight, tough and slow. Kill it: legendary blessing + title. +15 heat.', fx: [{ op: 'heat', n: 15 }, { op: 'unique', name: 'The Lantern-Eater', mult: 1.5 }, { op: 'advance' }] },
        { id: 'dark', label: 'Douse the lights, hide', hint: 'Normal blood moon tonight. It returns next time, angrier.', fx: [{ op: 'unique', name: 'The Lantern-Eater', mult: 1.6, later: 5 }, { op: 'advance' }] },
      ],
    },
    {
      id: 'aftermath', at: 'dawn', after: 1, needs: 'uniqueDone', eyebrow: '[Slain: The Lantern-Eater]', title: 'The thing on the street',
      scene: 'In daylight it is **smaller, sadder**: cables and bulbs grown into **what was a man**. Nobody speaks.',
      choices: [
        { id: 'skull', label: 'Mount the lamp-skull', hint: 'Towers +10% damage for good. The dead fear the light.', fx: [{ op: 'perk', key: 'towerDmg', add: 0.1 }, { op: 'resolve' }] },
        { id: 'burn', label: 'Burn it in the square', hint: 'Heat -25 and +1 food every dawn: people sleep again.', fx: [{ op: 'heat', n: -25 }, { op: 'flag', key: 'garden' }, { op: 'resolve' }] },
      ],
    },
  ],
};

// A faction: people are dangerous too
THREADS.toll = {
  title: 'The Bridge Crew',
  cast: { boss: { role: 'raider', names: ['Dario Kent', 'Mags Okoro', 'Viktor Hale', 'Rosa Quint'], epithet: 'the Toll-Keeper', persona: { traits: ['charming', 'greedy', 'loyal to their own'], quirk: 'flips a coin before every answer', want: 'their crew fed through winter', fear: 'being the last one left' }, secret: 'Their crew is half the size they claim. They are starving too.' } },
  start: { day: 9 },
  stages: [
    {
      id: 'demand', at: 'dawn', eyebrow: '[Faction: The Bridge Crew]', title: 'A toll for the road',
      speaker: 'boss', line: '"Heads, you pay. Tails, we **ring every bell** in town."',
      scene: 'Six armed strangers at your fence. **Clean. Rested.** Their leader flips a coin. They want **scrap** to keep the west road quiet.',
      choices: [
        { id: 'pay', label: 'Pay the toll', hint: '-10 scrap. They remember you kept your word. -10 heat now.', cost: { gold: 10 }, fx: [{ op: 'heat', n: -10 }, { op: 'flag', key: 'paid' }, { op: 'advance' }] },
        { id: 'refuse', label: 'Tell them to try', hint: 'They ring the bells. They will be back. +25 heat now.', fx: [{ op: 'heat', n: 25 }, { op: 'flag', key: 'refused' }, { op: 'advance' }] },
        { id: 'offer', label: 'Offer them a place', hint: '-6 food. If they say yes, their guns are yours. Answer in two days.', cost: { food: 6 }, fx: [{ op: 'flag', key: 'offered' }, { op: 'advance' }] },
      ],
    },
    {
      id: 'answer', at: 'dawn', after: 2, eyebrow: '[Quest: The Bridge Crew]', title: 'The coin comes down',
      speaker: 'boss', line: '"I flipped it. Didn\'t look. **I\'m asking you** instead."',
      scene: 'They are back, **fewer**. Half the crew is gone, the rest **starving**. Nobody wants to be **the last one left**.',
      choices: [
        { id: 'join', label: 'Bring the crew in', hint: '{name} leads the watch (towers +10%). +3 people. -4 food.', fx: [{ op: 'food', n: -4 }, { op: 'survivors', n: 3 }, { op: 'recruit', role: 'boss' }, { op: 'resolve' }] },
        { id: 'trade', label: 'Trade, keep fence shut', hint: 'They sell salvage: +14 scrap now. Then they go.', fx: [{ op: 'gold', n: 14 }, { op: 'resolve' }] },
        { id: 'away', label: 'Send them on', hint: 'They leave the city. Nothing changes.', fx: [{ op: 'resolve' }] },
      ],
    },
  ],
};

// Small moments: one-shot storylets that fill quiet dawns. `when` must hold; each happens once per run.
export const AMBIENT = [
  { id: 'dog', when: S => S.night >= 3, eyebrow: '[Event]', title: 'A dog at the gate',
    scene: 'A grey dog followed you home. **Ribs showing**, one ear torn, **tail going like mad**. It won\'t leave.',
    choices: [{ id: 'keep', label: 'Let it in', hint: 'Barks at the dead: hero 8% faster. Town sleeps better: +1 food each dawn.', fx: [{ op: 'perk', key: 'heroSpeed', mul: 1.08 }, { op: 'flag', key: 'garden' }] }, { id: 'shoo', label: 'Shoo it away', hint: 'One more mouth is too many.', fx: [] }] },
  { id: 'flag', when: S => S.night >= 4, eyebrow: '[Event]', title: 'Your flag on the overpass',
    scene: 'Someone painted **your flag** on the overpass. Three metres tall. Seen for miles. **So are you.**',
    choices: [{ id: 'leave', label: 'Leave it up', hint: 'Survivors find you: +2 people next dawn. +10 heat.', fx: [{ op: 'heat', n: 10 }, { op: 'flag', key: 'beacon' }, { op: 'flag', key: 'beacon' }] }, { id: 'paint', label: 'Paint over it', hint: 'Heat -10.', fx: [{ op: 'heat', n: -10 }] }] },
  { id: 'fever', when: S => S.night >= 4, eyebrow: '[Warning]', title: 'Fever in the bunks',
    scene: 'Four of your people, **coughing and burning up**. Not bitten. Just sick, the kind that **used to be nothing**.',
    choices: [{ id: 'care', label: 'Nurse them', hint: '-5 food. Everyone pulls through.', cost: { food: 5 }, fx: [] }, { id: 'rest', label: 'Let them rest', hint: 'One dies (-1 person). The rest are weak: -1 pair of hands today.', fx: [{ op: 'survivors', n: -1 }, { op: 'handsToday', n: -1 }] }] },
  { id: 'wedding', when: S => S.night >= 6, eyebrow: '[Event]', title: 'A wedding at the keep',
    scene: 'Two of your people want to **marry tonight**, on the keep steps. Someone found a suit. Somehow, **a cake**.',
    choices: [{ id: 'yes', label: 'Hold the wedding', hint: '-4 food. Spirits soar: +2 pairs of hands today.', cost: { food: 4 }, fx: [{ op: 'handsToday', n: 2 }] }, { id: 'no', label: 'Wait until after the war', hint: 'Nothing changes.', fx: [] }] },
  { id: 'thief', when: S => S.buildings.some(b => b.type === 'generator'), eyebrow: '[Event]', title: 'Diesel thief',
    scene: 'Someone is **draining the generator** at night. Tonight you catch her: a girl, maybe fifteen, with a **jerrycan bigger than her**.',
    choices: [{ id: 'hire', label: 'Put her to work', hint: '+1 person and +1 power.', fx: [{ op: 'survivors', n: 1 }, { op: 'power', n: 1 }] }, { id: 'chase', label: 'Chase her off', hint: 'She runs off, yelling. +8 heat.', fx: [{ op: 'heat', n: 8 }] }] },
  { id: 'window', when: S => S.night >= 8, eyebrow: '[Hidden scenario discovered]', title: 'A quest you never accepted',
    scene: '[Quest: Find the **clock that runs backwards**. Recommended level: 40.] The window **won\'t close**.',
    choices: [{ id: 'accept', label: '[Accept]', hint: 'A rare blessing now. The System will remember.', fx: [{ op: 'blessing' }, { op: 'flag', key: 'clockQuest' }] }, { id: 'decline', label: '[Decline]', hint: 'The window flickers out. For now.', fx: [] }] },
];

// Companion roles: what they give while they live, and what they can do at your side
export const ROLES = {
  engineer: { post: 'Engineer', bonus: '+3 power', power: 3 },
  teacher: { post: 'Quartermaster', bonus: '+1 pair of hands every day', hands: 1 },
  revenant: { post: 'Revenant', bonus: 'the dead slow near the keep', lullaby: 0.8 },
  raider: { post: 'Captain of the Watch', bonus: 'towers +10% damage', towers: 0.1 },
  // roles for the people Claude (or the city) makes up
  scout: { post: 'Scout', bonus: '+1 pair of hands every day', hands: 1 },
  medic: { post: 'Medic', bonus: 'you heal 1 health a second', regen: 1 },
  cook: { post: 'Cook', bonus: '+2 food every dawn', food: 2 },
  mechanic: { post: 'Mechanic', bonus: '+2 power', power: 2 },
  gunner: { post: 'Gunner', bonus: 'towers +6% damage', towers: 0.06 },
};

// Side quests the Chronicler (Claude) invents from what happened in this run. Claude picks a template, writes the words
// and may invent the person in it; the engine owns the effects (numbers grow a little with the day: n = night).
// Every choice has an id the AI must keep. `who`: the quest needs a character (Claude invents one).
export const QUEST_TEMPLATES = {
  rescue: { who: true, desc: 'someone trapped or hiding who needs you to come and get them', choices: [
    { id: 'bring', label: 'Bring them home', fx: n => [{ op: 'survivors', n: 2 + (n >> 3) }, { op: 'food', n: -2 }] },
    { id: 'supply', label: 'Leave supplies and a map', fx: () => [{ op: 'food', n: -2 }, { op: 'flag', key: 'beacon' }] },
  ] },
  recruit: { who: true, desc: 'a person with a skill and a past who could join the town as a companion (pick a role: scout, medic, cook, mechanic or gunner)', choices: [
    { id: 'join', label: 'Ask them to join you', fx: () => [{ op: 'recruitNew' }] },
    { id: 'trade', label: 'Trade, then part ways', fx: n => [{ op: 'gold', n: 5 + (n >> 1) }] },
  ] },
  bargain: { who: true, desc: 'a trader, a gang or a stranger who wants something for something', choices: [
    { id: 'pay', label: 'Pay their price', cost: n => ({ gold: 4 + (n >> 1) }), fx: n => [{ op: 'food', n: 6 + (n >> 1) }] },
    { id: 'refuse', label: 'Walk away', fx: () => [{ op: 'heat', n: 6 }] },
  ] },
  mystery: { who: false, desc: 'something strange the System notices: a place, an object, a sign, tied to what came before', choices: [
    { id: 'touch', label: 'Look closer', fx: () => [{ op: 'blessing' }, { op: 'hurt', n: 6 }] },
    { id: 'leave', label: 'Mark it and leave', fx: () => [{ op: 'hands', n: 1 }] },
  ] },
  dilemma: { who: true, desc: 'a hard choice between mercy and safety (or between two people), with no clean answer', choices: [
    { id: 'mercy', label: 'Choose mercy', fx: n => [{ op: 'survivors', n: 1 + (n >> 4) }, { op: 'heat', n: 8 }] },
    { id: 'safety', label: 'Choose the town', fx: n => [{ op: 'gold', n: 4 + (n >> 1) }] },
  ] },
  echo: { who: false, desc: 'a callback: something or someone from an earlier day comes back, changed', choices: [
    { id: 'welcome', label: 'Meet it head on', fx: n => [{ op: 'perk', key: 'heroDmg', add: 0.3 }] },
    { id: 'avoid', label: 'Let the past lie', fx: () => [{ op: 'heat', n: -8 }] },
  ] },
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
  { id: 'night', day1: true, when: S => S.phase === 'night' && S.night === 1, text: '[Tip: The first night] Something is coming from the dark. Your towers shoot on their own; you can fight too.' },
  { id: 'stream', when: S => S.mobs.some(m => m.stream !== undefined && !m.roam), text: '[Tip: The stream] Awake hives never stop sending their dead, day or night. Burn a hive to stop it, but hitting one makes it rage.' },
  { id: 'street', when: S => S.story.spots.length > 0 && S.phase === 'day', text: '[Tip: Encounters] Blue beacons in the open districts are people and places worth a look. A few dead guard each one.' },
  { id: 'district', when: S => S.story.quests.length > 0, text: '[Tip: Quests] A blue arrow points to your quest. Walk there yourself: the town will hold for a while.' },
  { id: 'evolve', when: S => S.lvl >= 2, text: '[Tip: Your path] Every **choice** you make leans you toward **Brawn, Aim, Wits or Heart**. At **level 5** the System offers the class you have been living, as a trial. Tap the day counter to see your path.' },
  { id: 'roam', when: S => S.mobs.some(m => m.hunt), text: '[Tip: Hunted] The dead out in the streets **follow you** once they see you, all the way home. Lead them into your towers, or lose them.' },
  { id: 'clear', when: (S, g) => S.night >= 3 && S.phase === 'day', text: '[Tip: Make room] Tap **rubble** or a **ruined block** on your land to knock it down. Blocks cost more scrap and a pair of hands, and the noise carries.' },
  { id: 'status', when: S => S.story.npcs.some(n => n.joined) || S.story.titles.length >= 2, text: '[Tip: Status] Tap the day counter (top left) for your status: titles, companions to talk to or take with you, and the chronicle.' },
];

// Out in the open districts: people and places you stumble on. A marker appears; walk there to see what it is.
// They are guarded by a few dead. Each happens once per run; the Chronicler rewrites them to fit your story.
export const STREET = [
  { id: 'carroof', eyebrow: '[Survivor detected]', title: 'Stranded on a bus roof',
    scene: 'A courier on a **burnt-out bus roof**, the dead you just cut down below him. Two days up there. **Very thirsty.**',
    choices: [{ id: 'take', label: 'Bring him home', hint: '+1 person. Knows the streets: next scout call shows one more route.', fx: [{ op: 'survivors', n: 1 }, { op: 'flag', key: 'scout' }] }, { id: 'water', label: 'Give water and directions', hint: '-2 food. He spreads the word: +1 person at dawn. +8 heat.', fx: [{ op: 'food', n: -2 }, { op: 'heat', n: 8 }, { op: 'flag', key: 'beacon' }] }] },
  { id: 'pharmacy', eyebrow: '[Location discovered]', title: 'The jammed pharmacy',
    scene: 'Shutter jammed half-open. Shelves bare. The back room is locked, and **something behind it is breathing**.',
    choices: [{ id: 'open', label: 'Force the door', hint: 'Coin toss: +12 scrap of medicine, or a dead pharmacist (you get hurt).', fx: [{ op: 'gamble', p: 0.5, good: [{ op: 'gold', n: 12 }], bad: [{ op: 'hurt', n: 10 }, { op: 'gold', n: 4 }] }] }, { id: 'front', label: 'Take what is out front', hint: '+5 scrap. No risk.', fx: [{ op: 'gold', n: 5 }] }] },
  { id: 'radio', eyebrow: '[Signal]', title: 'Sparrow on the radio',
    scene: 'A walkie-talkie crackles in a dead hand. A **child\'s voice**, calm: "Base, this is **Sparrow**. Still nobody. Over."',
    choices: [{ id: 'answer', label: 'Answer Sparrow', hint: 'Sparrow and two others reach you: +3 people. +10 heat.', fx: [{ op: 'heat', n: 10 }, { op: 'survivors', n: 3 }] }, { id: 'keep', label: 'Keep it and listen', hint: 'Learn their patrol routes: +1 pair of hands for good.', fx: [{ op: 'hands', n: 1 }] }] },
  { id: 'church', eyebrow: '[Location discovered]', title: 'Candles in the chapel',
    scene: 'Fresh candles. **Forty names** on the chapel wall. The last one is dated **yesterday**.',
    choices: [{ id: 'add', label: 'Add your own dead', hint: 'Your people take heart: +1 food each dawn. -15 heat.', fx: [{ op: 'heat', n: -15 }, { op: 'flag', key: 'garden' }] }, { id: 'take', label: 'Take the candles', hint: '+4 scrap. Light is light.', fx: [{ op: 'gold', n: 4 }] }] },
  { id: 'market', eyebrow: '[Encounter]', title: 'A trader with a trolley',
    scene: 'An old woman, a trolley of **tins and batteries**, a **rifle** on top. "I trade. I don\'t give. What have you got?"',
    choices: [{ id: 'food', label: 'Trade scrap for food', hint: '-6 scrap, +8 food.', cost: { gold: 6 }, fx: [{ op: 'food', n: 8 }] }, { id: 'tip', label: 'Ask what she has seen', hint: 'Free. She knows a hive\'s weak spot: hero +15% damage to hives.', fx: [{ op: 'flag', key: 'hiveTip' }] }] },
  { id: 'dog2', eyebrow: '[Encounter]', title: 'The dog at the door',
    scene: 'A starving dog guards a **basement door**. It growls at you, at the dead, at you again. **Someone is inside.**',
    choices: [{ id: 'food', label: 'Throw it some food', hint: '-2 food. It lets you in: a family of three joins (+3 people).', cost: { food: 2 }, fx: [{ op: 'survivors', n: 3 }] }, { id: 'leave', label: 'Leave them be', hint: 'Not everyone wants to be found.', fx: [] }] },
  { id: 'cache', eyebrow: '[Location discovered]', title: 'A prepper\'s cache',
    scene: 'A padlocked hatch under a skip. Someone **planned for this**. They **never came back**.',
    choices: [{ id: 'all', label: 'Take everything', hint: '+10 scrap, +5 food.', fx: [{ op: 'gold', n: 10 }, { op: 'food', n: 5 }] }, { id: 'half', label: 'Take half, leave a note', hint: '+5 scrap. Whoever reads it may find you: +1 person at dawn.', fx: [{ op: 'gold', n: 5 }, { op: 'flag', key: 'beacon' }] }] },
  { id: 'statue', eyebrow: '[Hidden scenario]', title: 'The statue that turned',
    scene: 'A bronze general on a horse. This morning it faced north. **Now it doesn\'t.** [The System hums. A **blessing** is near.]',
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
  where: [['on the roof of a laundromat', 'on the laundromat roof'], ['in a bank vault with the door wedged', 'in the bank vault'], ['up a scaffold on a half-built block', 'up the scaffold'], ['in the back of an ice-cream van', 'in the ice-cream van'], ['behind the counter of a kebab shop', 'in the kebab shop'], ['in a stalled tram', 'in the stalled tram'], ['in a church bell tower', 'in the bell tower'], ['on a footbridge with both ends full of dead', 'on the footbridge']],
  ask: [
    { id: 'rescue', line: 'They wave a sheet. They **can\'t get down** alone.', choices: [
      { id: 'bring', label: 'Get them down', hint: '+{n} people (they were not alone). -{f} food.', fx: [{ op: 'survivors', n: '{n}' }, { op: 'food', n: '-{f}' }] },
      { id: 'supplies', label: 'Toss up supplies, a map', hint: '-2 food. They find their own way: +1 person at dawn.', fx: [{ op: 'food', n: -2 }, { op: 'flag', key: 'beacon' }] } ] },
    { id: 'trade', line: 'They want to **trade**. Something for something.', choices: [
      { id: 'buy', label: 'Trade scrap for goods', hint: '-{g} scrap, +{h} food.', cost: { gold: '{g}' }, fx: [{ op: 'food', n: '{h}' }] },
      { id: 'invite', label: 'Offer them a place', hint: '+1 person, plus their pack: +{h2} food.', fx: [{ op: 'survivors', n: 1 }, { op: 'food', n: '{h2}' }] } ] },
    { id: 'skill', line: 'They have a **skill** the town needs.', choices: [
      { id: 'hire', label: 'Put them to work', hint: '+1 person and +1 pair of hands for good.', fx: [{ op: 'survivors', n: 1 }, { op: 'hands', n: 1 }] },
      { id: 'learn', label: 'Learn from them', hint: 'Your hero picks it up: +0.4 damage.', fx: [{ op: 'perk', key: 'heroDmg', add: 0.4 }] } ] },
    { id: 'warning', line: 'They saw something. **You need to hear it.**', choices: [
      { id: 'listen', label: 'Listen, bring them in', hint: '+1 person. Better route at the next scout call.', fx: [{ op: 'survivors', n: 1 }, { op: 'flag', key: 'scout' }] },
      { id: 'pay', label: 'Pay and part ways', hint: '-4 scrap. You learn the quiet streets: -10 heat.', cost: { gold: 4 }, fx: [{ op: 'heat', n: -10 }] } ] },
  ],
};
