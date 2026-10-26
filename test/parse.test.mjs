// Every source module parses. The sim tests import only the rules, so a syntax slip in a ui or render module
// (a stray brace left by a deletion) would otherwise show up only as a blank page in the browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : n.endsWith('.js') ? [p] : []; });

test('every module under src/ parses', () => {
  const bad = [];
  for (const f of walk(SRC)) { const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' }); if (r.status !== 0) bad.push(`${f.slice(SRC.length + 1)}: ${(r.stderr.split('\n').find(l => /Error/.test(l)) || '').trim()}`); }
  assert.deepEqual(bad, []);
});
