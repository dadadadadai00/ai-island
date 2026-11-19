// ============================================================================
// 【舞台データ②：地（地下5エリア）・パステル島統一カラー版】
// ============================================================================
window.AREA_REGISTRY = window.AREA_REGISTRY || {};

window.AREA_REGISTRY.earth_1 = {
  id: 'earth_1',
  group: 'earth',
  name: '⛏️ 地1：しめり土の入り口',
  persistent: false,
  dreamBonus: 'power',
  palette: {
    pastelGreenTop: 0xbbf7d0,
    pastelGreenMid: 0xd4a373,
    dryPastelSoil:  0xb07d56,
    wetSoilLv2:     0x9c6644
  },
  spawn: { x: 0, z: 0, lv: -1 },
  defaultHeight: 0,
  heights: { '0,0': -1, '0,-1': -1, '1,0': -1, '-1,1': 0 },
  carves: [
    { type: 'tunnel', x: -1, z: 0, lv: 0, w: 3, h: 2 },
    { type: 'top', x: 1, z: 1, keep: 2 }
  ],
  items: [
    { type: 'stone', x: 1, z: 0 },
    { type: 'oil',   x: -1, z: 0 }
  ],
  portals: [
    { type: 'hole_down', x: 0,  z: -1, target: 'earth_2', label: '🕳️ 掘り抜き穴（地2へ）', needPuzzle: false },
    { type: 'stairs_up', x: -2, z: 2,  target: 'home',    label: '🏠 マイホームへ戻る',     needPuzzle: false }
  ],
  puzzle: null,
  npcId: 'npc_mole_miner',
  enemyId: 'enemy_rock_crab',
  petId: 'pet_mini_mole'
};

window.AREA_REGISTRY.earth_2 = {
  id: 'earth_2',
  group: 'earth',
  name: '🍄 地2：ひかり苔のほら穴',
  persistent: false,
  dreamBonus: 'eco',
  palette: {
    pastelGreenTop: 0x99f6e4,
    pastelGreenMid: 0x6ee7b7,
    dryPastelSoil:  0xb89f80,
    wetSoilLv2:     0x8f775c
  },
  spawn: { x: 0, z: 1, lv: -1 },
  defaultHeight: 0,
  heights: { '0,1': -1, '0,0': -1, '-1,0': -1, '1,-1': -2 },
  carves: [
    { type: 'tunnel', x: 1, z: 0, lv: 0, w: 2, h: 2 },
    { type: 'top', x: -1, z: -1, keep: 2 }
  ],
  items: [
    { type: 'grass', x: -1, z: 0 },
    { type: 'apple', x: 0, z: 0 }
  ],
  portals: [
    { type: 'hole_down', x: 1,  z: -1, target: 'earth_3', label: '🕳️ 掘り抜き穴（地3へ）', needPuzzle: true },
    { type: 'stairs_up', x: -2, z: 2,  target: 'earth_1', label: '⬆️ 地1へ戻る',           needPuzzle: false }
  ],
  puzzle: {
    x: 0, z: 0,
    needItem: 'oil',
    desc: '狭い岩のすき間に🧴オイルを塗ると地3への抜け穴が開通するよ！',
    reward: 'unlock_portal'
  },
  npcId: 'npc_moss_chef',
  enemyId: 'enemy_glow_slime',
  petId: null
};

