// [top] V2 is seen from straight above (orthographic camera, flat colour); this holds the one top-down scale knob.
// [toppop] from above people are drawn bigger than true scale (the world stays true): hero, dead, folk and allies ×1.8
// [medium] the One-medium look's figures are letters: they need more cells to read (×2.4); ?look=classic keeps ×1.8
export const TOP_FIG = typeof location !== 'undefined' && /[?&]look=classic\b/.test(location.search) ? 1.8 : 2.4;
