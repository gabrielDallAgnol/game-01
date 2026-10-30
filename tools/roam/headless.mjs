// [roam] Headless Roam: a stand-in for the DOM canvases the town builder paints its render tiles on (the sim never reads
// them), so the town and the rules run in node for tests, the golden runs and the bots. Import before src/roam.
const noop = () => {};
const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'getImageData' || k === 'createImageData' ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }) : k === 'measureText' ? () => ({ width: 0 }) : k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' ? () => ({ addColorStop: noop }) : noop), set: (o, k, v) => { o[k] = v; return true; } });
const canvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener: noop, toDataURL: () => '' });
if (typeof globalThis.document === 'undefined') globalThis.document = { createElement: canvas, getElementById: () => null };
if (typeof globalThis.OffscreenCanvas === 'undefined') globalThis.OffscreenCanvas = function (w, h) { return Object.assign(canvas(), { width: w, height: h }); };
// three.js stand-in: the tiles make textures from those canvases; any THREE.X is a do-nothing class or a constant
if (typeof globalThis.THREE === 'undefined') globalThis.THREE = new Proxy({}, { get: (o, k) => (o[k] ||= class { constructor() { return new Proxy(this, { get: (t, p) => p in t ? t[p] : noop, set: (t, p, v) => { t[p] = v; return true; } }); } }) });
