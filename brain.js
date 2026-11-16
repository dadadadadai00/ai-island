// ============================================================================
// 【brain.js：頭脳・20種表現・6種トラウマ・5段階物理＆重力計算・クラウド保存】
// ============================================================================

const DEFAULT_EXPRESSIONS = [
  { key: 'normal',   icon: '🙂', label: '通常',           bulb: 0xfacc15, words: '立つ、待つ、見守る、落ち着く、通常、階段' },
  { key: 'joy',      icon: '😆', label: '喜ぶ',           bulb: 0xf472b6, words: 'バンザイ、成功、リンゴ、食べた、嬉しい、開通' },
  { key: 'anger',    icon: '😡', label: '怒る',           bulb: 0xef4444, words: '地団駄、つかえた、悔しい、プンプン、怒る、狭い' },
  { key: 'sad',      icon: '😭', label: '悲しむ',         bulb: 0x38bdf8, words: 'うなだれる、失敗、おなかすいた、しょんぼり、泣く' },
  { key: 'fun',      icon: '🎵', label: '楽しむ',         bulb: 0x34d399, words: 'ダンス、鼻歌、ごきげん、ステップ、踊る、散歩' },
  { key: 'fear',     icon: '😰', label: '怖がる',         bulb: 0x8b5cf6, words: '後ずさり、ビクビク、危険、お化け、怯える、トラウマ' },
  { key: 'shiver',   icon: '🥶', label: '震える',         bulb: 0x60a5fa, words: '寒い、ガタガタ、武者震い、氷、冷たい、足がすくむ' },
  { key: 'hot',      icon: '🥵', label: '暑がる',         bulb: 0xf97316, words: 'あおぐ、バテる、汗、熱い、蒸し暑い、過労、疲れた' },
  { key: 'think',    icon: '💡', label: '考える',         bulb: 0xfef08a, words: 'ひらめく、悩む、作戦会議、腕組み、思考、迷う' },
  { key: 'surprise', icon: '😲', label: '驚く',           bulb: 0xf87171, words: 'びっくり、飛び上がる、発見、ハッとする、白波、虫' },
  { key: 'wave',     icon: '👋', label: '挨拶',           bulb: 0x4ade80, words: '手を振る、ヤッホー、呼ぶ、お礼、バイバイ、挨拶' },
  { key: 'sleep',    icon: '💤', label: '居眠り',         bulb: 0x94a3b8, words: '寝る、船をこぐ、休憩、お昼寝、ひとやすみ、省エネ' },
  { key: 'swing_v',  icon: '⛏️', label: '縦に振りかざす', bulb: 0xfb923c, words: '斧、剣、ツルハシ、餅つき用きね、釣り竿、叩く、割る', tool: true },
  { key: 'swing_h',  icon: '🧹', label: '横に払う・掃く', bulb: 0x2dd4bf, words: '掃除、草刈り、鎌、ほうき、ペンキ塗り、払う、削る', tool: true },
  { key: 'pickup',   icon: '🤲', label: '拾う・置く',     bulb: 0xa3e635, words: 'しゃがむ、採取、種まき、置く、調べる、着地ポーズ、拾う' },
  { key: 'carry',    icon: '📦', label: '持ち上げる',     bulb: 0xfbbf24, words: '重い石、筋トレ、頭上に掲げる、積む、運ぶ、踏み台' },
  { key: 'push',     icon: '👐', label: '前に押す・掘る', bulb: 0xf87171, words: '壁押し、トンネル掘り、どかす、突っ張る、前掘り、掘削' },
  { key: 'run',      icon: '🏃', label: '走る・急ぐ',     bulb: 0x38bdf8, words: 'ダッシュ、逃げる、急ぐ、運動、駆け足、走る' },
  { key: 'peek',     icon: '🔍', label: 'のぞき込む',     bulb: 0xc084fc, words: '下を見る、穴をのぞく、観察、キョロキョロ、探す' },
  { key: 'struggle', icon: '🌀', label: '模索・奮闘する', bulb: 0xf43f5e, words: 'よじ登る、足をバタバタ、試行錯誤、ジタバタ挑戦、未知' }
];

