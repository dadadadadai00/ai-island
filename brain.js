// ============================================================================
// 【コア①：表現・プロンプト・トラウマ・体格データ定義】
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
  { key: 'swing_v',  icon: '⛏️', label: '縦に振りかざす', bulb: 0xfb923c, words: '斧、剣、ツルハシ、叩く、割る、掘る', tool: true },
  { key: 'swing_h',  icon: '🧹', label: '横に払う・掃く', bulb: 0x2dd4bf, words: '掃除、草刈り、鎌、ほうき、払う、削る', tool: true },
  { key: 'pickup',   icon: '🤲', label: '拾う・置く',     bulb: 0xa3e635, words: 'しゃがむ、採取、種まき、置く、着地ポーズ、拾う' },
  { key: 'carry',    icon: '📦', label: '持ち上げる',     bulb: 0xfbbf24, words: '重い石、筋トレ、頭上に掲げる、積む、運ぶ、踏み台' },
  { key: 'push',     icon: '👐', label: '前に押す・掘る', bulb: 0xf87171, words: '壁押し、トンネル掘り、どかす、突っ張る、掘削' },
  { key: 'run',      icon: '🏃', label: '走る・急ぐ',     bulb: 0x38bdf8, words: 'ダッシュ、逃げる、急ぐ、運動、駆け足、走る' },
  { key: 'peek',     icon: '🔍', label: 'のぞき込む',     bulb: 0xc084fc, words: '下を見る、穴をのぞく、観察、キョロキョロ、探す' },
  { key: 'struggle', icon: '🌀', label: '模索・奮闘する', bulb: 0xf43f5e, words: 'よじ登る、足をバタバタ、試行錯誤、ジタバタ挑戦' }
];

const DEFAULT_QUIRKY_PROMPTS = [
  { id: 'base_persona', icon: '🤖', title: '⑦ 常時ベース性格', enabled: true, prompt: 'あなたはパステル島のドジで憎めないロボット。小学生がクスッと笑うユーモアで話して' },
  { id: 'high_wall',    icon: '🧱', title: '① 高い壁で登れない時', enabled: true, prompt: '目の前の壁が高すぎて登れない！子どもが笑う言い訳や突破アイデアを1文で叫んで' },
  { id: 'narrow_hole',  icon: '🕳️', title: '② 狭い穴につかえた時', enabled: true, prompt: '狭い穴にお腹がつかえて動けない！奇想天外な心の声を1文で叫んで' },
  { id: 'corner_hit',   icon: '📐', title: '③ 斜めの角に引っかかった時', enabled: true, prompt: '斜めに進みたいのに角の壁が邪魔！奇想天外なツッコミを1文で叫んで' },
  { id: 'gravity_fall', icon: '🪂', title: '④ 崖や足元掘りで落下した時', enabled: true, prompt: '穴にストンと落ちた！着地のごまかしや感想を1文で叫んで' },
  { id: 'trauma_panic', icon: '⚡', title: '⑤ トラウマ発症・パニック時', enabled: true, prompt: 'トラウマが発動してパニック中！ユーモアたっぷりの心の声を1文で叫んで' },
  { id: 'stage_wonder', icon: '🌌', title: '⑥ 星座・滝・新エリア発見時', enabled: true, prompt: '島の不思議な景色や新しいエリアを発見！目をキラキラさせた感想を1文で叫んで' },
  { id: 'god_contact',  icon: '📡', title: '⑧ 神様（プレイヤー）と交信時', enabled: true, prompt: '空から見守る神様に向かって、今のエリアの状況や欲しい助けをおねだりして！' }
];

const TRAUMA_SPECS = [
  { id: 'sea',      icon: '🌊', name: '海トラウマ',         desc: '白波で溺れた(げいじゅつ-45)',       deltas: { curiosity: 0,   cautionLimiter: -45,  power: 0,   eco: 0,   logic: 0 } },
  { id: 'narrow',   icon: '🕳️', name: '狭所トラウマ',       desc: '穴につかえた(ちから+35/ぼうけん-30)', deltas: { curiosity: -30, cautionLimiter: 0,    power: 35,  eco: 0,   logic: 0 } },
  { id: 'stomach',  icon: '🤢', name: 'はらいたトラウマ',   desc: '食中毒・腹痛(ぼうけん-45)',         deltas: { curiosity: -45, cautionLimiter: -15,  power: 0,   eco: 0,   logic: 0 } },
  { id: 'height',   icon: '🧗', name: '高所トラウマ',       desc: '高い段から落下(げいじゅつが0に!)',   deltas: { curiosity: 0,   cautionLimiter: -100, power: 0,   eco: 0,   logic: 0 }, forceZeroCaution: true },
  { id: 'monster',  icon: '👻', name: 'ビックリ生物トラウマ', desc: '敵キャラに遭遇(かしこさ-45)',     deltas: { curiosity: 0,   cautionLimiter: -20,  power: 0,   eco: 0,   logic: -45 } },
  { id: 'overwork', icon: '⛏️', name: '過労トラウマ',       desc: '働きすぎ腰痛(やさしさMAX/ちから-35)', deltas: { curiosity: 0,   cautionLimiter: 0,    power: -35, eco: 100, logic: 0 }, forceMaxEco: true }
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

let CUSTOM_WORDS_MAP = {};
DEFAULT_EXPRESSIONS.forEach(item => { CUSTOM_WORDS_MAP[item.key] = item.words; });
let QUIRKY_PROMPTS_MAP = {};
function initDefaultQuirkyPrompts() {
  DEFAULT_QUIRKY_PROMPTS.forEach(item => { QUIRKY_PROMPTS_MAP[item.id] = { enabled: item.enabled, prompt: item.prompt }; });
}
initDefaultQuirkyPrompts();

let REALITY_LOG_BUFFER = [];
let OBS_MODE = 'wild';
let AI_MEMORY = [];
let CURRENT_AREA_ID = 'home';
let AREA_PUZZLE_SOLVED = {};
let HOME_SAVE_DATA = null;

// ============================================================================
// 【コア②：クラウド保存・ストレージ・LifeCore・状態変数】
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyAE7E42I361W4i" + "-I6CD4NEgydMSbAiDDOE",
  authDomain: "lifecore-5c9bf.firebaseapp.com",
  projectId: "lifecore-5c9bf",
  storageBucket: "lifecore-5c9bf.firebasestorage.app",
  messagingSenderId: "527921811555",
  appId: "1:527921811555:web:8c31f3a7ede3f700e42856"
};
let firestoreDocRef = null;
try {
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  firestoreDocRef = firebase.firestore().collection('lifecore_saves').doc('island_spacecore_v16');
} catch (e) {}

const safeStorage = {
  getItem(k) { try { return localStorage.getItem(k); } catch(e) { return null; } },
  setItem(k, v) { try { localStorage.setItem(k, v); } catch(e) {} },
  removeItem(k) { try { localStorage.removeItem(k); } catch(e) {} }
};

class LifeCore {
  constructor(save = null) {
    this.energy  = (save && typeof save.energy === 'number')  ? save.energy  : 100;
    this.stamina = (save && typeof save.stamina === 'number') ? save.stamina : 100;
    this.mental  = (save && typeof save.mental === 'number')  ? save.mental  : 100;
  }
  clamp() {
    this.energy  = Math.max(0, Math.min(100, Math.round(this.energy)));
    this.stamina = Math.max(0, Math.min(100, Math.round(this.stamina)));
    this.mental  = Math.max(0, Math.min(100, Math.round(this.mental)));
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
let DIARY_LOGS = ['🌱 1日目：独立住居＆全15エリア（天5・地5・左右5）の旅が始まった！'];
let CAM_VISUAL_STYLE = safeStorage.getItem('cam_visual_style_v15') || 'hide';
let HEIGHT_MAP = {}, CHIP_MAP = {}, WATER_MAP = {};
let currentDiaryTab = 'base';

let ROBOT = {
  unitModel: 1, gen: 1, rigType: 'box',
  pos: { x: 0, z: 1, lv: 0, sx: 2, sz: 2 },
  rotY: Math.PI, speed: 3, sizeLevel: 'tiny', bodyType: 'slim1',
  posture: 'stand', emotion: 'normal', bulbEmotion: null,
  params: { curiosity: 60, cautionLimiter: 50, power: 50, eco: 40, logic: 50, loyalty: 50 },
  traumas: [], workStreak: 0,
  pet: null // { id, x, z, lv }
};
let WORLD_ITEMS = [];

// ============================================================================
// 【コア③：全16エリア切り替え＆住居（創作物）永続保存】
// ============================================================================
function getCurrentAreaDef() {
  const reg = window.AREA_REGISTRY || {};
  return reg[CURRENT_AREA_ID] || reg.home || {
    id: 'home', group: 'home', name: '🏠 マイホーム', persistent: true,
    theme: { skyHex: 0x0f1d36, topColor: 0xa7f3d0, midColor: 0x86efac, soilColor: 0xd4a373, wetColor: 0xb07d56, showWaterfall: true },
    spawn: { x: 0, z: 1, lv: 0 }, defaultHeight: 0, heights: {}, carves: [], items: [], portals: []
  };
}

function getSubVoxelColorHex(lv, sy) {
  const th = getCurrentAreaDef().theme || {};
  if (lv >= 0) {
    if (sy === 4) return th.topColor  ?? 0xa7f3d0;
    if (sy === 3) return th.midColor  ?? 0x86efac;
    return th.soilColor ?? 0xd4a373;
  }
  if (lv === -1) return th.wetColor ?? 0xb07d56;
  if (lv === -2) return 0x9c6644;
  if (lv === -3) return 0x7f5539;
  return 0x603813;
}

function saveHomeSnapshotIfHome() {
  if (CURRENT_AREA_ID !== 'home') return;
  HOME_SAVE_DATA = {
    heightMap: JSON.parse(JSON.stringify(HEIGHT_MAP)),
    chipMap: JSON.parse(JSON.stringify(CHIP_MAP)),
    items: JSON.parse(JSON.stringify(WORLD_ITEMS))
  };
}

function applyAreaTerrain(areaDef, useSavedHome = true) {
  HEIGHT_MAP = {};
  CHIP_MAP = {};
  WATER_MAP = {};

  if (areaDef.persistent && useSavedHome && HOME_SAVE_DATA && HOME_SAVE_DATA.heightMap) {
    HEIGHT_MAP = JSON.parse(JSON.stringify(HOME_SAVE_DATA.heightMap));
    CHIP_MAP   = JSON.parse(JSON.stringify(HOME_SAVE_DATA.chipMap || {}));
    WORLD_ITEMS = JSON.parse(JSON.stringify(HOME_SAVE_DATA.items || []));
  } else {
    const defH = Number.isFinite(areaDef.defaultHeight) ? areaDef.defaultHeight : 0;
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) HEIGHT_MAP[`${x},${z}`] = defH;
    if (areaDef.heights) {
      Object.keys(areaDef.heights).forEach(k => { HEIGHT_MAP[k] = areaDef.heights[k]; });
    }
    if (Array.isArray(areaDef.carves)) {
      areaDef.carves.forEach(c => {
        if (c.type === 'top') carveTopSubLayers(c.x, c.z, HEIGHT_MAP[`${c.x},${c.z}`] ?? 0, c.keep ?? 2);
        else if (c.type === 'tunnel') carveCrawlTunnelBlock(c.x, c.z, c.lv ?? 0, c.w ?? 3, c.h ?? 2);
      });
    }
    WORLD_ITEMS = Array.isArray(areaDef.items) ? areaDef.items.map(it => ({ ...it })) : [];
  }
  enforceOuterWaterWallIntegrity();
  if (typeof window.spawnAreaEntities === 'function') window.spawnAreaEntities(areaDef);
}

function switchAreaById(targetAreaId, withFade = true) {
  const reg = window.AREA_REGISTRY || {};
  if (!reg[targetAreaId]) return false;
  if (CURRENT_AREA_ID === 'home') saveHomeSnapshotIfHome();

  const doSwitch = () => {
    CURRENT_AREA_ID = targetAreaId;
    const areaDef = getCurrentAreaDef();
    applyAreaTerrain(areaDef, true);

    const sp = areaDef.spawn || { x: 0, z: 0, lv: 0 };
    ROBOT.pos.x = sp.x; ROBOT.pos.z = sp.z;
    ROBOT.pos.lv = HEIGHT_MAP[`${sp.x},${sp.z}`] ?? sp.lv ?? 0;
    ROBOT.pos.sx = 2; ROBOT.pos.sz = 2;
    ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, ROBOT.pos.lv);
    clampCharSubPosForBodySize();
    if (ROBOT.pet && ROBOT.pet.id) {
      ROBOT.pet.x = ROBOT.pos.x; ROBOT.pet.z = ROBOT.pos.z; ROBOT.pet.lv = ROBOT.pos.lv;
    }

    if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
    if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition(true);
    if (typeof applyAreaVisualTheme === 'function') applyAreaVisualTheme(areaDef);
    if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
    updateAreaAndPetUI();
    saveWorldState();
    showToast(`🗺️ ${areaDef.name} へ移動したよ！`);
  };

