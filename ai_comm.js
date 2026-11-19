// ============================================================================
// 【不変通信コア：ai_comm.js（Groq自律行動決定・プラグイン登録型・上書きロック）】
// ※新ルール・新行動を追加する際は、このファイルを書き換えず
//   他ファイルから AICommCore.registerAction / registerSensor を呼ぶだけで自動反映されます。
// ============================================================================
(function initImmutableAICommCore() {
  if (window.AICommCore) return; // 二重読み込み・上書き防止

  const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODEL    = 'llama-3.3-70b-versatile';
  const TIMEOUT_MS    = 12000;

  let commEnabled = (typeof safeStorage !== 'undefined') && (safeStorage.getItem('ai_comm_enabled') === '1');
  const actionMap = new Map();
  const sensors   = [];
  const postHooks = [];

  // --------------------------------------------------------------------------
  // 1. プラグイン登録API（外部ファイルから新ルールを無改造で差し込む口）
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
        ? '📡 通信 ON（Groqが行動を決定）'
        : '🎲 通信 OFF（サイコロ行動思考）';
    }
    if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
  }

  function isEnabled() { return commEnabled; }

  // --------------------------------------------------------------------------
  // 2. 状況収集 ＆ Groq API 通信（タイムアウト＆JSON防御付き）
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

  async function requestDecision() {
    const key = (typeof safeStorage !== 'undefined') ? safeStorage.getItem('api_groq') : '';
    if (!key) return { ok: false, reason: 'no_key' };

    const actions = Array.from(actionMap.values());
    if (!actions.length) return { ok: false, reason: 'no_actions' };

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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 180,
          temperature: 0.85
        }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) return { ok: false, reason: `http_${res.status}` };
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content;
      if (!raw) return { ok: false, reason: 'empty' };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'invalid_json' };
      return { ok: true, data: parsed };
    } catch (e) {
      clearTimeout(timer);
      console.warn('AICommCore Groq error:', e);
      return { ok: false, reason: e.name === 'AbortError' ? 'timeout' : 'network' };
    }
  }

  function findDirByShortName(name) {
    if (!name || typeof ALL_DIRS === 'undefined') return ALL_DIRS[0];
    return ALL_DIRS.find(d => d.name.replace('(斜め)', '') === name || d.name === name) || ALL_DIRS[0];
  }

  // --------------------------------------------------------------------------
  // 3. ターン実行制御（ON: Groq判断 / OFF: 元のサイコロ思考へフォールバック）
  // --------------------------------------------------------------------------
  const fallbackTurnFn = (typeof executeTurn === 'function') ? executeTurn : null;

  async function runTurn() {
    if (!commEnabled) {
      return fallbackTurnFn ? await fallbackTurnFn() : undefined;
    }

    const btn  = document.getElementById('btn-action');
    const stEl = document.getElementById('ai-status');
    if (btn) btn.disabled = true;
    if (stEl) stEl.innerText = '🟪 Groq思考中...';

    // ※通信成功までは TIME_STEP を進めない（フォールバック時の二重加算防止）
    const res = await requestDecision();
    if (!res.ok) {
      if (btn) btn.disabled = false;
      const msg = res.reason === 'no_key'
        ? '⚠️ Groq APIキー未設定のためサイコロ思考で実行'
        : `⚠️ Groq通信失敗(${res.reason})：サイコロ思考へ切替`;
      if (typeof showToast === 'function') showToast(msg);
      return fallbackTurnFn ? await fallbackTurnFn() : undefined;
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

    // ターン後フック（アイテム拾得・パズル・住人・敵・ペット・ポータル等）
    let switchedArea = false;
    for (let i = 0; i < postHooks.length; i++) {
      try {
        const hookRes = postHooks[i]({ dec, dir, prevPos });
        if (hookRes && hookRes.switchedArea) { switchedArea = true; break; }
      } catch (e) {
        console.warn('AICommCore postHook error:', e);
      }
    }

    if (switchedArea) {
      if (btn) btn.disabled = false;
      return;
    }

    if (typeof manualCameraMode !== 'undefined' && manualCameraMode === 'robot' && typeof resetFpvToRobotFront === 'function') {
      resetFpvToRobotFront();
    }
    if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
    if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
    if (typeof applyRobotBulbColor === 'function') applyRobotBulbColor();
    if (typeof cameraDirty !== 'undefined') cameraDirty = true;
    if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
    if (typeof saveWorldState === 'function') saveWorldState();

    // 体力・おなか0での世代交代チェック
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
        if (btn) btn.disabled = false;
      }, 1800);
      return;
    }

    setTimeout(() => {
      if (stEl) stEl.innerText = getActiveBrainBadgeText();
      if (typeof applyRobotBulbColor === 'function') applyRobotBulbColor();
      if (btn) btn.disabled = false;
    }, 220);
  }

  // グローバル配線（world.js で固定されていた btn-action のクリック先を動的に張り替える）
  window.executeTurn = runTurn;
  if (typeof executeTurn !== 'undefined') executeTurn = runTurn;
  const actionBtn = document.getElementById('btn-action');
  if (actionBtn) actionBtn.onclick = () => window.executeTurn();

  if (typeof getActiveBrainBadgeText === 'function') {
    getActiveBrainBadgeText = function() {
      if (commEnabled && safeStorage.getItem('api_groq')) return '🟪 Groq自律通信ON';
      if (commEnabled) return '⚠️ Groqキー未設定';
      return '🎲 通信OFF(サイコロ思考)';
    };
  }
  window.toggleAiCommSwitch = setEnabled;

  // 不変コアAPIを上書き不可で公開
  const coreApi = Object.freeze({
    version: '1.0-locked',
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
  // 4. 標準センサー ＆ 標準アクション ＆ 標準ターン後フックの初期登録
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
    desc: '指定した方角(北/南/東/西/北西/北東/南西/南東)へ1マス移動する',
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
    desc: '指定した方角の目の前の壁や土を削る・掘る',
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
    id: 'dig_down',
    desc: '自分の足元を掘って下の層へ降りる（落下する）',
    run: () => {
      const res = digUnderneathAndFall();
      life.stamina -= 7;
      ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
      return { actionLabel: `🟪 Groq判断：足元掘り(${res ? res.dropSub : 0}段落下)` };
    }
  });

  registerAction({
    id: 'stack_step',
    desc: 'カバンの🪨石を使って足元に小段差(踏み台)を積む',
    run: () => {
      const idx = BAG.indexOf('stone');
      if (idx !== -1 && addSubStepFootholdAt(ROBOT.pos.x, ROBOT.pos.z, 1)) {
        BAG.splice(idx, 1);
        ROBOT.params.logic = Math.min(100, (ROBOT.params.logic || 50) + 3);
        return { actionLabel: '🟪 Groq判断：🪨石で足元に段差を積んだ' };
      }
      return { actionLabel: '🟪 Groq判断：石を積もうとしたが石がない' };
    }
  });

  registerAction({
    id: 'use_oil',
    desc: 'カバンの🧴オイルを使って狭い穴対策やトラウマ解消をする',
    run: () => {
      const idx = BAG.indexOf('oil');
      if (idx !== -1) {
        BAG.splice(idx, 1);
        ROBOT.traumas = (ROBOT.traumas || []).filter(t => t !== 'narrow');
        return { actionLabel: '🟪 Groq判断：🧴オイルを使用' };
      }
      return { actionLabel: '🟪 Groq判断：オイルを持っていなかった' };
    }
  });

  registerAction({
    id: 'use_grass',
    desc: 'カバンの🌿草ブロックを使ってごきげん回復＆夜空の星座を見る',
    run: () => {
      const idx = BAG.indexOf('grass');
      if (idx !== -1) {
        BAG.splice(idx, 1);
        life.mental = Math.min(100, life.mental + 25);
        ROBOT.params.cautionLimiter = Math.min(100, (ROBOT.params.cautionLimiter || 50) + 3);
        return { actionLabel: '🟪 Groq判断：🌿草ブロックで気分転換' };
      }
      return { actionLabel: '🟪 Groq判断：草ブロックを持っていなかった' };
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

  // 標準ターン後フック：アイテム拾得・ペット追従・パズル・住人・敵・野生ペット・ポータル
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
