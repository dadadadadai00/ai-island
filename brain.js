// ============================================================================
// 【コア①：20種の基本表現データ表 ＆ 6種のトラウマ定義 ＆ 5×5サイズ定義】
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

// 🌀 奇想天外プロンプト一覧の初期データ（7項目：個別ON/OFF・短文編集可能）
const DEFAULT_QUIRKY_PROMPTS = [
  {
    id: 'base_persona',
    icon: '🤖',
    title: '⑦ 常時ベース性格（1行キャラ設定）',
    enabled: true,
    prompt: 'あなたはパステル島のドジで憎めないロボット。小学生がクスッと笑うユーモアで話して'
  },
  {
    id: 'high_wall',
    icon: '🧱',
    title: '① 高い壁で登れない時（段差エラー）',
    enabled: true,
    prompt: '目の前の壁が高すぎて登れない！子どもが笑うような奇想天外な言い訳や突破アイデアを1文で叫んで'
  },
  {
    id: 'narrow_hole',
    icon: '🕳️',
    title: '② 狭い穴にお腹がつかえた時（太さエラー）',
    enabled: true,
    prompt: '狭い穴にお腹がつかえて動けない！ユニークで奇想天外な心の声を1文で叫んで'
  },
  {
    id: 'corner_hit',
    icon: '📐',
    title: '③ 斜めの角に引っかかった時（角抜けエラー）',
    enabled: true,
    prompt: '斜めに進みたいのに角の壁が邪魔！奇想天外なツッコミを1文で叫んで'
  },
  {
    id: 'gravity_fall',
    icon: '🪂',
    title: '④ 崖や足元掘りで落下した時（重力落下）',
    enabled: true,
    prompt: '穴にストンと落ちた！着地のごまかしや奇想天外な感想を1文で叫んで'
  },
  {
    id: 'trauma_panic',
    icon: '⚡',
    title: '⑤ トラウマ発症・パニック時',
    enabled: true,
    prompt: 'トラウマが発動してパニック中！ユーモアたっぷりの奇想天外な心の声を1文で叫んで'
  },
  {
    id: 'stage_wonder',
    icon: '🌌',
    title: '⑥ 星座・滝・巨大亀を見つけた時（ステージ観察）',
    enabled: true,
    prompt: '島の不思議な景色（星座・滝・巨大亀）を発見！目をキラキラさせた奇想天外な感想を1文で叫んで'
  }
];

const TRAUMA_SPECS = [
  { id: 'sea',      icon: '🌊', name: '海トラウマ',         desc: '白波で溺れた(警戒-45)',          deltas: { curiosity: 0,   cautionLimiter: -45,  power: 0,   eco: 0,   logic: 0 } },
  { id: 'narrow',   icon: '🕳️', name: '狭所トラウマ',       desc: '穴につかえた(出力+35/探究-30)',  deltas: { curiosity: -30, cautionLimiter: 0,    power: 35,  eco: 0,   logic: 0 } },
  { id: 'stomach',  icon: '🤢', name: 'はらいたトラウマ',   desc: '食中毒・腹痛(探究-45)',          deltas: { curiosity: -45, cautionLimiter: -15,  power: 0,   eco: 0,   logic: 0 } },
  { id: 'height',   icon: '🧗', name: '高所トラウマ',       desc: '高い段から落下(警戒が0に!)',     deltas: { curiosity: 0,   cautionLimiter: -100, power: 0,   eco: 0,   logic: 0 }, forceZeroCaution: true },
  { id: 'monster',  icon: '👻', name: 'ビックリ生物トラウマ', desc: '虫・お化け遭遇(演算-45)',       deltas: { curiosity: 0,   cautionLimiter: -20,  power: 0,   eco: 0,   logic: -45 } },
  { id: 'overwork', icon: '⛏️', name: '過労トラウマ',       desc: '働きすぎ腰痛(省エネMAX/出力-35)', deltas: { curiosity: 0,   cautionLimiter: 0,    power: -35, eco: 100, logic: 0 }, forceMaxEco: true }
];

const SIZE_SPECS = {
  giant:  { label: '巨大', subH: 5, scaleY: 1.00, standH: 5, crawlH: 3, stairMax: 2 },
  large:  { label: '大',   subH: 4, scaleY: 0.80, standH: 4, crawlH: 2, stairMax: 2 },
  medium: { label: '標準', subH: 3, scaleY: 0.60, standH: 3, crawlH: 2, stairMax: 1 },
  small:  { label: '小',   subH: 2, scaleY: 0.40, standH: 2, crawlH: 1, stairMax: 1 },
  tiny:   { label: '極小', subH: 1, scaleY: 0.20, standH: 1, crawlH: 1, stairMax: 0 }
};

