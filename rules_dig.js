// ============================================================================
// 【掘削・歩幅移動・体積ポケット・木箱収納ルール：rules_dig.js】
// ※ brain.js / world.js / ai_comm.js は無改造のままプラグイン接続します
// ============================================================================
(function initDigRulesModule() {
  if (window.DigRulesModule) return;

  const STORAGE_KEY = 'rules_dig_state_v1';
  const SUB_SIZE = 0.2; // 大ブロック(1.0)の1/5

  // 体格ランク（高さ1〜5 / 太さ1〜5）
  const HEIGHT_RANK = { tiny: 1, small: 2, medium: 3, large: 4, giant: 5 };
  const WIDTH_RANK  = { slim1: 1, slim2: 2, normal3: 3, fat4: 4, fat5: 5 };

  // 初期状態生成
  function createDefaultState() {
    return {
      initializedEmptyBag: false,
      pocketSoil: 0,
      crates: [
        { id: 'crate_1', areaId: 'home', x: -1, z: 0, capacity: 27, soil: 0 }
      ],
      dugCells: {},     // key: `${areaId}|${x},${z},${lv}` -> array of "sx,sy,sz"
      placedSoils: {}   // key: `${areaId}|${x},${z}` -> count (1分割ブロック積み上げ数)
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
      reachH: hRank,          // 掘れる高さ（分割1〜5）
      reachW: wRank,          // 掘れる幅（分割1〜5）
      reachD: 1,              // 掘れる奥行き（常に目の前1列目）
      moveStep: 6 - wRank,    // 1ターン歩幅（やせっちょ5〜でぶっちょ1）
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

    // スタート時、キャラの持ち物を完全に空にする（初回のみ適用）
    if (!DIG_STATE.initializedEmptyBag) {
      if (typeof BAG !== 'undefined' && Array.isArray(BAG)) BAG.length = 0;
      DIG_STATE.pocketSoil = 0;
      DIG_STATE.initializedEmptyBag = true;
      saveDigState();
      if (typeof saveWorldState === 'function') saveWorldState();
    }
  }

  // --------------------------------------------------------------------------
  // 1. 3D描画（3×3×3木箱・置いた1分割土・削り跡マーカー）
  // --------------------------------------------------------------------------
  const digVisualGroup = new THREE.Group();
  if (typeof scene !== 'undefined' && scene) scene.add(digVisualGroup);

  function buildCrateMesh(crate) {
    const grp = new THREE.Group();
    const boxSize = SUB_SIZE * 3; // 分割ブロック 3×3×3 (= 0.6)
    const yBase = (typeof getSurfaceYAt === 'function') ? getSurfaceYAt(crate.x, crate.z, null, 3) : 0;
    grp.position.set(crate.x, yBase, crate.z);

    // 木箱本体（パステルウッド調）
    const woodMat = new THREE.MeshLambertMaterial({ color: 0xe6be8a });
    const frameMat = new THREE.MeshLambertMaterial({ color: 0xb07d56 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(boxSize, boxSize * 0.88, boxSize), woodMat);
    body.position.y = boxSize * 0.44;
    grp.add(body);

    // 上部フチ枠
    const rim = new THREE.Mesh(new THREE.BoxGeometry(boxSize + 0.03, 0.06, boxSize + 0.03), frameMat);
    rim.position.y = boxSize * 0.86;
    grp.add(rim);

    // 中身が入っているほど土が盛り上がる表現
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

    // ① 3×3×3 木箱の描画
    DIG_STATE.crates.forEach(c => {
      if (c.areaId === areaId) digVisualGroup.add(buildCrateMesh(c));
    });

    // ② 地面に置いた分割土ブロック（1個＝0.2×0.2×0.2）の描画
    const soilMat = new THREE.MeshLambertMaterial({ color: 0xd4a373 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x8d5b32, transparent: true, opacity: 0.45 });
    const unitGeo = new THREE.BoxGeometry(SUB_SIZE * 0.96, SUB_SIZE * 0.96, SUB_SIZE * 0.96);
    const unitEdges = new THREE.EdgesGeometry(unitGeo);

    Object.keys(DIG_STATE.placedSoils).forEach(k => {
      if (!k.startsWith(areaId + '|')) return;
      const count = DIG_STATE.placedSoils[k] || 0;
      if (count <= 0) return;
      const [bx, bz] = k.split('|')[1].split(',').map(Number);
      const baseY = (typeof getSurfaceYAt === 'function') ? getSurfaceYAt(bx, bz, null, 3) : 0;
      const showCount = Math.min(count, 25); // 視覚上限（5×5分）
      for (let i = 0; i < showCount; i++) {
        const layer = Math.floor(i / 9);
        const rem = i % 9;
        const ox = ((rem % 3) - 1) * SUB_SIZE;
        const oz = (Math.floor(rem / 3) - 1) * SUB_SIZE;
        const oy = layer * SUB_SIZE + SUB_SIZE * 0.5;
        const m = new THREE.Mesh(unitGeo, soilMat);
        m.position.set(bx + ox, baseY + oy, bz + oz);
        const ln = new THREE.LineSegments(unitEdges, edgeMat);
        m.add(ln);
        digVisualGroup.add(m);
      }
    });

    // ③ 掘削済み1分割セルの視覚マーカー（削り進捗が見えるくぼみ枠）
    const dugMat = new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.32 });
    Object.keys(DIG_STATE.dugCells).forEach(k => {
      if (!k.startsWith(areaId + '|')) return;
      const list = DIG_STATE.dugCells[k];
      if (!Array.isArray(list) || !list.length) return;
      const [bx, bz, blv] = k.split('|')[1].split(',').map(Number);
      list.forEach(cellStr => {
        const [sx, sy, sz] = cellStr.split(',').map(Number);
        const m = new THREE.Mesh(unitGeo, dugMat);
        m.position.set(
          bx + (sx - 2) * SUB_SIZE,
          blv + sy * SUB_SIZE + SUB_SIZE * 0.5,
          bz + (sz - 2) * SUB_SIZE
        );
        digVisualGroup.add(m);
      });
    });
  }

  // --------------------------------------------------------------------------
  // 2. 掘削ロジック（高さ1〜5 × 幅1〜5 × 奥行き1・1ターン1分割ブロック）
  // --------------------------------------------------------------------------
  function getFrontSubCoord(dir, offsetW, offsetH) {
    // 進行方向(dx, dz)の手前1列目（奥行き1）と横幅オフセットを算出
    const curSx = Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2;
    const curSz = Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2;
    const dx = Math.sign(dir.dx || 0);
    const dz = Math.sign(dir.dz || 0);

    // 進行方向に垂直な横軸ベクトル
    let px = -dz, pz = dx;
    if (dx !== 0 && dz !== 0) { px = -dz; pz = 0; }

    let absSx = ROBOT.pos.x * 5 + curSx + dx + px * offsetW;
    let absSz = ROBOT.pos.z * 5 + curSz + dz + pz * offsetW;

    const tx = Math.floor(absSx / 5);
    const tz = Math.floor(absSz / 5);
    const tsx = ((absSx % 5) + 5) % 5;
    const tsz = ((absSz % 5) + 5) % 5;
    const tsy = Math.max(0, Math.min(4, offsetH));
    return { tx, tz, tsx, tsy, tsz };
  }

  function pickTargetOrderFromThought(thought, reachW, reachH) {
    const t = String(thought || '');
    const halfW = Math.floor(reachW / 2);
    const wList = [];
    for (let i = 0; i < reachW; i++) wList.push(i - halfW);
    if (t.includes('左')) wList.sort((a, b) => a - b);
    else if (t.includes('右')) wList.sort((a, b) => b - a);
    else wList.sort((a, b) => Math.abs(a) - Math.abs(b));

    const hList = [];
    for (let y = 0; y < reachH; y++) hList.push(y);
    if (t.includes('上') || t.includes('高')) hList.sort((a, b) => b - a);
    else if (t.includes('下') || t.includes('足元')) hList.sort((a, b) => a - b);

    const pairs = [];
    hList.forEach(h => wList.forEach(w => pairs.push({ w, h })));
    return pairs;
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

    const areaId = getCurAreaId();
    const curLv = (typeof getRobotHeightLevel === 'function') ? getRobotHeightLevel() : (ROBOT.pos.lv || 0);
    ROBOT.rotY = dir.rot;

    const order = pickTargetOrderFromThought(thought, stats.reachW, stats.reachH);
    let chosen = null;

    for (let i = 0; i < order.length; i++) {
      const c = getFrontSubCoord(dir, order[i].w, order[i].h);
      if (c.tx < -2 || c.tx > 2 || c.tz < -2 || c.tz > 2) continue;

      // 対象座標に土（高さ）があるか確認
      const targetH = (typeof HEIGHT_MAP !== 'undefined' && HEIGHT_MAP[`${c.tx},${c.tz}`] !== undefined)
        ? HEIGHT_MAP[`${c.tx},${c.tz}`]
        : 0;
      const targetLv = (targetH >= curLv) ? curLv : targetH;
      const cellKey = `${areaId}|${c.tx},${c.tz},${targetLv}`;
      const dugArr = DIG_STATE.dugCells[cellKey] || [];
      const tag = `${c.tsx},${c.tsy},${c.tsz}`;
      if (!dugArr.includes(tag)) {
        chosen = { ...c, targetLv, cellKey, tag };
        break;
      }
    }

    if (!chosen) {
      return {
        actionLabel: `⛏️ ${dir.name}の届く範囲(高${stats.reachH}×幅${stats.reachW})は掘削済み`,
        thoughtAppend: '（届く範囲はもう空っぽ！一歩動いてから掘ろう）'
      };
    }

    if (!DIG_STATE.dugCells[chosen.cellKey]) DIG_STATE.dugCells[chosen.cellKey] = [];
    DIG_STATE.dugCells[chosen.cellKey].push(chosen.tag);
    DIG_STATE.pocketSoil += 1;

    // 1列分（5分割）掘れたら既存地形にも削りを連動反映
    if (DIG_STATE.dugCells[chosen.cellKey].length % 5 === 0 && typeof digFromCharacterFront === 'function') {
      try {
        digFromCharacterFront(ROBOT.pos.x, ROBOT.pos.z, curLv, dir, ROBOT.posture === 'crawl', getEffectiveParams().power);
      } catch (e) {}
    }

    life.stamina = Math.max(0, life.stamina - 4);
    life.mental = Math.min(100, life.mental + 4);
    ROBOT.params.power = Math.min(100, (ROBOT.params.power || 50) + 2);
    saveDigState();

    return {
      actionLabel: `⛏️ 分割土1個掘削(${dir.name} 高${chosen.tsy + 1}) ポケット${getPocketTotalCount()}/${stats.pocketCap}`
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

      // 大ブロック境界をまたぐ時のみ段差・壁・姿勢判定を行う
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

    // 5個積まれたら足場の小段差も+1して物理地形へ反映
    if (DIG_STATE.placedSoils[key] % 5 === 0 && typeof addSubStepFootholdAt === 'function') {
      try { addSubStepFootholdAt(tx, tz, 1); } catch (e) {}
    }

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

    // 見出しラベルを新ルール向けに更新
    if (grid.previousElementSibling) {
      const stats = getSizeStats();
      grid.previousElementSibling.innerText =
        `🎒 上段5枠：ポケット(${getPocketTotalCount()}/${stats.pocketCap}個) ／ 下段5枠：📦木箱の数(${DIG_STATE.crates.length}/5箱)`;
    }

    const stats = getSizeStats();
    grid.innerHTML = '';

    // 1行目（5枠）：キャラのポケット
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
        slot.title = `ポケットの分割土：${DIG_STATE.pocketSoil}個（上限${stats.pocketCap}個）`;
        slot.onclick = () => {
          if (typeof showToast === 'function') {
            showToast(`🟫 ポケットの分割土：${DIG_STATE.pocketSoil}個（持ち運び上限 ${stats.pocketCap}個）`);
          }
        };
      } else {
        const bagIdx = i - 1;
        const item = (bagIdx >= 0 && typeof BAG !== 'undefined' && BAG[bagIdx]) ? BAG[bagIdx] : null;
        if (item) {
          slot.classList.add('filled');
          slot.innerHTML = `<span style="font-size:18px;line-height:1;">${ITEM_ICONS[item] || '📦'}</span>`;
          slot.title = `ポケットアイテム：${item}`;
        } else {
          slot.innerHTML = `<span style="font-size:9px;color:#94a3b8;font-weight:800;">空</span>`;
        }
      }
      grid.appendChild(slot);
    }

    // 2行目（5枠）：木箱の数と収納数（初期は1枠目のみ木箱アイコン）
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
        slot.title = `木箱#${i + 1}（3×3×3） 場所:(${crate.x},${crate.z}) 収納:${crate.soil}/${crate.capacity}`;
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
  // 6. 既存フックへの安全な接続（brain.js / world.js / ai_comm.js 無改造）
  // --------------------------------------------------------------------------
  if (typeof rebuildTerrainAndItems === 'function') {
    const _origRebuild = rebuildTerrainAndItems;
    rebuildTerrainAndItems = function() {
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
  // 7. AICommCore へのセンサー＆アクション登録（Groq自動実践）
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

      return [
        `サブ位置:(sx=${curSx},sz=${curSz}) 1ターン最大歩幅:分割${stats.moveStep}ブロック`,
        `掘削到達範囲:高さ${stats.reachH}×幅${stats.reachW}×奥行き1(1ターン分割1個)`,
        `ポケット:土${DIG_STATE.pocketSoil}個(合計${getPocketTotalCount()}/${stats.pocketCap}個)`,
        `設置木箱(3x3x3):${crateList}`
      ].join('\n');
    });

    // 既存 move / dig_front を新ルールで上書き統一（AIの重複迷い防止）
    window.AICommCore.registerAction({
      id: 'move',
      desc: '太さに応じた歩幅(やせっちょ5〜でぶっちょ1の分割ブロック)で指定方角へ移動する',
      run: ({ dir }) => runSubMove(dir)
    });

    window.AICommCore.registerAction({
      id: 'dig_front',
      desc: '移動せず体格の届く範囲(高さ1〜5×幅1〜5×奥行き1)から分割ブロック1個を掘ってポケットに入れる',
      run: ({ dir, dec }) => runSubDig(dir, dec && dec.thought)
    });

    window.AICommCore.registerAction({
      id: 'store_crate',
      desc: '近く(隣接または同じマス)にある3×3×3木箱(容量27)へポケットの土をまとめて収納する',
      run: () => runStoreCrate()
    });

    window.AICommCore.registerAction({
      id: 'place_soil',
      desc: 'ポケットの土を目の前または足元の地面に1分割ブロック置いて積む(満杯時の対策)',
      run: ({ dir }) => runPlaceSoil(dir)
    });
  }

  // 初期化＆初回描画
  loadDigState();
  renderDigVisuals();
  renderPocketAndCrateDiaryUI();

  window.DigRulesModule = Object.freeze({
    getState: () => DIG_STATE,
    getSizeStats,
    renderPocketAndCrateDiaryUI,
    renderDigVisuals
  });
})();
