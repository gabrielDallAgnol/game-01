// [roam] The objective (the Point's tutorial chain, docs/design/the-point.md §5): one line under the area chip saying what
// to do next, read from the state (no script): ride to Wendbridge → gather chips (machines' own; fire burns them) → build
// a freeing chip at the garage → free the big machine in Wend Bridge → mend the bridge → the road north. Writes nothing.
import { CHAPTER1, readyOf } from '../play/missions.js';
export function createObjUi({ sim, toast }) {
  const S = sim.state, el = document.createElement('div'); el.id = 'obj';
  el.style.cssText = 'position:fixed;left:max(12px,env(safe-area-inset-left,0px));top:calc(116px + env(safe-area-inset-top,0px));max-width:min(300px,calc(100vw - 24px));font:700 11px ui-monospace,monospace;letter-spacing:.03em;line-height:1.35;padding:5px 9px;border-radius:8px;background:rgba(10,11,13,.78);color:#e9e2cf;border-left:3px solid #f0b44c;pointer-events:none;z-index:9';
  document.body.appendChild(el);
  const home = S.areas.findIndex(a => a.home), main = S.areas.findIndex(a => a.pin); let seenTown = false, last = '';
  if (main < 0) { el.hidden = true; return { update() {} }; }
  const hasChapter = !!S.mission;
  // [missions] with a chapter, the line is the mission's: its objective with its count; a giver's words come as toasts
  function one(q) { const st = CHAPTER1.find(o => o.id === q.id), r = readyOf(S, st);
    if (r) return `✓ ${st.title}: ${r.then}`;
    if (st.goal.type === 'protect' && !q.wave) return `${st.title}: ride to Tomas's door in Wendbridge (a lamp swinging).`;
    const hp = q.hp !== undefined && q.hp < 100 ? ` · ${st.goal.type === 'protect' ? 'door' : 'it'} ${Math.max(0, Math.round(q.hp))}%` : '';
    if (hp) return `${st.title}: ` + st.line.replace('{n}', q.prog).replace('{need}', q.need) + hp;
    return `${st.title}: ` + st.line.replace('{n}', q.prog).replace('{need}', q.need); }
  function missionLine() { const A = (S.quests && S.quests.active) || []; if (!A.length) return S.quests && S.quests.offers.length ? 'Someone in Wendbridge has a "!" for you.' : 'The road north is open. Beyond the cut: the first town (next chapter).';
    const m = S.mission, rest = A.filter(q => q !== m).slice(0, 3); return [one(m)].concat(rest.map(q => '· ' + one(q))).join('\n'); }
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
    if (hasChapter) { const r = S.mission && readyOf(S, CHAPTER1[S.mission.i]); el.style.borderLeftColor = r ? '#8fd16a' : '#f0b44c'; el.style.color = r ? '#d8f5c4' : '#e9e2cf'; }
    for (const e of evs || []) {
      if (e.type === 'missionStep' && e.what === 'failed') toast('They broke his door in. Tomas is hurt, hiding upstairs. Ride back: they\'ll come again.', true);
      else if (e.type === 'missionStep' && e.what === 'battered') toast(`${e.id === 'tomas' ? 'Tomas\'s door' : e.id === 'scrubber' ? 'The scrubber' : 'Kai\'s garage door'}: ${e.hp}% left. Get them off it!`, e.hp <= 25);
      else if (e.type === 'missionStep' && e.what === 'broken') toast(e.id === 'scrubber' ? 'They knocked the scrubber off. Tomas kicks it going again: 15 s lost.' : 'They got at the garage door. Kai patches it: 15 s lost.', true);
      else if (e.type === 'missionStep' && e.what === 'taken') toast('The shield coil. Heavy: bring it home.', true);
      else if (e.type === 'missionStep' && e.what === 'dropped') toast('The coil fell where you went down. Go back for it.'); }
    const l = line(); if (l !== last) { last = l; el.textContent = l; el.style.whiteSpace = 'pre-line'; el.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 400 }); } }
  return { update };
}
