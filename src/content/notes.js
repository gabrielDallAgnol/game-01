// Chapter 1's words in the world: notes found in searched houses, graffiti on walls, and radio broadcasts. This is
// the only way the story is told (no narrator, no popups). Pure words; story1.js says which step shows which id.
//   note:     { id, district, kind (building kind it is found in), night (earliest), step? (the quest it hints), from, text }
//   graffiti: { id, district, where (which wall), night, step?, text }
//   radio:    { id, night, src ('car' = a car radio while salvaging, 'rig' = the Rig radio once Gus fixes it, 'any'), from, text }
// A note with no step is flavour: any house of its kind in its district may hold it, once per run.
// Voice: light anime adventure. Short, warm, a little funny. No gore. Never write zombie, undead or walker.

export const NOTES = [
  // ---- church square: Kai's own things and the first night ----
  { id: 'n.rig.1', district: 'square', kind: 'rig', night: 1, step: 'q1.salvage', from: 'Kai', text: 'Tow job #212. Pick up the bus at the church, 18:00. Engine knock again. Crankshaft on order, 4471. Do NOT drive her hard, Kai. You hear me, Hilde? Not hard.' },
  { id: 'n.rig.2', district: 'square', kind: 'rig', night: 3, step: 'q3.roof', from: 'Kai', text: 'Idea on a napkin: turret on the crane mount. Hilde can shoot while I fix. She will hate it. She will love it.' },
  { id: 'n.square.1', district: 'square', kind: 'shop', night: 1, from: 'the florist', text: 'Closed early. The ash came down like warm snow and my sister just stopped. She is still standing by the fountain. I could not move her. I am sorry, I ran.' },
  { id: 'n.square.2', district: 'square', kind: 'house', night: 1, from: 'a neighbour', text: 'The phone shows a blue line now. It says [Class pending]. Pending WHAT?' },
  { id: 'n.square.3', district: 'square', kind: 'church', night: 2, from: 'the sexton', text: 'They do not come into the church by day. They do not come in at night either. They stand at the door and listen to the bells that do not ring.' },

  // ---- the ring ----
  { id: 'n.ring.1', district: 'ring', kind: 'garage', night: 4, step: 'q4.garage', from: 'Kai', text: 'CLOSED FOR LUNCH. BACK BY ONE. — Kai. (The bench, the vice and the welder are still inside. Good. Nobody steals a welder.)' },
  { id: 'n.ring.2', district: 'ring', kind: 'shop', night: 1, from: 'Pizza Rapido', text: 'Lotte! You have one delivery left and it is to the water tower allotments AGAIN. Who orders pizza to a garden shed? Back by eight. — Enzo' },
  { id: 'n.ring.3', district: 'ring', kind: 'house', night: 1, from: 'a flat above the bakery', text: 'They go cold at sunrise. Grey, like statues. If you are quiet you can walk right past. If you are quiet.' },
  { id: 'n.ring.4', district: 'ring', kind: 'house', night: 2, from: 'a student', text: 'Day three. I tried shouting [Status]. Nothing. I tried [Inventory]. Nothing. I tried [Please]. Nothing. Anime lied to me.' },
  { id: 'n.ring.5', district: 'ring', kind: 'shop', night: 2, from: 'the hardware shop', text: 'Sold out of torches in an hour. Then the torches drew them right to the door. Note to self: dark is safer than bright.' },
  { id: 'n.ring.6', district: 'ring', kind: 'house', night: 3, from: 'a cat person', text: 'Mr Whiskers is fine. The Ash-Born do not care about cats. Cats are the true winners of all this.' },

  // ---- water tower hill ----
  { id: 'n.tower.1', district: 'tower', kind: 'shed', night: 2, step: 'q2.bunks', from: 'Lotte', text: 'If you can read this: I am UP the tower. The ladder fell. I have six slices of cold margherita and a torch. I will blink three times. Please have somewhere to sleep that is not a tower.' },
  { id: 'n.tower.2', district: 'tower', kind: 'shed', night: 2, step: 'q2.bunks', from: 'Lotte', text: 'They can not climb. Good to know. They also stand under the tower all night and HUM. Less good to know.' },
  { id: 'n.tower.3', district: 'tower', kind: 'house', night: 2, from: 'an allotment keeper', text: 'Tomatoes are ripe. Nobody to eat them. Take some. Leave the shed tidy.' },
  { id: 'n.tower.4', district: 'tower', kind: 'house', night: 3, from: 'a retired teacher', text: 'Strange. My neighbour the baker got a line too. [Class pending]. He cried. He said he only wanted to bake.' },

  // ---- main street ----
  { id: 'n.main.1', district: 'main', kind: 'house', night: 3, step: 'q3.stamps', from: 'Benno', text: 'Form 12-B, Household Check. Status: empty. Food: two tins. Pets: none. RECEIVED. Filed. Do not panic. — Town Hall, desk 4.' },
  { id: 'n.main.2', district: 'main', kind: 'shop', night: 3, step: 'q3.stamps', from: 'Benno', text: 'Notice: the town hall remains OPEN. Office hours 9 to 12. Knock three times. Please bring your own pen.' },
  { id: 'n.main.3', district: 'main', kind: 'house', night: 3, step: 'q3.stamps', from: 'Benno', text: 'Form 12-B. Status: the family left by car, east, day one. Good. RECEIVED. P.S. There are sleepers on my steps. I am not going out. I am filing.' },
  { id: 'n.main.4', district: 'main', kind: 'shop', night: 3, from: 'the bakery', text: 'Ovens off. They came for the heat of the ovens the first night. Never bake at night. Never.' },
  { id: 'n.main.5', district: 'main', kind: 'shop', night: 4, from: 'the bank', text: 'The vault is full of money and nobody wants it. Scrap is worth more now. My whole career, a joke.' },
  { id: 'n.main.6', district: 'main', kind: 'house', night: 4, from: 'a gamer', text: 'Theory: the System gives classes by job. My job was "content creator". I got nothing. Rude.' },
  { id: 'n.main.9', district: 'main', kind: 'townhall', night: 5, step: 'q5.order', from: 'Benno', text: 'Found it. Engine Works dispatch, order 4471: one crankshaft, recovery truck, for K. Brenner. Status: ready, not collected. Collect at the Works. Bring a big wrench.' },

  // ---- west gardens and the cinema ----
  { id: 'n.west.1', district: 'west', kind: 'house', night: 4, step: 'q4.cinema', from: 'a projectionist', text: 'They went into the cinema the first night and never came out. The projector lamp is still on. They love that lamp.' },
  { id: 'n.west.2', district: 'west', kind: 'shop', night: 4, step: 'q4.cinema', from: 'the ticket booth', text: 'Last show: 19:30, sold out. There is something at the back of the hall now. It glows and it beats like a heart.' },
  { id: 'n.west.3', district: 'west', kind: 'house', night: 3, from: 'a gardener', text: 'More sleep in the cinema every dawn. Like it calls them home.' },
  { id: 'n.west.4', district: 'west', kind: 'house', night: 4, from: 'a kid\'s diary', text: 'Mum says the grey people are just very very tired. I said so am I. She laughed. First laugh in a week.' },

  // ---- east estates ----
  { id: 'n.east.1', district: 'east', kind: 'house', night: 1, from: 'a commuter', text: 'Car will not start. Nothing with a chip starts. The old tractor next door runs fine. Figures.' },
  { id: 'n.east.2', district: 'east', kind: 'house', night: 2, from: 'a nurse', text: 'Not a disease. No fever, no pulse change. They just went still and grey, and at night the cracks glow. I have no word for it.' },
  { id: 'n.east.3', district: 'east', kind: 'shop', night: 2, from: 'the supermarket', text: 'Freezers dead. Took what I could. Left the crisps. Nobody is that desperate. Yet.' },
  { id: 'n.east.4', district: 'east', kind: 'house', night: 3, from: 'a neighbour', text: 'Saw a girl in a yellow jumpsuit fighting them with a WRENCH. And a little gun made of nails?? Hollowmere has a hero. A weird one.' },
  { id: 'n.east.5', district: 'east', kind: 'school', night: 4, from: 'a teacher', text: 'Register for class 4B: twenty names. Sixteen ticked "here". I will not write the others down.' },

  // ---- the mast field ----
  { id: 'n.masts.1', district: 'masts', kind: 'shed', night: 5, step: 'q5.gus', from: 'Gus', text: 'Mast Two hut. Generator coughs, my knee coughs louder. If you are the one with the wrench: the fuel line is cracked. Bring scrap, I have the coffee.' },
  { id: 'n.masts.2', district: 'masts', kind: 'house', night: 5, step: 'q5.gus', from: 'Gus', text: 'The masts have had no power since the ash. They broadcast anyway. Every night at 3:00. Same voice. Not a human one.' },
  { id: 'n.masts.3', district: 'masts', kind: 'house', night: 4, from: 'a farmer', text: 'The masts hum at night and the sleepers face them. All of them. Like sunflowers.' },

  // ---- station and works ----
  { id: 'n.north.1', district: 'north', kind: 'shed', night: 6, step: 'q6.shed', from: 'a rail worker', text: 'The goods shed is warm. Too warm. It feeds the Works, everyone knows that. The dead pass through like it is a station.' },
  { id: 'n.north.2', district: 'north', kind: 'house', night: 6, step: 'q6.shed', from: 'a signal box', text: 'Points to the Works are stuck. Shed blocks the yard road. Clear the shed, clear the way.' },
  { id: 'n.north.3', district: 'north', kind: 'shop', night: 5, from: 'the station kiosk', text: 'Last train: 17:52. It never left. The driver is still in the cab. Grey. He has his hand on the horn.' },
  { id: 'n.north.4', district: 'north', kind: 'house', night: 5, from: 'a night-shift worker', text: 'I clocked in for the night shift and the whole Works went quiet. Then the furnace lit by itself.' },
  { id: 'n.works.1', district: 'north', kind: 'factory', night: 7, step: 'q7.halls', from: 'the shift board', text: 'Hall A: crankshafts. Hall B: heads and blocks. Hall C: press line. Do not stand under the press.' },
  { id: 'n.works.2', district: 'north', kind: 'factory', night: 7, step: 'q7.halls', from: 'a locker', text: 'Twelve years on the press line and I never once got a class. Then the ash came and the System said [Class pending]. Twelve years! Pending!' },
  { id: 'n.works.3', district: 'north', kind: 'factory', night: 7, step: 'q7.halls', from: 'the dispatch desk', text: 'Rack 9: orders ready for pickup. 4469, 4470, 4471. Somebody come get these.' },
  { id: 'n.works.4', district: 'north', kind: 'factory', night: 7, step: 'q7.heart', from: 'a scrawl on the press', text: 'It grew round the press. It is warm and it beats and every sleeper in town beats with it. Break it and they will feel it.' },
];

