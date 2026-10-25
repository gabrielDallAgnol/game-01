// Socket types: the only places atoms may connect. The rules for what fits live here,
// not in the generators, so every stage and every agent-made atom obeys the same grammar.

export const SOCKETS = {
  'street.end':  { connects: ['street.end', 'junction', 'bridge.end'], note: 'streets meet only at ends or junctions' },
  'junction':    { connects: ['street.end', 'lamp'], note: 'where three or more streets meet' },
  'street.kerb': { connects: ['door', 'drive', 'path', 'tree.kerb', 'lamp'], note: 'the edge of a street a lot faces' },
  'door':        { connects: ['street.kerb', 'path'], note: 'a building entrance; must reach a street' },
  'drive':       { connects: ['street.kerb'], note: 'a driveway from a building to the kerb' },
  'path':        { connects: ['street.kerb', 'door'], note: 'a footpath' },
  'lot.edge':    { connects: ['fence', 'hedge', 'wall', 'lot.edge'], note: 'sides and backs of a lot, never the front' },
  'fence':       { connects: ['lot.edge'], note: 'runs along lot edges' },
  'hedge':       { connects: ['lot.edge'], note: 'a soft fence' },
  'wall':        { connects: ['lot.edge'], note: 'a hard boundary' },
  'party.wall':  { connects: ['party.wall'], gap: 0, note: 'row buildings share a wall' },
  'detached':    { connects: [], gap: 3, note: 'keep a 3 m gap to the neighbour' },
  'rail.end':    { connects: ['rail.end', 'rail.switch', 'rail.buffer'], note: 'tracks join cleanly' },
  'rail.switch': { connects: ['rail.end'], note: 'a points switch: one track in, two out' },
  'rail.buffer': { connects: ['rail.end'], note: 'the end of the line' },
  'water.edge':  { connects: ['bridge.end'], note: 'a bridge sits where a street crosses water' },
  'bridge.end':  { connects: ['water.edge', 'street.end'], note: 'a bridge lands on a street at each bank' },
  'tree.kerb':   { connects: ['street.kerb'], note: 'street trees on the pavement edge' },
  'lamp':        { connects: ['street.kerb', 'junction'], note: 'street lamps' },
  'body.hand':   { connects: ['tool'], note: 'what the hero holds' },
  'body.back':   { connects: ['pack'], note: 'what the hero carries' },
  'tool':        { connects: ['body.hand'], note: '' },
  'pack':        { connects: ['body.back'], note: '' },
};

export const socketTypes = () => Object.keys(SOCKETS);
export const canConnect = (a, b) => !!(SOCKETS[a] && SOCKETS[a].connects.includes(b));
export const gapFor = type => (SOCKETS[type] && SOCKETS[type].gap) || 0;
