// The Haven's voice on game events: one crew bark a dawn (in chapter 1 only from the crew Kai brought home). Words come from content/solar.js and content/barks.js.
import { DAWN_LINES, pickLine } from '../content/solar.js';
import { pickWho } from '../content/barks.js';

export function solarVoice(ui, events) {
  for (const e of events) {
    if (e.t === 'dawn' && Math.random() < 0.7) {
      const sv = ui.game && ui.game.chapter && ui.game.chapter() ? ui.game.survivors().filter(v => v.state === 'home').map(v => v.id) : null, b = pickWho('dawn', undefined, sv); const line = b.who === 'A neighbour' ? pickLine(DAWN_LINES, e.night || 0) : `${b.who}: "${b.text}"`;
      setTimeout(() => { if (ui.game && !ui.card && !ui.paused && !ui.game.state.over) ui.ctoast.show(line, 'good', 'people'); }, 5200);
    }
  }
}