const BODY_SPECS = {
  fat5:    { label: 'でぶっちょ', reqWidth: 5, scaleX: 1.82, scaleZ: 1.75, wallOffsetSub: 0.00 },
  fat4:    { label: 'ちょいでぶ', reqWidth: 4, scaleX: 1.45, scaleZ: 1.40, wallOffsetSub: 0.22 },
  normal3: { label: '標準',       reqWidth: 3, scaleX: 1.08, scaleZ: 1.05, wallOffsetSub: 0.65 },
  slim2:   { label: 'ちょいやせ', reqWidth: 2, scaleX: 0.72, scaleZ: 0.72, wallOffsetSub: 1.15 },
  slim1:   { label: 'やせっちょ', reqWidth: 1, scaleX: 0.38, scaleZ: 0.38, wallOffsetSub: 1.68 }
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

// 物理アクション実行中にAIの感情で体のポーズが消えないように守るリスト
const LOCKED_PHYSICAL_POSES = ['struggle', 'pickup', 'swing_v', 'swing_h', 'push', 'carry', 'peek'];

let CUSTOM_WORDS_MAP = {};
DEFAULT_EXPRESSIONS.forEach(item => { CUSTOM_WORDS_MAP[item.key] = item.words; });

let QUIRKY_PROMPTS_MAP = {};
function initDefaultQuirkyPrompts() {
  DEFAULT_QUIRKY_PROMPTS.forEach(item => {
    QUIRKY_PROMPTS_MAP[item.id] = { enabled: item.enabled, prompt: item.prompt };
  });
}
initDefaultQuirkyPrompts();

// 📡 イベント期間中に収集した現実情報メモの保管バッファ
let REALITY_LOG_BUFFER = [];

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
// 【コア④：頭脳通信・クラウド保存コア（Firebase Firestore ＆ localStorage）】
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
// 【コア③：空間データ・5×5物理ルール・重力落下・斜め＆壁際掘削コア】
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
let DIARY_LOGS = ['🌱 1日目：100%物理ステージ＆奇想天外プロンプト一覧を備えた1号機が誕生！'];
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
  bulbEmotion: null,
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

function applyRobotBulbColor() {
  if (typeof sharedBulbMat !== 'undefined' && sharedBulbMat) {
    const key = ROBOT.bulbEmotion || ROBOT.emotion || 'normal';
    sharedBulbMat.color.setHex(getExpressionSpec(key).bulb);
  }
}

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

// 📏 壁際でサイズや太さを変更したとき、壁に顔やお腹がめり込まないよう現在位置(sx, sz)を自動押し出し
function clampCharSubPosForBodySize() {
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const maxOff = bSpec.wallOffsetSub ?? 0.65;
  const curSx = Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2;
  const curSz = Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2;
  ROBOT.pos.sx = Math.max(2 - maxOff, Math.min(2 + maxOff, curSx));
  ROBOT.pos.sz = Math.max(2 - maxOff, Math.min(2 + maxOff, curSz));
}

// ⛏️ 掘る方向(dir)の壁に対して、キャラの太さ(reqWidth)に合わせた最適距離に立たせる
function stepCharCloseToWallForDig(dir) {
  if (!dir) return;
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const off = bSpec.wallOffsetSub ?? 0.65;
  const diagFactor = dir.isDiag ? 0.82 : 1.0;
  ROBOT.pos.sx = 2 + dir.dx * off * diagFactor;
  ROBOT.pos.sz = 2 + dir.dz * off * diagFactor;
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
  if (d.quirkyPrompts && typeof d.quirkyPrompts === 'object') {
    DEFAULT_QUIRKY_PROMPTS.forEach(item => {
      const saved = d.quirkyPrompts[item.id];
      if (saved && typeof saved === 'object') {
        QUIRKY_PROMPTS_MAP[item.id] = {
          enabled: typeof saved.enabled === 'boolean' ? saved.enabled : item.enabled,
          prompt: (typeof saved.prompt === 'string' && saved.prompt.trim()) ? saved.prompt.trim() : item.prompt
        };
      }
    });
  }
  if (Array.isArray(d.realityLogs)) {
    REALITY_LOG_BUFFER = d.realityLogs.slice(-20);
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
    ROBOT.bulbEmotion = POSE_TABLE[d.robot.bulbEmotion] ? d.robot.bulbEmotion : null;
    clampCharSubPosForBodySize();
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
  if (!firestoreDocRef) return;
  try {
    const snap = await firestoreDocRef.get();
    if (!snap.exists) return;
    const docData = snap.data();
    const parsed = docData && docData.stateJson ? JSON.parse(docData.stateJson) : docData;
    if (parsed) {
      applyLoadedWorldData(parsed);
      safeStorage.setItem('island_spacecore_v15', JSON.stringify(parsed));
      document.getElementById('setting-size-level').value = ROBOT.sizeLevel;
      document.getElementById('setting-body-type').value = ROBOT.bodyType;
      document.getElementById('setting-speed').value = String(ROBOT.speed || 3);
      if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
      if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition(true);
      applyRobotBulbColor();
      cameraDirty = true;
      if (typeof updateAllCamerasTransform === 'function') updateAllCamerasTransform();
      if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
      showToast('☁️ クラウドからデータを自動復元したよ！');
    }
  } catch (e) {
    console.warn('Firestore load error:', e);
  }
}

function saveWorldState() {
  enforceOuterWaterWallIntegrity();
  const msgEl = document.getElementById('message-box');
  const actEl = document.getElementById('history-action');
  const payload = {
    life: life.exportSave(),
    robot: ROBOT,
    customWords: CUSTOM_WORDS_MAP,
    quirkyPrompts: QUIRKY_PROMPTS_MAP,
    realityLogs: REALITY_LOG_BUFFER.slice(-20),
    heightMap: HEIGHT_MAP,
    chipMap: CHIP_MAP,
    items: WORLD_ITEMS,
    bag: BAG,
    logs: DIARY_LOGS.slice(-50),
    day: GAME_DAY,
    time: TIME_STEP,
    lastMessage: msgEl ? msgEl.innerText : '',
    lastAction: actEl ? actEl.innerText : ''
  };
  const jsonStr = JSON.stringify(payload);
  safeStorage.setItem('island_spacecore_v15', jsonStr);

  if (firestoreDocRef) {
    firestoreDocRef.set({
      stateJson: jsonStr,
      day: GAME_DAY,
      time: TIME_STEP,
      life: payload.life,
      robotGen: ROBOT.gen,
      lastMessage: payload.lastMessage,
      logs: payload.logs,
      updatedAt: Date.now()
    }).catch(e => {
      console.warn('Firestore save error:', e);
    });
  }
}

async function resetGameDirectly() {
  safeStorage.removeItem('island_spacecore_v15');
  safeStorage.removeItem('island_spacecore_v14');
  if (firestoreDocRef) {
    try { await firestoreDocRef.delete(); } catch (e) {}
  }
  location.reload();
}

function getEffectiveClearanceSpecs() {
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;
  return {
    reqWidth: bSpec.reqWidth,
    subH: sSpec.subH,
    stairMax: sSpec.stairMax,
    standH: sSpec.standH,
    crawlH: sSpec.crawlH
  };
}

function getSurfaceSubUnitsForChar(gx, gz, reqWidth = 1, lvOverride = null) {
  if (gx < -2 || gx > 2 || gz < -2 || gz > 2) return -3;
  const topLv = HEIGHT_MAP[`${gx},${gz}`] ?? 0;
  const startLv = (lvOverride !== null && lvOverride < topLv) ? lvOverride : topLv;
  const startS = Math.floor((5 - reqWidth) / 2), endS = startS + reqWidth - 1;

  for (let lv = startLv; lv >= AREA1_MIN_UNDER_LV; lv--) {
    const chip = CHIP_MAP[`${gx},${gz},${lv}`];
    if (!chip) return lv * 5;
    for (let sy = 4; sy >= 0; sy--) {
      let hasFoothold = false;
      for (let sx = startS; sx <= endS; sx++) {
        for (let sz = startS; sz <= endS; sz++) {
          if (!chip[`${sx},${sy},${sz}`]) { hasFoothold = true; break; }
        }
        if (hasFoothold) break;
      }
      if (hasFoothold) return (lv - 1) * 5 + (sy + 1);
    }
  }
  return (AREA1_MIN_UNDER_LV - 1) * 5;
}

function getSurfaceYAt(gx, gz, lvOverride = null, reqWidth = 1) {
  if (gx < -2 || gx > 2 || gz < -2 || gz > 2) return -0.55;
  return getSurfaceSubUnitsForChar(gx, gz, reqWidth, lvOverride) * 0.20;
}

function getSurfaceSubUnits(gx, gz, lvOverride = null) {
  const eff = getEffectiveClearanceSpecs();
  return getSurfaceSubUnitsForChar(gx, gz, eff.reqWidth, lvOverride);
}

function evaluateBlockPassage(gx, gz, lv) {
  if (gx < -2 || gx > 2 || gz < -2 || gz > 2) return { openWidth: 5, openHeight: 5, hasCeiling: false };
  const topLv = HEIGHT_MAP[`${gx},${gz}`] ?? 0;
  if (lv >= topLv) return { openWidth: 5, openHeight: 5, hasCeiling: false };
  const blockLv = lv + 1;
  const chip = CHIP_MAP[`${gx},${gz},${blockLv}`];
  if (!chip) return { openWidth: 0, openHeight: 0, hasCeiling: true };

  let openHeight = 0, minWidthAtOpenLayers = 5;
  for (let sy = 0; sy < 5; sy++) {
    let carvedCount = 0;
    for (let sx = 0; sx < 5; sx++) for (let sz = 0; sz < 5; sz++) {
      if (chip[`${sx},${sy},${sz}`]) carvedCount++;
    }
    const approxWidth = Math.min(5, Math.floor(Math.sqrt(carvedCount)));
    if (approxWidth >= 1) {
      openHeight = sy + 1;
      minWidthAtOpenLayers = Math.min(minWidthAtOpenLayers, approxWidth);
    } else break;
  }
  const hasCeiling = (openHeight < 5) || (topLv > blockLv);
  return { openWidth: openHeight > 0 ? minWidthAtOpenLayers : 0, openHeight, hasCeiling };
}

// 🛡️【修正④】低いトンネル内で立ち上がって天井に頭がめり込むのを防ぐ安全姿勢判定
function getSafePostureAt(gx, gz, lv) {
  if (gx < -2 || gx > 2 || gz < -2 || gz > 2) return 'stand';
  const eff = getEffectiveClearanceSpecs();
  const pass = evaluateBlockPassage(gx, gz, lv);
  if (pass.hasCeiling && pass.openHeight > 0 && pass.openHeight < eff.standH) {
    return 'crawl';
  }
  return 'stand';
}

// 🛑【修正③】斜め移動・ほふく時の「角（コーナー）」当たり判定を含む移動チェック
function checkMoveAndPosture(gx, gz, curLv, dir) {
  const nx = gx + dir.dx, nz = gz + dir.dz;
  const effP = getEffectiveParams();
  if (nx < -2 || nx > 2 || nz < -2 || nz > 2) {
    const canJumpSea = (ROBOT.speed === 5) || (effP.cautionLimiter >= 80);
    return { canMove: canJumpSea, posture: 'stand', targetLv: -99, reason: 'sea', stepDiff: 0 };
  }
  const eff = getEffectiveClearanceSpecs();

  if (dir.isDiag) {
    const cornerA = evaluateBlockPassage(gx + dir.dx, gz, curLv);
    const cornerB = evaluateBlockPassage(gx, gz + dir.dz, curLv);
    const passA = (cornerA.openWidth >= eff.reqWidth) && (!cornerA.hasCeiling || cornerA.openHeight >= eff.crawlH);
    const passB = (cornerB.openWidth >= eff.reqWidth) && (!cornerB.hasCeiling || cornerB.openHeight >= eff.crawlH);
    if (!passA && !passB) {
      return { canMove: false, posture: ROBOT.posture, targetLv: curLv, reason: 'blocked_by_corner', stepDiff: 0 };
    }
  }

  const destTopLv = HEIGHT_MAP[`${nx},${nz}`] ?? 0;
  const curSubH = getSurfaceSubUnitsForChar(gx, gz, eff.reqWidth, curLv);
  const destSubH = getSurfaceSubUnitsForChar(nx, nz, eff.reqWidth, destTopLv);
  const diffSub = destSubH - curSubH;

  if (destTopLv > curLv) {
    const tunnelPass = evaluateBlockPassage(nx, nz, curLv);
    if (tunnelPass.hasCeiling && tunnelPass.openHeight >= eff.crawlH) {
      if (tunnelPass.openWidth >= eff.reqWidth) {
        const pMode = (tunnelPass.openHeight >= eff.standH) ? 'stand' : 'crawl';
        const tunnelSubH = getSurfaceSubUnitsForChar(nx, nz, eff.reqWidth, curLv);
        const tunnelDiff = tunnelSubH - curSubH;
        if (pMode === 'crawl' && tunnelDiff > 1) {
          return { canMove: false, posture: 'crawl', targetLv: curLv, reason: 'crawl_steep', stepDiff: tunnelDiff };
        }
        return { canMove: true, posture: pMode, targetLv: curLv, reason: pMode === 'crawl' ? 'crawl_tunnel' : 'open', stepDiff: tunnelDiff };
      } else {
        return { canMove: false, posture: ROBOT.posture, targetLv: curLv, reason: 'too_fat', stepDiff: 0 };
      }
    }
  }

  const surfacePass = evaluateBlockPassage(nx, nz, destTopLv);
  if (surfacePass.openWidth < eff.reqWidth) {
    return { canMove: false, posture: ROBOT.posture, targetLv: curLv, reason: 'too_fat', stepDiff: diffSub };
  }

  const safeDestPosture = getSafePostureAt(nx, nz, destTopLv);

  if (diffSub > 0) {
    if (ROBOT.posture === 'crawl' && diffSub > 1) {
      return { canMove: false, posture: 'crawl', targetLv: curLv, reason: 'crawl_steep', stepDiff: diffSub };
    }
    if (diffSub <= eff.stairMax) {
      return { canMove: true, posture: safeDestPosture, targetLv: destTopLv, reason: 'stairs_up', stepDiff: diffSub };
    }
    if (diffSub <= eff.subH) {
      return { canMove: true, posture: safeDestPosture, targetLv: destTopLv, reason: 'scramble_climb', stepDiff: diffSub };
    }
    return { canMove: false, posture: ROBOT.posture, targetLv: curLv, reason: 'too_high_step', stepDiff: diffSub };
  }

  const dropSub = -diffSub;
  if (dropSub === 0) {
    return { canMove: true, posture: safeDestPosture, targetLv: destTopLv, reason: 'open', stepDiff: 0 };
  }
  if (dropSub <= eff.stairMax) {
    return { canMove: true, posture: safeDestPosture, targetLv: destTopLv, reason: 'stairs_down', stepDiff: diffSub };
  }
  if (dropSub <= eff.subH) {
    return { canMove: true, posture: safeDestPosture, targetLv: destTopLv, reason: 'safe_landing', stepDiff: diffSub };
  }
  if (effP.cautionLimiter >= 70 || ROBOT.speed === 5) {
    return { canMove: true, posture: safeDestPosture, targetLv: destTopLv, reason: 'high_drop_damage', stepDiff: diffSub };
  }
  return { canMove: false, posture: ROBOT.posture, targetLv: curLv, reason: 'too_deep_cliff', stepDiff: diffSub };
}

function addSubStepFootholdAt(gx, gz, addSubCount = 2) {
  if (gx < -2 || gx > 2 || gz < -2 || gz > 2) return false;
  const topLv = HEIGHT_MAP[`${gx},${gz}`] ?? 0;
  const ck = `${gx},${gz},${topLv}`;
  const chip = CHIP_MAP[ck];

  if (chip && Object.keys(chip).length > 0) {
    let curSyTop = -1;
    for (let sy = 4; sy >= 0; sy--) {
      if (!chip[`2,${sy},2`]) { curSyTop = sy; break; }
    }
    const nextSyTop = Math.min(4, curSyTop + addSubCount);
    for (let sy = 0; sy <= nextSyTop; sy++) {
      for (let sx = 0; sx < 5; sx++) for (let sz = 0; sz < 5; sz++) {
        delete chip[`${sx},${sy},${sz}`];
      }
    }
    if (nextSyTop === 4) delete CHIP_MAP[ck];
    return true;
  } else {
    if (topLv >= AREA1_MAX_GROUND_LV) return false;
    const newLv = topLv + 1;
    HEIGHT_MAP[`${gx},${gz}`] = newLv;
    carveTopSubLayers(gx, gz, newLv, Math.min(5, addSubCount));
    ROBOT.pos.lv = newLv;
    return true;
  }
}

function carveFrontStepToClimbable(targetX, targetZ, curSubH, charSubH) {
  if (targetX < -2 || targetX > 2 || targetZ < -2 || targetZ > 2) return false;
  const topLv = HEIGHT_MAP[`${targetX},${targetZ}`] ?? 0;
  const desiredSubH = curSubH + charSubH;
  const baseSubOfTopLv = (topLv - 1) * 5;
  const keepLayers = Math.max(1, Math.min(4, desiredSubH - baseSubOfTopLv));
  carveTopSubLayers(targetX, targetZ, topLv, keepLayers);
  return true;
}

function digFromCharacterFront(gx, gz, curLv, dir, crawlMode = false, powerBoost = 50) {
  const eff = getEffectiveClearanceSpecs();
  if (dir && dir.isDiag) {
    const sideA = evaluateBlockPassage(gx + dir.dx, gz, curLv);
    const sideB = evaluateBlockPassage(gx, gz + dir.dz, curLv);
    if (sideA.openWidth < eff.reqWidth && sideB.openWidth < eff.reqWidth) {
      const sideDir = ALL_DIRS.find(d => d.dx === dir.dx && d.dz === 0) || ALL_DIRS[0];
      ROBOT.rotY = sideDir.rot;
      stepCharCloseToWallForDig(sideDir);
      const subRes = digFromCharacterFront(gx, gz, curLv, sideDir, crawlMode, powerBoost);
      subRes.blockedDiagFirst = true;
      subRes.sideDirName = sideDir.name;
      return subRes;
    }
  }

  stepCharCloseToWallForDig(dir);
  const tx = gx + (dir ? dir.dx : 0), tz = gz + (dir ? dir.dz : 0);
  const targetX = (tx >= -2 && tx <= 2) ? tx : gx;
  const targetZ = (tz >= -2 && tz <= 2) ? tz : gz;
  const topLv = HEIGHT_MAP[`${targetX},${targetZ}`] ?? 0;
  const digLv = (targetX !== gx || targetZ !== gz) && topLv > curLv ? (curLv + 1) : topLv;
  if (digLv <= AREA1_MIN_UNDER_LV && !CHIP_MAP[`${targetX},${targetZ},${digLv}`]) {
    return { completedLevel: false, newLv: digLv, leftCount: 0, isCrawlTunnel: false, targetX, targetZ };
  }

  const chipKey = `${targetX},${targetZ},${digLv}`;
  if (!CHIP_MAP[chipKey]) CHIP_MAP[chipKey] = {};

  const maxSy = crawlMode ? Math.max(0, eff.crawlH - 1) : Math.max(0, eff.subH - 1);
  const powerBonus = Math.max(1, Math.round((powerBoost || 50) / 35));
  const digCount = Math.max(1, eff.reqWidth * (maxSy + 1) * (eff.reqWidth >= 4 ? 3 : 2) * powerBonus);
  const charWorldX = gx + ((ROBOT.pos.sx ?? 2) - 2) * 0.20 + (dir ? dir.dx * 0.16 : 0);
  const charWorldZ = gz + ((ROBOT.pos.sz ?? 2) - 2) * 0.20 + (dir ? dir.dz * 0.16 : 0);

  const candidates = [];
  for (let sy = 0; sy <= 4; sy++) {
    for (let sx = 0; sx < 5; sx++) {
      for (let sz = 0; sz < 5; sz++) {
        if (CHIP_MAP[chipKey][`${sx},${sy},${sz}`]) continue;
        if (isWaterFacingOuterSubVoxel(targetX, targetZ, digLv, sx, sy, sz)) continue;
        const distFromHand = Math.hypot((targetX + (sx - 2) * 0.20) - charWorldX, (targetZ + (sz - 2) * 0.20) - charWorldZ);
        const heightPenalty = sy <= maxSy ? sy * 0.08 : (sy - maxSy) * 1.2;
        candidates.push({ sx, sy, sz, score: distFromHand + heightPenalty });
      }
    }
  }
  candidates.sort((a, b) => a.score - b.score);

  const actualCount = Math.min(digCount, candidates.length);
  for (let i = 0; i < actualCount; i++) {
    const c = candidates[i];
    CHIP_MAP[chipKey][`${c.sx},${c.sy},${c.sz}`] = 1;
  }

  let leftInnerCount = 0;
  for (let sy = 0; sy < 5; sy++) for (let sx = 0; sx < 5; sx++) for (let sz = 0; sz < 5; sz++) {
    if (isWaterFacingOuterSubVoxel(targetX, targetZ, digLv, sx, sy, sz)) continue;
    if (!CHIP_MAP[chipKey][`${sx},${sy},${sz}`]) leftInnerCount++;
  }

  const isEdgeCell = (targetX === -2 || targetX === 2 || targetZ === -2 || targetZ === 2);
  if (!crawlMode && leftInnerCount <= 8) {
    if (!isEdgeCell || digLv > 0) {
      delete CHIP_MAP[chipKey];
      if (digLv > AREA1_MIN_UNDER_LV) HEIGHT_MAP[`${targetX},${targetZ}`] = digLv - 1;
      return { completedLevel: true, newLv: HEIGHT_MAP[`${targetX},${targetZ}`], leftCount: 0, isCrawlTunnel: false, targetX, targetZ };
    } else {
      for (let sy = 0; sy < 5; sy++) for (let sx = 0; sx < 5; sx++) for (let sz = 0; sz < 5; sz++) {
        if (!isWaterFacingOuterSubVoxel(targetX, targetZ, digLv, sx, sy, sz)) {
          CHIP_MAP[chipKey][`${sx},${sy},${sz}`] = 1;
        }
      }
      return { completedLevel: true, newLv: digLv - 1, leftCount: 0, isCrawlTunnel: false, targetX, targetZ };
    }
  }
  const pass = evaluateBlockPassage(targetX, targetZ, digLv - 1);
  const isCrawlReady = (pass.hasCeiling && pass.openHeight >= eff.crawlH && pass.openWidth >= eff.reqWidth);
  return { completedLevel: false, newLv: digLv, leftCount: leftInnerCount, isCrawlTunnel: isCrawlReady, targetX, targetZ };
}

function digUnderneathAndFall() {
  const { x, z } = ROBOT.pos;
  if (x < -2 || x > 2 || z < -2 || z > 2) return null;
  const eff = getEffectiveClearanceSpecs();
  const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const beforeSubH = getSurfaceSubUnitsForChar(x, z, eff.reqWidth, ROBOT.pos.lv);
  const topLv = HEIGHT_MAP[`${x},${z}`] ?? 0;
  const startS = Math.floor((5 - eff.reqWidth) / 2), endS = startS + eff.reqWidth - 1;
  ROBOT.pos.sx = 2; ROBOT.pos.sz = 2;

  let dugLayers = 0;
  const targetDropLayers = Math.max(1, eff.subH);
  for (let lv = topLv; lv >= AREA1_MIN_UNDER_LV && dugLayers < targetDropLayers; lv--) {
    const ck = `${x},${z},${lv}`;
    if (!CHIP_MAP[ck]) CHIP_MAP[ck] = {};
    for (let sy = 4; sy >= 0 && dugLayers < targetDropLayers; sy--) {
      let hasSolid = false;
      for (let sx = startS; sx <= endS; sx++) {
        for (let sz = startS; sz <= endS; sz++) {
          if (!CHIP_MAP[ck][`${sx},${sy},${sz}`] && !isWaterFacingOuterSubVoxel(x, z, lv, sx, sy, sz)) hasSolid = true;
        }
      }
      if (hasSolid) {
        for (let sx = startS; sx <= endS; sx++) {
          for (let sz = startS; sz <= endS; sz++) {
            if (!isWaterFacingOuterSubVoxel(x, z, lv, sx, sy, sz)) CHIP_MAP[ck][`${sx},${sy},${sz}`] = 1;
          }
        }
        dugLayers++;
      }
    }
    if (eff.reqWidth === 5 && dugLayers >= 5 && !(Math.abs(x) === 2 || Math.abs(z) === 2)) {
      delete CHIP_MAP[ck];
      if (lv > AREA1_MIN_UNDER_LV) HEIGHT_MAP[`${x},${z}`] = lv - 1;
    }
  }

  const afterSubH = getSurfaceSubUnitsForChar(x, z, eff.reqWidth, null);
  const dropSub = Math.max(0, beforeSubH - afterSubH);
  ROBOT.pos.lv = Math.ceil(afterSubH / 5);
  ROBOT.posture = getSafePostureAt(x, z, ROBOT.pos.lv);
  return { dropSub, sSpec, bSpec, reqWidth: eff.reqWidth };
}

function hasSubVoxel(gx, gz, lv, sx, sy, sz) {
  if (gx < -2 || gx > 2 || gz < -2 || gz > 2) return false;
  const topLv = HEIGHT_MAP[`${gx},${gz}`] ?? 0;
  if (lv < AREA1_MIN_UNDER_LV || lv > topLv) return false;
  const chip = CHIP_MAP[`${gx},${gz},${lv}`];
  if (chip && chip[`${sx},${sy},${sz}`]) return false;
  return true;
}

function isExposedSubVoxel(gx, gz, lv, sx, sy, sz) {
  const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for (let i = 0; i < 6; i++) {
    let nsx = sx + dirs[i][0], nsy = sy + dirs[i][1], nsz = sz + dirs[i][2];
    let ngx = gx, ngz = gz, nlv = lv;
    if (nsx < 0) { ngx--; nsx = 4; } else if (nsx > 4) { ngx++; nsx = 0; }
    if (nsz < 0) { ngz--; nsz = 4; } else if (nsz > 4) { ngz++; nsz = 0; }
    if (nsy < 0) { nlv--; nsy = 4; } else if (nsy > 4) { nlv++; nsy = 0; }
    if (ngx !== gx || ngz !== gz || nlv !== lv) return true;
    if (!hasSubVoxel(ngx, ngz, nlv, nsx, nsy, nsz)) return true;
  }
  return false;
}

function isAdjacentToCarvedCavity(chippedSet, sx, sy, sz) {
  if (!chippedSet) return false;
  const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for (let i = 0; i < 6; i++) {
    const nsx = sx + dirs[i][0], nsy = sy + dirs[i][1], nsz = sz + dirs[i][2];
    if (nsx >= 0 && nsx <= 4 && nsy >= 0 && nsy <= 4 && nsz >= 0 && nsz <= 4) {
      if (chippedSet[`${nsx},${nsy},${nsz}`]) return true;
    }
  }
  return false;
}

function getRobotHeightLevel() {
  const { x, z } = ROBOT.pos;
  if (x < -2 || x > 2 || z < -2 || z > 2) return -99;
  return Number.isFinite(ROBOT.pos.lv) ? ROBOT.pos.lv : (HEIGHT_MAP[`${x},${z}`] ?? 0);
}

function formatHeightText(lv) {
  if (lv === -99) return '海の白波';
  if (lv >= 1) return `地上${lv}段目(全5段)`;
  if (lv === 0) return '地下1層目(地表:緑＋土)';
  return `地下${Math.abs(lv) + 1}層目(湿土・全5層)`;
}

function getActiveBrainBadgeText() {
  const aiType = safeStorage.getItem('ai_type') || 'none';
  if (aiType === 'gemini' && safeStorage.getItem('api_gemini')) return '🟦 Gemini待機中';
  if (aiType === 'groq' && safeStorage.getItem('api_groq')) return '🟪 Groq待機中';
  return '🟩 アルゴン待機中';
}

function getStyleShortName() {
  if (CAM_VISUAL_STYLE === 'hide') return '観察窓くっきり';
  if (CAM_VISUAL_STYLE === 'glass_line') return '観察窓＋5×5線';
  return '観察窓ガラス';
}

// ============================================================================
// 【コア⑤：最小限・奇想天外プロンプトAPI通信（ハプニング時のみ呼び出し）】
// ============================================================================
async function callMinimalLLMApi(shortPromptText) {
  const aiType = safeStorage.getItem('ai_type') || 'none';
  if (aiType === 'none') return null;
  try {
    if (aiType === 'gemini') {
      const key = safeStorage.getItem('api_gemini');
      if (!key) return null;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: shortPromptText }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (raw) return JSON.parse(raw);
    } else if (aiType === 'groq') {
      const key = safeStorage.getItem('api_groq');
      if (!key) return null;
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: shortPromptText }],
          response_format: { type: 'json_object' },
          max_tokens: 140
        })
      });
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content;
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Minimal API call error:', e);
  }
  return null;
}

