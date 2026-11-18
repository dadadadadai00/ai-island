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

// 🌀 奇想天外プロンプト一覧
const DEFAULT_QUIRKY_PROMPTS = [
  { id: 'base_persona', icon: '🤖', title: '⑦ 常時ベース性格', enabled: true, prompt: 'あなたはパステル島のドジで憎めないロボット。小学生がクスッと笑うユーモアで話して' },
  { id: 'high_wall', icon: '🧱', title: '① 高い壁で登れない時', enabled: true, prompt: '目の前の壁が高すぎて登れない！子どもが笑うような言い訳や突破アイデアを1文で叫んで' },
  { id: 'narrow_hole', icon: '🕳️', title: '② 狭い穴にお腹がつかえた時', enabled: true, prompt: '狭い穴にお腹がつかえて動けない！ユニークで奇想天外な心の声を1文で叫んで' },
  { id: 'corner_hit', icon: '📐', title: '③ 斜めの角に引っかかった時', enabled: true, prompt: '斜めに進みたいのに角の壁が邪魔！奇想天外なツッコミを1文で叫んで' },
  { id: 'gravity_fall', icon: '🪂', title: '④ 崖や足元掘りで落下した時', enabled: true, prompt: '穴にストンと落ちた！着地のごまかしや奇想天外な感想を1文で叫んで' },
  { id: 'trauma_panic', icon: '⚡', title: '⑤ トラウマ発症・パニック時', enabled: true, prompt: 'トラウマが発動してパニック中！ユーモアたっぷりの奇想天外な心の声を1文で叫んで' },
  { id: 'stage_wonder', icon: '🌌', title: '⑥ 星座・滝・巨大亀を見つけた時', enabled: true, prompt: '島の不思議な景色を発見！目をキラキラさせた奇想天外な感想を1文で叫んで' },
  { id: 'god_contact', icon: '🤖', title: '⑧ 神様（プレイヤー）と交信した時', enabled: true, prompt: '空から見守る神様（プレイヤー）に向かって、今の島の状況や欲しい助けをおねだりして！' }
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
let REALITY_LOG_BUFFER = [];

// ============================================================================
// 【追加①：4つの観察モード ＆ AI記憶リスト】
// ============================================================================
let OBS_MODE = 'wild'; // 'wild' | 'rescue' | 'trial' | 'ai_mode'
let AI_MEMORY = [];

function updateModeUI() {
  const btnApple = document.getElementById('fan-btn-apple');
  const btnStep = document.getElementById('fan-btn-step');
  const btnDigDown = document.getElementById('fan-btn-digdown');
  const btnDigFront = document.getElementById('fan-btn-digfront');

  if (!btnApple) return;

  if (OBS_MODE === 'wild') {
    btnApple.style.display = 'none'; btnStep.style.display = 'none'; btnDigDown.style.display = 'none'; btnDigFront.style.display = 'none';
  } else if (OBS_MODE === 'rescue') {
    btnApple.style.display = 'flex'; btnStep.style.display = 'none'; btnDigDown.style.display = 'none'; btnDigFront.style.display = 'none';
  } else if (OBS_MODE === 'trial') {
    btnApple.style.display = 'none'; btnStep.style.display = 'flex'; btnDigDown.style.display = 'flex'; btnDigFront.style.display = 'flex';
  } else if (OBS_MODE === 'ai_mode') {
    btnApple.style.display = 'flex'; btnStep.style.display = 'flex'; btnDigDown.style.display = 'flex'; btnDigFront.style.display = 'flex';
  }

  const titleEl = document.getElementById('panel-header-title');
  if (titleEl) {
    const titles = {
      'wild': '🌿 野生モード（AI記憶なし・自力のみ）',
      'rescue': '🚑 救援モード（AI記憶なし・アイテム付与）',
      'trial': '⚡ 試練モード（AI記憶なし・試練配置）',
      'ai_mode': '🤖 AI搭載モード（AI記憶あり・おねだり）'
    };
    titleEl.innerText = titles[OBS_MODE] || '💭 ロボのきもち';
  }
}

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
// 【コア④：頭脳通信・クラウド保存コア】
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
} catch (e) {}

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

const AREA1_MAX_GROUND_LV = 5;
const AREA1_MIN_UNDER_LV  = -4;
const WATER_SURFACE_Y     = -0.40;

let life = new LifeCore(), GAME_DAY = 1, TIME_STEP = 0;
let BAG = ['stone', 'oil', 'apple', 'stone', 'grass'];
let DIARY_LOGS = ['🌱 1日目：100%物理ステージ＆奇想天外プロンプト一覧を備えた1号機が誕生！'];
let CAM_VISUAL_STYLE = safeStorage.getItem('cam_visual_style_v15') || 'hide';
let HEIGHT_MAP = {}, CHIP_MAP = {}, WATER_MAP = {};
let currentDiaryTab = 'base';

let ROBOT = {
  unitModel: 1, gen: 1, rigType: 'box',
  pos: { x: 0, z: 0, lv: -1, sx: 2, sz: 2 },
  rotY: Math.PI, speed: 3, sizeLevel: 'tiny', bodyType: 'slim1', posture: 'stand', emotion: 'normal', bulbEmotion: null,
  params: { curiosity: 60, cautionLimiter: 50, power: 50, eco: 40, logic: 50, loyalty: 50 },
  traumas: [], workStreak: 0
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
    if (!silent) showToast(`⚡「${spec.icon}${spec.name}」が発症し、裏ゲージが変化したよ！`);
    return true;
  }
  return false;
}
function hasTrauma(traumaId) { return Array.isArray(ROBOT.traumas) && ROBOT.traumas.includes(traumaId); }

function getEffectiveParams() {
  const base = ROBOT.params || { curiosity: 60, cautionLimiter: 50, power: 50, eco: 40, logic: 50, loyalty: 50 };
  const eff = {
    curiosity: base.curiosity ?? 60, cautionLimiter: base.cautionLimiter ?? 50,
    power: base.power ?? 50, eco: base.eco ?? 40, logic: base.logic ?? 50, loyalty: 50
  };
  let forceZeroCaution = false, forceMaxEco = false;
  const activeIds = Array.isArray(ROBOT.traumas) ? ROBOT.traumas : [];
  activeIds.forEach(id => {
    const sp = TRAUMA_SPECS.find(t => t.id === id);
    if (!sp) return;
    eff.curiosity += (sp.deltas.curiosity || 0); eff.cautionLimiter += (sp.deltas.cautionLimiter || 0);
    eff.power += (sp.deltas.power || 0); eff.eco += (sp.deltas.eco || 0); eff.logic += (sp.deltas.logic || 0);
    if (sp.forceZeroCaution) forceZeroCaution = true; if (sp.forceMaxEco) forceMaxEco = true;
  });
  if (forceZeroCaution) eff.cautionLimiter = 0; if (forceMaxEco) eff.eco = 100;
  ['curiosity', 'cautionLimiter', 'power', 'eco', 'logic'].forEach(k => { eff[k] = Math.max(0, Math.min(100, Math.round(eff[k]))); });
  return eff;
}

