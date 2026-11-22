// ============================================================================
// 【分割物理モジュール 3/7：dig_vision_3d.js】
// ・キャラ基本表現へスポーツ3種(パンチ/キック/スイング)を追加登録
// ・顔の向き連動の1人称視野記号マップ（ネタバレ語排除）
// ・3D描画（子ども用手持ちパステルスコップ・メモ・砂粒＆スポーツ瞬間モーション）
// ============================================================================
(function initDigVision3D() {
  const DIG = window.DIG;
  if (!DIG || !DIG.core || !DIG.move) return;
  const C = DIG.core;
  const M = DIG.move;
  const CONST = DIG.CONST;

  // --- 設定ページ「キャラ基本表現」へ最小3種(パンチ/キック/スイング)を正式追加 ---
  (function registerSportExpressions() {
    const extras = [
      {
        expr: { key: 'punch', icon: '🥊', label: 'パンチ',   bulb: 0xf97316, words: 'パンチ、殴る、突く、ジャブ、壁叩き、粉砕脱出' },
        pose: { spd: 16, bounce: 0.02, bodyX: 0.25,  headX: -0.10, shLX: -0.95, shLZ: 0.25, elLX: -1.45, shRX: -1.65, shRZ: -0.08, elRX: -0.15, hipX: -0.35, kneeX: 0.65, mode: 'push',    name: 'パンチ' }
      },
      {
        expr: { key: 'kick',  icon: '🦵', label: 'キック',   bulb: 0xef4444, words: 'キック、蹴る、シュート、蹴り飛ばす、壁蹴り、粉砕脱出' },
        pose: { spd: 15, bounce: 0.08, bodyX: -0.26, headX: 0.14,  shLX: -0.75, shLZ: 0.45, elLX: -1.10, shRX: -0.75, shRZ: -0.45, elRX: -1.10, hipX: -1.25, kneeX: 0.20, mode: 'stomp',   name: 'キック' }
      },
      {
        expr: { key: 'swing', icon: '🏏', label: 'スイング', bulb: 0x10b981, words: 'スイング、フルスイング、バット、ラケット、打ち返す、振る', tool: true },
        pose: { spd: 14, bounce: 0.03, bodyX: 0.18,  headX: 0.08,  shLX: -1.15, shLZ: 0.45, elLX: -0.70, shRX: -1.40, shRZ: -0.75, elRX: -0.45, hipX: -0.35, kneeX: 0.65, mode: 'swing_h', name: 'スイング' }
      }
    ];

    let savedWords = null;
    try {
      if (typeof safeStorage !== 'undefined') {
        const raw = safeStorage.getItem('island_spacecore_v15');
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && parsed.customWords) savedWords = parsed.customWords;
      }
    } catch (e) {}

    extras.forEach(({ expr, pose }) => {
      if (typeof DEFAULT_EXPRESSIONS !== 'undefined' && Array.isArray(DEFAULT_EXPRESSIONS)) {
        if (!DEFAULT_EXPRESSIONS.some(e => e.key === expr.key)) DEFAULT_EXPRESSIONS.push(expr);
      }
      if (typeof POSE_TABLE !== 'undefined' && POSE_TABLE && !POSE_TABLE[expr.key]) {
        POSE_TABLE[expr.key] = pose;
      }
      if (typeof LOCKED_PHYSICAL_POSES !== 'undefined' && Array.isArray(LOCKED_PHYSICAL_POSES)) {
        if (!LOCKED_PHYSICAL_POSES.includes(expr.key)) LOCKED_PHYSICAL_POSES.push(expr.key);
      }
      if (typeof CUSTOM_WORDS_MAP !== 'undefined' && CUSTOM_WORDS_MAP) {
        if (savedWords && typeof savedWords[expr.key] === 'string' && savedWords[expr.key].trim()) {
          CUSTOM_WORDS_MAP[expr.key] = savedWords[expr.key].trim();
        } else if (!CUSTOM_WORDS_MAP[expr.key]) {
          CUSTOM_WORDS_MAP[expr.key] = expr.words;
        }
      }
    });
  })();

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
  const fxGroup = new THREE.Group();
  fxGroup.name = 'dig_sport_fx_group';
  if (typeof scene !== 'undefined' && scene) {
    scene.add(digVisualGroup);
    scene.add(fxGroup);
  }

  const crateHitMeshes = [];
  const unitBoxGeo  = new THREE.BoxGeometry(CONST.SUB_SIZE * 0.96, CONST.SUB_SIZE * 0.96, CONST.SUB_SIZE * 0.96);
  const unitEdgeGeo = new THREE.EdgesGeometry(unitBoxGeo);
  const sandGeo     = new THREE.BoxGeometry(0.036, 0.036, 0.036);
  const smashGeo    = new THREE.BoxGeometry(0.068, 0.068, 0.068);
  const soilMatLight = new THREE.MeshLambertMaterial({ color: 0xd9a875 });
  const soilMatDark  = new THREE.MeshLambertMaterial({ color: 0xc68e5a });
  const sandMatPale  = new THREE.MeshLambertMaterial({ color: 0xebd0a7 });
  const soilEdgeMat  = new THREE.LineBasicMaterial({ color: 0x7c4a21, transparent: true, opacity: 0.42 });

  // 子ども用手持ちパステルスコップ素材（ピンク持ち手・クリーム軸・ミント先端）
  const pastelGripMat   = new THREE.MeshLambertMaterial({ color: 0xf9a8d4 });
  const pastelHandleMat = new THREE.MeshLambertMaterial({ color: 0xfef3c7 });
  const pastelBladeMat  = new THREE.MeshLambertMaterial({ color: 0x6ee7b7 });
  const pastelRimMat    = new THREE.MeshLambertMaterial({ color: 0x7dd3fc });
  const memoPaperMat    = new THREE.MeshLambertMaterial({ color: 0xfef9c3 });
  const memoInkMat      = new THREE.MeshLambertMaterial({ color: 0x64748b });

  // --- 砂粒飛び散り＆スポーツ瞬間モーション制御 ---
  let lastPlayedAnimTime = 0;
  const activeParticles = [];
  let activeBodyAnim = null;
  let fxRafId = null;

  function spawnSandBurst(wx, wy, wz, dx, dz, isSmash = false) {
    const count = isSmash ? 16 : 10;
    const geo = isSmash ? smashGeo : sandGeo;
    const mats = [soilMatLight, soilMatDark, sandMatPale];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mats[i % mats.length]);
      m.position.set(
        wx + (Math.random() - 0.5) * 0.14,
        wy + (Math.random() - 0.3) * 0.12,
        wz + (Math.random() - 0.5) * 0.14
      );
      const spread = isSmash ? 0.032 : 0.020;
      const vx = (-dx * 0.014) + (Math.random() - 0.5) * spread;
      const vy = (isSmash ? 0.036 : 0.024) + Math.random() * 0.022;
      const vz = (-dz * 0.014) + (Math.random() - 0.5) * spread;
      fxGroup.add(m);
      activeParticles.push({ mesh: m, vx, vy, vz, life: 0, maxLife: isSmash ? 34 : 26 });
    }
  }

  function stepFxLoop() {
    let alive = false;

    for (let i = activeParticles.length - 1; i >= 0; i--) {
      const p = activeParticles[i];
      p.life++;
      p.vy -= 0.0024;
      p.mesh.position.x += p.vx;
      p.mesh.position.y += p.vy;
      p.mesh.position.z += p.vz;
      p.mesh.rotation.x += 0.18;
      p.mesh.rotation.y += 0.15;
      const sc = Math.max(0.05, 1 - p.life / p.maxLife);
      p.mesh.scale.set(sc, sc, sc);
      if (p.life >= p.maxLife) {
        fxGroup.remove(p.mesh);
        activeParticles.splice(i, 1);
      } else {
        alive = true;
      }
    }

    if (activeBodyAnim && typeof robotGroup !== 'undefined' && robotGroup) {
      const t = (performance.now() - activeBodyAnim.start) / activeBodyAnim.dur;
      if (t >= 1) {
        robotGroup.position.x = activeBodyAnim.baseX;
        robotGroup.position.y = activeBodyAnim.baseY;
        robotGroup.position.z = activeBodyAnim.baseZ;
        robotGroup.rotation.x = 0;
        robotGroup.rotation.z = 0;
        robotGroup.rotation.y = activeBodyAnim.baseRotY;
        activeBodyAnim = null;
      } else {
        alive = true;
        const k = activeBodyAnim.kind;
        const wave = Math.sin(t * Math.PI);
        const snap = (t < 0.28) ? -(t / 0.28) * 0.45 : Math.sin(((t - 0.28) / 0.72) * Math.PI);
        const fx = Math.sin(activeBodyAnim.baseRotY), fz = Math.cos(activeBodyAnim.baseRotY);

        if (k === 'jump') {
          robotGroup.position.y = activeBodyAnim.baseY + wave * 0.26;
        } else if (k === 'punch') {
          robotGroup.position.x = activeBodyAnim.baseX + fx * snap * 0.14;
          robotGroup.position.z = activeBodyAnim.baseZ + fz * snap * 0.14;
          robotGroup.rotation.x = snap * 0.28;
          robotGroup.rotation.y = activeBodyAnim.baseRotY - snap * 0.32;
        } else if (k === 'kick') {
          robotGroup.position.x = activeBodyAnim.baseX + fx * snap * 0.13;
          robotGroup.position.z = activeBodyAnim.baseZ + fz * snap * 0.13;
          robotGroup.position.y = activeBodyAnim.baseY + Math.max(0, snap) * 0.09;
          robotGroup.rotation.x = -snap * 0.34;
        } else if (k === 'swing') {
          robotGroup.rotation.y = activeBodyAnim.baseRotY + (t < 0.3 ? -0.75 * (t / 0.3) : (-0.75 + 1.65 * Math.sin(((t - 0.3) / 0.7) * Math.PI * 0.5)));
          robotGroup.rotation.z = wave * 0.22;
        } else if (k === 'throw') {
          robotGroup.rotation.x = (t < 0.35 ? -0.35 * (t / 0.35) : 0.30 * Math.sin(((t - 0.35) / 0.65) * Math.PI));
        }
      }
    }

    if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof activeCamera !== 'undefined') {
      renderer.render(scene, activeCamera);
    }
    if (alive) fxRafId = requestAnimationFrame(stepFxLoop);
    else fxRafId = null;
  }

  function playTurnFxIfNeeded() {
    const anim = DIG.runtime.lastSportAnim;
    const isJump = (DIG.runtime.lastMoveVisualKind === 'jump');
    if (anim && anim.time && anim.time !== lastPlayedAnimTime) {
      lastPlayedAnimTime = anim.time;
      if (typeof robotGroup !== 'undefined' && robotGroup) {
        activeBodyAnim = {
          kind: anim.kind, start: performance.now(), dur: 360,
          baseX: robotGroup.position.x, baseY: robotGroup.position.y, baseZ: robotGroup.position.z,
          baseRotY: ROBOT.rotY || 0
        };
      }
      if (anim.hitWall || anim.smash) {
        const { absX, absZ } = C.getRobotAbsPos();
        const baseSubY = M.getRobotBaseSubY();
        const dx = Math.sign((anim.dir && anim.dir.dx) || Math.round(Math.sin(ROBOT.rotY || 0)));
        const dz = Math.sign((anim.dir && anim.dir.dz) || Math.round(Math.cos(ROBOT.rotY || 0)));
        const tAbs = anim.targetAbs || { absX: absX + dx, absZ: absZ + dz, subY: baseSubY };
        const { wx, wz } = C.absToWorldXZ(tAbs.absX, tAbs.absZ);
        const wy = ((Number.isFinite(tAbs.subY) ? tAbs.subY : baseSubY) + 0.5) * CONST.SUB_SIZE;
        spawnSandBurst(wx, wy, wz, dx, dz, Boolean(anim.smash));
      }
      if (!fxRafId) fxRafId = requestAnimationFrame(stepFxLoop);
    } else if (isJump && typeof robotGroup !== 'undefined' && robotGroup) {
      DIG.runtime.lastMoveVisualKind = null;
      activeBodyAnim = {
        kind: 'jump', start: performance.now(), dur: 340,
        baseX: robotGroup.position.x, baseY: robotGroup.position.y, baseZ: robotGroup.position.z,
        baseRotY: ROBOT.rotY || 0
      };
      if (!fxRafId) fxRafId = requestAnimationFrame(stepFxLoop);
    }
  }

  // --- 厳密DDA視線判定 ＆ 顔の向き連動記号マップ ---
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

  function resolveVisionBasis(bodyBasis, faceDir) {
    const cardinals = (typeof ALL_DIRS !== 'undefined' ? ALL_DIRS : []).filter(d => Math.abs(d.dx) + Math.abs(d.dz) === 1);
    const findName = (dx, dz) => {
      const hit = cardinals.find(d => d.dx === dx && d.dz === dz);
      return hit ? hit.name.replace('(斜め)', '') : '';
    };
    let fx = bodyBasis.fx, fz = bodyBasis.fz;
    if (faceDir === 'left') { fx = -bodyBasis.rx; fz = -bodyBasis.rz; }
    else if (faceDir === 'right') { fx = bodyBasis.rx; fz = bodyBasis.rz; }
    const rx = -fz, rz = fx;
    return {
      fx, fz, rx, rz,
      frontName: findName(fx, fz) || bodyBasis.frontName,
      rightName: findName(rx, rz) || bodyBasis.rightName,
      leftName: findName(-rx, -rz) || bodyBasis.leftName,
      actualFacingName: (faceDir === 'left' || faceDir === 'right') ? (findName(fx, fz) || bodyBasis.frontName) : bodyBasis.actualFacingName
    };
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
    const faceDir = (typeof M.getFaceDir === 'function') ? M.getFaceDir() : 'front';
    const faceLabelMap = { front: '正面', up: '上向き', down: '下向き', left: '左向き', right: '右向き' };
    const bodyBasis = M.getFacingBasis();
    const basis = resolveVisionBasis(bodyBasis, faceDir);

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

    const extraFocus = [];
    if (faceDir === 'up') {
      extraFocus.push('[上向き視界: 頭上(高2〜高4)の天井 3×3 (L1/正/R1)]');
      for (let fwd = 1; fwd >= -1; fwd--) {
        let r = `${fwd === 1 ? '前1' : (fwd === 0 ? '真上' : '後1')}: `;
        for (let lat = -1; lat <= 1; lat++) {
          const tx = absX + basis.fx * fwd + basis.rx * lat;
          const tz = absZ + basis.fz * fwd + basis.rz * lat;
          if (!C.isInsideIslandAbs(tx, tz)) { r += ' ~ '; continue; }
          let ceilH = '.';
          for (let h = stats.bodyHeight; h <= stats.bodyHeight + 4; h++) {
            if (C.hasSolidTerrainAtAbsSubY(tx, baseSubY + h, tz)) { ceilH = '#'; break; }
          }
          r += ` ${ceilH} `;
        }
        extraFocus.push(r.trimEnd());
      }
    } else if (faceDir === 'down') {
      extraFocus.push('[下向き視界: 足元1段下の床 3×3 (L1/正/R1)]');
      for (let fwd = 1; fwd >= -1; fwd--) {
        let r = `${fwd === 1 ? '前1' : (fwd === 0 ? '足元' : '後1')}: `;
        for (let lat = -1; lat <= 1; lat++) {
          const tx = absX + basis.fx * fwd + basis.rx * lat;
          const tz = absZ + basis.fz * fwd + basis.rz * lat;
          if (!C.isInsideIslandAbs(tx, tz)) { r += ' ~ '; continue; }
          const solid = C.hasSolidTerrainAtAbsSubY(tx, baseSubY - 1, tz);
          const loose = C.hasLooseSoilAtSubY(tx, baseSubY - 1, tz, areaId);
          r += ` ${solid ? '#' : (loose ? 'o' : 'v')} `;
        }
        extraFocus.push(r.trimEnd());
      }
    }

    const modeTitle = isMoving
      ? '[移動直後・狭い前方視野 (1文字=1分割, 上ほど奥)]'
      : '[停止中・180°パノラマ視野 (1文字=1分割, 上ほど奥・真横まで可視)]';
    const outLines = [
      `視界の向き: 視線=${basis.actualFacingName}(顔:${faceLabelMap[faceDir] || '正面'} / 体:${bodyBasis.actualFacingName} / 左:${basis.leftName} / 右:${basis.rightName}) ※背後は死角`,
      modeTitle, ...topRows,
      '[目の前1列目の正面断面 (L2=左2, L1=左1, 正=正面, R1=右1, R2=右2)]',
      ...sliceRows
    ];
    if (extraFocus.length) outLines.push(...extraFocus);
    outLines.push('記号: @=自分 #=壁(高2以上) +=1段高 ^=高1空洞(高2以上に壁/低天井) .=平坦/空間 v=低い床/穴 1-9/o=散らばり土(段数) S=落ちた道具(通行可) B=大きな四角い物体(5x5x5) ~=端 ?=死角');
    return outLines.join('\n');
  }

  // 子どもが手で持つコンパクトなパステルカラースコップ
  function createMiniShovelMesh(scale = 1.0) {
    const g = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.052 * scale, 0.095 * scale, 0.052 * scale), pastelGripMat);
    grip.position.y = 0.10 * scale;
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.068 * scale, 0.026 * scale, 0.068 * scale), pastelHandleMat);
    ring.position.y = 0.155 * scale;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.036 * scale, 0.055 * scale, 0.036 * scale), pastelHandleMat);
    neck.position.y = 0.025 * scale;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.115 * scale, 0.105 * scale, 0.030 * scale), pastelBladeMat);
    blade.position.y = -0.048 * scale;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.092 * scale, 0.028 * scale, 0.032 * scale), pastelRimMat);
    tip.position.y = -0.105 * scale;
    g.add(grip, ring, neck, blade, tip);
    return g;
  }

  function createMiniMemoMesh(scale = 1.0) {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 0.14 * scale, 0.014 * scale), memoPaperMat);
    const line1 = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 0.014 * scale, 0.018 * scale), memoInkMat);
    line1.position.y = 0.028 * scale;
    const line2 = new THREE.Mesh(new THREE.BoxGeometry(0.07 * scale, 0.014 * scale, 0.018 * scale), memoInkMat);
    line2.position.y = -0.012 * scale;
    g.add(paper, line1, line2);
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
      const sc = Math.max(0.85, 0.78 + stats.reachH * 0.14);
      const rSh = createMiniShovelMesh(sc);
      rSh.position.set(sideX, handY, frontZ * 0.58);
      rSh.rotation.set(0.55, 0, -0.18);
      handEquipGroup.add(rSh);
      if (hand.count >= 2) {
        const lSh = createMiniShovelMesh(sc);
        lSh.position.set(-sideX, handY, frontZ * 0.58);
        lSh.rotation.set(0.55, 0, 0.18);
        handEquipGroup.add(lSh);
      }
    } else if (hand.id === 'memo') {
      const mm = createMiniMemoMesh(Math.max(0.85, 0.72 + stats.reachH * 0.12));
      mm.position.set(sideX * 0.85, handY, frontZ * 0.72);
      mm.rotation.set(-0.2, 0.25, 0);
      handEquipGroup.add(mm);
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
      const { wx, wz } = C.absToWorldXZ(it.absX, it.absZ);
      const yPos = it.floorSubY * CONST.SUB_SIZE + 0.03;
      if (it.id === 'shovel') {
        const showN = Math.min(3, it.count);
        for (let i = 0; i < showN; i++) {
          const sh = createMiniShovelMesh(0.95);
          sh.position.set(wx + (i - (showN - 1) * 0.5) * 0.05, yPos + i * 0.02, wz);
          sh.rotation.set(Math.PI / 2, 0.35 + i * 0.4, 0.2);
          digVisualGroup.add(sh);
        }
      } else if (it.id === 'memo') {
        const mm = createMiniMemoMesh(0.95);
        mm.position.set(wx, yPos, wz);
        mm.rotation.set(Math.PI / 2, 0, 0.2);
        digVisualGroup.add(mm);
      }
    });

    playTurnFxIfNeeded();
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
    renderHeadPyramidVisual, renderHandEquipVisual, renderDigVisuals,
    playTurnFxIfNeeded
  };

  if (window.DebugGuard) window.DebugGuard.markLoaded('dig_vision_3d.js');
})();
