// [roam] Roam's golden runs must match test/roam-golden.json (see tools/roam/golden.mjs)
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
test('roam golden runs match', () => { assert.doesNotThrow(() => execFileSync(process.execPath, ['tools/roam/golden.mjs', '--check'], { stdio: 'pipe' })); });
