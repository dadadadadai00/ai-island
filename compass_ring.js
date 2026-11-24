// ============================================================================
// 【独立ビジュアルモジュール：compass_ring.js】
// ・丸い海の外周へ余白を空けて配置する未来風・青ホログラム3Dコンパス
// ・東西南北（中心向き直立3層立体＋大型発光土台＆投影光）固定
// ・直立シンプル目盛りリング（4ヶ所のみ長く太い）がゆっくり時計回り
// ・二重描画廃止＆カリング防止でキャラ視点上下移動時のちらつき解消
// ============================================================================
(function initCompassRingModule() {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined') return;

  const STORAGE_KEY = 'island_compass_ring_v1';
  const state = { unlocked: false, visible: false, rotating: true, radiusOffset: 0.9 };
  let externalHide = false;

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

  function createKanjiHoloTexture(char) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 162px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';

    ctx.shadowColor = 'rgba(125, 211, 252, 0.92)';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.88)';
    ctx.strokeText(char, 128, 134);

    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(char, 128, 134);

    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
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
    ringMain:  new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false }),
    ringSub:   new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    ticks:     new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.42, depthWrite: false }),
    majorTick: new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.56, side: THREE.DoubleSide, depthWrite: false }),
    node:      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.52, side: THREE.DoubleSide, depthWrite: false }),
    baseGlow:  new THREE.MeshBasicMaterial({ map: createBaseGlowTexture(), color: 0x38bdf8, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
    beam:      new THREE.MeshBasicMaterial({ map: createBeamGradientTexture(), color: 0x38bdf8, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false }),
    kanji:     []
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
        const bar = new THREE.Mesh(majorBarGeo, mats.majorTick);
        bar.position.set(0, 0.25, -R);
        holder.add(bar);
        rotatingGroup.add(holder);
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

      const tex = createKanjiHoloTexture(label);
      const layers = [
        { dz: -0.048, opMul: 0.26, sc: 1.03 },
        { dz:  0.000, opMul: 0.52, sc: 1.00 },
        { dz:  0.048, opMul: 0.92, sc: 1.00 }
      ];
      layers.forEach((ly) => {
        const km = new THREE.MeshBasicMaterial({
          map: tex, color: 0x38bdf8, transparent: true, opacity: 0.62 * ly.opMul,
          side: THREE.DoubleSide, depthWrite: false
        });
        km.userData.opMul = ly.opMul;
        mats.kanji.push(km);
        const mesh = new THREE.Mesh(plateGeo, km);
        mesh.scale.set(ly.sc, ly.sc, 1);
        mesh.position.set(0, 0.78, -labelDist + ly.dz);
        holder.add(mesh);
      });

      staticGroup.add(holder);
    });

    // 視線上下移動時に一瞬消えるカリングちらつきを防止
    rootGroup.traverse((obj) => { obj.frustumCulled = false; });
  }

  const PHASE_PALETTE = [
    { main: 0x0284c7, sub: 0x38bdf8, text: 0x0284c7, beam: 0x38bdf8, ringOp: 0.46, subOp: 0.28, tickOp: 0.40, majorOp: 0.54, textOp: 0.62, beamOp: 0.22, glowOp: 0.30, add: false },
    { main: 0x0369a1, sub: 0x0284c7, text: 0x0369a1, beam: 0x0ea5e9, ringOp: 0.52, subOp: 0.32, tickOp: 0.46, majorOp: 0.60, textOp: 0.68, beamOp: 0.20, glowOp: 0.28, add: false },
    { main: 0x0ea5e9, sub: 0x38bdf8, text: 0x38bdf8, beam: 0x38bdf8, ringOp: 0.48, subOp: 0.30, tickOp: 0.42, majorOp: 0.56, textOp: 0.64, beamOp: 0.26, glowOp: 0.34, add: false },
    { main: 0x38bdf8, sub: 0x7dd3fc, text: 0x7dd3fc, beam: 0x7dd3fc, ringOp: 0.72, subOp: 0.42, tickOp: 0.64, majorOp: 0.80, textOp: 0.88, beamOp: 0.38, glowOp: 0.48, add: true }
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

    mats.ringMain.color.setHex(pal.main);  mats.ringMain.opacity  = pal.ringOp;  mats.ringMain.blending  = blend;
    mats.ringSub.color.setHex(pal.sub);    mats.ringSub.opacity   = pal.subOp;   mats.ringSub.blending   = blend;
    mats.ticks.color.setHex(pal.main);     mats.ticks.opacity     = pal.tickOp;  mats.ticks.blending     = blend;
    mats.majorTick.color.setHex(pal.text); mats.majorTick.opacity = pal.majorOp; mats.majorTick.blending = blend;
    mats.node.color.setHex(pal.text);      mats.node.opacity      = pal.textOp * 0.78; mats.node.blending = blend;
    mats.baseGlow.color.setHex(pal.beam);  mats.baseGlow.opacity  = pal.glowOp;  mats.baseGlow.blending  = THREE.AdditiveBlending;
    mats.beam.color.setHex(pal.beam);      mats.beam.opacity      = pal.beamOp;  mats.beam.blending      = THREE.AdditiveBlending;

    mats.kanji.forEach((km) => {
      km.color.setHex(pal.text);
      km.opacity = pal.textOp * (km.userData.opMul || 1);
      km.blending = blend;
    });
  }

  function applyVisibility() {
    rootGroup.visible = Boolean(state.unlocked && state.visible && !externalHide);
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
        <div style="font-size:11px;font-weight:800;color:#0f172a;">🧭 未来風ホログラムコンパス<div style="font-size:9.5px;font-weight:600;color:#64748b;">直立東西南北固定＋直立目盛り時計回り</div></div>
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

  // --- 時計回りアニメーション（元アプリの描画ループに一本化してちらつき防止） ---
  let lastTs = performance.now();
  function tick(now) {
    const dt = Math.min(0.1, Math.max(0, (now - lastTs) / 1000));
    lastTs = now;

    if (rootGroup.visible) {
      if (state.rotating) {
        rotatingGroup.rotation.y -= 0.055 * dt;
      }
      applyTimePalette(false);
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
    unlock: () => { state.unlocked = true; state.visible = true; saveState(); applyVisibility(); },
    setVisible: (v) => { state.visible = Boolean(v); if (v) state.unlocked = true; saveState(); applyVisibility(); },
    setExternalHide: (hide) => { externalHide = Boolean(hide); applyVisibility(); },
    isVisible: () => Boolean(state.unlocked && state.visible && !externalHide),
    setRadiusOffset: (off) => { if (Number.isFinite(off)) { state.radiusOffset = off; saveState(); buildCompassGeometry(); applyTimePalette(true); } },
    refresh: () => { buildCompassGeometry(); applyTimePalette(true); }
  };

  if (window.DebugGuard) window.DebugGuard.markLoaded('compass_ring.js');
})();