const TRAUMA_SPECS = [
  { id: 'sea',      icon: '🌊', name: '海トラウマ',         desc: '白波で溺れた(警戒-45)',          deltas: { curiosity: 0,   cautionLimiter: -45,  power: 0,   eco: 0,   logic: 0 } },
  { id: 'narrow',   icon: '🕳️', name: '狭所トラウマ',       desc: '穴につかえた(出力+35/探究-30)',  deltas: { curiosity: -30, cautionLimiter: 0,    power: 35,  eco: 0,   logic: 0 } },
  { id: 'stomach',  icon: '🤢', name: 'はらいたトラウマ',   desc: '食中毒・腹痛(探究-45)',          deltas: { curiosity: -45, cautionLimiter: -15,  power: 0,   eco: 0,   logic: 0 } },
  { id: 'height',   icon: '🧗', name: '高所トラウマ',       desc: '高い段から落下(警戒が0に!)',     deltas: { curiosity: 0,   cautionLimiter: -100, power: 0,   eco: 0,   logic: 0 }, forceZeroCaution: true },
  { id: 'monster',  icon: '👻', name: 'ビックリ生物トラウマ', desc: '虫・お化け遭遇(演算-45)',       deltas: { curiosity: 0,   cautionLimiter: -20,  power: 0,   eco: 0,   logic: -45 } },
  { id: 'overwork', icon: '⛏️', name: '過労トラウマ',       desc: '働きすぎ腰痛(省エネMAX/出力-35)', deltas: { curiosity: 0,   cautionLimiter: 0,    power: -35, eco: 100, logic: 0 }, forceMaxEco: true }
];

// 📏 キャラの大きさ（高さ）5段階：分割1〜5ブロック（ほふく高crawlHは立ち高さの半分切り上げ）
const SIZE_SPECS = {
  giant:  { label: '巨大', subH: 5, scaleY: 1.00, standH: 5, crawlH: 3, stairMax: 2 },
  large:  { label: '大',   subH: 4, scaleY: 0.80, standH: 4, crawlH: 2, stairMax: 2 },
  medium: { label: '標準', subH: 3, scaleY: 0.60, standH: 3, crawlH: 2, stairMax: 1 },
  small:  { label: '小',   subH: 2, scaleY: 0.40, standH: 2, crawlH: 1, stairMax: 1 },
  tiny:   { label: '極小', subH: 1, scaleY: 0.20, standH: 1, crawlH: 1, stairMax: 0 }
};

// 🐛 キャラの太さ（横幅）5段階：分割1〜5ブロック
const BODY_SPECS = {
  fat5:    { label: 'でぶっちょ', reqWidth: 5, scaleX: 1.82, scaleZ: 1.75 },
  fat4:    { label: 'ちょいでぶ', reqWidth: 4, scaleX: 1.45, scaleZ: 1.40 },
  normal3: { label: '標準',       reqWidth: 3, scaleX: 1.08, scaleZ: 1.05 },
  slim2:   { label: 'ちょいやせ', reqWidth: 2, scaleX: 0.72, scaleZ: 0.72 },
  slim1:   { label: 'やせっちょ', reqWidth: 1, scaleX: 0.38, scaleZ: 0.38 }
};

