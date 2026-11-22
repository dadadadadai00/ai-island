// ============================================================================
// 【分割AI通信モジュール 2/4：ai_camera.js】
// ・キャラ視点（🤖視点＆検証カメラ共通）での未削り分割ブロック全表示・めり込み防止
// ・顔の向き(上/下/左/右/正面)連動の視線制御・3連180°統一サイズ1人称3D撮影
// ============================================================================
(function initAiCameraModule() {
  const SYS = window.AI_SYS;
  if (!SYS || !SYS.state) return;

  function getSafeRobotEyeHeight() {
    const sSpec = (typeof SIZE_SPECS !== 'undefined' && SIZE_SPECS[ROBOT.sizeLevel]) || { scaleY: 0.25 };
    if (ROBOT.posture === 'crawl') return Math.max(0.10, Math.min(0.15, 0.18 * sSpec.scaleY));
    return Math.max(0.12, Math.min(0.84, 0.52 * sSpec.scaleY));
  }

  function getFaceLookOffsets() {
    const f = (window.DIG && window.DIG.move && typeof window.DIG.move.getFaceDir === 'function')
      ? window.DIG.move.getFaceDir() : 'front';
    if (f === 'left')  return { yawOff:  Math.PI / 2, pitch: -0.10, tag: '顔:左' };
    if (f === 'right') return { yawOff: -Math.PI / 2, pitch: -0.10, tag: '顔:右' };
    if (f === 'up')    return { yawOff:  0,           pitch:  0.56, tag: '顔:上' };
    if (f === 'down')  return { yawOff:  0,           pitch: -0.66, tag: '顔:下' };
    return { yawOff: 0, pitch: -0.13, tag: '' };
  }

  if (typeof updateTransparencyAndOcclusion === 'function') {
    const _origUpdateTransparency = updateTransparencyAndOcclusion;
    updateTransparencyAndOcclusion = function(modeType, refCamPos, focusX, focusY, focusZ, targetFloorLv, lookDirX = 0, lookDirZ = 0) {
      if (modeType === 'robot_fpv') {
        const showLines = (typeof CAM_VISUAL_STYLE !== 'undefined' && CAM_VISUAL_STYLE === 'glass_line');
        if (typeof macroOutlineGroup !== 'undefined') macroOutlineGroup.visible = showLines;
        const inUndergroundFpv = (targetFloorLv < 0 || ROBOT.posture === 'crawl');
        if (typeof waterfallMesh !== 'undefined') waterfallMesh.visible = !inUndergroundFpv;
        if (typeof seaMesh !== 'undefined') seaMesh.visible = !inUndergroundFpv;
        if (typeof glassDepthMesh !== 'undefined') glassDepthMesh.visible = false;
        if (typeof glassSubMesh !== 'undefined') glassSubMesh.visible = false;

        let opaqueChanged = false;
        if (typeof subVoxelsMeta !== 'undefined' && typeof applyVoxelVisState === 'function') {
          for (let i = 0; i < subVoxelsMeta.length; i++) {
            if (applyVoxelVisState(subVoxelsMeta[i], 0, false)) opaqueChanged = true;
          }
        }
        if (typeof lastAppliedFrostedState !== 'undefined') lastAppliedFrostedState = false;
        if (opaqueChanged && typeof opaqueSubMesh !== 'undefined') {
          opaqueSubMesh.instanceMatrix.needsUpdate = true;
        }
        return;
      }
      return _origUpdateTransparency.apply(this, arguments);
    };
  }

  if (typeof updateAllCamerasTransform === 'function') {
    const _origUpdateAllCams = updateAllCamerasTransform;
    updateAllCamerasTransform = function() {
      _origUpdateAllCams.apply(this, arguments);
      if (typeof manualCameraMode !== 'undefined' && manualCameraMode === 'robot' &&
          typeof innerRobotCam !== 'undefined' && typeof robotGroup !== 'undefined') {
        const rot = ROBOT.rotY || 0;
        const face = getFaceLookOffsets();
        const lookYaw = rot + face.yawOff + (typeof fpvYawOffset === 'number' ? fpvYawOffset : 0);
        const manualPitch = (typeof fpvPitch === 'number' && Math.abs(fpvPitch + 0.06) > 0.02) ? fpvPitch : face.pitch;
        const lx = Math.sin(lookYaw), lz = Math.cos(lookYaw);
        const eyeX = robotGroup.position.x;
        const eyeY = robotGroup.position.y + getSafeRobotEyeHeight();
        const eyeZ = robotGroup.position.z;

        innerRobotCam.position.set(eyeX, eyeY, eyeZ);
        innerRobotCam.lookAt(
          eyeX + 20 * Math.cos(manualPitch) * lx,
          eyeY + 20 * Math.sin(manualPitch),
          eyeZ + 20 * Math.cos(manualPitch) * lz
        );
      }
    };
  }

  function rotToShortDirName(rot) {
    const x = Math.sin(rot), z = Math.cos(rot);
    const dirs = [
      { name: '北', x: 0, z: -1 }, { name: '北東', x: 0.7071, z: -0.7071 },
      { name: '東', x: 1, z: 0 }, { name: '南東', x: 0.7071, z: 0.7071 },
      { name: '南', x: 0, z: 1 }, { name: '南西', x: -0.7071, z: 0.7071 },
      { name: '西', x: -1, z: 0 }, { name: '北西', x: -0.7071, z: -0.7071 }
    ];
    let best = dirs[0], maxDot = -99;
    dirs.forEach(d => {
      const dot = d.x * x + d.z * z;
      if (dot > maxDot) { maxDot = dot; best = d; }
    });
    return best.name;
  }

  function getLogicalRobotWorldPos() {
    const sx = Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2;
    const sz = Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2;
    const rx = ROBOT.pos.x + (sx - 2) * 0.2;
    const rz = ROBOT.pos.z + (sz - 2) * 0.2;
    const bSpec = (typeof BODY_SPECS !== 'undefined' && BODY_SPECS[ROBOT.bodyType]) || { reqWidth: 1 };
    const ry = (typeof getSurfaceYAt === 'function')
      ? getSurfaceYAt(ROBOT.pos.x, ROBOT.pos.z, ROBOT.pos.lv, bSpec.reqWidth)
      : ((typeof robotGroup !== 'undefined') ? robotGroup.position.y : 0);
    return { rx, ry, rz };
  }

  function captureRobotFirstPersonImage(isMoving = SYS.state.lastTurnWasMoving, useLogicalPos = false, alwaysPanorama = true) {
    if (typeof renderer === 'undefined' || typeof scene === 'undefined' || typeof innerRobotCam === 'undefined') return null;
    try {
      const prevRobotVisible = (typeof robotGroup !== 'undefined') ? robotGroup.visible : true;
      const prevFov = innerRobotCam.fov;
      const prevAspect = innerRobotCam.aspect;
      const h = (typeof getRobotHeightLevel === 'function') ? getRobotHeightLevel() : (ROBOT.pos.lv || 0);
      const face = getFaceLookOffsets();
      const baseRot = (ROBOT.rotY || 0) + face.yawOff;
      const pitch = face.pitch;
      const eyeH = getSafeRobotEyeHeight();

      let rx = (typeof robotGroup !== 'undefined') ? robotGroup.position.x : ROBOT.pos.x;
      let ry = (typeof robotGroup !== 'undefined') ? robotGroup.position.y : 0;
      let rz = (typeof robotGroup !== 'undefined') ? robotGroup.position.z : ROBOT.pos.z;
      if (useLogicalPos) {
        const lp = getLogicalRobotWorldPos();
        rx = lp.rx; ry = lp.ry; rz = lp.rz;
      }

      const srcW = renderer.domElement.width || 360;
      const srcH = renderer.domElement.height || 640;
      const srcAspect = srcW / Math.max(1, srcH);
      if (typeof robotGroup !== 'undefined') robotGroup.visible = false;

      const singleOnly = (!alwaysPanorama && isMoving);
      const panelW = singleOnly ? 280 : 240;
      const panelH = singleOnly ? 340 : 300;
      const headerH = 26;
      const panelAspect = panelW / panelH;
      const targetHFovRad = (singleOnly ? 68 : 60) * (Math.PI / 180);

      let cropX = 0, cropY = 0, cropW = srcW, cropH = srcH;
      if (srcAspect > panelAspect) {
        cropW = Math.max(1, Math.round(srcH * panelAspect));
        cropX = Math.floor((srcW - cropW) / 2);
      } else {
        cropH = Math.max(1, Math.round(srcW / panelAspect));
        cropY = Math.floor((srcH - cropH) / 2);
      }
      const fullHalfTanX = Math.tan(targetHFovRad / 2) * (srcW / cropW);
      const vFovDeg = Math.min(135, Math.max(35, 2 * Math.atan(fullHalfTanX / srcAspect) * (180 / Math.PI)));

      const fSuffix = face.tag ? `/${face.tag}` : '';
      const shots = singleOnly
        ? [{ yaw: baseRot, label: `移動中・正面(${rotToShortDirName(baseRot)}${fSuffix})` }]
        : [
            { yaw: baseRot + Math.PI / 3, label: `左60°(${rotToShortDirName(baseRot + Math.PI / 3)})` },
            { yaw: baseRot,               label: `正面(${rotToShortDirName(baseRot)}${fSuffix})` },
            { yaw: baseRot - Math.PI / 3, label: `右60°(${rotToShortDirName(baseRot - Math.PI / 3)})` }
          ];

      const outCanvas = document.createElement('canvas');
      outCanvas.width = panelW * shots.length;
      outCanvas.height = panelH + headerH;
      const ctx = outCanvas.getContext('2d');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);

      innerRobotCam.fov = vFovDeg;
      innerRobotCam.aspect = srcAspect;
      innerRobotCam.updateProjectionMatrix();

      const eyeX = rx, eyeY = ry + eyeH, eyeZ = rz;
      const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
      shots.forEach((shot, idx) => {
        const lx = Math.sin(shot.yaw), lz = Math.cos(shot.yaw);
        innerRobotCam.position.set(eyeX, eyeY, eyeZ);
        innerRobotCam.lookAt(eyeX + 20 * cosP * lx, eyeY + 20 * sinP, eyeZ + 20 * cosP * lz);
        if (typeof updateTransparencyAndOcclusion === 'function') {
          updateTransparencyAndOcclusion('robot_fpv', innerRobotCam.position, rx, ry, rz, h, lx, lz);
        }
        renderer.render(scene, innerRobotCam);

        const destX = idx * panelW;
        ctx.drawImage(renderer.domElement, cropX, cropY, cropW, cropH, destX, headerH, panelW, panelH);
        ctx.fillStyle = (idx === 1 || singleOnly) ? '#0c4a6e' : '#1e293b';
        ctx.fillRect(destX, 0, panelW, headerH);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shot.label, destX + panelW / 2, headerH / 2);

        if (idx > 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(destX, 0); ctx.lineTo(destX, outCanvas.height); ctx.stroke();
        }
      });

      const dataUrl = outCanvas.toDataURL('image/jpeg', 0.80);
      innerRobotCam.fov = prevFov;
      innerRobotCam.aspect = prevAspect;
      innerRobotCam.updateProjectionMatrix();
      if (typeof robotGroup !== 'undefined') robotGroup.visible = prevRobotVisible;
      if (typeof updateAllCamerasTransform === 'function') updateAllCamerasTransform();
      if (typeof activeCamera !== 'undefined') renderer.render(scene, activeCamera);
      return dataUrl;
    } catch (e) {
      console.warn('captureRobotFirstPersonImage error:', e);
      return null;
    }
  }

  SYS.camera = { getSafeRobotEyeHeight, getFaceLookOffsets, rotToShortDirName, getLogicalRobotWorldPos, captureRobotFirstPersonImage };
  if (window.DebugGuard) window.DebugGuard.markLoaded('ai_camera.js');
})();
