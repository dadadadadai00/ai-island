// ============================================================================
// 【生き物・仲間コア：エリア住人（交換）・敵キャラ・追従ペット・通信名刺】
// ============================================================================
window.ENTITY_DB = {
  // 🤝 アイテム交換してくれるエリア住人（固定マス待機・低負荷）
  npcs: {
    npc_wind_merchant:   { name: '風の旅商人',     icon: '🧣', color: 0x38bdf8, give: 'stone', want: 'apple',  pos: { x: -1, z: -1 }, msg: 'リンゴと踏み台用の石を交換しよう！' },
    npc_cloud_baker:     { name: '雲のパン屋',     icon: '🥐', color: 0xfef08a, give: 'apple', want: 'grass',  pos: { x: -1, z: -1 }, msg: '草をくれたら甘いリンゴと交換するよ！' },
    npc_rainbow_painter: { name: 'にじの画家',     icon: '🎨', color: 0xf472b6, give: 'oil',   want: 'stone',  pos: { x: -2, z: 0 },  msg: '石をくれたらツルツルオイルをあげるよ！' },
    npc_star_keeper:     { name: '星守りの老人',   icon: '🔭', color: 0x818cf8, give: 'grass', want: 'oil',    pos: { x: -1, z: -1 }, msg: 'オイルのお礼に星の草ブロックを授けよう' },
    npc_sky_king:        { name: '天空の王さま',   icon: '👑', color: 0xfacc15, give: 'apple', want: 'stone',  pos: { x: 1,  z: 1 },  msg: 'よく登ってきたな！ご褒美のリンゴじゃ' },

    npc_mole_miner:      { name: 'もぐら親方',     icon: '⛏️', color: 0xb45309, give: 'stone', want: 'apple',  pos: { x: -1, z: -1 }, msg: '腹が減った！リンゴと掘り出し石を交換だ' },
    npc_moss_chef:       { name: '苔の料理人',     icon: '🍲', color: 0x10b981, give: 'oil',   want: 'grass',  pos: { x: 1,  z: 1 },  msg: '光り苔の草をくれたら特製オイルを渡すよ' },
    npc_crystal_smith:   { name: '水晶かじ屋',     icon: '🔨', color: 0x67e8f9, give: 'apple', want: 'stone',  pos: { x: 1,  z: -1 }, msg: 'いい石だな！リンゴと交換してくれ' },
    npc_fossil_prof:     { name: '化石はかせ',     icon: '🦴', color: 0xd97706, give: 'stone', want: 'oil',    pos: { x: -1, z: -1 }, msg: '発掘機のオイルと重い古代石を交換じゃ' },
    npc_turtle_elder:    { name: '長老ガメ',       icon: '🐢', color: 0x38bdf8, give: 'grass', want: 'stone',  pos: { x: 1,  z: 1 },  msg: '島を支える石をありがとう。恵みの草じゃ' },

    npc_adventurer_coach:{ name: 'ぼうけん師匠',   icon: '🧭', color: 0xf87171, give: 'apple', want: 'stone',  pos: { x: -1, z: -1 }, msg: '段差を越えてきたな！リンゴと交換だ' },
    npc_music_maestro:   { name: '音楽マエストロ', icon: '🎻', color: 0xc084fc, give: 'grass', want: 'apple',  pos: { x: -1, z: 0 },  msg: 'リンゴのお礼に音色の草を贈ろう♪' },
    npc_carpenter_boss:  { name: '大工の棟梁',     icon: '🪵', color: 0xf97316, give: 'stone', want: 'oil',    pos: { x: -1, z: 1 },  msg: '工具のオイルと特上ブロックを交換だ！' },
    npc_flower_sister:   { name: 'お花屋さん',     icon: '🌷', color: 0x4ade80, give: 'apple', want: 'grass',  pos: { x: 1,  z: 1 },  msg: 'きれいな草ね！甘いリンゴと交換しましょ' },
    npc_quiz_owl:        { name: '発明フクロウ',   icon: '🦉', color: 0x60a5fa, give: 'oil',   want: 'stone',  pos: { x: 1,  z: -1 }, msg: '石のサンプルと発明オイルを交換ホー！' }
  },

  // 👻 エリアを守る敵キャラ（接触でビックリ生物トラウマやスタミナ減・ペットがいれば撃退）
  enemies: {
    enemy_gust_puff:      { name: 'つむじ風パフ',   icon: '🌪️', color: 0xe2e8f0, pos: { x: 1,  z: 0 },  dmg: 10 },
    enemy_prism_beetle:   { name: 'にじカブト',     icon: '🪲', color: 0xf43f5e, pos: { x: 0,  z: 1 },  dmg: 12 },
    enemy_meteor_wisp:    { name: 'ながれ星お化け', icon: '👻', color: 0xa855f7, pos: { x: -1, z: 0 },  dmg: 12 },
    enemy_rock_crab:      { name: '岩ガニ',         icon: '🦀', color: 0xef4444, pos: { x: 1,  z: -1 }, dmg: 12 },
    enemy_glow_slime:     { name: 'ひかりスライム', icon: '🟢', color: 0x22c55e, pos: { x: -1, z: 1 },  dmg: 10 },
    enemy_magma_bug:      { name: 'マグマムシ',     icon: '🦂', color: 0xf97316, pos: { x: 1,  z: -1 }, dmg: 14 },
    enemy_training_dummy: { name: 'からくり案山子', icon: '🤖', color: 0xfb923c, pos: { x: 0,  z: -1 }, dmg: 8  },
    enemy_noise_bat:      { name: 'ざわめきコウモリ',icon: '🦇', color: 0x6366f1, pos: { x: 1,  z: -1 }, dmg: 10 },
    enemy_iron_beetle:    { name: 'てつクワガタ',   icon: '🪲', color: 0x64748b, pos: { x: 0,  z: 1 },  dmg: 12 },
    enemy_glitch_cube:    { name: 'バグキューブ',   icon: '👾', color: 0xec4899, pos: { x: -1, z: -1 }, dmg: 11 }
  },

  // 🐾 後ろをついてくるペット仲間（最大1匹・交代制・お助け効果付き）
  pets: {
    pet_sky_chick:   { name: 'そらピヨ',     icon: '🐥', color: 0xfef08a, perk: 'step_boost',  perkLabel: '段差登り+1',     pos: { x: 1,  z: 1 } },
    pet_prism_fox:   { name: 'にじギツネ',   icon: '🦊', color: 0xfb923c, perk: 'dream_art',   perkLabel: 'げいじゅつ+2',   pos: { x: 0,  z: -1 } },
    pet_star_dragon: { name: 'ほしドラ',     icon: '🐉', color: 0x38bdf8, perk: 'guard_enemy', perkLabel: '敵を追い払う',   pos: { x: -1, z: 1 } },
    pet_mini_mole:   { name: 'ちびモグ',     icon: '🐹', color: 0xd4a373, perk: 'dig_boost',   perkLabel: '掘削パワーUP',   pos: { x: 1,  z: 1 } },
    pet_crystal_pup: { name: 'すいしょう犬', icon: '🐶', color: 0x67e8f9, perk: 'guard_enemy', perkLabel: '敵を追い払う',   pos: { x: -1, z: 0 } },
    pet_baby_turtle: { name: 'こガメ',       icon: '🐢', color: 0x4ade80, perk: 'eco_heal',    perkLabel: '体力すこし回復', pos: { x: 0,  z: 1 } },
    pet_dash_hare:   { name: 'かけっこウサギ',icon: '🐰', color: 0xfca5a5, perk: 'step_boost',  perkLabel: '段差登り+1',     pos: { x: 1,  z: 0 } },
    pet_melody_bird: { name: 'おんぷインコ', icon: '🦜', color: 0xf472b6, perk: 'dream_art',   perkLabel: 'げいじゅつ+2',   pos: { x: 1,  z: -1 } },
    pet_muscle_bear: { name: 'ちからグマ',   icon: '🐻', color: 0xb45309, perk: 'dig_boost',   perkLabel: '掘削パワーUP',   pos: { x: 0,  z: -1 } },
    pet_flower_bee:  { name: 'はなミツバチ', icon: '🐝', color: 0xfacc15, perk: 'eco_heal',    perkLabel: '体力すこし回復', pos: { x: -1, z: 0 } },
    pet_logic_cat:   { name: 'めがねネコ',   icon: '🐱', color: 0x93c5fd, perk: 'guard_enemy', perkLabel: '敵を追い払う',   pos: { x: 0,  z: 1 } }
  }
};

