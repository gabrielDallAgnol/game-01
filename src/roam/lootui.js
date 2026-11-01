// [roam] Loot on the HUD (M3; recipes since M6): the scrap and chips counters (they jump when something comes in), the BOOK
// button with how many recipes Kai carries, the pickup feed (each recipe she rides over: its name in its rarity's colour),
// and the book: what she carries (at risk until a bank) and every recipe she knows. Building happens in the garage.
// The game pauses while the book is open. Writes nothing.
import { RARITY } from '../play/loot.js';
import { RECIPES, recipeName, MOD_NAME } from '../play/recipes.js';
import { ELITES } from '../play/elites.js';
import { MACHINES } from '../play/machines.js';
export function createLootUi({ sim, toast, ui }) {
  const $ = id => document.getElementById(id), S = sim.state, scrapEl = $('scrap'), chipsEl = $('chips'), bagBtn = $('bagBtn'), bagN = $('bagN'), panel = $('bag'), list = $('bagList'), feed = $('feed');
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const row = id => { const r = RECIPES[id], c = RARITY[r.rarity].color; return `<div class="it" style="border-color:${c}55"><div class="nm" style="color:${c}">${esc(r.name)}</div><div class="md">${r.rarity} · ${esc(r.desc)}</div></div>`; };
  function paint() { list.innerHTML = '<h3>Carried</h3>' + (S.carry.length ? '<p class="md warn">At risk: lost into your cache if you go down. Bank them at the camp or the garage to learn them.</p>' + S.carry.map(row).join('') : '<p class="empty">Nothing carried. Recipes drop from machines.</p>')
    + (S.carryMods.length ? '<h3>Carried mods</h3><p class="md warn">At risk too. A bank sends them to the garage, ready for a socket.</p>' + S.carryMods.map(m => `<div class="it" style="border-color:#ffd23a55"><div class="nm" style="color:#ffd23a">${MOD_NAME[m]} Mod</div></div>`).join('') : '')
    + `<h3>Known (${S.known.length})</h3>` + S.known.map(row).join(''); }
  bagBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); panel.hidden = false; ui.paused = true; paint(); });
  for (const id of ['bagDone', 'bagX']) for (const t of ['pointerdown', 'pointerup', 'touchend', 'click']) $(id).addEventListener(t, e => { e.preventDefault(); e.stopPropagation(); panel.hidden = true; ui.paused = false; }, { passive: false });
  const bump = el => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  const told = new Set(), once = (k, text, big) => { if (!told.has(k)) { told.add(k); toast(text, big); } };
  function pickup(text, colr) { const el = document.createElement('div'); el.textContent = text; el.style.color = colr; feed.appendChild(el); setTimeout(() => el.remove(), 3200); while (feed.children.length > 4) feed.firstChild.remove(); }
  let lastS = -1, lastC = -1, lastB = -1;
  function update(evs) {
    for (const e of evs || []) {
      if (e.type === 'drop') once('drop', 'A recipe on the ground: its name glows in its rarity\'s colour. Ride over it.', true);
      else if (e.type === 'loot') { pickup('+ ' + recipeName(e.r), RARITY[e.rarity].color); once('loot', 'A recipe! Bank it at the camp or the garage to learn it, then build it in the garage.', true); }
      else if (e.type === 'lootMod') { pickup(`+ ${MOD_NAME[e.m]} Mod`, '#ffd23a'); once('lootMod', 'A mod from the elite! Bank it and it waits in the garage for a socket.', true); }
      else if (e.type === 'bankMods') pickup(`Mods to the garage: ${e.mods.split(',').map(m => MOD_NAME[m]).join(', ')}`, '#ffd23a');
      else if (e.type === 'dupe') pickup(`${recipeName(e.r)}: known · +◆${e.chips}`, '#bfb8a6');
      else if (e.type === 'learn') pickup('Learned: ' + recipeName(e.r), RARITY[RECIPES[e.r].rarity].color);
      else if (e.type === 'scan' && (e.rarity === 'rare' || e.rarity === 'epic')) once('scan', `Your lamp read it: ${e.rarity}.`);
      else if (e.type === 'chips') once('chips', 'Chips: the rare currency. Big machines and known recipes give them.'); }
    if (!told.has('elite')) for (const d of S.dead) if (d.elite && Math.hypot(d.x - S.kai.x, d.y - S.kai.y) < 25) { once('elite', `${ELITES[d.elite].name} ${MACHINES[d.kind].name}: ${ELITES[d.elite].desc}`, true); break; }
    if (S.scrap !== lastS) { if (lastS >= 0) bump(scrapEl); lastS = S.scrap; scrapEl.textContent = S.scrap; }
    if (S.chips !== lastC) { if (lastC >= 0) bump(chipsEl); lastC = S.chips; chipsEl.textContent = S.chips; }
    const nb = S.carry.length + S.carryMods.length; if (nb !== lastB) { if (lastB >= 0 && nb > lastB) bump(bagN); lastB = nb; bagN.textContent = nb; } }
  return { update };
}
