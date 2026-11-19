// ============================================================================
// 【生き物＆全16エリア融合エンジン：住人・敵・追従ペット・パステル世界観維持】
// ============================================================================
window.ENTITY_DB = {
  npcs: {
    npc_wind_merchant:   { name: '風の旅商人',     icon: '🧣', color: 0x7dd3fc, give: 'stone', want: 'apple',  pos: { x: -1, z: -1 }, msg: 'リンゴと踏み台用の石を交換しよう！' },
    npc_cloud_baker:     { name: '雲のパン屋',     icon: '🥐', color: 0xfef08a, give: 'apple', want: 'grass',  pos: { x: -1, z: -1 }, msg: '草をくれたら甘いリンゴと交換するよ！' },
    npc_rainbow_painter: { name: 'にじの画家',     icon: '🎨', color: 0xf9a8d4, give: 'oil',   want: 'stone',  pos: { x: -2, z: 0 },  msg: '石をくれたらツルツルオイルをあげるよ！' },
    npc_star_keeper:     { name: '星守りの老人',   icon: '🔭', color: 0xc4b5fd, give: 'grass', want: 'oil',    pos: { x: -1, z: -1 }, msg: 'オイルのお礼に星の草ブロックを授けよう' },
    npc_sky_king:        { name: '天空の王さま',   icon: '👑', color: 0xfde047, give: 'apple', want: 'stone',  pos: { x: 1,  z: 1 },  msg: 'よく登ってきたな！ご褒美のリンゴじゃ' },

    npc_mole_miner:      { name: 'もぐら親方',     icon: '⛏️', color: 0xd4a373, give: 'stone', want: 'apple',  pos: { x: -1, z: -1 }, msg: '腹が減った！リンゴと掘り出し石を交換だ' },
    npc_moss_chef:       { name: '苔の料理人',     icon: '🍲', color: 0x86efac, give: 'oil',   want: 'grass',  pos: { x: 1,  z: 1 },  msg: '光り苔の草をくれたら特製オイルを渡すよ' },
    npc_crystal_smith:   { name: '水晶かじ屋',     icon: '🔨', color: 0xa5f3fc, give: 'apple', want: 'stone',  pos: { x: 1,  z: -1 }, msg: 'いい石だな！リンゴと交換してくれ' },
    npc_fossil_prof:     { name: '化石はかせ',     icon: '🦴', color: 0xfde68a, give: 'stone', want: 'oil',    pos: { x: -1, z: -1 }, msg: '発掘機のオイルと重い古代石を交換じゃ' },
    npc_turtle_elder:    { name: '長老ガメ',       icon: '🐢', color: 0x7dd3fc, give: 'grass', want: 'stone',  pos: { x: 1,  z: 1 },  msg: '島を支える石をありがとう。恵みの草じゃ' },

    npc_adventurer_coach:{ name: 'ぼうけん師匠',   icon: '🧭', color: 0xfca5a5, give: 'apple', want: 'stone',  pos: { x: -1, z: -1 }, msg: '段差を越えてきたな！リンゴと交換だ' },
    npc_music_maestro:   { name: '音楽マエストロ', icon: '🎻', color: 0xf9a8d4, give: 'grass', want: 'apple',  pos: { x: -1, z: 0 },  msg: 'リンゴのお礼に音色の草を贈ろう♪' },
    npc_carpenter_boss:  { name: '大工の棟梁',     icon: '🪵', color: 0xfdba74, give: 'stone', want: 'oil',    pos: { x: -1, z: 1 },  msg: '工具のオイルと特上ブロックを交換だ！' },
    npc_flower_sister:   { name: 'お花屋さん',     icon: '🌷', color: 0xa7f3d0, give: 'apple', want: 'grass',  pos: { x: 1,  z: 1 },  msg: 'きれいな草ね！甘いリンゴと交換しましょ' },
    npc_quiz_owl:        { name: '発明フクロウ',   icon: '🦉', color: 0x93c5fd, give: 'oil',   want: 'stone',  pos: { x: 1,  z: -1 }, msg: '石のサンプルと発明オイルを交換ホー！' }
  },

  enemies: {
    enemy_gust_puff:      { name: 'つむじ風パフ',   icon: '🌪️', color: 0xe2e8f0, pos: { x: 1,  z: 0 },  dmg: 10 },
    enemy_prism_beetle:   { name: 'にじカブト',     icon: '🪲', color: 0xfda4af, pos: { x: 0,  z: 1 },  dmg: 12 },
    enemy_meteor_wisp:    { name: 'ながれ星お化け', icon: '👻', color: 0xddd6fe, pos: { x: -1, z: 0 },  dmg: 12 },
    enemy_rock_crab:      { name: '岩ガニ',         icon: '🦀', color: 0xfca5a5, pos: { x: 1,  z: -1 }, dmg: 12 },
    enemy_glow_slime:     { name: 'ひかりスライム', icon: '🟢', color: 0x99f6e4, pos: { x: -1, z: 1 },  dmg: 10 },
    enemy_magma_bug:      { name: 'マグマムシ',     icon: '🦂', color: 0xfed7aa, pos: { x: 1,  z: -1 }, dmg: 14 },
    enemy_training_dummy: { name: 'からくり案山子', icon: '🤖', color: 0xfdba74, pos: { x: 0,  z: -1 }, dmg: 8  },
    enemy_noise_bat:      { name: 'ざわめきコウモリ',icon: '🦇', color: 0xc4b5fd, pos: { x: 1,  z: -1 }, dmg: 10 },
    enemy_iron_beetle:    { name: 'てつクワガタ',   icon: '🪲', color: 0xcbd5e1, pos: { x: 0,  z: 1 },  dmg: 12 },
    enemy_glitch_cube:    { name: 'バグキューブ',   icon: '👾', color: 0xfbcfe8, pos: { x: -1, z: -1 }, dmg: 11 }
  },

  pets: {
    pet_sky_chick:   { name: 'そらピヨ',     icon: '🐥', color: 0xfef08a, perk: 'step_boost',  perkLabel: '段差登り+1',     pos: { x: 1,  z: 1 } },
    pet_prism_fox:   { name: 'にじギツネ',   icon: '🦊', color: 0xfdba74, perk: 'dream_art',   perkLabel: 'げいじゅつ+2',   pos: { x: 0,  z: -1 } },
    pet_star_dragon: { name: 'ほしドラ',     icon: '🐉', color: 0xbae6fd, perk: 'guard_enemy', perkLabel: '敵を追い払う',   pos: { x: -1, z: 1 } },
    pet_mini_mole:   { name: 'ちびモグ',     icon: '🐹', color: 0xd4a373, perk: 'dig_boost',   perkLabel: '掘削パワーUP',   pos: { x: 1,  z: 1 } },
    pet_crystal_pup: { name: 'すいしょう犬', icon: '🐶', color: 0xa5f3fc, perk: 'guard_enemy', perkLabel: '敵を追い払う',   pos: { x: -1, z: 0 } },
    pet_baby_turtle: { name: 'こガメ',       icon: '🐢', color: 0xa7f3d0, perk: 'eco_heal',    perkLabel: '体力すこし回復', pos: { x: 0,  z: 1 } },
    pet_dash_hare:   { name: 'かけっこウサギ',icon: '🐰', color: 0xfecaca, perk: 'step_boost',  perkLabel: '段差登り+1',     pos: { x: 1,  z: 0 } },
    pet_melody_bird: { name: 'おんぷインコ', icon: '🦜', color: 0xfbcfe8, perk: 'dream_art',   perkLabel: 'げいじゅつ+2',   pos: { x: 1,  z: -1 } },
    pet_muscle_bear: { name: 'ちからグマ',   icon: '🐻', color: 0xd6bfa3, perk: 'dig_boost',   perkLabel: '掘削パワーUP',   pos: { x: 0,  z: -1 } },
    pet_flower_bee:  { name: 'はなミツバチ', icon: '🐝', color: 0xfde047, perk: 'eco_heal',    perkLabel: '体力すこし回復', pos: { x: -1, z: 0 } },
    pet_logic_cat:   { name: 'めがねネコ',   icon: '🐱', color: 0xbfdbfe, perk: 'guard_enemy', perkLabel: '敵を追い払う',   pos: { x: 0,  z: 1 } }
  }
};