// ============================================================================
// 【追加②：いまの夢（称号）の自動判定】
// ============================================================================
function getCurrentDreamTitle() {
  const p = ROBOT.params || { curiosity: 60, cautionLimiter: 50, power: 50, eco: 40, logic: 50 };
  const entries = [
    { key: 'curiosity', title: '🧭 探検家・勇者', val: p.curiosity },
    { key: 'cautionLimiter', title: '🎶 音楽家・アーティスト', val: p.cautionLimiter },
    { key: 'logic', title: '👓 学者・発明家', val: p.logic },
    { key: 'power', title: '🔨 たのもしい大工さん', val: p.power },
    { key: 'eco', title: '🌷 優しいお花屋さん', val: p.eco }
  ];
  entries.sort((a, b) => b.val - a.val);
  return `『${entries[0].title}』`;
}

function clampCharSubPosForBodySize() {
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const maxOff = bSpec.wallOffsetSub ?? 0.65;
  const curSx = Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2;
  const curSz = Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2;
  ROBOT.pos.sx = Math.max(2 - maxOff, Math.min(2 + maxOff, curSx));
  ROBOT.pos.sz = Math.max(2 - maxOff, Math.min(2 + maxOff, curSz));
}
function stepCharCloseToWallForDig(dir) {
  if (!dir) return;
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const off = bSpec.wallOffsetSub ?? 0.65;
  const diagFactor = dir.isDiag ? 0.82 : 1.0;
  ROBOT.pos.sx = 2 + dir.dx * off * diagFactor;
  ROBOT.pos.sz = 2 + dir.dz * off * diagFactor;
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

function applyLoadedWorldData(d) {
  if (!d || typeof d !== 'object') return;
  if (d.obsMode) { OBS_MODE = d.obsMode; const obsSel = document.getElementById('setting-obs-mode'); if (obsSel) obsSel.value = OBS_MODE; }
  if (Array.isArray(d.aiMemory)) AI_MEMORY = d.aiMemory;
  if (d.life) life = new LifeCore(d.life);
  if (d.customWords && typeof d.customWords === 'object') {
    DEFAULT_EXPRESSIONS.forEach(item => { if (typeof d.customWords[item.key] === 'string') { CUSTOM_WORDS_MAP[item.key] = d.customWords[item.key]; } });
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
  if (Array.isArray(d.realityLogs)) REALITY_LOG_BUFFER = d.realityLogs.slice(-20);
  if (d.robot && d.robot.pos) {
    ROBOT.unitModel = Number(d.robot.unitModel) || 1; ROBOT.gen = Number(d.robot.gen) || 1; ROBOT.rigType = (d.robot.rigType === 'stick') ? 'stick' : 'box';
    ROBOT.pos.x = Number.isFinite(d.robot.pos.x) ? d.robot.pos.x : 0; ROBOT.pos.z = Number.isFinite(d.robot.pos.z) ? d.robot.pos.z : 0;
    ROBOT.pos.lv = Number.isFinite(d.robot.pos.lv) ? d.robot.pos.lv : 0;
    ROBOT.pos.sx = Number.isFinite(d.robot.pos.sx) ? d.robot.pos.sx : 2; ROBOT.pos.sz = Number.isFinite(d.robot.pos.sz) ? d.robot.pos.sz : 2;
    ROBOT.rotY = Number.isFinite(d.robot.rotY) ? d.robot.rotY : Math.PI; ROBOT.speed = Number(d.robot.speed) || 3;
    ROBOT.sizeLevel = normalizeSizeKey(d.robot.sizeLevel); ROBOT.bodyType = normalizeBodyKey(d.robot.bodyType);
    ROBOT.posture = d.robot.posture === 'crawl' ? 'crawl' : 'stand';
    ROBOT.emotion = POSE_TABLE[d.robot.emotion] ? d.robot.emotion : 'normal';
    ROBOT.bulbEmotion = POSE_TABLE[d.robot.bulbEmotion] ? d.robot.bulbEmotion : null;
    clampCharSubPosForBodySize();
    if (d.robot.params && typeof d.robot.params === 'object') {
      ['curiosity', 'cautionLimiter', 'power', 'eco', 'logic'].forEach(k => {
        if (typeof d.robot.params[k] === 'number') ROBOT.params[k] = Math.max(0, Math.min(100, Math.round(d.robot.params[k])));
      });
    }
    if (Array.isArray(d.robot.traumas)) ROBOT.traumas = d.robot.traumas.filter(id => TRAUMA_SPECS.some(t => t.id === id));
  }
  if (d.heightMap) {
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
      const k = `${x},${z}`; if (d.heightMap[k] !== undefined) HEIGHT_MAP[k] = Math.max(AREA1_MIN_UNDER_LV, Math.min(AREA1_MAX_GROUND_LV, Number(d.heightMap[k]) || 0));
    }
  }
  if (d.chipMap && typeof d.chipMap === 'object') CHIP_MAP = d.chipMap;
  if (typeof enforceOuterWaterWallIntegrity === 'function') enforceOuterWaterWallIntegrity();
  if (Array.isArray(d.items)) WORLD_ITEMS = d.items;
  if (Array.isArray(d.bag)) BAG = d.bag;
  if (Array.isArray(d.logs) && d.logs.length) DIARY_LOGS = d.logs;
  GAME_DAY = Math.max(1, Number(d.day) || 1); TIME_STEP = Math.max(0, Math.min(19, Number(d.time) || 0));
  if (d.lastMessage && typeof d.lastMessage === 'string') { const msgEl = document.getElementById('message-box'); if (msgEl) msgEl.innerText = d.lastMessage; }
  if (d.lastAction && typeof d.lastAction === 'string') { const actEl = document.getElementById('history-action'); if (actEl) actEl.innerText = d.lastAction; }
  updateModeUI();
}

function saveWorldState() {
  if (typeof enforceOuterWaterWallIntegrity === 'function') enforceOuterWaterWallIntegrity();
  const msgEl = document.getElementById('message-box');
  const actEl = document.getElementById('history-action');
  const payload = {
    obsMode: OBS_MODE, aiMemory: AI_MEMORY,
    life: life.exportSave(), robot: ROBOT, customWords: CUSTOM_WORDS_MAP, quirkyPrompts: QUIRKY_PROMPTS_MAP, realityLogs: REALITY_LOG_BUFFER.slice(-20),
    heightMap: HEIGHT_MAP, chipMap: CHIP_MAP, items: WORLD_ITEMS, bag: BAG, logs: DIARY_LOGS.slice(-50),
    day: GAME_DAY, time: TIME_STEP,
    lastMessage: msgEl ? msgEl.innerText : '', lastAction: actEl ? actEl.innerText : ''
  };
  const jsonStr = JSON.stringify(payload);
  safeStorage.setItem('island_spacecore_v15', jsonStr);
  if (firestoreDocRef) {
    firestoreDocRef.set({ stateJson: jsonStr, day: GAME_DAY, time: TIME_STEP, life: payload.life, robotGen: ROBOT.gen, lastMessage: payload.lastMessage, logs: payload.logs, updatedAt: Date.now() }).catch(e => {});
  }
}
async function resetGameDirectly() {
  safeStorage.removeItem('island_spacecore_v15'); safeStorage.removeItem('island_spacecore_v14');
  if (firestoreDocRef) { try { await firestoreDocRef.delete(); } catch (e) {} }
  location.reload();
}

// 📡 API通信
async function callMinimalLLMApi(shortPromptText) {
  const aiType = safeStorage.getItem('ai_type') || 'none';
  if (aiType === 'none') return null;
  try {
    if (aiType === 'gemini') {
      const key = safeStorage.getItem('api_gemini');
      if (!key) return null;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: shortPromptText }] }], generationConfig: { responseMimeType: 'application/json' } })
      });
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (raw) return JSON.parse(raw);
    } else if (aiType === 'groq') {
      const key = safeStorage.getItem('api_groq');
      if (!key) return null;
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: shortPromptText }], response_format: { type: 'json_object' }, max_tokens: 140 })
      });
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content;
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

