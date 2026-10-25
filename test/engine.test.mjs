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
import { readFileSync, readdirSync } from 'node:fs';
import { DISTRICT_LOOKS } from '../src/engine/palettes.js';
import { HOLLOWMERE_ATOMS } from '../src/atoms/hollowmere.js';
import { nodeNetwork, reachableNetwork } from '../src/engine/network.js';
import { pointInPoly } from '../src/engine/geom.js';

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
  const files = readdirSync(new URL('../src/engine/stages/', import.meta.url)).filter(f => f.endsWith('.js'));
  assert.ok(files.length >= 24, 'every stage file is scanned');
  for (const f of files) {
    const src = readFileSync(new URL(`../src/engine/stages/${f}`, import.meta.url), 'utf8');
    assert.ok(!/'[a-z]+\.[a-z0-9-]+\.[a-z0-9]+'/.test(src.replace(/^\/\/.*$/gm, '')), `${f}.js names an atom id`);
  }
});

// the existing variants are pinned: engine speed-ups and the town's hooks (terraces' per-street sides, buildings
// skipping built lots) must not move one of their worlds
test('suburb, milltown and downtown worlds are unchanged', () => {
  const pin = { 'suburb:1': 'ca5e409a', 'suburb:2': 'a3c0d94f', 'suburb:7': 'e6cf7b19', 'milltown:1': '6a3d0b70', 'milltown:4': '27720913', 'milltown:9': 'ed271502', 'downtown:1': '103ba890', 'downtown:5': '46551673', 'downtown:10': 'f5502816' };
  for (const [k, h] of Object.entries(pin)) { const [id, seed] = k.split(':'); assert.equal(buildArea(id, +seed).hash, h, k); }
});

test('the network module splits crossings and T-junctions into nodes and drops what the start cannot reach', () => {
  const P = (x, y) => ({ x, y }), net = nodeNetwork([{ a: P(0, 50), b: P(100, 50) }, { a: P(50, 0), b: P(50, 100) }, { a: P(80, 50), b: P(80, 90) }, { a: P(200, 200), b: P(260, 200) }]);
  assert.equal(net.streets.length, 7);   // the cross makes 4 arms, the T splits one arm, plus the T's stem and the island
  const hub = net.nodes.find(n => n.x === 50 && n.y === 50); assert.equal(hub.deg, 4);
  const kept = reachableNetwork(net, hub.id); assert.equal(kept.streets.length, 6); assert.equal(kept.dropped, 1);
});

test('district looks name only palette roles', () => {
  for (const [k, L] of Object.entries(DISTRICT_LOOKS)) { assert.ok(ROLES.includes(L.tint), `${k} tint`); for (const [a, b] of Object.entries(L.roofs)) assert.ok(ROLES.includes(a) && ROLES.includes(b), `${k} ${a}→${b}`); }
});

test('hollowmere atoms offer only what the game maps, and the finale is a nest', () => {
  const vocab = /^(medicine|law|learning|signal|iron|work|shop|salvage|shelter|home:\d+)$/;
  for (const a of HOLLOWMERE_ATOMS) for (const o of a.offers || []) assert.match(o, vocab, `${a.id} offers ${o}`);
  const fin = HOLLOWMERE_ATOMS.filter(a => a.tags.includes('finale')); assert.equal(fin.length, 1); assert.ok(fin[0].tags.includes('nest'));
  assert.ok(HOLLOWMERE_ATOMS.filter(a => a.tags.includes('nestable')).length >= 2);
});

