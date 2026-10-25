// [gemini3] The trees panel (fell by hand or send the Logger's Hut crew) and the hut's names in the build tray.
// Hooks: panels.js `[gemini3]` (the rubble panel and its button). The rule is sim/logging.js.
import { SHORT, PLURAL, ONE } from './shared.js';

SHORT.lumbermill = 'Loggers'; PLURAL.lumbermill = "logger's huts"; ONE.lumbermill = "the logger's hut";

export function createLoggingUi(ui) {
  const n = k => `${k} ${k === 1 ? 'cell' : 'cells'}`;
  /** the panel body for a patch of trees on your land (r: game.rubbleAt with r.trees) */
  function treesHtml(r, opt, day) {
    const j = r.job, s = Math.ceil(r.dur);
    const state = j ? (j.working ? `<b class="good">Felling · ${Math.floor(j.progress * 100)}%</b>` : '<b class="bad">Waiting for you</b>: walk back to the trees to keep chopping.')
      : r.loggers ? "<b class=\"good\">Logger's Hut</b>: the crew fells it from the hut." : "By hand: you walk over and chop. A <b>Logger's Hut</b> does it quicker.";
    const name = j ? (j.crew ? 'The crew is on it' : 'Walk back and chop') : r.loggers ? `Send the crew (${n(r.cells.length)} · ${s} s)` : `Chop by hand (${n(r.cells.length)} · ${s} s)`;
    const ds = r.loggers ? `A 3×3 patch becomes open ground. +${r.pay} timber (scrap).` : `Stand by the trees ${s} s. A 3×3 patch becomes open ground. +${r.pay} timber (scrap).`;
    return `<div class="stat"><span>Blocks building. Slows the dead.</span><span>${state}</span></div><div class="opts one">${opt('opt-clear', 'data-clear="1"', name, null, ds, (j && j.crew) || !day)}</div>`;
  }
  /** the button: start (or walk back to) the job; true when the panel should close */
  function treesClick(x, y) {
    const r = ui.game.rubbleAt(x, y); if (!r.trees) return false;
    if (!ui.game.clearRubble(x, y)) return false;
    ui.toast(r.loggers ? `The crew goes to work: ${Math.ceil(r.dur)} s.` : `You walk over to fell the trees: stay by them ${Math.ceil(r.dur)} s.`);
    return true;
  }
  /** [gemini3] the Camp panel's small-and-strong line (sim/stronghold.js) */
  function strongLine() {
    const g = ui.game; if (!g.strongInfo) return '';
    const I = g.strongInfo(), bits = [];
    bits.push(I.compact ? `<b class="good">Compact stronghold</b> (${I.n}/${I.max} buildings): towers hit harder, buildings take less` : `Compact stronghold at ${I.max} buildings or fewer (now ${I.n})`);
    if (I.garrison) bits.push(`garrison <b>${I.garrison}</b> crew`);
    if (I.captain) bits.push('a companion holds the Camp');
    return `<span>${bits.join(' · ')}</span>`;
  }
  return { treesHtml, treesClick, strongLine };
}
