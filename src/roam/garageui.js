// [roam] The garage panel (M6): opened with GARAGE when Kai is at a workbench (the town's garage). Three tabs:
// - BIKE: the five slots (weapon, engine, frame, lamp, tyres), each with its level and UPGRADE (banked scrap, capped by
//   Kai's level); the weapon's built-in mods and its sockets. Tap an empty socket to put a mod in: it stays for good
//   (a second tap confirms; over an old mod, the old one is destroyed). CHANGE opens the stash for that slot.
// - BUILD: every known recipe by kind, its cost, BUILD (banked scrap and chips).
// - STASH: built gear waiting: EQUIP or SALVAGE; the mods Kai owns.
// The game pauses while it's open. Writes nothing but the API calls.
import { RECIPES, MOD_NAME, costOf } from '../play/recipes.js';
import { RARITY } from '../play/loot.js';
import { MODIFIERS } from '../play/modifiers.js';
import { PARTS } from '../play/parts/bike.js';
import { ROAM } from './sim.js';
const SLOTS = ['weapon', 'engine', 'frame', 'lamp', 'tyres'], SLOTN = { weapon: 'Weapon', engine: 'Engine', frame: 'Frame', lamp: 'Lamp', tyres: 'Tyres' };
const GROUPS = [['Weapons', r => r.kind === 'weapon'], ['Mods', r => r.kind === 'mod'], ['Engines', r => r.slot === 'engine'], ['Frames', r => r.slot === 'frame'], ['Lamps', r => r.slot === 'lamp'], ['Tyres', r => r.slot === 'tyres']];
export function createGarageUi({ sim, ui }) {
  const $ = id => document.getElementById(id), S = sim.state, panel = $('garage'), list = $('garList'), funds = $('garFunds'), msg = $('garMsg'), btn = $('garageBtn');
  let tab = 'bike', only = null, pick = null;   // pick: { i, mod } a socket being filled (the second tap confirms)
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const col = r => RARITY[r].color, nm = it => RECIPES[it.r].name;
  const NO = { bench: 'Only at the garage.', funds: 'Not enough banked scrap or chips.', cap: 'At the level cap: clean more areas to raise it.', nomod: 'You have none of that mod.', element: 'One element per weapon.', unknown: 'You don\'t know that recipe.', missing: 'Not there.' };
  const say = (t, warn) => { msg.textContent = t; msg.className = warn ? 'warn' : ''; };
  const cost = c => `⚙${c.scrap}${c.chips ? ' ◆' + c.chips : ''}`;
  const can = c => S.bank.scrap >= c.scrap && S.bank.chips >= c.chips;
  function statLine(slot, it) { const b = sim.bikeStats(), r1 = v => Math.round(v * 10) / 10;
    if (slot === 'weapon') return `damage ×${r1(1 + ROAM.garage.dmgPerLevel * (it.level - 1))}`;
    if (slot === 'engine') return `top ${r1(b.top)} m/s · accel ${r1(b.accel)}${b.ramMult > 1 ? ' · ram ×' + r1(b.ramMult) : ''}`;
    if (slot === 'frame') return `health ${b.hp} · soaks ${Math.round(b.soak * 100)}%`;
    if (slot === 'lamp') return `pulls scrap ${r1(b.pull)} m · reads rares ${r1(b.scan)} m${b.dazzle ? ' · dazzles ' + r1(b.dazzle) + ' m' : ''}`;
    return `turn ${r1(b.turn)} · bounce ${Math.round(b.bounce * 100)}%${b.crashMult < 1 ? ' · crashes ×' + b.crashMult : ''}`; }
  function bikeTab() { const cap = sim.levelCap(); let h = '';
    for (const slot of SLOTS) { const it = S.gear[slot], uc = sim.upCost(slot), n = S.stash.filter(q => q.slot === slot).length;
      h += `<div class="it" style="border-color:${col(it.rarity)}66"><div class="hd"><span class="sl">${SLOTN[slot]}</span><span class="nm" style="color:${col(it.rarity)}">${esc(nm(it))}</span><span class="lv">Lv ${it.level}/${cap}</span></div>`;
      h += `<div class="md">${statLine(slot, it)}</div>`;
      if (slot === 'weapon') { h += '<div class="sk">' + it.mods.map(m => `<span class="mod in" title="${esc(MODIFIERS[m].desc)}">${MOD_NAME[m]}</span>`).join('') + it.sockets.map((m, i) => `<button class="mod ${m ? 'full' : 'open'}${pick && pick.i === i ? ' on' : ''}" data-sock="${i}">${m ? MOD_NAME[m] : '+ socket'}</button>`).join('') + (it.mods.length + it.sockets.length ? '' : '<span class="md">no mods, no sockets</span>') + '</div>';
        if (pick) { const owned = Object.entries(S.mods).filter(([, c]) => c > 0);
          h += '<div class="pk">' + (owned.length ? owned.map(([m, c]) => `<button data-put="${m}" class="${pick.mod === m ? 'on' : ''}">${pick.mod === m ? 'CONFIRM: ' + MOD_NAME[m] + ' for good' : MOD_NAME[m] + ' ×' + c}</button>`).join('') : '<span class="md">No mods yet: build one in BUILD.</span>') + '</div>';
          if (it.sockets[pick.i]) h += `<div class="md warn">${MOD_NAME[it.sockets[pick.i]]} is in that socket: putting a mod over it destroys it.</div>`; } }
      h += `<div class="bt"><button data-up="${slot}" ${it.level >= cap || S.bank.scrap < uc ? 'disabled' : ''}>UPGRADE ⚙${uc}</button><button data-chg="${slot}" ${n ? '' : 'disabled'}>CHANGE${n ? ' (' + n + ')' : ''}</button></div></div>`; }
    return h; }
  function buildTab() { let h = '';
    for (const [title, f] of GROUPS) { const rs = S.known.map(id => RECIPES[id]).filter(r => r && f(r)); if (!rs.length) continue; h += `<h3>${title}</h3>`;
      for (const r of rs) { const c = costOf(r), have = r.kind === 'mod' ? S.mods[r.mod] || 0 : 0;
        h += `<div class="it row" style="border-color:${col(r.rarity)}55"><div><div class="nm" style="color:${col(r.rarity)}">${esc(r.name)}${have ? ' <span class="md">×' + have + '</span>' : ''}</div><div class="md">${esc(r.kind === 'weapon' ? weaponLine(r) : r.desc)}</div></div><button class="eq" data-build="${r.id}" ${can(c) ? '' : 'disabled'}>BUILD ${cost(c)}</button></div>`; } }
    return h + `<p class="md">${S.known.length} recipes known. Find more on machines; bank them to learn them.</p>`; }
  const weaponLine = r => `${r.base} · ${r.mods.length ? r.mods.map(m => MOD_NAME[m]).join(' + ') : 'no mods'} · ${r.sockets} socket${r.sockets === 1 ? '' : 's'}`;
  function stashTab() { const items = S.stash.filter(it => !only || it.slot === only); let h = only ? `<p class="md">${SLOTN[only]} only · <button class="lnk" data-all="1">show all</button></p>` : '';
    h += items.length ? items.map(it => { const c = costOf(RECIPES[it.r]); return `<div class="it" style="border-color:${col(it.rarity)}55"><div class="hd"><span class="sl">${SLOTN[it.slot]}</span><span class="nm" style="color:${col(it.rarity)}">${esc(nm(it))}</span><span class="lv">Lv ${it.level}</span></div>
      <div class="md">${esc(it.kind === 'weapon' ? weaponLine(RECIPES[it.r]) + (it.sockets.some(Boolean) ? ' · ' + it.sockets.filter(Boolean).map(m => MOD_NAME[m]).join(', ') : '') : PARTS[it.part].desc)}</div>
      <div class="bt"><button data-salv="${it.uid}">SALVAGE +⚙${Math.round(c.scrap * ROAM.garage.salvage)}</button><button class="eq" data-eq="${it.uid}">EQUIP</button></div></div>`; }).join('') : '<p class="empty">Nothing waiting. Build something in BUILD.</p>';
    const ms = Object.entries(S.mods).filter(([, c]) => c > 0); h += `<h3>Mods</h3>` + (ms.length ? ms.map(([m, c]) => `<div class="md">${MOD_NAME[m]} ×${c}: ${esc(MODIFIERS[m].desc)}</div>`).join('') : '<p class="md">None. Mods go into a weapon\'s sockets for good.</p>');
    return h; }
  function paint() { funds.textContent = `⌂ ⚙${S.bank.scrap} ◆${S.bank.chips}`; for (const b of panel.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.t === tab);
    list.innerHTML = tab === 'bike' ? bikeTab() : tab === 'build' ? buildTab() : stashTab(); }
  const did = (ok, good) => { if (ok) say(good); else { const e = S.events.slice().reverse().find(q => q.type === 'garageNo'); say(NO[e && e.why] || 'Can\'t.', true); } paint(); };
  panel.addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; const d = b.dataset;
    if (d.t) { tab = d.t; only = null; pick = null; say(''); paint(); return; }
    if (d.up) return did(sim.upgrade(d.up), `${SLOTN[d.up]} upgraded.`);
    if (d.chg) { tab = 'stash'; only = d.chg; pick = null; paint(); return; }
    if (d.all) { only = null; paint(); return; }
    if (d.sock !== undefined) { pick = pick && pick.i === +d.sock ? null : { i: +d.sock, mod: null }; say(pick ? 'Pick a mod for this socket. It stays there for good.' : ''); paint(); return; }
    if (d.put) { if (pick.mod !== d.put) { pick.mod = d.put; paint(); return; } const ok = sim.socket(S.gear.weapon.uid, pick.i, d.put); pick = null; return did(ok, `${MOD_NAME[d.put]} is in for good.`); }
    if (d.build) return did(sim.build(d.build), `Built: ${RECIPES[d.build].name}.`);
    if (d.eq) return did(sim.equipItem(+d.eq), 'Fitted.');
    if (d.salv) return did(sim.salvageItem(+d.salv), 'Salvaged.'); });
  const open = () => { panel.hidden = false; ui.paused = true; tab = 'bike'; only = null; pick = null; say(''); paint(); };
  const close = () => { panel.hidden = true; ui.paused = false; };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); open(); });
  for (const id of ['garDone', 'garX']) for (const t of ['pointerdown', 'pointerup', 'touchend', 'click']) $(id).addEventListener(t, e => { e.preventDefault(); e.stopPropagation(); close(); }, { passive: false });
  addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (k === 'g' && sim.atBench() && panel.hidden) open(); else if (k === 'escape' && !panel.hidden) close(); });
  let lastAt = null, told = false;
  function update(evs) { const at = sim.atBench(); if (at !== lastAt) { lastAt = at; btn.hidden = !at; if (at && !told) { told = true; ui.toast('The garage: build from your recipes, fit parts and mods. Tap GARAGE.', true); } } }
  return { update, open };
}