const POSE_TABLE = {
  normal:   { spd: 3.5, bounce: 0.01, bodyX: 0.00, headX: 0.00, shLX: 0.05,  shLZ: 0.05, elLX: -0.20, shRX: -0.05, shRZ: -0.05, elRX: -0.20, hipX: -0.05, kneeX: 0.10, mode: 'breath' },
  joy:      { spd: 7.5, bounce: 0.22, bodyX: -0.10, headX: -0.20, shLX: -2.65, shLZ: 0.35, elLX: -0.35, shRX: -2.65, shRZ: -0.35, elRX: -0.35, hipX: -0.35, kneeX: 0.70, mode: 'jump' },
  anger:    { spd: 16,  bounce: 0.04, bodyX: 0.18, headX: 0.12, shLX: -0.90, shLZ: 0.35, elLX: -1.35, shRX: -0.90, shRZ: -0.35, elRX: -1.35, hipX: -0.85, kneeX: 1.30, mode: 'stomp' },
  sad:      { spd: 2.2, bounce: -0.11, bodyX: 0.35, headX: 0.35, shLX: -0.45, shLZ: 0.10, elLX: -0.85, shRX: -0.45, shRZ: -0.10, elRX: -0.85, hipX: -1.40, kneeX: 0.80, mode: 'sit' },
  fun:      { spd: 6.0, bounce: 0.07, bodyX: 0.00, headX: -0.08, shLX: -0.30, shLZ: 0.85, elLX: -0.75, shRX: -0.30, shRZ: -0.85, elRX: -0.75, hipX: -0.30, kneeX: 0.60, mode: 'dance' },
  fear:     { spd: 24,  bounce: -0.04, bodyX: -0.22, headX: 0.20, shLX: -1.45, shLZ: -0.25, elLX: -1.15, shRX: -1.45, shRZ: 0.25, elRX: -1.15, hipX: -0.35, kneeX: 0.65, mode: 'tremor' },
  shiver:   { spd: 36,  bounce: -0.05, bodyX: 0.28, headX: 0.25, shLX: -0.85, shLZ: -0.45, elLX: -1.45, shRX: -0.85, shRZ: 0.45, elRX: -1.45, hipX: -0.45, kneeX: 0.85, mode: 'tremor' },
  hot:      { spd: 11,  bounce: -0.03, bodyX: 0.20, headX: 0.22, shLX: 0.15,  shLZ: 0.15, elLX: -0.15, shRX: -1.35, shRZ: -0.35, elRX: -1.10, hipX: -0.25, kneeX: 0.45, mode: 'fan' },
  think:    { spd: 2.8, bounce: 0.00, bodyX: 0.05, headX: 0.10, shLX: -0.75, shLZ: -0.45, elLX: -1.35, shRX: -1.25, shRZ: 0.25, elRX: -1.55, hipX: -0.08, kneeX: 0.15, mode: 'think' },
  surprise: { spd: 8.5, bounce: 0.17, bodyX: -0.26, headX: -0.25, shLX: -2.25, shLZ: 0.55, elLX: -0.20, shRX: -2.25, shRZ: -0.55, elRX: -0.20, hipX: 0.15,  kneeX: 0.20, mode: 'jump' },
  wave:     { spd: 11,  bounce: 0.02, bodyX: 0.00, headX: -0.05, shLX: 0.10,  shLZ: 0.15, elLX: -0.25, shRX: -2.40, shRZ: -0.45, elRX: -0.40, hipX: -0.08, kneeX: 0.15, mode: 'wave' },
  sleep:    { spd: 1.8, bounce: -0.11, bodyX: 0.28, headX: 0.35, shLX: -0.25, shLZ: 0.10, elLX: -0.65, shRX: -0.25, shRZ: -0.10, elRX: -0.65, hipX: -1.40, kneeX: 0.80, mode: 'sleep' },
  swing_v:  { spd: 9.5, bounce: 0.03, bodyX: 0.22, headX: 0.10, shLX: -0.60, shLZ: 0.20, elLX: -0.80, shRX: -1.75, shRZ: -0.10, elRX: -0.75, hipX: -0.35, kneeX: 0.65, mode: 'swing_v' },
  swing_h:  { spd: 8.5, bounce: 0.02, bodyX: 0.18, headX: 0.12, shLX: -0.85, shLZ: 0.35, elLX: -0.65, shRX: -1.10, shRZ: -0.65, elRX: -0.55, hipX: -0.30, kneeX: 0.55, mode: 'swing_h' },
  pickup:   { spd: 5.0, bounce: -0.10, bodyX: 0.50, headX: 0.25, shLX: -1.25, shLZ: 0.10, elLX: -0.45, shRX: -1.25, shRZ: -0.10, elRX: -0.45, hipX: -0.95, kneeX: 1.65, mode: 'pickup' },
  carry:    { spd: 4.5, bounce: -0.04, bodyX: -0.12, headX: -0.15, shLX: -2.45, shLZ: 0.20, elLX: -0.55, shRX: -2.45, shRZ: -0.20, elRX: -0.55, hipX: -0.45, kneeX: 0.85, mode: 'carry' },
  push:     { spd: 7.0, bounce: -0.05, bodyX: 0.42, headX: -0.15, shLX: -1.55, shLZ: 0.10, elLX: -0.65, shRX: -1.55, shRZ: -0.10, elRX: -0.65, hipX: -0.65, kneeX: 1.10, mode: 'push' },
  run:      { spd: 14,  bounce: 0.06, bodyX: 0.25, headX: -0.10, shLX: -0.85, shLZ: 0.15, elLX: -1.25, shRX: 0.65,  shRZ: -0.15, elRX: -1.25, hipX: -0.85, kneeX: 1.25, mode: 'run' },
  peek:     { spd: 3.2, bounce: -0.04, bodyX: 0.45, headX: 0.38, shLX: -0.45, shLZ: 0.25, elLX: -1.10, shRX: -1.35, shRZ: 0.20, elRX: -1.20, hipX: -0.40, kneeX: 0.70, mode: 'peek' },
  struggle: { spd: 15,  bounce: 0.11, bodyX: 0.22, headX: -0.18, shLX: -1.85, shLZ: 0.55, elLX: -0.95, shRX: -1.45, shRZ: -0.65, elRX: -1.15, hipX: -0.95, kneeX: 1.35, mode: 'struggle' }
};