window.ACTIVE_ENTITIES = { npc: null, enemy: null, wildPet: null, guestNpc: null };

let CURRENT_AREA_ID = 'home';
let AREA_PUZZLE_SOLVED = {};
let HOME_SAVE_DATA = null;

function getCurrentAreaDef() {
  const reg = window.AREA_REGISTRY || {};
  return reg[CURRENT_AREA_ID] || reg.home || {
    id: 'home', group: 'home', name: '🏠 マイホーム（パステル島・創作保存）', persistent: true,
    dreamBonus: 'eco',
    palette: { pastelGreenTop: 0xa7f3d0, pastelGreenMid: 0x86efac, dryPastelSoil: 0xd4a373, wetSoilLv2: 0xb07d56 },
    spawn: { x: 0, z: 0, lv: -1 }, defaultHeight: 0, heights: {}, carves: [], items: [], portals: []
  };
}

function applyAreaPaletteToSpaceColors(areaDef) {
  if (!areaDef || !areaDef.palette || typeof SPACE_COLORS === 'undefined') return;
  if (areaDef.palette.pastelGreenTop !== undefined) SPACE_COLORS.pastelGreenTop = areaDef.palette.pastelGreenTop;
  if (areaDef.palette.pastelGreenMid !== undefined) SPACE_COLORS.pastelGreenMid = areaDef.palette.pastelGreenMid;
  if (areaDef.palette.dryPastelSoil  !== undefined) SPACE_COLORS.dryPastelSoil  = areaDef.palette.dryPastelSoil;
  if (areaDef.palette.wetSoilLv2     !== undefined) SPACE_COLORS.wetSoilLv2     = areaDef.palette.wetSoilLv2;
}

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