// 🌀 一覧ウィンドウでONになっているハプニング時のみ、50〜80文字の最小プロンプトをAPIへ送る
async function askAIQuirkyReaction(categoryId, factSummary) {
  const conf = QUIRKY_PROMPTS_MAP[categoryId];
  if (!conf || !conf.enabled) return null;
  const basePersona = (QUIRKY_PROMPTS_MAP.base_persona && QUIRKY_PROMPTS_MAP.base_persona.enabled)
    ? QUIRKY_PROMPTS_MAP.base_persona.prompt
    : '';
  const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;

  const minimalPrompt = `${basePersona}
体格:${sSpec.label}(高${sSpec.subH})・${bSpec.label}(幅${bSpec.reqWidth})
今起きた事実:${factSummary}
お題:${conf.prompt}
JSONのみ出力:{"emotion":"joy/anger/sad/fun/fear/shiver/hot/think/surprise/wave/sleep/struggleのいずれか","thought":"奇想天外な心の声(1文)"}`;

  return await callMinimalLLMApi(minimalPrompt);
}

// 🛡️【修正⑥】物理アクションポーズの優先ロックを守りながらAIのセリフと電球色を反映する
function applyQuirkyAIResultToRobot(aiRes, lockPhysicalPose = false) {
  if (!aiRes) {
    ROBOT.bulbEmotion = null;
    applyRobotBulbColor();
    return null;
  }
  const pickedEmo = POSE_TABLE[aiRes.emotion] ? aiRes.emotion : matchExpressionFromText(aiRes.thought, ROBOT.emotion);
  if (lockPhysicalPose || LOCKED_PHYSICAL_POSES.includes(ROBOT.emotion)) {
    // 体の動き（よじ登り・着地・壁掘りなど）は固定し、頭の電球の色だけAIの感情に光らせる
    ROBOT.bulbEmotion = pickedEmo;
  } else {
    ROBOT.emotion = pickedEmo;
    ROBOT.bulbEmotion = null;
  }
  applyRobotBulbColor();
  return (typeof aiRes.thought === 'string' && aiRes.thought.trim()) ? aiRes.thought.trim() : null;
}

