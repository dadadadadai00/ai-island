// ============================================================================
// 【独立ビジュアルモジュール：compass_ring.js】
// ・丸い海の外周へ余白を空けて配置する未来風・青ホログラム3Dコンパス
// ・東西南北テキスト内部の交差縁線を型抜き除去（外周のみ白色細線縁取り）
// ・③天体観察時：回転停止＆北の1本がピンク点滅→北一致で点灯＆全体フェードアウト
// ============================================================================
(function initCompassRingModule() {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined') return;

  const STORAGE_KEY = 'island_compass_ring_v1';
  const state = { unlocked: false, visible: false, rotating: true, radiusOffset: 0.9 };
  let externalHide = false;

  // ③天体観察時（北合わせモード）用状態
  const alignState = {
    enabled: false,       // ③天体観察時かつコンパスONのとき true
    isAligned: false,     // 真北の許容範囲内か
    lockFlashTimer: 0,    // 北一致・確定直後の発光点灯タイマー（秒）
    fadeAlpha: 1.0        // 1.0=完全表示 <-> 0.0=ゆっくり消滅
  };

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

  // --- 内部交差縁線を完全に消した「外周のみ白縁＋高透過塗り」テクスチャ生成 ---
  function buildCleanKanjiTexture(char, fillRgba, glowRgba, glowBlur, rimWidth) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 162px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';

    if (rimWidth > 0) {
      // 1. 先に白い外周縁を描く
      ctx.lineJoin = 'round';
      ctx.lineWidth = rimWidth * 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
      ctx.strokeText(char, 128, 134);

      // 2. 文字の塗り領域で内側を透明に型抜きし、画が交差する内部の白線を完全消去
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000000';
      ctx.fillText(char, 128, 134);
      ctx.globalCompositeOperation = 'source-over';
    }

    // 3. くり抜いた内側に高透過の色を流し込む
    if (glowBlur > 0) {
      ctx.shadowColor = glowRgba;
      ctx.shadowBlur = glowBlur;
    }
    ctx.fillStyle = fillRgba;
    ctx.fillText(char, 128, 134);
    ctx.shadowBlur = 0;

    // 4. 控えめなスキャンライン
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let y = 0; y < 256; y += 8) ctx.fillRect(0, y, 256, 2);
    ctx.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    return tex;
  }

  function createBeamGradientTexture() {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 128;
    const ctx = cv.getContext('2d');
    const grad = ctx.createLinearGradient(0, 128, 0, 0);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.88)');
    grad.addColorStop(0.35, 'rgba(186, 230, 253, 0.38)');
    grad.addColorStop(0.78, 'rgba(125, 211, 252, 0.10)');
    grad.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 128);
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    return tex;
  }

  function createBaseGlowTexture() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0.0, 'rgba(224, 242, 254, 0.85)');
    g.addColorStop(0.45, 'rgba(125, 211, 252, 0.38)');
    g.addColorStop(0.82, 'rgba(56, 189, 248, 0.08)');
    g.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    return tex;
  }

  const rootGroup = new THREE.Group();
  rootGroup.name = 'holo_compass_root';
  rootGroup.visible = false;
  scene.add(rootGroup);

  const staticGroup = new THREE.Group();
  const rotatingGroup = new THREE.Group();
  rootGroup.add(staticGroup, rotatingGroup);

  const mats = {
    ringMain:  new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.44, side: THREE.DoubleSide, depthWrite: false }),
    ringSub:   new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false }),
    ticks:     new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.38, depthWrite: false }),
    majorTick: new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.52, side: THREE.DoubleSide, depthWrite: false }),
    northTick: new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.52, side: THREE.DoubleSide, depthWrite: false }),
    node:      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
    baseGlow:  new THREE.MeshBasicMaterial({ map: createBaseGlowTexture(), color: 0x38bdf8, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    beam:      new THREE.MeshBasicMaterial({ map: createBeamGradientTexture(), color: 0x38bdf8, transparent: true, opacity: 0.20, side: THREE.DoubleSide, depthWrite: false }),
    kanji:     []
  };

  let builtRadius = 0;
  let northBarMesh = null;

  function buildCompassGeometry() {
    while (staticGroup.children.length) staticGroup.remove(staticGroup.children[0]);
    while (rotatingGroup.children.length) rotatingGroup.remove(rotatingGroup.children[0]);
    mats.kanji.length = 0;
    northBarMesh = null;

    const { radius: seaR, topY } = detectSeaMetrics();
    const R = seaR + state.radiusOffset;
    builtRadius = R;
    rootGroup.position.set(0, topY + 0.08, 0);

    const outerGuide = new THREE.Mesh(new THREE.RingGeometry(R + 0.12, R + 0.155, 96), mats.ringSub);
    outerGuide.rotation.x = -Math.PI / 2;
    staticGroup.add(outerGuide);

    const baseRing = new THREE.Mesh(new THREE.RingGeometry(R - 0.028, R + 0.028, 96), mats.ringMain);
    baseRing.rotation.x = -Math.PI / 2;
    rotatingGroup.add(baseRing);

    const totalTicks = 48;
    const tickPositions = [];
    const majorBarGeo = new THREE.BoxGeometry(0.068, 0.50, 0.022);

    for (let i = 0; i < totalTicks; i++) {
      const ang = (i / totalTicks) * Math.PI * 2;
      if (i % 12 === 0) {
        const holder = new THREE.Group();
        holder.rotation.y = -ang;
        const isNorth = (i === 0);
        const bar = new THREE.Mesh(majorBarGeo, isNorth ? mats.northTick : mats.majorTick);
        bar.position.set(0, 0.25, -R);
        holder.add(bar);
        rotatingGroup.add(holder);
        if (isNorth) northBarMesh = bar;
      } else {
        const x = Math.sin(ang) * R;
        const z = -Math.cos(ang) * R;
        tickPositions.push(x, 0.006, z, x, 0.24, z);
      }
    }
    const tickGeo = new THREE.BufferGeometry();
    tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tickPositions, 3));
    rotatingGroup.add(new THREE.LineSegments(tickGeo, mats.ticks));

    const cardinals = [
      { label: '北', rotY: 0 },
      { label: '東', rotY: -Math.PI / 2 },
      { label: '南', rotY: Math.PI },
      { label: '西', rotY: Math.PI / 2 }
    ];

    const labelDist = R + 0.88;
    const baseGlowGeo  = new THREE.CircleGeometry(0.78, 32);
    const outerPadGeo  = new THREE.RingGeometry(0.50, 0.58, 36);
    const innerPadGeo  = new THREE.RingGeometry(0.24, 0.29, 32);
    const beamGeo      = new THREE.CylinderGeometry(0.64, 0.44, 1.32, 28, 1, true);
    const plateGeo     = new THREE.PlaneGeometry(1.06, 1.06);

    cardinals.forEach(({ label, rotY }) => {
      const holder = new THREE.Group();
      holder.rotation.y = rotY;

      const padGlow = new THREE.Mesh(baseGlowGeo, mats.baseGlow);
      padGlow.rotation.x = -Math.PI / 2;
      padGlow.position.set(0, 0.005, -labelDist);
      holder.add(padGlow);

      const outerPad = new THREE.Mesh(outerPadGeo, mats.node);
      outerPad.rotation.x = -Math.PI / 2;
      outerPad.position.set(0, 0.012, -labelDist);
      holder.add(outerPad);

      const innerPad = new THREE.Mesh(innerPadGeo, mats.node);
      innerPad.rotation.x = -Math.PI / 2;
      innerPad.position.set(0, 0.014, -labelDist);
      holder.add(innerPad);

      const beam = new THREE.Mesh(beamGeo, mats.beam);
      beam.position.set(0, 0.66, -labelDist);
      holder.add(beam);

      // 一番手前のみ「型抜き済み外周白縁付き」、奥の2層は「白縁なし高透過塗り」で二重線を防止
      const dayFrontTex   = buildCleanKanjiTexture(label, 'rgba(56, 189, 248, 0.26)', 'rgba(14, 165, 233, 0.3)', 4, 2.8);
      const dayBackTex    = buildCleanKanjiTexture(label, 'rgba(56, 189, 248, 0.22)', '', 0, 0);
      const nightFrontTex = buildCleanKanjiTexture(label, 'rgba(186, 230, 253, 0.66)', 'rgba(56, 189, 248, 0.95)', 16, 3.2);
      const nightBackTex  = buildCleanKanjiTexture(label, 'rgba(125, 211, 252, 0.48)', '', 0, 0);

      const layers = [
        { dz: -0.048, dayTex: dayBackTex,  nightTex: nightBackTex,  dayMul: 0.22, nightMul: 0.26, sc: 1.03 },
        { dz:  0.000, dayTex: dayBackTex,  nightTex: nightBackTex,  dayMul: 0.42, nightMul: 0.48, sc: 1.00 },
        { dz:  0.048, dayTex: dayFrontTex, nightTex: nightFrontTex, dayMul: 1.00, nightMul: 1.00, sc: 1.00 }
      ];
      layers.forEach((ly) => {
        const km = new THREE.MeshBasicMaterial({
          map: ly.dayTex, color: 0xffffff, transparent: true, opacity: 0.62 * ly.dayMul,
          side: THREE.DoubleSide, depthWrite: false
        });
        km.userData.dayTex   = ly.dayTex;
        km.userData.nightTex = ly.nightTex;
        km.userData.dayMul   = ly.dayMul;
        km.userData.nightMul = ly.nightMul;
        mats.kanji.push(km);
        const mesh = new THREE.Mesh(plateGeo, km);
        mesh.scale.set(ly.sc, ly.sc, 1);
        mesh.position.set(0, 0.78, -labelDist + ly.dz);
        holder.add(mesh);
      });

      staticGroup.add(holder);
    });

    rootGroup.traverse((obj) => { obj.frustumCulled = false; });
  }

  const PHASE_PALETTE = [
    { main: 0x0284c7, sub: 0x38bdf8, textOp: 0.62, isNight: false, ringOp: 0.42, subOp: 0.24, tickOp: 0.36, majorOp: 0.50, beamOp: 0.18, glowOp: 0.26, add: false },
    { main: 0x0369a1, sub: 0x0284c7, textOp: 0.66, isNight: false, ringOp: 0.46, subOp: 0.28, tickOp: 0.40, majorOp: 0.54, beamOp: 0.16, glowOp: 0.24, add: false },
    { main: 0x0ea5e9, sub: 0x38bdf8, textOp: 0.64, isNight: false, ringOp: 0.44, subOp: 0.26, tickOp: 0.38, majorOp: 0.52, beamOp: 0.22, glowOp: 0.30, add: false },
    { main: 0x38bdf8, sub: 0x7dd3fc, textOp: 0.90, isNight: true,  ringOp: 0.72, subOp: 0.42, tickOp: 0.64, majorOp: 0.80, beamOp: 0.38, glowOp: 0.48, add: true }
  ];

  function getCurrentPhaseIndex() {
    if (window.SkyTimeModule && typeof window.SkyTimeModule.getPhaseIndex === 'function') {
      return window.SkyTimeModule.getPhaseIndex();
    }
    const ts = (typeof TIME_STEP !== 'undefined' && Number.isFinite(Number(TIME_STEP))) ? Math.floor(Number(TIME_STEP)) : 0;
    return ((ts % 4) + 4) % 4;
  }

  let currentPal = PHASE_PALETTE[0];
  let lastPhaseApplied = -1;

  function applyTimePalette(force = false) {
    const pIdx = getCurrentPhaseIndex();
    if (force || pIdx !== lastPhaseApplied) {
      lastPhaseApplied = pIdx;
      currentPal = PHASE_PALETTE[pIdx] || PHASE_PALETTE[0];
    }
    const pal = currentPal;
    const a = alignState.enabled ? alignState.fadeAlpha : 1.0;
    const blend = pal.add ? THREE.AdditiveBlending : THREE.NormalBlending;

    mats.ringMain.color.setHex(pal.main);  mats.ringMain.opacity  = pal.ringOp * a;  mats.ringMain.blending  = blend;
    mats.ringSub.color.setHex(pal.sub);    mats.ringSub.opacity   = pal.subOp * a;   mats.ringSub.blending   = blend;
    mats.ticks.color.setHex(pal.main);     mats.ticks.opacity     = pal.tickOp * a;  mats.ticks.blending     = blend;
    mats.majorTick.color.setHex(pal.sub);  mats.majorTick.opacity = pal.majorOp * a; mats.majorTick.blending = blend;
    mats.node.color.setHex(pal.sub);       mats.node.opacity      = pal.textOp * 0.68 * a; mats.node.blending = blend;
    mats.baseGlow.color.setHex(pal.sub);   mats.baseGlow.opacity  = pal.glowOp * a;  mats.baseGlow.blending  = THREE.AdditiveBlending;
    mats.beam.color.setHex(pal.sub);       mats.beam.opacity      = pal.beamOp * a;  mats.beam.blending      = THREE.AdditiveBlending;

    if (!alignState.enabled) {
      mats.northTick.color.setHex(pal.sub);
      mats.northTick.opacity = pal.majorOp * a;
      mats.northTick.blending = blend;
      if (northBarMesh) northBarMesh.scale.set(1, 1, 1);
    }

    mats.kanji.forEach((km) => {
      const nextTex = pal.isNight ? km.userData.nightTex : km.userData.dayTex;
      if (km.map !== nextTex) {
        km.map = nextTex;
        km.needsUpdate = true;
      }
      km.color.setHex(0xffffff);
      const mul = pal.isNight ? (km.userData.nightMul || 1) : (km.userData.dayMul || 1);
      km.opacity = pal.textOp * mul * a;
      km.blending = blend;
    });
  }

  function applyVisibility() {
    const baseOn = Boolean(state.unlocked && state.visible && !externalHide);
    const alphaOk = !alignState.enabled || alignState.fadeAlpha > 0.01;
    rootGroup.visible = Boolean(baseOn && alphaOk);
    if (rootGroup.visible) applyTimePalette(true);
    syncSettingsPanelUI();
  }

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
    panel.innerHTML = '<div style="font-size:11.5px;font-weight:900;color:#0369a1;">🧪 観察環境・機能設定</div>';
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
        <div style="font-size:11px;font-weight:800;color:#0f172a;">🧭 未来風ホログラムコンパス<div style="font-size:9.5px;font-weight:600;color:#64748b;">直立東西南北固定＋③観察時は北合わせ</div></div>
        <button type="button" id="btn-toggle-holo-compass" style="padding:5px 10px;border-radius:8px;border:none;font-size:11px;font-weight:900;cursor:pointer;"></button>
      `;
      panel.appendChild(row);
      const btn = document.getElementById('btn-toggle-holo-compass');
      if (btn) {
        btn.onclick = () => {
          const next = !(state.unlocked && state.visible);
          state.unlocked = next;
          state.visible = next;
          if (next) alignState.fadeAlpha = 1.0;
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

  // --- 毎フレームアニメーション（通常回転 vs ③天体観察時の北ピンク点滅→点灯消滅） ---
  let lastTs = performance.now();
  function tick(now) {
    const dt = Math.min(0.1, Math.max(0, (now - lastTs) / 1000));
    lastTs = now;
    const baseOn = Boolean(state.unlocked && state.visible && !externalHide);

    if (baseOn) {
      if (alignState.enabled) {
        // ③天体観察時：目盛りリングの回転停止＆東西南北位置へピタリと揃える
        rotatingGroup.rotation.y *= Math.max(0, 1 - dt * 10);

        if (alignState.isAligned) {
          // 北を向いた状態：まずピンク1本が強く発光点灯し、その後コンパス全体がゆっくり消える
          if (alignState.lockFlashTimer > 0) {
            alignState.lockFlashTimer = Math.max(0, alignState.lockFlashTimer - dt);
            alignState.fadeAlpha = Math.min(1.0, alignState.fadeAlpha + dt * 4.0);
          } else {
            alignState.fadeAlpha = Math.max(0.0, alignState.fadeAlpha - dt * 0.95);
          }
        } else {
          // スマホの向きが変わって北から外れた：コンパスがゆっくり再表示され位置合わせへ戻る
          alignState.lockFlashTimer = 0;
          alignState.fadeAlpha = Math.min(1.0, alignState.fadeAlpha + dt * 1.35);
        }

        const alphaOk = alignState.fadeAlpha > 0.01;
        rootGroup.visible = alphaOk;

        if (alphaOk) {
          applyTimePalette(false);
          const a = alignState.fadeAlpha;
          mats.northTick.blending = THREE.AdditiveBlending;

          if (alignState.isAligned) {
            // 北一致時：強い発光点灯
            mats.northTick.color.setHex(0xff85c0);
            mats.northTick.opacity = 1.0 * a;
            if (northBarMesh) northBarMesh.scale.set(1.35, 1.18, 1.35);
          } else {
            // 北ズレ時：ピンク色に変色して発光点滅
            const pulse = 0.5 + 0.5 * Math.sin(now * 0.0075);
            mats.northTick.color.setHex(pulse > 0.45 ? 0xff4da6 : 0xf472b6);
            mats.northTick.opacity = (0.32 + 0.68 * pulse) * a;
            if (northBarMesh) {
              const sc = 1.15 + 0.22 * pulse;
              northBarMesh.scale.set(sc, 1.06 + 0.10 * pulse, sc);
            }
          }
        }
      } else {
        // ①観察アプリ・②天体観察前：通常通りゆっくり時計回り回転
        alignState.fadeAlpha = 1.0;
        rootGroup.visible = true;
        if (state.rotating) {
          rotatingGroup.rotation.y -= 0.055 * dt;
        }
        applyTimePalette(false);
      }
    } else {
      rootGroup.visible = false;
    }

    requestAnimationFrame(tick);
  }

  buildCompassGeometry();
  applyVisibility();
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
    unlock: () => { state.unlocked = true; state.visible = true; alignState.fadeAlpha = 1.0; saveState(); applyVisibility(); },
    setVisible: (v) => { state.visible = Boolean(v); if (v) { state.unlocked = true; alignState.fadeAlpha = 1.0; } saveState(); applyVisibility(); },
    toggleVisible: () => {
      const next = !(state.unlocked && state.visible);
      state.unlocked = next;
      state.visible = next;
      if (next) alignState.fadeAlpha = 1.0;
      saveState();
      applyVisibility();
      return next;
    },
    isUserEnabled: () => Boolean(state.unlocked && state.visible),
    setExternalHide: (hide) => { externalHide = Boolean(hide); applyVisibility(); },
    isVisible: () => Boolean(state.unlocked && state.visible && !externalHide && (!alignState.enabled || alignState.fadeAlpha > 0.01)),
    setObsAlignmentMode: (enabled) => {
      const next = Boolean(enabled);
      if (alignState.enabled !== next) {
        alignState.enabled = next;
        alignState.isAligned = false;
        alignState.lockFlashTimer = 0;
        alignState.fadeAlpha = 1.0;
        applyVisibility();
      }
    },
    updateNorthAlignment: (isAligned) => {
      const next = Boolean(isAligned);
      if (next && !alignState.isAligned) {
        // 北へ入った瞬間に発光点灯タイマーをセット
        alignState.lockFlashTimer = 0.85;
      }
      alignState.isAligned = next;
    },
    triggerNorthLocked: () => {
      alignState.isAligned = true;
      alignState.lockFlashTimer = 0.95;
      alignState.fadeAlpha = 1.0;
      applyVisibility();
    },
    setRadiusOffset: (off) => { if (Number.isFinite(off)) { state.radiusOffset = off; saveState(); buildCompassGeometry(); applyTimePalette(true); } },
    refresh: () => { buildCompassGeometry(); applyTimePalette(true); }
  };

  if (window.DebugGuard) window.DebugGuard.markLoaded('compass_ring.js');
})();