function saveHomeSnapshotIfHome() {
  if (CURRENT_AREA_ID !== 'home') return;
  HOME_SAVE_DATA = {
    heightMap: JSON.parse(JSON.stringify(HEIGHT_MAP)),
    chipMap: JSON.parse(JSON.stringify(CHIP_MAP)),
    items: JSON.parse(JSON.stringify(WORLD_ITEMS))
  };
}

function applyAreaTerrainToWorld(areaDef) {
  HEIGHT_MAP = {};
  CHIP_MAP = {};
  WATER_MAP = {};
  applyAreaPaletteToSpaceColors(areaDef);

  if (areaDef.persistent && HOME_SAVE_DATA && HOME_SAVE_DATA.heightMap) {
    HEIGHT_MAP = JSON.parse(JSON.stringify(HOME_SAVE_DATA.heightMap));
    CHIP_MAP   = JSON.parse(JSON.stringify(HOME_SAVE_DATA.chipMap || {}));
    WORLD_ITEMS = JSON.parse(JSON.stringify(HOME_SAVE_DATA.items || []));
  } else {
    const defH = Number.isFinite(areaDef.defaultHeight) ? areaDef.defaultHeight : 0;
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) HEIGHT_MAP[`${x},${z}`] = defH;
    if (areaDef.heights) Object.keys(areaDef.heights).forEach(k => { HEIGHT_MAP[k] = areaDef.heights[k]; });
    if (Array.isArray(areaDef.carves)) {
      areaDef.carves.forEach(c => {
        if (c.type === 'top') carveTopSubLayers(c.x, c.z, HEIGHT_MAP[`${c.x},${c.z}`] ?? 0, c.keep ?? 2);
        else if (c.type === 'tunnel') carveCrawlTunnelBlock(c.x, c.z, c.lv ?? 0, c.w ?? 3, c.h ?? 2);
      });
    }
    WORLD_ITEMS = Array.isArray(areaDef.items) ? areaDef.items.map(it => ({ ...it })) : [];
  }
  enforceOuterWaterWallIntegrity();
  window.spawnAreaEntities(areaDef);
}