let CUSTOM_WORDS_MAP = {};
DEFAULT_EXPRESSIONS.forEach(item => { CUSTOM_WORDS_MAP[item.key] = item.words; });

function getExpressionSpec(key) {
  return DEFAULT_EXPRESSIONS.find(e => e.key === key) || DEFAULT_EXPRESSIONS[0];
}

function matchExpressionFromText(text, fallbackKey = 'struggle') {
  if (!text) return fallbackKey;
  for (let i = 0; i < DEFAULT_EXPRESSIONS.length; i++) {
    const k = DEFAULT_EXPRESSIONS[i].key;
    const rawWords = CUSTOM_WORDS_MAP[k] || DEFAULT_EXPRESSIONS[i].words;
    const wordList = rawWords.split(/[、,，\s]+/).filter(Boolean);
    for (let w of wordList) {
      if (w.length >= 1 && text.includes(w)) return k;
    }
  }
  return fallbackKey;
}

function normalizeSizeKey(k) { return SIZE_SPECS[k] ? k : 'tiny'; }
function normalizeBodyKey(k) {
  if (BODY_SPECS[k]) return k;
  if (k === 'fat') return 'fat4';
  if (k === 'normal') return 'normal3';
  if (k === 'slim') return 'slim2';
  return 'slim1';
}

// ============================================================================
// 【Firebase Firestore ＆ localStorage クラウド保存コア】
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyAE7E42I361W4i-I6CD4NEgydMSbAiDDOE",
  authDomain: "lifecore-5c9bf.firebaseapp.com",
  projectId: "lifecore-5c9bf",
  storageBucket: "lifecore-5c9bf.firebasestorage.app",
  messagingSenderId: "527921811555",
  appId: "1:527921811555:web:8c31f3a7ede3f700e42856"
};

let firestoreDocRef = null;
try {
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  firestoreDocRef = db.collection('lifecore_saves').doc('island_spacecore_v15');
} catch (e) {
  console.warn('Firebase init error:', e);
}

const safeStorage = {
  getItem(k) { try { return localStorage.getItem(k); } catch(e) { return null; } },
  setItem(k, v) { try { localStorage.setItem(k, v); } catch(e) {} },
  removeItem(k) { try { localStorage.removeItem(k); } catch(e) {} }
};

