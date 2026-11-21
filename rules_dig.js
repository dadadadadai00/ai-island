// ============================================================================
// 【レゴ物理環境＆装備・25枠圧縮木箱・投擲モジュール：rules_dig.js（v7.0 完全版）】
// ・手帳最上部：正面キャラプレビュー＋左右6装備枠（左:頭/体/腰・右:背/手/足）
// ・手帳下部10枠：すべてキャラ所持枠（1〜9枠=ポケット / 10枠目=頭上ピラミッド専用）
// ・圧縮木箱（名称統一・5×5=25枠）：3D木箱短タップ＆手帳独立ボタンで25枠モーダル開閉
// ・素材1枠10個・道具1枠5本・資源上限(極小1〜巨大55)はポケット＋手枠共有・道具は資源上限非消費
// ・初期状態：完全手ぶら／圧縮木箱#1の1枠目にテスト用スコップ1本
// ・掘削：体格範囲内鉄則（素手1／スコップ1本で最大5／スコップ2本＆土所持中は掘削不可）
// ・投擲：頭上ピラミッド保持中は不可／手枠全量を放物線ランダム飛距離（道具:高+2, 土:高+1＋転がり）
// ※ index.html / brain.js / world.js / entities.js は無改造、ai_comm.js(v4.0)と連携動作
// ============================================================================
(function initDigRulesModule() {
  if (window.DigRulesModule) return;

  const STORAGE_KEY       = 'rules_dig_state_v7_0_clean';
  const CLEAN_ENV_TAG     = 'clean_flat_stairs_v7_0';
  const SUB_SIZE          = 0.2;
  const CRATE_SLOTS       = 25;   // 圧縮木箱 5×5 = 25枠
  const STACK_MATERIAL    = 10;   // 素材類（土・木・石など）1枠10個
  const STACK_TOOL        = 5;    // 道具類（スコップなど）1枠5本
  const HAND_SHOVEL_MAX   = 2;    // 手枠スコップ最大2本
  const PORTAL_CORNER_POS = { x: -2, z: -2 };

  const HEIGHT_RANK = { tiny: 1, small: 2, medium: 3, large: 4, giant: 5 };
  const WIDTH_RANK  = { slim1: 1, slim2: 2, normal3: 3, fat4: 4, fat5: 5 };

  // 全25体格マトリクス（ポケット＋手枠の資源合計上限：1〜55個）
  const POCKET_CAP_TABLE = {
    1: [1,  2,  4,  5,  7],
    2: [2,  5,  8, 12, 16],
    3: [4,  8, 14, 20, 28],
    4: [5, 12, 20, 30, 41],
    5: [7, 16, 28, 41, 55]
  };
  const PYRAMID_MAX_BY_WIDTH = [0, 1, 5, 14, 30, 55];

  const ITEM_META = {
    soil:   { id: 'soil',   name: '土ブロック', icon: '🟫', kind: 'material', stackMax: STACK_MATERIAL },
    wood:   { id: 'wood',   name: '木材',       icon: '🪵', kind: 'material', stackMax: STACK_MATERIAL },
    stone:  { id: 'stone',  name: '石材',       icon: '🪨', kind: 'material', stackMax: STACK_MATERIAL },
    shovel: { id: 'shovel', name: 'スコップ',   icon: '🪏', kind: 'tool',     stackMax: STACK_TOOL }
  };

  function createEmptyCrateSlots(withTestShovel = false) {
    const slots = Array.from({ length: CRATE_SLOTS }, () => null);
    if (withTestShovel) {
      slots[0] = { id: 'shovel', count: 1 };
    }
    return slots;
  }

  function createDefaultState() {
    return {
      envTag: CLEAN_ENV_TAG,
      // ポケット内（資源は種類別カウント、道具は本数管理）
      pocket: {
        soil: 0,
        wood: 0,
        stone: 0,
        shovel: 0
      },
      // 頭上ピラミッド（資源の超過分・土ブロック）
      headSoil: 0,
      // 装備6枠（頭・体・腰／背・手・足）※手枠は排他1種類のみ
      equip: {
        head: null,
        body: null,
        waist: null,
        back: null,
        hand: null, // null または { id: 'shovel'|'soil', count: n }
        feet: null
      },
      // 圧縮木箱（最大5箱・各25枠）
      crates: [
        {
          id: 'crate_1',
          areaId: 'home',
          x: -1,
          z: 0,
          slots: createEmptyCrateSlots(true) // テスト初期配置：スコップ1本
        }
      ],
      dugCells: {},
      worldSubSoils: {}, // key: `${areaId}|${absX},${absZ}|${floorSubY}` -> count
      worldDroppedItems: [] // { id:'shovel', areaId, absX, absZ, floorSubY, count:1 }
    };
  }

  let DIG_STATE = createDefaultState();
  let lastTurnActionId = null;
  let lastMoveVisualKind = null;
  let activeCrateModalId = null;

  const _origGetSurfaceYAt = (typeof getSurfaceYAt === 'function') ? getSurfaceYAt : null;

  function getCurAreaId() {
    return (typeof getCurrentAreaDef === 'function' && getCurrentAreaDef())
      ? getCurrentAreaDef().id
      : 'home';
  }

  function getMinUnderLv() {
    return (typeof AREA1_MIN_UNDER_LV !== 'undefined') ? AREA1_MIN_UNDER_LV : -4;
  }

  function getMinSubY() {
    return (getMinUnderLv() - 1) * 5;
  }

  function getHeadStackHeight(count, wRank) {
    let rem = Math.max(0, Math.floor(count || 0));
    if (rem <= 0) return 0;
    let layers = 0;
    for (let w = wRank; w >= 1 && rem > 0; w--) {
      rem -= (w * w);
      layers++;
    }
    return layers;
  }

  function getOriginalSizeSpec() {
    const key = (typeof ROBOT !== 'undefined' && ROBOT.sizeLevel) || 'tiny';
    if (typeof SIZE_SPECS !== 'undefined' && SIZE_SPECS[key]) return SIZE_SPECS[key];
    const h = HEIGHT_RANK[key] || 1;
    return {
      label: key, subH: h, scaleY: h * 0.2, standH: h,
      crawlH: Math.max(1, Math.ceil(h / 2)),
      stairMax: h >= 4 ? 2 : (h >= 2 ? 1 : 0)
    };
  }

  function getOriginalBodySpec() {
    const key = (typeof ROBOT !== 'undefined' && ROBOT.bodyType) || 'slim1';
    if (typeof BODY_SPECS !== 'undefined' && BODY_SPECS[key]) return BODY_SPECS[key];
    const w = WIDTH_RANK[key] || 1;
    return { label: key, reqWidth: w };
  }

  function getSizeStats() {
    const sSpec = getOriginalSizeSpec();
    const bSpec = getOriginalBodySpec();
    const hRank = sSpec.subH || HEIGHT_RANK[(typeof ROBOT !== 'undefined' && ROBOT.sizeLevel) || 'tiny'] || 1;
    const wRank = bSpec.reqWidth || WIDTH_RANK[(typeof ROBOT !== 'undefined' && ROBOT.bodyType) || 'slim1'] || 1;
    const pocketCap = (POCKET_CAP_TABLE[hRank] && POCKET_CAP_TABLE[hRank][wRank - 1]) || 1;
    const headCap = Math.min(PYRAMID_MAX_BY_WIDTH[wRank] || 1, pocketCap);
    const standH = sSpec.standH || hRank;
    const crawlH = sSpec.crawlH || 1;
    const stairMax = Number.isFinite(sSpec.stairMax) ? sSpec.stairMax : 0;
    const isCrawl = (typeof ROBOT !== 'undefined' && ROBOT.posture === 'crawl');
    const bodyHeight = isCrawl ? crawlH : standH;
    const headLayers = getHeadStackHeight(DIG_STATE.headSoil || 0, wRank);
    return {
      reachH: hRank,
      reachW: wRank,
      reachD: 1,
      moveStep: 6 - wRank,
      pocketCap,
      headCap,
      headLayers,
      handSoilMax: hRank, // 極小1 / 小2 / 標準3 / 大4 / 巨大5
      handShovelMax: HAND_SHOVEL_MAX,
      throwToolMax: hRank + 2, // 控えめ案：極小3〜巨大7
      throwSoilMax: hRank + 1, // 控えめ案：極小2〜巨大6
      standH,
      crawlH,
      stairMax,
      climbMax: hRank,
      bodyHeight,
      maxStackHeight: hRank * 2,
      maxStepUpSub: isCrawl ? 1 : hRank
    };
  }

  // ポケット＋手枠の資源合計（土・木・石すべて重さ1、道具は非消費）
  function getPocketResourceTotal() {
    const p = DIG_STATE.pocket || {};
    return Math.max(0, Math.floor(p.soil || 0))
      + Math.max(0, Math.floor(p.wood || 0))
      + Math.max(0, Math.floor(p.stone || 0));
  }

  function getHandResourceTotal() {
    const h = DIG_STATE.equip && DIG_STATE.equip.hand;
    if (!h || !ITEM_META[h.id] || ITEM_META[h.id].kind !== 'material') return 0;
    return Math.max(0, Math.floor(h.count || 0));
  }

  function getCarriedResourceTotal() {
    return getPocketResourceTotal() + getHandResourceTotal();
  }

  function getPocketUsedSlotCount() {
    const p = DIG_STATE.pocket || {};
    let used = 0;
    if ((p.soil || 0) > 0) used++;
    if ((p.wood || 0) > 0) used++;
    if ((p.stone || 0) > 0) used++;
    if ((p.shovel || 0) > 0) used += Math.ceil(p.shovel / STACK_TOOL);
    return used;
  }

  function getMaxAddableShovelsToPocket() {
    const p = DIG_STATE.pocket || {};
    const curShovels = Math.max(0, Math.floor(p.shovel || 0));
    const matSlots = ((p.soil || 0) > 0 ? 1 : 0) + ((p.wood || 0) > 0 ? 1 : 0) + ((p.stone || 0) > 0 ? 1 : 0);
    const freeSlotsForTools = Math.max(0, 9 - matSlots);
    return Math.max(0, freeSlotsForTools * STACK_TOOL - curShovels);
  }

  function purgeLegacyItems() {
    if (typeof BAG !== 'undefined' && Array.isArray(BAG) && BAG.length > 0) BAG.length = 0;
    if (typeof WORLD_ITEMS !== 'undefined' && Array.isArray(WORLD_ITEMS) && WORLD_ITEMS.length > 0) WORLD_ITEMS.length = 0;
    if (window.ACTIVE_ENTITIES) {
      window.ACTIVE_ENTITIES.npc = null;
      window.ACTIVE_ENTITIES.enemy = null;
      window.ACTIVE_ENTITIES.wildPet = null;
      window.ACTIVE_ENTITIES.guestNpc = null;
    }
  }

  function saveDigState() {
    try {
      if (typeof safeStorage !== 'undefined') {
        safeStorage.setItem(STORAGE_KEY, JSON.stringify(DIG_STATE));
      }
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // 0-A. 圧縮木箱（25枠）の出し入れヘルパー
  // --------------------------------------------------------------------------
  function ensureCrateSlots(crate) {
    if (!Array.isArray(crate.slots) || crate.slots.length !== CRATE_SLOTS) {
      const next = Array.from({ length: CRATE_SLOTS }, () => null);
      if (Array.isArray(crate.slots)) {
        for (let i = 0; i < Math.min(CRATE_SLOTS, crate.slots.length); i++) {
          next[i] = crate.slots[i];
        }
      }
      crate.slots = next;
    }
    return crate.slots;
  }

  function countItemInCrate(crate, itemId) {
    const slots = ensureCrateSlots(crate);
    let total = 0;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] && slots[i].id === itemId) total += (slots[i].count || 0);
    }
    return total;
  }

  function countUsedSlotsInCrate(crate) {
    const slots = ensureCrateSlots(crate);
    let used = 0;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] && slots[i].count > 0) used++;
    }
    return used;
  }

  function addItemToCrate(crate, itemId, amount) {
    const meta = ITEM_META[itemId];
    if (!meta || amount <= 0) return 0;
    const slots = ensureCrateSlots(crate);
    const maxPerSlot = meta.stackMax || STACK_MATERIAL;
    let rem = Math.floor(amount);
    let added = 0;

    // 既存スタックへ補充
    for (let i = 0; i < slots.length && rem > 0; i++) {
      const s = slots[i];
      if (s && s.id === itemId && s.count < maxPerSlot) {
        const take = Math.min(rem, maxPerSlot - s.count);
        s.count += take;
        rem -= take;
        added += take;
      }
    }
    // 空き枠へ新規配置
    for (let i = 0; i < slots.length && rem > 0; i++) {
      if (!slots[i]) {
        const take = Math.min(rem, maxPerSlot);
        slots[i] = { id: itemId, count: take };
        rem -= take;
        added += take;
      }
    }
    return added;
  }

  function removeItemFromCrate(crate, itemId, amount) {
    if (amount <= 0) return 0;
    const slots = ensureCrateSlots(crate);
    let rem = Math.floor(amount);
    let removed = 0;

    // 末尾の少ない枠から優先的に取り出す
    for (let i = slots.length - 1; i >= 0 && rem > 0; i--) {
      const s = slots[i];
      if (s && s.id === itemId && s.count > 0) {
        const take = Math.min(rem, s.count);
        s.count -= take;
        rem -= take;
        removed += take;
        if (s.count <= 0) slots[i] = null;
      }
    }
    return removed;
  }

  function summarizeCrateContents(crate) {
    const used = countUsedSlotsInCrate(crate);
    const soil = countItemInCrate(crate, 'soil');
    const shovel = countItemInCrate(crate, 'shovel');
    const wood = countItemInCrate(crate, 'wood');
    const stone = countItemInCrate(crate, 'stone');
    const parts = [];
    if (shovel > 0) parts.push(`スコップ${shovel}本`);
    if (soil > 0) parts.push(`土${soil}個`);
    if (wood > 0) parts.push(`木材${wood}個`);
    if (stone > 0) parts.push(`石材${stone}個`);
    return `${parts.length ? parts.join('・') : '空'}（使用${used}/${CRATE_SLOTS}枠）`;
  }

  // --------------------------------------------------------------------------
  // 0-B. クリーン検証環境の構築（遅延フェード＆クラウド旧データ巻き戻り遮断）
  // --------------------------------------------------------------------------
  function syncDugCellsToChipMap() {
    if (typeof CHIP_MAP === 'undefined') return;
    const areaId = getCurAreaId();
    Object.keys(DIG_STATE.dugCells).forEach(k => {
      if (!k.startsWith(areaId + '|')) return;
      const chipKey = k.slice(areaId.length + 1);
      const list = DIG_STATE.dugCells[k];
      if (!Array.isArray(list) || !list.length) return;
      if (!CHIP_MAP[chipKey]) CHIP_MAP[chipKey] = {};
      list.forEach(tag => { CHIP_MAP[chipKey][tag] = true; });
    });
  }

  function relocatePortalsToCorner() {
    const cornerPortal = {
      type: 'warp',
      x: PORTAL_CORNER_POS.x,
      z: PORTAL_CORNER_POS.z,
      target: 'home',
      label: '🚪 ポータル（停止中）',
      needPuzzle: false
    };
    try {
      if (window.AREA_REGISTRY && window.AREA_REGISTRY.home) {
        window.AREA_REGISTRY.home.portals = [Object.assign({}, cornerPortal)];
        window.AREA_REGISTRY.home.spawn = { x: 0, z: 0, lv: 0 };
        window.AREA_REGISTRY.home.items = [];
        window.AREA_REGISTRY.home.puzzle = null;
      }
      if (typeof getCurrentAreaDef === 'function') {
        const def = getCurrentAreaDef();
        if (def && def.id === 'home') {
          def.portals = [Object.assign({}, cornerPortal)];
          def.spawn = { x: 0, z: 0, lv: 0 };
          def.items = [];
          def.puzzle = null;
        }
      }
    } catch (e) {}
  }

  function buildStairTagsFor5StepNorth() {
    const tags = [];
    for (let sz = 4; sz >= 1; sz--) {
      const keepHeight = 5 - sz;
      for (let sy = keepHeight; sy < 5; sy++) {
        for (let sx = 0; sx < 5; sx++) {
          tags.push(`${sx},${sy},${sz}`);
        }
      }
    }
    return tags;
  }

  function isCleanTerrainValid() {
    if (getCurAreaId() !== 'home') return false;
    if (typeof HEIGHT_MAP === 'undefined') return false;
    if (HEIGHT_MAP['0,0'] !== 0) return false;
    if (HEIGHT_MAP['0,-1'] !== 1) return false;
    if (HEIGHT_MAP['0,-2'] !== 1) return false;
    if (HEIGHT_MAP['1,2'] === 1) return false;
    return true;
  }

  function applyCleanTestTerrain(resetStatus = true) {
    relocatePortalsToCorner();

    if (getCurAreaId() !== 'home') {
      if (typeof window.switchAreaById === 'function') {
        try { window.switchAreaById('home', false); } catch (e) {}
      }
      if (typeof CURRENT_AREA_ID !== 'undefined') {
        try { CURRENT_AREA_ID = 'home'; } catch (e) {}
      }
    }

    relocatePortalsToCorner();
    purgeLegacyItems();

    if (typeof HEIGHT_MAP !== 'undefined') {
      for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
          HEIGHT_MAP[`${x},${z}`] = 0;
        }
      }
      HEIGHT_MAP['0,-1'] = 1;
      HEIGHT_MAP['0,-2'] = 1;
    }

    if (typeof CHIP_MAP !== 'undefined') {
      Object.keys(CHIP_MAP).forEach(k => delete CHIP_MAP[k]);
      const stairTags = buildStairTagsFor5StepNorth();
      CHIP_MAP['0,-1,1'] = {};
      stairTags.forEach(tag => { CHIP_MAP['0,-1,1'][tag] = true; });
    }

    DIG_STATE = createDefaultState();
    DIG_STATE.dugCells['home|0,-1,1'] = buildStairTagsFor5StepNorth();

    if (resetStatus && typeof ROBOT !== 'undefined' && ROBOT) {
      ROBOT.pos = { x: 0, z: 0, lv: 0, sx: 2, sz: 2, subY: 0 };
      ROBOT.rotY = Math.PI;
      ROBOT.posture = 'stand';
      ROBOT.emotion = 'normal';
      ROBOT.bulbEmotion = null;
      ROBOT.traumas = [];
      ROBOT.pet = null;
      if (typeof life !== 'undefined' && life) {
        life.energy = 100;
        life.stamina = 100;
        life.mental = 100;
      }
      if (typeof GAME_DAY !== 'undefined') GAME_DAY = 1;
      if (typeof TIME_STEP !== 'undefined') TIME_STEP = 0;
      if (typeof AI_MEMORY !== 'undefined' && Array.isArray(AI_MEMORY)) AI_MEMORY.length = 0;
      if (typeof DIARY_LOGS !== 'undefined' && Array.isArray(DIARY_LOGS)) {
        DIARY_LOGS.length = 0;
        DIARY_LOGS.push('🌱 1日目：完全手ぶら・圧縮木箱(25枠・スコップ1本入)でスタート');
      }
      const actEl = document.getElementById('history-action');
      const msgEl = document.getElementById('message-box');
      if (actEl) actEl.innerText = '🌱 v7.0検証環境を初期化しました';
      if (msgEl) msgEl.innerText = '完全手ぶらで待機中（左隣の圧縮木箱にスコップ1本入り・木箱タップで25枠確認可）。';
      if (window.AICommCore && typeof window.AICommCore.resetPhysicalHistory === 'function') {
        window.AICommCore.resetPhysicalHistory();
      }
    }

    if (typeof saveHomeSnapshotIfHome === 'function') {
      try { saveHomeSnapshotIfHome(); } catch (e) {}
    }

    saveDigState();
    if (typeof saveWorldState === 'function') saveWorldState();
    if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
    if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition(true);
    if (typeof updateAllCamerasTransform === 'function') updateAllCamerasTransform();
    if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
    if (typeof updateAreaAndPetBadgeUI === 'function') updateAreaAndPetBadgeUI();
    renderDiaryFullUI();
  }

  // 旧ボタンイベント整理 ＆ 旧ツール非表示 ＆ 3D頭上・手元グループ追加
  (function setupCleanHooksAndVisualRoot() {
    const oldBtn = document.getElementById('btn-action');
    if (oldBtn && oldBtn.parentNode) {
      const newBtn = oldBtn.cloneNode(true);
      oldBtn.parentNode.replaceChild(newBtn, oldBtn);
      newBtn.addEventListener('click', () => {
        if (typeof window.executeTurn === 'function') window.executeTurn();
      });
    }
    try {
      if (typeof boxTool !== 'undefined' && boxTool) {
        boxTool.children.forEach(ch => { ch.visible = false; });
        boxTool.visible = false;
      }
      if (typeof stickTool !== 'undefined' && stickTool) {
        stickTool.children.forEach(ch => { ch.visible = false; });
        stickTool.visible = false;
      }
    } catch (e) {}
  })();

  const headPyramidGroup = new THREE.Group();
  headPyramidGroup.name = 'dig_head_pyramid_group';
  const handEquipGroup = new THREE.Group();
  handEquipGroup.name = 'dig_hand_equip_group';
  if (typeof robotGroup !== 'undefined' && robotGroup) {
    robotGroup.add(headPyramidGroup);
    robotGroup.add(handEquipGroup);
  }

  // --------------------------------------------------------------------------
  // 1. 厳密5×5×5サブ座標ユーティリティ
  // --------------------------------------------------------------------------
  function absToTile(absVal) {
    const n = Math.round(absVal);
    return { tile: Math.floor(n / 5), sub: ((n % 5) + 5) % 5 };
  }

  function isInsideIslandAbs(absX, absZ) {
    return absX >= -10 && absX <= 14 && absZ >= -10 && absZ <= 14;
  }

  function absToWorldXZ(absX, absZ) {
    return { wx: (absX - 2) * SUB_SIZE, wz: (absZ - 2) * SUB_SIZE };
  }

  function subYToLvSy(totalSubY) {
    const n = Math.round(totalSubY);
    const lv = Math.floor(n / 5) + 1;
    const sy = ((n % 5) + 5) % 5;
    return { lv, sy };
  }

  function floorSubYToRobotLv(floorSubY) {
    const minLv = getMinUnderLv();
    const lv = Math.floor((Math.round(floorSubY) - 1) / 5) + 1;
    return Math.max(minLv, lv);
  }

  function getRobotAbsPos() {
    const gx = Number.isFinite(ROBOT.pos.x) ? Math.round(ROBOT.pos.x) : 0;
    const gz = Number.isFinite(ROBOT.pos.z) ? Math.round(ROBOT.pos.z) : 0;
    const sx = Number.isFinite(ROBOT.pos.sx) ? Math.max(0, Math.min(4, Math.round(ROBOT.pos.sx))) : 2;
    const sz = Number.isFinite(ROBOT.pos.sz) ? Math.max(0, Math.min(4, Math.round(ROBOT.pos.sz))) : 2;
    return { absX: gx * 5 + sx, absZ: gz * 5 + sz };
  }

  function getFootprintBounds(reachW) {
    return {
      minOff: -Math.floor((reachW - 1) / 2),
      maxOff:  Math.floor(reachW / 2)
    };
  }

  function getFrontEdgeOffset(dx, dz, reachW) {
    const { minOff, maxOff } = getFootprintBounds(reachW);
    return {
      ox: dx > 0 ? (maxOff + 1) : (dx < 0 ? (minOff - 1) : 0),
      oz: dz > 0 ? (maxOff + 1) : (dz < 0 ? (minOff - 1) : 0)
    };
  }

  function isInsideRobotFootprint(absX, absZ, centerAbsX, centerAbsZ, reachW) {
    const { minOff, maxOff } = getFootprintBounds(reachW);
    return (
      absX >= centerAbsX + minOff && absX <= centerAbsX + maxOff &&
      absZ >= centerAbsZ + minOff && absZ <= centerAbsZ + maxOff
    );
  }

  function isWaterProtectedCell(tx, tz, lv, sx, sy, sz) {
    if (typeof isWaterFacingOuterSubVoxel === 'function') {
      return Boolean(isWaterFacingOuterSubVoxel(tx, tz, lv, sx, sy, sz));
    }
    if (lv > 0) return false;
    if (lv === 0 && sy >= 3) return false;
    if (tx === -2 && sx === 0) return true;
    if (tx === 2  && sx === 4) return true;
    if (tz === -2 && sz === 0) return true;
    if (tz === 2  && sz === 4) return true;
    return false;
  }

  function hasSolidTerrainSubVoxel(tx, tz, lv, sx, sy, sz) {
    if (tx < -2 || tx > 2 || tz < -2 || tz > 2) return false;
    const minLv = getMinUnderLv();
    const topLv = (typeof HEIGHT_MAP !== 'undefined' && HEIGHT_MAP[`${tx},${tz}`] !== undefined)
      ? HEIGHT_MAP[`${tx},${tz}`]
      : 0;
    if (lv < minLv || lv > topLv) return false;
    if (typeof CHIP_MAP !== 'undefined') {
      const ch = CHIP_MAP[`${tx},${tz},${lv}`];
      if (ch && ch[`${sx},${sy},${sz}`]) return false;
    }
    return true;
  }

  function hasSolidTerrainAtAbsSubY(absX, totalSubY, absZ) {
    const ix = Math.round(absX);
    const iz = Math.round(absZ);
    if (!isInsideIslandAbs(ix, iz)) return false;
    const tX = absToTile(ix);
    const tZ = absToTile(iz);
    const yInfo = subYToLvSy(totalSubY);
    return hasSolidTerrainSubVoxel(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub);
  }

  function isExposedToAir(tx, tz, lv, sx, sy, sz) {
    const absX = tx * 5 + sx;
    const absZ = tz * 5 + sz;
    const totalSubY = (lv - 1) * 5 + sy;
    const neighbors = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for (let i = 0; i < neighbors.length; i++) {
      const nx = absX + neighbors[i][0];
      const ny = totalSubY + neighbors[i][1];
      const nz = absZ + neighbors[i][2];
      if (!isInsideIslandAbs(nx, nz)) return true;
      if (!hasSolidTerrainAtAbsSubY(nx, ny, nz)) return true;
    }
    return false;
  }

  function getTerrainColumnTopSubY(absX, absZ) {
    const tX = absToTile(absX);
    const tZ = absToTile(absZ);
    const minLv = getMinUnderLv();
    const topLv = (typeof HEIGHT_MAP !== 'undefined' && HEIGHT_MAP[`${tX.tile},${tZ.tile}`] !== undefined)
      ? HEIGHT_MAP[`${tX.tile},${tZ.tile}`]
      : 0;
    for (let lv = topLv; lv >= minLv; lv--) {
      for (let sy = 4; sy >= 0; sy--) {
        if (hasSolidTerrainSubVoxel(tX.tile, tZ.tile, lv, tX.sub, sy, tZ.sub)) {
          return (lv - 1) * 5 + sy + 1;
        }
      }
    }
    return getMinSubY();
  }

  function findFloorSubYBelow(absX, absZ, startSubY) {
    const minSubY = getMinSubY();
    const maxCheck = Math.max(minSubY, Math.floor(startSubY));
    for (let y = maxCheck - 1; y >= minSubY; y--) {
      if (hasSolidTerrainAtAbsSubY(absX, y, absZ)) return y + 1;
    }
    return minSubY;
  }

  function makeSoilKey(absX, absZ, floorSubY, areaId = getCurAreaId()) {
    return `${areaId}|${Math.round(absX)},${Math.round(absZ)}|${Math.round(floorSubY)}`;
  }

  function parseSoilKey(key) {
    const parts = String(key).split('|');
    if (parts.length < 2) return null;
    const areaId = parts[0];
    const coords = parts[1].split(',').map(Number);
    if (coords.length < 2 || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return null;
    const floorSubY = (parts.length >= 3 && Number.isFinite(Number(parts[2]))) ? Number(parts[2]) : null;
    return { areaId, absX: Math.round(coords[0]), absZ: Math.round(coords[1]), floorSubY };
  }

  function getLooseSoilAtFloor(absX, absZ, floorSubY, areaId = getCurAreaId()) {
    return DIG_STATE.worldSubSoils[makeSoilKey(absX, absZ, floorSubY, areaId)] || 0;
  }

  function addLooseSoilAtFloor(absX, absZ, floorSubY, delta, areaId = getCurAreaId()) {
    const key = makeSoilKey(absX, absZ, floorSubY, areaId);
    const next = Math.max(0, (DIG_STATE.worldSubSoils[key] || 0) + delta);
    if (next === 0) delete DIG_STATE.worldSubSoils[key];
    else DIG_STATE.worldSubSoils[key] = next;
  }

  function getLooseSoilStacksInColumn(absX, absZ, areaId = getCurAreaId()) {
    const prefix = `${areaId}|${Math.round(absX)},${Math.round(absZ)}|`;
    const res = [];
    Object.keys(DIG_STATE.worldSubSoils).forEach(k => {
      if (!k.startsWith(prefix)) return;
      const cnt = DIG_STATE.worldSubSoils[k] || 0;
      if (cnt <= 0) return;
      const floorSubY = Number(k.slice(prefix.length));
      if (Number.isFinite(floorSubY)) res.push({ key: k, floorSubY, count: cnt });
    });
    res.sort((a, b) => a.floorSubY - b.floorSubY);
    return res;
  }

  function hasLooseSoilAtSubY(absX, totalSubY, absZ, areaId = getCurAreaId()) {
    const stacks = getLooseSoilStacksInColumn(absX, absZ, areaId);
    for (let i = 0; i < stacks.length; i++) {
      if (totalSubY >= stacks[i].floorSubY && totalSubY < stacks[i].floorSubY + stacks[i].count) {
        return true;
      }
    }
    return false;
  }

  function settleFloatingLooseSoilsAtColumn(absX, absZ, areaId = getCurAreaId()) {
    const stacks = getLooseSoilStacksInColumn(absX, absZ, areaId);
    const minSubY = getMinSubY();
    stacks.forEach(st => {
      if (st.floorSubY <= minSubY) return;
      if (!hasSolidTerrainAtAbsSubY(absX, st.floorSubY - 1, absZ)) {
        const newFloorY = findFloorSubYBelow(absX, absZ, st.floorSubY);
        if (newFloorY !== st.floorSubY) {
          addLooseSoilAtFloor(absX, absZ, st.floorSubY, -st.count, areaId);
          addLooseSoilAtFloor(absX, absZ, newFloorY, st.count, areaId);
        }
      }
    });
    // 落ちている道具も足元が抜ければ落下
    (DIG_STATE.worldDroppedItems || []).forEach(it => {
      if (it.areaId !== areaId || it.absX !== absX || it.absZ !== absZ) return;
      if (it.floorSubY > minSubY && !hasSolidTerrainAtAbsSubY(absX, it.floorSubY - 1, absZ)) {
        it.floorSubY = findFloorSubYBelow(absX, absZ, it.floorSubY);
      }
    });
  }

  function addDroppedTool(itemId, absX, absZ, floorSubY, count = 1, areaId = getCurAreaId()) {
    if (!Array.isArray(DIG_STATE.worldDroppedItems)) DIG_STATE.worldDroppedItems = [];
    const hit = DIG_STATE.worldDroppedItems.find(
      it => it.areaId === areaId && it.id === itemId && it.absX === absX && it.absZ === absZ && it.floorSubY === floorSubY
    );
    if (hit) hit.count += count;
    else DIG_STATE.worldDroppedItems.push({ id: itemId, areaId, absX, absZ, floorSubY, count });
  }

  function hasDroppedShovelAt(absX, absZ, refSubY, areaId = getCurAreaId()) {
    return (DIG_STATE.worldDroppedItems || []).some(
      it => it.areaId === areaId && it.id === 'shovel' && it.count > 0 &&
        it.absX === absX && it.absZ === absZ && Math.abs(it.floorSubY - refSubY) <= 1
    );
  }

  function getCeilingClearanceSubAt(centerAbsX, centerAbsZ, footSubY, reachW) {
    const { minOff, maxOff } = getFootprintBounds(reachW);
    let minClear = 20;
    for (let ox = minOff; ox <= maxOff; ox++) {
      for (let oz = minOff; oz <= maxOff; oz++) {
        const cx = centerAbsX + ox;
        const cz = centerAbsZ + oz;
        if (!isInsideIslandAbs(cx, cz)) return 0;
        let clearHere = 0;
        for (let h = 0; h < 20; h++) {
          if (hasSolidTerrainAtAbsSubY(cx, footSubY + h, cz)) break;
          clearHere++;
        }
        if (clearHere < minClear) minClear = clearHere;
      }
    }
    return minClear;
  }

  function computeExactFootSubYAt(centerAbsX, centerAbsZ, hintSubY, reachW) {
    const areaId = getCurAreaId();
    const { minOff, maxOff } = getFootprintBounds(reachW);
    let bestSupport = getMinSubY();
    for (let ox = minOff; ox <= maxOff; ox++) {
      for (let oz = minOff; oz <= maxOff; oz++) {
        const cx = centerAbsX + ox;
        const cz = centerAbsZ + oz;
        if (!isInsideIslandAbs(cx, cz)) continue;
        let airY = hintSubY;
        let foundAir = false;
        for (let up = 0; up <= 5; up++) {
          const testY = hintSubY + up;
          if (!hasSolidTerrainAtAbsSubY(cx, testY, cz) && !hasLooseSoilAtSubY(cx, testY, cz, areaId)) {
            airY = testY;
            foundAir = true;
            break;
          }
        }
        if (!foundAir) {
          bestSupport = Math.max(bestSupport, getTerrainColumnTopSubY(cx, cz));
          continue;
        }
        const solidFloor = findFloorSubYBelow(cx, cz, airY);
        const looseCnt = getLooseSoilAtFloor(cx, cz, solidFloor, areaId);
        const topSupport = Math.min(airY, solidFloor + looseCnt);
        if (topSupport > bestSupport) bestSupport = topSupport;
      }
    }
    return bestSupport;
  }

  function getRobotBaseSubY(gx = ROBOT.pos.x, gz = ROBOT.pos.z, lv = ROBOT.pos.lv) {
    const stats = getSizeStats();
    const isCurrentTile = (Math.round(gx) === Math.round(ROBOT.pos.x) && Math.round(gz) === Math.round(ROBOT.pos.z));
    if (isCurrentTile) {
      const { absX, absZ } = getRobotAbsPos();
      let hintSubY;
      if (Number.isFinite(ROBOT.pos.subY) && floorSubYToRobotLv(ROBOT.pos.subY) === (Number.isFinite(lv) ? lv : ROBOT.pos.lv)) {
        hintSubY = Math.round(ROBOT.pos.subY);
      } else if (_origGetSurfaceYAt) {
        hintSubY = Math.round(_origGetSurfaceYAt(Math.round(gx), Math.round(gz), lv, stats.reachW) * 5);
      } else {
        hintSubY = (lv || 0) * 5;
      }
      const exactY = computeExactFootSubYAt(absX, absZ, hintSubY, stats.reachW);
      ROBOT.pos.subY = exactY;
      return exactY;
    }
    if (_origGetSurfaceYAt) {
      return Math.round(_origGetSurfaceYAt(Math.round(gx), Math.round(gz), lv, stats.reachW) * 5);
    }
    return (lv || 0) * 5;
  }

  function getCrateBaseSubY(crate) {
    const yBase = _origGetSurfaceYAt ? _origGetSurfaceYAt(crate.x, crate.z, null, 5) : 0;
    return Math.round(yBase * 5);
  }

  function isCrateBlockingAtSubY(absX, totalSubY, absZ, areaId = getCurAreaId()) {
    return DIG_STATE.crates.some(c => {
      if (c.areaId !== areaId) return false;
      const cx = c.x * 5 + 2;
      const cz = c.z * 5 + 2;
      if (Math.abs(absX - cx) > 2 || Math.abs(absZ - cz) > 2) return false;
      const cBaseY = getCrateBaseSubY(c);
      return totalSubY >= cBaseY && totalSubY < cBaseY + 5;
    });
  }

  function loadDigState() {
    let loaded = false;
    try {
      if (typeof safeStorage !== 'undefined') {
        const raw = safeStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && parsed.envTag === CLEAN_ENV_TAG) {
            DIG_STATE = Object.assign(createDefaultState(), parsed);
            DIG_STATE.pocket = Object.assign({ soil: 0, wood: 0, stone: 0, shovel: 0 }, parsed.pocket || {});
            DIG_STATE.equip = Object.assign({ head: null, body: null, waist: null, back: null, hand: null, feet: null }, parsed.equip || {});
            if (!Array.isArray(DIG_STATE.crates) || !DIG_STATE.crates.length) {
              DIG_STATE.crates = createDefaultState().crates;
            } else {
              DIG_STATE.crates.forEach(c => ensureCrateSlots(c));
            }
            if (!Array.isArray(DIG_STATE.worldDroppedItems)) DIG_STATE.worldDroppedItems = [];
            loaded = true;
          }
        }
      }
    } catch (e) {
      DIG_STATE = createDefaultState();
    }

    if (!loaded || !isCleanTerrainValid()) {
      applyCleanTestTerrain(true);
    } else {
      relocatePortalsToCorner();
      purgeLegacyItems();
      syncDugCellsToChipMap();
      if (typeof ROBOT !== 'undefined' && ROBOT && ROBOT.pos) {
        ROBOT.pos.sx = Math.max(0, Math.min(4, Math.round(Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2)));
        ROBOT.pos.sz = Math.max(0, Math.min(4, Math.round(Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2)));
        ROBOT.pos.subY = getRobotBaseSubY();
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. A案：キャラの1人称視野記号マップ（厳密DDA視線・落ちたスコップ S 表示対応）
  // --------------------------------------------------------------------------
  function getFacingBasis() {
    const rot = ROBOT.rotY || 0;
    const vx = Math.sin(rot);
    const vz = Math.cos(rot);

    const cardinals = (typeof ALL_DIRS !== 'undefined' ? ALL_DIRS : []).filter(d => Math.abs(d.dx) + Math.abs(d.dz) === 1);
    let best = cardinals[0] || { dx: 0, dz: 1, name: '南' };
    let bestDot = -99;
    cardinals.forEach(d => {
      const dot = d.dx * vx + d.dz * vz;
      if (dot > bestDot) { bestDot = dot; best = d; }
    });

    const fx = best.dx, fz = best.dz;
    const rx = -fz, rz = fx;
    const findName = (dx, dz) => {
      const hit = cardinals.find(d => d.dx === dx && d.dz === dz);
      return hit ? hit.name.replace('(斜め)', '') : '';
    };
    const actualFacingName = (typeof getDirNameFromRot === 'function')
      ? getDirNameFromRot(rot).replace('(斜め)', '')
      : best.name.replace('(斜め)', '');

    return {
      fx, fz, rx, rz,
      frontName: best.name.replace('(斜め)', ''),
      rightName: findName(rx, rz),
      leftName:  findName(-rx, -rz),
      actualFacingName
    };
  }

  function isBehindCurrentFacing(dir) {
    if (!dir) return false;
    const curRot = ROBOT.rotY || 0;
    const cx = Math.sin(curRot), cz = Math.cos(curRot);
    const len = Math.hypot(dir.dx || 0, dir.dz || 0) || 1;
    const tx = (dir.dx || 0) / len;
    const tz = (dir.dz || 0) / len;
    return (cx * tx + cz * tz) < -0.38;
  }

  function isVisibleFromEye(curAbsX, curAbsZ, eyeSubY, targetAbsX, targetAbsZ) {
    const x0 = Math.round(curAbsX), z0 = Math.round(curAbsZ);
    const x1 = Math.round(targetAbsX), z1 = Math.round(targetAbsZ);
    if (x0 === x1 && z0 === z1) return true;

    const areaId = getCurAreaId();
    const dx = x1 - x0, dz = z1 - z0;
    const stepX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
    const stepZ = dz > 0 ? 1 : (dz < 0 ? -1 : 0);

    const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tMaxX = dx !== 0 ? (0.5 * tDeltaX) : Infinity;
    let tMaxZ = dz !== 0 ? (0.5 * tDeltaZ) : Infinity;

    let cx = x0, cz = z0;
    const maxIter = Math.abs(dx) + Math.abs(dz) + 4;

    const isBlockingCell = (mx, mz) => {
      if (!isInsideIslandAbs(mx, mz)) return true;
      if (hasSolidTerrainAtAbsSubY(mx, eyeSubY, mz)) return true;
      if (hasLooseSoilAtSubY(mx, eyeSubY, mz, areaId)) return true;
      if (isCrateBlockingAtSubY(mx, eyeSubY, mz, areaId)) return true;
      return false;
    };

    for (let iter = 0; iter < maxIter; iter++) {
      if (Math.abs(tMaxX - tMaxZ) < 1e-9) {
        const sideBlockA = (cx + stepX !== x1 || cz !== z1) && isBlockingCell(cx + stepX, cz);
        const sideBlockB = (cx !== x1 || cz + stepZ !== z1) && isBlockingCell(cx, cz + stepZ);
        if (sideBlockA && sideBlockB) return false;
        cx += stepX; cz += stepZ;
        tMaxX += tDeltaX; tMaxZ += tDeltaZ;
      } else if (tMaxX < tMaxZ) {
        cx += stepX; tMaxX += tDeltaX;
      } else {
        cz += stepZ; tMaxZ += tDeltaZ;
      }
      if (cx === x1 && cz === z1) return true;
      if (isBlockingCell(cx, cz)) return false;
    }
    return true;
  }

  function buildFirstPersonVisionMap(opts = {}) {
    const isMoving = Boolean(
      opts && typeof opts.isMoving === 'boolean'
        ? opts.isMoving
        : (window.AICommCore && typeof window.AICommCore.isMovingVision === 'function' && window.AICommCore.isMovingVision())
    );
    const stats = getSizeStats();
    const areaId = getCurAreaId();
    const { absX, absZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const eyeSubY = baseSubY + Math.max(1, stats.bodyHeight) - 1;
    const basis = getFacingBasis();

    const maxLat = isMoving ? 3 : 4;
    const headerCols = [];
    for (let lat = -maxLat; lat <= maxLat; lat++) {
      if (lat < 0) headerCols.push(`L${Math.abs(lat)}`);
      else if (lat === 0) headerCols.push('正');
      else headerCols.push(`R${lat}`);
    }

    const topRows = [`列 : ${headerCols.join(' ')}`];
    for (let fwd = 6; fwd >= 0; fwd--) {
      let row = `前${fwd}: `;
      for (let lat = -maxLat; lat <= maxLat; lat++) {
        if (fwd === 0 && lat === 0) { row += ' @ '; continue; }
        if (isMoving) {
          if (fwd === 0 && Math.abs(lat) > 0) { row += ' ? '; continue; }
          if (fwd === 1 && Math.abs(lat) > 1) { row += ' ? '; continue; }
          if (fwd === 2 && Math.abs(lat) > 2) { row += ' ? '; continue; }
        }

        const tx = absX + basis.fx * fwd + basis.rx * lat;
        const tz = absZ + basis.fz * fwd + basis.rz * lat;
        if (!isInsideIslandAbs(tx, tz)) { row += ' ~ '; continue; }
        if (!isVisibleFromEye(absX, absZ, eyeSubY, tx, tz)) { row += ' ? '; continue; }

        let ch = '.';
        if (isCrateBlockingAtSubY(tx, baseSubY, tz, areaId) || isCrateBlockingAtSubY(tx, eyeSubY, tz, areaId)) {
          ch = 'B';
        } else {
          const floorHere = findFloorSubYBelow(tx, tz, baseSubY + 1);
          const loose = getLooseSoilAtFloor(tx, tz, floorHere, areaId);
          const looseTopY = floorHere + loose;
          const solid0 = hasSolidTerrainAtAbsSubY(tx, baseSubY, tz);
          const solid1 = hasSolidTerrainAtAbsSubY(tx, baseSubY + 1, tz);
          let hasLowCeiling = solid1;
          if (!hasLowCeiling && !solid0) {
            for (let h = 2; h <= 4; h++) {
              if (hasSolidTerrainAtAbsSubY(tx, baseSubY + h, tz)) { hasLowCeiling = true; break; }
            }
          }

          if (loose > 0 && floorHere <= baseSubY + 1 && looseTopY > baseSubY) {
            const relHeight = (floorHere === baseSubY) ? loose : (looseTopY - baseSubY);
            ch = String(Math.min(9, Math.max(1, relHeight)));
          } else if (solid0 && solid1) {
            ch = '#';
          } else if (solid0 && !solid1) {
            ch = '+';
          } else if (!solid0 && hasLowCeiling) {
            ch = '^';
          } else if (hasDroppedShovelAt(tx, tz, floorHere, areaId)) {
            ch = 'S';
          } else if (floorHere === baseSubY || looseTopY === baseSubY) {
            ch = '.';
          } else {
            ch = 'v';
          }
        }
        row += ` ${ch} `;
      }
      topRows.push(row.trimEnd());
    }

    const frontEdge = getFrontEdgeOffset(basis.fx, basis.fz, stats.reachW);
    const sliceRows = ['列 : L2 L1 正 R1 R2'];
    for (let h = 4; h >= -1; h--) {
      const label = h >= 0 ? `高${h + 1}` : '床 ';
      let row = `${label}: `;
      for (let lat = -2; lat <= 2; lat++) {
        const tx = absX + frontEdge.ox + basis.rx * lat;
        const tz = absZ + frontEdge.oz + basis.rz * lat;
        if (!isInsideIslandAbs(tx, tz)) { row += ' ~ '; continue; }
        const curY = baseSubY + h;
        if (hasSolidTerrainAtAbsSubY(tx, curY, tz)) row += ' # ';
        else if (hasLooseSoilAtSubY(tx, curY, tz, areaId)) row += ' o ';
        else if (isCrateBlockingAtSubY(tx, curY, tz, areaId)) row += ' B ';
        else if (h === 0 && hasDroppedShovelAt(tx, tz, curY, areaId)) row += ' S ';
        else row += ' . ';
      }
      sliceRows.push(row.trimEnd());
    }

    const modeTitle = isMoving
      ? '[移動直後・狭い前方視野 (1文字=1分割, 上ほど奥)]'
      : '[停止中・180°パノラマ視野 (1文字=1分割, 上ほど奥・真横まで可視)]';

    return [
      `視界の向き: 正面=${basis.actualFacingName}(基準:${basis.frontName} / 左:${basis.leftName} / 右:${basis.rightName}) ※背後は死角`,
      modeTitle,
      ...topRows,
      `[目の前1列目の正面断面 (L2=左2, L1=左1, 正=正面, R1=右1, R2=右2)]`,
      ...sliceRows,
      `記号: @=自分 #=壁(高2以上) +=1段高 ^=高1空洞(高2以上に壁/低天井) .=平坦/空間 v=低い床/穴 1-9/o=散らばり土(段数) S=落ちたスコップ(通行可) B=圧縮木箱(5x5x5) ~=端 ?=死角`
    ].join('\n');
  }

  // --------------------------------------------------------------------------
  // 3. 3D描画（圧縮木箱・散らばり土・落ちたスコップ・頭上ピラミッド・手枠装備）
  // --------------------------------------------------------------------------
  const digVisualGroup = new THREE.Group();
  digVisualGroup.name = 'dig_rules_visual_group';
  if (typeof scene !== 'undefined' && scene) scene.add(digVisualGroup);

  const crateHitMeshes = []; // 3D圧縮木箱のタップ判定用メッシュ一覧

  const unitBoxGeo  = new THREE.BoxGeometry(SUB_SIZE * 0.96, SUB_SIZE * 0.96, SUB_SIZE * 0.96);
  const unitEdgeGeo = new THREE.EdgesGeometry(unitBoxGeo);
  const soilMatLight = new THREE.MeshLambertMaterial({ color: 0xd9a875 });
  const soilMatDark  = new THREE.MeshLambertMaterial({ color: 0xc68e5a });
  const soilEdgeMat  = new THREE.LineBasicMaterial({ color: 0x7c4a21, transparent: true, opacity: 0.42 });
  const shovelHandleMat = new THREE.MeshLambertMaterial({ color: 0x92400e });
  const shovelBladeMat  = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });

  function createMiniShovelMesh(scale = 1.0) {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035 * scale, 0.22 * scale, 0.035 * scale), shovelHandleMat);
    handle.position.y = 0.08 * scale;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.085 * scale, 0.03 * scale, 0.035 * scale), shovelHandleMat);
    grip.position.y = 0.19 * scale;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.095 * scale, 0.09 * scale, 0.025 * scale), shovelBladeMat);
    blade.position.y = -0.05 * scale;
    g.add(handle, grip, blade);
    return g;
  }

  function buildCrateMesh(crate) {
    const grp = new THREE.Group();
    const boxSize = SUB_SIZE * 5;
    const yBase = _origGetSurfaceYAt ? _origGetSurfaceYAt(crate.x, crate.z, null, 5) : 0;
    grp.position.set(crate.x, yBase, crate.z);
    grp.userData.crateId = crate.id;

    const woodMat  = new THREE.MeshLambertMaterial({ color: 0xe6be8a });
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x9a6b43 });
    const bandMat  = new THREE.MeshLambertMaterial({ color: 0x475569 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(boxSize * 0.96, boxSize * 0.90, boxSize * 0.96), woodMat);
    body.position.y = boxSize * 0.45;
    body.userData.crateId = crate.id;
    grp.add(body);
    crateHitMeshes.push(body);

    const rimTop = new THREE.Mesh(new THREE.BoxGeometry(boxSize, 0.08, boxSize), frameMat);
    rimTop.position.y = boxSize * 0.92;
    rimTop.userData.crateId = crate.id;
    grp.add(rimTop);
    crateHitMeshes.push(rimTop);

    const band = new THREE.Mesh(new THREE.BoxGeometry(boxSize * 0.99, 0.07, boxSize * 0.99), bandMat);
    band.position.y = boxSize * 0.45;
    grp.add(band);

    const usedSlots = countUsedSlotsInCrate(crate);
    if (usedSlots > 0) {
      const ratio = Math.min(1, usedSlots / CRATE_SLOTS);
      const fillH = Math.max(0.08, boxSize * 0.78 * ratio);
      const soilMesh = new THREE.Mesh(
        new THREE.BoxGeometry(boxSize * 0.84, fillH, boxSize * 0.84),
        new THREE.MeshLambertMaterial({ color: 0xb97f4c })
      );
      soilMesh.position.y = fillH * 0.5 + 0.08;
      grp.add(soilMesh);
    }
    return grp;
  }

  function renderHeadPyramidVisual() {
    while (headPyramidGroup.children.length) headPyramidGroup.remove(headPyramidGroup.children[0]);
    const count = Math.max(0, Math.floor(DIG_STATE.headSoil || 0));
    if (count <= 0) return;

    const stats = getSizeStats();
    const sSpec = getOriginalSizeSpec();
    const headBaseY = (ROBOT.posture === 'crawl')
      ? Math.max(0.20, stats.crawlH * SUB_SIZE)
      : (Number.isFinite(sSpec.scaleY) ? Math.max(0.22, sSpec.scaleY * 0.96) : stats.reachH * SUB_SIZE);

    let placed = 0;
    for (let layer = 0; layer < stats.reachW && placed < count; layer++) {
      const w = stats.reachW - layer;
      const offset = (w - 1) * 0.5;
      for (let gx = 0; gx < w && placed < count; gx++) {
        for (let gz = 0; gz < w && placed < count; gz++) {
          const m = new THREE.Mesh(unitBoxGeo, ((gx + gz + layer) % 2 === 0) ? soilMatLight : soilMatDark);
          m.position.set(
            (gx - offset) * SUB_SIZE,
            headBaseY + layer * SUB_SIZE + SUB_SIZE * 0.5,
            (gz - offset) * SUB_SIZE
          );
          m.add(new THREE.LineSegments(unitEdgeGeo, soilEdgeMat));
          headPyramidGroup.add(m);
          placed++;
        }
      }
    }
  }

  function renderHandEquipVisual() {
    while (handEquipGroup.children.length) handEquipGroup.remove(handEquipGroup.children[0]);
    const hand = DIG_STATE.equip && DIG_STATE.equip.hand;
    if (!hand || !hand.count) return;

    const stats = getSizeStats();
    const sSpec = getOriginalSizeSpec();
    const handY = Math.max(0.10, (Number.isFinite(sSpec.scaleY) ? sSpec.scaleY : stats.reachH * SUB_SIZE) * 0.48);
    const sideX = Math.max(0.12, stats.reachW * SUB_SIZE * 0.56);
    const frontZ = Math.max(0.11, stats.reachW * SUB_SIZE * 0.52);

    if (hand.id === 'shovel') {
      const sc = Math.max(0.85, 0.75 + stats.reachH * 0.16);
      const rightShovel = createMiniShovelMesh(sc);
      rightShovel.position.set(sideX, handY, frontZ * 0.55);
      rightShovel.rotation.set(0.45, 0, -0.2);
      handEquipGroup.add(rightShovel);
      if (hand.count >= 2) {
        const leftShovel = createMiniShovelMesh(sc);
        leftShovel.position.set(-sideX, handY, frontZ * 0.55);
        leftShovel.rotation.set(0.45, 0, 0.2);
        handEquipGroup.add(leftShovel);
      }
    } else if (hand.id === 'soil') {
      const showN = Math.min(5, hand.count);
      const miniScale = 0.65;
      for (let i = 0; i < showN; i++) {
        const m = new THREE.Mesh(unitBoxGeo, (i % 2 === 0) ? soilMatLight : soilMatDark);
        m.scale.set(miniScale, miniScale, miniScale);
        m.position.set(0, handY + i * (SUB_SIZE * miniScale * 0.85), frontZ);
        m.add(new THREE.LineSegments(unitEdgeGeo, soilEdgeMat));
        handEquipGroup.add(m);
      }
    }
  }

  function renderDigVisuals() {
    while (digVisualGroup.children.length) digVisualGroup.remove(digVisualGroup.children[0]);
    crateHitMeshes.length = 0;
    renderHeadPyramidVisual();
    renderHandEquipVisual();

    const areaId = getCurAreaId();
    DIG_STATE.crates.forEach(c => {
      if (c.areaId === areaId) digVisualGroup.add(buildCrateMesh(c));
    });

    // 地面の散らばり土
    Object.keys(DIG_STATE.worldSubSoils).forEach(k => {
      const count = DIG_STATE.worldSubSoils[k] || 0;
      if (count <= 0) return;
      const p = parseSoilKey(k);
      if (!p || p.areaId !== areaId || !isInsideIslandAbs(p.absX, p.absZ)) return;
      const { wx, wz } = absToWorldXZ(p.absX, p.absZ);
      const baseSubY = (p.floorSubY !== null) ? p.floorSubY : getTerrainColumnTopSubY(p.absX, p.absZ);
      const showCount = Math.min(count, 10);
      for (let i = 0; i < showCount; i++) {
        const m = new THREE.Mesh(unitBoxGeo, ((p.absX + p.absZ + i) % 2 === 0) ? soilMatLight : soilMatDark);
        m.position.set(wx, (baseSubY + i) * SUB_SIZE + SUB_SIZE * 0.5, wz);
        m.add(new THREE.LineSegments(unitEdgeGeo, soilEdgeMat));
        digVisualGroup.add(m);
      }
    });

    // 地面に落ちたスコップ（通り抜け可）
    (DIG_STATE.worldDroppedItems || []).forEach(it => {
      if (it.areaId !== areaId || it.count <= 0 || !isInsideIslandAbs(it.absX, it.absZ)) return;
      if (it.id === 'shovel') {
        const { wx, wz } = absToWorldXZ(it.absX, it.absZ);
        const yPos = it.floorSubY * SUB_SIZE + 0.03;
        const countShow = Math.min(3, it.count);
        for (let i = 0; i < countShow; i++) {
          const sh = createMiniShovelMesh(0.95);
          sh.position.set(wx + (i - (countShow - 1) * 0.5) * 0.05, yPos + i * 0.02, wz);
          sh.rotation.set(Math.PI / 2, 0.35 + i * 0.4, 0.2);
          digVisualGroup.add(sh);
        }
      }
    });
  }

  // 3D画面上の圧縮木箱を短タップで25枠ウィンドウを開く（ドラッグと誤爆させない）
  (function setupCrate3DTapListener() {
    if (typeof renderer === 'undefined' || !renderer || !renderer.domElement) return;
    const dom = renderer.domElement;
    if (dom.dataset.crateTapBound === '1') return;
    dom.dataset.crateTapBound = '1';

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0, downY = 0, downTime = 0;

    dom.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary) return;
      downX = e.clientX;
      downY = e.clientY;
      downTime = Date.now();
    }, { passive: true });

    dom.addEventListener('pointerup', (e) => {
      if (!e.isPrimary || !crateHitMeshes.length) return;
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      const dt = Date.now() - downTime;
      if (dist > 10 || dt > 380) return;

      // いずれかのモーダルが開いていれば無視
      const anyOpen = Array.from(document.querySelectorAll('.modal-overlay')).some(
        el => el.classList.contains('active') || (el.style.display && el.style.display !== 'none')
      );
      if (anyOpen) return;

      const cam = (typeof activeCamera !== 'undefined' && activeCamera) ? activeCamera : null;
      if (!cam) return;
      const rect = dom.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, cam);

      const hits = raycaster.intersectObjects(crateHitMeshes, false);
      if (hits.length > 0 && hits[0].object && hits[0].object.userData.crateId) {
        openCrateModal(hits[0].object.userData.crateId);
      }
    }, { passive: true });
  })();

  // --------------------------------------------------------------------------
  // 4. 物理アクション実装（掘削・回収・配置・圧縮木箱・装備・破棄・放物線投擲）
  // --------------------------------------------------------------------------
  function runTurnAroundOnly(dir, intendedVerb) {
    ROBOT.rotY = dir.rot;
    const dName = dir.name.replace('(斜め)', '');
    return {
      actionLabel: `🔄 背後(${dName})を振り返った（1ターン消費）`,
      physicalResult: `死角の背後(${dName})へ${intendedVerb}しようとしたため、まず${dName}の方へ振り返って向き直った`,
      moved: false
    };
  }

  function runLook(dir) {
    ROBOT.rotY = dir.rot;
    const dName = dir.name.replace('(斜め)', '');
    return {
      actionLabel: `👀 ${dName}の方を向いて見回した`,
      physicalResult: `移動せず${dName}の方へ体の向きを変えた`,
      moved: false
    };
  }

  function buildFrontRowCells(curAbsX, curAbsZ, dir, stats, thought) {
    const dx = Math.sign((dir && dir.dx) || 0);
    const dz = Math.sign((dir && dir.dz) || 0);
    const { minOff, maxOff } = getFootprintBounds(stats.reachW);
    const frontEdge = getFrontEdgeOffset(dx, dz, stats.reachW);
    const cells = [];

    if (dx === 0 && dz !== 0) {
      for (let ox = minOff; ox <= maxOff; ox++) cells.push({ absX: curAbsX + ox, absZ: curAbsZ + frontEdge.oz });
    } else if (dz === 0 && dx !== 0) {
      for (let oz = minOff; oz <= maxOff; oz++) cells.push({ absX: curAbsX + frontEdge.ox, absZ: curAbsZ + oz });
    } else {
      const px = -dz, pz = dx;
      for (let w = minOff; w <= maxOff; w++) {
        cells.push({ absX: curAbsX + frontEdge.ox + px * w, absZ: curAbsZ + frontEdge.oz + pz * w });
      }
    }

    const rx = -dz, rz = dx;
    const t = String(thought || '');
    const lateralScore = (c) => (c.absX - curAbsX) * rx + (c.absZ - curAbsZ) * rz;
    if (t.includes('左')) cells.sort((a, b) => lateralScore(a) - lateralScore(b));
    else if (t.includes('右')) cells.sort((a, b) => lateralScore(b) - lateralScore(a));
    else cells.sort((a, b) => Math.abs(lateralScore(a)) - Math.abs(lateralScore(b)));
    return cells;
  }

  function hasUnreachableUpperWallInFront(dir, stats) {
    const { absX: curAbsX, absZ: curAbsZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const frontCells = buildFrontRowCells(curAbsX, curAbsZ, dir, stats, '');
    for (let i = 0; i < frontCells.length; i++) {
      for (let h = stats.reachH; h <= 4; h++) {
        if (hasSolidTerrainAtAbsSubY(frontCells[i].absX, baseSubY + h, frontCells[i].absZ)) return true;
      }
    }
    return false;
  }

  // 体格範囲内の掘削対象を最大 maxCount 個まで列挙（体格リーチ厳守）
  function findDigTargetsInBodyRange(mode, dir, thought, maxCount = 1) {
    const stats = getSizeStats();
    const { absX: curAbsX, absZ: curAbsZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const targets = [];
    const seen = new Set();
    let hitWaterProtected = false;

    const tryPush = (absX, totalSubY, absZ, kindLabel) => {
      if (targets.length >= maxCount) return;
      const key = `${absX},${totalSubY},${absZ}`;
      if (seen.has(key)) return;
      if (!isInsideIslandAbs(absX, absZ)) return;
      const tX = absToTile(absX);
      const tZ = absToTile(absZ);
      const yInfo = subYToLvSy(totalSubY);
      if (!hasSolidTerrainSubVoxel(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) return;
      if (!isExposedToAir(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) return;
      if (isWaterProtectedCell(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) {
        hitWaterProtected = true;
        return;
      }
      seen.add(key);
      targets.push({
        tx: tX.tile, tz: tZ.tile, lv: yInfo.lv,
        tsx: tX.sub, tsy: yInfo.sy, tsz: tZ.sub,
        absX, absZ, totalSubY, kind: kindLabel
      });
    };

    if (mode === 'front') {
      const frontCells = buildFrontRowCells(curAbsX, curAbsZ, dir, stats, thought);
      for (let h = stats.reachH - 1; h >= 0 && targets.length < maxCount; h--) {
        for (let i = 0; i < frontCells.length && targets.length < maxCount; i++) {
          tryPush(frontCells[i].absX, baseSubY + h, frontCells[i].absZ, '壁');
        }
      }
    } else if (mode === 'down') {
      const t = String(thought || '');
      const preferUnderFeet = t.includes('真下') || t.includes('足元');
      const frontCells = buildFrontRowCells(curAbsX, curAbsZ, dir, stats, thought);
      const { minOff, maxOff } = getFootprintBounds(stats.reachW);
      const underCells = [];
      for (let ox = minOff; ox <= maxOff; ox++) {
        for (let oz = minOff; oz <= maxOff; oz++) {
          underCells.push({ absX: curAbsX + ox, absZ: curAbsZ + oz, dist: Math.abs(ox) + Math.abs(oz) });
        }
      }
      underCells.sort((a, b) => a.dist - b.dist);
      const groups = preferUnderFeet
        ? [{ list: underCells, label: '足元の床' }, { list: frontCells, label: '目の前の地面' }]
        : [{ list: frontCells, label: '目の前の地面' }, { list: underCells, label: '足元の床' }];
      for (let g = 0; g < groups.length && targets.length < maxCount; g++) {
        for (let i = 0; i < groups[g].list.length && targets.length < maxCount; i++) {
          tryPush(groups[g].list[i].absX, baseSubY - 1, groups[g].list[i].absZ, groups[g].label);
        }
      }
    } else if (mode === 'up') {
      const minCeilH = Math.max(1, stats.bodyHeight);
      const maxCeilH = stats.reachH;
      const { minOff, maxOff } = getFootprintBounds(stats.reachW);
      const topCells = [];
      for (let ox = minOff; ox <= maxOff; ox++) {
        for (let oz = minOff; oz <= maxOff; oz++) {
          topCells.push({ absX: curAbsX + ox, absZ: curAbsZ + oz, dist: Math.abs(ox) + Math.abs(oz) });
        }
      }
      topCells.sort((a, b) => a.dist - b.dist);
      for (let h = minCeilH; h <= maxCeilH && targets.length < maxCount; h++) {
        for (let i = 0; i < topCells.length && targets.length < maxCount; i++) {
          tryPush(topCells[i].absX, baseSubY + h, topCells[i].absZ, '頭上の天井');
        }
      }
    }

    return { targets, hitWaterProtected };
  }

  function describeRelativeDropPosition(ox, oz, heightDiff) {
    const basis = getFacingBasis();
    const fwd = ox * basis.fx + oz * basis.fz;
    const lat = ox * basis.rx + oz * basis.rz;
    let posLabel = '周囲';
    if (fwd > 0 && lat > 0) posLabel = '右前';
    else if (fwd > 0 && lat < 0) posLabel = '左前';
    else if (fwd > 0) posLabel = '前方';
    else if (fwd === 0 && lat > 0) posLabel = '右横';
    else if (fwd === 0 && lat < 0) posLabel = '左横';
    else if (fwd < 0 && lat > 0) posLabel = '右後ろ';
    else if (fwd < 0 && lat < 0) posLabel = '左後ろ';
    else if (fwd < 0) posLabel = '後ろ';
    return heightDiff > 0 ? `${posLabel}の${heightDiff}段上の床` : `${posLabel}の床`;
  }

  function findDropSlotForDugSoil(target, dir, stats) {
    const areaId = getCurAreaId();
    const { absX: rAbsX, absZ: rAbsZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const dx = Math.sign((dir && dir.dx) || 0);
    const dz = Math.sign((dir && dir.dz) || 0);
    const basis = getFacingBasis();

    function canPlaceOnFloor(tx, tz, floorY, ignoreMaxHeightOnDeepFall = false) {
      if (!isInsideIslandAbs(tx, tz)) return false;
      if (isCrateBlockingAtSubY(tx, floorY, tz, areaId)) return false;
      if (isInsideRobotFootprint(tx, tz, rAbsX, rAbsZ, stats.reachW) && Math.abs(floorY - baseSubY) <= stats.reachH) {
        return false;
      }
      const curStack = getLooseSoilAtFloor(tx, tz, floorY, areaId);
      const limit = ignoreMaxHeightOnDeepFall ? 10 : stats.maxStackHeight;
      if (curStack >= limit) return false;
      const placeY = floorY + curStack;
      if (hasSolidTerrainAtAbsSubY(tx, placeY, tz)) return false;
      if (isCrateBlockingAtSubY(tx, placeY, tz, areaId)) return false;
      return true;
    }

    if (!hasSolidTerrainAtAbsSubY(target.absX, target.totalSubY - 1, target.absZ)) {
      const fallFloorY = findFloorSubYBelow(target.absX, target.absZ, target.totalSubY - 1);
      const isDeepFall = (fallFloorY < baseSubY);
      if (canPlaceOnFloor(target.absX, target.absZ, fallFloorY, isDeepFall)) {
        return {
          absX: target.absX, absZ: target.absZ, floorSubY: fallFloorY,
          fellDown: isDeepFall, note: isDeepFall ? '下の空間の底へ落下した' : '真下の床へ落ちた'
        };
      }
    }

    if (dx !== 0 || dz !== 0) {
      const bx = target.absX + dx, bz = target.absZ + dz;
      if (isInsideIslandAbs(bx, bz) && !isCrateBlockingAtSubY(bx, target.totalSubY, bz, areaId) &&
          !hasSolidTerrainAtAbsSubY(bx, target.totalSubY, bz)) {
        const behindFloorY = findFloorSubYBelow(bx, bz, target.totalSubY);
        const isDeepFall = (behindFloorY < baseSubY);
        if (canPlaceOnFloor(bx, bz, behindFloorY, isDeepFall)) {
          return {
            absX: bx, absZ: bz, floorSubY: behindFloorY,
            fellDown: isDeepFall, note: isDeepFall ? '奥の空間から底まで落下した' : '奥の空き空間へ転がり落ちた'
          };
        }
      }
    }

    const { minOff, maxOff } = getFootprintBounds(stats.reachW);
    const minSearch = minOff - stats.reachW;
    const maxSearch = maxOff + stats.reachW;
    const candidates = [];

    for (let ox = minSearch; ox <= maxSearch; ox++) {
      for (let oz = minSearch; oz <= maxSearch; oz++) {
        const tx = rAbsX + ox, tz = rAbsZ + oz;
        if (!isInsideIslandAbs(tx, tz)) continue;
        if (isInsideRobotFootprint(tx, tz, rAbsX, rAbsZ, stats.reachW)) continue;
        if (tx === target.absX && tz === target.absZ) continue;

        let chosenFloorY = null;
        for (let h = 0; h <= stats.reachH; h++) {
          const yCheck = baseSubY + h;
          if (!hasSolidTerrainAtAbsSubY(tx, yCheck, tz) &&
              !isCrateBlockingAtSubY(tx, yCheck, tz, areaId) &&
              hasSolidTerrainAtAbsSubY(tx, yCheck - 1, tz)) {
            chosenFloorY = yCheck;
            break;
          }
        }
        if (chosenFloorY === null) continue;
        const stack = getLooseSoilAtFloor(tx, tz, chosenFloorY, areaId);
        if (stack >= stats.maxStackHeight) continue;
        if (hasSolidTerrainAtAbsSubY(tx, chosenFloorY + stack, tz)) continue;
        if (isCrateBlockingAtSubY(tx, chosenFloorY + stack, tz, areaId)) continue;

        const dist = Math.max(Math.abs(ox), Math.abs(oz));
        const heightDiff = chosenFloorY - baseSubY;
        const fwdDot = ox * basis.fx + oz * basis.fz;
        const rearPenalty = fwdDot < 0 ? 1.5 : 0;
        candidates.push({ absX: tx, absZ: tz, ox, oz, floorSubY: chosenFloorY, stack, dist, heightDiff, rearPenalty });
      }
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) =>
      (a.heightDiff * 3.0 + a.stack * 2.0 + a.rearPenalty + a.dist * 0.4) -
      (b.heightDiff * 3.0 + b.stack * 2.0 + b.rearPenalty + b.dist * 0.4)
    );
    const chosen = candidates[0];
    return {
      absX: chosen.absX, absZ: chosen.absZ, floorSubY: chosen.floorSubY,
      fellDown: false, note: `${describeRelativeDropPosition(chosen.ox, chosen.oz, chosen.heightDiff)}へ散らばった`
    };
  }

  function runSubDigByMode(mode, dir, thought) {
    if (mode !== 'up' && isBehindCurrentFacing(dir)) {
      return runTurnAroundOnly(dir, mode === 'down' ? '地面掘削' : '壁掘削');
    }

    // 手枠ルール判定（空＝1個／スコップ1本＝体格範囲内で最大5個／スコップ2本＆土所持中は掘削不可）
    const hand = DIG_STATE.equip && DIG_STATE.equip.hand;
    let digQuota = 1;
    let toolLabel = '素手';
    if (hand && hand.count > 0) {
      if (hand.id === 'shovel' && hand.count === 1) {
        digQuota = 5;
        toolLabel = 'スコップ1本';
      } else if (hand.id === 'shovel' && hand.count >= 2) {
        return {
          actionLabel: '🚫 スコップ2本持ちのため両手が塞がり掘れなかった',
          physicalResult: '手枠にスコップを2本持っていて両手が塞がっているため掘削できなかった（1本だけ持つか素手にする必要がある）',
          moved: false
        };
      } else {
        const m = ITEM_META[hand.id] || { name: hand.id };
        return {
          actionLabel: `🚫 手枠に${m.name}を持っているため掘れなかった`,
          physicalResult: `手枠に${m.name}(${hand.count}個)を持っていて手が塞がっているため掘削できなかった`,
          moved: false
        };
      }
    }

    if (mode !== 'up' && dir && Number.isFinite(dir.rot)) ROBOT.rotY = dir.rot;
    const dName = (dir && dir.name) ? dir.name.replace('(斜め)', '') : '正面';
    const stats = getSizeStats();
    const { targets, hitWaterProtected } = findDigTargetsInBodyRange(mode, dir, thought, digQuota);

    if (!targets.length) {
      if (hitWaterProtected) {
        return {
          actionLabel: '🛡️ 島の外周（水際の保護壁）は削れなかった',
          physicalResult: 'そこは島の外周（水際の保護壁）のため削れなかった',
          moved: false
        };
      }
      if (mode === 'front') {
        if (hasUnreachableUpperWallInFront(dir, stats)) {
          const reachLabel = stats.reachH === 1 ? '高1' : `高1〜${stats.reachH}`;
          return {
            actionLabel: `⛏️ ${dName}の上部壁(高${stats.reachH + 1}以上)には背が届かず空振りした`,
            physicalResult: `${dName}方向の目の前距離1は自分の届く高さ(${reachLabel})が既に空洞で、上部の壁(高${stats.reachH + 1}以上)には背が届かず空振りした`,
            moved: false
          };
        }
        return {
          actionLabel: `⛏️ ${dName}の正面壁を削ろうとしたが空振りした`,
          physicalResult: `${dName}方向の目の前距離1に削れる壁がなく空振りした`,
          moved: false
        };
      }
      if (mode === 'down') {
        return {
          actionLabel: `⛏️ ${dName}の地面を削ろうとしたが空振りした`,
          physicalResult: `${dName}方向の目の前および足元に削れる地面ブロックがなく空振りした`,
          moved: false
        };
      }
      return {
        actionLabel: '⛏️ 頭上の天井を削ろうとしたが空振りした',
        physicalResult: '頭上の届く高さに削れる天井ブロックがなく空振りした',
        moved: false
      };
    }

    const areaId = getCurAreaId();
    let dugCount = 0;
    let stoppedByFull = false;
    let lastDropNote = '';
    let lastKind = targets[0].kind;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const dropPos = findDropSlotForDugSoil(target, dir, stats);
      if (!dropPos) {
        stoppedByFull = true;
        break;
      }

      const chipKey = `${target.tx},${target.tz},${target.lv}`;
      const tag = `${target.tsx},${target.tsy},${target.tsz}`;
      if (typeof CHIP_MAP !== 'undefined') {
        if (!CHIP_MAP[chipKey]) CHIP_MAP[chipKey] = {};
        CHIP_MAP[chipKey][tag] = true;
      }
      const stateKey = `${areaId}|${chipKey}`;
      if (!DIG_STATE.dugCells[stateKey]) DIG_STATE.dugCells[stateKey] = [];
      if (!DIG_STATE.dugCells[stateKey].includes(tag)) DIG_STATE.dugCells[stateKey].push(tag);

      settleFloatingLooseSoilsAtColumn(target.absX, target.absZ, areaId);
      addLooseSoilAtFloor(dropPos.absX, dropPos.absZ, dropPos.floorSubY, 1, areaId);
      lastDropNote = dropPos.note;
      lastKind = target.kind;
      dugCount++;
    }

    if (dugCount <= 0) {
      return {
        actionLabel: '🧱 周囲の土が満杯で掘れなかった（片付けが必要）',
        physicalResult: `${lastKind}を削ろうとしたが、周囲の床がすべて積み上限(${stats.maxStackHeight}段)まで埋まっており置き場がないため掘れなかった`,
        moved: false
      };
    }

    let fallText = '';
    if (mode === 'down') {
      const { absX: rAbsX, absZ: rAbsZ } = getRobotAbsPos();
      const curBaseY = getRobotBaseSubY();
      const support = computeSupportedFloorUnderFootprint(rAbsX, rAbsZ, curBaseY, stats.reachW);
      if (support.fell) {
        const dropDist = curBaseY - support.landingSubY;
        ROBOT.pos.subY = support.landingSubY;
        ROBOT.pos.lv = floorSubYToRobotLv(support.landingSubY);
        fallText = `。足元の支えがなくなったため下の空間へ${dropDist}分割落下した`;
      }
    }

    life.stamina = Math.max(0, life.stamina - (dugCount > 1 ? 6 : 4));
    life.mental = Math.min(100, life.mental + 4);
    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    saveDigState();

    const dirPrefix = (mode === 'up' || lastKind === '足元の床') ? '' : `${dName}の`;
    const fullNote = stoppedByFull ? '（途中で周囲が満杯になり停止）' : '';
    return {
      actionLabel: `⛏️ ${toolLabel}で${dirPrefix}${lastKind}を${dugCount}分割削った${fullNote}`,
      physicalResult: `${toolLabel}で体格範囲内の${dirPrefix}${lastKind}を${dugCount}分割削り、土は${lastDropNote}${fullNote}${fallText}`,
      moved: false
    };
  }

  function findNearbyLooseSoilStacks(radiusSub = 3) {
    const areaId = getCurAreaId();
    const { absX, absZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const stats = getSizeStats();
    const hits = [];
    Object.keys(DIG_STATE.worldSubSoils).forEach(k => {
      const cnt = DIG_STATE.worldSubSoils[k] || 0;
      if (cnt <= 0) return;
      const p = parseSoilKey(k);
      if (!p || p.areaId !== areaId) return;
      const floorY = (p.floorSubY !== null) ? p.floorSubY : getTerrainColumnTopSubY(p.absX, p.absZ);
      if (floorY < baseSubY - 1 || floorY > baseSubY + stats.reachH) return;
      const dist = Math.max(Math.abs(p.absX - absX), Math.abs(p.absZ - absZ));
      if (dist <= radiusSub) hits.push({ key: k, absX: p.absX, absZ: p.absZ, floorSubY: floorY, cnt, dist });
    });
    hits.sort((a, b) => a.dist - b.dist);
    return hits;
  }

  function findNearbyDroppedItems(radiusSub = 3, filterId = '') {
    const areaId = getCurAreaId();
    const { absX, absZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const stats = getSizeStats();
    const hits = [];
    (DIG_STATE.worldDroppedItems || []).forEach(it => {
      if (it.areaId !== areaId || it.count <= 0) return;
      if (filterId && it.id !== filterId) return;
      if (it.floorSubY < baseSubY - 1 || it.floorSubY > baseSubY + stats.reachH) return;
      const dist = Math.max(Math.abs(it.absX - absX), Math.abs(it.absZ - absZ));
      if (dist <= radiusSub) hits.push({ ref: it, dist });
    });
    hits.sort((a, b) => a.dist - b.dist);
    return hits;
  }

  function runPickup(itemFilter = '') {
    const stats = getSizeStats();
    const areaId = getCurAreaId();
    const { absX, absZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const searchRadius = Math.max(3, Math.floor(stats.reachW / 2) + 2);

    // 1) スコップ等の落ちている道具を優先判定（itemFilter==="shovel" または 指定なし時に近くにあれば回収）
    const nearbyTools = (itemFilter !== 'soil') ? findNearbyDroppedItems(searchRadius, itemFilter === 'shovel' ? 'shovel' : '') : [];
    let pickedShovel = 0;
    if (nearbyTools.length && (itemFilter === 'shovel' || !itemFilter)) {
      let room = getMaxAddableShovelsToPocket();
      for (let i = 0; i < nearbyTools.length && room > 0; i++) {
        const it = nearbyTools[i].ref;
        if (it.id !== 'shovel') continue;
        const take = Math.min(it.count, room);
        if (take > 0) {
          it.count -= take;
          DIG_STATE.pocket.shovel = (DIG_STATE.pocket.shovel || 0) + take;
          pickedShovel += take;
          room -= take;
        }
      }
      DIG_STATE.worldDroppedItems = (DIG_STATE.worldDroppedItems || []).filter(it => it.count > 0);
      if (pickedShovel > 0 && itemFilter === 'shovel') {
        life.stamina = Math.max(0, life.stamina - 2);
        saveDigState();
        return {
          actionLabel: `🪏 地面のスコップを${pickedShovel}本ポケットへ拾った`,
          physicalResult: `周囲の地面からスコップを${pickedShovel}本拾ってポケットへ入れた（ポケット内スコップ計${DIG_STATE.pocket.shovel}本）`,
          moved: false
        };
      }
    }

    // 2) 土の回収（ポケット＋手枠の資源合計上限まで→超過分は頭上ピラミッドへ）
    const nearbySoil = (itemFilter !== 'shovel') ? findNearbyLooseSoilStacks(searchRadius) : [];
    if (!nearbySoil.length && pickedShovel <= 0) {
      return {
        actionLabel: '🟫 すぐそばに拾える土や道具がなかった',
        physicalResult: '手の届く周囲に散らばった土も落ちた道具もなく、何も拾えなかった',
        moved: false
      };
    }

    const maxPerTurn = Math.max(3, stats.reachW * 2);
    const clearance = getCeilingClearanceSubAt(absX, absZ, baseSubY, stats.reachW);
    let pickedPocket = 0;
    let pickedHead   = 0;
    let blockedByCeiling = false;
    let blockedByCrawl   = false;

    for (let i = 0; i < nearbySoil.length && (pickedPocket + pickedHead) < maxPerTurn; i++) {
      let avail = nearbySoil[i].cnt;
      const pSpace = Math.max(0, stats.pocketCap - getCarriedResourceTotal());
      if (pSpace > 0 && avail > 0) {
        const takeP = Math.min(avail, pSpace, maxPerTurn - (pickedPocket + pickedHead));
        if (takeP > 0) {
          addLooseSoilAtFloor(nearbySoil[i].absX, nearbySoil[i].absZ, nearbySoil[i].floorSubY, -takeP, areaId);
          DIG_STATE.pocket.soil = (DIG_STATE.pocket.soil || 0) + takeP;
          pickedPocket += takeP;
          avail -= takeP;
        }
      }
      while (avail > 0 && (pickedPocket + pickedHead) < maxPerTurn) {
        const curHead = DIG_STATE.headSoil || 0;
        if (curHead >= stats.headCap) break;
        if (ROBOT.posture === 'crawl') { blockedByCrawl = true; break; }
        const nextLayers = getHeadStackHeight(curHead + 1, stats.reachW);
        if (stats.bodyHeight + nextLayers > clearance) { blockedByCeiling = true; break; }
        addLooseSoilAtFloor(nearbySoil[i].absX, nearbySoil[i].absZ, nearbySoil[i].floorSubY, -1, areaId);
        DIG_STATE.headSoil = curHead + 1;
        pickedHead += 1;
        avail -= 1;
      }
    }

    const totalPicked = pickedPocket + pickedHead + pickedShovel;
    if (totalPicked <= 0) {
      if (blockedByCrawl) {
        return {
          actionLabel: '🟫 ほふく姿勢中のため頭上へ積めなかった',
          physicalResult: 'ポケットが資源上限で、ほふく姿勢中のため頭上ピラミッドへ積めなかった',
          moved: false
        };
      }
      if (blockedByCeiling) {
        return {
          actionLabel: `🟫 天井が低く頭上に載せられなかった(空き${clearance}段)`,
          physicalResult: `ポケットが資源上限で、天井の空き(${clearance}分割)が足りないため頭上ピラミッドへ積めなかった`,
          moved: false
        };
      }
      return {
        actionLabel: `🟫 ポケット(${getCarriedResourceTotal()}/${stats.pocketCap})も頭上(${DIG_STATE.headSoil}/${stats.headCap})も満杯`,
        physicalResult: 'ポケットも頭上ピラミッドも上限に達しており、これ以上拾えなかった',
        moved: false
      };
    }

    ROBOT.pos.subY = computeExactFootSubYAt(absX, absZ, baseSubY, stats.reachW);
    ROBOT.pos.lv = floorSubYToRobotLv(ROBOT.pos.subY);
    life.stamina = Math.max(0, life.stamina - 2);
    ROBOT.params.logic = Math.min(100, (ROBOT.params.logic || 50) + 2);
    saveDigState();

    const parts = [];
    if (pickedShovel > 0) parts.push(`スコップ+${pickedShovel}本`);
    if (pickedPocket > 0) parts.push(`ポケット土+${pickedPocket}`);
    if (pickedHead > 0) parts.push(`頭上土+${pickedHead}`);
    const newHeadLayers = getHeadStackHeight(DIG_STATE.headSoil || 0, stats.reachW);
    return {
      actionLabel: `🧺 回収した(${parts.join('・')})`,
      physicalResult: `周囲から回収した(${parts.join('、')})。現在ポケット資源${getCarriedResourceTotal()}/${stats.pocketCap}、頭上${DIG_STATE.headSoil}/${stats.headCap}(+${newHeadLayers}段)`,
      moved: false
    };
  }

  function runPlaceSoil(dir) {
    if (isBehindCurrentFacing(dir)) return runTurnAroundOnly(dir, '土の配置');

    const hasHead   = (DIG_STATE.headSoil || 0) > 0;
    const hasHand   = DIG_STATE.equip.hand && DIG_STATE.equip.hand.id === 'soil' && DIG_STATE.equip.hand.count > 0;
    const hasPocket = (DIG_STATE.pocket.soil || 0) > 0;
    if (!hasHead && !hasHand && !hasPocket) {
      return {
        actionLabel: '🟫 置く土が手元にも頭上にもなかった',
        physicalResult: 'ポケット・手枠・頭上のいずれにも土がなく、置けなかった',
        moved: false
      };
    }

    ROBOT.rotY = dir.rot;
    const dName = dir.name.replace('(斜め)', '');
    const areaId = getCurAreaId();
    const { absX, absZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const stats = getSizeStats();
    const dx = Math.sign(dir.dx || 0), dz = Math.sign(dir.dz || 0);
    const frontEdge = getFrontEdgeOffset(dx, dz, stats.reachW);
    const tx = absX + frontEdge.ox, tz = absZ + frontEdge.oz;

    if (!isInsideIslandAbs(tx, tz) || isCrateBlockingAtSubY(tx, baseSubY, tz, areaId)) {
      return {
        actionLabel: `🟫 ${dName}には置けなかった`,
        physicalResult: `${dName}の目の前は島の端または圧縮木箱のため土を置けなかった`,
        moved: false
      };
    }

    const floorY = findFloorSubYBelow(tx, tz, baseSubY + stats.reachH + 1);
    if (floorY > baseSubY + stats.reachH) {
      return {
        actionLabel: `🟫 ${dName}は壁で塞がっており置けない`,
        physicalResult: `${dName}の目の前は固体ブロックで塞がっており土を置けなかった`,
        moved: false
      };
    }

    const curStack = getLooseSoilAtFloor(tx, tz, floorY, areaId);
    const isDeepDrop = (floorY < baseSubY);
    if (!isDeepDrop && curStack >= stats.maxStackHeight) {
      return {
        actionLabel: `🟫 積み上げ上限(${stats.maxStackHeight}段)でこれ以上積めない`,
        physicalResult: `${dName}の目の前は既に${curStack}段積まれており、積み上限(${stats.maxStackHeight}段)のため置けなかった`,
        moved: false
      };
    }
    if (hasSolidTerrainAtAbsSubY(tx, floorY + curStack, tz) || isCrateBlockingAtSubY(tx, floorY + curStack, tz, areaId)) {
      return {
        actionLabel: `🟫 ${dName}は壁・天井で塞がっており置けない`,
        physicalResult: `${dName}の目の前は壁・天井・圧縮木箱で塞がっており置けなかった`,
        moved: false
      };
    }

    let fromLabel = '';
    if (hasHead) {
      DIG_STATE.headSoil -= 1;
      fromLabel = '頭上から';
    } else if (hasHand) {
      DIG_STATE.equip.hand.count -= 1;
      if (DIG_STATE.equip.hand.count <= 0) DIG_STATE.equip.hand = null;
      fromLabel = '手枠から';
    } else {
      DIG_STATE.pocket.soil -= 1;
      fromLabel = 'ポケットから';
    }

    addLooseSoilAtFloor(tx, tz, floorY, 1, areaId);
    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    saveDigState();

    const stackNow = getLooseSoilAtFloor(tx, tz, floorY, areaId);
    const dropNote = isDeepDrop ? '下の空間の底へ落ちた' : `高さ${stackNow}/${stats.maxStackHeight}段になった`;
    return {
      actionLabel: `🟫 ${fromLabel}${dName}へ土を1個置いた(${isDeepDrop ? '底へ落下' : `積${stackNow}/${stats.maxStackHeight}段`})`,
      physicalResult: `${fromLabel}${dName}の目の前へ土を1個そっと置き、${dropNote}`,
      moved: false
    };
  }

  function findNearbyCrate() {
    const areaId = getCurAreaId();
    const { absX, absZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const stats = getSizeStats();
    const { minOff, maxOff } = getFootprintBounds(stats.reachW);
    const rMinX = absX + minOff, rMaxX = absX + maxOff;
    const rMinZ = absZ + minOff, rMaxZ = absZ + maxOff;

    return DIG_STATE.crates.find(c => {
      if (c.areaId !== areaId) return false;
      const cMinX = c.x * 5, cMaxX = c.x * 5 + 4;
      const cMinZ = c.z * 5, cMaxZ = c.z * 5 + 4;
      const gapX = Math.max(0, cMinX - rMaxX, rMinX - cMaxX);
      const gapZ = Math.max(0, cMinZ - rMaxZ, rMinZ - cMaxZ);
      if (Math.max(gapX, gapZ) > 1) return false;
      const cBaseY = getCrateBaseSubY(c);
      return (baseSubY + stats.reachH >= cBaseY) && (baseSubY <= cBaseY + 5);
    }) || null;
  }

  // 圧縮木箱へ収納（頭上ピラミッドの土も「土」として加算・ピラミッドアイコンは木箱内に作らない）
  function runStoreCrate(itemSpec = '') {
    const crate = findNearbyCrate();
    if (!crate) {
      return {
        actionLabel: '📦 手が届くすぐ隣に圧縮木箱がなかった',
        physicalResult: '手が届くすぐ隣（距離1分割以内・同じ高さ）に圧縮木箱がなく、収納できなかった',
        moved: false
      };
    }

    const target = (itemSpec === 'shovel' || itemSpec === 'soil') ? itemSpec : 'all';
    let movedSoil = 0;
    let movedShovel = 0;

    if (target === 'all' || target === 'soil') {
      // 頭上 → ポケット → 手枠の土 の順で圧縮木箱へ「土」として加算
      const hSoil = DIG_STATE.headSoil || 0;
      if (hSoil > 0) {
        const a = addItemToCrate(crate, 'soil', hSoil);
        DIG_STATE.headSoil -= a;
        movedSoil += a;
      }
      const pSoil = DIG_STATE.pocket.soil || 0;
      if (pSoil > 0) {
        const a = addItemToCrate(crate, 'soil', pSoil);
        DIG_STATE.pocket.soil -= a;
        movedSoil += a;
      }
      if (DIG_STATE.equip.hand && DIG_STATE.equip.hand.id === 'soil' && DIG_STATE.equip.hand.count > 0) {
        const a = addItemToCrate(crate, 'soil', DIG_STATE.equip.hand.count);
        DIG_STATE.equip.hand.count -= a;
        if (DIG_STATE.equip.hand.count <= 0) DIG_STATE.equip.hand = null;
        movedSoil += a;
      }
    }

    if (target === 'shovel' || (target === 'all' && movedSoil === 0)) {
      const pShovel = DIG_STATE.pocket.shovel || 0;
      if (pShovel > 0) {
        const a = addItemToCrate(crate, 'shovel', pShovel);
        DIG_STATE.pocket.shovel -= a;
        movedShovel += a;
      }
      if (target === 'shovel' && DIG_STATE.equip.hand && DIG_STATE.equip.hand.id === 'shovel' && DIG_STATE.equip.hand.count > 0) {
        const a = addItemToCrate(crate, 'shovel', DIG_STATE.equip.hand.count);
        DIG_STATE.equip.hand.count -= a;
        if (DIG_STATE.equip.hand.count <= 0) DIG_STATE.equip.hand = null;
        movedShovel += a;
      }
    }

    if (movedSoil <= 0 && movedShovel <= 0) {
      return {
        actionLabel: '📦 圧縮木箱へ入れられるアイテムがないか満杯だった',
        physicalResult: `圧縮木箱へ収納できる対象アイテムがないか、25枠が満杯だった（現在:${summarizeCrateContents(crate)}）`,
        moved: false
      };
    }

    ROBOT.params.logic = Math.min(100, (ROBOT.params.logic || 50) + 3);
    life.mental = Math.min(100, life.mental + 6);
    saveDigState();

    const parts = [];
    if (movedSoil > 0) parts.push(`土${movedSoil}個`);
    if (movedShovel > 0) parts.push(`スコップ${movedShovel}本`);
    return {
      actionLabel: `📦 圧縮木箱へ収納(${parts.join('・')})`,
      physicalResult: `圧縮木箱へ${parts.join('と')}を収納した（木箱状態:${summarizeCrateContents(crate)}）`,
      moved: false
    };
  }

  // 圧縮木箱から取り出し：一旦ポケットの空き上限までまとめて取り出す（自動装備なし）
  function runTakeCrate(itemSpec = '') {
    const crate = findNearbyCrate();
    if (!crate) {
      return {
        actionLabel: '📦 手が届くすぐ隣に圧縮木箱がなかった',
        physicalResult: '手が届くすぐ隣（距離1分割以内）に圧縮木箱がなく、取り出せなかった',
        moved: false
      };
    }

    const stats = getSizeStats();
    let itemId = (itemSpec === 'shovel' || itemSpec === 'soil') ? itemSpec : '';
    if (!itemId) {
      if (countItemInCrate(crate, 'shovel') > 0) itemId = 'shovel';
      else if (countItemInCrate(crate, 'soil') > 0) itemId = 'soil';
    }
    if (!itemId || countItemInCrate(crate, itemId) <= 0) {
      return {
        actionLabel: '📦 圧縮木箱に指定のアイテムが入っていなかった',
        physicalResult: `圧縮木箱の中に指定アイテムがなかった（現在:${summarizeCrateContents(crate)}）`,
        moved: false
      };
    }

    if (itemId === 'shovel') {
      const avail = countItemInCrate(crate, 'shovel');
      const room = getMaxAddableShovelsToPocket();
      if (room <= 0) {
        return {
          actionLabel: '📦 ポケット9枠が満杯でスコップを取り出せなかった',
          physicalResult: 'ポケット9枠に空きがなく、圧縮木箱からスコップを取り出せなかった',
          moved: false
        };
      }
      const take = removeItemFromCrate(crate, 'shovel', Math.min(avail, room));
      DIG_STATE.pocket.shovel = (DIG_STATE.pocket.shovel || 0) + take;
      saveDigState();
      return {
        actionLabel: `📦 圧縮木箱からスコップ${take}本をポケットへ取り出した`,
        physicalResult: `圧縮木箱からスコップ${take}本をポケットへ取り出した（ポケット内スコップ${DIG_STATE.pocket.shovel}本・まだ手には装備していない）`,
        moved: false
      };
    }

    // 土（ポケットの資源空き上限までまとめて取り出す）
    const avail = countItemInCrate(crate, 'soil');
    const room = Math.max(0, stats.pocketCap - getCarriedResourceTotal());
    if (room <= 0) {
      return {
        actionLabel: `📦 ポケットの資源上限(${stats.pocketCap})で土を取り出せなかった`,
        physicalResult: `ポケットが資源上限(${getCarriedResourceTotal()}/${stats.pocketCap})に達しており、圧縮木箱から土を取り出せなかった`,
        moved: false
      };
    }
    const take = removeItemFromCrate(crate, 'soil', Math.min(avail, room));
    DIG_STATE.pocket.soil = (DIG_STATE.pocket.soil || 0) + take;
    saveDigState();
    return {
      actionLabel: `📦 圧縮木箱から土${take}個をポケットへ取り出した`,
      physicalResult: `圧縮木箱から土${take}個をポケットの空き上限までまとめて取り出した（ポケット土${DIG_STATE.pocket.soil}個）`,
      moved: false
    };
  }

  // 手枠への自由な装備・取り外し（ポケットと手枠を移動・自動補充なし）
  function runEquipHand(itemSpec = '', reqCount = 0) {
    const stats = getSizeStats();
    const curHand = DIG_STATE.equip.hand;

    // まず現在手枠にあるものをポケットへ戻すヘルパー
    function unequipHandToPocket() {
      if (!DIG_STATE.equip.hand || !DIG_STATE.equip.hand.count) return '';
      const h = DIG_STATE.equip.hand;
      if (h.id === 'shovel') {
        DIG_STATE.pocket.shovel = (DIG_STATE.pocket.shovel || 0) + h.count;
        DIG_STATE.equip.hand = null;
        return `スコップ${h.count}本をポケットへ戻した`;
      }
      if (h.id === 'soil') {
        DIG_STATE.pocket.soil = (DIG_STATE.pocket.soil || 0) + h.count;
        DIG_STATE.equip.hand = null;
        return `土${h.count}個をポケットへ戻した`;
      }
      DIG_STATE.equip.hand = null;
      return '';
    }

    // 取り外し指定（item==="none" または 空指定で既に何か持っている時）
    if (itemSpec === 'none' || (!itemSpec && curHand)) {
      if (!curHand || !curHand.count) {
        return {
          actionLabel: '🖐️ 手枠はすでに空だった',
          physicalResult: '手枠には何も装備していなかった',
          moved: false
        };
      }
      const msg = unequipHandToPocket();
      saveDigState();
      return {
        actionLabel: `🖐️ 手枠を外して素手になった(${msg})`,
        physicalResult: `${msg}。現在手枠は空（素手）になった`,
        moved: false
      };
    }

    const targetId = (itemSpec === 'shovel' || itemSpec === 'soil')
      ? itemSpec
      : ((DIG_STATE.pocket.shovel || 0) > 0 ? 'shovel' : ((DIG_STATE.pocket.soil || 0) > 0 ? 'soil' : ''));

    if (!targetId) {
      return {
        actionLabel: '🖐️ ポケットに装備できるアイテムがなかった',
        physicalResult: 'ポケットにスコップも土もなく、手枠へ装備できなかった',
        moved: false
      };
    }

    // 現在の手枠を一旦ポケットへ戻してから希望本数・個数を再装備（排他1種類ルール）
    const prevMsg = unequipHandToPocket();

    if (targetId === 'shovel') {
      const avail = DIG_STATE.pocket.shovel || 0;
      if (avail <= 0) {
        saveDigState();
        return {
          actionLabel: '🖐️ ポケットにスコップがなかった',
          physicalResult: 'ポケットにスコップが入っておらず手枠へ持てなかった',
          moved: false
        };
      }
      const want = (reqCount > 0) ? Math.min(reqCount, stats.handShovelMax) : 1;
      const take = Math.min(avail, want);
      DIG_STATE.pocket.shovel -= take;
      DIG_STATE.equip.hand = { id: 'shovel', count: take };
      saveDigState();
      const digNote = take === 1 ? '（掘削は体格範囲内で最大5個）' : '（2本持ちのため掘削不可・2本投擲可）';
      return {
        actionLabel: `🪏 手枠にスコップを${take}本装備した`,
        physicalResult: `${prevMsg ? prevMsg + '後、' : ''}ポケットから手枠へスコップを${take}本装備した${digNote}（ポケット残り${DIG_STATE.pocket.shovel}本）`,
        moved: false
      };
    }

    // 土を手枠へ移す（高さ分：極小1〜巨大5、ポケット枠の個数を消費）
    const availSoil = DIG_STATE.pocket.soil || 0;
    if (availSoil <= 0) {
      saveDigState();
      return {
        actionLabel: '🖐️ ポケットに土がなかった',
        physicalResult: 'ポケットに土が入っておらず手枠へ持てなかった',
        moved: false
      };
    }
    const want = (reqCount > 0) ? Math.min(reqCount, stats.handSoilMax) : Math.min(availSoil, stats.handSoilMax);
    const take = Math.min(availSoil, want);
    DIG_STATE.pocket.soil -= take;
    DIG_STATE.equip.hand = { id: 'soil', count: take };
    saveDigState();
    return {
      actionLabel: `🟫 手枠に土を${take}個持った（上限${stats.handSoilMax}）`,
      physicalResult: `${prevMsg ? prevMsg + '後、' : ''}ポケットから手枠へ土を${take}個移して持った（手が塞がるため掘削不可・${take}個一括投擲可、ポケット土残り${DIG_STATE.pocket.soil}個）`,
      moved: false
    };
  }

  // 周囲の地面へアイテムを捨てる
  function runDropItem(itemSpec = '', reqCount = 1) {
    const areaId = getCurAreaId();
    const { absX, absZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const stats = getSizeStats();

    let targetId = (itemSpec === 'shovel' || itemSpec === 'soil') ? itemSpec : '';
    if (!targetId) {
      if ((DIG_STATE.pocket.shovel || 0) > 0 || (DIG_STATE.equip.hand && DIG_STATE.equip.hand.id === 'shovel')) targetId = 'shovel';
      else if ((DIG_STATE.pocket.soil || 0) > 0 || (DIG_STATE.equip.hand && DIG_STATE.equip.hand.id === 'soil')) targetId = 'soil';
    }
    if (!targetId) {
      return {
        actionLabel: '🗑️ 捨てるアイテムを持っていなかった',
        physicalResult: 'ポケットにも手枠にも捨てられるアイテムがなかった',
        moved: false
      };
    }

    const want = Math.max(1, reqCount || 1);

    if (targetId === 'shovel') {
      let dropped = 0;
      const fromPocket = Math.min(DIG_STATE.pocket.shovel || 0, want);
      if (fromPocket > 0) {
        DIG_STATE.pocket.shovel -= fromPocket;
        dropped += fromPocket;
      }
      if (dropped < want && DIG_STATE.equip.hand && DIG_STATE.equip.hand.id === 'shovel') {
        const fromHand = Math.min(DIG_STATE.equip.hand.count, want - dropped);
        DIG_STATE.equip.hand.count -= fromHand;
        if (DIG_STATE.equip.hand.count <= 0) DIG_STATE.equip.hand = null;
        dropped += fromHand;
      }
      if (dropped <= 0) {
        return {
          actionLabel: '🗑️ 捨てるスコップを持っていなかった',
          physicalResult: 'スコップを持っておらず捨てられなかった',
          moved: false
        };
      }
      const floorY = findFloorSubYBelow(absX, absZ, baseSubY + 1);
      addDroppedTool('shovel', absX, absZ, floorY, dropped, areaId);
      saveDigState();
      return {
        actionLabel: `🗑️ スコップを${dropped}本足元へ捨てた`,
        physicalResult: `スコップを${dropped}本足元の地面へ捨てた（通り抜け可・後から回収可能）`,
        moved: false
      };
    }

    // 土を周囲へ捨てる（1個ずつ空き床へ）
    let dropped = 0;
    for (let i = 0; i < want; i++) {
      const hasP = (DIG_STATE.pocket.soil || 0) > 0;
      const hasH = DIG_STATE.equip.hand && DIG_STATE.equip.hand.id === 'soil' && DIG_STATE.equip.hand.count > 0;
      if (!hasP && !hasH) break;
      const slot = findDropSlotForDugSoil({ absX, absZ, totalSubY: baseSubY }, null, stats);
      if (!slot) break;
      if (hasP) DIG_STATE.pocket.soil -= 1;
      else {
        DIG_STATE.equip.hand.count -= 1;
        if (DIG_STATE.equip.hand.count <= 0) DIG_STATE.equip.hand = null;
      }
      addLooseSoilAtFloor(slot.absX, slot.absZ, slot.floorSubY, 1, areaId);
      dropped++;
    }
    if (dropped <= 0) {
      return {
        actionLabel: '🗑️ 土を捨てられなかった（手持ちなし・周囲満杯）',
        physicalResult: '捨てられる土がないか周囲の床が満杯で捨てられなかった',
        moved: false
      };
    }
    saveDigState();
    return {
      actionLabel: `🗑️ 土を${dropped}個周囲へ捨てた`,
      physicalResult: `土を${dropped}個周囲の床へ捨てた`,
      moved: false
    };
  }

  // 放物線投げ＋転がり物理（手枠の装備分を一気に投げる・頭上ピラミッド保持時は不可）
  function findSafeSoilLandingNearRobot(rAbsX, rAbsZ, baseSubY, dx, dz, stats, areaId) {
    const frontEdge = getFrontEdgeOffset(dx, dz, stats.reachW);
    const rx = -dz, rz = dx;
    const candidates = [
      { x: rAbsX + frontEdge.ox, z: rAbsZ + frontEdge.oz, label: '自分の1マス手前' },
      { x: rAbsX + rx, z: rAbsZ + rz, label: '足元の横' },
      { x: rAbsX - rx, z: rAbsZ - rz, label: '足元の横' },
      { x: rAbsX + frontEdge.ox + rx, z: rAbsZ + frontEdge.oz + rz, label: '手前の横' },
      { x: rAbsX + frontEdge.ox - rx, z: rAbsZ + frontEdge.oz - rz, label: '手前の横' }
    ];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (!isInsideIslandAbs(c.x, c.z)) continue;
      if (isInsideRobotFootprint(c.x, c.z, rAbsX, rAbsZ, stats.reachW)) continue;
      const fl = findFloorSubYBelow(c.x, c.z, baseSubY + 1);
      const st = getLooseSoilAtFloor(c.x, c.z, fl, areaId);
      if (isCrateBlockingAtSubY(c.x, fl + st, c.z, areaId)) continue;
      if (hasSolidTerrainAtAbsSubY(c.x, fl + st, c.z)) continue;
      if (fl >= baseSubY && st >= stats.maxStackHeight) continue;
      return { absX: c.x, absZ: c.z, floorSubY: fl, label: c.label };
    }
    return null;
  }

  function simulateThrowSingleSoil(rAbsX, rAbsZ, baseSubY, dx, dz, lateralJitter, stats, areaId) {
    const maxDist = stats.throwSoilMax; // 極小2 / 小3 / 標準4 / 大5 / 巨大6
    const targetDist = 1 + Math.floor(Math.random() * maxDist);
    const rx = -dz, rz = dx;
    const frontEdge = getFrontEdgeOffset(dx, dz, stats.reachW);
    const startX = rAbsX + frontEdge.ox;
    const startZ = rAbsZ + frontEdge.oz;

    let lastValid = null;
    let rolledBackSlope = false;

    for (let step = 0; step < targetDist; step++) {
      const lat = (step >= 1) ? lateralJitter : 0;
      const cx = startX + dx * step + rx * lat;
      const cz = startZ + dz * step + rz * lat;

      if (!isInsideIslandAbs(cx, cz)) break;
      if (isCrateBlockingAtSubY(cx, baseSubY, cz, areaId)) break;

      // 放物線頂点：縦1倍（baseSubY + reachH）までの障害物は越えられる
      const arcCheckY = baseSubY + stats.reachH;
      const blockedHigh = hasSolidTerrainAtAbsSubY(cx, arcCheckY, cz) || isCrateBlockingAtSubY(cx, arcCheckY, cz, areaId);
      if (blockedHigh) {
        // 階段のような山（上り段差）に当たった場合、キャラ側へ転がり落ちる判定
        if (hasSolidTerrainAtAbsSubY(cx, baseSubY, cz)) {
          rolledBackSlope = true;
        }
        break;
      }

      // そのマスの床と高さを確認
      const topSolid = getTerrainColumnTopSubY(cx, cz);
      const floorBelow = findFloorSubYBelow(cx, cz, arcCheckY + 1);
      const looseHere = getLooseSoilAtFloor(cx, cz, floorBelow, areaId);
      const surfaceY = Math.max(floorBelow + looseHere, (topSolid <= arcCheckY ? topSolid : floorBelow));

      // 階段のような上り斜面（自分の足元より高い固体段差）に着地した場合はキャラ側へ転がり落ちる
      if (floorBelow > baseSubY && hasSolidTerrainAtAbsSubY(cx, floorBelow - 1, cz)) {
        // 更に奥がさらに高ければ（階段・山）手前へ転がり落ちる
        const nextX = cx + dx, nextZ = cz + dz;
        const nextHigher = isInsideIslandAbs(nextX, nextZ) && hasSolidTerrainAtAbsSubY(nextX, floorBelow, nextZ);
        if (nextHigher || step === targetDist - 1) {
          rolledBackSlope = true;
          break;
        }
      }

      // 転がる先に障害物（積み上限に達した土・壁）があれば手前で停止
      if (floorBelow >= baseSubY && looseHere >= stats.maxStackHeight) break;
      if (hasSolidTerrainAtAbsSubY(cx, floorBelow + looseHere, cz)) break;

      lastValid = { absX: cx, absZ: cz, floorSubY: floorBelow, dist: step + 1, surfaceY };
    }

    if (rolledBackSlope) {
      const backSlot = findSafeSoilLandingNearRobot(rAbsX, rAbsZ, baseSubY, dx, dz, stats, areaId);
      if (backSlot) {
        addLooseSoilAtFloor(backSlot.absX, backSlot.absZ, backSlot.floorSubY, 1, areaId);
        return { ok: true, rolledBack: true, note: `斜面から転がり落ちて${backSlot.label}で止まった` };
      }
    }

    if (lastValid) {
      addLooseSoilAtFloor(lastValid.absX, lastValid.absZ, lastValid.floorSubY, 1, areaId);
      return { ok: true, rolledBack: false, note: `${lastValid.dist}分割先へ放物線を描いて転がり止まった` };
    }

    const fallback = findSafeSoilLandingNearRobot(rAbsX, rAbsZ, baseSubY, dx, dz, stats, areaId);
    if (fallback) {
      addLooseSoilAtFloor(fallback.absX, fallback.absZ, fallback.floorSubY, 1, areaId);
      return { ok: true, rolledBack: false, note: `障害物に当たり${fallback.label}へ落ちた` };
    }
    return { ok: false, note: '着地先が満杯だった' };
  }

  function simulateThrowSingleShovel(rAbsX, rAbsZ, baseSubY, dx, dz, lateralJitter, stats, areaId) {
    const maxDist = stats.throwToolMax; // 極小3 / 小4 / 標準5 / 大6 / 巨大7
    const targetDist = 1 + Math.floor(Math.random() * maxDist);
    const rx = -dz, rz = dx;
    const frontEdge = getFrontEdgeOffset(dx, dz, stats.reachW);
    const startX = rAbsX + frontEdge.ox;
    const startZ = rAbsZ + frontEdge.oz;

    let landX = rAbsX, landZ = rAbsZ, landY = findFloorSubYBelow(rAbsX, rAbsZ, baseSubY + 1);
    let landedDist = 0;

    for (let step = 0; step < targetDist; step++) {
      const lat = (step >= 1) ? lateralJitter : 0;
      const cx = startX + dx * step + rx * lat;
      const cz = startZ + dz * step + rz * lat;
      if (!isInsideIslandAbs(cx, cz)) break;

      const arcY = baseSubY + stats.reachH;
      if (isCrateBlockingAtSubY(cx, arcY, cz, areaId) || hasSolidTerrainAtAbsSubY(cx, arcY, cz)) {
        break;
      }
      const fl = findFloorSubYBelow(cx, cz, arcY + 1);
      if (isCrateBlockingAtSubY(cx, fl, cz, areaId)) break;

      landX = cx;
      landZ = cz;
      landY = fl;
      landedDist = step + 1;
    }

    addDroppedTool('shovel', landX, landZ, landY, 1, areaId);
    return { landedDist, landX, landZ, landY };
  }

  function runThrowHand(dir) {
    if (isBehindCurrentFacing(dir)) return runTurnAroundOnly(dir, '投擲');

    if ((DIG_STATE.headSoil || 0) > 0) {
      return {
        actionLabel: '🚫 頭上にピラミッド土を抱えているため投げられなかった',
        physicalResult: `頭上に土(${DIG_STATE.headSoil}個)を抱えているため、バランスを崩す恐れがあり投げられなかった（先に圧縮木箱へしまうか地面へ下ろす必要がある）`,
        moved: false
      };
    }

    const hand = DIG_STATE.equip && DIG_STATE.equip.hand;
    if (!hand || !hand.count) {
      return {
        actionLabel: '🖐️ 手枠に投げるアイテムがなかった',
        physicalResult: '手枠が空のため何も投げられなかった（先にポケットから手枠へ装備する必要がある）',
        moved: false
      };
    }

    ROBOT.rotY = dir.rot;
    const dName = dir.name.replace('(斜め)', '');
    const areaId = getCurAreaId();
    const { absX, absZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const stats = getSizeStats();
    const dx = Math.sign(dir.dx || 0), dz = Math.sign(dir.dz || 0);

    const itemId = hand.id;
    const totalCount = hand.count;

    if (itemId === 'shovel') {
      const dists = [];
      for (let i = 0; i < totalCount; i++) {
        const jitter = (totalCount > 1) ? (Math.floor(Math.random() * 3) - 1) : 0;
        const r = simulateThrowSingleShovel(absX, absZ, baseSubY, dx, dz, jitter, stats, areaId);
        dists.push(r.landedDist);
      }
      DIG_STATE.equip.hand = null;
      life.stamina = Math.max(0, life.stamina - 4);
      saveDigState();
      return {
        actionLabel: `🪏 ${dName}へスコップを${totalCount}本投げた（手枠空）`,
        physicalResult: `手枠のスコップ${totalCount}本を${dName}へ放物線を描いて一気に投げた（飛距離:${dists.join('・')}分割、通り抜け可・手枠は空になった）`,
        moved: false
      };
    }

    if (itemId === 'soil') {
      let thrown = 0;
      let rolledBackCnt = 0;
      let lastNote = '';
      for (let i = 0; i < totalCount; i++) {
        const jitter = (totalCount > 1) ? (Math.floor(Math.random() * 3) - 1) : 0;
        const r = simulateThrowSingleSoil(absX, absZ, baseSubY, dx, dz, jitter, stats, areaId);
        if (r.ok) {
          thrown++;
          if (r.rolledBack) rolledBackCnt++;
          lastNote = r.note;
        }
      }
      if (thrown <= 0) {
        return {
          actionLabel: `🟫 ${dName}へ土を投げたが着地先が満杯だった`,
          physicalResult: '周囲がすべて満杯で土を投げられなかった',
          moved: false
        };
      }
      DIG_STATE.equip.hand.count -= thrown;
      if (DIG_STATE.equip.hand.count <= 0) DIG_STATE.equip.hand = null;
      life.stamina = Math.max(0, life.stamina - 4);
      saveDigState();

      const scatterText = totalCount > 1
        ? `ランダムに散らばって着地した${rolledBackCnt > 0 ? `（うち${rolledBackCnt}個は斜面から手前へ転がり落ちた）` : ''}`
        : lastNote;
      return {
        actionLabel: `🟫 ${dName}へ土を${thrown}個一気に投げた（手枠空）`,
        physicalResult: `手枠の土${thrown}個を${dName}へ放物線を描いて一気に投げ、${scatterText}（手枠は空になった）`,
        moved: false
      };
    }

    return { actionLabel: '🖐️ 投げられなかった', physicalResult: '未対応アイテムのため投げられなかった', moved: false };
  }

  // 移動物理（地面のスコップは通り抜け可・障害物にならない）
  function computeSupportedFloorUnderFootprint(centerAbsX, centerAbsZ, curBaseSubY, reachW) {
    const areaId = getCurAreaId();
    const { minOff, maxOff } = getFootprintBounds(reachW);
    let highestSupportY = getMinSubY();
    let hasImmediateSupport = false;
    for (let ox = minOff; ox <= maxOff; ox++) {
      for (let oz = minOff; oz <= maxOff; oz++) {
        const cx = centerAbsX + ox, cz = centerAbsZ + oz;
        if (hasSolidTerrainAtAbsSubY(cx, curBaseSubY - 1, cz) || hasLooseSoilAtSubY(cx, curBaseSubY - 1, cz, areaId)) {
          hasImmediateSupport = true;
          highestSupportY = Math.max(highestSupportY, curBaseSubY);
        } else {
          const floorY = findFloorSubYBelow(cx, cz, curBaseSubY);
          const loose = getLooseSoilAtFloor(cx, cz, floorY, areaId);
          highestSupportY = Math.max(highestSupportY, floorY + loose);
        }
      }
    }
    return {
      fell: !hasImmediateSupport && highestSupportY < curBaseSubY,
      landingSubY: hasImmediateSupport ? curBaseSubY : highestSupportY
    };
  }

  function evaluateSubStepTarget(nextAbsX, nextAbsZ, curBaseSubY, curPosture, stats) {
    const areaId = getCurAreaId();
    const { minOff, maxOff } = getFootprintBounds(stats.reachW);
    const maxClimbUp = (curPosture === 'crawl') ? 1 : stats.climbMax;
    let highestFloorY = getMinSubY();

    for (let ox = minOff; ox <= maxOff; ox++) {
      for (let oz = minOff; oz <= maxOff; oz++) {
        const cx = nextAbsX + ox, cz = nextAbsZ + oz;
        if (!isInsideIslandAbs(cx, cz)) return { ok: false, reason: '島の端' };
        if (isCrateBlockingAtSubY(cx, curBaseSubY, cz, areaId)) return { ok: false, reason: '圧縮木箱' };

        let openY = null, hitLooseSoil = false, looseHeightHere = 0;
        for (let up = 0; up <= maxClimbUp; up++) {
          const yTest = curBaseSubY + up;
          const solid = hasSolidTerrainAtAbsSubY(cx, yTest, cz);
          const loose = hasLooseSoilAtSubY(cx, yTest, cz, areaId);
          const crate = isCrateBlockingAtSubY(cx, yTest, cz, areaId);
          if (!solid && !loose && !crate) { openY = yTest; break; }
          if (crate) return { ok: false, reason: '圧縮木箱' };
          if (loose && !solid) { hitLooseSoil = true; looseHeightHere = Math.max(looseHeightHere, up + 1); }
        }

        if (openY === null) {
          if (hitLooseSoil) {
            const fl = findFloorSubYBelow(cx, cz, curBaseSubY + 1);
            const cnt = getLooseSoilAtFloor(cx, cz, fl, areaId) || looseHeightHere;
            return { ok: false, reason: `高さ${cnt}段の散らばった土` };
          }
          return { ok: false, reason: curPosture === 'crawl' ? 'ほふく前進では登れない段差（壁）' : '高すぎる段差（壁）' };
        }

        let cellFloorY = openY;
        if (openY === curBaseSubY) {
          const solidBelow = findFloorSubYBelow(cx, cz, curBaseSubY);
          const looseBelow = getLooseSoilAtFloor(cx, cz, solidBelow, areaId);
          cellFloorY = Math.min(curBaseSubY, solidBelow + looseBelow);
        }
        if (cellFloorY > highestFloorY) highestFloorY = cellFloorY;
      }
    }

    const diffSub = highestFloorY - curBaseSubY;
    if (diffSub > maxClimbUp) {
      return { ok: false, reason: curPosture === 'crawl' ? 'ほふく前進では登れない段差（壁）' : '高すぎる段差（壁）' };
    }

    const clearance = getCeilingClearanceSubAt(nextAbsX, nextAbsZ, highestFloorY, stats.reachW);
    const needStandH = stats.standH + stats.headLayers;
    const needCrawlH = stats.crawlH + stats.headLayers;

    let nextPosture = 'stand';
    if (clearance >= needStandH) nextPosture = 'stand';
    else if (clearance >= needCrawlH) nextPosture = 'crawl';
    else {
      if (stats.headLayers > 0 && clearance >= stats.crawlH) {
        return { ok: false, reason: `頭上の土(+${stats.headLayers}段)が天井(空き${clearance}段)に当たる` };
      }
      return { ok: false, reason: `低い天井(空き${clearance}段)` };
    }

    let stepKind = 'flat';
    if (diffSub > 0) stepKind = (diffSub <= stats.stairMax) ? 'stairs_up' : 'scramble_climb';
    else if (diffSub < 0) {
      const drop = -diffSub;
      if (drop <= stats.stairMax) stepKind = 'stairs_down';
      else if (drop <= stats.climbMax) stepKind = 'safe_landing';
      else stepKind = 'high_drop';
    }
    return { ok: true, destFloorSubY: highestFloorY, nextPosture, diffSub, stepKind };
  }

  function runSubMove(dir) {
    lastMoveVisualKind = null;
    if (isBehindCurrentFacing(dir)) return runTurnAroundOnly(dir, '移動');

    const stats = getSizeStats();
    const maxStep = stats.moveStep;
    const dx = Math.sign(dir.dx || 0), dz = Math.sign(dir.dz || 0);
    const dName = dir.name.replace('(斜め)', '');
    ROBOT.rotY = dir.rot;

    let curX = Math.round(ROBOT.pos.x || 0);
    let curZ = Math.round(ROBOT.pos.z || 0);
    let curSx = Number.isFinite(ROBOT.pos.sx) ? Math.max(0, Math.min(4, Math.round(ROBOT.pos.sx))) : 2;
    let curSz = Number.isFinite(ROBOT.pos.sz) ? Math.max(0, Math.min(4, Math.round(ROBOT.pos.sz))) : 2;
    let curBaseSubY = getRobotBaseSubY(curX, curZ, ROBOT.pos.lv);
    let curLv = floorSubYToRobotLv(curBaseSubY);
    let curPosture = ROBOT.posture === 'crawl' ? 'crawl' : 'stand';

    let movedSteps = 0, totalClimbSub = 0, totalDropSub = 0;
    let didScramble = false, didStairsUp = false, didSafeLanding = false, didHighDrop = false;
    let stopReason = '';

    for (let s = 0; s < maxStep; s++) {
      const curAbsX = curX * 5 + curSx, curAbsZ = curZ * 5 + curSz;
      const nextAbsX = curAbsX + dx, nextAbsZ = curAbsZ + dz;
      if (!isInsideIslandAbs(nextAbsX, nextAbsZ)) { stopReason = '島の端'; break; }

      if (dx !== 0 && dz !== 0) {
        const sideA = evaluateSubStepTarget(curAbsX + dx, curAbsZ, curBaseSubY, curPosture, stats);
        const sideB = evaluateSubStepTarget(curAbsX, curAbsZ + dz, curBaseSubY, curPosture, stats);
        if (!sideA.ok && !sideB.ok) { stopReason = '斜めの角の壁'; break; }
      }

      const ev = evaluateSubStepTarget(nextAbsX, nextAbsZ, curBaseSubY, curPosture, stats);
      if (!ev.ok) { stopReason = ev.reason; break; }

      const tX = absToTile(nextAbsX), tZ = absToTile(nextAbsZ);
      if (ev.diffSub > 0) {
        totalClimbSub += ev.diffSub;
        if (ev.stepKind === 'scramble_climb') didScramble = true; else didStairsUp = true;
      } else if (ev.diffSub < 0) {
        totalDropSub += (-ev.diffSub);
        if (ev.stepKind === 'high_drop') didHighDrop = true; else if (ev.stepKind === 'safe_landing') didSafeLanding = true;
      }

      curX = tX.tile; curZ = tZ.tile; curSx = tX.sub; curSz = tZ.sub;
      curBaseSubY = ev.destFloorSubY; curLv = floorSubYToRobotLv(curBaseSubY);
      curPosture = ev.nextPosture;
      movedSteps++;
      if (ev.stepKind === 'high_drop' || ev.stepKind === 'scramble_climb') break;
    }

    if (movedSteps > 0) {
      ROBOT.pos.x = curX; ROBOT.pos.z = curZ; ROBOT.pos.sx = curSx; ROBOT.pos.sz = curSz;
      ROBOT.pos.subY = curBaseSubY; ROBOT.pos.lv = curLv; ROBOT.posture = curPosture;

      life.energy = Math.max(0, life.energy - 3);
      life.stamina = Math.max(0, life.stamina - (didScramble ? 6 : 4));
      life.mental = Math.min(100, life.mental + 5);
      ROBOT.params.curiosity = Math.min(100, (ROBOT.params.curiosity || 60) + 2);

      if (didScramble) lastMoveVisualKind = 'scramble_climb';
      else if (didHighDrop) lastMoveVisualKind = 'high_drop';
      else if (didSafeLanding) lastMoveVisualKind = 'safe_landing';
      else if (didStairsUp) lastMoveVisualKind = 'stairs_up';

      const notes = [];
      if (didScramble) notes.push(`段差${totalClimbSub}分割をよじ登った`);
      else if (totalClimbSub > 0) notes.push(`階段${totalClimbSub}分割を上がった`);
      if (didHighDrop) notes.push(`足元が空いていたため下の空間へ${totalDropSub}分割落下した`);
      else if (totalDropSub > 0) notes.push(`${totalDropSub}分割下へ降りた`);
      if (curPosture === 'crawl') notes.push('低い天井の下でほふく姿勢になった');

      const extraText = notes.length ? `（${notes.join('・')}）` : '';
      const phys = stopReason
        ? `${dName}へ${movedSteps}分割進んだところで「${stopReason}」に当たり停止した${extraText}`
        : `${dName}へ${movedSteps}分割進んだ${extraText}`;
      const badge = didScramble ? `(🧗↑${totalClimbSub})` : (totalClimbSub > 0 ? `(🪜↑${totalClimbSub})` : (totalDropSub > 0 ? `(↓${totalDropSub})` : ''));
      return {
        actionLabel: `🐾 ${dName}へ${movedSteps}分割移動${badge}${stopReason ? `(${stopReason})` : ''}`,
        physicalResult: phys,
        moved: true
      };
    }

    return {
      actionLabel: `🐾 ${dName}へ進めなかった(${stopReason || '障害物'})`,
      physicalResult: `${dName}へ進もうとしたが「${stopReason || '障害物'}」に阻まれ1分割も進めなかった`,
      moved: false
    };
  }

  // --------------------------------------------------------------------------
  // 5. 手帳UI刷新（最上部:正面プレビュー＋左右6装備枠／下部10枠／圧縮木箱25枠ウィンドウ）
  // --------------------------------------------------------------------------
  function drawFrontCharacterPreview(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 背景グラデーション
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#e0f2fe');
    grad.addColorStop(1, '#f8fafc');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 床面
    ctx.fillStyle = '#bbf7d0';
    ctx.fillRect(0, h - 22, w, 22);
    ctx.fillStyle = '#d4a373';
    ctx.fillRect(0, h - 10, w, 10);

    const stats = getSizeStats();
    // 体格比率を視覚的に反映（幅1〜5・高さ1〜5）
    const bodyW = 26 + stats.reachW * 9;
    const bodyH = 22 + stats.reachH * 10;
    const cx = w / 2;
    const baseY = h - 20;
    const bodyY = baseY - bodyH;

    // 影
    ctx.fillStyle = 'rgba(15,23,42,0.14)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 2, bodyW * 0.56, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 正面箱型キャラ本体
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(cx - bodyW / 2, bodyY, bodyW, bodyH, 7);
    ctx.fill();
    ctx.stroke();

    // 画面フェイス（正面を向いている）
    const faceW = bodyW * 0.68;
    const faceH = Math.min(20, bodyH * 0.44);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(cx - faceW / 2, bodyY + bodyH * 0.22, faceW, faceH, 4);
    ctx.fill();

    // 両目
    ctx.fillStyle = '#38bdf8';
    const eyeY = bodyY + bodyH * 0.22 + faceH * 0.5;
    ctx.beginPath();
    ctx.arc(cx - faceW * 0.22, eyeY, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + faceW * 0.22, eyeY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 頭上ピラミッド（積まれている場合）
    const headSoil = DIG_STATE.headSoil || 0;
    if (headSoil > 0) {
      const layers = Math.min(4, getHeadStackHeight(headSoil, stats.reachW));
      for (let l = 0; l < layers; l++) {
        const blocks = Math.max(1, Math.min(4, stats.reachW - l));
        const bw = 11, bh = 9;
        const rowW = blocks * bw;
        for (let b = 0; b < blocks; b++) {
          ctx.fillStyle = ((b + l) % 2 === 0) ? '#d9a875' : '#c68e5a';
          ctx.strokeStyle = '#7c4a21';
          ctx.lineWidth = 1;
          ctx.fillRect(cx - rowW / 2 + b * bw, bodyY - (l + 1) * bh - 2, bw - 1, bh - 1);
          ctx.strokeRect(cx - rowW / 2 + b * bw, bodyY - (l + 1) * bh - 2, bw - 1, bh - 1);
        }
      }
    }

    // 手枠の見た目反映（スコップ1〜2本 または 土）
    const hand = DIG_STATE.equip && DIG_STATE.equip.hand;
    if (hand && hand.count > 0) {
      const handY = bodyY + bodyH * 0.52;
      if (hand.id === 'shovel') {
        const drawShovel = (sx) => {
          ctx.strokeStyle = '#92400e';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(sx, handY - 14);
          ctx.lineTo(sx, handY + 12);
          ctx.stroke();
          ctx.fillStyle = '#94a3b8';
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.2;
          ctx.fillRect(sx - 5, handY + 8, 10, 9);
          ctx.strokeRect(sx - 5, handY + 8, 10, 9);
        };
        drawShovel(cx + bodyW / 2 + 10);
        if (hand.count >= 2) drawShovel(cx - bodyW / 2 - 10);
      } else if (hand.id === 'soil') {
        const n = Math.min(5, hand.count);
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = (i % 2 === 0) ? '#d9a875' : '#c68e5a';
          ctx.strokeStyle = '#7c4a21';
          ctx.lineWidth = 1;
          ctx.fillRect(cx + bodyW / 2 + 5, handY + 6 - i * 8, 10, 8);
          ctx.strokeRect(cx + bodyW / 2 + 5, handY + 6 - i * 8, 10, 8);
        }
      }
    }

    // 下部サイズラベル
    ctx.fillStyle = '#0369a1';
    ctx.font = 'bold 9.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`正面 (高${stats.reachH}×幅${stats.reachW})`, cx, h - 3);
  }

  function renderEquipSlotHTML(slotKey, label) {
    const eq = DIG_STATE.equip && DIG_STATE.equip[slotKey];
    const stats = getSizeStats();
    let content = `<span style="font-size:9px;color:#94a3b8;font-weight:800;">空</span>`;
    let border = '#cbd5e1';
    let bg = '#f8fafc';

    if (eq && eq.count > 0) {
      const meta = ITEM_META[eq.id] || { icon: '✨', name: eq.id };
      const maxStr = (slotKey === 'hand')
        ? (eq.id === 'shovel' ? `/${stats.handShovelMax}` : `/${stats.handSoilMax}`)
        : '';
      border = '#0284c7';
      bg = '#e0f2fe';
      content = `<span style="font-size:16px;line-height:1;">${meta.icon}</span><span style="font-size:8.5px;font-weight:900;color:#0369a1;line-height:1;">${eq.count}${maxStr}</span>`;
    }
    return `
      <div data-equip-slot="${slotKey}" style="width:52px;height:52px;border-radius:10px;border:1.5px solid ${border};background:${bg};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;cursor:pointer;position:relative;box-sizing:border-box;">
        <span style="position:absolute;top:1px;left:4px;font-size:8px;font-weight:900;color:#64748b;">${label}</span>
        ${content}
      </div>
    `;
  }

  function ensureDiaryEquipPreviewPanel() {
    const diaryModal = document.getElementById('modal-diary');
    if (!diaryModal) return null;
    const content = diaryModal.querySelector('.modal-content');
    if (!content) return null;

    let panel = document.getElementById('dig-equip-preview-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'dig-equip-preview-panel';
      panel.style.cssText = 'background:#ffffff;border:1.5px solid #bae6fd;border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;';
      // 手帳タイトル直下（最上部）へ挿入
      const titleEl = content.querySelector('.modal-title');
      if (titleEl && titleEl.nextSibling) content.insertBefore(panel, titleEl.nextSibling);
      else content.insertBefore(panel, content.firstChild);
    }
    return panel;
  }

  function renderEquipPreviewUI() {
    const panel = ensureDiaryEquipPreviewPanel();
    if (!panel) return;
    const stats = getSizeStats();
    const hand = DIG_STATE.equip && DIG_STATE.equip.hand;
    let handDesc = '素手（掘削1個）';
    if (hand && hand.id === 'shovel') {
      handDesc = hand.count === 1
        ? 'スコップ1本（体格範囲で最大5個掘削・1本投擲可）'
        : `スコップ${hand.count}本（両手塞がり掘削不可・${hand.count}本投擲可）`;
    } else if (hand && hand.id === 'soil') {
      handDesc = `土${hand.count}/${stats.handSoilMax}個（掘削不可・一括投擲可）`;
    }

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:10.5px;font-weight:900;color:#0369a1;">
        <span>🧍 キャラ装備＆正面プレビュー</span>
        <span style="font-size:9.5px;color:#475569;">手枠：${handDesc}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${renderEquipSlotHTML('head',  '頭')}
          ${renderEquipSlotHTML('body',  '体')}
          ${renderEquipSlotHTML('waist', '腰')}
        </div>
        <div style="border:1.5px solid #7dd3fc;border-radius:12px;overflow:hidden;background:#f0f9ff;flex-shrink:0;">
          <canvas id="dig-front-preview-canvas" width="132" height="168" style="display:block;width:132px;height:168px;"></canvas>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${renderEquipSlotHTML('back', '背')}
          ${renderEquipSlotHTML('hand', '手')}
          ${renderEquipSlotHTML('feet', '足')}
        </div>
      </div>
    `;

    drawFrontCharacterPreview(document.getElementById('dig-front-preview-canvas'));

    panel.querySelectorAll('[data-equip-slot]').forEach(el => {
      el.onclick = () => {
        const key = el.getAttribute('data-equip-slot');
        const eq = DIG_STATE.equip && DIG_STATE.equip[key];
        const names = { head: '頭（防具・飾り専用／頭上ピラミッドとは別）', body: '体', waist: '腰', back: '背', hand: '手（スコップ最大2本／土は高さ分）', feet: '足' };
        if (typeof showToast === 'function') {
          if (eq && eq.count > 0) {
            const m = ITEM_META[eq.id] || { name: eq.id, icon: '' };
            showToast(`${names[key]}：${m.icon}${m.name} × ${eq.count}`);
          } else {
            showToast(`${names[key]}：未装備（AIが自由に着脱可能）`);
          }
        }
      };
    });
  }

  // 圧縮木箱25枠モーダル（5×5グリッド）
  function ensureCrateModal() {
    let modal = document.getElementById('modal-crate-25');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'modal-crate-25';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-content" style="max-height:90vh;gap:8px;">
        <div class="modal-close" id="btn-close-crate25-x">✕</div>
        <div class="modal-title" id="crate25-title" style="font-size:14px;">📦 圧縮木箱（5×5＝25枠）</div>
        <div id="crate25-meta" style="font-size:10.5px;font-weight:800;color:#92400e;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:6px 8px;"></div>
        <div id="crate25-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;padding:4px;background:#fef3c7;border:1.5px solid #d97706;border-radius:10px;"></div>
        <div style="font-size:10px;color:#64748b;line-height:1.4;">
          ※ 素材類（土・木・石など）：1枠10個 ／ 道具類（スコップなど）：1枠5本<br>
          ※ 頭上ピラミッドの土を収納した時は「土」として加算されます
        </div>
        <button type="button" id="btn-close-crate25" class="btn-sub" style="font-size:11.5px;">閉じる</button>
      </div>
    `;
    document.body.appendChild(modal);

    const closeFn = () => {
      modal.style.display = 'none';
      modal.classList.remove('active');
      activeCrateModalId = null;
      if (window.AICommCore && typeof window.AICommCore.resetAllModalZooms === 'function') {
        window.AICommCore.resetAllModalZooms();
      }
    };
    document.getElementById('btn-close-crate25-x').onclick = closeFn;
    document.getElementById('btn-close-crate25').onclick = closeFn;

    if (window.AICommCore && typeof window.AICommCore.enablePinchZoomOnAllModals === 'function') {
      window.AICommCore.enablePinchZoomOnAllModals();
    }
    return modal;
  }

  function renderCrateModalContent(crateId) {
    const crateIdx = DIG_STATE.crates.findIndex(c => c.id === crateId);
    const crate = crateIdx >= 0 ? DIG_STATE.crates[crateIdx] : DIG_STATE.crates[0];
    if (!crate) return;
    const slots = ensureCrateSlots(crate);

    const titleEl = document.getElementById('crate25-title');
    const metaEl  = document.getElementById('crate25-meta');
    const gridEl  = document.getElementById('crate25-grid');
    if (titleEl) titleEl.innerText = `📦 圧縮木箱 #${(crateIdx >= 0 ? crateIdx : 0) + 1}（縦5×横5＝25枠）`;
    if (metaEl) metaEl.innerText = `場所(${crate.x}, ${crate.z}) ／ ${summarizeCrateContents(crate)}`;
    if (!gridEl) return;

    gridEl.innerHTML = '';
    for (let i = 0; i < CRATE_SLOTS; i++) {
      const s = slots[i];
      const cell = document.createElement('div');
      cell.style.cssText = 'aspect-ratio:1/1;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-weight:900;cursor:pointer;box-sizing:border-box;';
      if (s && s.count > 0) {
        const meta = ITEM_META[s.id] || { icon: '📦', name: s.id, stackMax: 10 };
        cell.style.background = '#ffffff';
        cell.style.border = '1.5px solid #b45309';
        cell.innerHTML = `<span style="font-size:17px;line-height:1;">${meta.icon}</span><span style="font-size:9px;color:#92400e;">${s.count}/${meta.stackMax}</span>`;
        cell.onclick = () => {
          if (typeof showToast === 'function') showToast(`枠${i + 1}：${meta.icon}${meta.name} ${s.count}/${meta.stackMax}`);
        };
      } else {
        cell.style.background = 'rgba(255,255,255,0.55)';
        cell.style.border = '1px dashed #d97706';
        cell.innerHTML = `<span style="font-size:8.5px;color:#b45309;opacity:0.45;">${i + 1}</span>`;
      }
      gridEl.appendChild(cell);
    }
  }

  function openCrateModal(crateId) {
    const modal = ensureCrateModal();
    activeCrateModalId = crateId || (DIG_STATE.crates[0] && DIG_STATE.crates[0].id) || null;
    renderCrateModalContent(activeCrateModalId);
    modal.style.display = 'flex';
    modal.classList.add('active');
  }

  // 下部10枠（1〜9枠=ポケット / 10枠目=頭上ピラミッド専用）＋独立した圧縮木箱ボタンエリア
  function renderDiaryFullUI() {
    purgeLegacyItems();
    renderEquipPreviewUI();

    const grid = document.getElementById('bag-grid');
    if (!grid) return;

    const stats = getSizeStats();
    const headNow = DIG_STATE.headSoil || 0;
    const carriedRes = getCarriedResourceTotal();

    if (grid.previousElementSibling) {
      grid.previousElementSibling.innerText =
        `🎒 キャラ所持枠（1〜9:ポケット 資源${carriedRes}/${stats.pocketCap}・道具別枠 ／ 10:頭上ピラミッド ${headNow}/${stats.headCap}）`;
    }

    // 1〜9枠に並べるポケットアイテムのリストを構築
    const pocketEntries = [];
    ['soil', 'wood', 'stone'].forEach(id => {
      const cnt = DIG_STATE.pocket[id] || 0;
      if (cnt > 0) pocketEntries.push({ id, count: cnt, isMaterial: true });
    });
    let remShovels = DIG_STATE.pocket.shovel || 0;
    while (remShovels > 0 && pocketEntries.length < 9) {
      const take = Math.min(STACK_TOOL, remShovels);
      pocketEntries.push({ id: 'shovel', count: take, isMaterial: false });
      remShovels -= take;
    }

    grid.innerHTML = '';

    // 1〜9枠：ポケット
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'bag-slot';
      slot.style.flexDirection = 'column';
      slot.style.gap = '1px';
      slot.style.padding = '2px';

      const ent = pocketEntries[i];
      if (ent) {
        const meta = ITEM_META[ent.id] || { icon: '📦', name: ent.id, stackMax: 5 };
        slot.classList.add('filled');
        if (ent.isMaterial) {
          const over = carriedRes > stats.pocketCap;
          slot.style.borderColor = over ? '#ef4444' : '#b45309';
          slot.style.background  = over ? '#fef2f2' : '#fef3c7';
          slot.innerHTML = `<span style="font-size:15px;line-height:1;">${meta.icon}</span><span style="font-size:8.5px;font-weight:900;color:${over ? '#dc2626' : '#92400e'};">${ent.count}</span>`;
          slot.onclick = () => {
            if (typeof showToast === 'function') {
              showToast(`${meta.icon}${meta.name}：ポケット内${ent.count}個（全資源合計 ${carriedRes}/${stats.pocketCap}）`);
            }
          };
        } else {
          slot.style.borderColor = '#0284c7';
          slot.style.background  = '#e0f2fe';
          slot.innerHTML = `<span style="font-size:15px;line-height:1;">${meta.icon}</span><span style="font-size:8.5px;font-weight:900;color:#0369a1;">${ent.count}/${STACK_TOOL}</span>`;
          slot.onclick = () => {
            if (typeof showToast === 'function') {
              showToast(`${meta.icon}${meta.name}：${ent.count}/${STACK_TOOL}本（資源上限1〜55は消費しない）`);
            }
          };
        }
      } else {
        slot.innerHTML = `<span style="font-size:8px;color:#94a3b8;font-weight:800;">枠${i + 1}</span>`;
      }
      grid.appendChild(slot);
    }

    // 10枠目：頭上ピラミッド専用枠
    const pyrSlot = document.createElement('div');
    pyrSlot.className = 'bag-slot';
    pyrSlot.style.flexDirection = 'column';
    pyrSlot.style.gap = '1px';
    pyrSlot.style.padding = '2px';
    if (headNow > 0) {
      pyrSlot.classList.add('filled');
      pyrSlot.style.borderColor = '#0284c7';
      pyrSlot.style.background  = '#dbeafe';
      pyrSlot.innerHTML = `<span style="font-size:15px;line-height:1;">🔺</span><span style="font-size:8px;font-weight:900;color:#1d4ed8;">${headNow}/${stats.headCap}</span>`;
    } else {
      pyrSlot.style.borderStyle = 'dashed';
      pyrSlot.style.borderColor = '#38bdf8';
      pyrSlot.style.background  = '#f0f9ff';
      pyrSlot.innerHTML = `<span style="font-size:13px;line-height:1;opacity:0.65;">🔺</span><span style="font-size:7.5px;font-weight:900;color:#0284c7;">頭上0/${stats.headCap}</span>`;
    }
    pyrSlot.onclick = () => {
      if (typeof showToast === 'function') {
        showToast(`🔺 頭上ピラミッド：土${headNow}/${stats.headCap}個（+${stats.headLayers}段・頭上保持中は投擲不可／圧縮木箱収納で土へ加算）`);
      }
    };
    grid.appendChild(pyrSlot);

    // 独立した「圧縮木箱」ボタンエリア（#bag-gridの直下）
    let cratePanel = document.getElementById('dig-crate-list-panel');
    if (!cratePanel && grid.parentNode) {
      cratePanel = document.createElement('div');
      cratePanel.id = 'dig-crate-list-panel';
      cratePanel.style.cssText = 'margin-top:8px;padding:8px;background:#fffbeb;border:1.5px solid #f59e0b;border-radius:10px;display:flex;flex-direction:column;gap:6px;';
      grid.parentNode.insertBefore(cratePanel, grid.nextSibling);
    }
    if (cratePanel) {
      cratePanel.innerHTML = `
        <div style="font-size:10.5px;font-weight:900;color:#92400e;">📦 圧縮木箱（タップで5×5＝25枠を表示 ／ 3D画面の木箱タップでも開閉）</div>
        <div id="dig-crate-btn-row" style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;"></div>
      `;
      const row = document.getElementById('dig-crate-btn-row');
      for (let i = 0; i < 5; i++) {
        const crate = DIG_STATE.crates[i];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = 'padding:6px 2px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;font-weight:900;';
        if (crate) {
          const used = countUsedSlotsInCrate(crate);
          btn.style.border = '1.5px solid #d97706';
          btn.style.background = '#ffffff';
          btn.style.color = '#92400e';
          btn.innerHTML = `<span style="font-size:15px;line-height:1;">📦</span><span style="font-size:8.5px;">${used}/${CRATE_SLOTS}枠</span>`;
          btn.onclick = () => openCrateModal(crate.id);
        } else {
          btn.style.border = '1px dashed #cbd5e1';
          btn.style.background = '#f8fafc';
          btn.style.color = '#94a3b8';
          btn.disabled = true;
          btn.innerHTML = `<span style="font-size:8.5px;">空き枠</span>`;
        }
        row.appendChild(btn);
      }
    }

    if (activeCrateModalId) renderCrateModalContent(activeCrateModalId);
  }

  // --------------------------------------------------------------------------
  // 6. 既存フック接続（クラウド旧データ遮断・1分割高さ同期・UI自動更新）
  // --------------------------------------------------------------------------
  if (_origGetSurfaceYAt) {
    getSurfaceYAt = function(gx, gz, lvOverride = null, reqWidth = 1) {
      if (typeof ROBOT !== 'undefined' && ROBOT && ROBOT.pos &&
          lvOverride !== null &&
          Math.round(gx) === Math.round(ROBOT.pos.x) &&
          Math.round(gz) === Math.round(ROBOT.pos.z) &&
          lvOverride === ROBOT.pos.lv) {
        return getRobotBaseSubY(gx, gz, lvOverride) * SUB_SIZE;
      }
      return _origGetSurfaceYAt(gx, gz, lvOverride, reqWidth);
    };
  }

  if (typeof clampCharSubPosForBodySize === 'function') {
    clampCharSubPosForBodySize = function() {
      if (typeof ROBOT === 'undefined' || !ROBOT || !ROBOT.pos) return;
      ROBOT.pos.sx = Math.max(0, Math.min(4, Math.round(Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2)));
      ROBOT.pos.sz = Math.max(0, Math.min(4, Math.round(Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2)));
      ROBOT.pos.subY = getRobotBaseSubY();
      ROBOT.pos.lv = floorSubYToRobotLv(ROBOT.pos.subY);
    };
  }

  if (typeof applyLoadedWorldData === 'function') {
    const _origApplyLoaded = applyLoadedWorldData;
    applyLoadedWorldData = function(d) {
      const hm = d && d.heightMap;
      const isOldCloudData = !d ||
        d.cleanEnvTag !== CLEAN_ENV_TAG ||
        (d.areaId && d.areaId !== 'home') ||
        !hm || hm['0,0'] !== 0 || hm['0,-1'] !== 1 || hm['0,-2'] !== 1 || hm['1,2'] === 1;

      if (isOldCloudData) {
        if (!isCleanTerrainValid()) applyCleanTestTerrain(true);
        else {
          relocatePortalsToCorner();
          purgeLegacyItems();
          saveDigState();
          if (typeof saveWorldState === 'function') saveWorldState();
        }
        return;
      }

      _origApplyLoaded(d);
      relocatePortalsToCorner();
      purgeLegacyItems();
      syncDugCellsToChipMap();
      if (typeof ROBOT !== 'undefined' && ROBOT && ROBOT.pos) {
        ROBOT.pos.sx = Math.max(0, Math.min(4, Math.round(Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2)));
        ROBOT.pos.sz = Math.max(0, Math.min(4, Math.round(Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2)));
        ROBOT.pos.subY = getRobotBaseSubY();
      }
      renderDigVisuals();
      renderDiaryFullUI();
    };
  }

  if (typeof saveWorldState === 'function') {
    const _origSaveWorld = saveWorldState;
    saveWorldState = function() {
      purgeLegacyItems();
      const res = _origSaveWorld.apply(this, arguments);
      try {
        if (typeof safeStorage !== 'undefined') {
          const raw = safeStorage.getItem('island_spacecore_v15');
          if (raw) {
            const obj = JSON.parse(raw);
            obj.cleanEnvTag = CLEAN_ENV_TAG;
            obj.areaId = 'home';
            const updatedStr = JSON.stringify(obj);
            safeStorage.setItem('island_spacecore_v15', updatedStr);
            if (typeof firestoreDocRef !== 'undefined' && firestoreDocRef) {
              firestoreDocRef.set({
                stateJson: updatedStr,
                day: obj.day, time: obj.time, life: obj.life,
                robotGen: obj.robot ? obj.robot.gen : 1,
                lastMessage: obj.lastMessage || '',
                logs: obj.logs || [],
                updatedAt: Date.now()
              }).catch(() => {});
            }
          }
        }
      } catch (e) {}
      return res;
    };
  }

  if (typeof renderDiaryModal === 'function') {
    const _origRenderDiary = renderDiaryModal;
    renderDiaryModal = function() {
      _origRenderDiary.apply(this, arguments);
      renderDiaryFullUI();
    };
  }

  if (typeof rebuildTerrainAndItems === 'function') {
    const _origRebuild = rebuildTerrainAndItems;
    rebuildTerrainAndItems = function() {
      relocatePortalsToCorner();
      purgeLegacyItems();
      syncDugCellsToChipMap();
      _origRebuild();
      renderDigVisuals();
    };
  }

  if (typeof updateEnvironmentAndUI === 'function') {
    const _origUI = updateEnvironmentAndUI;
    updateEnvironmentAndUI = function() {
      _origUI();
      renderHeadPyramidVisual();
      renderHandEquipVisual();
      renderDiaryFullUI();
    };
  }

  if (typeof resetGameDirectly === 'function') {
    const _origReset = resetGameDirectly;
    resetGameDirectly = function() {
      try {
        if (typeof safeStorage !== 'undefined') safeStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      if (window.AICommCore && typeof window.AICommCore.resetPhysicalHistory === 'function') {
        window.AICommCore.resetPhysicalHistory();
      }
      _origReset();
    };
  }

  const diaryBtn = document.getElementById('diary-btn');
  if (diaryBtn) diaryBtn.addEventListener('click', () => setTimeout(renderDiaryFullUI, 20));

  // --------------------------------------------------------------------------
  // 7. AICommCore への純粋知覚・物理アクション登録
  // --------------------------------------------------------------------------
  if (window.AICommCore) {
    if (typeof window.AICommCore.registerVisionProvider === 'function') {
      window.AICommCore.registerVisionProvider((opts) => buildFirstPersonVisionMap(opts));
    }

    const registerBody = window.AICommCore.registerBodySensor || window.AICommCore.registerSensor;
    registerBody(() => {
      const stats = getSizeStats();
      const st = life.getState();
      const basis = getFacingBasis();
      const { absX, absZ } = getRobotAbsPos();
      const clearance = getCeilingClearanceSubAt(absX, absZ, getRobotBaseSubY(), stats.reachW);
      const hand = DIG_STATE.equip && DIG_STATE.equip.hand;
      let handText = '空（素手：掘削1個）';
      if (hand && hand.id === 'shovel') {
        handText = hand.count === 1
          ? 'スコップ1本（体格範囲内で最大5個掘削可・投擲可）'
          : `スコップ${hand.count}本（両手塞がり掘削不可・${hand.count}本一括投擲可）`;
      } else if (hand && hand.id === 'soil') {
        handText = `土${hand.count}/${stats.handSoilMax}個（掘削不可・${hand.count}個一括投擲可）`;
      }

      const nearCrate = findNearbyCrate();
      const crateLine = nearCrate
        ? `隣接圧縮木箱(手が届く): ${summarizeCrateContents(nearCrate)}`
        : '隣接圧縮木箱: なし（手が届く距離1分割以内にない）';

      return [
        `体格: 高さ${stats.reachH}分割 × 幅${stats.reachW}分割 (歩幅:最大${stats.moveStep}分割 / 階段:${stats.stairMax}段・よじ登り:${stats.maxStepUpSub}段 / ほふく高:${stats.crawlH} / 整理上限:${stats.maxStackHeight}段 / 投げ最大距離:道具${stats.throwToolMax}・土${stats.throwSoilMax})`,
        `向いている方角: ${basis.actualFacingName} / 姿勢: ${ROBOT.posture === 'crawl' ? 'ほふく' : '立位'} / 頭上の天井空き: ${clearance}分割`,
        `身体状態: 体力${st.stamina}/100, おなか${st.energy}/100`,
        `手枠装備: ${handText}`,
        `ポケット(1〜9枠): 土${DIG_STATE.pocket.soil || 0}個（資源合計${getCarriedResourceTotal()}/${stats.pocketCap}・手枠と共有）、スコップ${DIG_STATE.pocket.shovel || 0}本（資源上限非消費）`,
        `頭上ピラミッド(10枠目): 土${DIG_STATE.headSoil || 0}/${stats.headCap}個 (現在+${stats.headLayers}段・必要天井:${stats.bodyHeight + stats.headLayers}分割${(DIG_STATE.headSoil || 0) > 0 ? '・頭上保持中は投擲不可' : ''})`,
        crateLine
      ].join('\n');
    });

    window.AICommCore.registerAction({
      id: 'look',
      desc: '移動せず指定方角へ体の向きを変える',
      run: ({ dir }) => { lastTurnActionId = 'look'; return runLook(dir); }
    });

    window.AICommCore.registerAction({
      id: 'move',
      desc: '指定方角へ移動する（落ちたスコップSは通り抜け可）',
      run: ({ dir }) => { lastTurnActionId = 'move'; return runSubMove(dir); }
    });

    window.AICommCore.registerAction({
      id: 'dig_front',
      desc: '指定方角の目の前距離1の壁を体格範囲内で削る（素手1個／スコップ1本最大5個／2本や土持ちは不可）',
      run: ({ dir, dec }) => { lastTurnActionId = 'dig_front'; return runSubDigByMode('front', dir, dec && dec.thought); }
    });

    window.AICommCore.registerAction({
      id: 'dig_down',
      desc: '指定方角の目の前または足元の地面(1段下)を体格範囲内で削る',
      run: ({ dir, dec }) => { lastTurnActionId = 'dig_down'; return runSubDigByMode('down', dir, dec && dec.thought); }
    });

    window.AICommCore.registerAction({
      id: 'dig_up',
      desc: '頭上の届く高さの天井を体格範囲内で削る',
      run: ({ dir, dec }) => { lastTurnActionId = 'dig_up'; return runSubDigByMode('up', dir, dec && dec.thought); }
    });

    window.AICommCore.registerAction({
      id: 'pickup',
      desc: 'すぐそばの散らばった土や地面のスコップ(S)をポケットへ拾う（item:"soil"/"shovel"/省略可、土は満杯後頭上へ）',
      run: ({ item }) => { lastTurnActionId = 'pickup'; return runPickup(item); }
    });

    window.AICommCore.registerAction({
      id: 'place_soil',
      desc: '頭上（なければ手枠・ポケット）の土を指定方角の距離1へ1個そっと置く（頭上保持中でも実行可）',
      run: ({ dir }) => { lastTurnActionId = 'place_soil'; return runPlaceSoil(dir); }
    });

    window.AICommCore.registerAction({
      id: 'store_crate',
      desc: 'すぐ隣(距離1分割以内)の圧縮木箱(25枠)へ土やスコップを収納する（item:"soil"/"shovel"/省略可）',
      run: ({ item }) => { lastTurnActionId = 'store_crate'; return runStoreCrate(item); }
    });

    window.AICommCore.registerAction({
      id: 'take_crate',
      desc: 'すぐ隣(距離1分割以内)の圧縮木箱からitem("shovel"/"soil")を一旦ポケットの空き上限までまとめて取り出す',
      run: ({ item }) => { lastTurnActionId = 'take_crate'; return runTakeCrate(item); }
    });

    window.AICommCore.registerAction({
      id: 'equip_hand',
      desc: 'ポケットと手枠の間で自由に付け外しする（item:"shovel"/"soil"/"none", count:個数。スコップ最大2本・土は高さ分）',
      run: ({ item, count }) => { lastTurnActionId = 'equip_hand'; return runEquipHand(item, count); }
    });

    window.AICommCore.registerAction({
      id: 'drop_item',
      desc: 'ポケットや手枠のitem("shovel"/"soil")をcount個だけ周囲の地面へ捨てる',
      run: ({ item, count }) => { lastTurnActionId = 'drop_item'; return runDropItem(item, count); }
    });

    window.AICommCore.registerAction({
      id: 'throw_hand',
      desc: '手枠に装備中のスコップや土を指定方角へ放物線を描いて一気に投げる（頭上ピラミッド保持時は不可）',
      run: ({ dir }) => { lastTurnActionId = 'throw_hand'; return runThrowHand(dir); }
    });

    window.AICommCore.registerPostTurnHook(({ dec }) => {
      const act = (dec && dec.action) || lastTurnActionId;
      const eSpec = (typeof getExpressionSpec === 'function') ? getExpressionSpec(ROBOT.emotion) : null;

      if (act === 'dig_front' || act === 'dig_down' || act === 'dig_up' || act === 'throw_hand') {
        ROBOT.emotion = 'swing_v';
      } else if (act === 'look') {
        ROBOT.emotion = 'peek';
      } else if (act === 'move' && lastMoveVisualKind === 'scramble_climb') {
        ROBOT.emotion = 'struggle';
      } else if (act === 'move' && lastMoveVisualKind === 'safe_landing') {
        ROBOT.emotion = 'pickup';
      } else if (act === 'move' && lastMoveVisualKind === 'high_drop') {
        ROBOT.emotion = 'surprise';
      } else if (eSpec && eSpec.tool) {
        if (act === 'move') ROBOT.emotion = 'run';
        else if (act === 'pickup' || act === 'take_crate') ROBOT.emotion = 'pickup';
        else if (act === 'place_soil' || act === 'store_crate' || act === 'equip_hand') ROBOT.emotion = 'carry';
        else ROBOT.emotion = 'normal';
      }
      lastMoveVisualKind = null;
      renderHeadPyramidVisual();
      renderHandEquipVisual();
      return null;
    });
  }

  loadDigState();
  if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
  else renderDigVisuals();
  if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition(true);
  renderDiaryFullUI();

  window.DigRulesModule = Object.freeze({
    getState: () => DIG_STATE,
    getSizeStats,
    buildFirstPersonVisionMap,
    renderDiaryFullUI,
    renderDigVisuals,
    renderHeadPyramidVisual,
    renderHandEquipVisual,
    openCrateModal,
    applyCleanTestTerrain
  });
})();
