// One icon set for the whole game (replaces every emoji and dingbat). 24×24 grid, 1.8 stroke, round joins,
// drawn in currentColor so the Camp HUD (amber) and the System windows (cyan) tint them. Injected once as a sprite.
const P = {
  scrap: '<path d="M12 2.8l7.9 4.6v9.2L12 21.2l-7.9-4.6V7.4z"/><circle cx="12" cy="12" r="3.2"/>',
  food: '<path d="M12 21V9"/><path d="M12 9c0-2.6 1.6-4.6 3.8-5.4C16 6.3 14.6 8.4 12 9z"/><path d="M12 9C12 6.4 10.4 4.4 8.2 3.6 8 6.3 9.4 8.4 12 9z"/><path d="M12 14c0-2.4 1.5-4.2 3.6-5 .2 2.5-1.2 4.4-3.6 5zM12 14c0-2.4-1.5-4.2-3.6-5-.2 2.5 1.2 4.4 3.6 5z"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.4-3.6 2.9-6 6-6s5.6 2.4 6 6"/><path d="M15.4 5.2a3 3 0 0 1 0 5.8M17.2 14.2c2.1.7 3.5 2.8 3.8 5.8"/>',
  noise: '<circle cx="12" cy="12" r="1.8" fill="currentColor"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.2 5.2a9.6 9.6 0 0 0 0 13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6"/>',
  quiet: '<circle cx="12" cy="12" r="1.8" fill="currentColor"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6"/><path d="M4 20L20 4"/>',
  camp: '<path d="M3 20.5h18"/><path d="M4.5 20.5L12 4l7.5 16.5"/><path d="M9.6 20.5L12 15l2.4 5.5"/><path d="M10 3l2 1 2-1"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  heartFill: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" fill="currentColor"/>',
  heartBreak: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/><path d="M12 7.2l-1.6 4 3 2-1.4 3.8"/>',
  level: '<path d="M6 13l6-5 6 5M6 18l6-5 6 5"/>',
  quest: '<path d="M12 2.8L21.2 12 12 21.2 2.8 12z"/><path d="M12 7.6v5.6"/><circle cx="12" cy="16.4" r=".6" fill="currentColor"/>',
  skill: '<path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2L12 21.5l-2.2-7.3L2.5 12l7.3-2.2z"/>',
  title: '<circle cx="12" cy="9" r="5.2"/><path d="M8.7 13l-1.7 8 5-2.6 5 2.6-1.7-8"/><path d="M12 6.4l.8 1.7 1.8.2-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.3 1.8-.2z" fill="currentColor" stroke="none"/>',
  build: '<path d="M14.5 3.5l6 6-2.6 2.6-6-6z"/><path d="M13.2 7.8L4 17a1.9 1.9 0 0 0 2.7 2.7l9.2-9.2"/>',
  map: '<path d="M3 6.5l5.6-2.5 6.8 2.5L21 4v13.5l-5.6 2.5-6.8-2.5L3 20z"/><path d="M8.6 4v13.5M15.4 6.5V20"/>',
  more: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor"/>',
  sound: '<path d="M4 9.5v5h3.5l5 4v-13l-5 4z"/><path d="M16 8.6a4.8 4.8 0 0 1 0 6.8M18.6 6a8.4 8.4 0 0 1 0 12"/>',
  mute: '<path d="M4 9.5v5h3.5l5 4v-13l-5 4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  sword: '<path d="M14.5 3.5H20.5V9.5L9.6 20.4 3.6 14.4z"/><path d="M6.6 11.4l6 6M3.2 20.8l2.6-2.6"/>',
  tower: '<path d="M7 21l1.6-11h6.8L17 21z"/><path d="M6 10h12V5.6l-2 1.4-2-2.2-2 2.2-2-2.2-2 2.2-2-1.4z"/><path d="M10.6 21v-3.6h2.8V21"/>',
  boots: '<path d="M7 3.5v9.8c0 .8-.6 1.5-1.4 1.7L4 15.4V20h15.6c.4-2.6-1.8-4.4-4.8-4.8L11 14.6V3.5z"/><path d="M4 17.6h15.4"/>',
  route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 17c5 0 2-10 8-10.6"/>',
  star: '<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.2"/><circle cx="8.6" cy="8.6" r="1.1" fill="currentColor"/><circle cx="15.4" cy="15.4" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/>',
  skull: '<path d="M12 3.2c-4.6 0-7.8 3.1-7.8 7.2 0 2.5 1.2 4.4 3 5.4V19h9.6v-3.2c1.8-1 3-2.9 3-5.4 0-4.1-3.2-7.2-7.8-7.2z"/><circle cx="9" cy="11" r="1.6" fill="currentColor"/><circle cx="15" cy="11" r="1.6" fill="currentColor"/><path d="M10.4 19v-2.2M13.6 19v-2.2"/>',
  drop: '<path d="M12 3.2s-6 6.8-6 10.8a6 6 0 0 0 12 0c0-4-6-10.8-6-10.8z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>',
  hourglass: '<path d="M6.5 3h11M6.5 21h11"/><path d="M7.5 3c0 4.6 4.5 6 4.5 9s-4.5 4.4-4.5 9M16.5 3c0 4.6-4.5 6-4.5 9s4.5 4.4 4.5 9"/>',
  end: '<circle cx="12" cy="12" r="8.6"/><path d="M8.8 8.8l6.4 6.4M15.2 8.8l-6.4 6.4"/>',
  flag: '<path d="M5.5 21V3.5"/><path d="M5.5 4h12.5l-2.6 4.2L18 12.4H5.5"/>',
  flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-4 3.4-5.6 3.6-10.3 2.4 1.4 3.4 3.4 3.5 5.5 1-.8 1.6-2 1.7-3.4 2.4 1.9 4.2 4.8 4.2 8.2 0 3.6-2.6 6.2-6.5 6.2z"/>',
  smoke: '<path d="M6.5 18.5h10.2a3.8 3.8 0 0 0 .4-7.6 5.4 5.4 0 0 0-10.4-1 4.3 4.3 0 0 0-.2 8.6z"/>',
  run: '<circle cx="14.6" cy="4.4" r="1.9"/><path d="M8 11.4l3.2-3.4 3.6.4 2 3.6 3 .6"/><path d="M11.2 8l-1.4 5.4 3.8 2.6-1 5"/><path d="M9.8 13.4l-2.6 3.2-3.8.2"/>',
  moon: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3L7 7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2"/>',
  next: '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
  quill: '<path d="M20 3.5C11.5 4.3 6.5 9.6 5 18.5"/><path d="M20 3.5c-1 6.6-5.5 10.6-11.6 10.8"/><path d="M3.5 20.5L5 18.5"/>',
  shield: '<path d="M12 2.8l7.6 2.8v6c0 4.7-3.2 8.2-7.6 9.6-4.4-1.4-7.6-4.9-7.6-9.6v-6z"/>',
  fist: '<path d="M7 10.5V7.4a1.7 1.7 0 0 1 3.4 0v2.4-3.6a1.7 1.7 0 0 1 3.4 0v3.6-2.6a1.7 1.7 0 0 1 3.4 0V13c0 4.2-2.6 7.5-6.4 7.5-3.4 0-5.8-2.4-5.8-5.8v-2.2a1.7 1.7 0 0 1 2-1.7z"/>',
  chest: '<rect x="3.5" y="9" width="17" height="11" rx="1.6"/><path d="M3.5 9c0-3 2.2-4.8 5-4.8h7c2.8 0 5 1.8 5 4.8"/><path d="M3.5 13h17"/><rect x="10.4" y="11.4" width="3.2" height="3.6" rx=".8"/>',
  zoomIn: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4l5.1 5.1M10.5 7.6v5.8M7.6 10.5h5.8"/>',
  zoomOut: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4l5.1 5.1M7.6 10.5h5.8"/>',
  horn: '<path d="M3.5 9.6v4.8h3.2L16 19.6V4.4L6.7 9.6z"/><path d="M18.6 9c.9.8 1.4 1.8 1.4 3s-.5 2.2-1.4 3"/><path d="M6.7 14.4l1.1 5.1h2.6l-.8-4"/>',
  lantern: '<path d="M12 2.6v2M9.2 4.6h5.6"/><path d="M8.4 7.2l.8-2.6h5.6l.8 2.6"/><rect x="6.8" y="7.2" width="10.4" height="11" rx="2.2"/><path d="M9 21h6M12 18.2V21"/><path d="M12 9.8c-1.4 1.6-1.8 2.9-.7 4.5 1-.5 1.9-1.6.7-4.5z"/>',
  pin: '<path d="M12 21s-6.2-6.2-6.2-11a6.2 6.2 0 0 1 12.4 0c0 4.8-6.2 11-6.2 11z"/><circle cx="12" cy="10" r="2.2"/>',
  part: '<circle cx="12" cy="12" r="2.8"/><circle cx="12" cy="12" r="6.4"/><path d="M12 2.8v2.8M12 18.4v2.8M2.8 12h2.8M18.4 12h2.8M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2"/>',   // [mech] a part: a gear
};
export const ICONS = Object.keys(P);
/** the sprite, injected once into the page */
export function iconSprite() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(P).map(([k, d]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</symbol>`).join('')}</defs></svg>`;
}
/** one icon, inline: icon('scrap') */
export const icon = (name, cls = '') => `<svg class="ic${cls ? ` ${cls}` : ''}" aria-hidden="true"><use href="#i-${P[name] ? name : 'skill'}"/></svg>`;
