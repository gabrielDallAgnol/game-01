// [gemini3] The build tag on the start screen ("v56 · 2026-10-25 06:40") and in the console, so the player can tell a
// reload picked up the latest build. Wraps ui.showCard: the start card gets the tag under its title line.
import { BUILD } from '../version.js';

export function createVersion(ui) {
  const tag = `${BUILD.version} · ${BUILD.time}`;
  try { console.info(`Hold Hollowmere ${tag}`); } catch { /* no console */ }
  const show = ui.showCard;
  if (typeof show === 'function') ui.showCard = (kind, html, o) => {
    const r = show(kind, html, o);
    if (kind === 'start') {
      const c = document.querySelector('#card'), k = c && c.querySelector('.kick');
      if (k && !c.querySelector('.buildtag')) {
        const el = document.createElement('div'); el.className = 'buildtag'; el.textContent = `Build ${tag}`;
        el.style.cssText = 'font:600 11px/14px var(--mono,monospace);letter-spacing:.06em;color:var(--cyan,#7fe3ff);opacity:.75;margin:-6px 0 8px';
        k.after(el);
      }
    }
    return r;
  };
  return { buildTag: () => tag };
}
