// ============================================================================
// 【分割物理モジュール 6/7：dig_throw.js】
// ・手枠装備分の放物線一括投擲（頭上ピラミッド保持時は不可）
// ・道具(スコップ)：最大 高さ+2 でランダム飛距離・通り抜け可
// ・土：最大 高さ+1 でランダム飛距離＋転がり・階段斜面ではキャラ側へ転がり落ち
// ============================================================================
(function initDigThrow() {
  const DIG = window.DIG;
  if (!DIG || !DIG.core || !DIG.move) return;
  const C = DIG.core;
  const M = DIG.move;

  function findSafeSoilLandingNearRobot(rAbsX, rAbsZ, baseSubY, dx, dz, stats, areaId) {
    const frontEdge = C.getFrontEdgeOffset(dx, dz, stats.reachW);
    const rx = -dz, rz = dx;
    const candidates = [
      { x: rAbsX + frontEdge.ox, z: rAbsZ + frontEdge.oz, label: '自分の1マス手前' },
      { x: rAbsX + rx, z: rAbsZ + rz, label: '足元の横' },
      { x: rAbsX - rx, z: rAbsZ - rz, label: '足元の横' },
      { x: rAbsX + frontEdge.ox + rx, z: rAbsZ + frontEdge.oz + rz, label: '手前の横' },
      { x: rAbsX + frontEdge.ox - rx, z: rAbsZ + frontEdge.oz - rz, label: '手前の横' }
    ];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (!C.isInsideIslandAbs(c.x, c.z)) continue;
      if (C.isInsideRobotFootprint(c.x, c.z, rAbsX, rAbsZ, stats.reachW)) continue;
      const fl = C.findFloorSubYBelow(c.x, c.z, baseSubY + 1);
      const st = C.getLooseSoilAtFloor(c.x, c.z, fl, areaId);
      if (M.isCrateBlockingAtSubY(c.x, fl + st, c.z, areaId)) continue;
      if (C.hasSolidTerrainAtAbsSubY(c.x, fl + st, c.z)) continue;
      if (fl >= baseSubY && st >= stats.maxStackHeight) continue;
      return { absX: c.x, absZ: c.z, floorSubY: fl, label: c.label };
    }
    return null;
  }

  function simulateThrowSingleSoil(rAbsX, rAbsZ, baseSubY, dx, dz, lateralJitter, stats, areaId) {
    const targetDist = 1 + Math.floor(Math.random() * stats.throwSoilMax);
    const rx = -dz, rz = dx;
    const frontEdge = C.getFrontEdgeOffset(dx, dz, stats.reachW);
    const startX = rAbsX + frontEdge.ox;
    const startZ = rAbsZ + frontEdge.oz;

    let lastValid = null;
    let rolledBackSlope = false;

    for (let step = 0; step < targetDist; step++) {
      const lat = (step >= 1) ? lateralJitter : 0;
      const cx = startX + dx * step + rx * lat;
      const cz = startZ + dz * step + rz * lat;
      if (!C.isInsideIslandAbs(cx, cz)) break;
      if (M.isCrateBlockingAtSubY(cx, baseSubY, cz, areaId)) break;

      // 放物線頂点：縦1倍（baseSubY + reachH）までの障害物は越えられる
      const arcCheckY = baseSubY + stats.reachH;
      if (C.hasSolidTerrainAtAbsSubY(cx, arcCheckY, cz) || M.isCrateBlockingAtSubY(cx, arcCheckY, cz, areaId)) {
        if (C.hasSolidTerrainAtAbsSubY(cx, baseSubY, cz)) rolledBackSlope = true;
        break;
      }

      const floorBelow = C.findFloorSubYBelow(cx, cz, arcCheckY + 1);
      const looseHere = C.getLooseSoilAtFloor(cx, cz, floorBelow, areaId);

      // 階段のような上り斜面に向かった場合はキャラ側へ転がり落ちる
      if (floorBelow > baseSubY && C.hasSolidTerrainAtAbsSubY(cx, floorBelow - 1, cz)) {
        const nx = cx + dx, nz = cz + dz;
        const nextHigher = C.isInsideIslandAbs(nx, nz) && C.hasSolidTerrainAtAbsSubY(nx, floorBelow, nz);
        if (nextHigher || step === targetDist - 1) {
          rolledBackSlope = true;
          break;
        }
      }

      // 転がる先に障害物があれば手前で停止
      if (floorBelow >= baseSubY && looseHere >= stats.maxStackHeight) break;
      if (C.hasSolidTerrainAtAbsSubY(cx, floorBelow + looseHere, cz)) break;

      lastValid = { absX: cx, absZ: cz, floorSubY: floorBelow, dist: step + 1 };
    }

    if (rolledBackSlope) {
      const backSlot = findSafeSoilLandingNearRobot(rAbsX, rAbsZ, baseSubY, dx, dz, stats, areaId);
      if (backSlot) {
        C.addLooseSoilAtFloor(backSlot.absX, backSlot.absZ, backSlot.floorSubY, 1, areaId);
        return { ok: true, rolledBack: true, note: `斜面から転がり落ちて${backSlot.label}で止まった` };
      }
    }
    if (lastValid) {
      C.addLooseSoilAtFloor(lastValid.absX, lastValid.absZ, lastValid.floorSubY, 1, areaId);
      return { ok: true, rolledBack: false, note: `${lastValid.dist}分割先へ放物線を描いて転がり止まった` };
    }
    const fallback = findSafeSoilLandingNearRobot(rAbsX, rAbsZ, baseSubY, dx, dz, stats, areaId);
    if (fallback) {
      C.addLooseSoilAtFloor(fallback.absX, fallback.absZ, fallback.floorSubY, 1, areaId);
      return { ok: true, rolledBack: false, note: `障害物に当たり${fallback.label}へ落ちた` };
    }
    return { ok: false, note: '着地先が満杯だった' };
  }

  function simulateThrowSingleShovel(rAbsX, rAbsZ, baseSubY, dx, dz, lateralJitter, stats, areaId) {
    const targetDist = 1 + Math.floor(Math.random() * stats.throwToolMax);
    const rx = -dz, rz = dx;
    const frontEdge = C.getFrontEdgeOffset(dx, dz, stats.reachW);
    const startX = rAbsX + frontEdge.ox;
    const startZ = rAbsZ + frontEdge.oz;

    let landX = rAbsX, landZ = rAbsZ;
    let landY = C.findFloorSubYBelow(rAbsX, rAbsZ, baseSubY + 1);
    let landedDist = 0;

    for (let step = 0; step < targetDist; step++) {
      const lat = (step >= 1) ? lateralJitter : 0;
      const cx = startX + dx * step + rx * lat;
      const cz = startZ + dz * step + rz * lat;
      if (!C.isInsideIslandAbs(cx, cz)) break;

      const arcY = baseSubY + stats.reachH;
      if (M.isCrateBlockingAtSubY(cx, arcY, cz, areaId) || C.hasSolidTerrainAtAbsSubY(cx, arcY, cz)) break;
      const fl = C.findFloorSubYBelow(cx, cz, arcY + 1);
      if (M.isCrateBlockingAtSubY(cx, fl, cz, areaId)) break;

      landX = cx; landZ = cz; landY = fl; landedDist = step + 1;
    }

    C.addDroppedTool('shovel', landX, landZ, landY, 1, areaId);
    return { landedDist, landX, landZ, landY };
  }

  function runThrowHand(dir) {
    if (M.isBehindCurrentFacing(dir)) return M.runTurnAroundOnly(dir, '投擲');

    if ((DIG.state.headSoil || 0) > 0) {
      return {
        actionLabel: '🚫 頭上にピラミッド土を抱えているため投げられなかった',
        physicalResult: `頭上に土(${DIG.state.headSoil}個)を抱えているため投げられなかった（先に圧縮木箱へしまうか地面へ下ろす必要がある）`,
        moved: false
      };
    }

    const hand = DIG.state.equip && DIG.state.equip.hand;
    if (!hand || !hand.count) {
      return {
        actionLabel: '🖐️ 手枠に投げるアイテムがなかった',
        physicalResult: '手枠が空のため何も投げられなかった（先にポケットから手枠へ装備する必要がある）',
        moved: false
      };
    }

    ROBOT.rotY = dir.rot;
    const dName = dir.name.replace('(斜め)', '');
    const areaId = C.getCurAreaId();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const stats = C.getSizeStats();
    const dx = Math.sign(dir.dx || 0), dz = Math.sign(dir.dz || 0);
    const totalCount = hand.count;

    if (hand.id === 'shovel') {
      const dists = [];
      for (let i = 0; i < totalCount; i++) {
        const jitter = (totalCount > 1) ? (Math.floor(Math.random() * 3) - 1) : 0;
        dists.push(simulateThrowSingleShovel(absX, absZ, baseSubY, dx, dz, jitter, stats, areaId).landedDist);
      }
      DIG.state.equip.hand = null;
      life.stamina = Math.max(0, life.stamina - 4);
      C.saveDigState();
      return {
        actionLabel: `🪏 ${dName}へスコップを${totalCount}本投げた（手枠空）`,
        physicalResult: `手枠のスコップ${totalCount}本を${dName}へ放物線を描いて一気に投げた（飛距離:${dists.join('・')}分割、通り抜け可・手枠は空になった）`,
        moved: false
      };
    }

    if (hand.id === 'soil') {
      let thrown = 0, rolledBackCnt = 0, lastNote = '';
      for (let i = 0; i < totalCount; i++) {
        const jitter = (totalCount > 1) ? (Math.floor(Math.random() * 3) - 1) : 0;
        const r = simulateThrowSingleSoil(absX, absZ, baseSubY, dx, dz, jitter, stats, areaId);
        if (r.ok) { thrown++; if (r.rolledBack) rolledBackCnt++; lastNote = r.note; }
      }
      if (thrown <= 0) {
        return { actionLabel: `🟫 ${dName}へ土を投げたが着地先が満杯だった`, physicalResult: '周囲がすべて満杯で土を投げられなかった', moved: false };
      }
      DIG.state.equip.hand.count -= thrown;
      if (DIG.state.equip.hand.count <= 0) DIG.state.equip.hand = null;
      life.stamina = Math.max(0, life.stamina - 4);
      C.saveDigState();

      const scatterText = totalCount > 1
        ? `ランダムに散らばって着地した${rolledBackCnt > 0 ? `（うち${rolledBackCnt}個は斜面から手前へ転がり落ちた）` : ''}`
        : lastNote;
      return {
        actionLabel: `🟫 ${dName}へ土を${thrown}個一気に投げた（手枠空）`,
        physicalResult: `手枠の土${thrown}個を${dName}へ放物線を描いて一気に投げ、${scatterText}（手枠は空になった）`,
        moved: false
      };
    }

    return { actionLabel: '🖐️ 投げられなかった', physicalResult: '未対応アイテムのため投げられなかった', moved: false };
  }

  DIG.throwAct = { runThrowHand };

  if (window.DebugGuard) window.DebugGuard.markLoaded('dig_throw.js');
})();