// 現在エリアのアクティブな生き物状態
window.ACTIVE_ENTITIES = {
  npc: null,
  enemy: null,
  wildPet: null,
  guestNpc: null // 将来のアプリ間通信で遊びに来た友達ロボ用枠
};

// エリア切り替え時に住人・敵・野生ペットを配置
window.spawnAreaEntities = function(areaDef) {
  window.ACTIVE_ENTITIES.npc = null;
  window.ACTIVE_ENTITIES.enemy = null;
  window.ACTIVE_ENTITIES.wildPet = null;
  if (!areaDef) return;

  if (areaDef.npcId && window.ENTITY_DB.npcs[areaDef.npcId]) {
    const src = window.ENTITY_DB.npcs[areaDef.npcId];
    window.ACTIVE_ENTITIES.npc = { id: areaDef.npcId, ...src, x: src.pos.x, z: src.pos.z, traded: false };
  }
  if (areaDef.enemyId && window.ENTITY_DB.enemies[areaDef.enemyId]) {
    const src = window.ENTITY_DB.enemies[areaDef.enemyId];
    window.ACTIVE_ENTITIES.enemy = { id: areaDef.enemyId, ...src, x: src.pos.x, z: src.pos.z, defeated: false };
  }
  if (areaDef.petId && window.ENTITY_DB.pets[areaDef.petId]) {
    const curPetId = (typeof ROBOT !== 'undefined' && ROBOT.pet) ? ROBOT.pet.id : null;
    if (curPetId !== areaDef.petId) {
      const src = window.ENTITY_DB.pets[areaDef.petId];
      window.ACTIVE_ENTITIES.wildPet = { id: areaDef.petId, ...src, x: src.pos.x, z: src.pos.z };
    }
  }
};

