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

// Companion roles: what they give while they live, and what they can do at your side
export const ROLES = {
  engineer: { post: 'Engineer', bonus: '+3 power', power: 3 },
  teacher: { post: 'Quartermaster', bonus: '+1 pair of hands every day', hands: 1 },
  revenant: { post: 'Revenant', bonus: 'the dead slow near the keep', lullaby: 0.8 },
};

// Offline chat: what companions say when Claude is not connected (topic buttons)
export const BARKS = {
  self: ['"{want}. That is all I want."', '"Ask me again when the sun is up."', '"You want the truth? {fear}. Every night."'],
  city: ['"{district} was quiet last night. Too quiet."', '"The heat is at {heat}. They can hear us."', '"We have {pop} people now. I remember when it was three."'],
  you: ['"You walk like someone who has done this before. Have you?"', '"I trust you. Mostly."', '"You talk to that blue window when you think nobody is looking."'],
};
