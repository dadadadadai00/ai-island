// ============================================================================
// 【舞台データ①：天（地上5エリア）・パステル島統一カラー版】
// ============================================================================
window.AREA_REGISTRY = window.AREA_REGISTRY || {};

window.AREA_REGISTRY.sky_1 = {
  id: 'sky_1',
  group: 'sky',
  name: '☀️ 天1：そよ風のパステル丘',
  persistent: false,
  dreamBonus: 'curiosity',
  palette: {
    pastelGreenTop: 0xa7f3d0,
    pastelGreenMid: 0x86efac,
    dryPastelSoil:  0xd4a373,
    wetSoilLv2:     0xb07d56
  },
  spawn: { x: 0, z: 0, lv: 0 },
  defaultHeight: 0,
  heights: { '1,1': 1, '2,-2': 1, '-1,2': 1 },
  carves: [
    { type: 'top', x: 1, z: 0, keep: 2 },
    { type: 'top', x: 0, z: 1, keep: 3 }
  ],
  items: [
    { type: 'apple', x: -1, z: 1 },
    { type: 'stone', x: 1, z: -1 }
  ],
  portals: [
    { type: 'stairs_up',   x: 2,  z: -2, target: 'sky_2', label: '🪜 パステル階段（天2へ）', needPuzzle: false },
    { type: 'stairs_down', x: -2, z: 2,  target: 'home',  label: '🏠 マイホームへ戻る',       needPuzzle: false }
  ],
  puzzle: null,
  npcId: 'npc_wind_merchant',
  enemyId: null,
  petId: 'pet_sky_chick'
};

window.AREA_REGISTRY.sky_2 = {
  id: 'sky_2',
  group: 'sky',
  name: '☁️ 天2：わたぐもパステルテラス',
  persistent: false,
  dreamBonus: 'curiosity',
  palette: {
    pastelGreenTop: 0xdbeafe,
    pastelGreenMid: 0xbfdbfe,
    dryPastelSoil:  0xd6c7b2,
    wetSoilLv2:     0xb09f89
  },
  spawn: { x: -1, z: 1, lv: 0 },
  defaultHeight: 0,
  heights: { '0,-1': 1, '1,-1': 1, '2,-2': 1, '-2,-1': 1 },
  carves: [
    { type: 'top', x: 0, z: 0, keep: 2 },
    { type: 'top', x: 1, z: -1, keep: 3 }
  ],
  items: [
    { type: 'stone', x: -2, z: 0 },
    { type: 'apple', x: 1, z: 1 }
  ],
  portals: [
    { type: 'stairs_up',   x: 2,  z: -2, target: 'sky_3', label: '🪜 パステル階段（天3へ）', needPuzzle: true },
    { type: 'stairs_down', x: -2, z: 2,  target: 'sky_1', label: '⬇️ 天1へ下りる',          needPuzzle: false }
  ],
  puzzle: {
    x: 0, z: -1,
    needItem: 'stone',
    desc: '雲の台座に🪨石を置くと天3への階段が開くよ！',
    reward: 'unlock_portal'
  },
  npcId: 'npc_cloud_baker',
  enemyId: 'enemy_gust_puff',
  petId: null
};

window.AREA_REGISTRY.sky_3 = {
  id: 'sky_3',
  group: 'sky',
  name: '🌈 天3：はなびらの段々畑',
  persistent: false,
  dreamBonus: 'cautionLimiter',
  palette: {
    pastelGreenTop: 0xfde68a,
    pastelGreenMid: 0xfecdd3,
    dryPastelSoil:  0xdcc3a1,
    wetSoilLv2:     0xb69b7a
  },
  spawn: { x: -1, z: 1, lv: 0 },
  defaultHeight: 0,
  heights: { '-1,-1': 1, '0,-1': 1, '1,-1': 1, '2,-2': 2, '1,2': 1 },
  carves: [
    { type: 'top', x: 0, z: 0, keep: 2 },
    { type: 'top', x: 1, z: 0, keep: 4 }
  ],
  items: [
    { type: 'grass', x: -2, z: -1 },
    { type: 'apple', x: 2, z: 1 }
  ],
  portals: [
    { type: 'stairs_up',   x: 2,  z: -2, target: 'sky_4', label: '🪜 パステル階段（天4へ）', needPuzzle: false },
    { type: 'stairs_down', x: -2, z: 2,  target: 'sky_2', label: '⬇️ 天2へ下りる',          needPuzzle: false }
  ],
  puzzle: {
    x: 1, z: 2,
    needItem: 'grass',
    desc: '花壇に🌿草ブロックを植えると🎵げいじゅつ夢ゲージが大きく育つよ！',
    reward: 'dream_boost'
  },
  npcId: 'npc_rainbow_painter',
  enemyId: 'enemy_prism_beetle',
  petId: 'pet_prism_fox'
};

