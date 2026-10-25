// [area] Which engine-built town the run starts in: ?area=suburb|milltown in the URL, or for a whole build with
// AREA_FLAG (`node tools/build.mjs --area=milltown`); ?area=0 turns a flagged build off. Read AREA.id (an object, so
// the bundle shares one live value). Without it the frontier map is generated exactly as before.
import { AREAS } from '../sim/areamap.js';

export const AREA_FLAG = 'suburb';
export const AREA = { id: null };
try { const q = new URLSearchParams(location.search).get('area'); const id = q === null ? AREA_FLAG : q === '0' ? '' : q; AREA.id = AREAS.includes(id) ? id : null; } catch (e) { /* no location (node) */ }
export const areaOpts = () => (AREA.id ? { area: AREA.id } : {});
