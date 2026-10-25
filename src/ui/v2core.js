// [v2] The V2 core's screen: with the v2 flag (?v2=1, a v2 save) the UI of the switched-off systems goes away. The sim
// already does nothing for them (sim/v2core.js); this hides what is left: the class ability button, the stat chip and
// ability bar, the noise meter, the blackout banner, the day's wave forecast, the nest siege bar, the Rig's panel
// section and pill, the carts row, and the Chronicler (no AI calls, no toggles). Wraps other modules' ui.x slots
// (read at call time by app.js, panels.js, placing.js), so their files stay as they are. Without the flag: no change.
import { V2 } from './v2-flag.js';

const CSS = `body.v2 #ability,body.v2 #rNoise,body.v2 #blackout,body.v2 .h3chip,body.v2 .h3bar,body.v2 .inf,body.v2 .rigbtn,body.v2 .aitog,body.v2 #forecast:not(.night){display:none!important}`;

export function createV2CoreUi(ui) {
  if (!document.getElementById('v2-css')) { const st = document.createElement('style'); st.id = 'v2-css'; st.textContent = CSS; document.head.appendChild(st); }
  /** on for this run: the game says so (a v2 save keeps it); before a run, the URL or the build */
  const v2 = () => (ui.game ? !!(ui.game.v2 && ui.game.v2()) : V2.on);
  let was = null;
  function sync() {
    const on = v2(); if (on === was) return; was = on;
    document.body.classList.toggle('v2', on);
  }
  sync();
  return {
    v2coreTick: () => sync(),
  };
}
