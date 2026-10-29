// [roam] Land: what covers the ground outside streets and lots (fields of wheat or barley in rows, ploughed soil,
// pasture, meadow, woodland floor, gravel and hard lots…). The world gives W.land = [{ kind, poly, dir? }]; this paints
// them into the 'land' map (landItems) and adds the look to the ground shader (landLook, a swap into GROUND like
// gardenLook). The kinds the world uses (fixed, so the world and the look can be built apart): wheat, barley, rape (yellow
// in flower), plough, stubble, pasture, meadow, woods (the floor under trees), lot (asphalt: car parks), gravel, yard
// (concrete or packed earth round farm and works buildings), water. `dir` is the rows' angle (radians) where it matters.
// STUB (the land agent fills it in).
export const LAND_KINDS = {};
export function landItems(W, add) { }
export function landLook(swap, NG) { }
