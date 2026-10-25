// The V2 engine: atoms validate, sockets are symmetric, palettes cover every role atoms name,
// every recipe (area variant) is deterministic per seed and passes every fatal validator across seeds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chapter1Registry, buildChapter1 } from '../src/engine/chapter1.js';
import { createRegistry } from '../src/engine/registry.js';
import { SOCKETS, canConnect } from '../src/engine/sockets.js';
import { PALETTES, ROLES, missingRoles } from '../src/engine/palettes.js';
import { seedTree } from '../src/engine/seeds.js';
import { CH1_ATOMS } from '../src/atoms/ch1.js';
import { RECIPES, recipeRegistry, buildArea } from '../src/engine/recipes.js';
import { LOOKS } from '../src/engine/schema.js';
import { readFileSync } from 'node:fs';

test('the registry rejects a bad atom and a duplicate id', () => {
  const r = createRegistry();
  assert.throws(() => r.atom({ id: 'bad', kind: 'nope' }));
  r.atom(CH1_ATOMS[0]);
  assert.throws(() => r.atom(CH1_ATOMS[0]), /twice/);
});

test('every atom is frozen, sized in metres, and names only known roles and sockets', () => {
  const reg = chapter1Registry();
  for (const a of reg.list()) {
    assert.ok(Object.isFrozen(a), a.id);
    assert.ok(a.size[0] > 0 && a.size[0] < 60 && a.size[1] > 0 && a.size[1] < 60, `${a.id} size`);
    for (const role of a.roles || []) assert.ok(ROLES.includes(role), `${a.id} role ${role}`);
    for (const s of a.sockets) assert.ok(SOCKETS[s.type], `${a.id} socket ${s.type}`);
  }
});

test('sockets connect both ways', () => {
  for (const [a, def] of Object.entries(SOCKETS)) for (const b of def.connects) assert.ok(canConnect(b, a), `${a} → ${b} but not back`);
});

test('every chapter palette has every role', () => {
  for (const k of Object.keys(PALETTES)) assert.deepEqual(missingRoles(k), [], k);
});

test('seed nodes are stable and independent', () => {
  const a = seedTree(7).child('ch1').child('lot:3'), b = seedTree(7).child('ch1').child('lot:3'), c = seedTree(7).child('ch1').child('lot:4');
  assert.equal(a.value, b.value); assert.notEqual(a.value, c.value);
  assert.equal(a.rng().float(), b.rng().float());
});

test('a chapter build is deterministic for a seed', () => {
  const reg = chapter1Registry();
  const x = buildChapter1(11, reg), y = buildChapter1(11, reg), z = buildChapter1(12, reg);
  assert.equal(x.hash, y.hash); assert.notEqual(x.hash, z.hash);
});

for (const id of Object.keys(RECIPES)) test(`${id}: seeds 1–10 pass every fatal validator`, () => {
  const reg = recipeRegistry(id);
  for (let seed = 1; seed <= 10; seed++) {
    const r = buildArea(id, seed, reg);
    const bad = r.results.filter(v => v.fatal && !v.ok);
    assert.deepEqual(bad.map(v => `${v.name}: ${v.msg}`), [], `${id} seed ${seed}`);
    assert.ok(r.W.placed.length > 400, `${id} seed ${seed} is too empty`);
    for (const a of reg.list().filter(a => a.tags.includes('must'))) assert.ok(r.W.placed.some(p => p.id === a.id), `${id} seed ${seed} misses ${a.id}`);
  }
});

test('recipes differ and stay deterministic', () => {
  const a = buildArea('milltown', 4), b = buildArea('milltown', 4), c = buildArea('suburb', 4);
  assert.equal(a.hash, b.hash); assert.notEqual(a.hash, c.hash);
});

test('every look is drawn by the flat renderer, and it never checks an atom id', () => {
  const src = readFileSync(new URL('../src/engine/draw2d.js', import.meta.url), 'utf8');
  for (const look of LOOKS) assert.ok(look === 'none' || new RegExp(`\\b${look}\\(`).test(src), `no drawing for look ${look}`);
  assert.ok(!/\.id\.startsWith|p\.id ===|\.id\.includes/.test(src), 'draw2d must not branch on atom ids');
});

test('stages pick atoms by tag or need, never by id', () => {
  for (const f of ['forest', 'props', 'camp', 'terraces', 'mill', 'nest', 'buildings', 'bridges', 'civic', 'gridstreets', 'water', 'rail', 'millstreets', 'lots', 'roads', 'terrain', 'nav']) {
    const src = readFileSync(new URL(`../src/engine/stages/${f}.js`, import.meta.url), 'utf8');
    assert.ok(!/'[a-z]+\.[a-z0-9-]+\.[a-z0-9]+'/.test(src.replace(/^\/\/.*$/gm, '')), `${f}.js names an atom id`);
  }
});