class LifeCore {
  constructor(save = null) {
    this.energy = (save && typeof save.energy === 'number') ? save.energy : 100;
    this.stamina = (save && typeof save.stamina === 'number') ? save.stamina : 100;
    this.mental = (save && typeof save.mental === 'number') ? save.mental : 100;
  }
  clamp() {
    this.energy = Math.max(0, Math.min(100, Math.round(this.energy)));
    this.stamina = Math.max(0, Math.min(100, Math.round(this.stamina)));
    this.mental = Math.max(0, Math.min(100, Math.round(this.mental)));
  }
  getState() {
    this.clamp();
    let mode = 'PEACE';
    if (this.energy <= 0 || this.stamina <= 0) mode = 'DEAD';
    else if (this.energy <= 30) mode = 'STARVING';
    else if (this.stamina <= 25) mode = 'EXHAUSTED';
    else if (this.mental <= 30) mode = 'BORED';
    return { energy: this.energy, stamina: this.stamina, mental: this.mental, mode };
  }
  exportSave() { return { energy: this.energy, stamina: this.stamina, mental: this.mental }; }
}

// ============================================================================
// 【空間データ・5段階物理・壁際掘削・太さ重力落下ルール】
// ============================================================================
const AREA1_MAX_GROUND_LV = 5;
const AREA1_MIN_UNDER_LV  = -4;
const WATER_SURFACE_Y     = -0.40;

const SPACE_COLORS = {
  pastelGreenTop: 0xa7f3d0,
  pastelGreenMid: 0x86efac,
  dryPastelSoil:  0xd4a373,
  wetSoilLv2:     0xb07d56,
  wetSoilLv3:     0x9c6644,
  wetSoilLv4:     0x7f5539,
  wetSoilLv5:     0x603813
};

function getSubVoxelColorHex(lv, sy) {
  if (lv >= 0) {
    if (sy === 4) return SPACE_COLORS.pastelGreenTop;
    if (sy === 3) return SPACE_COLORS.pastelGreenMid;
    return SPACE_COLORS.dryPastelSoil;
  }
  if (lv === -1) return SPACE_COLORS.wetSoilLv2;
  if (lv === -2) return SPACE_COLORS.wetSoilLv3;
  if (lv === -3) return SPACE_COLORS.wetSoilLv4;
  return SPACE_COLORS.wetSoilLv5;
}

function isWaterFacingOuterSubVoxel(gx, gz, lv, sx, sy, sz) {
  if (lv > 0) return false;
  if (lv === 0 && sy >= 3) return false;
  if (gx === -2 && sx === 0) return true;
  if (gx === 2  && sx === 4) return true;
  if (gz === -2 && sz === 0) return true;
  if (gz === 2  && sz === 4) return true;
  return false;
}

function enforceOuterWaterWallIntegrity() {
  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      const isEdgeCell = (x === -2 || x === 2 || z === -2 || z === 2);
      if (!isEdgeCell) continue;
      const k = `${x},${z}`;
      const curTop = HEIGHT_MAP[k] ?? 0;
      if (curTop < 0) {
        for (let lv = curTop + 1; lv <= 0; lv++) {
          const ck = `${x},${z},${lv}`;
          if (!CHIP_MAP[ck]) CHIP_MAP[ck] = {};
          for (let sy = 0; sy < 5; sy++) {
            for (let sx = 0; sx < 5; sx++) {
              for (let sz = 0; sz < 5; sz++) {
                if (!isWaterFacingOuterSubVoxel(x, z, lv, sx, sy, sz)) {
                  CHIP_MAP[ck][`${sx},${sy},${sz}`] = 1;
                } else {
                  delete CHIP_MAP[ck][`${sx},${sy},${sz}`];
                }
              }
            }
          }
        }
        HEIGHT_MAP[k] = 0;
      }
      for (let lv = AREA1_MIN_UNDER_LV; lv <= 0; lv++) {
        const ck = `${x},${z},${lv}`;
        if (!CHIP_MAP[ck]) continue;
        for (let sy = 0; sy < 5; sy++) {
          for (let sx = 0; sx < 5; sx++) {
            for (let sz = 0; sz < 5; sz++) {
              if (isWaterFacingOuterSubVoxel(x, z, lv, sx, sy, sz)) {
                delete CHIP_MAP[ck][`${sx},${sy},${sz}`];
              }
            }
          }
        }
      }
    }
  }
}

