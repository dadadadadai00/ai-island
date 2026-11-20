// ============================================================================
// 【レゴ物理環境＆1人称純粋知覚モジュール：rules_dig.js】
// ・A案：前方視野のみを切り出した記号マップ（壁の裏は?で死角）＋正面1列目断面図
// ・B案：ai_comm.js のキャラ視点3Dカメラ画像と同一の身体感覚・物理ルールを共有
// ・神様目線の絶対座標・誘導ヒントを排除し、直前の物理結果のみを返す
// ・向きを変えるだけの新アクション look を追加
// ※ brain.js / world.js / index.html は無改造のまま動作します
// ============================================================================
(function initDigRulesModule() {
  if (window.DigRulesModule) return;

  const STORAGE_KEY = 'rules_dig_state_v3';
  const SUB_SIZE = 0.2;

  const HEIGHT_RANK = { tiny: 1, small: 2, medium: 3, large: 4, giant: 5 };
  const WIDTH_RANK  = { slim1: 1, slim2: 2, normal3: 3, fat4: 4, fat5: 5 };

  function createDefaultState() {
    return {
      initializedStart: false,
      pocketSoil: 0,
      crates: [
        { id: 'crate_1', areaId: 'home', x: -1, z: 0, capacity: 27, soil: 0 }
      ],
      dugCells: {},
      worldSubSoils: {},
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

  function getCurAreaId() {
    return (typeof getCurrentAreaDef === 'function' && getCurrentAreaDef())
      ? getCurrentAreaDef().id
      : 'home';
  }

  function getSizeStats() {
    const hRank = HEIGHT_RANK[(typeof ROBOT !== 'undefined' && ROBOT.sizeLevel) || 'tiny'] || 1;
    const wRank = WIDTH_RANK[(typeof ROBOT !== 'undefined' && ROBOT.bodyType) || 'slim1'] || 1;
    return {
      reachH: hRank,
      reachW: wRank,
      reachD: 1,
      moveStep: 6 - wRank,
      pocketCap: hRank * wRank,
      maxStepUpSub: Math.min(3, Math.ceil(hRank / 2))
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
  // 0. 旧ボタンイベント除去 ＆ こども用シャベル右手装着（常時表示）
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
  // 1. 厳密5×5×5サブ座標ユーティリティ（島全体 absX/absZ: -10〜14）
  // --------------------------------------------------------------------------
  function absToTile(absVal) {
    return { tile: Math.floor(absVal / 5), sub: ((absVal % 5) + 5) % 5 };
  }

  function isInsideIslandAbs(absX, absZ) {
    return absX >= -10 && absX <= 14 && absZ >= -10 && absZ <= 14;
  }

  function absToWorldXZ(absX, absZ) {
    return { wx: (absX - 2) * SUB_SIZE, wz: (absZ - 2) * SUB_SIZE };
  }

  function subYToLvSy(totalSubY) {
    const lv = Math.floor(totalSubY / 5) + 1;
    const sy = ((totalSubY % 5) + 5) % 5;
    return { lv, sy };
  }

  function getRobotAbsPos() {
    const sx = Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2;
    const sz = Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2;
    return { absX: ROBOT.pos.x * 5 + sx, absZ: ROBOT.pos.z * 5 + sz };
  }

  function getRobotBaseSubY(gx = ROBOT.pos.x, gz = ROBOT.pos.z, lv = ROBOT.pos.lv) {
    const bSpec = (typeof BODY_SPECS !== 'undefined' && BODY_SPECS[ROBOT.bodyType]) || { reqWidth: 1 };
    const baseY = (typeof getSurfaceYAt === 'function')
      ? getSurfaceYAt(gx, gz, lv, bSpec.reqWidth)
      : (lv || 0);
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
      const tX = absToTile(nx);
      const tZ = absToTile(nz);
      const yInfo = subYToLvSy(ny);
      if (!hasSolidTerrainSubVoxel(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) return true;
    }
    return false;
  }

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
          return (lv - 1) * 5 + sy + 1;
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

  function getCombinedColumnTopSubY(absX, absZ) {
    return getTerrainColumnTopSubY(absX, absZ) + getLooseSoilCountAt(absX, absZ);
  }

  // --------------------------------------------------------------------------
  // 2. A案：キャラの1人称「前方視野のみ」記号マップ生成（視線遮蔽＝死角あり）
  // --------------------------------------------------------------------------
  function getFacingBasis() {
    const rot = ROBOT.rotY || 0;
    const vx = Math.sin(rot);
    const vz = Math.cos(rot);

    // ALL_DIRS の主4方位から最も近い正面ベクトルを厳密取得
    const cardinals = (typeof ALL_DIRS !== 'undefined' ? ALL_DIRS : []).filter(d => Math.abs(d.dx) + Math.abs(d.dz) === 1);
    let best = cardinals[0] || { dx: 0, dz: 1, name: '南' };
    let bestDot = -99;
    cardinals.forEach(d => {
      const dot = d.dx * vx + d.dz * vz;
      if (dot > bestDot) { bestDot = dot; best = d; }
    });

    const fx = best.dx;
    const fz = best.dz;
    // Three.js Y-up 右手系でのキャラから見た右方向: forward × up = (-fz, fx)
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

  function isCrateAtAbs(absX, absZ, areaId) {
    return DIG_STATE.crates.some(c => {
      if (c.areaId !== areaId) return false;
      const cx = c.x * 5 + 2;
      const cz = c.z * 5 + 2;
      return Math.abs(absX - cx) <= 1 && Math.abs(absZ - cz) <= 1;
    });
  }

  function isWorldItemAtAbs(absX, absZ) {
    if (typeof WORLD_ITEMS === 'undefined') return null;
    const tX = absToTile(absX);
    const tZ = absToTile(absZ);
    if (tX.sub !== 2 || tZ.sub !== 2) return null;
    return WORLD_ITEMS.find(it => it.x === tX.tile && it.z === tZ.tile) || null;
  }

  // キャラの目線から対象サブセルへ視線が通るか（手前に壁があれば死角）
  function isVisibleFromEye(curAbsX, curAbsZ, eyeSubY, targetAbsX, targetAbsZ) {
    const dx = targetAbsX - curAbsX;
    const dz = targetAbsZ - curAbsZ;
    const steps = Math.max(Math.abs(dx), Math.abs(dz)) * 2;
    if (steps <= 1) return true;

    for (let s = 1; s < steps; s++) {
      const ratio = s / steps;
      const mx = Math.round(curAbsX + dx * ratio);
      const mz = Math.round(curAbsZ + dz * ratio);
      if (mx === curAbsX && mz === curAbsZ) continue;
      if (mx === targetAbsX && mz === targetAbsZ) continue;
      if (!isInsideIslandAbs(mx, mz)) return false;

      // 途中マスの目線高さに固体ブロック（地形 or 積み土）があれば奥は遮蔽される
      const tX = absToTile(mx);
      const tZ = absToTile(mz);
      const yInfo = subYToLvSy(eyeSubY);
      if (hasSolidTerrainSubVoxel(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) return false;
      const looseTop = getCombinedColumnTopSubY(mx, mz);
      if (looseTop > eyeSubY) return false;
    }
    return true;
  }

  function buildFirstPersonVisionMap() {
    const stats = getSizeStats();
    const areaId = getCurAreaId();
    const { absX, absZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const eyeSubY = baseSubY + Math.max(1, stats.reachH) - 1;
    const basis = getFacingBasis();

    // ① 上面・前方視野マップ（前方 1〜6分割 × 左右 -3〜+3分割、後ろは見えない）
    const topRows = [];
    for (let fwd = 6; fwd >= 0; fwd--) {
      let row = `前${fwd}: `;
      for (let lat = -3; lat <= 3; lat++) {
        if (fwd === 0 && lat === 0) {
          row += '@ ';
          continue;
        }
        // 前方扇形視野の外側（真横の遠方）は視野外
        if (fwd === 0 && Math.abs(lat) > 1) {
          row += '? ';
          continue;
        }
        if (fwd === 1 && Math.abs(lat) > 2) {
          row += '? ';
          continue;
        }

        const tx = absX + basis.fx * fwd + basis.rx * lat;
        const tz = absZ + basis.fz * fwd + basis.rz * lat;

        if (!isInsideIslandAbs(tx, tz)) {
          row += '~ ';
          continue;
        }
        if (!isVisibleFromEye(absX, absZ, eyeSubY, tx, tz)) {
          row += '? ';
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
          const loose = getLooseSoilCountAt(tx, tz, areaId);
          if (item && item.type === 'apple') {
            ch = 'A';
          } else if (loose > 0) {
            ch = String(Math.min(9, loose));
          } else {
            const topY = getTerrainColumnTopSubY(tx, tz);
            const diff = topY - baseSubY;
            if (diff >= 2) ch = '#';
            else if (diff === 1) ch = '+';
            else if (diff === 0) ch = '.';
            else ch = 'v';
          }
        }
        row += ch + ' ';
      }
      topRows.push(row.trimEnd());
    }

    // ② 目の前1列目（距離1）の正面断面図（高さ: 足元-1〜上+4 × 左右 -2〜+2）
    const frontDist = Math.floor(stats.reachW / 2) + 1;
    const sliceRows = [];
    for (let h = 4; h >= -1; h--) {
      const label = h >= 0 ? `高${h + 1}` : '床 ';
      let row = `${label}: `;
      const yInfo = subYToLvSy(baseSubY + h);
      for (let lat = -2; lat <= 2; lat++) {
        const tx = absX + basis.fx * frontDist + basis.rx * lat;
        const tz = absZ + basis.fz * frontDist + basis.rz * lat;
        if (!isInsideIslandAbs(tx, tz)) {
          row += '~ ';
          continue;
        }
        const tX = absToTile(tx);
        const tZ = absToTile(tz);
        if (hasSolidTerrainSubVoxel(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) {
          row += '# ';
        } else {
          const terrainTop = getTerrainColumnTopSubY(tx, tz);
          const loose = getLooseSoilCountAt(tx, tz, areaId);
          const curY = baseSubY + h;
          if (loose > 0 && curY >= terrainTop && curY < terrainTop + loose) {
            row += 'o ';
          } else if (h >= 0 && h < 3 && isCrateAtAbs(tx, tz, areaId)) {
            row += 'B ';
          } else {
            row += '. ';
          }
        }
      }
      sliceRows.push(row.trimEnd());
    }

    return [
      `視界の向き: 正面=${basis.actualFacingName}(基準:${basis.frontName} / 左:${basis.leftName} / 右:${basis.rightName}) ※背後は死角`,
      `[前方・上面視野 (1文字=1分割, 上ほど奥)]`,
      ...topRows,
      `[目の前1列目の正面断面 (左2〜中央〜右2)]`,
      ...sliceRows,
      `記号: @=自分 #=壁(高2以上) +=1段高 .=平坦/空間 v=低い床/穴 1-9/o=散らばり土(段数) B=木箱 S=シャベル A=リンゴ ~=端 ?=死角`
    ].join('\n');
  }

  // --------------------------------------------------------------------------
  // 3. 3D描画（3×3×3木箱・散らばり土・地面のシャベル）
  // --------------------------------------------------------------------------
  const digVisualGroup = new THREE.Group();
  digVisualGroup.name = 'dig_rules_visual_group';
  if (typeof scene !== 'undefined' && scene) scene.add(digVisualGroup);

  const unitBoxGeo = new THREE.BoxGeometry(SUB_SIZE * 0.96, SUB_SIZE * 0.96, SUB_SIZE * 0.96);
  const unitEdgeGeo = new THREE.EdgesGeometry(unitBoxGeo);

  function buildCrateMesh(crate) {
    const grp = new THREE.Group();
    const boxSize = SUB_SIZE * 3;
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

    DIG_STATE.crates.forEach(c => {
      if (c.areaId === areaId) digVisualGroup.add(buildCrateMesh(c));
    });

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

    if (DIG_STATE.shovel && !DIG_STATE.shovel.held && DIG_STATE.shovel.areaId === areaId) {
      const sh = createKidShovelMesh(1.25);
      const { wx, wz } = absToWorldXZ(DIG_STATE.shovel.absX, DIG_STATE.shovel.absZ);
      const topSubY = getCombinedColumnTopSubY(DIG_STATE.shovel.absX, DIG_STATE.shovel.absZ);
      sh.position.set(wx, topSubY * SUB_SIZE + 0.06, wz);
      sh.rotation.set(Math.PI / 2 - 0.12, 0.7, 0.4);
      digVisualGroup.add(sh);
    }
  }

  // --------------------------------------------------------------------------
  // 4. 物理アクション実装（純粋な物理結果のみ返却・誘導テキストなし）
  // --------------------------------------------------------------------------
  function runLook(dir) {
    ROBOT.rotY = dir.rot;
    const dName = dir.name.replace('(斜め)', '');
    return {
      actionLabel: `👀 ${dName}の方を向いて見回した`,
      physicalResult: `移動せず${dName}の方へ体の向きを変えた`
    };
  }

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

    const maxDist = Math.floor(stats.reachW / 2) + 1;
    const distList = [];
    for (let d = 1; d <= maxDist; d++) distList.push(d);

    if (t.includes('天井') || t.includes('頭上')) {
      for (let wi = 0; wi < wList.length; wi++) {
        const hit = checkCell(curAbsX + px * wList[wi], baseSubY + stats.reachH, curAbsZ + pz * wList[wi], '天井');
        if (hit) return hit;
      }
    }

    if (t.includes('真下') || t.includes('足元')) {
      for (let d = 0; d <= maxDist; d++) {
        for (let wi = 0; wi < wList.length; wi++) {
          const hit = checkCell(curAbsX + dx * d + px * wList[wi], baseSubY - 1, curAbsZ + dz * d + pz * wList[wi], '足元');
          if (hit) return hit;
        }
      }
    }

    for (let di = 0; di < distList.length; di++) {
      const dist = distList[di];
      for (let hi = 0; hi < hList.length; hi++) {
        for (let wi = 0; wi < wList.length; wi++) {
          const hit = checkCell(curAbsX + dx * dist + px * wList[wi], baseSubY + hList[hi], curAbsZ + dz * dist + pz * wList[wi], '壁');
          if (hit) return hit;
        }
      }
    }

    for (let di = 0; di < distList.length; di++) {
      const dist = distList[di];
      for (let wi = 0; wi < wList.length; wi++) {
        const hit = checkCell(curAbsX + dx * dist + px * wList[wi], baseSubY - 1, curAbsZ + dz * dist + pz * wList[wi], '地面');
        if (hit) return hit;
      }
    }

    const underHit = checkCell(curAbsX, baseSubY - 1, curAbsZ, '足元');
    if (underHit) return underHit;

    const topHit = checkCell(curAbsX, baseSubY + stats.reachH, curAbsZ, '天井');
    if (topHit) return topHit;

    return null;
  }

  function scatterDugSoilAroundRobot() {
    const { absX, absZ } = getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const candidates = [];

    for (let ox = -2; ox <= 2; ox++) {
      for (let oz = -2; oz <= 2; oz++) {
        if (ox === 0 && oz === 0) continue;
        const tx = absX + ox;
        const tz = absZ + oz;
        if (!isInsideIslandAbs(tx, tz)) continue;
        const topY = getTerrainColumnTopSubY(tx, tz);
        if (topY <= baseSubY + 1) {
          candidates.push({ absX: tx, absZ: tz, stack: getLooseSoilCountAt(tx, tz), rand: Math.random() });
        }
      }
    }

    if (!candidates.length) {
      addLooseSoilAt(absX, absZ, 1);
      return { absX, absZ };
    }

    candidates.sort((a, b) => (a.stack * 0.6 + a.rand) - (b.stack * 0.6 + b.rand));
    const chosen = candidates[0];
    addLooseSoilAt(chosen.absX, chosen.absZ, 1);
    return chosen;
  }

  function runSubDig(dir, thought) {
    ROBOT.rotY = dir.rot;
    const dName = dir.name.replace('(斜め)', '');
    const target = findDigTargetInDirection(dir, thought);
    if (!target) {
      return {
        actionLabel: `⛏️ ${dName}方向を削ろうとしたが空振りした`,
        physicalResult: `${dName}方向の届く距離1を削ろうとしたが、手が届く露出ブロックがなく空振りした`
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

    const dropPos = scatterDugSoilAroundRobot();
    const totalHere = getLooseSoilCountAt(dropPos.absX, dropPos.absZ);

    life.stamina = Math.max(0, life.stamina - 4);
    life.mental = Math.min(100, life.mental + 4);
    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    saveDigState();

    return {
      actionLabel: `🪏 ${dName}の${target.kind}を1分割削った(周囲に散らばり積${totalHere})`,
      physicalResult: `${dName}の${target.kind}から1分割ブロックが欠け、削れた土が周囲の床に転がり落ちた(その場の積み段数${totalHere})`
    };
  }

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
        actionLabel: `🟫 ポケット満杯(${getResourceTotalCount()}/${stats.pocketCap})で拾えなかった`,
        physicalResult: `ポケットが上限(${stats.pocketCap}個)に達しており、土を拾えなかった`
      };
    }

    const nearby = findNearbyLooseSoilKeys(3);
    if (!nearby.length) {
      return {
        actionLabel: '🟫 すぐそばに拾える土がなかった',
        physicalResult: '手の届く周囲に散らばった土がなく、何も拾えなかった'
      };
    }

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
      actionLabel: `🧺 周囲の分割土を${picked}個拾った(${getResourceTotalCount()}/${stats.pocketCap})`,
      physicalResult: `周囲の散らばった土を${picked}個拾い、ポケットの土が${DIG_STATE.pocketSoil}個になった`
    };
  }

  function runPlaceSoil(dir) {
    if (DIG_STATE.pocketSoil <= 0) {
      return {
        actionLabel: '🟫 置く土がポケットになかった',
        physicalResult: 'ポケットに土がなく、置けなかった'
      };
    }
    ROBOT.rotY = dir.rot;
    const dName = dir.name.replace('(斜め)', '');
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
      actionLabel: `🟫 ${dName}の地面へ分割土を1個置いた(積${stackNow}段)`,
      physicalResult: `${dName}の目の前に土を1個置き、高さ${stackNow}段になった(ポケット残り${DIG_STATE.pocketSoil}個)`
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
      return {
        actionLabel: '📦 すぐ隣に木箱がなかった',
        physicalResult: '手が届く隣に木箱がなく、収納できなかった'
      };
    }
    if (DIG_STATE.pocketSoil <= 0) {
      return {
        actionLabel: '📦 入れる土がポケットになかった',
        physicalResult: 'ポケットに土がなく、木箱へ入れられなかった'
      };
    }
    const free = crate.capacity - crate.soil;
    if (free <= 0) {
      return {
        actionLabel: `📦 木箱が満杯(${crate.soil}/${crate.capacity})だった`,
        physicalResult: `木箱が満杯(${crate.soil}/${crate.capacity})で入らなかった`
      };
    }
    const moved = Math.min(DIG_STATE.pocketSoil, free);
    DIG_STATE.pocketSoil -= moved;
    crate.soil += moved;
    ROBOT.params.logic = Math.min(100, (ROBOT.params.logic || 50) + 3);
    life.mental = Math.min(100, life.mental + 8);
    saveDigState();
    return {
      actionLabel: `📦 木箱へ土を${moved}個入れた(${crate.soil}/${crate.capacity})`,
      physicalResult: `隣の木箱へ土を${moved}個入れ、木箱は${crate.soil}/${crate.capacity}になった`
    };
  }

  function runShovelFree(dir, thought) {
    const t = String(thought || '');
    const dName = dir.name.replace('(斜め)', '');
    const areaId = getCurAreaId();
    const { absX, absZ } = getRobotAbsPos();
    ROBOT.rotY = dir.rot;

    if (!DIG_STATE.shovel.held) {
      if (DIG_STATE.shovel.areaId !== areaId) {
        return {
          actionLabel: '🪏 近くにシャベルがなかった',
          physicalResult: '手が届く周囲にシャベルがなく、拾えなかった'
        };
      }
      const dist = Math.max(Math.abs(DIG_STATE.shovel.absX - absX), Math.abs(DIG_STATE.shovel.absZ - absZ));
      if (dist <= 3) {
        DIG_STATE.shovel.held = true;
        saveDigState();
        return {
          actionLabel: '🪏 こども用シャベルを拾った',
          physicalResult: '足元付近にあったこども用シャベルを右手に拾い上げた'
        };
      }
      return {
        actionLabel: '🪏 手が届く範囲にシャベルがなかった',
        physicalResult: '手が届く範囲にシャベルがなく、触れなかった'
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
        physicalResult: `こども用シャベルを${dName}方向へ約4分割先に投げ、右手は空になった`
      };
    }

    if (t.includes('遊') || t.includes('振') || t.includes('ブン')) {
      life.mental = Math.min(100, life.mental + 6);
      ROBOT.params.cautionLimiter = Math.min(100, (ROBOT.params.cautionLimiter || 50) + 2);
      return {
        actionLabel: '🪏 シャベルを空中で振った',
        physicalResult: '右手のこども用シャベルを空中で振った'
      };
    }

    const tx = Math.max(-10, Math.min(14, absX + Math.sign(dir.dx || 0)));
    const tz = Math.max(-10, Math.min(14, absZ + Math.sign(dir.dz || 0)));
    DIG_STATE.shovel = { held: false, areaId, absX: tx, absZ: tz };
    saveDigState();
    return {
      actionLabel: `🪏 シャベルを${dName}の地面に置いた`,
      physicalResult: `こども用シャベルを${dName}のすぐそばの地面に置き、右手は空になった`
    };
  }

  function checkLooseSoilObstacleAt(centerAbsX, centerAbsZ, curBaseSubY, stats) {
    const halfW = Math.floor((stats.reachW - 1) / 2);
    const maxW  = Math.floor(stats.reachW / 2);

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
            return `高さ${looseCnt}段の散らばった土`;
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
    const dName = dir.name.replace('(斜め)', '');
    ROBOT.rotY = dir.rot;

    let curX = ROBOT.pos.x;
    let curZ = ROBOT.pos.z;
    let curLv = (typeof getRobotHeightLevel === 'function') ? getRobotHeightLevel() : (ROBOT.pos.lv || 0);
    let curSx = Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2;
    let curSz = Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2;
    let curBaseSubY = getRobotBaseSubY(curX, curZ, curLv);

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

      const nextAbsX = nextX * 5 + nextSx;
      const nextAbsZ = nextZ * 5 + nextSz;
      const soilBlock = checkLooseSoilObstacleAt(nextAbsX, nextAbsZ, curBaseSubY, stats);
      if (soilBlock) {
        stopReason = soilBlock;
        break;
      }

      const { lv: footLv, sy: footSy } = subYToLvSy(curBaseSubY);

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
        curBaseSubY = getRobotBaseSubY(nextX, nextZ, curLv);
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
      const phys = stopReason
        ? `${dName}へ${movedSteps}分割進んだところで「${stopReason}」に当たり停止した`
        : `${dName}へ${movedSteps}分割進んだ`;
      return {
        actionLabel: `🐾 ${dName}へ${movedSteps}分割移動${stopReason ? `(${stopReason}で停止)` : ''}`,
        physicalResult: phys
      };
    }
    return {
      actionLabel: `🐾 ${dName}へ進めなかった(${stopReason || '障害物'})`,
      physicalResult: `${dName}へ進もうとしたが「${stopReason || '障害物'}」に阻まれ1分割も進めなかった`
    };
  }

  // --------------------------------------------------------------------------
  // 5. 日記帳アイテム枠UI（上段1枠目:シャベル / 2〜5枠目:資源 / 下段5枠:木箱）
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
          if (typeof showToast === 'function') showToast(`🟫 獲得した分割土：${DIG_STATE.pocketSoil}個（上限 ${stats.pocketCap}個）`);
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
  // 6. 既存フック接続
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
    // A案用：前方視野マッププロバイダ
    if (typeof window.AICommCore.registerVisionProvider === 'function') {
      window.AICommCore.registerVisionProvider(() => buildFirstPersonVisionMap());
    }

    // 身体感覚・所持状態センサー（A案・B案共通。絶対座標や見えていない物の位置は一切渡さない）
    const registerBody = window.AICommCore.registerBodySensor || window.AICommCore.registerSensor;
    registerBody(() => {
      const stats = getSizeStats();
      const st = life.getState();
      const basis = getFacingBasis();
      const bagOther = (typeof BAG !== 'undefined' && BAG.length) ? BAG.join(',') : 'なし';

      return [
        `体格: 高さ${stats.reachH}分割 × 幅${stats.reachW}分割 (1ターン歩幅:最大${stats.moveStep}分割 / 越えられる土段差:${stats.maxStepUpSub}段)`,
        `向いている方角: ${basis.actualFacingName} / 姿勢: ${ROBOT.posture === 'crawl' ? 'ほふく' : '立位'}`,
        `身体状態: 体力${st.stamina}/100, おなか${st.energy}/100`,
        `右手: ${DIG_STATE.shovel.held ? 'こども用シャベルを所持' : '空手'}`,
        `ポケット: 土${DIG_STATE.pocketSoil}個 (資源合計${getResourceTotalCount()}/${stats.pocketCap}個 / その他:${bagOther})`
      ].join('\n');
    });

    // ヒントなしの純粋な物理アクション一覧
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
      desc: '指定方角の距離1にある露出ブロックを1分割削る',
      run: ({ dir, dec }) => { lastTurnActionId = 'dig_front'; return runSubDig(dir, dec && dec.thought); }
    });

    window.AICommCore.registerAction({
      id: 'pickup_soil',
      desc: 'すぐそばの地面にある散らばった土を拾う',
      run: () => { lastTurnActionId = 'pickup_soil'; return runPickupSoil(); }
    });

    window.AICommCore.registerAction({
      id: 'place_soil',
      desc: 'ポケットの土を指定方角の距離1の地面へ1個置く',
      run: ({ dir }) => { lastTurnActionId = 'place_soil'; return runPlaceSoil(dir); }
    });

    window.AICommCore.registerAction({
      id: 'store_crate',
      desc: 'すぐ隣の木箱へポケットの土を入れる',
      run: () => { lastTurnActionId = 'store_crate'; return runStoreCrate(); }
    });

    window.AICommCore.registerAction({
      id: 'shovel_free',
      desc: 'こども用シャベルを地面に置く・指定方角へ投げる・すぐそばから拾う・振る',
      run: ({ dir, dec }) => { lastTurnActionId = 'shovel_free'; return runShovelFree(dir, dec && dec.thought); }
    });

    // 行動と見た目の同期
    window.AICommCore.registerPostTurnHook(({ dec }) => {
      const act = (dec && dec.action) || lastTurnActionId;
      const eSpec = (typeof getExpressionSpec === 'function') ? getExpressionSpec(ROBOT.emotion) : null;

      if (act === 'dig_front') {
        ROBOT.emotion = 'swing_v';
      } else if (act === 'shovel_free') {
        ROBOT.emotion = DIG_STATE.shovel.held ? 'swing_h' : 'wave';
      } else if (act === 'look') {
        ROBOT.emotion = 'peek';
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
    buildFirstPersonVisionMap,
    renderPocketAndCrateDiaryUI,
    renderDigVisuals
  });
})();