async function askAIQuirkyReaction(categoryId, factSummary) {
  const conf = QUIRKY_PROMPTS_MAP[categoryId];
  if (!conf || !conf.enabled) return null;
  const basePersona = (QUIRKY_PROMPTS_MAP.base_persona && QUIRKY_PROMPTS_MAP.base_persona.enabled) ? QUIRKY_PROMPTS_MAP.base_persona.prompt : '';
  const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const memoryText = (OBS_MODE === 'ai_mode' && AI_MEMORY.length > 0) ? `\n【過去の記憶】${AI_MEMORY.slice(-3).join(' / ')}` : '';

  const minimalPrompt = `${basePersona}
体格:${sSpec.label}(高${sSpec.subH})・${bSpec.label}(幅${bSpec.reqWidth})
夢(一番高い才能):${getCurrentDreamTitle()}
今起きた事実:${factSummary}${memoryText}
お題:${conf.prompt}
JSONのみ出力:{"emotion":"joy/anger/sad/fun/fear/shiver/hot/think/surprise/wave/sleep/struggleのいずれか","thought":"奇想天外な心の声(1文)"}`;
  return await callMinimalLLMApi(minimalPrompt);
}

function applyQuirkyAIResultToRobot(aiRes, lockPhysicalPose = false) {
  if (!aiRes) { ROBOT.bulbEmotion = null; applyRobotBulbColor(); return null; }
  const pickedEmo = POSE_TABLE[aiRes.emotion] ? aiRes.emotion : matchExpressionFromText(aiRes.thought, ROBOT.emotion);
  if (lockPhysicalPose || LOCKED_PHYSICAL_POSES.includes(ROBOT.emotion)) {
    ROBOT.bulbEmotion = pickedEmo;
  } else {
    ROBOT.emotion = pickedEmo; ROBOT.bulbEmotion = null;
  }
  applyRobotBulbColor();
  if (OBS_MODE === 'ai_mode' && typeof aiRes.thought === 'string') AI_MEMORY.push(`ボクの発言:${aiRes.thought.trim()}`);
  return (typeof aiRes.thought === 'string' && aiRes.thought.trim()) ? aiRes.thought.trim() : null;
}

