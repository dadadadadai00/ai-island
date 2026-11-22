// ============================================================================
// 【分割物理モジュール 6/7：dig_throw.js】
// ・手枠装備の放物線投擲（個数自由選択・頭上保持時は不可）
// ・スポーツ3動作（punch / kick / swing）＆完全詰み時の粉砕（消失）脱出
// ============================================================================
(function initDigThrow() {
  const DIG = window.DIG;
  if (!DIG || !DIG.core || !DIG.move || !DIG.dig) return;
  const C = DIG.core;
  const M = DIG.move;
  const D = DIG.dig;
  const CONST = DIG.CONST;

  function traceLandingColumn(startAbsX, startAbsZ, dx, dz, startSubY, maxDist, areaId) {
    let lastValidX = startAbsX, lastValidZ = startAbsZ, hitWall = false;
    for (let step = 1; step <= maxDist; step++) {
      const tx = startAbsX + dx * step;
      const tz = startAbsZ + dz * step;
      if (!C.isInsideIslandAbs(tx, tz)) { hitWall = true; break; }
      const arcY = startSubY + (step === 1 ? 1 : 0);
      if (C.hasSolidTerrainAtAbsSubY(tx, arcY, tz) || M.isCrateBlockingAtSubY(tx, arcY, tz, areaId)) {
        hitWall = true;
        break;
      }
      lastValidX = tx;
      lastValidZ = tz;
    }
    const floorY = C.findFloorSubYBelow(lastValidX, lastValidZ, startSubY + 2);
    return { absX: lastValidX, absZ: lastValidZ, floorSubY: floorY, hitWall };
  }

  function runThrowHand(dir, opts = {}) {
    if (M.isBehindCurrentFacing(dir)) return M.runTurnAroundOnly(dir, '投擲');

    if ((DIG.state.headSoil || 0) > 0) {
      return {
        actionLabel: '🚫 頭上に土を載せているため投げられなかった',
        physicalResult: '頭上ピラミッド保持中はバランスが崩れるため投擲できなかった（先に土を置く必要がある）',
        moved: false
      };
    }

    const hand = DIG.state.equip && DIG.state.equip.hand;
    if (!hand || hand.count <= 0) {
      return {
        actionLabel: '🎯 手枠が空（素手）のため投げられなかった',
        physicalResult: '手枠に装備している道具・土がないため投げられなかった',
        moved: false
      };
    }

    ROBOT.rotY = dir.rot;
    M.setFaceDir('front');
    const dName = dir.name.replace('(斜め)', '');
    const areaId = C.getCurAreaId();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const stats = C.getSizeStats();
    const meta = CONST.ITEM_META[hand.id] || { name: hand.id, kind: 'material' };
    const unit = meta.kind === 'tool' ? '本' : '個';
    const dx = Math.sign(dir.dx || 0), dz = Math.sign(dir.dz || 0);

    const throwCount = (Number.isFinite(Number(opts.count)) && Number(opts.count) > 0)
      ? Math.min(hand.count, Math.floor(Number(opts.count)))
      : hand.count;
    const maxDist = (meta.kind === 'tool') ? stats.throwToolMax : stats.throwSoilMax;
    const land = traceLandingColumn(absX, absZ, dx, dz, baseSubY, maxDist, areaId);

    hand.count -= throwCount;
    if (hand.count <= 0) DIG.state.equip.hand = null;

    if (meta.kind === 'tool') {
      C.addDroppedTool(meta.id, land.absX, land.absZ, land.floorSubY, throwCount, areaId);
    } else {
      C.addLooseSoilAtFloor(land.absX, land.absZ, land.floorSubY, throwCount, areaId);
    }

    const dist = Math.max(Math.abs(land.absX - absX), Math.abs(land.absZ - absZ));
    DIG.runtime.lastSportAnim = { kind: 'throw', dir, time: Date.now(), hitWall: land.hitWall, targetAbs: land };
    life.stamina = Math.max(0, life.stamina - 4);
    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    C.saveDigState();
    if (DIG.ui && DIG.ui.renderDiaryFullUI) DIG.ui.renderDiaryFullUI();

    return {
      actionLabel: `🎯 ${dName}へ${meta.name}×${throwCount}${unit}を投げた(距離${dist})`,
      physicalResult: `手枠の${meta.name}を${dName}方向へ${throwCount}${unit}投げ、距離${dist}分割先の床へ着地させた${land.hitWall ? '（途中で壁等に当たって落下）' : ''}`,
      moved: false
    };
  }

  // 周囲が土で満杯になり掘削不能かチェック（詰み救済判定の補助）
  function isSoilStorageDeadlocked(dir) {
    const stats = C.getSizeStats();
    const { targets } = D.findConnectedDigTargets('front', dir, 'auto', 1, '');
    if (!targets.length) return false;
    return !D.findDropSlotForDugSoil(targets[0], dir, stats);
  }

  // 目の前の散らばり土・落ちた道具を物理的に押す／蹴る／弾く
  function strikeLooseObjectInFront(dir, pushDist, verbLabel) {
    const areaId = C.getCurAreaId();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const stats = C.getSizeStats();
    const cells = D.buildFrontRowCells(absX, absZ, dir, stats, '');
    const dx = Math.sign((dir && dir.dx) || 0), dz = Math.sign((dir && dir.dz) || 0);
    const dName = (dir && dir.name) ? dir.name.replace('(斜め)', '') : '正面';

    // 1) 落ちているスコップ等の道具を弾く
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const itIdx = (DIG.state.worldDroppedItems || []).findIndex(
        it => it.areaId === areaId && it.count > 0 && it.absX === c.absX && it.absZ === c.absZ &&
          Math.abs(it.floorSubY - baseSubY) <= stats.reachH
      );
      if (itIdx >= 0) {
        const it = DIG.state.worldDroppedItems[itIdx];
        const land = traceLandingColumn(c.absX, c.absZ, dx, dz, it.floorSubY, pushDist, areaId);
        const movedDist = Math.max(Math.abs(land.absX - c.absX), Math.abs(land.absZ - c.absZ));
        const meta = CONST.ITEM_META[it.id] || { name: it.id };
        if (movedDist > 0) {
          it.absX = land.absX; it.absZ = land.absZ; it.floorSubY = land.floorSubY;
          C.saveDigState();
          return {
            hit: true, targetAbs: land,
            actionLabel: `⚡ ${dName}の${meta.name}を${verbLabel}で${movedDist}分割先へ飛ばした`,
            physicalResult: `目の前の${meta.name}を${verbLabel}で${dName}へ${movedDist}分割飛ばした`
          };
        }
      }
    }

    // 2) 目の前の散らばり土を1個押す／蹴り飛ばす
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const stacks = C.getLooseSoilStacksInColumn(c.absX, c.absZ, areaId);
      const st = stacks.find(s => s.count > 0 && s.floorSubY <= baseSubY + stats.reachH && s.floorSubY + s.count > baseSubY);
      if (st) {
        const land = traceLandingColumn(c.absX, c.absZ, dx, dz, st.floorSubY + st.count - 1, pushDist, areaId);
        const movedDist = Math.max(Math.abs(land.absX - c.absX), Math.abs(land.absZ - c.absZ));
        if (movedDist > 0) {
          C.addLooseSoilAtFloor(c.absX, c.absZ, st.floorSubY, -1, areaId);
          C.addLooseSoilAtFloor(land.absX, land.absZ, land.floorSubY, 1, areaId);
          C.saveDigState();
          return {
            hit: true, targetAbs: land,
            actionLabel: `⚡ ${dName}の土を${verbLabel}で${movedDist}分割先へ飛ばした`,
            physicalResult: `目の前の散らばり土1個を${verbLabel}で${dName}へ${movedDist}分割動かした`
          };
        }
      }
    }
    return { hit: false };
  }

  function hasWallInFront(dir) {
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const stats = C.getSizeStats();
    const cells = D.buildFrontRowCells(absX, absZ, dir, stats, '');
    for (let i = 0; i < cells.length; i++) {
      for (let h = 0; h < stats.reachH; h++) {
        if (C.hasSolidTerrainAtAbsSubY(cells[i].absX, baseSubY + h, cells[i].absZ)) {
          return { hit: true, absX: cells[i].absX, absZ: cells[i].absZ, subY: baseSubY + h };
        }
      }
    }
    return { hit: false };
  }

  // --- スポーツ3動作（punch / kick / swing）＆汎用 use ---
  function runUseAction(sub = '', dir, opts = {}) {
    const mode = String(sub || 'use').toLowerCase();
    const verbMap = { punch: 'パンチ', kick: 'キック', swing: 'スイング', use: '使用' };
    const verb = verbMap[mode] || '使用';

    if (M.isBehindCurrentFacing(dir)) return M.runTurnAroundOnly(dir, verb);
    if (dir && Number.isFinite(dir.rot)) ROBOT.rotY = dir.rot;
    M.setFaceDir('front');

    const dName = (dir && dir.name) ? dir.name.replace('(斜め)', '') : '正面';
    const stats = C.getSizeStats();
    const hand = DIG.state.equip && DIG.state.equip.hand;
    const hasTool = Boolean(hand && hand.id === 'shovel' && hand.count > 0);

    // 1) 完全詰み救済（パンチ・キック時のみ、土・壁を1分割粉砕して消失）
    if ((mode === 'punch' || mode === 'kick') && (M.isCompletelyTrapped() || isSoilStorageDeadlocked(dir))) {
      const esc = D.smashBlockForEscape(dir, verb);
      if (esc.smashed) {
        DIG.runtime.lastSportAnim = { kind: mode, dir, time: Date.now(), hitWall: true, smash: true };
        life.stamina = Math.max(0, life.stamina - 6);
        return { actionLabel: esc.actionLabel, physicalResult: esc.physicalResult, moved: false };
      }
    }

    // 2) 通常時：目の前の散らばり土・道具を押す／蹴る／弾く
    if (mode === 'punch' || mode === 'kick' || mode === 'swing') {
      const pushDist = (mode === 'punch') ? 1 : (mode === 'kick' ? Math.max(2, Math.min(3, stats.reachH + 1)) : (hasTool ? 3 : 2));
      const strike = strikeLooseObjectInFront(dir, pushDist, verb);
      if (strike.hit) {
        DIG.runtime.lastSportAnim = { kind: mode, dir, time: Date.now(), hitWall: false, targetAbs: strike.targetAbs };
        life.stamina = Math.max(0, life.stamina - 4);
        ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
        return { actionLabel: strike.actionLabel, physicalResult: strike.physicalResult, moved: false };
      }

      // 3) 壁に当たった場合：削れず砂がパラパラ飛び散る
      const wall = hasWallInFront(dir);
      DIG.runtime.lastSportAnim = { kind: mode, dir, time: Date.now(), hitWall: wall.hit, targetAbs: wall.hit ? wall : null };
      life.stamina = Math.max(0, life.stamina - 3);
      if (wall.hit) {
        const icon = mode === 'punch' ? '🥊' : (mode === 'kick' ? '🦵' : '🏏');
        return {
          actionLabel: `${icon} ${dName}の壁に${verb}！（砂がパラパラ飛び散った）`,
          physicalResult: `${dName}の壁へ${verb}を当てたが通常時は削れず、表面から砂粒がパラパラと飛び散った`,
          moved: false
        };
      }
      const icon = mode === 'punch' ? '🥊' : (mode === 'kick' ? '🦵' : '🏏');
      return {
        actionLabel: `${icon} ${dName}へ向かって${verb}を繰り出した`,
        physicalResult: `${dName}の空間へ向かって${verb}を素振りした`,
        moved: false
      };
    }

    return {
      actionLabel: `🛠️ ${dName}へ使う動作を試みたが対象がなかった`,
      physicalResult: `${dName}に使用できる対象がなかった（スポーツ動作はsub:"punch"/"kick"/"swing"を指定）`,
      moved: false
    };
  }

  DIG.throw = {
    traceLandingColumn, runThrowHand, runUseAction
  };

  if (window.DebugGuard) window.DebugGuard.markLoaded('dig_throw.js');
})();