export const GRAFFITI = [
  { id: 'g.square.1', district: 'square', where: 'the fountain rim', night: 1, step: 'q1.salvage', text: 'QUIET BY DAY. LOUD BY NIGHT. LIGHT = TROUBLE.' },
  { id: 'g.square.2', district: 'square', where: 'the church door', night: 1, text: 'NOBODY KNOWS WHAT THE BLUE LINE WANTS' },
  { id: 'g.square.3', district: 'square', where: 'the bus shelter', night: 2, text: 'THE YELLOW TRUCK GIRL IS OK. FOLLOW THE WRENCH →' },
  { id: 'g.square.4', district: 'square', where: 'the cobbles, in chalk, where the Rig stood', night: 7, step: 'q7.roll', text: 'HILDE WAS HERE. SO WERE WE.' },
  { id: 'g.ring.1', district: 'ring', where: 'Brenner\'s Garage shutter', night: 4, step: 'q4.garage', text: 'KAI — YOUR BENCH IS STILL HERE. WE DIDN\'T TOUCH IT. PROMISE.' },
  { id: 'g.ring.2', district: 'ring', where: 'the old town wall', night: 1, text: 'CLASS PENDING. LIFE PENDING. EVERYTHING PENDING.' },
  { id: 'g.ring.3', district: 'ring', where: 'Pizza Rapido window', night: 2, text: 'LOTTE COME HOME ♥ — ENZO' },
  { id: 'g.tower.1', district: 'tower', where: 'the water tower base', night: 2, step: 'q2.bunks', text: 'HELP ↑ NO LADDER ↑ HAVE PIZZA' },
  { id: 'g.tower.2', district: 'tower', where: 'an allotment shed', night: 3, text: 'THEY CAN\'T CLIMB. BE A CAT.' },
  { id: 'g.main.1', district: 'main', where: 'the town hall wall', night: 3, step: 'q3.stamps', text: 'OFFICE OPEN. KNOCK 3 TIMES.' },
  { id: 'g.main.2', district: 'main', where: 'the bank shutter', night: 3, text: 'MONEY IS SCRAP NOW' },
  { id: 'g.main.3', district: 'main', where: 'the bakery wall', night: 4, text: 'NO OVENS AFTER DARK!!!' },
  { id: 'g.west.1', district: 'west', where: 'the cinema poster', night: 3, step: 'q3.glow', text: 'NOW SHOWING: THEM. EVERY NIGHT.' },
  { id: 'g.west.2', district: 'west', where: 'the cinema side door', night: 4, step: 'q4.cinema', text: 'THE HEART IS IN HALL 1. HIT IT HARD.' },
  { id: 'g.west.3', district: 'west', where: 'a garden gate', night: 4, text: 'THE CINEMA CALLS THEM HOME' },
  { id: 'g.east.1', district: 'east', where: 'the school fence', night: 2, text: 'SCHOOL\'S OUT. FOREVER?' },
  { id: 'g.east.2', district: 'east', where: 'a garage door', night: 3, text: 'OLD ENGINES RUN. NEW ONES DON\'T.' },
  { id: 'g.masts.1', district: 'masts', where: 'the Mast Two fence', night: 5, step: 'q5.gus', text: 'GUS IS IN THE HUT. BRING SCRAP. SHE HAS COFFEE.' },
  { id: 'g.masts.2', district: 'masts', where: 'the base of Mast One', night: 5, text: 'WHO IS TALKING AT 3:00?' },
  { id: 'g.north.1', district: 'north', where: 'the goods shed doors', night: 6, step: 'q6.shed', text: 'SHED FEEDS THE WORKS. KILL THE SHED.' },
  { id: 'g.north.2', district: 'north', where: 'the Engine Works gate', night: 7, step: 'q7.gate', text: 'IT NEVER GETS DARK IN THERE. IT NEVER GETS LIGHT EITHER.' },
  { id: 'g.north.3', district: 'north', where: 'the station platform', night: 5, text: 'LAST TRAIN: NEVER' },
];