window.switchAreaById = function(targetAreaId, withFade = true) {
  const reg = window.AREA_REGISTRY || {};
  if (!reg[targetAreaId]) return false;
  if (CURRENT_AREA_ID === 'home') saveHomeSnapshotIfHome();

  const finishSwitch = () => {
    CURRENT_AREA_ID = targetAreaId;
    const areaDef = getCurrentAreaDef();
    applyAreaTerrainToWorld(areaDef);

    const sp = areaDef.spawn || { x: 0, z: 0, lv: 0 };
    ROBOT.pos.x = sp.x; ROBOT.pos.z = sp.z;
    ROBOT.pos.lv = HEIGHT_MAP[`${sp.x},${sp.z}`] ?? sp.lv ?? 0;
    ROBOT.pos.sx = 2; ROBOT.pos.sz = 2;
    ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, ROBOT.pos.lv);
    clampCharSubPosForBodySize();
    if (ROBOT.pet && ROBOT.pet.id) {
      ROBOT.pet.x = ROBOT.pos.x; ROBOT.pet.z = ROBOT.pos.z; ROBOT.pet.lv = ROBOT.pos.lv;
    }
    if (typeof visualPosInitialized !== 'undefined') visualPosInitialized = false;
    if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
    if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition(true);
    if (typeof cameraDirty !== 'undefined') cameraDirty = true;
    if (typeof updateAllCamerasTransform === 'function') updateAllCamerasTransform();
    if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
    updateAreaAndPetBadgeUI();
    if (typeof saveWorldState === 'function') saveWorldState();
    if (typeof showToast === 'function') showToast(`🗺️ ${areaDef.name}`);
  };

  const fadeEl = document.getElementById('area-fade');
  if (withFade && fadeEl) {
    fadeEl.style.opacity = '1';
    setTimeout(() => { finishSwitch(); setTimeout(() => { fadeEl.style.opacity = '0'; }, 80); }, 200);
  } else {
    finishSwitch();
  }
  return true;
};

function updateAreaAndPetBadgeUI() {
  const areaDef = getCurrentAreaDef();
  const aEl = document.getElementById('ui-area-name');
  if (aEl) aEl.innerText = areaDef.name;
  const petSpec = (ROBOT.pet && window.ENTITY_DB.pets[ROBOT.pet.id]) ? window.ENTITY_DB.pets[ROBOT.pet.id] : null;
  const pEl = document.getElementById('ui-pet-badge');
  if (pEl) pEl.innerText = petSpec ? `🐾 ${petSpec.icon}${petSpec.name}` : '🐾 相棒：なし';
  const daEl = document.getElementById('diary-area-label');
  if (daEl) daEl.innerText = `📍 ${areaDef.name}${areaDef.persistent ? '（創作保存ON）' : ''}`;
  const dpEl = document.getElementById('diary-pet-label');
  if (dpEl) dpEl.innerText = petSpec ? `🐾 相棒：${petSpec.icon}${petSpec.name}（${petSpec.perkLabel}）` : '🐾 ついてくる相棒：まだいません';
}

// ============================================================================
// 【元の world.js を壊さずに上から足す「箱庭に馴染むパステル仕掛け＆仲間3D描画」】
// ============================================================================
const pastelExtraGroup = new THREE.Group();
if (typeof scene !== 'undefined' && scene) scene.add(pastelExtraGroup);

let followPetMesh = null;
const followPetVisualPos = new THREE.Vector3(0, 0, 0);
let followPetPosInit = false;

function ensureFollowPetMesh() {
  if (followPetMesh || typeof scene === 'undefined' || !scene) return;
  followPetMesh = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.26), new THREE.MeshLambertMaterial({ color: 0xfef08a }));
  body.position.y = 0.12;
  const ear = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.08), new THREE.MeshLambertMaterial({ color: 0xfecaca }));
  ear.position.set(0, 0.25, -0.02);
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.03), new THREE.MeshLambertMaterial({ color: 0x1e293b }));
  eyeL.position.set(-0.06, 0.14, 0.13);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.06;
  followPetMesh.add(body, ear, eyeL, eyeR);
  followPetMesh.visible = false;
  scene.add(followPetMesh);
}

