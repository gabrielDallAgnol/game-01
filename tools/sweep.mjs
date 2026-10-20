// Balance sweep in parallel: the clock bot over many seeds, split across the machine's cores.
// usage: node tools/sweep.mjs [difficulty] [days] [seeds] [hero] [auto]
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
const args = process.argv.slice(2), W = Math.max(1, cpus().length), rows = [];
await Promise.all(Array.from({ length: W }, (_, w) => new Promise(done => {
  const p = spawn(process.execPath, ['tools/clockbot.mjs', ...args], { env: { ...process.env, SEED_START: String(w), SEED_STRIDE: String(W) } });
  let buf = ''; p.stdout.on('data', d => { buf += d; }); p.on('close', () => { for (const l of buf.split('\n')) if (l.startsWith('{')) rows.push(JSON.parse(l)); done(); });
})));
rows.sort((a, b) => a.seed - b.seed);
const reached = rows.map(r => r.reached), sorted = [...reached].sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
console.log(`${args[0] || 'survivor'} · ${rows.length} runs on ${W} cores · fell ${rows.filter(r => r.fell).length} · reached ${reached.join(',')} · median ${med} · early deaths (<8) ${reached.filter(n => n < 8).length} · collapses (≥90% → fallen) ${rows.filter(r => r.collapse && r.fell).length} · contracts lost ${rows.filter(r => r.contractLost).length}`);
if (process.env.SWEEP_OUT) { const { writeFileSync } = await import('node:fs'); writeFileSync(process.env.SWEEP_OUT, rows.map(r => JSON.stringify(r)).join('\n') + '\n'); }
