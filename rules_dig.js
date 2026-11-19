// ============================================================================
// 【掘削・歩幅移動・体積ポケット・木箱収納ルール：rules_dig.js（1分割欠け描画対応版）】
// ※ brain.js / world.js / ai_comm.js / index.html は無改造のまま接続します
// ============================================================================
(function initDigRulesModule() {
  if (window.DigRulesModule) return;

  const STORAGE_KEY = 'rules_dig_state_v1';
  const SUB_SIZE = 0.2; // 大ブロック(1.0)の1/5

  const HEIGHT_RANK = { tiny: 1, small: 2, medium: 3, large: 4, giant: 5 };
  const WIDTH_RANK  = { slim1: 1, slim2: 2, normal3: 3, fat4: 4, fat5: 5 };

  function createDefaultState() {
    return {
      initializedEmptyBag: false,
      pocketSoil: 0,
      crates: [
        { id: 'crate_1', areaId: 'home', x: -1, z: 0, capacity: 27, soil: 0 }
      ],
      dugCells: {},    // key: `${areaId}|${x},${z},${lv}` -> ["sx,sy,sz", ...]
      placedSoils: {}  // key: `${areaId}|${x},${z}` -> count
    };
  }

  let DIG_STATE = createDefaultState();

  function getCurAreaId() {
    return (typeof getCurrentAreaDef === 'function' && getCurrentAreaDef())
      ? getCurrentAreaDef().id
      : 'home';
  }

  function getSizeStats() {
    const hRank = HEIGHT_RANK[(typeof ROBOT !== 'undefined' && ROBOT.sizeLevel) || 'tiny'] || 1;
    const wRank = WIDTH_RANK[(typeof ROBOT !== 'undefined' && ROBOT.bodyType) || 'slim1'] || 1;
    return {
      reachH: hRank,           // 掘れる高さ（分割1〜5）
      reachW: wRank,           // 掘れる幅（分割1〜5）
      reachD: 1,               // 掘れる奥行き（常に目の前1列目）
      moveStep: 6 - wRank,     // 1ターン最大歩幅（やせっちょ5〜でぶっちょ1）
      pocketCap: hRank * wRank // 体積型持ち運び上限（1〜25）
    };
  }

  function getPocketTotalCount() {
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
          }
        }
      }
    } catch (e) {
      DIG_STATE = createDefaultState();
    }

    if (!DIG_STATE.initializedEmptyBag) {
      if (typeof BAG !== 'undefined' && Array.isArray(BAG)) BAG.length = 0;
      DIG_STATE.pocketSoil = 0;
      DIG_STATE.initializedEmptyBag = true;
      saveDigState();
      if (typeof saveWorldState === 'function') saveWorldState();
    }
  }

  // --------------------------------------------------------------------------
  // 0. 旧ボタンイベント（addEventListener）の完全除去＆通信エラー診断フック
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

    // Groq通信失敗時に旧サイコロ思考へ落ちた理由をメッセージ欄にも残す
    if (typeof showToast === 'function') {
      const _origToast = showToast;
      showToast = function(msg) {
        _origToast(msg);
        if (typeof msg === 'string' && (msg.includes('Groq通信失敗') || msg.includes('キー未設定'))) {
          setTimeout(() => {
            const actEl = document.getElementById('history-action');
            if (actEl) actEl.innerText = msg;
          }, 50);
        }
      };
    }
  })();

  // --------------------------------------------------------------------------
  // 1. 3D描画（3×3×3木箱・置いた1分割土・1個だけ欠けた5×5×5削りブロック）
  // --------------------------------------------------------------------------
  const digVisualGroup = new THREE.Group();
  digVisualGroup.name = 'dig_rules_visual_group';
  if (typeof scene !== 'undefined' && scene) scene.add(digVisualGroup);

  const unitBoxGeo = new THREE.BoxGeometry(SUB_SIZE * 0.985, SUB_SIZE * 0.985, SUB_SIZE * 0.985);
  const unitEdgeGeo = new THREE.EdgesGeometry(unitBoxGeo);
  const hiddenOrigMeshes = [];

  function restoreHiddenOrigMeshes() {
    while (hiddenOrigMeshes.length) {
      const m = hiddenOrigMeshes.pop();
      if (m) m.visible = true;
    }
  }

  function isProtectedObject(obj) {
    let p = obj;
    while (p) {
      if (p === digVisualGroup) return true;
      if (typeof robotGroup !== 'undefined' && p === robotGroup) return true;
      if (typeof followPetMesh !== 'undefined' && p === followPetMesh) return true;
      if (typeof pastelExtraGroup !== 'undefined' && p === pastelExtraGroup) return true;
      p = p.parent;
    }
    return false;
  }

  // 指定ブロック(bx, bz, blv)の上面Yと底面Yを既存world.jsの座標系から取得
  function getBlockVerticalBounds(bx, bz, blv) {
    const surfaceY = (typeof getSurfaceYAt === 'function')
      ? getSurfaceYAt(bx, bz, blv)
      : (blv + 1);
    const topY = Math.round(surfaceY * 5) / 5;
    const bottomY = topY - 1.0;
    return { bottomY, topY };
  }

  // 元の1ブロック（または層スライス）を非表示にし、欠けた1分割だけ抜いた5×5×5を描画
  function replaceDugBlockWithVoxelGrid(bx, bz, blv, dugSet) {
    const { bottomY, topY } = getBlockVerticalBounds(bx, bz, blv);
    const worldPos = new THREE.Vector3();
    const box3 = new THREE.Box3();
    const size3 = new THREE.Vector3();

    if (typeof scene !== 'undefined' && scene) {
      scene.traverse(obj => {
        if (!obj.isMesh || !obj.visible || isProtectedObject(obj)) return;
        obj.getWorldPosition(worldPos);
        if (Math.abs(worldPos.x - bx) > 0.48 || Math.abs(worldPos.z - bz) > 0.48) return;
        if (worldPos.y < bottomY - 0.05 || worldPos.y > topY + 0.05) return;

        box3.setFromObject(obj);
        box3.getSize(size3);
        // 地形ブロック本体（幅0.15〜1.08、高さ0.15〜1.08）のみ非表示化
        if (size3.x >= 0.15 && size3.x <= 1.08 && size3.z >= 0.15 && size3.z <= 1.08 && size3.y >= 0.15 && size3.y <= 1.08) {
          obj.visible = false;
          hiddenOrigMeshes.push(obj);
        }
      });
    }

    const topCol  = (typeof SPACE_COLORS !== 'undefined' && SPACE_COLORS.pastelGreenTop) || 0xa7f3d0;
    const midCol  = (typeof SPACE_COLORS !== 'undefined' && SPACE_COLORS.pastelGreenMid) || 0x86efac;
    const soilCol = (typeof SPACE_COLORS !== 'undefined' && SPACE_COLORS.dryPastelSoil)  || 0xd4a373;
    const wetCol  = (typeof SPACE_COLORS !== 'undefined' && SPACE_COLORS.wetSoilLv2)     || 0xb07d56;
    const isSurfaceBlock = (typeof HEIGHT_MAP !== 'undefined' && HEIGHT_MAP[`${bx},${bz}`] === blv);

    // 残っている小ブロック一覧を抽出し、InstancedMesh 1回で軽量描画
    const remaining = [];
    for (let sx = 0; sx < 5; sx++) {
      for (let sy = 0; sy < 5; sy++) {
        for (let sz = 0; sz < 5; sz++) {
          if (dugSet.has(`${sx},${sy},${sz}`)) continue;
          remaining.push({ sx, sy, sz });
        }
      }
    }
    if (!remaining.length) return;

    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const inst = new THREE.InstancedMesh(unitBoxGeo, mat, remaining.length);
    const dummy = new THREE.Object3D();
    const cTop = new THREE.Color(topCol);
    const cMid = new THREE.Color(midCol);
    const cSoil = new THREE.Color(soilCol);
    const cWet = new THREE.Color(wetCol);
    const cLightSoil = cSoil.clone().offsetHSL(0, 0, 0.05);

    remaining.forEach((cell, idx) => {
      dummy.position.set(
        bx + (cell.sx - 2) * SUB_SIZE,
        bottomY + cell.sy * SUB_SIZE + SUB_SIZE * 0.5,
        bz + (cell.sz - 2) * SUB_SIZE
      );
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);

      const checker = ((cell.sx + cell.sz) % 2 === 0);
      let col = checker ? cSoil : cLightSoil;
      if (isSurfaceBlock && cell.sy === 4) col = cTop;
      else if (isSurfaceBlock && cell.sy === 3) col = cMid;
      else if (blv < 0) col = cWet;
      inst.setColorAt(idx, col);
    });

    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    digVisualGroup.add(inst);
  }

  function buildCrateMesh(crate) {
    const grp = new THREE.Group();
    const boxSize = SUB_SIZE * 3; // 分割ブロック 3×3×3
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
    restoreHiddenOrigMeshes();
    while (digVisualGroup.children.length) digVisualGroup.remove(digVisualGroup.children[0]);
    const areaId = getCurAreaId();

    // ① 3×3×3 木箱
    DIG_STATE.crates.forEach(c => {
      if (c.areaId === areaId) digVisualGroup.add(buildCrateMesh(c));
    });

    // ② 地面に置いた1分割土ブロック
    const soilMat = new THREE.MeshLambertMaterial({ color: 0xd4a373 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x8d5b32, transparent: true, opacity: 0.45 });
    Object.keys(DIG_STATE.placedSoils).forEach(k => {
      if (!k.startsWith(areaId + '|')) return;
      const count = DIG_STATE.placedSoils[k] || 0;
      if (count <= 0) return;
      const [bx, bz] = k.split('|')[1].split(',').map(Number);
      const baseY = (typeof getSurfaceYAt === 'function') ? getSurfaceYAt(bx, bz, null, 3) : 0;
      const showCount = Math.min(count, 25);
      for (let i = 0; i < showCount; i++) {
        const layer = Math.floor(i / 9);
        const rem = i % 9;
        const ox = ((rem % 3) - 1) * SUB_SIZE;
        const oz = (Math.floor(rem / 3) - 1) * SUB_SIZE;
        const oy = layer * SUB_SIZE + SUB_SIZE * 0.5;
        const m = new THREE.Mesh(unitBoxGeo, soilMat);
        m.position.set(bx + ox, baseY + oy, bz + oz);
        m.add(new THREE.LineSegments(unitEdgeGeo, edgeMat));
        digVisualGroup.add(m);
      }
    });

    // ③ 1分割単位で削ったブロックの5×5×5差し替え描画
    Object.keys(DIG_STATE.dugCells).forEach(k => {
      if (!k.startsWith(areaId + '|')) return;
      const list = DIG_STATE.dugCells[k];
      if (!Array.isArray(list) || !list.length) return;
      const [bx, bz, blv] = k.split('|')[1].split(',').map(Number);
      replaceDugBlockWithVoxelGrid(bx, bz, blv, new Set(list));
    });
  }

  // --------------------------------------------------------------------------
  // 2. 掘削ロジック（高さ1〜5 × 幅1〜5 × 奥行き1・1ターン分割1個のみ）
  // --------------------------------------------------------------------------
  function getFrontSubCoord(dir, offsetW, offsetH) {
    const curSx = Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2;
    const curSz = Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2;
    const dx = Math.sign(dir.dx || 0);
    const dz = Math.sign(dir.dz || 0);

    // 目の前が壁（隣接大ブロックが高い）なら、隣接大ブロックの手前1列目を狙う
    const adjX = ROBOT.pos.x + dx;
    const adjZ = ROBOT.pos.z + dz;
    const curLv = (typeof getRobotHeightLevel === 'function') ? getRobotHeightLevel() : (ROBOT.pos.lv || 0);
    const adjH = (typeof HEIGHT_MAP !== 'undefined' && HEIGHT_MAP[`${adjX},${adjZ}`] !== undefined)
      ? HEIGHT_MAP[`${adjX},${adjZ}`]
      : curLv;

    let px = -dz, pz = dx;
    if (dx !== 0 && dz !== 0) { px = -dz; pz = 0; }

    let tx, tz, tsx, tsz, targetLv;
    if (adjX >= -2 && adjX <= 2 && adjZ >= -2 && adjZ <= 2 && adjH > curLv) {
      // 目の前の壁（1段上のブロック）のキャラ側手前1列目（奥行き1）
      tx = adjX;
      tz = adjZ;
      targetLv = curLv + 1;
      const baseSx = dx > 0 ? 0 : (dx < 0 ? 4 : curSx);
      const baseSz = dz > 0 ? 0 : (dz < 0 ? 4 : curSz);
      tsx = Math.max(0, Math.min(4, baseSx + px * offsetW));
      tsz = Math.max(0, Math.min(4, baseSz + pz * offsetW));
    } else {
      // 同じ高さのサブ座標1マス先（または足元ブロック）
      const absSx = ROBOT.pos.x * 5 + curSx + dx + px * offsetW;
      const absSz = ROBOT.pos.z * 5 + curSz + dz + pz * offsetW;
      tx = Math.floor(absSx / 5);
      tz = Math.floor(absSz / 5);
      tsx = ((absSx % 5) + 5) % 5;
      tsz = ((absSz % 5) + 5) % 5;
      targetLv = (typeof HEIGHT_MAP !== 'undefined' && HEIGHT_MAP[`${tx},${tz}`] !== undefined)
        ? Math.min(HEIGHT_MAP[`${tx},${tz}`], curLv)
        : curLv;
    }

    const tsy = Math.max(0, Math.min(4, offsetH));
    return { tx, tz, tsx, tsy, tsz, targetLv };
  }

  function pickTargetOrderFromThought(thought, reachW, reachH) {
    const t = String(thought || '');
    const halfW = Math.floor(reachW / 2);
    const wList = [];
    for (let i = 0; i < reachW; i++) wList.push(i - halfW);
    if (t.includes('左')) wList.sort((a, b) => a - b);
    else if (t.includes('右')) wList.sort((a, b) => b - a);
    else wList.sort((a, b) => Math.abs(a) - Math.abs(b));

    const hList = [];
    for (let y = 0; y < reachH; y++) hList.push(y);
    if (t.includes('上') || t.includes('高')) hList.sort((a, b) => b - a);
    else if (t.includes('下') || t.includes('足元')) hList.sort((a, b) => a - b);

    const pairs = [];
    hList.forEach(h => wList.forEach(w => pairs.push({ w, h })));
    return pairs;
  }

  function runSubDig(dir, thought) {
    const stats = getSizeStats();
    const used = getPocketTotalCount();
    if (used >= stats.pocketCap) {
      return {
        actionLabel: `🟫 ポケット満杯(${used}/${stats.pocketCap})で掘れない`,
        thoughtAppend: '（ポケットがいっぱい！木箱にしまうか地面に置かなきゃ）'
      };
    }

    const areaId = getCurAreaId();
    ROBOT.rotY = dir.rot;

    const order = pickTargetOrderFromThought(thought, stats.reachW, stats.reachH);
    let chosen = null;

    for (let i = 0; i < order.length; i++) {
      const c = getFrontSubCoord(dir, order[i].w, order[i].h);
      if (c.tx < -2 || c.tx > 2 || c.tz < -2 || c.tz > 2) continue;

      const cellKey = `${areaId}|${c.tx},${c.tz},${c.targetLv}`;
      const dugArr = DIG_STATE.dugCells[cellKey] || [];
      const tag = `${c.tsx},${c.tsy},${c.tsz}`;
      if (!dugArr.includes(tag)) {
        chosen = { ...c, cellKey, tag };
        break;
      }
    }

    if (!chosen) {
      return {
        actionLabel: `⛏️ ${dir.name}の届く範囲(高${stats.reachH}×幅${stats.reachW}×奥1)は掘削済み`,
        thoughtAppend: '（届く範囲はもう空っぽ！一歩動いてから掘ろう）'
      };
    }

    if (!DIG_STATE.dugCells[chosen.cellKey]) DIG_STATE.dugCells[chosen.cellKey] = [];
    DIG_STATE.dugCells[chosen.cellKey].push(chosen.tag);
    DIG_STATE.pocketSoil += 1;

    life.stamina = Math.max(0, life.stamina - 4);
    life.mental = Math.min(100, life.mental + 4);
    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    saveDigState();

    return {
      actionLabel: `⛏️ 分割ブロック1個掘削(${dir.name} 高${chosen.tsy + 1}) ポケット${getPocketTotalCount()}/${stats.pocketCap}`
    };
  }

  // --------------------------------------------------------------------------
  // 3. 移動ロジック（太さ別：1ターン最大分割1〜5ブロック移動）
  // --------------------------------------------------------------------------
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
      thoughtAppend: '（進めなかった！掘るか別の方角へ回ろう）'
    };
  }

  // --------------------------------------------------------------------------
  // 4. 木箱収納 ＆ 地面に置くアクション
  // --------------------------------------------------------------------------
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
        thoughtAppend: '（木箱のそばまで歩かないとしまえないよ）'
      };
    }
    if (DIG_STATE.pocketSoil <= 0) {
      return { actionLabel: '📦 しまう土がポケットにない' };
    }
    const free = crate.capacity - crate.soil;
    if (free <= 0) {
      return {
        actionLabel: `📦 木箱が満杯(${crate.soil}/${crate.capacity})！`,
        thoughtAppend: '（木箱がいっぱいだ！地面に積むしかない）'
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

  function runPlaceSoil(dir) {
    if (DIG_STATE.pocketSoil <= 0) {
      return { actionLabel: '🟫 置くための土がポケットにない' };
    }
    const areaId = getCurAreaId();
    const tx = Math.max(-2, Math.min(2, ROBOT.pos.x + Math.sign(dir.dx || 0)));
    const tz = Math.max(-2, Math.min(2, ROBOT.pos.z + Math.sign(dir.dz || 0)));
    const key = `${areaId}|${tx},${tz}`;
    DIG_STATE.placedSoils[key] = (DIG_STATE.placedSoils[key] || 0) + 1;
    DIG_STATE.pocketSoil -= 1;

    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    saveDigState();
    return {
      actionLabel: `🟫 地面(${tx},${tz})に分割土を1個置いた(計${DIG_STATE.placedSoils[key]}個)`
    };
  }

  // --------------------------------------------------------------------------
  // 5. 日記帳アイテム枠UI（1行目5枠：ポケット / 2行目5枠：木箱）
  // --------------------------------------------------------------------------
  const ITEM_ICONS = { apple: '🍎', stone: '🪨', oil: '🧴', grass: '🌿' };

  function renderPocketAndCrateDiaryUI() {
    const grid = document.getElementById('bag-grid');
    if (!grid) return;

    const stats = getSizeStats();
    if (grid.previousElementSibling) {
      grid.previousElementSibling.innerText =
        `🎒 上段5枠：ポケット(${getPocketTotalCount()}/${stats.pocketCap}個) ／ 下段5枠：📦木箱の数(${DIG_STATE.crates.length}/5箱)`;
    }

    grid.innerHTML = '';

    for (let i = 0; i < 5; i++) {
      const slot = document.createElement('div');
      slot.className = 'bag-slot';
      slot.style.flexDirection = 'column';
      slot.style.gap = '1px';
      slot.style.padding = '2px';

      if (i === 0 && DIG_STATE.pocketSoil > 0) {
        slot.classList.add('filled');
        const over = getPocketTotalCount() > stats.pocketCap;
        slot.style.borderColor = over ? '#ef4444' : '#b45309';
        slot.style.background = over ? '#fef2f2' : '#fef3c7';
        slot.innerHTML = `<span style="font-size:16px;line-height:1;">🟫</span><span style="font-size:9px;font-weight:900;color:${over ? '#dc2626' : '#92400e'};">${DIG_STATE.pocketSoil}/${stats.pocketCap}</span>`;
        slot.onclick = () => {
          if (typeof showToast === 'function') {
            showToast(`🟫 ポケットの分割土：${DIG_STATE.pocketSoil}個（上限 ${stats.pocketCap}個）`);
          }
        };
      } else {
        const bagIdx = i - 1;
        const item = (bagIdx >= 0 && typeof BAG !== 'undefined' && BAG[bagIdx]) ? BAG[bagIdx] : null;
        if (item) {
          slot.classList.add('filled');
          slot.innerHTML = `<span style="font-size:18px;line-height:1;">${ITEM_ICONS[item] || '📦'}</span>`;
        } else {
          slot.innerHTML = `<span style="font-size:9px;color:#94a3b8;font-weight:800;">空</span>`;
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
  // 6. 既存フックへの安全な接続
  // --------------------------------------------------------------------------
  if (typeof rebuildTerrainAndItems === 'function') {
    const _origRebuild = rebuildTerrainAndItems;
    rebuildTerrainAndItems = function() {
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
  // 7. AICommCore へのセンサー＆アクション登録
  // --------------------------------------------------------------------------
  if (window.AICommCore) {
    window.AICommCore.registerSensor(() => {
      const stats = getSizeStats();
      const areaId = getCurAreaId();
      const crateList = DIG_STATE.crates
        .filter(c => c.areaId === areaId)
        .map((c, idx) => `木箱${idx + 1}(x=${c.x},z=${c.z},収納${c.soil}/${c.capacity})`)
        .join(', ') || 'このエリアに木箱なし';
      const curSx = Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2;
      const curSz = Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2;

      return [
        `サブ位置:(sx=${curSx},sz=${curSz}) 1ターン最大歩幅:分割${stats.moveStep}ブロック`,
        `掘削到達範囲:高さ${stats.reachH}×幅${stats.reachW}×奥行き1(1ターン分割1個のみ)`,
        `ポケット:土${DIG_STATE.pocketSoil}個(合計${getPocketTotalCount()}/${stats.pocketCap}個)`,
        `設置木箱(3x3x3):${crateList}`
      ].join('\n');
    });

    window.AICommCore.registerAction({
      id: 'move',
      desc: '太さに応じた歩幅(やせっちょ5〜でぶっちょ1の分割ブロック)で指定方角へ移動する',
      run: ({ dir }) => runSubMove(dir)
    });

    window.AICommCore.registerAction({
      id: 'dig_front',
      desc: '移動せず体格の届く範囲(高さ1〜5×幅1〜5×奥行き1)から分割ブロック1個だけを掘ってポケットに入れる',
      run: ({ dir, dec }) => runSubDig(dir, dec && dec.thought)
    });

    window.AICommCore.registerAction({
      id: 'store_crate',
      desc: '近く(隣接または同じマス)にある3×3×3木箱(容量27)へポケットの土をまとめて収納する',
      run: () => runStoreCrate()
    });

    window.AICommCore.registerAction({
      id: 'place_soil',
      desc: 'ポケットの土を目の前または足元の地面に1分割ブロック置いて積む',
      run: ({ dir }) => runPlaceSoil(dir)
    });
  }

  loadDigState();
  renderDigVisuals();
  renderPocketAndCrateDiaryUI();

  window.DigRulesModule = Object.freeze({
    getState: () => DIG_STATE,
    getSizeStats,
    renderPocketAndCrateDiaryUI,
    renderDigVisuals
  });
})();