  const fadeEl = document.getElementById('area-fade');
  if (withFade && fadeEl) {
    fadeEl.style.opacity = '1';
    setTimeout(() => { doSwitch(); setTimeout(() => { fadeEl.style.opacity = '0'; }, 80); }, 220);
  } else {
    doSwitch();
  }
  return true;
}

function updateAreaAndPetUI() {
  const areaDef = getCurrentAreaDef();
  const aEl = document.getElementById('ui-area-name');
  if (aEl) aEl.innerText = areaDef.name;
  const pEl = document.getElementById('ui-pet-badge');
  const petSpec = (ROBOT.pet && window.ENTITY_DB && window.ENTITY_DB.pets[ROBOT.pet.id]) ? window.ENTITY_DB.pets[ROBOT.pet.id] : null;
  if (pEl) pEl.innerText = petSpec ? `🐾 ${petSpec.icon}${petSpec.name}` : '🐾 相棒：なし';
  const daEl = document.getElementById('diary-area-label');
  if (daEl) daEl.innerText = `📍 ${areaDef.name}${areaDef.persistent ? '（創作保存ON）' : ''}`;
  const dpEl = document.getElementById('diary-pet-label');
  if (dpEl) dpEl.innerText = petSpec ? `🐾 相棒：${petSpec.icon}${petSpec.name}（${petSpec.perkLabel}）` : '🐾 ついてくる相棒：まだいません';
}

function updateModeUI() {
  const btnApple = document.getElementById('fan-btn-apple');
  const btnStep = document.getElementById('fan-btn-step');
  const btnDigDown = document.getElementById('fan-btn-digdown');
  const btnDigFront = document.getElementById('fan-btn-digfront');
  if (btnApple && btnStep && btnDigDown && btnDigFront) {
    if (OBS_MODE === 'wild') {
      btnApple.style.display = 'none'; btnStep.style.display = 'none'; btnDigDown.style.display = 'none'; btnDigFront.style.display = 'none';
    } else if (OBS_MODE === 'rescue') {
      btnApple.style.display = 'flex'; btnStep.style.display = 'none'; btnDigDown.style.display = 'none'; btnDigFront.style.display = 'none';
    } else if (OBS_MODE === 'trial') {
      btnApple.style.display = 'none'; btnStep.style.display = 'flex'; btnDigDown.style.display = 'flex'; btnDigFront.style.display = 'flex';
    } else {
      btnApple.style.display = 'flex'; btnStep.style.display = 'flex'; btnDigDown.style.display = 'flex'; btnDigFront.style.display = 'flex';
    }
  }
  const titleEl = document.getElementById('panel-header-title');
  if (titleEl) {
    const titles = {
      wild: '🌿 野生モード（AI記憶なし・自力旅）',
      rescue: '🚑 救援モード（アイテム付与OK）',
      trial: '⚡ 試練モード（段差・穴配置OK）',
      ai_mode: '🤖 AI搭載モード（記憶あり・交信）'
    };
    titleEl.innerText = titles[OBS_MODE] || '💭 ロボのきもち';
  }
}

// ============================================================================
// 【コア④：共通ヘルパー・5×5物理計算・掘削・段差・重力落下】
// ============================================================================
function getExpressionSpec(key) { return DEFAULT_EXPRESSIONS.find(e => e.key === key) || DEFAULT_EXPRESSIONS[0]; }
function matchExpressionFromText(text, fallbackKey = 'struggle') {
  if (!text) return fallbackKey;
  for (let i = 0; i < DEFAULT_EXPRESSIONS.length; i++) {
    const k = DEFAULT_EXPRESSIONS[i].key;
    const words = (CUSTOM_WORDS_MAP[k] || DEFAULT_EXPRESSIONS[i].words).split(/[、,，\s]+/).filter(Boolean);
    for (let w of words) if (w.length >= 1 && text.includes(w)) return k;
  }
  return fallbackKey;
}
function normalizeSizeKey(k) { return SIZE_SPECS[k] ? k : 'tiny'; }
function normalizeBodyKey(k) {
  if (BODY_SPECS[k]) return k;
  return k === 'fat' ? 'fat4' : (k === 'normal' ? 'normal3' : (k === 'slim' ? 'slim2' : 'slim1'));
}
function getDirNameFromRot(rotY) {
  let best = ALL_DIRS[0], minDiff = 999;
  ALL_DIRS.forEach(d => {
    const diff = Math.abs(Math.atan2(Math.sin(rotY - d.rot), Math.cos(rotY - d.rot)));
    if (diff < minDiff) { minDiff = diff; best = d; }
  });
  return best.name;
}
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
    if (!silent) showToast(`⚡「${spec.icon}${spec.name}」が発症したよ！`);
    return true;
  }
  return false;
}
function hasTrauma(id) { return Array.isArray(ROBOT.traumas) && ROBOT.traumas.includes(id); }

function getEffectiveParams() {
  const b = ROBOT.params || { curiosity: 60, cautionLimiter: 50, power: 50, eco: 40, logic: 50, loyalty: 50 };
  const eff = { curiosity: b.curiosity ?? 60, cautionLimiter: b.cautionLimiter ?? 50, power: b.power ?? 50, eco: b.eco ?? 40, logic: b.logic ?? 50, loyalty: 50 };
  let zeroC = false, maxE = false;
  (ROBOT.traumas || []).forEach(id => {
    const sp = TRAUMA_SPECS.find(t => t.id === id); if (!sp) return;
    eff.curiosity += (sp.deltas.curiosity || 0); eff.cautionLimiter += (sp.deltas.cautionLimiter || 0);
    eff.power += (sp.deltas.power || 0); eff.eco += (sp.deltas.eco || 0); eff.logic += (sp.deltas.logic || 0);
    if (sp.forceZeroCaution) zeroC = true; if (sp.forceMaxEco) maxE = true;
  });
  if (zeroC) eff.cautionLimiter = 0; if (maxE) eff.eco = 100;
  ['curiosity', 'cautionLimiter', 'power', 'eco', 'logic'].forEach(k => { eff[k] = Math.max(0, Math.min(100, Math.round(eff[k]))); });
  return eff;
}

function getCurrentDreamTitle() {
  const p = ROBOT.params || { curiosity: 60, cautionLimiter: 50, power: 50, eco: 40, logic: 50 };
  const arr = [
    { title: '🧭 探検家・勇者', val: p.curiosity ?? 60 },
    { title: '🎶 音楽家・アーティスト', val: p.cautionLimiter ?? 50 },
    { title: '👓 学者・発明家', val: p.logic ?? 50 },
    { title: '🔨 たのもしい大工さん', val: p.power ?? 50 },
    { title: '🌷 優しいお花屋さん', val: p.eco ?? 40 }
  ].sort((a, b) => b.val - a.val);
  return `『${arr[0].title}』`;
}

function clampCharSubPosForBodySize() {
  const maxOff = (BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1).wallOffsetSub ?? 0.65;
  ROBOT.pos.sx = Math.max(2 - maxOff, Math.min(2 + maxOff, Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2));
  ROBOT.pos.sz = Math.max(2 - maxOff, Math.min(2 + maxOff, Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2));
}
function stepCharCloseToWallForDig(dir) {
  if (!dir) return;
  const off = (BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1).wallOffsetSub ?? 0.65;
  const f = dir.isDiag ? 0.82 : 1.0;
  ROBOT.pos.sx = 2 + dir.dx * off * f; ROBOT.pos.sz = 2 + dir.dz * off * f;
}

function isWaterFacingOuterSubVoxel(gx, gz, lv, sx, sy, sz) {
  if (lv > 0 || (lv === 0 && sy >= 3)) return false;
  return (gx === -2 && sx === 0) || (gx === 2 && sx === 4) || (gz === -2 && sz === 0) || (gz === 2 && sz === 4);
}
function enforceOuterWaterWallIntegrity() {
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
    if (x !== -2 && x !== 2 && z !== -2 && z !== 2) continue;
    const k = `${x},${z}`, curTop = HEIGHT_MAP[k] ?? 0;
    if (curTop < 0) {
      for (let lv = curTop + 1; lv <= 0; lv++) {
        const ck = `${x},${z},${lv}`; if (!CHIP_MAP[ck]) CHIP_MAP[ck] = {};
        for (let sy = 0; sy < 5; sy++) for (let sx = 0; sx < 5; sx++) for (let sz = 0; sz < 5; sz++) {
          if (!isWaterFacingOuterSubVoxel(x, z, lv, sx, sy, sz)) CHIP_MAP[ck][`${sx},${sy},${sz}`] = 1;
          else delete CHIP_MAP[ck][`${sx},${sy},${sz}`];
        }
      }
      HEIGHT_MAP[k] = 0;
    }
    for (let lv = AREA1_MIN_UNDER_LV; lv <= 0; lv++) {
      const ck = `${x},${z},${lv}`; if (!CHIP_MAP[ck]) continue;
      for (let sy = 0; sy < 5; sy++) for (let sx = 0; sx < 5; sx++) for (let sz = 0; sz < 5; sz++) {
        if (isWaterFacingOuterSubVoxel(x, z, lv, sx, sy, sz)) delete CHIP_MAP[ck][`${sx},${sy},${sz}`];
      }
    }
  }
}

