// ============================================================================
// 【分割物理モジュール 2/7：dig_move.js】
// ・1分割足元高さ同期・天井空き・木箱遮蔽判定・体/顔の向き管理
// ・歩数自由移動＆移動中操作・姿勢(立/しゃがみ/ジャンプ/休む/見る)・完全詰み判定
// ============================================================================
(function initDigMove() {
  const DIG = window.DIG;
  if (!DIG || !DIG.core) return;
  const C = DIG.core;

  DIG.runtime.faceDir = DIG.runtime.faceDir || 'front';

  function getFaceDir() { return DIG.runtime.faceDir || 'front'; }
  function setFaceDir(f) {
    const ok = ['front', 'up', 'down', 'left', 'right'];
    DIG.runtime.faceDir = ok.includes(f) ? f : 'front';
    return DIG.runtime.faceDir;
  }

  function getCrateBaseSubY(crate) {
    const orig = DIG.runtime.origGetSurfaceYAt;
    const yBase = orig ? orig(crate.x, crate.z, null, 5) : 0;
    return Math.round(yBase * 5);
  }

  function isCrateBlockingAtSubY(absX, totalSubY, absZ, areaId = C.getCurAreaId()) {
    return DIG.state.crates.some(c => {
      if (c.areaId !== areaId) return false;
      const cx = c.x * 5 + 2, cz = c.z * 5 + 2;
      if (Math.abs(absX - cx) > 2 || Math.abs(absZ - cz) > 2) return false;
      const cBaseY = getCrateBaseSubY(c);
      return totalSubY >= cBaseY && totalSubY < cBaseY + 5;
    });
  }

  function getCeilingClearanceSubAt(centerAbsX, centerAbsZ, footSubY, reachW) {
    const { minOff, maxOff } = C.getFootprintBounds(reachW);
    let minClear = 20;
    for (let ox = minOff; ox <= maxOff; ox++) {
      for (let oz = minOff; oz <= maxOff; oz++) {
        const cx = centerAbsX + ox, cz = centerAbsZ + oz;
        if (!C.isInsideIslandAbs(cx, cz)) return 0;
        let clearHere = 0;
        for (let h = 0; h < 20; h++) {
          if (C.hasSolidTerrainAtAbsSubY(cx, footSubY + h, cz)) break;
          clearHere++;
        }
        if (clearHere < minClear) minClear = clearHere;
      }
    }
    return minClear;
  }

  function computeExactFootSubYAt(centerAbsX, centerAbsZ, hintSubY, reachW) {
    const areaId = C.getCurAreaId();
    const { minOff, maxOff } = C.getFootprintBounds(reachW);
    let bestSupport = C.getMinSubY();
    for (let ox = minOff; ox <= maxOff; ox++) {
      for (let oz = minOff; oz <= maxOff; oz++) {
        const cx = centerAbsX + ox, cz = centerAbsZ + oz;
        if (!C.isInsideIslandAbs(cx, cz)) continue;
        let airY = hintSubY, foundAir = false;
        for (let up = 0; up <= 5; up++) {
          const testY = hintSubY + up;
          if (!C.hasSolidTerrainAtAbsSubY(cx, testY, cz) && !C.hasLooseSoilAtSubY(cx, testY, cz, areaId)) {
            airY = testY; foundAir = true; break;
          }
        }
        if (!foundAir) {
          bestSupport = Math.max(bestSupport, C.getTerrainColumnTopSubY(cx, cz));
          continue;
        }
        const solidFloor = C.findFloorSubYBelow(cx, cz, airY);
        const looseCnt = C.getLooseSoilAtFloor(cx, cz, solidFloor, areaId);
        const topSupport = Math.min(airY, solidFloor + looseCnt);
        if (topSupport > bestSupport) bestSupport = topSupport;
      }
    }
    return bestSupport;
  }

  function getRobotBaseSubY(gx = ROBOT.pos.x, gz = ROBOT.pos.z, lv = ROBOT.pos.lv) {
    const stats = C.getSizeStats();
    const orig = DIG.runtime.origGetSurfaceYAt;
    const isCurrentTile = (Math.round(gx) === Math.round(ROBOT.pos.x) && Math.round(gz) === Math.round(ROBOT.pos.z));
    if (isCurrentTile) {
      const { absX, absZ } = C.getRobotAbsPos();
      let hintSubY;
      if (Number.isFinite(ROBOT.pos.subY) && C.floorSubYToRobotLv(ROBOT.pos.subY) === (Number.isFinite(lv) ? lv : ROBOT.pos.lv)) {
        hintSubY = Math.round(ROBOT.pos.subY);
      } else if (orig) {
        hintSubY = Math.round(orig(Math.round(gx), Math.round(gz), lv, stats.reachW) * 5);
      } else {
        hintSubY = (lv || 0) * 5;
      }
      const exactY = computeExactFootSubYAt(absX, absZ, hintSubY, stats.reachW);
      ROBOT.pos.subY = exactY;
      return exactY;
    }
    return orig ? Math.round(orig(Math.round(gx), Math.round(gz), lv, stats.reachW) * 5) : (lv || 0) * 5;
  }

  function getFacingBasis() {
    const rot = ROBOT.rotY || 0;
    const vx = Math.sin(rot), vz = Math.cos(rot);
    const cardinals = (typeof ALL_DIRS !== 'undefined' ? ALL_DIRS : []).filter(d => Math.abs(d.dx) + Math.abs(d.dz) === 1);
    let best = cardinals[0] || { dx: 0, dz: 1, name: '南' }, bestDot = -99;
    cardinals.forEach(d => {
      const dot = d.dx * vx + d.dz * vz;
      if (dot > bestDot) { bestDot = dot; best = d; }
    });
    const fx = best.dx, fz = best.dz, rx = -fz, rz = fx;
    const findName = (dx, dz) => {
      const hit = cardinals.find(d => d.dx === dx && d.dz === dz);
      return hit ? hit.name.replace('(斜め)', '') : '';
    };
    const actualFacingName = (typeof getDirNameFromRot === 'function')
      ? getDirNameFromRot(rot).replace('(斜め)', '') : best.name.replace('(斜め)', '');
    return {
      fx, fz, rx, rz,
      frontName: best.name.replace('(斜め)', ''),
      rightName: findName(rx, rz),
      leftName: findName(-rx, -rz),
      actualFacingName
    };
  }

  function isBehindCurrentFacing(dir) {
    if (!dir) return false;
    const rot = ROBOT.rotY || 0;
    const cx = Math.sin(rot), cz = Math.cos(rot);
    const len = Math.hypot(dir.dx || 0, dir.dz || 0) || 1;
    return (cx * ((dir.dx || 0) / len) + cz * ((dir.dz || 0) / len)) < -0.38;
  }

  function runTurnAroundOnly(dir, intendedVerb) {
    ROBOT.rotY = dir.rot;
    setFaceDir('front');
    const dName = dir.name.replace('(斜め)', '');
    return {
      actionLabel: `🔄 背後(${dName})を振り返った（1ターン消費）`,
      physicalResult: `死角の背後(${dName})へ${intendedVerb}しようとしたため、まず${dName}の方へ振り返って向き直った`,
      moved: false
    };
  }

  function runTurn(dir, face = '') {
    const faceMap = { front: '正面', up: '上向き', down: '下向き', left: '左向き', right: '右向き' };
    if (dir && Number.isFinite(dir.rot)) ROBOT.rotY = dir.rot;
    const dName = (dir && dir.name) ? dir.name.replace('(斜め)', '') : getFacingBasis().actualFacingName;
    const fKey = setFaceDir(face || 'front');
    const fLabel = faceMap[fKey] || '正面';
    return {
      actionLabel: `🔄 体を${dName}・顔を${fLabel}へ向けた`,
      physicalResult: `移動せず体の向きを${dName}、顔の向きを${fLabel}に変えた`,
      moved: false
    };
  }

  function runLook(dir, face = 'front') { return runTurn(dir, face); }

  function computeSupportedFloorUnderFootprint(centerAbsX, centerAbsZ, curBaseSubY, reachW) {
    const areaId = C.getCurAreaId();
    const { minOff, maxOff } = C.getFootprintBounds(reachW);
    let highestSupportY = C.getMinSubY(), hasImmediateSupport = false;
    for (let ox = minOff; ox <= maxOff; ox++) {
      for (let oz = minOff; oz <= maxOff; oz++) {
        const cx = centerAbsX + ox, cz = centerAbsZ + oz;
        if (C.hasSolidTerrainAtAbsSubY(cx, curBaseSubY - 1, cz) || C.hasLooseSoilAtSubY(cx, curBaseSubY - 1, cz, areaId)) {
          hasImmediateSupport = true;
          highestSupportY = Math.max(highestSupportY, curBaseSubY);
        } else {
          const floorY = C.findFloorSubYBelow(cx, cz, curBaseSubY);
          const loose = C.getLooseSoilAtFloor(cx, cz, floorY, areaId);
          highestSupportY = Math.max(highestSupportY, floorY + loose);
        }
      }
    }
    return { fell: !hasImmediateSupport && highestSupportY < curBaseSubY, landingSubY: hasImmediateSupport ? curBaseSubY : highestSupportY };
  }

  function evaluateSubStepTarget(nextAbsX, nextAbsZ, curBaseSubY, curPosture, stats, extraClimb = 0) {
    const areaId = C.getCurAreaId();
    const { minOff, maxOff } = C.getFootprintBounds(stats.reachW);
    const maxClimbUp = ((curPosture === 'crawl') ? 1 : stats.climbMax) + extraClimb;
    let highestFloorY = C.getMinSubY();

    for (let ox = minOff; ox <= maxOff; ox++) {
      for (let oz = minOff; oz <= maxOff; oz++) {
        const cx = nextAbsX + ox, cz = nextAbsZ + oz;
        if (!C.isInsideIslandAbs(cx, cz)) return { ok: false, reason: '島の端' };
        if (isCrateBlockingAtSubY(cx, curBaseSubY, cz, areaId)) return { ok: false, reason: '圧縮木箱' };

        let openY = null, hitLooseSoil = false, looseHeightHere = 0;
        for (let up = 0; up <= maxClimbUp; up++) {
          const yTest = curBaseSubY + up;
          const solid = C.hasSolidTerrainAtAbsSubY(cx, yTest, cz);
          const loose = C.hasLooseSoilAtSubY(cx, yTest, cz, areaId);
          const crate = isCrateBlockingAtSubY(cx, yTest, cz, areaId);
          if (!solid && !loose && !crate) { openY = yTest; break; }
          if (crate) return { ok: false, reason: '圧縮木箱' };
          if (loose && !solid) { hitLooseSoil = true; looseHeightHere = Math.max(looseHeightHere, up + 1); }
        }
        if (openY === null) {
          if (hitLooseSoil) {
            const fl = C.findFloorSubYBelow(cx, cz, curBaseSubY + 1);
            const cnt = C.getLooseSoilAtFloor(cx, cz, fl, areaId) || looseHeightHere;
            return { ok: false, reason: `高さ${cnt}段の散らばった土` };
          }
          return { ok: false, reason: curPosture === 'crawl' ? 'しゃがみでは登れない段差（壁）' : '高すぎる段差（壁）' };
        }
        let cellFloorY = openY;
        if (openY === curBaseSubY) {
          const solidBelow = C.findFloorSubYBelow(cx, cz, curBaseSubY);
          const looseBelow = C.getLooseSoilAtFloor(cx, cz, solidBelow, areaId);
          cellFloorY = Math.min(curBaseSubY, solidBelow + looseBelow);
        }
        if (cellFloorY > highestFloorY) highestFloorY = cellFloorY;
      }
    }

    const diffSub = highestFloorY - curBaseSubY;
    if (diffSub > maxClimbUp) {
      return { ok: false, reason: curPosture === 'crawl' ? 'しゃがみでは登れない段差（壁）' : '高すぎる段差（壁）' };
    }

    const clearance = getCeilingClearanceSubAt(nextAbsX, nextAbsZ, highestFloorY, stats.reachW);
    let nextPosture = curPosture;
    if (nextPosture === 'stand' && clearance < stats.standH + stats.headLayers) {
      if (clearance >= stats.crawlH + stats.headLayers) nextPosture = 'crawl';
      else {
        return {
          ok: false,
          reason: (stats.headLayers > 0 && clearance >= stats.crawlH)
            ? `頭上の土(+${stats.headLayers}段)が天井(空き${clearance}段)に当たる`
            : `低い天井(空き${clearance}段)`
        };
      }
    } else if (nextPosture === 'crawl' && clearance < stats.crawlH + stats.headLayers) {
      return { ok: false, reason: `低い天井(空き${clearance}段)` };
    }

    let stepKind = 'flat';
    if (diffSub > 0) stepKind = (diffSub <= stats.stairMax) ? 'stairs_up' : 'scramble_climb';
    else if (diffSub < 0) {
      const drop = -diffSub;
      if (drop <= stats.stairMax) stepKind = 'stairs_down';
      else if (drop <= stats.climbMax) stepKind = 'safe_landing';
      else stepKind = 'high_drop';
    }
    return { ok: true, destFloorSubY: highestFloorY, nextPosture, diffSub, stepKind };
  }

  function isCompletelyTrapped() {
    const stats = C.getSizeStats();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();
    const curPosture = ROBOT.posture === 'crawl' ? 'crawl' : 'stand';
    const dirs = [
      [0, -1], [1, 0], [0, 1], [-1, 0],
      [1, -1], [1, 1], [-1, 1], [-1, -1]
    ];
    for (let i = 0; i < dirs.length; i++) {
      const ev = evaluateSubStepTarget(absX + dirs[i][0], absZ + dirs[i][1], baseSubY, curPosture, stats, 0);
      if (ev.ok) return false;
    }
    return true;
  }

  function runPosture(sub, dir, face) {
    const mode = String(sub || 'rest').toLowerCase();
    const stats = C.getSizeStats();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = getRobotBaseSubY();

    if (mode === 'look') return runTurn(dir, face || 'front');
    if (mode === 'crouch' || mode === 'crawl') {
      ROBOT.posture = 'crawl';
      return { actionLabel: '🧎 その場でしゃがんだ', physicalResult: '姿勢をしゃがみ(低姿勢)へ切り替えた', moved: false };
    }
    if (mode === 'stand') {
      const clear = getCeilingClearanceSubAt(absX, absZ, baseSubY, stats.reachW);
      if (clear < stats.standH + stats.headLayers) {
        return {
          actionLabel: `🚫 天井が低く立ち上がれない(空き${clear}段)`,
          physicalResult: `頭上の天井空き(${clear}段)が足りず立ち上がれなかった`,
          moved: false
        };
      }
      ROBOT.posture = 'stand';
      return { actionLabel: '🧍 立ち上がった', physicalResult: '姿勢を立位へ戻した', moved: false };
    }
    if (mode === 'jump') {
      DIG.runtime.lastMoveVisualKind = 'jump';
      if (dir && Number.isFinite(dir.rot)) ROBOT.rotY = dir.rot;
      setFaceDir('front');
      const dx = Math.sign((dir && dir.dx) || 0), dz = Math.sign((dir && dir.dz) || 0);
      const dName = (dir && dir.name) ? dir.name.replace('(斜め)', '') : '正面';
      const clear = getCeilingClearanceSubAt(absX, absZ, baseSubY, stats.reachW);
      if (clear <= stats.bodyHeight) {
        return { actionLabel: '🚫 天井がつかえてジャンプできなかった', physicalResult: '頭上に余裕がなくジャンプできなかった', moved: false };
      }
      life.stamina = Math.max(0, life.stamina - 5);
      if (dx !== 0 || dz !== 0) {
        const ev = evaluateSubStepTarget(absX + dx, absZ + dz, baseSubY, 'stand', stats, 1);
        if (ev.ok) {
          const tX = C.absToTile(absX + dx), tZ = C.absToTile(absZ + dz);
          ROBOT.pos.x = tX.tile; ROBOT.pos.z = tZ.tile; ROBOT.pos.sx = tX.sub; ROBOT.pos.sz = tZ.sub;
          ROBOT.pos.subY = ev.destFloorSubY; ROBOT.pos.lv = C.floorSubYToRobotLv(ev.destFloorSubY);
          ROBOT.posture = ev.nextPosture;
          return {
            actionLabel: `🦘 ${dName}へジャンプした(${ev.diffSub > 0 ? `↑${ev.diffSub}段` : '1分割'})`,
            physicalResult: `${dName}方向へ1分割ジャンプして着地した`,
            moved: true
          };
        }
      }
      return { actionLabel: '🦘 その場でジャンプした', physicalResult: 'その場で真上へジャンプして着地した', moved: false };
    }

    // default: rest
    life.stamina = Math.min(100, life.stamina + 30);
    life.energy = Math.max(0, life.energy - 3);
    ROBOT.params.eco = Math.min(100, (ROBOT.params.eco || 40) + 2);
    return { actionLabel: '💤 その場で休んだ', physicalResult: 'その場で休み、体力が回復した', moved: false };
  }

  function runSubMove(dir, opts = {}) {
    DIG.runtime.lastMoveVisualKind = null;
    if (isBehindCurrentFacing(dir)) return runTurnAroundOnly(dir, '移動');

    const stats = C.getSizeStats();
    const reqSteps = (Number.isFinite(Number(opts.count)) && Number(opts.count) > 0)
      ? Math.max(1, Math.min(stats.moveStep, Math.floor(Number(opts.count))))
      : stats.moveStep;
    const subAction = String(opts.sub || '').toLowerCase();

    const dx = Math.sign(dir.dx || 0), dz = Math.sign(dir.dz || 0);
    const dName = dir.name.replace('(斜め)', '');
    ROBOT.rotY = dir.rot;
    setFaceDir('front');

    let curX = Math.round(ROBOT.pos.x || 0), curZ = Math.round(ROBOT.pos.z || 0);
    let curSx = Number.isFinite(ROBOT.pos.sx) ? Math.max(0, Math.min(4, Math.round(ROBOT.pos.sx))) : 2;
    let curSz = Number.isFinite(ROBOT.pos.sz) ? Math.max(0, Math.min(4, Math.round(ROBOT.pos.sz))) : 2;
    let curBaseSubY = getRobotBaseSubY(curX, curZ, ROBOT.pos.lv);
    let curLv = C.floorSubYToRobotLv(curBaseSubY);
    let curPosture = ROBOT.posture === 'crawl' ? 'crawl' : 'stand';

    let movedSteps = 0, totalClimbSub = 0, totalDropSub = 0;
    let didScramble = false, didStairsUp = false, didSafeLanding = false, didHighDrop = false;
    let stopReason = '';

    for (let s = 0; s < reqSteps; s++) {
      const curAbsX = curX * 5 + curSx, curAbsZ = curZ * 5 + curSz;
      const nextAbsX = curAbsX + dx, nextAbsZ = curAbsZ + dz;
      if (!C.isInsideIslandAbs(nextAbsX, nextAbsZ)) { stopReason = '島の端'; break; }

      if (dx !== 0 && dz !== 0) {
        const sA = evaluateSubStepTarget(curAbsX + dx, curAbsZ, curBaseSubY, curPosture, stats);
        const sB = evaluateSubStepTarget(curAbsX, curAbsZ + dz, curBaseSubY, curPosture, stats);
        if (!sA.ok && !sB.ok) { stopReason = '斜めの角の壁'; break; }
      }
      const ev = evaluateSubStepTarget(nextAbsX, nextAbsZ, curBaseSubY, curPosture, stats);
      if (!ev.ok) { stopReason = ev.reason; break; }

      const tX = C.absToTile(nextAbsX), tZ = C.absToTile(nextAbsZ);
      if (ev.diffSub > 0) {
        totalClimbSub += ev.diffSub;
        if (ev.stepKind === 'scramble_climb') didScramble = true; else didStairsUp = true;
      } else if (ev.diffSub < 0) {
        totalDropSub += (-ev.diffSub);
        if (ev.stepKind === 'high_drop') didHighDrop = true; else if (ev.stepKind === 'safe_landing') didSafeLanding = true;
      }
      curX = tX.tile; curZ = tZ.tile; curSx = tX.sub; curSz = tZ.sub;
      curBaseSubY = ev.destFloorSubY; curLv = C.floorSubYToRobotLv(curBaseSubY);
      curPosture = ev.nextPosture;
      movedSteps++;
      if (ev.stepKind === 'high_drop' || ev.stepKind === 'scramble_climb') break;
    }

    let subNote = '';
    if (movedSteps > 0) {
      ROBOT.pos.x = curX; ROBOT.pos.z = curZ; ROBOT.pos.sx = curSx; ROBOT.pos.sz = curSz;
      ROBOT.pos.subY = curBaseSubY; ROBOT.pos.lv = curLv; ROBOT.posture = curPosture;
      life.energy = Math.max(0, life.energy - 3);
      life.stamina = Math.max(0, life.stamina - (didScramble ? 6 : 4));
      life.mental = Math.min(100, life.mental + 5);
      ROBOT.params.curiosity = Math.min(100, (ROBOT.params.curiosity || 60) + 2);

      if (didScramble) DIG.runtime.lastMoveVisualKind = 'scramble_climb';
      else if (didHighDrop) DIG.runtime.lastMoveVisualKind = 'high_drop';
      else if (didSafeLanding) DIG.runtime.lastMoveVisualKind = 'safe_landing';
      else if (didStairsUp) DIG.runtime.lastMoveVisualKind = 'stairs_up';

      // 移動しながら操作（移動拾い・移動置き・移動投げ）
      if (subAction === 'pickup' && DIG.items && DIG.items.runPickup) {
        const r = DIG.items.runPickup(opts.item || '', opts.itemCount || 0);
        if (r && r.physicalResult) subNote = `＋移動拾い(${r.physicalResult})`;
      } else if (subAction === 'place' && DIG.dig && DIG.dig.runPlaceSoil) {
        const r = DIG.dig.runPlaceSoil(dir, { count: 1, item: opts.item || 'soil' });
        if (r && r.physicalResult) subNote = `＋移動置き(${r.physicalResult})`;
      } else if (subAction === 'throw' && DIG.throw && DIG.throw.runThrowHand) {
        const r = DIG.throw.runThrowHand(dir, { count: 0 });
        if (r && r.physicalResult) subNote = `＋移動投げ(${r.physicalResult})`;
      }

      const notes = [];
      if (didScramble) notes.push(`段差${totalClimbSub}分割をよじ登った`);
      else if (totalClimbSub > 0) notes.push(`階段${totalClimbSub}分割を上がった`);
      if (didHighDrop) notes.push(`足元が空いていたため下の空間へ${totalDropSub}分割落下した`);
      else if (totalDropSub > 0) notes.push(`${totalDropSub}分割下へ降りた`);
      if (curPosture === 'crawl') notes.push('低い姿勢(しゃがみ)になった');

      const extraText = notes.length ? `（${notes.join('・')}）` : '';
      const phys = (stopReason
        ? `${dName}へ${movedSteps}分割進んだところで「${stopReason}」に当たり停止した${extraText}`
        : `${dName}へ${movedSteps}分割進んだ${extraText}`) + subNote;
      const badge = didScramble ? `(🧗↑${totalClimbSub})` : (totalClimbSub > 0 ? `(🪜↑${totalClimbSub})` : (totalDropSub > 0 ? `(↓${totalDropSub})` : ''));
      const subTag = subNote ? `[+${subAction}]` : '';
      return {
        actionLabel: `🐾 ${dName}へ${movedSteps}分割移動${badge}${subTag}${stopReason ? `(${stopReason})` : ''}`,
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

  DIG.move = {
    getFaceDir, setFaceDir,
    getCrateBaseSubY, isCrateBlockingAtSubY, getCeilingClearanceSubAt,
    computeExactFootSubYAt, getRobotBaseSubY, getFacingBasis, isBehindCurrentFacing,
    runTurnAroundOnly, runTurn, runLook, runPosture, isCompletelyTrapped,
    computeSupportedFloorUnderFootprint, evaluateSubStepTarget, runSubMove
  };

  if (window.DebugGuard) window.DebugGuard.markLoaded('dig_move.js');
})();
