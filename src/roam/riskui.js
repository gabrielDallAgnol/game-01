// [roam] Risk on the HUD (M5): the bike's bar under Kai's (amber; ember when low, blinking when wrecked), the banked scrap
// beside what she carries (⌂), the REPAIR button while the bike is hurt (it shows what a full repair costs; tap again to
// stop), and the words for the bike, repairs, banking and the cache. Writes only `input`.
import { ROAM } from './sim.js';
export function createRiskUi({ sim, toast, input }) {
  const $ = id => document.getElementById(id), S = sim.state, bar = $('bikeHp'), barI = bar.firstElementChild, bankEl = $('bank'), fix = $('fix');
  const per = ROAM.risk.fixPer;
  fix.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); input.repair = true; });
  const told = new Set(), once = (k, text, big) => { if (!told.has(k)) { told.add(k); toast(text, big); return true; } return false; };
  let lowAt = -99;
  const NO = { scrap: 'No scrap on you to fix it with.', machines: 'Not with machines this close.', far: 'Get next to the bike.', whole: 'The bike is whole.' };
  const STOP = { moved: 'Repair stopped.', hit: 'Hit! Repair stopped.', machines: 'Machines close: repair stopped.', scrap: 'Out of scrap: repair stopped.' };
  const sc = (s, c) => `⚙${s}${c ? ' ◆' + c : ''}`;
  function words(evs) { for (const e of evs) {
    if (e.type === 'bikeLow' && S.t - lowAt > 20) { lowAt = S.t; toast('The bike is hurting and runs slower. REPAIR when it\'s quiet, or ride to a bank.', true); }
    else if (e.type === 'bikeWreck') toast('The bike is wrecked: it limps, and every hit lands on you.', true);
    else if (e.type === 'fixNo') toast(NO[e.why] || 'Can\'t repair now.');
    else if (e.type === 'fixStart') once('fix', 'Kai works on the bike: it costs scrap. Moving or a hit stops her.');
    else if (e.type === 'fixStop' && STOP[e.why]) toast(STOP[e.why]);
    else if (e.type === 'fixed') toast(e.at === 'field' ? 'The bike is whole again.' : 'Fixed up at the bank.');
    else if (e.type === 'bank') { toast(`Banked ${sc(e.scrap, e.chips)}. Safe now.`, true); once('bank', 'What you carry is lost if you go down. Banked scrap is safe.'); }
    else if (e.type === 'cache') toast(`You dropped ${sc(e.scrap, e.chips)} where you fell. Ride back for it.`, true);
    else if (e.type === 'cacheBack') toast(`Got it back: ${sc(e.scrap, e.chips)}.`);
    else if (e.type === 'cacheLost') toast(`Your old cache is gone: ${sc(e.scrap, e.chips)} lost.`);
    else if (e.type === 'beacon') toast('Where the walker fell is a beacon now: a bank out here.', true);
    else if (e.type === 'towed') toast('The bike was towed in and patched up.'); }
    if (S.scrap >= 25 && !S.kai.dead) once('carry', 'Carried scrap is at risk. Bank it at the garage (⌂) on the square.'); }
  let last = '';
  function update(evs) { words(evs || []);
    const b = S.bike, k = S.kai, f = b.maxHp ? b.hp / b.maxHp : 1, cost = Math.ceil((b.maxHp - b.hp) / per);
    const near = (S.banks || []).some(q => Math.hypot(q.x - k.x, q.y - k.y) < ROAM.risk.bankR), sig = `${near}|${Math.round(f * 100)}|${S.bank.scrap}|${S.bank.chips}|${b.fixing}|${k.dead > 0}|${S.scrap > 0}|${cost}`;
    if (sig === last) return; last = sig;
    barI.style.width = `${Math.max(0, f * 100)}%`; bar.classList.toggle('low', f < 0.3 && f > 0); bar.classList.toggle('wreck', f <= 0);
    bankEl.textContent = S.bank.chips ? `${S.bank.scrap}·◆${S.bank.chips}` : S.bank.scrap;
    const atBank = (S.banks || []).some(q => Math.hypot(q.x - k.x, q.y - k.y) < ROAM.risk.bankR);   // a bank mends it by itself
    fix.hidden = !!k.dead || atBank || (f >= 1 && !b.fixing);
    fix.classList.toggle('on', !!b.fixing); fix.classList.toggle('poor', !(S.scrap > 0));
    fix.innerHTML = b.fixing ? 'STOP<small>fixing</small>' : `REPAIR<small>⚙${cost}</small>`;
    fix.setAttribute('aria-label', b.fixing ? 'Stop repairing' : `Repair the bike (about ${cost} scrap)`); }
  return { update };
}
