// The opening: five skippable story cards (the hot afternoon at the depot → the Solar Flare → the Ash-Born → under the
// rack → the Thermal Pioneer System window). Tap to go on, Skip to leave. Shown once per profile (store key `introSeen`);
// "Replay the opening" on the start screen's More sheet shows it again. Pure DOM: it never touches the game.
import { INTRO_CARDS, INTRO_UI } from '../content/solar.js';
import { sysRich, typeOn, reduced } from './system.js';

export const INTRO_KEY = 'introSeen';
export const markIntroSeen = store => store.set(INTRO_KEY, true);
/** headless drivers (Playwright, tests) skip the opening unless ?intro=1; ?intro=0 always skips */
export function introWanted(store, search = '') {
  const q = new URLSearchParams(search).get('intro');
  if (q === '0') return false; if (q === '1') return true;
  if (typeof navigator !== 'undefined' && navigator.webdriver) return false;
  return !store.get(INTRO_KEY, false);
}

// ---------- the drawings: simple, warm, flat shapes (one per card) ----------
const rnd = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
const rig = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="0" y="-26" width="86" height="12" rx="2" fill="#f2c230"/><rect x="-18" y="-40" width="26" height="30" rx="3" fill="#f2c230"/><rect x="-14" y="-36" width="14" height="12" fill="#ffe9a0"/><rect x="2" y="-52" width="4" height="14" fill="#3a3430"/><rect x="-4" y="-14" width="96" height="12" rx="6" fill="#2a2522"/><g fill="#555"><circle cx="6" cy="-8" r="3"/><circle cx="30" cy="-8" r="3"/><circle cx="54" cy="-8" r="3"/><circle cx="78" cy="-8" r="3"/></g><path d="M14 -26l12 -16h40l8 16z" fill="#ff8a2a" opacity=".9"/><rect x="62" y="-48" width="18" height="12" fill="#2d6fb0"/><path d="M-22 -34l-30 -8v-8l34 8z" fill="#fff3c0" opacity=".55"/></g>`;
const figure = (x, y, s, c, cracks) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-44" r="7" fill="${c}"/><path d="M-9 -36h18l3 22h-6l-1 14h-10l-1-14h-6z" fill="${c}"/>${cracks ? '<path d="M-5 -40l3 6-2 5M3 -34l-2 8 3 6M-1 -22l2 8" stroke="#ff7a2a" stroke-width="1.4" fill="none"/>' : ''}</g>`;
const ART = {
  depot: () => `<defs><linearGradient id="ig1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd86a"/><stop offset=".55" stop-color="#ff9a4a"/><stop offset="1" stop-color="#c8553a"/></linearGradient><radialGradient id="ig1s"><stop offset="0" stop-color="#fff6c8"/><stop offset="1" stop-color="#ffd86a" stop-opacity="0"/></radialGradient></defs>
    <rect width="390" height="520" fill="url(#ig1)"/><circle cx="280" cy="130" r="130" fill="url(#ig1s)"/><circle cx="280" cy="130" r="38" fill="#fffbe6"/>
    <g fill="#7b3a30"><rect x="0" y="300" width="250" height="110"/><path d="M0 300l20 -22h210l20 22z" fill="#8f453a"/></g><g fill="#3d1c1a">${[0, 1, 2, 3].map(k => `<rect x="${18 + k * 56}" y="344" width="40" height="66"/>`).join('')}</g><g fill="#ffb347" opacity=".35">${[0, 1, 2, 3].map(k => `<rect x="${18 + k * 56}" y="344" width="40" height="8"/>`).join('')}</g>
    <rect x="0" y="410" width="390" height="110" fill="#4a2a24"/><g fill="#2a1614"><rect x="262" y="372" width="96" height="40" rx="3"/><rect x="342" y="382" width="34" height="30" rx="3"/><circle cx="286" cy="414" r="9"/><circle cx="350" cy="414" r="9"/></g>
    <g stroke="#fff3c8" stroke-opacity=".35" fill="none" stroke-width="2">${[0, 1, 2].map(k => `<path class="shim" style="animation-delay:${k * .4}s" d="M0 ${440 + k * 24}q48 -8 97 0t97 0t97 0t99 0"/>`).join('')}</g>${figure(318, 412, 1.2, '#1f1210')}`,
  flare: () => `<defs><radialGradient id="ig2"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#fff0b0"/><stop offset=".7" stop-color="#ff9a3a" stop-opacity=".7"/><stop offset="1" stop-color="#ff5a2a" stop-opacity="0"/></radialGradient></defs>
    <rect width="390" height="520" fill="#2a1a3a"/><rect width="390" height="520" fill="#ffd9a0" opacity=".28"/><circle class="pulse" cx="195" cy="170" r="260" fill="url(#ig2)"/><g stroke="#fff" stroke-opacity=".7" stroke-width="3">${Array.from({ length: 18 }, (_, k) => { const a = k / 18 * 6.283, r1 = 70, r2 = 150 + rnd(k) * 120; return `<path d="M${(195 + Math.cos(a) * r1).toFixed(0)} ${(170 + Math.sin(a) * r1).toFixed(0)}L${(195 + Math.cos(a) * r2).toFixed(0)} ${(170 + Math.sin(a) * r2).toFixed(0)}"/>`; }).join('')}</g>
    <g fill="#1a1020"><path d="M0 520V380l30 0V340h26v40h20V310h30v70h34V350h40v30h30V320h26v60h40V345h30v35h24V300h34v80h26V520z"/></g><g fill="#fff" opacity=".9">${Array.from({ length: 14 }, (_, k) => `<circle cx="${(rnd(k + 3) * 390).toFixed(0)}" cy="${(260 + rnd(k + 9) * 110).toFixed(0)}" r="${(1 + rnd(k) * 2).toFixed(1)}"/>`).join('')}</g>`,
  ash: () => `<defs><linearGradient id="ig3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1a14"/><stop offset=".6" stop-color="#7a3a22"/><stop offset="1" stop-color="#1e100c"/></linearGradient></defs><rect width="390" height="520" fill="url(#ig3)"/>
    <circle cx="195" cy="150" r="90" fill="#ff7a2a" opacity=".16"/><rect x="0" y="420" width="390" height="100" fill="#160c0a"/>
    ${[[70, 440, 2.4], [150, 450, 2.9], [250, 444, 2.6], [330, 452, 2.2]].map(([x, y, s], k) => `<g class="glowfig" style="animation-delay:${k * .3}s">${figure(x, y, s, '#14100f', true)}</g>`).join('')}
    <g fill="#ff7a2a" opacity=".5">${Array.from({ length: 22 }, (_, k) => `<circle class="ember" style="animation-delay:${(k % 7) * .35}s" cx="${(rnd(k + 20) * 390).toFixed(0)}" cy="${(300 + rnd(k + 40) * 150).toFixed(0)}" r="${(1 + rnd(k) * 1.8).toFixed(1)}"/>`).join('')}</g>`,
  rack: () => `<defs><radialGradient id="ig4"><stop offset="0" stop-color="#7fe3ff" stop-opacity=".9"/><stop offset="1" stop-color="#7fe3ff" stop-opacity="0"/></radialGradient></defs><rect width="390" height="520" fill="#140e10"/>
    <g stroke="#6b4a3a" stroke-width="12" fill="none"><path d="M-10 90L320 330"/><path d="M20 20L400 300"/><path d="M-20 200L240 400"/></g><g stroke="#3a2a24" stroke-width="5"><path d="M60 52l40 90M170 100l50 110M300 180l40 80"/></g>
    <circle class="pulse" cx="195" cy="360" r="120" fill="url(#ig4)"/>
    <g fill="#241a1c"><path d="M120 440q40 -80 76 -60q40 -24 74 62z"/><circle cx="196" cy="340" r="17"/></g><g fill="#f2c230"><path d="M150 402l10 -4 8 28h-12z"/></g>${figure(110, 470, 1.3, '#1b1416')}${figure(280, 474, 1.2, '#1b1416')}${figure(200, 480, 1.0, '#1b1416')}<g fill="#7fe3ff" opacity=".8"><circle cx="196" cy="372" r="4"/></g>
    <g stroke="#ffb347" stroke-width="2" opacity=".7" fill="none"><path d="M40 470q20 -30 6 -70M340 460q-18 -26 -4 -60"/></g>`,
  system: () => `<defs><linearGradient id="ig5" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06101c"/><stop offset=".7" stop-color="#14203a"/><stop offset="1" stop-color="#3a2a30"/></linearGradient></defs><rect width="390" height="520" fill="url(#ig5)"/>
    <g stroke="#7fe3ff" stroke-opacity=".12">${Array.from({ length: 12 }, (_, k) => `<path d="M0 ${k * 44}H390"/><path d="M${k * 36} 0V520"/>`).join('')}</g>
    <ellipse cx="195" cy="410" rx="150" ry="30" fill="#ffb347" opacity=".18"/>${rig(120, 420, 1.35)}<g fill="#ffe9a0" opacity=".9"><circle cx="86" cy="378" r="3"/><circle cx="64" cy="374" r="2"/></g>
    <g fill="#e8eefc">${Array.from({ length: 30 }, (_, k) => `<circle cx="${(rnd(k + 2) * 390).toFixed(0)}" cy="${(rnd(k + 8) * 220).toFixed(0)}" r="${(0.5 + rnd(k) * 1).toFixed(1)}" opacity=".6"/>`).join('')}</g>`,
};