function carveCrawlTunnelBlock(gx, gz, lv, w = 3, h = 2) {
  const key = `${gx},${gz},${lv}`; if (!CHIP_MAP[key]) CHIP_MAP[key] = {};
  const s0 = Math.floor((5 - w) / 2), s1 = s0 + w - 1;
  for (let sy = 0; sy < h; sy++) for (let sx = 0; sx < 5; sx++) for (let sz = 0; sz < 5; sz++) {
    if (!isWaterFacingOuterSubVoxel(gx, gz, lv, sx, sy, sz) && ((sx >= s0 && sx <= s1) || (sz >= s0 && sz <= s1))) CHIP_MAP[key][`${sx},${sy},${sz}`] = 1;
  }
}
function carveTopSubLayers(gx, gz, lv, keep) {
  const ck = `${gx},${gz},${lv}`; if (!CHIP_MAP[ck]) CHIP_MAP[ck] = {};
  for (let sy = keep; sy < 5; sy++) for (let sx = 0; sx < 5; sx++) for (let sz = 0; sz < 5; sz++) {
    if (!isWaterFacingOuterSubVoxel(gx, gz, lv, sx, sy, sz)) CHIP_MAP[ck][`${sx},${sy},${sz}`] = 1;
  }
}

function getEffectiveClearanceSpecs() {
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;
  const myPet = (ROBOT.pet && window.ENTITY_DB && window.ENTITY_DB.pets[ROBOT.pet.id]) ? window.ENTITY_DB.pets[ROBOT.pet.id] : null;
  const stepBonus = (myPet && myPet.perk === 'step_boost') ? 1 : 0;
  return { reqWidth: bSpec.reqWidth, subH: sSpec.subH + stepBonus, stairMax: sSpec.stairMax, standH: sSpec.standH, crawlH: sSpec.crawlH };
}

function getSurfaceSubUnitsForChar(gx, gz, reqWidth = 1, lvOverride = null) {
  if (gx < -2 || gx > 2 || gz < -2 || gz > 2) return -3;
  const topLv = HEIGHT_MAP[`${gx},${gz}`] ?? 0;
  const startLv = (lvOverride !== null && lvOverride < topLv) ? lvOverride : topLv;
  const s0 = Math.floor((5 - reqWidth) / 2), s1 = s0 + reqWidth - 1;
  for (let lv = startLv; lv >= AREA1_MIN_UNDER_LV; lv--) {
    const chip = CHIP_MAP[`${gx},${gz},${lv}`];
    if (!chip) return lv * 5;
    for (let sy = 4; sy >= 0; sy--) {
      for (let sx = s0; sx <= s1; sx++) for (let sz = s0; sz <= s1; sz++) {
        if (!chip[`${sx},${sy},${sz}`]) return (lv - 1) * 5 + (sy + 1);
      }
    }
  }
  return (AREA1_MIN_UNDER_LV - 1) * 5;
}
function getSurfaceYAt(gx, gz, lvOverride = null, reqWidth = 1) {
  if (gx < -2 || gx > 2 || gz < -2 || gz > 2) return -0.55;
  return getSurfaceSubUnitsForChar(gx, gz, reqWidth, lvOverride) * 0.20;
}
function getSurfaceSubUnits(gx, gz, lvOverride = null) {
  return getSurfaceSubUnitsForChar(gx, gz, getEffectiveClearanceSpecs().reqWidth, lvOverride);
}

function evaluateBlockPassage(gx, gz, lv) {
  if (gx < -2 || gx > 2 || gz < -2 || gz > 2) return { openWidth: 5, openHeight: 5, hasCeiling: false };
  const topLv = HEIGHT_MAP[`${gx},${gz}`] ?? 0;
  if (lv >= topLv) return { openWidth: 5, openHeight: 5, hasCeiling: false };
  const chip = CHIP_MAP[`${gx},${gz},${lv + 1}`];
  if (!chip) return { openWidth: 0, openHeight: 0, hasCeiling: true };
  let openHeight = 0, minW = 5;
  for (let sy = 0; sy < 5; sy++) {
    let c = 0;
    for (let sx = 0; sx < 5; sx++) for (let sz = 0; sz < 5; sz++) if (chip[`${sx},${sy},${sz}`]) c++;
    const aw = Math.min(5, Math.floor(Math.sqrt(c)));
    if (aw >= 1) { openHeight = sy + 1; minW = Math.min(minW, aw); } else break;
  }
  return { openWidth: openHeight > 0 ? minW : 0, openHeight, hasCeiling: (openHeight < 5) || (topLv > lv + 1) };
}
function getSafePostureAt(gx, gz, lv) {
  if (gx < -2 || gx > 2 || gz < -2 || gz > 2) return 'stand';
  const pass = evaluateBlockPassage(gx, gz, lv);
  return (pass.hasCeiling && pass.openHeight > 0 && pass.openHeight < getEffectiveClearanceSpecs().standH) ? 'crawl' : 'stand';
}

function checkMoveAndPosture(gx, gz, curLv, dir) {
  const nx = gx + dir.dx, nz = gz + dir.dz;
  const effP = getEffectiveParams();
  if (nx < -2 || nx > 2 || nz < -2 || nz > 2) {
    return { canMove: (ROBOT.speed === 5) || (effP.cautionLimiter >= 80), posture: 'stand', targetLv: -99, reason: 'sea', stepDiff: 0 };
  }
  const eff = getEffectiveClearanceSpecs();
  if (dir.isDiag) {
    const cA = evaluateBlockPassage(gx + dir.dx, gz, curLv), cB = evaluateBlockPassage(gx, gz + dir.dz, curLv);
    const okA = cA.openWidth >= eff.reqWidth && (!cA.hasCeiling || cA.openHeight >= eff.crawlH);
    const okB = cB.openWidth >= eff.reqWidth && (!cB.hasCeiling || cB.openHeight >= eff.crawlH);
    if (!okA && !okB) return { canMove: false, posture: ROBOT.posture, targetLv: curLv, reason: 'blocked_by_corner', stepDiff: 0 };
  }
  const destTopLv = HEIGHT_MAP[`${nx},${nz}`] ?? 0;
  const curSubH = getSurfaceSubUnitsForChar(gx, gz, eff.reqWidth, curLv);
  const destSubH = getSurfaceSubUnitsForChar(nx, nz, eff.reqWidth, destTopLv);
  const diffSub = destSubH - curSubH;

  if (destTopLv > curLv) {
    const tp = evaluateBlockPassage(nx, nz, curLv);
    if (tp.hasCeiling && tp.openHeight >= eff.crawlH) {
      if (tp.openWidth >= eff.reqWidth) {
        const pMode = tp.openHeight >= eff.standH ? 'stand' : 'crawl';
        const tDiff = getSurfaceSubUnitsForChar(nx, nz, eff.reqWidth, curLv) - curSubH;
        if (pMode === 'crawl' && tDiff > 1) return { canMove: false, posture: 'crawl', targetLv: curLv, reason: 'crawl_steep', stepDiff: tDiff };
        return { canMove: true, posture: pMode, targetLv: curLv, reason: pMode === 'crawl' ? 'crawl_tunnel' : 'open', stepDiff: tDiff };
      }
      return { canMove: false, posture: ROBOT.posture, targetLv: curLv, reason: 'too_fat', stepDiff: 0 };
    }
  }
  if (evaluateBlockPassage(nx, nz, destTopLv).openWidth < eff.reqWidth) return { canMove: false, posture: ROBOT.posture, targetLv: curLv, reason: 'too_fat', stepDiff: diffSub };

  const safePost = getSafePostureAt(nx, nz, destTopLv);
  if (diffSub > 0) {
    if (ROBOT.posture === 'crawl' && diffSub > 1) return { canMove: false, posture: 'crawl', targetLv: curLv, reason: 'crawl_steep', stepDiff: diffSub };
    if (diffSub <= eff.stairMax) return { canMove: true, posture: safePost, targetLv: destTopLv, reason: 'stairs_up', stepDiff: diffSub };
    if (diffSub <= eff.subH) return { canMove: true, posture: safePost, targetLv: destTopLv, reason: 'scramble_climb', stepDiff: diffSub };
    return { canMove: false, posture: ROBOT.posture, targetLv: curLv, reason: 'too_high_step', stepDiff: diffSub };
  }
  const dropSub = -diffSub;
  if (dropSub === 0) return { canMove: true, posture: safePost, targetLv: destTopLv, reason: 'open', stepDiff: 0 };
  if (dropSub <= eff.stairMax) return { canMove: true, posture: safePost, targetLv: destTopLv, reason: 'stairs_down', stepDiff: diffSub };
  if (dropSub <= eff.subH) return { canMove: true, posture: safePost, targetLv: destTopLv, reason: 'safe_landing', stepDiff: diffSub };
  if (effP.cautionLimiter >= 70 || ROBOT.speed === 5) return { canMove: true, posture: safePost, targetLv: destTopLv, reason: 'high_drop_damage', stepDiff: diffSub };
  return { canMove: false, posture: ROBOT.posture, targetLv: curLv, reason: 'too_deep_cliff', stepDiff: diffSub };
}

function addSubStepFootholdAt(gx, gz, addSubCount = 2) {
  if (gx < -2 || gx > 2 || gz < -2 || gz > 2) return false;
  const topLv = HEIGHT_MAP[`${gx},${gz}`] ?? 0, ck = `${gx},${gz},${topLv}`, chip = CHIP_MAP[ck];
  if (chip && Object.keys(chip).length > 0) {
    let curTop = -1;
    for (let sy = 4; sy >= 0; sy--) if (!chip[`2,${sy},2`]) { curTop = sy; break; }
    const nextTop = Math.min(4, curTop + addSubCount);
    for (let sy = 0; sy <= nextTop; sy++) for (let sx = 0; sx < 5; sx++) for (let sz = 0; sz < 5; sz++) delete chip[`${sx},${sy},${sz}`];
    if (nextTop === 4) delete CHIP_MAP[ck];
    return true;
  }
  if (topLv >= AREA1_MAX_GROUND_LV) return false;
  const newLv = topLv + 1;
  HEIGHT_MAP[`${gx},${gz}`] = newLv;
  carveTopSubLayers(gx, gz, newLv, Math.min(5, addSubCount));
  ROBOT.pos.lv = newLv;
  return true;
}

function carveFrontStepToClimbable(tx, tz, curSubH, charSubH) {
  if (tx < -2 || tx > 2 || tz < -2 || tz > 2) return false;
  const topLv = HEIGHT_MAP[`${tx},${tz}`] ?? 0;
  const keep = Math.max(1, Math.min(4, (curSubH + charSubH) - (topLv - 1) * 5));
  carveTopSubLayers(tx, tz, topLv, keep);
  return true;
}

