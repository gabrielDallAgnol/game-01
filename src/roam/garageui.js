// [roam] The garage panel (M6): opened with GARAGE when Kai is at a workbench (the town's garage). Three tabs:
// - BIKE: a picture of the bike with its five fitted parts (gun, engine, frame, lamp, tyres) labelled where they sit; tap
//   one to see it: its level and UPGRADE THIS <PART> (banked scrap, capped by Kai's level); the others in the stash for that
//   slot to try on (the bike shows the one you tap, glowing) and FIT; the gun's built-in mods
//   and its sockets. Tap an empty socket to put a mod in: it stays for good
//   (a second tap confirms; over an old mod, the old one is destroyed). CHANGE opens the stash for that slot.
// - BUILD: every known recipe by kind, its cost, BUILD (banked scrap and chips).
// - STASH: built gear waiting: EQUIP or SALVAGE; the mods Kai owns.
// [m6e] GARAGE has the bike ride itself into the bay in front of the doors (always the same angle, like Need for Speed:
// Most Wanted's garage); the panel opens once it's parked, and closing it rides the bike back out.
// The game pauses while it's open. Writes nothing but the API calls.
import { STARTING, RECIPES, MOD_NAME, costOf } from '../play/recipes.js';
import { RARITY } from '../play/loot.js';
import { MODIFIERS } from '../play/modifiers.js';
import { PARTS } from '../play/parts/bike.js';
import { ROAM } from './sim.js';
const SLOTS = ['weapon', 'engine', 'frame', 'lamp', 'tyres'], SLOTN = { weapon: 'Weapon', engine: 'Engine', frame: 'Frame', lamp: 'Lamp', tyres: 'Tyres' };
const GROUPS = [['Key items', r => r.kind === 'key'], ['Weapons', r => r.kind === 'weapon'], ['Mods', r => r.kind === 'mod'], ['Engines', r => r.slot === 'engine'], ['Frames', r => r.slot === 'frame'], ['Lamps', r => r.slot === 'lamp'], ['Tyres', r => r.slot === 'tyres']];
export function createGarageUi({ sim, ui, cam, lab }) {
  const $ = id => document.getElementById(id), S = sim.state, panel = $('garage'), list = $('garList'), funds = $('garFunds'), msg = $('garMsg'), btn = $('garageBtn');
  let tab = 'bike', only = null, pick = null, prev = null;   // [m6f] prev: a stash item tried on the bike (the bike shows it, the part glows)   // pick: { i, mod } a socket being filled (the second tap confirms)
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
  // [m6c] the real bike, close up (the camera comes in on it while the garage is open: garageview.js rings the part you
  // pick); below it a row of its five fitted parts, and the one you pick (Gabriel: the drawn diagram was confusing)
  let sel = 'weapon';
  const LABEL = { weapon: 'GUN', engine: 'ENGINE', frame: 'FRAME', lamp: 'LAMP', tyres: 'TYRES' };
  function partRow() { return '<div class="parts">' + SLOTS.map(slot => { const it = S.gear[slot]; return `<button data-sel="${slot}" class="${slot === sel ? 'on' : ''}" style="--c:${col(it.rarity)}"><b>${LABEL[slot]}</b><span>Lv ${it.level}</span></button>`; }).join('') + '</div>'; }
  function bikeTab() { const cap = sim.levelCap(), b = sim.bikeStats(), it = S.gear[sel], uc = sim.upCost(sel), n = S.stash.filter(q => q.slot === sel).length, what = sel === 'weapon' ? 'gun' : sel;
    let h = `<div class="bikehd"><span>YOUR BIKE</span><span class="md">health ${b.hp} · ${Math.round(b.top * 10) / 10} m/s · turn ${Math.round(b.turn * 10) / 10}</span></div>${partRow()}`;
    h += `<div class="it sel" style="border-color:${col(it.rarity)}"><div class="md up">FITTED ${what.toUpperCase()}</div><div class="hd"><span class="nm big" style="color:${col(it.rarity)}">${esc(nm(it))}</span><span class="lv">Lv ${it.level}/${cap}</span></div>`;
    h += `<div class="md">${esc(RECIPES[it.r].desc)}</div><div class="md st">${statLine(sel, it)}</div>`;
    if (sel === 'weapon') { h += '<div class="sk">' + it.mods.map(m => `<span class="mod in" title="${esc(MODIFIERS[m].desc)}">${MOD_NAME[m]} <i>built in</i></span>`).join('') + it.sockets.map((m, i) => `<button class="mod ${m ? 'full' : 'open'}${pick && pick.i === i ? ' on' : ''}" data-sock="${i}">${m ? MOD_NAME[m] : '+ empty socket'}</button>`).join('') + (it.mods.length + it.sockets.length ? '' : '<span class="md">no mods, no sockets</span>') + '</div>';
      if (pick) { const owned = Object.entries(S.mods).filter(([, c]) => c > 0);
        h += '<div class="pk">' + (owned.length ? owned.map(([m, c]) => `<button data-put="${m}" class="${pick.mod === m ? 'on' : ''}">${pick.mod === m ? 'CONFIRM: ' + MOD_NAME[m] + ' for good' : MOD_NAME[m] + ' ×' + c}</button>`).join('') : '<span class="md">No mods yet: beat an elite machine, or build one in BUILD.</span>') + '</div>';
        if (it.sockets[pick.i]) h += `<div class="md warn">${MOD_NAME[it.sockets[pick.i]]} is in that socket: putting a mod over it destroys it.</div>`; } }
    h += `<div class="bt"><button data-up="${sel}" ${it.level >= cap || S.bank.scrap < uc ? 'disabled' : ''}>UPGRADE ${sel === 'tyres' ? 'THESE' : 'THIS'} ${what.toUpperCase()} ⚙${uc}</button></div>`;
    // [m6f] the others for this slot, from the stash: tap one to try it on (the bike shows it, glowing), FIT to keep it
    const others = S.stash.filter(q => q.slot === sel);
    if (others.length) { h += `<h3>Try another ${what}</h3>` + others.map(o => `<div class="it row try${prev && prev.uid === o.uid ? ' on' : ''}" data-try="${o.uid}" style="border-color:${col(o.rarity)}88"><div><div class="nm" style="color:${col(o.rarity)}">${esc(nm(o))}</div><div class="md">${prev && prev.uid === o.uid ? 'on the bike now: see it glow' : 'tap to try it on'} · Lv ${o.level}</div></div><button class="eq" data-eq="${o.uid}">FIT</button></div>`).join(''); }
    h += `<div class="md note">Upgrading makes ${sel === 'tyres' ? 'these tyres' : 'this ' + what} better, not the bike. Swap ${sel === 'tyres' ? 'them' : 'it'} and the level goes with ${sel === 'tyres' ? 'them' : 'it'}.${it.level >= cap ? ' At the cap: clean more areas to raise it.' : ''}</div></div>`;
    return h; }
  function buildTab() { let h = '';
    for (const [title, f] of GROUPS) { const rs = S.known.filter(id => !STARTING.includes(id)).map(id => RECIPES[id]).filter(r => r && f(r));   // the gear you started with is yours already: not in BUILD if (!rs.length) continue; h += `<h3>${title}</h3>`;
      for (const r of rs) { const c = costOf(r), have = r.kind === 'mod' ? S.mods[r.mod] || 0 : r.kind === 'key' ? (S.keys || {})[r.key] || 0 : 0;
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
  panel.addEventListener('pointerdown', e => { const tr = e.target.closest('[data-try]'); if (tr && !e.target.closest('button')) { const o = S.stash.find(q => q.uid === +tr.dataset.try); prev = prev && o && prev.uid === o.uid ? null : o; paint(); return; }
    const b = e.target.closest('button'); if (!b || b.disabled) return; const d = b.dataset;
    if (d.t) { tab = d.t; only = null; pick = null; prev = null; say(''); paint(); return; }
    if (d.sel) { sel = d.sel; pick = null; prev = null; say(''); paint(); return; }
    if (d.up) return did(sim.upgrade(d.up), `${nm(S.gear[d.up])} is now level ${S.gear[d.up].level + 1}.`);
    if (d.chg) { tab = 'stash'; only = d.chg; pick = null; paint(); return; }
    if (d.all) { only = null; paint(); return; }
    if (d.sock !== undefined) { pick = pick && pick.i === +d.sock ? null : { i: +d.sock, mod: null }; say(pick ? 'Pick a mod for this socket. It stays there for good.' : ''); paint(); return; }
    if (d.put) { if (pick.mod !== d.put) { pick.mod = d.put; paint(); return; } const ok = sim.socket(S.gear.weapon.uid, pick.i, d.put); pick = null; return did(ok, `${MOD_NAME[d.put]} is in for good.`); }
    if (d.build) return did(sim.build(d.build), `Built: ${RECIPES[d.build].name}.`);
    if (d.eq) { const it = S.stash.find(q => q.uid === +d.eq); const ok = sim.equipItem(+d.eq); prev = null; if (ok) { sel = it.slot; tab = 'bike'; } return did(ok, it ? `${nm(it)} fitted to the bike.` : 'Fitted.'); }
    if (d.salv) return did(sim.salvageItem(+d.salv), 'Salvaged.'); });
  // [m6c] the camera comes in on the bike, set in the top of the screen above the sheet; the HUD steps aside
  let saved = null; const CLOSE = 56;
  const open = () => { panel.hidden = false; ui.paused = true; ui.zoomOnly = true; tab = 'bike'; only = null; pick = null; prev = null; say(''); paint(); document.body.classList.add('garage-open');
    if (cam && lab) { saved = { base: cam.base, labCam: lab.cam }; cam.base = CLOSE; const b = S.bike; lab.cam = { x: b.x, y: b.y + innerHeight * 0.27 / CLOSE }; } };
  const close = () => { panel.hidden = true; ui.paused = false; ui.zoomOnly = false; prev = null; document.body.classList.remove('garage-open'); if (saved) { cam.base = saved.base; lab.cam = saved.labCam; saved = null; } if (hooks.back) hooks.back(); else sim.leaveGarage(); };   // [m6e] it rides itself back out; [hub] or back to the garage's open space
  // [m6e] GARAGE asks the bike to ride itself into the bay; the panel opens when it's parked ('parked')
  const enter = () => { if (!S.garageRun && sim.enterGarage()) btn.hidden = true; };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); enter(); });
  for (const id of ['garDone', 'garX']) for (const t of ['pointerdown', 'pointerup', 'touchend', 'click']) $(id).addEventListener(t, e => { e.preventDefault(); e.stopPropagation(); close(); }, { passive: false });
  addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (k === 'g' && sim.atBench() && panel.hidden) enter(); else if (k === 'escape' && !panel.hidden) close(); });
  let lastAt = null, told = false;
  // [m6b] the FIRE button names the gun you carry (and its level): the button is your gun
  const fire = $('fire'); let lastGun = '';
  function update(evs) { const w = S.gear.weapon, gs = `${w.r}|${w.level}`; if (gs !== lastGun) { lastGun = gs; fire.innerHTML = `FIRE<small>${esc(RECIPES[w.r].name)}${w.level > 1 ? ' · Lv' + w.level : ''}</small>`; }
    fire.classList.toggle('quiet', !!S.guns.main.holstered);   // [m6d] dimmed on the safe lot
    for (const e of evs || []) if (e.type === 'parked') { if (hooks.parked) hooks.parked(); else open(); }   // [hub] the garage's open space first, when there is one
    if (!panel.hidden && lab && saved) { const b = S.bike; lab.cam = { x: b.x, y: b.y + innerHeight * 0.27 / Math.max(10, cam.ppm) }; }   // the bike stays in the top of the screen at any zoom
    const at = sim.atGate() && !S.garageRun; if (at !== lastAt) { lastAt = at; btn.hidden = !at; if (at && !told) { told = true; ui.toast('The garage gate. Tap GARAGE and the bike rides in.', true); } } }
  // what the renderer needs: the picked slot, whether Kai is hidden (the close-up is just the bike), and the gear as tried on
  const gearView = () => prev && !panel.hidden ? { ...S.gear, [prev.slot]: prev } : S.gear;
  const hooks = {};   // [hub] set by garagehub.js: parked (instead of opening the workbench), back (closing it)
  return { hooks, update, open, get sel() { return panel.hidden || tab !== 'bike' ? null : sel; }, get isOpen() { return !panel.hidden; }, gearView, get gunBase() { return prev && !panel.hidden && prev.slot === 'weapon' ? prev.base : null; } };
}
