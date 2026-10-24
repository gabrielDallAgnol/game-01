Unmodified helper scripts from three.js r128 `examples/js` (MIT licence, © three.js authors).
They attach to the global `THREE` and are inlined into dist/index.html by tools/build.mjs.

`GLTFLoader.js` and `SkeletonUtils.js` (also unmodified r128 `examples/js`, MIT) are NOT in index.html: tools/build.mjs inlines them only
for `node tools/build.mjs --gltf`, so the default build does not grow.
