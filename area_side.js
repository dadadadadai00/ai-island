// ============================================================================
// 【舞台データ③：マイホーム（独立住居・創作保存）＋ 左右（育成5エリア）】
// ============================================================================
window.AREA_REGISTRY = window.AREA_REGISTRY || {};

// 🏠 独立した住居エリア（16エリア目：元のv29パステル島そのままの色味＆永続保存）
window.AREA_REGISTRY.home = {
  id: 'home',
  group: 'home',
  name: '🏠 マイホーム（パステル島・創作保存）',
  persistent: true,
  dreamBonus: 'eco',
  palette: {
    pastelGreenTop: 0xa7f3d0,
    pastelGreenMid: 0x86efac,
    dryPastelSoil:  0xd4a373,
    wetSoilLv2:     0xb07d56
  },
  spawn: { x: 0, z: 0, lv: -1 },
  defaultHeight: 0,
  heights: { '1,2': 1, '0,0': -1 },
  carves: [
    { type: 'top', x: 1, z: 0, keep: 1 },
    { type: 'top', x: 0, z: 1, keep: 2 },
    { type: 'tunnel', x: -1, z: -1, lv: 0, w: 3, h: 2 }
  ],
  items: [
    { type: 'apple', x: -1, z: 1 },
    { type: 'apple', x: 1, z: 0 }
  ],
  portals: [
    { type: 'stairs_up', x: 2,  z: -2, target: 'sky_1',   label: '🪜 パステル階段（天1へ）', needPuzzle: false },
    { type: 'hole_down', x: 0,  z: -1, target: 'earth_1', label: '🕳️ 地下の穴（地1へ）',     needPuzzle: false },
    { type: 'warp',      x: -2, z: -2, target: 'side_1',  label: '🌀 育成ワープ（左右へ）',   needPuzzle: false }
  ],
  puzzle: null,
  npcId: null,
  enemyId: null,
  petId: null
};

// 🗡️ 左右1：ぼうけん育成エリア
window.AREA_REGISTRY.side_1 = {
  id: 'side_1',
  group: 'side',
  name: '🗡️ 育成1：ぼうけんアスレチック',
  persistent: false,
  dreamBonus: 'curiosity',
  palette: {
    pastelGreenTop: 0xfecaca,
    pastelGreenMid: 0xfca5a5,
    dryPastelSoil:  0xd4a373,
    wetSoilLv2:     0xb07d56
  },
  spawn: { x: -2, z: 1, lv: 0 },
  defaultHeight: 0,
  heights: { '-1,0': 1, '0,0': 1, '1,-1': 2, '2,-1': 1, '0,2': 1 },
  carves: [
    { type: 'top', x: -1, z: 1, keep: 3 },
    { type: 'top', x: 0, z: -1, keep: 4 }
  ],
  items: [
    { type: 'apple', x: 1, z: -1 },
    { type: 'stone', x: 0, z: 2 }
  ],
  portals: [
    { type: 'warp', x: 2,  z: -2, target: 'side_2', label: '🌀 育成2（げいじゅつ）へ', needPuzzle: false },
    { type: 'warp', x: -2, z: 2,  target: 'home',   label: '🏠 マイホームへ戻る',      needPuzzle: false }
  ],
  puzzle: {
    x: 1, z: 1,
    needItem: 'stone',
    desc: '特訓ゴール台に🪨石を置くと🗡️ぼうけん夢ゲージが大きく育つよ！',
    reward: 'dream_boost'
  },
  npcId: 'npc_adventurer_coach',
  enemyId: 'enemy_training_dummy',
  petId: 'pet_dash_hare'
};

// 🎵 左右2：げいじゅつ育成エリア
window.AREA_REGISTRY.side_2 = {
  id: 'side_2',
  group: 'side',
  name: '🎵 育成2：おんがくパステルテラス',
  persistent: false,
  dreamBonus: 'cautionLimiter',
  palette: {
    pastelGreenTop: 0xfbcfe8,
    pastelGreenMid: 0xf9a8d4,
    dryPastelSoil:  0xd6bfa3,
    wetSoilLv2:     0xb89f80
  },
  spawn: { x: -1, z: 1, lv: 0 },
  defaultHeight: 0,
  heights: { '0,-1': 1, '-1,-1': 1, '1,-1': 1, '0,0': 0 },
  carves: [
    { type: 'top', x: 0, z: -1, keep: 3 },
    { type: 'top', x: 1, z: 0, keep: 2 }
  ],
  items: [
    { type: 'grass', x: -1, z: -1 },
    { type: 'apple', x: 1, z: 1 }
  ],
  portals: [
    { type: 'warp', x: 2,  z: -2, target: 'side_3', label: '🌀 育成3（ちから）へ', needPuzzle: false },
    { type: 'warp', x: -2, z: 2,  target: 'home',   label: '🏠 マイホームへ戻る',  needPuzzle: false }
  ],
  puzzle: {
    x: 0, z: -1,
    needItem: 'grass',
    desc: '音符ステージに🌿草ブロックを飾ると🎵げいじゅつ夢ゲージが大きく育つよ！',
    reward: 'dream_boost'
  },
  npcId: 'npc_music_maestro',
  enemyId: 'enemy_noise_bat',
  petId: 'pet_melody_bird'
};

