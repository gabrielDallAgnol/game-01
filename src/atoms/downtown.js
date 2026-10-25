// City-centre atoms (Ashford downtown, the old core). Data only. Tall shopfront rows join by party walls round every
// block; civic buildings face the plaza and become claimable sites in the game; a fountain marks the plaza.

const front = (id, w, d, h, roof, roof2, offers) => ({
  id, look: 'flat', kind: 'building', size: [w, d], height: h, layer: 'roof', collide: 'box', roles: [roof, roof2, 'metal'],
  sockets: [{ type: 'door', at: 'front' }, { type: 'party.wall', at: 'left' }, { type: 'party.wall', at: 'right' }, { type: 'lot.edge', at: 'back' }],
  needs: ['lot.terrace'], offers, tags: ['shopfront', 'downtown'], light: 0.5,
});
const civic = (id, w, d, h, roof, roof2, offer, label) => ({
  id, look: 'flat', kind: 'building', size: [w, d], height: h, layer: 'roof', collide: 'box', roles: [roof, roof2, 'metal'],
  sockets: [{ type: 'door', at: 'front' }], needs: ['lot.civic'], offers: [offer], tags: ['civic', 'poi', 'downtown'], light: 0.8, label, labelRole: 'wall.light',
});

export const DOWNTOWN_ATOMS = [
  front('shop.front.a', 8, 14, 12, 'roof.slate', 'roof.slate2', ['shop']),
  front('shop.front.b', 9.5, 14, 15, 'roof.cream', 'roof.cream2', ['home:6']),
  front('shop.front.c', 7.5, 13, 10, 'roof.sand', 'roof.sand2', ['shop']),
  front('shop.front.d', 11, 14, 16, 'roof.sage', 'roof.sage2', ['home:8']),
  front('shop.front.e', 8.5, 13.5, 13, 'roof.warm2', 'roof.warm', ['shop']),
  civic('civic.police.a', 22, 15, 11, 'roof.slate', 'roof.slate2', 'law', 'police'),
  civic('civic.school.a', 26, 16, 10, 'roof.warm', 'roof.warm2', 'learning', 'school'),
  civic('civic.clinic.a', 20, 14, 12, 'roof.cream', 'roof.cream2', 'medicine', 'clinic'),
  civic('civic.radio.a', 14, 12, 9, 'roof.sand', 'roof.sand2', 'signal', 'radio 9'),
  { id: 'fountain.plaza.a', look: 'ring', kind: 'prop', size: [6, 6], height: 0.8, layer: 'low', collide: 'circle', roles: ['roof.cream2', 'water.deep'], tags: ['fountain', 'downtown'] },
];