// ============================================================================
// 【メインターン実行：行動決定は100%物理計算・ハプニング時のみAPI】
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
    ROBOT.pos.x = Math.max(-2, Math.min(2, ROBOT.pos.x)); ROBOT.pos.z = Math.max(-2, Math.min(2, ROBOT.pos.z));
    ROBOT.pos.lv = HEIGHT_MAP[`${ROBOT.pos.x},${ROBOT.pos.z}`] ?? 0;
    ROBOT.pos.sx = 2; ROBOT.pos.sz = 2; ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, ROBOT.pos.lv);
    ROBOT.emotion = 'surprise';
    life.stamina -= 18; life.mental -= 15;
    addTraumaById('sea', true);
    actionLabel = '🌊 白波で大ダメージ！「海トラウマ」発症';
    thoughtText = 'うわぁぁっ！！海の白い波に飲まれて大ダメージを受けたよ…！「🌊海トラウマ」になっちゃった！';
    quirkyCategory = 'trauma_panic'; quirkyFact = '海の白波に飲まれて海トラウマ発症';
  } else {
    const isAtSeaEdge = (Math.abs(ROBOT.pos.x) === 2 || Math.abs(ROBOT.pos.z) === 2);
    const moveEvaluations = ALL_DIRS.map(d => ({ dir: d, check: (typeof checkMoveAndPosture === 'function') ? checkMoveAndPosture(ROBOT.pos.x, ROBOT.pos.z, curH, d) : {canMove:false,reason:''} }));
    const validMoves = moveEvaluations.filter(m => m.check.canMove);
    const blockedByFat = moveEvaluations.find(m => m.check.reason === 'too_fat');
    const blockedByHighStep = moveEvaluations.find(m => m.check.reason === 'too_high_step');
    const blockedByCorner = moveEvaluations.find(m => m.check.reason === 'blocked_by_corner');

    if (blockedByFat) addTraumaById('narrow', true);
    if (curH >= 3 && Math.random() < 0.45) addTraumaById('height', true);
    if (TIME_STEP >= 14 && Math.random() < 0.22) addTraumaById('monster', true);

    const effP = getEffectiveParams();
    let chosenMove = null, wantDig = false, wantCrawlDig = false, wantRest = false, wantGodContact = false;
    let wantSolveHighStep = false, wantSolveNarrow = false, wantSolveCorner = false, wantObserveWonder = false;
    let traumaReaction = null;

    if (hasTrauma('height') && curH >= 2 && Math.random() < 0.75) traumaReaction = 'height';
    else if (hasTrauma('sea') && isAtSeaEdge && Math.random() < 0.75) traumaReaction = 'sea';
    else if (hasTrauma('overwork') && Math.random() < 0.60) traumaReaction = 'overwork';
    else if (hasTrauma('monster') && TIME_STEP >= 13 && Math.random() < 0.65) traumaReaction = 'monster';

    const restThreshold = 20 + Math.round(effP.eco * 0.38);
    if (!traumaReaction) {
      if (OBS_MODE === 'ai_mode' && Math.random() < 0.2) {
        wantGodContact = true;
      } else if (life.stamina <= restThreshold) {
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
      ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, curH); ROBOT.emotion = 'shiver';
      actionLabel = `🧗 高所トラウマ発動(裏警戒:${effP.cautionLimiter})：足がすくむ`;
      thoughtText = `「🧗高所トラウマ」で裏の警戒リミッターが0になっちゃった！高い場所が怖くて足がガタガタ震えるよ〜😭`;
      quirkyCategory = 'trauma_panic'; quirkyFact = `地上${curH}段目で高所トラウマ発動`;
    } else if (traumaReaction === 'sea') {
      const inlandMoves = validMoves.filter(m => m.check.reason !== 'sea' && Math.abs(ROBOT.pos.x + m.dir.dx) <= 1 && Math.abs(ROBOT.pos.z + m.dir.dz) <= 1);
      if (inlandMoves.length > 0) {
        const esc = inlandMoves[Math.floor(Math.random() * inlandMoves.length)];
        ROBOT.pos.x += esc.dir.dx; ROBOT.pos.z += esc.dir.dz; ROBOT.pos.lv = esc.check.targetLv; ROBOT.rotY = esc.dir.rot; ROBOT.pos.sx = 2; ROBOT.pos.sz = 2;
      }
      ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, ROBOT.pos.lv); ROBOT.emotion = 'fear';
      actionLabel = `🌊 海トラウマ発動：内陸へ避難`;
      thoughtText = `「🌊海トラウマ」で白波が怖くて内陸へ後ずさりしたよ😰`;
      quirkyCategory = 'trauma_panic'; quirkyFact = '海の近くで海トラウマが発動して後ずさり';
    } else if (traumaReaction === 'overwork') {
      ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, curH); ROBOT.emotion = 'sleep';
      life.stamina += 30; ROBOT.workStreak = 0;
      actionLabel = `⛏️ 過労トラウマ発動：サボって居眠り`;
      thoughtText = `「⛏️過労トラウマ」で省エネ駆動がMAXだよ！腰が痛いからサボって居眠りしちゃうよ…💤`;
      quirkyCategory = 'trauma_panic'; quirkyFact = '働きすぎの過労トラウマでサボり居眠り';
    } else if (traumaReaction === 'monster') {
      ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, curH); ROBOT.emotion = 'surprise';
      actionLabel = `👻 ビックリ生物トラウマ：暗闇でパニック`;
      thoughtText = `「👻ビックリ生物トラウマ」で暗闇にお化けや虫がいそうでパニックだよ😲`;
      quirkyCategory = 'trauma_panic'; quirkyFact = '夜の暗闇でビックリ生物トラウマ発動';

    } else if (wantGodContact) {
      ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, curH); ROBOT.emotion = 'wave'; lockPose = true;
      actionLabel = `📡 神様（プレイヤー）と交信中！`;
      thoughtText = `空から見守る神様（プレイヤー）、ボクのこと見てるー？`;
      quirkyCategory = 'god_contact';
      quirkyFact = `神様に向かって手を振って交信を試みた`;

    } else if (wantObserveWonder) {
      ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, curH); ROBOT.emotion = 'peek'; lockPose = true;
      life.mental = Math.min(100, life.mental + 15);
      if (TIME_STEP >= 13) {
        const pickedStar = ['🦢はくちょう座', '👑カシオペア座', '🥄北斗七星', '🏹オリオン座'][Math.floor(Math.random() * 4)];
        actionLabel = `🌌 夜空の星座観察：「${pickedStar}」を見上げた！`;
        thoughtText = `わぁ〜！夜空を見上げたらキラキラ光る「${pickedStar}」を見つけたよ！`;
        quirkyCategory = 'stage_wonder'; quirkyFact = `夜空に輝く${pickedStar}を発見して見上げた`;
      } else {
        const isTurtle = Math.random() < 0.5;
        actionLabel = isTurtle ? `🐢 島の端からのぞき込み：地下の「巨大な亀」を発見！` : `🌊 島の端からのぞき込み：「大滝と白波」を観察！`;
        thoughtText = isTurtle ? `島の端っこから下をのぞき込んだら、この島を背中で支えている「巨大な亀さん」と目が合ったよ！` : `島の端から勢いよく流れ落ちる大滝と白い水しぶきをのぞき込んだよ！`;
        quirkyCategory = 'stage_wonder'; quirkyFact = isTurtle ? '島を背中で支える巨大な亀を下に見つけた' : '島の端の大滝と水しぶきをのぞき込んだ';
      }
      DIARY_LOGS.push(`🔍 ${GAME_DAY}日目：${actionLabel}`);

    } else if (wantSolveCorner && blockedByCorner) {
      const d = blockedByCorner.dir; const sideDir = ALL_DIRS.find(dxz => dxz.dx === d.dx && dxz.dz === 0) || ALL_DIRS[0];
      ROBOT.rotY = sideDir.rot; stepCharCloseToWallForDig(sideDir);
      if (typeof digFromCharacterFront === 'function') digFromCharacterFront(ROBOT.pos.x, ROBOT.pos.z, curH, sideDir, ROBOT.posture === 'crawl', effP.power);
      ROBOT.emotion = 'swing_v'; lockPose = true;
      actionLabel = `📐 角抜けエラー解決(${bSpec.label})：邪魔な${sideDir.name}の角壁を削った！`;
      thoughtText = `斜め(${d.name})に進みたいのに角の壁がおなかに引っかかる！邪魔な${sideDir.name}の壁から削ってやるーッ😡`;
      quirkyCategory = 'corner_hit'; quirkyFact = `${d.name}へ進もうとして角の壁に引っかかり、${sideDir.name}の壁を削り始めた`;

    } else if (wantSolveHighStep && blockedByHighStep) {
      const d = blockedByHighStep.dir; ROBOT.rotY = d.rot;
      const stoneIdx = BAG.indexOf('stone');
      if (stoneIdx !== -1 && Math.random() < 0.6) {
        BAG.splice(stoneIdx, 1);
        if (typeof addSubStepFootholdAt === 'function') addSubStepFootholdAt(ROBOT.pos.x, ROBOT.pos.z, Math.max(1, sSpec.subH));
        ROBOT.pos.sx = 2; ROBOT.pos.sz = 2; ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, ROBOT.pos.lv);
        ROBOT.emotion = 'carry'; lockPose = true;
        actionLabel = `🪜 段差エラー解決(${sSpec.label}・高${sSpec.subH})：カバンの石で足元に踏み台を積んだ！`;
        thoughtText = `${d.name}の段差(分割${blockedByHighStep.check.stepDiff}ブロック)が身長(分割${sSpec.subH})より高くて登れないから、石で踏み台を積んだよ！`;
        quirkyCategory = 'high_wall'; quirkyFact = `目の前の高さ${blockedByHighStep.check.stepDiff}段の壁が登れず、石で踏み台を積んだ`;
      } else {
        stepCharCloseToWallForDig(d);
        const curSubH = (typeof getSurfaceSubUnits === 'function') ? getSurfaceSubUnits(ROBOT.pos.x, ROBOT.pos.z, curH) : 0;
        if (typeof carveFrontStepToClimbable === 'function') carveFrontStepToClimbable(ROBOT.pos.x + d.dx, ROBOT.pos.z + d.dz, curSubH, sSpec.subH);
        ROBOT.emotion = 'swing_v'; lockPose = true;
        actionLabel = `⛏️ 段差エラー解決(${sSpec.label}・高${sSpec.subH})：${d.name}の壁の手前に立って階段に削った！`;
        thoughtText = `${d.name}の壁が高すぎて登れないから、壁の手前に立ってよじ登れる高さまで階段状に削ったよ！`;
        quirkyCategory = 'high_wall'; quirkyFact = `目の前の壁が高すぎて登れず、壁を削って階段にした`;
      }
    } else if (wantSolveNarrow && blockedByFat) {
      const d = blockedByFat.dir; ROBOT.rotY = d.rot;
      const oilIdx = BAG.indexOf('oil');
      if (oilIdx !== -1) {
        BAG.splice(oilIdx, 1);
        ROBOT.pos.x += d.dx; ROBOT.pos.z += d.dz; ROBOT.pos.sx = 2; ROBOT.pos.sz = 2;
        ROBOT.posture = 'crawl'; ROBOT.emotion = 'joy';
        ROBOT.traumas = (ROBOT.traumas || []).filter(t => t !== 'narrow');
        actionLabel = `🧴 太さエラー解決(${bSpec.label}・幅${bSpec.reqWidth})：スライムオイルで狭い穴をツルッと突破！`;
        thoughtText = `太さ「${bSpec.label}(幅${bSpec.reqWidth})」で穴につかえたけど、🧴スライムオイルを塗ってツルッと滑り抜けたよ！`;
        quirkyCategory = 'narrow_hole'; quirkyFact = `狭い穴にお腹がつかえたがオイルを塗って滑り抜けた`;
      } else {
        stepCharCloseToWallForDig(d);
        if (typeof carveCrawlTunnelBlock === 'function') carveCrawlTunnelBlock(ROBOT.pos.x + d.dx, ROBOT.pos.z + d.dz, curH + 1, bSpec.reqWidth, Math.max(2, sSpec.crawlH));
        ROBOT.emotion = 'push'; lockPose = true;
        actionLabel = `👐 太さエラー解決(${bSpec.label}・幅${bSpec.reqWidth})：狭い穴を自分の太さに削り広げた！`;
        thoughtText = `狭い穴にお腹がつかえて動けないから、${d.name}の穴を幅${bSpec.reqWidth}ブロック分まで削り広げたよ！`;
        quirkyCategory = 'narrow_hole'; quirkyFact = `狭い穴にお腹がつかえて通れず、必死に壁を削り広げた`;
      }
    } else if (wantRest) {
      life.stamina += 35; life.energy -= 5; life.mental += 10;
      ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, curH); ROBOT.workStreak = 0;
      ROBOT.emotion = (life.energy <= 30) ? 'sad' : 'sleep';
      actionLabel = `💤 省エネ休憩（姿勢:${ROBOT.posture === 'crawl' ? 'ほふく維持' : '立ち'}）`;
      thoughtText = ROBOT.posture === 'crawl' ? `天井が低いトンネルの中だから、頭をぶつけないようにほふく前進のままコックリ居眠り中だよ…💤` : `マイペースにコックリ居眠りしてバッテリー温存中だよ…💤`;
    } else if (wantDig) {
      const digDir = ALL_DIRS[Math.floor(Math.random() * ALL_DIRS.length)]; ROBOT.rotY = digDir.rot;
      const digRes = (typeof digFromCharacterFront === 'function') ? digFromCharacterFront(ROBOT.pos.x, ROBOT.pos.z, curH, digDir, wantCrawlDig || ROBOT.posture === 'crawl', effP.power) : {completedLevel:false};
      life.stamina -= 9; life.mental += 10; ROBOT.workStreak = (ROBOT.workStreak || 0) + 1;
      if (ROBOT.workStreak >= 3 && life.stamina <= 55) addTraumaById('overwork', true);

      ROBOT.emotion = 'swing_v'; lockPose = true;
      if (digRes.blockedDiagFirst) {
        actionLabel = `📐 斜め奥は角壁が邪魔！まず${digRes.sideDirName}の壁を幅${bSpec.reqWidth}で削った`;
        thoughtText = `斜め奥を掘ろうとしたけど手前の角壁が邪魔だから、まず${digRes.sideDirName}の壁の手前に立って削ったよ！`;
        quirkyCategory = 'corner_hit'; quirkyFact = `斜め掘りで手前の角に引っかかり${digRes.sideDirName}の壁を削った`;
      } else if (digRes.completedLevel) {
        if (BAG.length < 10) BAG.push('stone');
        if (digRes.targetX === ROBOT.pos.x && digRes.targetZ === ROBOT.pos.z) ROBOT.pos.lv = digRes.newLv;
        ROBOT.emotion = 'joy'; lockPose = false;
        actionLabel = `⛏️ ${digDir.name}を掘り抜いて${formatHeightText(digRes.newLv)}開通！`;
        thoughtText = `${digDir.name}の壁を掘り抜いて道が開通したよ！カバンに🪨石素材をゲット！`;
      } else {
        actionLabel = `⛏️ ${digDir.name}の壁の手前で掘削中(幅${bSpec.reqWidth}×高${sSpec.subH}・残${digRes.leftCount})`;
        thoughtText = `${digDir.name}の壁の手前にピタッと立って、ボクのサイズ(幅${bSpec.reqWidth}×高${sSpec.subH})で土を削っているよ！`;
      }
    } else if (chosenMove) {
      const d = chosenMove.dir, chk = chosenMove.check;
      ROBOT.pos.x += d.dx; ROBOT.pos.z += d.dz; ROBOT.pos.lv = chk.targetLv; ROBOT.pos.sx = 2; ROBOT.pos.sz = 2; ROBOT.rotY = d.rot; ROBOT.posture = chk.posture;
      life.energy -= 6; life.stamina -= 7; life.mental += 10;

      if (chk.reason === 'scramble_climb') {
        ROBOT.emotion = 'struggle'; lockPose = true; life.stamina -= 4;
        actionLabel = `🧗 バタバタよじ登り(${sSpec.label}:高${sSpec.subH})：分割${chk.stepDiff}ブロックの段差を登った！`;
        thoughtText = `分割${chk.stepDiff}ブロックの段差はボク(${sSpec.label}・高${sSpec.subH})には壁だから、足をバタバタさせて一生けんめいよじ登ったよ！`;
        DIARY_LOGS.push(`🧗 ${GAME_DAY}日目：${sSpec.label}(高${sSpec.subH})で分割${chk.stepDiff}ブロックの段差をバタバタよじ登った！`);
      } else if (chk.reason === 'stairs_up') {
        ROBOT.emotion = 'fun'; actionLabel = `🪜 スイスイ階段上り(${sSpec.label}:高${sSpec.subH})：分割${chk.stepDiff}ブロック段差を通過`; thoughtText = `分割${chk.stepDiff}ブロックの段差なら、${sSpec.label}(高さ${sSpec.subH})のボクにはスイスイ歩ける階段だよ♪`;
      } else if (chk.reason === 'safe_landing') {
        ROBOT.emotion = 'pickup'; lockPose = true;
        actionLabel = `🦸 着地ポーズで安全降下(${sSpec.label}:高${sSpec.subH})：分割${Math.abs(chk.stepDiff)}ブロック下りた！`;
        thoughtText = `分割${Math.abs(chk.stepDiff)}ブロックの高さから飛び降りて、シュタッ！と着地ポーズでカッコよく降りたよ！`;
        quirkyCategory = 'gravity_fall'; quirkyFact = `分割${Math.abs(chk.stepDiff)}ブロックの段差を飛び降りて着地ポーズを決めた`;
      } else if (chk.reason === 'stairs_down') {
        ROBOT.emotion = 'normal'; actionLabel = `🪜 スイスイ階段下り(${sSpec.label}:高${sSpec.subH})：分割${Math.abs(chk.stepDiff)}ブロック下りた`; thoughtText = `小さな段差をトントンと階段みたいに歩いて下りたよ！`;
      } else if (chk.reason === 'high_drop_damage') {
        ROBOT.emotion = 'surprise'; life.stamina -= 16; life.mental -= 12; addTraumaById('height', true);
        actionLabel = `💥 身長超えの崖(${Math.abs(chk.stepDiff)}段)から重力落下！ダメージ＆高所トラウマ`;
        thoughtText = `わわっ！！自分の身長(分割${sSpec.subH}ブロック)より高い${Math.abs(chk.stepDiff)}ブロックの崖から落ちてお尻をぶつけたよ…！「🧗高所トラウマ」になっちゃった😭`;
        quirkyCategory = 'gravity_fall'; quirkyFact = `身長より深い${Math.abs(chk.stepDiff)}段の崖から重力落下してお尻をぶつけた`;
      } else if (chk.posture === 'crawl') {
        ROBOT.emotion = 'fun'; actionLabel = `🐛 ほふく前進(高${sSpec.crawlH}×幅${bSpec.reqWidth})で通過！`; thoughtText = `高さを半分(分割${sSpec.crawlH}ブロック)に丸めて「ほふく前進」で${d.name}へくぐり抜けたよ！`;
      } else {
        ROBOT.emotion = (effP.curiosity >= 75 || ROBOT.speed === 5) ? 'run' : 'fun'; actionLabel = `👟 ${d.name}へ移動（${sSpec.label}高${sSpec.subH}・${bSpec.label}幅${bSpec.reqWidth})）`; thoughtText = `${d.name}へ進んだよ！`;
      }
    }
  }

  const charSubY = (typeof getSurfaceSubUnitsForChar === 'function') ? getSurfaceSubUnitsForChar(ROBOT.pos.x, ROBOT.pos.z, bSpec.reqWidth, getRobotHeightLevel()) : 0;
  const itemIdx = WORLD_ITEMS.findIndex(it => {
    if (it.x !== ROBOT.pos.x || it.z !== ROBOT.pos.z) return false;
    const itemSubY = (typeof getSurfaceSubUnitsForChar === 'function') ? getSurfaceSubUnitsForChar(it.x, it.z, 3, null) : 0;
    return Math.abs(charSubY - itemSubY) <= 1;
  });

  if (itemIdx !== -1) {
    const targetItem = WORLD_ITEMS[itemIdx];
    const safePostureHere = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, getRobotHeightLevel());
    if (targetItem.type === 'apple' && hasTrauma('stomach') && Math.random() < 0.72) {
      ROBOT.posture = safePostureHere; ROBOT.emotion = 'fear';
      actionLabel = '🤢 はらいたトラウマ発動！リンゴを食べずに後ずさり'; thoughtText = '足元に🍎リンゴがあるけど、「🤢はらいたトラウマ」でおなかが痛くなるのが怖くて食べられないよ〜！';
      quirkyCategory = 'trauma_panic'; quirkyFact = 'リンゴを見つけたが、はらいたトラウマで怖くて食べられない';
    } else {
      const picked = WORLD_ITEMS.splice(itemIdx, 1)[0];
      if (picked.type === 'apple') {
        if (Math.random() < 0.16) {
          life.energy += 15; life.mental -= 12; ROBOT.posture = safePostureHere; ROBOT.emotion = 'sad'; addTraumaById('stomach', true);
          actionLabel = '🤢 傷んだリンゴでおなかイタイ！「はらいたトラウマ」発症'; thoughtText = 'うぅぅ…食べたリンゴが傷んでいておなかが痛くなっちゃった…！「🤢はらいたトラウマ」になっちゃったよ😭';
          quirkyCategory = 'trauma_panic'; quirkyFact = '傷んだリンゴを食べておなかを壊し、はらいたトラウマ発症';
        } else {
          life.energy += 45; life.mental += 15; ROBOT.posture = safePostureHere; ROBOT.emotion = 'joy'; ROBOT.traumas = (ROBOT.traumas || []).filter(t => t !== 'stomach');
          actionLabel = '🍎 おいしいリンゴを食べて大喜び！'; thoughtText = 'わーい！！甘くておいしいリンゴを食べたよ！嬉しくてバンザイジャンプ！！';
        }
      } else {
        if (BAG.length < 10) BAG.push(picked.type);
        life.mental += 10; ROBOT.posture = safePostureHere; ROBOT.emotion = 'pickup'; lockPose = true;
        actionLabel = `🤲 アイテムをしゃがんでカバンに拾った`; thoughtText = '足元にいいものが落ちていたから、しゃがんでカバンに拾ったよ！';
      }
    }
  }

  if (quirkyCategory && quirkyFact) {
    document.getElementById('ai-status').innerText = '🌀 奇想天外API通信中...';
    const aiRes = await askAIQuirkyReaction(quirkyCategory, quirkyFact);
    const customThought = applyQuirkyAIResultToRobot(aiRes, lockPose);
    if (customThought) thoughtText = customThought;
  } else {
    applyRobotBulbColor();
  }

  if (thoughtText) DIARY_LOGS.push(`💭 ${GAME_DAY}日目：${thoughtText}`);
  if (typeof resetFpvToRobotFront === 'function' && typeof manualCameraMode !== 'undefined' && manualCameraMode === 'robot') resetFpvToRobotFront();

  document.getElementById('history-action').innerText = actionLabel;
  document.getElementById('message-box').innerText = thoughtText;

  if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
  if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
  applyRobotBulbColor();
  cameraDirty = true;
  if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
  saveWorldState();

  if (life.getState().mode === 'DEAD') {
    ROBOT.emotion = 'sad';
    document.getElementById('message-box').innerText = `力尽きて倒れてしまった…。パラメータとトラウマ記憶を引き継ぎ、次の1号機（第${ROBOT.gen + 1}世代）が誕生します！`;
    setTimeout(() => {
      ROBOT.gen += 1; ROBOT.pos = { x: 0, z: 0, lv: -1, sx: 2, sz: 2 }; ROBOT.rotY = Math.PI; ROBOT.posture = 'stand'; ROBOT.emotion = 'joy'; ROBOT.bulbEmotion = null; AI_MEMORY = [];
      GAME_DAY = 1; TIME_STEP = 0; life = new LifeCore(); DIARY_LOGS.push(`📖 記憶を引き継いで1号機（第${ROBOT.gen}世代）が誕生した！`);
      if (!WORLD_ITEMS.length) WORLD_ITEMS.push({ type: 'apple', x: -1, z: 1 });
      if (typeof resetFpvToRobotFront === 'function' && typeof manualCameraMode !== 'undefined' && manualCameraMode === 'robot') resetFpvToRobotFront();
      if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
      if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition(true);
      applyRobotBulbColor(); cameraDirty = true;
      if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
      saveWorldState(); btn.disabled = false;
    }, 2000);
    return;
  }
  setTimeout(() => {
    document.getElementById('ai-status').innerText = getActiveBrainBadgeText(); applyRobotBulbColor(); btn.disabled = false;
  }, 300);
}

