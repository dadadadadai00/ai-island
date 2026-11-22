// ============================================================================
// 【分割物理モジュール 4/7：dig_dig.js】
// ・繋がり合うブロック/分割ブロックの自由連結掘削（上下左右・斜め45度・個数自由）
// ・距離1触覚サマリー(describeImmediateTouch)・空振り距離診断・個数指定手置き・詰み粉砕
// ============================================================================
(function initDigDig() {
  const DIG = window.DIG;
  if (!DIG || !DIG.core || !DIG.move) return;
  const C = DIG.core;
  const M = DIG.move;
  const CONST = DIG.CONST;

  function buildFrontRowCells(curAbsX, curAbsZ, dir, stats, thought) {
    const dx = Math.sign((dir && dir.dx) || 0);
    const dz = Math.sign((dir && dir.dz) || 0);
    const { minOff, maxOff } = C.getFootprintBounds(stats.reachW);
    const frontEdge = C.getFrontEdgeOffset(dx, dz, stats.reachW);
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
      cells.push({ absX: curAbsX + frontEdge.ox, absZ: curAbsZ });
      cells.push({ absX: curAbsX, absZ: curAbsZ + frontEdge.oz });
    }

    const rx = -dz, rz = dx;
    const t = String(thought || '');
    const lateralScore = (c) => (c.absX - curAbsX) * rx + (c.absZ - curAbsZ) * rz;
    if (t.includes('左')) cells.sort((a, b) => lateralScore(a) - lateralScore(b));
    else if (t.includes('右')) cells.sort((a, b) => lateralScore(b) - lateralScore(a));
    else cells.sort((a, b) => Math.abs(lateralScore(a)) - Math.abs(lateralScore(b)));
    return cells;
  }

  function buildSideRowCells(curAbsX, curAbsZ, dir, stats, sideSign) {
    const dx = Math.sign((dir && dir.dx) || 0);
    const dz = Math.sign((dir && dir.dz) || 0);
    const sx = (-dz) * sideSign;
    const sz = (dx) * sideSign;
    return buildFrontRowCells(curAbsX, curAbsZ, { dx: sx, dz: sz }, stats, '');
  }

  function hasUnreachableUpperWallInFront(dir, stats) {
    const { absX: curAbsX, absZ: curAbsZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const frontCells = buildFrontRowCells(curAbsX, curAbsZ, dir, stats, '');
    for (let i = 0; i < frontCells.length; i++) {
      for (let h = stats.reachH; h <= 4; h++) {
        if (C.hasSolidTerrainAtAbsSubY(frontCells[i].absX, baseSubY + h, frontCells[i].absZ)) return true;
      }
    }
    return false;
  }

  function findNearestWallDistInDir(dir, mode, stats) {
    const { absX: curAbsX, absZ: curAbsZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    let dx = Math.sign((dir && dir.dx) || 0), dz = Math.sign((dir && dir.dz) || 0);
    if (mode === 'left') { const ox = dx, oz = dz; dx = oz; dz = -ox; }
    else if (mode === 'right') { const ox = dx, oz = dz; dx = -oz; dz = ox; }
    if (dx === 0 && dz === 0) return 0;

    for (let dist = 2; dist <= 4; dist++) {
      const tx = curAbsX + dx * dist, tz = curAbsZ + dz * dist;
      if (!C.isInsideIslandAbs(tx, tz)) break;
      for (let h = 0; h < stats.reachH; h++) {
        if (C.hasSolidTerrainAtAbsSubY(tx, baseSubY + h, tz)) return dist;
      }
    }
    return 0;
  }

  // 今すぐ手が届く距離1の接触情報（触覚サマリー）
  function describeImmediateTouch() {
    const areaId = C.getCurAreaId();
    const stats = C.getSizeStats();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const dirs = (typeof ALL_DIRS !== 'undefined' && ALL_DIRS.length) ? ALL_DIRS : [];
    const hitWalls = [], hitLoose = [], hitCrates = [];

    dirs.forEach(d => {
      if (M.isBehindCurrentFacing(d)) return; // 背後死角の原則を維持
      const dName = d.name.replace('(斜め)', '');
      const frontEdge = C.getFrontEdgeOffset(Math.sign(d.dx), Math.sign(d.dz), stats.reachW);
      const tx = absX + frontEdge.ox, tz = absZ + frontEdge.oz;
      if (!C.isInsideIslandAbs(tx, tz)) return;

      if (M.isCrateBlockingAtSubY(tx, baseSubY, tz, areaId)) {
        hitCrates.push(dName);
        return;
      }
      let hasDigWall = false;
      for (let h = 0; h < stats.reachH; h++) {
        if (C.hasSolidTerrainAtAbsSubY(tx, baseSubY + h, tz)) { hasDigWall = true; break; }
      }
      if (hasDigWall) {
        hitWalls.push(dName);
      } else {
        const stacks = C.getLooseSoilStacksInColumn(tx, tz, areaId);
        const st = stacks.find(s => s.count > 0 && s.floorSubY <= baseSubY + stats.reachH && s.floorSubY + s.count > baseSubY);
        if (st) hitLoose.push(`${dName}(土${st.count}段)`);
      }
    });

    const parts = [];
    if (hitWalls.length) parts.push(`すぐ掘れる距離1の壁=[${hitWalls.join('・')}]`);
    else parts.push('すぐ掘れる距離1の壁=なし(壁を掘るには距離1まで移動が必要)');
    if (hitLoose.length) parts.push(`距離1の散らばり土=[${hitLoose.join('・')}]`);
    if (hitCrates.length) parts.push(`距離1の圧縮木箱=[${hitCrates.join('・')}]`);
    return `手の届く距離1の接触(視界側): ${parts.join(' ／ ')}`;
  }

  function isWithinDigReach(absX, totalSubY, absZ, curAbsX, baseSubY, curAbsZ, stats, targetMode) {
    const { minOff, maxOff } = C.getFootprintBounds(stats.reachW);
    const reachHoriz = Math.max(1, stats.reachW) + 1;
    if (absX < curAbsX + minOff - reachHoriz || absX > curAbsX + maxOff + reachHoriz) return false;
    if (absZ < curAbsZ + minOff - reachHoriz || absZ > curAbsZ + maxOff + reachHoriz) return false;
    const minY = (targetMode === 'front_down' || targetMode === 'under' || targetMode === 'down') ? (baseSubY - 2) : (baseSubY - 1);
    const maxY = (targetMode === 'up') ? (baseSubY + stats.reachH + 1) : (baseSubY + stats.reachH);
    return totalSubY >= minY && totalSubY <= maxY;
  }

  function validateDigCell(absX, totalSubY, absZ, kindLabel, state) {
    const key = `${absX},${totalSubY},${absZ}`;
    if (state.seen.has(key) || !C.isInsideIslandAbs(absX, absZ)) return null;
    const tX = C.absToTile(absX), tZ = C.absToTile(absZ), yInfo = C.subYToLvSy(totalSubY);
    if (!C.hasSolidTerrainSubVoxel(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) return null;
    if (!C.isExposedToAir(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) return null;
    if (!DIG.runtime.waterProtectOff && C.isWaterProtectedCell(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) {
      state.hitWaterProtected = true;
      return null;
    }
    return {
      key, tx: tX.tile, tz: tZ.tile, lv: yInfo.lv,
      tsx: tX.sub, tsy: yInfo.sy, tsz: tZ.sub,
      absX, absZ, totalSubY, kind: kindLabel
    };
  }

  function findConnectedDigTargets(targetMode, dir, shape, maxCount, thought) {
    const stats = C.getSizeStats();
    const { absX: curAbsX, absZ: curAbsZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const state = { seen: new Set(), hitWaterProtected: false };
    const seedCandidates = [];

    const pushSeed = (ax, ay, az, label) => {
      const cell = validateDigCell(ax, ay, az, label, state);
      if (cell) seedCandidates.push(cell);
    };

    const { minOff, maxOff } = C.getFootprintBounds(stats.reachW);
    const underCells = [];
    for (let ox = minOff; ox <= maxOff; ox++) {
      for (let oz = minOff; oz <= maxOff; oz++) {
        underCells.push({ absX: curAbsX + ox, absZ: curAbsZ + oz, dist: Math.abs(ox) + Math.abs(oz) });
      }
    }
    underCells.sort((a, b) => a.dist - b.dist);

    if (targetMode === 'front' || targetMode === 'left' || targetMode === 'right') {
      const cells = targetMode === 'left'
        ? buildSideRowCells(curAbsX, curAbsZ, dir, stats, -1)
        : (targetMode === 'right'
            ? buildSideRowCells(curAbsX, curAbsZ, dir, stats, 1)
            : buildFrontRowCells(curAbsX, curAbsZ, dir, stats, thought));
      const lbl = targetMode === 'left' ? '左横の壁' : (targetMode === 'right' ? '右横の壁' : '正面の壁');
      for (let h = stats.reachH - 1; h >= 0; h--) {
        for (let i = 0; i < cells.length; i++) pushSeed(cells[i].absX, baseSubY + h, cells[i].absZ, lbl);
      }
    } else if (targetMode === 'front_down') {
      const cells = buildFrontRowCells(curAbsX, curAbsZ, dir, stats, thought);
      for (let i = 0; i < cells.length; i++) pushSeed(cells[i].absX, baseSubY - 1, cells[i].absZ, '目の前の地面');
    } else if (targetMode === 'under') {
      for (let i = 0; i < underCells.length; i++) pushSeed(underCells[i].absX, baseSubY - 1, underCells[i].absZ, '足元の床');
    } else if (targetMode === 'down') {
      const t = String(thought || '');
      const frontCells = buildFrontRowCells(curAbsX, curAbsZ, dir, stats, thought);
      const list = (t.includes('真下') || t.includes('足元'))
        ? [{ c: underCells, l: '足元の床' }, { c: frontCells, l: '目の前の地面' }]
        : [{ c: frontCells, l: '目の前の地面' }, { c: underCells, l: '足元の床' }];
      list.forEach(g => g.c.forEach(p => pushSeed(p.absX, baseSubY - 1, p.absZ, g.l)));
    } else if (targetMode === 'up') {
      for (let h = Math.max(1, stats.bodyHeight); h <= stats.reachH; h++) {
        for (let i = 0; i < underCells.length; i++) pushSeed(underCells[i].absX, baseSubY + h, underCells[i].absZ, '頭上の天井');
      }
    }

    if (!seedCandidates.length) return { targets: [], hitWaterProtected: state.hitWaterProtected };

    const dx = Math.sign((dir && dir.dx) || 0), dz = Math.sign((dir && dir.dz) || 0);
    const rx = -dz || 1, rz = dx || 0;
    const dirs6 = shape === 'tall'
      ? [[0, 1, 0], [0, -1, 0], [rx, 0, rz], [-rx, 0, -rz], [dx, 0, dz], [-dx, 0, -dz]]
      : (shape === 'wide'
          ? [[rx, 0, rz], [-rx, 0, -rz], [0, 1, 0], [0, -1, 0], [dx, 0, dz], [-dx, 0, -dz]]
          : [[rx, 0, rz], [-rx, 0, -rz], [0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]);

    const targets = [];
    const queue = [seedCandidates[0]];
    state.seen.add(seedCandidates[0].key);

    while (queue.length && targets.length < maxCount) {
      const cur = queue.shift();
      targets.push(cur);
      if (targets.length >= maxCount) break;

      for (let i = 0; i < dirs6.length; i++) {
        const nx = cur.absX + dirs6[i][0];
        const ny = cur.totalSubY + dirs6[i][1];
        const nz = cur.absZ + dirs6[i][2];
        if (nx === cur.absX && ny === cur.totalSubY && nz === cur.absZ) continue;
        if (!isWithinDigReach(nx, ny, nz, curAbsX, baseSubY, curAbsZ, stats, targetMode)) continue;
        const nextCell = validateDigCell(nx, ny, nz, cur.kind, state);
        if (nextCell) {
          state.seen.add(nextCell.key);
          queue.push(nextCell);
        }
      }
      if (!queue.length && targets.length < maxCount) {
        for (let s = 1; s < seedCandidates.length; s++) {
          if (!state.seen.has(seedCandidates[s].key)) {
            state.seen.add(seedCandidates[s].key);
            queue.push(seedCandidates[s]);
            break;
          }
        }
      }
    }

    return { targets, hitWaterProtected: state.hitWaterProtected };
  }

  function findDigTargetsInBodyRange(mode, dir, thought, maxCount = 1) {
    return findConnectedDigTargets(mode, dir, 'auto', maxCount, thought);
  }

  function describeRelativeDropPosition(ox, oz, heightDiff) {
    const basis = M.getFacingBasis();
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
    const areaId = C.getCurAreaId();
    const { absX: rAbsX, absZ: rAbsZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const dx = Math.sign((dir && dir.dx) || 0);
    const dz = Math.sign((dir && dir.dz) || 0);
    const basis = M.getFacingBasis();

    function canPlaceOnFloor(tx, tz, floorY, ignoreMaxOnFall = false) {
      if (!C.isInsideIslandAbs(tx, tz) || M.isCrateBlockingAtSubY(tx, floorY, tz, areaId)) return false;
      if (C.isInsideRobotFootprint(tx, tz, rAbsX, rAbsZ, stats.reachW) && Math.abs(floorY - baseSubY) <= stats.reachH) return false;
      const curStack = C.getLooseSoilAtFloor(tx, tz, floorY, areaId);
      if (curStack >= (ignoreMaxOnFall ? 10 : stats.maxStackHeight)) return false;
      const placeY = floorY + curStack;
      return !C.hasSolidTerrainAtAbsSubY(tx, placeY, tz) && !M.isCrateBlockingAtSubY(tx, placeY, tz, areaId);
    }

    if (!C.hasSolidTerrainAtAbsSubY(target.absX, target.totalSubY - 1, target.absZ)) {
      const fallFloorY = C.findFloorSubYBelow(target.absX, target.absZ, target.totalSubY - 1);
      const isDeep = (fallFloorY < baseSubY);
      if (canPlaceOnFloor(target.absX, target.absZ, fallFloorY, isDeep)) {
        return { absX: target.absX, absZ: target.absZ, floorSubY: fallFloorY, fellDown: isDeep, note: isDeep ? '下の空間の底へ落下した' : '真下の床へ落ちた' };
      }
    }

    if (dx !== 0 || dz !== 0) {
      const bx = target.absX + dx, bz = target.absZ + dz;
      if (C.isInsideIslandAbs(bx, bz) && !M.isCrateBlockingAtSubY(bx, target.totalSubY, bz, areaId) &&
          !C.hasSolidTerrainAtAbsSubY(bx, target.totalSubY, bz)) {
        const behindY = C.findFloorSubYBelow(bx, bz, target.totalSubY);
        const isDeep = (behindY < baseSubY);
        if (canPlaceOnFloor(bx, bz, behindY, isDeep)) {
          return { absX: bx, absZ: bz, floorSubY: behindY, fellDown: isDeep, note: isDeep ? '奥の空間から底まで落下した' : '奥の空き空間へ転がり落ちた' };
        }
      }
    }

    const { minOff, maxOff } = C.getFootprintBounds(stats.reachW);
    const minS = minOff - stats.reachW, maxS = maxOff + stats.reachW;
    const candidates = [];

    for (let ox = minS; ox <= maxS; ox++) {
      for (let oz = minS; oz <= maxS; oz++) {
        const tx = rAbsX + ox, tz = rAbsZ + oz;
        if (!C.isInsideIslandAbs(tx, tz) || C.isInsideRobotFootprint(tx, tz, rAbsX, rAbsZ, stats.reachW)) continue;
        if (tx === target.absX && tz === target.absZ) continue;

        let chosenFloorY = null;
        for (let h = 0; h <= stats.reachH; h++) {
          const yCheck = baseSubY + h;
          if (!C.hasSolidTerrainAtAbsSubY(tx, yCheck, tz) &&
              !M.isCrateBlockingAtSubY(tx, yCheck, tz, areaId) &&
              C.hasSolidTerrainAtAbsSubY(tx, yCheck - 1, tz)) {
            chosenFloorY = yCheck;
            break;
          }
        }
        if (chosenFloorY === null) continue;
        const stack = C.getLooseSoilAtFloor(tx, tz, chosenFloorY, areaId);
        if (stack >= stats.maxStackHeight) continue;
        if (C.hasSolidTerrainAtAbsSubY(tx, chosenFloorY + stack, tz) || M.isCrateBlockingAtSubY(tx, chosenFloorY + stack, tz, areaId)) continue;

        const dist = Math.max(Math.abs(ox), Math.abs(oz));
        const heightDiff = chosenFloorY - baseSubY;
        const rearPenalty = (ox * basis.fx + oz * basis.fz) < 0 ? 1.5 : 0;
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

  function runUnifiedDig(opts = {}) {
    const mode = String(opts.target || 'front').toLowerCase();
    const shape = String(opts.shape || 'auto').toLowerCase();
    const dir = opts.dir;
    const thought = opts.thought || '';

    if (mode !== 'up' && mode !== 'under' && M.isBehindCurrentFacing(dir)) {
      return M.runTurnAroundOnly(dir, mode === 'front_down' || mode === 'down' ? '地面掘削' : '壁掘削');
    }

    const hand = DIG.state.equip && DIG.state.equip.hand;
    let maxQuota = 1, toolLabel = '素手';
    if (hand && hand.count > 0) {
      if (hand.id === 'shovel' && hand.count === 1) {
        maxQuota = 5;
        toolLabel = 'スコップ1本';
      } else if (hand.id === 'shovel' && hand.count >= 2) {
        return {
          actionLabel: '🚫 スコップ2本持ちのため両手が塞がり掘れなかった',
          physicalResult: '手枠にスコップを2本持っていて両手が塞がっているため掘削できなかった（1本だけ持つか素手にする必要がある）',
          moved: false
        };
      } else {
        const m = CONST.ITEM_META[hand.id] || { name: hand.id };
        return {
          actionLabel: `🚫 手枠に${m.name}を持っているため掘れなかった`,
          physicalResult: `手枠に${m.name}(${hand.count}個)を持っていて手が塞がっているため掘削できなかった`,
          moved: false
        };
      }
    }

    const reqCount = (Number.isFinite(Number(opts.count)) && Number(opts.count) > 0)
      ? Math.max(1, Math.min(maxQuota, Math.floor(Number(opts.count))))
      : maxQuota;

    if (mode !== 'up' && mode !== 'under' && dir && Number.isFinite(dir.rot)) ROBOT.rotY = dir.rot;
    const dName = (dir && dir.name) ? dir.name.replace('(斜め)', '') : '正面';
    const stats = C.getSizeStats();
    const { targets, hitWaterProtected } = findConnectedDigTargets(mode, dir, shape, reqCount, thought);

    if (!targets.length) {
      if (hitWaterProtected) {
        return { actionLabel: '🛡️ 島の外周（水際の保護壁）は削れなかった', physicalResult: 'そこは島の外周（水際の保護壁）のため削れなかった', moved: false };
      }
      if (mode === 'front' && hasUnreachableUpperWallInFront(dir, stats)) {
        const rLbl = stats.reachH === 1 ? '高1' : `高1〜${stats.reachH}`;
        return {
          actionLabel: `⛏️ ${dName}の上部壁(高${stats.reachH + 1}以上)には背が届かず空振りした`,
          physicalResult: `${dName}方向の距離1は届く高さ(${rLbl})が既に空洞で、上部の壁(高${stats.reachH + 1}以上)には背が届かず空振りした`,
          moved: false
        };
      }
      if (mode === 'front' || mode === 'left' || mode === 'right') {
        const wallDist = findNearestWallDistInDir(dir, mode, stats);
        if (wallDist >= 2) {
          return {
            actionLabel: `⛏️ ${dName}(${mode})は距離1が空洞のため空振り(壁は距離${wallDist}先)`,
            physicalResult: `${dName}(${mode})の距離1はすでに空洞で空振りした（壁は距離${wallDist}先にあるため、まず${wallDist - 1}分割近づく必要がある）`,
            moved: false
          };
        }
      }
      return {
        actionLabel: `⛏️ ${dName}(${mode})の距離1に削れるブロックがなく空振りした`,
        physicalResult: `${dName}(${mode})の手の届く距離1に削れるブロックがなく空振りした`,
        moved: false
      };
    }

    const areaId = C.getCurAreaId();
    let dugCount = 0, stoppedByFull = false, lastDropNote = '', lastKind = targets[0].kind;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const dropPos = findDropSlotForDugSoil(target, dir, stats);
      if (!dropPos) { stoppedByFull = true; break; }

      const chipKey = `${target.tx},${target.tz},${target.lv}`;
      const tag = `${target.tsx},${target.tsy},${target.tsz}`;
      if (typeof CHIP_MAP !== 'undefined') {
        if (!CHIP_MAP[chipKey]) CHIP_MAP[chipKey] = {};
        CHIP_MAP[chipKey][tag] = true;
      }
      const stateKey = `${areaId}|${chipKey}`;
      if (!DIG.state.dugCells[stateKey]) DIG.state.dugCells[stateKey] = [];
      if (!DIG.state.dugCells[stateKey].includes(tag)) DIG.state.dugCells[stateKey].push(tag);

      C.settleFloatingLooseSoilsAtColumn(target.absX, target.absZ, areaId);
      C.addLooseSoilAtFloor(dropPos.absX, dropPos.absZ, dropPos.floorSubY, 1, areaId);
      lastDropNote = dropPos.note;
      lastKind = target.kind;
      dugCount++;
    }

    if (dugCount <= 0) {
      return {
        actionLabel: '🧱 周囲の土が満杯で掘れなかった（片付けか詰み時パンチ/キックが必要）',
        physicalResult: `${lastKind}を削ろうとしたが周囲の床が上限(${stats.maxStackHeight}段)まで満杯で置き場がないため掘れなかった`,
        moved: false
      };
    }

    let fallText = '';
    if (mode === 'under' || mode === 'down' || mode === 'front_down') {
      const { absX: rAbsX, absZ: rAbsZ } = C.getRobotAbsPos();
      const curBaseY = M.getRobotBaseSubY();
      const support = M.computeSupportedFloorUnderFootprint(rAbsX, rAbsZ, curBaseY, stats.reachW);
      if (support.fell) {
        const dropDist = curBaseY - support.landingSubY;
        ROBOT.pos.subY = support.landingSubY;
        ROBOT.pos.lv = C.floorSubYToRobotLv(support.landingSubY);
        fallText = `。足元の支えがなくなったため下の空間へ${dropDist}分割落下した`;
      }
    }

    life.stamina = Math.max(0, life.stamina - (dugCount > 1 ? 6 : 4));
    life.mental = Math.min(100, life.mental + 4);
    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    C.saveDigState();

    const dirPrefix = (mode === 'up' || mode === 'under' || lastKind === '足元の床') ? '' : `${dName}の`;
    const fullNote = stoppedByFull ? '（途中で周囲が満杯になり停止）' : '';
    return {
      actionLabel: `⛏️ ${toolLabel}で${dirPrefix}${lastKind}を${dugCount}分割削った${fullNote}`,
      physicalResult: `${toolLabel}で繋がり合う${dirPrefix}${lastKind}を${dugCount}分割削り、土は${lastDropNote}${fullNote}${fallText}`,
      moved: false
    };
  }

  function runSubDigByMode(mode, dir, thought) {
    return runUnifiedDig({ target: mode, dir, shape: 'auto', count: 0, thought });
  }

  function smashBlockForEscape(dir, verbLabel = 'パンチ') {
    const areaId = C.getCurAreaId();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const stats = C.getSizeStats();
    const cells = buildFrontRowCells(absX, absZ, dir, stats, '');
    const dName = (dir && dir.name) ? dir.name.replace('(斜め)', '') : '正面';

    for (let i = 0; i < cells.length; i++) {
      const stacks = C.getLooseSoilStacksInColumn(cells[i].absX, cells[i].absZ, areaId);
      const hit = stacks.find(st => st.count > 0 && st.floorSubY <= baseSubY + stats.reachH && st.floorSubY + st.count > baseSubY);
      if (hit) {
        C.addLooseSoilAtFloor(cells[i].absX, cells[i].absZ, hit.floorSubY, -1, areaId);
        C.saveDigState();
        return {
          smashed: true,
          actionLabel: `💥 詰み脱出！${dName}の散らばり土を${verbLabel}で1個粉砕(消失)した`,
          physicalResult: `完全詰み状態だったため、${dName}の散らばり土を${verbLabel}で1分割粉砕して消失させ脱出路を作った`
        };
      }
    }

    const { targets, hitWaterProtected } = findConnectedDigTargets('front', dir, 'auto', 1, '');
    if (targets.length) {
      const t = targets[0];
      const chipKey = `${t.tx},${t.tz},${t.lv}`;
      const tag = `${t.tsx},${t.tsy},${t.tsz}`;
      if (typeof CHIP_MAP !== 'undefined') {
        if (!CHIP_MAP[chipKey]) CHIP_MAP[chipKey] = {};
        CHIP_MAP[chipKey][tag] = true;
      }
      const stateKey = `${areaId}|${chipKey}`;
      if (!DIG.state.dugCells[stateKey]) DIG.state.dugCells[stateKey] = [];
      if (!DIG.state.dugCells[stateKey].includes(tag)) DIG.state.dugCells[stateKey].push(tag);
      C.settleFloatingLooseSoilsAtColumn(t.absX, t.absZ, areaId);
      C.saveDigState();
      return {
        smashed: true,
        actionLabel: `💥 詰み脱出！${dName}の壁を${verbLabel}で1分割粉砕(消失)した`,
        physicalResult: `完全詰み状態だったため、${dName}の壁1分割を${verbLabel}で粉砕・消失させて脱出路を作った`
      };
    }

    return { smashed: false, hitWaterProtected };
  }

  function runPlaceSoil(dir, opts = {}) {
    if (M.isBehindCurrentFacing(dir)) return M.runTurnAroundOnly(dir, '土の配置');

    const totalAvail = (DIG.state.headSoil || 0)
      + ((DIG.state.equip.hand && DIG.state.equip.hand.id === 'soil') ? DIG.state.equip.hand.count : 0)
      + (DIG.state.pocket.soil || 0);
    if (totalAvail <= 0) {
      return { actionLabel: '🟫 置く土が手元にも頭上にもなかった', physicalResult: 'ポケット・手枠・頭上のいずれにも土がなく、置けなかった', moved: false };
    }

    const reqCount = (Number.isFinite(Number(opts.count)) && Number(opts.count) > 0)
      ? Math.max(1, Math.min(totalAvail, Math.floor(Number(opts.count))))
      : 1;

    ROBOT.rotY = dir.rot;
    const dName = dir.name.replace('(斜め)', '');
    const areaId = C.getCurAreaId();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const stats = C.getSizeStats();
    const dx = Math.sign(dir.dx || 0), dz = Math.sign(dir.dz || 0);
    const frontEdge = C.getFrontEdgeOffset(dx, dz, stats.reachW);
    const tx = absX + frontEdge.ox, tz = absZ + frontEdge.oz;

    if (!C.isInsideIslandAbs(tx, tz) || M.isCrateBlockingAtSubY(tx, baseSubY, tz, areaId)) {
      return { actionLabel: `🟫 ${dName}には置けなかった`, physicalResult: `${dName}の目の前は島の端または圧縮木箱のため土を置けなかった`, moved: false };
    }
    const floorY = C.findFloorSubYBelow(tx, tz, baseSubY + stats.reachH + 1);
    if (floorY > baseSubY + stats.reachH) {
      return { actionLabel: `🟫 ${dName}は壁で塞がっており置けない`, physicalResult: `${dName}の目の前は固体ブロックで塞がっており土を置けなかった`, moved: false };
    }

    const isDeep = (floorY < baseSubY);
    let placed = 0, lastFrom = '';
    for (let i = 0; i < reqCount; i++) {
      const curStack = C.getLooseSoilAtFloor(tx, tz, floorY, areaId);
      if (!isDeep && curStack >= stats.maxStackHeight) break;
      if (C.hasSolidTerrainAtAbsSubY(tx, floorY + curStack, tz) || M.isCrateBlockingAtSubY(tx, floorY + curStack, tz, areaId)) break;

      if ((DIG.state.headSoil || 0) > 0) { DIG.state.headSoil -= 1; lastFrom = '頭上から'; }
      else if (DIG.state.equip.hand && DIG.state.equip.hand.id === 'soil' && DIG.state.equip.hand.count > 0) {
        DIG.state.equip.hand.count -= 1;
        if (DIG.state.equip.hand.count <= 0) DIG.state.equip.hand = null;
        lastFrom = '手枠から';
      } else if ((DIG.state.pocket.soil || 0) > 0) { DIG.state.pocket.soil -= 1; lastFrom = 'ポケットから'; }
      else break;

      C.addLooseSoilAtFloor(tx, tz, floorY, 1, areaId);
      placed++;
    }

    if (placed <= 0) {
      return { actionLabel: `🟫 上限(${stats.maxStackHeight}段)または障害物で置けなかった`, physicalResult: `${dName}の目の前は積み上限または壁・天井のため土を置けなかった`, moved: false };
    }

    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    C.saveDigState();
    const stackNow = C.getLooseSoilAtFloor(tx, tz, floorY, areaId);
    const dropNote = isDeep ? '下の空間の底へ落ちた' : `高さ${stackNow}/${stats.maxStackHeight}段になった`;
    return {
      actionLabel: `🟫 ${lastFrom}${dName}へ土を${placed}個置いた(${isDeep ? '底へ落下' : `積${stackNow}/${stats.maxStackHeight}段`})`,
      physicalResult: `${lastFrom}${dName}の目の前へ土を${placed}個そっと置き、${dropNote}`,
      moved: false
    };
  }

  DIG.dig = {
    buildFrontRowCells, buildSideRowCells, hasUnreachableUpperWallInFront,
    findNearestWallDistInDir, describeImmediateTouch,
    findConnectedDigTargets, findDigTargetsInBodyRange,
    describeRelativeDropPosition, findDropSlotForDugSoil,
    runUnifiedDig, runSubDigByMode, smashBlockForEscape, runPlaceSoil
  };

  if (window.DebugGuard) window.DebugGuard.markLoaded('dig_dig.js');
})();
