// ============================================================================
// 【レゴ物理環境ルール：rules_dig.js】
// ・全6面 外側→中心 1分割掘削（CHIP_MAP直結）
// ・掘った土は周囲へ散らばり、体格(高さ・太さ)に応じて障害物になる
// ・こども用シャベル（初期所持・放置/投げ/拾い/遊びがAI自由）
// ・日記帳 上段5枠(1枠目シャベル＋残り4枠資源) / 下段5枠(木箱)
// ※ brain.js / world.js / ai_comm.js / index.html は無改造のまま接続
// ============================================================================
(function initDigRulesModule() {
  if (window.DigRulesModule) return;

  const STORAGE_KEY = 'rules_dig_state_v3';
  const SUB_SIZE = 0.2; // 大ブロック(1.0)の1/5

  const HEIGHT_RANK = { tiny: 1, small: 2, medium: 3, large: 4, giant: 5 };
  const WIDTH_RANK  = { slim1: 1, slim2: 2, normal3: 3, fat4: 4, fat5: 5 };

  function createDefaultState() {
    return {
      initializedStart: false,
      pocketSoil: 0,
      crates: [
        { id: 'crate_1', areaId: 'home', x: -1, z: 0, capacity: 27, soil: 0 }
      ],
      dugCells: {},       // key: `${areaId}|${x},${z},${lv}` -> ["sx,sy,sz", ...]
      worldSubSoils: {},  // key: `${areaId}|${absX},${absZ}` -> count (散らばり・積んだ1分割土)
      shovel: {
        held: true,       // スタート時は手持ち（テスト用）
        areaId: 'home',
        absX: 2,
        absZ: 2
      }
    };
  }

  let DIG_STATE = createDefaultState();
  let lastTurnActionId = null;

  function getCurAreaId() {
    return (typeof getCurrentAreaDef === 'function' && getCurrentAreaDef())
      ? getCurrentAreaDef().id
      : 'home';
  }

  function getSizeStats() {
    const hRank = HEIGHT_RANK[(typeof ROBOT !== 'undefined' && ROBOT.sizeLevel) || 'tiny'] || 1;
    const wRank = WIDTH_RANK[(typeof ROBOT !== 'undefined' && ROBOT.bodyType) || 'slim1'] || 1;
    return {
      reachH: hRank,                // 掘れる高さ（分割1〜5）
      reachW: wRank,                // 掘れる幅（分割1〜5）
      reachD: 1,                    // 掘れる奥行き（体表面から1列目）
      moveStep: 6 - wRank,          // 1ターン最大歩幅（やせっちょ5〜でぶっちょ1）
      pocketCap: hRank * wRank,     // 資源持ち運び上限（体積型 1〜25）
      maxStepUpSub: Math.min(3, Math.ceil(hRank / 2)) // 越えられる散らばり土段数（極小/小:1, 標準/大:2, 巨大:3）
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

  function loadDigState() {
    try {
      if (typeof safeStorage !== 'undefined') {
        const raw = safeStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            DIG_STATE = Object.assign(createDefaultState(), parsed);
            if (!Array.isArray(DIG_STATE.crates) || !DIG_STATE.crates.length) {
              DIG_STATE.crates = createDefaultState().crates;
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

    // スタート時：資源は空、こども用シャベル1本のみ所持
    if (!DIG_STATE.initializedStart) {
      if (typeof BAG !== 'undefined' && Array.isArray(BAG)) BAG.length = 0;
      DIG_STATE.pocketSoil = 0;
      DIG_STATE.shovel = { held: true, areaId: getCurAreaId(), absX: 2, absZ: 2 };
      DIG_STATE.initializedStart = true;
      saveDigState();
      if (typeof saveWorldState === 'function') saveWorldState();
    }

    syncDugCellsToChipMap();
  }

  // --------------------------------------------------------------------------
  // 0. 旧ボタンイベントの除去 ＆ こども用シャベル手持ち造形への差し替え
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

  function createKidShovelMesh(scale = 1.0) {
    const grp = new THREE.Group();
    const matHandle = new THREE.MeshLambertMaterial({ color: 0xfb7185 }); // こども用パステルピンク持ち手
    const matGrip   = new THREE.MeshLambertMaterial({ color: 0xfde047 }); // 黄色グリップ
    const matScoop  = new THREE.MeshLambertMaterial({ color: 0x38bdf8 }); // 水色スコップ先

    // 持ち手棒
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * scale, 0.018 * scale, 0.24 * scale, 8), matHandle);
    shaft.position.set(0, 0, 0);
    grp.add(shaft);

    // 輪っか風グリップ
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 0.03 * scale, 0.03 * scale), matGrip);
    grip.position.set(0, 0.13 * scale, 0);
    grp.add(grip);

    // スコップのすくう皿部分
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.11 * scale, 0.13 * scale, 0.03 * scale), matScoop);
    scoop.position.set(0, -0.15 * scale, 0.015 * scale);
    scoop.rotation.x = -0.2;
    grp.add(scoop);

    return grp;
  }

  function setupKidShovelOnRobotHands() {
    try {
      if (typeof boxTool !== 'undefined' && boxTool) {
        boxTool.children.forEach(ch => { ch.visible = false; });
        const sh = createKidShovelMesh(1.0);
        sh.position.set(0, -0.25, 0.16);
        sh.rotation.x = Math.PI / 2.2;
        boxTool.add(sh);
        handShovelMeshes.push(sh);
      }
      if (typeof stickTool !== 'undefined' && stickTool) {
        stickTool.children.forEach(ch => { ch.visible = false; });
        const sh = createKidShovelMesh(1.0);
        sh.position.set(0, -0.05, 0.16);
        sh.rotation.x = Math.PI / 2.2;
        stickTool.add(sh);
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
  // 1. 厳密5×5×5サブ座標ユーティリティ（島全体 absX/absZ: -10〜14）
  // --------------------------------------------------------------------------
  function absToTile(absVal) {
    return {
      tile: Math.floor(absVal / 5),
      sub: ((absVal % 5) + 5) % 5
    };
  }

  function isInsideIslandAbs(absX, absZ) {
    return absX >= -10 && absX <= 14 && absZ >= -10 && absZ <= 14;
  }

  function absToWorldXZ(absX, absZ) {
    return {
      wx: (absX - 2) * SUB_SIZE,
      wz: (absZ - 2) * SUB_SIZE
    };
  }

  function subYToLvSy(totalSubY) {
    const lv = Math.floor(totalSubY / 5) + 1;
    const sy = ((totalSubY % 5) + 5) % 5;
    return { lv, sy };
  }

  function getRobotAbsPos() {
    const sx = Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2;
    const sz = Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2;
    return {
      absX: ROBOT.pos.x * 5 + sx,
      absZ: ROBOT.pos.z * 5 + sz
    };
  }

  function getRobotBaseSubY() {
    const bSpec = (typeof BODY_SPECS !== 'undefined' && BODY_SPECS[ROBOT.bodyType]) || { reqWidth: 1 };
    const baseY = (typeof getSurfaceYAt === 'function')
      ? getSurfaceYAt(ROBOT.pos.x, ROBOT.pos.z, ROBOT.pos.lv, bSpec.reqWidth)
      : (ROBOT.pos.lv || 0);
    return Math.round(baseY * 5);
  }

  function hasSolidTerrainSubVoxel(tx, tz, lv, sx, sy, sz) {
    if (tx < -2 || tx > 2 || tz < -2 || tz > 2) return false;
    const minLv = (typeof AREA1_MIN_UNDER_LV !== 'undefined') ? AREA1_MIN_UNDER_LV : -4;
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

  // 全6面・外側優先ルール：上下前後左右の6面のうち1面でも空気に触れているか
  function isExposedToAir(tx, tz, lv, sx, sy, sz) {
    const absX = tx * 5 + sx;
    const absZ = tz * 5 + sz;
    const totalSubY = (lv - 1) * 5 + sy;
    const neighbors = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1]
    ];
    for (let i = 0; i < neighbors.length; i++) {
      const nx = absX + neighbors[i][0];
      const ny = totalSubY + neighbors[i][1];
      const nz = absZ + neighbors[i][2];
      if (!isInsideIslandAbs(nx, nz)) return true;
      const tX = absToTile(nx);
      const tZ = absToTile(nz);
      const yInfo = subYToLvSy(ny);
      if (!hasSolidTerrainSubVoxel(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) {
        return true;
      }
    }
    return false;
  }

  // 指定サブ列(absX, absZ)の既存地形の最も高い表面サブYを返す
  function getTerrainColumnTopSubY(absX, absZ) {
    const tX = absToTile(absX);
    const tZ = absToTile(absZ);
    const minLv = (typeof AREA1_MIN_UNDER_LV !== 'undefined') ? AREA1_MIN_UNDER_LV : -4;
    const topLv = (typeof HEIGHT_MAP !== 'undefined' && HEIGHT_MAP[`${tX.tile},${tZ.tile}`] !== undefined)
      ? HEIGHT_MAP[`${tX.tile},${tZ.tile}`]
      : 0;

    for (let lv = topLv; lv >= minLv; lv--) {
      for (let sy = 4; sy >= 0; sy--) {
        if (hasSolidTerrainSubVoxel(tX.tile, tZ.tile, lv, tX.sub, sy, tZ.sub)) {
          return (lv - 1) * 5 + sy + 1; // 上面のサブY
        }
      }
    }
    return (minLv - 1) * 5;
  }

  function getLooseSoilCountAt(absX, absZ, areaId = getCurAreaId()) {
    return DIG_STATE.worldSubSoils[`${areaId}|${absX},${absZ}`] || 0;
  }

  function addLooseSoilAt(absX, absZ, delta, areaId = getCurAreaId()) {
    const key = `${areaId}|${absX},${absZ}`;
    const next = Math.max(0, (DIG_STATE.worldSubSoils[key] || 0) + delta);
    if (next === 0) delete DIG_STATE.worldSubSoils[key];
    else DIG_STATE.worldSubSoils[key] = next;
  }

  // 地形＋散らばり土を含めた指定サブ列の最終高さ（サブY）
  function getCombinedColumnTopSubY(absX, absZ) {
    return getTerrainColumnTopSubY(absX, absZ) + getLooseSoilCountAt(absX, absZ);
  }

  // --------------------------------------------------------------------------
  // 2. 3D描画（3×3×3木箱・散らばった/積んだ1分割土・地面のこども用シャベル）
  // --------------------------------------------------------------------------
  const digVisualGroup = new THREE.Group();
  digVisualGroup.name = 'dig_rules_visual_group';
  if (typeof scene !== 'undefined' && scene) scene.add(digVisualGroup);

  const unitBoxGeo = new THREE.BoxGeometry(SUB_SIZE * 0.96, SUB_SIZE * 0.96, SUB_SIZE * 0.96);
  const unitEdgeGeo = new THREE.EdgesGeometry(unitBoxGeo);

  function buildCrateMesh(crate) {
    const grp = new THREE.Group();
    const boxSize = SUB_SIZE * 3; // 3×3×3
    const yBase = (typeof getSurfaceYAt === 'function') ? getSurfaceYAt(crate.x, crate.z, null, 3) : 0;
    grp.position.set(crate.x, yBase, crate.z);

    const woodMat = new THREE.MeshLambertMaterial({ color: 0xe6be8a });
    const frameMat = new THREE.MeshLambertMaterial({ color: 0xb07d56 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(boxSize, boxSize * 0.88, boxSize), woodMat);
    body.position.y = boxSize * 0.44;
    grp.add(body);

    const rim = new THREE.Mesh(new THREE.BoxGeometry(boxSize + 0.03, 0.06, boxSize + 0.03), frameMat);
    rim.position.y = boxSize * 0.86;
    grp.add(rim);

    if (crate.soil > 0) {
      const ratio = Math.min(1, crate.soil / crate.capacity);
      const fillH = Math.max(0.06, boxSize * 0.72 * ratio);
      const soilMesh = new THREE.Mesh(
        new THREE.BoxGeometry(boxSize * 0.82, fillH, boxSize * 0.82),
        new THREE.MeshLambertMaterial({ color: 0xc28e5c })
      );
      soilMesh.position.y = fillH * 0.5 + 0.08;
      grp.add(soilMesh);
    }
    return grp;
  }

  function renderDigVisuals() {
    while (digVisualGroup.children.length) digVisualGroup.remove(digVisualGroup.children[0]);
    syncHandShovelVisibility();
    const areaId = getCurAreaId();

    // ① 3×3×3 木箱
    DIG_STATE.crates.forEach(c => {
      if (c.areaId === areaId) digVisualGroup.add(buildCrateMesh(c));
    });

    // ② 周囲に散らばった／積んだ1分割土ブロック（レゴブロック積み上げ）
    const soilMatLight = new THREE.MeshLambertMaterial({ color: 0xd9a875 });
    const soilMatDark  = new THREE.MeshLambertMaterial({ color: 0xc68e5a });
    const edgeMat      = new THREE.LineBasicMaterial({ color: 0x7c4a21, transparent: true, opacity: 0.42 });

    Object.keys(DIG_STATE.worldSubSoils).forEach(k => {
      if (!k.startsWith(areaId + '|')) return;
      const count = DIG_STATE.worldSubSoils[k] || 0;
      if (count <= 0) return;
      const [absX, absZ] = k.slice(areaId.length + 1).split(',').map(Number);
      if (!isInsideIslandAbs(absX, absZ)) return;

      const { wx, wz } = absToWorldXZ(absX, absZ);
      const baseSubY = getTerrainColumnTopSubY(absX, absZ);
      const showCount = Math.min(count, 10);

      for (let i = 0; i < showCount; i++) {
        const m = new THREE.Mesh(unitBoxGeo, ((absX + absZ + i) % 2 === 0) ? soilMatLight : soilMatDark);
        m.position.set(wx, (baseSubY + i) * SUB_SIZE + SUB_SIZE * 0.5, wz);
        m.add(new THREE.LineSegments(unitEdgeGeo, edgeMat));
        digVisualGroup.add(m);
      }
    });

    // ③ 地面に置かれた／放り投げられたこども用シャベル
    if (DIG_STATE.shovel && !DIG_STATE.shovel.held && DIG_STATE.shovel.areaId === areaId) {
      const sh = createKidShovelMesh(1.15);
      const { wx, wz } = absToWorldXZ(DIG_STATE.shovel.absX, DIG_STATE.shovel.absZ);
      const topSubY = getCombinedColumnTopSubY(DIG_STATE.shovel.absX, DIG_STATE.shovel.absZ);
      sh.position.set(wx, topSubY * SUB_SIZE + 0.05, wz);
      sh.rotation.set(Math.PI / 2 - 0.15, 0.7, 0.4); // 地面にポンと転がった角度
      digVisualGroup.add(sh);
    }
  }

  // --------------------------------------------------------------------------
  // 3. 掘削ロジック（全6面・外側優先 → 周囲へ1分割土が散らばる）
  // --------------------------------------------------------------------------
  function findDigTargetInDirection(dir, thought) {
    const stats = getSizeStats();
    const { absX: curAbsX, absZ: curAbsZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();

    const dx = Math.sign(dir.dx || 0);
    const dz = Math.sign(dir.dz || 0);
    let px = -dz, pz = dx;
    if (dx !== 0 && dz !== 0) { px = -dz; pz = 0; }

    const t = String(thought || '');
    const halfW = Math.floor(stats.reachW / 2);
    const wList = [];
    for (let i = 0; i < stats.reachW; i++) wList.push(i - halfW);
    if (t.includes('左')) wList.sort((a, b) => a - b);
    else if (t.includes('右')) wList.sort((a, b) => b - a);
    else wList.sort((a, b) => Math.abs(a) - Math.abs(b));

    const hList = [];
    for (let y = 0; y < stats.reachH; y++) hList.push(y);
    if (t.includes('下') || t.includes('足元')) hList.sort((a, b) => a - b);
    else hList.sort((a, b) => b - a);

    const checkCell = (absX, totalSubY, absZ, kindLabel) => {
      if (!isInsideIslandAbs(absX, absZ)) return null;
      const tX = absToTile(absX);
      const tZ = absToTile(absZ);
      const yInfo = subYToLvSy(totalSubY);
      if (!hasSolidTerrainSubVoxel(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) return null;
      if (!isExposedToAir(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) return null;
      return { tx: tX.tile, tz: tZ.tile, lv: yInfo.lv, tsx: tX.sub, tsy: yInfo.sy, tsz: tZ.sub, absX, absZ, totalSubY, kind: kindLabel };
    };

    // 体の前縁〜すぐ目の前（距離1から最大halfW+1まで走査して死角をなくす）
    const maxDist = Math.floor(stats.reachW / 2) + 1;
    const distList = [];
    for (let d = 1; d <= maxDist; d++) distList.push(d);

    // 優先分岐：AIが「天井・上」を明示した場合
    if (t.includes('天井') || t.includes('頭上')) {
      for (let wi = 0; wi < wList.length; wi++) {
        const hit = checkCell(curAbsX + px * wList[wi], baseSubY + stats.reachH, curAbsZ + pz * wList[wi], '天井');
        if (hit) return hit;
      }
    }

    // 優先分岐：AIが「足元・真下」を明示した場合
    if (t.includes('真下') || t.includes('足元')) {
      for (let d = 0; d <= maxDist; d++) {
        for (let wi = 0; wi < wList.length; wi++) {
          const hit = checkCell(curAbsX + dx * d + px * wList[wi], baseSubY - 1, curAbsZ + dz * d + pz * wList[wi], '足元');
          if (hit) return hit;
        }
      }
    }

    // ① 目の前の壁（高さ 0〜reachH-1 × 幅 reachW × 奥行き1）
    for (let di = 0; di < distList.length; di++) {
      const dist = distList[di];
      for (let hi = 0; hi < hList.length; hi++) {
        for (let wi = 0; wi < wList.length; wi++) {
          const hit = checkCell(
            curAbsX + dx * dist + px * wList[wi],
            baseSubY + hList[hi],
            curAbsZ + dz * dist + pz * wList[wi],
            '壁'
          );
          if (hit) return hit;
        }
      }
    }

    // ② 目の前〜足元の地面表面（上面から削る）
    for (let di = 0; di < distList.length; di++) {
      const dist = distList[di];
      for (let wi = 0; wi < wList.length; wi++) {
        const hit = checkCell(
          curAbsX + dx * dist + px * wList[wi],
          baseSubY - 1,
          curAbsZ + dz * dist + pz * wList[wi],
          '地面'
        );
        if (hit) return hit;
      }
    }

    // ③ 真下（自分の足元の面）
    const underHit = checkCell(curAbsX, baseSubY - 1, curAbsZ, '足元');
    if (underHit) return underHit;

    // ④ 頭上（天井の面）
    const topHit = checkCell(curAbsX, baseSubY + stats.reachH, curAbsZ, '天井');
    if (topHit) return topHit;

    return null;
  }

  // 削った1分割土をキャラ周囲の空きサブ座標へ散らばす
  function scatterDugSoilAroundRobot(dir) {
    const { absX, absZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const candidates = [];

    // キャラ周囲（半径1〜2サブ座標）を候補にし、足元ど真ん中は避ける
    for (let ox = -2; ox <= 2; ox++) {
      for (let oz = -2; oz <= 2; oz++) {
        if (ox === 0 && oz === 0) continue;
        const tx = absX + ox;
        const tz = absZ + oz;
        if (!isInsideIslandAbs(tx, tz)) continue;
        const topY = getTerrainColumnTopSubY(tx, tz);
        // 高い壁の上ではなく、キャラ付近の床面・段差付近へ落ちる
        if (topY <= baseSubY + 1) {
          const curStack = getLooseSoilCountAt(tx, tz);
          candidates.push({ absX: tx, absZ: tz, stack: curStack, rand: Math.random() });
        }
      }
    }

    if (!candidates.length) {
      addLooseSoilAt(absX, absZ, 1);
      return { absX, absZ };
    }

    // なるべく低く散らばりやすく（自然に適度に積まれる）
    candidates.sort((a, b) => (a.stack * 0.6 + a.rand) - (b.stack * 0.6 + b.rand));
    const chosen = candidates[0];
    addLooseSoilAt(chosen.absX, chosen.absZ, 1);
    return chosen;
  }

  function runSubDig(dir, thought) {
    ROBOT.rotY = dir.rot;
    const target = findDigTargetInDirection(dir, thought);
    if (!target) {
      return {
        actionLabel: `⛏️ ${dir.name}の届く範囲(全6面露出)に削れる土がない`,
        thoughtAppend: '（手が届く範囲は空っぽだ！移動してから削ろう）'
      };
    }

    // world.js 本体の CHIP_MAP へ1分割ブロックだけ直接くり抜き
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

    // 削った土はキャラの周囲に散らばる（ポケットには自動で入らない）
    const dropPos = scatterDugSoilAroundRobot(dir);
    const totalHere = getLooseSoilCountAt(dropPos.absX, dropPos.absZ);

    life.stamina = Math.max(0, life.stamina - 4);
    life.mental = Math.min(100, life.mental + 4);
    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    saveDigState();

    const toolNote = DIG_STATE.shovel.held ? 'シャベルで' : '素手で';
    return {
      actionLabel: `🪏 ${toolNote}${dir.name}の${target.kind}を1分割削り周囲に散らばした(積${totalHere})`
    };
  }

  // --------------------------------------------------------------------------
  // 4. 散らばり土の拾得 ＆ 設置（積む） ＆ 木箱収納
  // --------------------------------------------------------------------------
  function findNearbyLooseSoilKeys(radiusSub = 3) {
    const areaId = getCurAreaId();
    const { absX, absZ } = getRobotAbsPos();
    const hits = [];
    Object.keys(DIG_STATE.worldSubSoils).forEach(k => {
      if (!k.startsWith(areaId + '|')) return;
      const cnt = DIG_STATE.worldSubSoils[k] || 0;
      if (cnt <= 0) return;
      const [sx, sz] = k.slice(areaId.length + 1).split(',').map(Number);
      const dist = Math.max(Math.abs(sx - absX), Math.abs(sz - absZ));
      if (dist <= radiusSub) hits.push({ key: k, absX: sx, absZ: sz, cnt, dist });
    });
    hits.sort((a, b) => a.dist - b.dist);
    return hits;
  }

  function runPickupSoil() {
    const stats = getSizeStats();
    const freeSpace = stats.pocketCap - getResourceTotalCount();
    if (freeSpace <= 0) {
      return {
        actionLabel: `🟫 ポケット満杯(${getResourceTotalCount()}/${stats.pocketCap})で拾えない`,
        thoughtAppend: '（ポケットがいっぱい！木箱にしまうかどこかに置こう）'
      };
    }

    const nearby = findNearbyLooseSoilKeys(3);
    if (!nearby.length) {
      return {
        actionLabel: '🟫 周囲に拾える散らばり土がない',
        thoughtAppend: '（周りに転がっている土がないな）'
      };
    }

    // 周囲の散らばり土をポケット上限まで拾う（最大3個/ターンで整理しやすいテンポに）
    let picked = 0;
    const maxPerTurn = Math.min(freeSpace, 3);
    for (let i = 0; i < nearby.length && picked < maxPerTurn; i++) {
      const take = Math.min(nearby[i].cnt, maxPerTurn - picked);
      addLooseSoilAt(nearby[i].absX, nearby[i].absZ, -take);
      DIG_STATE.pocketSoil += take;
      picked += take;
    }

    life.stamina = Math.max(0, life.stamina - 2);
    ROBOT.params.logic = Math.min(100, (ROBOT.params.logic || 50) + 2);
    saveDigState();
    return {
      actionLabel: `🧺 周囲の分割土を${picked}個拾った(ポケット${getResourceTotalCount()}/${stats.pocketCap})`
    };
  }

  function runPlaceSoil(dir) {
    if (DIG_STATE.pocketSoil <= 0) {
      return { actionLabel: '🟫 置くための土がポケットにない' };
    }
    ROBOT.rotY = dir.rot;
    const { absX, absZ } = getRobotAbsPos();
    const stats = getSizeStats();
    const dist = Math.floor(stats.reachW / 2) + 1;
    const tx = Math.max(-10, Math.min(14, absX + Math.sign(dir.dx || 0) * dist));
    const tz = Math.max(-10, Math.min(14, absZ + Math.sign(dir.dz || 0) * dist));

    addLooseSoilAt(tx, tz, 1);
    DIG_STATE.pocketSoil -= 1;
    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    saveDigState();

    const stackNow = getLooseSoilCountAt(tx, tz);
    return {
      actionLabel: `🟫 ${dir.name}の地面へ分割土を1個置いた(高さ${stackNow}段)`
    };
  }

  function findNearbyCrate() {
    const areaId = getCurAreaId();
    return DIG_STATE.crates.find(c =>
      c.areaId === areaId &&
      Math.abs(ROBOT.pos.x - c.x) <= 1 &&
      Math.abs(ROBOT.pos.z - c.z) <= 1
    ) || null;
  }

  function runStoreCrate() {
    const crate = findNearbyCrate();
    if (!crate) {
      const first = DIG_STATE.crates.find(c => c.areaId === getCurAreaId());
      const hint = first ? `(${first.x},${first.z})` : 'なし';
      return {
        actionLabel: `📦 木箱が近くにない(木箱位置:${hint})`,
        thoughtAppend: '（木箱のそばまで行かないとしまえないな）'
      };
    }
    if (DIG_STATE.pocketSoil <= 0) {
      return { actionLabel: '📦 しまう土がポケットにない' };
    }
    const free = crate.capacity - crate.soil;
    if (free <= 0) {
      return {
        actionLabel: `📦 木箱が満杯(${crate.soil}/${crate.capacity})！`,
        thoughtAppend: '（木箱がいっぱいだ！地面に積んでおこう）'
      };
    }
    const moved = Math.min(DIG_STATE.pocketSoil, free);
    DIG_STATE.pocketSoil -= moved;
    crate.soil += moved;
    ROBOT.params.logic = Math.min(100, (ROBOT.params.logic || 50) + 3);
    life.mental = Math.min(100, life.mental + 8);
    saveDigState();
    return {
      actionLabel: `📦 木箱へ土を${moved}個まとめて収納(${crate.soil}/${crate.capacity})`
    };
  }

  // --------------------------------------------------------------------------
  // 5. こども用シャベル自由操作（置く・放り投げる・拾う・遊ぶ）
  // --------------------------------------------------------------------------
  function runShovelFree(dir, thought) {
    const t = String(thought || '');
    const areaId = getCurAreaId();
    const { absX, absZ } = getRobotAbsPos();
    ROBOT.rotY = dir.rot;

    // 地面に落ちている場合 → 近くなら拾う
    if (!DIG_STATE.shovel.held) {
      if (DIG_STATE.shovel.areaId !== areaId) {
        return { actionLabel: '🪏 シャベルは別のエリアに置いたままだ' };
      }
      const dist = Math.max(Math.abs(DIG_STATE.shovel.absX - absX), Math.abs(DIG_STATE.shovel.absZ - absZ));
      if (dist <= 3) {
        DIG_STATE.shovel.held = true;
        saveDigState();
        return { actionLabel: '🪏 こども用シャベルを拾い上げた' };
      }
      const tile = absToTile(DIG_STATE.shovel.absX).tile;
      const tileZ = absToTile(DIG_STATE.shovel.absZ).tile;
      return {
        actionLabel: `🪏 シャベルは(${tile},${tileZ})付近に落ちている`,
        thoughtAppend: '（ちょっと離れてるから歩いて取りに行こうかな）'
      };
    }

    // 手持ちの場合：放り投げる / その場に置く / 遊ぶ
    if (t.includes('投') || t.includes('ポイ') || t.includes('放り') || t.includes('飛ば')) {
      const throwDist = 4;
      const tx = Math.max(-10, Math.min(14, absX + Math.sign(dir.dx || 0) * throwDist));
      const tz = Math.max(-10, Math.min(14, absZ + Math.sign(dir.dz || 0) * throwDist));
      DIG_STATE.shovel = { held: false, areaId, absX: tx, absZ: tz };
      life.mental = Math.min(100, life.mental + 8);
      saveDigState();
      return { actionLabel: `🪏 こども用シャベルを${dir.name}へポイッと放り投げた！` };
    }

    if (t.includes('置') || t.includes('手放') || t.includes('ほっぽ') || t.includes('捨て') || t.includes('邪魔')) {
      const tx = Math.max(-10, Math.min(14, absX + Math.sign(dir.dx || 0)));
      const tz = Math.max(-10, Math.min(14, absZ + Math.sign(dir.dz || 0)));
      DIG_STATE.shovel = { held: false, areaId, absX: tx, absZ: tz };
      saveDigState();
      return { actionLabel: '🪏 こども用シャベルをその辺の地面に置いた' };
    }

    // 持ったまま遊ぶ
    life.mental = Math.min(100, life.mental + 10);
    ROBOT.params.cautionLimiter = Math.min(100, (ROBOT.params.cautionLimiter || 50) + 2);
    return { actionLabel: '🪏 こども用シャベルをブンブン振って遊んだ！' };
  }

  // --------------------------------------------------------------------------
  // 6. 移動ロジック（歩幅1〜5分割 ＆ 体格による散らばり土の障害物・隙間判定）
  // --------------------------------------------------------------------------
  function checkLooseSoilObstacleAt(centerAbsX, centerAbsZ, curBaseSubY, stats) {
    const halfW = Math.floor((stats.reachW - 1) / 2);
    const maxW  = Math.floor(stats.reachW / 2);

    // キャラの太さ(幅1〜5)のフットプリント範囲をチェック
    for (let ox = -halfW; ox <= maxW; ox++) {
      for (let oz = -halfW; oz <= maxW; oz++) {
        const cx = centerAbsX + ox;
        const cz = centerAbsZ + oz;
        if (!isInsideIslandAbs(cx, cz)) return '島の端';
        const looseCnt = getLooseSoilCountAt(cx, cz);
        if (looseCnt > 0) {
          const topSubY = getCombinedColumnTopSubY(cx, cz);
          const diff = topSubY - curBaseSubY;
          if (diff > stats.maxStepUpSub) {
            return `散らばった土(${looseCnt}段)が邪魔`;
          }
        }
      }
    }
    return '';
  }

  function runSubMove(dir) {
    const stats = getSizeStats();
    const maxStep = stats.moveStep;
    const dx = Math.sign(dir.dx || 0);
    const dz = Math.sign(dir.dz || 0);
    ROBOT.rotY = dir.rot;

    let curX = ROBOT.pos.x;
    let curZ = ROBOT.pos.z;
    let curLv = (typeof getRobotHeightLevel === 'function') ? getRobotHeightLevel() : (ROBOT.pos.lv || 0);
    let curSx = Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2;
    let curSz = Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2;
    const baseSubY = getRobotBaseSubY();
    const { lv: footLv, sy: footSy } = subYToLvSy(baseSubY);

    let movedSteps = 0;
    let stopReason = '';

    for (let s = 0; s < maxStep; s++) {
      let nextSx = curSx + dx;
      let nextSz = curSz + dz;
      let nextX = curX;
      let nextZ = curZ;

      if (nextSx < 0) { nextSx = 4; nextX -= 1; }
      else if (nextSx > 4) { nextSx = 0; nextX += 1; }

      if (nextSz < 0) { nextSz = 4; nextZ -= 1; }
      else if (nextSz > 4) { nextSz = 0; nextZ += 1; }

      if (nextX < -2 || nextX > 2 || nextZ < -2 || nextZ > 2) {
        stopReason = '島の端';
        break;
      }

      // 散らばった土ブロックの障害物判定（太さ・高さ依存）
      const nextAbsX = nextX * 5 + nextSx;
      const nextAbsZ = nextZ * 5 + nextSz;
      const soilBlock = checkLooseSoilObstacleAt(nextAbsX, nextAbsZ, baseSubY, stats);
      if (soilBlock) {
        stopReason = soilBlock;
        break;
      }

      if (nextX !== curX || nextZ !== curZ) {
        const stepDir = { dx: nextX - curX, dz: nextZ - curZ, name: dir.name, rot: dir.rot };
        const chk = (typeof checkMoveAndPosture === 'function')
          ? checkMoveAndPosture(curX, curZ, curLv, stepDir)
          : { canMove: true, targetLv: curLv, posture: 'stand', reason: '' };
        if (!chk.canMove) {
          stopReason = chk.reason || '壁';
          break;
        }
        curLv = chk.targetLv;
        ROBOT.posture = chk.posture;
      } else if (hasSolidTerrainSubVoxel(nextX, nextZ, footLv, nextSx, footSy, nextSz)) {
        stopReason = '土の壁';
        break;
      }

      curX = nextX; curZ = nextZ; curSx = nextSx; curSz = nextSz;
      movedSteps++;
    }

    if (movedSteps > 0) {
      ROBOT.pos.x = curX;
      ROBOT.pos.z = curZ;
      ROBOT.pos.lv = curLv;
      ROBOT.pos.sx = curSx;
      ROBOT.pos.sz = curSz;
      life.energy = Math.max(0, life.energy - 3);
      life.stamina = Math.max(0, life.stamina - 4);
      life.mental = Math.min(100, life.mental + 5);
      ROBOT.params.curiosity = Math.min(100, (ROBOT.params.curiosity || 60) + 2);
      return {
        actionLabel: `🐾 ${dir.name}へ分割${movedSteps}ブロック移動(歩幅上限${maxStep})`
      };
    }
    return {
      actionLabel: `🐾 ${dir.name}へ進めなかった(${stopReason || '障害物'})`,
      thoughtAppend: '（通れなかった！土を片付けるか削るか、別の方角へ回ろう）'
    };
  }

  // --------------------------------------------------------------------------
  // 7. 日記帳アイテム枠UI（上段1枠目:シャベル / 2〜5枠目:資源 / 下段5枠:木箱）
  // --------------------------------------------------------------------------
  const ITEM_ICONS = { apple: '🍎', stone: '🪨', oil: '🧴', grass: '🌿' };

  function renderPocketAndCrateDiaryUI() {
    const grid = document.getElementById('bag-grid');
    if (!grid) return;

    const stats = getSizeStats();
    if (grid.previousElementSibling) {
      grid.previousElementSibling.innerText =
        `🎒 上段：シャベル＋資源4枠(上限${stats.pocketCap}) ／ 下段：📦木箱(${DIG_STATE.crates.length}/5箱)`;
    }

    grid.innerHTML = '';

    // 1行目 1枠目：こども用シャベル（独立枠・資源と混在しない）
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
          if (typeof showToast === 'function') showToast('🪏 こども用シャベル（手持ち中：使っても放置しても投げて遊んでもOK）');
        };
      } else {
        slot.style.borderStyle = 'dashed';
        slot.style.borderColor = '#94a3b8';
        slot.style.background = '#f1f5f9';
        const sx = DIG_STATE.shovel ? absToTile(DIG_STATE.shovel.absX).tile : 0;
        const sz = DIG_STATE.shovel ? absToTile(DIG_STATE.shovel.absZ).tile : 0;
        slot.innerHTML = `<span style="font-size:13px;opacity:0.45;line-height:1;">🪏</span><span style="font-size:8px;font-weight:800;color:#64748b;">放置(${sx},${sz})</span>`;
        slot.onclick = () => {
          if (typeof showToast === 'function') showToast(`🪏 こども用シャベルは地面(${sx},${sz})付近に放置中`);
        };
      }
      grid.appendChild(slot);
    }

    // 1行目 2〜5枠目：獲得した資源枠（4枠）
    for (let i = 0; i < 4; i++) {
      const slot = document.createElement('div');
      slot.className = 'bag-slot';
      slot.style.flexDirection = 'column';
      slot.style.gap = '1px';
      slot.style.padding = '2px';

      if (i === 0 && DIG_STATE.pocketSoil > 0) {
        slot.classList.add('filled');
        const over = getResourceTotalCount() > stats.pocketCap;
        slot.style.borderColor = over ? '#ef4444' : '#b45309';
        slot.style.background = over ? '#fef2f2' : '#fef3c7';
        slot.innerHTML = `<span style="font-size:16px;line-height:1;">🟫</span><span style="font-size:9px;font-weight:900;color:${over ? '#dc2626' : '#92400e'};">${DIG_STATE.pocketSoil}/${stats.pocketCap}</span>`;
        slot.onclick = () => {
          if (typeof showToast === 'function') showToast(`🟫 獲得した分割土：${DIG_STATE.pocketSoil}個（持ち運び上限 ${stats.pocketCap}個）`);
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

    // 2行目（5枠）：木箱の数と収納数
    for (let i = 0; i < 5; i++) {
      const slot = document.createElement('div');
      slot.className = 'bag-slot';
      slot.style.flexDirection = 'column';
      slot.style.gap = '1px';
      slot.style.padding = '2px';

      const crate = DIG_STATE.crates[i];
      if (crate) {
        slot.classList.add('filled');
        slot.style.borderColor = '#d97706';
        slot.style.background = '#fffbeb';
        slot.innerHTML = `<span style="font-size:16px;line-height:1;">📦</span><span style="font-size:9px;font-weight:900;color:#92400e;">${crate.soil}/${crate.capacity}</span>`;
        slot.onclick = () => {
          if (typeof showToast === 'function') {
            showToast(`📦 木箱#${i + 1}(3×3×3)：${crate.soil}/${crate.capacity}個 場所(${crate.x},${crate.z})`);
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
  // 8. 既存フック接続（brain.js / world.js / ai_comm.js 無改造）
  // --------------------------------------------------------------------------
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
      renderPocketAndCrateDiaryUI();
    };
  }

  if (typeof resetGameDirectly === 'function') {
    const _origReset = resetGameDirectly;
    resetGameDirectly = function() {
      try { if (typeof safeStorage !== 'undefined') safeStorage.removeItem(STORAGE_KEY); } catch (e) {}
      _origReset();
    };
  }

  const diaryBtn = document.getElementById('diary-btn');
  if (diaryBtn) {
    diaryBtn.addEventListener('click', () => setTimeout(renderPocketAndCrateDiaryUI, 20));
  }

  // --------------------------------------------------------------------------
  // 9. AICommCore へのセンサー・アクション・見た目連動フック登録
  // --------------------------------------------------------------------------
  if (window.AICommCore) {
    window.AICommCore.registerSensor(() => {
      const stats = getSizeStats();
      const areaId = getCurAreaId();
      const { absX, absZ } = getRobotAbsPos();

      const crateList = DIG_STATE.crates
        .filter(c => c.areaId === areaId)
        .map((c, idx) => `木箱${idx + 1}(x=${c.x},z=${c.z},収納${c.soil}/${c.capacity})`)
        .join(', ') || 'なし';

      const digHints = (typeof ALL_DIRS !== 'undefined' ? ALL_DIRS.slice(0, 4) : []).map(d => {
        const hit = findDigTargetInDirection(d, '');
        return `${d.name.replace('(斜め)', '')}:${hit ? `${hit.kind}可` : '空'}`;
      }).join(' / ');

      const nearbyLoose = findNearbyLooseSoilKeys(3);
      const looseTotal = nearbyLoose.reduce((s, it) => s + it.cnt, 0);

      let shovelStatus = '手持ち中(使っても放置しても投げて遊んでも自由)';
      if (!DIG_STATE.shovel.held) {
        const dist = Math.max(Math.abs(DIG_STATE.shovel.absX - absX), Math.abs(DIG_STATE.shovel.absZ - absZ));
        const tx = absToTile(DIG_STATE.shovel.absX).tile;
        const tz = absToTile(DIG_STATE.shovel.absZ).tile;
        shovelStatus = `地面(${tx},${tz})に放置中(距離${dist}分割)`;
      }

      return [
        `サブ位置:(sx=${ROBOT.pos.sx ?? 2},sz=${ROBOT.pos.sz ?? 2}) 歩幅:最大${stats.moveStep}分割 越えられる土段差:${stats.maxStepUpSub}段`,
        `掘削(全6面外側から中心へ1分割・削ると周囲に散らばる):高さ${stats.reachH}×幅${stats.reachW} 周辺掘削可否:[${digHints}]`,
        `周囲の散らばり土:${looseTotal}個(邪魔なら拾って整理可) / ポケット資源:土${DIG_STATE.pocketSoil}個(上限${stats.pocketCap})`,
        `こども用シャベル:${shovelStatus} / 木箱(3x3x3):${crateList}`
      ].join('\n');
    });

    window.AICommCore.registerAction({
      id: 'move',
      desc: '太さに応じた歩幅(1〜5分割)で移動する(散らばった土が多いと体格によっては通れない)',
      run: ({ dir }) => { lastTurnActionId = 'move'; return runSubMove(dir); }
    });

    window.AICommCore.registerAction({
      id: 'dig_front',
      desc: '届く範囲のブロックを全6面の外側から1分割だけ削る(削った土は周囲の地面に散らばる)',
      run: ({ dir, dec }) => { lastTurnActionId = 'dig_front'; return runSubDig(dir, dec && dec.thought); }
    });

    window.AICommCore.registerAction({
      id: 'pickup_soil',
      desc: '周囲に散らばった分割土ブロックを拾ってポケットに入れる(整理・持ち運び用)',
      run: () => { lastTurnActionId = 'pickup_soil'; return runPickupSoil(); }
    });

    window.AICommCore.registerAction({
      id: 'place_soil',
      desc: 'ポケットの分割土を指定方角の地面に1個置いて積む',
      run: ({ dir }) => { lastTurnActionId = 'place_soil'; return runPlaceSoil(dir); }
    });

    window.AICommCore.registerAction({
      id: 'store_crate',
      desc: '近くにある3×3×3木箱(容量27)へポケットの土をまとめて収納する',
      run: () => { lastTurnActionId = 'store_crate'; return runStoreCrate(); }
    });

    window.AICommCore.registerAction({
      id: 'shovel_free',
      desc: 'こども用シャベルを自由に扱う(地面に置く・指定方角へ放り投げる・拾い直す・振って遊ぶ)',
      run: ({ dir, dec }) => { lastTurnActionId = 'shovel_free'; return runShovelFree(dir, dec && dec.thought); }
    });

    // 見た目連動フック：掘削・シャベル遊び以外のターンで勝手にシャベルを振らないよう補正
    window.AICommCore.registerPostTurnHook(({ dec }) => {
      const act = (dec && dec.action) || lastTurnActionId;
      const eSpec = (typeof getExpressionSpec === 'function') ? getExpressionSpec(ROBOT.emotion) : null;

      if (act === 'dig_front') {
        ROBOT.emotion = 'swing_v';
      } else if (act === 'shovel_free') {
        ROBOT.emotion = DIG_STATE.shovel.held ? 'swing_h' : 'wave';
      } else if (eSpec && eSpec.tool) {
        if (act === 'move') ROBOT.emotion = 'run';
        else if (act === 'pickup_soil') ROBOT.emotion = 'pickup';
        else if (act === 'place_soil' || act === 'store_crate') ROBOT.emotion = 'carry';
        else ROBOT.emotion = 'normal';
      }
      syncHandShovelVisibility();
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
    renderPocketAndCrateDiaryUI,
    renderDigVisuals
  });
})();
