// [hero3] The abilities your stats unlock (sim/powers.js runs them). Each stat has a line: its ability at 10 points,
// a second rank at 20, a capstone at 30. Two stats at HYBRID_AT (content/stats.js) each unlock their combination.
// Many are this week's class signatures (branch fix-classes2) reborn: the Brawler's Shockwave and Berserk, Smoke Step,
// the Ranger's Hawk and Rain, the Scavver's Crew, the Medic's Arise, the Druid's Wolf Form.
// Numbers: `dmg` is a multiple of your own hit (heroDmg), `hp` of your max health; INT's ability power scales every
// active's dmg and its cooldown cut every cd. kind: 'active' (a button) · 'passive' (always on).
export const ABILITIES = {
  // ---------- STR: Heavy Cleave → Shockwave → Unbreakable ----------
  cleave: { name: 'Heavy Cleave', stat: 'str', at: 10, kind: 'active', icon: 'fist', cd: 14,
    r: 3.2, dmg: 2.4, push: 1.6, stun: 0.6,
    rank2: { name: 'Shockwave Cleave', r: 4.4, dmg: 3, push: 2.8, stun: 1, cd: 12 },
    how: 'A two-handed swing round you: every dead in reach is hit hard and thrown back.', how2: 'Rank 2: wider, harder, the dead fly further and lose their next bite.' },
  unbreak: { name: 'Unbreakable', stat: 'str', at: 30, kind: 'passive', icon: 'shield',
    below: 0.3, dur: 8, dmgK: 1.5, rate: 1.3, every: 60,
    how: 'Once a minute, when you drop under 30% health in a fight: 8 s nothing brings you down, and you hit 50% harder.' },
  // ---------- AGI: Blink Strike → Chain Blink → Smoke Step ----------
  blink: { name: 'Blink Strike', stat: 'agi', at: 10, kind: 'active', icon: 'boots', cd: 10,
    reach: 7, dmg: 2.6, splash: 1.5, splashK: 0.8, chain: 0,
    rank2: { name: 'Chain Blink', reach: 9, dmg: 3, chain: 2, cd: 8 },
    how: 'Flash to the toughest dead within 7 cells and strike it, and the ones beside it.', how2: 'Rank 2: reach 9, and you blink on through two more.' },
  smoke: { name: 'Smoke Step', stat: 'agi', at: 30, kind: 'passive', icon: 'smoke',
    dur: 4, r: 10, dmgK: 1.5,
    how: 'After a Blink Strike you vanish for 4 s: the dead near you lose your scent, and your hits land 50% harder.' },
  // ---------- INT: Aether Burst → Aether Rain → Spirit Hawk ----------
  burst: { name: 'Aether Burst', stat: 'int', at: 10, kind: 'active', icon: 'flame', cd: 14,
    reach: 9, r: 2.6, dmg: 2.2, waves: 1,
    rank2: { name: 'Aether Rain', r: 3.2, waves: 4, dmg: 1.1, cd: 13 },
    how: 'The charge in your blood bursts on the thickest crowd within 9 cells.', how2: 'Rank 2: it keeps raining down, four pulses, wider.' },
  hawk: { name: 'Spirit Hawk', stat: 'int', at: 30, kind: 'passive', icon: 'eye',
    r: 10, every: 4, mark: 1.4, markT: 6,
    how: 'A hawk of light circles you and marks the toughest dead: everything hits it 40% harder.' },
  // ---------- GOV: Rally Cry → Rally Banner → Hired Crew ----------
  rally: { name: 'Rally Cry', stat: 'gov', at: 10, kind: 'active', icon: 'horn', cd: 30,
    r: 8, dur: 10, tower: 1.4, heal: 0.25, mend: 0.1,
    rank2: { name: 'Rally Banner', r: 12, dur: 15, tower: 1.6, cd: 26 },
    how: 'Towers within 8 cells fire 40% faster for 10 s; you and your allies heal a quarter; walls mend a little.', how2: 'Rank 2: 12 cells, 15 s, 60% faster.' },
  crew: { name: 'Hired Crew', stat: 'gov', at: 30, kind: 'passive', icon: 'people',
    n: 2, hp: 0.5, dmg: 0.4,
    how: 'Two of your coworkers fight beside you. The fallen are back at dawn.' },
  // ---------- hybrids: two stats at 15+ each ----------
  whirl: { name: 'Whirlwind', pair: ['str', 'agi'], kind: 'passive', icon: 'sword', every: 3,
    how: 'Every third swing hits everything in reach.' },
  radiant: { name: 'Radiant Blade', pair: ['str', 'int'], kind: 'passive', icon: 'star', every: 4, r: 1.8, dmg: 1.2,
    how: 'Your blade stores the charge: every fourth hit bursts in light round its target.' },
  iron: { name: 'Iron Warden', pair: ['str', 'gov'], kind: 'passive', icon: 'shield', r: 5, ward: 0.7,
    how: 'Buildings within 5 cells of you take 30% less damage.' },
  wild: { name: 'Wild Shape', pair: ['agi', 'int'], kind: 'active', icon: 'run', cd: 40,
    dur: 15, speed: 1.45, dmgK: 1.25, rate: 1.4,
    how: 'For 15 s you run as a wolf of embers: 45% faster, a harder, quicker bite.' },
  skirm: { name: 'Skirmish Commander', pair: ['agi', 'gov'], kind: 'passive', icon: 'flag', ally: 1.3, tower: 1.15,
    how: 'Your allies hit 30% harder; towers near you fire 15% faster.' },
  arise: { name: 'Raise the Fallen', pair: ['int', 'gov'], kind: 'active', icon: 'skull', cd: 25,
    r: 8, window: 25, cap: 6, hp: 0.4, dmg: 0.45,
    how: 'The dead that fell near you in the last 25 s rise and fight for you, till dawn.' },
};
export const ABILITY_ORDER = ['cleave', 'blink', 'burst', 'rally', 'unbreak', 'smoke', 'hawk', 'crew', 'whirl', 'radiant', 'iron', 'wild', 'skirm', 'arise'];
