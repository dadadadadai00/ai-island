// ============================================================================
// 【レゴ物理環境＆装備・25枠圧縮木箱・投擲モジュール：rules_dig.js（v7.1 気持ち枠拡大版）】
// ・メイン画面のキャラの気持ち枠(#message-box)の上下サイズ＆テキストサイズを拡大
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
      pocket: {
        soil: 0,
        wood: 0,
        stone: 0,
        shovel: 0
      },
      headSoil: 0,
      equip: {
        head: null,
        body: null,
        waist: null,
        back: null,
        hand: null,
        feet: null
      },
      crates: [
        {
          id: 'crate_1',
          areaId: 'home',
          x: -1,
          z: 0,
          slots: createEmptyCrateSlots(true)
        }
      ],
      dugCells: {},
      worldSubSoils: {},
      worldDroppedItems: []
    };
  }

  let DIG_STATE = createDefaultState();
  let lastTurnActionId = null;
  let lastMoveVisualKind = null;
  let activeCrateModalId = null;

  const _origGetSurfaceYAt = (typeof getSurfaceYAt === 'function') ? getSurfaceYAt : null;

  // メイン画面のキャラの気持ち枠(#message-box)を上下拡大＆文字サイズ拡大
  function enhanceMessageBoxUI() {
    const msgEl = document.getElementById('message-box');
    if (!msgEl) return;
    msgEl.style.fontSize = '16px';
    msgEl.style.lineHeight = '1.5';
    msgEl.style.fontWeight = '700';
    msgEl.style.minHeight = '96px';
    msgEl.style.maxHeight = '148px';
    msgEl.style.padding = '10px 12px';
    msgEl.style.overflowY = 'auto';
    msgEl.style.display = 'block';
    msgEl.style.boxSizing = 'border-box';
    msgEl.style.color = '#0f172a';
    msgEl.style.webkitOverflowScrolling = 'touch';
    if (msgEl.parentElement) {
      msgEl.parentElement.style.height = 'auto';
      msgEl.parentElement.style.maxHeight = 'none';
    }
  }

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
      handSoilMax: hRank,
      handShovelMax: HAND_SHOVEL_MAX,
      throwToolMax: hRank + 2,
      throwSoilMax: hRank + 1,
      standH,
      crawlH,
      stairMax,
      climbMax: hRank,
      bodyHeight,
      maxStackHeight: hRank * 2,
      maxStepUpSub: isCrawl ? 1 : hRank
    };
  }

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

    for (let i = 0; i < slots.length && rem > 0; i++) {
      const s = slots[i];
      if (s && s.id === itemId && s.count < maxPerSlot) {
        const take = Math.min(rem, maxPerSlot - s.count);
        s.count += take;
        rem -= take;
        added += take;
      }
    }
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
      if (actEl) actEl.innerText = '🌱 v7.1検証環境を初期化しました';
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
    enhanceMessageBoxUI();
    renderDiaryFullUI();
  }

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
    enhanceMessageBoxUI();
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