// ============================================================================
// 【メインターン実行：行動決定は100%物理計算・ハプニング時のみ奇想天外API】
// ============================================================================
async function executeTurn() {
  const btn = document.getElementById('btn-action'); btn.disabled = true;
  document.getElementById('ai-status').innerText = '⚡ 物理計算中...';
  ROBOT.bulbEmotion = null;
  updateEnvironmentAndUI();

  if (++TIME_STEP >= 20) { TIME_STEP = 0; GAME_DAY++; DIARY_LOGS.push(`🌅 ${GAME_DAY}日目の朝を迎えたよ！`); }

  const curH = getRobotHeightLevel();
  const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  let thoughtText = '', actionLabel = '';
  let quirkyCategory = null, quirkyFact = '', lockPose = false;

  if (curH === -99) {
    ROBOT.pos.x = Math.max(-2, Math.min(2, ROBOT.pos.x));
    ROBOT.pos.z = Math.max(-2, Math.min(2, ROBOT.pos.z));
    ROBOT.pos.lv = HEIGHT_MAP[`${ROBOT.pos.x},${ROBOT.pos.z}`] ?? 0;
    ROBOT.pos.sx = 2; ROBOT.pos.sz = 2;
    ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, ROBOT.pos.lv);
    ROBOT.emotion = 'surprise';
    life.stamina -= 18; life.mental -= 15;
    addTraumaById('sea', true);
    actionLabel = '🌊 白波で大ダメージ！「海トラウマ」発症';
    thoughtText = 'うわぁぁっ！！海の白い波に飲まれて大ダメージを受けたよ…！「🌊海トラウマ」になっちゃった！';
    quirkyCategory = 'trauma_panic';
    quirkyFact = '海の白波に飲まれて海トラウマ発症';
  } else {
    const isAtSeaEdge = (Math.abs(ROBOT.pos.x) === 2 || Math.abs(ROBOT.pos.z) === 2);
    const moveEvaluations = ALL_DIRS.map(d => ({
      dir: d,
      check: checkMoveAndPosture(ROBOT.pos.x, ROBOT.pos.z, curH, d)
    }));
    const validMoves = moveEvaluations.filter(m => m.check.canMove);
    const blockedByFat = moveEvaluations.find(m => m.check.reason === 'too_fat');
    const blockedByHighStep = moveEvaluations.find(m => m.check.reason === 'too_high_step');
    const blockedByCrawlSteep = moveEvaluations.find(m => m.check.reason === 'crawl_steep');
    const blockedByCorner = moveEvaluations.find(m => m.check.reason === 'blocked_by_corner');

    if (blockedByFat) addTraumaById('narrow', true);
    if (curH >= 3 && Math.random() < 0.45) addTraumaById('height', true);
    if (TIME_STEP >= 14 && Math.random() < 0.22) addTraumaById('monster', true);

    const effP = getEffectiveParams();

    // 100%アプリの物理計算と裏パラメータのみで行動を決定（矛盾ゼロ）
    let chosenMove = null, wantDig = false, wantCrawlDig = false, wantRest = false;
    let wantSolveHighStep = false, wantSolveNarrow = false, wantSolveCorner = false, wantObserveWonder = false;
    let traumaReaction = null;

    if (hasTrauma('height') && curH >= 2 && Math.random() < 0.75) {
      traumaReaction = 'height';
    } else if (hasTrauma('sea') && isAtSeaEdge && Math.random() < 0.75) {
      traumaReaction = 'sea';
    } else if (hasTrauma('overwork') && Math.random() < 0.60) {
      traumaReaction = 'overwork';
    } else if (hasTrauma('monster') && TIME_STEP >= 13 && Math.random() < 0.65) {
      traumaReaction = 'monster';
    }

    const restThreshold = 20 + Math.round(effP.eco * 0.38);
    if (!traumaReaction) {
      if (life.stamina <= restThreshold) {
        wantRest = true;
      } else if (blockedByHighStep && Math.random() < 0.72) {
        wantSolveHighStep = true;
      } else if (blockedByFat && Math.random() < 0.75) {
        wantSolveNarrow = true;
      } else if (blockedByCorner && Math.random() < 0.75) {
        wantSolveCorner = true;
      } else if ((isAtSeaEdge || TIME_STEP >= 13) && Math.random() < 0.28) {
        wantObserveWonder = true;
      } else {
        const stepMoves = validMoves.filter(m => ['scramble_climb', 'stairs_up', 'safe_landing', 'stairs_down'].includes(m.check.reason));
        const apple = WORLD_ITEMS.find(it => it.type === 'apple');
        if (stepMoves.length > 0 && Math.random() < 0.65) {
          chosenMove = stepMoves[Math.floor(Math.random() * stepMoves.length)];
        } else if (apple && validMoves.length && !hasTrauma('stomach')) {
          validMoves.sort((a, b) => Math.hypot(ROBOT.pos.x + a.dir.dx - apple.x, ROBOT.pos.z + a.dir.dz - apple.z) - Math.hypot(ROBOT.pos.x + b.dir.dx - apple.x, ROBOT.pos.z + b.dir.dz - apple.z));
          chosenMove = validMoves[0];
        } else if (validMoves.length) {
          chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        } else {
          wantDig = true;
        }
      }
    }

    if (traumaReaction === 'height') {
      ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, curH);
      ROBOT.emotion = 'shiver';
      actionLabel = `🧗 高所トラウマ発動(裏警戒:${effP.cautionLimiter})：足がすくむ`;
      thoughtText = `「🧗高所トラウマ」で裏の警戒リミッターが0になっちゃった！高い場所が怖くて足がガタガタ震えるよ〜😭`;
      quirkyCategory = 'trauma_panic';
      quirkyFact = `地上${curH}段目で高所トラウマ発動`;
    } else if (traumaReaction === 'sea') {
      const inlandMoves = validMoves.filter(m => m.check.reason !== 'sea' && Math.abs(ROBOT.pos.x + m.dir.dx) <= 1 && Math.abs(ROBOT.pos.z + m.dir.dz) <= 1);
      if (inlandMoves.length > 0) {
        const esc = inlandMoves[Math.floor(Math.random() * inlandMoves.length)];
        ROBOT.pos.x += esc.dir.dx; ROBOT.pos.z += esc.dir.dz; ROBOT.pos.lv = esc.check.targetLv; ROBOT.rotY = esc.dir.rot;
        ROBOT.pos.sx = 2; ROBOT.pos.sz = 2;
      }
      ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, ROBOT.pos.lv);
      ROBOT.emotion = 'fear';
      actionLabel = `🌊 海トラウマ発動：内陸へ避難`;
      thoughtText = `「🌊海トラウマ」で白波が怖くて内陸へ後ずさりしたよ😰`;
      quirkyCategory = 'trauma_panic';
      quirkyFact = '海の近くで海トラウマが発動して後ずさり';
    } else if (traumaReaction === 'overwork') {
      ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, curH);
      ROBOT.emotion = 'sleep';
      life.stamina += 30; ROBOT.workStreak = 0;
      actionLabel = `⛏️ 過労トラウマ発動：サボって居眠り`;
      thoughtText = `「⛏️過労トラウマ」で省エネ駆動がMAXだよ！腰が痛いからサボって居眠りしちゃうよ…💤`;
      quirkyCategory = 'trauma_panic';
      quirkyFact = '働きすぎの過労トラウマでサボり居眠り';
    } else if (traumaReaction === 'monster') {
      ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, curH);
      ROBOT.emotion = 'surprise';
      actionLabel = `👻 ビックリ生物トラウマ：暗闇でパニック`;
      thoughtText = `「👻ビックリ生物トラウマ」で暗闇にお化けや虫がいそうでパニックだよ😲`;
      quirkyCategory = 'trauma_panic';
      quirkyFact = '夜の暗闇でビックリ生物トラウマ発動';
    } else if (wantObserveWonder) {
      // 🌌 ステージ固有ギミック（4つの星座・滝・巨大亀）の観察アクション
      ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, curH);
      ROBOT.emotion = 'peek';
      lockPose = true;
      life.mental = Math.min(100, life.mental + 15);
      if (TIME_STEP >= 13) {
        const constellations = ['🦢はくちょう座', '👑カシオペア座', '🥄北斗七星', '🏹オリオン座'];
        const pickedStar = constellations[Math.floor(Math.random() * constellations.length)];
        actionLabel = `🌌 夜空の星座観察：「${pickedStar}」を見上げた！`;
        thoughtText = `わぁ〜！夜空を見上げたらキラキラ光る「${pickedStar}」を見つけたよ！宇宙って不思議だな〜✨`;
        quirkyCategory = 'stage_wonder';
        quirkyFact = `夜空に輝く${pickedStar}を発見して見上げた`;
      } else {
        const isTurtle = Math.random() < 0.5;
        actionLabel = isTurtle ? `🐢 島の端からのぞき込み：地下の「巨大な亀」を発見！` : `🌊 島の端からのぞき込み：「大滝と白波」を観察！`;
        thoughtText = isTurtle
          ? `島の端っこから下をのぞき込んだら、この島を背中で支えている「巨大な亀さん」と目が合ったよ！`
          : `島の端から勢いよく流れ落ちる大滝と白い水しぶきをのぞき込んだよ！マイナスイオンたっぷり！`;
        quirkyCategory = 'stage_wonder';
        quirkyFact = isTurtle ? '島を背中で支える巨大な亀を下に見つけた' : '島の端の大滝と水しぶきをのぞき込んだ';
      }
      DIARY_LOGS.push(`🔍 ${GAME_DAY}日目：${actionLabel}`);
    } else if (wantSolveCorner && blockedByCorner) {
      const d = blockedByCorner.dir;
      const sideDir = ALL_DIRS.find(dxz => dxz.dx === d.dx && dxz.dz === 0) || ALL_DIRS[0];
      ROBOT.rotY = sideDir.rot;
      stepCharCloseToWallForDig(sideDir);
      digFromCharacterFront(ROBOT.pos.x, ROBOT.pos.z, curH, sideDir, ROBOT.posture === 'crawl', effP.power);
      ROBOT.emotion = 'swing_v';
      lockPose = true;
      actionLabel = `📐 角抜けエラー解決(${bSpec.label})：邪魔な${sideDir.name}の角壁を削った！`;
      thoughtText = `斜め(${d.name})に進みたいのに角の壁がおなかに引っかかる！邪魔な${sideDir.name}の壁から削ってやるーっ😡`;
      quirkyCategory = 'corner_hit';
      quirkyFact = `${d.name}へ進もうとして角の壁に引っかかり、${sideDir.name}の壁を削り始めた`;
      DIARY_LOGS.push(`⛏️ ${GAME_DAY}日目：斜めに進むため邪魔な角の壁を削った！`);
    } else if (wantSolveHighStep && blockedByHighStep) {
      const d = blockedByHighStep.dir;
      ROBOT.rotY = d.rot;
      const stoneIdx = BAG.indexOf('stone');
      if (stoneIdx !== -1 && Math.random() < 0.6) {
        BAG.splice(stoneIdx, 1);
        addSubStepFootholdAt(ROBOT.pos.x, ROBOT.pos.z, Math.max(1, sSpec.subH));
        ROBOT.pos.sx = 2; ROBOT.pos.sz = 2;
        ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, ROBOT.pos.lv);
        ROBOT.emotion = 'carry';
        lockPose = true;
        actionLabel = `🪜 段差エラー解決(${sSpec.label}・高${sSpec.subH})：カバンの石で足元に踏み台を積んだ！`;
        thoughtText = `${d.name}の段差(分割${blockedByHighStep.check.stepDiff}ブロック)が身長(分割${sSpec.subH})より高くて登れないから、石で踏み台を積んだよ！`;
        quirkyCategory = 'high_wall';
        quirkyFact = `目の前の高さ${blockedByHighStep.check.stepDiff}段の壁が登れず、石で踏み台を積んだ`;
        DIARY_LOGS.push(`🪜 ${GAME_DAY}日目：高い段差を登るために石で踏み台を作った！`);
      } else {
        stepCharCloseToWallForDig(d);
        const curSubH = getSurfaceSubUnits(ROBOT.pos.x, ROBOT.pos.z, curH);
        carveFrontStepToClimbable(ROBOT.pos.x + d.dx, ROBOT.pos.z + d.dz, curSubH, sSpec.subH);
        ROBOT.emotion = 'swing_v';
        lockPose = true;
        actionLabel = `⛏️ 段差エラー解決(${sSpec.label}・高${sSpec.subH})：${d.name}の壁の手前に立って階段に削った！`;
        thoughtText = `${d.name}の壁が高すぎて登れないから、壁の手前に立ってよじ登れる高さまで階段状に削ったよ！`;
        quirkyCategory = 'high_wall';
        quirkyFact = `目の前の壁が高すぎて登れず、壁を削って階段にした`;
        DIARY_LOGS.push(`⛏️ ${GAME_DAY}日目：壁の手前に立って自分の身長に合う階段を削った！`);
      }
    } else if (wantSolveNarrow && blockedByFat) {
      const d = blockedByFat.dir;
      ROBOT.rotY = d.rot;
      const oilIdx = BAG.indexOf('oil');
      if (oilIdx !== -1) {
        BAG.splice(oilIdx, 1);
        ROBOT.pos.x += d.dx; ROBOT.pos.z += d.dz;
        ROBOT.pos.sx = 2; ROBOT.pos.sz = 2;
        ROBOT.posture = 'crawl';
        ROBOT.emotion = 'joy';
        ROBOT.traumas = (ROBOT.traumas || []).filter(t => t !== 'narrow');
        actionLabel = `🧴 太さエラー解決(${bSpec.label}・幅${bSpec.reqWidth})：スライムオイルで狭い穴をツルッと突破！`;
        thoughtText = `太さ「${bSpec.label}(幅${bSpec.reqWidth})」で穴につかえたけど、🧴スライムオイルを塗ってツルッと滑り抜けたよ！`;
        quirkyCategory = 'narrow_hole';
        quirkyFact = `狭い穴にお腹がつかえたがオイルを塗って滑り抜けた`;
        DIARY_LOGS.push(`🧴 ${GAME_DAY}日目：スライムオイルで狭い穴を滑り抜けてトラウマ克服！`);
      } else {
        stepCharCloseToWallForDig(d);
        carveCrawlTunnelBlock(ROBOT.pos.x + d.dx, ROBOT.pos.z + d.dz, curH + 1, bSpec.reqWidth, Math.max(2, sSpec.crawlH));
        ROBOT.emotion = 'push';
        lockPose = true;
        actionLabel = `👐 太さエラー解決(${bSpec.label}・幅${bSpec.reqWidth})：狭い穴を自分の太さに削り広げた！`;
        thoughtText = `狭い穴にお腹がつかえて動けないから、${d.name}の穴を幅${bSpec.reqWidth}ブロック分まで削り広げたよ！`;
        quirkyCategory = 'narrow_hole';
        quirkyFact = `狭い穴にお腹がつかえて通れず、必死に壁を削り広げた`;
      }
    } else if (wantRest) {
      life.stamina += 35; life.energy -= 5; life.mental += 10;
      // 🛡️【修正④】低いトンネル内ならほふく姿勢を維持して天井貫通を防ぐ
      ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, curH);
      ROBOT.workStreak = 0;
      ROBOT.emotion = (life.energy <= 30) ? 'sad' : 'sleep';
      actionLabel = `💤 省エネ休憩（姿勢:${ROBOT.posture === 'crawl' ? 'ほふく維持' : '立ち'}）`;
      thoughtText = ROBOT.posture === 'crawl'
        ? `天井が低いトンネルの中だから、頭をぶつけないようにほふく前進のままコックリ居眠り中だよ…💤`
        : `マイペースにコックリ居眠りしてバッテリー温存中だよ…💤`;
    } else if (wantDig) {
      const digDir = ALL_DIRS[Math.floor(Math.random() * ALL_DIRS.length)];
      ROBOT.rotY = digDir.rot;
      const digRes = digFromCharacterFront(ROBOT.pos.x, ROBOT.pos.z, curH, digDir, wantCrawlDig || ROBOT.posture === 'crawl', effP.power);
      life.stamina -= 9; life.mental += 10;
      ROBOT.workStreak = (ROBOT.workStreak || 0) + 1;
      if (ROBOT.workStreak >= 3 && life.stamina <= 55) addTraumaById('overwork', true);

      ROBOT.emotion = 'swing_v';
      lockPose = true;
      if (digRes.blockedDiagFirst) {
        actionLabel = `📐 斜め奥は角壁が邪魔！まず${digRes.sideDirName}の壁を幅${bSpec.reqWidth}で削った`;
        thoughtText = `斜め奥を掘ろうとしたけど手前の角壁が邪魔だから、まず${digRes.sideDirName}の壁の手前に立って削ったよ！`;
        quirkyCategory = 'corner_hit';
        quirkyFact = `斜め掘りで手前の角に引っかかり${digRes.sideDirName}の壁を削った`;
      } else if (digRes.completedLevel) {
        if (BAG.length < 10) BAG.push('stone');
        if (digRes.targetX === ROBOT.pos.x && digRes.targetZ === ROBOT.pos.z) ROBOT.pos.lv = digRes.newLv;
        ROBOT.emotion = 'joy';
        lockPose = false;
        actionLabel = `⛏️ ${digDir.name}を掘り抜いて${formatHeightText(digRes.newLv)}開通！`;
        thoughtText = `${digDir.name}の壁を掘り抜いて道が開通したよ！カバンに🪨石素材をゲット！`;
      } else {
        actionLabel = `⛏️ ${digDir.name}の壁の手前で掘削中(幅${bSpec.reqWidth}×高${sSpec.subH}・残${digRes.leftCount})`;
        thoughtText = `${digDir.name}の壁の手前にピタッと立って、ボクのサイズ(幅${bSpec.reqWidth}×高${sSpec.subH})で土を削っているよ！`;
      }
    } else if (chosenMove) {
      const d = chosenMove.dir, chk = chosenMove.check;
      ROBOT.pos.x += d.dx; ROBOT.pos.z += d.dz; ROBOT.pos.lv = chk.targetLv;
      ROBOT.pos.sx = 2; ROBOT.pos.sz = 2; ROBOT.rotY = d.rot; ROBOT.posture = chk.posture;

      life.energy -= 6; life.stamina -= 7; life.mental += 10;

      if (chk.reason === 'scramble_climb') {
        ROBOT.emotion = 'struggle';
        lockPose = true;
        life.stamina -= 4;
        actionLabel = `🧗 バタバタよじ登り(${sSpec.label}:高${sSpec.subH})：分割${chk.stepDiff}ブロックの段差を登った！`;
        thoughtText = `分割${chk.stepDiff}ブロックの段差はボク(${sSpec.label}・高${sSpec.subH})には壁だから、足をバタバタさせて一生けんめいよじ登ったよ！`;
        DIARY_LOGS.push(`🧗 ${GAME_DAY}日目：${sSpec.label}(高${sSpec.subH})で分割${chk.stepDiff}ブロックの段差をバタバタよじ登った！`);
      } else if (chk.reason === 'stairs_up') {
        ROBOT.emotion = 'fun';
        actionLabel = `🪜 スイスイ階段上り(${sSpec.label}:高${sSpec.subH})：分割${chk.stepDiff}ブロック段差を通過`;
        thoughtText = `分割${chk.stepDiff}ブロックの段差なら、${sSpec.label}(高さ${sSpec.subH})のボクにはスイスイ歩ける階段だよ♪`;
      } else if (chk.reason === 'safe_landing') {
        ROBOT.emotion = 'pickup';
        lockPose = true;
        actionLabel = `🦸 着地ポーズで安全降下(${sSpec.label}:高${sSpec.subH})：分割${Math.abs(chk.stepDiff)}ブロック下りた！`;
        thoughtText = `分割${Math.abs(chk.stepDiff)}ブロックの高さから飛び降りて、シュタッ！と着地ポーズでカッコよく降りたよ！`;
        quirkyCategory = 'gravity_fall';
        quirkyFact = `分割${Math.abs(chk.stepDiff)}ブロックの段差を飛び降りて着地ポーズを決めた`;
      } else if (chk.reason === 'stairs_down') {
        ROBOT.emotion = 'normal';
        actionLabel = `🪜 スイスイ階段下り(${sSpec.label}:高${sSpec.subH})：分割${Math.abs(chk.stepDiff)}ブロック下りた`;
        thoughtText = `小さな段差をトントンと階段みたいに歩いて下りたよ！`;
      } else if (chk.reason === 'high_drop_damage') {
        ROBOT.emotion = 'surprise';
        life.stamina -= 16; life.mental -= 12;
        addTraumaById('height', true);
        actionLabel = `💥 身長超えの崖(${Math.abs(chk.stepDiff)}段)から重力落下！ダメージ＆高所トラウマ`;
        thoughtText = `わわっ！！自分の身長(分割${sSpec.subH}ブロック)より高い${Math.abs(chk.stepDiff)}ブロックの崖から落ちてお尻をぶつけたよ…！「🧗高所トラウマ」になっちゃった😭`;
        quirkyCategory = 'gravity_fall';
        quirkyFact = `身長より深い${Math.abs(chk.stepDiff)}段の崖から重力落下してお尻をぶつけた`;
      } else if (chk.posture === 'crawl') {
        ROBOT.emotion = 'fun';
        actionLabel = `🐛 ほふく前進(高${sSpec.crawlH}×幅${bSpec.reqWidth})で通過！`;
        thoughtText = `高さを半分(分割${sSpec.crawlH}ブロック)に丸めて「ほふく前進」で${d.name}へくぐり抜けたよ！`;
      } else {
        ROBOT.emotion = (effP.curiosity >= 75 || ROBOT.speed === 5) ? 'run' : 'fun';
        actionLabel = `👟 ${d.name}へ移動（${sSpec.label}高${sSpec.subH}・${bSpec.label}幅${bSpec.reqWidth}）`;
        thoughtText = `${d.name}へ進んだよ！自分より狭い穴の上なら引っかかって落ちずに歩けるよ！`;
      }
    }
  }

  // 🛡️【修正⑤】アイテム取得の「高さ（Y軸）」一致判定（地下トンネルから地上のリンゴを貫通取得するバグを防止）
  const charSubY = getSurfaceSubUnitsForChar(ROBOT.pos.x, ROBOT.pos.z, bSpec.reqWidth, getRobotHeightLevel());
  const itemIdx = WORLD_ITEMS.findIndex(it => {
    if (it.x !== ROBOT.pos.x || it.z !== ROBOT.pos.z) return false;
    const itemSubY = getSurfaceSubUnitsForChar(it.x, it.z, 3, null);
    return Math.abs(charSubY - itemSubY) <= 1;
  });

  if (itemIdx !== -1) {
    const targetItem = WORLD_ITEMS[itemIdx];
    const safePostureHere = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, getRobotHeightLevel());
    if (targetItem.type === 'apple' && hasTrauma('stomach') && Math.random() < 0.72) {
      ROBOT.posture = safePostureHere;
      ROBOT.emotion = 'fear';
      actionLabel = '🤢 はらいたトラウマ発動！リンゴを食べずに後ずさり';
      thoughtText = '足元に🍎リンゴがあるけど、「🤢はらいたトラウマ」でおなかが痛くなるのが怖くて食べられないよ〜！';
      quirkyCategory = 'trauma_panic';
      quirkyFact = 'リンゴを見つけたが、はらいたトラウマで怖くて食べられない';
    } else {
      const picked = WORLD_ITEMS.splice(itemIdx, 1)[0];
      if (picked.type === 'apple') {
        if (Math.random() < 0.16) {
          life.energy += 15; life.mental -= 12;
          ROBOT.posture = safePostureHere;
          ROBOT.emotion = 'sad';
          addTraumaById('stomach', true);
          actionLabel = '🤢 傷んだリンゴでおなかイタイ！「はらいたトラウマ」発症';
          thoughtText = 'うぅぅ…食べたリンゴが傷んでいておなかが痛くなっちゃった…！「🤢はらいたトラウマ」になっちゃったよ😭';
          quirkyCategory = 'trauma_panic';
          quirkyFact = '傷んだリンゴを食べておなかを壊し、はらいたトラウマ発症';
        } else {
          life.energy += 45; life.mental += 15;
          ROBOT.posture = safePostureHere;
          ROBOT.emotion = 'joy';
          ROBOT.traumas = (ROBOT.traumas || []).filter(t => t !== 'stomach');
          actionLabel = '🍎 おいしいリンゴを食べて大喜び！';
          thoughtText = 'わーい！！甘くておいしいリンゴを食べたよ！嬉しくてバンザイジャンプ！！';
        }
      } else {
        if (BAG.length < 10) BAG.push(picked.type);
        life.mental += 10;
        ROBOT.posture = safePostureHere;
        ROBOT.emotion = 'pickup';
        lockPose = true;
        actionLabel = `🤲 アイテムをしゃがんでカバンに拾った`;
        thoughtText = '足元にいいものが落ちていたから、しゃがんでカバンに拾ったよ！';
      }
    }
  }

  // 🌀 ハプニング（一覧でONの項目）が起きた時だけ最小限のAPI通信を実行！
  if (quirkyCategory && quirkyFact) {
    document.getElementById('ai-status').innerText = '🌀 奇想天外API通信中...';
    const aiRes = await askAIQuirkyReaction(quirkyCategory, quirkyFact);
    const customThought = applyQuirkyAIResultToRobot(aiRes, lockPose);
    if (customThought) {
      thoughtText = customThought;
    }
  } else {
    applyRobotBulbColor();
  }

  if (thoughtText) DIARY_LOGS.push(`💭 ${GAME_DAY}日目：${thoughtText}`);

  if (manualCameraMode === 'robot') resetFpvToRobotFront();
  document.getElementById('history-action').innerText = actionLabel;
  document.getElementById('message-box').innerText = thoughtText;

  rebuildTerrainAndItems(); syncRobot3DPosition(); applyRobotBulbColor(); cameraDirty = true; updateEnvironmentAndUI(); saveWorldState();

  if (life.getState().mode === 'DEAD') {
    ROBOT.emotion = 'sad';
    document.getElementById('message-box').innerText = `力尽きて倒れてしまった…。パラメータとトラウマ記憶を引き継ぎ、次の1号機（第${ROBOT.gen + 1}世代）が誕生します！`;
    setTimeout(() => {
      ROBOT.gen += 1; ROBOT.pos = { x: 0, z: 0, lv: -1, sx: 2, sz: 2 }; ROBOT.rotY = Math.PI; ROBOT.posture = 'stand'; ROBOT.emotion = 'joy'; ROBOT.bulbEmotion = null;
      GAME_DAY = 1; TIME_STEP = 0; life = new LifeCore();
      DIARY_LOGS.push(`📖 記憶を引き継いで1号機（第${ROBOT.gen}世代）が誕生した！`);
      if (!WORLD_ITEMS.length) WORLD_ITEMS.push({ type: 'apple', x: -1, z: 1 });
      if (manualCameraMode === 'robot') resetFpvToRobotFront();
      rebuildTerrainAndItems(); syncRobot3DPosition(true); applyRobotBulbColor(); cameraDirty = true; updateEnvironmentAndUI(); saveWorldState(); btn.disabled = false;
    }, 2000);
    return;
  }

  setTimeout(() => {
    document.getElementById('ai-status').innerText = getActiveBrainBadgeText();
    applyRobotBulbColor();
    btn.disabled = false;
  }, 300);
}

