// ============================================================================
// 【独立ビジュアルモジュール：compass_ring.js】
// ・丸い海の外周へ余白を空けて配置する未来風・青ホログラム3Dコンパス
// ・東西南北（さりげなく立体＋下からの青ライトアップ）固定／目盛りリング時計回り
// ・基本非表示（ストーリー解放 or 設定画面のテストスイッチでON/OFF）
// ============================================================================
(function initCompassRingModule() {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined') return;

  const STORAGE_KEY = 'island_compass_ring_v1';
  const state = { unlocked: false, visible: false, rotating: true, radiusOffset: 0.9 };

  function loadState() {
    try {
      const store = (typeof safeStorage !== 'undefined') ? safeStorage : window.localStorage;
      const raw = store && store.getItem(STORAGE_KEY);
      if (raw) Object.assign(state, JSON.parse(raw));
    } catch (e) {}
  }
  function saveState() {
    try {
      const store = (typeof safeStorage !== 'undefined') ? safeStorage : window.localStorage;
      if (store) store.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }
  loadState();

  // --- 丸い海の半径・高さを自動検出（未検出時は標準値5.0） ---
  function detectSeaMetrics() {
    let radius = 5.0, topY = -0.12;
    const candidates = [];
    if (typeof seaMesh !== 'undefined' && seaMesh) candidates.push(seaMesh);
    scene.traverse((obj) => {
      if (!obj || !obj.isMesh || !obj.geometry || obj.name.startsWith('holo_')) return;
      if (obj === candidates[0]) return;
      const gType = obj.geometry.type || '';
      if (gType.includes('Cylinder') || gType.includes('Circle')) candidates.push(obj);
    });
    for (let i = 0; i < candidates.length; i++) {
      const m = candidates[i];
      try {
        m.updateWorldMatrix(true, false);
        const box = new THREE.Box3().setFromObject(m);
        const size = new THREE.Vector3();
        box.getSize(size);
        const r = Math.max(size.x, size.z) * 0.5;
        if (r >= 3.2 && r <= 18 && Math.abs(size.x - size.z) < 1.2 && size.y <= 3.5) {
          radius = r;
          topY = Number.isFinite(box.max.y) ? box.max.y : topY;
          break;
        }
      } catch (e) {}
    }
    return { radius, topY };
  }

  // --- キャンバス描画：スキャンライン入りホログラム漢字テクスチャ ---
  function createKanjiHoloTexture(char) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 156px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';

    // うっすら青い発光輪郭
    ctx.shadowColor = 'rgba(125, 211, 252, 0.9)';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
    ctx.strokeText(char, 128, 134);

    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(char, 128, 134);

    // 未来風・極細スキャンライン
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    for (let y = 0; y < 256; y += 8) ctx.fillRect(0, y, 256, 2);
    ctx.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    return tex;
  }

  // --- 下から上へフェードする投影ライトアップ用テクスチャ ---
  function createBeamGradientTexture() {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 128;
    const ctx = cv.getContext('2d');
    const grad = ctx.createLinearGradient(0, 128, 0, 0);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.45, 'rgba(186, 230, 253, 0.32)');
    grad.addColorStop(1.0, 'rgba(125, 211, 252, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 128);
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    return tex;
  }

  // --- 3Dコンパス本体構築 ---
  const rootGroup = new THREE.Group();
  rootGroup.name = 'holo_compass_root';
  rootGroup.visible = false;
  scene.add(rootGroup);

  const staticGroup = new THREE.Group();
  const rotatingGroup = new THREE.Group();
  rootGroup.add(staticGroup, rotatingGroup);

  const mats = {
    ringMain: new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
    ringSub:  new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }),
    ticks:    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65, depthWrite: false }),
    node:     new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
    beam:     new THREE.MeshBasicMaterial({ map: createBeamGradientTexture(), color: 0x38bdf8, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    kanji:    []
  };

  let builtRadius = 0;

  function buildCompassGeometry() {
    while (staticGroup.children.length) staticGroup.remove(staticGroup.children[0]);
    while (rotatingGroup.children.length) rotatingGroup.remove(rotatingGroup.children[0]);
    mats.kanji.length = 0;

    const { radius: seaR, topY } = detectSeaMetrics();
    const R = seaR + state.radiusOffset;
    builtRadius = R;
    rootGroup.position.set(0, topY + 0.08, 0);

    // 1. 固定リング（外周の極細ガイド輪）
    const outerRing = new THREE.Mesh(new THREE.RingGeometry(R + 0.14, R + 0.185, 96), mats.ringSub);
    outerRing.rotation.x = -Math.PI / 2;
    staticGroup.add(outerRing);

    // 2. 回転層（ゆっくり時計回りする主リング＋72目盛り＋破線アクセント）
    const mainRing = new THREE.Mesh(new THREE.RingGeometry(R - 0.035, R + 0.035, 96), mats.ringMain);
    mainRing.rotation.x = -Math.PI / 2;
    rotatingGroup.add(mainRing);

    const tickPositions = [];
    for (let i = 0; i < 72; i++) {
      const ang = (i / 72) * Math.PI * 2;
      const isMajor = (i % 9 === 0);
      const isMid = (i % 3 === 0);
      const rIn = R - (isMajor ? 0.26 : (isMid ? 0.16 : 0.09));
      const rOut = R + (isMajor ? 0.10 : 0.05);
      tickPositions.push(
        Math.sin(ang) * rIn, 0.005, -Math.cos(ang) * rIn,
        Math.sin(ang) * rOut, 0.005, -Math.cos(ang) * rOut
      );
    }
    const tickGeo = new THREE.BufferGeometry();
    tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tickPositions, 3));
    rotatingGroup.add(new THREE.LineSegments(tickGeo, mats.ticks));

    // 破線セグメント（内周）
    const dashPositions = [];
    const segs = 48;
    for (let i = 0; i < segs; i += 2) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 0.72) / segs) * Math.PI * 2;
      const rDash = R - 0.14;
      dashPositions.push(
        Math.sin(a0) * rDash, 0.004, -Math.cos(a0) * rDash,
        Math.sin(a1) * rDash, 0.004, -Math.cos(a1) * rDash
      );
    }
    const dashGeo = new THREE.BufferGeometry();
    dashGeo.setAttribute('position', new THREE.Float32BufferAttribute(dashPositions, 3));
    rotatingGroup.add(new THREE.LineSegments(dashGeo, mats.ticks));

    // 3. 東西南北固定（北=Z-, 東=X+, 南=Z+, 西=X-）
    const cardinals = [
      { label: '北', rotY: 0 },
      { label: '東', rotY: -Math.PI / 2 },
      { label: '南', rotY: Math.PI },
      { label: '西', rotY: Math.PI / 2 }
    ];

    const labelDist = R + 0.78;
    const beamGeo = new THREE.CylinderGeometry(0.46, 0.10, 0.42, 20, 1, true);
    const nodeGeo = new THREE.RingGeometry(0.05, 0.13, 24);
    const dotGeo  = new THREE.CircleGeometry(0.045, 16);
    const plateGeo = new THREE.PlaneGeometry(0.95, 0.95);

    cardinals.forEach(({ label, rotY }) => {
      const holder = new THREE.Group();
      holder.rotation.y = rotY;

      // 足元からの淡いライトアップ基点ノード
      const nodeRing = new THREE.Mesh(nodeGeo, mats.node);
      nodeRing.rotation.x = -Math.PI / 2;
      nodeRing.position.set(0, 0.008, -labelDist);
      holder.add(nodeRing);

      const nodeDot = new THREE.Mesh(dotGeo, mats.node);
      nodeDot.rotation.x = -Math.PI / 2;
      nodeDot.position.set(0, 0.01, -labelDist);
      holder.add(nodeDot);

      // 足元から文字をうっすら照らす青い光柱
      const beam = new THREE.Mesh(beamGeo, mats.beam);
      beam.position.set(0, 0.21, -labelDist);
      holder.add(beam);

      // さりげなく立体的な3層ホログラム漢字（地面と平行）
      const tex = createKanjiHoloTexture(label);
      const layers = [
        { dy: 0.08, opMul: 0.30, sc: 1.03 },
        { dy: 0.14, opMul: 0.55, sc: 1.00 },
        { dy: 0.20, opMul: 1.00, sc: 1.00 }
      ];
      layers.forEach((ly) => {
        const km = new THREE.MeshBasicMaterial({
          map: tex, color: 0x38bdf8, transparent: true, opacity: 0.85 * ly.opMul,
          side: THREE.DoubleSide, depthWrite: false
        });
        km.userData.opMul = ly.opMul;
        mats.kanji.push(km);
        const mesh = new THREE.Mesh(plateGeo, km);
        mesh.rotation.x = -Math.PI / 2;
        mesh.scale.set(ly.sc, ly.sc, 1);
        mesh.position.set(0, ly.dy, -labelDist);
        holder.add(mesh);
      });

      staticGroup.add(holder);
    });
  }

  // --- 時間帯に応じた青系ホログラム自動調光 ---
  const PHASE_PALETTE = [
    // 0:朝（澄んだクリアブルー）
    { main: 0x0284c7, sub: 0x0ea5e9, text: 0x0284c7, beam: 0x38bdf8, ringOp: 0.72, subOp: 0.44, textOp: 0.86, beamOp: 0.22, add: false },
    // 1:昼（明るい空に溶けない深め透明ブルー）
    { main: 0x0369a1, sub: 0x0284c7, text: 0x0369a1, beam: 0x0ea5e9, ringOp: 0.84, subOp: 0.52, textOp: 0.92, beamOp: 0.18, add: false },
    // 2:夕（映える鮮やかなシアンブルー）
    { main: 0x0ea5e9, sub: 0x38bdf8, text: 0x38bdf8, beam: 0x38bdf8, ringOp: 0.78, subOp: 0.48, textOp: 0.90, beamOp: 0.30, add: false },
    // 3:夜（透き通る発光アイスブルー）
    { main: 0x38bdf8, sub: 0x7dd3fc, text: 0x7dd3fc, beam: 0x7dd3fc, ringOp: 0.82, subOp: 0.50, textOp: 0.95, beamOp: 0.38, add: true }
  ];

  function getCurrentPhaseIndex() {
    if (window.SkyTimeModule && typeof window.SkyTimeModule.getPhaseIndex === 'function') {
      return window.SkyTimeModule.getPhaseIndex();
    }
    const ts = (typeof TIME_STEP !== 'undefined' && Number.isFinite(Number(TIME_STEP))) ? Math.floor(Number(TIME_STEP)) : 0;
    return ((ts % 4) + 4) % 4;
  }

  let lastPhaseApplied = -1;
  function applyTimePalette(force = false) {
    const pIdx = getCurrentPhaseIndex();
    if (!force && pIdx === lastPhaseApplied) return;
    lastPhaseApplied = pIdx;
    const pal = PHASE_PALETTE[pIdx] || PHASE_PALETTE[0];
    const blend = pal.add ? THREE.AdditiveBlending : THREE.NormalBlending;

    mats.ringMain.color.setHex(pal.main); mats.ringMain.opacity = pal.ringOp; mats.ringMain.blending = blend;
    mats.ringSub.color.setHex(pal.sub);   mats.ringSub.opacity  = pal.subOp;  mats.ringSub.blending  = blend;
    mats.ticks.color.setHex(pal.main);    mats.ticks.opacity    = pal.ringOp * 0.88; mats.ticks.blending = blend;
    mats.node.color.setHex(pal.text);     mats.node.opacity     = pal.textOp * 0.85; mats.node.blending  = blend;
    mats.beam.color.setHex(pal.beam);     mats.beam.opacity     = pal.beamOp; mats.beam.blending = THREE.AdditiveBlending;

    mats.kanji.forEach((km) => {
      km.color.setHex(pal.text);
      km.opacity = pal.textOp * (km.userData.opMul || 1);
      km.blending = blend;
    });
  }

  function applyVisibility() {
    rootGroup.visible = Boolean(state.unlocked && state.visible);
    if (rootGroup.visible) applyTimePalette(true);
    syncSettingsPanelUI();
  }

  // --- 設定画面へテスト＆解放スイッチを自動注入（sky_time.jsと共通枠） ---
  function ensureEnvSettingsPanel() {
    let panel = document.getElementById('env-hologram-settings-panel');
    if (panel) return panel;

    const modals = Array.from(document.querySelectorAll('.modal-overlay'));
    let targetContent = null;
    for (let i = 0; i < modals.length; i++) {
      const idLow = (modals[i].id || '').toLowerCase();
      const titleEl = modals[i].querySelector('.modal-title');
      const titleTxt = titleEl ? titleEl.innerText : '';
      if (idLow.includes('setting') || idLow.includes('config') || titleTxt.includes('設定')) {
        targetContent = modals[i].querySelector('.modal-content');
        break;
      }
    }
    if (!targetContent) return null;

    panel = document.createElement('div');
    panel.id = 'env-hologram-settings-panel';
    panel.style.cssText = 'margin-top:8px;padding:10px;border-radius:12px;background:#f0f9ff;border:1.5px solid #7dd3fc;display:flex;flex-direction:column;gap:8px;text-align:left;';
    panel.innerHTML = '<div style="font-size:11.5px;font-weight:900;color:#0369a1;">🧪 観察環境・機能解放（基本非表示／ストーリー解放予定）</div>';
    targetContent.appendChild(panel);
    return panel;
  }

  function syncSettingsPanelUI() {
    const panel = ensureEnvSettingsPanel();
    if (!panel) return;
    let row = document.getElementById('env-compass-row');
    if (!row) {
      row = document.createElement('div');
      row.id = 'env-compass-row';
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;background:#ffffff;border:1px solid #bae6fd;border-radius:9px;padding:7px 9px;';
      row.innerHTML = `
        <div style="font-size:11px;font-weight:800;color:#0f172a;">🧭 未来風ホログラムコンパス<div style="font-size:9.5px;font-weight:600;color:#64748b;">東西南北固定＋目盛り時計回り</div></div>
        <button type="button" id="btn-toggle-holo-compass" style="padding:5px 10px;border-radius:8px;border:none;font-size:11px;font-weight:900;cursor:pointer;"></button>
      `;
      panel.appendChild(row);
      const btn = document.getElementById('btn-toggle-holo-compass');
      if (btn) {
        btn.onclick = () => {
          const next = !(state.unlocked && state.visible);
          state.unlocked = next;
          state.visible = next;
          saveState();
          applyVisibility();
          if (typeof showToast === 'function') showToast(next ? '🧭 ホログラムコンパスを表示しました' : '🧭 ホログラムコンパスを非表示にしました');
        };
      }
    }
    const btn = document.getElementById('btn-toggle-holo-compass');
    if (btn) {
      const on = Boolean(state.unlocked && state.visible);
      btn.innerText = on ? '表示中 (ON)' : '非表示 (OFF)';
      btn.style.background = on ? '#0284c7' : '#e2e8f0';
      btn.style.color = on ? '#ffffff' : '#475569';
    }
  }

  // --- 時計回りアニメーション＆自動再描画（メインループと競合しない安全設計） ---
  let lastTs = performance.now();
  let lastRenderFrame = -1;
  function tick(now) {
    const dt = Math.min(0.1, Math.max(0, (now - lastTs) / 1000));
    lastTs = now;

    if (rootGroup.visible) {
      if (state.rotating) {
        // 上から見て時計回り（Three.js +Y軸基準ではマイナス回転）
        rotatingGroup.rotation.y -= 0.055 * dt;
      }
      applyTimePalette(false);

      if (typeof renderer !== 'undefined' && renderer && renderer.info && typeof activeCamera !== 'undefined' && activeCamera) {
        const curFrame = renderer.info.render.frame;
        if (curFrame === lastRenderFrame) renderer.render(scene, activeCamera);
        lastRenderFrame = renderer.info.render.frame;
      }
    }
    requestAnimationFrame(tick);
  }

  buildCompassGeometry();
  applyVisibility();
  // 海メッシュが非同期構築される場合に備えて1秒後に半径を再確認
  setTimeout(() => {
    const m = detectSeaMetrics();
    if (Math.abs((m.radius + state.radiusOffset) - builtRadius) > 0.2) {
      buildCompassGeometry();
      applyTimePalette(true);
    }
    syncSettingsPanelUI();
  }, 1000);
  requestAnimationFrame(tick);

  window.CompassRingModule = {
    unlock: () => { state.unlocked = true; state.visible = true; saveState(); applyVisibility(); },
    setVisible: (v) => { state.visible = Boolean(v); if (v) state.unlocked = true; saveState(); applyVisibility(); },
    isVisible: () => Boolean(state.unlocked && state.visible),
    setRadiusOffset: (off) => { if (Number.isFinite(off)) { state.radiusOffset = off; saveState(); buildCompassGeometry(); applyTimePalette(true); } },
    refresh: () => { buildCompassGeometry(); applyTimePalette(true); }
  };

  if (window.DebugGuard) window.DebugGuard.markLoaded('compass_ring.js');
})();
