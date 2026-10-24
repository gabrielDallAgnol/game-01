// The Solar Flare's voice on game events: act intros and the Rig's anchor / migrate lines (rig3 emits actStart, rigAnchor,
// rigMigrate; harmless if never fired) and one crew bark a dawn. Words come from content/solar.js and content/barks.js.
import { eventText, DAWN_LINES, pickLine } from '../content/solar.js';
import { pickWho } from '../content/barks.js';

export function solarVoice(ui, events) {
  for (const e of events) {
    const t = eventText(e);
    if (t) { ui.strip.say(t.tag ? `${t.tag} ${t.lines[0]}` : t.text, 'sys', true); if (t.tag && t.lines[1]) ui.ctoast.show(t.lines[1], 'good', 'people'); continue; }
    if (e.t === 'dawn' && Math.random() < 0.7) {
      const b = pickWho('dawn') ; const line = b.who === 'A neighbour' ? pickLine(DAWN_LINES, e.night || 0) : `${b.who}: "${b.text}"`;
      setTimeout(() => { if (ui.game && !ui.card && !ui.paused && !ui.game.state.over) ui.ctoast.show(line, 'good', 'people'); }, 5200);
    }
  }
}