// 💪 左右3：ちから育成エリア
window.AREA_REGISTRY.side_3 = {
  id: 'side_3',
  group: 'side',
  name: '💪 育成3：だいくの岩場道場',
  persistent: false,
  dreamBonus: 'power',
  palette: {
    pastelGreenTop: 0xfed7aa,
    pastelGreenMid: 0xfdba74,
    dryPastelSoil:  0xc7a987,
    wetSoilLv2:     0x9e8264
  },
  spawn: { x: -1, z: 1, lv: 0 },
  defaultHeight: 0,
  heights: { '0,0': 1, '1,0': 2, '0,-1': 1, '-1,-1': 1 },
  carves: [
    { type: 'tunnel', x: 0, z: 0, lv: 1, w: 2, h: 2 },
    { type: 'top', x: 1, z: 1, keep: 2 }
  ],
  items: [
    { type: 'stone', x: -1, z: 0 },
    { type: 'stone', x: 1, z: -1 }
  ],
  portals: [
    { type: 'warp', x: 2,  z: -2, target: 'side_4', label: '🌀 育成4（やさしさ）へ', needPuzzle: false },
    { type: 'warp', x: -2, z: 2,  target: 'home',   label: '🏠 マイホームへ戻る',    needPuzzle: false }
  ],
  puzzle: {
    x: 1, z: 1,
    needItem: 'stone',
    desc: '石積み道場に🪨石を積むと💪ちから夢ゲージが大きく育つよ！',
    reward: 'dream_boost'
  },
  npcId: 'npc_carpenter_boss',
  enemyId: 'enemy_iron_beetle',
  petId: 'pet_muscle_bear'
};

// 💖 左右4：やさしさ育成エリア
window.AREA_REGISTRY.side_4 = {
  id: 'side_4',
  group: 'side',
  name: '💖 育成4：おはな畑の農園',
  persistent: false,
  dreamBonus: 'eco',
  palette: {
    pastelGreenTop: 0xbbf7d0,
    pastelGreenMid: 0xfef08a,
    dryPastelSoil:  0xd4a373,
    wetSoilLv2:     0xb07d56
  },
  spawn: { x: 0, z: 1, lv: 0 },
  defaultHeight: 0,
  heights: { '-1,-1': 1, '1,-1': 1, '0,2': 0 },
  carves: [
    { type: 'top', x: -1, z: 0, keep: 4 },
    { type: 'top', x: 1, z: 0, keep: 4 }
  ],
  items: [
    { type: 'apple', x: -1, z: -1 },
    { type: 'apple', x: 1, z: -1 },
    { type: 'grass', x: 0, z: 0 }
  ],
  portals: [
    { type: 'warp', x: 2,  z: -2, target: 'side_5', label: '🌀 育成5（かしこさ）へ', needPuzzle: false },
    { type: 'warp', x: -2, z: 2,  target: 'home',   label: '🏠 マイホームへ戻る',    needPuzzle: false }
  ],
  puzzle: {
    x: 0, z: -1,
    needItem: 'apple',
    desc: 'おすそ分けカゴに🍎リンゴを入れると💖やさしさ夢ゲージが大きく育つよ！',
    reward: 'dream_boost'
  },
  npcId: 'npc_flower_sister',
  enemyId: null,
  petId: 'pet_flower_bee'
};

// 💡 左右5：かしこさ育成エリア
window.AREA_REGISTRY.side_5 = {
  id: 'side_5',
  group: 'side',
  name: '💡 育成5：なぞとき発明ラボ',
  persistent: false,
  dreamBonus: 'logic',
  palette: {
    pastelGreenTop: 0xbfdbfe,
    pastelGreenMid: 0x93c5fd,
    dryPastelSoil:  0xcbd5e1,
    wetSoilLv2:     0x94a3b8
  },
  spawn: { x: 0, z: 1, lv: 0 },
  defaultHeight: 0,
  heights: { '-1,0': 1, '1,0': 1, '0,-1': 1, '-2,-1': 2 },
  carves: [
    { type: 'tunnel', x: 0, z: -1, lv: 1, w: 3, h: 2 },
    { type: 'top', x: 0, z: 0, keep: 3 }
  ],
  items: [
    { type: 'oil',   x: -1, z: 0 },
    { type: 'stone', x: 1, z: 0 }
  ],
  portals: [
    { type: 'warp', x: 2,  z: -2, target: 'side_1', label: '🌀 育成1（ぼうけん）へ', needPuzzle: false },
    { type: 'warp', x: -2, z: 2,  target: 'home',   label: '🏠 マイホームへ戻る',    needPuzzle: false }
  ],
  puzzle: {
    x: 0, z: 0,
    needItem: 'oil',
    desc: '歯車マシンに🧴オイルを差すと💡かしこさ夢ゲージが大きく育つよ！',
    reward: 'dream_boost'
  },
  npcId: 'npc_quiz_owl',
  enemyId: 'enemy_glitch_cube',
  petId: 'pet_logic_cat'
};