// broadcasts: a car radio crackles when you salvage a car (the first car each night), the Rig radio plays at dusk
// once Gus is home. The 3:00 voice is the masts: it reads like the System but nobody sent it.
export const RADIO = [
  { id: 'r.1', night: 1, src: 'car', from: 'emergency service', text: '...stay indoors... keep lights low... help is on the... (static)' },
  { id: 'r.2', night: 2, src: 'car', from: 'the 3:00 voice', text: '[Registry check] Hollowmere. Population: pending. Classes: one.' },
  { id: 'r.3', night: 3, src: 'car', from: 'a trucker', text: 'Anyone on this band? Old diesels still run. If your engine has no chip, it is gold. Keep it.' },
  { id: 'r.4', night: 4, src: 'car', from: 'Gus', text: 'Mast Field to anyone with a wrench. I saw your nail gun from up the hill. Nice work. I have a radio, a broken generator and a bad knee. Hut at Mast Two.' },
  { id: 'r.5', night: 5, src: 'car', from: 'Gus', text: 'Still here. Still have coffee. Fuel line is the problem. You will know it when you see it, it is the one that is leaking.' },
  { id: 'r.6', night: 5, src: 'rig', from: 'the 3:00 voice', text: '[Registry update] Mechanic: one. Seeking: Cook. Medic. Smith. Courier: pending.' },
  { id: 'r.7', night: 5, src: 'rig', from: 'Gus', text: 'That voice. No power at the masts and it still talks. The sleepers turn to face it. I do not like it.' },
  { id: 'r.8', night: 6, src: 'any', from: 'the 3:00 voice', text: '[Movement: north] [Movement: south] [Advisory: hold position]' },
  { id: 'r.9', night: 6, src: 'any', from: 'a girl, far away', text: '...if your engine runs... Reedwater Lock... we have a crane and no one to fix it...' },
  { id: 'r.10', night: 7, src: 'any', from: 'the 3:00 voice', text: '[Infestation: Engine Works] [Core: active] [Recommended: Mechanic]' },
  { id: 'r.11', night: 7, src: 'any', from: 'the 3:00 voice', text: '[Core destroyed] [Ash activity: all sectors] [Advisory: leave]' },
  { id: 'r.12', night: 7, src: 'rig', from: 'the 3:00 voice, then a girl', text: '[Region complete: Hollowmere] [Registry: Mechanic, one. Seeking: Cook, Medic, Smith.] ... then a girl, close now: "Reedwater Lock. North-east. Bring the yellow truck."' },
];
