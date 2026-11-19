// ============================================================================
// 【掘削・歩幅移動・体積ポケット・木箱収納ルール：rules_dig.js（CHIP_MAP直結版）】
// ※ brain.js / world.js / ai_comm.js / index.html は無改造のまま接続します
// ============================================================================
(function initDigRulesModule() {
  if (window.DigRulesModule) return;

  const STORAGE_KEY = 'rules_dig_state_v2';
  const SUB_SIZE = 0.2; // 大ブロック(1.0)の1/5

  const HEIGHT_RANK = { tiny: 1, small: 2, medium: 3, large: 4, giant: 5 };
  const WIDTH_RANK  = { slim1: 1, slim2: 2, normal3: 3, fat4: 4, fat5: 5 };

  function createDefaultState() {
    return {
      initializedEmptyBag: false,
      pocketSoil: 0,
      crates: [
        { id: 'crate_1', areaId: 'home', x: -1, z: 0, capacity: 27, soil: 0 }
      ],
      dugCells: {},    // key: `${areaId}|${x},${z},${lv}` -> ["sx,sy,sz", ...]
      placedSoils: {}  // key: `${areaId}|${x},${z}` -> count
    };
  }

  let DIG_STATE = createDefaultState();

  function getCurAreaId() {
    return (typeof getCurrentAreaDef === 'function' && getCurrentAreaDef())
      ? getCurrentAreaDef().id
      : 'home';
  }

  function getSizeStats() {
    const hRank = HEIGHT_RANK[(typeof ROBOT !== 'undefined' && ROBOT.sizeLevel) || 'tiny'] || 1;
    const wRank = WIDTH_RANK[(typeof ROBOT !== 'undefined' && ROBOT.bodyType) || 'slim1'] || 1;
    return {
      reachH: hRank,           // 掘れる高さ（分割1〜5）
      reachW: wRank,           // 掘れる幅（分割1〜5）
      reachD: 1,               // 掘れる奥行き（常に目の前1列目）
      moveStep: 6 - wRank,     // 1ターン最大歩幅（やせっちょ5〜でぶっちょ1）
      pocketCap: hRank * wRank // 体積型持ち運び上限（1〜25）
    };
  }

  function getPocketTotalCount() {
    const bagItems = (typeof BAG !== 'undefined' && Array.isArray(BAG)) ? BAG.length : 0;
    return (DIG_STATE.pocketSoil || 0) + bagItems;
  }

  function saveDigState() {
    try {
      if (typeof safeStorage !== 'undefined') {
        safeStorage.setItem(STORAGE_KEY, JSON.stringify(DIG_STATE));
      }
    } catch (e) {}
  }

  // DIG_STATE.dugCells の内容を world.js 本体の CHIP_MAP へ同期反映
  function syncDugCellsToChipMap() {
    if (typeof CHIP_MAP === 'undefined') return;
    const areaId = getCurAreaId();
    Object.keys(DIG_STATE.dugCells).forEach(k => {
      if (!k.startsWith(areaId + '|')) return;
      const chipKey = k.slice(areaId.length + 1); // "x,z,lv"
      const list = DIG_STATE.dugCells[k];
      if (!Array.isArray(list) || !list.length) return;
      if (!CHIP_MAP[chipKey]) CHIP_MAP[chipKey] = {};
      list.forEach(tag => { CHIP_MAP[chipKey][tag] = true; });
    });
  }

  function loadDigState() {
    try {
      if (typeof safeStorage !== 'undefined') {
        const raw = safeStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            DIG_STATE = Object.assign(createDefaultState(), parsed);
            if (!Array.isArray(DIG_STATE.crates) || !DIG_STATE.crates.length) {
              DIG_STATE.crates = createDefaultState().crates;
            }
          }
        }
      }
    } catch (e) {
      DIG_STATE = createDefaultState();
    }

    if (!DIG_STATE.initializedEmptyBag) {
      if (typeof BAG !== 'undefined' && Array.isArray(BAG)) BAG.length = 0;
      DIG_STATE.pocketSoil = 0;
      DIG_STATE.initializedEmptyBag = true;
      saveDigState();
      if (typeof saveWorldState === 'function') saveWorldState();
    }

    syncDugCellsToChipMap();
  }

  // --------------------------------------------------------------------------
  // 0. 旧ボタンイベント（addEventListener）の完全除去
  // --------------------------------------------------------------------------
  (function rebindActionButtonCleanly() {
    const oldBtn = document.getElementById('btn-action');
    if (oldBtn && oldBtn.parentNode) {
      const newBtn = oldBtn.cloneNode(true);
      oldBtn.parentNode.replaceChild(newBtn, oldBtn);
      newBtn.addEventListener('click', () => {
        if (typeof window.executeTurn === 'function') window.executeTurn();
      });
    }
  })();

  // --------------------------------------------------------------------------
  // 1. 3D描画（3×3×3木箱 ＆ 地面に置いた1分割土ブロック）
  // ※掘削の1分割欠け自体は world.js 本体の CHIP_MAP でネイティブ描画されます
  // --------------------------------------------------------------------------
  const digVisualGroup = new THREE.Group();
  digVisualGroup.name = 'dig_rules_visual_group';
  if (typeof scene !== 'undefined' && scene) scene.add(digVisualGroup);

  const unitBoxGeo = new THREE.BoxGeometry(SUB_SIZE * 0.98, SUB_SIZE * 0.98, SUB_SIZE * 0.98);
  const unitEdgeGeo = new THREE.EdgesGeometry(unitBoxGeo);

  function buildCrateMesh(crate) {
    const grp = new THREE.Group();
    const boxSize = SUB_SIZE * 3; // 分割ブロック 3×3×3 (= 0.6)
    const yBase = (typeof getSurfaceYAt === 'function') ? getSurfaceYAt(crate.x, crate.z, null, 3) : 0;
    grp.position.set(crate.x, yBase, crate.z);

    const woodMat = new THREE.MeshLambertMaterial({ color: 0xe6be8a });
    const frameMat = new THREE.MeshLambertMaterial({ color: 0xb07d56 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(boxSize, boxSize * 0.88, boxSize), woodMat);
    body.position.y = boxSize * 0.44;
    grp.add(body);

    const rim = new THREE.Mesh(new THREE.BoxGeometry(boxSize + 0.03, 0.06, boxSize + 0.03), frameMat);
    rim.position.y = boxSize * 0.86;
    grp.add(rim);

    if (crate.soil > 0) {
      const ratio = Math.min(1, crate.soil / crate.capacity);
      const fillH = Math.max(0.06, boxSize * 0.72 * ratio);
      const soilMesh = new THREE.Mesh(
        new THREE.BoxGeometry(boxSize * 0.82, fillH, boxSize * 0.82),
        new THREE.MeshLambertMaterial({ color: 0xc28e5c })
      );
      soilMesh.position.y = fillH * 0.5 + 0.08;
      grp.add(soilMesh);
    }
    return grp;
  }

  function renderDigVisuals() {
    while (digVisualGroup.children.length) digVisualGroup.remove(digVisualGroup.children[0]);
    const areaId = getCurAreaId();

    // ① 3×3×3 木箱
    DIG_STATE.crates.forEach(c => {
      if (c.areaId === areaId) digVisualGroup.add(buildCrateMesh(c));
    });

    // ② 地面に置いた1分割土ブロック
    const soilMat = new THREE.MeshLambertMaterial({ color: 0xd4a373 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x8d5b32, transparent: true, opacity: 0.45 });
    Object.keys(DIG_STATE.placedSoils).forEach(k => {
      if (!k.startsWith(areaId + '|')) return;
      const count = DIG_STATE.placedSoils[k] || 0;
      if (count <= 0) return;
      const [bx, bz] = k.split('|')[1].split(',').map(Number);
      const baseY = (typeof getSurfaceYAt === 'function') ? getSurfaceYAt(bx, bz, null, 3) : 0;
      const showCount = Math.min(count, 25);
      for (let i = 0; i < showCount; i++) {
        const layer = Math.floor(i / 9);
        const rem = i % 9;
        const ox = ((rem % 3) - 1) * SUB_SIZE;
        const oz = (Math.floor(rem / 3) - 1) * SUB_SIZE;
        const oy = layer * SUB_SIZE + SUB_SIZE * 0.5;
        const m = new THREE.Mesh(unitBoxGeo, soilMat);
        m.position.set(bx + ox, baseY + oy, bz + oz);
        m.add(new THREE.LineSegments(unitEdgeGeo, edgeMat));
        digVisualGroup.add(m);
      }
    });
  }

  // --------------------------------------------------------------------------
  // 2. 厳密サブ座標変換 ＆ 掘削ロジック（CHIP_MAPへ1分割ブロックを直接くり抜き）
  // world.jsの式: wy = (lv - 1) * 1.0 + sy * 0.20 + 0.10
  // --------------------------------------------------------------------------
  function subYToLvSy(totalSubY) {
    const lv = Math.floor(totalSubY / 5) + 1;
    const sy = ((totalSubY % 5) + 5) % 5;
    return { lv, sy };
  }

  function hasSolidSubVoxel(tx, tz, lv, sx, sy, sz) {
    if (tx < -2 || tx > 2 || tz < -2 || tz > 2) return false;
    const minLv = (typeof AREA1_MIN_UNDER_LV !== 'undefined') ? AREA1_MIN_UNDER_LV : -4;
    const topLv = (typeof HEIGHT_MAP !== 'undefined' && HEIGHT_MAP[`${tx},${tz}`] !== undefined)
      ? HEIGHT_MAP[`${tx},${tz}`]
      : 0;
    if (lv < minLv || lv > topLv) return false;
    if (typeof CHIP_MAP !== 'undefined') {
      const ch = CHIP_MAP[`${tx},${tz},${lv}`];
      if (ch && ch[`${sx},${sy},${sz}`]) return false;
    }
    return true;
  }

  function getRobotBaseSubY() {
    const bSpec = (typeof BODY_SPECS !== 'undefined' && BODY_SPECS[ROBOT.bodyType]) || { reqWidth: 1 };
    const baseY = (typeof getSurfaceYAt === 'function')
      ? getSurfaceYAt(ROBOT.pos.x, ROBOT.pos.z, ROBOT.pos.lv, bSpec.reqWidth)
      : (ROBOT.pos.lv || 0);
    return Math.round(baseY * 5);
  }

  function findDigTargetInDirection(dir, thought) {
    const stats = getSizeStats();
    const curSx = Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2;
    const curSz = Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2;
    const curAbsX = ROBOT.pos.x * 5 + curSx;
    const curAbsZ = ROBOT.pos.z * 5 + curSz;
    const baseSubY = getRobotBaseSubY();

    const dx = Math.sign(dir.dx || 0);
    const dz = Math.sign(dir.dz || 0);
    let px = -dz, pz = dx;
    if (dx !== 0 && dz !== 0) { px = -dz; pz = 0; }

    // 横幅の探索順（左/右指定があれば優先、なければ中央から）
    const t = String(thought || '');
    const halfW = Math.floor(stats.reachW / 2);
    const wList = [];
    for (let i = 0; i < stats.reachW; i++) wList.push(i - halfW);
    if (t.includes('左')) wList.sort((a, b) => a - b);
    else if (t.includes('右')) wList.sort((a, b) => b - a);
    else wList.sort((a, b) => Math.abs(a) - Math.abs(b));

    // 高さの探索順（上/下指定があれば優先、なければ視認しやすい上から下へ）
    const hList = [];
    for (let y = 0; y < stats.reachH; y++) hList.push(y);
    if (t.includes('下') || t.includes('足元')) hList.sort((a, b) => a - b);
    else hList.sort((a, b) => b - a);

    // 体の前縁のすぐ1列目（奥行き1）
    const frontDist = Math.floor(stats.reachW / 2) + 1;

    // 1) 目の前1列目の壁（高さ 0〜reachH-1 × 幅 reachW）を探す
    for (let hi = 0; hi < hList.length; hi++) {
      const { lv, sy } = subYToLvSy(baseSubY + hList[hi]);
      for (let wi = 0; wi < wList.length; wi++) {
        const absX = curAbsX + dx * frontDist + px * wList[wi];
        const absZ = curAbsZ + dz * frontDist + pz * wList[wi];
        const tx = Math.floor(absX / 5);
        const tz = Math.floor(absZ / 5);
        const tsx = ((absX % 5) + 5) % 5;
        const tsz = ((absZ % 5) + 5) % 5;
        if (hasSolidSubVoxel(tx, tz, lv, tsx, sy, tsz)) {
          return { tx, tz, lv, tsx, tsy: sy, tsz, relH: hList[hi] + 1, kind: '壁' };
        }
      }
    }

    // 2) 目の前1列目に壁がなければ、目の前1列目の地面表面（足元1段下）を1個掘る
    const { lv: floorLv, sy: floorSy } = subYToLvSy(baseSubY - 1);
    for (let wi = 0; wi < wList.length; wi++) {
      const absX = curAbsX + dx * frontDist + px * wList[wi];
      const absZ = curAbsZ + dz * frontDist + pz * wList[wi];
      const tx = Math.floor(absX / 5);
      const tz = Math.floor(absZ / 5);
      const tsx = ((absX % 5) + 5) % 5;
      const tsz = ((absZ % 5) + 5) % 5;
      if (hasSolidSubVoxel(tx, tz, floorLv, tsx, floorSy, tsz)) {
        return { tx, tz, lv: floorLv, tsx, tsy: floorSy, tsz, relH: 0, kind: '地面' };
      }
    }

    return null;
  }

  function runSubDig(dir, thought) {
    const stats = getSizeStats();
    const used = getPocketTotalCount();
    if (used >= stats.pocketCap) {
      return {
        actionLabel: `🟫 ポケット満杯(${used}/${stats.pocketCap})で掘れない`,
        thoughtAppend: '（ポケットがいっぱい！木箱にしまうか地面に置かなきゃ）'
      };
    }

    ROBOT.rotY = dir.rot;
    const target = findDigTargetInDirection(dir, thought);
    if (!target) {
      return {
        actionLabel: `⛏️ ${dir.name}の目の前1列(高${stats.reachH}×幅${stats.reachW})に掘れる土がない`,
        thoughtAppend: '（目の前1列目は空っぽ！別の位置へ移動してから掘ろう）'
      };
    }

    // world.js 本体の CHIP_MAP へ1分割ブロックだけ直接くり抜き登録
    const chipKey = `${target.tx},${target.tz},${target.lv}`;
    const tag = `${target.tsx},${target.tsy},${target.tsz}`;
    if (typeof CHIP_MAP !== 'undefined') {
      if (!CHIP_MAP[chipKey]) CHIP_MAP[chipKey] = {};
      CHIP_MAP[chipKey][tag] = true;
    }

    // 自前セーブにも記録
    const areaId = getCurAreaId();
    const stateKey = `${areaId}|${chipKey}`;
    if (!DIG_STATE.dugCells[stateKey]) DIG_STATE.dugCells[stateKey] = [];
    if (!DIG_STATE.dugCells[stateKey].includes(tag)) DIG_STATE.dugCells[stateKey].push(tag);

    DIG_STATE.pocketSoil += 1;
    life.stamina = Math.max(0, life.stamina - 4);
    life.mental = Math.min(100, life.mental + 4);
    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    saveDigState();

    return {
      actionLabel: `⛏️ ${dir.name}の${target.kind}を1分割掘削 ポケット${getPocketTotalCount()}/${stats.pocketCap}`
    };
  }

  // --------------------------------------------------------------------------
  // 3. 移動ロジック（太さ別：1ターン最大分割1〜5ブロック移動）
  // --------------------------------------------------------------------------
  function runSubMove(dir) {
    const stats = getSizeStats();
    const maxStep = stats.moveStep;
    const dx = Math.sign(dir.dx || 0);
    const dz = Math.sign(dir.dz || 0);
    ROBOT.rotY = dir.rot;

    let curX = ROBOT.pos.x;
    let curZ = ROBOT.pos.z;
    let curLv = (typeof getRobotHeightLevel === 'function') ? getRobotHeightLevel() : (ROBOT.pos.lv || 0);
    let curSx = Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2;
    let curSz = Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2;
    const baseSubY = getRobotBaseSubY();
    const { lv: footLv, sy: footSy } = subYToLvSy(baseSubY);

    let movedSteps = 0;
    let stopReason = '';

    for (let s = 0; s < maxStep; s++) {
      let nextSx = curSx + dx;
      let nextSz = curSz + dz;
      let nextX = curX;
      let nextZ = curZ;

      if (nextSx < 0) { nextSx = 4; nextX -= 1; }
      else if (nextSx > 4) { nextSx = 0; nextX += 1; }

      if (nextSz < 0) { nextSz = 4; nextZ -= 1; }
      else if (nextSz > 4) { nextSz = 0; nextZ += 1; }

      if (nextX < -2 || nextX > 2 || nextZ < -2 || nextZ > 2) {
        stopReason = '島の端';
        break;
      }

      if (nextX !== curX || nextZ !== curZ) {
        const stepDir = { dx: nextX - curX, dz: nextZ - curZ, name: dir.name, rot: dir.rot };
        const chk = (typeof checkMoveAndPosture === 'function')
          ? checkMoveAndPosture(curX, curZ, curLv, stepDir)
          : { canMove: true, targetLv: curLv, posture: 'stand', reason: '' };
        if (!chk.canMove) {
          stopReason = chk.reason || '壁';
          break;
        }
        curLv = chk.targetLv;
        ROBOT.posture = chk.posture;
      } else if (hasSolidSubVoxel(nextX, nextZ, footLv, nextSx, footSy, nextSz)) {
        stopReason = '土の壁';
        break;
      }

      curX = nextX; curZ = nextZ; curSx = nextSx; curSz = nextSz;
      movedSteps++;
    }

    if (movedSteps > 0) {
      ROBOT.pos.x = curX;
      ROBOT.pos.z = curZ;
      ROBOT.pos.lv = curLv;
      ROBOT.pos.sx = curSx;
      ROBOT.pos.sz = curSz;
      life.energy = Math.max(0, life.energy - 3);
      life.stamina = Math.max(0, life.stamina - 4);
      life.mental = Math.min(100, life.mental + 5);
      ROBOT.params.curiosity = Math.min(100, (ROBOT.params.curiosity || 60) + 2);
      return {
        actionLabel: `🐾 ${dir.name}へ分割${movedSteps}ブロック移動(歩幅上限${maxStep})`
      };
    }
    return {
      actionLabel: `🐾 ${dir.name}へ進めなかった(${stopReason || '障害物'})`,
      thoughtAppend: '（進めなかった！掘るか別の方角へ回ろう）'
    };
  }

  // --------------------------------------------------------------------------
  // 4. 木箱収納 ＆ 地面に置くアクション
  // --------------------------------------------------------------------------
  function findNearbyCrate() {
    const areaId = getCurAreaId();
    return DIG_STATE.crates.find(c =>
      c.areaId === areaId &&
      Math.abs(ROBOT.pos.x - c.x) <= 1 &&
      Math.abs(ROBOT.pos.z - c.z) <= 1
    ) || null;
  }

  function runStoreCrate() {
    const crate = findNearbyCrate();
    if (!crate) {
      const first = DIG_STATE.crates.find(c => c.areaId === getCurAreaId());
      const hint = first ? `(${first.x},${first.z})` : 'なし';
      return {
        actionLabel: `📦 木箱が近くにない(木箱位置:${hint})`,
        thoughtAppend: '（木箱のそばまで歩かないとしまえないよ）'
      };
    }
    if (DIG_STATE.pocketSoil <= 0) {
      return { actionLabel: '📦 しまう土がポケットにない' };
    }
    const free = crate.capacity - crate.soil;
    if (free <= 0) {
      return {
        actionLabel: `📦 木箱が満杯(${crate.soil}/${crate.capacity})！`,
        thoughtAppend: '（木箱がいっぱいだ！地面に積むしかない）'
      };
    }
    const moved = Math.min(DIG_STATE.pocketSoil, free);
    DIG_STATE.pocketSoil -= moved;
    crate.soil += moved;
    ROBOT.params.logic = Math.min(100, (ROBOT.params.logic || 50) + 3);
    life.mental = Math.min(100, life.mental + 8);
    saveDigState();
    return {
      actionLabel: `📦 木箱へ土を${moved}個まとめて収納(${crate.soil}/${crate.capacity})`
    };
  }

  function runPlaceSoil(dir) {
    if (DIG_STATE.pocketSoil <= 0) {
      return { actionLabel: '🟫 置くための土がポケットにない' };
    }
    const areaId = getCurAreaId();
    const tx = Math.max(-2, Math.min(2, ROBOT.pos.x + Math.sign(dir.dx || 0)));
    const tz = Math.max(-2, Math.min(2, ROBOT.pos.z + Math.sign(dir.dz || 0)));
    const key = `${areaId}|${tx},${tz}`;
    DIG_STATE.placedSoils[key] = (DIG_STATE.placedSoils[key] || 0) + 1;
    DIG_STATE.pocketSoil -= 1;

    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    saveDigState();
    return {
      actionLabel: `🟫 地面(${tx},${tz})に分割土を1個置いた(計${DIG_STATE.placedSoils[key]}個)`
    };
  }

  // --------------------------------------------------------------------------
  // 5. 日記帳アイテム枠UI（1行目5枠：ポケット / 2行目5枠：木箱）
  // --------------------------------------------------------------------------
  const ITEM_ICONS = { apple: '🍎', stone: '🪨', oil: '🧴', grass: '🌿' };

  function renderPocketAndCrateDiaryUI() {
    const grid = document.getElementById('bag-grid');
    if (!grid) return;

    const stats = getSizeStats();
    if (grid.previousElementSibling) {
      grid.previousElementSibling.innerText =
        `🎒 上段5枠：ポケット(${getPocketTotalCount()}/${stats.pocketCap}個) ／ 下段5枠：📦木箱の数(${DIG_STATE.crates.length}/5箱)`;
    }

    grid.innerHTML = '';

    for (let i = 0; i < 5; i++) {
      const slot = document.createElement('div');
      slot.className = 'bag-slot';
      slot.style.flexDirection = 'column';
      slot.style.gap = '1px';
      slot.style.padding = '2px';

      if (i === 0 && DIG_STATE.pocketSoil > 0) {
        slot.classList.add('filled');
        const over = getPocketTotalCount() > stats.pocketCap;
        slot.style.borderColor = over ? '#ef4444' : '#b45309';
        slot.style.background = over ? '#fef2f2' : '#fef3c7';
        slot.innerHTML = `<span style="font-size:16px;line-height:1;">🟫</span><span style="font-size:9px;font-weight:900;color:${over ? '#dc2626' : '#92400e'};">${DIG_STATE.pocketSoil}/${stats.pocketCap}</span>`;
        slot.onclick = () => {
          if (typeof showToast === 'function') {
            showToast(`🟫 ポケットの分割土：${DIG_STATE.pocketSoil}個（上限 ${stats.pocketCap}個）`);
          }
        };
      } else {
        const bagIdx = i - 1;
        const item = (bagIdx >= 0 && typeof BAG !== 'undefined' && BAG[bagIdx]) ? BAG[bagIdx] : null;
        if (item) {
          slot.classList.add('filled');
          slot.innerHTML = `<span style="font-size:18px;line-height:1;">${ITEM_ICONS[item] || '📦'}</span>`;
        } else {
          slot.innerHTML = `<span style="font-size:9px;color:#94a3b8;font-weight:800;">空</span>`;
        }
      }
      grid.appendChild(slot);
    }

    for (let i = 0; i < 5; i++) {
      const slot = document.createElement('div');
      slot.className = 'bag-slot';
      slot.style.flexDirection = 'column';
      slot.style.gap = '1px';
      slot.style.padding = '2px';

      const crate = DIG_STATE.crates[i];
      if (crate) {
        slot.classList.add('filled');
        slot.style.borderColor = '#d97706';
        slot.style.background = '#fffbeb';
        slot.innerHTML = `<span style="font-size:16px;line-height:1;">📦</span><span style="font-size:9px;font-weight:900;color:#92400e;">${crate.soil}/${crate.capacity}</span>`;
        slot.onclick = () => {
          if (typeof showToast === 'function') {
            showToast(`📦 木箱#${i + 1}(3×3×3)：${crate.soil}/${crate.capacity}個 場所(${crate.x},${crate.z})`);
          }
        };
      } else {
        slot.style.borderStyle = 'dashed';
        slot.style.background = '#f8fafc';
        slot.innerHTML = `<span style="font-size:8.5px;color:#cbd5e1;font-weight:800;">木箱枠</span>`;
      }
      grid.appendChild(slot);
    }
  }

  // --------------------------------------------------------------------------
  // 6. 既存フックへの接続
  // --------------------------------------------------------------------------
  if (typeof rebuildTerrainAndItems === 'function') {
    const _origRebuild = rebuildTerrainAndItems;
    rebuildTerrainAndItems = function() {
      syncDugCellsToChipMap();
      _origRebuild();
      renderDigVisuals();
    };
  }

  if (typeof updateEnvironmentAndUI === 'function') {
    const _origUI = updateEnvironmentAndUI;
    updateEnvironmentAndUI = function() {
      _origUI();
      renderPocketAndCrateDiaryUI();
    };
  }

  if (typeof resetGameDirectly === 'function') {
    const _origReset = resetGameDirectly;
    resetGameDirectly = function() {
      try { if (typeof safeStorage !== 'undefined') safeStorage.removeItem(STORAGE_KEY); } catch (e) {}
      _origReset();
    };
  }

  const diaryBtn = document.getElementById('diary-btn');
  if (diaryBtn) {
    diaryBtn.addEventListener('click', () => setTimeout(renderPocketAndCrateDiaryUI, 20));
  }

  // --------------------------------------------------------------------------
  // 7. AICommCore へのセンサー＆アクション登録
  // --------------------------------------------------------------------------
  if (window.AICommCore) {
    window.AICommCore.registerSensor(() => {
      const stats = getSizeStats();
      const areaId = getCurAreaId();
      const crateList = DIG_STATE.crates
        .filter(c => c.areaId === areaId)
        .map((c, idx) => `木箱${idx + 1}(x=${c.x},z=${c.z},収納${c.soil}/${c.capacity})`)
        .join(', ') || 'このエリアに木箱なし';
      const curSx = Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2;
      const curSz = Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2;

      // 4方向の目の前1列目に掘れる土があるかAIへ知らせる
      const digHints = (typeof ALL_DIRS !== 'undefined' ? ALL_DIRS.slice(0, 4) : []).map(d => {
        const hit = findDigTargetInDirection(d, '');
        return `${d.name.replace('(斜め)', '')}:${hit ? `${hit.kind}掘削可` : '空'}`;
      }).join(' / ');

      return [
        `サブ位置:(sx=${curSx},sz=${curSz}) 1ターン最大歩幅:分割${stats.moveStep}ブロック`,
        `掘削到達範囲:高さ${stats.reachH}×幅${stats.reachW}×奥行き1(1ターン分割1個のみ) 掘削可能方向:[${digHints}]`,
        `ポケット:土${DIG_STATE.pocketSoil}個(合計${getPocketTotalCount()}/${stats.pocketCap}個)`,
        `設置木箱(3x3x3):${crateList}`
      ].join('\n');
    });

    window.AICommCore.registerAction({
      id: 'move',
      desc: '太さに応じた歩幅(やせっちょ5〜でぶっちょ1の分割ブロック)で指定方角へ移動する',
      run: ({ dir }) => runSubMove(dir)
    });

    window.AICommCore.registerAction({
      id: 'dig_front',
      desc: '移動せず体格の届く範囲(高さ1〜5×幅1〜5×奥行き1)から分割ブロック1個だけを掘ってポケットに入れる',
      run: ({ dir, dec }) => runSubDig(dir, dec && dec.thought)
    });

    window.AICommCore.registerAction({
      id: 'store_crate',
      desc: '近く(隣接または同じマス)にある3×3×3木箱(容量27)へポケットの土をまとめて収納する',
      run: () => runStoreCrate()
    });

    window.AICommCore.registerAction({
      id: 'place_soil',
      desc: 'ポケットの土を目の前または足元の地面に1分割ブロック置いて積む',
      run: ({ dir }) => runPlaceSoil(dir)
    });
  }

  loadDigState();
  if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
  else renderDigVisuals();
  renderPocketAndCrateDiaryUI();

  window.DigRulesModule = Object.freeze({
    getState: () => DIG_STATE,
    getSizeStats,
    renderPocketAndCrateDiaryUI,
    renderDigVisuals
  });
})();