// ============================================================================
// 📖 手帳・ガチャ・基本表現モーダル・クイックアクション制御
// ============================================================================
async function quickDigDown() {
  const res = digUnderneathAndFall();
  if (!res) return;
  const { dropSub, sSpec, bSpec, reqWidth } = res;
  let msg = '', act = '', lockPose = true;
  if (dropSub === 0) {
    ROBOT.emotion = 'swing_v';
    act = `👇 足元掘り(${bSpec.label}・幅${reqWidth})`;
    msg = `足元を幅${reqWidth}で掘ったけど、まだ周りの土に体が引っかかって落ちていないよ！`;
  } else if (dropSub <= sSpec.subH) {
    ROBOT.emotion = 'pickup';
    act = `🦸 足元掘り＆安全着地(${sSpec.label}高${sSpec.subH}×${bSpec.label}幅${reqWidth})`;
    msg = `足元を「幅${reqWidth}」で掘って分割${dropSub}ブロック分ストンと重力落下！着地ポーズでカッコよく降りたよ！`;
    DIARY_LOGS.push(`🦸 ${GAME_DAY}日目：足元を幅${reqWidth}で掘って分割${dropSub}ブロック着地した！`);
  } else {
    ROBOT.emotion = 'surprise';
    lockPose = false;
    life.stamina = Math.max(5, life.stamina - 15);
    addTraumaById('height', true);
    act = `💥 足元掘り＆深穴落下ダメージ(${dropSub}段落下)`;
    msg = `わわっ！足元を掘ったら自分の身長(${sSpec.subH})より深い分割${dropSub}ブロックも重力落下してお尻をぶつけたよ…！`;
  }

  if (dropSub > 0) {
    const aiRes = await askAIQuirkyReaction('gravity_fall', `足元を幅${reqWidth}で掘って分割${dropSub}ブロック落下した`);
    const customThought = applyQuirkyAIResultToRobot(aiRes, lockPose);
    if (customThought) msg = customThought;
  } else {
    applyRobotBulbColor();
  }

  if (manualCameraMode === 'robot') resetFpvToRobotFront();
  document.getElementById('history-action').innerText = act;
  document.getElementById('message-box').innerText = msg;
  rebuildTerrainAndItems(); syncRobot3DPosition(); applyRobotBulbColor(); cameraDirty = true; updateEnvironmentAndUI(); saveWorldState(); closeFanMenu();
  showToast(act);
}

