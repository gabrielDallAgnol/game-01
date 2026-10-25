// Stage: grid streets. A city centre's square blocks: avenues edge to edge, cut into segments at every junction (streets
// meet only at ends or junctions), the middle block left open as the plaza, where the camp is.
import { STREET } from '../units.js';
import { toWorld } from '../geom.js';
import { nameStreets } from '../names.js';

export const gridStreetsStage = {
  name: 'streets',
  run(W, seed) {
    const rng = seed.rng(), P = { cols: 4, rows: 3, block: 60, w: 9, walk: 2.5, ...(W.params.grid || {}) };
    const pitch = P.block + P.w + 2 * P.walk, F = { x: W.w / 2 + rng.range(-6, 6), y: W.h / 2 + rng.range(-5, 5), rot: rng.range(-0.06, 0.06), w: 0, h: 0 };
    const at = (u, v) => toWorld(F, u, v), u0 = -P.cols * pitch / 2, v0 = -P.rows * pitch / 2, nid = (i, j) => `${i},${j}`;
    for (let j = 0; j <= P.rows; j++) for (let i = 0; i <= P.cols; i++) W.nodes.push({ id: nid(i, j), ...at(u0 + i * pitch, v0 + j * pitch), deg: 2 + (i > 0 && i < P.cols) + (j > 0 && j < P.rows) });
    const seg = (id, a, b, ends, big) => W.streets.push({ id, pts: [a, b], w: P.w, walk: P.walk, kind: 'local', marks: big ? 'double' : 'dash', ends });
    for (let j = 0; j <= P.rows; j++) for (let i = 0; i < P.cols; i++) seg(`h:${i},${j}`, at(u0 + i * pitch, v0 + j * pitch), at(u0 + (i + 1) * pitch, v0 + j * pitch), [nid(i, j), nid(i + 1, j)], j === Math.floor(P.rows / 2));
    for (let i = 0; i <= P.cols; i++) for (let j = 0; j < P.rows; j++) seg(`v:${i},${j}`, at(u0 + i * pitch, v0 + j * pitch), at(u0 + i * pitch, v0 + (j + 1) * pitch), [nid(i, j), nid(i, j + 1)], i === Math.floor(P.cols / 2));
    // the avenues run on past the grid to the edge of the map, so the town opens onto the country
    for (const [id, a, b] of [['out:w', at(u0, 0), at(u0 - 200, 0)], ['out:e', at(-u0, 0), at(-u0 + 200, 0)]]) { const j = Math.floor(P.rows / 2); W.streets.push({ id, pts: [at(id === 'out:w' ? u0 : -u0, v0 + j * pitch), id === 'out:w' ? at(u0 - 200, v0 + j * pitch) : at(-u0 + 200, v0 + j * pitch)], w: P.w, walk: P.walk, kind: 'local', marks: 'double', ends: [id === 'out:w' ? nid(0, j) : nid(P.cols, j), 'edge'] }); }
    // the plaza: the block nearest the middle
    const bi = Math.floor((P.cols - 1) / 2), bj = Math.floor((P.rows - 1) / 2), pc = at(u0 + (bi + 0.5) * pitch, v0 + (bj + 0.5) * pitch);
    W.plaza = { x: pc.x, y: pc.y, w: P.block, h: P.block, rot: F.rot, block: [bi, bj] };
    W.camp = { x: pc.x, y: pc.y, r: 14 };   // the camp is the plaza, in the lab and in the game
    W.grid = { F, at, u0, v0, pitch, P };
    nameStreets(W, seed.child('names').rng(), 'downtown');
    W.note('streets', `${P.cols}×${P.rows} blocks, ${W.streets.length} street segments, plaza at block ${bi},${bj}`);
  },
};
