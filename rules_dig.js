// ============================================================================
// 【レゴ物理環境＆1人称純粋知覚モジュール：rules_dig.js（v6.2 上書き復元完全遮断・再スタート確定版）】
// ・entities.js の遅延フェード復元(HOME_SAVE_DATA)＆クラウド旧データ巻き戻りを完全遮断
// ・初期エリア(home)固定・地下全埋め平坦地上・地上5段階段(0,-1)＋高台1ブロック(0,-2)・圧縮木箱(-1,0)
// ・ポータル移動停止＆既存パステル入口アイコンを北西端(-2,-2)に1つだけ退避配置（二重表示解消）
// ・ポケット内旧アイテム全削除・こども用シャベル全削除・1日目/体力100のまっさら再スタート
// ・水際外周保護壁の掘削除外・木箱の距離1分割厳密判定・全25体格×8方向占有端基準・SIZE_SPECS原本リンク
// ※ index.html / brain.js / world.js / entities.js / ai_comm.js(v3.9) は無改造のまま動作します
// ============================================================================
(function initDigRulesModule() {
  if (window.DigRulesModule) return;

  const STORAGE_KEY       = 'rules_dig_state_v6_2_clean';
  const CLEAN_ENV_TAG     = 'clean_flat_stairs_v6_2';
  const SUB_SIZE          = 0.2;
  const CRATE_CAPACITY    = 220;
  const PORTAL_CORNER_POS = { x: -2, z: -2 }; // ポータル入口アイコン退避先（北西の端）

  const HEIGHT_RANK = { tiny: 1, small: 2, medium: 3, large: 4, giant: 5 };
  const WIDTH_RANK  = { slim1: 1, slim2: 2, normal3: 3, fat4: 4, fat5: 5 };

  // 全25体格マトリクス（ポケット上限：1〜55個）
  const POCKET_CAP_TABLE = {
    1: [1,  2,  4,  5,  7],
    2: [2,  5,  8, 12, 16],
    3: [4,  8, 14, 20, 28],
    4: [5, 12, 20, 30, 41],
    5: [7, 16, 28, 41, 55]
  };
  // 太さWに対するピラミッド実数（1²〜5²累積）
  const PYRAMID_MAX_BY_WIDTH = [0, 1, 5, 14, 30, 55];

  function createDefaultState() {
    return {
      envTag: CLEAN_ENV_TAG,
      pocketSoil: 0,
      headSoil: 0,
      crates: [
        { id: 'crate_1', areaId: 'home', x: -1, z: 0, capacity: CRATE_CAPACITY, soil: 0 }
      ],
      dugCells: {},
      worldSubSoils: {} // key: `${areaId}|${absX},${absZ}|${floorSubY}` -> count
    };
  }

  let DIG_STATE = createDefaultState();
  let lastTurnActionId = null;
  let lastMoveVisualKind = null;

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

  // brain.js の SIZE_SPECS / BODY_SPECS（原本）を直接リンク参照
  function getOriginalSizeSpec() {
    const key = (typeof ROBOT !== 'undefined' && ROBOT.sizeLevel) || 'tiny';
    if (typeof SIZE_SPECS !== 'undefined' && SIZE_SPECS[key]) {
      return SIZE_SPECS[key];
    }
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
    if (typeof BODY_SPECS !== 'undefined' && BODY_SPECS[key]) {
      return BODY_SPECS[key];
    }
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
      standH,
      crawlH,
      stairMax,
      climbMax: hRank,
      bodyHeight,
      maxStackHeight: hRank * 2,
      maxStepUpSub: isCrawl ? 1 : hRank
    };
  }

  // ポケット内は純粋に分割土のみ（旧BAG / WORLD_ITEMS / フィールド生き物は常に空）
  function purgeLegacyItems() {
    if (typeof BAG !== 'undefined' && Array.isArray(BAG) && BAG.length > 0) {
      BAG.length = 0;
    }
    if (typeof WORLD_ITEMS !== 'undefined' && Array.isArray(WORLD_ITEMS) && WORLD_ITEMS.length > 0) {
      WORLD_ITEMS.length = 0;
    }
    if (window.ACTIVE_ENTITIES) {
      window.ACTIVE_ENTITIES.npc = null;
      window.ACTIVE_ENTITIES.enemy = null;
      window.ACTIVE_ENTITIES.wildPet = null;
      window.ACTIVE_ENTITIES.guestNpc = null;
    }
  }

  function getResourceTotalCount() {
    return Math.max(0, Math.floor(DIG_STATE.pocketSoil || 0));
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
  // 0. シンプル検証環境の構築（平坦地上＋地下全埋め＋5段階段＋高台1ブロック＋木箱1＋端ポータル1）
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
    // (0, -1, lv=1) を南側(sz=4)から北側(sz=0)へ1分割ずつ上がる5段階段にする
    const tags = [];
    for (let sz = 4; sz >= 1; sz--) {
      const keepHeight = 5 - sz; // sz=4->1段, sz=3->2段, sz=2->3段, sz=1->4段, sz=0->5段
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
    if (HEIGHT_MAP['1,2'] === 1) return false; // 旧初期高台が残っていれば旧データ
    return true;
  }

  function applyCleanTestTerrain(resetStatus = true) {
    relocatePortalsToCorner();

    // 重要：別エリアにいる場合は必ず同期(withFade=false)でhomeへ戻し、遅延上書きを絶対に起こさせない
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

    // 1. 地下(-4〜0)まで完全に土で埋め詰まった平坦地上を作成
    if (typeof HEIGHT_MAP !== 'undefined') {
      for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
          HEIGHT_MAP[`${x},${z}`] = 0;
        }
      }
      // 2. 地上の5段階段 (0,-1) ＋ 階段に繋がる高台1ブロック (0,-2) の計2マスを構築
      HEIGHT_MAP['0,-1'] = 1;
      HEIGHT_MAP['0,-2'] = 1;
    }

    // 3. 地下穴・旧トンネル・削り跡をすべて消去し、5段階段のみ構築
    if (typeof CHIP_MAP !== 'undefined') {
      Object.keys(CHIP_MAP).forEach(k => delete CHIP_MAP[k]);
      const stairTags = buildStairTagsFor5StepNorth();
      CHIP_MAP['0,-1,1'] = {};
      stairTags.forEach(tag => { CHIP_MAP['0,-1,1'][tag] = true; });

      DIG_STATE.dugCells = {};
      DIG_STATE.dugCells['home|0,-1,1'] = stairTags.slice();
    }

    DIG_STATE.envTag = CLEAN_ENV_TAG;
    DIG_STATE.pocketSoil = 0;
    DIG_STATE.headSoil = 0;
    DIG_STATE.worldSubSoils = {};
    DIG_STATE.crates = [
      { id: 'crate_1', areaId: 'home', x: -1, z: 0, capacity: CRATE_CAPACITY, soil: 0 }
    ];

    if (resetStatus && typeof ROBOT !== 'undefined' && ROBOT) {
      ROBOT.pos = { x: 0, z: 0, lv: 0, sx: 2, sz: 2, subY: 0 };
      ROBOT.rotY = Math.PI; // 北向き（正面に5段階段、左に圧縮木箱）
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
        DIARY_LOGS.push('🌱 1日目：平らな島・5段階段・圧縮木箱の検証環境でスタート');
      }
      const actEl = document.getElementById('history-action');
      const msgEl = document.getElementById('message-box');
      if (actEl) actEl.innerText = '🌱 検証環境を初期化しました';
      if (msgEl) msgEl.innerText = '平らな島（5段階段＋高台1ブロック＋圧縮木箱）で待機中。「⚡今すぐ考える」でスタートできます。';
      if (window.AICommCore && typeof window.AICommCore.resetPhysicalHistory === 'function') {
        window.AICommCore.resetPhysicalHistory();
      }
    }

    // entities.js の HOME_SAVE_DATA も新地形で上書き同期
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
    renderPocketAndCrateDiaryUI();
  }

  // 旧ボタンイベント除去 ＆ 旧ツール完全非表示 ＆ 頭上ピラミッド3D土台
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
  if (typeof robotGroup !== 'undefined' && robotGroup) {
    robotGroup.add(headPyramidGroup);
  }

  // --------------------------------------------------------------------------
  // 1. 厳密5×5×5サブ座標ユーティリティ（占有端・水際保護・重力・床・天井・木箱）
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
      if (hasSolidTerrainAtAbsSubY(absX, y, absZ)) {
        return y + 1;
      }
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
            if (!Number.isFinite(DIG_STATE.headSoil)) DIG_STATE.headSoil = 0;
            if (!Number.isFinite(DIG_STATE.pocketSoil)) DIG_STATE.pocketSoil = 0;
            if (!Array.isArray(DIG_STATE.crates) || !DIG_STATE.crates.length) {
              DIG_STATE.crates = createDefaultState().crates;
            } else {
              DIG_STATE.crates.forEach(c => {
                if (!c.capacity || c.capacity < CRATE_CAPACITY) c.capacity = CRATE_CAPACITY;
              });
            }
            if (!DIG_STATE.worldSubSoils || typeof DIG_STATE.worldSubSoils !== 'object') {
              DIG_STATE.worldSubSoils = {};
            }
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
  // 2. A案：キャラの1人称視野記号マップ（厳密DDA視線・木箱遮蔽・段差高さ整合）
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

    const fx = best.dx;
    const fz = best.dz;
    const rx = -fz;
    const rz = fx;

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
    const dot = cx * tx + cz * tz;
    return dot < -0.38;
  }

  function isVisibleFromEye(curAbsX, curAbsZ, eyeSubY, targetAbsX, targetAbsZ) {
    const x0 = Math.round(curAbsX);
    const z0 = Math.round(curAbsZ);
    const x1 = Math.round(targetAbsX);
    const z1 = Math.round(targetAbsZ);
    if (x0 === x1 && z0 === z1) return true;

    const areaId = getCurAreaId();
    const dx = x1 - x0;
    const dz = z1 - z0;
    const stepX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
    const stepZ = dz > 0 ? 1 : (dz < 0 ? -1 : 0);

    const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tMaxX = dx !== 0 ? (0.5 * tDeltaX) : Infinity;
    let tMaxZ = dz !== 0 ? (0.5 * tDeltaZ) : Infinity;

    let cx = x0;
    let cz = z0;
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
        cx += stepX;
        cz += stepZ;
        tMaxX += tDeltaX;
        tMaxZ += tDeltaZ;
      } else if (tMaxX < tMaxZ) {
        cx += stepX;
        tMaxX += tDeltaX;
      } else {
        cz += stepZ;
        tMaxZ += tDeltaZ;
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
        if (fwd === 0 && lat === 0) {
          row += ' @ ';
          continue;
        }
        if (isMoving) {
          if (fwd === 0 && Math.abs(lat) > 0) { row += ' ? '; continue; }
          if (fwd === 1 && Math.abs(lat) > 1) { row += ' ? '; continue; }
          if (fwd === 2 && Math.abs(lat) > 2) { row += ' ? '; continue; }
        }

        const tx = absX + basis.fx * fwd + basis.rx * lat;
        const tz = absZ + basis.fz * fwd + basis.rz * lat;

        if (!isInsideIslandAbs(tx, tz)) {
          row += ' ~ ';
          continue;
        }
        if (!isVisibleFromEye(absX, absZ, eyeSubY, tx, tz)) {
          row += ' ? ';
          continue;
        }

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
              if (hasSolidTerrainAtAbsSubY(tx, baseSubY + h, tz)) {
                hasLowCeiling = true;
                break;
              }
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
        if (!isInsideIslandAbs(tx, tz)) {
          row += ' ~ ';
          continue;
        }
        const curY = baseSubY + h;
        if (hasSolidTerrainAtAbsSubY(tx, curY, tz)) {
          row += ' # ';
        } else if (hasLooseSoilAtSubY(tx, curY, tz, areaId)) {
          row += ' o ';
        } else if (isCrateBlockingAtSubY(tx, curY, tz, areaId)) {
          row += ' B ';
        } else {
          row += ' . ';
        }
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
      `記号: @=自分 #=壁(高2以上) +=1段高 ^=高1空洞(高2以上に壁/低天井) .=平坦/空間 v=低い床/穴 1-9/o=散らばり土(段数) B=圧縮木箱(5x5x5) ~=端 ?=死角`
    ].join('\n');
  }

  // --------------------------------------------------------------------------
  // 3. 3D描画（圧縮木箱・散らばり土・頭上ピラミッド ※端っこポータルはentities.js純正を使用）
  // --------------------------------------------------------------------------
  const digVisualGroup = new THREE.Group();
  digVisualGroup.name = 'dig_rules_visual_group';
  if (typeof scene !== 'undefined' && scene) scene.add(digVisualGroup);

  const unitBoxGeo  = new THREE.BoxGeometry(SUB_SIZE * 0.96, SUB_SIZE * 0.96, SUB_SIZE * 0.96);
  const unitEdgeGeo = new THREE.EdgesGeometry(unitBoxGeo);
  const soilMatLight = new THREE.MeshLambertMaterial({ color: 0xd9a875 });
  const soilMatDark  = new THREE.MeshLambertMaterial({ color: 0xc68e5a });
  const soilEdgeMat  = new THREE.LineBasicMaterial({ color: 0x7c4a21, transparent: true, opacity: 0.42 });

  function buildCrateMesh(crate) {
    const grp = new THREE.Group();
    const boxSize = SUB_SIZE * 5;
    const yBase = _origGetSurfaceYAt ? _origGetSurfaceYAt(crate.x, crate.z, null, 5) : 0;
    grp.position.set(crate.x, yBase, crate.z);

    const woodMat  = new THREE.MeshLambertMaterial({ color: 0xe6be8a });
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x9a6b43 });
    const bandMat  = new THREE.MeshLambertMaterial({ color: 0x475569 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(boxSize * 0.96, boxSize * 0.90, boxSize * 0.96), woodMat);
    body.position.y = boxSize * 0.45;
    grp.add(body);

    const rimTop = new THREE.Mesh(new THREE.BoxGeometry(boxSize, 0.08, boxSize), frameMat);
    rimTop.position.y = boxSize * 0.92;
    grp.add(rimTop);

    const band = new THREE.Mesh(new THREE.BoxGeometry(boxSize * 0.99, 0.07, boxSize * 0.99), bandMat);
    band.position.y = boxSize * 0.45;
    grp.add(band);

    if (crate.soil > 0) {
      const ratio = Math.min(1, crate.soil / (crate.capacity || CRATE_CAPACITY));
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

  function renderDigVisuals() {
    while (digVisualGroup.children.length) digVisualGroup.remove(digVisualGroup.children[0]);
    renderHeadPyramidVisual();
    const areaId = getCurAreaId();

    DIG_STATE.crates.forEach(c => {
      if (c.areaId === areaId) digVisualGroup.add(buildCrateMesh(c));
    });

    Object.keys(DIG_STATE.worldSubSoils).forEach(k => {
      const count = DIG_STATE.worldSubSoils[k] || 0;
      if (count <= 0) return;
      const p = parseSoilKey(k);
      if (!p || p.areaId !== areaId) return;
      if (!isInsideIslandAbs(p.absX, p.absZ)) return;

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
  }

  // --------------------------------------------------------------------------
  // 4. 物理アクション実装（純粋な物理結果のみ返却・誘導なし）
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
      for (let ox = minOff; ox <= maxOff; ox++) {
        cells.push({ absX: curAbsX + ox, absZ: curAbsZ + frontEdge.oz });
      }
    } else if (dz === 0 && dx !== 0) {
      for (let oz = minOff; oz <= maxOff; oz++) {
        cells.push({ absX: curAbsX + frontEdge.ox, absZ: curAbsZ + oz });
      }
    } else {
      const px = -dz;
      const pz = dx;
      for (let w = minOff; w <= maxOff; w++) {
        cells.push({
          absX: curAbsX + frontEdge.ox + px * w,
          absZ: curAbsZ + frontEdge.oz + pz * w
        });
      }
    }

    const rx = -dz;
    const rz = dx;
    const t = String(thought || '');
    const lateralScore = (c) => (c.absX - curAbsX) * rx + (c.absZ - curAbsZ) * rz;
    if (t.includes('左')) {
      cells.sort((a, b) => lateralScore(a) - lateralScore(b));
    } else if (t.includes('右')) {
      cells.sort((a, b) => lateralScore(b) - lateralScore(a));
    } else {
      cells.sort((a, b) => Math.abs(lateralScore(a)) - Math.abs(lateralScore(b)));
    }
    return cells;
  }

  function hasUnreachableUpperWallInFront(dir, stats) {
    const { absX: curAbsX, absZ: curAbsZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const frontCells = buildFrontRowCells(curAbsX, curAbsZ, dir, stats, '');
    for (let i = 0; i < frontCells.length; i++) {
      for (let h = stats.reachH; h <= 4; h++) {
        if (hasSolidTerrainAtAbsSubY(frontCells[i].absX, baseSubY + h, frontCells[i].absZ)) {
          return true;
        }
      }
    }
    return false;
  }

  function findDigTargetByMode(mode, dir, thought) {
    const stats = getSizeStats();
    const { absX: curAbsX, absZ: curAbsZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    let hitWaterProtected = false;

    const checkCell = (absX, totalSubY, absZ, kindLabel) => {
      if (!isInsideIslandAbs(absX, absZ)) return null;
      const tX = absToTile(absX);
      const tZ = absToTile(absZ);
      const yInfo = subYToLvSy(totalSubY);
      if (!hasSolidTerrainSubVoxel(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) return null;
      if (!isExposedToAir(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) return null;
      if (isWaterProtectedCell(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) {
        hitWaterProtected = true;
        return null;
      }
      return {
        tx: tX.tile, tz: tZ.tile, lv: yInfo.lv,
        tsx: tX.sub, tsy: yInfo.sy, tsz: tZ.sub,
        absX, absZ, totalSubY, kind: kindLabel
      };
    };

    if (mode === 'front') {
      const frontCells = buildFrontRowCells(curAbsX, curAbsZ, dir, stats, thought);
      for (let h = stats.reachH - 1; h >= 0; h--) {
        for (let i = 0; i < frontCells.length; i++) {
          const hit = checkCell(frontCells[i].absX, baseSubY + h, frontCells[i].absZ, '壁');
          if (hit) return { target: hit, hitWaterProtected: false };
        }
      }
      return { target: null, hitWaterProtected };
    }

    if (mode === 'down') {
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

      for (let g = 0; g < groups.length; g++) {
        const list = groups[g].list;
        for (let i = 0; i < list.length; i++) {
          const hit = checkCell(list[i].absX, baseSubY - 1, list[i].absZ, groups[g].label);
          if (hit) return { target: hit, hitWaterProtected: false };
        }
      }
      return { target: null, hitWaterProtected };
    }

    if (mode === 'up') {
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

      for (let h = minCeilH; h <= maxCeilH; h++) {
        for (let i = 0; i < topCells.length; i++) {
          const hit = checkCell(topCells[i].absX, baseSubY + h, topCells[i].absZ, '頭上の天井');
          if (hit) return { target: hit, hitWaterProtected: false };
        }
      }
      return { target: null, hitWaterProtected };
    }

    return { target: null, hitWaterProtected: false };
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
          absX: target.absX,
          absZ: target.absZ,
          floorSubY: fallFloorY,
          fellDown: isDeepFall,
          note: isDeepFall ? '下の空間の底へ落下した' : '真下の床へ落ちた'
        };
      }
    }

    if (dx !== 0 || dz !== 0) {
      const bx = target.absX + dx;
      const bz = target.absZ + dz;
      if (isInsideIslandAbs(bx, bz) && !isCrateBlockingAtSubY(bx, target.totalSubY, bz, areaId) &&
          !hasSolidTerrainAtAbsSubY(bx, target.totalSubY, bz)) {
        const behindFloorY = findFloorSubYBelow(bx, bz, target.totalSubY);
        const isDeepFall = (behindFloorY < baseSubY);
        if (canPlaceOnFloor(bx, bz, behindFloorY, isDeepFall)) {
          return {
            absX: bx,
            absZ: bz,
            floorSubY: behindFloorY,
            fellDown: isDeepFall,
            note: isDeepFall ? '奥の空間から底まで落下した' : '奥の空き空間へ転がり落ちた'
          };
        }
      }
    }

    const { minOff, maxOff } = getFootprintBounds(stats.reachW);
    const spreadSpan = stats.reachW;
    const minSearch = minOff - spreadSpan;
    const maxSearch = maxOff + spreadSpan;
    const candidates = [];

    for (let ox = minSearch; ox <= maxSearch; ox++) {
      for (let oz = minSearch; oz <= maxSearch; oz++) {
        const tx = rAbsX + ox;
        const tz = rAbsZ + oz;
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

        candidates.push({
          absX: tx,
          absZ: tz,
          ox,
          oz,
          floorSubY: chosenFloorY,
          stack,
          dist,
          heightDiff,
          rearPenalty
        });
      }
    }

    if (!candidates.length) return null;

    candidates.sort((a, b) =>
      (a.heightDiff * 3.0 + a.stack * 2.0 + a.rearPenalty + a.dist * 0.4) -
      (b.heightDiff * 3.0 + b.stack * 2.0 + b.rearPenalty + b.dist * 0.4)
    );
    const chosen = candidates[0];
    const relPosText = describeRelativeDropPosition(chosen.ox, chosen.oz, chosen.heightDiff);
    return {
      absX: chosen.absX,
      absZ: chosen.absZ,
      floorSubY: chosen.floorSubY,
      fellDown: false,
      note: `${relPosText}へ散らばった`
    };
  }

  function runSubDigByMode(mode, dir, thought) {
    if (mode !== 'up' && isBehindCurrentFacing(dir)) {
      const verb = mode === 'down' ? '地面掘削' : '壁掘削';
      return runTurnAroundOnly(dir, verb);
    }

    if (mode !== 'up' && dir && Number.isFinite(dir.rot)) {
      ROBOT.rotY = dir.rot;
    }

    const dName = (dir && dir.name) ? dir.name.replace('(斜め)', '') : '正面';
    const stats = getSizeStats();
    const { target, hitWaterProtected } = findDigTargetByMode(mode, dir, thought);

    if (!target) {
      if (hitWaterProtected) {
        return {
          actionLabel: `🛡️ 島の外周（水際の保護壁）は削れなかった`,
          physicalResult: `そこは島の外周（水際の保護壁）のため削れなかった`,
          moved: false
        };
      }
      if (mode === 'front') {
        if (hasUnreachableUpperWallInFront(dir, stats)) {
          const reachLabel = stats.reachH === 1 ? '高1' : `高1〜${stats.reachH}`;
          return {
            actionLabel: `⛏️ ${dName}の上部壁(高${stats.reachH + 1}以上)には背が届かず空振りした`,
            physicalResult: `${dName}方向の目の前距離1は自分の届く高さ(${reachLabel})が既に空洞で、残っている上部の壁(高${stats.reachH + 1}以上)には背が届かず空振りした`,
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
        actionLabel: `⛏️ 頭上の天井を削ろうとしたが空振りした`,
        physicalResult: `頭上の届く高さに削れる天井ブロックがなく空振りした`,
        moved: false
      };
    }

    const dropPos = findDropSlotForDugSoil(target, dir, stats);
    if (!dropPos) {
      return {
        actionLabel: `🧱 周囲の土が満杯で掘れなかった（片付けが必要）`,
        physicalResult: `${target.kind}を削ろうとしたが、周囲の床がすべて積み上限(${stats.maxStackHeight}段)まで埋まっており置き場がないため掘れなかった`,
        moved: false
      };
    }

    const chipKey = `${target.tx},${target.tz},${target.lv}`;
    const tag = `${target.tsx},${target.tsy},${target.tsz}`;
    if (typeof CHIP_MAP !== 'undefined') {
      if (!CHIP_MAP[chipKey]) CHIP_MAP[chipKey] = {};
      CHIP_MAP[chipKey][tag] = true;
    }

    const areaId = getCurAreaId();
    const stateKey = `${areaId}|${chipKey}`;
    if (!DIG_STATE.dugCells[stateKey]) DIG_STATE.dugCells[stateKey] = [];
    if (!DIG_STATE.dugCells[stateKey].includes(tag)) DIG_STATE.dugCells[stateKey].push(tag);

    settleFloatingLooseSoilsAtColumn(target.absX, target.absZ, areaId);
    addLooseSoilAtFloor(dropPos.absX, dropPos.absZ, dropPos.floorSubY, 1, areaId);
    const totalHere = getLooseSoilAtFloor(dropPos.absX, dropPos.absZ, dropPos.floorSubY, areaId);

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

    life.stamina = Math.max(0, life.stamina - 4);
    life.mental = Math.min(100, life.mental + 4);
    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    saveDigState();

    const dirPrefix = (mode === 'up' || target.kind === '足元の床') ? '' : `${dName}の`;
    return {
      actionLabel: `⛏️ ${dirPrefix}${target.kind}を1分割削った(${dropPos.fellDown ? '下方へ落下' : `積${totalHere}/${stats.maxStackHeight}段`})`,
      physicalResult: `${dirPrefix}${target.kind}を1分割削り、土は${dropPos.note}(その場の積み段数${totalHere})${fallText}`,
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

  function runPickupSoil() {
    const stats = getSizeStats();
    const areaId = getCurAreaId();
    const { absX, absZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();

    const pocketFree = Math.max(0, stats.pocketCap - getResourceTotalCount());
    const headFree   = Math.max(0, stats.headCap - (DIG_STATE.headSoil || 0));

    if (pocketFree <= 0 && headFree <= 0) {
      return {
        actionLabel: `🟫 ポケット(${getResourceTotalCount()}/${stats.pocketCap})も頭上(${DIG_STATE.headSoil}/${stats.headCap})も満杯`,
        physicalResult: `ポケットも頭上ピラミッドも上限に達しており、これ以上拾えなかった`,
        moved: false
      };
    }

    const searchRadius = Math.max(3, Math.floor(stats.reachW / 2) + 2);
    const nearby = findNearbyLooseSoilStacks(searchRadius);
    if (!nearby.length) {
      return {
        actionLabel: '🟫 すぐそばに拾える土がなかった',
        physicalResult: '手の届く周囲に散らばった土がなく、何も拾えなかった',
        moved: false
      };
    }

    const maxPerTurn = Math.max(3, stats.reachW * 2);
    const clearance = getCeilingClearanceSubAt(absX, absZ, baseSubY, stats.reachW);
    let pickedPocket = 0;
    let pickedHead   = 0;
    let blockedByCeiling = false;
    let blockedByCrawl   = false;

    for (let i = 0; i < nearby.length && (pickedPocket + pickedHead) < maxPerTurn; i++) {
      let avail = nearby[i].cnt;
      const pSpace = Math.max(0, stats.pocketCap - getResourceTotalCount());
      if (pSpace > 0 && avail > 0) {
        const takeP = Math.min(avail, pSpace, maxPerTurn - (pickedPocket + pickedHead));
        if (takeP > 0) {
          addLooseSoilAtFloor(nearby[i].absX, nearby[i].absZ, nearby[i].floorSubY, -takeP, areaId);
          DIG_STATE.pocketSoil += takeP;
          pickedPocket += takeP;
          avail -= takeP;
        }
      }
      while (avail > 0 && (pickedPocket + pickedHead) < maxPerTurn) {
        const curHead = DIG_STATE.headSoil || 0;
        if (curHead >= stats.headCap) break;
        if (ROBOT.posture === 'crawl') {
          blockedByCrawl = true;
          break;
        }
        const nextLayers = getHeadStackHeight(curHead + 1, stats.reachW);
        if (stats.bodyHeight + nextLayers > clearance) {
          blockedByCeiling = true;
          break;
        }
        addLooseSoilAtFloor(nearby[i].absX, nearby[i].absZ, nearby[i].floorSubY, -1, areaId);
        DIG_STATE.headSoil = curHead + 1;
        pickedHead += 1;
        avail -= 1;
      }
    }

    const totalPicked = pickedPocket + pickedHead;
    if (totalPicked <= 0) {
      if (blockedByCrawl) {
        return {
          actionLabel: `🟫 ほふく姿勢中のため頭上へ積めなかった`,
          physicalResult: `ポケットが満杯で、ほふく姿勢中のため頭上ピラミッドへ積めなかった`,
          moved: false
        };
      }
      if (blockedByCeiling) {
        return {
          actionLabel: `🟫 天井が低く頭上に載せられなかった(空き${clearance}段)`,
          physicalResult: `ポケットが満杯で、天井の空き(${clearance}分割)が足りないため頭上ピラミッドへ積めなかった`,
          moved: false
        };
      }
      return {
        actionLabel: '🟫 土を拾えなかった',
        physicalResult: '上限に達しており土を拾えなかった',
        moved: false
      };
    }

    ROBOT.pos.subY = computeExactFootSubYAt(absX, absZ, baseSubY, stats.reachW);
    ROBOT.pos.lv = floorSubYToRobotLv(ROBOT.pos.subY);

    life.stamina = Math.max(0, life.stamina - 2);
    ROBOT.params.logic = Math.min(100, (ROBOT.params.logic || 50) + 2);
    saveDigState();

    const newHeadLayers = getHeadStackHeight(DIG_STATE.headSoil || 0, stats.reachW);
    const parts = [];
    if (pickedPocket > 0) parts.push(`ポケット+${pickedPocket}`);
    if (pickedHead > 0) parts.push(`頭上ピラミッド+${pickedHead}`);
    const note = blockedByCrawl
      ? '（ほふく姿勢中のため頭上には積めない）'
      : (blockedByCeiling ? '（天井が低くこれ以上は頭上に載せられない）' : '');

    return {
      actionLabel: `🧺 土を${totalPicked}個回収(${parts.join('・')})`,
      physicalResult: `周囲の土を${totalPicked}個拾った(${parts.join('、')})。現在ポケット${DIG_STATE.pocketSoil}/${stats.pocketCap}個、頭上${DIG_STATE.headSoil}/${stats.headCap}個(+${newHeadLayers}段)${note}`,
      moved: false
    };
  }

  function runPlaceSoil(dir) {
    if (isBehindCurrentFacing(dir)) {
      return runTurnAroundOnly(dir, '土の配置');
    }

    const hasHead   = (DIG_STATE.headSoil || 0) > 0;
    const hasPocket = (DIG_STATE.pocketSoil || 0) > 0;
    if (!hasHead && !hasPocket) {
      return {
        actionLabel: '🟫 置く土が手元にも頭上にもなかった',
        physicalResult: 'ポケットにも頭上にも土がなく、置けなかった',
        moved: false
      };
    }

    ROBOT.rotY = dir.rot;
    const dName = dir.name.replace('(斜め)', '');
    const areaId = getCurAreaId();
    const { absX, absZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const stats = getSizeStats();
    const dx = Math.sign(dir.dx || 0);
    const dz = Math.sign(dir.dz || 0);
    const frontEdge = getFrontEdgeOffset(dx, dz, stats.reachW);
    const tx = absX + frontEdge.ox;
    const tz = absZ + frontEdge.oz;

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
        physicalResult: `${dName}の目の前は既に${curStack}段積まれており、自分の高さの2倍(${stats.maxStackHeight}段)の上限に達しているため積めなかった`,
        moved: false
      };
    }
    if (hasSolidTerrainAtAbsSubY(tx, floorY + curStack, tz) || isCrateBlockingAtSubY(tx, floorY + curStack, tz, areaId)) {
      return {
        actionLabel: `🟫 ${dName}は壁・天井で塞がっており置けない`,
        physicalResult: `${dName}の目の前は固体ブロックまたは圧縮木箱で塞がっており土を置けなかった`,
        moved: false
      };
    }

    let fromLabel = '';
    if (hasHead) {
      DIG_STATE.headSoil -= 1;
      fromLabel = '頭上から';
    } else {
      DIG_STATE.pocketSoil -= 1;
      fromLabel = 'ポケットから';
    }

    addLooseSoilAtFloor(tx, tz, floorY, 1, areaId);
    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    saveDigState();

    const stackNow = getLooseSoilAtFloor(tx, tz, floorY, areaId);
    const dropNote = isDeepDrop ? '下の空間の底へ落ちた' : `高さ${stackNow}/${stats.maxStackHeight}段になった`;
    return {
      actionLabel: `🟫 ${fromLabel}${dName}へ土を1個置いた(${isDeepDrop ? '底へ落下' : `積${stackNow}/${stats.maxStackHeight}段`})`,
      physicalResult: `${fromLabel}${dName}の目の前へ土を1個置き、${dropNote}(残りポケット${DIG_STATE.pocketSoil}・頭上${DIG_STATE.headSoil})`,
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
      const rTopY = baseSubY + stats.reachH;
      return (rTopY >= cBaseY) && (baseSubY <= cBaseY + 5);
    }) || null;
  }

  function runStoreCrate() {
    const crate = findNearbyCrate();
    if (!crate) {
      return {
        actionLabel: '📦 手が届くすぐ隣に圧縮木箱がなかった',
        physicalResult: '手が届くすぐ隣（距離1分割以内・同じ高さ）に圧縮木箱がなく、収納できなかった',
        moved: false
      };
    }
    const curHead   = DIG_STATE.headSoil || 0;
    const curPocket = DIG_STATE.pocketSoil || 0;
    if (curHead + curPocket <= 0) {
      return {
        actionLabel: '📦 入れる土が手元にも頭上にもなかった',
        physicalResult: 'ポケットにも頭上にも土がなく、圧縮木箱へ入れられなかった',
        moved: false
      };
    }
    const cap = crate.capacity || CRATE_CAPACITY;
    const free = cap - crate.soil;
    if (free <= 0) {
      return {
        actionLabel: `📦 圧縮木箱が満杯(${crate.soil}/${cap})だった`,
        physicalResult: `圧縮木箱が満杯(${crate.soil}/${cap})で入らなかった`,
        moved: false
      };
    }

    const moveHead = Math.min(curHead, free);
    DIG_STATE.headSoil = curHead - moveHead;
    const remFree = free - moveHead;
    const movePocket = Math.min(curPocket, remFree);
    DIG_STATE.pocketSoil = curPocket - movePocket;

    const totalMoved = moveHead + movePocket;
    crate.soil += totalMoved;
    ROBOT.params.logic = Math.min(100, (ROBOT.params.logic || 50) + 3);
    life.mental = Math.min(100, life.mental + 8);
    saveDigState();

    const detail = [];
    if (moveHead > 0) detail.push(`頭上${moveHead}`);
    if (movePocket > 0) detail.push(`ポケット${movePocket}`);

    return {
      actionLabel: `📦 圧縮木箱へ土を${totalMoved}個収納(${crate.soil}/${cap})`,
      physicalResult: `圧縮木箱へ土を計${totalMoved}個(${detail.join('＋')})まとめて圧縮収納し、木箱は${crate.soil}/${cap}になった`,
      moved: false
    };
  }

  function computeSupportedFloorUnderFootprint(centerAbsX, centerAbsZ, curBaseSubY, reachW) {
    const areaId = getCurAreaId();
    const { minOff, maxOff } = getFootprintBounds(reachW);
    let highestSupportY = getMinSubY();
    let hasImmediateSupport = false;

    for (let ox = minOff; ox <= maxOff; ox++) {
      for (let oz = minOff; oz <= maxOff; oz++) {
        const cx = centerAbsX + ox;
        const cz = centerAbsZ + oz;
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
        const cx = nextAbsX + ox;
        const cz = nextAbsZ + oz;
        if (!isInsideIslandAbs(cx, cz)) {
          return { ok: false, reason: '島の端' };
        }
        if (isCrateBlockingAtSubY(cx, curBaseSubY, cz, areaId)) {
          return { ok: false, reason: '圧縮木箱' };
        }

        let openY = null;
        let hitLooseSoil = false;
        let looseHeightHere = 0;

        for (let up = 0; up <= maxClimbUp; up++) {
          const yTest = curBaseSubY + up;
          const solid = hasSolidTerrainAtAbsSubY(cx, yTest, cz);
          const loose = hasLooseSoilAtSubY(cx, yTest, cz, areaId);
          const crate = isCrateBlockingAtSubY(cx, yTest, cz, areaId);
          if (!solid && !loose && !crate) {
            openY = yTest;
            break;
          }
          if (crate) {
            return { ok: false, reason: '圧縮木箱' };
          }
          if (loose && !solid) {
            hitLooseSoil = true;
            looseHeightHere = Math.max(looseHeightHere, up + 1);
          }
        }

        if (openY === null) {
          if (hitLooseSoil) {
            const fl = findFloorSubYBelow(cx, cz, curBaseSubY + 1);
            const cnt = getLooseSoilAtFloor(cx, cz, fl, areaId) || looseHeightHere;
            return { ok: false, reason: `高さ${cnt}段の散らばった土` };
          }
          if (curPosture === 'crawl') {
            return { ok: false, reason: 'ほふく前進では登れない段差（壁）' };
          }
          return { ok: false, reason: '高すぎる段差（壁）' };
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
    if (clearance >= needStandH) {
      nextPosture = 'stand';
    } else if (clearance >= needCrawlH) {
      nextPosture = 'crawl';
    } else {
      if (stats.headLayers > 0 && clearance >= stats.crawlH) {
        return { ok: false, reason: `頭上の土(+${stats.headLayers}段)が天井(空き${clearance}段)に当たる` };
      }
      return { ok: false, reason: `低い天井(空き${clearance}段)` };
    }

    let stepKind = 'flat';
    if (diffSub > 0) {
      stepKind = (diffSub <= stats.stairMax) ? 'stairs_up' : 'scramble_climb';
    } else if (diffSub < 0) {
      const drop = -diffSub;
      if (drop <= stats.stairMax) stepKind = 'stairs_down';
      else if (drop <= stats.climbMax) stepKind = 'safe_landing';
      else stepKind = 'high_drop';
    }

    return {
      ok: true,
      destFloorSubY: highestFloorY,
      nextPosture,
      diffSub,
      stepKind
    };
  }

  function runSubMove(dir) {
    lastMoveVisualKind = null;
    if (isBehindCurrentFacing(dir)) {
      return runTurnAroundOnly(dir, '移動');
    }

    const stats = getSizeStats();
    const maxStep = stats.moveStep;
    const dx = Math.sign(dir.dx || 0);
    const dz = Math.sign(dir.dz || 0);
    const dName = dir.name.replace('(斜め)', '');
    ROBOT.rotY = dir.rot;

    let curX = Math.round(ROBOT.pos.x || 0);
    let curZ = Math.round(ROBOT.pos.z || 0);
    let curSx = Number.isFinite(ROBOT.pos.sx) ? Math.max(0, Math.min(4, Math.round(ROBOT.pos.sx))) : 2;
    let curSz = Number.isFinite(ROBOT.pos.sz) ? Math.max(0, Math.min(4, Math.round(ROBOT.pos.sz))) : 2;
    let curBaseSubY = getRobotBaseSubY(curX, curZ, ROBOT.pos.lv);
    let curLv = floorSubYToRobotLv(curBaseSubY);
    let curPosture = ROBOT.posture === 'crawl' ? 'crawl' : 'stand';

    let movedSteps = 0;
    let totalClimbSub = 0;
    let totalDropSub = 0;
    let didScramble = false;
    let didStairsUp = false;
    let didSafeLanding = false;
    let didHighDrop = false;
    let stopReason = '';

    for (let s = 0; s < maxStep; s++) {
      const curAbsX = curX * 5 + curSx;
      const curAbsZ = curZ * 5 + curSz;
      const nextAbsX = curAbsX + dx;
      const nextAbsZ = curAbsZ + dz;

      if (!isInsideIslandAbs(nextAbsX, nextAbsZ)) {
        stopReason = '島の端';
        break;
      }

      if (dx !== 0 && dz !== 0) {
        const sideA = evaluateSubStepTarget(curAbsX + dx, curAbsZ, curBaseSubY, curPosture, stats);
        const sideB = evaluateSubStepTarget(curAbsX, curAbsZ + dz, curBaseSubY, curPosture, stats);
        if (!sideA.ok && !sideB.ok) {
          stopReason = '斜めの角の壁';
          break;
        }
      }

      const ev = evaluateSubStepTarget(nextAbsX, nextAbsZ, curBaseSubY, curPosture, stats);
      if (!ev.ok) {
        stopReason = ev.reason;
        break;
      }

      const tX = absToTile(nextAbsX);
      const tZ = absToTile(nextAbsZ);

      if (ev.diffSub > 0) {
        totalClimbSub += ev.diffSub;
        if (ev.stepKind === 'scramble_climb') didScramble = true;
        else didStairsUp = true;
      } else if (ev.diffSub < 0) {
        totalDropSub += (-ev.diffSub);
        if (ev.stepKind === 'high_drop') didHighDrop = true;
        else if (ev.stepKind === 'safe_landing') didSafeLanding = true;
      }

      curX = tX.tile;
      curZ = tZ.tile;
      curSx = tX.sub;
      curSz = tZ.sub;
      curBaseSubY = ev.destFloorSubY;
      curLv = floorSubYToRobotLv(curBaseSubY);
      curPosture = ev.nextPosture;
      movedSteps++;

      if (ev.stepKind === 'high_drop' || ev.stepKind === 'scramble_climb') {
        break;
      }
    }

    if (movedSteps > 0) {
      ROBOT.pos.x = curX;
      ROBOT.pos.z = curZ;
      ROBOT.pos.sx = curSx;
      ROBOT.pos.sz = curSz;
      ROBOT.pos.subY = curBaseSubY;
      ROBOT.pos.lv = curLv;
      ROBOT.posture = curPosture;

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

      const badge = didScramble
        ? `(🧗↑${totalClimbSub})`
        : (totalClimbSub > 0 ? `(🪜↑${totalClimbSub})` : (totalDropSub > 0 ? `(↓${totalDropSub})` : ''));

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
  // 5. 日記帳ポケット＆圧縮木箱UI（シャベル＆旧石アイテム削除・純粋資源5枠＋木箱5枠）
  // --------------------------------------------------------------------------
  function renderPocketAndCrateDiaryUI() {
    purgeLegacyItems();
    const grid = document.getElementById('bag-grid');
    if (!grid) return;

    const stats = getSizeStats();
    const headNow = DIG_STATE.headSoil || 0;
    if (grid.previousElementSibling) {
      grid.previousElementSibling.innerText =
        `🎒 資源ポケット(上限${stats.pocketCap})・頭上(${headNow}/${stats.headCap}) ／ 📦圧縮木箱(${DIG_STATE.crates.length}/5箱)`;
    }

    grid.innerHTML = '';

    for (let i = 0; i < 5; i++) {
      const slot = document.createElement('div');
      slot.className = 'bag-slot';
      slot.style.flexDirection = 'column';
      slot.style.gap = '1px';
      slot.style.padding = '2px';

      if (i === 0 && (DIG_STATE.pocketSoil > 0 || headNow > 0)) {
        slot.classList.add('filled');
        const over = getResourceTotalCount() > stats.pocketCap || headNow > stats.headCap;
        slot.style.borderColor = over ? '#ef4444' : '#b45309';
        slot.style.background  = over ? '#fef2f2' : '#fef3c7';
        const headLine = headNow > 0
          ? `<span style="font-size:7.5px;font-weight:900;color:#0369a1;line-height:1;">頭${headNow}/${stats.headCap}</span>`
          : '';
        slot.innerHTML = `<span style="font-size:14px;line-height:1;">🟫</span><span style="font-size:8.5px;font-weight:900;color:${over ? '#dc2626' : '#92400e'};line-height:1.1;">${DIG_STATE.pocketSoil}/${stats.pocketCap}</span>${headLine}`;
        slot.onclick = () => {
          if (typeof showToast === 'function') {
            showToast(`🟫 分割土 ポケット:${DIG_STATE.pocketSoil}/${stats.pocketCap}個 ／ 頭上ピラミッド:${headNow}/${stats.headCap}個(+${stats.headLayers}段) ／ 整理上限:${stats.maxStackHeight}段`);
          }
        };
      } else {
        slot.innerHTML = `<span style="font-size:8.5px;color:#94a3b8;font-weight:800;">資源空</span>`;
      }
      grid.appendChild(slot);
    }

    for (let i = 0; i < 5; i++) {
      const slot = document.createElement('div');
      slot.className = 'bag-slot';
      slot.style.flexDirection = 'column';
      slot.style.gap = '1px';
      slot.style.padding = '2px';

      const crate = DIG_STATE.crates[i];
      if (crate) {
        const cap = crate.capacity || CRATE_CAPACITY;
        slot.classList.add('filled');
        slot.style.borderColor = '#d97706';
        slot.style.background = '#fffbeb';
        slot.innerHTML = `<span style="font-size:16px;line-height:1;">📦</span><span style="font-size:8.5px;font-weight:900;color:#92400e;">${crate.soil}/${cap}</span>`;
        slot.onclick = () => {
          if (typeof showToast === 'function') {
            showToast(`📦 圧縮木箱#${i + 1}(5×5×5)：${crate.soil}/${cap}個 場所(${crate.x},${crate.z})`);
          }
        };
      } else {
        slot.style.borderStyle = 'dashed';
        slot.style.background = '#f8fafc';
        slot.innerHTML = `<span style="font-size:8.5px;color:#cbd5e1;font-weight:800;">木箱枠</span>`;
      }
      grid.appendChild(slot);
    }
  }

  // --------------------------------------------------------------------------
  // 6. 既存フック接続（クラウド旧データ完全遮断・整数座標維持・手帳UI維持・1分割高さ同期）
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

  // クラウド復元時に旧データ（穴あき・別エリア・旧タグ）が返ってきても即座に弾く
  if (typeof applyLoadedWorldData === 'function') {
    const _origApplyLoaded = applyLoadedWorldData;
    applyLoadedWorldData = function(d) {
      const hm = d && d.heightMap;
      const isOldCloudData = !d ||
        d.cleanEnvTag !== CLEAN_ENV_TAG ||
        (d.areaId && d.areaId !== 'home') ||
        !hm ||
        hm['0,0'] !== 0 ||
        hm['0,-1'] !== 1 ||
        hm['0,-2'] !== 1 ||
        hm['1,2'] === 1;

      if (isOldCloudData) {
        // 旧クラウドデータは適用せず、現在のクリーン検証環境をそのまま維持・上書き保存
        if (!isCleanTerrainValid()) {
          applyCleanTestTerrain(true);
        } else {
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
      renderPocketAndCrateDiaryUI();
    };
  }

  if (typeof saveWorldState === 'function') {
    const _origSaveWorld = saveWorldState;
    saveWorldState = function() {
      purgeLegacyItems();
      const res = _origSaveWorld.apply(this, arguments);
      // 保存データへクリーン環境タグを刻印（次回起動時のクラウド判定用）
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
                day: obj.day,
                time: obj.time,
                life: obj.life,
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
      renderPocketAndCrateDiaryUI();
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
      renderPocketAndCrateDiaryUI();
    };
  }

  if (typeof resetGameDirectly === 'function') {
    const _origReset = resetGameDirectly;
    resetGameDirectly = function() {
      try {
        if (typeof safeStorage !== 'undefined') {
          safeStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {}
      if (window.AICommCore && typeof window.AICommCore.resetPhysicalHistory === 'function') {
        window.AICommCore.resetPhysicalHistory();
      }
      _origReset();
    };
  }

  const diaryBtn = document.getElementById('diary-btn');
  if (diaryBtn) {
    diaryBtn.addEventListener('click', () => setTimeout(renderPocketAndCrateDiaryUI, 20));
  }

  // --------------------------------------------------------------------------
  // 7. AICommCore への純粋知覚・純粋物理アクション登録
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

      return [
        `体格: 高さ${stats.reachH}分割 × 幅${stats.reachW}分割 (1ターン歩幅:最大${stats.moveStep}分割 / スイスイ階段:${stats.stairMax}段・よじ登り上限:${stats.maxStepUpSub}段 / ほふく高:${stats.crawlH} / 整理積み上げ上限:${stats.maxStackHeight}段)`,
        `向いている方角: ${basis.actualFacingName} / 姿勢: ${ROBOT.posture === 'crawl' ? 'ほふく' : '立位'} / 頭上の天井空き: ${clearance}分割`,
        `身体状態: 体力${st.stamina}/100, おなか${st.energy}/100`,
        `ポケット: 土${DIG_STATE.pocketSoil}/${stats.pocketCap}個`,
        `頭上ピラミッド: 土${DIG_STATE.headSoil || 0}/${stats.headCap}個 (現在+${stats.headLayers}段・移動時の必要天井高さ:${stats.bodyHeight + stats.headLayers}分割)`
      ].join('\n');
    });

    window.AICommCore.registerAction({
      id: 'look',
      desc: '移動せず指定方角へ体の向きを変える',
      run: ({ dir }) => { lastTurnActionId = 'look'; return runLook(dir); }
    });

    window.AICommCore.registerAction({
      id: 'move',
      desc: '指定方角へ移動する',
      run: ({ dir }) => { lastTurnActionId = 'move'; return runSubMove(dir); }
    });

    window.AICommCore.registerAction({
      id: 'dig_front',
      desc: '指定方角の目の前距離1にある壁の露出ブロックを1分割削る（壁がなければ空振り）',
      run: ({ dir, dec }) => { lastTurnActionId = 'dig_front'; return runSubDigByMode('front', dir, dec && dec.thought); }
    });

    window.AICommCore.registerAction({
      id: 'dig_down',
      desc: '指定方角の目の前または足元の地面（1段下）の露出ブロックを1分割削る',
      run: ({ dir, dec }) => { lastTurnActionId = 'dig_down'; return runSubDigByMode('down', dir, dec && dec.thought); }
    });

    window.AICommCore.registerAction({
      id: 'dig_up',
      desc: '頭上の届く高さにある真上の天井の露出ブロックを1分割削る',
      run: ({ dir, dec }) => { lastTurnActionId = 'dig_up'; return runSubDigByMode('up', dir, dec && dec.thought); }
    });

    window.AICommCore.registerAction({
      id: 'pickup_soil',
      desc: 'すぐそばの地面にある散らばった土を拾う（ポケット満杯後は立位かつ天井に収まる範囲で頭上ピラミッドへ積む）',
      run: () => { lastTurnActionId = 'pickup_soil'; return runPickupSoil(); }
    });

    window.AICommCore.registerAction({
      id: 'place_soil',
      desc: '頭上またはポケットの土を指定方角の距離1の地面へ1個置く（上限はキャラ高さの2倍）',
      run: ({ dir }) => { lastTurnActionId = 'place_soil'; return runPlaceSoil(dir); }
    });

    window.AICommCore.registerAction({
      id: 'store_crate',
      desc: '手が届くすぐ隣(距離1分割以内)の圧縮木箱(容量220)へ頭上とポケットの土をまとめて入れる',
      run: () => { lastTurnActionId = 'store_crate'; return runStoreCrate(); }
    });

    window.AICommCore.registerPostTurnHook(({ dec }) => {
      const act = (dec && dec.action) || lastTurnActionId;
      const eSpec = (typeof getExpressionSpec === 'function') ? getExpressionSpec(ROBOT.emotion) : null;

      if (act === 'dig_front' || act === 'dig_down' || act === 'dig_up') {
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
        else if (act === 'pickup_soil') ROBOT.emotion = 'pickup';
        else if (act === 'place_soil' || act === 'store_crate') ROBOT.emotion = 'carry';
        else ROBOT.emotion = 'normal';
      }
      lastMoveVisualKind = null;
      renderHeadPyramidVisual();
      return null;
    });
  }

  loadDigState();
  if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
  else renderDigVisuals();
  if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition(true);
  renderPocketAndCrateDiaryUI();

  window.DigRulesModule = Object.freeze({
    getState: () => DIG_STATE,
    getSizeStats,
    buildFirstPersonVisionMap,
    renderPocketAndCrateDiaryUI,
    renderDigVisuals,
    renderHeadPyramidVisual,
    applyCleanTestTerrain
  });
})();
