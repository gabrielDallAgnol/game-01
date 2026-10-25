// [hero3] The Thermal Pioneer's stats: no class, four stats you raise with points (3 at the awakening, 3 a level, +1
// from a stat tome). What each point gives, the thresholds that unlock abilities (content/abilities.js), the titles
// your build earns, and the spread the bots and the autopilot spend by. Data only: sim/stats.js reads it.

/** the switch: on = stat points (class picks are off); off = the old Survivor → Calling → advanced class line */
export const STATS_FLAG = { on: true };

export const STAT_IDS = ['str', 'agi', 'int', 'gov'];
export const POINTS = { start: 3, perLevel: 3 };
export const THRESHOLDS = [10, 20, 30];   // a stat's own ability (10), its second rank (20), its capstone (30)
export const HYBRID_AT = 15;              // two stats at 15 or more each unlock their combination

// per point. Kept modest: the old Calling (+47% damage a second at Lv 15) and advanced class (×1.5 at Lv 30) are
// what a spread build of ~45 / ~90 points must roughly match, never beat by much. Tuned down after the first sweep
// (Oct 25: 2%/1.5% a point took the bot from a median of 12–13 nights to the 16-night cap).
export const STATS = {
  str: { name: 'STR', long: 'Strength', color: '#ff8a5c', icon: 'fist',
    per: { dmg: 0.006, hp: 0.3, hive: 0.02 },
    lines: p => { const q = STATS.str.per; return [`+${(p * q.dmg * 100).toFixed(0)}% damage`, `+${Math.round(p * q.hp)} health`, `+${Math.round(p * q.hive * 100)}% damage to hives`]; } },
  agi: { name: 'AGI', long: 'Agility', color: '#7dff9e', icon: 'run',
    per: { speed: 0.006, rate: 0.005, dodge: 0.002 }, dodgeMax: 0.2,
    lines: p => { const q = STATS.agi.per; return [`+${(p * q.speed * 100).toFixed(0)}% move speed`, `+${(p * q.rate * 100).toFixed(0)}% attack speed`, `${Math.round(Math.min(0.2, p * q.dodge) * 100)}% dodge`]; } },
  int: { name: 'INT', long: 'Intellect', color: '#7fc8ff', icon: 'skill',
    per: { power: 0.03, cd: 0.01, tower: 0.003 }, cdMax: 0.35,
    lines: p => { const q = STATS.int.per; return [`+${Math.round(p * q.power * 100)}% ability power`, `-${Math.round(Math.min(0.35, p * q.cd) * 100)}% cooldowns`, `+${(p * q.tower * 100).toFixed(0)}% fire rate, towers near you`]; } },
  gov: { name: 'GOV', long: 'Governance', color: '#ffd36a', icon: 'flag',
    per: { income: 0.012, build: 0.02, ally: 0.02 },
    lines: p => { const q = STATS.gov.per; return [`+${(p * q.income * 100).toFixed(0)}% scrap income`, `+${Math.round(p * q.build * 100)}% build speed`, `+${Math.round(p * q.ally * 100)}% ally and crew strength`]; } },
};
// v56 integration tune (Oct 25, after merging econ3/nest3/rig3/gemini3): the stat values a point gives, scaled as one
// (the sweep sat at the 16-night cap); the % lines read the scaled values at call time
export const STAT_TUNE = { per: 0.45 };
for (const k in STATS) for (const q in STATS[k].per) STATS[k].per[q] *= STAT_TUNE.per;

// the bots' and the autopilot's spread: each point goes to the stat furthest below its share (a fighter who leads)
export const AUTO_SPREAD = { str: 0.4, agi: 0.3, int: 0.15, gov: 0.15 };

// ---------- titles: the System names you by your build ----------
// one leading stat (≥ 60% of a total of 12+), two leading stats (each ≥ 30%), or a balanced build. The words are
// story3's to rewrite; the engine only picks the key.
export const TITLES_SOLO = {
  str: ['Ironhand Hauler', 'Rackbreaker', 'The Unbroken'],
  agi: ['Dock Runner', 'Ash Dancer', 'Flicker'],
  int: ['Spark Reader', 'Ember Sage', 'Aether Savant'],
  gov: ['Shift Lead', 'Warden of the Rig', 'Lord of the Haven'],
};
export const TITLES_PAIR = {
  'agi+str': 'Ashwind Reaver', 'int+str': 'Radiant Knight', 'gov+str': 'Iron Foreman',
  'agi+int': 'Wildfire Stalker', 'agi+gov': 'Skirmish Captain', 'gov+int': 'Pale Shepherd',
};
export const TITLE_BALANCED = ['Thermal Pioneer', 'Thermal Vanguard', 'Hollowmere Paragon'];
export const TITLE_START = 'Thermal Pioneer';