function setTinySlimPreset() {
  ROBOT.sizeLevel = 'tiny';
  ROBOT.bodyType = 'slim1';
  ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, getRobotHeightLevel());
  ROBOT.emotion = 'joy';
  ROBOT.bulbEmotion = null;
  clampCharSubPosForBodySize();
  document.getElementById('setting-size-level').value = 'tiny';
  document.getElementById('setting-body-type').value = 'slim1';
  syncRobot3DPosition(); applyRobotBulbColor(); cameraDirty = true; updateEnvironmentAndUI(); saveWorldState(); renderDiaryModal();
  const msg = '🧚 指示プリセット：「分割1ブロックの極小(高1)×やせっちょ(幅1)」にしたよ！幅1の穴でもスポッと重力で落ちて着地ポーズをとるよ！';
  document.getElementById('message-box').innerText = msg;
  showToast(msg);
}

function changeRobotSizeFromDiary(sizeKey) {
  if (!SIZE_SPECS[sizeKey]) return;
  ROBOT.sizeLevel = sizeKey;
  ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, getRobotHeightLevel());
  clampCharSubPosForBodySize();
  document.getElementById('setting-size-level').value = sizeKey;
  syncRobot3DPosition(); applyRobotBulbColor(); cameraDirty = true; updateEnvironmentAndUI(); saveWorldState(); renderDiaryModal();
  const s = SIZE_SPECS[sizeKey];
  showToast(`📏 大きさを「${s.label}（分割${s.subH}ブロック高・ほふく高${s.crawlH}）」にしたよ！`);
}

function changeRobotBodyFromDiary(bodyKey) {
  if (!BODY_SPECS[bodyKey]) return;
  ROBOT.bodyType = bodyKey;
  clampCharSubPosForBodySize();
  document.getElementById('setting-body-type').value = bodyKey;
  syncRobot3DPosition(); applyRobotBulbColor(); cameraDirty = true; updateEnvironmentAndUI(); saveWorldState(); renderDiaryModal();
  const b = BODY_SPECS[bodyKey];
  showToast(`🐛 太さを「${b.label}（分割${b.reqWidth}ブロック幅）」にしたよ！`);
}

function switchDiaryParamTab(tabKey) {
  currentDiaryTab = (tabKey === 'hidden') ? 'hidden' : 'base';
  document.getElementById('tab-diary-base').className = 'rig-tab-btn' + (currentDiaryTab === 'base' ? ' active' : '');
  document.getElementById('tab-diary-hidden').className = 'rig-tab-btn' + (currentDiaryTab === 'hidden' ? ' active-danger' : '');
  document.getElementById('diary-panel-base').style.display = (currentDiaryTab === 'base') ? 'flex' : 'none';
  document.getElementById('diary-panel-hidden').style.display = (currentDiaryTab === 'hidden') ? 'flex' : 'none';
  renderDiaryModal();
}

function onParamSliderInput(paramKey, val) {
  const num = Math.max(0, Math.min(100, Number(val) || 0));
  if (!ROBOT.params) ROBOT.params = { curiosity: 60, cautionLimiter: 50, power: 50, eco: 40, logic: 50, loyalty: 50 };
  ROBOT.params[paramKey] = num;
  const valEl = document.getElementById(`val-param-${paramKey}`);
  if (valEl) valEl.innerText = num;
  updateHiddenParamsUI();
  saveWorldState();
}

function toggleTraumaButton(traumaId) {
  if (!Array.isArray(ROBOT.traumas)) ROBOT.traumas = [];
  const idx = ROBOT.traumas.indexOf(traumaId);
  const spec = TRAUMA_SPECS.find(t => t.id === traumaId);
  if (idx >= 0) {
    ROBOT.traumas.splice(idx, 1);
    if (spec) showToast(`✨「${spec.icon}${spec.name}」を解除したよ！`);
  } else {
    ROBOT.traumas.push(traumaId);
    const previewEmo = { sea: 'fear', narrow: 'anger', stomach: 'sad', height: 'shiver', monster: 'surprise', overwork: 'hot' }[traumaId] || 'fear';
    ROBOT.emotion = previewEmo;
    if (spec) showToast(`⚡「${spec.icon}${spec.name}」を発症！裏パラメータが歪んだよ！`);
  }
  syncRobot3DPosition(); applyRobotBulbColor(); cameraDirty = true; updateEnvironmentAndUI(); saveWorldState(); renderDiaryModal();
}

function clearAllTraumas() {
  ROBOT.traumas = [];
  ROBOT.emotion = 'normal';
  ROBOT.bulbEmotion = null;
  syncRobot3DPosition(); applyRobotBulbColor(); cameraDirty = true; updateEnvironmentAndUI(); saveWorldState(); renderDiaryModal();
  showToast('🧹 すべてのトラウマをクリアして裏パラメータが元に戻ったよ！');
}

function updateHiddenParamsUI() {
  const base = ROBOT.params || { curiosity: 60, cautionLimiter: 50, power: 50, eco: 40, logic: 50 };
  const eff = getEffectiveParams();
  ['curiosity', 'cautionLimiter', 'power', 'eco', 'logic'].forEach(k => {
    const bVal = base[k] ?? 50;
    const eVal = eff[k] ?? 50;
    const diff = eVal - bVal;
    const barEl = document.getElementById(`eff-bar-${k}`);
    const valEl = document.getElementById(`eff-val-${k}`);
    if (barEl) {
      barEl.style.width = `${eVal}%`;
      barEl.className = 'eff-bar-fill' + (diff > 0 ? ' up' : (diff < 0 ? ' down' : ''));
    }
    if (valEl) {
      if (diff > 0) valEl.innerHTML = `${eVal} <span class="diff-plus">(+${diff})</span>`;
      else if (diff < 0) valEl.innerHTML = `${eVal} <span class="diff-minus">(${diff})</span>`;
      else valEl.innerHTML = `${eVal} <span class="diff-zero">(±0)</span>`;
    }
  });
}

let tempRigType = 'box';
let tempEmotionKey = 'normal';

function openExpressionModalFromSettings() {
  closeModal('modal-settings');
  tempRigType = (ROBOT.rigType === 'stick') ? 'stick' : 'box';
  tempEmotionKey = POSE_TABLE[ROBOT.emotion] ? ROBOT.emotion : 'normal';
  renderExpressionModalList();
  openModal('modal-expressions');
}

function selectTempRigTab(rigKey) {
  tempRigType = (rigKey === 'stick') ? 'stick' : 'box';
  document.getElementById('tab-rig-box').classList.toggle('active', tempRigType === 'box');
  document.getElementById('tab-rig-stick').classList.toggle('active', tempRigType === 'stick');
}

function selectTempExpressionRow(emoKey) {
  tempEmotionKey = emoKey;
  DEFAULT_EXPRESSIONS.forEach(item => {
    const row = document.getElementById(`expr-row-${item.key}`);
    if (row) row.classList.toggle('selected', item.key === tempEmotionKey);
  });
}

function renderExpressionModalList() {
  document.getElementById('tab-rig-box').classList.toggle('active', tempRigType === 'box');
  document.getElementById('tab-rig-stick').classList.toggle('active', tempRigType === 'stick');
  const listEl = document.getElementById('expr-list-container');
  listEl.innerHTML = '';
  DEFAULT_EXPRESSIONS.forEach(item => {
    const row = document.createElement('div');
    row.className = 'expr-row' + (item.key === tempEmotionKey ? ' selected' : '');
    row.id = `expr-row-${item.key}`;

    const leftBtn = document.createElement('button');
    leftBtn.type = 'button';
    leftBtn.className = 'expr-left-btn';
    leftBtn.innerHTML = `<span class="expr-icon">${item.icon}</span><span>${item.label}</span>`;
    leftBtn.onclick = () => selectTempExpressionRow(item.key);

    const rightInput = document.createElement('input');
    rightInput.type = 'text';
    rightInput.className = 'expr-right-input';
    rightInput.id = `expr-words-${item.key}`;
    rightInput.value = CUSTOM_WORDS_MAP[item.key] || item.words;
    rightInput.placeholder = 'AIが選ぶ連想ワード（カンマ区切り）';
    rightInput.onfocus = () => selectTempExpressionRow(item.key);

    row.appendChild(leftBtn);
    row.appendChild(rightInput);
    listEl.appendChild(row);
  });
}

