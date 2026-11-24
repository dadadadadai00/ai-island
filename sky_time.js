// ============================================================================
// 【独立ビジュアルモジュール：sky_time.js】
// ・二重球体スクリーン（通常アニメ朝昼夕は空ドーム非表示／夜・観測はドーム表示）
// ・1層2層目から地下非表示／観察時は地上透過＋余裕視野／360°観測ボタン切替
// ・夜のキャラ視点カメラ限定で●星星座＋中央捕捉でピロン枠＆タイプライター演出
// ============================================================================
(function initSkyTimeModule() {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined') return;

  const STORAGE_KEY = 'island_sky_time_v5';
  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;
  const SKY_R = 16.5;
  const INNER_DOME_R = 20.5;
  const STAR_R = 22.0;
  const OUTER_DOME_R = 25.0;

  const state = {
    skyUnlocked: false,
    skyVisible: false,
    viewMode: 'anime',    // 'anime' | 'pre_obs' | 'obs'
    previewPhase: 'auto', // 'auto' | 0(朝) | 1(昼) | 2(夕) | 3(夜) | 4(深夜)
    obsConstLines: true,
    full360Mode: false,   // 観察時専用の360°全天観測モード
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
      state.full360Mode = false; // 起動時は必ず地上表示から開始
    } catch (e) {}
  }
  function saveState() {
    try {
      const store = (typeof safeStorage !== 'undefined') ? safeStorage : window.localStorage;
      if (store) {
        const toSave = Object.assign({}, state, { full360Mode: false });
        store.setItem(STORAGE_KEY, JSON.stringify(toSave));
      }
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

  // --- 天文計算 ---
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
    if (h < times.sunriseH) realPhase = 4;
    else if (h < 10.5) realPhase = 0;
    else if (h < times.sunsetH - 1.5) realPhase = 1;
    else if (h < times.sunsetH + 0.75) realPhase = 2;
    else realPhase = 3;

    const skyDayBase = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    if (h < times.sunriseH) skyDayBase.setDate(skyDayBase.getDate() - 1);
    return { realPhase, skyDayBase, times, nowH: h };
  }

  function resolveEffectiveSkyMoment() {
    const now = new Date();
    const { realPhase, skyDayBase, times, nowH } = getRealTimeInfo(now);
    const isPreview = (state.previewPhase !== 'auto' && Number.isInteger(Number(state.previewPhase)));

    if (!isPreview && state.realtimeUnlocked && state.realtimeActive) {
      let moonMood = 'calm';
      if (realPhase === 3 && nowH < 22.0) moonMood = 'energetic';
      else if (realPhase === 4 && nowH >= 2.0) moonMood = 'sleepy';
      return { date: now, phase: realPhase, times, modeLabel: '現実リアルタイム', moonMood, isRealtime: true };
    }

    let targetPhase;
    if (isPreview) {
      targetPhase = Math.max(0, Math.min(4, Number(state.previewPhase)));
    } else {
      const rawTs = (typeof TIME_STEP !== 'undefined' && Number.isFinite(Number(TIME_STEP))) ? Math.floor(Number(TIME_STEP)) : 0;
      const app4 = ((rawTs % 4) + 4) % 4;
      targetPhase = (app4 === 3 && realPhase === 4) ? 4 : app4;
    }

    const refBase = new Date(skyDayBase.getTime());
    if (!isPreview && Math.min(3, targetPhase) < Math.min(3, realPhase)) {
      refBase.setDate(refBase.getDate() + 1);
    }
    const refTimes = calcSunriseSunsetLocal(refBase, state.lat, state.lon);

    let refDate;
    let moonMood = 'calm';
    if (targetPhase === 0) {
      const th = refTimes.sunriseH + 0.55;
      refDate = new Date(refBase.getFullYear(), refBase.getMonth(), refBase.getDate(), Math.floor(th), Math.floor((th % 1) * 60), 0);
    } else if (targetPhase === 1) {
      const th = refTimes.solarNoonH;
      refDate = new Date(refBase.getFullYear(), refBase.getMonth(), refBase.getDate(), Math.floor(th), Math.floor((th % 1) * 60), 0);
    } else if (targetPhase === 2) {
      const th = refTimes.sunsetH - 0.55;
      refDate = new Date(refBase.getFullYear(), refBase.getMonth(), refBase.getDate(), Math.floor(th), Math.floor((th % 1) * 60), 0);
    } else if (targetPhase === 3) {
      refDate = new Date(refBase.getFullYear(), refBase.getMonth(), refBase.getDate(), 20, 30, 0);
      moonMood = 'energetic';
    } else {
      const nextDay = new Date(refBase.getTime());
      nextDay.setDate(nextDay.getDate() + 1);
      refDate = new Date(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate(), 2, 30, 0);
      moonMood = 'sleepy';
    }

    return { date: refDate, phase: targetPhase, times: refTimes, modeLabel: isPreview ? '時間帯プレビュー' : 'ゲーム昼夜×現実空', moonMood, isRealtime: false };
  }

  // --- カメラ種別判定（追従・地上・地下を除外し、キャラ視点カメラのみ true） ---
  function detectCameraKind() {
    let txt = '';
    const els = document.querySelectorAll('div, span, button');
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (el.children.length > 0) continue;
      const t = (el.textContent || '').trim();
      if (t.length > 0 && t.length <= 42 && (t.includes('カメラ') || t.includes('視点') || t.includes('追従'))) {
        txt += ' ' + t;
      }
    }
    if (txt.includes('地下')) return 'underground';
    if (txt.includes('追従')) return 'follow';
    if (txt.includes('外カメラ') || txt.includes('地上')) return 'ground';
    if (txt.includes('視点') || txt.includes('キャラ') || txt.includes('一人称')) return 'char';
    if (typeof cameraMode !== 'undefined') {
      const cm = String(cameraMode).toLowerCase();
      if (cm.includes('under')) return 'underground';
      if (cm.includes('follow')) return 'follow';
      if (cm.includes('fpv') || cm.includes('char') || cm.includes('eye') || cm.includes('first')) return 'char';
    }
    return 'ground';
  }

  // --- テクスチャ生成 ---
  function makeCanvasTex(w, h, drawFn) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    drawFn(cv.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    return tex;
  }

  const texOuterSpace = makeCanvasTex(1024, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.00, '#020617');
    g.addColorStop(0.45, '#07122a');
    g.addColorStop(0.55, '#0c1b3a');
    g.addColorStop(1.00, '#020617');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    let seed = 1337;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < 240; i++) {
      const x = rand() * w;
      const y = rand() * (h * 0.65);
      const r = 0.6 + rand() * 1.4;
      const a = 0.25 + rand() * 0.65;
      ctx.fillStyle = `rgba(224, 242, 254, ${a.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  });

  const SKY_PALETTES = {
    anime: [
      { stops: [[0,'#7dd3fc'],[0.34,'#bae6fd'],[0.49,'#fde68a'],[0.54,'#fbcfe8'],[1,'#bae6fd']], op: 1.00 },
      { stops: [[0,'#38bdf8'],[0.32,'#7dd3fc'],[0.50,'#e0f2fe'],[0.56,'#bae6fd'],[1,'#7dd3fc']], op: 1.00 },
      { stops: [[0,'#818cf8'],[0.28,'#f472b6'],[0.48,'#fdba74'],[0.55,'#fde68a'],[1,'#c4b5fd']], op: 1.00 },
      { stops: [[0,'#1e1b4b'],[0.35,'#312e81'],[0.52,'#4c1d95'],[1,'#1e1b4b']], op: 0.46 },
      { stops: [[0,'#090d24'],[0.38,'#11183c'],[0.54,'#1e2959'],[1,'#090d24']], op: 0.20 }
    ],
    real: [
      { stops: [[0,'#1e4e79'],[0.32,'#4b86b4'],[0.48,'#d4a987'],[0.54,'#94a3b8'],[1,'#334155']], op: 1.00 },
      { stops: [[0,'#1e4f91'],[0.32,'#5a93c7'],[0.50,'#cbd5e1'],[0.56,'#94a3b8'],[1,'#475569']], op: 1.00 },
      { stops: [[0,'#1e293b'],[0.28,'#644a66'],[0.48,'#c27856'],[0.55,'#7c4a46'],[1,'#1e293b']], op: 1.00 },
      { stops: [[0,'#081226'],[0.36,'#0f2242'],[0.52,'#1e3a5f'],[1,'#081226']], op: 0.42 },
      { stops: [[0,'#020617'],[0.38,'#071024'],[0.54,'#0f172a'],[1,'#020617']], op: 0.16 }
    ]
  };
  const skyDomeTexCache = {};
  function getSkyDomeStyle(isAnime, phase) {
    const style = isAnime ? 'anime' : 'real';
    const p = Math.max(0, Math.min(4, phase));
    const key = `${style}_${p}`;
    const def = SKY_PALETTES[style][p];
    if (!skyDomeTexCache[key]) {
      skyDomeTexCache[key] = makeCanvasTex(32, 256, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        def.stops.forEach(([pos, col]) => g.addColorStop(pos, col));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });
    }
    return { tex: skyDomeTexCache[key], opacity: def.op };
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
      ctx.lineWidth = 4.6;
      eyes.forEach(([ex, ey]) => { ctx.beginPath(); ctx.arc(ex, ey - 2, 7.5, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke(); });
      ctx.lineWidth = 4.0;
      ctx.beginPath(); ctx.ellipse(cx, cy + 12, isProfile ? 5 : 6.5, 5, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  const texSunRays = makeCanvasTex(256, 256, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#fdba74';
    for (let i = 0; i < 12; i++) {
      ctx.save(); ctx.translate(c, c); ctx.rotate((i / 12) * Math.PI * 2);
      ctx.beginPath(); ctx.moveTo(-12, -74); ctx.lineTo(12, -74); ctx.lineTo(0, -118); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  });

  const texSunAnime = {};
  ['energetic', 'calm', 'sleepy'].forEach((mood) => {
    texSunAnime[mood] = makeCanvasTex(256, 256, (ctx, s) => {
      const c = s / 2;
      const g = ctx.createRadialGradient(c, c, 46, c, c, 120);
      g.addColorStop(0, mood === 'sleepy' ? 'rgba(251,146,60,0.55)' : 'rgba(255,198,128,0.58)');
      g.addColorStop(1, 'rgba(255,198,128,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, 120, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mood === 'sleepy' ? '#fb923c' : '#f97316';
      ctx.beginPath(); ctx.arc(c, c, 70, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mood === 'sleepy' ? '#fdba74' : '#fed7aa';
      ctx.beginPath(); ctx.arc(c - 7, c - 7, 58, 0, Math.PI * 2); ctx.fill();
      drawCuteFace(ctx, c, c, mood, '#7c2d12', 'rgba(251,113,133,0.52)', false);
    });
  });

  const texMoonAnime = {};
  ['full', 'crescent'].forEach((shape) => {
    texMoonAnime[shape] = {};
    ['energetic', 'calm', 'sleepy'].forEach((mood) => {
      texMoonAnime[shape][mood] = makeCanvasTex(256, 256, (ctx, s) => {
        const c = s / 2;
        const g = ctx.createRadialGradient(c, c, 44, c, c, 118);
        g.addColorStop(0, 'rgba(254,240,138,0.48)'); g.addColorStop(1, 'rgba(254,240,138,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, 118, 0, Math.PI * 2); ctx.fill();
        if (shape === 'full') {
          ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(c, c, 68, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(c - 6, c - 6, 56, 0, Math.PI * 2); ctx.fill();
          drawCuteFace(ctx, c, c, mood, '#713f12', 'rgba(251,146,60,0.34)', false);
        } else {
          const off = document.createElement('canvas'); off.width = s; off.height = s;
          const octx = off.getContext('2d');
          octx.fillStyle = '#fde047'; octx.beginPath(); octx.arc(c, c, 70, 0, Math.PI * 2); octx.fill();
          octx.globalCompositeOperation = 'destination-out';
          octx.beginPath(); octx.arc(c + 34, c - 14, 58, 0, Math.PI * 2); octx.fill();
          ctx.drawImage(off, 0, 0);
          drawCuteFace(ctx, c - 22, c + 2, mood, '#713f12', 'rgba(251,146,60,0.34)', true);
        }
      });
    });
  });

  const texSunReal = makeCanvasTex(256, 256, (ctx, s) => {
    const c = s / 2, g = ctx.createRadialGradient(c, c, 14, c, c, 124);
    g.addColorStop(0, 'rgba(255,255,250,1)'); g.addColorStop(0.28, 'rgba(255,244,214,0.96)');
    g.addColorStop(0.46, 'rgba(253,224,150,0.48)'); g.addColorStop(0.75, 'rgba(186,230,253,0.14)'); g.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });

  const moonRealCanvas = document.createElement('canvas');
  moonRealCanvas.width = 256; moonRealCanvas.height = 256;
  const texMoonReal = new THREE.CanvasTexture(moonRealCanvas);
  let lastMoonBucket = -1;
  function updateRealMoonTexture(phaseDeg) {
    const b = Math.round(phaseDeg / 6);
    if (b === lastMoonBucket) return;
    lastMoonBucket = b;
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
    return makeCanvasTex(256, 256, (ctx, s) => {
      const c = s / 2;
      ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(c, c, 82, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = stroke; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(c, c, 82, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c, c, 102, 0, Math.PI * 2); ctx.stroke();
    });
  }
  const texSunObs  = createMeasureTex('rgba(250, 204, 21, 0.36)', 'rgba(253, 224, 71, 0.88)');
  const texMoonObs = createMeasureTex('rgba(255, 255, 255, 0.34)', 'rgba(241, 245, 249, 0.90)');

  // 星座の星は必ず●型（丸い発光ドット）
  const texStarCircleDigital = makeCanvasTex(64, 64, (ctx, s) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.32, 'rgba(224,242,254,0.95)');
    g.addColorStop(0.62, 'rgba(56,189,248,0.45)');
    g.addColorStop(1.0, 'rgba(56,189,248,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
  });
  const texStarCirclePastel = makeCanvasTex(64, 64, (ctx, s) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0.0, 'rgba(255,251,235,1)');
    g.addColorStop(0.36, 'rgba(254,240,138,0.92)');
    g.addColorStop(0.68, 'rgba(249,168,212,0.42)');
    g.addColorStop(1.0, 'rgba(249,168,212,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
  });

  // --- 3D二重球体スクリーン＋天体グループ ---
  const skyRoot = new THREE.Group();
  skyRoot.name = 'holo_sky_exhibit_root';
  skyRoot.visible = false;
  scene.add(skyRoot);

  const outerSpaceMat = new THREE.MeshBasicMaterial({ map: texOuterSpace, side: THREE.BackSide, depthWrite: false });
  const outerSpaceDome = new THREE.Mesh(new THREE.SphereGeometry(OUTER_DOME_R, 36, 24), outerSpaceMat);
  outerSpaceDome.renderOrder = -20;
  skyRoot.add(outerSpaceDome);

  // キャラ視点限定の星座グループ（●星＋線）
  const starGroup = new THREE.Group();
  const starPointsMat = new THREE.PointsMaterial({ map: texStarCircleDigital, color: 0xe0f2fe, size: 1.15, transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending, depthWrite: false });
  const starLineSolidMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.52, blending: THREE.AdditiveBlending, depthWrite: false });
  const starLineDashMat  = new THREE.LineDashedMaterial({ color: 0xf9a8d4, dashSize: 0.75, gapSize: 0.42, transparent: true, opacity: 0.72, depthWrite: false });
  const starPoints = new THREE.Points(new THREE.BufferGeometry(), starPointsMat);
  const starLines  = new THREE.LineSegments(new THREE.BufferGeometry(), starLineSolidMat);
  starPoints.renderOrder = -15;
  starLines.renderOrder = -16;
  starGroup.add(starLines, starPoints);
  skyRoot.add(starGroup);

  const innerSkyMat = new THREE.MeshBasicMaterial({ map: getSkyDomeStyle(true, 0).tex, side: THREE.BackSide, transparent: true, opacity: 1.0, depthWrite: false });
  const innerSkyDome = new THREE.Mesh(new THREE.SphereGeometry(INNER_DOME_R, 36, 24), innerSkyMat);
  innerSkyDome.renderOrder = -10;
  skyRoot.add(innerSkyDome);

  const sunOrbitMat  = new THREE.LineBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.50, depthWrite: false });
  const moonOrbitMat = new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.36, depthWrite: false });
  const sunOrbitLine  = new THREE.Line(new THREE.BufferGeometry(), sunOrbitMat);
  const moonOrbitLine = new THREE.Line(new THREE.BufferGeometry(), moonOrbitMat);
  sunOrbitLine.renderOrder = -6;
  moonOrbitLine.renderOrder = -6;
  skyRoot.add(sunOrbitLine, moonOrbitLine);

  const sunRayMat     = new THREE.SpriteMaterial({ map: texSunRays, transparent: true, opacity: 0.9, depthWrite: false });
  const sunSpriteMat  = new THREE.SpriteMaterial({ map: texSunAnime.energetic, transparent: true, depthWrite: false });
  const moonSpriteMat = new THREE.SpriteMaterial({ map: texMoonAnime.full.energetic, transparent: true, depthWrite: false });
  const sunRaySprite  = new THREE.Sprite(sunRayMat);
  const sunSprite     = new THREE.Sprite(sunSpriteMat);
  const moonSprite    = new THREE.Sprite(moonSpriteMat);
  sunRaySprite.renderOrder = -4;
  sunSprite.renderOrder = -3;
  moonSprite.renderOrder = -3;
  skyRoot.add(sunRaySprite, sunSprite, moonSprite);

  // --- 地上物・地下層・海・旧星座の状態管理＆AI撮影保護 ---
  const hiddenLegacy3D = new Map();
  const hiddenLegacyDOM = new Map();
  const modifiedWorldObjs = new Map(); // obj -> { vis, matStates: Map(mat -> { transparent, opacity }) }
  const CONST_KW = ['オリオン座', '北斗七星', 'カシオペア', '夏の大三角', 'さそり座', 'こぐま座'];

  function isOwnObject(obj) {
    let cur = obj;
    while (cur) {
      if (cur === skyRoot || (cur.name && cur.name.startsWith('holo_'))) return true;
      cur = cur.parent;
    }
    return false;
  }

  function restoreWorldObjects() {
    modifiedWorldObjs.forEach((rec, obj) => {
      try {
        obj.visible = rec.vis;
        rec.matStates.forEach((ms, mat) => {
          mat.transparent = ms.transparent;
          mat.opacity = ms.opacity;
          mat.needsUpdate = true;
        });
      } catch (e) {}
    });
    modifiedWorldObjs.clear();
  }

  function applyWorldVisibilityAndTransparency(active, camKind) {
    restoreWorldObjects();
    if (!active) return;

    const isObs = (state.viewMode === 'obs');
    const isFull360 = Boolean(isObs && camKind === 'char' && state.full360Mode);
    const hideUnderground = (camKind !== 'underground');

    scene.traverse((obj) => {
      if (!obj || !obj.isMesh || isOwnObject(obj)) return;
      try {
        obj.updateWorldMatrix(true, false);
        const box = new THREE.Box3().setFromObject(obj);
        if (!Number.isFinite(box.max.y)) return;
        const size = new THREE.Vector3();
        box.getSize(size);
        const isSea = (typeof seaMesh !== 'undefined' && obj === seaMesh) || (Math.max(size.x, size.z) >= 8.5 && size.y <= 3.0);
        // 1層・2層目以下の地下ブロック判定（天面が地表面より下）
        const isUndergroundLayer = !isSea && (box.max.y <= -0.05);

        let targetVis = obj.visible;
        let targetOpacity = null;

        if (isFull360) {
          // 観察時360°ボタンON：地上物・海・地下をすべて一時非表示
          targetVis = false;
        } else {
          if (hideUnderground && isUndergroundLayer) {
            targetVis = false;
          } else if (isObs && (isSea || box.max.y <= 2.6)) {
            // 観察時（通常）：地表(0層)・海を半透明（透過）にする
            targetOpacity = isSea ? 0.34 : 0.38;
          }
        }

        if (targetVis !== obj.visible || targetOpacity !== null) {
          const matStates = new Map();
          const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
          mats.forEach((m) => {
            matStates.set(m, { transparent: m.transparent, opacity: m.opacity });
            if (targetOpacity !== null) {
              m.transparent = true;
              m.opacity = targetOpacity;
              m.needsUpdate = true;
            }
          });
          modifiedWorldObjs.set(obj, { vis: obj.visible, matStates });
          obj.visible = targetVis;
        }
      } catch (e) {}
    });

    if (window.CompassRingModule && typeof window.CompassRingModule.setExternalHide === 'function') {
      window.CompassRingModule.setExternalHide(isFull360);
    }
  }

  function syncLegacySkyObjects(shouldHide) {
    if (shouldHide) {
      scene.traverse((obj) => {
        if (!obj || isOwnObject(obj) || !obj.visible) return;
        const nm = (obj.name || '').toLowerCase();
        let hide = nm.includes('star') || nm.includes('constell') || nm.includes('orion') || nm.includes('zodiac');
        if (!hide && obj.isPoints && obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position) {
          if (obj.geometry.attributes.position.count >= 12) {
            obj.geometry.computeBoundingSphere();
            if (obj.geometry.boundingSphere && obj.geometry.boundingSphere.radius > 7.5) hide = true;
          }
        }
        if (!hide && (obj.isLine || obj.isLineSegments || obj.isMesh)) {
          const wp = new THREE.Vector3();
          obj.getWorldPosition(wp);
          if (wp.length() > 9.0 && wp.y > 1.2) {
            if (obj.isLine || obj.isLineSegments) hide = true;
            else if (obj.material && obj.material.color) {
              const col = obj.material.color;
              if (col.r > 0.82 && col.g > 0.70 && col.b < 0.52) hide = true;
            }
          }
        }
        if (hide) { hiddenLegacy3D.set(obj, true); obj.visible = false; }
      });

      document.querySelectorAll('div, span').forEach((el) => {
        if (!el || el.children.length > 0 || el.id === 'env-skytime-status' || el.id === 'sky-const-typewriter-text') return;
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

  // --- AI解析用画像キャプチャの保護（地上物を一時復帰して自然な水平画像を渡す） ---
  function installAiCameraGuard() {
    const fnNames = ['captureAiCameraImage', 'captureFirstPersonImage', 'captureRobotEye', 'getRobotCameraBase64'];
    fnNames.forEach((fn) => {
      if (typeof window[fn] === 'function' && !window[fn]._skyGuarded) {
        const orig = window[fn];
        window[fn] = function() {
          const wasActive = skyRoot.visible;
          const savedMap = new Map();
          if (wasActive) {
            modifiedWorldObjs.forEach((rec, obj) => {
              savedMap.set(obj, obj.visible);
              obj.visible = rec.vis;
            });
            starGroup.visible = false;
          }
          try {
            return orig.apply(this, arguments);
          } finally {
            if (wasActive) {
              savedMap.forEach((v, obj) => { obj.visible = v; });
              updateCelestialExhibit(true);
            }
          }
        };
        window[fn]._skyGuarded = true;
      }
    });
  }

  // --- 視野角・回転制限の適用（180° / 観察時210° / 360°フル） ---
  function applyCameraAngleLimits(camKind) {
    if (typeof controls === 'undefined' || !controls) return;
    try {
      if (camKind === 'char' && state.skyUnlocked && state.skyVisible && state.viewMode === 'obs') {
        controls.maxPolarAngle = state.full360Mode ? Math.PI * 0.99 : Math.PI * 0.60;
        controls.minPolarAngle = 0.02;
      } else if (camKind === 'char' && state.skyUnlocked && state.skyVisible) {
        controls.maxPolarAngle = Math.PI * 0.52;
        controls.minPolarAngle = 0.02;
      }
    } catch (e) {}
  }

  // --- 中央からピロンと広がり、左からタイプライティングする星座名HUD ---
  let activeConstName = '';
  let typeTimer = null;

  function ensureConstellationHud() {
    let wrap = document.getElementById('sky-constellation-hud');
    if (wrap) return wrap;
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      @keyframes skyPironExpand {
        0%   { transform: scaleX(0.05) scaleY(0.75); opacity: 0; }
        68%  { transform: scaleX(1.06) scaleY(1.03); opacity: 1; }
        100% { transform: scaleX(1.00) scaleY(1.00); opacity: 1; }
      }
      .sky-piron-box {
        transform-origin: center center;
        animation: skyPironExpand 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
    `;
    document.head.appendChild(styleTag);

    wrap = document.createElement('div');
    wrap.id = 'sky-constellation-hud';
    wrap.style.cssText = 'position:fixed;left:50%;bottom:215px;transform:translateX(-50%);z-index:8800;pointer-events:none;display:none;align-items:center;justify-content:center;';
    wrap.innerHTML = `
      <div id="sky-const-frame" style="min-width:148px;padding:7px 18px;border-radius:10px;background:rgba(8,24,48,0.82);border:1.5px solid #38bdf8;box-shadow:0 0 18px rgba(56,189,248,0.45),inset 0 0 10px rgba(125,211,252,0.22);backdrop-filter:blur(4px);text-align:left;">
        <div style="font-size:8.5px;font-weight:800;letter-spacing:0.12em;color:#7dd3fc;margin-bottom:1px;">✦ CONSTELLATION</div>
        <div id="sky-const-typewriter-text" style="font-size:15px;font-weight:900;letter-spacing:0.08em;color:#f0f9ff;min-height:21px;white-space:nowrap;"></div>
      </div>
    `;
    document.body.appendChild(wrap);
    return wrap;
  }

  function showConstellationHud(name) {
    const wrap = ensureConstellationHud();
    if (!name) {
      if (activeConstName) {
        activeConstName = '';
        if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
        wrap.style.display = 'none';
      }
      return;
    }
    if (name === activeConstName) return;
    activeConstName = name;
    if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }

    const frame = document.getElementById('sky-const-frame');
    const txtEl = document.getElementById('sky-const-typewriter-text');
    wrap.style.display = 'flex';
    if (frame) {
      frame.classList.remove('sky-piron-box');
      void frame.offsetWidth;
      frame.classList.add('sky-piron-box');
    }
    if (txtEl) {
      txtEl.textContent = '';
      let idx = 0;
      typeTimer = setInterval(() => {
        idx++;
        txtEl.textContent = name.slice(0, idx);
        if (idx >= name.length) {
          clearInterval(typeTimer);
          typeTimer = null;
        }
      }, 65);
    }
  }

  // --- 観察時（キャラ視点）専用の「360°観測」フローティング切替ボタン ---
  function syncFloating360Button(showBtn) {
    let btn = document.getElementById('btn-sky-360-toggle');
    if (!showBtn) {
      if (btn) btn.style.display = 'none';
      return;
    }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'btn-sky-360-toggle';
      btn.type = 'button';
      btn.style.cssText = 'position:fixed;right:14px;bottom:215px;z-index:8810;padding:8px 12px;border-radius:999px;border:1.5px solid #38bdf8;font-size:11px;font-weight:900;box-shadow:0 4px 14px rgba(2,132,199,0.35);cursor:pointer;';
      btn.onclick = () => {
        state.full360Mode = !state.full360Mode;
        updateCelestialExhibit(true);
        if (typeof showToast === 'function') {
          showToast(state.full360Mode ? '🔭 360°全天観測モード（地上・コンパス一時非表示）' : '🏝️ 通常観察（地上透過・コンパス表示）へ戻しました');
        }
      };
      document.body.appendChild(btn);
    }
    btn.style.display = 'block';
    btn.textContent = state.full360Mode ? '🏝️ 地上戻す(360°中)' : '🔭 360°全天観測';
    btn.style.background = state.full360Mode ? '#0284c7' : 'rgba(15,23,42,0.84)';
    btn.style.color = '#ffffff';
  }

  // --- 視線中央に入った星座の判定（夜のキャラ視点カメラのみ） ---
  let constellationCenters = [];
  const tmpCamDir = new THREE.Vector3();
  const tmpToStar = new THREE.Vector3();

  function updateFocusedConstellation(canShowConst) {
    if (!canShowConst || typeof activeCamera === 'undefined' || !activeCamera || constellationCenters.length === 0) {
      showConstellationHud('');
      return;
    }
    activeCamera.getWorldDirection(tmpCamDir);
    let bestName = '';
    let bestDot = Math.cos(16 * RAD); // 画面中央16度以内

    for (let i = 0; i < constellationCenters.length; i++) {
      const item = constellationCenters[i];
      tmpToStar.copy(item.center).sub(activeCamera.position).normalize();
      const d = tmpCamDir.dot(tmpToStar);
      if (d > bestDot) {
        bestDot = d;
        bestName = item.name;
      }
    }
    showConstellationHud(bestName);
  }

  // --- メイン更新処理 ---
  let lastCalcKey = '';
  let lastStatusText = '非表示';
  let currentRayMode = 'off';
  let lastCamKind = '';

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
    const camKind = detectCameraKind();

    // キャラ視点以外へ移ったら360°全非表示は自動解除
    if (camKind !== 'char' && state.full360Mode) {
      state.full360Mode = false;
    }

    skyRoot.visible = active;
    syncLegacySkyObjects(active);
    installAiCameraGuard();

    if (!active) {
      currentRayMode = 'off';
      restoreWorldObjects();
      if (window.CompassRingModule && typeof window.CompassRingModule.setExternalHide === 'function') {
        window.CompassRingModule.setExternalHide(false);
      }
      showConstellationHud('');
      syncFloating360Button(false);
      lastStatusText = '非表示';
      syncSettingsUI();
      return;
    }

    if (typeof activeCamera !== 'undefined' && activeCamera && activeCamera.far < 90) {
      activeCamera.far = 120;
      activeCamera.updateProjectionMatrix();
    }

    const moment = resolveEffectiveSkyMoment();
    const isNight = (moment.phase >= 3);
    const isAnime = (state.viewMode === 'anime');
    const isPreObs = (state.viewMode === 'pre_obs');
    const isObs = (state.viewMode === 'obs');
    // 星座は「夜・深夜」かつ「キャラ視点カメラ」のときだけ表示（追従・地上・地下は非表示）
    const canShowConst = Boolean(isNight && camKind === 'char');

    // 観察時（キャラ視点）のときだけ360°観測ボタンを表示
    syncFloating360Button(Boolean(isObs && camKind === 'char'));

    const key = `${state.viewMode}-${state.previewPhase}-${state.obsConstLines}-${state.full360Mode}-${camKind}-${moment.isRealtime}-${moment.moonMood}-${moment.date.getFullYear()}-${moment.date.getMonth()}-${moment.date.getDate()}-${moment.date.getHours()}-${Math.floor(moment.date.getMinutes() / 2)}-${moment.phase}-${state.lat.toFixed(2)}-${state.lon.toFixed(2)}`;
    if (!force && key === lastCalcKey && camKind === lastCamKind) {
      updateFocusedConstellation(canShowConst);
      return;
    }
    lastCalcKey = key;
    lastCamKind = camKind;

    // 地上透過・地下非表示・視野角の適用
    applyWorldVisibilityAndTransparency(active, camKind);
    applyCameraAngleLimits(camKind);

    const y = moment.date.getFullYear(), mo = moment.date.getMonth(), da = moment.date.getDate();
    const curLst = norm360(getGMSTDeg(moment.date) + state.lon);
    const curSun = getSunInfo(moment.date);
    const curMoon = getMoonInfo(moment.date);
    const sunPos = raDecToAltAz(curSun.raDeg, curSun.decDeg, curLst, state.lat);
    const moonPos = raDecToAltAz(curMoon.raDeg, curMoon.decDeg, curLst, state.lat);

    // 0. 空ドーム制御：通常(アニメ)の朝・昼・夕はアニメ空球体を非表示にする
    if (isAnime && !isNight) {
      innerSkyDome.visible = false;
      outerSpaceDome.visible = false;
    } else {
      const domeStyle = getSkyDomeStyle(isAnime, moment.phase);
      innerSkyDome.visible = true;
      innerSkyMat.map = domeStyle.tex;
      innerSkyMat.opacity = domeStyle.opacity;
      innerSkyMat.needsUpdate = true;
      outerSpaceDome.visible = isNight;
    }

    // 1. 軌道線（通常アニメなし／観測前・観察時は太陽＆月あり）
    if (isAnime) {
      sunOrbitLine.visible = false; moonOrbitLine.visible = false;
    } else {
      const sPts = buildBodyOrbitPoints(y, mo, da, getSunInfo, SKY_R - 0.6);
      sunOrbitLine.geometry.dispose();
      sunOrbitLine.geometry = new THREE.BufferGeometry().setFromPoints(sPts);
      sunOrbitLine.visible = (sPts.length >= 2) && !isNight;
      sunOrbitMat.opacity = (moment.phase === 1) ? 0.36 : 0.52;

      const mPts = buildBodyOrbitPoints(y, mo, da, getMoonInfo, SKY_R - 0.9);
      moonOrbitLine.geometry.dispose();
      moonOrbitLine.geometry = new THREE.BufferGeometry().setFromPoints(mPts);
      moonOrbitLine.visible = (mPts.length >= 2);
      moonOrbitMat.opacity = isNight ? 0.44 : 0.24;
    }

    // 2. 太陽配置＆表情
    currentRayMode = 'off';
    if (!isNight && sunPos.alt > -0.04) {
      const sVec = altAzToVec3(Math.max(0.05, sunPos.alt), sunPos.az, SKY_R - 0.6);
      const horizonFade = Math.min(1, Math.max(0.55, (sunPos.alt + 0.04) / 0.16));
      sunSprite.visible = true;
      sunSprite.position.copy(sVec);

      if (isAnime) {
        const sunMood = moment.phase === 0 ? 'energetic' : (moment.phase === 1 ? 'calm' : 'sleepy');
        sunSpriteMat.map = texSunAnime[sunMood];
        sunSpriteMat.opacity = horizonFade;
        sunSprite.scale.set(2.6, 2.6, 1);
        sunRaySprite.position.copy(sVec).multiplyScalar(1.008);
        if (moment.phase === 0) {
          currentRayMode = 'morning'; sunRaySprite.visible = true; sunRaySprite.scale.set(3.25, 3.25, 1); sunRayMat.opacity = 0.95;
        } else if (moment.phase === 1) {
          currentRayMode = 'noon'; sunRaySprite.visible = true; sunRaySprite.scale.set(2.75, 2.75, 1); sunRayMat.opacity = 0.48;
        } else {
          sunRaySprite.visible = false;
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

    // 3. 月配置＆表情
    if (isAnime) {
      if (isNight) {
        const shape = (curMoon.illum <= 0.55) ? 'crescent' : 'full';
        moonSprite.visible = true;
        moonSpriteMat.map = texMoonAnime[shape][moment.moonMood] || texMoonAnime[shape].calm;
        moonSpriteMat.opacity = moment.moonMood === 'sleepy' ? 0.88 : 1.0;
        moonSpriteMat.needsUpdate = true;
        moonSprite.scale.set(2.5, 2.5, 1);
        if (moonPos.alt > 0.08) moonSprite.position.copy(altAzToVec3(moonPos.alt, moonPos.az, SKY_R - 0.8));
        else moonSprite.position.copy(altAzToVec3(0.42, 215 * RAD, SKY_R - 0.8));
      } else {
        moonSprite.visible = false;
      }
    } else if (moonPos.alt > -0.02) {
      moonSprite.visible = true;
      moonSprite.position.copy(altAzToVec3(Math.max(0.04, moonPos.alt), moonPos.az, SKY_R - 0.9));
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

    // 4. 星座（夜のキャラ視点カメラのみ表示・●星＋距離感調整）
    starGroup.visible = canShowConst;
    constellationCenters = [];
    if (canShowConst) {
      const pArr = [], lArr = [];
      const minAlt = state.full360Mode ? -1.4 : 0.03;
      CONSTELLATIONS.forEach((con) => {
        const mapped = con.stars.map(([raH, decD]) => {
          const { alt, az } = raDecToAltAz(raH * 15, decD, curLst, state.lat);
          return { alt, vec: altAzToVec3(alt, az, STAR_R) };
        });
        const visibleStars = mapped.filter((st) => st.alt > minAlt);
        visibleStars.forEach((st) => pArr.push(st.vec.x, st.vec.y, st.vec.z));

        if (visibleStars.length >= 2) {
          const center = new THREE.Vector3();
          visibleStars.forEach((st) => center.add(st.vec));
          center.divideScalar(visibleStars.length);
          constellationCenters.push({ name: con.name, center });
        }

        con.lines.forEach(([a, b]) => {
          if (mapped[a] && mapped[b] && mapped[a].alt > minAlt && mapped[b].alt > minAlt) {
            lArr.push(mapped[a].vec.x, mapped[a].vec.y, mapped[a].vec.z, mapped[b].vec.x, mapped[b].vec.y, mapped[b].vec.z);
          }
        });
      });

      starPoints.geometry.dispose();
      starPoints.geometry = new THREE.BufferGeometry();
      starPoints.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pArr, 3));
      starPointsMat.map = isAnime ? texStarCirclePastel : texStarCircleDigital;
      starPointsMat.color.setHex(isAnime ? 0xfffbeb : 0xe0f2fe);
      starPointsMat.size = isAnime ? 1.32 : 1.08;
      starPointsMat.needsUpdate = true;

      starLines.geometry.dispose();
      starLines.geometry = new THREE.BufferGeometry();
      starLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(lArr, 3));
      if (isAnime) { starLines.material = starLineDashMat; starLines.computeLineDistances(); starLines.visible = true; }
      else if (isPreObs) { starLines.material = starLineSolidMat; starLines.visible = true; }
      else { starLines.material = starLineSolidMat; starLines.visible = Boolean(state.obsConstLines); }
    }
    updateFocusedConstellation(canShowConst);

    const pNames = ['朝', '昼', '夕', '夜', '深夜'];
    const mNames = { anime: '通常(アニメ)', pre_obs: '観測前(リアル)', obs: '観察時(計測◯)' };
    lastStatusText = `${mNames[state.viewMode]}｜${moment.modeLabel}｜${mo + 1}/${da} ${pNames[moment.phase]}（日出${formatHM(moment.times.sunriseH)}・日入${formatHM(moment.times.sunsetH)}）｜${state.gpsApplied ? `GPS(${state.lat.toFixed(1)}°N)` : '日本標準'}`;
    syncSettingsUI();

    if (typeof renderer !== 'undefined' && renderer && typeof activeCamera !== 'undefined' && activeCamera) {
      try { renderer.render(scene, activeCamera); } catch (e) {}
    }
  }

  // --- 自前GPS事前確認モーダル ---
  function openGpsConsentModal() {
    let modal = document.getElementById('sky-gps-consent-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'sky-gps-consent-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.58);display:flex;align-items:center;justify-content:center;padding:18px;';
      modal.innerHTML = `
        <div style="width:100%;max-width:320px;background:#ffffff;border-radius:16px;padding:16px;box-shadow:0 12px 32px rgba(0,0,0,0.28);text-align:left;border:2px solid #7dd3fc;">
          <div style="font-size:14px;font-weight:900;color:#0369a1;margin-bottom:8px;">📍 位置情報の利用確認</div>
          <div style="font-size:12px;line-height:1.6;color:#334155;margin-bottom:14px;">現在地の空（太陽・月・星座の位置）を再現するために位置情報を使いますか？<br><span style="font-size:10.5px;color:#64748b;">※「今はしない」を選んでも日本標準の空でそのまま遊べます。</span></div>
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
          <div style="font-size:11px;font-weight:800;color:#0f172a;">🌌 空・天体システム<div style="font-size:9.5px;font-weight:600;color:#64748b;">夜キャラ視点限定星座＋地下非表示</div></div>
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
            <span style="font-size:10px;font-weight:800;color:#334155;">✨ 観察時の星座線（夜キャラ視点）</span>
            <button type="button" id="btn-toggle-obs-lines" style="padding:4px 9px;border-radius:7px;border:none;font-size:10px;font-weight:900;cursor:pointer;"></button>
          </div>
        </div>
        <div style="background:#ffffff;border:1px solid #bae6fd;border-radius:9px;padding:7px 9px;display:flex;flex-direction:column;gap:5px;">
          <div style="font-size:10.5px;font-weight:800;color:#0f172a;">🌅 時間帯プレビュー（5時間帯の空を確認）</div>
          <div style="display:flex;gap:3px;">
            <button type="button" data-preview="auto" style="flex:1.1;padding:5px 2px;border-radius:6px;border:1px solid #bae6fd;font-size:10px;font-weight:900;cursor:pointer;">自動</button>
            <button type="button" data-preview="0" style="flex:1;padding:5px 2px;border-radius:6px;border:1px solid #bae6fd;font-size:10px;font-weight:900;cursor:pointer;">朝</button>
            <button type="button" data-preview="1" style="flex:1;padding:5px 2px;border-radius:6px;border:1px solid #bae6fd;font-size:10px;font-weight:900;cursor:pointer;">昼</button>
            <button type="button" data-preview="2" style="flex:1;padding:5px 2px;border-radius:6px;border:1px solid #bae6fd;font-size:10px;font-weight:900;cursor:pointer;">夕</button>
            <button type="button" data-preview="3" style="flex:1;padding:5px 2px;border-radius:6px;border:1px solid #bae6fd;font-size:10px;font-weight:900;cursor:pointer;">夜</button>
            <button type="button" data-preview="4" style="flex:1.1;padding:5px 2px;border-radius:6px;border:1px solid #bae6fd;font-size:10px;font-weight:900;cursor:pointer;">深夜</button>
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
        if (!next) state.full360Mode = false;
        saveState(); updateCelestialExhibit(true);
      };
      box.querySelectorAll('[data-skymode]').forEach((btn) => {
        btn.onclick = () => {
          const m = btn.getAttribute('data-skymode');
          state.viewMode = m;
          state.skyUnlocked = true; state.skyVisible = true;
          if (m === 'obs') { state.realtimeUnlocked = true; state.realtimeActive = true; state.previewPhase = 'auto'; }
          else { state.realtimeActive = false; state.full360Mode = false; }
          saveState(); updateCelestialExhibit(true);
        };
      });
      box.querySelectorAll('[data-preview]').forEach((btn) => {
        btn.onclick = () => {
          const v = btn.getAttribute('data-preview');
          state.previewPhase = (v === 'auto') ? 'auto' : Number(v);
          state.skyUnlocked = true; state.skyVisible = true;
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
        if (next) { state.skyUnlocked = true; state.skyVisible = true; state.previewPhase = 'auto'; }
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
    box.querySelectorAll('[data-preview]').forEach((btn) => {
      const sel = (String(state.previewPhase) === btn.getAttribute('data-preview'));
      btn.style.background = sel ? '#0284c7' : '#f8fafc';
      btn.style.color = sel ? '#ffffff' : '#334155';
    });
    if (stEl) stEl.innerText = lastStatusText;
  }

  // --- 軽量アニメーション＆視線方向での星座HUD更新 ---
  let lastRenderFrame = -1;
  function animateSky(now) {
    if (skyRoot.visible) {
      if (sunRaySprite.visible) {
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
      }
      if (starGroup.visible) {
        updateFocusedConstellation(true);
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
  }, 900);
  setTimeout(() => { updateCelestialExhibit(true); syncSettingsUI(); }, 800);
  requestAnimationFrame(animateSky);

  window.SkyTimeModule = {
    unlockSky: () => { state.skyUnlocked = true; state.skyVisible = true; saveState(); updateCelestialExhibit(true); },
    setSkyVisible: (v) => { state.skyVisible = Boolean(v); if (v) state.skyUnlocked = true; else state.full360Mode = false; saveState(); updateCelestialExhibit(true); },
    setMode: (m) => { if (['anime','pre_obs','obs'].includes(m)) { state.viewMode = m; state.skyUnlocked = true; state.skyVisible = true; state.realtimeActive = (m === 'obs'); if (m === 'obs') { state.realtimeUnlocked = true; state.previewPhase = 'auto'; } else { state.full360Mode = false; } saveState(); updateCelestialExhibit(true); } },
    setPreviewPhase: (p) => { state.previewPhase = (p === 'auto') ? 'auto' : Number(p); saveState(); updateCelestialExhibit(true); },
    setObsConstLines: (v) => { state.obsConstLines = Boolean(v); saveState(); updateCelestialExhibit(true); },
    setFull360: (v) => { state.full360Mode = Boolean(v); updateCelestialExhibit(true); },
    unlockRealtime: () => { state.realtimeUnlocked = true; state.realtimeActive = true; state.skyUnlocked = true; state.skyVisible = true; state.previewPhase = 'auto'; saveState(); updateCelestialExhibit(true); },
    setRealtime: (v) => { state.realtimeActive = Boolean(v); if (v) { state.realtimeUnlocked = true; state.skyUnlocked = true; state.skyVisible = true; state.previewPhase = 'auto'; } saveState(); updateCelestialExhibit(true); },
    requestGPS: openGpsConsentModal,
    getPhaseIndex: () => Math.min(3, resolveEffectiveSkyMoment().phase),
    refresh: () => updateCelestialExhibit(true)
  };

  if (window.DebugGuard) window.DebugGuard.markLoaded('sky_time.js');
})();
