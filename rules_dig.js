// ============================================================================
// 【レゴ物理環境＆装備・25枠圧縮木箱・投擲モジュール：rules_dig.js（v7.0 完全版）】
// ・手帳最上部：正面キャラプレビュー＋左右6装備枠（左:頭/体/腰、右:背/手/足）
// ・手帳下部10枠：すべてキャラ所持枠（1〜9枠:ポケット / 10枠目:頭上ピラミッド専用アイコン）
// ・圧縮木箱（名称統一・5×5=25枠）：3Dタップ＆手帳独立ボタンから25枠ウィンドウを開閉
//   - 素材類1枠10個 / 道具類1枠5本 / 初期状態は1枠目にテスト用スコップ1本、キャラは完全手ぶら
// ・手枠（排他・1種類のみ）：空 / スコップ(最大2本) / 土(高さ分:1〜5、資源上限1〜55をポケットと共有)
// ・掘削（体格範囲内鉄則）：素手=1個 / スコップ1本=最大5個 / スコップ2本・土所持中=掘削不可
// ・投擲（放物線・ランダム飛距離）：頭上ピラミッド保持時は不可、手枠分を一気に投擲
//   - スコップ: 最大(高さ+2)、通り抜け可、視界記号Sで回収可
//   - 土: 最大(高さ+1)、複数個はランダム散らばり、縦1倍障害物越え、階段等からキャラ手前へ転がり落ち
// ※ index.html / brain.js / world.js / entities.js は無改造、ai_comm.js(v4.0) と連携動作します
// ============================================================================
(function initDigRulesModule() {
  if (window.DigRulesModule) return;

  const STORAGE_KEY       = 'rules_dig_state_v7_0_equip_crate';
  const CLEAN_ENV_TAG     = 'clean_flat_stairs_v7_0';
  const SUB_SIZE          = 0.2;
  const CRATE_SLOTS_COUNT = 25; // 縦5×横5枠
  const STACK_LIMIT_SOIL  = 10; // 素材類：圧縮木箱1枠10個
  const STACK_LIMIT_TOOL  = 5;  // 道具類：圧縮木箱・ポケット共1枠5本
  const POCKET_SLOT_COUNT = 9;  // 下部10枠のうち1〜9枠がポケット（10枠目は頭上ピラミッド専用）
  const PORTAL_CORNER_POS = { x: -2, z: -2 };

  const HEIGHT_RANK = { tiny: 1, small: 2, medium: 3, large: 4, giant: 5 };
  const WIDTH_RANK  = { slim1: 1, slim2: 2, normal3: 3, fat4: 4, fat5: 5 };

  // 全25体格マトリクス（資源合計上限：1〜55個）
  const POCKET_CAP_TABLE = {
    1: [1,  2,  4,  5,  7],
    2: [2,  5,  8, 12, 16],
    3: [4,  8, 14, 20, 28],
    4: [5, 12, 20, 30, 41],
    5: [7, 16, 28, 41, 55]
  };
  const PYRAMID_MAX_BY_WIDTH = [0, 1, 5, 14, 30, 55];

  const ITEM_META = {
    soil:   { name: '土',       icon: '🟫', kind: 'material', crateStack: STACK_LIMIT_SOIL, pocketStack: null },
    shovel: { name: 'スコップ', icon: '⛏️', kind: 'tool',     crateStack: STACK_LIMIT_TOOL, pocketStack: STACK_LIMIT_TOOL }
  };

  function createEmptyCrateSlots(withTestShovel = false) {
    const slots = new Array(CRATE_SLOTS_COUNT).fill(null);
    if (withTestShovel) {
      slots[0] = { type: 'shovel', count: 1 };
    }
    return slots;
  }

  function createDefaultState() {
    return {
      envTag: CLEAN_ENV_TAG,
      pocketSoil: 0,
      pocketShovels: 0,
      headSoil: 0,
      equip: {
        head: null,
        body: null,
        waist: null,
        back: null,
        hand: null, // null | { type: 'shovel'|'soil', count: number }
        feet: null
      },
      crates: [
        {
          id: 'crate_1',
          areaId: 'home',
          x: -1,
          z: 0,
          slots: createEmptyCrateSlots(true) // テスト用スコップ1本入り
        }
      ],
      dugCells: {},
      worldSubSoils: {}, // `${areaId}|${absX},${absZ}|${floorSubY}` -> count
      worldItems: []     // { id, areaId, type: 'shovel', absX, absZ, floorSubY }
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
      label: key,
      subH: h,
      scaleY: h * 0.2,
      standH: h,
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
      handSoilCap: hRank, // 極小1 / 小2 / 標準3 / 大4 / 巨大5
      handShovelCap: 2,   // 手枠スコップ最大2本
      throwToolMaxDist: hRank + 2, // 控えめ案：極小3〜巨大7
      throwSoilMaxDist: hRank + 1, // 控えめ案：極小2〜巨大6
      standH,
      crawlH,
      stairMax,
      climbMax: hRank,
      bodyHeight,
      maxStackHeight: hRank * 2,
      maxStepUpSub: isCrawl ? 1 : hRank
    };
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

  // ポケット＋手枠の資源合計（上限1〜55を共有）
  function getHandSoilCount() {
    return (DIG_STATE.equip && DIG_STATE.equip.hand && DIG_STATE.equip.hand.type === 'soil')
      ? Math.max(0, Math.floor(DIG_STATE.equip.hand.count || 0))
      : 0;
  }

  function getHandShovelCount() {
    return (DIG_STATE.equip && DIG_STATE.equip.hand && DIG_STATE.equip.hand.type === 'shovel')
      ? Math.max(0, Math.floor(DIG_STATE.equip.hand.count || 0))
      : 0;
  }

  function getResourceTotalCount() {
    return Math.max(0, Math.floor(DIG_STATE.pocketSoil || 0)) + getHandSoilCount();
  }

  // ポケット9枠の現在使用スロット数（資源種類＋スコップ5本毎）
  function getUsedPocketSlots() {
    let used = 0;
    if ((DIG_STATE.pocketSoil || 0) > 0) used += 1;
    if ((DIG_STATE.pocketShovels || 0) > 0) used += Math.ceil(DIG_STATE.pocketShovels / STACK_LIMIT_TOOL);
    return used;
  }

  function getMaxAdditionalShovelsForPocket() {
    const curShovels = Math.max(0, Math.floor(DIG_STATE.pocketShovels || 0));
    const remInLastStack = (curShovels % STACK_LIMIT_TOOL === 0) ? 0 : (STACK_LIMIT_TOOL - (curShovels % STACK_LIMIT_TOOL));
    const freeSlots = Math.max(0, POCKET_SLOT_COUNT - getUsedPocketSlots());
    return remInLastStack + freeSlots * STACK_LIMIT_TOOL;
  }

  // 体格縮小時に手枠の土が上限を超えた場合の安全補正
  function normalizeHandEquipForBodySize() {
    if (!DIG_STATE.equip) {
      DIG_STATE.equip = { head: null, body: null, waist: null, back: null, hand: null, feet: null };
    }
    const h = DIG_STATE.equip.hand;
    if (!h) return;
    if (!h.count || h.count <= 0) {
      DIG_STATE.equip.hand = null;
      return;
    }
    const stats = getSizeStats();
    if (h.type === 'soil' && h.count > stats.handSoilCap) {
      const overflow = h.count - stats.handSoilCap;
      h.count = stats.handSoilCap;
      DIG_STATE.pocketSoil = (DIG_STATE.pocketSoil || 0) + overflow;
    } else if (h.type === 'shovel' && h.count > stats.handShovelCap) {
      const overflow = h.count - stats.handShovelCap;
      h.count = stats.handShovelCap;
      DIG_STATE.pocketShovels = (DIG_STATE.pocketShovels || 0) + overflow;
    }
  }

  // 圧縮木箱（25枠）操作ヘルパー
  function ensureCrateSlots(crate) {
    if (!crate) return;
    if (!Array.isArray(crate.slots) || crate.slots.length !== CRATE_SLOTS_COUNT) {
      const next = createEmptyCrateSlots(false);
      if (Array.isArray(crate.slots)) {
        for (let i = 0; i < Math.min(crate.slots.length, CRATE_SLOTS_COUNT); i++) {
          const s = crate.slots[i];
          if (s && s.type && s.count > 0) next[i] = { type: s.type, count: Math.floor(s.count) };
        }
      }
      crate.slots = next;
    }
  }

  function getCrateSummary(crate) {
    ensureCrateSlots(crate);
    let usedSlots = 0;
    let soil = 0;
    let shovel = 0;
    for (let i = 0; i < CRATE_SLOTS_COUNT; i++) {
      const s = crate.slots[i];
      if (!s || s.count <= 0) continue;
      usedSlots++;
      if (s.type === 'soil') soil += s.count;
      else if (s.type === 'shovel') shovel += s.count;
    }
    return { usedSlots, freeSlots: CRATE_SLOTS_COUNT - usedSlots, soil, shovel };
  }

  function addItemToCrate(crate, type, amount) {
    ensureCrateSlots(crate);
    const meta = ITEM_META[type];
    if (!meta || amount <= 0) return 0;
    const maxPerSlot = meta.crateStack;
    let rem = Math.floor(amount);
    let added = 0;

    // 既存同種スロットへ補充
    for (let i = 0; i < CRATE_SLOTS_COUNT && rem > 0; i++) {
      const s = crate.slots[i];
      if (s && s.type === type && s.count < maxPerSlot) {
        const put = Math.min(rem, maxPerSlot - s.count);
        s.count += put;
        rem -= put;
        added += put;
      }
    }
    // 空スロットへ新規配置
    for (let i = 0; i < CRATE_SLOTS_COUNT && rem > 0; i++) {
      if (!crate.slots[i]) {
        const put = Math.min(rem, maxPerSlot);
        crate.slots[i] = { type, count: put };
        rem -= put;
        added += put;
      }
    }
    return added;
  }

  function removeItemFromCrate(crate, type, amount) {
    ensureCrateSlots(crate);
    if (amount <= 0) return 0;
    let rem = Math.floor(amount);
    let removed = 0;

    // 後ろのスロットから優先して取り出す
    for (let i = CRATE_SLOTS_COUNT - 1; i >= 0 && rem > 0; i--) {
      const s = crate.slots[i];
      if (s && s.type === type && s.count > 0) {
        const take = Math.min(rem, s.count);
        s.count -= take;
        rem -= take;
        removed += take;
        if (s.count <= 0) crate.slots[i] = null;
      }
    }
    return removed;
  }

  function saveDigState() {
    try {
      if (typeof safeStorage !== 'undefined') {
        safeStorage.setItem(STORAGE_KEY, JSON.stringify(DIG_STATE));
      }
    } catch (e) {}
  }

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

  // --------------------------------------------------------------------------
  // 0. クリーン検証環境構築（平坦地上＋地下全埋め＋5段階段＋高台1ブロック＋圧縮木箱1）
  // --------------------------------------------------------------------------
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

      DIG_STATE = createDefaultState();
      DIG_STATE.dugCells['home|0,-1,1'] = stairTags.slice();
    } else {
      DIG_STATE = createDefaultState();
    }

    if (resetStatus && typeof ROBOT !== 'undefined' && ROBOT) {
      ROBOT.pos = { x: 0, z: 0, lv: 0, sx: 2, sz: 2, subY: 0 };
