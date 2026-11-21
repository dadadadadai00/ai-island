// ============================================================================
// 【分割物理モジュール 4/7：dig_dig.js】
// ・体格範囲内での掘削（素手1個／スコップ1本最大5個／2本・土所持中は掘削不可）
// ・削った土の散らばり先判定・足元掘削時の落下連動・目の前への手置き(place_soil)
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

  function findDigTargetsInBodyRange(mode, dir, thought, maxCount = 1) {
    const stats = C.getSizeStats();
    const { absX: curAbsX, absZ: curAbsZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const targets = [];
    const seen = new Set();
    let hitWaterProtected = false;

    const tryPush = (absX, totalSubY, absZ, kindLabel) => {
      if (targets.length >= maxCount) return;
      const key = `${absX},${totalSubY},${absZ}`;
      if (seen.has(key) || !C.isInsideIslandAbs(absX, absZ)) return;
      const tX = C.absToTile(absX), tZ = C.absToTile(absZ), yInfo = C.subYToLvSy(totalSubY);
      if (!C.hasSolidTerrainSubVoxel(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) return;
      if (!C.isExposedToAir(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) return;
      if (C.isWaterProtectedCell(tX.tile, tZ.tile, yInfo.lv, tX.sub, yInfo.sy, tZ.sub)) {
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
      const { minOff, maxOff } = C.getFootprintBounds(stats.reachW);
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
      const { minOff, maxOff } = C.getFootprintBounds(stats.reachW);
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

  function runSubDigByMode(mode, dir, thought) {
    if (mode !== 'up' && M.isBehindCurrentFacing(dir)) {
      return M.runTurnAroundOnly(dir, mode === 'down' ? '地面掘削' : '壁掘削');
    }

    const hand = DIG.state.equip && DIG.state.equip.hand;
    let digQuota = 1, toolLabel = '素手';
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
        const m = CONST.ITEM_META[hand.id] || { name: hand.id };
        return {
          actionLabel: `🚫 手枠に${m.name}を持っているため掘れなかった`,
          physicalResult: `手枠に${m.name}(${hand.count}個)を持っていて手が塞がっているため掘削できなかった`,
          moved: false
        };
      }
    }

    if (mode !== 'up' && dir && Number.isFinite(dir.rot)) ROBOT.rotY = dir.rot;
    const dName = (dir && dir.name) ? dir.name.replace('(斜め)', '') : '正面';
    const stats = C.getSizeStats();
    const { targets, hitWaterProtected } = findDigTargetsInBodyRange(mode, dir, thought, digQuota);

    if (!targets.length) {
      if (hitWaterProtected) {
        return { actionLabel: '🛡️ 島の外周（水際の保護壁）は削れなかった', physicalResult: 'そこは島の外周（水際の保護壁）のため削れなかった', moved: false };
      }
      if (mode === 'front') {
        if (hasUnreachableUpperWallInFront(dir, stats)) {
          const rLbl = stats.reachH === 1 ? '高1' : `高1〜${stats.reachH}`;
          return {
            actionLabel: `⛏️ ${dName}の上部壁(高${stats.reachH + 1}以上)には背が届かず空振りした`,
            physicalResult: `${dName}方向の目の前距離1は自分の届く高さ(${rLbl})が既に空洞で、上部の壁(高${stats.reachH + 1}以上)には背が届かず空振りした`,
            moved: false
          };
        }
        return { actionLabel: `⛏️ ${dName}の正面壁を削ろうとしたが空振りした`, physicalResult: `${dName}方向の目の前距離1に削れる壁がなく空振りした`, moved: false };
      }
      if (mode === 'down') {
        return { actionLabel: `⛏️ ${dName}の地面を削ろうとしたが空振りした`, physicalResult: `${dName}方向の目の前および足元に削れる地面ブロックがなく空振りした`, moved: false };
      }
      return { actionLabel: '⛏️ 頭上の天井を削ろうとしたが空振りした', physicalResult: '頭上の届く高さに削れる天井ブロックがなく空振りした', moved: false };
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
        actionLabel: '🧱 周囲の土が満杯で掘れなかった（片付けが必要）',
        physicalResult: `${lastKind}を削ろうとしたが、周囲の床がすべて積み上限(${stats.maxStackHeight}段)まで埋まっており置き場がないため掘れなかった`,
        moved: false
      };
    }

    let fallText = '';
    if (mode === 'down') {
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

    const dirPrefix = (mode === 'up' || lastKind === '足元の床') ? '' : `${dName}の`;
    const fullNote = stoppedByFull ? '（途中で周囲が満杯になり停止）' : '';
    return {
      actionLabel: `⛏️ ${toolLabel}で${dirPrefix}${lastKind}を${dugCount}分割削った${fullNote}`,
      physicalResult: `${toolLabel}で体格範囲内の${dirPrefix}${lastKind}を${dugCount}分割削り、土は${lastDropNote}${fullNote}${fallText}`,
      moved: false
    };
  }

  function runPlaceSoil(dir) {
    if (M.isBehindCurrentFacing(dir)) return M.runTurnAroundOnly(dir, '土の配置');

    const hasHead   = (DIG.state.headSoil || 0) > 0;
    const hasHand   = DIG.state.equip.hand && DIG.state.equip.hand.id === 'soil' && DIG.state.equip.hand.count > 0;
    const hasPocket = (DIG.state.pocket.soil || 0) > 0;
    if (!hasHead && !hasHand && !hasPocket) {
      return { actionLabel: '🟫 置く土が手元にも頭上にもなかった', physicalResult: 'ポケット・手枠・頭上のいずれにも土がなく、置けなかった', moved: false };
    }

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
    const curStack = C.getLooseSoilAtFloor(tx, tz, floorY, areaId);
    const isDeep = (floorY < baseSubY);
    if (!isDeep && curStack >= stats.maxStackHeight) {
      return { actionLabel: `🟫 積み上げ上限(${stats.maxStackHeight}段)でこれ以上積めない`, physicalResult: `${dName}の目の前は既に${curStack}段積まれており上限(${stats.maxStackHeight}段)のため置けなかった`, moved: false };
    }
    if (C.hasSolidTerrainAtAbsSubY(tx, floorY + curStack, tz) || M.isCrateBlockingAtSubY(tx, floorY + curStack, tz, areaId)) {
      return { actionLabel: `🟫 ${dName}は壁・天井で塞がっており置けない`, physicalResult: `${dName}の目の前は壁・天井・圧縮木箱で塞がっており置けなかった`, moved: false };
    }

    let fromLabel = '';
    if (hasHead) {
      DIG.state.headSoil -= 1;
      fromLabel = '頭上から';
    } else if (hasHand) {
      DIG.state.equip.hand.count -= 1;
      if (DIG.state.equip.hand.count <= 0) DIG.state.equip.hand = null;
      fromLabel = '手枠から';
    } else {
      DIG.state.pocket.soil -= 1;
      fromLabel = 'ポケットから';
    }

    C.addLooseSoilAtFloor(tx, tz, floorY, 1, areaId);
    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    C.saveDigState();

    const stackNow = C.getLooseSoilAtFloor(tx, tz, floorY, areaId);
    const dropNote = isDeep ? '下の空間の底へ落ちた' : `高さ${stackNow}/${stats.maxStackHeight}段になった`;
    return {
      actionLabel: `🟫 ${fromLabel}${dName}へ土を1個置いた(${isDeep ? '底へ落下' : `積${stackNow}/${stats.maxStackHeight}段`})`,
      physicalResult: `${fromLabel}${dName}の目の前へ土を1個そっと置き、${dropNote}`,
      moved: false
    };
  }

  DIG.dig = {
    buildFrontRowCells, hasUnreachableUpperWallInFront, findDigTargetsInBodyRange,
    describeRelativeDropPosition, findDropSlotForDugSoil, runSubDigByMode, runPlaceSoil
  };

  if (window.DebugGuard) window.DebugGuard.markLoaded('dig_dig.js');
})();