const ALL_DIRS = [
  { name: '北',   dx: 0,  dz: -1, rot: Math.PI,          isDiag: false },
  { name: '南',   dx: 0,  dz: 1,  rot: 0,                isDiag: false },
  { name: '東',   dx: 1,  dz: 0,  rot: Math.PI / 2,      isDiag: false },
  { name: '西',   dx: -1, dz: 0,  rot: -Math.PI / 2,     isDiag: false },
  { name: '北西(斜め)', dx: -1, dz: -1, rot: -Math.PI * 0.75, isDiag: true },
  { name: '北東(斜め)', dx: 1,  dz: -1, rot: Math.PI * 0.75,  isDiag: true },
  { name: '南西(斜め)', dx: -1, dz: 1,  rot: -Math.PI * 0.25, isDiag: true },
  { name: '南東(斜め)', dx: 1,  dz: 1,  rot: Math.PI * 0.25,  isDiag: true }
];

function getDirNameFromRot(rotY) {
  let best = ALL_DIRS[0], minDiff = 999;
  ALL_DIRS.forEach(d => {
    const diff = Math.abs(Math.atan2(Math.sin(rotY - d.rot), Math.cos(rotY - d.rot)));
    if (diff < minDiff) { minDiff = diff; best = d; }
  });
  return best.name;
}

let life = new LifeCore(), GAME_DAY = 1, TIME_STEP = 0;
let BAG = ['stone', 'oil', 'apple', 'stone', 'grass'];
let DIARY_LOGS = ['🌱 1日目：分割1〜5ブロック基準の「高さ5段階×太さ5段階・壁際掘削・太さ重力落下」を持つ1号機が誕生！'];
let CAM_VISUAL_STYLE = safeStorage.getItem('cam_visual_style_v15') || 'hide';
let HEIGHT_MAP = {}, CHIP_MAP = {}, WATER_MAP = {};
let currentDiaryTab = 'base';

let ROBOT = {
  unitModel: 1,
  gen: 1,
  rigType: 'box',
  pos: { x: 0, z: 0, lv: -1, sx: 2, sz: 2 },
  rotY: Math.PI,
  speed: 3,
  sizeLevel: 'tiny',
  bodyType: 'slim1',
  posture: 'stand',
  emotion: 'normal',
  params: {
    curiosity: 60,
    cautionLimiter: 50,
    power: 50,
    eco: 40,
    logic: 50,
    loyalty: 50
  },
  traumas: [],
  workStreak: 0
};
let WORLD_ITEMS = [{ type: 'apple', x: -1, z: 1 }, { type: 'apple', x: 1, z: 0 }];

function addTraumaById(traumaId, silent = false) {
  const spec = TRAUMA_SPECS.find(t => t.id === traumaId);
  if (!spec) return false;
  if (!Array.isArray(ROBOT.traumas)) ROBOT.traumas = [];
  if (!ROBOT.traumas.includes(traumaId)) {
    ROBOT.traumas.push(traumaId);
    DIARY_LOGS.push(`⚡ トラウマ発症：「${spec.icon}${spec.name}」になった！`);
    if (!silent) showToast(`⚡「${spec.icon}${spec.name}」が発症し、裏パラメータが変化したよ！`);
    return true;
  }
  return false;
}

function hasTrauma(traumaId) {
  return Array.isArray(ROBOT.traumas) && ROBOT.traumas.includes(traumaId);
}

