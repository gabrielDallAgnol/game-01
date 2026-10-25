// Mill town atoms (Ironvale, a burned rail town in the opening area). Data only, like ch1.
// Rowhouses join by party walls (gap 0); ruins share the same footprint and carry their walls
// as segment atoms, so you can walk into them; rail cars ride the siding.

const terrace = (id, w, d, roof, roof2) => ({
  id, look: 'gable', kind: 'building', size: [w, d], height: 7, layer: 'roof', collide: 'box', roles: [roof, roof2, 'roof.slate'],
  sockets: [{ type: 'door', at: 'front' }, { type: 'party.wall', at: 'left' }, { type: 'party.wall', at: 'right' }, { type: 'lot.edge', at: 'back' }],
  needs: ['lot.terrace'], offers: ['home:3'], tags: ['house', 'terrace', 'milltown'], light: 0.4,
});

export const MILL_ATOMS = [
  terrace('terrace.brick.a', 5.6, 9, 'roof.slate', 'roof.slate2'),
  terrace('terrace.brick.b', 6, 9.5, 'roof.warm2', 'roof.warm'),
  terrace('terrace.brick.c', 6.4, 9, 'roof.sand2', 'roof.sand'),
  terrace('terrace.brick.d', 5.8, 9, 'roof.slate2', 'roof.slate'),
  { id: 'ruin.terrace.a', look: 'ruin', kind: 'building', size: [6, 9], height: 0, layer: 'low', collide: 'none', roles: ['road.lot', 'ground.gravel', 'roof.slate2'],
    sockets: [{ type: 'party.wall', at: 'left' }, { type: 'party.wall', at: 'right' }, { type: 'door', at: 'front' }], needs: ['lot.terrace'], tags: ['ruin', 'milltown'] },
  { id: 'wall.ruin.a', look: 'none', kind: 'prop', size: [1, 0.4], height: 2.6, layer: 'low', collide: 'segment', roles: ['roof.cream2'], tags: ['wall', 'milltown'], thick: 0.4, posts: false },
  { id: 'wall.yard.a', look: 'none', kind: 'prop', size: [1, 0.3], height: 1.8, layer: 'low', collide: 'segment', roles: ['roof.cream2'], tags: ['wall', 'yard-wall', 'milltown'], thick: 0.3, posts: false },
  { id: 'mill.ironvale.a', look: 'flat', kind: 'building', size: [44, 20], height: 12, layer: 'roof', collide: 'box', roles: ['roof.slate', 'roof.slate2', 'metal'],
    sockets: [{ type: 'door', at: 'front' }], needs: ['lot.industrial'], offers: ['work', 'iron'], tags: ['industrial', 'poi', 'must', 'milltown'], light: 0.6, label: 'ironvale mill', labelRole: 'accent.caution' },
  { id: 'tower.water.a', look: 'tower', kind: 'building', size: [6, 6], height: 14, layer: 'roof', collide: 'circle', roles: ['roof.slate', 'roof.slate2', 'metal'], tags: ['landmark', 'milltown'] },
  { id: 'railcar.box.a', look: 'railcar', kind: 'vehicle', size: [14, 3], height: 4, layer: 'roof', collide: 'box', roles: ['roof.warm2', 'roof.sage2', 'roof.slate', 'metal'], sockets: [{ type: 'rail.end', at: 'left' }, { type: 'rail.end', at: 'right' }], tags: ['railcar', 'milltown'] },
  { id: 'nest.inferno.a', look: 'nest', kind: 'building', size: [16, 16], height: 3, layer: 'low', collide: 'circle', roles: ['roof.slate2', 'roof.slate', 'accent.fire', 'accent.ember'], tags: ['nest', 'poi', 'must', 'milltown'], light: 1 },
  { id: 'crater.ash.a', look: 'crater', kind: 'prop', size: [5, 4], height: 0, layer: 'ground', collide: 'none', roles: ['roof.slate2', 'roof.slate'], tags: ['crater', 'milltown'] },
  { id: 'tree.dead.a', look: 'deadtree', kind: 'tree', size: [6, 6], height: 7, trunk: 0.3, layer: 'canopy', collide: 'circle', roles: ['roof.slate', 'roof.slate2'], tags: ['tree', 'forest-dead', 'milltown'] },
  { id: 'tree.dead.b', look: 'deadtree', kind: 'tree', size: [4.6, 4.6], height: 5, trunk: 0.25, layer: 'canopy', collide: 'circle', roles: ['roof.slate2', 'roof.slate'], tags: ['tree', 'forest-dead', 'milltown'] },
];
