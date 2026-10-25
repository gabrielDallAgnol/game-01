// [v2] The V2 core: ?v2=1 in the URL switches the old v56 systems off (the cut list: sim/v2core.js). Read V2.on (an
// object, so the bundle shares one live value). The sim never reads the URL: start.js passes it into createGame.
// A whole build can start with it on: V2_FLAG (`node tools/build.mjs --v2`); ?v2=0 turns it off.
export const V2_FLAG = true;
export const V2 = { on: false };
try { const q = new URLSearchParams(location.search).get('v2'); V2.on = q === '1' || (V2_FLAG && q !== '0'); } catch (e) { /* no location (node) */ }
