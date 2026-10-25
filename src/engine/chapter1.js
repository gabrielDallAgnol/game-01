// Chapter 1 = the suburb recipe. Kept so older callers (tests, tools) still work; new code
// builds any variant through recipes.js.
import { RECIPES, recipeRegistry, buildArea } from './recipes.js';

export const CH1_SIZE = RECIPES.suburb.size;
export function chapter1Registry() { return recipeRegistry('suburb'); }
export function buildChapter1(seed, reg = chapter1Registry()) { return buildArea('suburb', seed, reg); }
