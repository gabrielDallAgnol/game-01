// The storybook palette: every token is a valid sRGB hex, the ink is dark and warm, the Ash-Born skin is charcoal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PAL } from '../src/render/palette.js';

const hex = /^#[0-9a-f]{6}$/i, lum = h => { const n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
const leaves = (o, out = []) => { for (const v of Object.values(o)) typeof v === 'string' ? out.push(v) : leaves(v, out); return out; };
test('every palette token is a hex colour', () => { for (const v of leaves(PAL)) assert.match(v, hex, v); });
test('ink is dark and warm (r >= b)', () => { assert.ok(lum(PAL.ink) < 0.15); assert.ok(parseInt(PAL.ink.slice(1, 3), 16) >= parseInt(PAL.ink.slice(5, 7), 16)); });
test('Ash-Born skin is charcoal, ember is orange', () => { for (const v of Object.values(PAL.ash)) assert.ok(lum(v) < 0.25, v); assert.ok(parseInt(PAL.ember.slice(1, 3), 16) > 200 && parseInt(PAL.ember.slice(5, 7), 16) < 80); });
test('day is brighter than night', () => { assert.ok(lum(PAL.day.bg) > lum(PAL.night.bg) * 3); });
