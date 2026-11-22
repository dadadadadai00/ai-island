// ============================================================================
// 【分割AI通信モジュール 1/4：ai_api.js】
// ・共通ハブ window.AI_SYS・定数・共有状態の初期化
// ・Groq API通信・実在アクティブモデル自動検出・JSON解析
// ============================================================================
(function initAiApiModule() {
  const SYS = window.AI_SYS = window.AI_SYS || {};

  const CONST = SYS.CONST = {
    GROQ_CHAT_URL:          'https://api.groq.com/openai/v1/chat/completions',
    GROQ_MODELS_URL:        'https://api.groq.com/openai/v1/models',
    TIMEOUT_MS:             22000,
    TEXT_MODEL_CACHE_KEY:   'groq_text_model_cache_v5',
    VISION_MODEL_CACHE_KEY: 'groq_vision_model_cache_v5',
    MANUAL_MODEL_KEY:       'groq_manual_model_v1',
    VISION_MODE_KEY:        'ai_vision_mode_v1',
    MAX_SHORT_MEMORY:       4,
    B_MODE_LOCKED:          true,  // A案安定までB案(画像AI送信)は一時停止・内部温存
    PORTAL_TRAVEL_DISABLED: true   // 初期エリアのみで基本動作検証
  };

  const initComm = (typeof safeStorage !== 'undefined') && (safeStorage.getItem('ai_comm_enabled') === '1');
  const initVision = CONST.B_MODE_LOCKED
    ? 'map'
    : ((typeof safeStorage !== 'undefined' && safeStorage.getItem(CONST.VISION_MODE_KEY) === 'image') ? 'image' : 'map');
  if (CONST.B_MODE_LOCKED && typeof safeStorage !== 'undefined') {
    safeStorage.setItem(CONST.VISION_MODE_KEY, 'map');
  }

  SYS.state = {
    commEnabled: initComm,
    visionMode: initVision,
    lastTurnWasMoving: false,
    shortTermMemory: [],
    turnSequenceNo: 0,
    lastTurnAudit: {
      hasData: false, turnNo: 0, time: '未実行', day: 1, mode: 'map',
      isMovingBefore: false, isMovingAfter: false, modelId: '-',
      facingBefore: '-', facingAfter: '-',
      beforeImageUrl: null, afterImageUrl: null,
      promptText: '', rawResponse: '', parsedJson: null,
      actionId: '-', dirName: '-', itemName: '-', countVal: '-',
      emotionId: '-', motionLabel: '-', thoughtText: '',
      actionLabel: '-', physicalResult: '-', error: ''
    }
  };

  let cachedTextModels    = [];
  let cachedVisionModels  = [];
  let lastAllActiveModels = [];

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

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
    return (safeStorage.getItem(CONST.MANUAL_MODEL_KEY) || '').trim();
  }

  function clearModelCache() {
    cachedTextModels = [];
    cachedVisionModels = [];
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

    const cacheKey = wantVision ? CONST.VISION_MODEL_CACHE_KEY : CONST.TEXT_MODEL_CACHE_KEY;
    const savedModel = (!forceRefresh && typeof safeStorage !== 'undefined')
      ? (safeStorage.getItem(cacheKey) || '').trim() : '';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    let allActive = [];
    try {
      const res = await fetch(CONST.GROQ_MODELS_URL, {
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
        const high = allActive.filter(id => scoreVisionModel(id) > 0).sort((a, b) => scoreVisionModel(b) - scoreVisionModel(a));
        const rest = allActive.filter(id => scoreVisionModel(id) <= 0).sort((a, b) => scoreTextModel(b) - scoreTextModel(a));
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

  async function callGroqApi(key, modelId, promptText, sendImageUrl, useJsonFormat) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONST.TIMEOUT_MS);
    try {
      const userContent = sendImageUrl
        ? [{ type: 'text', text: promptText }, { type: 'image_url', image_url: { url: sendImageUrl } }]
        : promptText;

      const body = { model: modelId, messages: [{ role: 'user', content: userContent }], max_tokens: 320, temperature: 0.75 };
      if (useJsonFormat && !sendImageUrl) body.response_format = { type: 'json_object' };

      const res = await fetch(CONST.GROQ_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        let errDetail = '';
        try { const ej = await res.json(); errDetail = ej?.error?.message || ''; } catch (e) {}
        return { ok: false, status: res.status, detail: errDetail };
      }

      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || '';
      const parsed = extractJsonFromText(raw);
      if (!parsed || typeof parsed !== 'object') return { ok: false, status: 200, detail: 'JSON解析失敗', raw };
      return { ok: true, data: parsed, raw, modelId };
    } catch (e) {
      clearTimeout(timer);
      return { ok: false, status: 0, detail: e.name === 'AbortError' ? 'タイムアウト' : (e.message || '通信エラー') };
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
    const cacheKey = wantVision ? CONST.VISION_MODEL_CACHE_KEY : CONST.TEXT_MODEL_CACHE_KEY;
    let models = await fetchAvailableModels(key, wantVision, false);
    let lastError = '', lastRaw = '', triedModels = [];

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

  SYS.api = { escapeHtml, getManualModelOverride, clearModelCache, fetchAvailableModels, extractJsonFromText, requestDecision };
  if (window.DebugGuard) window.DebugGuard.markLoaded('ai_api.js');
})();