function renderPastelAreaPropsAndEntities() {
  while (pastelExtraGroup.children.length) pastelExtraGroup.remove(pastelExtraGroup.children[0]);
  ensureFollowPetMesh();

  const areaDef = getCurrentAreaDef();
  const isSolved = !!AREA_PUZZLE_SOLVED[areaDef.id];

  // 階段・穴・ワープ装置（元のパステル島になじむ控えめな木・石・パステル造形）
  (areaDef.portals || []).forEach(p => {
    const py = getSurfaceYAt(p.x, p.z, null, 3);
    const locked = p.needPuzzle && !isSolved;
    const grp = new THREE.Group();
    grp.position.set(p.x, py, p.z);

    if (p.type === 'stairs_up' || p.type === 'stairs_down') {
      const col = locked ? 0xfca5a5 : (p.type === 'stairs_up' ? 0xfef08a : 0xbae6fd);
      const mat = new THREE.MeshLambertMaterial({ color: col });
      for (let i = 0; i < 3; i++) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.08, 0.18), mat);
        st.position.set(0, 0.04 + i * 0.08, 0.16 - i * 0.16);
        grp.add(st);
      }
    } else if (p.type === 'hole_down') {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.52), new THREE.MeshLambertMaterial({ color: locked ? 0xfca5a5 : 0xd4a373 }));
      rim.position.y = 0.03;
      const hole = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.32), new THREE.MeshLambertMaterial({ color: 0x334155 }));
      hole.position.y = 0.035;
      grp.add(rim, hole);
    } else {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.48), new THREE.MeshLambertMaterial({ color: locked ? 0xfca5a5 : 0xa5f3fc }));
      pad.position.y = 0.03;
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), new THREE.MeshLambertMaterial({ color: 0xe2e8f0 }));
      stone.position.y = 0.11;
      stone.userData.spin = true;
      grp.add(pad, stone);
    }
    pastelExtraGroup.add(grp);
  });

  // 素材パズル台座
  if (areaDef.puzzle) {
    const pz = areaDef.puzzle;
    const py = getSurfaceYAt(pz.x, pz.z, null, 3);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.44), new THREE.MeshLambertMaterial({ color: isSolved ? 0xa7f3d0 : 0xfbcfe8 }));
    pad.position.set(pz.x, py + 0.04, pz.z);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), new THREE.MeshLambertMaterial({ color: isSolved ? 0x86efac : 0xf9a8d4 }));
    core.position.set(pz.x, py + 0.19, pz.z);
    core.userData.spin = true;
    pastelExtraGroup.add(pad, core);
  }

  // エリア住人・敵キャラ・野生ペット（パステル調の小さな箱庭キャラ）
  const act = window.ACTIVE_ENTITIES || {};
  function spawnPastelEnt(ent, kind) {
    if (!ent) return;
    const ey = getSurfaceYAt(ent.x, ent.z, null, 3);
    const g = new THREE.Group();
    g.position.set(ent.x, ey, ent.z);
    const sz = kind === 'pet' ? 0.22 : 0.28;
    const body = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz), new THREE.MeshLambertMaterial({ color: ent.color || 0xfef08a }));
    body.position.y = sz * 0.55;
    const eye = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.45, 0.04, 0.03), new THREE.MeshLambertMaterial({ color: 0x1e293b }));
    eye.position.set(0, sz * 0.68, sz * 0.51);
    g.add(body, eye);
    if (kind === 'npc') {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.7, 0.07, sz * 0.7), new THREE.MeshLambertMaterial({ color: 0xf8fafc }));
      cap.position.y = sz + 0.03;
      g.add(cap);
    }
    g.userData.bob = true;
    g.userData.baseY = ey;
    pastelExtraGroup.add(g);
  }
  if (act.npc) spawnPastelEnt(act.npc, 'npc');
  if (act.guestNpc) spawnPastelEnt(act.guestNpc, 'npc');
  if (act.enemy && !act.enemy.defeated) spawnPastelEnt(act.enemy, 'enemy');
  if (act.wildPet) spawnPastelEnt(act.wildPet, 'pet');
}

// 元の rebuildTerrainAndItems の後ろにパステル仕掛け＆生き物描画を差し込む
if (typeof rebuildTerrainAndItems === 'function') {
  const _origRebuild = rebuildTerrainAndItems;
  rebuildTerrainAndItems = function() {
    _origRebuild();
    renderPastelAreaPropsAndEntities();
  };
  rebuildTerrainAndItems();
}

// ============================================================================
// 【元の brain.js のセーブ/ロード/設定/ターンを壊さずに16エリア機能を合体】
// ============================================================================
if (typeof saveWorldState === 'function') {
  const _origSave = saveWorldState;
  saveWorldState = function() {
    saveHomeSnapshotIfHome();
    _origSave();
    try {
      const raw = safeStorage.getItem('island_spacecore_v15');
      if (raw) {
        const obj = JSON.parse(raw);
        obj.areaId = CURRENT_AREA_ID;
        obj.puzzles = AREA_PUZZLE_SOLVED;
        obj.homeSave = HOME_SAVE_DATA;
        obj.robotPet = ROBOT.pet || null;
        safeStorage.setItem('island_spacecore_v15', JSON.stringify(obj));
      }
    } catch (e) {}
  };
}