// the town's shape, on every seed: Nauen's plan, as promised to the game
test('hollowmere: the ring is closed, the main street comes from the south, the square is central, the station north, the masts south-west', () => {
  const reg = recipeRegistry('hollowmere'), times = [];
  for (let seed = 1; seed <= 10; seed++) {
    const t0 = performance.now(), r = buildArea('hollowmere', seed, reg); times.push(performance.now() - t0);
    const W = r.W, T = W.town, at = `seed ${seed}`, S = W.sites;
    assert.ok(r.results.find(v => v.name === 'the ring street is closed').ok, `${at} ring`);
    const ringTop = Math.min(...T.ring.map(p => p.y)), ringBottom = Math.max(...T.ring.map(p => p.y)), ringLeft = Math.min(...T.ring.map(p => p.x));
    assert.ok(ringBottom - ringTop > 230 && ringBottom - ringTop < 320, `${at} the old town is ~300 m across`);
    // the main street: one straight line of pieces from the south edge to the square
    const south = W.streets.filter(s => s.role === 'south' || (s.role === 'main' && T.loc(s.pts[0].x, s.pts[0].y).y > 0));
    assert.ok(south.some(s => Math.max(s.pts[0].y, s.pts[1].y) > W.h - 4), `${at} the main street reaches the south edge`);
    assert.ok(south.every(s => Math.abs(T.loc(s.pts[0].x, s.pts[0].y).x) < 1 && Math.abs(T.loc(s.pts[1].x, s.pts[1].y).x) < 1), `${at} the main street is straight`);
    assert.ok(S.townhall && S.townhall.y > T.F.y + 60 && Math.abs(S.townhall.x - T.F.x) < 30, `${at} the town hall stands at the south gate`);
    // the square: in the middle of the map, the church on it, the camp on it
    assert.ok(Math.hypot(W.plaza.x - W.w / 2, W.plaza.y - W.h / 2) < 40, `${at} the square is central`);
    const inPlaza = p => Math.abs(T.loc(p.x, p.y).x) < W.plaza.w / 2 && Math.abs(T.loc(p.x, p.y).y) < W.plaza.h / 2;
    assert.ok(S.church && inPlaza(S.church) && inPlaza(W.camp), `${at} St Jacobi and the camp are on the square`);
    assert.ok(S.school && Math.hypot(S.school.x - S.church.x, S.school.y - S.church.y) < 70, `${at} the school is beside the church`);
    // the north: the station beyond the ring, by the line; the finale in the works
    assert.ok(S.station && S.station.y < ringTop && Math.abs(S.station.x - T.F.x) < 20, `${at} the station is north, on the main axis`);
    assert.ok(W.rails.some(r => r.id === 'siding') && W.crossings.length >= 1, `${at} the works siding crosses the station road`);
    assert.ok(W.finale && W.placed.find(p => p.uid === W.finale.uid).def.tags.includes('finale'), `${at} the finale is placed`);
    assert.equal(W.districtAt(W.finale.x, W.finale.y).kind, 'industry', `${at} the finale is in the works`);
    assert.ok(S.watertower && S.watertower.x < T.F.x && S.watertower.y < T.F.y, `${at} the water tower is north-west`);
    // the masts south-west, outside the town
    assert.ok(S.masts.length >= 3 && S.masts.every(m => m.x < W.w / 3 && m.y > W.h * 0.6 && m.x < ringLeft + 40), `${at} the masts stand south-west`);
    // districts: at least the old town, a suburb, the rail and the works, all on the square's network
    const kinds = new Set(W.districts.map(d => d.kind)); for (const k of ['oldtown', 'suburb', 'rail', 'industry']) assert.ok(kinds.has(k), `${at} has a ${k} district`);
    assert.ok(W.districts.length >= 3 && r.results.find(v => v.name === 'every district reachable from the square').ok, `${at} districts reached`);
    assert.equal(W.districtAt(W.camp.x, W.camp.y).kind, 'oldtown', `${at} the camp is in the old town`);
    assert.ok(W.placed.every(p => p.district == null || W.districts[p.district]), `${at} district indices`);
    assert.ok(W.districts.every(d => d.poly.length >= 3 && d.palette), `${at} district polygons and palettes`);
    assert.ok(W.placed.filter(p => p.def.tags.includes('terrace') && p.district === 0).length > 120, `${at} the old town is built up`);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  assert.ok(avg < 1500, `a 600 × 500 m build takes ${avg.toFixed(0)} ms on average (target < 1000)`);
});
