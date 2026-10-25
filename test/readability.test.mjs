// [toppop] The top-down readability colours (src/render/readable.js) must pop against every town colour of every
// palette (src/engine/palettes.js): a perceptual distance in OKLab (ΔE ≥ 0.15 is a plain different colour, 0.02 is
// barely visible) and, where the signal is meant to read by lightness, a WCAG contrast ratio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES } from '../src/engine/palettes.js';
import { READ, TERRAIN_ROLES } from '../src/render/readable.js';

const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = h => [1, 3, 5].map(i => lin(parseInt(h.slice(i, i + 2), 16) / 255));
const lum = h => { const [r, g, b] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const oklab = h => { const [r, g, b] = rgb(h), l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]; };
const dE = (a, b) => { const p = oklab(a), q = oklab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const town = pal => Object.entries(PALETTES[pal]).filter(([k, v]) => TERRAIN_ROLES.test(k) && /^#[0-9a-f]{6}$/i.test(v));
const worst = (c, pal) => town(pal).map(([k, v]) => ({ k, e: dE(c, v), cr: ratio(c, v) })).sort((a, b) => a.e - b.e)[0];

// the signals and how far each must stand from every town colour (the ember is an accent on a dark body, so a bit less)
const SIGNALS = { hero: 0.2, own: 0.18, deadEmber: 0.12 };

for (const pal of Object.keys(PALETTES)) {
  test(`readability: the signals stand off every town colour (${pal})`, () => {
    for (const [name, min] of Object.entries(SIGNALS)) { const w = worst(READ[name], pal); assert.ok(w.e >= min, `${name} ${READ[name]} vs ${w.k}: ΔE ${w.e.toFixed(3)} < ${min}`); }
    // a dead token is an ash body inside an ember rim: on any town colour one of the two must stand off plainly
    for (const [k, v] of town(pal)) { const e = Math.max(dE(READ.dead, v), dE(READ.deadEmber, v)); assert.ok(e >= 0.2, `dead token vs ${k}: ΔE ${e.toFixed(3)}`); }
  });
}

test('readability: the dead read by lightness on the ground, the ember on the asphalt', () => {
  for (const pal of ['ch1', 'road', 'ch2']) {
    const P = PALETTES[pal];
    for (const r of ['ground.base', 'ground.lawn', 'ground.field', 'road.walk']) assert.ok(ratio(READ.dead, P[r]) >= 3.5, `dead vs ${pal} ${r}: ${ratio(READ.dead, P[r]).toFixed(2)}`);
  }
  for (const pal of ['ch1', 'road', 'ch2']) { const a = PALETTES[pal]['road.asphalt']; assert.ok(ratio(READ.deadEmber, a) >= 2 && dE(READ.deadEmber, a) >= 0.3, `ember vs ${pal} asphalt: ${ratio(READ.deadEmber, a).toFixed(2)} / ΔE ${dE(READ.deadEmber, a).toFixed(3)}`); }
  assert.ok(ratio(READ.heroInk, PALETTES.ch1['ground.lawn']) >= 7 && ratio(READ.deadInk, PALETTES.ch1['ground.lawn']) >= 7, 'the ink edges are dark');
});

test('readability: hero, mine and the dead never read as each other', () => {
  const pairs = [['hero', 'own'], ['hero', 'deadEmber'], ['own', 'deadEmber'], ['hero', 'dead'], ['own', 'dead']];
  for (const [a, b] of pairs) assert.ok(dE(READ[a], READ[b]) >= 0.2, `${a} vs ${b}: ΔE ${dE(READ[a], READ[b]).toFixed(3)}`);
});
