// ============================================================================
// 【純粋知覚・不変通信コア：ai_comm.js】
// ・A案(記号マップ)／B案(3Dカメラ画像) 設定切替（デフォルトA案）
// ・停止時180度パノラマ視野（3連60度合成＋方位ラベル）／移動時狭い前方視野の自動切替
// ・キャラ視点（🤖視点 ＆ AI B案共通）では未削り分割ブロックを一切非表示にせず実体通り表示
// ・直近4ターンの短期記憶（意図＋物理結果）保持による脱線・記憶喪失防止
// ・全モーダルウィンドウの非崩れピンチ拡大縮小（100%〜250%・開閉時自動100%リセット・3Dカメラ無変更）
// ※ index.html / brain.js / world.js は無改造のまま動作します
// ============================================================================
(function initImmutableAICommCore() {
  if (window.AICommCore) return;

  const GROQ_CHAT_URL   = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';
  const TIMEOUT_MS      = 22000;
  const TEXT_MODEL_CACHE_KEY   = 'groq_text_model_cache_v4';
  const VISION_MODEL_CACHE_KEY = 'groq_vision_model_cache_v4';
  const VISION_MODE_KEY        = 'ai_vision_mode_v1'; // 'map' | 'image'
  const MAX_SHORT_MEMORY       = 4;

  let commEnabled = (typeof safeStorage !== 'undefined') && (safeStorage.getItem('ai_comm_enabled') === '1');
  let visionMode  = (typeof safeStorage !== 'undefined' && safeStorage.getItem(VISION_MODE_KEY) === 'image') ? 'image' : 'map';

  let cachedTextModels   = [];
  let cachedVisionModels = [];
  let lastTurnWasMoving  = false; // false: 停止中(180°パノラマ), true: 移動直後(狭い前方)
  let shortTermMemory    = [];    // [{ action, dir, thought, result }]

  const actionMap   = new Map();
  const bodySensors = [];
  const postHooks   = [];
  let visionProvider = null;

  let lastInspection = {
    time: '未実行',
    mode: visionMode,
    isMoving: false,
    modelId: '-',
    promptText: 'まだ通信していません（下の「今の視界を更新」で通信なしプレビューできます）',
    imageDataUrl: null,
    rawResponse: '-',
    parsedJson: null,
    error: ''
  };

  // --------------------------------------------------------------------------
  // 0. キャラ視点カメラの「未削り分割ブロック全表示」＆めり込み防止フック
  //    ※ 追従カメラ・外カメラ（地上/地下）の透過ルールは一切変更しません
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

        // 削られていない分割ブロックは1個も非表示にせず、すべて実体通り表示
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
      // 人間の🤖キャラ視点カメラも壁めり込み防止のためキャラ中心の目の位置へ補正
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
    visionMode = (mode === 'image') ? 'image' : 'map';
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
  }

  // --------------------------------------------------------------------------
  // 2. B案：キャラ視点3Dカメラ描画（未削りブロック全表示・停止時180°/移動時前方）
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

  function captureRobotFirstPersonImage(isMoving = lastTurnWasMoving) {
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
      const rx = (typeof robotGroup !== 'undefined') ? robotGroup.position.x : ROBOT.pos.x;
      const ry = (typeof robotGroup !== 'undefined') ? robotGroup.position.y : 0;
      const rz = (typeof robotGroup !== 'undefined') ? robotGroup.position.z : ROBOT.pos.z;

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

      // キャラ視点では未削り分割ブロックをすべて表示して撮影
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

      const dataUrl = outCanvas.toDataURL('image/jpeg', 0.78);

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
  // 3. Groqモデル自動検出（A案: テキスト / B案: Vision対応）
  // --------------------------------------------------------------------------
  function isUsableChatModel(id) {
    const s = String(id || '').toLowerCase();
    if (!s) return false;
    const ng = ['whisper', 'tts', 'playai', 'orpheus', 'guard', 'safeguard', 'moderation', 'embed', 'rerank', 'compound-beta'];
    return !ng.some(w => s.includes(w));
  }

  function isVisionModel(id) {
    const s = String(id || '').toLowerCase();
    if (!isUsableChatModel(s)) return false;
    return s.includes('llama-4-scout') || s.includes('llama-4-maverick') || s.includes('vision') || s.includes('-vl');
  }

  function scoreTextModel(id) {
    const s = String(id || '').toLowerCase();
    if (s.includes('llama-3.3') && s.includes('70b')) return 100;
    if (s.includes('llama-4-maverick')) return 96;
    if (s.includes('llama-4-scout')) return 94;
    if (s.includes('llama-3.1') && s.includes('8b')) return 90;
    if (s.includes('gpt-oss')) return 85;
    if (s.includes('qwen')) return 80;
    if (s.includes('llama')) return 75;
    return 50;
  }

  function scoreVisionModel(id) {
    const s = String(id || '').toLowerCase();
    if (s.includes('llama-4-maverick')) return 100;
    if (s.includes('llama-4-scout')) return 95;
    if (s.includes('vision') && s.includes('90b')) return 85;
    if (s.includes('vision') && s.includes('11b')) return 80;
    if (s.includes('vision') || s.includes('-vl')) return 70;
    return 10;
  }

  async function fetchAvailableModels(key, wantVision, forceRefresh = false) {
    if (!forceRefresh) {
      if (wantVision && cachedVisionModels.length) return cachedVisionModels;
      if (!wantVision && cachedTextModels.length) return cachedTextModels;
    }

    const cacheKey = wantVision ? VISION_MODEL_CACHE_KEY : TEXT_MODEL_CACHE_KEY;
    const savedModel = (!forceRefresh && typeof safeStorage !== 'undefined')
      ? (safeStorage.getItem(cacheKey) || '').trim()
      : '';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(GROQ_MODELS_URL, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${key}` },
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        const allActive = (Array.isArray(json.data) ? json.data : [])
          .filter(m => m && m.id && m.active !== false && isUsableChatModel(m.id))
          .map(m => m.id);

        const filtered = wantVision
          ? allActive.filter(isVisionModel).sort((a, b) => scoreVisionModel(b) - scoreVisionModel(a))
          : allActive.sort((a, b) => scoreTextModel(b) - scoreTextModel(a));

        if (filtered.length) {
          const ordered = (savedModel && filtered.includes(savedModel))
            ? [savedModel, ...filtered.filter(x => x !== savedModel)]
            : filtered;
          if (wantVision) cachedVisionModels = ordered;
          else cachedTextModels = ordered;
          return ordered;
        }
      }
    } catch (e) {
      clearTimeout(timer);
    }

    const fallback = wantVision
      ? ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct']
      : ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'];
    const ordered = savedModel ? [savedModel, ...fallback.filter(x => x !== savedModel)] : fallback;
    if (wantVision) cachedVisionModels = ordered;
    else cachedTextModels = ordered;
    return ordered;
  }

  function extractJsonFromText(raw) {
    if (!raw || typeof raw !== 'string') return null;
    try { return JSON.parse(raw); } catch (e) {}
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch (e) { return null; }
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
    const actions = Array.from(actionMap.values());
    const actionIds   = actions.map(a => a.id).join('/');
    const actionsText = actions.map(a => `- ${a.id}: ${a.desc}`).join('\n');
    const bodyText    = collectBodyText();
    const memoryText  = formatShortTermMemory();

    let visionSection = '';
    let imageDataUrl  = null;

    if (targetMode === 'image') {
      imageDataUrl = captureRobotFirstPersonImage(isMoving);
      if (imageDataUrl) {
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

    return { promptText, imageDataUrl, mode: targetMode, isMoving, actionsCount: actions.length };
  }

  async function callGroqApi(key, modelId, promptText, imageDataUrl, useJsonFormat) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const userContent = imageDataUrl
        ? [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]
        : promptText;

      const body = {
        model: modelId,
        messages: [{ role: 'user', content: userContent }],
        max_tokens: 220,
        temperature: 0.75
      };
      if (useJsonFormat && !imageDataUrl) {
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

  async function requestDecision() {
    const key = (typeof safeStorage !== 'undefined') ? (safeStorage.getItem('api_groq') || '').trim() : '';
    if (!key) return { ok: false, reason: 'Groq APIキー未設定' };

    const payload = buildPerceptionPayload(visionMode, lastTurnWasMoving);
    if (!payload.actionsCount) return { ok: false, reason: '実行可能なアクション未登録' };
    if (visionMode === 'image' && !payload.imageDataUrl) {
      return { ok: false, reason: 'B案(3Dカメラ画像)のキャプチャに失敗しました' };
    }

    const wantVision = (visionMode === 'image');
    const cacheKey   = wantVision ? VISION_MODEL_CACHE_KEY : TEXT_MODEL_CACHE_KEY;
    let models = await fetchAvailableModels(key, wantVision, false);
    let lastError = '';
    let lastRaw   = '';

    for (let i = 0; i < Math.min(models.length, 3); i++) {
      const mId = models[i];
      let res = await callGroqApi(key, mId, payload.promptText, payload.imageDataUrl, !wantVision);
      if (!res.ok && res.status === 400 && !wantVision) {
        res = await callGroqApi(key, mId, payload.promptText, null, false);
      }

      if (res.ok) {
        if (typeof safeStorage !== 'undefined') safeStorage.setItem(cacheKey, mId);
        lastInspection = {
          time: new Date().toLocaleTimeString('ja-JP'),
          mode: visionMode,
          isMoving: payload.isMoving,
          modelId: mId,
          promptText: payload.promptText,
          imageDataUrl: payload.imageDataUrl,
          rawResponse: res.raw,
          parsedJson: res.data,
          error: ''
        };
        return res;
      }

      lastError = `HTTP ${res.status}${res.detail ? ': ' + res.detail : ''}`;
      if (res.raw) lastRaw = res.raw;

      if (res.status === 401 || res.status === 429) break;
      if (res.status === 404 && i === 0) {
        if (typeof safeStorage !== 'undefined') safeStorage.removeItem(cacheKey);
        models = await fetchAvailableModels(key, wantVision, true);
      }
    }

    lastInspection = {
      time: new Date().toLocaleTimeString('ja-JP'),
      mode: visionMode,
      isMoving: payload.isMoving,
      modelId: models[0] || '-',
      promptText: payload.promptText,
      imageDataUrl: payload.imageDataUrl,
      rawResponse: lastRaw || '-',
      parsedJson: null,
      error: lastError || '通信失敗'
    };
    return { ok: false, reason: lastError || '通信失敗' };
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
  // 5. ターン実行制御（Groq専用・通信不可時は一切動かず停止）
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
    if (stEl) stEl.innerText = visionMode === 'image' ? '📷 Groq視覚思考中...' : '🟪 Groq思考中...';

    try {
      const res = await requestDecision();
      if (!res.ok) {
        showStopMessage(
          '⚠️ Groq通信停止（行動なし）',
          `通信できなかったためロボットは動かずに待機しました。\n理由：${res.reason}`
        );
        return;
      }

      if (++TIME_STEP >= 20) {
        TIME_STEP = 0;
        GAME_DAY++;
        DIARY_LOGS.push(`🌅 ${GAME_DAY}日目の朝を迎えた`);
      }

      const dec = res.data;
      const prevPos = { x: ROBOT.pos.x, z: ROBOT.pos.z, lv: ROBOT.pos.lv };
      const dir = findDirByShortName(dec.dir);
      const chosenAction = actionMap.get(dec.action) || actionMap.get('rest') || Array.from(actionMap.values())[0];

      let thoughtText = (typeof dec.thought === 'string' && dec.thought.trim())
        ? dec.thought.trim()
        : '（無言で行動した）';
      let actionLabel = `🟪 ${chosenAction.id}`;
      let physResult  = `${chosenAction.id}(${dir.name.replace('(斜め)', '')})を実行した`;
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
        dir: dir.name.replace('(斜め)', ''),
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
      if (switchedArea) return;

      if (typeof manualCameraMode !== 'undefined' && manualCameraMode === 'robot' && typeof resetFpvToRobotFront === 'function') {
        resetFpvToRobotFront();
      }
      if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
      if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
      if (typeof applyRobotBulbColor === 'function') applyRobotBulbColor();
      if (typeof cameraDirty !== 'undefined') cameraDirty = true;
      if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
      if (typeof saveWorldState === 'function') saveWorldState();

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
  // 6. 全モーダルウィンドウの非崩れピンチ拡大縮小（transform: scale + 1本指パン）
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
  // 7. 設定UI（A案/B案切替）＆ 👁️ AI視界モニター自動注入
  // --------------------------------------------------------------------------
  function renderVisionMonitorContent(previewOnly = false, forceMovingOverride = null) {
    let data = lastInspection;
    if (previewOnly) {
      const useMoving = (forceMovingOverride === null) ? lastTurnWasMoving : Boolean(forceMovingOverride);
      const p = buildPerceptionPayload(visionMode, useMoving);
      data = {
        time: `${new Date().toLocaleTimeString('ja-JP')}（通信なしプレビュー）`,
        mode: p.mode,
        isMoving: p.isMoving,
        modelId: lastInspection.modelId,
        promptText: p.promptText,
        imageDataUrl: p.imageDataUrl,
        rawResponse: lastInspection.rawResponse,
        parsedJson: lastInspection.parsedJson,
        error: ''
      };
    }

    const metaEl   = document.getElementById('vision-mon-meta');
    const imgWrap  = document.getElementById('vision-mon-img-wrap');
    const imgLabel = document.getElementById('vision-mon-img-label');
    const imgEl    = document.getElementById('vision-mon-img');
    const promptEl = document.getElementById('vision-mon-prompt');
    const respEl   = document.getElementById('vision-mon-resp');

    if (metaEl) {
      const modeLabel  = data.mode === 'image' ? 'B案：3Dカメラ画像' : 'A案：記号マップ';
      const stateLabel = data.isMoving ? '🏃移動中(前方視野)' : '🧍停止中(180°パノラマ)';
      metaEl.innerText = `${modeLabel} ／ ${stateLabel} ／ モデル: ${data.modelId} ／ ${data.time}`;
    }
    if (imgWrap && imgEl) {
      if (data.imageDataUrl) {
        imgWrap.style.display = 'block';
        if (imgLabel) {
          imgLabel.innerText = data.isMoving
            ? '📷 B案：移動中・前方視野（狭い1枚・未削り全表示）'
            : '📷 B案：停止中・180°パノラマ視野（左60°＋正面＋右60°・未削り全表示）';
        }
        imgEl.src = data.imageDataUrl;
      } else {
        imgWrap.style.display = 'none';
      }
    }
    if (promptEl) promptEl.textContent = data.promptText || '';
    if (respEl) {
      respEl.textContent = data.error
        ? `エラー: ${data.error}\n生データ: ${data.rawResponse}`
        : (data.rawResponse || '-');
    }
  }

  function openVisionMonitor(previewNow = true) {
    const modal = document.getElementById('modal-ai-vision');
    if (!modal) return;
    resetAllModalZooms();
    renderVisionMonitorContent(previewNow);
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
        <label class="setting-label" style="color:#0369a1;">👁️ AIキャラ視点情報（送信方式の切替）</label>
        <select id="setting-ai-vision-mode" class="setting-input">
          <option value="map">A案：前方視野の記号マップ（デフォルト・距離正確）</option>
          <option value="image">B案：キャラ視点3Dカメラ画像（停止180°パノラマ／移動前方）</option>
        </select>
        <button type="button" id="btn-open-vision-mon-from-settings" class="btn-sub" style="padding:6px; font-size:11px;">👁️ いまAIに見えている視界を確認する</button>
      `;
      if (commCard && commCard.parentNode) {
        commCard.parentNode.insertBefore(group, commCard.nextSibling);
      }
      const sel = document.getElementById('setting-ai-vision-mode');
      if (sel) {
        sel.value = visionMode;
        sel.addEventListener('change', () => setVisionMode(sel.value));
      }
      const openBtn = document.getElementById('btn-open-vision-mon-from-settings');
      if (openBtn) {
        openBtn.addEventListener('click', () => {
          if (typeof closeModal === 'function') closeModal('modal-settings');
          openVisionMonitor(true);
        });
      }
    }

    const sideCol = document.getElementById('side-icon-column');
    if (sideCol && !document.getElementById('ai-vision-btn')) {
      const btn = document.createElement('div');
      btn.id = 'ai-vision-btn';
      btn.className = 'side-circle-btn';
      btn.title = '👁️ AI視界モニター（AIへ送っている生の知覚と返答を確認）';
      btn.innerText = '👁️';
      btn.addEventListener('click', () => openVisionMonitor(true));
      sideCol.appendChild(btn);
    }

    if (!document.getElementById('modal-ai-vision')) {
      const overlay = document.createElement('div');
      overlay.id = 'modal-ai-vision';
      overlay.className = 'modal-overlay';
      overlay.style.display = 'none';
      overlay.innerHTML = `
        <div class="modal-content" style="max-height:92vh;">
          <div class="modal-close" id="btn-close-vision-mon-x">✕</div>
          <div class="modal-title">👁️ AI視界モニター（2本指ピンチ拡大対応）</div>
          <div id="vision-mon-meta" style="font-size:10.5px; font-weight:800; color:#0369a1; background:#f0f9ff; padding:6px 8px; border-radius:8px; border:1px solid #bae6fd;"></div>
          <div id="vision-mon-img-wrap" style="display:none; text-align:center; background:#0f172a; padding:6px; border-radius:10px;">
            <div id="vision-mon-img-label" style="font-size:10px; color:#cbd5e1; font-weight:800; margin-bottom:4px;"></div>
            <img id="vision-mon-img" style="max-width:100%; max-height:240px; border-radius:8px; border:1px solid #38bdf8;" alt="AI視点画像">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <button type="button" id="btn-prev-stop-180" class="btn-sub" style="padding:5px; font-size:10.5px;">🧍 停止180°をプレビュー</button>
            <button type="button" id="btn-prev-move-fwd" class="btn-sub" style="padding:5px; font-size:10.5px;">🏃 移動前方をプレビュー</button>
          </div>
          <div style="font-size:11px; font-weight:900; color:#334155;">📤 AIへ渡す知覚テキスト（誘導なし）</div>
          <pre id="vision-mon-prompt" style="background:#0f172a; color:#e2e8f0; padding:8px; border-radius:10px; font-size:10.5px; line-height:1.35; overflow:auto; max-height:220px; white-space:pre-wrap; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"></pre>
          <div style="font-size:11px; font-weight:900; color:#334155;">📥 直前のGroq生返答JSON</div>
          <pre id="vision-mon-resp" style="background:#f8fafc; color:#1e293b; border:1px solid #cbd5e1; padding:8px; border-radius:10px; font-size:10.5px; line-height:1.35; overflow:auto; max-height:110px; white-space:pre-wrap; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"></pre>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <button type="button" id="btn-refresh-vision-mon" class="btn-primary" style="font-size:11.5px;">🔄 現在の状態で更新</button>
            <button type="button" id="btn-close-vision-mon" class="btn-sub" style="font-size:11.5px;">閉じる</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      document.getElementById('btn-close-vision-mon-x').onclick = closeVisionMonitor;
      document.getElementById('btn-close-vision-mon').onclick = closeVisionMonitor;
      document.getElementById('btn-refresh-vision-mon').onclick = () => renderVisionMonitorContent(true, null);
      document.getElementById('btn-prev-stop-180').onclick = () => renderVisionMonitorContent(true, false);
      document.getElementById('btn-prev-move-fwd').onclick = () => renderVisionMonitorContent(true, true);
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
      const tag = visionMode === 'image' ? '📷B案' : '🗺️A案';
      if (commEnabled && (safeStorage.getItem('api_groq') || '').trim()) return `🟪 Groq(${tag})`;
      if (commEnabled) return '⚠️ Groqキー未設定';
      return '⏸️ 通信OFF(停止)';
    };
  }
  window.toggleAiCommSwitch = setEnabled;

  // 不変コアAPI公開
  const coreApi = Object.freeze({
    version: '3.3-solid-fpv-terrain',
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
    getLastInspection: () => lastInspection,
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
