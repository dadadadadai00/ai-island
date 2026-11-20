// ============================================================================
// 【純粋知覚・不変通信コア：ai_comm.js（1ターン答え合わせ＆コピペ・B案一時停止版）】
// ・設定ページでB案(画像AI送信)を暗転・使用停止し、A案(記号マップ)固定で検証（B案機能は内部温存）
// ・キャラ視点カメラ専用「1ターン答え合わせウィンドウ」（行動前3D画像＋送信文＋AI返答＋行動後3D画像）
// ・チャット貼り付け用「1ターン答え合わせコピペ」ボタン搭載（通常スクショと併用可能）
// ・キャラ視点（🤖視点＆検証カメラ共通）では未削り分割ブロックを全表示
// ・全モーダルウィンドウの非崩れピンチ拡大縮小（100%〜250%・開閉時自動100%リセット・3Dカメラ無変更）
// ※ index.html / brain.js / world.js / rules_dig.js は無改造のまま動作します
// ============================================================================
(function initImmutableAICommCore() {
  if (window.AICommCore) return;

  const GROQ_CHAT_URL   = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';
  const TIMEOUT_MS      = 22000;
  const TEXT_MODEL_CACHE_KEY   = 'groq_text_model_cache_v5';
  const VISION_MODEL_CACHE_KEY = 'groq_vision_model_cache_v5';
  const MANUAL_MODEL_KEY       = 'groq_manual_model_v1';
  const VISION_MODE_KEY        = 'ai_vision_mode_v1';
  const MAX_SHORT_MEMORY       = 4;

  // B案（画像AI送信）はA案の挙動が安定するまで一時停止（falseに戻すだけで即復活）
  const B_MODE_LOCKED = true;

  let commEnabled = (typeof safeStorage !== 'undefined') && (safeStorage.getItem('ai_comm_enabled') === '1');
  let visionMode  = B_MODE_LOCKED
    ? 'map'
    : ((typeof safeStorage !== 'undefined' && safeStorage.getItem(VISION_MODE_KEY) === 'image') ? 'image' : 'map');

  if (B_MODE_LOCKED && typeof safeStorage !== 'undefined') {
    safeStorage.setItem(VISION_MODE_KEY, 'map');
  }

  let cachedTextModels    = [];
  let cachedVisionModels  = [];
  let lastAllActiveModels = [];
  let lastTurnWasMoving   = false;
  let shortTermMemory     = [];
  let turnSequenceNo      = 0;

  const actionMap   = new Map();
  const bodySensors = [];
  const postHooks   = [];
  let visionProvider = null;

  // 直前1ターンの完全凍結スナップショット（送信前〜AI回答〜実行後をズレなく保持）
  let lastTurnAudit = {
    hasData: false,
    turnNo: 0,
    time: '未実行',
    day: 1,
    mode: 'map',
    isMovingBefore: false,
    isMovingAfter: false,
    modelId: '-',
    facingBefore: '-',
    facingAfter: '-',
    beforeImageUrl: null,
    afterImageUrl: null,
    promptText: '',
    rawResponse: '',
    parsedJson: null,
    actionId: '-',
    dirName: '-',
    emotionId: '-',
    motionLabel: '-',
    thoughtText: '',
    actionLabel: '-',
    physicalResult: '-',
    error: ''
  };

  let currentMonitorTab = 'audit'; // 'audit' | 'preview'

  // --------------------------------------------------------------------------
  // 0. キャラ視点カメラの「未削り分割ブロック全表示」＆めり込み防止フック
  //    ※ 通常追従カメラ・外カメラ（地上/地下）の透過ルールには一切触れません
  // --------------------------------------------------------------------------
  function getSafeRobotEyeHeight() {
    const sSpec = (typeof SIZE_SPECS !== 'undefined' && SIZE_SPECS[ROBOT.sizeLevel]) || { scaleY: 0.25 };
    if (ROBOT.posture === 'crawl') {
      return Math.max(0.10, Math.min(0.15, 0.18 * sSpec.scaleY));
    }
    return Math.max(0.12, Math.min(0.84, 0.52 * sSpec.scaleY));
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
        const lookYaw = rot + (typeof fpvYawOffset === 'number' ? fpvYawOffset : 0);
        const pitch = (typeof fpvPitch === 'number') ? fpvPitch : -0.06;
        const lookDirX = Math.sin(lookYaw);
        const lookDirZ = Math.cos(lookYaw);

        const eyeX = robotGroup.position.x;
        const eyeY = robotGroup.position.y + getSafeRobotEyeHeight();
        const eyeZ = robotGroup.position.z;

        innerRobotCam.position.set(eyeX, eyeY, eyeZ);
        innerRobotCam.lookAt(
          eyeX + 20 * Math.cos(pitch) * lookDirX,
          eyeY + 20 * Math.sin(pitch),
          eyeZ + 20 * Math.cos(pitch) * lookDirZ
        );
      }
    };
  }

  // --------------------------------------------------------------------------
  // 1. プラグイン登録API
  // --------------------------------------------------------------------------
  function registerAction(spec) {
    if (!spec || !spec.id || typeof spec.run !== 'function') return false;
    actionMap.set(spec.id, {
      id: String(spec.id),
      desc: String(spec.desc || spec.id),
      run: spec.run
    });
    return true;
  }

  function registerBodySensor(fn) {
    if (typeof fn === 'function') bodySensors.push(fn);
  }

  function registerSensor(fn) {
    registerBodySensor(fn);
  }

  function registerVisionProvider(fn) {
    if (typeof fn === 'function') visionProvider = fn;
  }

  function registerPostTurnHook(fn) {
    if (typeof fn === 'function') postHooks.push(fn);
  }

  function setEnabled(isOn) {
    commEnabled = Boolean(isOn);
    window.AI_COMM_ENABLED = commEnabled;
    if (typeof safeStorage !== 'undefined') {
      safeStorage.setItem('ai_comm_enabled', commEnabled ? '1' : '0');
    }
    const chk = document.getElementById('setting-ai-comm-toggle');
    if (chk) chk.checked = commEnabled;
    const label = document.getElementById('comm-toggle-label');
    if (label) {
      label.innerText = commEnabled
        ? '📡 通信 ON（Groq自律行動）'
        : '⏸️ 通信 OFF（完全停止・サイコロ廃止）';
    }
    if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
  }

  function isEnabled() { return commEnabled; }

  function setVisionMode(mode) {
    visionMode = B_MODE_LOCKED ? 'map' : ((mode === 'image') ? 'image' : 'map');
    if (typeof safeStorage !== 'undefined') {
      safeStorage.setItem(VISION_MODE_KEY, visionMode);
    }
    const sel = document.getElementById('setting-ai-vision-mode');
    if (sel) sel.value = visionMode;
    if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
  }

  function getVisionMode() { return visionMode; }
  function isMovingVision() { return lastTurnWasMoving; }

  function resetPhysicalHistory() {
    shortTermMemory = [];
    lastTurnWasMoving = false;
    turnSequenceNo = 0;
    lastTurnAudit.hasData = false;
  }

  // --------------------------------------------------------------------------
  // 2. キャラ視点3Dカメラ撮影（検証基準＆将来のB案送信兼用・未削りブロック全表示）
  // --------------------------------------------------------------------------
  function rotToShortDirName(rot) {
    const x = Math.sin(rot);
    const z = Math.cos(rot);
    const dirs = [
      { name: '北',   x: 0,       z: -1 },
      { name: '北東', x: 0.7071,  z: -0.7071 },
      { name: '東',   x: 1,       z: 0 },
      { name: '南東', x: 0.7071,  z: 0.7071 },
      { name: '南',   x: 0,       z: 1 },
      { name: '南西', x: -0.7071, z: 0.7071 },
      { name: '西',   x: -1,      z: 0 },
      { name: '北西', x: -0.7071, z: -0.7071 }
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

  function captureRobotFirstPersonImage(isMoving = lastTurnWasMoving, useLogicalPos = false) {
    if (typeof renderer === 'undefined' || typeof scene === 'undefined' || typeof innerRobotCam === 'undefined') {
      return null;
    }
    try {
      const prevRobotVisible = (typeof robotGroup !== 'undefined') ? robotGroup.visible : true;
      const prevFov    = innerRobotCam.fov;
      const prevAspect = innerRobotCam.aspect;

      const h = (typeof getRobotHeightLevel === 'function') ? getRobotHeightLevel() : (ROBOT.pos.lv || 0);
      const baseRot = ROBOT.rotY || 0;
      const eyeH = getSafeRobotEyeHeight();

      let rx = (typeof robotGroup !== 'undefined') ? robotGroup.position.x : ROBOT.pos.x;
      let ry = (typeof robotGroup !== 'undefined') ? robotGroup.position.y : 0;
      let rz = (typeof robotGroup !== 'undefined') ? robotGroup.position.z : ROBOT.pos.z;
      if (useLogicalPos) {
        const lp = getLogicalRobotWorldPos();
        rx = lp.rx;
        ry = lp.ry;
        rz = lp.rz;
      }

      const srcW = renderer.domElement.width || 360;
      const srcH = renderer.domElement.height || 640;
      const srcAspect = srcW / Math.max(1, srcH);

      if (typeof robotGroup !== 'undefined') robotGroup.visible = false;

      const panelW  = isMoving ? 280 : 240;
      const panelH  = isMoving ? 340 : 300;
      const headerH = 26;
      const panelAspect = panelW / panelH;
      const targetHFovRad = (isMoving ? 68 : 60) * (Math.PI / 180);

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

      const shots = isMoving
        ? [{ yaw: baseRot, label: `移動中・正面(${rotToShortDirName(baseRot)})` }]
        : [
            { yaw: baseRot + Math.PI / 3, label: `左60°(${rotToShortDirName(baseRot + Math.PI / 3)})` },
            { yaw: baseRot,               label: `正面(${rotToShortDirName(baseRot)})` },
            { yaw: baseRot - Math.PI / 3, label: `右60°(${rotToShortDirName(baseRot - Math.PI / 3)})` }
          ];

      const outCanvas = document.createElement('canvas');
      outCanvas.width  = panelW * shots.length;
      outCanvas.height = panelH + headerH;
      const ctx = outCanvas.getContext('2d');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);

      innerRobotCam.fov = vFovDeg;
      innerRobotCam.aspect = srcAspect;
      innerRobotCam.updateProjectionMatrix();

      const eyeX = rx;
      const eyeY = ry + eyeH;
      const eyeZ = rz;

      shots.forEach((shot, idx) => {
        const lx = Math.sin(shot.yaw);
        const lz = Math.cos(shot.yaw);

        innerRobotCam.position.set(eyeX, eyeY, eyeZ);
        innerRobotCam.lookAt(eyeX + 20 * lx, eyeY - 2.6, eyeZ + 20 * lz);

        if (typeof updateTransparencyAndOcclusion === 'function') {
          updateTransparencyAndOcclusion('robot_fpv', innerRobotCam.position, rx, ry, rz, h, lx, lz);
        }
        renderer.render(scene, innerRobotCam);

        const destX = idx * panelW;
        ctx.drawImage(renderer.domElement, cropX, cropY, cropW, cropH, destX, headerH, panelW, panelH);

        ctx.fillStyle = idx === 1 || isMoving ? '#0c4a6e' : '#1e293b';
        ctx.fillRect(destX, 0, panelW, headerH);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shot.label, destX + panelW / 2, headerH / 2);

        if (idx > 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(destX, 0);
          ctx.lineTo(destX, outCanvas.height);
          ctx.stroke();
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

  // --------------------------------------------------------------------------
  // 3. Groqモデル自動検出（実在アクティブモデル優先）
  // --------------------------------------------------------------------------
  function isUsableChatModel(id) {
    const s = String(id || '').toLowerCase();
    if (!s) return false;
    const ng = ['whisper', 'tts', 'playai', 'orpheus', 'guard', 'safeguard', 'moderation', 'embed', 'rerank', 'distil-whisper'];
    return !ng.some(w => s.includes(w));
  }

  function scoreVisionModel(id) {
    const s = String(id || '').toLowerCase();
    if (!isUsableChatModel(s)) return -1;
    if (s.includes('qwen3.8') || s.includes('qwen3.9') || s.includes('qwen4')) return 125;
    if (s.includes('vision')) return 105;
    if (s.includes('-vl') || s.includes('vl-')) return 100;
    if (s.includes('pixtral') || s.includes('llava') || s.includes('multimodal') || s.includes('omni')) return 95;
    if (s.includes('gemma-3') || s.includes('gemma3')) return 90;
    if (s.includes('qwen3')) return 85;
    return 0;
  }

  function scoreTextModel(id) {
    const s = String(id || '').toLowerCase();
    if (s.includes('gpt-oss-120b')) return 105;
    if (s.includes('llama-3.3') && s.includes('70b')) return 100;
    if (s.includes('qwen3.8')) return 96;
    if (s.includes('llama-3.1') && s.includes('8b')) return 92;
    if (s.includes('gpt-oss')) return 88;
    if (s.includes('qwen')) return 85;
    if (s.includes('llama')) return 80;
    return 50;
  }

  function getManualModelOverride() {
    if (typeof safeStorage === 'undefined') return '';
    return (safeStorage.getItem(MANUAL_MODEL_KEY) || '').trim();
  }

  async function fetchAvailableModels(key, wantVision, forceRefresh = false) {
    const manual = getManualModelOverride();
    if (!forceRefresh) {
      if (wantVision && cachedVisionModels.length) {
        return manual ? [manual, ...cachedVisionModels.filter(x => x !== manual)] : cachedVisionModels;
      }
      if (!wantVision && cachedTextModels.length) {
        return manual ? [manual, ...cachedTextModels.filter(x => x !== manual)] : cachedTextModels;
      }
    }

    const cacheKey = wantVision ? VISION_MODEL_CACHE_KEY : TEXT_MODEL_CACHE_KEY;
    const savedModel = (!forceRefresh && typeof safeStorage !== 'undefined')
      ? (safeStorage.getItem(cacheKey) || '').trim()
      : '';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    let allActive = [];
    try {
      const res = await fetch(GROQ_MODELS_URL, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${key}` },
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        allActive = (Array.isArray(json.data) ? json.data : [])
          .filter(m => m && m.id && m.active !== false && isUsableChatModel(m.id))
          .map(m => m.id);
        lastAllActiveModels = allActive.slice();
      }
    } catch (e) {
      clearTimeout(timer);
    }

    let ordered = [];
    if (allActive.length) {
      if (wantVision) {
        const high = allActive.filter(id => scoreVisionModel(id) > 0)
          .sort((a, b) => scoreVisionModel(b) - scoreVisionModel(a));
        const rest = allActive.filter(id => scoreVisionModel(id) <= 0)
          .sort((a, b) => scoreTextModel(b) - scoreTextModel(a));
        ordered = [...high, ...rest];
      } else {
        ordered = allActive.slice().sort((a, b) => scoreTextModel(b) - scoreTextModel(a));
      }
      if (savedModel && ordered.includes(savedModel)) {
        ordered = [savedModel, ...ordered.filter(x => x !== savedModel)];
      }
    } else {
      ordered = wantVision
        ? ['qwen/qwen3.8-27b']
        : ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
      if (savedModel) ordered = [savedModel, ...ordered.filter(x => x !== savedModel)];
    }

    if (wantVision) cachedVisionModels = ordered;
    else cachedTextModels = ordered;

    return manual ? [manual, ...ordered.filter(x => x !== manual)] : ordered;
  }

  function extractJsonFromText(raw) {
    if (!raw || typeof raw !== 'string') return null;
    try { return JSON.parse(raw); } catch (e) {}
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch (e) { return null; }
  }

  function getMotionDisplayName(emotionId) {
    try {
      if (typeof getExpressionSpec === 'function') {
        const spec = getExpressionSpec(emotionId);
        if (spec && spec.name) return `${spec.name} (${emotionId})`;
      }
      if (typeof POSE_TABLE !== 'undefined' && POSE_TABLE[emotionId] && POSE_TABLE[emotionId].name) {
        return `${POSE_TABLE[emotionId].name} (${emotionId})`;
      }
    } catch (e) {}
    return String(emotionId || 'normal');
  }

  // --------------------------------------------------------------------------
  // 4. 純粋知覚プロンプト組み立て（視覚＋身体感覚＋直近4ターン記憶）
  // --------------------------------------------------------------------------
  function collectBodyText() {
    const lines = [];
    for (let i = 0; i < bodySensors.length; i++) {
      try {
        const res = bodySensors[i]();
        if (typeof res === 'string' && res.trim()) lines.push(res.trim());
      } catch (e) {
        console.warn('AICommCore bodySensor error:', e);
      }
    }
    return lines.join('\n');
  }

  function formatShortTermMemory() {
    if (!shortTermMemory.length) return 'なし（開始直後）';
    return shortTermMemory.map((m, idx) => {
      const ago = shortTermMemory.length - idx;
      const tag = ago === 1 ? '直前' : `${ago}ターン前`;
      return `- ${tag}: [${m.action}(${m.dir})] 思考「${m.thought}」→ 結果: ${m.result}`;
    }).join('\n');
  }

  function buildPerceptionPayload(targetMode = visionMode, isMoving = lastTurnWasMoving) {
    const effectiveMode = B_MODE_LOCKED ? 'map' : targetMode;
    const actions = Array.from(actionMap.values());
    const actionIds   = actions.map(a => a.id).join('/');
    const actionsText = actions.map(a => `- ${a.id}: ${a.desc}`).join('\n');
    const bodyText    = collectBodyText();
    const memoryText  = formatShortTermMemory();

    // 検証用のキャラ視点3D画像はA案時でも答え合わせ基準として撮影（AIへはB案解放時のみ送信）
    const fpvImageUrl = captureRobotFirstPersonImage(isMoving, true);
    let visionSection = '';
    let sendImageUrl  = null;

    if (effectiveMode === 'image') {
      sendImageUrl = fpvImageUrl;
      if (sendImageUrl) {
        visionSection = isMoving
          ? '【移動直後・狭い前方視野】添付の1人称カメラ画像（正面1枚）が、今あなたの目に見えている視界のすべてです。'
          : '【停止中・180度パノラマ視野】首を左右に振って見渡した「左60°・正面・右60°」の3連180度パノラマ画像が、今あなたの目に見えている視界のすべてです（背後は死角）。';
      } else {
        visionSection = '（1人称カメラ画像の取得に失敗しました）';
      }
    } else {
      visionSection = (typeof visionProvider === 'function')
        ? String(visionProvider({ isMoving }) || '（視界データなし）')
        : '（視界モジュール未接続）';
    }

    const promptText = `あなたはこの3Dブロック空間の中にいる1体の存在です。
以下の知覚情報（視覚・身体感覚・直近の記憶）だけをもとに、次の行動を1つ自分で決めてください。

【視覚（今見えている範囲のみ）】
${visionSection}

【身体感覚・所持状態】
${bodyText}

【直近の記憶（自分の思考と物理結果）】
${memoryText}

【物理アクション】
${actionsText}

以下のJSON形式のみで返答してください（前置き・解説禁止）:
{"action":"${actionIds}","dir":"北/南/東/西/北西/北東/南西/南東","emotion":"normal/joy/anger/sad/fun/fear/think/surprise/wave/sleep/swing_v/pickup/carry/push/run/peek/struggle","thought":"知覚した事実や意図を短い1文で"}`;

    return {
      promptText,
      sendImageUrl,
      fpvImageUrl,
      mode: effectiveMode,
      isMoving,
      actionsCount: actions.length
    };
  }

  async function callGroqApi(key, modelId, promptText, sendImageUrl, useJsonFormat) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const userContent = sendImageUrl
        ? [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: { url: sendImageUrl } }
          ]
        : promptText;

      const body = {
        model: modelId,
        messages: [{ role: 'user', content: userContent }],
        max_tokens: 320,
        temperature: 0.75
      };
      if (useJsonFormat && !sendImageUrl) {
        body.response_format = { type: 'json_object' };
      }

      const res = await fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        let errDetail = '';
        try {
          const errJson = await res.json();
          errDetail = errJson?.error?.message || '';
        } catch (e) {}
        return { ok: false, status: res.status, detail: errDetail };
      }

      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || '';
      const parsed = extractJsonFromText(raw);
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, status: 200, detail: 'JSON解析失敗', raw };
      }
      return { ok: true, data: parsed, raw, modelId };
    } catch (e) {
      clearTimeout(timer);
      return {
        ok: false,
        status: 0,
        detail: e.name === 'AbortError' ? 'タイムアウト' : (e.message || '通信エラー')
      };
    }
  }

  async function requestDecision(payload) {
    const key = (typeof safeStorage !== 'undefined') ? (safeStorage.getItem('api_groq') || '').trim() : '';
    if (!key) return { ok: false, reason: 'Groq APIキー未設定' };

    if (!payload.actionsCount) return { ok: false, reason: '実行可能なアクション未登録' };
    if (payload.mode === 'image' && !payload.sendImageUrl) {
      return { ok: false, reason: 'B案(3Dカメラ画像)のキャプチャに失敗しました' };
    }

    const wantVision = (payload.mode === 'image');
    const cacheKey   = wantVision ? VISION_MODEL_CACHE_KEY : TEXT_MODEL_CACHE_KEY;
    let models = await fetchAvailableModels(key, wantVision, false);
    let lastError = '';
    let lastRaw   = '';
    let triedModels = [];

    const maxTries = Math.min(models.length, 6);
    for (let i = 0; i < maxTries; i++) {
      const mId = models[i];
      triedModels.push(mId);
      let res = await callGroqApi(key, mId, payload.promptText, payload.sendImageUrl, !wantVision);
      if (!res.ok && res.status === 400 && !wantVision) {
        res = await callGroqApi(key, mId, payload.promptText, null, false);
      }

      if (res.ok) {
        if (typeof safeStorage !== 'undefined') safeStorage.setItem(cacheKey, mId);
        return res;
      }

      lastError = `[${mId}] HTTP ${res.status}${res.detail ? ': ' + res.detail : ''}`;
      if (res.raw) lastRaw = res.raw;

      if (res.status === 401 || res.status === 429) break;
      if (res.status === 404 && i === 0 && !getManualModelOverride()) {
        if (typeof safeStorage !== 'undefined') safeStorage.removeItem(cacheKey);
        const refreshed = await fetchAvailableModels(key, wantVision, true);
        if (refreshed.length) {
          models = refreshed.filter(x => !triedModels.includes(x));
          i = -1;
          continue;
        }
      }
    }

    const availNote = lastAllActiveModels.length
      ? `\n利用可能モデル(${lastAllActiveModels.length}件): ${lastAllActiveModels.slice(0, 10).join(', ')}`
      : '\n（/models一覧を取得できませんでした）';
    return {
      ok: false,
      reason: `${lastError || '通信失敗'}${availNote}`,
      lastRaw,
      lastModelId: triedModels[triedModels.length - 1] || '-'
    };
  }

  function findDirByShortName(name) {
    if (!name || typeof ALL_DIRS === 'undefined') return ALL_DIRS[0];
    return ALL_DIRS.find(d => d.name.replace('(斜め)', '') === name || d.name === name) || ALL_DIRS[0];
  }

  function showStopMessage(title, detail) {
    const actEl = document.getElementById('history-action');
    const msgEl = document.getElementById('message-box');
    const stEl  = document.getElementById('ai-status');
    if (actEl) actEl.innerText = title;
    if (msgEl) msgEl.innerText = detail;
    if (stEl)  stEl.innerText  = getActiveBrainBadgeText();
    if (typeof showToast === 'function') showToast(title);
  }

  // --------------------------------------------------------------------------
  // 5. ターン実行制御（送信前・AI返答・実行後の1ターン完全スナップショット保存）
  // --------------------------------------------------------------------------
  async function runTurn() {
    if (!commEnabled) {
      showStopMessage(
        '⏸️ 通信OFF（待機中）',
        '通信OFFのため停止しています（サイコロ思考廃止済み）。⚙️設定で通信ONにしてください。'
      );
      return;
    }

    const btn  = document.getElementById('btn-action');
    const stEl = document.getElementById('ai-status');
    if (btn) btn.disabled = true;
    if (stEl) stEl.innerText = '🟪 Groq思考中...';

    try {
      const isMovingBefore = lastTurnWasMoving;
      const facingBefore = rotToShortDirName(ROBOT.rotY || 0);
      const payload = buildPerceptionPayload(visionMode, isMovingBefore);

      const res = await requestDecision(payload);
      if (!res.ok) {
        lastTurnAudit = {
          hasData: true,
          turnNo: turnSequenceNo + 1,
          time: new Date().toLocaleTimeString('ja-JP'),
          day: typeof GAME_DAY !== 'undefined' ? GAME_DAY : 1,
          mode: payload.mode,
          isMovingBefore,
          isMovingAfter: isMovingBefore,
          modelId: res.lastModelId || '-',
          facingBefore,
          facingAfter: facingBefore,
          beforeImageUrl: payload.fpvImageUrl,
          afterImageUrl: null,
          promptText: payload.promptText,
          rawResponse: res.lastRaw || '-',
          parsedJson: null,
          actionId: '-',
          dirName: '-',
          emotionId: '-',
          motionLabel: '-',
          thoughtText: '',
          actionLabel: '⚠️ 通信エラー（行動なし）',
          physicalResult: '通信失敗のため行動なし',
          error: res.reason
        };
        showStopMessage(
          '⚠️ Groq通信停止（行動なし）',
          `通信できなかったためロボットは動かずに待機しました。\n理由：${res.reason}`
        );
        return;
      }

      turnSequenceNo++;
      if (++TIME_STEP >= 20) {
        TIME_STEP = 0;
        GAME_DAY++;
        DIARY_LOGS.push(`🌅 ${GAME_DAY}日目の朝を迎えた`);
      }

      const dec = res.data;
      const prevPos = { x: ROBOT.pos.x, z: ROBOT.pos.z, lv: ROBOT.pos.lv };
      const dir = findDirByShortName(dec.dir);
      const dirShort = dir.name.replace('(斜め)', '');
      const chosenAction = actionMap.get(dec.action) || actionMap.get('rest') || Array.from(actionMap.values())[0];

      let thoughtText = (typeof dec.thought === 'string' && dec.thought.trim())
        ? dec.thought.trim()
        : '（無言で行動した）';
      let actionLabel = `🟪 ${chosenAction.id}`;
      let physResult  = `${chosenAction.id}(${dirShort})を実行した`;
      let out = null;

      try {
        out = chosenAction.run({ dec, dir, prevPos });
        if (out && out.actionLabel) actionLabel = out.actionLabel;
        if (out && out.physicalResult) physResult = out.physicalResult;
        else if (out && out.actionLabel) physResult = out.actionLabel;
      } catch (e) {
        console.warn('AICommCore action execution error:', e);
        physResult = '行動処理中にエラーが発生した';
      }

      lastTurnWasMoving = Boolean(chosenAction.id === 'move' && out && out.moved === true);

      shortTermMemory.push({
        action: chosenAction.id,
        dir: dirShort,
        thought: thoughtText,
        result: physResult
      });
      if (shortTermMemory.length > MAX_SHORT_MEMORY) {
        shortTermMemory.shift();
      }

      ROBOT.emotion = (typeof POSE_TABLE !== 'undefined' && POSE_TABLE[dec.emotion]) ? dec.emotion : 'normal';
      ROBOT.bulbEmotion = null;
      if (OBS_MODE === 'ai_mode') AI_MEMORY.push(physResult);
      DIARY_LOGS.push(`🟪 ${GAME_DAY}日目：${actionLabel}`);

      const actEl = document.getElementById('history-action');
      const msgEl = document.getElementById('message-box');
      if (actEl) actEl.innerText = actionLabel;
      if (msgEl) msgEl.innerText = thoughtText;

      let switchedArea = false;
      for (let i = 0; i < postHooks.length; i++) {
        try {
          const hookRes = postHooks[i]({ dec, dir, prevPos, out });
          if (hookRes && hookRes.switchedArea) { switchedArea = true; break; }
        } catch (e) {
          console.warn('AICommCore postHook error:', e);
        }
      }

      const finalEmotionId = ROBOT.emotion || dec.emotion || 'normal';
      const motionLabel = getMotionDisplayName(finalEmotionId);

      if (!switchedArea) {
        if (typeof manualCameraMode !== 'undefined' && manualCameraMode === 'robot' && typeof resetFpvToRobotFront === 'function') {
          resetFpvToRobotFront();
        }
        if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
        if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
        if (typeof applyRobotBulbColor === 'function') applyRobotBulbColor();
        if (typeof cameraDirty !== 'undefined') cameraDirty = true;
        if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
        if (typeof saveWorldState === 'function') saveWorldState();
      }

      // 行動後の最新地形・最新位置から答え合わせ用のキャラ視点3D画像を撮影
      const afterImageUrl = captureRobotFirstPersonImage(lastTurnWasMoving, true);
      const facingAfter = rotToShortDirName(ROBOT.rotY || 0);

      lastTurnAudit = {
        hasData: true,
        turnNo: turnSequenceNo,
        time: new Date().toLocaleTimeString('ja-JP'),
        day: typeof GAME_DAY !== 'undefined' ? GAME_DAY : 1,
        mode: payload.mode,
        isMovingBefore,
        isMovingAfter: lastTurnWasMoving,
        modelId: res.modelId || '-',
        facingBefore,
        facingAfter,
        beforeImageUrl: payload.fpvImageUrl,
        afterImageUrl,
        promptText: payload.promptText,
        rawResponse: res.raw || '-',
        parsedJson: dec,
        actionId: chosenAction.id,
        dirName: dirShort,
        emotionId: finalEmotionId,
        motionLabel,
        thoughtText,
        actionLabel,
        physicalResult: physResult,
        error: ''
      };

      if (switchedArea) return;

      if (life.getState().mode === 'DEAD') {
        ROBOT.emotion = 'sad';
        if (msgEl) msgEl.innerText = `力尽きた。第${ROBOT.gen + 1}世代へ移行します。`;
        setTimeout(() => {
          ROBOT.gen += 1;
          life = new LifeCore();
          GAME_DAY = 1; TIME_STEP = 0; AI_MEMORY = [];
          resetPhysicalHistory();
          if (typeof window.switchAreaById === 'function') {
            window.switchAreaById('home', true);
          } else {
            ROBOT.pos = { x: 0, z: 0, lv: -1, sx: 2, sz: 2 };
            if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
            if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition(true);
            if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
            if (typeof saveWorldState === 'function') saveWorldState();
          }
        }, 1800);
      }
    } finally {
      setTimeout(() => {
        if (stEl) stEl.innerText = getActiveBrainBadgeText();
        if (typeof applyRobotBulbColor === 'function') applyRobotBulbColor();
        if (btn) btn.disabled = false;
      }, 220);
    }
  }

  // --------------------------------------------------------------------------
  // 6. 1ターン答え合わせコピペ用テキスト生成 ＆ クリップボードコピー
  // --------------------------------------------------------------------------
  function buildTurnCopyText() {
    if (!lastTurnAudit.hasData) {
      const p = buildPerceptionPayload('map', lastTurnWasMoving);
      return [
        '=== 【通信前プレビュー（まだ1ターン未実行）】 ===',
        `視野状態: ${p.isMoving ? '移動直後(狭い前方視野)' : '停止中(180°パノラマ視野)'}`,
        `向いている方角: ${rotToShortDirName(ROBOT.rotY || 0)}`,
        '',
        '【送信予定の情報文】',
        p.promptText
      ].join('\n');
    }

    const a = lastTurnAudit;
    const lines = [
      `=== 【1ターン答え合わせレポート】第${a.turnNo}ターン（${a.day}日目 / ${a.time}）===`,
      `通信方式: A案(記号マップ送信) / 使用モデル: ${a.modelId}`,
      `視野状態: 行動前=${a.isMovingBefore ? '移動直後(前方視野)' : '停止中(180°パノラマ)'}（向き:${a.facingBefore}） → 行動後=${a.isMovingAfter ? '移動直後(前方視野)' : '停止中(180°パノラマ)'}（向き:${a.facingAfter}）`,
      '',
      '--- [1] AIへ送信した情報文（行動前） ---',
      a.promptText || '(なし)',
      '',
      '--- [2] AIからの返答（判断・しゃべり・動き） ---'
    ];

    if (a.error) {
      lines.push(`エラー: ${a.error}`);
      lines.push(`生データ: ${a.rawResponse || '-'}`);
    } else {
      lines.push(`思考・しゃべり: ${a.thoughtText}`);
      lines.push(`選んだ行動: ${a.actionId}`);
      lines.push(`選んだ方角: ${a.dirName}`);
      lines.push(`表情・動き(モーション): ${a.motionLabel}`);
      lines.push(`生返答JSON: ${a.rawResponse}`);
    }

    lines.push('');
    lines.push('--- [3] 実行後の物理結果 ---');
    lines.push(`画面表示ログ: ${a.actionLabel}`);
    lines.push(`物理結果: ${a.physicalResult}`);
    lines.push('================================================');
    return lines.join('\n');
  }

  async function copyTextToClipboard(text) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed; top:-9999px; left:-9999px; opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // 7. 全モーダルウィンドウの非崩れピンチ拡大縮小（transform: scale + 1本指パン）
  // --------------------------------------------------------------------------
  const modalResetFns = [];

  function resetAllModalZooms() {
    modalResetFns.forEach(fn => {
      try { fn(); } catch (e) {}
    });
  }

  function attachPinchZoomToModal(overlay) {
    if (!overlay || overlay.dataset.pinchBound === '2') return;
    const content = overlay.querySelector('.modal-content');
    if (!content) return;
    overlay.dataset.pinchBound = '2';

    const MIN_SCALE = 1.0;
    const MAX_SCALE = 2.5;

    let scale = 1.0;
    let panX  = 0;
    let panY  = 0;

    let pinchActive = false;
    let startDist = 0;
    let startScale = 1.0;
    let startPanX = 0;
    let startPanY = 0;
    let startMidX = 0;
    let startMidY = 0;

    let panDragActive = false;
    let panDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragInitPanX = 0;
    let dragInitPanY = 0;

    content.style.transformOrigin = 'center center';
    content.style.willChange = 'transform';

    const badge = document.createElement('button');
    badge.type = 'button';
    badge.style.cssText = 'position:fixed; bottom:18px; right:18px; z-index:9999; display:none; padding:6px 12px; border-radius:999px; border:1.5px solid #38bdf8; background:rgba(15,23,42,0.92); color:#f8fafc; font-size:11.5px; font-weight:900; box-shadow:0 4px 14px rgba(0,0,0,0.35); cursor:pointer;';
    badge.title = 'タップで元の100%サイズへ戻す';
    overlay.appendChild(badge);

    function clampPan(nextPanX, nextPanY, nextScale) {
      if (nextScale <= 1.001) return { x: 0, y: 0 };
      const baseW = content.offsetWidth || Math.min(window.innerWidth * 0.92, 420);
      const baseH = content.offsetHeight || (window.innerHeight * 0.85);
      const maxX = Math.max(20, (baseW * nextScale - window.innerWidth) / 2 + 28);
      const maxY = Math.max(20, (baseH * nextScale - window.innerHeight) / 2 + 48);
      return {
        x: Math.max(-maxX, Math.min(maxX, nextPanX)),
        y: Math.max(-maxY, Math.min(maxY, nextPanY))
      };
    }

    function applyTransform(nextScale, nextPanX, nextPanY) {
      let s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
      if (s < 1.03) {
        scale = 1.0;
        panX = 0;
        panY = 0;
        content.style.zoom = '';
        content.style.transform = '';
        badge.style.display = 'none';
        return;
      }
      const clamped = clampPan(nextPanX, nextPanY, s);
      scale = s;
      panX = clamped.x;
      panY = clamped.y;
      content.style.zoom = '';
      content.style.transform = `translate3d(${panX.toFixed(1)}px, ${panY.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      badge.style.display = 'block';
      badge.innerText = `🔍 ${Math.round(scale * 100)}%（元に戻す）`;
    }

    function resetZoom() {
      pinchActive = false;
      panDragActive = false;
      panDragging = false;
      applyTransform(1.0, 0, 0);
    }

    modalResetFns.push(resetZoom);

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      resetZoom();
    });

    let prevVisible = overlay.classList.contains('active') || (overlay.style.display && overlay.style.display !== 'none');
    const visObserver = new MutationObserver(() => {
      const nowVisible = overlay.classList.contains('active') || (overlay.style.display && overlay.style.display !== 'none');
      if (nowVisible !== prevVisible) {
        prevVisible = nowVisible;
        resetZoom();
      }
    });
    visObserver.observe(overlay, { attributes: true, attributeFilter: ['style', 'class'] });

    overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
    overlay.addEventListener('pointermove', (e) => e.stopPropagation());
    overlay.addEventListener('pointerup',   (e) => e.stopPropagation());
    overlay.addEventListener('wheel',       (e) => e.stopPropagation(), { passive: true });

    overlay.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        pinchActive = true;
        panDragActive = false;
        panDragging = false;
        const t0 = e.touches[0], t1 = e.touches[1];
        startDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY) || 1;
        startMidX = (t0.clientX + t1.clientX) / 2;
        startMidY = (t0.clientY + t1.clientY) / 2;
        startScale = scale;
        startPanX = panX;
        startPanY = panY;
      } else if (e.touches.length === 1 && scale > 1.01) {
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
        if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
        panDragActive = true;
        panDragging = false;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        dragInitPanX = panX;
        dragInitPanY = panY;
      }
    }, { passive: true });

    overlay.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && pinchActive) {
        e.preventDefault();
        e.stopPropagation();
        const t0 = e.touches[0], t1 = e.touches[1];
        const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        const curMidX = (t0.clientX + t1.clientX) / 2;
        const curMidY = (t0.clientY + t1.clientY) / 2;
        const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, startScale * (dist / startDist)));
        const ratio = nextScale / startScale;

        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const nextPanX = (curMidX - cx) - ((startMidX - cx) - startPanX) * ratio;
        const nextPanY = (curMidY - cy) - ((startMidY - cy) - startPanY) * ratio;

        applyTransform(nextScale, nextPanX, nextPanY);
        return;
      }

      if (e.touches.length === 1 && panDragActive && scale > 1.01) {
        const dx = e.touches[0].clientX - dragStartX;
        const dy = e.touches[0].clientY - dragStartY;
        if (!panDragging && Math.hypot(dx, dy) > 8) {
          panDragging = true;
        }
        if (panDragging) {
          e.preventDefault();
          e.stopPropagation();
          applyTransform(scale, dragInitPanX + dx, dragInitPanY + dy);
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      if (!e.touches || e.touches.length < 2) pinchActive = false;
      if (!e.touches || e.touches.length === 0) {
        panDragActive = false;
        panDragging = false;
      }
    };
    overlay.addEventListener('touchend', endTouch, { passive: true });
    overlay.addEventListener('touchcancel', endTouch, { passive: true });
  }

  function enablePinchZoomOnAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(attachPinchZoomToModal);
    const sideCol = document.getElementById('side-icon-column');
    if (sideCol && sideCol.dataset.resetHookBound !== '1') {
      sideCol.dataset.resetHookBound = '1';
      sideCol.addEventListener('click', () => resetAllModalZooms(), true);
    }
  }

  // --------------------------------------------------------------------------
  // 8. 設定UI（B案暗転・使用停止）＆ 👁️ キャラ視点1ターン答え合わせモーダル
  // --------------------------------------------------------------------------
  function renderMonitorModal(tab = currentMonitorTab, previewMovingOverride = null) {
    currentMonitorTab = tab;

    const tabAuditBtn   = document.getElementById('btn-tab-audit');
    const tabPreviewBtn = document.getElementById('btn-tab-preview');
    const auditPane     = document.getElementById('vision-pane-audit');
    const previewPane   = document.getElementById('vision-pane-preview');

    if (tabAuditBtn && tabPreviewBtn) {
      const isAudit = (tab === 'audit');
      tabAuditBtn.style.background   = isAudit ? '#0284c7' : '#e2e8f0';
      tabAuditBtn.style.color        = isAudit ? '#ffffff' : '#334155';
      tabPreviewBtn.style.background = !isAudit ? '#0284c7' : '#e2e8f0';
      tabPreviewBtn.style.color      = !isAudit ? '#ffffff' : '#334155';
    }
    if (auditPane)   auditPane.style.display   = (tab === 'audit') ? 'flex' : 'none';
    if (previewPane) previewPane.style.display = (tab === 'preview') ? 'flex' : 'none';

    // --- タブ1：直前1ターンの答え合わせ ---
    if (tab === 'audit') {
      const metaEl     = document.getElementById('audit-meta');
      const emptyEl    = document.getElementById('audit-empty-notice');
      const bodyEl     = document.getElementById('audit-body');
      const beforeWrap = document.getElementById('audit-before-img-wrap');
      const beforeLbl  = document.getElementById('audit-before-img-label');
      const beforeImg  = document.getElementById('audit-before-img');
      const promptEl   = document.getElementById('audit-prompt');
      const summaryEl  = document.getElementById('audit-reply-summary');
      const rawEl      = document.getElementById('audit-raw-json');
      const resultEl   = document.getElementById('audit-phys-result');
      const afterWrap  = document.getElementById('audit-after-img-wrap');
      const afterLbl   = document.getElementById('audit-after-img-label');
      const afterImg   = document.getElementById('audit-after-img');

      if (!lastTurnAudit.hasData) {
        if (metaEl)  metaEl.innerText = 'まだ通信ターンが実行されていません（「⚡ 今すぐ考える」を押すと1ターン分の答え合わせが記録されます）';
        if (emptyEl) emptyEl.style.display = 'block';
        if (bodyEl)  bodyEl.style.display  = 'none';
        return;
      }

      if (emptyEl) emptyEl.style.display = 'none';
      if (bodyEl)  bodyEl.style.display  = 'flex';

      const a = lastTurnAudit;
      if (metaEl) {
        const beforeState = a.isMovingBefore ? '🏃移動前方' : '🧍停止180°';
        const afterState  = a.isMovingAfter  ? '🏃移動前方' : '🧍停止180°';
        metaEl.innerText = `第${a.turnNo}ターン(${a.day}日目 ${a.time}) ／ A案送信 ／ ${a.modelId} ／ 視野:${beforeState}(${a.facingBefore})→${afterState}(${a.facingAfter})`;
      }

      if (beforeWrap && beforeImg) {
        if (a.beforeImageUrl) {
          beforeWrap.style.display = 'block';
          if (beforeLbl) {
            beforeLbl.innerText = `📷 送信前のキャラ視点3D（確認用・AI未送信 ／ ${a.isMovingBefore ? '移動前方' : '停止180°'}・向き:${a.facingBefore}）`;
          }
          beforeImg.src = a.beforeImageUrl;
        } else {
          beforeWrap.style.display = 'none';
        }
      }

      if (promptEl) promptEl.textContent = a.promptText || '';

      if (summaryEl) {
        if (a.error) {
          summaryEl.innerHTML = `<div style="color:#dc2626; font-weight:900;">⚠️ 通信エラー：${a.error.replace(/\n/g, '<br>')}</div>`;
        } else {
          summaryEl.innerHTML = `
            <div><strong>💬 思考・しゃべり：</strong>${a.thoughtText}</div>
            <div><strong>🎯 行動 / 方角：</strong><code>${a.actionId}</code> ／ <strong>${a.dirName}</strong></div>
            <div><strong>🤖 動き・モーション：</strong>${a.motionLabel}</div>
          `;
        }
      }

      if (rawEl) rawEl.textContent = a.rawResponse || '-';
      if (resultEl) {
        resultEl.innerHTML = `
          <div><strong>📌 画面ログ：</strong>${a.actionLabel}</div>
          <div><strong>🧱 物理結果：</strong>${a.physicalResult}</div>
        `;
      }

      if (afterWrap && afterImg) {
        if (a.afterImageUrl) {
          afterWrap.style.display = 'block';
          if (afterLbl) {
            afterLbl.innerText = `📷 実行後のキャラ視点3D（確認用・AI未送信 ／ ${a.isMovingAfter ? '移動前方' : '停止180°'}・向き:${a.facingAfter}）`;
          }
          afterImg.src = a.afterImageUrl;
        } else {
          afterWrap.style.display = 'none';
        }
      }
      return;
    }

    // --- タブ2：次の送信プレビュー（通信前チェック） ---
    const useMoving = (previewMovingOverride === null) ? lastTurnWasMoving : Boolean(previewMovingOverride);
    const p = buildPerceptionPayload('map', useMoving);
    const pMeta   = document.getElementById('preview-meta');
    const pImgWr  = document.getElementById('preview-img-wrap');
    const pImgLbl = document.getElementById('preview-img-label');
    const pImg    = document.getElementById('preview-img');
    const pPrompt = document.getElementById('preview-prompt');

    if (pMeta) {
      const stateLabel = p.isMoving ? '🏃移動中(狭い前方視野)' : '🧍停止中(180°パノラマ)';
      pMeta.innerText = `通信なしプレビュー ／ A案送信予定 ／ ${stateLabel} ／ 向き:${rotToShortDirName(ROBOT.rotY || 0)}`;
    }
    if (pImgWr && pImg) {
      if (p.fpvImageUrl) {
        pImgWr.style.display = 'block';
        if (pImgLbl) {
          pImgLbl.innerText = p.isMoving
            ? '📷 現在のキャラ視点3D（確認用・AI未送信 ／ 移動前方・未削り全表示）'
            : '📷 現在のキャラ視点3D（確認用・AI未送信 ／ 停止180°・未削り全表示）';
        }
        pImg.src = p.fpvImageUrl;
      } else {
        pImgWr.style.display = 'none';
      }
    }
    if (pPrompt) pPrompt.textContent = p.promptText || '';
  }

  function openVisionMonitor(initialTab = null) {
    const modal = document.getElementById('modal-ai-vision');
    if (!modal) return;
    resetAllModalZooms();
    const tab = initialTab || (lastTurnAudit.hasData ? 'audit' : 'preview');
    renderMonitorModal(tab, null);
    modal.style.display = 'flex';
    modal.classList.add('active');
  }

  function closeVisionMonitor() {
    const modal = document.getElementById('modal-ai-vision');
    if (!modal) return;
    resetAllModalZooms();
    modal.style.display = 'none';
    modal.classList.remove('active');
  }

  function injectVisionControlsUI() {
    const settingsModal = document.getElementById('modal-settings');
    if (settingsModal && !document.getElementById('setting-ai-vision-mode')) {
      const commCard = settingsModal.querySelector('.comm-toggle-card');
      const group = document.createElement('div');
      group.className = 'setting-group';
      group.style.cssText = 'background:#f0f9ff; border:1.5px solid #7dd3fc; border-radius:12px; padding:8px 10px; gap:6px;';
      group.innerHTML = `
        <label class="setting-label" style="color:#0369a1;">👁️ AIキャラ視点情報（送信方式）</label>
        <select id="setting-ai-vision-mode" class="setting-input">
          <option value="map">A案：前方視野の記号マップ（使用中・距離正確）</option>
          <option value="image" ${B_MODE_LOCKED ? 'disabled' : ''}>${B_MODE_LOCKED ? '🔒 B案：キャラ視点3Dカメラ画像（A案安定まで使用停止）' : 'B案：キャラ視点3Dカメラ画像（停止180°／移動前方）'}</option>
        </select>
        ${B_MODE_LOCKED ? `
        <div style="background:#334155; color:#94a3b8; border:1px solid #475569; border-radius:8px; padding:6px 8px; font-size:10.5px; font-weight:800; opacity:0.85;">
          🔒 B案（3Dカメラ画像のAI送信）：使用停止中（機能は非表示で温存・A案の挙動が安定次第解放）
        </div>` : ''}
        <label class="setting-label" style="color:#0369a1; margin-top:2px;">🤖 Groqモデル手動指定（空欄で自動検出）</label>
        <input id="setting-groq-manual-model" type="text" class="setting-input" placeholder="例: openai/gpt-oss-120b（空欄推奨）">
        <button type="button" id="btn-open-vision-mon-from-settings" class="btn-sub" style="padding:6px; font-size:11px;">👁️ 1ターン答え合わせ・キャラ視点を確認する</button>
      `;
      if (commCard && commCard.parentNode) {
        commCard.parentNode.insertBefore(group, commCard.nextSibling);
      }
      const sel = document.getElementById('setting-ai-vision-mode');
      if (sel) {
        sel.value = visionMode;
        sel.addEventListener('change', () => setVisionMode(sel.value));
      }
      const manualInput = document.getElementById('setting-groq-manual-model');
      if (manualInput) {
        manualInput.value = getManualModelOverride();
        manualInput.addEventListener('change', () => {
          const val = manualInput.value.trim();
          if (typeof safeStorage !== 'undefined') {
            if (val) safeStorage.setItem(MANUAL_MODEL_KEY, val);
            else safeStorage.removeItem(MANUAL_MODEL_KEY);
          }
          cachedTextModels = [];
          cachedVisionModels = [];
        });
      }
      const openBtn = document.getElementById('btn-open-vision-mon-from-settings');
      if (openBtn) {
        openBtn.addEventListener('click', () => {
          if (typeof closeModal === 'function') closeModal('modal-settings');
          openVisionMonitor();
        });
      }
    }

    const sideCol = document.getElementById('side-icon-column');
    if (sideCol && !document.getElementById('ai-vision-btn')) {
      const btn = document.createElement('div');
      btn.id = 'ai-vision-btn';
      btn.className = 'side-circle-btn';
      btn.title = '👁️ キャラ視点＆1ターン答え合わせ（送信前・AI返答・実行後・コピペ）';
      btn.innerText = '👁️';
      btn.addEventListener('click', () => openVisionMonitor());
      sideCol.appendChild(btn);
    }

    if (!document.getElementById('modal-ai-vision')) {
      const overlay = document.createElement('div');
      overlay.id = 'modal-ai-vision';
      overlay.className = 'modal-overlay';
      overlay.style.display = 'none';
      overlay.innerHTML = `
        <div class="modal-content" style="max-height:92vh; gap:8px;">
          <div class="modal-close" id="btn-close-vision-mon-x">✕</div>
          <div class="modal-title" style="font-size:14px;">👁️ キャラ視点・1ターン答え合わせ</div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <button type="button" id="btn-tab-audit" style="padding:7px 6px; border:none; border-radius:8px; font-size:11px; font-weight:900; cursor:pointer;">📌 直前ターンの答え合わせ</button>
            <button type="button" id="btn-tab-preview" style="padding:7px 6px; border:none; border-radius:8px; font-size:11px; font-weight:900; cursor:pointer;">👁️ 次の送信プレビュー</button>
          </div>

          <button type="button" id="btn-copy-turn-report" class="btn-primary" style="padding:8px; font-size:12px; font-weight:900; background:#0ea5e9;">
            📋 1ターン答え合わせをコピペ（送信文＋AI返答＋結果）
          </button>

          <!-- ===== タブ1：直前ターンの答え合わせ ===== -->
          <div id="vision-pane-audit" style="display:flex; flex-direction:column; gap:7px;">
            <div id="audit-meta" style="font-size:10.5px; font-weight:800; color:#0369a1; background:#f0f9ff; padding:6px 8px; border-radius:8px; border:1px solid #bae6fd;"></div>
            <div id="audit-empty-notice" style="display:none; font-size:11.5px; color:#475569; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:10px; padding:12px; text-align:center; font-weight:700;">
              まだ通信ターンが実行されていません。<br>「⚡ 今すぐ考える」を1回押すと、送信前のキャラ視点・送信文・AI返答・実行後のキャラ視点がここに凍結表示されます。
            </div>

            <div id="audit-body" style="display:none; flex-direction:column; gap:7px;">
              <div id="audit-before-img-wrap" style="display:none; text-align:center; background:#0f172a; padding:6px; border-radius:10px;">
                <div id="audit-before-img-label" style="font-size:10px; color:#7dd3fc; font-weight:800; margin-bottom:4px;"></div>
                <img id="audit-before-img" style="max-width:100%; max-height:220px; border-radius:8px; border:1px solid #38bdf8;" alt="行動前のキャラ視点">
              </div>

              <div style="font-size:11px; font-weight:900; color:#334155;">📤 [1] AIへ送信した情報文（行動前）</div>
              <pre id="audit-prompt" style="background:#0f172a; color:#e2e8f0; padding:8px; border-radius:10px; font-size:10.5px; line-height:1.35; overflow:auto; max-height:190px; white-space:pre-wrap; margin:0; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"></pre>

              <div style="font-size:11px; font-weight:900; color:#334155;">📥 [2] AIからの返答（しゃべり・判断・動き）</div>
              <div id="audit-reply-summary" style="background:#f0fdf4; border:1.5px solid #86efac; color:#14532d; padding:7px 9px; border-radius:10px; font-size:11px; line-height:1.45;"></div>
              <pre id="audit-raw-json" style="background:#f8fafc; color:#1e293b; border:1px solid #cbd5e1; padding:7px; border-radius:8px; font-size:10px; line-height:1.35; overflow:auto; max-height:95px; white-space:pre-wrap; margin:0; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"></pre>

              <div style="font-size:11px; font-weight:900; color:#334155;">🧱 [3] 実行後の物理結果 ＆ 行動後キャラ視点</div>
              <div id="audit-phys-result" style="background:#fffbeb; border:1.5px solid #fcd34d; color:#78350f; padding:7px 9px; border-radius:10px; font-size:11px; line-height:1.45;"></div>

              <div id="audit-after-img-wrap" style="display:none; text-align:center; background:#0f172a; padding:6px; border-radius:10px;">
                <div id="audit-after-img-label" style="font-size:10px; color:#fcd34d; font-weight:800; margin-bottom:4px;"></div>
                <img id="audit-after-img" style="max-width:100%; max-height:220px; border-radius:8px; border:1px solid #f59e0b;" alt="行動後のキャラ視点">
              </div>
            </div>
          </div>

          <!-- ===== タブ2：次の送信プレビュー（通信前） ===== -->
          <div id="vision-pane-preview" style="display:none; flex-direction:column; gap:7px;">
            <div id="preview-meta" style="font-size:10.5px; font-weight:800; color:#0369a1; background:#f0f9ff; padding:6px 8px; border-radius:8px; border:1px solid #bae6fd;"></div>
            <div id="preview-img-wrap" style="display:none; text-align:center; background:#0f172a; padding:6px; border-radius:10px;">
              <div id="preview-img-label" style="font-size:10px; color:#cbd5e1; font-weight:800; margin-bottom:4px;"></div>
              <img id="preview-img" style="max-width:100%; max-height:220px; border-radius:8px; border:1px solid #38bdf8;" alt="現在のキャラ視点">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
              <button type="button" id="btn-prev-stop-180" class="btn-sub" style="padding:5px; font-size:10.5px;">🧍 停止180°をプレビュー</button>
              <button type="button" id="btn-prev-move-fwd" class="btn-sub" style="padding:5px; font-size:10.5px;">🏃 移動前方をプレビュー</button>
            </div>
            <div style="font-size:11px; font-weight:900; color:#334155;">📤 次にAIへ送る情報文（A案）</div>
            <pre id="preview-prompt" style="background:#0f172a; color:#e2e8f0; padding:8px; border-radius:10px; font-size:10.5px; line-height:1.35; overflow:auto; max-height:220px; white-space:pre-wrap; margin:0; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"></pre>
            <button type="button" id="btn-refresh-preview" class="btn-sub" style="padding:6px; font-size:11px;">🔄 現在の状態で再取得</button>
          </div>

          <button type="button" id="btn-close-vision-mon" class="btn-sub" style="font-size:11.5px;">閉じる</button>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById('btn-close-vision-mon-x').onclick = closeVisionMonitor;
      document.getElementById('btn-close-vision-mon').onclick = closeVisionMonitor;
      document.getElementById('btn-tab-audit').onclick = () => renderMonitorModal('audit', null);
      document.getElementById('btn-tab-preview').onclick = () => renderMonitorModal('preview', null);
      document.getElementById('btn-refresh-preview').onclick = () => renderMonitorModal('preview', null);
      document.getElementById('btn-prev-stop-180').onclick = () => renderMonitorModal('preview', false);
      document.getElementById('btn-prev-move-fwd').onclick = () => renderMonitorModal('preview', true);

      const copyBtn = document.getElementById('btn-copy-turn-report');
      if (copyBtn) {
        copyBtn.onclick = async () => {
          const text = buildTurnCopyText();
          const ok = await copyTextToClipboard(text);
          if (ok) {
            const orig = copyBtn.innerText;
            copyBtn.innerText = '✅ コピーしました！そのままチャットへ貼り付けできます';
            copyBtn.style.background = '#16a34a';
            if (typeof showToast === 'function') showToast('📋 1ターン答え合わせをコピーしました');
            setTimeout(() => {
              copyBtn.innerText = orig;
              copyBtn.style.background = '#0ea5e9';
            }, 1800);
          } else {
            if (typeof showToast === 'function') showToast('⚠️ コピーに失敗しました');
          }
        };
      }
    }

    enablePinchZoomOnAllModals();
  }

  injectVisionControlsUI();
  setTimeout(enablePinchZoomOnAllModals, 500);

  // グローバル配線
  window.executeTurn = runTurn;
  if (typeof executeTurn !== 'undefined') executeTurn = runTurn;
  const actionBtn = document.getElementById('btn-action');
  if (actionBtn) actionBtn.onclick = () => window.executeTurn();

  if (typeof getActiveBrainBadgeText === 'function') {
    getActiveBrainBadgeText = function() {
      if (commEnabled && (safeStorage.getItem('api_groq') || '').trim()) return '🟪 Groq(🗺️A案)';
      if (commEnabled) return '⚠️ Groqキー未設定';
      return '⏸️ 通信OFF(停止)';
    };
  }
  window.toggleAiCommSwitch = setEnabled;

  // 不変コアAPI公開
  const coreApi = Object.freeze({
    version: '3.5-audit-copy-b-locked',
    isEnabled,
    setEnabled,
    getVisionMode,
    setVisionMode,
    isMovingVision,
    registerAction,
    registerSensor,
    registerBodySensor,
    registerVisionProvider,
    registerPostTurnHook,
    resetPhysicalHistory,
    openVisionMonitor,
    enablePinchZoomOnAllModals,
    resetAllModalZooms,
    buildTurnCopyText,
    getLastTurnAudit: () => lastTurnAudit,
    getLastInspection: () => lastTurnAudit,
    listActions: () => Array.from(actionMap.values()).map(a => ({ id: a.id, desc: a.desc }))
  });
  Object.defineProperty(window, 'AICommCore', {
    value: coreApi,
    writable: false,
    configurable: false
  });

  // 標準休憩アクション
  registerAction({
    id: 'rest',
    desc: 'その場で休む',
    run: () => {
      life.stamina = Math.min(100, life.stamina + 30);
      life.energy = Math.max(0, life.energy - 3);
      ROBOT.params.eco = Math.min(100, (ROBOT.params.eco || 40) + 2);
      return {
        actionLabel: '💤 その場で休んだ',
        physicalResult: 'その場で休み、体力が回復した',
        moved: false
      };
    }
  });

  // 標準ターン後フック（物理接触のみ）
  registerPostTurnHook(({ prevPos }) => {
    const itemIdx = WORLD_ITEMS.findIndex(it => it.x === ROBOT.pos.x && it.z === ROBOT.pos.z);
    if (itemIdx !== -1) {
      const picked = WORLD_ITEMS.splice(itemIdx, 1)[0];
      if (picked.type === 'apple') { life.energy += 40; life.mental += 12; }
      else if (BAG.length < 10) BAG.push(picked.type);
    }

    if (ROBOT.pet && ROBOT.pet.id) {
      ROBOT.pet.x = prevPos.x; ROBOT.pet.z = prevPos.z; ROBOT.pet.lv = prevPos.lv;
    }

    if (typeof getCurrentAreaDef !== 'function') return null;
    const areaDef = getCurrentAreaDef();

    const portal = (areaDef.portals || []).find(p => p.x === ROBOT.pos.x && p.z === ROBOT.pos.z);
    if (portal && (!portal.needPuzzle || (typeof AREA_PUZZLE_SOLVED !== 'undefined' && AREA_PUZZLE_SOLVED[areaDef.id]))) {
      if (typeof window.switchAreaById === 'function') {
        window.switchAreaById(portal.target, true);
        return { switchedArea: true };
      }
    }
    return null;
  });

  setEnabled(commEnabled);
  setVisionMode(visionMode);
  if (typeof cameraDirty !== 'undefined') cameraDirty = true;
})();
