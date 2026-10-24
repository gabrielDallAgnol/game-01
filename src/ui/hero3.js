// [hero3] The Thermal Pioneer on screen: the System Status window (stats with + buttons, the abilities each
// threshold unlocks, the hybrids you are closing in on), the title chip under the strip (with unspent points), the
// "[+3 Stat Points]" moment, and the ability bar (one round button per active you hold, above the class button).
// It polls the game (no events needed); its CSS is injected here so index.html stays untouched.
import { $, $$, esc } from './shared.js';
import { icon } from './icons.js';
import { THRESHOLDS, HYBRID_AT } from '../content/stats.js';

const CSS = `
.h3chip{position:fixed;left:max(16px,env(safe-area-inset-left,0px));z-index:6;display:inline-flex;align-items:center;gap:8px;min-height:30px;padding:0 10px;border:1px solid var(--cyan-d);border-radius:2px;
  background:linear-gradient(180deg,rgba(10,26,44,.92),rgba(6,14,26,.92));color:var(--sys-text);font:600 12px/1 var(--mono);letter-spacing:.06em;box-shadow:0 0 14px rgba(60,170,255,.18);pointer-events:auto;cursor:pointer}
.h3chip .tt{color:var(--cyan)}.h3chip .pp{display:none;padding:3px 6px;background:var(--cyan);color:#04121d;border-radius:2px;animation:h3pulse 1.2s ease-in-out infinite}.h3chip.pts .pp{display:inline-block}
@keyframes h3pulse{50%{box-shadow:0 0 12px var(--cyan)}}
.h3boom{position:fixed;left:50%;top:28%;transform:translate(-50%,-50%);z-index:30;pointer-events:none;padding:14px 22px;border:1px solid var(--cyan);border-radius:2px;background:rgba(6,16,30,.94);
  color:var(--sys-text);font:700 22px/1.1 var(--mono);letter-spacing:.08em;text-align:center;box-shadow:0 0 40px rgba(80,190,255,.45),inset 0 0 18px rgba(127,227,255,.12);animation:h3boom 2.6s ease-out forwards}
.h3boom small{display:block;margin-top:6px;font:500 12px/1.3 var(--mono);color:var(--cyan);letter-spacing:.04em}
@keyframes h3boom{0%{opacity:0;transform:translate(-50%,-40%) scale(.85)}12%{opacity:1;transform:translate(-50%,-50%) scale(1.04)}20%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-60%)}}
.h3bar{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(var(--dockH,72px) + 92px);z-index:5;display:flex;flex-direction:column-reverse;gap:8px;pointer-events:none}
.h3ab{pointer-events:auto;position:relative;width:52px;height:52px;border-radius:50%;border:1px solid var(--cyan-d);background:radial-gradient(circle at 50% 35%,rgba(30,70,110,.95),rgba(6,16,30,.95));
  color:var(--sys-text);display:grid;place-items:center;padding:0;box-shadow:0 0 14px rgba(60,170,255,.25);overflow:hidden}
.h3ab svg{width:22px;height:22px}.h3ab .nm{position:absolute;bottom:5px;left:0;right:0;font:600 7.5px/1 var(--mono);letter-spacing:.04em;text-transform:uppercase;text-align:center;white-space:nowrap;overflow:hidden}
.h3ab.cool{color:rgba(217,244,255,.5)}.h3ab.cool::after{content:'';position:absolute;inset:0;background:conic-gradient(rgba(4,10,18,.72) calc(var(--cd,0) * 360deg),transparent 0)}
.h3ab .cs{position:absolute;inset:0;display:grid;place-items:center;font:700 15px/1 var(--mono);color:#fff;z-index:2;text-shadow:0 0 6px #000}
.h3ab.on{border-color:var(--cyan);box-shadow:0 0 18px var(--cyan)}
.h3w .h3head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}
.h3w .h3title{font:600 13px/1 var(--mono);color:var(--cyan);letter-spacing:.08em}
.h3w .h3pts{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0 4px;padding:10px 12px;border:1px solid var(--cyan-d);background:rgba(127,227,255,.06);font:600 14px/1.2 var(--mono)}
.h3w .h3pts b{font-size:20px;color:#fff}.h3w .h3pts.zero{opacity:.65}
.h3stat{display:grid;grid-template-columns:52px 1fr auto;gap:4px 10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--cyan-f)}
.h3stat .sn{font:700 15px/1 var(--mono);color:var(--sc)}.h3stat .sv{font:700 22px/1 var(--mono);color:#fff;text-align:left}
.h3stat .sl{grid-column:1/3;font:400 12px/1.4 var(--mono);color:rgba(217,244,255,.75)}
.h3stat .sb{grid-column:1/4;position:relative;height:6px;background:rgba(127,227,255,.08);border-radius:1px}
.h3stat .sb i{position:absolute;left:0;top:0;bottom:0;background:var(--sc);opacity:.85}
.h3stat .sb u{position:absolute;top:-3px;bottom:-3px;width:2px;background:rgba(255,255,255,.5)}
.h3stat .pl{display:flex;gap:6px;grid-row:1/3;grid-column:3}
.h3stat .pl button{min-width:44px;min-height:44px;border:1px solid var(--cyan-d);border-radius:2px;background:rgba(127,227,255,.12);color:#fff;font:700 18px/1 var(--mono)}
.h3stat .pl button:disabled{opacity:.25}
.h3abs{display:grid;gap:8px;margin-top:8px}
.h3a{display:grid;grid-template-columns:34px 1fr;gap:2px 10px;align-items:start;padding:10px;border:1px solid var(--cyan-f);background:rgba(127,227,255,.03);border-radius:2px}
.h3a .ai{grid-row:1/4;width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--cyan-f);border-radius:50%;color:var(--sc,var(--cyan))}
.h3a .an{font:700 14px/1.2 var(--mono);color:#fff}.h3a .an em{font-style:normal;font-weight:500;color:var(--cyan);font-size:11px;margin-left:6px;letter-spacing:.06em}
.h3a .ad{font:400 12px/1.4 var(--mono);color:rgba(217,244,255,.78)}
.h3a .aq{font:600 11px/1.3 var(--mono);color:var(--cyan);letter-spacing:.05em}
.h3a.lock{opacity:.5;filter:saturate(.3)}.h3a.got{border-color:var(--cyan-d);box-shadow:inset 0 0 14px rgba(127,227,255,.08)}
.h3a .hb{display:flex;gap:8px;margin-top:4px}.h3a .hb span{flex:1;height:4px;background:rgba(127,227,255,.1);position:relative}.h3a .hb i{position:absolute;inset:0 auto 0 0;background:var(--cyan)}
.h3w .h3row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
`;

