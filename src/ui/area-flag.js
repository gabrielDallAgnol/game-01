// [area] Which engine-built town the run starts in: ?area=suburb|milltown|downtown in the URL, the start screen's
// picker, or for a whole build AREA_FLAG (`node tools/build.mjs --area=milltown`). Read AREA.id (an object, so the
// bundle shares one live value). An unknown id falls back to the default town.
import { AREAS } from '../sim/areamap.js';

export const AREA_FLAG = 'suburb';
export const AREA = { id: AREA_FLAG };
try { const q = new URLSearchParams(location.search).get('area'); if (q && AREAS.includes(q)) AREA.id = q; } catch (e) { /* no location (node) */ }
export const areaOpts = () => ({ area: AREA.id });