function digFromCharacterFront(gx, gz, curLv, dir, crawlMode = false, powerBoost = 50) {
  const eff = getEffectiveClearanceSpecs();
  if (dir && dir.isDiag) {
    const sA = evaluateBlockPassage(gx + dir.dx, gz, curLv), sB = evaluateBlockPassage(gx, gz + dir.dz, curLv);
    if (sA.openWidth < eff.reqWidth && sB.openWidth < eff.reqWidth) {
      const sideDir = ALL_DIRS.find(d => d.dx === dir.dx && d.dz === 0) || ALL_DIRS[0];
      ROBOT.rotY = sideDir.rot; stepCharCloseToWallForDig(sideDir);
      const r = digFromCharacterFront(gx, gz, curLv, sideDir, crawlMode, powerBoost);
      r.blockedDiagFirst = true; r.sideDirName = sideDir.name; return r;
    }
  }
  stepCharCloseToWallForDig(dir);
  const tx = gx + (dir ? dir.dx : 0), tz = gz + (dir ? dir.dz : 0);
  const targetX = (tx >= -2 && tx <= 2) ? tx : gx, targetZ = (tz >= -2 && tz <= 2) ? tz : gz;
  const topLv = HEIGHT_MAP[`${targetX},${targetZ}`] ?? 0;
  const digLv = (targetX !== gx || targetZ !== gz) && topLv > curLv ? (curLv + 1) : topLv;
  if (digLv <= AREA1_MIN_UNDER_LV && !CHIP_MAP[`${targetX},${targetZ},${digLv}`]) {
    return { completedLevel: false, newLv: digLv, leftCount: 0, isCrawlTunnel: false, targetX, targetZ };
  }
  const ck = `${targetX},${targetZ},${digLv}`; if (!CHIP_MAP[ck]) CHIP_MAP[ck] = {};
  const maxSy = crawlMode ? Math.max(0, eff.crawlH - 1) : Math.max(0, eff.subH - 1);
  const myPet = (ROBOT.pet && window.ENTITY_DB && window.ENTITY_DB.pets[ROBOT.pet.id]) ? window.ENTITY_DB.pets[ROBOT.pet.id] : null;
  const petMul = (myPet && myPet.perk === 'dig_boost') ? 1.5 : 1.0;
  const digCount = Math.max(1, Math.round(eff.reqWidth * (maxSy + 1) * 2 * Math.max(1, (powerBoost || 50) / 35) * petMul));
  const cwX = gx + ((ROBOT.pos.sx ?? 2) - 2) * 0.2 + (dir ? dir.dx * 0.16 : 0);
  const cwZ = gz + ((ROBOT.pos.sz ?? 2) - 2) * 0.2 + (dir ? dir.dz * 0.16 : 0);

  const cands = [];
  for (let sy = 0; sy <= 4; sy++) for (let sx = 0; sx < 5; sx++) for (let sz = 0; sz < 5; sz++) {
    if (CHIP_MAP[ck][`${sx},${sy},${sz}`] || isWaterFacingOuterSubVoxel(targetX, targetZ, digLv, sx, sy, sz)) continue;
    const dist = Math.hypot((targetX + (sx - 2) * 0.2) - cwX, (targetZ + (sz - 2) * 0.2) - cwZ);
    cands.push({ sx, sy, sz, score: dist + (sy <= maxSy ? sy * 0.08 : (sy - maxSy) * 1.2) });
  }
  cands.sort((a, b) => a.score - b.score);
  for (let i = 0; i < Math.min(digCount, cands.length); i++) CHIP_MAP[ck][`${cands[i].sx},${cands[i].sy},${cands[i].sz}`] = 1;

  let left = 0;
  for (let sy = 0; sy < 5; sy++) for (let sx = 0; sx < 5; sx++) for (let sz = 0; sz < 5; sz++) {
    if (!isWaterFacingOuterSubVoxel(targetX, targetZ, digLv, sx, sy, sz) && !CHIP_MAP[ck][`${sx},${sy},${sz}`]) left++;
  }
  const isEdge = (Math.abs(targetX) === 2 || Math.abs(targetZ) === 2);
  if (!crawlMode && left <= 8) {
    if (!isEdge || digLv > 0) {
      delete CHIP_MAP[ck];
      if (digLv > AREA1_MIN_UNDER_LV) HEIGHT_MAP[`${targetX},${targetZ}`] = digLv - 1;
      return { completedLevel: true, newLv: HEIGHT_MAP[`${targetX},${targetZ}`], leftCount: 0, isCrawlTunnel: false, targetX, targetZ };
    }
  }
  return { completedLevel: false, newLv: digLv, leftCount: left, isCrawlTunnel: false, targetX, targetZ };
}

function digUnderneathAndFall() {
  const { x, z } = ROBOT.pos; if (x < -2 || x > 2 || z < -2 || z > 2) return null;
  const eff = getEffectiveClearanceSpecs();
  const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny, bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const before = getSurfaceSubUnitsForChar(x, z, eff.reqWidth, ROBOT.pos.lv);
  const topLv = HEIGHT_MAP[`${x},${z}`] ?? 0, s0 = Math.floor((5 - eff.reqWidth) / 2), s1 = s0 + eff.reqWidth - 1;
  ROBOT.pos.sx = 2; ROBOT.pos.sz = 2;
  let dug = 0, target = Math.max(1, eff.subH);
  for (let lv = topLv; lv >= AREA1_MIN_UNDER_LV && dug < target; lv--) {
    const ck = `${x},${z},${lv}`; if (!CHIP_MAP[ck]) CHIP_MAP[ck] = {};
    for (let sy = 4; sy >= 0 && dug < target; sy--) {
      let solid = false;
      for (let sx = s0; sx <= s1; sx++) for (let sz = s0; sz <= s1; sz++) {
        if (!CHIP_MAP[ck][`${sx},${sy},${sz}`] && !isWaterFacingOuterSubVoxel(x, z, lv, sx, sy, sz)) solid = true;
      }
      if (solid) {
        for (let sx = s0; sx <= s1; sx++) for (let sz = s0; sz <= s1; sz++) {
          if (!isWaterFacingOuterSubVoxel(x, z, lv, sx, sy, sz)) CHIP_MAP[ck][`${sx},${sy},${sz}`] = 1;
        }
        dug++;
      }
    }
  }
  const after = getSurfaceSubUnitsForChar(x, z, eff.reqWidth, null);
  ROBOT.pos.lv = Math.ceil(after / 5);
  ROBOT.posture = getSafePostureAt(x, z, ROBOT.pos.lv);
  return { dropSub: Math.max(0, before - after), sSpec, bSpec, reqWidth: eff.reqWidth };
}

function hasSubVoxel(gx, gz, lv, sx, sy, sz) {
  if (gx < -2 || gx > 2 || gz < -2 || gz > 2) return false;
  if (lv < AREA1_MIN_UNDER_LV || lv > (HEIGHT_MAP[`${gx},${gz}`] ?? 0)) return false;
  const chip = CHIP_MAP[`${gx},${gz},${lv}`];
  return !(chip && chip[`${sx},${sy},${sz}`]);
}
function isExposedSubVoxel(gx, gz, lv, sx, sy, sz) {
  const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for (let i = 0; i < 6; i++) {
    let nsx = sx + dirs[i][0], nsy = sy + dirs[i][1], nsz = sz + dirs[i][2];
    if (nsx < 0 || nsx > 4 || nsy < 0 || nsy > 4 || nsz < 0 || nsz > 4) return true;
    if (!hasSubVoxel(gx, gz, lv, nsx, nsy, nsz)) return true;
  }
  return false;
}
function isAdjacentToCarvedCavity(chippedSet, sx, sy, sz) {
  if (!chippedSet) return false;
  const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for (let i = 0; i < 6; i++) {
    const a = sx + dirs[i][0], b = sy + dirs[i][1], c = sz + dirs[i][2];
    if (a >= 0 && a <= 4 && b >= 0 && b <= 4 && c >= 0 && c <= 4 && chippedSet[`${a},${b},${c}`]) return true;
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
  if (lv >= 1) return `地上${lv}段`;
  if (lv === 0) return '地下1層(地表)';
  return `地下${Math.abs(lv) + 1}層`;
}
function getActiveBrainBadgeText() {
  const t = safeStorage.getItem('ai_type') || 'none';
  if (t === 'gemini' && safeStorage.getItem('api_gemini')) return '🟦 Gemini待機中';
  if (t === 'groq' && safeStorage.getItem('api_groq')) return '🟪 Groq待機中';
  return '🟩 アルゴン待機中';
}
function getStyleShortName() {
  return CAM_VISUAL_STYLE === 'hide' ? '観察窓' : (CAM_VISUAL_STYLE === 'glass_line' ? '5×5線' : 'ガラス');
}

// ============================================================================
// 【コア⑤：セーブ＆ロード（住居データ・全16エリア・ペット対応）】
// ============================================================================
function applyLoadedWorldData(d) {
  if (!d || typeof d !== 'object') return;
  if (d.obsMode) OBS_MODE = d.obsMode;
  if (Array.isArray(d.aiMemory)) AI_MEMORY = d.aiMemory;
  if (d.areaId && window.AREA_REGISTRY && window.AREA_REGISTRY[d.areaId]) CURRENT_AREA_ID = d.areaId;
  if (d.puzzles && typeof d.puzzles === 'object') AREA_PUZZLE_SOLVED = d.puzzles;
  if (d.homeSave && typeof d.homeSave === 'object') HOME_SAVE_DATA = d.homeSave;
  if (d.life) life = new LifeCore(d.life);
  if (d.customWords) DEFAULT_EXPRESSIONS.forEach(it => { if (typeof d.customWords[it.key] === 'string') CUSTOM_WORDS_MAP[it.key] = d.customWords[it.key]; });
  if (d.quirkyPrompts) DEFAULT_QUIRKY_PROMPTS.forEach(it => {
    const s = d.quirkyPrompts[it.id];
    if (s) QUIRKY_PROMPTS_MAP[it.id] = { enabled: typeof s.enabled === 'boolean' ? s.enabled : it.enabled, prompt: s.prompt || it.prompt };
  });
  if (d.robot && d.robot.pos) {
    Object.assign(ROBOT, {
      unitModel: Number(d.robot.unitModel) || 1, gen: Number(d.robot.gen) || 1,
      rigType: d.robot.rigType === 'stick' ? 'stick' : 'box',
      rotY: Number.isFinite(d.robot.rotY) ? d.robot.rotY : Math.PI,
      speed: Number(d.robot.speed) || 3,
      sizeLevel: normalizeSizeKey(d.robot.sizeLevel),
      bodyType: normalizeBodyKey(d.robot.bodyType),
      posture: d.robot.posture === 'crawl' ? 'crawl' : 'stand',
      emotion: POSE_TABLE[d.robot.emotion] ? d.robot.emotion : 'normal',
      bulbEmotion: POSE_TABLE[d.robot.bulbEmotion] ? d.robot.bulbEmotion : null,
      pet: d.robot.pet || null
    });
    ROBOT.pos = {
      x: Number.isFinite(d.robot.pos.x) ? d.robot.pos.x : 0,
      z: Number.isFinite(d.robot.pos.z) ? d.robot.pos.z : 1,
      lv: Number.isFinite(d.robot.pos.lv) ? d.robot.pos.lv : 0,
      sx: Number.isFinite(d.robot.pos.sx) ? d.robot.pos.sx : 2,
      sz: Number.isFinite(d.robot.pos.sz) ? d.robot.pos.sz : 2
    };
    if (d.robot.params) ['curiosity','cautionLimiter','power','eco','logic'].forEach(k => {
      if (typeof d.robot.params[k] === 'number') ROBOT.params[k] = Math.max(0, Math.min(100, Math.round(d.robot.params[k])));
    });
    if (Array.isArray(d.robot.traumas)) ROBOT.traumas = d.robot.traumas.filter(id => TRAUMA_SPECS.some(t => t.id === id));
    clampCharSubPosForBodySize();
  }
  if (d.heightMap) HEIGHT_MAP = d.heightMap;
  if (d.chipMap) CHIP_MAP = d.chipMap;
  if (Array.isArray(d.items)) WORLD_ITEMS = d.items;
  if (Array.isArray(d.bag)) BAG = d.bag;
  if (Array.isArray(d.logs) && d.logs.length) DIARY_LOGS = d.logs;
  GAME_DAY = Math.max(1, Number(d.day) || 1);
  TIME_STEP = Math.max(0, Math.min(19, Number(d.time) || 0));
  if (typeof window.spawnAreaEntities === 'function') window.spawnAreaEntities(getCurrentAreaDef());
  enforceOuterWaterWallIntegrity();
  updateModeUI();
  updateAreaAndPetUI();
}

(function initStartupArea() {
  try {
    const raw = safeStorage.getItem('island_spacecore_v16');
    if (raw) { applyLoadedWorldData(JSON.parse(raw)); return; }
  } catch (e) {}
  applyAreaTerrain(getCurrentAreaDef(), false);
  saveHomeSnapshotIfHome();
})();

async function loadCloudWorldState() {
  if (!firestoreDocRef) return;
  try {
    const snap = await firestoreDocRef.get();
    if (!snap.exists) return;
    const data = snap.data();
    const parsed = data && data.stateJson ? JSON.parse(data.stateJson) : data;
    if (parsed) {
      applyLoadedWorldData(parsed);
      safeStorage.setItem('island_spacecore_v16', JSON.stringify(parsed));
      if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
      if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition(true);
      if (typeof applyAreaVisualTheme === 'function') applyAreaVisualTheme(getCurrentAreaDef());
      if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
      showToast('☁️ クラウドからデータを復元したよ！');
    }
  } catch (e) {}
}

function saveWorldState() {
  enforceOuterWaterWallIntegrity();
  saveHomeSnapshotIfHome();
  const payload = {
    obsMode: OBS_MODE, aiMemory: AI_MEMORY.slice(-20),
    areaId: CURRENT_AREA_ID, puzzles: AREA_PUZZLE_SOLVED, homeSave: HOME_SAVE_DATA,
    life: life.exportSave(), robot: ROBOT, customWords: CUSTOM_WORDS_MAP, quirkyPrompts: QUIRKY_PROMPTS_MAP,
    heightMap: HEIGHT_MAP, chipMap: CHIP_MAP, items: WORLD_ITEMS, bag: BAG, logs: DIARY_LOGS.slice(-50),
    day: GAME_DAY, time: TIME_STEP
  };
  const jsonStr = JSON.stringify(payload);
  safeStorage.setItem('island_spacecore_v16', jsonStr);
  if (firestoreDocRef) firestoreDocRef.set({ stateJson: jsonStr, updatedAt: Date.now() }).catch(() => {});
}

async function resetGameDirectly() {
  safeStorage.removeItem('island_spacecore_v16');
  safeStorage.removeItem('island_spacecore_v15');
  if (firestoreDocRef) { try { await firestoreDocRef.delete(); } catch (e) {} }
  location.reload();
}

// ============================================================================
// 【コア⑥：奇想天外API通信 ＆ メインターン（全自動16エリア旅）】
// ============================================================================
async function callMinimalLLMApi(shortPromptText) {
  const aiType = safeStorage.getItem('ai_type') || 'none';
  if (aiType === 'none') return null;
  try {
    if (aiType === 'gemini') {
      const key = safeStorage.getItem('api_gemini'); if (!key) return null;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: shortPromptText }] }], generationConfig: { responseMimeType: 'application/json' } })
      });
      const raw = (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text;
      if (raw) return JSON.parse(raw);
    } else if (aiType === 'groq') {
      const key = safeStorage.getItem('api_groq'); if (!key) return null;
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: shortPromptText }], response_format: { type: 'json_object' }, max_tokens: 140 })
      });
      const raw = (await res.json()).choices?.[0]?.message?.content;
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

