// ============================================================================
// 【独立ビジュアルモジュール：sky_time.js】
// ・3段階表示：通常(アニメ表情＆ピカピカ▲→◯)／観測前(リアル)／観察時(計測◯)
// ・太陽＆月の実天球計算・日の出切替ルール・GPS自前事前確認・現実時刻同期
// ============================================================================
(function initSkyTimeModule() {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined') return;

  const STORAGE_KEY = 'island_sky_time_v3';
  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;
  const SKY_R = 16.5;

  const state = {
    skyUnlocked: false,
    skyVisible: false,
    viewMode: 'anime', // 'anime'(通常) | 'pre_obs'(観測前) | 'obs'(観察時)
    obsConstLines: true,
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

  // --- 実天球座標データ（主要12星座：赤経[時], 赤緯[度]） ---
  const CONSTELLATIONS = [
    { name: 'こぐま座', stars: [[2.53,89.26],[14.85,74.16],[15.35,71.83],[16.77,82.04],[17.54,86.59]], lines: [[0,4],[4,3],[3,1],[1,2]] },
    { name: '北斗七星', stars: [[11.06,61.75],[11.03,56.38],[11.90,53.69],[12.26,57.03],[12.90,55.96],[13.40,54.93],[13.79,49.31]], lines: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]] },
    { name: 'カシオペア座', stars: [[0.15,59.15],[0.68,56.54],[0.95,60.72],[1.43,60.24],[1.91,63.67]], lines: [[0,1],[1,2],[2,3],[3,4]] },
    { name: 'オリオン座', stars: [[5.92,7.41],[5.42,6.35],[5.53,-0.30],[5.60,-1.20],[5.68,-1.94],[5.24,-8.20],[5.80,-9.67]], lines: [[0,1],[0,4],[1,2],[2,3],[3,4],[2,5],[4,6],[5,6]] },
    { name: 'はくちょう座', stars: [[20.69,45.28],[20.37,40.26],[19.51,27.96],[19.75,45.13],[20.77,33.97]], lines: [[0,1],[1,2],[3,1],[1,4]] },
    { name: 'さそり座', stars: [[16.49,-26.43],[16.01,-19.81],[15.98,-22.62],[16.09,-26.11],[16.84,-34.29],[17.20,-43.24],[17.56,-37.10]], lines: [[1,2],[2,3],[2,0],[0,4],[4,5],[5,6]] },
    { name: 'こと座', stars: [[18.62,38.78],[18.83,33.36],[18.98,32.69],[18.91,36.90]], lines: [[0,3],[3,1],[1,2],[2,0]] },
    { name: 'わし座', stars: [[19.85,8.87],[19.77,10.61],[19.92,6.41],[19.09,13.86]], lines: [[3,1],[1,0],[0,2]] },
    { name: 'おおいぬ座', stars: [[6.75,-16.72],[6.38,-17.96],[7.14,-26.39],[7.05,-28.97],[7.40,-29.30]], lines: [[1,0],[0,2],[2,3],[2,4]] },
    { name: 'しし座', stars: [[10.14,11.97],[10.33,19.84],[10.12,16.76],[11.24,20.52],[11.82,14.57]], lines: [[0,2],[2,1],[1,3],[3,4],[4,0]] },
    { name: 'ふたご座', stars: [[7.58,31.89],[7.76,28.03],[6.63,16.40],[6.38,22.51]], lines: [[0,1],[0,3],[1,2]] },
    { name: 'ペガスス座', stars: [[23.08,15.21],[23.06,28.08],[0.14,29.09],[0.22,15.18]], lines: [[0,1],[1,2],[2,3],[3,0]] }
  ];

  // --- 天文計算（太陽・月・満ち欠け・恒星時→3D座標） ---
  function norm360(v) { return ((v % 360) + 360) % 360; }

  function getSunInfo(date) {
    const d = (date.getTime() / 86400000 + 2440587.5) - 2451545.0;
    const L = norm360(280.460 + 0.9856474 * d);
    const g = norm360(357.528 + 0.9856003 * d);
    const lamDeg = norm360(L + 1.915 * Math.sin(g * RAD) + 0.020 * Math.sin(2 * g * RAD));
    const eps = (23.439 - 0.0000004 * d) * RAD;
    const lam = lamDeg * RAD;
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    const ra = norm360(Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * DEG);
    return { raDeg: ra, decDeg: dec * DEG, lamDeg };
  }

  function getMoonInfo(date) {
    const d = (date.getTime() / 86400000 + 2440587.5) - 2451545.0;
    const Lm = norm360(218.316 + 13.176396 * d);
    const Mm = norm360(134.963 + 13.064993 * d);
    const F  = norm360(93.272 + 13.229350 * d);
    const lamDeg = norm360(Lm + 6.289 * Math.sin(Mm * RAD));
    const betDeg = 5.128 * Math.sin(F * RAD);
    const eps = (23.439 - 0.0000004 * d) * RAD;
    const lam = lamDeg * RAD, bet = betDeg * RAD;
    const ra = norm360(Math.atan2(Math.sin(lam) * Math.cos(eps) - Math.tan(bet) * Math.sin(eps), Math.cos(lam)) * DEG);
    const dec = Math.asin(Math.max(-1, Math.min(1, Math.sin(bet) * Math.cos(eps) + Math.cos(bet) * Math.sin(eps) * Math.sin(lam)))) * DEG;
    const sun = getSunInfo(date);
    const phaseDeg = norm360(lamDeg - sun.lamDeg);
    return { raDeg: ra, decDeg: dec, phaseDeg, illum: (1 - Math.cos(phaseDeg * RAD)) * 0.5 };
  }

  function getGMSTDeg(date) {
    return norm360(280.46061837 + 360.98564736629 * ((date.getTime() / 86400000 + 2440587.5) - 2451545.0));
  }

  function raDecToAltAz(raDeg, decDeg, lstDeg, latDeg) {
    const ha = (lstDeg - raDeg) * RAD, dec = decDeg * RAD, lat = latDeg * RAD;
    const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const cosDen = Math.cos(lat) * Math.cos(alt);
    let cosAz = Math.abs(cosDen) > 1e-6 ? (Math.sin(dec) - Math.sin(lat) * sinAlt) / cosDen : 0;
    let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
    if (Math.sin(ha) > 0) az = Math.PI * 2 - az;
    return { alt, az };
  }

  function altAzToVec3(alt, az, r = SKY_R) {
    const c = Math.cos(alt);
    return new THREE.Vector3(r * c * Math.sin(az), r * Math.sin(alt), -r * c * Math.cos(az));
  }

  function calcSunriseSunsetLocal(baseDate, latDeg, lonDeg) {
    const noon = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 12, 0, 0);
    const { decDeg } = getSunInfo(noon);
    const lat = latDeg * RAD, dec = decDeg * RAD;
    const cosH = (Math.sin(-0.833 * RAD) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));
    const solarNoonH = 12 + (-noon.getTimezoneOffset() / 60 * 15 - lonDeg) / 15;
    if (cosH >= 1) return { sunriseH: 7.0, sunsetH: 17.0, solarNoonH };
    if (cosH <= -1) return { sunriseH: 4.0, sunsetH: 20.0, solarNoonH };
    const halfDayH = (Math.acos(cosH) * DEG) / 15;
    return { sunriseH: solarNoonH - halfDayH, sunsetH: solarNoonH + halfDayH, solarNoonH };
  }

  function getRealTimeInfo(now) {
    const times = calcSunriseSunsetLocal(now, state.lat, state.lon);
    const h = now.getHours() + now.getMinutes() / 60;
    let realPhase = 3;
    if (h >= times.sunriseH && h < 10.5) realPhase = 0;
    else if (h >= 10.5 && h < times.sunsetH - 1.5) realPhase = 1;
    else if (h >= times.sunsetH - 1.5 && h < times.sunsetH + 0.75) realPhase = 2;
    const skyDayBase = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    if (h < times.sunriseH) skyDayBase.setDate(skyDayBase.getDate() - 1);
    return { realPhase, skyDayBase, times, nowH: h };
  }

  function resolveEffectiveSkyMoment() {
    const now = new Date();
    const { realPhase, skyDayBase, times, nowH } = getRealTimeInfo(now);
    const useRealtime = Boolean(state.realtimeUnlocked && state.realtimeActive);
    if (useRealtime) {
      let moonMood = 'calm';
      if (nowH >= times.sunsetH - 0.5 && nowH < 22.5) moonMood = 'energetic';
      else if (nowH >= 2.5 && nowH < times.sunriseH + 0.5) moonMood = 'sleepy';
      return { date: now, phase: realPhase, times, modeLabel: '現実リアルタイム', moonMood, isRealtime: true };
    }
    const rawTs = (typeof TIME_STEP !== 'undefined' && Number.isFinite(Number(TIME_STEP))) ? Math.floor(Number(TIME_STEP)) : 0;
    const appPhase = ((rawTs % 4) + 4) % 4;
    const refBase = new Date(skyDayBase.getTime());
    if (appPhase < realPhase) refBase.setDate(refBase.getDate() + 1);
    const refTimes = calcSunriseSunsetLocal(refBase, state.lat, state.lon);
    let targetH = refTimes.solarNoonH;
    if (appPhase === 0) targetH = refTimes.sunriseH + 0.55;
    else if (appPhase === 1) targetH = refTimes.solarNoonH;
    else if (appPhase === 2) targetH = refTimes.sunsetH - 0.55;
    else targetH = 21.5;

    // ゲーム夜の表情：夜の時間帯は現実進行に合わせ、昼テスト時は45秒で3表情を穏やかに巡回
    let moonMood = 'energetic';
    if (realPhase === 3) {
      if (nowH >= 22.5 || nowH < 2.5) moonMood = 'calm';
      if (nowH >= 2.5 && nowH < times.sunriseH) moonMood = 'sleepy';
    } else {
      const cycle = Math.floor((Date.now() / 15000) % 3);
      moonMood = cycle === 0 ? 'energetic' : (cycle === 1 ? 'calm' : 'sleepy');
    }
    const hr = Math.floor(targetH), mn = Math.floor((targetH - hr) * 60);
    return { date: new Date(refBase.getFullYear(), refBase.getMonth(), refBase.getDate(), hr, mn, 0), phase: appPhase, times: refTimes, modeLabel: 'ゲーム昼夜×現実空', moonMood, isRealtime: false };
  }

  // --- Canvasテクスチャ生成（超軽量キャッシュ） ---
  function makeCanvasTex(size, drawFn) {
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    drawFn(cv.getContext('2d'), size);
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    return tex;
  }

  function drawCuteFace(ctx, cx, cy, mood, ink, cheekRgba, isProfile = false) {
    ctx.fillStyle = cheekRgba;
    if (isProfile) {
      ctx.beginPath(); ctx.ellipse(cx - 2, cy + 12, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(cx - 33, cy + 11, 10, 6, 0, 0, Math.PI * 2); ctx.ellipse(cx + 33, cy + 11, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineCap = 'round';
    const eyes = isProfile ? [[cx - 10, cy - 4]] : [[cx - 21, cy - 6], [cx + 21, cy - 6]];
    if (mood === 'energetic') {
      eyes.forEach(([ex, ey]) => {
        ctx.beginPath(); ctx.arc(ex, ey, 7.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex - 2.3, ey - 2.6, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = ink;
      });
      ctx.beginPath(); ctx.arc(cx, cy + 6, isProfile ? 10 : 14, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#fb7185'; ctx.beginPath(); ctx.arc(cx, cy + 12, isProfile ? 5.5 : 7.5, 0, Math.PI); ctx.fill();
    } else if (mood === 'calm') {
      eyes.forEach(([ex, ey]) => { ctx.beginPath(); ctx.arc(ex, ey, 6.4, 0, Math.PI * 2); ctx.fill(); });
      ctx.lineWidth = 4.6;
      ctx.beginPath(); ctx.arc(cx, cy + 5, isProfile ? 9 : 13, 0.16 * Math.PI, 0.84 * Math.PI); ctx.stroke();
    } else {
      // sleepy（眠そうな半目＋ふわっと小さな口）
      ctx.lineWidth = 4.6;
      eyes.forEach(([ex, ey]) => {
        ctx.beginPath(); ctx.arc(ex, ey - 2, 7.5, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
      });
      ctx.lineWidth = 4.0;
      ctx.beginPath(); ctx.ellipse(cx, cy + 12, isProfile ? 5 : 6.5, 5, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // 太陽の後ろでピカピカ揺れる▲光線専用テクスチャ
  const texSunRays = makeCanvasTex(256, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#fdba74';
    for (let i = 0; i < 12; i++) {
      ctx.save(); ctx.translate(c, c); ctx.rotate((i / 12) * Math.PI * 2);
      ctx.beginPath(); ctx.moveTo(-12, -74); ctx.lineTo(12, -74); ctx.lineTo(0, -118); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  });

  // パステル顔つき太陽（丸本体：朝/昼/夕の3表情）
  const texSunAnime = {};
  ['energetic', 'calm', 'sleepy'].forEach((mood) => {
    texSunAnime[mood] = makeCanvasTex(256, (ctx, s) => {
      const c = s / 2;
      const g = ctx.createRadialGradient(c, c, 46, c, c, 120);
      g.addColorStop(0, mood === 'sleepy' ? 'rgba(251, 146, 60, 0.55)' : 'rgba(255, 198, 128, 0.58)');
      g.addColorStop(1, 'rgba(255, 198, 128, 0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, 120, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mood === 'sleepy' ? '#fb923c' : '#f97316';
      ctx.beginPath(); ctx.arc(c, c, 70, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mood === 'sleepy' ? '#fdba74' : '#fed7aa';
      ctx.beginPath(); ctx.arc(c - 7, c - 7, 58, 0, Math.PI * 2); ctx.fill();
      drawCuteFace(ctx, c, c, mood, '#7c2d12', 'rgba(251, 113, 133, 0.52)', false);
    });
  });

  // パステル顔つき月（満月＆三日月 × 3表情）
  const texMoonAnime = {};
  ['full', 'crescent'].forEach((shape) => {
    texMoonAnime[shape] = {};
    ['energetic', 'calm', 'sleepy'].forEach((mood) => {
      texMoonAnime[shape][mood] = makeCanvasTex(256, (ctx, s) => {
        const c = s / 2;
        const g = ctx.createRadialGradient(c, c, 44, c, c, 118);
        g.addColorStop(0, 'rgba(254, 240, 138, 0.48)'); g.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, 118, 0, Math.PI * 2); ctx.fill();
        if (shape === 'full') {
          ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(c, c, 68, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(c - 6, c - 6, 56, 0, Math.PI * 2); ctx.fill();
          drawCuteFace(ctx, c, c, mood, '#713f12', 'rgba(251, 146, 60, 0.34)', false);
        } else {
          const off = document.createElement('canvas'); off.width = s; off.height = s;
          const octx = off.getContext('2d');
          octx.fillStyle = '#fde047'; octx.beginPath(); octx.arc(c, c, 70, 0, Math.PI * 2); octx.fill();
          octx.globalCompositeOperation = 'destination-out';
          octx.beginPath(); octx.arc(c + 34, c - 14, 58, 0, Math.PI * 2); octx.fill();
          ctx.drawImage(off, 0, 0);
          drawCuteFace(ctx, c - 22, c + 2, mood, '#713f12', 'rgba(251, 146, 60, 0.34)', true);
        }
      });
    });
  });

  // リアル太陽・リアル満ち欠け月・計測透過◯・星
  const texSunReal = makeCanvasTex(256, (ctx, s) => {
    const c = s / 2, g = ctx.createRadialGradient(c, c, 14, c, c, 124);
    g.addColorStop(0, 'rgba(255,255,250,1)'); g.addColorStop(0.28, 'rgba(255,244,214,0.96)');
    g.addColorStop(0.46, 'rgba(253,224,150,0.48)'); g.addColorStop(0.75, 'rgba(186,230,253,0.14)'); g.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });

  const moonRealCanvas = document.createElement('canvas');
  moonRealCanvas.width = 256; moonRealCanvas.height = 256;
  const texMoonReal = new THREE.CanvasTexture(moonRealCanvas);
  let lastMoonPhaseBucket = -1;
  function updateRealMoonTexture(phaseDeg) {
    const bucket = Math.round(phaseDeg / 6);
    if (bucket === lastMoonPhaseBucket) return;
    lastMoonPhaseBucket = bucket;
    const ctx = moonRealCanvas.getContext('2d'), s = 256, c = 128, r = 82;
    ctx.clearRect(0, 0, s, s);
    const halo = ctx.createRadialGradient(c, c, r * 0.85, c, c, 124);
    halo.addColorStop(0, 'rgba(224,242,254,0.28)'); halo.addColorStop(1, 'rgba(224,242,254,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(c, c, 124, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.clip();
    const bg = ctx.createRadialGradient(c - 18, c - 18, 12, c, c, r);
    bg.addColorStop(0, '#f8fafc'); bg.addColorStop(0.7, '#e2e8f0'); bg.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(148,163,184,0.28)';
    [[c-22,c-18,22],[c+18,c-8,16],[c-6,c+24,20],[c+26,c+22,12]].forEach(([x,y,cr]) => { ctx.beginPath(); ctx.arc(x,y,cr,0,Math.PI*2); ctx.fill(); });
    const k = Math.cos(phaseDeg * RAD);
    ctx.fillStyle = 'rgba(15,23,42,0.86)'; ctx.beginPath();
    if (phaseDeg <= 180) {
      ctx.arc(c, c, r + 1, Math.PI / 2, Math.PI * 1.5, false);
      ctx.ellipse(c, c, Math.abs(k) * r, r + 1, 0, -Math.PI / 2, Math.PI / 2, k < 0);
    } else {
      ctx.arc(c, c, r + 1, -Math.PI / 2, Math.PI / 2, false);
      ctx.ellipse(c, c, Math.abs(k) * r, r + 1, 0, Math.PI / 2, Math.PI * 1.5, k < 0);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
    texMoonReal.needsUpdate = true;
  }

  function createMeasureTex(fill, stroke) {
    return makeCanvasTex(256, (ctx, s) => {
      const c = s / 2;
      ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(c, c, 82, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = stroke; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(c, c, 82, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c, c, 102, 0, Math.PI * 2); ctx.stroke();
    });
  }
  const texSunObs  = createMeasureTex('rgba(250, 204, 21, 0.36)', 'rgba(253, 224, 71, 0.88)');
  const texMoonObs = createMeasureTex('rgba(255, 255, 255, 0.34)', 'rgba(241, 245, 249, 0.90)');

  const texStarDigital = makeCanvasTex(64, (ctx, s) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(186,230,253,0.85)'); g.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
  const texStarPastel = makeCanvasTex(64, (ctx, s) => {
    const c = 32, g = ctx.createRadialGradient(c, c, 2, c, c, 28);
    g.addColorStop(0, 'rgba(255,251,235,1)'); g.addColorStop(0.45, 'rgba(253,224,71,0.55)'); g.addColorStop(1, 'rgba(249,168,212,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#fffbeb'; ctx.beginPath();
    ctx.moveTo(c, 6); ctx.quadraticCurveTo(c, c, 58, c); ctx.quadraticCurveTo(c, c, c, 58);
    ctx.quadraticCurveTo(c, c, 6, c); ctx.quadraticCurveTo(c, c, c, 6); ctx.fill();
  });

  // --- 3D天体儀グループ ---
  const skyRoot = new THREE.Group();
  skyRoot.name = 'holo_sky_exhibit_root';
  skyRoot.visible = false;
  scene.add(skyRoot);

  const sunOrbitMat  = new THREE.LineBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.48, depthWrite: false });
  const moonOrbitMat = new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.34, depthWrite: false });
  const sunOrbitLine  = new THREE.Line(new THREE.BufferGeometry(), sunOrbitMat);
  const moonOrbitLine = new THREE.Line(new THREE.BufferGeometry(), moonOrbitMat);
  skyRoot.add(sunOrbitLine, moonOrbitLine);

  const sunRayMat     = new THREE.SpriteMaterial({ map: texSunRays, transparent: true, opacity: 0.9, depthWrite: false });
  const sunSpriteMat  = new THREE.SpriteMaterial({ map: texSunAnime.energetic, transparent: true, depthWrite: false });
  const moonSpriteMat = new THREE.SpriteMaterial({ map: texMoonAnime.full.energetic, transparent: true, depthWrite: false });
  const sunRaySprite  = new THREE.Sprite(sunRayMat);
  const sunSprite     = new THREE.Sprite(sunSpriteMat);
  const moonSprite    = new THREE.Sprite(moonSpriteMat);
  skyRoot.add(sunRaySprite, sunSprite, moonSprite);

  const starGroup = new THREE.Group();
  const starPointsMat = new THREE.PointsMaterial({ map: texStarDigital, color: 0xe0f2fe, size: 0.56, transparent: true, opacity: 0.94, blending: THREE.AdditiveBlending, depthWrite: false });
  const starLineSolidMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.40, blending: THREE.AdditiveBlending, depthWrite: false });
  const starLineDashMat  = new THREE.LineDashedMaterial({ color: 0xf9a8d4, dashSize: 0.55, gapSize: 0.35, transparent: true, opacity: 0.58, depthWrite: false });
  const starPoints = new THREE.Points(new THREE.BufferGeometry(), starPointsMat);
  const starLines  = new THREE.LineSegments(new THREE.BufferGeometry(), starLineSolidMat);
  starGroup.add(starLines, starPoints);
  skyRoot.add(starGroup);

  // --- 元アプリの星空・オリオン座の徹底非表示（朝昼夕の星かぶり解消） ---
  const hiddenLegacy3D = new Map();
  const hiddenLegacyDOM = new Map();
  const CONST_KW = ['オリオン座', '北斗七星', 'カシオペア', '夏の大三角', 'さそり座', 'こぐま座'];

  function isOwnObject(obj) {
    let cur = obj;
    while (cur) {
      if (cur === skyRoot || (cur.name && cur.name.startsWith('holo_'))) return true;
      cur = cur.parent;
    }
    return false;
  }

  function syncLegacySkyObjects(shouldHide) {
    if (shouldHide) {
      scene.traverse((obj) => {
        if (!obj || isOwnObject(obj) || !obj.visible) return;
        const nm = (obj.name || '').toLowerCase();
        let hide = nm.includes('star') || nm.includes('constell') || nm.includes('orion') || nm.includes('zodiac');
        if (!hide && obj.isPoints && obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position) {
          // 広域に散らばる背景の白い星パーティクルを検出（島内の小型エフェクトは除外）
          if (obj.geometry.attributes.position.count >= 15) {
            obj.geometry.computeBoundingSphere();
            if (obj.geometry.boundingSphere && obj.geometry.boundingSphere.radius > 8) hide = true;
          }
        }
        if (!hide && (obj.isLine || obj.isLineSegments || obj.isMesh)) {
          const wp = new THREE.Vector3();
          obj.getWorldPosition(wp);
          if (wp.length() > 9.5 && wp.y > 1.5) {
            if (obj.isLine || obj.isLineSegments) hide = true;
            else if (obj.material && obj.material.color) {
              const col = obj.material.color;
              if (col.r > 0.85 && col.g > 0.72 && col.b < 0.5) hide = true;
            }
          }
        }
        if (hide) { hiddenLegacy3D.set(obj, true); obj.visible = false; }
      });

      document.querySelectorAll('div, span').forEach((el) => {
        if (!el || el.children.length > 0 || el.id === 'env-skytime-status') return;
        const txt = (el.textContent || '').trim();
        if (txt.length > 0 && txt.length <= 16 && CONST_KW.some((kw) => txt.includes(kw))) {
          if (el.style.display !== 'none') { hiddenLegacyDOM.set(el, el.style.display || ''); el.style.display = 'none'; }
        }
      });
    } else {
      hiddenLegacy3D.forEach((_, obj) => { try { obj.visible = true; } catch (e) {} });
      hiddenLegacy3D.clear();
      hiddenLegacyDOM.forEach((d, el) => { try { el.style.display = d; } catch (e) {} });
      hiddenLegacyDOM.clear();
    }
  }

  // --- 天体更新＆バトンタッチ状態管理 ---
  let lastCalcKey = '';
  let lastStatusText = '非表示';
  let currentRayMode = 'off'; // 'morning' | 'noon' | 'off'

  function formatHM(hVal) {
    const hh = Math.floor(((hVal % 24) + 24) % 24);
    const mm = Math.floor((hVal - Math.floor(hVal)) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  function buildBodyOrbitPoints(y, mo, da, getBodyFn, radius) {
    const pts = [];
    for (let m = 0; m <= 1440; m += 20) {
      const sample = new Date(y, mo, da, Math.floor(m / 60), m % 60, 0);
      const body = getBodyFn(sample);
      const lst = norm360(getGMSTDeg(sample) + state.lon);
      const { alt, az } = raDecToAltAz(body.raDeg, body.decDeg, lst, state.lat);
      if (alt >= -0.01) pts.push(altAzToVec3(Math.max(0.01, alt), az, radius));
    }
    return pts;
  }

  function updateCelestialExhibit(force = false) {
    const active = Boolean(state.skyUnlocked && state.skyVisible);
    skyRoot.visible = active;
    syncLegacySkyObjects(active);
    if (!active) {
      currentRayMode = 'off';
      lastStatusText = '非表示';
      syncSettingsUI();
      return;
    }

    const moment = resolveEffectiveSkyMoment();
    const key = `${state.viewMode}-${state.obsConstLines}-${moment.isRealtime}-${moment.moonMood}-${moment.date.getFullYear()}-${moment.date.getMonth()}-${moment.date.getDate()}-${moment.date.getHours()}-${Math.floor(moment.date.getMinutes() / 2)}-${moment.phase}-${state.lat.toFixed(2)}-${state.lon.toFixed(2)}`;
    if (!force && key === lastCalcKey) return;
    lastCalcKey = key;

    const y = moment.date.getFullYear(), mo = moment.date.getMonth(), da = moment.date.getDate();
    const curLst = norm360(getGMSTDeg(moment.date) + state.lon);
    const curSun = getSunInfo(moment.date);
    const curMoon = getMoonInfo(moment.date);
    const sunPos = raDecToAltAz(curSun.raDeg, curSun.decDeg, curLst, state.lat);
    const moonPos = raDecToAltAz(curMoon.raDeg, curMoon.decDeg, curLst, state.lat);
    const isNight = (moment.phase === 3 || sunPos.alt < -0.05);
    const isAnime = (state.viewMode === 'anime');
    const isPreObs = (state.viewMode === 'pre_obs');

    // 1. 軌道線（通常アニメなし／観測前・観察時は太陽＆月あり）
    if (isAnime) {
      sunOrbitLine.visible = false; moonOrbitLine.visible = false;
    } else {
      const sPts = buildBodyOrbitPoints(y, mo, da, getSunInfo, SKY_R - 0.9);
      sunOrbitLine.geometry.dispose();
      sunOrbitLine.geometry = new THREE.BufferGeometry().setFromPoints(sPts);
      sunOrbitLine.visible = (sPts.length >= 2) && !isNight;
      sunOrbitMat.opacity = (moment.phase === 1) ? 0.36 : 0.50;

      const mPts = buildBodyOrbitPoints(y, mo, da, getMoonInfo, SKY_R - 1.2);
      moonOrbitLine.geometry.dispose();
      moonOrbitLine.geometry = new THREE.BufferGeometry().setFromPoints(mPts);
      moonOrbitLine.visible = (mPts.length >= 2);
      moonOrbitMat.opacity = isNight ? 0.42 : 0.24;
    }

    // 2. 太陽配置＆表情（朝：元気＋ピカピカ▲／昼：穏やか＋弱▲／夕：眠い＋◯のみ）
    currentRayMode = 'off';
    if (!isNight && sunPos.alt > -0.04) {
      const sVec = altAzToVec3(Math.max(0.05, sunPos.alt), sunPos.az, SKY_R - 0.9);
      const horizonFade = Math.min(1, Math.max(0.55, (sunPos.alt + 0.04) / 0.16));
      sunSprite.visible = true;
      sunSprite.position.copy(sVec);

      if (isAnime) {
        const sunMood = moment.phase === 0 ? 'energetic' : (moment.phase === 1 ? 'calm' : 'sleepy');
        sunSpriteMat.map = texSunAnime[sunMood];
        sunSpriteMat.opacity = horizonFade;
        sunSprite.scale.set(2.6, 2.6, 1);
        sunRaySprite.position.copy(sVec).multiplyScalar(1.008); // 太陽のすぐ背後に配置
        if (moment.phase === 0) {
          currentRayMode = 'morning'; sunRaySprite.visible = true; sunRaySprite.scale.set(3.25, 3.25, 1); sunRayMat.opacity = 0.95;
        } else if (moment.phase === 1) {
          currentRayMode = 'noon'; sunRaySprite.visible = true; sunRaySprite.scale.set(2.75, 2.75, 1); sunRayMat.opacity = 0.48;
        } else {
          sunRaySprite.visible = false; // 夕方は▲を消して◯だけで沈む
        }
      } else if (isPreObs) {
        sunRaySprite.visible = false;
        sunSpriteMat.map = texSunReal; sunSpriteMat.opacity = 0.98 * horizonFade; sunSprite.scale.set(3.2, 3.2, 1);
      } else {
        sunRaySprite.visible = false;
        sunSpriteMat.map = texSunObs;  sunSpriteMat.opacity = 0.92; sunSprite.scale.set(2.1, 2.1, 1);
      }
      sunSpriteMat.needsUpdate = true;
    } else {
      sunSprite.visible = false;
      sunRaySprite.visible = false;
    }

    // 3. 月配置＆表情（夜はじめ元気→夜中穏やか→明け方前眠いでバトンタッチ）
    if (isAnime) {
      if (isNight) {
        const shape = (curMoon.illum <= 0.55) ? 'crescent' : 'full';
        moonSprite.visible = true;
        moonSpriteMat.map = texMoonAnime[shape][moment.moonMood] || texMoonAnime[shape].calm;
        moonSpriteMat.opacity = moment.moonMood === 'sleepy' ? 0.88 : 1.0;
        moonSpriteMat.needsUpdate = true;
        moonSprite.scale.set(2.5, 2.5, 1);
        if (moonPos.alt > 0.08) moonSprite.position.copy(altAzToVec3(moonPos.alt, moonPos.az, SKY_R - 1.1));
        else moonSprite.position.copy(altAzToVec3(0.42, 215 * RAD, SKY_R - 1.1));
      } else {
        moonSprite.visible = false;
      }
    } else if (moonPos.alt > -0.02) {
      moonSprite.visible = true;
      moonSprite.position.copy(altAzToVec3(Math.max(0.04, moonPos.alt), moonPos.az, SKY_R - 1.2));
      if (isPreObs) {
        updateRealMoonTexture(curMoon.phaseDeg);
        moonSpriteMat.map = texMoonReal; moonSpriteMat.opacity = isNight ? 0.98 : 0.62; moonSprite.scale.set(2.3, 2.3, 1);
      } else {
        moonSpriteMat.map = texMoonObs;  moonSpriteMat.opacity = isNight ? 0.92 : 0.58; moonSprite.scale.set(1.9, 1.9, 1);
      }
      moonSpriteMat.needsUpdate = true;
    } else {
      moonSprite.visible = false;
    }

    // 4. 星＆星座（全モード共通で朝昼夕は星なし・夜のみ表示）
    starGroup.visible = isNight;
    if (isNight) {
      const pArr = [], lArr = [];
      CONSTELLATIONS.forEach((con) => {
        const mapped = con.stars.map(([raH, decD]) => {
          const { alt, az } = raDecToAltAz(raH * 15, decD, curLst, state.lat);
          return { alt, vec: altAzToVec3(alt, az, SKY_R) };
        });
        mapped.forEach((st) => { if (st.alt > 0.02) pArr.push(st.vec.x, st.vec.y, st.vec.z); });
        con.lines.forEach(([a, b]) => {
          if (mapped[a] && mapped[b] && mapped[a].alt > 0.01 && mapped[b].alt > 0.01) {
            lArr.push(mapped[a].vec.x, mapped[a].vec.y, mapped[a].vec.z, mapped[b].vec.x, mapped[b].vec.y, mapped[b].vec.z);
          }
        });
      });
      starPoints.geometry.dispose();
      starPoints.geometry = new THREE.BufferGeometry();
      starPoints.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pArr, 3));
      starPointsMat.map = isAnime ? texStarPastel : texStarDigital;
      starPointsMat.color.setHex(isAnime ? 0xfffbeb : 0xe0f2fe);
      starPointsMat.size = isAnime ? 0.78 : 0.54;
      starPointsMat.needsUpdate = true;

      starLines.geometry.dispose();
      starLines.geometry = new THREE.BufferGeometry();
      starLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(lArr, 3));
      if (isAnime) { starLines.material = starLineDashMat; starLines.computeLineDistances(); starLines.visible = true; }
      else if (isPreObs) { starLines.material = starLineSolidMat; starLines.visible = true; }
      else { starLines.material = starLineSolidMat; starLines.visible = Boolean(state.obsConstLines); }
    }

    const pNames = ['朝', '昼', '夕', '夜'];
    const mNames = { anime: '通常(アニメ)', pre_obs: '観測前(リアル)', obs: '観察時(計測◯)' };
    lastStatusText = `${mNames[state.viewMode]}｜${moment.modeLabel}｜${mo + 1}/${da} ${pNames[moment.phase]}（日出${formatHM(moment.times.sunriseH)}・日入${formatHM(moment.times.sunsetH)}）｜${state.gpsApplied ? `GPS(${state.lat.toFixed(1)}°N)` : '日本標準'}`;
    syncSettingsUI();
  }

  // --- 自前GPS事前確認モーダル（OSの拒否カウントを消費しない安全設計） ---
  function openGpsConsentModal() {
    let modal = document.getElementById('sky-gps-consent-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'sky-gps-consent-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.58);display:flex;align-items:center;justify-content:center;padding:18px;';
      modal.innerHTML = `
        <div style="width:100%;max-width:320px;background:#ffffff;border-radius:16px;padding:16px;box-shadow:0 12px 32px rgba(0,0,0,0.28);text-align:left;border:2px solid #7dd3fc;">
          <div style="font-size:14px;font-weight:900;color:#0369a1;margin-bottom:8px;">📍 位置情報の利用確認</div>
          <div id="sky-gps-modal-msg" style="font-size:12px;line-height:1.6;color:#334155;margin-bottom:14px;">現在地の空（太陽・月・星座の位置）を再現するために位置情報を使いますか？<br><span style="font-size:10.5px;color:#64748b;">※「今はしない」を選んでも日本標準の空でそのまま遊べます。</span></div>
          <div style="display:flex;gap:8px;">
            <button type="button" id="sky-gps-btn-later" style="flex:1;padding:9px;border-radius:10px;border:1px solid #cbd5e1;background:#f8fafc;color:#475569;font-size:12px;font-weight:800;cursor:pointer;">今はしない</button>
            <button type="button" id="sky-gps-btn-allow" style="flex:1;padding:9px;border-radius:10px;border:none;background:#0284c7;color:#ffffff;font-size:12px;font-weight:900;cursor:pointer;">使う</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('sky-gps-btn-later').onclick = () => { modal.style.display = 'none'; };
      document.getElementById('sky-gps-btn-allow').onclick = () => { modal.style.display = 'none'; executeGpsFetch(); };
    }
    const msgEl = document.getElementById('sky-gps-modal-msg');
    if (msgEl) msgEl.innerHTML = '現在地の空（太陽・月・星座の位置）を再現するために位置情報を使いますか？<br><span style="font-size:10.5px;color:#64748b;">※「今はしない」を選んでも日本標準の空でそのまま遊べます。</span>';
    modal.style.display = 'flex';
  }

  function executeGpsFetch() {
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
      (err) => {
        if (err && err.code === 1) {
          const guide = '📍 ブラウザで位置情報がブロックされています。URL左のアイコン → 権限 → 位置情報 を「許可」にして再読み込みしてください。';
          lastStatusText = guide;
          syncSettingsUI();
          if (typeof showToast === 'function') showToast(guide);
        } else if (typeof showToast === 'function') {
          showToast('📍 位置情報を取得できなかったため日本標準(35.7°N)を使用します');
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }

  // --- 設定画面UI注入 ---
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
          <div style="font-size:11px;font-weight:800;color:#0f172a;">🌌 空・天体システム<div style="font-size:9.5px;font-weight:600;color:#64748b;">表ルール基準（旧星空は自動非表示）</div></div>
          <button type="button" id="btn-toggle-holo-sky" style="padding:5px 10px;border-radius:8px;border:none;font-size:11px;font-weight:900;cursor:pointer;"></button>
        </div>
        <div style="background:#ffffff;border:1px solid #bae6fd;border-radius:9px;padding:7px 9px;display:flex;flex-direction:column;gap:6px;">
          <div style="font-size:10.5px;font-weight:800;color:#0f172a;">🎨 空の表示モード（同じ天体位置で切替）</div>
          <div style="display:flex;gap:4px;">
            <button type="button" data-skymode="anime" style="flex:1;padding:6px 4px;border-radius:7px;border:1px solid #bae6fd;font-size:10px;font-weight:900;cursor:pointer;">通常(アニメ)</button>
            <button type="button" data-skymode="pre_obs" style="flex:1;padding:6px 4px;border-radius:7px;border:1px solid #bae6fd;font-size:10px;font-weight:900;cursor:pointer;">観測前(リアル)</button>
            <button type="button" data-skymode="obs" style="flex:1;padding:6px 4px;border-radius:7px;border:1px solid #bae6fd;font-size:10px;font-weight:900;cursor:pointer;">観察時(計測◯)</button>
          </div>
          <div id="row-obs-const-line" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:4px;border-top:1px dashed #e2e8f0;">
            <span style="font-size:10px;font-weight:800;color:#334155;">✨ 観察時の星座線（夜）</span>
            <button type="button" id="btn-toggle-obs-lines" style="padding:4px 9px;border-radius:7px;border:none;font-size:10px;font-weight:900;cursor:pointer;"></button>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:#ffffff;border:1px solid #bae6fd;border-radius:9px;padding:7px 9px;">
          <div style="font-size:11px;font-weight:800;color:#0f172a;">🕒 時刻だけを現実時刻に合わす<div style="font-size:9.5px;font-weight:600;color:#64748b;">観察時モード選択で自動ON／単独切替可</div></div>
          <button type="button" id="btn-toggle-realtime-sky" style="padding:5px 10px;border-radius:8px;border:none;font-size:11px;font-weight:900;cursor:pointer;"></button>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <button type="button" id="btn-gps-sync-sky" style="flex:1;padding:6px 8px;border-radius:8px;border:1px solid #38bdf8;background:#e0f2fe;color:#0369a1;font-size:10.5px;font-weight:900;cursor:pointer;">📍 GPSで現在地の空に合わせる</button>
          <button type="button" id="btn-gps-reset-sky" style="padding:6px 8px;border-radius:8px;border:1px solid #cbd5e1;background:#ffffff;color:#475569;font-size:10px;font-weight:800;cursor:pointer;">日本標準</button>
        </div>
        <div id="env-skytime-status" style="font-size:9.5px;font-weight:700;color:#0369a1;background:#e0f2fe;border-radius:7px;padding:5px 7px;line-height:1.45;"></div>
      `;
      panel.appendChild(box);

      document.getElementById('btn-toggle-holo-sky').onclick = () => {
        const next = !(state.skyUnlocked && state.skyVisible);
        state.skyUnlocked = next; state.skyVisible = next;
        saveState(); updateCelestialExhibit(true);
      };
      box.querySelectorAll('[data-skymode]').forEach((btn) => {
        btn.onclick = () => {
          const m = btn.getAttribute('data-skymode');
          state.viewMode = m;
          state.skyUnlocked = true; state.skyVisible = true;
          // 観察時は現実時刻へ自動連動、通常・観測前はゲーム時間へ戻す
          if (m === 'obs') { state.realtimeUnlocked = true; state.realtimeActive = true; }
          else { state.realtimeActive = false; }
          saveState(); updateCelestialExhibit(true);
        };
      });
      document.getElementById('btn-toggle-obs-lines').onclick = () => {
        state.obsConstLines = !state.obsConstLines;
        saveState(); updateCelestialExhibit(true);
      };
      document.getElementById('btn-toggle-realtime-sky').onclick = () => {
        const next = !(state.realtimeUnlocked && state.realtimeActive);
        state.realtimeUnlocked = next; state.realtimeActive = next;
        if (next) { state.skyUnlocked = true; state.skyVisible = true; }
        saveState(); updateCelestialExhibit(true);
      };
      document.getElementById('btn-gps-sync-sky').onclick = openGpsConsentModal;
      document.getElementById('btn-gps-reset-sky').onclick = () => {
        state.lat = 35.68; state.lon = 139.77; state.gpsApplied = false;
        saveState(); updateCelestialExhibit(true);
        if (typeof showToast === 'function') showToast('📍 日本標準座標(35.7°N)へ戻しました');
      };
    }

    const skyOn = Boolean(state.skyUnlocked && state.skyVisible);
    const rtOn = Boolean(state.realtimeUnlocked && state.realtimeActive);
    const bSky = document.getElementById('btn-toggle-holo-sky');
    const bRt  = document.getElementById('btn-toggle-realtime-sky');
    const bLn  = document.getElementById('btn-toggle-obs-lines');
    const rLn  = document.getElementById('row-obs-const-line');
    const stEl = document.getElementById('env-skytime-status');

    if (bSky) { bSky.innerText = skyOn ? '表示中 (ON)' : '非表示 (OFF)'; bSky.style.background = skyOn ? '#0284c7' : '#e2e8f0'; bSky.style.color = skyOn ? '#fff' : '#475569'; }
    if (bRt)  { bRt.innerText = rtOn ? '現実時刻 (ON)' : 'ゲーム連動 (OFF)'; bRt.style.background = rtOn ? '#0284c7' : '#e2e8f0'; bRt.style.color = rtOn ? '#fff' : '#475569'; }
    if (rLn)  { rLn.style.display = (state.viewMode === 'obs') ? 'flex' : 'none'; }
    if (bLn)  { bLn.innerText = state.obsConstLines ? '星座線 ON' : '星座線 OFF'; bLn.style.background = state.obsConstLines ? '#0284c7' : '#e2e8f0'; bLn.style.color = state.obsConstLines ? '#fff' : '#475569'; }
    box.querySelectorAll('[data-skymode]').forEach((btn) => {
      const sel = (btn.getAttribute('data-skymode') === state.viewMode);
      btn.style.background = sel ? '#0284c7' : '#f8fafc';
      btn.style.color = sel ? '#ffffff' : '#334155';
    });
    if (stEl) stEl.innerText = lastStatusText;
  }

  // --- 超軽量アニメーション（朝の▲ピカピカ揺れ＆旧星監視） ---
  let lastRenderFrame = -1;
  function animateSky(now) {
    if (skyRoot.visible && sunRaySprite.visible) {
      const t = now * 0.001;
      if (currentRayMode === 'morning') {
        sunRayMat.rotation = t * 0.35;
        const pulse = 1 + 0.07 * Math.sin(t * 4.2);
        sunRaySprite.scale.set(3.2 * pulse, 3.2 * pulse, 1);
        sunRayMat.opacity = 0.78 + 0.22 * Math.sin(t * 5.0);
      } else if (currentRayMode === 'noon') {
        sunRayMat.rotation = t * 0.12;
        sunRayMat.opacity = 0.44 + 0.08 * Math.sin(t * 2.0);
      }
      if (typeof renderer !== 'undefined' && renderer && renderer.info && typeof activeCamera !== 'undefined' && activeCamera) {
        const curFrame = renderer.info.render.frame;
        if (curFrame === lastRenderFrame) renderer.render(scene, activeCamera);
        lastRenderFrame = renderer.info.render.frame;
      }
    }
    requestAnimationFrame(animateSky);
  }

  if (typeof updateEnvironmentAndUI === 'function') {
    const _origUpdateEnv = updateEnvironmentAndUI;
    updateEnvironmentAndUI = function() {
      const r = _origUpdateEnv.apply(this, arguments);
      updateCelestialExhibit(false);
      return r;
    };
  }
  setInterval(() => {
    if (skyRoot.visible) syncLegacySkyObjects(true);
    updateCelestialExhibit(false);
  }, 2500);
  setTimeout(() => { updateCelestialExhibit(true); syncSettingsUI(); }, 800);
  requestAnimationFrame(animateSky);

  window.SkyTimeModule = {
    unlockSky: () => { state.skyUnlocked = true; state.skyVisible = true; saveState(); updateCelestialExhibit(true); },
    setSkyVisible: (v) => { state.skyVisible = Boolean(v); if (v) state.skyUnlocked = true; saveState(); updateCelestialExhibit(true); },
    setMode: (m) => { if (['anime','pre_obs','obs'].includes(m)) { state.viewMode = m; state.skyUnlocked = true; state.skyVisible = true; state.realtimeActive = (m === 'obs'); if (m === 'obs') state.realtimeUnlocked = true; saveState(); updateCelestialExhibit(true); } },
    setObsConstLines: (v) => { state.obsConstLines = Boolean(v); saveState(); updateCelestialExhibit(true); },
    unlockRealtime: () => { state.realtimeUnlocked = true; state.realtimeActive = true; state.skyUnlocked = true; state.skyVisible = true; saveState(); updateCelestialExhibit(true); },
    setRealtime: (v) => { state.realtimeActive = Boolean(v); if (v) { state.realtimeUnlocked = true; state.skyUnlocked = true; state.skyVisible = true; } saveState(); updateCelestialExhibit(true); },
    requestGPS: openGpsConsentModal,
    getPhaseIndex: () => resolveEffectiveSkyMoment().phase,
    refresh: () => updateCelestialExhibit(true)
  };

  if (window.DebugGuard) window.DebugGuard.markLoaded('sky_time.js');
})();
