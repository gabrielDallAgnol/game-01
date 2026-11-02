// [roam] The objective (the Point's tutorial chain, docs/design/the-point.md §5): one line under the area chip saying what
// to do next, read from the state (no script): ride to Wendbridge → gather chips (machines' own; fire burns them) → build
// a freeing chip at the garage → free the big machine in Wend Bridge → mend the bridge → the road north. Writes nothing.
import { CHAPTER1 } from '../play/missions.js';
export function createObjUi({ sim, toast }) {
  const S = sim.state, el = document.createElement('div'); el.id = 'obj';
  el.style.cssText = 'position:fixed;left:max(12px,env(safe-area-inset-left,0px));top:calc(116px + env(safe-area-inset-top,0px));max-width:min(300px,calc(100vw - 24px));font:700 11px ui-monospace,monospace;letter-spacing:.03em;line-height:1.35;padding:5px 9px;border-radius:8px;background:rgba(10,11,13,.78);color:#e9e2cf;border-left:3px solid #f0b44c;pointer-events:none;z-index:9';
  document.body.appendChild(el);
  const home = S.areas.findIndex(a => a.home), main = S.areas.findIndex(a => a.pin); let seenTown = false, last = '';
  if (main < 0) { el.hidden = true; return { update() {} }; }
  const hasChapter = !!S.mission;
  // [missions] with a chapter, the line is the mission's: its objective with its count; a giver's words come as toasts
  function missionLine() { const m = S.mission; if (!m) return 'The road north is open. Beyond the cut: the first town (next chapter).'; const st = CHAPTER1[m.i];
    if (st.goal.type === 'protect' && !m.wave) return 'Ride to Tomas\'s door in Wendbridge: the first house off the lane, a lamp swinging.';
    if (st.goal.type === 'fetch' && S.carryItems && S.carryItems.length) return 'Bring the shield coil home: bank it at the Point. If you go down, it drops where you fell.';
    return `${m.i + 1}/${CHAPTER1.length} · ${st.title.toUpperCase()}: ` + st.line.replace('{n}', m.prog).replace('{need}', m.need); }
  function line() { if (hasChapter) return missionLine(); const chips = S.chips + (S.bank ? S.bank.chips : 0), need = 6, b = (S.bridges || [])[0], freed = (S.guardians || []).length > 0;
    if (S.inArea === main) seenTown = true;
    if (b && b.state === 'mended') return 'The road north is open. Beyond the cut: the first town (next chapter).';
    if (b && b.state === 'mending') return `Guard the people mending ${b.name}: ${Math.round(b.prog * 100)}%`;
    if (freed) return `Mend ${b ? b.name : 'the bridge'}: carry 60 scrap to its end (you carry ${S.scrap}).`;
    if ((S.keys && S.keys.link) || S.link) return 'Free the big machine in Wend Bridge: break it open, then LINK in time with its pulse.';
    if (chips >= need) return `Bank your chips and build a freeing chip at the garage (40 ⚙, 6 ◆; banked ◆ ${S.bank ? S.bank.chips : 0}).`;
    if (!seenTown) return 'Ride up the point lane to Wendbridge. The grey starts where the Point ends.';
    return `Gather chips from machines: ◆ ${chips}/${need}. Their chips burn if they die burning.`; }
  function update(evs) {
    for (const e of evs || []) {
      if (e.type === 'missionStart' && e.say) toast(`${e.giver}: ${e.say}`, true);
      else if (e.type === 'missionDone' && e.say) toast(e.say, true);
      else if (e.type === 'missionStep' && e.what === 'failed') toast('They broke in. Tomas held the door, barely. Go back for him.', true);
      else if (e.type === 'missionStep' && e.what === 'taken') toast('The shield coil. Heavy: bring it home.', true);
      else if (e.type === 'missionStep' && e.what === 'dropped') toast('The coil fell where you went down. Go back for it.'); }
    const l = line(); if (l !== last) { last = l; el.textContent = l; el.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 400 }); } }
  return { update };
}
