// [roam] The opening (the Point): black bars, the camera on the garage at the tip, Kai and the robot, a few lines. Kai
// speaks in words; the robot answers in its eye's light (a short line of glyph marks). Tap to go on; the last tap gives
// the robot back. Shown once (remembered in this browser), again with ?intro=1. UI only: it holds the camera through
// lab.cam and pauses the rules through ui.paused; it never touches the game state.
const LINES = [
  ['KAI', 'Easy. Easy. You\'re home. This is the Point: my garage, between the two rivers.'],
  ['ROBOT', '▪ ▫ ▪'],
  ['KAI', 'You stopped, out there. You were one of them, and you stopped. My kids are alive because of you.'],
  ['KAI', 'Everything past the Point is grey: ash. Most of it comes off the big one wedged in Wend Bridge.'],
  ['KAI', 'It can\'t get out, and nobody can mend the bridge while it\'s there. So we\'re all stuck in here with it.'],
  ['ROBOT', '▪▪ ▫'],
  ['KAI', 'Bring me chips from the machines. I\'ll build something that wakes it up the way you woke up. Then we free it.'],
  ['ROBOT', '▪'],
  ['KAI', 'Go on. Mind the grey.'],
];
export function createIntroUi({ sim, ui, lab, cam, qs }) {
  const S = sim.state, g = S.sites.find(q => q.bay); let seen = false; try { seen = localStorage.getItem('hm-intro-1') === '1'; } catch (e) { /* storage may be off */ }
  if (!g || qs.get('auto') || (seen && !qs.get('intro'))) return { active: false };
  const wrap = document.createElement('div'); wrap.id = 'intro';
  wrap.innerHTML = '<div class="bar top"></div><div class="bar bot"></div><div class="line"><b></b><span></span><i>tap</i></div>';
  const css = document.createElement('style'); css.textContent = `#intro{position:fixed;inset:0;z-index:60;pointer-events:auto}#intro .bar{position:absolute;left:0;right:0;height:13vh;background:#000;transition:height .6s}#intro .top{top:0}#intro .bot{bottom:0}
#intro .line{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(13vh + 18px);width:min(440px,calc(100vw - 32px));background:rgba(8,9,11,.82);border-radius:12px;padding:12px 14px 10px;font:500 15px/1.45 ui-monospace,Menlo,monospace;color:#e9e2cf}
#intro .line b{display:block;font-size:11px;letter-spacing:.14em;color:#f0b44c;margin-bottom:3px}#intro .line i{display:block;text-align:right;font-style:normal;font-size:10px;color:#8a877e;margin-top:4px}#intro .robot span{color:#ffc35a;font-size:22px;letter-spacing:.3em}
body.intro #hud,body.intro #loot,body.intro #area,body.intro #obj,body.intro #pad,body.intro #btns,body.intro #feed,body.intro #fps,body.intro #lookChip,body.intro #toasts{visibility:hidden}`;
  document.head.appendChild(css); document.body.appendChild(wrap); document.body.classList.add('intro');
  const lineEl = wrap.querySelector('.line'), who = wrap.querySelector('b'), say = wrap.querySelector('span'); let i = 0;
  const z0 = cam.ppm, b = S.bike, d = Math.hypot(b.x - g.bay.x, b.y - g.bay.y); cam.base = cam.ppm = Math.max(10, Math.min(30, innerWidth / (d + 14))); lab.cam = { x: (b.x + g.bay.x) / 2, y: (b.y + g.bay.y) / 2 + 3 }; ui.paused = true;   // both in frame: Kai by her doors, the robot
  const show = () => { const [w, s] = LINES[i]; who.textContent = w; say.textContent = s; lineEl.className = 'line' + (w === 'ROBOT' ? ' robot' : ''); };
  show();
  wrap.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); i++; if (i < LINES.length) { show(); return; }
    wrap.remove(); document.body.classList.remove('intro'); lab.cam = null; cam.base = cam.ppm = z0; ui.paused = false; try { localStorage.setItem('hm-intro-1', '1'); } catch (e2) { /* ignore */ } });
  return { active: true };
}