if (typeof applyLoadedWorldData === 'function') {
  const _origApply = applyLoadedWorldData;
  applyLoadedWorldData = function(d) {
    _origApply(d);
    if (!d) return;
    if (d.puzzles && typeof d.puzzles === 'object') AREA_PUZZLE_SOLVED = d.puzzles;
    if (d.homeSave && typeof d.homeSave === 'object') HOME_SAVE_DATA = d.homeSave;
    if (d.robotPet) ROBOT.pet = d.robotPet;
    if (d.areaId && window.AREA_REGISTRY && window.AREA_REGISTRY[d.areaId]) {
      CURRENT_AREA_ID = d.areaId;
      applyAreaPaletteToSpaceColors(getCurrentAreaDef());
      window.spawnAreaEntities(getCurrentAreaDef());
    }
    updateAreaAndPetBadgeUI();
  };
}

// 起動時の初期エリア（マイホーム）反映
(function initHomeAreaIfFresh() {
  try {
    const raw = safeStorage.getItem('island_spacecore_v15');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.areaId && window.AREA_REGISTRY && window.AREA_REGISTRY[parsed.areaId]) {
        CURRENT_AREA_ID = parsed.areaId;
        if (parsed.puzzles) AREA_PUZZLE_SOLVED = parsed.puzzles;
        if (parsed.homeSave) HOME_SAVE_DATA = parsed.homeSave;
        if (parsed.robotPet) ROBOT.pet = parsed.robotPet;
        applyAreaPaletteToSpaceColors(getCurrentAreaDef());
        window.spawnAreaEntities(getCurrentAreaDef());
        if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
        if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition(true);
        updateAreaAndPetBadgeUI();
        return;
      }
    }
  } catch (e) {}
  saveHomeSnapshotIfHome();
  window.spawnAreaEntities(getCurrentAreaDef());
  if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
  updateAreaAndPetBadgeUI();
})();

// 設定保存時の「テスト用エリア移動」対応
if (typeof saveSettings === 'function') {
  const _origSaveSettings = saveSettings;
  saveSettings = function() {
    const jumpEl = document.getElementById('setting-jump-area');
    const jumpId = jumpEl ? jumpEl.value : '';
    _origSaveSettings();
    if (jumpId && window.AREA_REGISTRY && window.AREA_REGISTRY[jumpId]) {
      if (jumpEl) jumpEl.value = '';
      window.switchAreaById(jumpId, true);
    }
    updateAreaAndPetBadgeUI();
  };
}

