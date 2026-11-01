// [roam] The objective (the Point's tutorial chain, docs/design/the-point.md §5): one line under the area chip saying what
// to do next, read from the state (no script): ride to Wendbridge → gather chips (machines' own; fire burns them) → build
// a freeing chip at the garage → free the big machine in Wend Bridge → mend the bridge → the road north. Writes nothing.
export function createObjUi({ sim }) {
  const S = sim.state, el = document.createElement('div'); el.id = 'obj';
  el.style.cssText = 'position:fixed;left:max(12px,env(safe-area-inset-left,0px));top:calc(116px + env(safe-area-inset-top,0px));max-width:min(300px,calc(100vw - 24px));font:700 11px ui-monospace,monospace;letter-spacing:.03em;line-height:1.35;padding:5px 9px;border-radius:8px;background:rgba(10,11,13,.78);color:#e9e2cf;border-left:3px solid #f0b44c;pointer-events:none;z-index:9';
  document.body.appendChild(el);
  const home = S.areas.findIndex(a => a.home), main = S.areas.findIndex(a => a.pin); let seenTown = false, last = '';
  if (main < 0) { el.hidden = true; return { update() {} }; }
  function line() { const chips = S.chips + (S.bank ? S.bank.chips : 0), need = 6, b = (S.bridges || [])[0], freed = (S.guardians || []).length > 0;
    if (S.inArea === main) seenTown = true;
    if (b && b.state === 'mended') return 'The road north is open. Beyond the cut: the first town (next chapter).';
    if (b && b.state === 'mending') return `Guard the people mending ${b.name}: ${Math.round(b.prog * 100)}%`;
    if (freed) return `Mend ${b ? b.name : 'the bridge'}: carry 60 scrap to its end (you carry ${S.scrap}).`;
    if ((S.keys && S.keys.link) || S.link) return 'Free the big machine in Wend Bridge: break it open, then LINK in time with its pulse.';
    if (chips >= need) return `Bank your chips and build a freeing chip at the garage (40 ⚙, 6 ◆; banked ◆ ${S.bank ? S.bank.chips : 0}).`;
    if (!seenTown) return 'Ride up the point lane to Wendbridge. The grey starts where the Point ends.';
    return `Gather chips from machines: ◆ ${chips}/${need}. Their chips burn if they die burning.`; }
  function update() { const l = line(); if (l !== last) { last = l; el.textContent = l; el.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 400 }); } }
  return { update };
}
