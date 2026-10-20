// The refactor safety net: five scripted runs must hash exactly as recorded in test/golden.json (state + events, every
// night). A failure means behaviour changed. If the change is intended (a rule or balance change, not a refactor),
// re-record with: node tools/golden.mjs --write   (and say so in the commit message).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('golden runs: state and event hashes match test/golden.json byte for byte', () => {
  const tool = fileURLToPath(new URL('../tools/golden.mjs', import.meta.url));
  let out = '';
  try { out = execFileSync(process.execPath, [tool, '--check'], { encoding: 'utf8', maxBuffer: 1 << 24 }); }
  catch (e) { assert.fail(String(e.stdout || e.message)); }
  assert.match(out, /golden: identical/);
});
