// [roam] The garage's open space (Gabriel, Nov 2): once the robot has ridden in and parked, a choice before anything
// else: talk to Kai, go to the workbench (build, fit, upgrade: garageui.js), or leave (it rides back out). The camera
// holds on the robot and Kai by her doors. After a talk or the workbench, back here. UI only.
export function createGarageHub({ sim, ui, lab, cam, garageUi, talk }) {
  const S = sim.state, el = document.createElement('div'); el.id = 'garHub'; el.hidden = true;
  el.innerHTML = `<b>KAI'S GARAGE</b><button data-a="talk">TALK TO KAI</button><button data-a="bench">WORKBENCH<small>build · fit · upgrade</small></button><button data-a="leave" class="q">LEAVE</button>`;
  const css = document.createElement('style'); css.textContent = `#garHub{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(24px + env(safe-area-inset-bottom,0px));width:min(360px,calc(100vw - 24px));background:rgba(8,9,11,.94);border:1px solid #f0b44c66;border-radius:16px;padding:10px;z-index:58;display:grid;gap:8px}
#garHub b{font:700 11px ui-monospace,monospace;letter-spacing:.16em;color:#f0b44c;padding:2px 4px}#garHub button{padding:13px;border-radius:12px;border:1px solid #f0b44c55;background:rgba(240,180,76,.12);color:#ffe2a6;font:700 14px ui-monospace,monospace;letter-spacing:.06em;text-align:left}
#garHub button small{display:block;font:500 11px ui-monospace,monospace;color:#b9b3a4;letter-spacing:0;margin-top:2px}#garHub button.q{background:none;border-color:transparent;color:#8a877e;text-align:center;padding:8px}
body.hub #hud,body.hub #loot,body.hub #area,body.hub #obj,body.hub #pad,body.hub #toasts,body.hub #garageBtn{visibility:hidden}`;
  document.head.appendChild(css); document.body.appendChild(el);
  let mode = null, saved = null;
  const frame = () => { const q = S.sites.find(o => o.bay); if (!q) return; lab.cam = { x: S.bike.x, y: S.bike.y + 5 }; cam.base = cam.ppm = 26; };
  function show() { mode = 'hub'; el.hidden = false; document.body.classList.add('hub'); ui.paused = true; if (!saved) saved = { base: cam.base }; frame(); }
  function hide() { el.hidden = true; document.body.classList.remove('hub'); }
  garageUi.hooks.parked = show;
  garageUi.hooks.back = show;
  el.addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); e.stopPropagation(); const a = b.dataset.a;
    if (a === 'bench') { hide(); mode = 'bench'; garageUi.open(); }
    else if (a === 'talk') { hide(); mode = 'talk'; talk.open(() => show()); }
    else if (a === 'leave') { hide(); mode = null; ui.paused = false; lab.cam = null; if (saved) { cam.base = saved.base; saved = null; } sim.leaveGarage(); } });
  return { get mode() { return mode; } };
}
