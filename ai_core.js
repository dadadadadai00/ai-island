// ============================================================================
// 【分割AI通信モジュール 3/4：ai_core.js】
// ・プラグイン登録API・プロンプト組立・短期記憶8T＆目標メモ・自由選択引数配線
// ・不変API window.AICommCore の公開とグローバル関数配線
// ============================================================================
(function initAiCoreModule() {
  const SYS = window.AI_SYS;
  if (!SYS || !SYS.state || !SYS.api || !SYS.camera) return;
  if (window.AICommCore) return;

  const CONST = SYS.CONST;
  const ST = SYS.state;
  const API = SYS.api;
  const CAM = SYS.camera;

  const actionMap = new Map();
  const bodySensors = [];
  const postHooks = [];
  let visionProvider = null;

  function registerAction(spec) {
    if (!spec || !spec.id || typeof spec.run !== 'function') return false;
    actionMap.set(spec.id, { id: String(spec.id), desc: String(spec.desc || spec.id), run: spec.run });
    return true;
  }
  function clearActions() { actionMap.clear(); }
  function registerBodySensor(fn) { if (typeof fn === 'function') bodySensors.push(fn); }
  function registerSensor(fn) { registerBodySensor(fn); }
  function registerVisionProvider(fn) { if (typeof fn === 'function') visionProvider = fn; }
  function registerPostTurnHook(fn) { if (typeof fn === 'function') postHooks.push(fn); }

  function setEnabled(isOn) {
    ST.commEnabled = Boolean(isOn);
    window.AI_COMM_ENABLED = ST.commEnabled;
    if (typeof safeStorage !== 'undefined') safeStorage.setItem('ai_comm_enabled', ST.commEnabled ? '1' : '0');
    const chk = document.getElementById('setting-ai-comm-toggle');
    if (chk) chk.checked = ST.commEnabled;
    const label = document.getElementById('comm-toggle-label');
    if (label) {
      label.innerText = ST.commEnabled
        ? '📡 通信 ON（Groq自律行動）'
        : '⏸️ 通信 OFF（完全停止・サイコロ廃止）';
    }
    if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
  }

  function isEnabled() { return ST.commEnabled; }

  function setVisionMode(mode) {
    ST.visionMode = CONST.B_MODE_LOCKED ? 'map' : ((mode === 'image') ? 'image' : 'map');
    if (typeof safeStorage !== 'undefined') safeStorage.setItem(CONST.VISION_MODE_KEY, ST.visionMode);
    const sel = document.getElementById('setting-ai-vision-mode');
    if (sel) sel.value = ST.visionMode;
    if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
  }

  function getVisionMode() { return ST.visionMode; }
  function isMovingVision() { return ST.lastTurnWasMoving; }

  function resetPhysicalHistory() {
    ST.shortTermMemory = [];
    ST.currentGoal = '';
    ST.lastTurnWasMoving = false;
    ST.turnSequenceNo = 0;
    ST.lastTurnAudit.hasData = false;
  }

  function getMotionDisplayName(emotionId) {
    try {
      if (typeof getExpressionSpec === 'function') {
        const spec = getExpressionSpec(emotionId);
        if (spec && spec.label) return `${spec.label} (${emotionId})`;
      }
      if (typeof POSE_TABLE !== 'undefined' && POSE_TABLE[emotionId] && POSE_TABLE[emotionId].name) {
        return `${POSE_TABLE[emotionId].name} (${emotionId})`;
      }
    } catch (e) {}
    return String(emotionId || 'normal');
  }

  function collectBodyText() {
    const lines = [];
    for (let i = 0; i < bodySensors.length; i++) {
      try {
        const res = bodySensors[i]();
        if (typeof res === 'string' && res.trim()) lines.push(res.trim());
      } catch (e) { console.warn('AICommCore bodySensor error:', e); }
    }
    return lines.join('\n');
  }

  function formatShortTermMemory() {
    if (!ST.shortTermMemory.length) return 'なし（開始直後）';
    return ST.shortTermMemory.map((m, idx) => {
      const ago = ST.shortTermMemory.length - idx;
      const tag = ago === 1 ? '直前' : `${ago}T前`;
      const extra = m.extra ? ` ${m.extra}` : '';
      return `- ${tag}: [${m.action}(${m.dir}${extra})] 思考「${m.thought}」→ 結果: ${m.result}`;
    }).join('\n');
  }

  function buildPerceptionPayload(targetMode = ST.visionMode, isMoving = ST.lastTurnWasMoving) {
    const effectiveMode = CONST.B_MODE_LOCKED ? 'map' : targetMode;
    const actions = Array.from(actionMap.values());
    const actionIds = actions.map(a => a.id).join('/');
    const actionsText = actions.map(a => `- ${a.id}: ${a.desc}`).join('\n');
    const bodyText = collectBodyText();
    const memoryText = formatShortTermMemory();
    const goalText = ST.currentGoal ? ST.currentGoal : 'なし（自由に決めてよい）';

    const fpvImageUrl = CAM.captureRobotFirstPersonImage(isMoving, true, true);
    let visionSection = '';
    let sendImageUrl = null;

    if (effectiveMode === 'image') {
      sendImageUrl = CAM.captureRobotFirstPersonImage(isMoving, true, false);
      visionSection = sendImageUrl
        ? (isMoving
            ? '【移動直後・狭い前方視野】添付の1人称カメラ画像（正面1枚）が、今あなたの目に見えている視界のすべてです。'
            : '【停止中・180度パノラマ視野】首を左右に振って見渡した「左60°・正面・右60°」の3連180度パノラマ画像が、今あなたの目に見えている視界のすべてです（背後は死角）。')
        : '（1人称カメラ画像の取得に失敗しました）';
    } else {
      visionSection = (typeof visionProvider === 'function')
        ? String(visionProvider({ isMoving }) || '（視界データなし）')
        : '（視界モジュール未接続）';
    }

    const promptText = `あなたはこの3Dブロック空間の中にいる1体の存在です。
以下の知覚情報（視覚・身体感覚・目標メモ・直近8ターンの記憶）だけをもとに、次の1ターンの行動を1つ自分で決めてください。
※準備動作（向き変え・木箱出し入れ・持ち替え・姿勢変更）はそれぞれ独立した1ターンを消費します。

【視覚（今見えている範囲のみ）】
${visionSection}

【身体感覚・所持状態】
${bodyText}

【現在の目標メモ（毎ターン継続または自由更新可）】
${goalText}

【直近の記憶（自分の思考と物理結果：最大${CONST.MAX_SHORT_MEMORY}ターン）】
${memoryText}

【物理アクション（1ターンに1つ選択）】
${actionsText}

以下のJSON形式のみで返答してください（前置き・解説禁止。不要な項目は"none"/0のままにしてください）:
{"action":"${actionIds}","dir":"北/南/東/西/北西/北東/南西/南東","sub":"none/take/store/stand/crouch/jump/rest/look/pickup/place/throw/punch/kick/swing","target":"front/front_down/under/up/left/right","shape":"auto/wide/tall","face":"front/up/down/left/right","item":"soil/shovel/all/none","count":1,"goal":"今の目標を短い1文で","emotion":"normal/joy/anger/sad/fun/fear/think/surprise/wave/sleep/swing_v/pickup/carry/push/run/peek/struggle/punch/kick/swing","thought":"知覚した事実や意図を短い1文で"}`;

    return { promptText, sendImageUrl, fpvImageUrl, mode: effectiveMode, isMoving, actionsCount: actions.length };
  }

  function findDirByShortName(name) {
    if (!name || typeof ALL_DIRS === 'undefined') return ALL_DIRS[0];
    return ALL_DIRS.find(d => d.name.replace('(斜め)', '') === name || d.name === name) || ALL_DIRS[0];
  }

  function normStr(val, fallback = '') {
    if (typeof val !== 'string') return fallback;
    const s = val.trim().toLowerCase();
    return (!s || s === 'none' || s === 'null') ? fallback : s;
  }

  function showStopMessage(title, detail) {
    const actEl = document.getElementById('history-action');
    const msgEl = document.getElementById('message-box');
    const stEl = document.getElementById('ai-status');
    if (actEl) actEl.innerText = title;
    if (msgEl) msgEl.innerText = detail;
    if (stEl && typeof getActiveBrainBadgeText === 'function') stEl.innerText = getActiveBrainBadgeText();
    if (typeof showToast === 'function') showToast(title);
  }

  async function runTurn() {
    if (!ST.commEnabled) {
      showStopMessage('⏸️ 通信OFF（待機中）', '通信OFFのため停止しています（サイコロ思考廃止済み）。⚙️設定で通信ONにしてください。');
      return;
    }

    const btn = document.getElementById('btn-action');
    const stEl = document.getElementById('ai-status');
    if (btn) btn.disabled = true;
    if (stEl) stEl.innerText = '🟪 Groq思考中...';

    try {
      const isMovingBefore = ST.lastTurnWasMoving;
      const facingBefore = CAM.rotToShortDirName(ROBOT.rotY || 0);
      const payload = buildPerceptionPayload(ST.visionMode, isMovingBefore);

      const res = await API.requestDecision(payload);
      if (!res.ok) {
        ST.lastTurnAudit = {
          hasData: true, turnNo: ST.turnSequenceNo + 1, time: new Date().toLocaleTimeString('ja-JP'),
          day: typeof GAME_DAY !== 'undefined' ? GAME_DAY : 1, mode: payload.mode,
          isMovingBefore, isMovingAfter: isMovingBefore, modelId: res.lastModelId || '-',
          facingBefore, facingAfter: facingBefore,
          beforeImageUrl: payload.fpvImageUrl, afterImageUrl: payload.fpvImageUrl,
          promptText: payload.promptText, rawResponse: res.lastRaw || '-', parsedJson: null,
          actionId: '-', dirName: '-', subVal: '-', targetVal: '-', shapeVal: '-', faceVal: '-',
          itemName: '-', countVal: '-', goalText: ST.currentGoal || '',
          emotionId: '-', motionLabel: '-',
          thoughtText: '', actionLabel: '⚠️ 通信エラー（行動なし）',
          physicalResult: '通信失敗のため行動なし', error: res.reason
        };
        showStopMessage('⚠️ Groq通信停止（行動なし）', `通信できなかったためロボットは動かずに待機しました。\n理由：${res.reason}`);
        return;
      }

      ST.turnSequenceNo++;
      if (++TIME_STEP >= 20) {
        TIME_STEP = 0; GAME_DAY++;
        DIARY_LOGS.push(`🌅 ${GAME_DAY}日目の朝を迎えた`);
      }

      const dec = res.data;
      const prevPos = {
        x: ROBOT.pos.x, z: ROBOT.pos.z, lv: ROBOT.pos.lv,
        sx: Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2,
        sz: Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2
      };
      const dir = findDirByShortName(dec.dir);
      const dirShort = dir.name.replace('(斜め)', '');
      const chosenAction = actionMap.get(dec.action)
        || actionMap.get('posture')
        || actionMap.get('rest')
        || Array.from(actionMap.values())[0];

      const subStr    = normStr(dec.sub, '');
      const targetStr = normStr(dec.target, '');
      const shapeStr  = normStr(dec.shape, '');
      const faceStr   = normStr(dec.face, '');
      const itemStr   = normStr(dec.item, '');
      const countNum  = (Number.isFinite(Number(dec.count)) && Number(dec.count) > 0) ? Math.floor(Number(dec.count)) : 0;
      const goalStr   = (typeof dec.goal === 'string' && dec.goal.trim()) ? dec.goal.trim().slice(0, 60) : '';
      if (goalStr) ST.currentGoal = goalStr;

      const extraParts = [];
      if (subStr) extraParts.push(subStr);
      if (targetStr && chosenAction.id === 'dig') extraParts.push(targetStr + (shapeStr && shapeStr !== 'auto' ? `/${shapeStr}` : ''));
      if (faceStr && chosenAction.id === 'turn') extraParts.push(`顔:${faceStr}`);
      if (itemStr) extraParts.push(itemStr);
      if (countNum > 0) extraParts.push(`×${countNum}`);
      const extraTag = extraParts.join(' ');

      let thoughtText = (typeof dec.thought === 'string' && dec.thought.trim()) ? dec.thought.trim() : '（無言で行動した）';
      let actionLabel = `🟪 ${chosenAction.id}`;
      let physResult = `${chosenAction.id}(${dirShort})を実行した`;
      let out = null;

      try {
        out = chosenAction.run({
          dec, dir, prevPos,
          sub: subStr, target: targetStr, shape: shapeStr, face: faceStr,
          item: itemStr, count: countNum, goal: ST.currentGoal
        });
        if (out && out.actionLabel) actionLabel = out.actionLabel;
        if (out && out.physicalResult) physResult = out.physicalResult;
        else if (out && out.actionLabel) physResult = out.actionLabel;
      } catch (e) {
        console.warn('AICommCore action execution error:', e);
        physResult = '行動処理中にエラーが発生した';
      }

      const curSx = Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2;
      const curSz = Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2;
      const posChanged = (ROBOT.pos.x !== prevPos.x) || (ROBOT.pos.z !== prevPos.z) ||
        (curSx !== prevPos.sx) || (curSz !== prevPos.sz) || (ROBOT.pos.lv !== prevPos.lv);

      ST.lastTurnWasMoving = Boolean(chosenAction.id === 'move' && ((out && out.moved === true) || posChanged));
      const reqEmo = typeof dec.emotion === 'string' ? dec.emotion.trim() : 'normal';
      ROBOT.emotion = (typeof POSE_TABLE !== 'undefined' && POSE_TABLE[reqEmo]) ? reqEmo : 'normal';
      ROBOT.bulbEmotion = null;

      for (let i = 0; i < postHooks.length; i++) {
        try { postHooks[i]({ dec, dir, prevPos, out, sub: subStr }); } catch (e) { console.warn('AICommCore postHook error:', e); }
      }

      ST.shortTermMemory.push({ action: chosenAction.id, dir: dirShort, extra: extraTag, thought: thoughtText, result: physResult });
      if (ST.shortTermMemory.length > CONST.MAX_SHORT_MEMORY) ST.shortTermMemory.shift();

      if (OBS_MODE === 'ai_mode') AI_MEMORY.push(physResult);
      DIARY_LOGS.push(`🟪 ${GAME_DAY}日目：${actionLabel}`);

      const actEl = document.getElementById('history-action');
      const msgEl = document.getElementById('message-box');
      if (actEl) actEl.innerText = actionLabel;
      if (msgEl) msgEl.innerText = thoughtText;

      const finalEmotionId = ROBOT.emotion || reqEmo || 'normal';
      const motionLabel = getMotionDisplayName(finalEmotionId);

      if (typeof manualCameraMode !== 'undefined' && manualCameraMode === 'robot' && typeof resetFpvToRobotFront === 'function') {
        resetFpvToRobotFront();
      }
      if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
      if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
      if (typeof applyRobotBulbColor === 'function') applyRobotBulbColor();
      if (typeof cameraDirty !== 'undefined') cameraDirty = true;
      if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
      if (typeof saveWorldState === 'function') saveWorldState();

      const afterImageUrl = CAM.captureRobotFirstPersonImage(ST.lastTurnWasMoving, true, true);
      const facingAfter = CAM.rotToShortDirName(ROBOT.rotY || 0);

      ST.lastTurnAudit = {
        hasData: true, turnNo: ST.turnSequenceNo, time: new Date().toLocaleTimeString('ja-JP'),
        day: typeof GAME_DAY !== 'undefined' ? GAME_DAY : 1, mode: payload.mode,
        isMovingBefore, isMovingAfter: ST.lastTurnWasMoving, modelId: res.modelId || '-',
        facingBefore, facingAfter, beforeImageUrl: payload.fpvImageUrl, afterImageUrl,
        promptText: payload.promptText, rawResponse: res.raw || '-', parsedJson: dec,
        actionId: chosenAction.id, dirName: dirShort,
        subVal: subStr || '-', targetVal: targetStr || '-', shapeVal: shapeStr || '-', faceVal: faceStr || '-',
        itemName: itemStr || (subStr || '-'), countVal: countNum > 0 ? String(countNum) : '-',
        goalText: ST.currentGoal || '',
        emotionId: finalEmotionId, motionLabel, thoughtText, actionLabel, physicalResult: physResult, error: ''
      };

      if (life.getState().mode === 'DEAD') {
        ROBOT.emotion = 'sad';
        if (msgEl) msgEl.innerText = `力尽きた。第${ROBOT.gen + 1}世代へ移行します。`;
        setTimeout(() => {
          ROBOT.gen += 1; life = new LifeCore();
          GAME_DAY = 1; TIME_STEP = 0; AI_MEMORY = [];
          resetPhysicalHistory();
          ROBOT.pos = { x: 0, z: 0, lv: 0, sx: 2, sz: 2, subY: 0 };
          ROBOT.rotY = Math.PI; ROBOT.posture = 'stand';
          if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
          if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition(true);
          if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
          if (typeof saveWorldState === 'function') saveWorldState();
        }, 1800);
      }
    } finally {
      setTimeout(() => {
        if (stEl && typeof getActiveBrainBadgeText === 'function') stEl.innerText = getActiveBrainBadgeText();
        if (typeof applyRobotBulbColor === 'function') applyRobotBulbColor();
        if (btn) btn.disabled = false;
      }, 220);
    }
  }

  // グローバル配線
  window.executeTurn = runTurn;
  if (typeof executeTurn !== 'undefined') executeTurn = runTurn;
  const actionBtn = document.getElementById('btn-action');
  if (actionBtn) actionBtn.onclick = () => window.executeTurn();

  if (typeof getActiveBrainBadgeText === 'function') {
    getActiveBrainBadgeText = function() {
      if (ST.commEnabled && (safeStorage.getItem('api_groq') || '').trim()) return '🟪 Groq(🗺️A案)';
      if (ST.commEnabled) return '⚠️ Groqキー未設定';
      return '⏸️ 通信OFF(停止)';
    };
  }
  window.toggleAiCommSwitch = setEnabled;

  // 不変コアAPI公開（UI系は ai_monitor_ui.js へ遅延委譲）
  const coreApi = Object.freeze({
    version: '4.2-unified-10act',
    portalTravelDisabled: CONST.PORTAL_TRAVEL_DISABLED,
    isEnabled, setEnabled, getVisionMode, setVisionMode, isMovingVision,
    registerAction, clearActions, registerSensor, registerBodySensor, registerVisionProvider, registerPostTurnHook,
    resetPhysicalHistory,
    getGoal: () => ST.currentGoal,
    setGoal: (g) => { ST.currentGoal = String(g || '').slice(0, 60); },
    openVisionMonitor: (tab) => SYS.ui && SYS.ui.openVisionMonitor(tab),
    enablePinchZoomOnAllModals: () => SYS.ui && SYS.ui.enablePinchZoomOnAllModals(),
    resetAllModalZooms: () => SYS.ui && SYS.ui.resetAllModalZooms(),
    buildTurnCopyText: () => (SYS.ui && SYS.ui.buildTurnCopyText) ? SYS.ui.buildTurnCopyText() : '',
    getLastTurnAudit: () => ST.lastTurnAudit,
    getLastInspection: () => ST.lastTurnAudit,
    listActions: () => Array.from(actionMap.values()).map(a => ({ id: a.id, desc: a.desc }))
  });
  Object.defineProperty(window, 'AICommCore', { value: coreApi, writable: false, configurable: false });

  // 初期フォールバック休憩（dig_ui.js 刷新時に clearActions() で統一10アクションへ差し替え可）
  registerAction({
    id: 'rest',
    desc: 'その場で休む',
    run: () => {
      life.stamina = Math.min(100, life.stamina + 30);
      life.energy = Math.max(0, life.energy - 3);
      ROBOT.params.eco = Math.min(100, (ROBOT.params.eco || 40) + 2);
      return { actionLabel: '💤 その場で休んだ', physicalResult: 'その場で休み、体力が回復した', moved: false };
    }
  });
  registerPostTurnHook(({ prevPos }) => {
    if (ROBOT.pet && ROBOT.pet.id) { ROBOT.pet.x = prevPos.x; ROBOT.pet.z = prevPos.z; ROBOT.pet.lv = prevPos.lv; }
    return null;
  });

  SYS.core = { buildPerceptionPayload, setEnabled, setVisionMode, resetPhysicalHistory, runTurn };
  if (window.DebugGuard) window.DebugGuard.markLoaded('ai_core.js');
})();
