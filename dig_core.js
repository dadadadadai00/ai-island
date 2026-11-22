// ============================================================================
// 【分割物理モジュール 1/7：dig_core.js】
// ・共通ハブ window.DIG の生成・定数・アイテム定義（ひんとメモ＆パステルスコップ）
// ・体格計算・体験ベースの日記メモ(diaryMemos)・5x5x5座標基礎・セーブ/ロード・初期地形
// ============================================================================
(function initDigCore() {
  const DIG = window.DIG = window.DIG || {};

  const CONST = DIG.CONST = {
    STORAGE_KEY:       'rules_dig_state_v7_0_clean',
    CLEAN_ENV_TAG:     'clean_flat_stairs_v7_0',
    SUB_SIZE:          0.2,
    CRATE_SLOTS:       25,
    STACK_MATERIAL:    10,
    STACK_TOOL:        5,
    HAND_SHOVEL_MAX:   2,
    PORTAL_CORNER_POS: { x: -2, z: -2 },
    HINT_MEMO_TEXT:    'きみは パステルじまへ おくられた たんさロボットだよ！ この スコップをつかって しまを ほって ちょうさしよう！',
    HEIGHT_RANK: { tiny: 1, small: 2, medium: 3, large: 4, giant: 5 },
    WIDTH_RANK:  { slim1: 1, slim2: 2, normal3: 3, fat4: 4, fat5: 5 },
    POCKET_CAP_TABLE: {
      1: [1,  2,  4,  5,  7],
      2: [2,  5,  8,  12, 16],
      3: [4,  8,  14, 20, 28],
      4: [5,  12, 20, 30, 41],
      5: [7,  16, 28, 41, 55]
    },
    PYRAMID_MAX_BY_WIDTH: [0, 1, 5, 14, 30, 55],
    ITEM_META: {
      memo:   { id: 'memo',   name: 'ひんとメモ',       icon: '📝', kind: 'memo',     stackMax: 1 },
      shovel: { id: 'shovel', name: 'パステルスコップ', icon: '🪏', kind: 'tool',     stackMax: 5 },
      soil:   { id: 'soil',   name: '土ブロック',       icon: '🟫', kind: 'material', stackMax: 10 },
      wood:   { id: 'wood',   name: '木材',             icon: '🪵', kind: 'material', stackMax: 10 },
      stone:  { id: 'stone',  name: '石材',             icon: '🪨', kind: 'material', stackMax: 10 }
    }
  };

  function createEmptyCrateSlots(withStarterItems = false) {
    const slots = Array.from({ length: CONST.CRATE_SLOTS }, () => null);
    if (withStarterItems) {
      // 並び順：1枠目メモ・2枠目パステルスコップ
      slots[0] = { id: 'memo', count: 1 };
      slots[1] = { id: 'shovel', count: 1 };
    }
    return slots;
  }

  function createDefaultState() {
    return {
      envTag: CONST.CLEAN_ENV_TAG,
      pocket: { soil: 0, wood: 0, stone: 0, shovel: 0, memo: 0 },
      headSoil: 0,
      equip: { head: null, body: null, waist: null, back: null, hand: null, feet: null },
      crates: [
        { id: 'crate_1', areaId: 'home', x: -1, z: 0, slots: createEmptyCrateSlots(true) }
      ],
      diaryMemos: [],
      dugCells: {},
      worldSubSoils: {},
      worldDroppedItems: []
    };
  }

  DIG.state = createDefaultState();
  DIG.runtime = {
    lastTurnActionId: null,
    lastMoveVisualKind: null,
    activeCrateModalId: null,
    origGetSurfaceYAt: (typeof getSurfaceYAt === 'function') ? getSurfaceYAt : null
  };

  // --- 体験・発見だけを記録する日記メモ（AIへ渡す唯一の知識記憶） ---
  function addDiaryMemo(text) {
    const clean = String(text || '').trim();
    if (!clean) return false;
    if (!Array.isArray(DIG.state.diaryMemos)) DIG.state.diaryMemos = [];
    if (DIG.state.diaryMemos.includes(clean)) return false;
    DIG.state.diaryMemos.push(clean);
    if (DIG.state.diaryMemos.length > 12) DIG.state.diaryMemos.shift();
    if (typeof DIARY_LOGS !== 'undefined' && Array.isArray(DIARY_LOGS)) {
      const dayNum = (typeof GAME_DAY !== 'undefined') ? GAME_DAY : 1;
      DIARY_LOGS.push(`📝 ${dayNum}日目：${clean}`);
    }
    saveDigState();
    return true;
  }

  function getDiaryMemos() {
    return Array.isArray(DIG.state.diaryMemos) ? DIG.state.diaryMemos.slice() : [];
  }

  // --- 基本参照＆体格計算 ---
  function getCurAreaId() {
    return (typeof getCurrentAreaDef === 'function' && getCurrentAreaDef())
      ? getCurrentAreaDef().id : 'home';
  }
  function getMinUnderLv() {
    return (typeof AREA1_MIN_UNDER_LV !== 'undefined') ? AREA1_MIN_UNDER_LV : -4;
  }
  function getMinSubY() { return (getMinUnderLv() - 1) * 5; }

  function getHeadStackHeight(count, wRank) {
    let rem = Math.max(0, Math.floor(count || 0));
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
    const h = CONST.HEIGHT_RANK[key] || 1;
    return { label: key, subH: h, scaleY: h * 0.2, standH: h, crawlH: Math.max(1, Math.ceil(h / 2)), stairMax: h >= 4 ? 2 : (h >= 2 ? 1 : 0) };
  }

  function getOriginalBodySpec() {
    const key = (typeof ROBOT !== 'undefined' && ROBOT.bodyType) || 'slim1';
    if (typeof BODY_SPECS !== 'undefined' && BODY_SPECS[key]) return BODY_SPECS[key];
    return { label: key, reqWidth: CONST.WIDTH_RANK[key] || 1 };
  }

  function getSizeStats() {
    const sSpec = getOriginalSizeSpec();
    const bSpec = getOriginalBodySpec();
    const hRank = sSpec.subH || CONST.HEIGHT_RANK[(typeof ROBOT !== 'undefined' && ROBOT.sizeLevel) || 'tiny'] || 1;
    const wRank = bSpec.reqWidth || CONST.WIDTH_RANK[(typeof ROBOT !== 'undefined' && ROBOT.bodyType) || 'slim1'] || 1;
    const pocketCap = (CONST.POCKET_CAP_TABLE[hRank] && CONST.POCKET_CAP_TABLE[hRank][wRank - 1]) || 1;
    const headCap = Math.min(CONST.PYRAMID_MAX_BY_WIDTH[wRank] || 1, pocketCap);
    const standH = sSpec.standH || hRank;
    const crawlH = sSpec.crawlH || 1;
    const stairMax = Number.isFinite(sSpec.stairMax) ? sSpec.stairMax : 0;
    const isCrawl = (typeof ROBOT !== 'undefined' && ROBOT.posture === 'crawl');
    return {
      reachH: hRank, reachW: wRank, reachD: 1,
      moveStep: 6 - wRank,
      pocketCap, headCap,
      headLayers: getHeadStackHeight(DIG.state.headSoil || 0, wRank),
      handSoilMax: hRank,
      handShovelMax: CONST.HAND_SHOVEL_MAX,
      throwToolMax: hRank + 2,
      throwSoilMax: hRank + 1,
      standH, crawlH, stairMax, climbMax: hRank,
      bodyHeight: isCrawl ? crawlH : standH,
      maxStackHeight: hRank * 2,
      maxStepUpSub: isCrawl ? 1 : hRank
    };
  }

  function getPocketResourceTotal() {
    const p = DIG.state.pocket || {};
    return Math.max(0, Math.floor(p.soil || 0))
      + Math.max(0, Math.floor(p.wood || 0))
      + Math.max(0, Math.floor(p.stone || 0));
  }
  function getHandResourceTotal() {
    const h = DIG.state.equip && DIG.state.equip.hand;
    if (!h || !CONST.ITEM_META[h.id] || CONST.ITEM_META[h.id].kind !== 'material') return 0;
    return Math.max(0, Math.floor(h.count || 0));
  }
  function getCarriedResourceTotal() { return getPocketResourceTotal() + getHandResourceTotal(); }
  function getMaxAddableShovelsToPocket() {
    const p = DIG.state.pocket || {};
    const curShovels = Math.max(0, Math.floor(p.shovel || 0));
    const usedNonShovel = ((p.soil || 0) > 0 ? 1 : 0)
      + ((p.wood || 0) > 0 ? 1 : 0)
      + ((p.stone || 0) > 0 ? 1 : 0)
      + ((p.memo || 0) > 0 ? 1 : 0);
    return Math.max(0, Math.max(0, 9 - usedNonShovel) * CONST.STACK_TOOL - curShovels);
  }

  // --- 5x5x5サブ座標・地形・土＆落下道具基礎 ---
  function absToTile(absVal) {
    const n = Math.round(absVal);
    return { tile: Math.floor(n / 5), sub: ((n % 5) + 5) % 5 };
  }
  function isInsideIslandAbs(absX, absZ) { return absX >= -10 && absX <= 14 && absZ >= -10 && absZ <= 14; }
  function absToWorldXZ(absX, absZ) { return { wx: (absX - 2) * CONST.SUB_SIZE, wz: (absZ - 2) * CONST.SUB_SIZE }; }
  function subYToLvSy(totalSubY) {
    const n = Math.round(totalSubY);
    return { lv: Math.floor(n / 5) + 1, sy: ((n % 5) + 5) % 5 };
  }
  function floorSubYToRobotLv(floorSubY) {
    return Math.max(getMinUnderLv(), Math.floor((Math.round(floorSubY) - 1) / 5) + 1);
  }
  function getRobotAbsPos() {
    const gx = Number.isFinite(ROBOT.pos.x) ? Math.round(ROBOT.pos.x) : 0;
    const gz = Number.isFinite(ROBOT.pos.z) ? Math.round(ROBOT.pos.z) : 0;
    const sx = Number.isFinite(ROBOT.pos.sx) ? Math.max(0, Math.min(4, Math.round(ROBOT.pos.sx))) : 2;
    const sz = Number.isFinite(ROBOT.pos.sz) ? Math.max(0, Math.min(4, Math.round(ROBOT.pos.sz))) : 2;
    return { absX: gx * 5 + sx, absZ: gz * 5 + sz };
  }
  function getFootprintBounds(reachW) {
    return { minOff: -Math.floor((reachW - 1) / 2), maxOff: Math.floor(reachW / 2) };
  }
  function getFrontEdgeOffset(dx, dz, reachW) {
    const { minOff, maxOff } = getFootprintBounds(reachW);
    return { ox: dx > 0 ? (maxOff + 1) : (dx < 0 ? (minOff - 1) : 0), oz: dz > 0 ? (maxOff + 1) : (dz < 0 ? (minOff - 1) : 0) };
  }
  function isInsideRobotFootprint(absX, absZ, cx, cz, reachW) {
    const { minOff, maxOff } = getFootprintBounds(reachW);
    return absX >= cx + minOff && absX <= cx + maxOff && absZ >= cz + minOff && absZ <= cz + maxOff;
  }

  function isWaterProtectedCell(tx, tz, lv, sx, sy, sz) {
    if (typeof isWaterFacingOuterSubVoxel === 'function') return Boolean(isWaterFacingOuterSubVoxel(tx, tz, lv, sx, sy, sz));
    if (lv > 0 || (lv === 0 && sy >= 3)) return false;
    return (tx === -2 && sx === 0) || (tx === 2 && sx === 4) || (tz === -2 && sz === 0) || (tz === 2 && sz === 4);
  }
  function hasSolidTerrainSubVoxel(tx, tz, lv, sx, sy, sz) {
    if (tx < -2 || tx > 2 || tz < -2 || tz > 2) return false;
    const topLv = (typeof HEIGHT_MAP !== 'undefined' && HEIGHT_MAP[`${tx},${tz}`] !== undefined) ? HEIGHT_MAP[`${tx},${tz}`] : 0;
    if (lv < getMinUnderLv() || lv > topLv) return false;
    if (typeof CHIP_MAP !== 'undefined') {
      const ch = CHIP_MAP[`${tx},${tz},${lv}`];
      if (ch && ch[`${sx},${sy},${sz}`]) return false;
    }
    return true;
  }
  function hasSolidTerrainAtAbsSubY(absX, totalSubY, absZ) {
    const ix = Math.round(absX), iz = Math.round(absZ);
    if (!isInsideIslandAbs(ix, iz)) return false;
    const tX = absToTile(ix), tZ = absToTile(iz), yInfo = subYToLvSy(totalSubY);
    return hasSolidTerrainSubVoxel(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub);
  }
  function isExposedToAir(tx, tz, lv, sx, sy, sz) {
    const ax = tx * 5 + sx, az = tz * 5 + sz, ay = (lv - 1) * 5 + sy;
    const nb = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for (let i = 0; i < nb.length; i++) {
      const nx = ax + nb[i][0], ny = ay + nb[i][1], nz = az + nb[i][2];
      if (!isInsideIslandAbs(nx, nz) || !hasSolidTerrainAtAbsSubY(nx, ny, nz)) return true;
    }
    return false;
  }
  function getTerrainColumnTopSubY(absX, absZ) {
    const tX = absToTile(absX), tZ = absToTile(absZ);
    const topLv = (typeof HEIGHT_MAP !== 'undefined' && HEIGHT_MAP[`${tX.tile},${tZ.tile}`] !== undefined) ? HEIGHT_MAP[`${tX.tile},${tZ.tile}`] : 0;
    for (let lv = topLv; lv >= getMinUnderLv(); lv--) {
      for (let sy = 4; sy >= 0; sy--) {
        if (hasSolidTerrainSubVoxel(tX.tile, tZ.tile, lv, tX.sub, sy, tZ.sub)) return (lv - 1) * 5 + sy + 1;
      }
    }
    return getMinSubY();
  }
  function findFloorSubYBelow(absX, absZ, startSubY) {
    const minSubY = getMinSubY();
    for (let y = Math.max(minSubY, Math.floor(startSubY)) - 1; y >= minSubY; y--) {
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
    const coords = parts[1].split(',').map(Number);
    if (coords.length < 2 || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return null;
    const floorSubY = (parts.length >= 3 && Number.isFinite(Number(parts[2]))) ? Number(parts[2]) : null;
    return { areaId: parts[0], absX: Math.round(coords[0]), absZ: Math.round(coords[1]), floorSubY };
  }
  function getLooseSoilAtFloor(absX, absZ, floorSubY, areaId = getCurAreaId()) {
    return DIG.state.worldSubSoils[makeSoilKey(absX, absZ, floorSubY, areaId)] || 0;
  }
  function addLooseSoilAtFloor(absX, absZ, floorSubY, delta, areaId = getCurAreaId()) {
    const key = makeSoilKey(absX, absZ, floorSubY, areaId);
    const next = Math.max(0, (DIG.state.worldSubSoils[key] || 0) + delta);
    if (next === 0) delete DIG.state.worldSubSoils[key];
    else DIG.state.worldSubSoils[key] = next;
  }
  function getLooseSoilStacksInColumn(absX, absZ, areaId = getCurAreaId()) {
    const prefix = `${areaId}|${Math.round(absX)},${Math.round(absZ)}|`;
    const res = [];
    Object.keys(DIG.state.worldSubSoils).forEach(k => {
      if (!k.startsWith(prefix)) return;
      const cnt = DIG.state.worldSubSoils[k] || 0;
      if (cnt <= 0) return;
      const fy = Number(k.slice(prefix.length));
      if (Number.isFinite(fy)) res.push({ key: k, floorSubY: fy, count: cnt });
    });
    return res.sort((a, b) => a.floorSubY - b.floorSubY);
  }
  function hasLooseSoilAtSubY(absX, totalSubY, absZ, areaId = getCurAreaId()) {
    const stacks = getLooseSoilStacksInColumn(absX, absZ, areaId);
    return stacks.some(s => totalSubY >= s.floorSubY && totalSubY < s.floorSubY + s.count);
  }
  function settleFloatingLooseSoilsAtColumn(absX, absZ, areaId = getCurAreaId()) {
    const minSubY = getMinSubY();
    getLooseSoilStacksInColumn(absX, absZ, areaId).forEach(st => {
      if (st.floorSubY > minSubY && !hasSolidTerrainAtAbsSubY(absX, st.floorSubY - 1, absZ)) {
        const ny = findFloorSubYBelow(absX, absZ, st.floorSubY);
        if (ny !== st.floorSubY) {
          addLooseSoilAtFloor(absX, absZ, st.floorSubY, -st.count, areaId);
          addLooseSoilAtFloor(absX, absZ, ny, st.count, areaId);
        }
      }
    });
    (DIG.state.worldDroppedItems || []).forEach(it => {
      if (it.areaId === areaId && it.absX === absX && it.absZ === absZ &&
          it.floorSubY > minSubY && !hasSolidTerrainAtAbsSubY(absX, it.floorSubY - 1, absZ)) {
        it.floorSubY = findFloorSubYBelow(absX, absZ, it.floorSubY);
      }
    });
  }
  function addDroppedTool(itemId, absX, absZ, floorSubY, count = 1, areaId = getCurAreaId()) {
    if (!Array.isArray(DIG.state.worldDroppedItems)) DIG.state.worldDroppedItems = [];
    const hit = DIG.state.worldDroppedItems.find(
      it => it.areaId === areaId && it.id === itemId && it.absX === absX && it.absZ === absZ && it.floorSubY === floorSubY
    );
    if (hit) hit.count += count;
    else DIG.state.worldDroppedItems.push({ id: itemId, areaId, absX, absZ, floorSubY, count });
  }
  function hasDroppedShovelAt(absX, absZ, refSubY, areaId = getCurAreaId()) {
    return (DIG.state.worldDroppedItems || []).some(
      it => it.areaId === areaId && it.id === 'shovel' && it.count > 0 &&
        it.absX === absX && it.absZ === absZ && Math.abs(it.floorSubY - refSubY) <= 1
    );
  }

  // --- セーブ/ロード＆クリーン検証環境 ---
  function purgeLegacyItems() {
    if (typeof BAG !== 'undefined' && Array.isArray(BAG) && BAG.length > 0) BAG.length = 0;
    if (typeof WORLD_ITEMS !== 'undefined' && Array.isArray(WORLD_ITEMS) && WORLD_ITEMS.length > 0) WORLD_ITEMS.length = 0;
    if (window.ACTIVE_ENTITIES) {
      window.ACTIVE_ENTITIES.npc = null; window.ACTIVE_ENTITIES.enemy = null;
      window.ACTIVE_ENTITIES.wildPet = null; window.ACTIVE_ENTITIES.guestNpc = null;
    }
  }
  function saveDigState() {
    try { if (typeof safeStorage !== 'undefined') safeStorage.setItem(CONST.STORAGE_KEY, JSON.stringify(DIG.state)); } catch (e) {}
  }
  function syncDugCellsToChipMap() {
    if (typeof CHIP_MAP === 'undefined') return;
    const areaId = getCurAreaId();
    Object.keys(DIG.state.dugCells).forEach(k => {
      if (!k.startsWith(areaId + '|')) return;
      const chipKey = k.slice(areaId.length + 1);
      const list = DIG.state.dugCells[k];
      if (!Array.isArray(list) || !list.length) return;
      if (!CHIP_MAP[chipKey]) CHIP_MAP[chipKey] = {};
      list.forEach(tag => { CHIP_MAP[chipKey][tag] = true; });
    });
  }
  function relocatePortalsToCorner() {
    const cornerPortal = { type: 'warp', x: CONST.PORTAL_CORNER_POS.x, z: CONST.PORTAL_CORNER_POS.z, target: 'home', label: '🚪 ポータル（停止中）', needPuzzle: false };
    try {
      const targets = [window.AREA_REGISTRY && window.AREA_REGISTRY.home, (typeof getCurrentAreaDef === 'function') ? getCurrentAreaDef() : null];
      targets.forEach(def => {
        if (def && def.id === 'home') {
          def.portals = [Object.assign({}, cornerPortal)];
          def.spawn = { x: 0, z: 0, lv: 0 }; def.items = []; def.puzzle = null;
        }
      });
    } catch (e) {}
  }
  function buildStairTagsFor5StepNorth() {
    const tags = [];
    for (let sz = 4; sz >= 1; sz--) {
      for (let sy = 5 - sz; sy < 5; sy++) {
        for (let sx = 0; sx < 5; sx++) tags.push(`${sx},${sy},${sz}`);
      }
    }
    return tags;
  }
  function isCleanTerrainValid() {
    if (getCurAreaId() !== 'home' || typeof HEIGHT_MAP === 'undefined') return false;
    return HEIGHT_MAP['0,0'] === 0 && HEIGHT_MAP['0,-1'] === 1 && HEIGHT_MAP['0,-2'] === 1 && HEIGHT_MAP['1,2'] !== 1;
  }

  // 既存セーブにも「枠1:メモ / 枠2:スコップ」を自動補完
  function ensureStarterMemoInFirstCrate() {
    const first = DIG.state.crates && DIG.state.crates[0];
    if (!first || !Array.isArray(first.slots)) return;
    const hasMemoAnywhere = first.slots.some(s => s && s.id === 'memo' && s.count > 0)
      || (DIG.state.pocket && DIG.state.pocket.memo > 0)
      || (DIG.state.equip && DIG.state.equip.hand && DIG.state.equip.hand.id === 'memo')
      || (Array.isArray(DIG.state.diaryMemos) && DIG.state.diaryMemos.some(m => m.includes('ひんとメモ')));
    if (hasMemoAnywhere) return;

    // 枠0にスコップだけ入っている旧初期状態なら、枠0=メモ・枠1=スコップへ並べ替え
    const nonEmpty = first.slots.filter(s => s && s.count > 0);
    if (nonEmpty.length === 1 && nonEmpty[0].id === 'shovel') {
      first.slots = createEmptyCrateSlots(false);
      first.slots[0] = { id: 'memo', count: 1 };
      first.slots[1] = { id: 'shovel', count: nonEmpty[0].count };
    } else {
      // 先頭に空きを作るか空き枠へ追加
      if (!first.slots[0]) first.slots[0] = { id: 'memo', count: 1 };
      else {
        const emptyIdx = first.slots.findIndex(s => !s);
        if (emptyIdx >= 0) first.slots[emptyIdx] = { id: 'memo', count: 1 };
      }
    }
    saveDigState();
  }

  function applyCleanTestTerrain(resetStatus = true) {
    relocatePortalsToCorner();
    if (getCurAreaId() !== 'home') {
      if (typeof window.switchAreaById === 'function') try { window.switchAreaById('home', false); } catch (e) {}
      if (typeof CURRENT_AREA_ID !== 'undefined') try { CURRENT_AREA_ID = 'home'; } catch (e) {}
    }
    relocatePortalsToCorner();
    purgeLegacyItems();

    if (typeof HEIGHT_MAP !== 'undefined') {
      for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) HEIGHT_MAP[`${x},${z}`] = 0;
      HEIGHT_MAP['0,-1'] = 1; HEIGHT_MAP['0,-2'] = 1;
    }
    if (typeof CHIP_MAP !== 'undefined') {
      Object.keys(CHIP_MAP).forEach(k => delete CHIP_MAP[k]);
      CHIP_MAP['0,-1,1'] = {};
      buildStairTagsFor5StepNorth().forEach(tag => { CHIP_MAP['0,-1,1'][tag] = true; });
    }
    DIG.state = createDefaultState();
    DIG.state.dugCells['home|0,-1,1'] = buildStairTagsFor5StepNorth();

    if (resetStatus && typeof ROBOT !== 'undefined' && ROBOT) {
      ROBOT.pos = { x: 0, z: 0, lv: 0, sx: 2, sz: 2, subY: 0 };
      ROBOT.rotY = Math.PI; ROBOT.posture = 'stand'; ROBOT.emotion = 'normal';
      ROBOT.bulbEmotion = null; ROBOT.traumas = []; ROBOT.pet = null;
      if (typeof life !== 'undefined' && life) { life.energy = 100; life.stamina = 100; life.mental = 100; }
      if (typeof GAME_DAY !== 'undefined') GAME_DAY = 1;
      if (typeof TIME_STEP !== 'undefined') TIME_STEP = 0;
      if (typeof AI_MEMORY !== 'undefined' && Array.isArray(AI_MEMORY)) AI_MEMORY.length = 0;
      if (typeof DIARY_LOGS !== 'undefined' && Array.isArray(DIARY_LOGS)) {
        DIARY_LOGS.length = 0;
        DIARY_LOGS.push('🌱 1日目：完全手ぶらでスタート（左隣の箱にメモとスコップ入り）');
      }
      const actEl = document.getElementById('history-action');
      const msgEl = document.getElementById('message-box');
      if (actEl) actEl.innerText = '🌱 検証環境を初期化しました';
      if (msgEl) msgEl.innerText = '完全手ぶらで待機中（左隣の圧縮木箱タップでメモ＆パステルスコップ確認可）。';
      if (window.AICommCore && typeof window.AICommCore.resetPhysicalHistory === 'function') window.AICommCore.resetPhysicalHistory();
    }
    if (typeof saveHomeSnapshotIfHome === 'function') try { saveHomeSnapshotIfHome(); } catch (e) {}
    saveDigState();
    if (typeof saveWorldState === 'function') saveWorldState();
    if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
    if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition(true);
    if (typeof updateAllCamerasTransform === 'function') updateAllCamerasTransform();
    if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
    if (typeof updateAreaAndPetBadgeUI === 'function') updateAreaAndPetBadgeUI();
    if (DIG.ui && DIG.ui.renderDiaryFullUI) DIG.ui.renderDiaryFullUI();
  }

  function loadDigState() {
    let loaded = false;
    try {
      if (typeof safeStorage !== 'undefined') {
        const raw = safeStorage.getItem(CONST.STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.envTag === CONST.CLEAN_ENV_TAG) {
            DIG.state = Object.assign(createDefaultState(), parsed);
            DIG.state.pocket = Object.assign({ soil: 0, wood: 0, stone: 0, shovel: 0, memo: 0 }, parsed.pocket || {});
            DIG.state.equip = Object.assign({ head: null, body: null, waist: null, back: null, hand: null, feet: null }, parsed.equip || {});
            if (!Array.isArray(DIG.state.diaryMemos)) DIG.state.diaryMemos = [];
            if (!Array.isArray(DIG.state.crates) || !DIG.state.crates.length) DIG.state.crates = createDefaultState().crates;
            else if (DIG.items && DIG.items.ensureCrateSlots) DIG.state.crates.forEach(c => DIG.items.ensureCrateSlots(c));
            if (!Array.isArray(DIG.state.worldDroppedItems)) DIG.state.worldDroppedItems = [];
            ensureStarterMemoInFirstCrate();
            loaded = true;
          }
        }
      }
    } catch (e) { DIG.state = createDefaultState(); }

    if (!loaded || !isCleanTerrainValid()) {
      applyCleanTestTerrain(true);
    } else {
      relocatePortalsToCorner();
      purgeLegacyItems();
      syncDugCellsToChipMap();
      if (typeof ROBOT !== 'undefined' && ROBOT && ROBOT.pos) {
        ROBOT.pos.sx = Math.max(0, Math.min(4, Math.round(Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2)));
        ROBOT.pos.sz = Math.max(0, Math.min(4, Math.round(Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2)));
        if (DIG.move && DIG.move.getRobotBaseSubY) ROBOT.pos.subY = DIG.move.getRobotBaseSubY();
      }
    }
  }

  DIG.core = {
    createEmptyCrateSlots, createDefaultState, addDiaryMemo, getDiaryMemos,
    getCurAreaId, getMinUnderLv, getMinSubY, getHeadStackHeight,
    getOriginalSizeSpec, getOriginalBodySpec, getSizeStats,
    getPocketResourceTotal, getHandResourceTotal, getCarriedResourceTotal, getMaxAddableShovelsToPocket,
    absToTile, isInsideIslandAbs, absToWorldXZ, subYToLvSy, floorSubYToRobotLv,
    getRobotAbsPos, getFootprintBounds, getFrontEdgeOffset, isInsideRobotFootprint,
    isWaterProtectedCell, hasSolidTerrainSubVoxel, hasSolidTerrainAtAbsSubY, isExposedToAir,
    getTerrainColumnTopSubY, findFloorSubYBelow,
    makeSoilKey, parseSoilKey, getLooseSoilAtFloor, addLooseSoilAtFloor,
    getLooseSoilStacksInColumn, hasLooseSoilAtSubY, settleFloatingLooseSoilsAtColumn,
    addDroppedTool, hasDroppedShovelAt,
    purgeLegacyItems, saveDigState, syncDugCellsToChipMap,
    relocatePortalsToCorner, buildStairTagsFor5StepNorth, isCleanTerrainValid,
    ensureStarterMemoInFirstCrate, applyCleanTestTerrain, loadDigState
  };

  if (window.DebugGuard) window.DebugGuard.markLoaded('dig_core.js');
})();