const CSS = `#intro{position:fixed;inset:0;z-index:60;background:#07090c;display:grid;grid-template-rows:1fr auto;color:#f4ead6;font-family:var(--body,system-ui);-webkit-user-select:none;user-select:none;touch-action:manipulation;cursor:pointer;opacity:0;transition:opacity .35s}
#intro.on{opacity:1}#intro .iart{position:relative;overflow:hidden;min-height:0}#intro .iart svg{position:absolute;inset:0;width:100%;height:100%;animation:inIn .7s ease-out}
@keyframes inIn{from{opacity:0;transform:scale(1.04)}to{opacity:1;transform:none}}
#intro .iart::after{content:"";position:absolute;left:0;right:0;bottom:0;height:42%;background:linear-gradient(transparent,#07090c)}
#intro .itext{padding:6px 20px calc(22px + env(safe-area-inset-bottom,0px));max-width:480px;width:100%;margin:0 auto;display:grid;gap:10px;min-height:224px;align-content:start}
#intro .ikick{font:600 12px/16px var(--mono,monospace);letter-spacing:.2em;text-transform:uppercase;color:var(--cyan,#7fe3ff)}
#intro .ibody{font:500 20px/28px var(--body,system-ui);min-height:112px}#intro .ibody p{margin:0 0 8px}#intro .ibody p:first-child{font:700 28px/30px var(--display,system-ui);letter-spacing:.01em;color:#fff3d0}
#intro .sysbox{border:1px solid rgba(127,227,255,.55);background:rgba(10,24,40,.7);padding:14px 14px 12px;font:500 14px/22px var(--mono,monospace);color:#d9f4ff;box-shadow:0 0 22px rgba(60,170,255,.22);min-height:112px}
#intro .sysbox p{margin:0 0 6px;font:inherit}#intro .sysbox p:first-child{font:600 15px/20px var(--mono,monospace);color:#7fe3ff;letter-spacing:.04em}#intro .sysbox p:nth-child(2){font:700 20px/26px var(--mono,monospace);color:#fff}
#intro .br{color:#7fe3ff}#intro .caret{display:inline-block;width:8px;height:1em;background:#7fe3ff;vertical-align:-2px;margin-left:2px;animation:inBlink 1s steps(2) infinite}@keyframes inBlink{50%{opacity:0}}
#intro .irow{display:flex;align-items:center;justify-content:space-between;min-height:44px}#intro .dots{display:flex;gap:7px}#intro .dots i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.22)}#intro .dots i.a{background:#ffb347}
#intro .hint{font:500 12px/16px var(--mono,monospace);letter-spacing:.12em;text-transform:uppercase;color:#9fb0b8}#intro .go{background:#ffb347;color:#1f1407;border:0;border-radius:10px;min-height:44px;padding:0 22px;font:700 17px/1 var(--display,system-ui);letter-spacing:.06em;text-transform:uppercase}
#intro .skip{position:absolute;top:calc(12px + env(safe-area-inset-top,0px));right:12px;min-height:44px;min-width:64px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.4);background:rgba(0,0,0,.35);color:#fff;font:600 13px var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;z-index:2}
#intro .shim{animation:inShim 2.4s ease-in-out infinite alternate}@keyframes inShim{to{transform:translateX(-18px)}}
#intro .pulse{transform-origin:center;transform-box:fill-box;animation:inPulse 2.2s ease-in-out infinite alternate}@keyframes inPulse{to{transform:scale(1.08);opacity:.85}}
#intro .glowfig{animation:inGlow 1.8s ease-in-out infinite alternate}@keyframes inGlow{from{filter:drop-shadow(0 0 2px #ff7a2a)}to{filter:drop-shadow(0 0 10px #ff7a2a)}}
#intro .ember{animation:inEmber 3s ease-in infinite}@keyframes inEmber{to{transform:translateY(-60px);opacity:0}}
@media (prefers-reduced-motion:reduce){#intro *{animation:none!important;transition:none!important}}`;