async function askAIQuirkyReaction(categoryId, factSummary) {
  const conf = QUIRKY_PROMPTS_MAP[categoryId];
  if (!conf || !conf.enabled) return null;
  const basePersona = (QUIRKY_PROMPTS_MAP.base_persona && QUIRKY_PROMPTS_MAP.base_persona.enabled) ? QUIRKY_PROMPTS_MAP.base_persona.prompt : '';
  const mem = (OBS_MODE === 'ai_mode' && AI_MEMORY.length) ? `\n記憶:${AI_MEMORY.slice(-3).join('/')}` : '';
  const p = `${basePersona}\n場所:${getCurrentAreaDef().name}\n夢:${getCurrentDreamTitle()}\n事実:${factSummary}${mem}\nお題:${conf.prompt}\nJSONのみ:{"emotion":"joy/anger/sad/fun/fear/shiver/hot/think/surprise/wave/sleep/struggle","thought":"1文"}`;
  return await callMinimalLLMApi(p);
}

function applyQuirkyAIResultToRobot(aiRes, lockPose = false) {
  if (!aiRes) { ROBOT.bulbEmotion = null; applyRobotBulbColor(); return null; }
  const emo = POSE_TABLE[aiRes.emotion] ? aiRes.emotion : matchExpressionFromText(aiRes.thought, ROBOT.emotion);
  if (lockPose || LOCKED_PHYSICAL_POSES.includes(ROBOT.emotion)) ROBOT.bulbEmotion = emo;
  else { ROBOT.emotion = emo; ROBOT.bulbEmotion = null; }
  applyRobotBulbColor();
  if (OBS_MODE === 'ai_mode' && typeof aiRes.thought === 'string') AI_MEMORY.push(aiRes.thought.trim());
  return (typeof aiRes.thought === 'string' && aiRes.thought.trim()) ? aiRes.thought.trim() : null;
}

function pickAutonomousGoal(areaDef) {
  const portals = areaDef.portals || [];
  const isSolved = !!AREA_PUZZLE_SOLVED[areaDef.id];
  // 1. パズル未解決で必要アイテムを持っていればパズルマスを目指す
  if (areaDef.puzzle && !isSolved && BAG.includes(areaDef.puzzle.needItem)) {
    return { x: areaDef.puzzle.x, z: areaDef.puzzle.z, kind: 'puzzle' };
  }
  // 2. 体力低下・夜なら住居へ帰還するポータルを目指す
  if (areaDef.id !== 'home' && (life.stamina <= 35 || TIME_STEP >= 16)) {
    const back = portals.find(p => p.target === 'home' || p.type === 'stairs_down' || p.type === 'stairs_up');
    if (back && (!back.needPuzzle || isSolved)) return { x: back.x, z: back.z, kind: 'portal' };
  }
  // 3. 住居にいる時：元気なら夢ゲージや気分に応じて天・地・左右へ旅立つ
  if (areaDef.id === 'home' && life.stamina > 50 && Math.random() < 0.65) {
    const p = portals[Math.floor(Math.random() * portals.length)];
    if (p) return { x: p.x, z: p.z, kind: 'portal' };
  }
  // 4. 野生ペットがいれば仲間にしに行く
  if (window.ACTIVE_ENTITIES && window.ACTIVE_ENTITIES.wildPet && Math.random() < 0.55) {
    return { x: window.ACTIVE_ENTITIES.wildPet.x, z: window.ACTIVE_ENTITIES.wildPet.z, kind: 'pet' };
  }
  // 5. 未交換の住人がいて欲しい物を持っていれば向かう
  if (window.ACTIVE_ENTITIES && window.ACTIVE_ENTITIES.npc && !window.ACTIVE_ENTITIES.npc.traded && BAG.includes(window.ACTIVE_ENTITIES.npc.want)) {
    return { x: window.ACTIVE_ENTITIES.npc.x, z: window.ACTIVE_ENTITIES.npc.z, kind: 'npc' };
  }
  // 6. 先へ進むポータルを目指す（野生モードでの自動旅）
  const nextPortals = portals.filter(p => p.target !== 'home' && (!p.needPuzzle || isSolved));
  if (nextPortals.length && Math.random() < 0.45) {
    const p = nextPortals[Math.floor(Math.random() * nextPortals.length)];
    return { x: p.x, z: p.z, kind: 'portal' };
  }
  return null;
}

