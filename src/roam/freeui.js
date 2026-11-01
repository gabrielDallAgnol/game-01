// [roam] Freeing, the controls and words (the Point): LINK appears beside FIRE when a weak big machine is in reach and Kai
// has a freeing chip (or while linked: tap it on each pulse). Toasts teach each step once: the core lies open, build a chip,
// linked, a tap landed or missed, the link broke, it is free, it climbed out of the bridge. Acts only through input.link.
export function createFreeUi({ sim, toast, input }) {
  const S = sim.state, btn = document.createElement('button'); btn.id = 'linkBtn'; btn.className = 'rb'; btn.hidden = true; btn.textContent = 'LINK';
  btn.style.cssText = 'position:fixed;right:max(126px,calc(env(safe-area-inset-right,0px) + 126px));bottom:calc(250px + env(safe-area-inset-bottom,0px));width:88px;height:88px;border-radius:50%;font:700 15px ui-monospace,monospace;letter-spacing:.08em;color:#1b1406;background:#f0b44c;border:2px solid #ffd98a;box-shadow:0 0 22px rgba(240,180,76,.55);z-index:20';
  btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); input.link = true; btn.animate([{ transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: 140 }); });
  document.body.appendChild(btn);
  let told = {}; const once = (k, msg, big) => { if (told[k]) return; told[k] = true; toast(msg, big); };
  function update(evs) {
    for (const e of evs || []) {
      if (e.type === 'weak') once('weak', (S.keys && S.keys.link) ? 'Its core lies open. Get close and LINK to free it.' : 'Its core lies open, but it can\'t be destroyed: it has to be freed. Kai can build a freeing chip at the garage.', true);
      else if (e.type === 'learn' && e.r === 'link_chip') once('learn', 'Kai knows how to build a freeing chip: chips from machines, and scrap.');
      else if (e.type === 'built' && e.r === 'link_chip') toast('A freeing chip. Take it to the big machine in the bridge.', true);
      else if (e.type === 'linkStart') toast(`Linked. Tap LINK as the ring meets it: ${e.need} in time.`, true);
      else if (e.type === 'linkHit') toast(`${e.prog} / ${e.need}`);
      else if (e.type === 'linkMiss') toast('Out of time: the link slips.');
      else if (e.type === 'linkBreak') toast('The link broke. Your chip is safe: try again.');
      else if (e.type === 'freed') toast('It\'s free. It stops, and starts to clear the ash.', true);
      else if (e.type === 'chipBurnt') once('burnt', 'Its chip burnt with it: machines killed burning keep no chip.');
      else if (e.type === 'guardPost') once('post', 'It climbed out of the bridge. Now Wend Bridge can be mended.', true); }
    const show = !!S.link || sim.canLink(); if (btn.hidden === show) btn.hidden = !show;
    const label = S.link ? 'TAP' : 'LINK'; if (btn.textContent !== label) btn.textContent = label; }
  return { update };
}
