// ============================================================================
// 【分割AI通信モジュール 3/4：ai_core.js】
// ・「本当の輪っか」実装（①体のサイン消費 → ②AI通信 → ③成功時のみ5ページ日記保存＆現実回復）
// ・毎ターン記憶喪失・5ページ日記帳限定・子ども向けやさしい例え話・通信失敗時完全停止
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
        ? '📡 通信 ON（本当の輪っか稼働中）'
        : '⏸️ 通信 OFF（輪っか停止・回復なし）';
    }
    if (SYS.ui && typeof SYS.ui.setTrueLoopState === 'function') {
      SYS.ui.setTrueLoopState(
        ST.commEnabled ? 'idle' : 'error',
        ST.commEnabled
          ? '待機中：「⚡ 今すぐ考える」または「▶ 自動(60秒)」で輪っかが1周します'
          : '⏸️ 通信OFFのため輪っかが停止しています（数字は回復しません）'
      );
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
    if (typeof ROBOT !== 'undefined') {
      ROBOT.diaryPages = [];
      ROBOT.isInjured = false;
      ROBOT.isSick = false;
      ROBOT.ghostNear = false;
    }
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
    if (typeof life !== 'undefined' && life) {
      const bagApples = (typeof BAG !== 'undefined' && Array.isArray(BAG)) ? BAG.filter(x => x === 'apple').length : 0;
      const groundApples = (typeof WORLD_ITEMS !== 'undefined' && Array.isArray(WORLD_ITEMS)) ? WORLD_ITEMS.filter(it => it.type === 'apple').length : 0;
      const statusFlags = [];
      if (typeof ROBOT !== 'undefined') {
        if (ROBOT.isInjured) statusFlags.push('🩹ケガ中(毎ターンたいりょく追加-5・休むと治る)');
        if (ROBOT.isSick) statusFlags.push('😷病気中(リンゴ回復量が半分+25・休むと治る)');
        if (ROBOT.ghostNear) statusFlags.push('👻お化け接近中！(最優先でescapeで逃げること！)');
      }
      lines.push(`【現在の3ゲージ】たいりょく:${life.stamina}/100, おなか:${life.energy}/100, ごきげん:${life.mental}/100`);
      lines.push(`【リンゴ所持/周辺】カバン内:${bagApples}個, 地面:${groundApples}個`);
      lines.push(`【体調・危険サイン】${statusFlags.length ? statusFlags.join(' / ') : '異常なし（健康）'}`);
    }
    for (let i = 0; i < bodySensors.length; i++) {
      try {
        const res = bodySensors[i]();
        if (typeof res === 'string' && res.trim()) lines.push(res.trim());
      } catch (e) { console.warn('AICommCore bodySensor error:', e); }
    }
    return lines.join('\n');
  }

  function getDiaryPagesList() {
    if (typeof ROBOT !== 'undefined' && Array.isArray(ROBOT.diaryPages)) {
      return ROBOT.diaryPages;
    }
    return ST.shortTermMemory || [];
  }

  function formatFivePageDiary() {
    const pages = getDiaryPagesList();
    if (!pages.length) return '（まだ日記帳は1ページも書かれていません。記憶喪失のため過去のことは何も知りません）';
    return pages.map((p, idx) => {
      return `【${idx + 1}ページ目(${p.time || ''})】${p.text}`;
    }).join('\n');
  }

  function buildPerceptionPayload(targetMode = ST.visionMode, isMoving = ST.lastTurnWasMoving, beforeVitalsNote = '') {
    const effectiveMode = CONST.B_MODE_LOCKED ? 'map' : targetMode;
    const actions = Array.from(actionMap.values());
    const actionIds = actions.map(a => a.id).join('/');
    const actionsText = actions.map(a => `- ${a.id}: ${a.desc}`).join('\n');
    const bodyText = collectBodyText();
    const diaryText = formatFivePageDiary();

    const fpvImageUrl = CAM.captureRobotFirstPersonImage(isMoving, true, true);
    let visionSection = '';
    let sendImageUrl = null;

    if (effectiveMode === 'image') {
      sendImageUrl = CAM.captureRobotFirstPersonImage(isMoving, true, false);
      visionSection = sendImageUrl
        ? '【1人称カメラ画像】今見えている視界のすべてです。'
        : '（1人称カメラ画像の取得に失敗しました）';
    } else {
      visionSection = (typeof visionProvider === 'function')
        ? String(visionProvider({ isMoving }) || '（視界データなし）')
        : '（視界モジュール未接続）';
    }

    const promptText = `あなたは「毎ターン記憶喪失になる」小さな観察キャラクターです。
過去の記憶は一切なく、ポケットにある【最大5ページの日記帳】と【今の体のサイン】だけを頼りに次の1ターンの行動を1つ決めます。

【絶対ルール（作り話禁止・子ども向け表現）】
1. 日記帳と今の体のサインに書かれていない作り話・空想は絶対に禁止です（書かれていないことは「日記にないから分からない」と扱います）。
2. お化け接近中（👻）なら最優先で "escape" を選んで逃げてください。
3. おなかが55以下でリンゴがあるなら "eat_apple" で食べて回復してください（1個で+50、病気中は+25）。
4. たいりょく45以下、またはケガ(🩹)・病気(😷)中なら "rest" で休んで回復＆治療してください。
5. "thought" には、日記帳の体験と今の体のことだけを使い、小学生にも分かるやさしい言葉と身近な例え話1つを入れて65文字以内で話してください。
6. "diary_summary" には、今回の行動前のピンチと行動後の結果をまとめた短い体験メモ（40文字以内）を書いてください。

【今すぐ考える前の体の変化】
${beforeVitalsNote || 'ターン経過で体力を消費した'}

【視覚（今見えている範囲のみ）】
${visionSection}

【今の体のサイン・所持状態】
${bodyText}

【ポケットにある5ページの日記帳（唯一の記憶・最大5ページ）】
${diaryText}

【選べる物理アクション（1ターンに1つ選択）】
${actionsText}

以下のJSON形式のみで返答してください（前置き・解説禁止。不要な項目は"none"/0のままにしてください）:
{"action":"${actionIds}","dir":"北/南/東/西/北西/北東/南西/南東","sub":"none/take/store/stand/crouch/jump/rest/look/pickup/place/throw/punch/kick/swing","target":"front/front_down/under/up/left/right","shape":"auto/wide/tall","face":"front/up/down/left/right","item":"soil/shovel/all/none","count":1,"emotion":"normal/joy/anger/sad/fun/fear/think/surprise/wave/sleep/swing_v/pickup/carry/push/run/peek/struggle/punch/kick/swing","diary_summary":"体験の短いまとめ(40文字以内)","thought":"日記と体のことだけを子ども向け例え話1つで話すセリフ(65文字以内)"}`;

    return { promptText, sendImageUrl, fpvImageUrl, mode: effectiveMode, isMoving, actionsCount: actions.length };
  }

  function findDirByShortName(name) {
    if (typeof ALL_DIRS === 'undefined' || !ALL_DIRS.length) return { name: '北', dx: 0, dz: -1, rot: Math.PI };
    const clean = (typeof name === 'string') ? name.trim() : '';
    if (clean && clean.toLowerCase() !== 'none' && clean.toLowerCase() !== 'null') {
      const hit = ALL_DIRS.find(d => d.name.replace('(斜め)', '') === clean || d.name === clean);
      if (hit) return hit;
    }
    const rot = (typeof ROBOT !== 'undefined' && Number.isFinite(ROBOT.rotY)) ? ROBOT.rotY : Math.PI;
    let best = ALL_DIRS[0], minDiff = 999;
    ALL_DIRS.forEach(d => {
      const diff = Math.abs(Math.atan2(Math.sin(rot - d.rot), Math.cos(rot - d.rot)));
      if (diff < minDiff) { minDiff = diff; best = d; }
    });
    return best;
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
      if (SYS.ui && typeof SYS.ui.setTrueLoopState === 'function') {
        SYS.ui.setTrueLoopState('error', '❌ 通信OFFのため輪っかが停止中（数字は回復しません）');
      }
      showStopMessage('⏸️ 通信OFF（輪っか停止中）', '通信OFFのため輪っかが回らず停止しています（数字は回復しません）。⚙️設定で通信ONにしてください。');
      return;
    }

    const btn = document.getElementById('btn-action');
    const stEl = document.getElementById('ai-status');
    if (btn) btn.disabled = true;
    if (stEl) stEl.innerText = '🟪 Ai通信中...';

    // 毎ターン記憶喪失：前のターンの一時目標は忘れる（頼りは5ページ日記帳のみ）
    ST.currentGoal = '';

    try {
      // ======================================================================
      // 【輪っか①】ターン経過による基本消費（考える前の体のサイン変化）
      // ======================================================================
      let beforeVitalsNote = 'ターン経過';
      if (typeof applyTurnVitalsAndConditions === 'function') {
        const vRes = applyTurnVitalsAndConditions();
        beforeVitalsNote = vRes.summary;
      }
      if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();

      if (SYS.ui && typeof SYS.ui.setTrueLoopState === 'function') {
        SYS.ui.setTrueLoopState('step1', `① 体のサイン変化：${beforeVitalsNote}`);
      }

      // ======================================================================
      // 【輪っか②】Ai（Api）へ通信（5ページ日記帳＋今の体の数字のみ渡す）
      // ======================================================================
      if (SYS.ui && typeof SYS.ui.setTrueLoopState === 'function') {
        SYS.ui.setTrueLoopState('step2', '② Ai通信中：記憶喪失の状態で5ページ日記帳だけを見て思考中…');
      }

      const isMovingBefore = ST.lastTurnWasMoving;
      const facingBefore = CAM.rotToShortDirName(ROBOT.rotY || 0);
      const payload = buildPerceptionPayload(ST.visionMode, isMovingBefore, beforeVitalsNote);

      const res = await API.requestDecision(payload);
      if (!res.ok) {
        // ※通信最重要：失敗時は絶対に回復させず、赤いエラーで輪っかを停止する
        ST.lastTurnAudit = {
          hasData: true, turnNo: ST.turnSequenceNo + 1, time: new Date().toLocaleTimeString('ja-JP'),
          day: typeof GAME_DAY !== 'undefined' ? GAME_DAY : 1, mode: payload.mode,
          isMovingBefore, isMovingAfter: isMovingBefore, modelId: res.lastModelId || '-',
          facingBefore, facingAfter: facingBefore,
          beforeImageUrl: payload.fpvImageUrl, afterImageUrl: payload.fpvImageUrl,
          promptText: payload.promptText, rawResponse: res.lastRaw || '-', parsedJson: null,
          actionId: '-', dirName: '-', subVal: '-', targetVal: '-', shapeVal: '-', faceVal: '-',
          itemName: '-', countVal: '-', goalText: '',
          emotionId: '-', motionLabel: '-',
          thoughtText: '', actionLabel: '❌ 通信エラーで輪っか停止（回復なし）',
          physicalResult: '通信失敗のため回復・行動ともに停止', error: res.reason
        };
        if (SYS.ui && typeof SYS.ui.setTrueLoopState === 'function') {
          SYS.ui.setTrueLoopState('error', `❌ 通信エラーで輪っかが停止しました（数字は回復しません）：${res.reason}`);
        }
        if (typeof saveWorldState === 'function') saveWorldState();
        showStopMessage('❌ Ai通信エラー（輪っか停止）', `遠くのAiと通信できなかったため輪っかが止まり、体力やおなかは回復しませんでした。\n理由：${res.reason}`);
        return;
      }

      // ======================================================================
      // 【輪っか③】通信成功！Aiの決断で現実の数字が変わり、5ページ日記帳へ保存
      // ======================================================================
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
        || actionMap.get('rest')
        || actionMap.get('posture')
        || Array.from(actionMap.values())[0];

      const subStr    = normStr(dec.sub, '');
      const targetStr = normStr(dec.target, '');
      const shapeStr  = normStr(dec.shape, '');
      const faceStr   = normStr(dec.face, '');
      const itemStr   = normStr(dec.item, '');
      const countNum  = (Number.isFinite(Number(dec.count)) && Number(dec.count) > 0) ? Math.floor(Number(dec.count)) : 0;

      const extraParts = [];
      if (subStr) extraParts.push(subStr);
      if (targetStr && chosenAction.id === 'dig') extraParts.push(targetStr + (shapeStr && shapeStr !== 'auto' ? `/${shapeStr}` : ''));
      if (faceStr && chosenAction.id === 'turn') extraParts.push(`顔:${faceStr}`);
      if (itemStr) extraParts.push(itemStr);
      if (countNum > 0) extraParts.push(`×${countNum}`);
      const extraTag = extraParts.join(' ');

      let thoughtText = (typeof dec.thought === 'string' && dec.thought.trim())
        ? dec.thought.trim()
        : '日記を見て、今の体のサインに合わせて動いたよ！';
      let aiDiaryNote = (typeof dec.diary_summary === 'string' && dec.diary_summary.trim())
        ? dec.diary_summary.trim().slice(0, 45)
        : '';
      let actionLabel = `🔄 ${chosenAction.id}`;
      let physResult = `${chosenAction.id}(${dirShort})を実行した`;
      let out = null;

      try {
        out = chosenAction.run({
          dec, dir, prevPos,
          sub: subStr, target: targetStr, shape: shapeStr, face: faceStr,
          item: itemStr, count: countNum, goal: ''
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

      // 考える前と後の体験情報をまとめて「5ページ限定日記帳」へ保存（6ページ目で1ページ目が消える）
      const nowTimeStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      const combinedDiaryText = `【前】${beforeVitalsNote} ／ 【後】${physResult}${aiDiaryNote ? `（${aiDiaryNote}）` : ''}`;
      if (!Array.isArray(ROBOT.diaryPages)) ROBOT.diaryPages = [];
      ROBOT.diaryPages.push({
        turn: ST.turnSequenceNo,
        time: nowTimeStr,
        text: combinedDiaryText
      });
      while (ROBOT.diaryPages.length > CONST.MAX_SHORT_MEMORY) {
        ROBOT.diaryPages.shift();
      }

      ST.shortTermMemory.push({ action: chosenAction.id, dir: dirShort, extra: extraTag, thought: thoughtText, result: physResult });
      while (ST.shortTermMemory.length > CONST.MAX_SHORT_MEMORY) ST.shortTermMemory.shift();

      if (OBS_MODE === 'ai_mode') AI_MEMORY.push(physResult);
      DIARY_LOGS.push(`📖 ${GAME_DAY}日目：${combinedDiaryText}`);

      const actEl = document.getElementById('history-action');
      const msgEl = document.getElementById('message-box');
      if (actEl) actEl.innerText = actionLabel;
      if (msgEl) msgEl.innerText = thoughtText;

      if (SYS.ui && typeof SYS.ui.setTrueLoopState === 'function') {
        SYS.ui.setTrueLoopState('step3', `③ 輪っか成功！5ページ日記(${ROBOT.diaryPages.length}/5)へ保存し現実が動きました`);
      }

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
        itemName: itemStr || '-', countVal: countNum > 0 ? String(countNum) : '-',
        goalText: `日記帳 ${ROBOT.diaryPages.length}/5ページ使用中`,
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

  window.executeTurn = runTurn;
  if (typeof executeTurn !== 'undefined') executeTurn = runTurn;
  const actionBtn = document.getElementById('btn-action');
  if (actionBtn) actionBtn.onclick = () => window.executeTurn();

  if (typeof getActiveBrainBadgeText === 'function') {
    getActiveBrainBadgeText = function() {
      if (ST.commEnabled && (safeStorage.getItem('api_groq') || '').trim()) return '🔄 輪っか稼働(5P日記)';
      if (ST.commEnabled) return '⚠️ Groqキー未設定';
      return '⏸️ 通信OFF(輪っか停止)';
    };
  }
  window.toggleAiCommSwitch = setEnabled;

  const coreApi = Object.freeze({
    version: '5.0-true-loop',
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

  // 基本アクション①：その場で休む（体力+35・ケガ＆病気治癒）
  registerAction({
    id: 'rest',
    desc: 'その場で休む（たいりょく+35回復・ケガと病気を治す）',
    run: () => {
      life.stamina = Math.min(100, life.stamina + 35);
      life.mental = Math.min(100, life.mental + 8);
      const cured = [];
      if (typeof ROBOT !== 'undefined') {
        if (ROBOT.isInjured) { ROBOT.isInjured = false; cured.push('ケガ'); }
        if (ROBOT.isSick) { ROBOT.isSick = false; cured.push('病気'); }
      }
      if (typeof addExpPoint === 'function') addExpPoint('eco', 1);
      const cureMsg = cured.length ? `・${cured.join('と')}が治った！` : '';
      return {
        actionLabel: `💤 休憩でたいりょく+35${cureMsg}`,
        physicalResult: `その場でゆっくり休み、たいりょく+35回復した${cureMsg}`,
        moved: false
      };
    }
  });

  // 基本アクション②：リンゴを食べる（おなか+50回復・病気中は+25）
  registerAction({
    id: 'eat_apple',
    desc: 'カバンまたは足元のリンゴを食べる（おなか+50回復・病気中は+25）',
    run: () => {
      let ate = false;
      if (typeof BAG !== 'undefined' && Array.isArray(BAG)) {
        const idx = BAG.indexOf('apple');
        if (idx !== -1) { BAG.splice(idx, 1); ate = true; }
      }
      if (!ate && typeof WORLD_ITEMS !== 'undefined' && Array.isArray(WORLD_ITEMS)) {
        const wIdx = WORLD_ITEMS.findIndex(it => it.type === 'apple');
        if (wIdx !== -1) { WORLD_ITEMS.splice(wIdx, 1); ate = true; }
      }
      if (!ate) {
        return {
          actionLabel: '🍎 リンゴがなくて食べられなかった',
          physicalResult: 'リンゴを探したが見つからずおなかは回復しなかった',
          moved: false
        };
      }
      const isSick = (typeof ROBOT !== 'undefined' && ROBOT.isSick);
      const heal = isSick ? 25 : 50;
      life.energy = Math.min(100, life.energy + heal);
      life.mental = Math.min(100, life.mental + 12);
      if (typeof addExpPoint === 'function') addExpPoint('eco', 1);
      return {
        actionLabel: `🍎 リンゴを食べておなか+${heal}${isSick ? '(病気で半分)' : ''}`,
        physicalResult: `リンゴを1個食べておなかが+${heal}回復した${isSick ? '(病気中のため半分)' : ''}`,
        moved: false
      };
    }
  });

  // 基本アクション③：お化けから全力で逃げる（記憶喪失＋5ページ日記帳頼りに統一）
  registerAction({
    id: 'escape',
    desc: 'お化けから全力で逃げる（恐怖回避・ゆうき体験UP）',
    run: ({ dir }) => {
      if (typeof ROBOT !== 'undefined') {
        ROBOT.ghostNear = false;
        const d = dir || { dx: 0, dz: 1, rot: 0, name: '南' };
        const nx = Math.max(-2, Math.min(2, ROBOT.pos.x + d.dx));
        const nz = Math.max(-2, Math.min(2, ROBOT.pos.z + d.dz));
        ROBOT.pos.x = nx;
        ROBOT.pos.z = nz;
        ROBOT.rotY = d.rot;
      }
      life.stamina = Math.max(0, life.stamina - 5);
      life.mental = Math.max(0, life.mental - 5);
      if (typeof addExpPoint === 'function') addExpPoint('curiosity', 2);
      return {
        actionLabel: '👻💨 お化けから全力で逃げた！',
        physicalResult: 'お化けに驚いて全力で逃げて隠れた（日記帳へ記録）',
        moved: true
      };
    }
  });

  registerPostTurnHook(({ prevPos }) => {
    if (ROBOT.pet && ROBOT.pet.id) { ROBOT.pet.x = prevPos.x; ROBOT.pet.z = prevPos.z; ROBOT.pet.lv = prevPos.lv; }
    return null;
  });

  SYS.core = { buildPerceptionPayload, setEnabled, setVisionMode, resetPhysicalHistory, runTurn };
  if (window.DebugGuard) window.DebugGuard.markLoaded('ai_core.js');
})();
