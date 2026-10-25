// "The Solar Flare" words: the opening shows once, the world is Ash-Born and Inferno Nests (never zombies or miasma in
// player-facing text), the barks and the act/rig event lines exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { INTRO_CARDS, CANON, TONE_WORLD, ACTS, eventText, CREW_BIO, GAME_TITLE } from '../src/content/solar.js';
import { pick, pickWho, KINDS, CREW, CITIZEN } from '../src/content/barks.js';
import { introWanted, markIntroSeen, INTRO_KEY } from '../src/ui/intro.js';
import { MOBS } from '../src/content/mobs.js';

const mem = () => { const m = new Map(); return { get: (k, d) => (m.has(k) ? m.get(k) : d), set: (k, v) => m.set(k, v) }; };
const here = path.dirname(new URL(import.meta.url).pathname), SRC = path.join(here, '..', 'src');

test('the opening: five cards, ends on the System window, shown once per profile, ?intro= overrides', () => {
  assert.equal(INTRO_CARDS.length, 5);
  const last = INTRO_CARDS.at(-1); assert.ok(last.sys);
  assert.ok(last.lines.includes('[THERMAL PIONEER SYSTEM INITIALIZED]') && last.lines.includes('Unassigned Stat Points: 3'));
  assert.match(INTRO_CARDS.map(c => c.lines.join(' ')).join(' '), /Solar Zenith Flare|sun blinks/i);
  const st = mem();
  assert.equal(introWanted(st, ''), true, 'a fresh profile sees it');
  markIntroSeen(st); assert.equal(st.get(INTRO_KEY), true);
  assert.equal(introWanted(st, ''), false, 'the second time it is skipped');
  assert.equal(introWanted(st, '?intro=1'), true, '?intro=1 forces it');
  assert.equal(introWanted(mem(), '?intro=0'), false, '?intro=0 skips it');
  assert.equal(GAME_TITLE.sub, 'The Solar Flare');
});

test('barks: every kind has lines, pick is deterministic with a seeded rng, pickWho names the crew', () => {
  for (const k of KINDS) assert.ok(pick(k).length > 3, k);
  assert.equal(pick('nonsense'), '');
  const seq = a => { let i = 0; return () => a[i++ % a.length]; };
  assert.equal(pick('haul', seq([0.1])), pick('haul', seq([0.1])));
  const w = pickWho('heat', seq([0.1, 0.0, 0.0])); assert.ok(w.who && w.text);
  assert.ok(CITIZEN.haul.includes('Good haul today!') && CITIZEN.rigHolds.includes("Rig's holding!") && CITIZEN.heat.some(t => /rising to the east/.test(t)));
  assert.deepEqual(CREW.map(c => c.id).sort(), CREW_BIO.map(c => c.id).sort());
  assert.ok(CREW_BIO.some(c => /mechanic/i.test(c.role)) && CREW_BIO.some(c => /athlete/i.test(c.role)) && CREW_BIO.some(c => /manager/i.test(c.role)));
});

test('act and rig events have words (rigAnchor, rigMigrate, actStart 1 and 2); unknown events give null', () => {
  assert.match(eventText({ t: 'actStart', act: 1 }).text, /Depot Suburbs/);
  assert.match(eventText({ t: 'actStart', n: 2 }).text, /Rail Yard/);
  assert.ok(eventText({ t: 'rigAnchor' }).text.startsWith('[Rig anchored]'));
  assert.ok(eventText({ t: 'rigMigrate', n: 1 }).text.startsWith('[Migration]'));
  assert.equal(eventText({ t: 'dawn' }), null); assert.equal(eventText({ t: 'actStart', act: 9 }), null);
  assert.deepEqual(Object.keys(ACTS), ['1', '2']);
});

test('mob names are the Ash-Born varieties', () => {
  assert.equal(MOBS.brute.name, 'Slag Brute'); assert.equal(MOBS.walker.name, 'Cinder'); assert.equal(MOBS.risen.name, 'Husk');
  assert.ok(!Object.values(MOBS).some(m => /zombie|walker|gravelord/i.test(m.name)));
});

// ---------- no zombies in what the player reads ----------
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => (d.isDirectory() ? files(path.join(dir, d.name)) : d.name.endsWith('.js') ? [path.join(dir, d.name)] : []));
const stripComments = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
test('no zombie / miasma / undead in player-facing source (the canon in solar.js is the one intentional exception)', () => {
  const bad = [];
  for (const f of files(SRC).concat(path.join(SRC, '..', 'index.html'))) {
    if (f.endsWith(path.join('content', 'solar.js'))) continue;   // CANON names the words it forbids
    const t = f.endsWith('.html') ? fs.readFileSync(f, 'utf8') : stripComments(fs.readFileSync(f, 'utf8'));
    for (const m of t.matchAll(/\b(zombies?|miasma|undead)\b/gi)) bad.push(`${path.relative(SRC, f)}: ${m[0]}`);
  }
  assert.deepEqual(bad, []);
});
test('the content files say Ash-Born and Inferno Nest, not "the dead" or "hive" in their strings', () => {
  const bad = [];
  for (const f of files(path.join(SRC, 'content'))) {
    if (/solar\.js$|barks\.js$/.test(f)) continue;
    const t = stripComments(fs.readFileSync(f, 'utf8'));
    for (const lit of t.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || []) {
      if (!/ /.test(lit)) continue;
      const m = /\b(the dead|The dead|hives?|zombie)\b/.exec(lit.replace(/\{hive\}/g, '')); if (m) bad.push(`${path.basename(f)}: ${lit.slice(0, 70)}`);
    }
  }
  assert.deepEqual(bad, []);
});