/** show the opening; resolves onDone() once (finished or skipped). Marks it seen as soon as it starts. */
export function playIntro({ store, onDone, root = document.body }) {
  const cards = INTRO_CARDS; let i = 0, busy = false, closed = false;
  if (!document.getElementById('introCss')) { const st = document.createElement('style'); st.id = 'introCss'; st.textContent = CSS; document.head.appendChild(st); }
  markIntroSeen(store);
  const el = document.createElement('div'); el.id = 'intro'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Hollowmere: opening'); root.appendChild(el);
  function finish() { if (closed) return; closed = true; window.removeEventListener('keydown', key, true); el.classList.remove('on'); setTimeout(() => { el.remove(); onDone && onDone(); }, reduced() ? 0 : 300); }
  function show() {
    const c = cards[i], last = i === cards.length - 1;
    el.innerHTML = `<div class="iart"><svg viewBox="0 0 390 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${ART[c.art]()}</svg><button class="skip" data-skip aria-label="Skip the opening">${INTRO_UI.skip}</button></div>
      <div class="itext"><div class="ikick">${c.kick ? sysRich(c.kick) : '&nbsp;'}</div><div class="${c.sys ? 'sysbox' : 'ibody'}" aria-live="polite"></div>
      <div class="irow"><div class="dots">${cards.map((_, k) => `<i class="${k === i ? 'a' : ''}"></i>`).join('')}</div>${last ? `<button class="go" data-go>${c.cta || 'Begin'}</button>` : `<span class="hint">${INTRO_UI.next}</span>`}</div></div>`;
    const body = el.querySelector('.itext > div:nth-child(2)'); busy = true; body.dataset.skip = '';
    body.innerHTML = c.lines.map(() => '<p></p>').join(''); const ps = [...body.querySelectorAll('p')];
    (async () => { for (let k = 0; k < c.lines.length; k++) { if (closed || !body.isConnected) return; await typeOn(ps[k], c.lines[k], c.sys ? 70 : 90); if (body.dataset.skip) { c.lines.forEach((t, j) => { ps[j].innerHTML = sysRich(t); }); break; } } busy = false; })();
    el.onclick = e => { if (e.target.closest('[data-skip]')) { finish(); return; } if (busy) { body.dataset.skip = '1'; ps.forEach((p, j) => { p.dataset.skip = '1'; }); return; } if (last) finish(); else { i++; show(); } };
  }
  function key(e) { if (e.key === 'Escape') { e.preventDefault(); finish(); } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } }
  window.addEventListener('keydown', key, true);
  show(); requestAnimationFrame(() => el.classList.add('on'));
  return { close: finish };
}