export function createHero3Ui(ui) {
  const { strip } = ui;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const chip = document.createElement('button'); chip.className = 'h3chip'; chip.hidden = true; chip.setAttribute('aria-label', 'Your stats');
  chip.innerHTML = '<span class="tt"></span><span class="pp"></span>'; document.body.appendChild(chip);
  const bar = document.createElement('div'); bar.className = 'h3bar'; document.body.appendChild(bar);
  const on = () => !!(ui.game && ui.game.statsOn && ui.game.statsOn());
  const showStatusOld = ui.showStatus;

  // ---------- the System Status window ----------
  const statBy = id => ui.game.statsInfo().stats.find(s => s.id === id);
  function abilityHtml(a, I) {
    const v = s => I.stats.find(x => x.id === s).v;
    const color = a.stat ? statBy(a.stat).color : '#7fe3ff';
    let req;
    if (a.pair) req = `${a.pair.map(s => `${statBy(s).name} ${v(s)}/${HYBRID_AT}`).join(' + ')}`;
    else req = `${statBy(a.stat).name} ${a.at}${a.hasRank2 ? ` · rank 2 at ${THRESHOLDS[1]}` : ''}`;
    const hb = a.pair && !a.got ? `<div class="hb">${a.pair.map(s => `<span><i style="width:${Math.min(100, Math.round(v(s) / HYBRID_AT * 100))}%"></i></span>`).join('')}</div>` : '';
    return `<div class="h3a ${a.got ? 'got' : 'lock'}" style="--sc:${color}"><span class="ai">${icon(a.icon)}</span>
      <span class="an">${esc(a.name)}${a.got ? `<em>${a.kind === 'active' ? 'ACTIVE' : 'PASSIVE'}${a.rank === 2 ? ' · RANK 2' : ''}</em>` : ''}</span>
      <span class="ad">${esc(a.how)}${a.got && a.rank < 2 && a.how2 ? ` <i>${esc(a.how2)}</i>` : ''}</span>
      <span class="aq">${a.got ? '[Unlocked]' : `[Locked] ${esc(req)}`}</span>${hb}</div>`;
  }
  function showStats(keepScroll) {
    if (!ui.game) return;
    if (!on()) { showStatusOld(); return; }
    const S = ui.game.state, I = ui.game.statsInfo(), scroll = keepScroll ? $('#card').scrollTop : 0;
    ui.paused = true; if (ui.placing) ui.stopPlacing(); ui.closePanel();
    const next = v => THRESHOLDS.find(t => t > v) || 40;
    const line = I.abilities.filter(a => !a.pair), hyb = I.abilities.filter(a => a.pair);
    ui.showCard('status', `<div class="h3w"><button class="closex" id="h3X" aria-label="Close">${icon('close')}</button>
      <div class="eyebrow">[Status] Thermal Pioneer System</div>
      <div class="h3head"><h1 class="sm">Lv ${S.lvl} · ${Math.ceil(S.hero.hp)}/${S.hero.maxHp} HP</h1><span class="h3title">[${esc(I.title)}]</span></div>
      <div class="h3pts ${I.pts ? '' : 'zero'}"><span>Unassigned Stat Points</span><b>${I.pts}</b></div>
      ${I.stats.map(s => `<div class="h3stat" style="--sc:${s.color}"><span class="sn">${s.name}</span><span class="sv">${s.v}</span>
        <span class="pl"><button data-sp="${s.id}" data-n="1" ${I.pts ? '' : 'disabled'} aria-label="Raise ${s.long}">+</button>${I.pts >= 5 ? `<button data-sp="${s.id}" data-n="5" aria-label="Raise ${s.long} by 5">+5</button>` : ''}</span>
        <span class="sl">${esc(s.long)}: ${s.lines.map(esc).join(' · ')}</span>
        <span class="sb"><i style="width:${Math.min(100, s.v / 30 * 100)}%"></i>${THRESHOLDS.map(t => `<u style="left:${t / 30 * 100}%"></u>`).join('')}</span></div>`).join('')}
      <h2>Abilities</h2><p class="note">At ${THRESHOLDS.join(' / ')} points a stat unlocks its ability, its second rank, its capstone. Next: ${I.stats.map(s => `${s.name} ${next(s.v)}`).join(' · ')}.</p>
      <div class="h3abs">${line.map(a => abilityHtml(a, I)).join('')}</div>
      <h2>Hybrids</h2><p class="note">Two stats at ${HYBRID_AT} each unlock their combination.</p>
      <div class="h3abs">${hyb.map(a => abilityHtml(a, I)).join('')}</div>
      <div class="h3row"><button class="btn sys ghost" id="h3Auto">${I.auto ? 'Auto-assign: on' : 'Auto-assign: off'}</button><button class="btn sys ghost" id="h3Old">Quests · companions</button></div>
      <div class="cardrow foot end"><button class="btn big" id="h3Close">Back</button></div></div>`, { sys: true, arm: false, anim: !keepScroll });
    if (keepScroll) $('#card').scrollTop = scroll;
    const close = () => { ui.hideCard(); ui.paused = false; };
    $('#h3X').onclick = $('#h3Close').onclick = close;
    $('#h3Old').onclick = () => showStatusOld();
    $('#h3Auto').onclick = () => { ui.game.setStatAuto(!I.auto); if (!I.auto) ui.game.autoStats(); showStats(true); };
    $$('[data-sp]').forEach(b => b.onclick = () => { if (ui.game.spendStat(b.dataset.sp, +b.dataset.n)) showStats(true); });
  }

  // ---------- the chip, the moment, the ability bar ----------
  let lastPts = -1, lastTitle = '', barKey = '';
  function boom(text, sub) {
    const d = document.createElement('div'); d.className = 'h3boom'; d.innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 2700);
  }
  function tick() {
    if (!ui.game || !on() || ui.game.state.over || !ui.systemHere()) { chip.hidden = true; bar.innerHTML = ''; barKey = ''; return; }
    bar.hidden = !!ui.card;
    const S = ui.game.state, a = S.attr;
    // the chip sits under the strip, at its left edge
    // the chip sits under the top of the HUD (the strip, the camp bar, the forecast line), at the left edge
    const below = ['#strip', '#campBar', '#forecast'].map(q => $(q)).filter(e => e && !e.hidden && e.getBoundingClientRect().height > 0).map(e => e.getBoundingClientRect().bottom);
    chip.hidden = !below.length || !!ui.card; if (below.length) chip.style.top = `${Math.round(Math.max(...below) + 6)}px`;
    chip.querySelector('.tt').textContent = `[${a.title}]`;
    chip.classList.toggle('pts', a.pts > 0); chip.querySelector('.pp').textContent = `+${a.pts}`;
    if (lastPts >= 0 && a.pts > lastPts) boom(`[+${a.pts - lastPts} Stat ${a.pts - lastPts === 1 ? 'Point' : 'Points'}]`, 'Tap your title to assign them.');
    if (lastTitle && a.title !== lastTitle) boom(`[Title: ${a.title}]`);
    lastPts = a.pts; lastTitle = a.title;
    // the bar: rebuilt only when the set changes; cooldowns every tick
    const P = ui.game.powersInfo(), key = P.actives.map(x => x.id).join(',');
    if (key !== barKey) {
      barKey = key;
      bar.innerHTML = P.actives.map(x => `<button class="h3ab" data-pow="${x.id}" aria-label="${esc(x.name)}">${icon(ABI[x.id] || 'skill')}<span class="nm">${esc(x.name.split(' ')[0])}</span><span class="cs"></span></button>`).join('');
      $$('[data-pow]').forEach(b => b.onclick = e => { e.stopPropagation(); if (!ui.paused && ui.game) ui.game.usePower(b.dataset.pow); });
    }
    for (const x of P.actives) {
      const b = bar.querySelector(`[data-pow="${x.id}"]`); if (!b) continue;
      b.classList.toggle('cool', x.cd > 0); b.style.setProperty('--cd', x.cdMax ? x.cd / x.cdMax : 0);
      b.querySelector('.cs').textContent = x.cd > 0 ? Math.ceil(x.cd) : '';
      b.classList.toggle('on', (x.id === 'wild' && P.wild > 0) || (x.id === 'rally' && P.rally > 0));
    }
  }
  const ABI = { cleave: 'fist', blink: 'boots', burst: 'flame', rally: 'horn', wild: 'run', arise: 'skull' };
  chip.onclick = () => { if (ui.game && !ui.card && !ui.game.state.over) showStats(); };

  // the strip and the day pill open this window while the stats are on; the old one is a button inside it
  const up0 = ui.updateHud;
  const updateHud = () => { up0(); try { tick(); } catch (err) { /* the HUD must never stop the game */ } };
  const dp = $('#dayPill'); if (dp) dp.onclick = () => { if (ui.game && !ui.card && !ui.game.state.over) showStats(); };
  return { showStatus: showStats, showStatusOld, updateHud, heroTick: tick };
}