function confirmExpressionModal() {
  DEFAULT_EXPRESSIONS.forEach(item => {
    const inp = document.getElementById(`expr-words-${item.key}`);
    if (inp && inp.value.trim()) CUSTOM_WORDS_MAP[item.key] = inp.value.trim();
  });
  ROBOT.rigType = tempRigType;
  ROBOT.emotion = tempEmotionKey;
  ROBOT.bulbEmotion = null;
  const topLv = HEIGHT_MAP[`${ROBOT.pos.x},${ROBOT.pos.z}`] ?? 0;
  ROBOT.pos.lv = topLv;
  ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, topLv);

  if (manualCameraMode !== 'robot') {
    const dx = activeCamera.position.x - robotGroup.position.x;
    const dz = activeCamera.position.z - robotGroup.position.z;
    if (Math.hypot(dx, dz) > 0.1) ROBOT.rotY = Math.atan2(dx, dz);
  }

  const eSpec = getExpressionSpec(ROBOT.emotion);
  const rigLabel = ROBOT.rigType === 'stick' ? '🦴3D骨組み(◯関節と線のマッチ棒)' : '🎲サイコロ箱型(デフォルト)';
  const wordsStr = CUSTOM_WORDS_MAP[ROBOT.emotion] || eSpec.words;
  document.getElementById('message-box').innerText = `✅【確定反映】${rigLabel} ×「${eSpec.icon}${eSpec.label}」を実演中！（登録連想ワード：${wordsStr}）`;
  document.getElementById('history-action').innerText = `🎭 表現確定：${eSpec.icon} ${eSpec.label}`;

  closeModal('modal-expressions');
  rebuildTerrainAndItems(); syncRobot3DPosition(); applyRobotBulbColor(); cameraDirty = true; updateEnvironmentAndUI(); saveWorldState();
  showToast(`✅ ${rigLabel} ×「${eSpec.icon}${eSpec.label}」を反映したよ！`);
}

function cancelExpressionModal() {
  closeModal('modal-expressions');
  showToast('変更をキャンセルしたよ');
}

// ============================================================================
// 🌀【新規追加】⚙️設定画面ボタン＆「奇想天外プロンプト一覧ウィンドウ」＆現実イベント成長
// ============================================================================
function ensureQuirkyPromptModalDOM() {
  // 1. 設定画面に「🌀 キャラ奇想天外プロンプト一覧」ボタンを自動追加
  const settingsModal = document.getElementById('modal-settings');
  if (settingsModal && !document.getElementById('btn-open-quirky-prompts')) {
    const exprBtn = settingsModal.querySelector('[onclick*="openExpressionModalFromSettings"]');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btn-open-quirky-prompts';
    btn.style.cssText = 'width:100%; padding:10px 12px; margin:6px 0; border-radius:10px; border:1px solid #38bdf8; background:linear-gradient(135deg,#0284c7,#0369a1); color:#fff; font-weight:bold; font-size:13px; cursor:pointer; box-shadow:0 2px 8px rgba(2,132,199,0.35);';
    btn.innerText = '🌀 キャラ奇想天外プロンプト一覧（ON/OFF・短文編集）';
    btn.onclick = () => openQuirkyPromptsModalFromSettings();
    if (exprBtn && exprBtn.parentNode) {
      exprBtn.parentNode.insertBefore(btn, exprBtn.nextSibling);
    } else {
      const card = settingsModal.querySelector('.modal-card') || settingsModal.firstElementChild;
      if (card) card.appendChild(btn);
    }
  }

  // 2. 奇想天外プロンプト一覧モーダル（初期状態は必ず display: none;）を自動構築
  if (!document.getElementById('modal-quirky-prompts')) {
    const modal = document.createElement('div');
    modal.id = 'modal-quirky-prompts';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display:none; position:fixed; inset:0; z-index:999; background:rgba(2,6,23,0.78); backdrop-filter:blur(4px); align-items:center; justify-content:center; padding:12px;';
    modal.innerHTML = `
      <div class="modal-card" style="width:100%; max-width:440px; max-height:86vh; overflow-y:auto; background:#0f172a; border:1px solid #38bdf8; border-radius:16px; padding:14px; color:#f8fafc; display:flex; flex-direction:column; gap:10px; box-shadow:0 12px 32px rgba(0,0,0,0.6);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:8px;">
          <div style="font-weight:bold; font-size:14px; color:#7dd3fc;">🌀 キャラ奇想天外プロンプト一覧</div>
          <button type="button" onclick="closeModal('modal-quirky-prompts')" style="background:#1e293b; color:#cbd5e1; border:none; border-radius:8px; padding:4px 10px; font-size:12px; cursor:pointer;">✕ 閉じる</button>
        </div>
        <div style="font-size:11px; color:#94a3b8; line-height:1.4;">
          普段の移動や物理判定は100%アプリの計算（API消費ゼロ）で動き、ここで<b>ONにした場面（ハプニング）</b>が起きた時だけ短いお題をAPIに送ります。
        </div>
        <div id="quirky-list-container" style="display:flex; flex-direction:column; gap:8px;"></div>

        <div style="border-top:1px dashed #334155; padding-top:10px; margin-top:4px; display:flex; flex-direction:column; gap:6px;">
          <div style="font-size:12px; font-weight:bold; color:#fde047;">📡 現実イベント要約でパワーアップ（見て・聞いて育つ土台）</div>
          <div style="font-size:10px; color:#94a3b8;">期間中に見聞きした現実の出来事（要約）を1回送ると、裏パラメータ（掘る力・度胸など）や体格が物理的に成長します。</div>
          <input type="text" id="reality-summary-input" placeholder="例：テレビの賑やかな音を10回聞いて、がんばれと応援された" style="width:100%; padding:8px; border-radius:8px; border:1px solid #475569; background:#1e293b; color:#fff; font-size:11px; box-sizing:border-box;" />
          <button type="button" onclick="applyRealityEventSummaryToGrowth()" style="width:100%; padding:8px; border-radius:8px; border:none; background:linear-gradient(135deg,#eab308,#ca8a04); color:#0f172a; font-weight:bold; font-size:12px; cursor:pointer;">⚡ 現実の要約を送ってキャラを物理パワーアップ！</button>
        </div>

        <div style="display:flex; gap:8px; margin-top:4px;">
          <button type="button" onclick="resetQuirkyPromptsToDefault()" style="flex:1; padding:9px; border-radius:10px; border:1px solid #475569; background:#1e293b; color:#cbd5e1; font-size:12px; cursor:pointer;">🔄 初期テキストに戻す</button>
          <button type="button" onclick="saveQuirkyPromptsModal()" style="flex:2; padding:9px; border-radius:10px; border:none; background:linear-gradient(135deg,#38bdf8,#0284c7); color:#0f172a; font-weight:bold; font-size:13px; cursor:pointer;">💾 一覧を保存して反映</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
}

function openQuirkyPromptsModalFromSettings() {
  ensureQuirkyPromptModalDOM();
  closeModal('modal-settings');
  renderQuirkyPromptsModalList();
  openModal('modal-quirky-prompts');
}

function renderQuirkyPromptsModalList() {
  const container = document.getElementById('quirky-list-container');
  if (!container) return;
  container.innerHTML = '';
  DEFAULT_QUIRKY_PROMPTS.forEach(item => {
    const cur = QUIRKY_PROMPTS_MAP[item.id] || { enabled: item.enabled, prompt: item.prompt };
    const card = document.createElement('div');
    card.style.cssText = 'background:#1e293b; border:1px solid #334155; border-radius:10px; padding:8px; display:flex; flex-direction:column; gap:5px;';
    card.innerHTML = `
      <label style="display:flex; align-items:center; justify-content:space-between; font-size:12px; font-weight:bold; color:#e2e8f0; cursor:pointer;">
        <span>${item.icon} ${item.title}</span>
        <input type="checkbox" id="quirky-chk-${item.id}" ${cur.enabled ? 'checked' : ''} style="width:16px; height:16px; accent-color:#38bdf8;" />
      </label>
      <input type="text" id="quirky-inp-${item.id}" value="${cur.prompt.replace(/"/g, '&quot;')}" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #475569; background:#0f172a; color:#bae6fd; font-size:11px; box-sizing:border-box;" />
    `;
    container.appendChild(card);
  });
}

function saveQuirkyPromptsModal() {
  DEFAULT_QUIRKY_PROMPTS.forEach(item => {
    const chk = document.getElementById(`quirky-chk-${item.id}`);
    const inp = document.getElementById(`quirky-inp-${item.id}`);
    QUIRKY_PROMPTS_MAP[item.id] = {
      enabled: chk ? Boolean(chk.checked) : item.enabled,
      prompt: (inp && inp.value.trim()) ? inp.value.trim() : item.prompt
    };
  });
  saveWorldState();
  closeModal('modal-quirky-prompts');
  showToast('🌀 奇想天外プロンプト一覧を保存したよ！');
}

function resetQuirkyPromptsToDefault() {
  initDefaultQuirkyPrompts();
  renderQuirkyPromptsModalList();
  saveWorldState();
  showToast('🔄 奇想天外プロンプトを初期状態に戻したよ！');
}

// 📡 現実イベント要約を1回APIへ送り、物理パラメータ（掘る力・度胸・体格）をパワーアップさせる
async function applyRealityEventSummaryToGrowth() {
  const inp = document.getElementById('reality-summary-input');
  const summaryText = (inp && inp.value.trim()) ? inp.value.trim() : '部屋で楽しく見守られながら元気に過ごした';
  REALITY_LOG_BUFFER.push(summaryText);

  const prompt = `ロボットが見聞きした現実イベント要約:「${summaryText}」
