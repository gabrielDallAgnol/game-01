// [top] Readable from above: what the tilted view lifts into the air (bars, name tags, the MAIN tag, the look-at
// tag) is pushed toward screen-up (world −z) instead, and grows a little as the camera pulls back so it still
// reads at 60–90 m. Vertical beams are edge-on from above, so they go; the pulsing ground rings stay.

export function createTopMarks(V) {
  // k: 1 at the default zoom, growing slower than the view (a bar at zoom 4 is twice as big, not four times)
  const k = () => { const h = V.cam.half; return Math.max(1, Math.sqrt(Math.min(h.w, h.h) / 12)); };
  /** the screen-up offset (metres along −z) for a mark that the tilted view hangs at height h */
  const lift = h => (0.3 + 0.3 * h) * k();
  /** a health bar set at height h: off the figure toward screen-up, sized by the zoom */
  function bar(b, h) { b.position.z -= lift(h); b.position.y = 3; b.scale.setScalar(k()); }
  /** a MAIN objective mark: no beam, the tag sits above the ring on screen */
  function main(v) { const kk = k(); v.g.children[0].visible = v.g.children[1].visible = false; v.tag.position.set(0, 3, -(2.3 + 0.9 * kk) * (v.big ? 1.2 : 1)); v.tag.scale.set(6.0 * kk, 1.3 * kk, 1); }
  /** the look-at shot's marks: no beam, the tag above the ring */
  function cinema(beam, tag) { beam.visible = false; if (tag) { tag.position.z -= 4 * k(); tag.position.y = 3; } }
  /** once a frame: floating labels follow the zoom */
  function update() { V.fx2.labelK.value = k(); }
  return { k, lift, bar, main, cinema, update };
}