function getEffectiveParams() {
  const base = ROBOT.params || { curiosity: 60, cautionLimiter: 50, power: 50, eco: 40, logic: 50, loyalty: 50 };
  const eff = {
    curiosity: base.curiosity ?? 60,
    cautionLimiter: base.cautionLimiter ?? 50,
    power: base.power ?? 50,
    eco: base.eco ?? 40,
    logic: base.logic ?? 50,
    loyalty: 50
  };
  let forceZeroCaution = false, forceMaxEco = false;

  const activeIds = Array.isArray(ROBOT.traumas) ? ROBOT.traumas : [];
  activeIds.forEach(id => {
    const sp = TRAUMA_SPECS.find(t => t.id === id);
    if (!sp) return;
    eff.curiosity += (sp.deltas.curiosity || 0);
    eff.cautionLimiter += (sp.deltas.cautionLimiter || 0);
    eff.power += (sp.deltas.power || 0);
    eff.eco += (sp.deltas.eco || 0);
    eff.logic += (sp.deltas.logic || 0);
    if (sp.forceZeroCaution) forceZeroCaution = true;
    if (sp.forceMaxEco) forceMaxEco = true;
  });

  if (forceZeroCaution) eff.cautionLimiter = 0;
  if (forceMaxEco) eff.eco = 100;

  ['curiosity', 'cautionLimiter', 'power', 'eco', 'logic'].forEach(k => {
    eff[k] = Math.max(0, Math.min(100, Math.round(eff[k])));
  });
  return eff;
}

function carveCrawlTunnelBlock(gx, gz, lv, tunnelWidth = 3, tunnelHeight = 2) {
  const key = `${gx},${gz},${lv}`;
  if (!CHIP_MAP[key]) CHIP_MAP[key] = {};
  const startS = Math.floor((5 - tunnelWidth) / 2);
  const endS = startS + tunnelWidth - 1;
  for (let sy = 0; sy < tunnelHeight; sy++) {
    for (let sx = 0; sx < 5; sx++) {
      for (let sz = 0; sz < 5; sz++) {
        if (isWaterFacingOuterSubVoxel(gx, gz, lv, sx, sy, sz)) continue;
        if ((sx >= startS && sx <= endS) || (sz >= startS && sz <= endS)) {
          CHIP_MAP[key][`${sx},${sy},${sz}`] = 1;
        }
      }
    }
  }
}

function carveTopSubLayers(gx, gz, lv, remainingSubHeight) {
  const ck = `${gx},${gz},${lv}`;
  if (!CHIP_MAP[ck]) CHIP_MAP[ck] = {};
  for (let sy = remainingSubHeight; sy < 5; sy++) {
    for (let sx = 0; sx < 5; sx++) {
      for (let sz = 0; sz < 5; sz++) {
        if (!isWaterFacingOuterSubVoxel(gx, gz, lv, sx, sy, sz)) {
          CHIP_MAP[ck][`${sx},${sy},${sz}`] = 1;
        }
      }
    }
  }
}

function initDefaultSpaceCore() {
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) HEIGHT_MAP[`${x},${z}`] = 0;
  HEIGHT_MAP['1,2'] = 1;
  HEIGHT_MAP['0,0'] = -1;
  CHIP_MAP = {};
  WATER_MAP = {};

  carveTopSubLayers(1, 0, 0, 1);
  carveTopSubLayers(0, 1, 0, 2);

  carveCrawlTunnelBlock(-1, -1, 0, 3, 2);
  for (let sy = 0; sy < 2; sy++) {
    CHIP_MAP['-1,-1,0'][`3,${sy},3`] = 1; CHIP_MAP['-1,-1,0'][`4,${sy},4`] = 1;
    CHIP_MAP['-1,-1,0'][`4,${sy},3`] = 1; CHIP_MAP['-1,-1,0'][`3,${sy},4`] = 1;
    CHIP_MAP['-1,-1,0'][`0,${sy},0`] = 1; CHIP_MAP['-1,-1,0'][`1,${sy},1`] = 1;
  }

  CHIP_MAP['0,-1,0'] = {};
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 1; sx <= 3; sx++) {
      CHIP_MAP['0,-1,0'][`${sx},${sy},4`] = 1;
      if (sy < 2) CHIP_MAP['0,-1,0'][`${sx},${sy},3`] = 1;
    }
  }
  enforceOuterWaterWallIntegrity();
}
initDefaultSpaceCore();