// ターン終了時にパズル・住人交換・敵・野生ペット・ポータル移動を連携
if (typeof executeTurn === 'function') {
  const _origExecuteTurn = executeTurn;
  executeTurn = async function() {
    const prevX = ROBOT.pos.x, prevZ = ROBOT.pos.z, prevLv = ROBOT.pos.lv;
    await _origExecuteTurn();

    const areaDef = getCurrentAreaDef();
    if (ROBOT.pet && ROBOT.pet.id) {
      ROBOT.pet.x = prevX; ROBOT.pet.z = prevZ; ROBOT.pet.lv = prevLv;
    }

    // 素材パズル判定
    if (areaDef.puzzle && !AREA_PUZZLE_SOLVED[areaDef.id] && ROBOT.pos.x === areaDef.puzzle.x && ROBOT.pos.z === areaDef.puzzle.z) {
      const idx = BAG.indexOf(areaDef.puzzle.needItem);
      if (idx !== -1) {
        BAG.splice(idx, 1);
        AREA_PUZZLE_SOLVED[areaDef.id] = true;
        if (areaDef.dreamBonus && ROBOT.params[areaDef.dreamBonus] !== undefined) {
          ROBOT.params[areaDef.dreamBonus] = Math.min(100, (ROBOT.params[areaDef.dreamBonus] || 50) + 6);
        }
        DIARY_LOGS.push(`🧩 ${GAME_DAY}日目：${areaDef.name}のパズルを解決！`);
        if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
      }
    }

    // 住人とのアイテム交換
    const npc = window.ACTIVE_ENTITIES.npc || window.ACTIVE_ENTITIES.guestNpc;
    if (npc && !npc.traded && Math.abs(ROBOT.pos.x - npc.x) + Math.abs(ROBOT.pos.z - npc.z) <= 1) {
      const wIdx = BAG.indexOf(npc.want);
      if (wIdx !== -1) {
        BAG.splice(wIdx, 1);
        if (BAG.length < 10) BAG.push(npc.give);
        npc.traded = true;
        DIARY_LOGS.push(`🤝 ${GAME_DAY}日目：${npc.icon}${npc.name}と交換した！`);
      }
    }

    // 敵との遭遇（ペットがいれば撃退、いなければ少しダメージ）
    const enemy = window.ACTIVE_ENTITIES.enemy;
    if (enemy && !enemy.defeated && Math.abs(ROBOT.pos.x - enemy.x) + Math.abs(ROBOT.pos.z - enemy.z) <= 1) {
      const petSpec = (ROBOT.pet && window.ENTITY_DB.pets[ROBOT.pet.id]) ? window.ENTITY_DB.pets[ROBOT.pet.id] : null;
      enemy.defeated = true;
      if (!petSpec || petSpec.perk !== 'guard_enemy') {
        life.stamina = Math.max(5, life.stamina - (enemy.dmg || 10));
      }
      if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
    }

    // 野生ペットの仲間化
    const wp = window.ACTIVE_ENTITIES.wildPet;
    if (wp && Math.abs(ROBOT.pos.x - wp.x) + Math.abs(ROBOT.pos.z - wp.z) <= 1) {
      ROBOT.pet = { id: wp.id, x: prevX, z: prevZ, lv: prevLv };
      window.ACTIVE_ENTITIES.wildPet = null;
      DIARY_LOGS.push(`🐾 ${GAME_DAY}日目：${wp.icon}${wp.name}が相棒になった！`);
      if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
    }

    // 階段・穴・ワープ装置を踏んだら次のエリアへ移動
    const portal = (areaDef.portals || []).find(p => p.x === ROBOT.pos.x && p.z === ROBOT.pos.z);
    if (portal && (!portal.needPuzzle || AREA_PUZZLE_SOLVED[areaDef.id])) {
      DIARY_LOGS.push(`🗺️ ${GAME_DAY}日目：${portal.label}で移動した！`);
      window.switchAreaById(portal.target, true);
      return;
    }

    updateAreaAndPetBadgeUI();
    if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
    if (typeof saveWorldState === 'function') saveWorldState();
  };
}

// 追従ペット＆パステル仕掛けのアニメーション連動
(function attachPetAndPropAnim() {
  const _origSync = syncRobot3DPosition;
  syncRobot3DPosition = function(instant = false) {
    _origSync(instant);
    ensureFollowPetMesh();
    if (!followPetMesh) return;
    const petSpec = (ROBOT.pet && window.ENTITY_DB.pets[ROBOT.pet.id]) ? window.ENTITY_DB.pets[ROBOT.pet.id] : null;
    if (petSpec) {
      followPetMesh.visible = true;
      followPetMesh.children[0].material = new THREE.MeshLambertMaterial({ color: petSpec.color || 0xfef08a });
      const px = (ROBOT.pet.x ?? ROBOT.pos.x);
      const pz = (ROBOT.pet.z ?? ROBOT.pos.z);
      const py = getSurfaceYAt(px, pz, ROBOT.pet.lv ?? null, 1);
      if (instant || !followPetPosInit) {
        followPetVisualPos.set(px, py, pz);
        followPetMesh.position.copy(followPetVisualPos);
        followPetPosInit = true;
      } else {
        followPetVisualPos.set(px, py, pz);
      }
    } else {
      followPetMesh.visible = false;
    }
    updateAreaAndPetBadgeUI();
  };

  const _origAnim = updateRobotUnifiedAnimation;
  updateRobotUnifiedAnimation = function(t) {
    _origAnim(t);
    if (followPetMesh && followPetMesh.visible) {
      followPetMesh.position.lerp(followPetVisualPos, 0.12);
      followPetMesh.position.y = followPetVisualPos.y + Math.abs(Math.sin(t * 5.0)) * 0.06;
      if (typeof robotGroup !== 'undefined') followPetMesh.rotation.y = robotGroup.rotation.y;
    }
    pastelExtraGroup.children.forEach((obj, idx) => {
      if (obj.userData.spin) obj.rotation.y += 0.02;
      if (obj.userData.bob) obj.position.y = (obj.userData.baseY ?? 0) + Math.sin(t * 2.6 + idx) * 0.04;
      obj.children.forEach(ch => { if (ch.userData.spin) ch.rotation.y += 0.025; });
    });
  };
})();
