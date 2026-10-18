// Balance runner: bots play many seeded runs in parallel and we summarise the numbers.
//   node tools/balance.mjs [--runs 2] [--max 40] [--out reports/balance.json]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

if (!isMainThread) {
  const { createGame } = await import('../src/sim/game.js');
  const { playRun } = await import('./bot.mjs');
  for (const job of workerData.jobs) {
    const r = playRun(createGame, job);
    parentPort.postMessage({ job, nights: r.nights, claimed: r.claimed, log: r.log.map(l => ({
      night: l.night, result: l.result, keep: l.keepEnd / l.keepMax, lost: l.lost.length, risen: l.risen, ratio: l.ratio, purge: l.purge, wave: l.wave,
      waveHp: l.waveHp, defDps: l.defDps, heroDps: l.heroDps, gold: l.goldAtBell, goldIn: l.goldIn, spent: l.spent, secs: l.seconds, dmg: l.dmg, claimed: l.claimed, nests: l.nests,
    })) });
  }
} else {
  const runs = +arg('--runs', 2), max = +arg('--max', 40), out = arg('--out', 'reports/balance.json');
  const HEROES = (arg('--heroes', 'warrior,archer,merchant')).split(',');
  const STRATS = (arg('--strats', 'balanced,towers,economy,walls')).split(',');
  const EXP = (arg('--exp', 'never,careful,bold,reckless')).split(',');
  const PATHS = (arg('--paths', 'any')).split(',');
  const BIOMES = ['riverbend', 'highland', 'lakeshore'];
  const jobs = [];
  for (let s = 0; s < runs; s++) for (const hero of HEROES) for (const strat of STRATS) for (const expansion of EXP) for (const path of PATHS)
    jobs.push({ seed: 100 + s * 7 + jobs.length, biome: BIOMES[jobs.length % 3], hero, strat, expansion, path, maxNights: max });
  const nW = Math.max(1, Math.min(os.cpus().length, 4));
  const results = []; const t0 = Date.now();
  await Promise.all(Array.from({ length: nW }, (_, w) => new Promise((res, rej) => {
    const wk = new Worker(fileURLToPath(import.meta.url), { workerData: { jobs: jobs.filter((_, i) => i % nW === w) } });
    wk.on('message', m => { results.push(m); if (results.length % 10 === 0) process.stderr.write(`${results.length}/${jobs.length}\r`); });
    wk.on('error', rej); wk.on('exit', res);
  })));
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(out, JSON.stringify(results));
  console.log(`${results.length} runs in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const { report } = await import('./report.mjs');
  console.log(report(results));
}