function applyLoadedWorldData(d) {
  if (!d || typeof d !== 'object') return;
  if (d.life) life = new LifeCore(d.life);
  if (d.customWords && typeof d.customWords === 'object') {
    DEFAULT_EXPRESSIONS.forEach(item => {
      if (typeof d.customWords[item.key] === 'string') {
        CUSTOM_WORDS_MAP[item.key] = d.customWords[item.key];
      }
    });
  }
  if (d.robot && d.robot.pos) {
    ROBOT.unitModel = Number(d.robot.unitModel) || 1;
    ROBOT.gen = Number(d.robot.gen) || 1;
    ROBOT.rigType = (d.robot.rigType === 'stick') ? 'stick' : 'box';
    ROBOT.pos.x = Number.isFinite(d.robot.pos.x) ? d.robot.pos.x : 0;
    ROBOT.pos.z = Number.isFinite(d.robot.pos.z) ? d.robot.pos.z : 0;
    ROBOT.pos.lv = Number.isFinite(d.robot.pos.lv) ? d.robot.pos.lv : (HEIGHT_MAP[`${ROBOT.pos.x},${ROBOT.pos.z}`] ?? 0);
    ROBOT.pos.sx = Number.isFinite(d.robot.pos.sx) ? d.robot.pos.sx : 2;
    ROBOT.pos.sz = Number.isFinite(d.robot.pos.sz) ? d.robot.pos.sz : 2;
    ROBOT.rotY = Number.isFinite(d.robot.rotY) ? d.robot.rotY : Math.PI;
    ROBOT.speed = Number(d.robot.speed) || 3;
    ROBOT.sizeLevel = normalizeSizeKey(d.robot.sizeLevel);
    ROBOT.bodyType = normalizeBodyKey(d.robot.bodyType);
    ROBOT.posture = d.robot.posture === 'crawl' ? 'crawl' : 'stand';
    ROBOT.emotion = POSE_TABLE[d.robot.emotion] ? d.robot.emotion : 'normal';
    if (d.robot.params && typeof d.robot.params === 'object') {
      ['curiosity', 'cautionLimiter', 'power', 'eco', 'logic'].forEach(k => {
        if (typeof d.robot.params[k] === 'number') {
          ROBOT.params[k] = Math.max(0, Math.min(100, Math.round(d.robot.params[k])));
        }
      });
    }
    if (Array.isArray(d.robot.traumas)) {
      ROBOT.traumas = d.robot.traumas.filter(id => TRAUMA_SPECS.some(t => t.id === id));
    }
  }
  if (d.heightMap) {
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
      const k = `${x},${z}`;
      if (d.heightMap[k] !== undefined) {
        HEIGHT_MAP[k] = Math.max(AREA1_MIN_UNDER_LV, Math.min(AREA1_MAX_GROUND_LV, Number(d.heightMap[k]) || 0));
      }
    }
  }
  if (d.chipMap && typeof d.chipMap === 'object') CHIP_MAP = d.chipMap;
  enforceOuterWaterWallIntegrity();

  if (Array.isArray(d.items)) WORLD_ITEMS = d.items;
  if (Array.isArray(d.bag)) BAG = d.bag;
  if (Array.isArray(d.logs) && d.logs.length) DIARY_LOGS = d.logs;
  GAME_DAY = Math.max(1, Number(d.day) || 1);
  TIME_STEP = Math.max(0, Math.min(19, Number(d.time) || 0));
  if (d.lastMessage && typeof d.lastMessage === 'string') {
    const msgEl = document.getElementById('message-box');
    if (msgEl) msgEl.innerText = d.lastMessage;
  }
  if (d.lastAction && typeof d.lastAction === 'string') {
    const actEl = document.getElementById('history-action');
    if (actEl) actEl.innerText = d.lastAction;
  }
}

(function loadLocalWorldState() {
  try {
    const raw = safeStorage.getItem('island_spacecore_v15');
    if (!raw) return;
    applyLoadedWorldData(JSON.parse(raw));
  } catch (e) {}
})();

async function loadCloudWorldState() {
  if (!firestoreDocRef)
