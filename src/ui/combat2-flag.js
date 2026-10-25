// [combat2] Whether the run plays with telegraphed bites and the dash: ?v2combat=1 in the URL. Read COMBAT2.on (an
// object, so the bundle shares one live value). The sim never reads the URL: start.js passes it into createGame.
// A whole build can start with it on: COMBAT2_FLAG (`node tools/build.mjs --v2combat`); ?v2combat=0 turns it off.
export const COMBAT2_FLAG = false;
export const COMBAT2 = { on: false };
try { const q = new URLSearchParams(location.search).get('v2combat'); COMBAT2.on = q === '1' || (COMBAT2_FLAG && q !== '0'); } catch (e) { /* no location (node) */ }