window.AREA_REGISTRY.sky_4 = {
  id: 'sky_4',
  group: 'sky',
  name: '🌠 天4：ほしぞら見晴らし台',
  persistent: false,
  dreamBonus: 'logic',
  palette: {
    pastelGreenTop: 0xddd6fe,
    pastelGreenMid: 0xc4b5fd,
    dryPastelSoil:  0xcbbba0,
    wetSoilLv2:     0x9e8f77
  },
  spawn: { x: 0, z: 2, lv: 0 },
  defaultHeight: 0,
  heights: { '0,0': 1, '0,-1': 1, '1,-1': 2, '2,-2': 2, '-2,0': 1 },
  carves: [
    { type: 'top', x: 0, z: 1, keep: 3 },
    { type: 'top', x: 1, z: 0, keep: 4 }
  ],
  items: [
    { type: 'grass', x: -2, z: 0 },
    { type: 'oil',   x: 2, z: 1 }
  ],
  portals: [
    { type: 'stairs_up',   x: 2,  z: -2, target: 'sky_5', label: '🪜 パステル階段（天空頂上へ）', needPuzzle: true },
    { type: 'stairs_down', x: -2, z: 2,  target: 'sky_3', label: '⬇️ 天3へ下りる',                needPuzzle: false }
  ],
  puzzle: {
    x: 0, z: 0,
    needItem: 'grass',
    desc: '星見台に🌿草ブロックを供えると最上階への階段が開くよ！',
    reward: 'unlock_portal'
  },
  npcId: 'npc_star_keeper',
  enemyId: 'enemy_meteor_wisp',
  petId: null
};

window.AREA_REGISTRY.sky_5 = {
  id: 'sky_5',
  group: 'sky',
  name: '👑 天5：そらのパステル頂上',
  persistent: false,
  dreamBonus: 'curiosity',
  palette: {
    pastelGreenTop: 0xfef08a,
    pastelGreenMid: 0xbbf7d0,
    dryPastelSoil:  0xdfd0b8,
    wetSoilLv2:     0xb8a890
  },
  spawn: { x: 0, z: 1, lv: 0 },
  defaultHeight: 0,
  heights: { '0,-1': 2, '0,0': 1, '-1,-1': 1, '1,-1': 1 },
  carves: [
    { type: 'top', x: 0, z: 0, keep: 3 }
  ],
  items: [
    { type: 'apple', x: 0, z: -1 },
    { type: 'stone', x: -1, z: -1 },
    { type: 'grass', x: 1, z: -1 }
  ],
  portals: [
    { type: 'warp',        x: 2,  z: -2, target: 'home',  label: '🌀 マイホームへ帰還ワープ', needPuzzle: false },
    { type: 'stairs_down', x: -2, z: 2,  target: 'sky_4', label: '⬇️ 天4へ下りる',            needPuzzle: false }
  ],
  puzzle: {
    x: 0, z: -1,
    needItem: 'apple',
    desc: '頂上の祭壇に🍎リンゴを置くと夢ゲージが大きく祝福されるよ！',
    reward: 'dream_boost'
  },
  npcId: 'npc_sky_king',
  enemyId: null,
  petId: 'pet_star_dragon'
};