async function executeTurn() {
  const btn = document.getElementById('btn-action'); btn.disabled = true;
  document.getElementById('ai-status').innerText = '⚡ 物理＆自律探索中...';
  ROBOT.bulbEmotion = null;
  if (++TIME_STEP >= 20) { TIME_STEP = 0; GAME_DAY++; DIARY_LOGS.push(`🌅 ${GAME_DAY}日目の朝を迎えたよ！`); }

  const areaDef = getCurrentAreaDef();
  const prevX = ROBOT.pos.x, prevZ = ROBOT.pos.z, prevLv = ROBOT.pos.lv;
  const curH = getRobotHeightLevel();
  const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const effP = getEffectiveParams();
  let thoughtText = '', actionLabel = '', quirkyCategory = null, quirkyFact = '', lockPose = false;
  let movedArea = false;

  // ペットの毎ターンお助け効果
  const myPet = (ROBOT.pet && window.ENTITY_DB && window.ENTITY_DB.pets[ROBOT.pet.id]) ? window.ENTITY_DB.pets[ROBOT.pet.id] : null;
  if (myPet) {
    if (myPet.perk === 'eco_heal') life.stamina = Math.min(100, life.stamina + 4);
    if (myPet.perk === 'dream_art') ROBOT.params.cautionLimiter = Math.min(100, (ROBOT.params.cautionLimiter || 50) + 1);
  }

  if (curH === -99) {
    ROBOT.pos.x = Math.max(-2, Math.min(2, ROBOT.pos.x)); ROBOT.pos.z = Math.max(-2, Math.min(2, ROBOT.pos.z));
    ROBOT.pos.lv = HEIGHT_MAP[`${ROBOT.pos.x},${ROBOT.pos.z}`] ?? 0; ROBOT.pos.sx = 2; ROBOT.pos.sz = 2;
    ROBOT.emotion = 'surprise'; life.stamina -= 16; life.mental -= 12; addTraumaById('sea', true);
    actionLabel = '🌊 白波で大ダメージ！「海トラウマ」発症';
    thoughtText = 'うわぁっ！海の白波に飲まれちゃった…！';
    quirkyCategory = 'trauma_panic'; quirkyFact = '海の白波に飲まれた';
  } else {
    const evals = ALL_DIRS.map(d => ({ dir: d, check: checkMoveAndPosture(ROBOT.pos.x, ROBOT.pos.z, curH, d) }));
    const validMoves = evals.filter(m => m.check.canMove);
    const blockedHigh = evals.find(m => m.check.reason === 'too_high_step');
    const blockedFat  = evals.find(m => m.check.reason === 'too_fat');
    const blockedCorner = evals.find(m => m.check.reason === 'blocked_by_corner');

    const goal = pickAutonomousGoal(areaDef);
    let chosen = null;

    if (OBS_MODE === 'ai_mode' && Math.random() < 0.16) {
      ROBOT.emotion = 'wave'; lockPose = true;
      actionLabel = '📡 神様（プレイヤー）に交信中！';
      thoughtText = `おーい神様！いま「${areaDef.name}」にいるよ！夢は${getCurrentDreamTitle()}だよ！`;
      quirkyCategory = 'god_contact'; quirkyFact = `${areaDef.name}から神様に手を振った`;
    } else if (life.stamina <= 25) {
      life.stamina += 35; life.energy -= 4; life.mental += 8; ROBOT.emotion = 'sleep';
      ROBOT.params.eco = Math.min(100, (ROBOT.params.eco || 40) + 2);
      actionLabel = areaDef.id === 'home' ? '🏠 マイホームでぐっすり休憩' : '💤 省エネ休憩中';
      thoughtText = areaDef.id === 'home' ? 'マイホームでゆっくり充電中だよ…💤' : 'ちょっと疲れたからひと休みするね…💤';
    } else if (areaDef.id === 'home' && Math.random() < 0.25 && BAG.includes('stone')) {
      // 🏠 住居での創作（ブロック積み・彫刻が永続保存される）
      const ok = addSubStepFootholdAt(ROBOT.pos.x, ROBOT.pos.z, 1);
      if (ok) {
        BAG.splice(BAG.indexOf('stone'), 1);
        ROBOT.emotion = 'carry'; lockPose = true;
        ROBOT.params.cautionLimiter = Math.min(100, (ROBOT.params.cautionLimiter || 50) + 3);
        actionLabel = '🎨 マイホームでブロック創作！（自動保存）';
        thoughtText = '持ち帰った🪨石をマイホームに積んで、ぼくだけのオブジェを作ったよ！';
        DIARY_LOGS.push(`🎨 ${GAME_DAY}日目：マイホームで創作ブロックを積んだ！`);
      }
    } else if (blockedHigh && Math.random() < 0.55) {
      const d = blockedHigh.dir; ROBOT.rotY = d.rot;
      if (BAG.includes('stone')) {
        BAG.splice(BAG.indexOf('stone'), 1);
        addSubStepFootholdAt(ROBOT.pos.x, ROBOT.pos.z, Math.max(1, sSpec.subH));
        ROBOT.emotion = 'carry'; lockPose = true;
        ROBOT.params.logic = Math.min(100, (ROBOT.params.logic || 50) + 2);
        actionLabel = '🪜 石で踏み台を積んで段差突破！';
        thoughtText = '壁が高いからカバンの🪨石で踏み台を作ったよ！';
        quirkyCategory = 'high_wall'; quirkyFact = '壁が高くて石で踏み台を積んだ';
      } else {
        stepCharCloseToWallForDig(d);
        carveFrontStepToClimbable(ROBOT.pos.x + d.dx, ROBOT.pos.z + d.dz, getSurfaceSubUnits(ROBOT.pos.x, ROBOT.pos.z, curH), sSpec.subH);
        ROBOT.emotion = 'swing_v'; lockPose = true;
        ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
        actionLabel = `⛏️ ${d.name}の壁を階段状に削った！`;
        thoughtText = '登れるように壁を削って階段にしたよ！';
        quirkyCategory = 'high_wall'; quirkyFact = '壁を削って階段を作った';
      }
    } else if (blockedFat && Math.random() < 0.55) {
      const d = blockedFat.dir; ROBOT.rotY = d.rot;
      if (BAG.includes('oil')) {
        BAG.splice(BAG.indexOf('oil'), 1);
        ROBOT.pos.x += d.dx; ROBOT.pos.z += d.dz; ROBOT.posture = 'crawl'; ROBOT.emotion = 'joy';
        actionLabel = '🧴 オイルを塗って狭い穴を突破！';
        thoughtText = '🧴スライムオイルでツルッと狭い穴を抜けたよ！';
      } else {
        stepCharCloseToWallForDig(d);
        carveCrawlTunnelBlock(ROBOT.pos.x + d.dx, ROBOT.pos.z + d.dz, curH + 1, bSpec.reqWidth, Math.max(2, sSpec.crawlH));
        ROBOT.emotion = 'push'; lockPose = true; addTraumaById('narrow', true);
        actionLabel = '👐 狭い穴を自分の太さに広げた！';
        thoughtText = 'お腹がつかえたから穴を削り広げたよ！';
        quirkyCategory = 'narrow_hole'; quirkyFact = '狭い穴にお腹がつかえた';
      }
    } else if (blockedCorner && Math.random() < 0.4) {
      const d = blockedCorner.dir;
      const sideDir = ALL_DIRS.find(dxz => dxz.dx === d.dx && dxz.dz === 0) || ALL_DIRS[0];
      ROBOT.rotY = sideDir.rot; digFromCharacterFront(ROBOT.pos.x, ROBOT.pos.z, curH, sideDir, false, effP.power);
      ROBOT.emotion = 'swing_v'; lockPose = true;
      actionLabel = `📐 邪魔な${sideDir.name}の角壁を削った！`;
      thoughtText = '斜めに進みたいから邪魔な角を削ったよ！';
      quirkyCategory = 'corner_hit'; quirkyFact = '斜めの角壁に引っかかった';
    } else if (validMoves.length) {
      const apple = WORLD_ITEMS.find(it => it.type === 'apple');
      if (life.energy <= 50 && apple) {
        validMoves.sort((a, b) => Math.hypot(ROBOT.pos.x + a.dir.dx - apple.x, ROBOT.pos.z + a.dir.dz - apple.z) - Math.hypot(ROBOT.pos.x + b.dir.dx - apple.x, ROBOT.pos.z + b.dir.dz - apple.z));
        chosen = validMoves[0];
      } else if (goal) {
        validMoves.sort((a, b) => Math.hypot(ROBOT.pos.x + a.dir.dx - goal.x, ROBOT.pos.z + a.dir.dz - goal.z) - Math.hypot(ROBOT.pos.x + b.dir.dx - goal.x, ROBOT.pos.z + b.dir.dz - goal.z));
        chosen = validMoves[0];
      } else {
        chosen = validMoves[Math.floor(Math.random() * validMoves.length)];
      }
      const d = chosen.dir, chk = chosen.check;
      ROBOT.pos.x += d.dx; ROBOT.pos.z += d.dz; ROBOT.pos.lv = chk.targetLv;
      ROBOT.pos.sx = 2; ROBOT.pos.sz = 2; ROBOT.rotY = d.rot; ROBOT.posture = chk.posture;
      life.energy -= 4; life.stamina -= 5; life.mental += 6;
      // 電車ごっこ方式でペットを1歩後ろへ追従
      if (typeof window.updatePetFollowPosition === 'function') window.updatePetFollowPosition(prevX, prevZ, prevLv);
      // エリアごとの夢ボーナス育成
      if (areaDef.dreamBonus && ROBOT.params[areaDef.dreamBonus] !== undefined) {
        ROBOT.params[areaDef.dreamBonus] = Math.min(100, ROBOT.params[areaDef.dreamBonus] + 2);
      }
      if (chk.reason === 'scramble_climb') {
        ROBOT.emotion = 'struggle'; lockPose = true;
        actionLabel = `🧗 段差(分割${chk.stepDiff})をよじ登った！`;
        thoughtText = `よいしょっ！段差をバタバタよじ登ったよ！`;
      } else if (chk.reason === 'safe_landing') {
        ROBOT.emotion = 'pickup'; lockPose = true;
        actionLabel = `🦸 着地ポーズで安全降下！`;
        thoughtText = `シュタッ！カッコよく着地したよ！`;
      } else if (chk.reason === 'high_drop_damage') {
        ROBOT.emotion = 'surprise'; life.stamina -= 14; addTraumaById('height', true);
        actionLabel = '💥 高い崖から落下！高所トラウマ発症';
        thoughtText = 'わわっ！お尻をぶつけちゃった😭';
        quirkyCategory = 'gravity_fall'; quirkyFact = '高い崖から落下してお尻を打った';
      } else {
        ROBOT.emotion = (chk.posture === 'crawl') ? 'fun' : 'run';
        actionLabel = `👟 ${areaDef.name}：${d.name}へ移動`;
        thoughtText = goal && goal.kind === 'portal' ? `次のエリアへ続く仕掛けを目指して${d.name}へ進むよ！` : `${d.name}へ探検中だよ！`;
      }
    } else {
      const digDir = ALL_DIRS[Math.floor(Math.random() * 4)];
      ROBOT.rotY = digDir.rot; digFromCharacterFront(ROBOT.pos.x, ROBOT.pos.z, curH, digDir, false, effP.power);
      ROBOT.emotion = 'swing_v'; lockPose = true; life.stamina -= 7;
      actionLabel = `⛏️ ${digDir.name}を掘り進めた！`;
      thoughtText = '道がないから自分で掘り抜くよ！';
    }
  }

  // 🧩 1. 素材パズル判定（パズルマス到達＆必要アイテム所持）
  if (areaDef.puzzle && !AREA_PUZZLE_SOLVED[areaDef.id] && ROBOT.pos.x === areaDef.puzzle.x && ROBOT.pos.z === areaDef.puzzle.z) {
    const pIdx = BAG.indexOf(areaDef.puzzle.needItem);
    if (pIdx !== -1) {
      BAG.splice(pIdx, 1);
      AREA_PUZZLE_SOLVED[areaDef.id] = true;
      ROBOT.emotion = 'joy';
      if (areaDef.dreamBonus) ROBOT.params[areaDef.dreamBonus] = Math.min(100, (ROBOT.params[areaDef.dreamBonus] || 50) + 8);
      actionLabel = `🧩 素材パズル解決！${areaDef.puzzle.reward === 'unlock_portal' ? '次の道が開通！' : '夢ゲージ大成長！'}`;
      thoughtText = `やったー！${areaDef.puzzle.desc}`;
      DIARY_LOGS.push(`🧩 ${GAME_DAY}日目：${areaDef.name}のパズルを解いた！`);
      showToast('🧩 パズルを解いたよ！');
    }
  }

  // 🍎 2. 足元アイテム拾得
  const itemIdx = WORLD_ITEMS.findIndex(it => it.x === ROBOT.pos.x && it.z === ROBOT.pos.z);
  if (itemIdx !== -1) {
    const picked = WORLD_ITEMS.splice(itemIdx, 1)[0];
    if (picked.type === 'apple' && life.energy <= 80) {
      life.energy += 40; life.mental += 12; ROBOT.emotion = 'joy';
      actionLabel = '🍎 リンゴを食べて元気いっぱい！';
      thoughtText = 'わーい！おいしいリンゴを食べたよ！';
    } else if (BAG.length < 10) {
      BAG.push(picked.type); ROBOT.emotion = 'pickup';
      actionLabel = `🤲 アイテム(${picked.type})をカバンに拾った`;
    }
  }

  // 🤝 3. エリア住人との自動アイテム交換
  if (typeof window.tryInteractWithNpc === 'function') {
    const npcRes = window.tryInteractWithNpc(ROBOT.pos.x, ROBOT.pos.z);
    if (npcRes) {
      actionLabel = npcRes.action; thoughtText = npcRes.thought;
      if (npcRes.traded) { ROBOT.emotion = 'joy'; DIARY_LOGS.push(`🤝 ${GAME_DAY}日目：${npcRes.action}`); }
    }
  }

  // 👻 4. 敵キャラとの遭遇（ペットがいれば撃退）
  if (typeof window.checkEnemyEncounter === 'function') {
    const eRes = window.checkEnemyEncounter(ROBOT.pos.x, ROBOT.pos.z);
    if (eRes) {
      actionLabel = eRes.action; thoughtText = eRes.thought;
      if (!eRes.guarded) {
        life.stamina = Math.max(5, life.stamina - (eRes.dmg || 10));
        ROBOT.emotion = 'surprise'; addTraumaById('monster', true);
      } else {
        ROBOT.emotion = 'joy';
      }
    }
  }

  // 🐾 5. 野生ペットの仲間化＆交代
  if (typeof window.tryBefriendWildPet === 'function') {
    const petRes = window.tryBefriendWildPet(ROBOT.pos.x, ROBOT.pos.z, ROBOT.params.eco || 40);
    if (petRes) {
      actionLabel = petRes.action; thoughtText = petRes.thought; ROBOT.emotion = 'joy';
      DIARY_LOGS.push(`🐾 ${GAME_DAY}日目：${petRes.action}`);
      updateAreaAndPetUI();
    }
  }

  // 🚪 6. 階段・穴・ワープ装置を踏んだら自律エリア切り替え！
  const portal = (areaDef.portals || []).find(p => p.x === ROBOT.pos.x && p.z === ROBOT.pos.z);
  if (portal) {
    const isLocked = portal.needPuzzle && !AREA_PUZZLE_SOLVED[areaDef.id];
    if (isLocked) {
      actionLabel = `🔒 仕掛けが閉じている！（パズルを解こう）`;
      thoughtText = areaDef.puzzle ? areaDef.puzzle.desc : 'まだ通れないみたい！';
    } else {
      movedArea = true;
      const destName = (window.AREA_REGISTRY && window.AREA_REGISTRY[portal.target]) ? window.AREA_REGISTRY[portal.target].name : portal.target;
      actionLabel = `${portal.label} → ${destName}`;
      thoughtText = `わくわく！「${portal.label}」を使って【${destName}】へ移動したよ！`;
      DIARY_LOGS.push(`🗺️ ${GAME_DAY}日目：${destName} へ旅した！`);
      quirkyCategory = 'stage_wonder'; quirkyFact = `${destName}へ新しく到着した`;
      switchAreaById(portal.target, true);
    }
  }

  if (quirkyCategory && quirkyFact) {
    document.getElementById('ai-status').innerText = '🌀 奇想天外API通信中...';
    const aiRes = await askAIQuirkyReaction(quirkyCategory, quirkyFact);
    const custom = applyQuirkyAIResultToRobot(aiRes, lockPose);
    if (custom) thoughtText = custom;
  } else {
    applyRobotBulbColor();
  }

  document.getElementById('history-action').innerText = actionLabel;
  document.getElementById('message-box').innerText = thoughtText;

  if (!movedArea) {
    if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
    if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
    if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
    updateAreaAndPetUI();
    saveWorldState();
  }

  if (life.getState().mode === 'DEAD') {
    ROBOT.emotion = 'sad';
    document.getElementById('message-box').innerText = `力尽きてしまった…。夢と記憶を引き継ぎ、マイホームで第${ROBOT.gen + 1}世代が誕生します！`;
    setTimeout(() => {
      ROBOT.gen += 1; life = new LifeCore(); GAME_DAY = 1; TIME_STEP = 0; AI_MEMORY = [];
      DIARY_LOGS.push(`📖 記憶を引き継いで第${ROBOT.gen}世代がマイホームに誕生した！`);
      switchAreaById('home', true);
      btn.disabled = false;
    }, 1800);
    return;
  }

  setTimeout(() => {
    document.getElementById('ai-status').innerText = getActiveBrainBadgeText();
    applyRobotBulbColor();
    btn.disabled = false;
  }, 260);
}

