// [roam] Loot on the HUD (M3): the scrap and chips counters (they jump when something is banked), and the quick swap: stand
// by a dropped weapon and a card shows it beside yours (rarity, base, modifiers); EQUIP takes it on the spot (yours is
// left where it lay), SALVAGE breaks it for scrap. No menu: the fight never stops. Writes nothing but the API calls.
import { RARITY, salvageOf } from '../play/loot.js';
import { WEAPONS } from '../play/parts/weapons.js';
import { MODIFIERS } from '../play/modifiers.js';
export function createLootUi({ sim, toast }) {
  const $ = id => document.getElementById(id), S = sim.state, box = $('loot'), scrapEl = $('scrap'), chipsEl = $('chips'), card = $('swap');
  const NAME = { scatter: 'Scatter gun', launcher: 'Launcher', thrower: 'Thrower' };
  const MODN = { double_shot: 'double shot', faster: 'faster', ricochet: 'ricochet', fire: 'fire', water: 'water' };
  const line = w => `<b style="color:${RARITY[w.rarity].color}">${w.rarity.toUpperCase()}</b> ${NAME[w.base] || w.base}<small>${w.mods.length ? w.mods.map(m => MODN[m] || m).join(' · ') : 'no modifiers'}</small>`;
  const tip = w => `${(WEAPONS[w.base] || {}).desc || ''} ${w.mods.map(m => (MODIFIERS[m] || {}).desc || '').join(' ')}`.trim();
  let shown = -1, lastS = -1, lastC = -1;
  const bump = el => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  card.querySelector('#equip').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (shown >= 0) sim.equip(shown); shown = -2; });
  card.querySelector('#salvage').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (shown >= 0) sim.salvage(shown); shown = -2; });
  // first times: what a light on the ground is, what the scan does
  const told = new Set(), once = (k, text, big) => { if (!told.has(k)) { told.add(k); toast(text, big); } };
  function update(evs) {
    for (const e of evs || []) { if (e.type === 'drop') once('drop', 'A light on the ground: a weapon. Ride up to it to swap.', true);
      else if (e.type === 'scan' && (e.rarity === 'rare' || e.rarity === 'epic')) once('scan', `Your lamp read it: ${e.rarity}.`);
      else if (e.type === 'chips') once('chips', 'Chips: the rare currency. Nests and rare salvage give them.'); }
    if (S.scrap !== lastS) { if (lastS >= 0) bump(scrapEl); lastS = S.scrap; scrapEl.textContent = S.scrap; }
    if (S.chips !== lastC) { if (lastC >= 0) bump(chipsEl); lastC = S.chips; chipsEl.textContent = S.chips; }
    box.hidden = false;
    const id = S.nearDrop; if (id === shown) return; shown = id;
    const d = id >= 0 && S.drops.find(q => q.id === id); if (!d) { card.hidden = true; return; }
    const w = d.w, have = S.guns.main.weapon, p = salvageOf(w);
    card.style.borderColor = RARITY[w.rarity].color;
    card.querySelector('.new').innerHTML = line(w); card.querySelector('.new').title = tip(w);
    card.querySelector('.have').innerHTML = line(have);
    card.querySelector('#salvage').textContent = `SALVAGE +${p.scrap}${p.chips ? ` · ◆${p.chips}` : ''}`;
    card.hidden = false; }
  return { update };
}
