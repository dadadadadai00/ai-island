// ============================================================================
// 【レゴ物理環境＆1人称純粋知覚モジュール：rules_dig.js（v5.2 SIZE_SPECS原本リンク・1分割階段＆脱出修正版）】
// ・brain.js の SIZE_SPECS（スイスイ階段 stairMax / よじ登り subH / ほふく crawlH）を原本リンク参照
// ・1分割単位の厳密な段差上り(階段/よじ登り)・下り(階段/安全着地/落下)・自動ほふく・角抜け防止へ統合
// ・ロボットの3D足元高さを1分割単位で正確に同期（world.js無改造のまま1段穴の上り下りを完全一致）
// ・1段くぼみの中からでも手が届く高さの周囲安定床へ土を散らばせられるよう修正（満杯誤判定の詰み解消）
// ・掘削3分離(dig_front/dig_down/dig_up)・DDA視界・低天井記号「^」・頭上ピラミッド・圧縮木箱220を維持
// ※ brain.js / world.js / index.html / ai_comm.js は無改造のまま動作します
// ============================================================================
(function initDigRulesModule() {
  if (window.DigRulesModule) return;

  const STORAGE_KEY = 'rules_dig_state_v3';
  const SUB_SIZE = 0.2;
  const CRATE_CAPACITY = 220;

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
      initializedStart: false,
      pocketSoil: 0,
      headSoil: 0,
      crates: [
        { id: 'crate_1', areaId: 'home', x: -1, z: 0, capacity: CRATE_CAPACITY, soil: 0 }
      ],
      dugCells: {},
      worldSubSoils: {}, // key: `${areaId}|${absX},${absZ}|${floorSubY}` -> count
      shovel: {
        held: true,
        areaId: 'home',
        absX: 2,
        absZ: 2
      }
    };
  }

  let DIG_STATE = createDefaultState();
  let lastTurnActionId = null;
  let lastMoveVisualKind = null; // 'stairs_up' | 'scramble_climb' | 'stairs_down' | 'safe_landing' | 'high_drop' | null

  // world.js / brain.js の元の getSurfaceYAt を退避（外部呼び出し＆フォールバック用）
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
      // ほふく前進中は1段まで、立位は身長(subH)までよじ登り可能（brain.js原本ルール準拠）
      maxStepUpSub: isCrawl ? 1 : hRank
    };
  }

  function getResourceTotalCount() {
    const bagItems = (typeof BAG !== 'undefined' && Array.isArray(BAG)) ? BAG.length : 0;
    return (DIG_STATE.pocketSoil || 0) + bagItems;
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
  // 0. 旧ボタンイベント除去 ＆ こども用シャベル右手装着 ＆ 頭上ピラミッド3D土台
  // --------------------------------------------------------------------------
  (function rebindActionButtonCleanly() {
    const oldBtn = document.getElementById('btn-action');
    if (oldBtn && oldBtn.parentNode) {
      const newBtn = oldBtn.cloneNode(true);
      oldBtn.parentNode.replaceChild(newBtn, oldBtn);
      newBtn.addEventListener('click', () => {
        if (typeof window.executeTurn === 'function') window.executeTurn();
      });
    }
  })();

  const handShovelMeshes = [];
  const headPyramidGroup = new THREE.Group();
  headPyramidGroup.name = 'dig_head_pyramid_group';
  if (typeof robotGroup !== 'undefined' && robotGroup) {
    robotGroup.add(headPyramidGroup);
  }

  function createKidShovelMesh(scale = 1.0) {
    const grp = new THREE.Group();
    const matHandle = new THREE.MeshLambertMaterial({ color: 0xf43f5e });
    const matGrip   = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
    const matScoop  = new THREE.MeshLambertMaterial({ color: 0x0ea5e9 });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022 * scale, 0.022 * scale, 0.28 * scale, 8), matHandle);
    grp.add(shaft);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.10 * scale, 0.036 * scale, 0.036 * scale), matGrip);
    grip.position.set(0, 0.15 * scale, 0);
    grp.add(grip);

    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.14 * scale, 0.16 * scale, 0.035 * scale), matScoop);
    scoop.position.set(0, -0.18 * scale, 0.02 * scale);
    scoop.rotation.x = -0.22;
    grp.add(scoop);

    return grp;
  }

  function setupKidShovelOnRobotHands() {
    try {
      if (typeof boxTool !== 'undefined' && boxTool) {
        boxTool.children.forEach(ch => { ch.visible = false; });
      }
      if (typeof stickTool !== 'undefined' && stickTool) {
        stickTool.children.forEach(ch => { ch.visible = false; });
      }
      if (typeof boxArmRPivot !== 'undefined' && boxArmRPivot) {
        const sh = createKidShovelMesh(1.25);
        sh.position.set(0.04, -0.26, 0.18);
        sh.rotation.x = Math.PI / 2.2;
        boxArmRPivot.add(sh);
        handShovelMeshes.push(sh);
      }
      if (typeof SB !== 'undefined' && SB && SB.wristR) {
        const sh = createKidShovelMesh(1.25);
        sh.position.set(0.02, -0.06, 0.18);
        sh.rotation.x = Math.PI / 2.2;
        SB.wristR.add(sh);
        handShovelMeshes.push(sh);
      }
    } catch (e) {}
  }

  function syncHandShovelVisibility() {
    const show = Boolean(DIG_STATE.shovel && DIG_STATE.shovel.held);
    handShovelMeshes.forEach(m => { m.visible = show; });
  }

  setupKidShovelOnRobotHands();

  // --------------------------------------------------------------------------
  // 1. 厳密5×5×5サブ座標ユーティリティ（重力・床・天井・散らばり土）
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

  // 整数正規化（小数混入によるレイキャスト不一致・壁消失を完全に防止）
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

  function isInsideRobotFootprint(absX, absZ, centerAbsX, centerAbsZ, reachW) {
    const { minOff, maxOff } = getFootprintBounds(reachW);
    return (
      absX >= centerAbsX + minOff && absX <= centerAbsX + maxOff &&
      absZ >= centerAbsZ + minOff && absZ <= centerAbsZ + maxOff
    );
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

  // 指定高さから真下へ探索し、最初に当たる固体地形の直上面（空間底まで落ちる場合は minSubY）を返す
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

  // 散らばり土（階層floorSubY付きキー: `${areaId}|${absX},${absZ}|${floorSubY}`）
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

  // 指定高さに散らばり土が存在するか
  function hasLooseSoilAtSubY(absX, totalSubY, absZ, areaId = getCurAreaId()) {
    const stacks = getLooseSoilStacksInColumn(absX, absZ, areaId);
    for (let i = 0; i < stacks.length; i++) {
      if (totalSubY >= stacks[i].floorSubY && totalSubY < stacks[i].floorSubY + stacks[i].count) {
        return true;
      }
    }
    return false;
  }

  // 下の地形が削られて浮いた散らばり土を重力で下の床（または空間底）へ落とす
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

  // キャラ占有範囲（reachW×reachW）全体で、footSubY から天井まで何分割空いているかを返す
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

  // キャラの現在の正確な足元サブY（1分割単位・散らばり土の上面も考慮）を取得
  function computeExactFootSubYAt(centerAbsX, centerAbsZ, hintSubY, reachW) {
    const areaId = getCurAreaId();
    const { minOff, maxOff } = getFootprintBounds(reachW);
    let bestSupport = getMinSubY();
    for (let ox = minOff; ox <= maxOff; ox++) {
      for (let oz = minOff; oz <= maxOff; oz++) {
        const cx = centerAbsX + ox;
        const cz = centerAbsZ + oz;
        if (!isInsideIslandAbs(cx, cz)) continue;
        // 埋まり防止のため hintSubY から上に空いている高さを確認（最大+5段）
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

  function isCrateAtAbs(absX, absZ, areaId = getCurAreaId()) {
    return DIG_STATE.crates.some(c => {
      if (c.areaId !== areaId) return false;
      const cx = c.x * 5 + 2;
      const cz = c.z * 5 + 2;
      // 5×5×5圧縮木箱（1大ブロック全体）
      return Math.abs(absX - cx) <= 2 && Math.abs(absZ - cz) <= 2;
    });
  }

  function isWorldItemAtAbs(absX, absZ) {
    if (typeof WORLD_ITEMS === 'undefined') return null;
    const tX = absToTile(absX);
    const tZ = absToTile(absZ);
    if (tX.sub !== 2 || tZ.sub !== 2) return null;
    return WORLD_ITEMS.find(it => it.x === tX.tile && it.z === tZ.tile) || null;
  }

  // 旧セーブデータの自動マイグレーション（木箱220化・headSoil初期化・散らばり土キー階層化）
  function loadDigState() {
    try {
      if (typeof safeStorage !== 'undefined') {
        const raw = safeStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            DIG_STATE = Object.assign(createDefaultState(), parsed);
            if (!Number.isFinite(DIG_STATE.headSoil)) DIG_STATE.headSoil = 0;
            if (!Array.isArray(DIG_STATE.crates) || !DIG_STATE.crates.length) {
              DIG_STATE.crates = createDefaultState().crates;
            } else {
              DIG_STATE.crates.forEach(c => {
                if (!c.capacity || c.capacity < CRATE_CAPACITY) c.capacity = CRATE_CAPACITY;
              });
            }
            if (!DIG_STATE.shovel || typeof DIG_STATE.shovel !== 'object') {
              DIG_STATE.shovel = createDefaultState().shovel;
            }
            if (!DIG_STATE.worldSubSoils || typeof DIG_STATE.worldSubSoils !== 'object') {
              DIG_STATE.worldSubSoils = {};
            }
          }
        }
      }
    } catch (e) {
      DIG_STATE = createDefaultState();
    }

    if (!DIG_STATE.initializedStart) {
      if (typeof BAG !== 'undefined' && Array.isArray(BAG)) BAG.length = 0;
      DIG_STATE.pocketSoil = 0;
      DIG_STATE.headSoil = 0;
      DIG_STATE.shovel = { held: true, areaId: getCurAreaId(), absX: 2, absZ: 2 };
      DIG_STATE.initializedStart = true;
      saveDigState();
      if (typeof saveWorldState === 'function') saveWorldState();
    }

    syncDugCellsToChipMap();

    // 旧キー `${areaId}|${absX},${absZ}` を `${areaId}|${absX},${absZ}|${floorSubY}` へ自動変換
    let migrated = false;
    const nextSoils = {};
    Object.keys(DIG_STATE.worldSubSoils).forEach(k => {
      const cnt = DIG_STATE.worldSubSoils[k] || 0;
      if (cnt <= 0) return;
      const p = parseSoilKey(k);
      if (!p) return;
      const floorY = (p.floorSubY !== null) ? p.floorSubY : getTerrainColumnTopSubY(p.absX, p.absZ);
      const nk = makeSoilKey(p.absX, p.absZ, floorY, p.areaId);
      nextSoils[nk] = (nextSoils[nk] || 0) + cnt;
      if (p.floorSubY === null) migrated = true;
    });
    DIG_STATE.worldSubSoils = nextSoils;
    if (migrated) saveDigState();

    // 起動時のロボット足元サブYを同期
    if (typeof ROBOT !== 'undefined' && ROBOT && ROBOT.pos) {
      ROBOT.pos.subY = getRobotBaseSubY();
    }
  }

  // --------------------------------------------------------------------------
  // 2. A案：キャラの1人称視野記号マップ（厳密DDA視線・停止180° / 移動狭い前方視野）
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

  // 背後（135〜180°）判定（左右45〜90°は即行動OK、背後のみ振り返り1ターン消費）
  function isBehindCurrentFacing(dir) {
    if (!dir) return false;
    const curRot = ROBOT.rotY || 0;
    const cx = Math.sin(curRot), cz = Math.cos(curRot);
    const len = Math.hypot(dir.dx || 0, dir.dz || 0) || 1;
    const tx = (dir.dx || 0) / len;
    const tz = (dir.dz || 0) / len;
    const dot = cx * tx + cz * tz;
    // cos(112.5°) ≒ -0.383（90°真横はdot=0で即行動OK、135°は-0.707・180°は-1で背後扱い）
    return dot < -0.38;
  }

  // 厳密2Dグリッド線分（DDA）による視線判定
  function isVisibleFromEye(curAbsX, curAbsZ, eyeSubY, targetAbsX, targetAbsZ) {
    const x0 = Math.round(curAbsX);
    const z0 = Math.round(curAbsZ);
    const x1 = Math.round(targetAbsX);
    const z1 = Math.round(targetAbsZ);
    if (x0 === x1 && z0 === z1) return true;

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
      if (hasLooseSoilAtSubY(mx, eyeSubY, mz)) return true;
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
        if (DIG_STATE.shovel && !DIG_STATE.shovel.held && DIG_STATE.shovel.areaId === areaId &&
            DIG_STATE.shovel.absX === tx && DIG_STATE.shovel.absZ === tz) {
          ch = 'S';
        } else if (isCrateAtAbs(tx, tz, areaId)) {
          ch = 'B';
        } else {
          const item = isWorldItemAtAbs(tx, tz);
          const floorHere = findFloorSubYBelow(tx, tz, baseSubY + 1);
          const loose = getLooseSoilAtFloor(tx, tz, floorHere, areaId);
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

          if (item && item.type === 'apple') {
            ch = 'A';
          } else if (loose > 0 && floorHere <= baseSubY + 1) {
            ch = String(Math.min(9, loose));
          } else if (solid0 && solid1) {
            ch = '#';
          } else if (solid0 && !solid1) {
            ch = '+';
          } else if (!solid0 && hasLowCeiling) {
            ch = '^';
          } else if (floorHere === baseSubY) {
            ch = '.';
          } else {
            ch = 'v';
          }
        }
        row += ` ${ch} `;
      }
      topRows.push(row.trimEnd());
    }

    // 目の前1列目の正面断面図（列ラベル付きで真正面と左右を明確化）
    const frontDist = Math.floor(stats.reachW / 2) + 1;
    const sliceRows = ['列 : L2 L1 正 R1 R2'];
    for (let h = 4; h >= -1; h--) {
      const label = h >= 0 ? `高${h + 1}` : '床 ';
      let row = `${label}: `;
      for (let lat = -2; lat <= 2; lat++) {
        const tx = absX + basis.fx * frontDist + basis.rx * lat;
        const tz = absZ + basis.fz * frontDist + basis.rz * lat;
        if (!isInsideIslandAbs(tx, tz)) {
          row += ' ~ ';
          continue;
        }
        const curY = baseSubY + h;
        if (hasSolidTerrainAtAbsSubY(tx, curY, tz)) {
          row += ' # ';
        } else if (hasLooseSoilAtSubY(tx, curY, tz, areaId)) {
          row += ' o ';
        } else if (h >= 0 && h < 5 && isCrateAtAbs(tx, tz, areaId)) {
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
      `記号: @=自分 #=壁(高1〜高2以上) +=1段高 ^=高1空洞(高2以上に壁/低天井) .=平坦/空間 v=低い床/穴 1-9/o=散らばり土(段数) B=圧縮木箱(5x5x5) S=シャベル A=リンゴ ~=端 ?=死角`
    ].join('\n');
  }

  // --------------------------------------------------------------------------
  // 3. 3D描画（5×5×5圧縮木箱・散らばり土・地面シャベル・頭上ピラミッド）
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
    syncHandShovelVisibility();
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

    if (DIG_STATE.shovel && !DIG_STATE.shovel.held && DIG_STATE.shovel.areaId === areaId) {
      const sh = createKidShovelMesh(1.25);
      const { wx, wz } = absToWorldXZ(DIG_STATE.shovel.absX, DIG_STATE.shovel.absZ);
      const floorY = getTerrainColumnTopSubY(DIG_STATE.shovel.absX, DIG_STATE.shovel.absZ);
      const topSubY = floorY + getLooseSoilAtFloor(DIG_STATE.shovel.absX, DIG_STATE.shovel.absZ, floorY, areaId);
      sh.position.set(wx, topSubY * SUB_SIZE + 0.06, wz);
      sh.rotation.set(Math.PI / 2 - 0.12, 0.7, 0.4);
      digVisualGroup.add(sh);
    }
  }

  // --------------------------------------------------------------------------
  // 4. 物理アクション実装（純粋な物理結果のみ返却・誘導テキストなし）
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

  // 正面距離1に「自分の届く高さより上」の壁だけが残っているかを確認（空振り時の物理事実通知用）
  function hasUnreachableUpperWallInFront(dir, stats) {
    const { absX: curAbsX, absZ: curAbsZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const dx = Math.sign((dir && dir.dx) || 0);
    const dz = Math.sign((dir && dir.dz) || 0);
    let px = -dz, pz = dx;
    if (dx !== 0 && dz !== 0) { px = -dz; pz = 0; }
    if (px === 0 && pz === 0) { px = 1; pz = 0; }

    const halfW = Math.floor(stats.reachW / 2);
    const maxDist = Math.floor(stats.reachW / 2) + 1;
    for (let dist = 1; dist <= maxDist; dist++) {
      for (let i = 0; i < stats.reachW; i++) {
        const w = i - halfW;
        const tx = curAbsX + dx * dist + px * w;
        const tz = curAbsZ + dz * dist + pz * w;
        for (let h = stats.reachH; h <= 4; h++) {
          if (hasSolidTerrainAtAbsSubY(tx, baseSubY + h, tz)) return true;
        }
      }
    }
    return false;
  }

  // 掘削対象探索（モード別厳密分離：'front'=正面の壁のみ / 'down'=足元・目の前の地面のみ / 'up'=頭上の天井のみ）
  function findDigTargetByMode(mode, dir, thought) {
    const stats = getSizeStats();
    const { absX: curAbsX, absZ: curAbsZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();

    const dx = Math.sign((dir && dir.dx) || 0);
    const dz = Math.sign((dir && dir.dz) || 0);
    let px = -dz, pz = dx;
    if (dx !== 0 && dz !== 0) { px = -dz; pz = 0; }
    if (px === 0 && pz === 0) { px = 1; pz = 0; }

    const t = String(thought || '');
    const halfW = Math.floor(stats.reachW / 2);
    const wList = [];
    for (let i = 0; i < stats.reachW; i++) wList.push(i - halfW);
    if (t.includes('左')) wList.sort((a, b) => a - b);
    else if (t.includes('右')) wList.sort((a, b) => b - a);
    else wList.sort((a, b) => Math.abs(a) - Math.abs(b));

    const checkCell = (absX, totalSubY, absZ, kindLabel) => {
      if (!isInsideIslandAbs(absX, absZ)) return null;
      const tX = absToTile(absX);
      const tZ = absToTile(absZ);
      const yInfo = subYToLvSy(totalSubY);
      if (!hasSolidTerrainSubVoxel(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) return null;
      if (!isExposedToAir(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) return null;
      return {
        tx: tX.tile, tz: tZ.tile, lv: yInfo.lv,
        tsx: tX.sub, tsy: yInfo.sy, tsz: tZ.sub,
        absX, absZ, totalSubY, kind: kindLabel
      };
    };

    const maxDist = Math.floor(stats.reachW / 2) + 1;
    const distList = [];
    for (let d = 1; d <= maxDist; d++) distList.push(d);

    // 1. 正面の壁専用（地面・天井へは絶対にフォールバックしない）
    if (mode === 'front') {
      const hList = [];
      for (let y = 0; y < stats.reachH; y++) hList.push(y);
      hList.sort((a, b) => b - a);

      for (let di = 0; di < distList.length; di++) {
        const dist = distList[di];
        for (let hi = 0; hi < hList.length; hi++) {
          for (let wi = 0; wi < wList.length; wi++) {
            const hit = checkCell(curAbsX + dx * dist + px * wList[wi], baseSubY + hList[hi], curAbsZ + dz * dist + pz * wList[wi], '壁');
            if (hit) return hit;
          }
        }
      }
      return null;
    }

    // 2. 地面・足元専用（baseSubY - 1 のみ対象）
    if (mode === 'down') {
      const preferUnderFeet = t.includes('真下') || t.includes('足元');
      const dOrder = preferUnderFeet ? [0, ...distList] : [...distList, 0];
      for (let di = 0; di < dOrder.length; di++) {
        const dist = dOrder[di];
        const kindLabel = (dist === 0) ? '足元の床' : '目の前の地面';
        for (let wi = 0; wi < wList.length; wi++) {
          const hit = checkCell(curAbsX + dx * dist + px * wList[wi], baseSubY - 1, curAbsZ + dz * dist + pz * wList[wi], kindLabel);
          if (hit) return hit;
        }
      }
      return null;
    }

    // 3. 天井専用（現在姿勢の頭上〜届く高さの上面のみ対象）
    if (mode === 'up') {
      const minCeilH = Math.max(1, stats.bodyHeight);
      const maxCeilH = stats.reachH;
      const dOrder = [0, ...distList];
      for (let h = minCeilH; h <= maxCeilH; h++) {
        for (let di = 0; di < dOrder.length; di++) {
          const dist = dOrder[di];
          const kindLabel = (dist === 0) ? '頭上の天井' : '前方の天井';
          for (let wi = 0; wi < wList.length; wi++) {
            const hit = checkCell(curAbsX + dx * dist + px * wList[wi], baseSubY + h, curAbsZ + dz * dist + pz * wList[wi], kindLabel);
            if (hit) return hit;
          }
        }
      }
      return null;
    }

    return null;
  }

  // 散らばり＆落下先の厳密決定：
  // ① 掘った真下や奥に抜けた空間があれば押し出し落下（底なしは空間底まで重力落下）
  // ② 奥が壁塞がりなら、キャラ占有外・掘削対象外・木箱外で太さ幅の周囲安定床（同じ高さ〜届く高さ）へ高さ×2段まで散らばり
  // ③ 全部埋まっていれば null（置き場不足で掘削停止）
  function findDropSlotForDugSoil(target, dir, stats) {
    const areaId = getCurAreaId();
    const { absX: rAbsX, absZ: rAbsZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const dx = Math.sign((dir && dir.dx) || 0);
    const dz = Math.sign((dir && dir.dz) || 0);

    function canPlaceOnFloor(tx, tz, floorY, ignoreMaxHeightOnDeepFall = false) {
      if (!isInsideIslandAbs(tx, tz)) return false;
      if (isCrateAtAbs(tx, tz, areaId)) return false;
      if (isInsideRobotFootprint(tx, tz, rAbsX, rAbsZ, stats.reachW) && Math.abs(floorY - baseSubY) <= stats.reachH) {
        return false;
      }
      const curStack = getLooseSoilAtFloor(tx, tz, floorY, areaId);
      const limit = ignoreMaxHeightOnDeepFall ? 10 : stats.maxStackHeight;
      if (curStack >= limit) return false;
      const placeY = floorY + curStack;
      if (hasSolidTerrainAtAbsSubY(tx, placeY, tz)) return false;
      return true;
    }

    // ①-A：掘った真下が空間 → 真下の床または空間底へ重力落下
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

    // ①-B：奥に抜けた空間（●■☆）→ 奥へ押し出して重力落下（底がなければ底まで落下）
    if (dx !== 0 || dz !== 0) {
      const bx = target.absX + dx;
      const bz = target.absZ + dz;
      if (isInsideIslandAbs(bx, bz) && !isCrateAtAbs(bx, bz, areaId) &&
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

    // ②：奥が壁塞がり → キャラ周囲（太さ幅・キャラ占有外・掘削対象外）の安定床へ高さ×2段まで散らばり
    // 1段くぼんだ穴の中からでも、手が届く高さ（baseSubY 〜 baseSubY + reachH）の周囲床へ放り出せるようにする
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
        if (isCrateAtAbs(tx, tz, areaId)) continue;

        // 同じ高さ〜手が届く高さ(+reachH)の中で、空間に接している安定床面を探索
        let chosenFloorY = null;
        for (let h = 0; h <= stats.reachH; h++) {
          const yCheck = baseSubY + h;
          if (!hasSolidTerrainAtAbsSubY(tx, yCheck, tz) && hasSolidTerrainAtAbsSubY(tx, yCheck - 1, tz)) {
            chosenFloorY = yCheck;
            break;
          }
        }
        if (chosenFloorY === null) continue;

        const stack = getLooseSoilAtFloor(tx, tz, chosenFloorY, areaId);
        if (stack >= stats.maxStackHeight) continue;
        if (hasSolidTerrainAtAbsSubY(tx, chosenFloorY + stack, tz)) continue;

        const dist = Math.max(Math.abs(ox), Math.abs(oz));
        const heightDiff = chosenFloorY - baseSubY;
        candidates.push({
          absX: tx,
          absZ: tz,
          floorSubY: chosenFloorY,
          stack,
          dist,
          heightDiff,
          rand: Math.random()
        });
      }
    }

    if (!candidates.length) return null;

    // 同じ高さの床・低い段数・近い安定床を優先しつつ自然に散らばる
    candidates.sort((a, b) =>
      (a.heightDiff * 1.2 + a.stack * 1.4 + a.dist * 0.25 + a.rand * 0.6) -
      (b.heightDiff * 1.2 + b.stack * 1.4 + b.dist * 0.25 + b.rand * 0.6)
    );
    const chosen = candidates[0];
    return {
      absX: chosen.absX,
      absZ: chosen.absZ,
      floorSubY: chosen.floorSubY,
      fellDown: false,
      note: chosen.heightDiff > 0 ? '周囲の1段上の床へ散らばった' : '周囲の床へ散らばった'
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
    const target = findDigTargetByMode(mode, dir, thought);

    if (!target) {
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

    // 足元の床を掘り抜いて支えが完全に失われた場合は、その場で下の空間へ重力落下
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
      actionLabel: `🪏 ${dirPrefix}${target.kind}を1分割削った(${dropPos.fellDown ? '下方へ落下' : `積${totalHere}/${stats.maxStackHeight}段`})`,
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
        const nextLayers = getHeadStackHeight(curHead + 1, stats.reachW);
        if (ROBOT.posture === 'crawl' && clearance <= stats.crawlH) {
          blockedByCeiling = true;
          break;
        }
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
      if (blockedByCeiling) {
        const postureNote = ROBOT.posture === 'crawl' ? 'ほふく前進中で' : '';
        return {
          actionLabel: `🟫 天井が低く頭上に載せられなかった(空き${clearance}段)`,
          physicalResult: `ポケットが満杯で、${postureNote}天井の空き(${clearance}分割)が足りないため頭上ピラミッドへ積めなかった`,
          moved: false
        };
      }
      return {
        actionLabel: '🟫 土を拾えなかった',
        physicalResult: '上限に達しており土を拾えなかった',
        moved: false
      };
    }

    // 足元の散らばり土を拾った場合に高さを再同期
    ROBOT.pos.subY = computeExactFootSubYAt(absX, absZ, baseSubY, stats.reachW);
    ROBOT.pos.lv = floorSubYToRobotLv(ROBOT.pos.subY);

    life.stamina = Math.max(0, life.stamina - 2);
    ROBOT.params.logic = Math.min(100, (ROBOT.params.logic || 50) + 2);
    saveDigState();

    const newHeadLayers = getHeadStackHeight(DIG_STATE.headSoil || 0, stats.reachW);
    const parts = [];
    if (pickedPocket > 0) parts.push(`ポケット+${pickedPocket}`);
    if (pickedHead > 0) parts.push(`頭上ピラミッド+${pickedHead}`);
    const ceilNote = blockedByCeiling ? '（天井が低くこれ以上は頭上に載せられない）' : '';

    return {
      actionLabel: `🧺 土を${totalPicked}個回収(${parts.join('・')})`,
      physicalResult: `周囲の土を${totalPicked}個拾った(${parts.join('、')})。現在ポケット${DIG_STATE.pocketSoil}/${stats.pocketCap}個、頭上${DIG_STATE.headSoil}/${stats.headCap}個(+${newHeadLayers}段)${ceilNote}`,
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
    const dist = Math.floor(stats.reachW / 2) + 1;
    const tx = absX + Math.sign(dir.dx || 0) * dist;
    const tz = absZ + Math.sign(dir.dz || 0) * dist;

    if (!isInsideIslandAbs(tx, tz) || isCrateAtAbs(tx, tz, areaId)) {
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
    if (hasSolidTerrainAtAbsSubY(tx, floorY + curStack, tz)) {
      return {
        actionLabel: `🟫 ${dName}は壁・天井で塞がっており置けない`,
        physicalResult: `${dName}の目の前は固体ブロックで塞がっており土を置けなかった`,
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
    return DIG_STATE.crates.find(c =>
      c.areaId === areaId &&
      Math.abs(Math.round(ROBOT.pos.x) - c.x) <= 1 &&
      Math.abs(Math.round(ROBOT.pos.z) - c.z) <= 1
    ) || null;
  }

  function runStoreCrate() {
    const crate = findNearbyCrate();
    if (!crate) {
      return {
        actionLabel: '📦 すぐ隣に圧縮木箱がなかった',
        physicalResult: '手が届く隣に圧縮木箱がなく、収納できなかった',
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

  function runShovelFree(dir, thought) {
    if (isBehindCurrentFacing(dir)) {
      return runTurnAroundOnly(dir, 'シャベル操作');
    }

    const t = String(thought || '');
    const dName = dir.name.replace('(斜め)', '');
    const areaId = getCurAreaId();
    const { absX, absZ } = getRobotAbsPos();
    ROBOT.rotY = dir.rot;

    if (!DIG_STATE.shovel.held) {
      if (DIG_STATE.shovel.areaId !== areaId) {
        return {
          actionLabel: '🪏 近くにシャベルがなかった',
          physicalResult: '手が届く周囲にシャベルがなく、拾えなかった',
          moved: false
        };
      }
      const dist = Math.max(Math.abs(DIG_STATE.shovel.absX - absX), Math.abs(DIG_STATE.shovel.absZ - absZ));
      if (dist <= 3) {
        DIG_STATE.shovel.held = true;
        saveDigState();
        return {
          actionLabel: '🪏 こども用シャベルを拾った',
          physicalResult: '足元付近にあったこども用シャベルを右手に拾い上げた',
          moved: false
        };
      }
      return {
        actionLabel: '🪏 手が届く範囲にシャベルがなかった',
        physicalResult: '手が届く範囲にシャベルがなく、触れなかった',
        moved: false
      };
    }

    if (t.includes('投') || t.includes('ポイ') || t.includes('放り') || t.includes('飛ば')) {
      const throwDist = 4;
      const tx = Math.max(-10, Math.min(14, absX + Math.sign(dir.dx || 0) * throwDist));
      const tz = Math.max(-10, Math.min(14, absZ + Math.sign(dir.dz || 0) * throwDist));
      DIG_STATE.shovel = { held: false, areaId, absX: tx, absZ: tz };
      life.mental = Math.min(100, life.mental + 6);
      saveDigState();
      return {
        actionLabel: `🪏 シャベルを${dName}へ放り投げた`,
        physicalResult: `こども用シャベルを${dName}方向へ約4分割先に投げ、右手は空になった`,
        moved: false
      };
    }

    if (t.includes('遊') || t.includes('振') || t.includes('ブン')) {
      life.mental = Math.min(100, life.mental + 6);
      ROBOT.params.cautionLimiter = Math.min(100, (ROBOT.params.cautionLimiter || 50) + 2);
      return {
        actionLabel: '🪏 シャベルを空中で振った',
        physicalResult: '右手のこども用シャベルを空中で振った',
        moved: false
      };
    }

    const tx = Math.max(-10, Math.min(14, absX + Math.sign(dir.dx || 0)));
    const tz = Math.max(-10, Math.min(14, absZ + Math.sign(dir.dz || 0)));
    DIG_STATE.shovel = { held: false, areaId, absX: tx, absZ: tz };
    saveDigState();
    return {
      actionLabel: `🪏 シャベルを${dName}の地面に置いた`,
      physicalResult: `こども用シャベルを${dName}のすぐそばの地面に置き、右手は空になった`,
      moved: false
    };
  }

  // 足元占有範囲の支えを調べ、すべて空間（底が抜けた）なら下の着地床Yを返す
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

  // 1分割移動先の足場高さ・姿勢・段差可否を brain.js の SIZE_SPECS 原本ルールで厳密評価
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
        if (isCrateAtAbs(cx, cz, areaId)) {
          return { ok: false, reason: '圧縮木箱' };
        }

        // curBaseSubY から上へ maxClimbUp 段以内で、固体地形も散らばり土もない最初の空き空間を探す
        let openY = null;
        let hitLooseSoil = false;
        let looseHeightHere = 0;

        for (let up = 0; up <= maxClimbUp; up++) {
          const yTest = curBaseSubY + up;
          const solid = hasSolidTerrainAtAbsSubY(cx, yTest, cz);
          const loose = hasLooseSoilAtSubY(cx, yTest, cz, areaId);
          if (!solid && !loose) {
            openY = yTest;
            break;
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

    // 移動先の天井クリアランスを確認し、立位 / ほふく姿勢を自動決定
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

    // 段差の種類を原本ルール（stairMax / subH）で分類
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

      // 斜め移動の角抜け防止（brain.jsの世界観準拠：両隣が壁なら斜めすり抜け不可）
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

      // よじ登り・身長超え落下時はその段差で一旦止まる（1段ずつの自然な挙動）
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
  // 5. 日記帳アイテム枠UI（上段1枠目:シャベル / 2〜5枠目:資源＆頭上 / 下段5枠:圧縮木箱220）
  // --------------------------------------------------------------------------
  const ITEM_ICONS = { apple: '🍎', stone: '🪨', oil: '🧴', grass: '🌿' };

  function renderPocketAndCrateDiaryUI() {
    const grid = document.getElementById('bag-grid');
    if (!grid) return;

    const stats = getSizeStats();
    const headNow = DIG_STATE.headSoil || 0;
    if (grid.previousElementSibling) {
      grid.previousElementSibling.innerText =
        `🎒 ポケット(上限${stats.pocketCap})・頭上(${headNow}/${stats.headCap}) ／ 📦圧縮木箱(${DIG_STATE.crates.length}/5箱)`;
    }

    grid.innerHTML = '';

    // 1枠目：こども用シャベル
    {
      const slot = document.createElement('div');
      slot.className = 'bag-slot';
      slot.style.flexDirection = 'column';
      slot.style.gap = '1px';
      slot.style.padding = '2px';

      if (DIG_STATE.shovel && DIG_STATE.shovel.held) {
        slot.classList.add('filled');
        slot.style.borderColor = '#38bdf8';
        slot.style.background = '#e0f2fe';
        slot.innerHTML = `<span style="font-size:15px;line-height:1;">🪏</span><span style="font-size:8.5px;font-weight:900;color:#0369a1;">シャベル</span>`;
        slot.onclick = () => {
          if (typeof showToast === 'function') showToast('🪏 こども用シャベル（右手所持中）');
        };
      } else {
        slot.style.borderStyle = 'dashed';
        slot.style.borderColor = '#94a3b8';
        slot.style.background = '#f1f5f9';
        const sx = DIG_STATE.shovel ? absToTile(DIG_STATE.shovel.absX).tile : 0;
        const sz = DIG_STATE.shovel ? absToTile(DIG_STATE.shovel.absZ).tile : 0;
        slot.innerHTML = `<span style="font-size:13px;opacity:0.45;line-height:1;">🪏</span><span style="font-size:8px;font-weight:800;color:#64748b;">放置(${sx},${sz})</span>`;
        slot.onclick = () => {
          if (typeof showToast === 'function') showToast(`🪏 こども用シャベルは(${sx},${sz})付近に放置中`);
        };
      }
      grid.appendChild(slot);
    }

    // 2〜5枠目：資源枠（2枠目に分割土ポケット＋頭上ピラミッド残数を表示）
    for (let i = 0; i < 4; i++) {
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
        const bagIdx = i - 1;
        const item = (bagIdx >= 0 && typeof BAG !== 'undefined' && BAG[bagIdx]) ? BAG[bagIdx] : null;
        if (item) {
          slot.classList.add('filled');
          slot.innerHTML = `<span style="font-size:18px;line-height:1;">${ITEM_ICONS[item] || '📦'}</span>`;
        } else {
          slot.innerHTML = `<span style="font-size:8.5px;color:#94a3b8;font-weight:800;">資源空</span>`;
        }
      }
      grid.appendChild(slot);
    }

    // 下段5枠：圧縮木箱（5×5×5・容量220）
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
  // 6. 既存フック接続（getSurfaceYAt の1分割ロボット高さ同期含む・world.js無改造）
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

  if (typeof rebuildTerrainAndItems === 'function') {
    const _origRebuild = rebuildTerrainAndItems;
    rebuildTerrainAndItems = function() {
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
      try { if (typeof safeStorage !== 'undefined') safeStorage.removeItem(STORAGE_KEY); } catch (e) {}
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
      const bagOther = (typeof BAG !== 'undefined' && BAG.length) ? BAG.join(',') : 'なし';

      return [
        `体格: 高さ${stats.reachH}分割 × 幅${stats.reachW}分割 (1ターン歩幅:最大${stats.moveStep}分割 / スイスイ階段:${stats.stairMax}段・よじ登り上限:${stats.maxStepUpSub}段 / ほふく高:${stats.crawlH} / 整理積み上げ上限:${stats.maxStackHeight}段)`,
        `向いている方角: ${basis.actualFacingName} / 姿勢: ${ROBOT.posture === 'crawl' ? 'ほふく' : '立位'} / 頭上の天井空き: ${clearance}分割`,
        `身体状態: 体力${st.stamina}/100, おなか${st.energy}/100`,
        `右手: ${DIG_STATE.shovel.held ? 'こども用シャベルを所持' : '空手'}`,
        `ポケット: 土${DIG_STATE.pocketSoil}個 (資源合計${getResourceTotalCount()}/${stats.pocketCap}個 / その他:${bagOther})`,
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
      desc: '頭上の届く高さにある天井の露出ブロックを1分割削る',
      run: ({ dir, dec }) => { lastTurnActionId = 'dig_up'; return runSubDigByMode('up', dir, dec && dec.thought); }
    });

    window.AICommCore.registerAction({
      id: 'pickup_soil',
      desc: 'すぐそばの地面にある散らばった土を拾う（ポケット満杯後は天井に収まる範囲で頭上ピラミッドへ積む）',
      run: () => { lastTurnActionId = 'pickup_soil'; return runPickupSoil(); }
    });

    window.AICommCore.registerAction({
      id: 'place_soil',
      desc: '頭上またはポケットの土を指定方角の距離1の地面へ1個置く（上限はキャラ高さの2倍）',
      run: ({ dir }) => { lastTurnActionId = 'place_soil'; return runPlaceSoil(dir); }
    });

    window.AICommCore.registerAction({
      id: 'store_crate',
      desc: 'すぐ隣の圧縮木箱(容量220)へ頭上とポケットの土をまとめて入れる',
      run: () => { lastTurnActionId = 'store_crate'; return runStoreCrate(); }
    });

    window.AICommCore.registerAction({
      id: 'shovel_free',
      desc: 'こども用シャベルを地面に置く・指定方角へ投げる・すぐそばから拾う・振る',
      run: ({ dir, dec }) => { lastTurnActionId = 'shovel_free'; return runShovelFree(dir, dec && dec.thought); }
    });

    window.AICommCore.registerPostTurnHook(({ dec }) => {
      const act = (dec && dec.action) || lastTurnActionId;
      const eSpec = (typeof getExpressionSpec === 'function') ? getExpressionSpec(ROBOT.emotion) : null;

      if (act === 'dig_front' || act === 'dig_down' || act === 'dig_up') {
        ROBOT.emotion = 'swing_v';
      } else if (act === 'shovel_free') {
        ROBOT.emotion = DIG_STATE.shovel.held ? 'swing_h' : 'wave';
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
      syncHandShovelVisibility();
      renderHeadPyramidVisual();
      return null;
    });
  }

  loadDigState();
  if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
  else renderDigVisuals();
  renderPocketAndCrateDiaryUI();

  window.DigRulesModule = Object.freeze({
    getState: () => DIG_STATE,
    getSizeStats,
    buildFirstPersonVisionMap,
    renderPocketAndCrateDiaryUI,
    renderDigVisuals,
    renderHeadPyramidVisual
  });
})();
