// The way home on the HUD: under the "Camp 100%" pill (shown when the hero is far from the Camp), the walk home in
// minutes, and at a lit fire or a site you hold by day a "Return to Camp" button (a short channel: stand still).
// The rules and the dusk warning live in sim/pacify.js; this only shows them and taps the API (homeInfo, returnHome).
import { $ } from './shared.js';
import { icon } from './icons.js';

const CSS = `
.campaway .walk{font:600 13px/1 var(--display);color:var(--dim);font-variant-numeric:tabular-nums}
.campaway .walk.late{color:var(--blood)}
.homebtn{justify-self:end;margin-top:6px;display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 14px;border-radius:20px;border:1px solid rgba(240,166,73,.7);
  background:linear-gradient(180deg,rgba(54,36,16,.95),rgba(30,20,10,.95));color:#ffe2b8;font:700 15px/1 var(--display);letter-spacing:.05em;text-transform:uppercase;pointer-events:auto;position:relative;overflow:hidden;
  box-shadow:0 0 14px rgba(240,166,73,.28)}
.homebtn .ic{color:var(--amber);font-size:16px}
.homebtn::after{content:"";position:absolute;inset:-6px}
.homebtn .fill{position:absolute;left:0;top:0;bottom:0;width:calc(var(--p,0)*100%);background:rgba(240,166,73,.28);pointer-events:none}
.homebtn.off{opacity:.55;box-shadow:none}
.homebtn span{position:relative}
`;

export function createHomeward(ui) {
  if (!document.getElementById('hw-css')) { const st = document.createElement('style'); st.id = 'hw-css'; st.textContent = CSS; document.head.appendChild(st); }
  const ca = $('#campAway');
  const walk = document.createElement('span'); walk.className = 'walk'; if (ca) ca.appendChild(walk);
  const btn = document.createElement('button'); btn.className = 'homebtn'; btn.hidden = true; btn.setAttribute('aria-label', 'Return to Haven');
  if (ca && ca.parentNode) ca.parentNode.insertBefore(btn, ca.nextSibling);
  btn.onclick = () => { if (ui.game && !ui.paused && !btn.classList.contains('off')) ui.game.returnHome(); };
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.max(0, Math.round(s)) % 60).padStart(2, '0')}`;
  let sig = '';
  /** called with the HUD (5× a second) */
  function tickHome() {
    const g = ui.game; if (!g || !g.homeInfo || !ca) return;
    const S = g.state, i = g.homeInfo(), day = S.phase === 'day';
    // the walk home, next to the Camp's health: red when dusk comes first
    const late = day && S.clock && g.duskIn() < i.walk;
    const wt = !ca.hidden && i.far ? `· ${mmss(i.walk)}` : '';
    if (walk.textContent !== wt) walk.textContent = wt; walk.classList.toggle('late', late);
    // the button: at a fire or a held site, by day
    const show = !S.over && !S.hero.dead && i.far && day && (i.channel > 0 || (i.from && i.why !== 'nowhere'));
    let label = '', off = false;
    if (show) {
      if (i.channel > 0) label = 'Returning…';
      else if (i.why === 'cooldown') { label = `Return in ${i.cd}s`; off = true; }
      else if (i.why === 'fight') { label = 'Return · fight first'; off = true; }
      else label = 'Return to Haven';
    }
    const k = `${show}|${label}|${off}`;
    if (k !== sig) { sig = k; btn.hidden = !show; btn.classList.toggle('off', off); btn.innerHTML = `<i class="fill"></i>${icon('camp')}<span>${label}</span>`; }
    btn.style.setProperty('--p', i.channel || 0);
  }
  return { tickHome };
}
