// Turns balance results into tables. Also used by the balance tests.
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const pct = x => `${Math.round(x * 100)}%`;

export function groupBy(results, key) {
  const g = {}; for (const r of results) (g[r.job[key]] ||= []).push(r); return g;
}
export function summary(results) {
  const by = k => Object.fromEntries(Object.entries(groupBy(results, k)).map(([v, rs]) => [v, { runs: rs.length, median: med(rs.map(r => r.nights)), mean: +mean(rs.map(r => r.nights)).toFixed(1), claimed: +mean(rs.map(r => r.claimed)).toFixed(1) }]));
  return { all: { runs: results.length, median: med(results.map(r => r.nights)), mean: +mean(results.map(r => r.nights)).toFixed(1) }, hero: by('hero'), strat: by('strat'), expansion: by('expansion'), biome: by('biome') };
}
/** how often a night with a given threat ratio ends the run, per rating bucket */
export function calibration(results, edges = [0.25, 0.5, 0.75, 1.05, 1.45, 2, 3]) {
  const nights = results.flatMap(r => r.log.filter(l => l.ratio !== undefined));
  const rows = [];
  let lo = 0;
  for (const hi of [...edges, Infinity]) {
    const ns = nights.filter(l => l.ratio >= lo && l.ratio < hi);
    if (ns.length) rows.push({ ratio: `${lo}–${hi === Infinity ? '∞' : hi}`, nights: ns.length, lossRate: ns.filter(l => l.result === 'lost').length / ns.length, keepLeft: mean(ns.map(l => l.keep)), lost: mean(ns.map(l => l.lost)) });
    lo = hi;
  }
  return rows;
}
export function curve(results) {
  const byN = {};
  for (const r of results) for (const l of r.log) (byN[l.night] ||= []).push(l);
  return Object.entries(byN).map(([n, ls]) => ({ night: +n, runs: ls.length, waveHp: Math.round(mean(ls.map(l => l.waveHp))), defDps: +mean(ls.map(l => l.defDps)).toFixed(1), ratio: +mean(ls.map(l => l.ratio)).toFixed(2),
    keepLeft: mean(ls.map(l => l.keep)), lost: +mean(ls.map(l => l.lost)).toFixed(1), deaths: ls.filter(l => l.result === 'lost').length, gold: +mean(ls.map(l => l.gold || 0)).toFixed(0), secs: Math.round(mean(ls.map(l => l.secs))) }));
}
export function report(results) {
  const s = summary(results);
  const t = (title, o) => `\n${title}\n` + Object.entries(o).map(([k, v]) => `  ${k.padEnd(10)} runs ${String(v.runs).padStart(3)}  median night ${String(v.median).padStart(3)}  mean ${String(v.mean).padStart(5)}  regions ${v.claimed ?? ''}`).join('\n');
  let out = `All runs: ${s.all.runs}, median night reached ${s.all.median}, mean ${s.all.mean}`;
  out += t('By hero', s.hero) + t('By strategy', s.strat) + t('By expansion', s.expansion) + t('By map', s.biome);
  out += '\n\nThreat ratio vs outcome (calibrates Easy/Medium/Hard/Impossible)\n' + calibration(results).map(r => `  ratio ${r.ratio.padEnd(10)} nights ${String(r.nights).padStart(4)}  run ends ${pct(r.lossRate).padStart(4)}  keep left ${pct(r.keepLeft).padStart(4)}  buildings lost ${r.lost.toFixed(1)}`).join('\n');
  out += '\n\nPer-night curve\n' + curve(results).filter(r => r.night <= 40 && (r.night <= 10 || r.night % 5 === 0)).map(r => `  night ${String(r.night).padStart(2)} runs ${String(r.runs).padStart(3)} waveHp ${String(r.waveHp).padStart(5)} towerDps ${String(r.defDps).padStart(5)} ratio ${String(r.ratio).padStart(5)} keep ${pct(r.keepLeft).padStart(4)} lost ${String(r.lost).padStart(4)} deaths ${String(r.deaths).padStart(3)} bank ${String(r.gold).padStart(3)} secs ${r.secs}`).join('\n');
  return out;
}
