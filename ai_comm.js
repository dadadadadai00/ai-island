// ============================================================================
// 【純粋知覚・不変通信コア：ai_comm.js（A案マップ／B案3D画像切替・サイコロ廃止）】
// ・神様目線の座標・行動ヒント・演技誘導を全廃し、キャラ視点の知覚のみをGroqへ送信
// ・設定モーダルへ「AIキャラ視点情報(A案/B案)」切替と「👁️ AI視界モニター」を自動追加
// ※ index.html / brain.js / world.js は無改造のまま動作します
// ============================================================================
(function initImmutableAICommCore() {
  if (window.AICommCore) return;

  const GROQ_CHAT_URL   = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';
  const TIMEOUT_MS      = 20000;
  const TEXT_MODEL_CACHE_KEY   = 'groq_text_model_cache_v3';
  const VISION_MODEL_CACHE_KEY = 'groq_vision_model_cache_v3';
  const VISION_MODE_KEY        = 'ai_vision_mode_v1'; // 'map' (A案) | 'image' (B案)

  let commEnabled = (typeof safeStorage !== 'undefined') && (safeStorage.getItem('ai_comm_enabled') === '1');
  let visionMode  = (typeof safeStorage !== 'undefined' && safeStorage.getItem(VISION_MODE_KEY) === 'image') ? 'image' : 'map';

  let cachedTextModels   = [];
  let cachedVisionModels = [];
  let lastPhysicalResult = 'なし（開始直後）';

  const actionMap = new Map();
  const bodySensors = [];
  const postHooks = [];
  let visionProvider = null;

  let lastInspection = {
    time: '未実行',
    mode: visionMode,
    modelId: '-',
    promptText: 'まだ通信していません（下の「今の視界をプレビュー」で通信なし確認できます）',
    imageDataUrl: null,
    rawResponse: '-',
    parsedJson: null,
    error: ''
  };

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

  // 後方互換エイリアス
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

  function resetPhysicalHistory() {
    lastPhysicalResult = 'なし（開始直後）';
  }

  // --------------------------------------------------------------------------
  // 2. B案：キャラ視点3Dカメラ（innerRobotCam）のオフスクリーン風キャプチャ
  // --------------------------------------------------------------------------
  function captureRobotFirstPersonImage() {
    if (typeof renderer === 'undefined' || typeof scene === 'undefined' || typeof innerRobotCam === 'undefined') {
      return null;
    }
    try {
      const prevRobotVisible = (typeof robotGroup !== 'undefined') ? robotGroup.visible : true;
      const prevFov    = innerRobotCam.fov;
      const prevAspect = innerRobotCam.aspect;

      const h = (typeof getRobotHeightLevel === 'function') ? getRobotHeightLevel() : (ROBOT.pos.lv || 0);
      const sSpec = (typeof SIZE_SPECS !== 'undefined' && SIZE_SPECS[ROBOT.sizeLevel]) || { scaleY: 0.25 };
      const isCrawl = (ROBOT.posture === 'crawl');

      const rot = ROBOT.rotY || 0;
      const lookDirX = Math.sin(rot);
      const lookDirZ = Math.cos(rot);

      const eyeH = isCrawl ? (0.18 * sSpec.scaleY) : Math.max(0.14, 0.52 * sSpec.scaleY);
      const forwardOffset = isCrawl ? 0.06 : -0.18;
      const rx = (typeof robotGroup !== 'undefined') ? robotGroup.position.x : ROBOT.pos.x;
      const ry = (typeof robotGroup !== 'undefined') ? robotGroup.position.y : 0;
      const rz = (typeof robotGroup !== 'undefined') ? robotGroup.position.z : ROBOT.pos.z;

      const eyeX = rx + lookDirX * forwardOffset;
      const eyeY = ry + eyeH;
      const eyeZ = rz + lookDirZ * forwardOffset;

      if (typeof robotGroup !== 'undefined') robotGroup.visible = false;

      innerRobotCam.fov = isCrawl ? 78 : 96;
      innerRobotCam.aspect = renderer.domElement.width / Math.max(1, renderer.domElement.height);
      innerRobotCam.updateProjectionMatrix();
      innerRobotCam.position.set(eyeX, eyeY, eyeZ);
      innerRobotCam.lookAt(
        eyeX + 20 * lookDirX,
        eyeY - 2.6, // 目の前の壁と足元の床・土が同時に収まる少し下向き目線
        eyeZ + 20 * lookDirZ
      );

      if (typeof updateTransparencyAndOcclusion === 'function') {
        updateTransparencyAndOcclusion('robot_fpv', innerRobotCam.position, rx, ry, rz, h, lookDirX, lookDirZ);
      }

      // キャラ視点で1フレーム描画 → 同一フレーム内で即座に軽量リサイズJPEG化
      renderer.render(scene, innerRobotCam);

      const srcW = renderer.domElement.width || 360;
      const srcH = renderer.domElement.height || 640;
      const maxEdge = 512;
      const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
      const outW = Math.max(64, Math.round(srcW * scale));
      const outH = Math.max(64, Math.round(srcH * scale));

      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = outW;
      tmpCanvas.height = outH;
      const ctx = tmpCanvas.getContext('2d');
      ctx.drawImage(renderer.domElement, 0, 0, outW, outH);
      const dataUrl = tmpCanvas.toDataURL('image/jpeg', 0.78);

      // 人間側のカメラ表示を即座に元へ戻す
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
  // 3. Groqモデル自動検出（A案: テキスト / B案: Vision画像対応）
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
  // 4. 純粋知覚プロンプト組み立て（誘導・神様目線ゼロ）
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

  function buildPerceptionPayload(targetMode = visionMode) {
    const actions = Array.from(actionMap.values());
    const actionIds   = actions.map(a => a.id).join('/');
    const actionsText = actions.map(a => `- ${a.id}: ${a.desc}`).join('\n');
    const bodyText    = collectBodyText();

    let visionSection = '';
    let imageDataUrl  = null;

    if (targetMode === 'image') {
      imageDataUrl = captureRobotFirstPersonImage();
      visionSection = imageDataUrl
        ? '添付の1人称カメラ画像が、今あなたの目に見えている視界のすべてです。'
        : '（1人称カメラ画像の取得に失敗しました）';
    } else {
      visionSection = (typeof visionProvider === 'function')
        ? String(visionProvider() || '（視界データなし）')
        : '（視界モジュール未接続）';
    }

    const promptText = `あなたはこの3Dブロック空間の中にいる1体の存在です。
以下の知覚情報（視覚・身体感覚・直前の物理結果）だけをもとに、次の行動を1つ自分で決めてください。

【視覚（今見えている範囲のみ）】
${visionSection}

【身体感覚・所持状態】
${bodyText}

【直前の物理結果】
${lastPhysicalResult}

【物理アクション】
${actionsText}

以下のJSON形式のみで返答してください（前置き・解説禁止）:
{"action":"${actionIds}","dir":"北/南/東/西/北西/北東/南西/南東","emotion":"normal/joy/anger/sad/fun/fear/think/surprise/wave/sleep/swing_v/pickup/carry/push/run/peek/struggle","thought":"知覚した事実や意図を短い1文で"}`;

    return { promptText, imageDataUrl, mode: targetMode, actionsCount: actions.length };
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

    const payload = buildPerceptionPayload(visionMode);
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
      let physResult  = `${chosenAction.id}(${dir.name})を実行した`;

      try {
        const out = chosenAction.run({ dec, dir, prevPos });
        if (out && out.actionLabel) actionLabel = out.actionLabel;
        if (out && out.physicalResult) physResult = out.physicalResult;
        else if (out && out.actionLabel) physResult = out.actionLabel;
      } catch (e) {
        console.warn('AICommCore action execution error:', e);
        physResult = '行動処理中にエラーが発生した';
      }

      // 次ターンへ渡す「直前の物理結果（触覚）」のみを保存
      lastPhysicalResult = physResult;

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
          const hookRes = postHooks[i]({ dec, dir, prevPos });
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
  // 6. 設定UI（A案/B案切替）＆ 👁️ AI視界モニターモーダル自動注入
  // --------------------------------------------------------------------------
  function renderVisionMonitorContent(previewOnly = false) {
    let data = lastInspection;
    if (previewOnly) {
      const p = buildPerceptionPayload(visionMode);
      data = {
        time: `${new Date().toLocaleTimeString('ja-JP')}（通信なしプレビュー）`,
        mode: p.mode,
        modelId: lastInspection.modelId,
        promptText: p.promptText,
        imageDataUrl: p.imageDataUrl,
        rawResponse: lastInspection.rawResponse,
        parsedJson: lastInspection.parsedJson,
        error: ''
      };
    }

    const metaEl = document.getElementById('vision-mon-meta');
    const imgWrap = document.getElementById('vision-mon-img-wrap');
    const imgEl = document.getElementById('vision-mon-img');
    const promptEl = document.getElementById('vision-mon-prompt');
    const respEl = document.getElementById('vision-mon-resp');

    if (metaEl) {
      const modeLabel = data.mode === 'image' ? 'B案：3Dカメラ画像' : 'A案：前方視野記号マップ';
      metaEl.innerText = `モード: ${modeLabel} ／ モデル: ${data.modelId} ／ 更新: ${data.time}`;
    }
    if (imgWrap && imgEl) {
      if (data.imageDataUrl) {
        imgWrap.style.display = 'block';
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
    renderVisionMonitorContent(previewNow);
    modal.style.display = 'flex';
    modal.classList.add('active');
  }

  function closeVisionMonitor() {
    const modal = document.getElementById('modal-ai-vision');
    if (!modal) return;
    modal.style.display = 'none';
    modal.classList.remove('active');
  }

  function injectVisionControlsUI() {
    // ① 設定モーダルへ「AIキャラ視点情報(A案/B案)」切替を自動挿入
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
          <option value="image">B案：キャラ視点3Dカメラ画像（Visionモデルへ直接送信）</option>
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

    // ② 右サイドアイコン列にワンタップ視界モニターボタンを追加
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

    // ③ AI視界モニターモーダルを生成
    if (!document.getElementById('modal-ai-vision')) {
      const overlay = document.createElement('div');
      overlay.id = 'modal-ai-vision';
      overlay.className = 'modal-overlay';
      overlay.style.display = 'none';
      overlay.innerHTML = `
        <div class="modal-content" style="max-height:92vh;">
          <div class="modal-close" id="btn-close-vision-mon-x">✕</div>
          <div class="modal-title">👁️ AI視界モニター（生の知覚 ＆ 返答）</div>
          <div id="vision-mon-meta" style="font-size:10.5px; font-weight:800; color:#0369a1; background:#f0f9ff; padding:6px 8px; border-radius:8px; border:1px solid #bae6fd;"></div>
          <div id="vision-mon-img-wrap" style="display:none; text-align:center; background:#0f172a; padding:6px; border-radius:10px;">
            <div style="font-size:10px; color:#cbd5e1; font-weight:800; margin-bottom:4px;">📷 B案：AIへ送るキャラ視点3D画像</div>
            <img id="vision-mon-img" style="max-width:100%; max-height:220px; border-radius:8px; border:1px solid #38bdf8;" alt="AI視点画像">
          </div>
          <div style="font-size:11px; font-weight:900; color:#334155;">📤 AIへ渡す知覚テキスト（誘導なし）</div>
          <pre id="vision-mon-prompt" style="background:#0f172a; color:#e2e8f0; padding:8px; border-radius:10px; font-size:10.5px; line-height:1.35; overflow:auto; max-height:220px; white-space:pre-wrap; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"></pre>
          <div style="font-size:11px; font-weight:900; color:#334155;">📥 直前のGroq生返答JSON</div>
          <pre id="vision-mon-resp" style="background:#f8fafc; color:#1e293b; border:1px solid #cbd5e1; padding:8px; border-radius:10px; font-size:10.5px; line-height:1.35; overflow:auto; max-height:110px; white-space:pre-wrap; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"></pre>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <button type="button" id="btn-refresh-vision-mon" class="btn-primary" style="font-size:11.5px;">🔄 今の視界を更新</button>
            <button type="button" id="btn-close-vision-mon" class="btn-sub" style="font-size:11.5px;">閉じる</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      document.getElementById('btn-close-vision-mon-x').onclick = closeVisionMonitor;
      document.getElementById('btn-close-vision-mon').onclick = closeVisionMonitor;
      document.getElementById('btn-refresh-vision-mon').onclick = () => renderVisionMonitorContent(true);
    }
  }

  injectVisionControlsUI();

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
    version: '3.0-pure-perception-ab',
    isEnabled,
    setEnabled,
    getVisionMode,
    setVisionMode,
    registerAction,
    registerSensor,
    registerBodySensor,
    registerVisionProvider,
    registerPostTurnHook,
    resetPhysicalHistory,
    openVisionMonitor,
    getLastInspection: () => lastInspection,
    listActions: () => Array.from(actionMap.values()).map(a => ({ id: a.id, desc: a.desc }))
  });
  Object.defineProperty(window, 'AICommCore', {
    value: coreApi,
    writable: false,
    configurable: false
  });

  // 最小限の標準休憩アクション（物理ルール側は rules_dig.js が登録）
  registerAction({
    id: 'rest',
    desc: 'その場で休む',
    run: () => {
      life.stamina = Math.min(100, life.stamina + 30);
      life.energy = Math.max(0, life.energy - 3);
      ROBOT.params.eco = Math.min(100, (ROBOT.params.eco || 40) + 2);
      return {
        actionLabel: '💤 その場で休んだ',
        physicalResult: 'その場で休み、体力が回復した'
      };
    }
  });

  // 標準ターン後フック（アイテム接触・エリア移動など物理接触のみ）
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
})();
