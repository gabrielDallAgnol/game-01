// [roam] Loot on the HUD (M3): the scrap and chips counters (they jump when something is banked), the bag button with how
// many weapons it holds, the pickup feed (each weapon you pass over: its name in its rarity's colour), and the bag: your
// weapon on top, everything you carry below; tap one to equip it (yours goes in the bag) or salvage it for scrap.
// The game pauses while the bag is open. Writes nothing but the API calls.
import { RARITY, salvageOf, nameOf } from '../play/loot.js';
import { MODIFIERS } from '../play/modifiers.js';
export function createLootUi({ sim, toast, ui }) {
  const $ = id => document.getElementById(id), S = sim.state, scrapEl = $('scrap'), chipsEl = $('chips'), bagBtn = $('bagBtn'), bagN = $('bagN'), panel = $('bag'), list = $('bagList'), feed = $('feed');
  const MODN = { double_shot: 'double shot', faster: 'faster', ricochet: 'ricochet', fire: 'fire', water: 'water' };
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const row = (w, id) => { const R = RARITY[w.rarity], p = salvageOf(w);
    return `<div class="it" style="border-color:${R.color}55"><div class="nm" style="color:${R.color}">${esc(nameOf(w))}</div>
      <div class="md">${w.rarity} · ${w.mods.length ? w.mods.map(m => `<span title="${esc((MODIFIERS[m] || {}).desc || '')}">${MODN[m] || m}</span>`).join(' · ') : 'no modifiers'}</div>
      ${id === undefined ? '<div class="md">in hand</div>' : `<div class="bt"><button data-s="${id}">SALVAGE +${p.scrap}${p.chips ? ' ◆' + p.chips : ''}</button><button class="eq" data-e="${id}">EQUIP</button></div>`}</div>`; };
  function paint() { list.innerHTML = row(S.guns.main.weapon) + (S.bag.length ? S.bag.map(b => row(b.w, b.id)).join('') : '<p class="empty">Nothing yet. Weapons you ride over go here.</p>'); }
  list.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.e) sim.equip(+b.dataset.e); else if (b.dataset.s) sim.salvage(+b.dataset.s); paint(); });
  bagBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); panel.hidden = false; ui.paused = true; paint(); });
  $('bagDone').addEventListener('click', () => { panel.hidden = true; ui.paused = false; });
  const bump = el => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  const told = new Set(), once = (k, text, big) => { if (!told.has(k)) { told.add(k); toast(text, big); } };
  function pickup(w) { const el = document.createElement('div'); el.textContent = '+ ' + nameOf(w); el.style.color = RARITY[w.rarity].color; feed.appendChild(el); setTimeout(() => el.remove(), 3200); while (feed.children.length > 4) feed.firstChild.remove(); }
  let lastS = -1, lastC = -1, lastB = -1;
  function update(evs) {
    for (const e of evs || []) {
      if (e.type === 'drop') once('drop', 'A weapon on the ground: its name glows in its rarity\'s colour. Ride over it to pick it up.', true);
      else if (e.type === 'loot') { const b = S.bag.find(q => q.id === e.id); if (b) pickup(b.w); once('loot', 'In the bag. Open BAG to equip it.'); }
      else if (e.type === 'scan' && (e.rarity === 'rare' || e.rarity === 'epic')) once('scan', `Your lamp read it: ${e.rarity}.`);
      else if (e.type === 'bagFull') toast('Bag full: salvage something.');
      else if (e.type === 'chips') once('chips', 'Chips: the rare currency. Nests and rare salvage give them.'); }
    if (S.scrap !== lastS) { if (lastS >= 0) bump(scrapEl); lastS = S.scrap; scrapEl.textContent = S.scrap; }
    if (S.chips !== lastC) { if (lastC >= 0) bump(chipsEl); lastC = S.chips; chipsEl.textContent = S.chips; }
    if (S.bag.length !== lastB) { if (lastB >= 0 && S.bag.length > lastB) bump(bagN); lastB = S.bag.length; bagN.textContent = S.bag.length; } }
  return { update };
}