window.AREA_REGISTRY.earth_3 = {
  id: 'earth_3',
  group: 'earth',
  name: '💎 地3：パステル水晶の鉱脈',
  persistent: false,
  dreamBonus: 'logic',
  palette: {
    pastelGreenTop: 0xcffafe,
    pastelGreenMid: 0xa5f3fc,
    dryPastelSoil:  0xc4b5fd,
    wetSoilLv2:     0x9e8fb2
  },
  spawn: { x: -1, z: 1, lv: -1 },
  defaultHeight: 0,
  heights: { '-1,1': -1, '0,0': -1, '1,0': -2, '0,-1': -2, '2,-1': 1 },
  carves: [
    { type: 'top', x: 0, z: 1, keep: 2 },
    { type: 'tunnel', x: -1, z: -1, lv: 0, w: 3, h: 3 }
  ],
  items: [
    { type: 'stone', x: 0, z: 0 },
    { type: 'stone', x: -1, z: -1 }
  ],
  portals: [
    { type: 'hole_down', x: 1,  z: 0, target: 'earth_4', label: '🕳️ 掘り抜き穴（地4へ）', needPuzzle: false },
    { type: 'stairs_up', x: -2, z: 2, target: 'earth_2', label: '⬆️ 地2へ戻る',           needPuzzle: false }
  ],
  puzzle: {
    x: 0, z: -1,
    needItem: 'stone',
    desc: '水晶の共鳴台に🪨石を置くと💡かしこさ夢ゲージが大きく育つよ！',
    reward: 'dream_boost'
  },
  npcId: 'npc_crystal_smith',
  enemyId: 'enemy_rock_crab',
  petId: 'pet_crystal_pup'
};

window.AREA_REGISTRY.earth_4 = {
  id: 'earth_4',
  group: 'earth',
  name: '🦴 地4：こだい化石のねむる層',
  persistent: false,
  dreamBonus: 'power',
  palette: {
    pastelGreenTop: 0xfef3c7,
    pastelGreenMid: 0xfde68a,
    dryPastelSoil:  0xc29b70,
    wetSoilLv2:     0x96704b
  },
  spawn: { x: 0, z: 1, lv: -1 },
  defaultHeight: 0,
  heights: { '0,1': -1, '0,0': -2, '-1,0': -2, '1,0': -2, '0,-1': -3 },
  carves: [
    { type: 'top', x: 1, z: 1, keep: 2 },
    { type: 'tunnel', x: -1, z: 1, lv: 0, w: 2, h: 2 }
  ],
  items: [
    { type: 'stone', x: -1, z: 0 },
    { type: 'oil',   x: 1, z: 0 }
  ],
  portals: [
    { type: 'hole_down', x: 0,  z: -1, target: 'earth_5', label: '🕳️ 最深部の穴（地5へ）', needPuzzle: true },
    { type: 'stairs_up', x: -2, z: 2,  target: 'earth_3', label: '⬆️ 地3へ戻る',           needPuzzle: false }
  ],
  puzzle: {
    x: 0, z: 0,
    needItem: 'stone',
    desc: '古代のスイッチに🪨石を重しとして置くと最深部の穴が開くよ！',
    reward: 'unlock_portal'
  },
  npcId: 'npc_fossil_prof',
  enemyId: 'enemy_magma_bug',
  petId: null
};

window.AREA_REGISTRY.earth_5 = {
  id: 'earth_5',
  group: 'earth',
  name: '🐢 地5：巨大ガメのせなか（地底湖）',
  persistent: false,
  dreamBonus: 'eco',
  palette: {
    pastelGreenTop: 0xbae6fd,
    pastelGreenMid: 0x7dd3fc,
    dryPastelSoil:  0xd6bfa3,
    wetSoilLv2:     0xb89f80
  },
  spawn: { x: 0, z: 1, lv: -1 },
  defaultHeight: -1,
  heights: { '0,-1': 0, '-1,0': -2, '1,0': -2, '0,0': -1 },
  carves: [
    { type: 'top', x: 0, z: -1, keep: 3 }
  ],
  items: [
    { type: 'apple', x: 0, z: -1 },
    { type: 'oil',   x: -1, z: 0 },
    { type: 'grass', x: 1, z: 0 }
  ],
  portals: [
    { type: 'warp',      x: 2,  z: -2, target: 'home',    label: '🌀 マイホームへ帰還ワープ', needPuzzle: false },
    { type: 'stairs_up', x: -2, z: 2,  target: 'earth_4', label: '⬆️ 地4へ戻る',              needPuzzle: false }
  ],
  puzzle: {
    x: 0, z: 0,
    needItem: 'apple',
    desc: '巨大ガメの泉に🍎リンゴをお供えすると夢ゲージと体力が回復するよ！',
    reward: 'dream_boost'
  },
  npcId: 'npc_turtle_elder',
  enemyId: null,
  petId: 'pet_baby_turtle'
};
