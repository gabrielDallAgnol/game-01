// Shrinks a GLB for the single-file build: keeps only the named animation clips and drops every accessor / buffer view
// nothing uses any more (the KayKit rigs ship ~76-95 clips, ~2-3 MB of keyframes; a game needs ~6).
//   node tools/gltf-trim.mjs in.glb out.glb Idle Walking_A Running_A ...
import fs from 'node:fs';
const [, , inp, outp, ...keep] = process.argv;
const b = fs.readFileSync(inp), jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl).toString());
const bin = b.subarray(20 + jl + 8, 20 + jl + 8 + b.readUInt32LE(20 + jl));
j.animations = (j.animations || []).filter(a => keep.includes(a.name));
const missing = keep.filter(k => !j.animations.some(a => a.name === k)); if (missing.length) console.error('missing clips:', missing.join(', '));
// collect used accessors
const used = new Set();
for (const m of j.meshes) for (const p of m.primitives) { for (const a of Object.values(p.attributes)) used.add(a); if (p.indices != null) used.add(p.indices); }
for (const s of j.skins || []) if (s.inverseBindMatrices != null) used.add(s.inverseBindMatrices);
for (const a of j.animations) for (const s of a.samplers) { used.add(s.input); used.add(s.output); }
const accMap = new Map(), newAcc = [];
for (const i of [...used].sort((a, c) => a - c)) { accMap.set(i, newAcc.length); newAcc.push(j.accessors[i]); }
const bvUsed = new Set(newAcc.map(a => a.bufferView)); for (const im of j.images || []) if (im.bufferView != null) bvUsed.add(im.bufferView);
const bvMap = new Map(), newBv = [], chunks = []; let off = 0;
for (const i of [...bvUsed].sort((a, c) => a - c)) {
  const v = j.bufferViews[i], data = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength), pad = (4 - off % 4) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
  bvMap.set(i, newBv.length); newBv.push({ ...v, byteOffset: off }); chunks.push(data); off += data.length;
}
for (const a of newAcc) a.bufferView = bvMap.get(a.bufferView);
for (const im of j.images || []) if (im.bufferView != null) im.bufferView = bvMap.get(im.bufferView);
for (const m of j.meshes) for (const p of m.primitives) { for (const k of Object.keys(p.attributes)) p.attributes[k] = accMap.get(p.attributes[k]); if (p.indices != null) p.indices = accMap.get(p.indices); }
for (const s of j.skins || []) if (s.inverseBindMatrices != null) s.inverseBindMatrices = accMap.get(s.inverseBindMatrices);
for (const a of j.animations) for (const s of a.samplers) { s.input = accMap.get(s.input); s.output = accMap.get(s.output); }
j.accessors = newAcc; j.bufferViews = newBv;
const body = Buffer.concat(chunks), pad4 = (4 - body.length % 4) % 4, binBuf = Buffer.concat([body, Buffer.alloc(pad4)]);
j.buffers = [{ byteLength: binBuf.length }];
let js = Buffer.from(JSON.stringify(j)); const jp = (4 - js.length % 4) % 4; js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
const hdr = Buffer.alloc(12); hdr.write('glTF', 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(12 + 8 + js.length + 8 + binBuf.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.write('JSON', 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(binBuf.length, 0); bh.write('BIN\0', 4);
fs.writeFileSync(outp, Buffer.concat([hdr, jh, js, bh, binBuf]));
console.log(`${inp} ${b.length} -> ${outp} ${12 + 8 + js.length + 8 + binBuf.length} bytes, ${j.animations.length} clips`);
