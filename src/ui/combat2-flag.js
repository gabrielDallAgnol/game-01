// [combat2] Whether the run plays with telegraphed bites and the dash: ?v2combat=1 in the URL. Read COMBAT2.on (an
// object, so the bundle shares one live value). The sim never reads the URL: start.js passes it into createGame.
export const COMBAT2 = { on: false };
try { COMBAT2.on = new URLSearchParams(location.search).get('v2combat') === '1'; } catch (e) { /* no location (node) */ }