// 🤝 住人とのアイテム自動交換チェック（隣接または同一マス）
window.tryInteractWithNpc = function(rx, rz) {
  const npc = window.ACTIVE_ENTITIES.npc || window.ACTIVE_ENTITIES.guestNpc;
  if (!npc || npc.traded) return null;
  const dist = Math.abs(rx - npc.x) + Math.abs(rz - npc.z);
  if (dist > 1) return null;

  const idx = BAG.indexOf(npc.want);
  if (idx !== -1) {
    BAG.splice(idx, 1);
    if (BAG.length < 10) BAG.push(npc.give);
    npc.traded = true;
    const itemIcon = { apple: '🍎', stone: '🪨', oil: '🧴', grass: '🌿' };
    return {
      traded: true,
      action: `🤝 ${npc.icon}${npc.name}とアイテム交換！（${itemIcon[npc.want] || ''}→${itemIcon[npc.give] || ''}）`,
      thought: `${npc.name}が「${npc.msg}」って言って、${itemIcon[npc.want]}と${itemIcon[npc.give]}を交換してくれたよ！`
    };
  }
  return {
    traded: false,
    action: `👋 ${npc.icon}${npc.name}にあいさつした`,
    thought: `${npc.name}に会ったよ！「${npc.msg}」だって！今度もってこよう！`
  };
};