// ============================================================================
// 【コア⑦：UI操作・手帳・ガチャ・設定・基本表現・奇想天外モーダル】
// ============================================================================
async function quickDigDown() {
  const res = digUnderneathAndFall(); if (!res) return;
  ROBOT.emotion = res.dropSub > res.sSpec.subH ? 'surprise' : (res.dropSub > 0 ? 'pickup' : 'swing_v');
  document.getElementById('history-action').innerText = `👇 足元掘り(${res.dropSub}段落下)`;
  document.getElementById('message-box').innerText = res.dropSub > 0 ? `足元を掘って分割${res.dropSub}ブロック落下したよ！` : '足元を掘ったよ！';
  if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
  if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
  if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
  saveWorldState(); closeFanMenu();
}

function setTinySlimPreset() {
  ROBOT.sizeLevel = 'tiny'; ROBOT.bodyType = 'slim1'; ROBOT.emotion = 'joy';
  ROBOT.posture = getSafePostureAt(ROBOT.pos.x, ROBOT.pos.z, getRobotHeightLevel());
  clampCharSubPosForBodySize();
  if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
  if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
  saveWorldState(); renderDiaryModal(); showToast('🧚 極小(高1)×やせっちょ(幅1)にしたよ！');
}
function changeRobotSizeFromDiary(k) {
  if (!SIZE_SPECS[k]) return; ROBOT.sizeLevel = k; clampCharSubPosForBodySize();
  if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
  if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
  saveWorldState(); renderDiaryModal();
}
function changeRobotBodyFromDiary(k) {
  if (!BODY_SPECS[k]) return; ROBOT.bodyType = k; clampCharSubPosForBodySize();
  if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
  if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
  saveWorldState(); renderDiaryModal();
}
function cycleBodyAndCrawlTest() {
  const so = ['tiny','small','medium','large','giant'], bo = ['slim1','slim2','normal3','fat4','fat5'];
  const n = (so.indexOf(ROBOT.sizeLevel) + 1) % 5;
  ROBOT.sizeLevel = so[n]; ROBOT.bodyType = bo[n]; clampCharSubPosForBodySize();
  if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
  if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
  saveWorldState(); showToast(`${SIZE_SPECS[ROBOT.sizeLevel].label} × ${BODY_SPECS[ROBOT.bodyType].label}`);
}
function quickDiagonalOrFrontDig() {
  const d = ALL_DIRS[4 + Math.floor(Math.random() * 4)]; ROBOT.rotY = d.rot; ROBOT.emotion = 'swing_v';
  digFromCharacterFront(ROBOT.pos.x, ROBOT.pos.z, getRobotHeightLevel(), d, true, 50);
  if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
  if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
  saveWorldState(); closeFanMenu(); showToast(`⛏️ ${d.name}を削ったよ！`);
}
function closeFanMenu() { const w = document.getElementById('fan-menu-wrapper'); if (w) w.classList.remove('open'); }
function quickDropApple() {
  WORLD_ITEMS.push({ type: 'apple', x: ROBOT.pos.x, z: ROBOT.pos.z });
  if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
  saveWorldState(); closeFanMenu(); showToast('🍎 足元にリンゴを置いたよ！');
}
function quickStackSubStep() {
  if (!addSubStepFootholdAt(ROBOT.pos.x, ROBOT.pos.z, 1)) { showToast('ここは地上上限(5段目)だよ！'); closeFanMenu(); return; }
  ROBOT.emotion = 'carry';
  if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
  if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
  saveWorldState(); closeFanMenu(); showToast('🪜 足元に小段差+1を積んだよ！');
}

function openModal(id) {
  ensureQuirkyPromptModalDOM();
  if (typeof activePointers !== 'undefined') activePointers.clear();
  if (id === 'modal-diary') renderDiaryModal();
  if (id === 'modal-settings') {
    const o = document.getElementById('setting-obs-mode'); if (o) o.value = OBS_MODE;
    const j = document.getElementById('setting-jump-area'); if (j) j.value = '';
    document.getElementById('setting-cam-style').value = CAM_VISUAL_STYLE;
    document.getElementById('setting-size-level').value = ROBOT.sizeLevel;
    document.getElementById('setting-body-type').value = ROBOT.bodyType;
  }
  const el = document.getElementById(id); if (el) { el.style.display = 'flex'; el.classList.add('active'); }
}
function closeModal(id) {
  if (typeof activePointers !== 'undefined') activePointers.clear();
  const el = document.getElementById(id); if (el) { el.classList.remove('active'); el.style.display = 'none'; }
}

function switchDiaryParamTab(tabKey) {
  currentDiaryTab = tabKey === 'hidden' ? 'hidden' : 'base';
  document.getElementById('tab-diary-base').className = 'rig-tab-btn' + (currentDiaryTab === 'base' ? ' active' : '');
  document.getElementById('tab-diary-hidden').className = 'rig-tab-btn' + (currentDiaryTab === 'hidden' ? ' active-danger' : '');
  document.getElementById('diary-panel-base').style.display = currentDiaryTab === 'base' ? 'flex' : 'none';
  document.getElementById('diary-panel-hidden').style.display = currentDiaryTab === 'hidden' ? 'flex' : 'none';
  renderDiaryModal();
}
function onParamSliderInput(k, v) {
  ROBOT.params[k] = Math.max(0, Math.min(100, Number(v) || 0));
  const el = document.getElementById(`val-param-${k}`); if (el) el.innerText = ROBOT.params[k];
  const dEl = document.getElementById('diary-dream-title'); if (dEl) dEl.innerText = getCurrentDreamTitle();
  updateHiddenParamsUI(); saveWorldState();
}
function toggleTraumaButton(id) {
  const idx = ROBOT.traumas.indexOf(id);
  if (idx >= 0) ROBOT.traumas.splice(idx, 1); else ROBOT.traumas.push(id);
  saveWorldState(); renderDiaryModal();
}
function clearAllTraumas() { ROBOT.traumas = []; saveWorldState(); renderDiaryModal(); showToast('🧹 トラウマを全クリアしたよ！'); }

function updateHiddenParamsUI() {
  const base = ROBOT.params, eff = getEffectiveParams();
  ['curiosity','cautionLimiter','power','eco','logic'].forEach(k => {
    const diff = (eff[k] ?? 50) - (base[k] ?? 50);
    const bar = document.getElementById(`eff-bar-${k}`), val = document.getElementById(`eff-val-${k}`);
    if (bar) { bar.style.width = `${eff[k]}%`; bar.className = 'eff-bar-fill' + (diff > 0 ? ' up' : (diff < 0 ? ' down' : '')); }
    if (val) val.innerHTML = diff > 0 ? `${eff[k]} <span class="diff-plus">(+${diff})</span>` : (diff < 0 ? `${eff[k]} <span class="diff-minus">(${diff})</span>` : `${eff[k]} <span class="diff-zero">(±0)</span>`);
  });
}