// ⚙️ モード切替やUIイベント群
function ensureQuirkyPromptModalDOM() {
  const settingsModal = document.getElementById('modal-settings');
  if (settingsModal && !document.getElementById('btn-open-quirky-prompts')) {
    const exprBtn = settingsModal.querySelector('[onclick*="openExpressionModalFromSettings"]');
    const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'btn-open-quirky-prompts';
    btn.style.cssText = 'width:100%; padding:10px 12px; margin:6px 0; border-radius:10px; border:1px solid #38bdf8; background:linear-gradient(135deg,#0284c7,#0369a1); color:#fff; font-weight:bold; font-size:13px; cursor:pointer; box-shadow:0 2px 8px rgba(2,132,199,0.35);';
    btn.innerText = '🌀 キャラ奇想天外プロンプト一覧（ON/OFF・短文編集）';
    btn.onclick = () => openQuirkyPromptsModalFromSettings();
    if (exprBtn && exprBtn.parentNode) exprBtn.parentNode.insertBefore(btn, exprBtn.nextSibling);
  }
  if (!document.getElementById('modal-quirky-prompts')) {
    const modal = document.createElement('div'); modal.id = 'modal-quirky-prompts'; modal.className = 'modal-overlay';
    modal.style.cssText = 'display:none; position:fixed; inset:0; z-index:999; background:rgba(2,6,23,0.78); backdrop-filter:blur(4px); align-items:center; justify-content:center; padding:12px;';
    modal.innerHTML = `
      <div class="modal-card" style="width:100%; max-width:440px; max-height:86vh; overflow-y:auto; background:#0f172a; border:1px solid #38bdf8; border-radius:16px; padding:14px; color:#f8fafc; display:flex; flex-direction:column; gap:10px; box-shadow:0 12px 32px rgba(0,0,0,0.6);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:8px;">
          <div style="font-weight:bold; font-size:14px; color:#7dd3fc;">🌀 キャラ奇想天外プロンプト一覧</div>
          <button type="button" onclick="closeModal('modal-quirky-prompts')" style="background:#1e293b; color:#cbd5e1; border:none; border-radius:8px; padding:4px 10px; font-size:12px; cursor:pointer;">✕ 閉じる</button>
        </div>
        <div style="font-size:11px; color:#94a3b8; line-height:1.4;">ハプニングが起きた時だけ短いお題をAPIに送ります。</div>
        <div id="quirky-list-container" style="display:flex; flex-direction:column; gap:8px;"></div>
        <div style="border-top:1px dashed #334155; padding-top:10px; margin-top:4px; display:flex; flex-direction:column; gap:6px;">
          <div style="font-size:12px; font-weight:bold; color:#fde047;">📡 現実イベント要約で夢と体が育つ！</div>
          <input type="text" id="reality-summary-input" placeholder="例：テレビの賑やかな音を10回聞いた" style="width:100%; padding:8px; border-radius:8px; border:1px solid #475569; background:#1e293b; color:#fff; font-size:11px; box-sizing:border-box;" />
          <button type="button" onclick="applyRealityEventSummaryToGrowth()" style="width:100%; padding:8px; border-radius:8px; border:none; background:linear-gradient(135deg,#eab308,#ca8a04); color:#0f172a; font-weight:bold; font-size:12px; cursor:pointer;">⚡ 要約を送ってキャラを物理パワーアップ！</button>
        </div>
        <div style="display:flex; gap:8px; margin-top:4px;">
          <button type="button" onclick="resetQuirkyPromptsToDefault()" style="flex:1; padding:9px; border-radius:10px; border:1px solid #475569; background:#1e293b; color:#cbd5e1; font-size:12px; cursor:pointer;">🔄 初期に戻す</button>
          <button type="button" onclick="saveQuirkyPromptsModal()" style="flex:2; padding:9px; border-radius:10px; border:none; background:linear-gradient(135deg,#38bdf8,#0284c7); color:#0f172a; font-weight:bold; font-size:13px; cursor:pointer;">💾 保存して反映</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
}

function openQuirkyPromptsModalFromSettings() { ensureQuirkyPromptModalDOM(); closeModal('modal-settings'); renderQuirkyPromptsModalList(); openModal('modal-quirky-prompts'); }
function renderQuirkyPromptsModalList() {
  const container = document.getElementById('quirky-list-container'); if (!container) return; container.innerHTML = '';
  DEFAULT_QUIRKY_PROMPTS.forEach(item => {
    const cur = QUIRKY_PROMPTS_MAP[item.id] || { enabled: item.enabled, prompt: item.prompt };
    const card = document.createElement('div'); card.style.cssText = 'background:#1e293b; border:1px solid #334155; border-radius:10px; padding:8px; display:flex; flex-direction:column; gap:5px;';
    card.innerHTML = `<label style="display:flex; align-items:center; justify-content:space-between; font-size:12px; font-weight:bold; color:#e2e8f0; cursor:pointer;"><span>${item.icon} ${item.title}</span><input type="checkbox" id="quirky-chk-${item.id}" ${cur.enabled ? 'checked' : ''} style="width:16px; height:16px; accent-color:#38bdf8;" /></label><input type="text" id="quirky-inp-${item.id}" value="${cur.prompt.replace(/"/g, '&quot;')}" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #475569; background:#0f172a; color:#bae6fd; font-size:11px; box-sizing:border-box;" />`;
    container.appendChild(card);
  });
}
function saveQuirkyPromptsModal() {
  DEFAULT_QUIRKY_PROMPTS.forEach(item => {
    const chk = document.getElementById(`quirky-chk-${item.id}`); const inp = document.getElementById(`quirky-inp-${item.id}`);
    QUIRKY_PROMPTS_MAP[item.id] = { enabled: chk ? Boolean(chk.checked) : item.enabled, prompt: (inp && inp.value.trim()) ? inp.value.trim() : item.prompt };
  });
  saveWorldState(); closeModal('modal-quirky-prompts'); showToast('🌀 奇想天外プロンプト一覧を保存したよ！');
}
function resetQuirkyPromptsToDefault() { initDefaultQuirkyPrompts(); renderQuirkyPromptsModalList(); saveWorldState(); showToast('🔄 奇想天外プロンプトを初期状態に戻したよ！'); }

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
    ROBOT.sizeLevel = sizeOrder[curSizeIdx + 1]; clampCharSubPosForBodySize();
  }
  ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, getRobotHeightLevel()); ROBOT.emotion = 'joy'; ROBOT.bulbEmotion = null;
  const sSpec = SIZE_SPECS[ROBOT.sizeLevel];
  const msg = aiRes?.thought || `📡 現実要約「${summaryText}」からエネルギーをもらって、物理パワーアップ！体格も「${sSpec.label}(高${sSpec.subH})」になったよ！`;
  document.getElementById('history-action').innerText = `⚡ 現実連動パワーアップ（出力:${ROBOT.params.power} / 高さ:${sSpec.label}）`;
  document.getElementById('message-box').innerText = msg; DIARY_LOGS.push(`📡 ${GAME_DAY}日目：${msg}`);
  closeModal('modal-quirky-prompts');
  if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
  if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
  applyRobotBulbColor(); cameraDirty = true;
  if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
  saveWorldState(); showToast('⚡ 現実イベント要約でキャラが物理パワーアップしたよ！');
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
  if (id === 'modal-diary') {
    renderDiaryModal();
    const dreamEl = document.getElementById('diary-dream-title');
    if (dreamEl) dreamEl.innerText = getCurrentDreamTitle();
  }
  if (id === 'modal-settings') {
    const obsSel = document.getElementById('setting-obs-mode');
    if (obsSel) obsSel.value = OBS_MODE;
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

  const dreamEl = document.getElementById('diary-dream-title');
  if (dreamEl) dreamEl.innerText = getCurrentDreamTitle();

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
    TIME_STEP = Math.max(TIME_STEP, 14);
    ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, getRobotHeightLevel());
    ROBOT.emotion = 'peek';
    const constellations = ['🦢はくちょう座', '👑カシオペア座', '🥄北斗七星', '🏹オリオン座'];
    const pickedStar = constellations[Math.floor(Math.random() * constellations.length)];
    let msg = `🌿 草ブロックを使ってごきげん大回復！夜空に輝く「${pickedStar}」を見上げてウットリしているよ✨`;
    const aiRes = await askAIQuirkyReaction('stage_wonder', `草ブロックを使って夜空の${pickedStar}を見上げた`);
    const customThought = applyQuirkyAIResultToRobot(aiRes, true);
    if (customThought) msg = customThought;
    document.getElementById('history-action').innerText = `🌿 草ブロックで星座観察（${pickedStar}）`;
    document.getElementById('message-box').innerText = msg;
    DIARY_LOGS.push(`🌿 ${GAME_DAY}日目：${msg}`);
    showToast(`🌿 草ブロックで「${pickedStar}」を見上げたよ！`);
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
  const obsSel = document.getElementById('setting-obs-mode');
  if (obsSel) {
    OBS_MODE = obsSel.value;
    updateModeUI();
  }
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
  showToast(`⚙️ 設定を保存したよ（モード:${OBS_MODE} / 高さ:${SIZE_SPECS[ROBOT.sizeLevel].label}）！`);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg; t.style.opacity = '1';
  setTimeout(() => { t.style.opacity = '0'; }, 2400);
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', ensureQuirkyPromptModalDOM); } else { ensureQuirkyPromptModalDOM(); }
