
// ============================================================================
// 【舞台データ①：天（地上5エリア）・光の階段＆素材パズル定義】
// ============================================================================
window.AREA_REGISTRY = window.AREA_REGISTRY || {};

window.AREA_REGISTRY.sky_1 = {
  id: 'sky_1',
  group: 'sky',
  name: '☀️ 天1：そよ風の丘',
  persistent: false,
  dreamBonus: 'curiosity',
  theme: {
    skyHex: 0x152c52,
    topColor: 0xa7f3d0,
    midColor: 0x86efac,
    soilColor: 0xd4a373,
    wetColor: 0xb07d56,
    showWaterfall: true
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
    { type: 'stairs_up',   x: 2,  z: -2, target: 'sky_2', label: '✨ 光の階段（天2へ）', needPuzzle: false },
    { type: 'stairs_down', x: -2, z: 2,  target: 'home',  label: '🏠 住居へ戻る',        needPuzzle: false }
  ],
  puzzle: null,
  npcId: 'npc_wind_merchant',
  enemyId: null,
  petId: 'pet_sky_chick'
};

window.AREA_REGISTRY.sky_2 = {
  id: 'sky_2',
  group: 'sky',
  name: '☁️ 天2：わたぐもテラス',
  persistent: false,
  dreamBonus: 'curiosity',
  theme: {
    skyHex: 0x1d3b6b,
    topColor: 0xe0f2fe,
    midColor: 0xbae6fd,
    soilColor: 0xcbd5e1,
    wetColor: 0x94a3b8,
    showWaterfall: true
  },
  spawn: { x: -1, z: 1, lv: 0 },
  defaultHeight: 0,
  heights: { '0,-1': 1, '1,-2': 1, '2,-2': 2, '-2,-1': 1 },
  carves: [
    { type: 'top', x: 0, z: 0, keep: 2 },
    { type: 'top', x: 1, z: -1, keep: 3 }
  ],
  items: [
    { type: 'stone', x: -2, z: 0 },
    { type: 'apple', x: 1, z: 1 }
  ],
  portals: [
    { type: 'stairs_up',   x: 2,  z: -2, target: 'sky_3', label: '✨ 光の階段（天3へ）', needPuzzle: true },
    { type: 'stairs_down', x: -2, z: 2,  target: 'sky_1', label: '⬇️ 天1へ下りる',      needPuzzle: false }
  ],
  puzzle: {
    x: 0, z: -1,
    needItem: 'stone',
    desc: '雲の台座に🪨石を置くと天3への光の階段が開く！',
    reward: 'unlock_portal'
  },
  npcId: 'npc_cloud_baker',
  enemyId: 'enemy_gust_puff',
  petId: null
};

window.AREA_REGISTRY.sky_3 = {
  id: 'sky_3',
  group: 'sky',
  name: '🌈 天3：にじの段々畑',
  persistent: false,
  dreamBonus: 'cautionLimiter',
  theme: {
    skyHex: 0x25386e,
    topColor: 0xfde68a,
    midColor: 0xfca5a5,
    soilColor: 0xfdba74,
    wetColor: 0xc084fc,
    showWaterfall: true
  },
  spawn: { x: -1, z: 1, lv: 0 },
  defaultHeight: 0,
  heights: { '-1,-1': 1, '0,-1': 1, '1,-1': 2, '2,-2': 2, '1,2': 1 },
  carves: [
    { type: 'top', x: 0, z: 0, keep: 2 },
    { type: 'top', x: 1, z: 0, keep: 4 }
  ],
  items: [
    { type: 'grass', x: -2, z: -1 },
    { type: 'apple', x: 2, z: 1 }
  ],
  portals: [
    { type: 'stairs_up',   x: 2,  z: -2, target: 'sky_4', label: '✨ 光の階段（天4へ）', needPuzzle: false },
    { type: 'stairs_down', x: -2, z: 2,  target: 'sky_2', label: '⬇️ 天2へ下りる',      needPuzzle: false }
  ],
  puzzle: {
    x: 1, z: 2,
    needItem: 'grass',
    desc: 'にじの花壇に🌿草を植えると🎵げいじゅつ夢ゲージが大きく育つ！',
    reward: 'dream_boost'
  },
  npcId: 'npc_rainbow_painter',
  enemyId: 'enemy_prism_beetle',
  petId: 'pet_prism_fox'
};

window.AREA_REGISTRY.sky_4 = {
  id: 'sky_4',
  group: 'sky',
  name: '🌠 天4：ほしぞら展望台',
  persistent: false,
  dreamBonus: 'logic',
  theme: {
    skyHex: 0x091026,
    topColor: 0xc4b5fd,
    midColor: 0x818cf8,
    soilColor: 0x475569,
    wetColor: 0x334155,
    showWaterfall: false
  },
  spawn: { x: 0, z: 2, lv: 0 },
  defaultHeight: 0,
  heights: { '0,0': 1, '0,-1': 2, '1,-1': 2, '2,-2': 3, '-2,0': 1 },
  carves: [
    { type: 'top', x: 0, z: 1, keep: 3 },
    { type: 'top', x: 1, z: 0, keep: 4 }
  ],
  items: [
    { type: 'grass', x: -2, z: 0 },
    { type: 'oil',   x: 2, z: 1 }
  ],
  portals: [
    { type: 'stairs_up',   x: 2,  z: -2, target: 'sky_5', label: '✨ 光の階段（天空頂上へ）', needPuzzle: true },
    { type: 'stairs_down', x: -2, z: 2,  target: 'sky_3', label: '⬇️ 天3へ下りる',            needPuzzle: false }
  ],
  puzzle: {
    x: 0, z: 0,
    needItem: 'grass',
    desc: '星見台に🌿草ブロックを供えると最上階への光の階段が開く！',
    reward: 'unlock_portal'
  },
  npcId: 'npc_star_keeper',
  enemyId: 'enemy_meteor_wisp',
  petId: null
};

window.AREA_REGISTRY.sky_5 = {
  id: 'sky_5',
  group: 'sky',
  name: '👑 天5：天空のいただき',
  persistent: false,
  dreamBonus: 'curiosity',
  theme: {
    skyHex: 0x05091a,
    topColor: 0xfef08a,
    midColor: 0xfde047,
    soilColor: 0xe2e8f0,
    wetColor: 0x94a3b8,
    showWaterfall: false
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
    { type: 'warp',        x: 2,  z: -2, target: 'home',  label: '🌀 住居へ帰還ワープ', needPuzzle: false },
    { type: 'stairs_down', x: -2, z: 2,  target: 'sky_4', label: '⬇️ 天4へ下りる',      needPuzzle: false }
  ],
  puzzle: {
    x: 0, z: -1,
    needItem: 'apple',
    desc: '天空の祭壇に🍎リンゴを置くとお宝と全夢ゲージ祝福！',
    reward: 'dream_boost'
  },
  npcId: 'npc_sky_king',
  enemyId: null,
  petId: 'pet_star_dragon'
};
