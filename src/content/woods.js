// The woods underfoot: numbers for worn trails. The rule lives in src/sim/woods.js.
export const WOODS = {
  passes: 4,     // walk through the same patch of woods this many times and it wears into a trail (dirt: full speed)
  gap: 25,       // seconds: passing again sooner than this does not count (back and forth on one errand is one pass)
  told: '[Trail] Your feet wore a path through the woods. **You walk it at full speed**, and so do the dead.',
};
