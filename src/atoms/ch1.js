// Chapter 1 atoms (Ashford Hollow, late summer). Data only: sizes in metres, sockets,
// needs and offers, collision, layer and palette roles. Agents add atoms here, never code.

const house = (id, w, d, roof, roof2) => ({
  id, kind: 'building', size: [w, d], height: 6, layer: 'roof', collide: 'box', roles: [roof, roof2, 'wall.light'],
  sockets: [{ type: 'door', at: 'front' }, { type: 'drive', at: 'front' }, { type: 'lot.edge', at: 'back' }, { type: 'detached', at: 'left' }, { type: 'detached', at: 'right' }],
  needs: ['lot.residential'], offers: ['home:4'], tags: ['house', 'ch1'], setback: [4, 6], light: 0.55, look: 'gable',
});

export const CH1_ATOMS = [
  house('house.suburban.a', 11, 9, 'roof.warm', 'roof.warm2'),
  house('house.suburban.b', 12, 9.5, 'roof.sand', 'roof.sand2'),
  house('house.suburban.c', 10, 8.5, 'roof.cream', 'roof.cream2'),
  house('house.suburban.d', 11.5, 9, 'roof.sage', 'roof.sage2'),
  house('house.suburban.e', 10.5, 9, 'roof.slate', 'roof.slate2'),
  { id: 'shed.garden.a', look: 'gable', kind: 'building', size: [3, 2.5], height: 2.4, layer: 'roof', collide: 'box', roles: ['roof.cream', 'roof.cream2'], needs: ['yard'], tags: ['yard', 'ch1'] },
  { id: 'pool.backyard.a', look: 'pool', kind: 'prop', size: [4.5, 3], height: 0, layer: 'drive', collide: 'box', roles: ['pool', 'road.walk'], needs: ['yard'], tags: ['yard', 'ch1'] },
  { id: 'shop.strip.a', look: 'flat', kind: 'building', size: [28, 9], height: 5, layer: 'roof', collide: 'box', roles: ['roof.sage', 'roof.sage2', 'metal'],
    sockets: [{ type: 'door', at: 'front' }, { type: 'party.wall', at: 'left' }, { type: 'party.wall', at: 'right' }], needs: ['lot.commercial'], offers: ['shop'], tags: ['shop', 'ch1'], setback: [14, 16], light: 0.4, label: 'maple strip' },
  { id: 'shop.pharmacy.a', look: 'flat', kind: 'building', size: [15, 10], height: 5, layer: 'roof', collide: 'box', roles: ['roof.sage', 'roof.sage2', 'metal'],
    sockets: [{ type: 'door', at: 'front' }], needs: ['lot.commercial'], offers: ['shop', 'medicine'], tags: ['shop', 'ch1', 'poi'], setback: [12, 14], light: 0.7, label: 'pharmacy' },
  { id: 'station.fuel.a', look: 'canopy', kind: 'building', size: [16, 11], height: 5, layer: 'roof', collide: 'none', roles: ['roof.cream', 'accent.scarf', 'metal'],
    sockets: [{ type: 'drive', at: 'front' }], needs: ['lot.commercial'], offers: ['fuel'], tags: ['shop', 'ch1', 'canopy'], setback: [5, 7], light: 0.9, label: 'sunny fuel' },
  { id: 'depot.depot9.a', look: 'flat', kind: 'building', size: [40, 16], height: 9, layer: 'roof', collide: 'box', roles: ['roof.slate', 'roof.slate2', 'metal', 'accent.caution'],
    sockets: [{ type: 'door', at: 'front' }, { type: 'drive', at: 'front' }], needs: ['lot.industrial'], offers: ['work'], tags: ['industrial', 'ch1', 'poi'], setback: [16, 18], light: 0.8, label: 'depot 9' },
  { id: 'tree.street.a', look: 'tree', kind: 'tree', size: [6.6, 6.6], height: 8, trunk: 0.35, layer: 'canopy', collide: 'circle', roles: ['tree.a', 'tree.b', 'tree.c'], sockets: [{ type: 'tree.kerb', at: 'center' }], tags: ['tree', 'street', 'street-tree', 'ch1'] },
  { id: 'tree.yard.a', look: 'tree', kind: 'tree', size: [7, 7], height: 8, trunk: 0.35, layer: 'canopy', collide: 'circle', roles: ['tree.a', 'tree.b', 'tree.c'], needs: ['yard'], tags: ['tree', 'yard', 'lone', 'ch1'] },
  { id: 'tree.forest.a', look: 'tree', kind: 'tree', size: [9, 9], height: 12, trunk: 0.4, layer: 'canopy', collide: 'circle', roles: ['tree.a', 'tree.b', 'tree.c'], tags: ['tree', 'forest', 'ch1'] },
  { id: 'tree.forest.b', look: 'tree', kind: 'tree', size: [7, 7], height: 10, trunk: 0.35, layer: 'canopy', collide: 'circle', roles: ['tree.b', 'tree.a', 'tree.c'], tags: ['tree', 'forest', 'ch1'] },
  { id: 'fence.picket.a', look: 'none', kind: 'prop', size: [1, 0.12], height: 1.1, layer: 'low', collide: 'segment', roles: ['fence'], sockets: [{ type: 'fence', at: 'center' }], tags: ['fence', 'ch1'] },
  { id: 'lamp.street.a', look: 'lamp', kind: 'prop', size: [0.4, 0.4], height: 5, layer: 'low', collide: 'circle', roles: ['metal', 'accent.glow'], sockets: [{ type: 'lamp', at: 'center' }], tags: ['lamp', 'ch1'], light: 1 },
  { id: 'car.sedan.a', look: 'car', kind: 'vehicle', size: [4.6, 1.9], height: 1.5, layer: 'low', collide: 'box', roles: ['roof.cream', 'metal', 'roof.warm', 'roof.sand'], tags: ['car', 'ch1'] },
  { id: 'bridge.road.a', look: 'none', kind: 'street', size: [14, 10], height: 0.5, layer: 'road', collide: 'none', roles: ['roof.slate', 'road.asphalt', 'road.line'], sockets: [{ type: 'bridge.end', at: 'left' }, { type: 'bridge.end', at: 'right' }], tags: ['bridge', 'ch1'] },
  { id: 'rig.hauler.a', look: 'rig', kind: 'vehicle', size: [9, 3.2], height: 3.5, layer: 'roof', collide: 'box', roles: ['accent.caution', 'roof.slate'], tags: ['rig', 'camp', 'camp.rig', 'ch1'] },
  { id: 'tarp.camp.a', look: 'tarp', kind: 'building', size: [4.5, 3.2], height: 2, layer: 'roof', collide: 'box', roles: ['accent.hero', 'roof.sand', 'roof.cream'], tags: ['camp', 'camp.tarp', 'ch1'] },
  { id: 'firepit.camp.a', look: 'ring', kind: 'prop', size: [2, 2], height: 0.4, layer: 'low', collide: 'circle', roles: ['metal', 'accent.fire', 'accent.glow'], tags: ['camp', 'camp.fire', 'ch1'], light: 1 },
];
