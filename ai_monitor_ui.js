// ============================================================================
// 【分割AI通信モジュール 4/4：ai_monitor_ui.js】
// ・1ターン答え合わせ2タブモーダル（目標メモ/詳細指定の独立行表示）・コピペ・設定UI
// ・自動「⚡ 今すぐ考える」連続再生（5段階間隔・モニター開いたら即完全停止）
// ・全モーダル共通の非崩れピンチ拡大縮小（内部スクロール保護付き）
// ============================================================================
(function initAiMonitorUiModule() {
  const SYS = window.AI_SYS;
  if (!SYS || !SYS.state || !SYS.api || !SYS.camera || !SYS.core) return;

  const CONST = SYS.CONST;
  const ST = SYS.state;
  const API = SYS.api;
  const CAM = SYS.camera;
  const CORE = SYS.core;

  const AUTO_INTERVAL_KEY = 'ai_auto_interval_ms_v2';
  const AUTO_INTERVAL_OPTIONS = [
    { ms: 2500,  label: '① 2.5秒（高速・有料枠向け）' },
    { ms: 5000,  label: '② 5.0秒（標準・有料枠向け）' },
    { ms: 10000, label: '③ 10秒（やや遅め・軽負荷）' },
    { ms: 16000, label: '④ 16秒（無料枠・安定推奨）' },
    { ms: 25000, label: '⑤ 25秒（無料枠・超安全）' }
  ];

  let currentMonitorTab = 'before';
  let currentDimMoving = false;
  const modalResetFns = [];

  let autoPlayEnabled = false;
  let autoTimerId = null;
  let autoBusy = false;

  function getAutoIntervalMs() {
    const raw = (typeof safeStorage !== 'undefined') ? Number(safeStorage.getItem(AUTO_INTERVAL_KEY)) : 16000;
    const hit = AUTO_INTERVAL_OPTIONS.find(o => o.ms === raw);
    return hit ? hit.ms : 16000;
  }

  function isAnyModalOpen() {
    return Array.from(document.querySelectorAll('.modal-overlay')).some(
      el => el.classList.contains('active') || (el.style.display && el.style.display !== 'none')
    );
  }

  function updateAutoPlayButtonUI() {
    const btn = document.getElementById('btn-auto-play');
    if (!btn) return;
    if (autoPlayEnabled) {
      btn.innerText = '⏹ 停止';
      btn.style.background = '#ef4444';
      btn.style.color = '#ffffff';
      btn.style.borderColor = '#dc2626';
    } else {
      btn.innerText = '▶ 自動';
      btn.style.background = '#0f172a';
      btn.style.color = '#38bdf8';
      btn.style.borderColor = '#38bdf8';
    }
  }

  function stopAutoPlay(reasonToast = '') {
    autoPlayEnabled = false;
    if (autoTimerId) { clearTimeout(autoTimerId); autoTimerId = null; }
    updateAutoPlayButtonUI();
    if (reasonToast && typeof showToast === 'function') showToast(reasonToast);
  }

  function scheduleNextAutoTick(delayMs) {
    if (!autoPlayEnabled) return;
    if (autoTimerId) clearTimeout(autoTimerId);
    autoTimerId = setTimeout(runAutoTick, delayMs);
  }

  async function runAutoTick() {
    autoTimerId = null;
    if (!autoPlayEnabled) return;
    if (!ST.commEnabled) {
      stopAutoPlay('⏸️ 通信OFFのため自動思考を停止しました');
      return;
    }
    if (isAnyModalOpen()) {
      stopAutoPlay('⏹ モニター/設定画面を開いたため自動思考を停止しました');
      return;
    }
    if (autoBusy) {
      scheduleNextAutoTick(500);
      return;
    }
    const actBtn = document.getElementById('btn-action');
    if (actBtn && actBtn.disabled) {
      scheduleNextAutoTick(500);
      return;
    }

    autoBusy = true;
    try {
      await CORE.runTurn();
    } catch (e) {
      stopAutoPlay('⚠️ 実行エラーのため自動思考を停止しました');
      autoBusy = false;
      return;
    }
    autoBusy = false;

    // 通信中に停止またはモニターが開かれていた場合は次を絶対に予約しない
    if (!autoPlayEnabled) return;
    if (isAnyModalOpen()) {
      stopAutoPlay('⏹ モニター/設定画面を開いたため自動思考を停止しました');
      return;
    }
    if (ST.lastTurnAudit && ST.lastTurnAudit.error) {
      const is429 = String(ST.lastTurnAudit.error).includes('429');
      stopAutoPlay(is429
        ? '⚠️ レート制限(429)で停止：⚙️設定で間隔を④16秒〜⑤25秒へ広げてください'
        : '⚠️ 通信エラーのため自動思考を停止しました');
      return;
    }
    if (typeof life !== 'undefined' && life && life.getState && life.getState().mode === 'DEAD') {
      stopAutoPlay('💀 世代交代のため自動思考を停止しました');
      return;
    }
    scheduleNextAutoTick(getAutoIntervalMs());
  }

  function setAutoPlay(isOn) {
    if (!isOn) {
      stopAutoPlay('⏹ 自動思考を停止しました');
      return;
    }
    if (!ST.commEnabled) {
      if (typeof showToast === 'function') showToast('⚠️ 先に⚙️設定で通信ONにしてください');
      updateAutoPlayButtonUI();
      return;
    }
    if (isAnyModalOpen()) {
      if (typeof showToast === 'function') showToast('⚠️ 開いている画面を閉じてから自動思考を押してください');
      updateAutoPlayButtonUI();
      return;
    }
    autoPlayEnabled = true;
    updateAutoPlayButtonUI();
    const sec = (getAutoIntervalMs() / 1000).toFixed(1).replace(/\.0$/, '');
    if (typeof showToast === 'function') showToast(`▶ 自動思考ON（間隔 ${sec}秒）`);
    scheduleNextAutoTick(250);
  }

  // --- 1ターン答え合わせテキスト生成 ＆ クリップボード ---
  function formatDetailParams(a) {
    const parts = [];
    if (a.subVal && a.subVal !== '-') parts.push(`sub:${a.subVal}`);
    if (a.targetVal && a.targetVal !== '-') parts.push(`target:${a.targetVal}`);
    if (a.shapeVal && a.shapeVal !== '-') parts.push(`shape:${a.shapeVal}`);
    if (a.faceVal && a.faceVal !== '-') parts.push(`face:${a.faceVal}`);
    if (a.itemName && a.itemName !== '-') parts.push(`item:${a.itemName}`);
    if (a.countVal && a.countVal !== '-') parts.push(`count:${a.countVal}`);
    return parts.length ? parts.join(' / ') : 'なし';
  }

  function buildTurnCopyText() {
    const a = ST.lastTurnAudit;
    if (!a.hasData) {
      const p = CORE.buildPerceptionPayload('map', ST.lastTurnWasMoving);
      return [
        '=== 【通信前プレビュー（まだ1ターン未実行）】 ===',
        `視野状態: ${p.isMoving ? '移動視点(前方視野)' : 'クリア(停止180°)'}`,
        `向いている方角: ${CAM.rotToShortDirName(ROBOT.rotY || 0)}`,
        '', '【送信予定の情報文】', p.promptText
      ].join('\n');
    }

    const lines = [
      `=== 【1ターン答え合わせレポート】第${a.turnNo}ターン（${a.day}日目 / ${a.time}）===`,
      `通信方式: A案(記号マップ送信) / 使用モデル: ${a.modelId}`,
      `視野状態: 行動前=${a.isMovingBefore ? '移動視点' : 'クリア(停止180°)'}（向き:${a.facingBefore}） → 行動後=${a.isMovingAfter ? '移動視点' : 'クリア(停止180°)'}（向き:${a.facingAfter}）`,
      '', '--- [1] AIへ送信した情報文（今すぐ考える前） ---', a.promptText || '(なし)',
      '', '--- [2] AIからの返答（しゃべり・目標・判断・動き） ---'
    ];
    if (a.error) {
      lines.push(`エラー: ${a.error}`, `生データ: ${a.rawResponse || '-'}`);
    } else {
      lines.push(`思考・しゃべり: ${a.thoughtText}`);
      if (a.goalText) lines.push(`目標メモ(goal): ${a.goalText}`);
      lines.push(`選んだ行動 / 方角: ${a.actionId} / ${a.dirName}`);
      lines.push(`詳細指定: ${formatDetailParams(a)}`);
      lines.push(`表情・動き(モーション): ${a.motionLabel}`, `生返答JSON: ${a.rawResponse}`);
    }
    lines.push('', '--- [3] 実行後の物理結果 ---', `画面表示ログ: ${a.actionLabel}`, `物理結果: ${a.physicalResult}`, '================================================');
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
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
      document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  // --- 全モーダル共通ピンチ拡大縮小 ---
  function resetAllModalZooms() { modalResetFns.forEach(fn => { try { fn(); } catch (e) {} }); }

  function findInnerScrollableBox(startEl, stopEl) {
    let el = startEl;
    while (el && el !== stopEl && el !== document.body) {
      if (el.dataset && el.dataset.allowInnerScroll === '1') return el;
      try {
        const oy = window.getComputedStyle(el)?.overflowY || '';
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 2) return el;
      } catch (e) {}
      el = el.parentElement;
    }
    return null;
  }

  function attachPinchZoomToModal(overlay) {
    if (!overlay || overlay.dataset.pinchBound === '3') return;
    const content = overlay.querySelector('.modal-content');
    if (!content) return;
    overlay.dataset.pinchBound = '3';

    const MIN_SCALE = 1.0, MAX_SCALE = 2.5;
    let scale = 1.0, panX = 0, panY = 0;
    let pinchActive = false, startDist = 0, startScale = 1.0, startPanX = 0, startPanY = 0, startMidX = 0, startMidY = 0;
    let dragMode = 'none', innerScrollEl = null, dragStartX = 0, dragStartY = 0, dragLastY = 0, dragInitPanX = 0, dragInitPanY = 0;

    content.style.transformOrigin = 'center center';
    content.style.willChange = 'transform';

    const badge = document.createElement('button');
    badge.type = 'button';
    badge.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:9999;display:none;padding:6px 12px;border-radius:999px;border:1.5px solid #38bdf8;background:rgba(15,23,42,0.92);color:#f8fafc;font-size:11.5px;font-weight:900;box-shadow:0 4px 14px rgba(0,0,0,0.35);cursor:pointer;';
    badge.title = 'タップで元の100%サイズへ戻す';
    overlay.appendChild(badge);

    function clampPan(nx, ny, ns) {
      if (ns <= 1.001) return { x: 0, y: 0 };
      const bw = content.offsetWidth || Math.min(window.innerWidth * 0.92, 420);
      const bh = content.offsetHeight || (window.innerHeight * 0.85);
      const maxX = Math.max(20, (bw * ns - window.innerWidth) / 2 + 28);
      const maxY = Math.max(20, (bh * ns - window.innerHeight) / 2 + 48);
      return { x: Math.max(-maxX, Math.min(maxX, nx)), y: Math.max(-maxY, Math.min(maxY, ny)) };
    }

    function applyTransform(ns, nx, ny) {
      const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, ns));
      if (s < 1.03) {
        scale = 1.0; panX = 0; panY = 0;
        content.style.zoom = ''; content.style.transform = ''; badge.style.display = 'none';
        return;
      }
      const cl = clampPan(nx, ny, s);
      scale = s; panX = cl.x; panY = cl.y;
      content.style.zoom = '';
      content.style.transform = `translate3d(${panX.toFixed(1)}px,${panY.toFixed(1)}px,0) scale(${scale.toFixed(3)})`;
      badge.style.display = 'block';
      badge.innerText = `🔍 ${Math.round(scale * 100)}%（元に戻す）`;
    }

    function resetZoom() { pinchActive = false; dragMode = 'none'; innerScrollEl = null; applyTransform(1.0, 0, 0); }
    modalResetFns.push(resetZoom);
    badge.addEventListener('click', (e) => { e.stopPropagation(); resetZoom(); });

    let prevVis = overlay.classList.contains('active') || (overlay.style.display && overlay.style.display !== 'none');
    new MutationObserver(() => {
      const nowVis = overlay.classList.contains('active') || (overlay.style.display && overlay.style.display !== 'none');
      if (nowVis !== prevVis) {
        prevVis = nowVis;
        resetZoom();
        // いずれかのモーダルが開いた瞬間に自動思考を即停止
        if (nowVis && autoPlayEnabled) stopAutoPlay('⏹ 画面を開いたため自動思考を停止しました');
      }
    }).observe(overlay, { attributes: true, attributeFilter: ['style', 'class'] });

    ['pointerdown', 'pointermove', 'pointerup'].forEach(ev => overlay.addEventListener(ev, (e) => e.stopPropagation()));
    overlay.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

    overlay.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        pinchActive = true; dragMode = 'none'; innerScrollEl = null;
        const t0 = e.touches[0], t1 = e.touches[1];
        startDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY) || 1;
        startMidX = (t0.clientX + t1.clientX) / 2; startMidY = (t0.clientY + t1.clientY) / 2;
        startScale = scale; startPanX = panX; startPanY = panY;
      } else if (e.touches.length === 1 && scale > 1.01) {
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
        if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') { dragMode = 'none'; return; }
        innerScrollEl = findInnerScrollableBox(e.target, content);
        dragMode = 'undecided';
        dragStartX = e.touches[0].clientX; dragStartY = e.touches[0].clientY; dragLastY = dragStartY;
        dragInitPanX = panX; dragInitPanY = panY;
      }
    }, { passive: true });

    overlay.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && pinchActive) {
        e.preventDefault(); e.stopPropagation();
        const t0 = e.touches[0], t1 = e.touches[1];
        const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        const curMidX = (t0.clientX + t1.clientX) / 2, curMidY = (t0.clientY + t1.clientY) / 2;
        const ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, startScale * (dist / startDist)));
        const ratio = ns / startScale;
        const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
        applyTransform(ns, (curMidX - cx) - ((startMidX - cx) - startPanX) * ratio, (curMidY - cy) - ((startMidY - cy) - startPanY) * ratio);
        return;
      }
      if (e.touches.length === 1 && scale > 1.01 && dragMode !== 'none') {
        const cx = e.touches[0].clientX, cy = e.touches[0].clientY;
        const dx = cx - dragStartX, dy = cy - dragStartY;
        if (dragMode === 'undecided') {
          if (Math.hypot(dx, dy) < 6) return;
          if (innerScrollEl && Math.abs(dy) >= Math.abs(dx)) { dragMode = 'inner-scroll'; dragLastY = cy; }
          else dragMode = 'pan';
        }
        if (dragMode === 'inner-scroll' && innerScrollEl) {
          const stepY = cy - dragLastY; dragLastY = cy;
          e.preventDefault(); e.stopPropagation();
          innerScrollEl.scrollTop -= stepY / scale;
          return;
        }
        if (dragMode === 'pan') { e.preventDefault(); e.stopPropagation(); applyTransform(scale, dragInitPanX + dx, dragInitPanY + dy); }
      }
    }, { passive: false });

    const endTouch = (e) => {
      if (!e.touches || e.touches.length < 2) pinchActive = false;
      if (!e.touches || e.touches.length === 0) { dragMode = 'none'; innerScrollEl = null; }
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

  // --- 統一2タブ式モニター描画 ＆ 設定UI・自動再生ボタン注入 ---
  function applyDimOverlayState(isMovingDim) {
    currentDimMoving = Boolean(isMovingDim);
    const lM = document.getElementById('mon-dim-left'), rM = document.getElementById('mon-dim-right');
    const cBtn = document.getElementById('btn-dim-clear'), mBtn = document.getElementById('btn-dim-move');
    if (lM) lM.style.opacity = currentDimMoving ? '1' : '0';
    if (rM) rM.style.opacity = currentDimMoving ? '1' : '0';
    if (cBtn && mBtn) {
      cBtn.style.background = !currentDimMoving ? '#38bdf8' : 'transparent';
      cBtn.style.color = !currentDimMoving ? '#0f172a' : '#94a3b8';
      mBtn.style.background = currentDimMoving ? '#f59e0b' : 'transparent';
      mBtn.style.color = currentDimMoving ? '#0f172a' : '#94a3b8';
    }
  }

  function renderUnifiedMonitor(tab = currentMonitorTab) {
    currentMonitorTab = tab;
    const isBefore = (tab === 'before');
    const bBtn = document.getElementById('btn-tab-before'), aBtn = document.getElementById('btn-tab-after');
    if (bBtn && aBtn) {
      bBtn.style.background = isBefore ? '#0284c7' : '#e2e8f0'; bBtn.style.color = isBefore ? '#ffffff' : '#334155';
      aBtn.style.background = !isBefore ? '#0284c7' : '#e2e8f0'; aBtn.style.color = !isBefore ? '#ffffff' : '#334155';
    }

    const metaEl = document.getElementById('mon-meta'), imgEl = document.getElementById('mon-img');
    const pLblEl = document.getElementById('mon-prompt-label'), pEl = document.getElementById('mon-prompt');
    const rLblEl = document.getElementById('mon-reply-label'), rSumEl = document.getElementById('mon-reply-summary');
    const rawEl = document.getElementById('mon-raw-json'), resEl = document.getElementById('mon-phys-result');
    const a = ST.lastTurnAudit;

    function fillReply(headerText) {
      if (rLblEl) rLblEl.innerText = headerText;
      if (!a.hasData) {
        if (rSumEl) rSumEl.innerHTML = '<div style="color:#64748b;">まだ「⚡ 今すぐ考える」が実行されていません</div>';
        if (rawEl) rawEl.textContent = '-';
        if (resEl) resEl.innerHTML = '<div style="color:#78350f;">物理結果：未実行</div>';
        return;
      }
      if (a.error) {
        if (rSumEl) rSumEl.innerHTML = `<div style="color:#dc2626;font-weight:900;">⚠️ 通信エラー：${API.escapeHtml(a.error).replace(/\n/g, '<br>')}</div>`;
      } else {
        const detail = formatDetailParams(a);
        const goalLine = a.goalText ? `<div><strong>🎯 目標メモ：</strong>${API.escapeHtml(a.goalText)}</div>` : '';
        if (rSumEl) {
          rSumEl.innerHTML = [
            goalLine,
            `<div><strong>💬 思考・しゃべり：</strong>${API.escapeHtml(a.thoughtText)}</div>`,
            `<div><strong>🧭 行動 / 方角：</strong><code>${API.escapeHtml(a.actionId)}</code> ／ <strong>${API.escapeHtml(a.dirName)}</strong>　<strong>🤖 動き：</strong>${API.escapeHtml(a.motionLabel)}</div>`,
            `<div><strong>⚙️ 詳細指定：</strong><code>${API.escapeHtml(detail)}</code></div>`
          ].filter(Boolean).join('');
        }
      }
      if (rawEl) { rawEl.textContent = a.rawResponse || '-'; rawEl.scrollTop = 0; }
      if (resEl) resEl.innerHTML = `<div><strong>🧱 結果：</strong>${API.escapeHtml(a.actionLabel)} ／ ${API.escapeHtml(a.physicalResult)}</div>`;
    }

    if (isBefore) {
      if (!a.hasData) {
        const live = CORE.buildPerceptionPayload('map', ST.lastTurnWasMoving);
        if (metaEl) metaEl.innerText = `未実行（通信前） ／ 向き:${CAM.rotToShortDirName(ROBOT.rotY || 0)} ／ 自動視野:${live.isMoving ? '移動視点' : 'クリア'}`;
        if (imgEl && live.fpvImageUrl) imgEl.src = live.fpvImageUrl;
        applyDimOverlayState(live.isMoving);
        if (pLblEl) pLblEl.innerText = '📤 AIへ送る予定の情報文（まだ送信前）';
        if (pEl) { pEl.textContent = live.promptText || ''; pEl.scrollTop = 0; }
        fillReply('📥 AIからの返答（しゃべり・目標・判断・詳細）');
        return;
      }
      if (metaEl) metaEl.innerText = `第${a.turnNo}ターン(${a.day}日目 ${a.time}) ／ 行動前 ／ ${a.isMovingBefore ? '🏃移動視点(自動)' : '🧍クリア(自動)'} ／ 向き:${a.facingBefore}`;
      if (imgEl && a.beforeImageUrl) imgEl.src = a.beforeImageUrl;
      applyDimOverlayState(a.isMovingBefore);
      if (pLblEl) pLblEl.innerText = '📤 AIへ送信した情報文（今すぐ考える前）';
      if (pEl) { pEl.textContent = a.promptText || ''; pEl.scrollTop = 0; }
      fillReply('📥 AIからの返答（しゃべり・目標・判断・詳細）');
    } else {
      const live = CORE.buildPerceptionPayload('map', ST.lastTurnWasMoving);
      if (metaEl) metaEl.innerText = `${a.hasData ? `第${a.turnNo}ターン後(${a.day}日目 ${a.time})` : '現在状態（未実行）'} ／ 次の送信状態 ／ ${live.isMoving ? '🏃移動視点(自動)' : '🧍クリア(自動)'} ／ 向き:${CAM.rotToShortDirName(ROBOT.rotY || 0)}`;
      if (imgEl && live.fpvImageUrl) imgEl.src = live.fpvImageUrl;
      applyDimOverlayState(live.isMoving);
      if (pLblEl) pLblEl.innerText = '📤 現在の状態文（次に送る予定の情報）';
      if (pEl) { pEl.textContent = live.promptText || ''; pEl.scrollTop = 0; }
      fillReply('📥 直前ターンのAI返答（しゃべり・目標・判断・詳細）');
    }
  }

  function openVisionMonitor(initialTab = null) {
    // モニターを開いたら即座に自動思考を完全停止
    if (autoPlayEnabled) stopAutoPlay('👁️ モニターを開いたため自動思考を停止しました');
    const modal = document.getElementById('modal-ai-vision');
    if (!modal) return;
    resetAllModalZooms();
    renderUnifiedMonitor(initialTab || (ST.lastTurnAudit.hasData ? 'before' : 'after'));
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

  function injectAutoPlayButton() {
    const actionBtn = document.getElementById('btn-action');
    if (!actionBtn || document.getElementById('btn-auto-play')) return;
    const parent = actionBtn.parentNode;
    if (!parent) return;

    const row = document.createElement('div');
    row.id = 'action-auto-row';
    row.style.cssText = 'display:flex;gap:6px;align-items:stretch;width:100%;';
    parent.insertBefore(row, actionBtn);
    row.appendChild(actionBtn);
    actionBtn.style.flex = '1';
    actionBtn.style.width = 'auto';

    const autoBtn = document.createElement('button');
    autoBtn.type = 'button';
    autoBtn.id = 'btn-auto-play';
    autoBtn.style.cssText = 'flex:0 0 88px;border-radius:12px;border:2px solid #38bdf8;font-size:12px;font-weight:900;cursor:pointer;padding:0 6px;box-shadow:0 3px 10px rgba(15,23,42,0.22);transition:background 0.15s ease;';
    autoBtn.onclick = () => setAutoPlay(!autoPlayEnabled);
    row.appendChild(autoBtn);
    updateAutoPlayButtonUI();
  }

  function injectVisionControlsUI() {
    injectAutoPlayButton();

    const settingsModal = document.getElementById('modal-settings');
    if (settingsModal && !document.getElementById('setting-ai-vision-mode')) {
      const commCard = settingsModal.querySelector('.comm-toggle-card');
      const group = document.createElement('div');
      group.className = 'setting-group';
      group.style.cssText = 'background:#f0f9ff;border:1.5px solid #7dd3fc;border-radius:12px;padding:8px 10px;gap:6px;';
      const intervalOptsHtml = AUTO_INTERVAL_OPTIONS.map(o => `<option value="${o.ms}">${o.label}</option>`).join('');
      group.innerHTML = `
        <label class="setting-label" style="color:#0369a1;">👁️ AIキャラ視点情報（送信方式）</label>
        <select id="setting-ai-vision-mode" class="setting-input">
          <option value="map">A案：前方視野の記号マップ（使用中・距離正確）</option>
          <option value="image" ${CONST.B_MODE_LOCKED ? 'disabled' : ''}>${CONST.B_MODE_LOCKED ? '🔒 B案：キャラ視点3Dカメラ画像（A案安定まで使用停止）' : 'B案：キャラ視点3Dカメラ画像'}</option>
        </select>
        ${CONST.B_MODE_LOCKED ? '<div style="background:#334155;color:#94a3b8;border:1px solid #475569;border-radius:8px;padding:6px 8px;font-size:10.5px;font-weight:800;opacity:0.85;">🔒 B案（3Dカメラ画像のAI送信）：使用停止中（機能温存・A案安定次第解放）</div>' : ''}
        <label class="setting-label" style="color:#0369a1;margin-top:2px;">▶ 自動思考の実行間隔（5段階・無料枠は④〜⑤推奨）</label>
        <select id="setting-auto-interval" class="setting-input">${intervalOptsHtml}</select>
        <label class="setting-label" style="color:#0369a1;margin-top:2px;">🤖 Groqモデル手動指定（空欄で自動検出）</label>
        <input id="setting-groq-manual-model" type="text" class="setting-input" placeholder="例: openai/gpt-oss-120b（空欄推奨）">
        <button type="button" id="btn-open-vision-mon-from-settings" class="btn-sub" style="padding:6px;font-size:11px;">👁️ 1ターン答え合わせ・キャラ視点を確認する</button>
      `;
      if (commCard && commCard.parentNode) commCard.parentNode.insertBefore(group, commCard.nextSibling);

      const sel = document.getElementById('setting-ai-vision-mode');
      if (sel) { sel.value = ST.visionMode; sel.addEventListener('change', () => CORE.setVisionMode(sel.value)); }
      const intSel = document.getElementById('setting-auto-interval');
      if (intSel) {
        intSel.value = String(getAutoIntervalMs());
        intSel.addEventListener('change', () => {
          if (typeof safeStorage !== 'undefined') safeStorage.setItem(AUTO_INTERVAL_KEY, intSel.value);
        });
      }
      const manualInput = document.getElementById('setting-groq-manual-model');
      if (manualInput) {
        manualInput.value = API.getManualModelOverride();
        manualInput.addEventListener('change', () => {
          const val = manualInput.value.trim();
          if (typeof safeStorage !== 'undefined') {
            if (val) safeStorage.setItem(CONST.MANUAL_MODEL_KEY, val);
            else safeStorage.removeItem(CONST.MANUAL_MODEL_KEY);
          }
          API.clearModelCache();
        });
      }
      const openBtn = document.getElementById('btn-open-vision-mon-from-settings');
      if (openBtn) openBtn.addEventListener('click', () => { if (typeof closeModal === 'function') closeModal('modal-settings'); openVisionMonitor(); });
    }

    const sideCol = document.getElementById('side-icon-column');
    if (sideCol && !document.getElementById('ai-vision-btn')) {
      const btn = document.createElement('div');
      btn.id = 'ai-vision-btn'; btn.className = 'side-circle-btn';
      btn.title = '👁️ キャラ視点＆1ターン答え合わせ'; btn.innerText = '👁️';
      btn.addEventListener('click', () => openVisionMonitor());
      sideCol.appendChild(btn);
    }

    if (!document.getElementById('modal-ai-vision')) {
      const overlay = document.createElement('div');
      overlay.id = 'modal-ai-vision'; overlay.className = 'modal-overlay'; overlay.style.display = 'none';
      overlay.innerHTML = `
        <div class="modal-content" style="max-height:92vh;gap:7px;">
          <div class="modal-close" id="btn-close-vision-mon-x">✕</div>
          <div class="modal-title" style="font-size:14px;">👁️ キャラ視点・1ターン答え合わせ</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <button type="button" id="btn-tab-before" style="padding:7px 6px;border:none;border-radius:8px;font-size:11px;font-weight:900;cursor:pointer;">⏪ 今すぐ考える前</button>
            <button type="button" id="btn-tab-after"  style="padding:7px 6px;border:none;border-radius:8px;font-size:11px;font-weight:900;cursor:pointer;">⏩ 考えた結果</button>
          </div>
          <div id="mon-meta" style="font-size:10px;font-weight:800;color:#0369a1;background:#f0f9ff;padding:5px 8px;border-radius:8px;border:1px solid #bae6fd;"></div>
          <div id="mon-img-wrap" style="background:#0f172a;padding:6px;border-radius:10px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:5px;">
              <span style="font-size:11px;color:#f8fafc;font-weight:900;">📷 キャラの視点3D</span>
              <div style="display:inline-flex;background:#1e293b;border:1px solid #334155;border-radius:999px;padding:2px;gap:2px;">
                <button type="button" id="btn-dim-clear" style="border:none;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:900;cursor:pointer;">クリア</button>
                <button type="button" id="btn-dim-move"  style="border:none;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:900;cursor:pointer;">移動視点</button>
              </div>
            </div>
            <div style="position:relative;width:100%;overflow:hidden;border-radius:8px;border:1px solid #38bdf8;background:#020617;">
              <img id="mon-img" style="display:block;width:100%;height:auto;" alt="キャラの視点3D">
              <div id="mon-dim-left"  style="position:absolute;top:0;left:0;width:33.333%;height:100%;background:rgba(15,23,42,0.55);pointer-events:none;opacity:0;transition:opacity 0.16s ease;"></div>
              <div id="mon-dim-right" style="position:absolute;top:0;right:0;width:33.333%;height:100%;background:rgba(15,23,42,0.55);pointer-events:none;opacity:0;transition:opacity 0.16s ease;"></div>
            </div>
          </div>
          <div id="mon-prompt-label" style="font-size:11px;font-weight:900;color:#334155;"></div>
          <pre id="mon-prompt" data-allow-inner-scroll="1" style="background:#0f172a;color:#e2e8f0;padding:8px;border-radius:10px;font-size:10px;line-height:1.35;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;height:145px;white-space:pre-wrap;margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"></pre>
          <div id="mon-reply-label" style="font-size:11px;font-weight:900;color:#334155;"></div>
          <div id="mon-reply-summary" style="background:#f0fdf4;border:1.5px solid #86efac;color:#14532d;padding:6px 8px;border-radius:9px;font-size:10.5px;line-height:1.45;min-height:60px;"></div>
          <pre id="mon-raw-json" data-allow-inner-scroll="1" style="background:#f8fafc;color:#1e293b;border:1px solid #cbd5e1;padding:6px 7px;border-radius:8px;font-size:9.5px;line-height:1.3;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;height:56px;white-space:pre-wrap;margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"></pre>
          <div id="mon-phys-result" style="background:#fffbeb;border:1.5px solid #fcd34d;color:#78350f;padding:5px 8px;border-radius:8px;font-size:10.5px;line-height:1.35;"></div>
          <button type="button" id="btn-copy-turn-report" class="btn-primary" style="padding:8px;font-size:11.5px;font-weight:900;background:#0ea5e9;margin-top:2px;">📋 1ターン答え合わせをコピペ（送信文＋AI返答＋結果）</button>
          <button type="button" id="btn-close-vision-mon" class="btn-sub" style="font-size:11.5px;">閉じる</button>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById('btn-close-vision-mon-x').onclick = closeVisionMonitor;
      document.getElementById('btn-close-vision-mon').onclick = closeVisionMonitor;
      document.getElementById('btn-tab-before').onclick = () => renderUnifiedMonitor('before');
      document.getElementById('btn-tab-after').onclick = () => renderUnifiedMonitor('after');
      document.getElementById('btn-dim-clear').onclick = () => applyDimOverlayState(false);
      document.getElementById('btn-dim-move').onclick = () => applyDimOverlayState(true);

      const copyBtn = document.getElementById('btn-copy-turn-report');
      if (copyBtn) {
        copyBtn.onclick = async () => {
          const ok = await copyTextToClipboard(buildTurnCopyText());
          if (ok) {
            const orig = copyBtn.innerText;
            copyBtn.innerText = '✅ コピーしました！そのままチャットへ貼り付けできます';
            copyBtn.style.background = '#16a34a';
            if (typeof showToast === 'function') showToast('📋 1ターン答え合わせをコピーしました');
            setTimeout(() => { copyBtn.innerText = orig; copyBtn.style.background = '#0ea5e9'; }, 1800);
          } else if (typeof showToast === 'function') showToast('⚠️ コピーに失敗しました');
        };
      }
    }
    enablePinchZoomOnAllModals();
  }

  SYS.ui = {
    openVisionMonitor, closeVisionMonitor,
    enablePinchZoomOnAllModals, resetAllModalZooms,
    buildTurnCopyText, setAutoPlay, stopAutoPlay, isAutoPlay: () => autoPlayEnabled
  };

  injectVisionControlsUI();
  setTimeout(enablePinchZoomOnAllModals, 500);
  CORE.setEnabled(ST.commEnabled);
  CORE.setVisionMode(ST.visionMode);
  if (typeof cameraDirty !== 'undefined') cameraDirty = true;

  if (window.DebugGuard) window.DebugGuard.markLoaded('ai_monitor_ui.js');
})();