function renderDiaryModal() {
  const s = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny, b = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  document.getElementById('diary-emo-icon').innerText = getExpressionSpec(ROBOT.emotion).icon;
  document.getElementById('diary-robo-name').innerText = `${ROBOT.unitModel}号機（${ROBOT.rigType === 'stick' ? '🦴3D骨組み' : '🎲サイコロ箱型'}・${GAME_DAY}日目）`;
  document.getElementById('diary-robo-height').innerText = `高さ:${s.label}(${s.subH}) / 太さ:${b.label}(${b.reqWidth})`;
  document.getElementById('diary-step-rule').innerText = `🪜階段:${s.stairMax} / 🧗よじ登り:${getEffectiveClearanceSpecs().subH} / 🐛ほふく:${s.crawlH}`;
  document.getElementById('diary-dream-title').innerText = getCurrentDreamTitle();
  updateAreaAndPetUI();

  ['curiosity','cautionLimiter','power','eco','logic'].forEach(k => {
    const sl = document.getElementById(`param-${k}`), vl = document.getElementById(`val-param-${k}`);
    if (sl) sl.value = ROBOT.params[k] ?? 50; if (vl) vl.innerText = ROBOT.params[k] ?? 50;
  });
  const tagList = document.getElementById('base-trauma-tag-list');
  if (tagList) {
    tagList.innerHTML = ROBOT.traumas.length ? ROBOT.traumas.map(id => {
      const sp = TRAUMA_SPECS.find(t => t.id === id); return sp ? `<span class="trauma-tag">${sp.icon} ${sp.name}</span>` : '';
    }).join('') : `<span style="color:#94a3b8; font-size:10px;">トラウマはありません</span>`;
  }
  updateHiddenParamsUI();
  const btnGrid = document.getElementById('trauma-btn-grid');
  if (btnGrid) {
    btnGrid.innerHTML = '';
    TRAUMA_SPECS.forEach(sp => {
      const btn = document.createElement('button'); btn.type = 'button';
      btn.className = 'trauma-toggle-btn' + (hasTrauma(sp.id) ? ' active' : '');
      btn.innerHTML = `<div>${sp.icon} ${sp.name}${hasTrauma(sp.id) ? '【ON】' : ''}</div><div class="trauma-btn-sub">${sp.desc}</div>`;
      btn.onclick = () => toggleTraumaButton(sp.id); btnGrid.appendChild(btn);
    });
  }
  ['giant','large','medium','small','tiny'].forEach(k => { const c = document.getElementById(`size-chip-${k}`); if (c) c.classList.toggle('active', ROBOT.sizeLevel === k); });
  ['fat5','fat4','normal3','slim2','slim1'].forEach(k => { const c = document.getElementById(`body-chip-${k}`); if (c) c.classList.toggle('active', ROBOT.bodyType === k); });
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

function useBagItem(index) {
  const item = BAG[index]; if (!item) return;
  if (item === 'stone') {
    if (!addSubStepFootholdAt(ROBOT.pos.x, ROBOT.pos.z, 2)) { showToast('地上上限(5段目)だよ！'); return; }
    BAG.splice(index, 1); ROBOT.emotion = 'carry'; showToast('🪨 足元に踏み台を積んだよ！');
  } else if (item === 'grass') {
    BAG.splice(index, 1); life.mental = Math.min(100, life.mental + 30); ROBOT.emotion = 'peek'; showToast('🌿 草ブロックでごきげん回復！');
  } else if (item === 'oil') {
    BAG.splice(index, 1); ROBOT.traumas = ROBOT.traumas.filter(t => t !== 'narrow'); ROBOT.emotion = 'joy'; showToast('🧴 オイルで狭所トラウマ解消！');
  } else if (item === 'apple') {
    WORLD_ITEMS.push({ type: 'apple', x: ROBOT.pos.x, z: ROBOT.pos.z }); BAG.splice(index, 1); showToast('🍎 足元にリンゴを置いたよ！');
  }
  if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
  if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
  if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
  saveWorldState(); renderDiaryModal();
}

let tempRigType = 'box', tempEmotionKey = 'normal';
function openExpressionModalFromSettings() {
  closeModal('modal-settings'); tempRigType = ROBOT.rigType; tempEmotionKey = ROBOT.emotion;
  document.getElementById('tab-rig-box').classList.toggle('active', tempRigType === 'box');
  document.getElementById('tab-rig-stick').classList.toggle('active', tempRigType === 'stick');
  const listEl = document.getElementById('expr-list-container'); listEl.innerHTML = '';
  DEFAULT_EXPRESSIONS.forEach(item => {
    const row = document.createElement('div'); row.className = 'expr-row' + (item.key === tempEmotionKey ? ' selected' : ''); row.id = `expr-row-${item.key}`;
    row.innerHTML = `<button type="button" class="expr-left-btn" onclick="selectTempExpressionRow('${item.key}')"><span class="expr-icon">${item.icon}</span><span>${item.label}</span></button><input type="text" class="expr-right-input" id="expr-words-${item.key}" value="${(CUSTOM_WORDS_MAP[item.key] || item.words).replace(/"/g,'&quot;')}">`;
    listEl.appendChild(row);
  });
  openModal('modal-expressions');
}
function selectTempRigTab(r) {
  tempRigType = r === 'stick' ? 'stick' : 'box';
  document.getElementById('tab-rig-box').classList.toggle('active', tempRigType === 'box');
  document.getElementById('tab-rig-stick').classList.toggle('active', tempRigType === 'stick');
}
function selectTempExpressionRow(k) {
  tempEmotionKey = k;
  DEFAULT_EXPRESSIONS.forEach(it => { const r = document.getElementById(`expr-row-${it.key}`); if (r) r.classList.toggle('selected', it.key === k); });
}
function confirmExpressionModal() {
  DEFAULT_EXPRESSIONS.forEach(it => { const inp = document.getElementById(`expr-words-${it.key}`); if (inp && inp.value.trim()) CUSTOM_WORDS_MAP[it.key] = inp.value.trim(); });
  ROBOT.rigType = tempRigType; ROBOT.emotion = tempEmotionKey; ROBOT.bulbEmotion = null;
  closeModal('modal-expressions');
  if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
  applyRobotBulbColor(); if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
  saveWorldState(); showToast('✅ 表現と骨組みを反映したよ！');
}
function cancelExpressionModal() { closeModal('modal-expressions'); }

function ensureQuirkyPromptModalDOM() {
  const sm = document.getElementById('modal-settings');
  if (sm && !document.getElementById('btn-open-quirky-prompts')) {
    const ref = sm.querySelector('[onclick*="openExpressionModalFromSettings"]');
    const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'btn-open-quirky-prompts';
    btn.style.cssText = 'width:100%; padding:10px; margin:4px 0; border-radius:10px; border:1px solid #38bdf8; background:linear-gradient(135deg,#0284c7,#0369a1); color:#fff; font-weight:bold; font-size:12.5px; cursor:pointer;';
    btn.innerText = '🌀 キャラ奇想天外プロンプト一覧（編集）';
    btn.onclick = () => { closeModal('modal-settings'); renderQuirkyPromptsModalList(); openModal('modal-quirky-prompts'); };
    if (ref && ref.parentNode) ref.parentNode.insertBefore(btn, ref.nextSibling);
  }
  if (!document.getElementById('modal-quirky-prompts')) {
    const m = document.createElement('div'); m.id = 'modal-quirky-prompts'; m.className = 'modal-overlay';
    m.innerHTML = `<div class="modal-content" style="background:#0f172a; color:#f8fafc; border:1px solid #38bdf8;"><div class="modal-close" onclick="closeModal('modal-quirky-prompts')">✕</div><div class="modal-title" style="color:#7dd3fc;">🌀 奇想天外プロンプト一覧</div><div id="quirky-list-container" style="display:flex; flex-direction:column; gap:6px;"></div><div style="display:flex; gap:8px; margin-top:6px;"><button class="btn-sub" onclick="initDefaultQuirkyPrompts(); renderQuirkyPromptsModalList();">初期化</button><button class="btn-primary" onclick="saveQuirkyPromptsModal()">保存</button></div></div>`;
    document.body.appendChild(m);
  }
}
function renderQuirkyPromptsModalList() {
  const c = document.getElementById('quirky-list-container'); if (!c) return; c.innerHTML = '';
  DEFAULT_QUIRKY_PROMPTS.forEach(it => {
    const cur = QUIRKY_PROMPTS_MAP[it.id] || it;
    const d = document.createElement('div'); d.style.cssText = 'background:#1e293b; padding:7px; border-radius:8px; display:flex; flex-direction:column; gap:4px;';
    d.innerHTML = `<label style="display:flex; justify-content:space-between; font-size:11.5px; font-weight:bold;"><span>${it.icon} ${it.title}</span><input type="checkbox" id="quirky-chk-${it.id}" ${cur.enabled ? 'checked' : ''}></label><input type="text" id="quirky-inp-${it.id}" value="${cur.prompt.replace(/"/g,'&quot;')}" style="width:100%; padding:5px; border-radius:5px; border:1px solid #475569; background:#0f172a; color:#bae6fd; font-size:11px;">`;
    c.appendChild(d);
  });
}
function saveQuirkyPromptsModal() {
  DEFAULT_QUIRKY_PROMPTS.forEach(it => {
    const chk = document.getElementById(`quirky-chk-${it.id}`), inp = document.getElementById(`quirky-inp-${it.id}`);
    QUIRKY_PROMPTS_MAP[it.id] = { enabled: chk ? chk.checked : it.enabled, prompt: (inp && inp.value.trim()) ? inp.value.trim() : it.prompt };
  });
  saveWorldState(); closeModal('modal-quirky-prompts'); showToast('🌀 プロンプトを保存したよ！');
}

function saveSettings() {
  const o = document.getElementById('setting-obs-mode'); if (o) { OBS_MODE = o.value; updateModeUI(); }
  CAM_VISUAL_STYLE = document.getElementById('setting-cam-style').value || 'hide';
  safeStorage.setItem('cam_visual_style_v15', CAM_VISUAL_STYLE);
  ROBOT.sizeLevel = normalizeSizeKey(document.getElementById('setting-size-level').value);
  ROBOT.bodyType = normalizeBodyKey(document.getElementById('setting-body-type').value);
  clampCharSubPosForBodySize();
  safeStorage.setItem('ai_type', document.getElementById('setting-ai-type').value);
  safeStorage.setItem('api_gemini', document.getElementById('setting-gemini-key').value.trim());
  safeStorage.setItem('api_groq', document.getElementById('setting-groq-key').value.trim());
  ROBOT.speed = Number(document.getElementById('setting-speed').value) || 3;
  const jumpEl = document.getElementById('setting-jump-area');
  const jumpId = jumpEl ? jumpEl.value : '';
  closeModal('modal-settings');
  if (jumpId && window.AREA_REGISTRY && window.AREA_REGISTRY[jumpId]) {
    switchAreaById(jumpId, true);
  } else {
    if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
    if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition();
    if (typeof updateAllCamerasTransform === 'function') updateAllCamerasTransform();
    if (typeof updateEnvironmentAndUI === 'function') updateEnvironmentAndUI();
    saveWorldState(); showToast('⚙️ 設定を保存したよ！');
  }
}

function showToast(msg) {
  const t = document.getElementById('toast'); if (!t) return;
  t.innerText = msg; t.style.opacity = '1';
  setTimeout(() => { t.style.opacity = '0'; }, 2400);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { ensureQuirkyPromptModalDOM(); updateModeUI(); updateAreaAndPetUI(); });
} else {
  ensureQuirkyPromptModalDOM(); updateModeUI(); updateAreaAndPetUI();
}
