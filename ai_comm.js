// ============================================================================
// 【不変通信コア：ai_comm.js（Groq専用・サイコロ完全廃止・モデル自動検出）】
// ※通信できない時・通信OFF時は一切行動せず停止します。
// ※新ルールは他ファイルから AICommCore.registerAction / registerSensor で登録します。
// ============================================================================
(function initImmutableAICommCore() {
  if (window.AICommCore) return;

  const GROQ_CHAT_URL   = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';
  const TIMEOUT_MS      = 15000;
  const MODEL_CACHE_KEY = 'groq_active_model_cache_v2';

  let commEnabled = (typeof safeStorage !== 'undefined') && (safeStorage.getItem('ai_comm_enabled') === '1');
  let cachedModels = [];
  const actionMap = new Map();
  const sensors   = [];
  const postHooks = [];

  // --------------------------------------------------------------------------
  // 1. プラグイン登録API（外部ルールファイルからの接続口）
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

  function registerSensor(fn) {
    if (typeof fn === 'function') sensors.push(fn);
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

  // --------------------------------------------------------------------------
  // 2. Groq利用可能モデルの自動取得（404防止）
  // --------------------------------------------------------------------------
  function isUsableChatModel(id) {
    const s = String(id || '').toLowerCase();
    if (!s) return false;
    const ng = ['whisper', 'tts', 'playai', 'orpheus', 'guard', 'safeguard', 'moderation', 'embed', 'rerank', 'compound-beta'];
    return !ng.some(w => s.includes(w));
  }

  function scoreModelPriority(id) {
    const s = String(id || '').toLowerCase();
    if (s.includes('llama-3.3') && s.includes('70b')) return 100;
    if (s.includes('llama-4')) return 95;
    if (s.includes('llama-3.1') && s.includes('8b')) return 90;
    if (s.includes('gpt-oss')) return 85;
    if (s.includes('qwen')) return 80;
    if (s.includes('llama')) return 75;
    if (s.includes('gemma')) return 70;
    return 50;
  }

  async function fetchAvailableGroqModels(key, forceRefresh = false) {
    if (!forceRefresh && cachedModels.length) return cachedModels;

    const savedModel = (!forceRefresh && typeof safeStorage !== 'undefined')
      ? (safeStorage.getItem(MODEL_CACHE_KEY) || '').trim()
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
        const ids = (Array.isArray(json.data) ? json.data : [])
          .filter(m => m && m.id && m.active !== false && isUsableChatModel(m.id))
          .map(m => m.id)
          .sort((a, b) => scoreModelPriority(b) - scoreModelPriority(a));
        if (ids.length) {
          cachedModels = savedModel && ids.includes(savedModel)
            ? [savedModel, ...ids.filter(x => x !== savedModel)]
            : ids;
          return cachedModels;
        }
      }
    } catch (e) {
      clearTimeout(timer);
    }

    // モデル一覧取得に失敗した場合の予備リスト
    const fallbackIds = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'qwen/qwen3-32b'];
    cachedModels = savedModel ? [savedModel, ...fallbackIds.filter(x => x !== savedModel)] : fallbackIds;
    return cachedModels;
  }

  function extractJsonFromText(raw) {
    if (!raw || typeof raw !== 'string') return null;
    try { return JSON.parse(raw); } catch (e) {}
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch (e) { return null; }
  }

  // --------------------------------------------------------------------------
  // 3. 状況収集 ＆ Groq API 通信
  // --------------------------------------------------------------------------
  function collectObservationText() {
    const lines = [];
    for (let i = 0; i < sensors.length; i++) {
      try {
        const res = sensors[i]();
        if (typeof res === 'string' && res.trim()) lines.push(res.trim());
      } catch (e) {
        console.warn('AICommCore sensor error:', e);
      }
    }
    return lines.join('\n');
  }

  async function callGroqWithModel(key, modelId, prompt, useJsonFormat = true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const body = {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.8
      };
      if (useJsonFormat) body.response_format = { type: 'json_object' };

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
      const raw = data.choices?.[0]?.message?.content;
      const parsed = extractJsonFromText(raw);
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, status: 200, detail: 'JSON解析失敗' };
      }
      return { ok: true, data: parsed, modelId };
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

    const actions = Array.from(actionMap.values());
    if (!actions.length) return { ok: false, reason: '実行可能なアクション未登録' };

    const actionIds   = actions.map(a => a.id).join('/');
    const actionsText = actions.map(a => `- ${a.id}: ${a.desc}`).join('\n');
    const obsText     = collectObservationText();
    const persona     = (typeof QUIRKY_PROMPTS_MAP !== 'undefined' && QUIRKY_PROMPTS_MAP.base_persona && QUIRKY_PROMPTS_MAP.base_persona.enabled)
      ? QUIRKY_PROMPTS_MAP.base_persona.prompt
      : 'あなたはパステル島で自由に考えて生きる小さなロボットです。';

    const prompt = `${persona}
現在の状況を見て、次に何をするか自分の意思で1つ自由に選んでください。

【現在の状況】
${obsText}

【選べる行動】
${actionsText}

以下のJSON形式のみで返答してください（前置き・解説禁止）:
{"action":"${actionIds}のいずれか","dir":"北/南/東/西/北西/北東/南西/南東のいずれか","emotion":"normal/joy/anger/sad/fun/fear/think/surprise/wave/sleep/swing_v/pickup/carry/push/run/peek/struggleのいずれか","thought":"その行動を選んだ理由や心の声(1文)"}`;

    let models = await fetchAvailableGroqModels(key, false);
    let lastError = '';

    // 最大3モデルまで自動リトライ（404や400時に次の利用可能モデルへ切替）
    for (let i = 0; i < Math.min(models.length, 3); i++) {
      const mId = models[i];
      let res = await callGroqWithModel(key, mId, prompt, true);

      // json_object非対応モデルによる400エラー時はフォーマット指定なしで再試行
      if (!res.ok && res.status === 400) {
        res = await callGroqWithModel(key, mId, prompt, false);
      }

      if (res.ok) {
        if (typeof safeStorage !== 'undefined') safeStorage.setItem(MODEL_CACHE_KEY, mId);
        return res;
      }

      lastError = `HTTP ${res.status}${res.detail ? ': ' + res.detail : ''}`;

      // 認証エラー(401)や回数制限(429)はモデルを変えても解決しないため即終了
      if (res.status === 401 || res.status === 429) break;

      // 初回404ならモデル一覧を強制再取得してやり直す
      if (res.status === 404 && i === 0) {
        if (typeof safeStorage !== 'undefined') safeStorage.removeItem(MODEL_CACHE_KEY);
        models = await fetchAvailableGroqModels(key, true);
      }
    }

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
  // 4. ターン実行制御（Groq通信専用・通信不可時は一切動かず停止）
  // --------------------------------------------------------------------------
  async function runTurn() {
    if (!commEnabled) {
      showStopMessage(
        '⏸️ 通信OFF（待機中）',
        '通信がOFFのため行動せず待機しています（サイコロ自動行動は廃止済みです）。動かすには⚙️設定で通信をONにしてください。'
      );
      return;
    }

    const btn  = document.getElementById('btn-action');
    const stEl = document.getElementById('ai-status');
    if (btn) btn.disabled = true;
    if (stEl) stEl.innerText = '🟪 Groq思考中...';

    try {
      const res = await requestDecision();
      if (!res.ok) {
        showStopMessage(
          `⚠️ Groq通信停止（行動なし）`,
          `通信できなかったためロボットは動かずに待機しました。\n理由：${res.reason}`
        );
        return;
      }

      if (++TIME_STEP >= 20) {
        TIME_STEP = 0;
        GAME_DAY++;
        DIARY_LOGS.push(`🌅 ${GAME_DAY}日目の朝を迎えたよ！`);
      }

      const dec = res.data;
      const prevPos = { x: ROBOT.pos.x, z: ROBOT.pos.z, lv: ROBOT.pos.lv };
      const dir = findDirByShortName(dec.dir);
      const chosenAction = actionMap.get(dec.action) || actionMap.get('rest') || Array.from(actionMap.values())[0];

      let thoughtText = (typeof dec.thought === 'string' && dec.thought.trim())
        ? dec.thought.trim()
        : '自分で考えて行動したよ！';
      let actionLabel = `🟪 Groq判断：${chosenAction.id}`;

      try {
        const out = chosenAction.run({ dec, dir, prevPos });
        if (out && out.actionLabel) actionLabel = out.actionLabel;
        if (out && out.thoughtAppend) thoughtText += out.thoughtAppend;
      } catch (e) {
        console.warn('AICommCore action execution error:', e);
      }

      ROBOT.emotion = (typeof POSE_TABLE !== 'undefined' && POSE_TABLE[dec.emotion]) ? dec.emotion : 'normal';
      ROBOT.bulbEmotion = null;
      if (OBS_MODE === 'ai_mode') AI_MEMORY.push(`${actionLabel}:${thoughtText}`);
      DIARY_LOGS.push(`🟪 ${GAME_DAY}日目：${thoughtText}`);

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
        if (msgEl) msgEl.innerText = `力尽きてしまった…。記憶と夢を引き継ぎ、第${ROBOT.gen + 1}世代が誕生します！`;
        setTimeout(() => {
          ROBOT.gen += 1;
          life = new LifeCore();
          GAME_DAY = 1; TIME_STEP = 0; AI_MEMORY = [];
          DIARY_LOGS.push(`📖 記憶を引き継いで第${ROBOT.gen}世代が誕生した！`);
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

  // グローバル配線（サイコロ思考への抜け道を完全に塞ぐ）
  window.executeTurn = runTurn;
  if (typeof executeTurn !== 'undefined') executeTurn = runTurn;
  const actionBtn = document.getElementById('btn-action');
  if (actionBtn) actionBtn.onclick = () => window.executeTurn();

  if (typeof getActiveBrainBadgeText === 'function') {
    getActiveBrainBadgeText = function() {
      if (commEnabled && (safeStorage.getItem('api_groq') || '').trim()) return '🟪 Groq自律通信ON';
      if (commEnabled) return '⚠️ Groqキー未設定';
      return '⏸️ 通信OFF(停止)';
    };
  }
  window.toggleAiCommSwitch = setEnabled;

  // 不変コアAPIを上書き不可で公開
  const coreApi = Object.freeze({
    version: '2.0-groq-only-locked',
    isEnabled,
    setEnabled,
    registerAction,
    registerSensor,
    registerPostTurnHook,
    listActions: () => Array.from(actionMap.values()).map(a => ({ id: a.id, desc: a.desc }))
  });
  Object.defineProperty(window, 'AICommCore', {
    value: coreApi,
    writable: false,
    configurable: false
  });

  // ==========================================================================
  // 5. 標準センサー ＆ 標準アクション ＆ 標準ターン後フック
  // ==========================================================================
  registerSensor(() => {
    const curH  = getRobotHeightLevel();
    const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;
    const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
    const st    = life.getState();
    const area  = (typeof getCurrentAreaDef === 'function') ? getCurrentAreaDef() : null;
    const dirs  = ALL_DIRS.map(d => {
      const c = checkMoveAndPosture(ROBOT.pos.x, ROBOT.pos.z, curH, d);
      return `${d.name.replace('(斜め)', '')}:${c.canMove ? `可(${c.reason},段差${c.stepDiff})` : `不可(${c.reason},段差${c.stepDiff})`}`;
    }).join(' / ');
    const items = WORLD_ITEMS.map(it => `${it.type}(${it.x},${it.z})`).join(', ') || 'なし';
    const portals = (area && area.portals && area.portals.length)
      ? area.portals.map(p => `${p.label}(${p.x},${p.z})`).join(', ')
      : 'なし';
    const mem = (OBS_MODE === 'ai_mode' && AI_MEMORY.length) ? AI_MEMORY.slice(-4).join(' / ') : 'なし';

    return [
      `場所:${area ? area.name : 'パステル島'} 座標:(x=${ROBOT.pos.x},z=${ROBOT.pos.z},層=${curH}) 姿勢:${ROBOT.posture}`,
      `体格:高さ${sSpec.label}(${sSpec.subH}) 太さ${bSpec.label}(${bSpec.reqWidth})`,
      `状態:体力${st.stamina} おなか${st.energy} ごきげん${st.mental} トラウマ:${ROBOT.traumas.join(',') || 'なし'}`,
      `夢:${getCurrentDreamTitle()} カバン:[${BAG.join(',') || '空'}] アイテム:[${items}] 仕掛け:[${portals}]`,
      `8方向物理判定: ${dirs}`,
      `最近の記憶: ${mem}`
    ].join('\n');
  });

  registerAction({
    id: 'move',
    desc: '指定した方角(北/南/東/西/北西/北東/南西/南東)へ移動する',
    run: ({ dir }) => {
      const chk = checkMoveAndPosture(ROBOT.pos.x, ROBOT.pos.z, getRobotHeightLevel(), dir);
      ROBOT.rotY = dir.rot;
      if (chk.canMove) {
        ROBOT.pos.x += dir.dx; ROBOT.pos.z += dir.dz; ROBOT.pos.lv = chk.targetLv;
        ROBOT.pos.sx = 2; ROBOT.pos.sz = 2; ROBOT.posture = chk.posture;
        life.energy -= 5; life.stamina -= 6; life.mental += 8;
        ROBOT.params.curiosity = Math.min(100, (ROBOT.params.curiosity || 60) + 2);
        return { actionLabel: `🟪 Groq判断：${dir.name}へ移動` };
      }
      return { actionLabel: `🟪 Groq判断：${dir.name}は塞がっていた(${chk.reason})`, thoughtAppend: '（通れなかった！）' };
    }
  });

  registerAction({
    id: 'dig_front',
    desc: '指定した方角の目の前の壁や土を掘る',
    run: ({ dir }) => {
      ROBOT.rotY = dir.rot;
      const res = digFromCharacterFront(ROBOT.pos.x, ROBOT.pos.z, getRobotHeightLevel(), dir, ROBOT.posture === 'crawl', getEffectiveParams().power);
      life.stamina -= 8; life.mental += 6;
      ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
      if (res.completedLevel && BAG.length < 10) BAG.push('stone');
      return { actionLabel: `🟪 Groq判断：${dir.name}の壁を掘削` };
    }
  });

  registerAction({
    id: 'rest',
    desc: 'その場で省エネ休憩・居眠りして体力を回復する',
    run: () => {
      life.stamina = Math.min(100, life.stamina + 30);
      life.energy -= 3;
      ROBOT.params.eco = Math.min(100, (ROBOT.params.eco || 40) + 2);
      return { actionLabel: '🟪 Groq判断：💤 ひと休み' };
    }
  });

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

    if (areaDef.puzzle && typeof AREA_PUZZLE_SOLVED !== 'undefined' && !AREA_PUZZLE_SOLVED[areaDef.id] &&
        ROBOT.pos.x === areaDef.puzzle.x && ROBOT.pos.z === areaDef.puzzle.z) {
      const idx = BAG.indexOf(areaDef.puzzle.needItem);
      if (idx !== -1) {
        BAG.splice(idx, 1);
        AREA_PUZZLE_SOLVED[areaDef.id] = true;
        if (areaDef.dreamBonus && ROBOT.params[areaDef.dreamBonus] !== undefined) {
          ROBOT.params[areaDef.dreamBonus] = Math.min(100, (ROBOT.params[areaDef.dreamBonus] || 50) + 6);
        }
        DIARY_LOGS.push(`🧩 ${GAME_DAY}日目：${areaDef.name}のパズルを解決！`);
      }
    }

    const act = window.ACTIVE_ENTITIES || {};
    const npc = act.npc || act.guestNpc;
    if (npc && !npc.traded && Math.abs(ROBOT.pos.x - npc.x) + Math.abs(ROBOT.pos.z - npc.z) <= 1) {
      const wIdx = BAG.indexOf(npc.want);
      if (wIdx !== -1) {
        BAG.splice(wIdx, 1);
        if (BAG.length < 10) BAG.push(npc.give);
        npc.traded = true;
        DIARY_LOGS.push(`🤝 ${GAME_DAY}日目：${npc.icon}${npc.name}と交換した！`);
      }
    }

    const enemy = act.enemy;
    if (enemy && !enemy.defeated && Math.abs(ROBOT.pos.x - enemy.x) + Math.abs(ROBOT.pos.z - enemy.z) <= 1) {
      const petSpec = (ROBOT.pet && window.ENTITY_DB && window.ENTITY_DB.pets[ROBOT.pet.id]) ? window.ENTITY_DB.pets[ROBOT.pet.id] : null;
      enemy.defeated = true;
      if (!petSpec || petSpec.perk !== 'guard_enemy') life.stamina = Math.max(5, life.stamina - (enemy.dmg || 10));
    }

    const wp = act.wildPet;
    if (wp && Math.abs(ROBOT.pos.x - wp.x) + Math.abs(ROBOT.pos.z - wp.z) <= 1) {
      ROBOT.pet = { id: wp.id, x: prevPos.x, z: prevPos.z, lv: prevPos.lv };
      act.wildPet = null;
      DIARY_LOGS.push(`🐾 ${GAME_DAY}日目：${wp.icon}${wp.name}が相棒になった！`);
    }

    const portal = (areaDef.portals || []).find(p => p.x === ROBOT.pos.x && p.z === ROBOT.pos.z);
    if (portal && (!portal.needPuzzle || (typeof AREA_PUZZLE_SOLVED !== 'undefined' && AREA_PUZZLE_SOLVED[areaDef.id]))) {
      if (typeof window.switchAreaById === 'function') {
        DIARY_LOGS.push(`🗺️ ${GAME_DAY}日目：${portal.label}で移動した！`);
        window.switchAreaById(portal.target, true);
        return { switchedArea: true };
      }
    }
    return null;
  });

  setEnabled(commEnabled);
})();
