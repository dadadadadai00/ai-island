// ============================================================================
// 【独立ビジュアルモジュール：sky_time.js】
// ・未来の博物館風デジタル天体儀（青白い太陽軌道・日の出/入りデジタル光・夜星座線）
// ・日の出基準の朝昼夕夜ルール＋GPS任意同期（標準は日本座標）＋現実時刻全振りモード
// ・基本非表示（ストーリー解放 or 設定画面のテストスイッチで個別にON/OFF）
// ============================================================================
(function initSkyTimeModule() {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined') return;

  const STORAGE_KEY = 'island_sky_time_v1';
  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;
  const SKY_R = 16.5;

  const state = {
    skyUnlocked: false,
    skyVisible: false,
    realtimeUnlocked: false,
    realtimeActive: false,
    lat: 35.68,
    lon: 139.77,
    gpsApplied: false
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

  // --- 実天球座標データ（主要12星座：赤経[時], 赤緯[度], 明るさ） ---
  const CONSTELLATIONS = [
    { name: 'こぐま座', stars: [[2.53,89.26,2.0],[14.85,74.16,2.1],[15.35,71.83,3.0],[16.77,82.04,4.2],[17.54,86.59,4.3]], lines: [[0,4],[4,3],[3,1],[1,2]] },
    { name: '北斗七星', stars: [[11.06,61.75,1.8],[11.03,56.38,2.4],[11.90,53.69,2.4],[12.26,57.03,3.3],[12.90,55.96,1.8],[13.40,54.93,2.2],[13.79,49.31,1.9]], lines: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]] },
    { name: 'カシオペア座', stars: [[0.15,59.15,2.3],[0.68,56.54,2.2],[0.95,60.72,2.4],[1.43,60.24,2.7],[1.91,63.67,3.4]], lines: [[0,1],[1,2],[2,3],[3,4]] },
    { name: 'オリオン座', stars: [[5.92,7.41,0.5],[5.42,6.35,1.6],[5.53,-0.30,2.2],[5.60,-1.20,1.7],[5.68,-1.94,1.8],[5.24,-8.20,0.1],[5.80,-9.67,2.1]], lines: [[0,1],[0,4],[1,2],[2,3],[3,4],[2,5],[4,6],[5,6]] },
    { name: 'はくちょう座', stars: [[20.69,45.28,1.3],[20.37,40.26,2.2],[19.51,27.96,3.1],[19.75,45.13,2.9],[20.77,33.97,2.5]], lines: [[0,1],[1,2],[3,1],[1,4]] },
    { name: 'さそり座', stars: [[16.49,-26.43,1.0],[16.01,-19.81,2.6],[15.98,-22.62,2.3],[16.09,-26.11,2.9],[16.84,-34.29,2.3],[17.20,-43.24,2.4],[17.56,-37.10,1.6]], lines: [[1,2],[2,3],[2,0],[0,4],[4,5],[5,6]] },
    { name: 'こと座', stars: [[18.62,38.78,0.0],[18.83,33.36,3.5],[18.98,32.69,3.2],[18.91,36.90,4.3]], lines: [[0,3],[3,1],[1,2],[2,0]] },
    { name: 'わし座', stars: [[19.85,8.87,0.8],[19.77,10.61,2.7],[19.92,6.41,3.7],[19.09,13.86,3.0]], lines: [[3,1],[1,0],[0,2]] },
    { name: 'おおいぬ座', stars: [[6.75,-16.72,-1.5],[6.38,-17.96,2.0],[7.14,-26.39,1.8],[7.05,-28.97,1.5],[7.40,-29.30,2.5]], lines: [[1,0],[0,2],[2,3],[2,4]] },
    { name: 'しし座', stars: [[10.14,11.97,1.4],[10.33,19.84,2.0],[10.12,16.76,3.5],[11.24,20.52,2.6],[11.82,14.57,2.1]], lines: [[0,2],[2,1],[1,3],[3,4],[4,0]] },
    { name: 'ふたご座', stars: [[7.58,31.89,1.6],[7.76,28.03,1.1],[6.63,16.40,1.9],[6.38,22.51,2.9]], lines: [[0,1],[0,3],[1,2]] },
    { name: 'ペガスス座', stars: [[23.08,15.21,2.5],[23.06,28.08,2.4],[0.14,29.09,2.1],[0.22,15.18,2.8]], lines: [[0,1],[1,2],[2,3],[3,0]] }
  ];

  // --- 天文計算（太陽位置・日の出/日の入り・恒星時→3D座標） ---
  function getSunRaDec(date) {
    const jd = date.getTime() / 86400000 + 2440587.5;
    const d = jd - 2451545.0;
    const L = ((280.460 + 0.9856474 * d) % 360 + 360) % 360;
    const g = ((357.528 + 0.9856003 * d) % 360 + 360) % 360;
    const lam = (L + 1.915 * Math.sin(g * RAD) + 0.020 * Math.sin(2 * g * RAD)) * RAD;
    const eps = (23.439 - 0.0000004 * d) * RAD;
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    const ra = ((Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * DEG) % 360 + 360) % 360;
    return { raDeg: ra, decDeg: dec * DEG, jd, d };
  }

  function getGMSTDeg(date) {
    const d = (date.getTime() / 86400000 + 2440587.5) - 2451545.0;
    return ((280.46061837 + 360.98564736629 * d) % 360 + 360) % 360;
  }

  function raDecToAltAz(raDeg, decDeg, lstDeg, latDeg) {
    const ha = (lstDeg - raDeg) * RAD;
    const dec = decDeg * RAD;
    const lat = latDeg * RAD;
    const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const cosDen = Math.cos(lat) * Math.cos(alt);
    let cosAz = Math.abs(cosDen) > 1e-6 ? (Math.sin(dec) - Math.sin(lat) * sinAlt) / cosDen : 0;
    cosAz = Math.max(-1, Math.min(1, cosAz));
    let az = Math.acos(cosAz);
    if (Math.sin(ha) > 0) az = Math.PI * 2 - az;
    return { alt, az };
  }

  function altAzToVec3(alt, az, r = SKY_R) {
    const c = Math.cos(alt);
    return new THREE.Vector3(r * c * Math.sin(az), r * Math.sin(alt), -r * c * Math.cos(az));
  }

  function calcSunriseSunsetLocal(baseDate, latDeg, lonDeg) {
    const noon = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 12, 0, 0);
    const { decDeg } = getSunRaDec(noon);
    const lat = latDeg * RAD, dec = decDeg * RAD;
    const cosH = (Math.sin(-0.833 * RAD) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));
    const tzOffsetH = -noon.getTimezoneOffset() / 60;
    const solarNoonH = 12 + (tzOffsetH * 15 - lonDeg) / 15;
    if (cosH >= 1) return { sunriseH: 7.0, sunsetH: 17.0, solarNoonH };
    if (cosH <= -1) return { sunriseH: 4.0, sunsetH: 20.0, solarNoonH };
    const halfDayH = (Math.acos(cosH) * DEG) / 15;
    return { sunriseH: solarNoonH - halfDayH, sunsetH: solarNoonH + halfDayH, solarNoonH };
  }

  // --- 日の出切替ルールによる参照日時＆時間帯の算出 ---
  function getRealTimeInfo(now) {
    const times = calcSunriseSunsetLocal(now, state.lat, state.lon);
    const h = now.getHours() + now.getMinutes() / 60;
    let realPhase = 3;
    if (h >= times.sunriseH && h < 10.5) realPhase = 0;
    else if (h >= 10.5 && h < times.sunsetH - 1.5) realPhase = 1;
    else if (h >= times.sunsetH - 1.5 && h < times.sunsetH + 0.75) realPhase = 2;
    else realPhase = 3;

    const skyDayBase = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    if (h < times.sunriseH) skyDayBase.setDate(skyDayBase.getDate() - 1);
    return { realPhase, skyDayBase, times };
  }

  function resolveEffectiveSkyMoment() {
    const now = new Date();
    const { realPhase, skyDayBase, times } = getRealTimeInfo(now);

    if (state.realtimeUnlocked && state.realtimeActive) {
      return { date: now, phase: realPhase, times, modeLabel: '現実リアルタイム' };
    }

    const rawTs = (typeof TIME_STEP !== 'undefined' && Number.isFinite(Number(TIME_STEP))) ? Math.floor(Number(TIME_STEP)) : 0;
    const appPhase = ((rawTs % 4) + 4) % 4;
    const dayOffset = (appPhase < realPhase) ? 1 : 0;
    const refBase = new Date(skyDayBase.getTime());
    refBase.setDate(refBase.getDate() + dayOffset);

    const refTimes = calcSunriseSunsetLocal(refBase, state.lat, state.lon);
    let targetH = refTimes.solarNoonH;
    if (appPhase === 0) targetH = refTimes.sunriseH + 0.45;
    else if (appPhase === 1) targetH = refTimes.solarNoonH;
    else if (appPhase === 2) targetH = refTimes.sunsetH - 0.45;
    else targetH = 21.5;

    const hr = Math.floor(targetH);
    const mn = Math.floor((targetH - hr) * 60);
    const refDate = new Date(refBase.getFullYear(), refBase.getMonth(), refBase.getDate(), hr, mn, 0);
    return { date: refDate, phase: appPhase, times: refTimes, modeLabel: 'ゲーム昼夜×現実空' };
  }

  // --- 3D未来博物館・デジタル天体儀オブジェクト ---
  const skyRoot = new THREE.Group();
  skyRoot.name = 'holo_sky_exhibit_root';
  skyRoot.visible = false;
  scene.add(skyRoot);

  const orbitLineMat = new THREE.LineBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.45, depthWrite: false });
  const orbitLine = new THREE.Line(new THREE.BufferGeometry(), orbitLineMat);
  skyRoot.add(orbitLine);

  const sunGroup = new THREE.Group();
  const sunCoreMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.92, depthWrite: false });
  const sunRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
  sunGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), sunCoreMat));
  const sunHalo = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.68, 32), sunRingMat);
  sunGroup.add(sunHalo);
  skyRoot.add(sunGroup);

  function createHorizonGlowTex() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(64, 124, 6, 64, 124, 118);
    g.addColorStop(0.0, 'rgba(224, 242, 254, 0.85)');
    g.addColorStop(0.4, 'rgba(125, 211, 252, 0.35)');
    g.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    return tex;
  }
  const glowCurtainMat = new THREE.MeshBasicMaterial({
    map: createHorizonGlowTex(), color: 0xbae6fd, transparent: true, opacity: 0.55,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const glowCurtain = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 4.2), glowCurtainMat);
  glowCurtain.visible = false;
  skyRoot.add(glowCurtain);

  function createStarDotTex() {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    g.addColorStop(0.35, 'rgba(186, 230, 253, 0.8)');
    g.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    return tex;
  }

  const starGroup = new THREE.Group();
  const starPointsMat = new THREE.PointsMaterial({
    map: createStarDotTex(), color: 0xe0f2fe, size: 0.52,
    transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const starLinesMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8, transparent: true, opacity: 0.36, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const starPoints = new THREE.Points(new THREE.BufferGeometry(), starPointsMat);
  const starLines = new THREE.LineSegments(new THREE.BufferGeometry(), starLinesMat);
  starGroup.add(starLines, starPoints);
  skyRoot.add(starGroup);

  // --- 天体表示の更新 ---
  let lastCalcKey = '';
  let lastStatusText = '非表示';

  function formatHM(hVal) {
    const hh = Math.floor(((hVal % 24) + 24) % 24);
    const mm = Math.floor((hVal - Math.floor(hVal)) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  function updateCelestialExhibit(force = false) {
    const active = Boolean(state.skyUnlocked && state.skyVisible);
    skyRoot.visible = active;
    if (!active) {
      lastStatusText = '非表示';
      syncSettingsUI();
      return;
    }

    const moment = resolveEffectiveSkyMoment();
    const key = `${moment.date.getFullYear()}-${moment.date.getMonth()}-${moment.date.getDate()}-${moment.date.getHours()}-${Math.floor(moment.date.getMinutes() / 2)}-${moment.phase}-${state.lat.toFixed(2)}-${state.lon.toFixed(2)}`;
    if (!force && key === lastCalcKey) return;
    lastCalcKey = key;

    const orbitPts = [];
    const y = moment.date.getFullYear(), mo = moment.date.getMonth(), da = moment.date.getDate();
    let riseVec = null, setVec = null;
    for (let m = 0; m <= 1440; m += 20) {
      const sample = new Date(y, mo, da, Math.floor(m / 60), m % 60, 0);
      const sun = getSunRaDec(sample);
      const lst = (getGMSTDeg(sample) + state.lon + 360) % 360;
      const { alt, az } = raDecToAltAz(sun.raDeg, sun.decDeg, lst, state.lat);
      if (alt >= -0.01) {
        const v = altAzToVec3(Math.max(0.01, alt), az, SKY_R - 0.8);
        orbitPts.push(v);
        if (!riseVec) riseVec = altAzToVec3(0.02, az, SKY_R - 1.2);
        setVec = altAzToVec3(0.02, az, SKY_R - 1.2);
      }
    }
    orbitLine.geometry.dispose();
    orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(orbitPts);
    orbitLineMat.opacity = (moment.phase === 3) ? 0.16 : (moment.phase === 1 ? 0.38 : 0.52);

    const curSun = getSunRaDec(moment.date);
    const curLst = (getGMSTDeg(moment.date) + state.lon + 360) % 360;
    const sunPos = raDecToAltAz(curSun.raDeg, curSun.decDeg, curLst, state.lat);
    if (sunPos.alt > -0.04 && moment.phase !== 3) {
      sunGroup.visible = true;
      sunGroup.position.copy(altAzToVec3(Math.max(0.03, sunPos.alt), sunPos.az, SKY_R - 0.8));
      sunGroup.lookAt(0, 0, 0);
    } else {
      sunGroup.visible = false;
    }

    if (moment.phase === 0 && riseVec) {
      glowCurtain.visible = true;
      glowCurtain.position.set(riseVec.x, 1.8, riseVec.z);
      glowCurtain.lookAt(0, 1.8, 0);
      glowCurtainMat.opacity = 0.52;
    } else if (moment.phase === 2 && setVec) {
      glowCurtain.visible = true;
      glowCurtain.position.set(setVec.x, 1.8, setVec.z);
      glowCurtain.lookAt(0, 1.8, 0);
      glowCurtainMat.opacity = 0.48;
    } else {
      glowCurtain.visible = false;
    }

    const isNight = (moment.phase === 3 || sunPos.alt < -0.05);
    starGroup.visible = isNight;
    if (isNight) {
      const pArr = [], lArr = [];
      CONSTELLATIONS.forEach((con) => {
        const mapped = con.stars.map(([raH, decD]) => {
          const { alt, az } = raDecToAltAz(raH * 15, decD, curLst, state.lat);
          return { alt, vec: altAzToVec3(alt, az, SKY_R) };
        });
        mapped.forEach((st) => {
          if (st.alt > 0.02) pArr.push(st.vec.x, st.vec.y, st.vec.z);
        });
        con.lines.forEach(([a, b]) => {
          if (mapped[a] && mapped[b] && mapped[a].alt > 0.01 && mapped[b].alt > 0.01) {
            lArr.push(mapped[a].vec.x, mapped[a].vec.y, mapped[a].vec.z, mapped[b].vec.x, mapped[b].vec.y, mapped[b].vec.z);
          }
        });
      });
      starPoints.geometry.dispose();
      starPoints.geometry = new THREE.BufferGeometry();
      starPoints.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pArr, 3));

      starLines.geometry.dispose();
      starLines.geometry = new THREE.BufferGeometry();
      starLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(lArr, 3));
    }

    const pNames = ['朝', '昼', '夕', '夜'];
    lastStatusText = `${moment.modeLabel}｜参照 ${mo + 1}/${da} ${pNames[moment.phase]}（日出${formatHM(moment.times.sunriseH)} / 日入${formatHM(moment.times.sunsetH)}）｜${state.gpsApplied ? `GPS(${state.lat.toFixed(1)}°N)` : '日本標準'}`;
    syncSettingsUI();
  }

  // --- GPS取得（任意ボタン・失敗時は日本標準を維持） ---
  function requestGPS() {
    if (!navigator.geolocation) {
      if (typeof showToast === 'function') showToast('📍 この端末ではGPSを利用できません（日本標準で動作中）');
      return;
    }
    if (typeof showToast === 'function') showToast('📍 現在地の緯度・経度を取得中...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.lat = Number(pos.coords.latitude.toFixed(3));
        state.lon = Number(pos.coords.longitude.toFixed(3));
        state.gpsApplied = true;
        saveState();
        updateCelestialExhibit(true);
        if (typeof showToast === 'function') showToast(`📍 現在地の空へ同期しました (${state.lat.toFixed(1)}°N, ${state.lon.toFixed(1)}°E)`);
      },
      () => {
        if (typeof showToast === 'function') showToast('📍 位置情報が未許可のため日本標準(35.7°N)を使用します');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }

  // --- 設定画面へ天体儀・現実時刻モード・GPSボタンを自動注入 ---
  function syncSettingsUI() {
    let panel = document.getElementById('env-hologram-settings-panel');
    if (!panel) {
      const modals = Array.from(document.querySelectorAll('.modal-overlay'));
      for (let i = 0; i < modals.length; i++) {
        const idLow = (modals[i].id || '').toLowerCase();
        const titleEl = modals[i].querySelector('.modal-title');
        if (idLow.includes('setting') || idLow.includes('config') || (titleEl && titleEl.innerText.includes('設定'))) {
          const content = modals[i].querySelector('.modal-content');
          if (content) {
            panel = document.createElement('div');
            panel.id = 'env-hologram-settings-panel';
            panel.style.cssText = 'margin-top:8px;padding:10px;border-radius:12px;background:#f0f9ff;border:1.5px solid #7dd3fc;display:flex;flex-direction:column;gap:8px;text-align:left;';
            panel.innerHTML = '<div style="font-size:11.5px;font-weight:900;color:#0369a1;">🧪 観察環境・機能解放（基本非表示／ストーリー解放予定）</div>';
            content.appendChild(panel);
          }
          break;
        }
      }
    }
    if (!panel) return;

    let box = document.getElementById('env-skytime-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'env-skytime-box';
      box.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
      box.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:#ffffff;border:1px solid #bae6fd;border-radius:9px;padding:7px 9px;">
          <div style="font-size:11px;font-weight:800;color:#0f172a;">🌌 デジタル天体儀（朝昼夕夜）<div style="font-size:9.5px;font-weight:600;color:#64748b;">青白太陽軌道＋夜のみリアル星座線</div></div>
          <button type="button" id="btn-toggle-holo-sky" style="padding:5px 10px;border-radius:8px;border:none;font-size:11px;font-weight:900;cursor:pointer;"></button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:#ffffff;border:1px solid #bae6fd;border-radius:9px;padding:7px 9px;">
          <div style="font-size:11px;font-weight:800;color:#0f172a;">🕒 現実時刻・全振り観察モード<div style="font-size:9.5px;font-weight:600;color:#64748b;">ONでスマホ現在時刻の空へ完全同期</div></div>
          <button type="button" id="btn-toggle-realtime-sky" style="padding:5px 10px;border-radius:8px;border:none;font-size:11px;font-weight:900;cursor:pointer;"></button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
          <button type="button" id="btn-gps-sync-sky" style="flex:1;padding:6px 8px;border-radius:8px;border:1px solid #38bdf8;background:#e0f2fe;color:#0369a1;font-size:10.5px;font-weight:900;cursor:pointer;">📍 GPSで現在地の空に合わせる</button>
          <button type="button" id="btn-gps-reset-sky" style="padding:6px 8px;border-radius:8px;border:1px solid #cbd5e1;background:#ffffff;color:#475569;font-size:10px;font-weight:800;cursor:pointer;">日本標準</button>
        </div>
        <div id="env-skytime-status" style="font-size:9.5px;font-weight:700;color:#0369a1;background:#e0f2fe;border-radius:7px;padding:5px 7px;line-height:1.4;"></div>
      `;
      panel.appendChild(box);

      document.getElementById('btn-toggle-holo-sky').onclick = () => {
        const next = !(state.skyUnlocked && state.skyVisible);
        state.skyUnlocked = next;
        state.skyVisible = next;
        saveState();
        updateCelestialExhibit(true);
        if (typeof showToast === 'function') showToast(next ? '🌌 デジタル天体儀を表示しました' : '🌌 デジタル天体儀を非表示にしました');
      };
      document.getElementById('btn-toggle-realtime-sky').onclick = () => {
        const next = !(state.realtimeUnlocked && state.realtimeActive);
        state.realtimeUnlocked = next;
        state.realtimeActive = next;
        if (next) { state.skyUnlocked = true; state.skyVisible = true; }
        saveState();
        updateCelestialExhibit(true);
        if (typeof showToast === 'function') showToast(next ? '🕒 現実時刻モードへ切り替えました' : '🕒 ゲーム昼夜×現実空ルールへ戻しました');
      };
      document.getElementById('btn-gps-sync-sky').onclick = requestGPS;
      document.getElementById('btn-gps-reset-sky').onclick = () => {
        state.lat = 35.68; state.lon = 139.77; state.gpsApplied = false;
        saveState(); updateCelestialExhibit(true);
        if (typeof showToast === 'function') showToast('📍 日本標準座標(35.7°N)へ戻しました');
      };
    }

    const skyOn = Boolean(state.skyUnlocked && state.skyVisible);
    const rtOn = Boolean(state.realtimeUnlocked && state.realtimeActive);
    const bSky = document.getElementById('btn-toggle-holo-sky');
    const bRt = document.getElementById('btn-toggle-realtime-sky');
    const stEl = document.getElementById('env-skytime-status');
    if (bSky) {
      bSky.innerText = skyOn ? '表示中 (ON)' : '非表示 (OFF)';
      bSky.style.background = skyOn ? '#0284c7' : '#e2e8f0';
      bSky.style.color = skyOn ? '#ffffff' : '#475569';
    }
    if (bRt) {
      bRt.innerText = rtOn ? '現実時刻 (ON)' : 'ゲーム連動 (OFF)';
      bRt.style.background = rtOn ? '#0284c7' : '#e2e8f0';
      bRt.style.color = rtOn ? '#ffffff' : '#475569';
    }
    if (stEl) stEl.innerText = lastStatusText;
  }

  // --- 既存の環境更新フック＆定期チェック ---
  if (typeof updateEnvironmentAndUI === 'function') {
    const _origUpdateEnv = updateEnvironmentAndUI;
    updateEnvironmentAndUI = function() {
      const r = _origUpdateEnv.apply(this, arguments);
      updateCelestialExhibit(false);
      return r;
    };
  }
  setInterval(() => updateCelestialExhibit(false), 3000);
  setTimeout(() => { updateCelestialExhibit(true); syncSettingsUI(); }, 800);

  window.SkyTimeModule = {
    unlockSky: () => { state.skyUnlocked = true; state.skyVisible = true; saveState(); updateCelestialExhibit(true); },
    setSkyVisible: (v) => { state.skyVisible = Boolean(v); if (v) state.skyUnlocked = true; saveState(); updateCelestialExhibit(true); },
    unlockRealtime: () => { state.realtimeUnlocked = true; state.realtimeActive = true; state.skyUnlocked = true; state.skyVisible = true; saveState(); updateCelestialExhibit(true); },
    setRealtime: (v) => { state.realtimeActive = Boolean(v); if (v) { state.realtimeUnlocked = true; state.skyUnlocked = true; state.skyVisible = true; } saveState(); updateCelestialExhibit(true); },
    requestGPS,
    getPhaseIndex: () => resolveEffectiveSkyMoment().phase,
    refresh: () => updateCelestialExhibit(true)
  };

  if (window.DebugGuard) window.DebugGuard.markLoaded('sky_time.js');
})();
