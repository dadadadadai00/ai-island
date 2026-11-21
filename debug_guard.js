// ============================================================================
// 【スマホ用エラー監視＆モジュール読込チェッカー：debug_guard.js】
// ・構文エラー／実行時エラー／コピペ途中切れ（未読込ファイル）を画面上部に赤表示
// ・正常時は完全非表示（画面の邪魔をしない）
// ============================================================================
(function initDebugGuard() {
  if (window.DebugGuard) return;

  const expected = [];
  const loaded = new Set();
  const errors = [];
  let bannerEl = null;

  function ensureBanner() {
    if (bannerEl) return bannerEl;
    bannerEl = document.createElement('div');
    bannerEl.id = 'debug-guard-banner';
    bannerEl.style.cssText = [
      'position:fixed', 'top:6px', 'left:50%', 'transform:translateX(-50%)',
      'width:95%', 'max-width:430px', 'z-index:99999',
      'background:rgba(127,29,29,0.96)', 'color:#fef2f2',
      'border:2px solid #f87171', 'border-radius:12px',
      'padding:8px 10px', 'font-size:11px', 'line-height:1.4',
      'box-shadow:0 8px 24px rgba(0,0,0,0.45)', 'display:none',
      'max-height:42vh', 'overflow-y:auto', 'user-select:text', '-webkit-user-select:text'
    ].join(';');
    document.body.appendChild(bannerEl);
    return bannerEl;
  }

  function renderBanner() {
    const missing = expected.filter(f => !loaded.has(f));
    if (!errors.length && !missing.length) {
      if (bannerEl) bannerEl.style.display = 'none';
      return;
    }
    const el = ensureBanner();
    const lines = [];
    if (missing.length) {
      lines.push(`⚠️ 未読込（途中切れ・構文エラーの可能性）:\n  ${missing.join(', ')}`);
    }
    errors.forEach((e, i) => lines.push(`[${i + 1}] ${e}`));
    const rawText = lines.join('\n');

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-weight:900;">
        <span>🚨 モジュール異常を検知 (${loaded.size}/${expected.length}読込済)</span>
        <div style="display:flex;gap:4px;">
          <button type="button" id="dbg-copy-btn" style="background:#ef4444;color:#fff;border:1px solid #fecaca;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:900;cursor:pointer;">📋コピー</button>
          <button type="button" id="dbg-close-btn" style="background:#450a0a;color:#fecaca;border:1px solid #f87171;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:900;cursor:pointer;">✕</button>
        </div>
      </div>
      <pre style="margin:0;white-space:pre-wrap;word-break:break-all;font-size:10px;font-family:monospace;">${rawText.replace(/</g, '&lt;')}</pre>
    `;
    el.style.display = 'block';

    const copyBtn = document.getElementById('dbg-copy-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        if (navigator.clipboard) navigator.clipboard.writeText(rawText).catch(() => {});
        copyBtn.innerText = '✅コピー済';
      };
    }
    const closeBtn = document.getElementById('dbg-close-btn');
    if (closeBtn) closeBtn.onclick = () => { el.style.display = 'none'; };
  }

  function pushError(msg) {
    if (errors.length < 10) errors.push(String(msg));
    if (document.body) renderBanner();
  }

  window.addEventListener('error', (ev) => {
    const file = ev.filename ? ev.filename.split('/').pop() : 'unknown';
    const loc = ev.lineno ? `${file}:${ev.lineno}:${ev.colno || 0}` : file;
    pushError(`${loc} -> ${ev.message || 'Error'}`);
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason;
    pushError(`Promise -> ${r && r.message ? r.message : String(r)}`);
  });

  window.addEventListener('load', () => {
    setTimeout(renderBanner, 250);
  });

  window.DebugGuard = {
    expect: (list) => {
      (list || []).forEach(name => { if (!expected.includes(name)) expected.push(name); });
    },
    markLoaded: (name) => {
      if (name) loaded.add(name);
    },
    getStatus: () => ({ expected: expected.slice(), loaded: Array.from(loaded), errors: errors.slice() }),
    renderBanner
  };
})();
