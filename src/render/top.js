// [top] The top-down spike's switch: the world seen from straight above (orthographic camera, flat colour).
// On with ?top=1 in the URL, or for a whole build with TOP_FLAG (`node tools/build.mjs --top` flips it); ?top=0
// turns a flagged build off. Read TOP.on (an object, so the bundle shares one live value). Render and UI only.
export const TOP_FLAG = true;
export const TOP = { on: false };
try { const q = new URLSearchParams(location.search).get('top'); TOP.on = q === '1' || (TOP_FLAG && q !== '0'); } catch (e) { /* no location (node) */ }
// [toppop] from above people are drawn bigger than true scale (the world stays true): hero, dead, folk and allies ×1.8
export const TOP_FIG = 1.8;
