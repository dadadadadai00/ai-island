// ============================================================================
// 【分割物理モジュール 3/7：dig_vision_3d.js】
// ・1人称視野記号マップ（厳密DDA視線・落ちたスコップS表示）
// ・3D描画（圧縮木箱・散らばり土・落下スコップ・頭上ピラミッド・手枠装備）
// ・3D画面上の圧縮木箱短タップによる25枠モーダル起動
// ============================================================================
(function initDigVision3D() {
  const DIG = window.DIG;
  if (!DIG || !DIG.core || !DIG.move) return;
  const C = DIG.core;
  const M = DIG.move;
  const CONST = DIG.CONST;

  // 旧ツール非表示 ＆ 3D頭上・手元グループ接続
  try {
    if (typeof boxTool !== 'undefined' && boxTool) {
      boxTool.children.forEach(ch => { ch.visible = false; });
      boxTool.visible = false;
    }
    if (typeof stickTool !== 'undefined' && stickTool) {
      stickTool.children.forEach(ch => { ch.visible = false; });
      stickTool.visible = false;
    }
  } catch (e) {}

  const headPyramidGroup = new THREE.Group();
  headPyramidGroup.name = 'dig_head_pyramid_group';
  const handEquipGroup = new THREE.Group();
  handEquipGroup.name = 'dig_hand_equip_group';
  if (typeof robotGroup !== 'undefined' && robotGroup) {
    robotGroup.add(headPyramidGroup);
    robotGroup.add(handEquipGroup);
  }

  const digVisualGroup = new THREE.Group();
  digVisualGroup.name = 'dig_rules_visual_group';
  if (typeof scene !== 'undefined' && scene) scene.add(digVisualGroup);

  const crateHitMeshes = [];
  const unitBoxGeo  = new THREE.BoxGeometry(CONST.SUB_SIZE * 0.96, CONST.SUB_SIZE * 0.96, CONST.SUB_SIZE * 0.96);
  const unitEdgeGeo = new THREE.EdgesGeometry(unitBoxGeo);
  const soilMatLight = new THREE.MeshLambertMaterial({ color: 0xd9a875 });
  const soilMatDark  = new THREE.MeshLambertMaterial({ color: 0xc68e5a });
  const soilEdgeMat  = new THREE.LineBasicMaterial({ color: 0x7c4a21, transparent: true, opacity: 0.42 });
  const shovelHandleMat = new THREE.MeshLambertMaterial({ color: 0x92400e });
  const shovelBladeMat  = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });

  function isVisibleFromEye(curAbsX, curAbsZ, eyeSubY, targetAbsX, targetAbsZ) {
    const x0 = Math.round(curAbsX), z0 = Math.round(curAbsZ);
    const x1 = Math.round(targetAbsX), z1 = Math.round(targetAbsZ);
    if (x0 === x1 && z0 === z1) return true;

    const areaId = C.getCurAreaId();
    const dx = x1 - x0, dz = z1 - z0;
    const stepX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
    const stepZ = dz > 0 ? 1 : (dz < 0 ? -1 : 0);
    const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tMaxX = dx !== 0 ? (0.5 * tDeltaX) : Infinity;
    let tMaxZ = dz !== 0 ? (0.5 * tDeltaZ) : Infinity;

    let cx = x0, cz = z0;
    const maxIter = Math.abs(dx) + Math.abs(dz) + 4;
    const isBlockingCell = (mx, mz) => {
      if (!C.isInsideIslandAbs(mx, mz)) return true;
      if (C.hasSolidTerrainAtAbsSubY(mx, eyeSubY, mz)) return true;
      if (C.hasLooseSoilAtSubY(mx, eyeSubY, mz, areaId)) return true;
      if (M.isCrateBlockingAtSubY(mx, eyeSubY, mz, areaId)) return true;
      return false;
    };

    for (let iter = 0; iter < maxIter; iter++) {
      if (Math.abs(tMaxX - tMaxZ) < 1e-9) {
        const sA = (cx + stepX !== x1 || cz !== z1) && isBlockingCell(cx + stepX, cz);
        const sB = (cx !== x1 || cz + stepZ !== z1) && isBlockingCell(cx, cz + stepZ);
        if (sA && sB) return false;
        cx += stepX; cz += stepZ; tMaxX += tDeltaX; tMaxZ += tDeltaZ;
      } else if (tMaxX < tMaxZ) {
        cx += stepX; tMaxX += tDeltaX;
      } else {
        cz += stepZ; tMaxZ += tDeltaZ;
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
    const stats = C.getSizeStats();
    const areaId = C.getCurAreaId();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const eyeSubY = baseSubY + Math.max(1, stats.bodyHeight) - 1;
    const basis = M.getFacingBasis();

    const maxLat = isMoving ? 3 : 4;
    const headerCols = [];
    for (let lat = -maxLat; lat <= maxLat; lat++) {
      headerCols.push(lat < 0 ? `L${Math.abs(lat)}` : (lat === 0 ? '正' : `R${lat}`));
    }

    const topRows = [`列 : ${headerCols.join(' ')}`];
    for (let fwd = 6; fwd >= 0; fwd--) {
      let row = `前${fwd}: `;
      for (let lat = -maxLat; lat <= maxLat; lat++) {
        if (fwd === 0 && lat === 0) { row += ' @ '; continue; }
        if (isMoving && ((fwd === 0 && Math.abs(lat) > 0) || (fwd === 1 && Math.abs(lat) > 1) || (fwd === 2 && Math.abs(lat) > 2))) {
          row += ' ? '; continue;
        }
        const tx = absX + basis.fx * fwd + basis.rx * lat;
        const tz = absZ + basis.fz * fwd + basis.rz * lat;
        if (!C.isInsideIslandAbs(tx, tz)) { row += ' ~ '; continue; }
        if (!isVisibleFromEye(absX, absZ, eyeSubY, tx, tz)) { row += ' ? '; continue; }

        let ch = '.';
        if (M.isCrateBlockingAtSubY(tx, baseSubY, tz, areaId) || M.isCrateBlockingAtSubY(tx, eyeSubY, tz, areaId)) {
          ch = 'B';
        } else {
          const floorHere = C.findFloorSubYBelow(tx, tz, baseSubY + 1);
          const loose = C.getLooseSoilAtFloor(tx, tz, floorHere, areaId);
          const looseTopY = floorHere + loose;
          const solid0 = C.hasSolidTerrainAtAbsSubY(tx, baseSubY, tz);
          const solid1 = C.hasSolidTerrainAtAbsSubY(tx, baseSubY + 1, tz);
          let hasLowCeiling = solid1;
          if (!hasLowCeiling && !solid0) {
            for (let h = 2; h <= 4; h++) {
              if (C.hasSolidTerrainAtAbsSubY(tx, baseSubY + h, tz)) { hasLowCeiling = true; break; }
            }
          }
          if (loose > 0 && floorHere <= baseSubY + 1 && looseTopY > baseSubY) {
            const relH = (floorHere === baseSubY) ? loose : (looseTopY - baseSubY);
            ch = String(Math.min(9, Math.max(1, relH)));
          } else if (solid0 && solid1) ch = '#';
          else if (solid0 && !solid1) ch = '+';
          else if (!solid0 && hasLowCeiling) ch = '^';
          else if (C.hasDroppedShovelAt(tx, tz, floorHere, areaId)) ch = 'S';
          else if (floorHere === baseSubY || looseTopY === baseSubY) ch = '.';
          else ch = 'v';
        }
        row += ` ${ch} `;
      }
      topRows.push(row.trimEnd());
    }

    const frontEdge = C.getFrontEdgeOffset(basis.fx, basis.fz, stats.reachW);
    const sliceRows = ['列 : L2 L1 正 R1 R2'];
    for (let h = 4; h >= -1; h--) {
      let row = `${h >= 0 ? `高${h + 1}` : '床 '}: `;
      for (let lat = -2; lat <= 2; lat++) {
        const tx = absX + frontEdge.ox + basis.rx * lat;
        const tz = absZ + frontEdge.oz + basis.rz * lat;
        if (!C.isInsideIslandAbs(tx, tz)) { row += ' ~ '; continue; }
        const curY = baseSubY + h;
        if (C.hasSolidTerrainAtAbsSubY(tx, curY, tz)) row += ' # ';
        else if (C.hasLooseSoilAtSubY(tx, curY, tz, areaId)) row += ' o ';
        else if (M.isCrateBlockingAtSubY(tx, curY, tz, areaId)) row += ' B ';
        else if (h === 0 && C.hasDroppedShovelAt(tx, tz, curY, areaId)) row += ' S ';
        else row += ' . ';
      }
      sliceRows.push(row.trimEnd());
    }

    const modeTitle = isMoving
      ? '[移動直後・狭い前方視野 (1文字=1分割, 上ほど奥)]'
      : '[停止中・180°パノラマ視野 (1文字=1分割, 上ほど奥・真横まで可視)]';
    return [
      `視界の向き: 正面=${basis.actualFacingName}(基準:${basis.frontName} / 左:${basis.leftName} / 右:${basis.rightName}) ※背後は死角`,
      modeTitle, ...topRows,
      '[目の前1列目の正面断面 (L2=左2, L1=左1, 正=正面, R1=右1, R2=右2)]',
      ...sliceRows,
      '記号: @=自分 #=壁(高2以上) +=1段高 ^=高1空洞(高2以上に壁/低天井) .=平坦/空間 v=低い床/穴 1-9/o=散らばり土(段数) S=落ちたスコップ(通行可) B=圧縮木箱(5x5x5) ~=端 ?=死角'
    ].join('\n');
  }

  function createMiniShovelMesh(scale = 1.0) {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035 * scale, 0.22 * scale, 0.035 * scale), shovelHandleMat);
    handle.position.y = 0.08 * scale;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.085 * scale, 0.03 * scale, 0.035 * scale), shovelHandleMat);
    grip.position.y = 0.19 * scale;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.095 * scale, 0.09 * scale, 0.025 * scale), shovelBladeMat);
    blade.position.y = -0.05 * scale;
    g.add(handle, grip, blade);
    return g;
  }

  function buildCrateMesh(crate) {
    const grp = new THREE.Group();
    const boxSize = CONST.SUB_SIZE * 5;
    const orig = DIG.runtime.origGetSurfaceYAt;
    const yBase = orig ? orig(crate.x, crate.z, null, 5) : 0;
    grp.position.set(crate.x, yBase, crate.z);
    grp.userData.crateId = crate.id;

    const body = new THREE.Mesh(new THREE.BoxGeometry(boxSize * 0.96, boxSize * 0.90, boxSize * 0.96), new THREE.MeshLambertMaterial({ color: 0xe6be8a }));
    body.position.y = boxSize * 0.45;
    body.userData.crateId = crate.id;
    grp.add(body);
    crateHitMeshes.push(body);

    const rimTop = new THREE.Mesh(new THREE.BoxGeometry(boxSize, 0.08, boxSize), new THREE.MeshLambertMaterial({ color: 0x9a6b43 }));
    rimTop.position.y = boxSize * 0.92;
    rimTop.userData.crateId = crate.id;
    grp.add(rimTop);
    crateHitMeshes.push(rimTop);

    const band = new THREE.Mesh(new THREE.BoxGeometry(boxSize * 0.99, 0.07, boxSize * 0.99), new THREE.MeshLambertMaterial({ color: 0x475569 }));
    band.position.y = boxSize * 0.45;
    grp.add(band);

    const usedSlots = (DIG.items && DIG.items.countUsedSlotsInCrate)
      ? DIG.items.countUsedSlotsInCrate(crate)
      : (Array.isArray(crate.slots) ? crate.slots.filter(s => s && s.count > 0).length : 0);
    if (usedSlots > 0) {
      const ratio = Math.min(1, usedSlots / CONST.CRATE_SLOTS);
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
    const count = Math.max(0, Math.floor(DIG.state.headSoil || 0));
    if (count <= 0) return;

    const stats = C.getSizeStats();
    const sSpec = C.getOriginalSizeSpec();
    const headBaseY = (ROBOT.posture === 'crawl')
      ? Math.max(0.20, stats.crawlH * CONST.SUB_SIZE)
      : (Number.isFinite(sSpec.scaleY) ? Math.max(0.22, sSpec.scaleY * 0.96) : stats.reachH * CONST.SUB_SIZE);

    let placed = 0;
    for (let layer = 0; layer < stats.reachW && placed < count; layer++) {
      const w = stats.reachW - layer, offset = (w - 1) * 0.5;
      for (let gx = 0; gx < w && placed < count; gx++) {
        for (let gz = 0; gz < w && placed < count; gz++) {
          const m = new THREE.Mesh(unitBoxGeo, ((gx + gz + layer) % 2 === 0) ? soilMatLight : soilMatDark);
          m.position.set((gx - offset) * CONST.SUB_SIZE, headBaseY + layer * CONST.SUB_SIZE + CONST.SUB_SIZE * 0.5, (gz - offset) * CONST.SUB_SIZE);
          m.add(new THREE.LineSegments(unitEdgeGeo, soilEdgeMat));
          headPyramidGroup.add(m);
          placed++;
        }
      }
    }
  }

  function renderHandEquipVisual() {
    while (handEquipGroup.children.length) handEquipGroup.remove(handEquipGroup.children[0]);
    const hand = DIG.state.equip && DIG.state.equip.hand;
    if (!hand || !hand.count) return;

    const stats = C.getSizeStats();
    const sSpec = C.getOriginalSizeSpec();
    const handY = Math.max(0.10, (Number.isFinite(sSpec.scaleY) ? sSpec.scaleY : stats.reachH * CONST.SUB_SIZE) * 0.48);
    const sideX = Math.max(0.12, stats.reachW * CONST.SUB_SIZE * 0.56);
    const frontZ = Math.max(0.11, stats.reachW * CONST.SUB_SIZE * 0.52);

    if (hand.id === 'shovel') {
      const sc = Math.max(0.85, 0.75 + stats.reachH * 0.16);
      const rSh = createMiniShovelMesh(sc);
      rSh.position.set(sideX, handY, frontZ * 0.55);
      rSh.rotation.set(0.45, 0, -0.2);
      handEquipGroup.add(rSh);
      if (hand.count >= 2) {
        const lSh = createMiniShovelMesh(sc);
        lSh.position.set(-sideX, handY, frontZ * 0.55);
        lSh.rotation.set(0.45, 0, 0.2);
        handEquipGroup.add(lSh);
      }
    } else if (hand.id === 'soil') {
      const showN = Math.min(5, hand.count), mini = 0.65;
      for (let i = 0; i < showN; i++) {
        const m = new THREE.Mesh(unitBoxGeo, (i % 2 === 0) ? soilMatLight : soilMatDark);
        m.scale.set(mini, mini, mini);
        m.position.set(0, handY + i * (CONST.SUB_SIZE * mini * 0.85), frontZ);
        m.add(new THREE.LineSegments(unitEdgeGeo, soilEdgeMat));
        handEquipGroup.add(m);
      }
    }
  }

  function renderDigVisuals() {
    while (digVisualGroup.children.length) digVisualGroup.remove(digVisualGroup.children[0]);
    crateHitMeshes.length = 0;
    renderHeadPyramidVisual();
    renderHandEquipVisual();

    const areaId = C.getCurAreaId();
    DIG.state.crates.forEach(c => {
      if (c.areaId === areaId) digVisualGroup.add(buildCrateMesh(c));
    });

    Object.keys(DIG.state.worldSubSoils).forEach(k => {
      const count = DIG.state.worldSubSoils[k] || 0;
      if (count <= 0) return;
      const p = C.parseSoilKey(k);
      if (!p || p.areaId !== areaId || !C.isInsideIslandAbs(p.absX, p.absZ)) return;
      const { wx, wz } = C.absToWorldXZ(p.absX, p.absZ);
      const baseSubY = (p.floorSubY !== null) ? p.floorSubY : C.getTerrainColumnTopSubY(p.absX, p.absZ);
      const showCount = Math.min(count, 10);
      for (let i = 0; i < showCount; i++) {
        const m = new THREE.Mesh(unitBoxGeo, ((p.absX + p.absZ + i) % 2 === 0) ? soilMatLight : soilMatDark);
        m.position.set(wx, (baseSubY + i) * CONST.SUB_SIZE + CONST.SUB_SIZE * 0.5, wz);
        m.add(new THREE.LineSegments(unitEdgeGeo, soilEdgeMat));
        digVisualGroup.add(m);
      }
    });

    (DIG.state.worldDroppedItems || []).forEach(it => {
      if (it.areaId !== areaId || it.count <= 0 || !C.isInsideIslandAbs(it.absX, it.absZ)) return;
      if (it.id === 'shovel') {
        const { wx, wz } = C.absToWorldXZ(it.absX, it.absZ);
        const yPos = it.floorSubY * CONST.SUB_SIZE + 0.03;
        const showN = Math.min(3, it.count);
        for (let i = 0; i < showN; i++) {
          const sh = createMiniShovelMesh(0.95);
          sh.position.set(wx + (i - (showN - 1) * 0.5) * 0.05, yPos + i * 0.02, wz);
          sh.rotation.set(Math.PI / 2, 0.35 + i * 0.4, 0.2);
          digVisualGroup.add(sh);
        }
      }
    });
  }

  // 3D画面上の圧縮木箱短タップで25枠モーダルを開く
  (function setupCrate3DTapListener() {
    if (typeof renderer === 'undefined' || !renderer || !renderer.domElement) return;
    const dom = renderer.domElement;
    if (dom.dataset.crateTapBound === '1') return;
    dom.dataset.crateTapBound = '1';

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0, downY = 0, downTime = 0;

    dom.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary) return;
      downX = e.clientX; downY = e.clientY; downTime = Date.now();
    }, { passive: true });

    dom.addEventListener('pointerup', (e) => {
      if (!e.isPrimary || !crateHitMeshes.length) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 10 || (Date.now() - downTime) > 380) return;
      const anyOpen = Array.from(document.querySelectorAll('.modal-overlay')).some(
        el => el.classList.contains('active') || (el.style.display && el.style.display !== 'none')
      );
      if (anyOpen) return;
      const cam = (typeof activeCamera !== 'undefined' && activeCamera) ? activeCamera : null;
      if (!cam) return;
      const rect = dom.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, cam);
      const hits = raycaster.intersectObjects(crateHitMeshes, false);
      if (hits.length > 0 && hits[0].object && hits[0].object.userData.crateId && DIG.ui && DIG.ui.openCrateModal) {
        DIG.ui.openCrateModal(hits[0].object.userData.crateId);
      }
    }, { passive: true });
  })();

  DIG.vision = {
    isVisibleFromEye, buildFirstPersonVisionMap,
    renderHeadPyramidVisual, renderHandEquipVisual, renderDigVisuals
  };

  if (window.DebugGuard) window.DebugGuard.markLoaded('dig_vision_3d.js');
})();