// 👻 敵キャラとの遭遇チェック（ペットがいれば撃退、いなければビックリ）
window.checkEnemyEncounter = function(rx, rz) {
  const enemy = window.ACTIVE_ENTITIES.enemy;
  if (!enemy || enemy.defeated) return null;
  const dist = Math.abs(rx - enemy.x) + Math.abs(rz - enemy.z);
  if (dist > 1) return null;

  const myPet = (typeof ROBOT !== 'undefined' && ROBOT.pet) ? window.ENTITY_DB.pets[ROBOT.pet.id] : null;
  if (myPet && myPet.perk === 'guard_enemy') {
    enemy.defeated = true;
    return {
      guarded: true,
      action: `🛡️ 相棒${myPet.icon}${myPet.name}が${enemy.icon}${enemy.name}を追い払った！`,
      thought: `${enemy.name}が出たけど、相棒の${myPet.name}が守って追い払ってくれたよ！頼もしい〜✨`
    };
  }
  enemy.defeated = true;
  return {
    guarded: false,
    dmg: enemy.dmg || 10,
    action: `👻 ${enemy.icon}${enemy.name}にビックリ！（体力-${enemy.dmg || 10}）`,
    thought: `うわっ！${enemy.name}が飛び出してきてビックリしたよ〜！`
  };
};

// 🐾 野生ペットの勧誘＆交代（最大1匹まで）
window.tryBefriendWildPet = function(rx, rz, ecoVal) {
  const wp = window.ACTIVE_ENTITIES.wildPet;
  if (!wp) return null;
  const dist = Math.abs(rx - wp.x) + Math.abs(rz - wp.z);
  if (dist > 1) return null;

  const chance = 0.35 + (ecoVal / 100) * 0.55;
  if (Math.random() > chance) return null;

  const prevPet = (ROBOT.pet && window.ENTITY_DB.pets[ROBOT.pet.id]) ? window.ENTITY_DB.pets[ROBOT.pet.id] : null;
  ROBOT.pet = {
    id: wp.id,
    x: rx,
    z: rz,
    lv: ROBOT.pos.lv
  };
  window.ACTIVE_ENTITIES.wildPet = null;

  const swapNote = prevPet ? `（${prevPet.icon}${prevPet.name}とは一旦バイバイ）` : '';
  return {
    action: `🐾 ${wp.icon}${wp.name}が仲間になった！【${wp.perkLabel}】${swapNote}`,
    thought: `わーい！${wp.icon}${wp.name}が懐いて後ろをついてくるよ！効果は「${wp.perkLabel}」だって♪`
  };
};

// 🚃 ペット追従（電車ごっこ方式：主役ロボが1ターン前までいたマスへ移動）
window.updatePetFollowPosition = function(prevX, prevZ, prevLv) {
  if (!ROBOT || !ROBOT.pet || !ROBOT.pet.id) return;
  ROBOT.pet.x = prevX;
  ROBOT.pet.z = prevZ;
  ROBOT.pet.lv = prevLv;
};

// 🎫 将来のアプリ間通信・合言葉交換用「名刺データ（プロフィールカード）」
window.exportRobotCard = function() {
  if (typeof ROBOT === 'undefined') return null;
  return {
    ver: 1,
    model: ROBOT.unitModel,
    gen: ROBOT.gen,
    rigType: ROBOT.rigType,
    sizeLevel: ROBOT.sizeLevel,
    bodyType: ROBOT.bodyType,
    dream: (typeof getCurrentDreamTitle === 'function') ? getCurrentDreamTitle() : '『🧭 探検家・勇者』',
    params: { ...(ROBOT.params || {}) },
    traumas: [...(ROBOT.traumas || [])],
    petId: ROBOT.pet ? ROBOT.pet.id : null,
    souvenir: (Array.isArray(BAG) && BAG.length > 0) ? BAG[0] : 'apple',
    homeSnapshot: (typeof HOME_SAVE_DATA !== 'undefined') ? HOME_SAVE_DATA : null,
    exportedAt: Date.now()
  };
};

// 🎫 他のアプリから受け取った名刺データを「遊びに来た住人」として住居に登場させる窓口
window.importGuestRobotAsNpc = function(cardData) {
  if (!cardData || typeof cardData !== 'object') return false;
  window.ACTIVE_ENTITIES.guestNpc = {
    id: 'guest_robot',
    name: `${cardData.model || 1}号機(旅人)`,
    icon: '🤖',
    color: 0xf472b6,
    give: cardData.souvenir || 'apple',
    want: 'stone',
    x: -1,
    z: 0,
    traded: false,
    msg: `よそから遊びに来たよ！ボクの夢は${cardData.dream || '冒険'}なんだ！`
  };
  return true;
};