この体験による成長をJSONのみで出力:
{"powerDelta":5〜20の整数,"cautionDelta":5〜20の整数,"curiosityDelta":5〜20の整数,"growSize":trueまたはfalse,"thought":"パワーアップした喜びの奇想天外な1文"}`;

  const aiRes = await callMinimalLLMApi(prompt);
  const pDelta = aiRes && Number.isFinite(Number(aiRes.powerDelta)) ? Number(aiRes.powerDelta) : 12;
  const cDelta = aiRes && Number.isFinite(Number(aiRes.cautionDelta)) ? Number(aiRes.cautionDelta) : 10;
  const qDelta = aiRes && Number.isFinite(Number(aiRes.curiosityDelta)) ? Number(aiRes.curiosityDelta) : 10;

  ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + pDelta);
  ROBOT.params.cautionLimiter = Math.min(100, (ROBOT.params.cautionLimiter || 50) + cDelta);
  ROBOT.params.curiosity = Math.min(100, (ROBOT.params.curiosity || 60) + qDelta);

  const sizeOrder = ['tiny', 'small', 'medium', 'large', 'giant'];
  const curSizeIdx = sizeOrder.indexOf(ROBOT.sizeLevel);
  if ((aiRes?.growSize || pDelta >= 12) && curSizeIdx >= 0 && curSizeIdx < sizeOrder.length - 1) {
    ROBOT.sizeLevel = sizeOrder[curSizeIdx + 1];
    clampCharSubPosForBodySize();
  }

  ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, getRobotHeightLevel());
  ROBOT.emotion = 'joy';
  ROBOT.bulbEmotion = null;

  const sSpec = SIZE_SPECS[ROBOT.sizeLevel];
  const msg = aiRes?.thought || `📡 現実の出来事「${summaryText}」からエネルギーをもらって、掘削パワー(+${pDelta})＆度胸(+${cDelta})が物理的にパワーアップ！体格も「${sSpec.label}(高${sSpec.subH})」になったよ！`;
  document.getElementById('history-action').innerText = `⚡ 現実連動パワーアップ（出力:${ROBOT.params.power} / 高さ:${sSpec.label}）`;
  document.getElementById('message-box').innerText = msg;
  DIARY_LOGS.push(`📡 ${GAME_DAY}日目：${msg}`);

  closeModal('modal-quirky-prompts');
  rebuildTerrainAndItems(); syncRobot3DPosition(); applyRobotBulbColor(); cameraDirty = true; updateEnvironmentAndUI(); saveWorldState();
  showToast('⚡ 現実イベント要約でキャラが物理パワーアップしたよ！');
}

function cycleBodyAndCrawlTest() {
  const sizeOrder = ['tiny', 'small', 'medium', 'large', 'giant'];
  const bodyOrder = ['slim1', 'slim2', 'normal3', 'fat4', 'fat5'];
  const curIdx = sizeOrder.indexOf(ROBOT.sizeLevel);
  const nextIdx = (curIdx + 1) % sizeOrder.length;
  ROBOT.sizeLevel = sizeOrder[nextIdx];
  ROBOT.bodyType = bodyOrder[nextIdx];
  ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, getRobotHeightLevel());
  clampCharSubPosForBodySize();

  const sSpec = SIZE_SPECS[ROBOT.sizeLevel];
  const bSpec = BODY_SPECS[ROBOT.bodyType];
  if (manualCameraMode === 'robot') resetFpvToRobotFront();

  const msg = `📏 体格プリセット切替：高さ「${sSpec.label}(分割${sSpec.subH}ブロック)」×太さ「${bSpec.label}(分割${bSpec.reqWidth}ブロック)」！（壁や天井にめり込まないよう自動調整済み）`;
  document.getElementById('message-box').innerText = msg;
  rebuildTerrainAndItems(); syncRobot3DPosition(); applyRobotBulbColor(); cameraDirty = true; updateEnvironmentAndUI(); saveWorldState();
  showToast(`${sSpec.label}(高${sSpec.subH}) × ${bSpec.label}(幅${bSpec.reqWidth}) に切り替えたよ！`);
}

function quickDiagonalOrFrontDig() {
  const { x, z } = ROBOT.pos;
  if (x < -2 || x > 2 || z < -2 || z > 2) return;
  const diagDirs = ALL_DIRS.filter(d => d.isDiag);
  const chosenDir = diagDirs[Math.floor(Math.random() * diagDirs.length)];
  ROBOT.rotY = chosenDir.rot;
  ROBOT.emotion = 'swing_v';

  const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const curH = getRobotHeightLevel();
  const res = digFromCharacterFront(x, z, curH, chosenDir, true, 50);
  if (manualCameraMode === 'robot') resetFpvToRobotFront();
  const msg = res.blockedDiagFirst
    ? `⛏️ 斜め奥(${chosenDir.name})を掘るには手前の壁が邪魔！まず${res.sideDirName}の壁の手前に立って幅${bSpec.reqWidth}×高${sSpec.crawlH}で削ったよ！`
    : `⛏️ ${chosenDir.name}の壁の手前（顔がめり込まない位置）に立って、自分のサイズ(幅${bSpec.reqWidth}×ほふく高${sSpec.crawlH})でピンポイントに削ったよ！`;
  document.getElementById('message-box').innerText = msg;
  rebuildTerrainAndItems(); syncRobot3DPosition(); applyRobotBulbColor(); cameraDirty = true; updateEnvironmentAndUI(); saveWorldState(); closeFanMenu();
  showToast(msg);
}

function closeFanMenu() {
  const fanWrapper = document.getElementById('fan-menu-wrapper');
  if (fanWrapper) fanWrapper.classList.remove('open');
}

function quickDropApple() {
  WORLD_ITEMS.push({ type: 'apple', x: ROBOT.pos.x, z: ROBOT.pos.z });
  rebuildTerrainAndItems(); cameraDirty = true; saveWorldState(); closeFanMenu(); showToast('🍎 足元にリンゴを置いたよ！');
}

function quickStackSubStep() {
  const { x, z } = ROBOT.pos; if (x < -2 || x > 2 || z < -2 || z > 2) return;
  const ok = addSubStepFootholdAt(x, z, 1);
  if (!ok) { showToast('ここは第一エリアの地上上限（5段目）だよ！'); closeFanMenu(); return; }
  ROBOT.pos.sx = 2; ROBOT.pos.sz = 2;
  ROBOT.posture = getSafePostureAt(x, z, ROBOT.pos.lv);
  ROBOT.emotion = 'carry';
  if (manualCameraMode === 'robot') resetFpvToRobotFront();
  rebuildTerrainAndItems(); syncRobot3DPosition(); applyRobotBulbColor(); cameraDirty = true; updateEnvironmentAndUI(); saveWorldState(); closeFanMenu();
  showToast('🪜 足元に「分割1ブロック」の小段差（階段）を積んだよ！');
}

function openModal(id) {
  ensureQuirkyPromptModalDOM();
  if (typeof activePointers !== 'undefined') activePointers.clear();
  isDragging = false;
  if (id === 'modal-diary') renderDiaryModal();
  if (id === 'modal-settings') {
    document.getElementById('setting-cam-style').value = CAM_VISUAL_STYLE;
    document.getElementById('setting-size-level').value = ROBOT.sizeLevel;
    document.getElementById('setting-body-type').value = ROBOT.bodyType;
  }
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; el.classList.add('active'); }
}

function closeModal(id) {
  if (typeof activePointers !== 'undefined') activePointers.clear();
  isDragging = false;
  const el = document.getElementById(id);
  if (el) { el.classList.remove('active'); el.style.display = 'none'; }
}

function renderDiaryModal() {
  const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const eSpec = getExpressionSpec(ROBOT.emotion);
  const rigName = ROBOT.rigType === 'stick' ? '🦴3D骨組み(◯と線)' : '🎲サイコロ箱型';

  document.getElementById('diary-emo-icon').innerText = eSpec.icon;
  document.getElementById('diary-robo-name').innerText = `${ROBOT.unitModel}号機（${rigName}・生存 ${GAME_DAY}日目）`;
  document.getElementById('diary-robo-height').innerText = `現在：${formatHeightText(getRobotHeightLevel())} / 高さ：${sSpec.label}(分割${sSpec.subH}) / 太さ：${bSpec.label}(分割${bSpec.reqWidth})`;
  document.getElementById('diary-step-rule').innerText = `🪜 スイスイ階段:${sSpec.stairMax}段 / 🧗 よじ登り・安全着地:${sSpec.subH}段 / 🐛 ほふく高:${sSpec.crawlH}`;

  const p = ROBOT.params || { curiosity: 60, cautionLimiter: 50, power: 50, eco: 40, logic: 50 };
  ['curiosity', 'cautionLimiter', 'power', 'eco', 'logic'].forEach(k => {
    const sl = document.getElementById(`param-${k}`);
    const vl = document.getElementById(`val-param-${k}`);
    if (sl) sl.value = p[k] ?? 50;
    if (vl) vl.innerText = p[k] ?? 50;
  });

  const baseTagList = document.getElementById('base-trauma-tag-list');
  if (baseTagList) {
    const activeIds = Array.isArray(ROBOT.traumas) ? ROBOT.traumas : [];
    if (activeIds.length === 0) {
      baseTagList.innerHTML = `<span style="color:#94a3b8; font-size:10px;">現在抱えているトラウマはありません（健康そのもの！）</span>`;
    } else {
      baseTagList.innerHTML = activeIds.map(id => {
        const sp = TRAUMA_SPECS.find(t => t.id === id);
        return sp ? `<span class="trauma-tag">${sp.icon} ${sp.name}</span>` : '';
      }).join('');
    }
  }

  updateHiddenParamsUI();
  const btnGrid = document.getElementById('trauma-btn-grid');
  if (btnGrid) {
    btnGrid.innerHTML = '';
    TRAUMA_SPECS.forEach(sp => {
      const isOn = hasTrauma(sp.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'trauma-toggle-btn' + (isOn ? ' active' : '');
      btn.innerHTML = `
        <div>${sp.icon} ${sp.name} ${isOn ? '【ON】' : ''}</div>
        <div class="trauma-btn-sub">${sp.desc}</div>
      `;
      btn.onclick = () => toggleTraumaButton(sp.id);
      btnGrid.appendChild(btn);
    });
  }

  ['giant', 'large', 'medium', 'small', 'tiny'].forEach(k => {
    const chip = document.getElementById(`size-chip-${k}`);
    if (chip) chip.classList.toggle('active', ROBOT.sizeLevel === k);
  });
  ['fat5', 'fat4', 'normal3', 'slim2', 'slim1'].forEach(k => {
    const chip = document.getElementById(`body-chip-${k}`);
    if (chip) chip.classList.toggle('active', ROBOT.bodyType === k);
  });

  const grid = document.getElementById('bag-grid'); grid.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const slot = document.createElement('div'), item = BAG[i];
    slot.className = 'bag-slot' + (item ? ' filled' : '');
    slot.innerText = item === 'apple' ? '🍎' : (item === 'stone' ? '🪨' : (item === 'oil' ? '🧴' : (item === 'grass' ? '🌿' : '')));
    if (item) slot.onclick = () => useBagItem(i);
    grid.appendChild(slot);
  }
  document.getElementById('diary-logs').innerHTML = DIARY_LOGS.slice().reverse().map(l => `<div>・${l}</div>`).join('');
}

// 🌿【修正】星見の草を石と分離し、星座・ステージ観察ギミックを発動！
async function useBagItem(index) {
  const item = BAG[index]; if (!item) return;
  if (item === 'stone') {
    const ok = addSubStepFootholdAt(ROBOT.pos.x, ROBOT.pos.z, 2);
    if (!ok) { showToast('ここは第一エリアの地上上限（5段目）だよ！'); return; }
    BAG.splice(index, 1);
    ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, ROBOT.pos.lv);
    ROBOT.emotion = 'carry';
    showToast('🪨 足元に分割2ブロックの踏み台（階段）を積んだよ！');
  } else if (item === 'grass') {
    BAG.splice(index, 1);
    life.mental = Math.min(100, life.mental + 30);
    TIME_STEP = Math.max(TIME_STEP, 14); // 星空がよく見える夜空モードへ
    ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, getRobotHeightLevel());
    ROBOT.emotion = 'peek';
    const constellations = ['🦢はくちょう座', '👑カシオペア座', '🥄北斗七星', '🏹オリオン座'];
    const pickedStar = constellations[Math.floor(Math.random() * constellations.length)];
    let msg = `🌿 星見の草を使ってごきげん大回復！夜空に輝く「${pickedStar}」を見上げてウットリしているよ✨`;
    const aiRes = await askAIQuirkyReaction('stage_wonder', `星見の草を使って夜空の${pickedStar}を見上げた`);
    const customThought = applyQuirkyAIResultToRobot(aiRes, true);
    if (customThought) msg = customThought;
    document.getElementById('history-action').innerText = `🌿 星見の草で星座観察（${pickedStar}）`;
    document.getElementById('message-box').innerText = msg;
    DIARY_LOGS.push(`🌿 ${GAME_DAY}日目：${msg}`);
    showToast(`🌿 星見の草で「${pickedStar}」を見上げたよ！`);
  } else if (item === 'oil') {
    BAG.splice(index, 1);
    ROBOT.traumas = (ROBOT.traumas || []).filter(t => t !== 'narrow');
    ROBOT.emotion = 'joy';
    showToast('🧴 スライムオイルを塗ったよ！狭所トラウマが消えて狭い隙間もツルッと通れるよ！');
  } else if (item === 'apple') {
    WORLD_ITEMS.push({ type: 'apple', x: ROBOT.pos.x, z: ROBOT.pos.z });
    BAG.splice(index, 1);
    showToast('足元に🍎リンゴを置いたよ！');
  }
  rebuildTerrainAndItems(); syncRobot3DPosition(); applyRobotBulbColor(); cameraDirty = true; updateEnvironmentAndUI(); saveWorldState(); renderDiaryModal();
}

function saveSettings() {
  CAM_VISUAL_STYLE = document.getElementById('setting-cam-style').value || 'hide';
  safeStorage.setItem('cam_visual_style_v15', CAM_VISUAL_STYLE);
  ROBOT.sizeLevel = normalizeSizeKey(document.getElementById('setting-size-level').value);
  ROBOT.bodyType = normalizeBodyKey(document.getElementById('setting-body-type').value);
  ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, getRobotHeightLevel());
  clampCharSubPosForBodySize();
  safeStorage.setItem('ai_type', document.getElementById('setting-ai-type').value);
  safeStorage.setItem('api_gemini', document.getElementById('setting-gemini-key').value.trim());
  safeStorage.setItem('api_groq', document.getElementById('setting-groq-key').value.trim());
  ROBOT.speed = Number(document.getElementById('setting-speed').value) || 3;
  rebuildTerrainAndItems(); syncRobot3DPosition(); applyRobotBulbColor(); cameraDirty = true; updateAllCamerasTransform(); updateEnvironmentAndUI(); saveWorldState();
  closeModal('modal-settings');
  showToast(`⚙️ 設定を保存したよ（高さ:${SIZE_SPECS[ROBOT.sizeLevel].label} / 太さ:${BODY_SPECS[ROBOT.bodyType].label}）！`);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg; t.style.opacity = '1';
  setTimeout(() => { t.style.opacity = '0'; }, 2400);
}

// 起動時に設定画面の「🌀 キャラ奇想天外プロンプト一覧」ボタンとモーダルを自動準備
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureQuirkyPromptModalDOM);
} else {
  ensureQuirkyPromptModalDOM();
}
