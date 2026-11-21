
// ============================================================================
// 【分割物理モジュール 5/7：dig_items.js】
// ・圧縮木箱（5x5=25枠：素材1枠10・道具1枠5）の出し入れ計算
// ・周囲の土＆落下スコップ回収(pickup)・木箱収納(store_crate)・一括取出(take_crate)
// ・手枠への自由着脱(equip_hand)・周囲への破棄(drop_item)
// ============================================================================
(function initDigItems() {
  const DIG = window.DIG;
  if (!DIG || !DIG.core || !DIG.move) return;
  const C = DIG.core;
  const M = DIG.move;
  const CONST = DIG.CONST;

  // --- 圧縮木箱25枠ヘルパー ---
  function ensureCrateSlots(crate) {
    if (!Array.isArray(crate.slots) || crate.slots.length !== CONST.CRATE_SLOTS) {
      const next = Array.from({ length: CONST.CRATE_SLOTS }, () => null);
      if (Array.isArray(crate.slots)) {
        for (let i = 0; i < Math.min(CONST.CRATE_SLOTS, crate.slots.length); i++) next[i] = crate.slots[i];
      }
      crate.slots = next;
    }
    return crate.slots;
  }

  function countItemInCrate(crate, itemId) {
    const slots = ensureCrateSlots(crate);
    let total = 0;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] && slots[i].id === itemId) total += (slots[i].count || 0);
    }
    return total;
  }

  function countUsedSlotsInCrate(crate) {
    const slots = ensureCrateSlots(crate);
    let used = 0;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] && slots[i].count > 0) used++;
    }
    return used;
  }

  function addItemToCrate(crate, itemId, amount) {
    const meta = CONST.ITEM_META[itemId];
    if (!meta || amount <= 0) return 0;
    const slots = ensureCrateSlots(crate);
    const maxPerSlot = meta.stackMax || CONST.STACK_MATERIAL;
    let rem = Math.floor(amount), added = 0;

    for (let i = 0; i < slots.length && rem > 0; i++) {
      const s = slots[i];
      if (s && s.id === itemId && s.count < maxPerSlot) {
        const take = Math.min(rem, maxPerSlot - s.count);
        s.count += take; rem -= take; added += take;
      }
    }
    for (let i = 0; i < slots.length && rem > 0; i++) {
      if (!slots[i]) {
        const take = Math.min(rem, maxPerSlot);
        slots[i] = { id: itemId, count: take };
        rem -= take; added += take;
      }
    }
    return added;
  }

  function removeItemFromCrate(crate, itemId, amount) {
    if (amount <= 0) return 0;
    const slots = ensureCrateSlots(crate);
    let rem = Math.floor(amount), removed = 0;
    for (let i = slots.length - 1; i >= 0 && rem > 0; i--) {
      const s = slots[i];
      if (s && s.id === itemId && s.count > 0) {
        const take = Math.min(rem, s.count);
        s.count -= take; rem -= take; removed += take;
        if (s.count <= 0) slots[i] = null;
      }
    }
    return removed;
  }

  function summarizeCrateContents(crate) {
    const used = countUsedSlotsInCrate(crate);
    const soil = countItemInCrate(crate, 'soil');
    const shovel = countItemInCrate(crate, 'shovel');
    const wood = countItemInCrate(crate, 'wood');
    const stone = countItemInCrate(crate, 'stone');
    const parts = [];
    if (shovel > 0) parts.push(`スコップ${shovel}本`);
    if (soil > 0) parts.push(`土${soil}個`);
    if (wood > 0) parts.push(`木材${wood}個`);
    if (stone > 0) parts.push(`石材${stone}個`);
    return `${parts.length ? parts.join('・') : '空'}（使用${used}/${CONST.CRATE_SLOTS}枠）`;
  }

  function findNearbyCrate() {
    const areaId = C.getCurAreaId();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const stats = C.getSizeStats();
    const { minOff, maxOff } = C.getFootprintBounds(stats.reachW);
    const rMinX = absX + minOff, rMaxX = absX + maxOff;
    const rMinZ = absZ + minOff, rMaxZ = absZ + maxOff;

    return DIG.state.crates.find(c => {
      if (c.areaId !== areaId) return false;
      const cMinX = c.x * 5, cMaxX = c.x * 5 + 4;
      const cMinZ = c.z * 5, cMaxZ = c.z * 5 + 4;
      const gapX = Math.max(0, cMinX - rMaxX, rMinX - cMaxX);
      const gapZ = Math.max(0, cMinZ - rMaxZ, rMinZ - cMaxZ);
      if (Math.max(gapX, gapZ) > 1) return false;
      const cBaseY = M.getCrateBaseSubY(c);
      return (baseSubY + stats.reachH >= cBaseY) && (baseSubY <= cBaseY + 5);
    }) || null;
  }

  // --- 回収(pickup) ---
  function findNearbyLooseSoilStacks(radiusSub = 3) {
    const areaId = C.getCurAreaId();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const stats = C.getSizeStats();
    const hits = [];
    Object.keys(DIG.state.worldSubSoils).forEach(k => {
      const cnt = DIG.state.worldSubSoils[k] || 0;
      if (cnt <= 0) return;
      const p = C.parseSoilKey(k);
      if (!p || p.areaId !== areaId) return;
      const floorY = (p.floorSubY !== null) ? p.floorSubY : C.getTerrainColumnTopSubY(p.absX, p.absZ);
      if (floorY < baseSubY - 1 || floorY > baseSubY + stats.reachH) return;
      const dist = Math.max(Math.abs(p.absX - absX), Math.abs(p.absZ - absZ));
      if (dist <= radiusSub) hits.push({ key: k, absX: p.absX, absZ: p.absZ, floorSubY: floorY, cnt, dist });
    });
    return hits.sort((a, b) => a.dist - b.dist);
  }

  function findNearbyDroppedItems(radiusSub = 3, filterId = '') {
    const areaId = C.getCurAreaId();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const stats = C.getSizeStats();
    const hits = [];
    (DIG.state.worldDroppedItems || []).forEach(it => {
      if (it.areaId !== areaId || it.count <= 0) return;
      if (filterId && it.id !== filterId) return;
      if (it.floorSubY < baseSubY - 1 || it.floorSubY > baseSubY + stats.reachH) return;
      const dist = Math.max(Math.abs(it.absX - absX), Math.abs(it.absZ - absZ));
      if (dist <= radiusSub) hits.push({ ref: it, dist });
    });
    return hits.sort((a, b) => a.dist - b.dist);
  }

  function runPickup(itemFilter = '') {
    const stats = C.getSizeStats();
    const areaId = C.getCurAreaId();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const searchRadius = Math.max(3, Math.floor(stats.reachW / 2) + 2);

    const nearbyTools = (itemFilter !== 'soil') ? findNearbyDroppedItems(searchRadius, itemFilter === 'shovel' ? 'shovel' : '') : [];
    let pickedShovel = 0;
    if (nearbyTools.length && (itemFilter === 'shovel' || !itemFilter)) {
      let room = C.getMaxAddableShovelsToPocket();
      for (let i = 0; i < nearbyTools.length && room > 0; i++) {
        const it = nearbyTools[i].ref;
        if (it.id !== 'shovel') continue;
        const take = Math.min(it.count, room);
        if (take > 0) {
          it.count -= take;
          DIG.state.pocket.shovel = (DIG.state.pocket.shovel || 0) + take;
          pickedShovel += take; room -= take;
        }
      }
      DIG.state.worldDroppedItems = (DIG.state.worldDroppedItems || []).filter(it => it.count > 0);
      if (pickedShovel > 0 && itemFilter === 'shovel') {
        life.stamina = Math.max(0, life.stamina - 2);
        C.saveDigState();
        return {
          actionLabel: `🪏 地面のスコップを${pickedShovel}本ポケットへ拾った`,
          physicalResult: `周囲の地面からスコップを${pickedShovel}本拾ってポケットへ入れた（ポケット内スコップ計${DIG.state.pocket.shovel}本）`,
          moved: false
        };
      }
    }

    const nearbySoil = (itemFilter !== 'shovel') ? findNearbyLooseSoilStacks(searchRadius) : [];
    if (!nearbySoil.length && pickedShovel <= 0) {
      return { actionLabel: '🟫 すぐそばに拾える土や道具がなかった', physicalResult: '手の届く周囲に散らばった土も落ちた道具もなく、何も拾えなかった', moved: false };
    }

    const maxPerTurn = Math.max(3, stats.reachW * 2);
    const clearance = M.getCeilingClearanceSubAt(absX, absZ, baseSubY, stats.reachW);
    let pickedPocket = 0, pickedHead = 0, blockedByCeiling = false, blockedByCrawl = false;

    for (let i = 0; i < nearbySoil.length && (pickedPocket + pickedHead) < maxPerTurn; i++) {
      let avail = nearbySoil[i].cnt;
      const pSpace = Math.max(0, stats.pocketCap - C.getCarriedResourceTotal());
      if (pSpace > 0 && avail > 0) {
        const takeP = Math.min(avail, pSpace, maxPerTurn - (pickedPocket + pickedHead));
        if (takeP > 0) {
          C.addLooseSoilAtFloor(nearbySoil[i].absX, nearbySoil[i].absZ, nearbySoil[i].floorSubY, -takeP, areaId);
          DIG.state.pocket.soil = (DIG.state.pocket.soil || 0) + takeP;
          pickedPocket += takeP; avail -= takeP;
        }
      }
      while (avail > 0 && (pickedPocket + pickedHead) < maxPerTurn) {
        const curHead = DIG.state.headSoil || 0;
        if (curHead >= stats.headCap) break;
        if (ROBOT.posture === 'crawl') { blockedByCrawl = true; break; }
        if (stats.bodyHeight + C.getHeadStackHeight(curHead + 1, stats.reachW) > clearance) { blockedByCeiling = true; break; }
        C.addLooseSoilAtFloor(nearbySoil[i].absX, nearbySoil[i].absZ, nearbySoil[i].floorSubY, -1, areaId);
        DIG.state.headSoil = curHead + 1;
        pickedHead += 1; avail -= 1;
      }
    }

    if (pickedPocket + pickedHead + pickedShovel <= 0) {
      if (blockedByCrawl) return { actionLabel: '🟫 ほふく姿勢中のため頭上へ積めなかった', physicalResult: 'ポケットが資源上限で、ほふく姿勢中のため頭上ピラミッドへ積めなかった', moved: false };
      if (blockedByCeiling) return { actionLabel: `🟫 天井が低く頭上に載せられなかった(空き${clearance}段)`, physicalResult: `ポケットが資源上限で、天井の空き(${clearance}分割)が足りないため頭上へ積めなかった`, moved: false };
      return { actionLabel: `🟫 ポケット(${C.getCarriedResourceTotal()}/${stats.pocketCap})も頭上(${DIG.state.headSoil}/${stats.headCap})も満杯`, physicalResult: 'ポケットも頭上ピラミッドも上限に達しており、これ以上拾えなかった', moved: false };
    }

    ROBOT.pos.subY = M.computeExactFootSubYAt(absX, absZ, baseSubY, stats.reachW);
    ROBOT.pos.lv = C.floorSubYToRobotLv(ROBOT.pos.subY);
    life.stamina = Math.max(0, life.stamina - 2);
    ROBOT.params.logic = Math.min(100, (ROBOT.params.logic || 50) + 2);
    C.saveDigState();

    const parts = [];
    if (pickedShovel > 0) parts.push(`スコップ+${pickedShovel}本`);
    if (pickedPocket > 0) parts.push(`ポケット土+${pickedPocket}`);
    if (pickedHead > 0) parts.push(`頭上土+${pickedHead}`);
    const newLayers = C.getHeadStackHeight(DIG.state.headSoil || 0, stats.reachW);
    return {
      actionLabel: `🧺 回収した(${parts.join('・')})`,
      physicalResult: `周囲から回収した(${parts.join('、')})。現在ポケット資源${C.getCarriedResourceTotal()}/${stats.pocketCap}、頭上${DIG.state.headSoil}/${stats.headCap}(+${newLayers}段)`,
      moved: false
    };
  }

  // --- 圧縮木箱への収納(store_crate) ＆ 一括取り出し(take_crate) ---
  function runStoreCrate(itemSpec = '') {
    const crate = findNearbyCrate();
    if (!crate) {
      return { actionLabel: '📦 手が届くすぐ隣に圧縮木箱がなかった', physicalResult: '手が届くすぐ隣（距離1分割以内・同じ高さ）に圧縮木箱がなく、収納できなかった', moved: false };
    }
    const target = (itemSpec === 'shovel' || itemSpec === 'soil') ? itemSpec : 'all';
    let movedSoil = 0, movedShovel = 0;

    if (target === 'all' || target === 'soil') {
      if ((DIG.state.headSoil || 0) > 0) {
        const a = addItemToCrate(crate, 'soil', DIG.state.headSoil);
        DIG.state.headSoil -= a; movedSoil += a;
      }
      if ((DIG.state.pocket.soil || 0) > 0) {
        const a = addItemToCrate(crate, 'soil', DIG.state.pocket.soil);
        DIG.state.pocket.soil -= a; movedSoil += a;
      }
      if (DIG.state.equip.hand && DIG.state.equip.hand.id === 'soil' && DIG.state.equip.hand.count > 0) {
        const a = addItemToCrate(crate, 'soil', DIG.state.equip.hand.count);
        DIG.state.equip.hand.count -= a;
        if (DIG.state.equip.hand.count <= 0) DIG.state.equip.hand = null;
        movedSoil += a;
      }
    }
    if (target === 'shovel' || (target === 'all' && movedSoil === 0)) {
      if ((DIG.state.pocket.shovel || 0) > 0) {
        const a = addItemToCrate(crate, 'shovel', DIG.state.pocket.shovel);
        DIG.state.pocket.shovel -= a; movedShovel += a;
      }
      if (target === 'shovel' && DIG.state.equip.hand && DIG.state.equip.hand.id === 'shovel' && DIG.state.equip.hand.count > 0) {
        const a = addItemToCrate(crate, 'shovel', DIG.state.equip.hand.count);
        DIG.state.equip.hand.count -= a;
        if (DIG.state.equip.hand.count <= 0) DIG.state.equip.hand = null;
        movedShovel += a;
      }
    }
    if (movedSoil <= 0 && movedShovel <= 0) {
      return { actionLabel: '📦 圧縮木箱へ入れられるアイテムがないか満杯だった', physicalResult: `収納できる対象アイテムがないか25枠が満杯だった（現在:${summarizeCrateContents(crate)}）`, moved: false };
    }

    ROBOT.params.logic = Math.min(100, (ROBOT.params.logic || 50) + 3);
    life.mental = Math.min(100, life.mental + 6);
    C.saveDigState();
    const parts = [];
    if (movedSoil > 0) parts.push(`土${movedSoil}個`);
    if (movedShovel > 0) parts.push(`スコップ${movedShovel}本`);
    return {
      actionLabel: `📦 圧縮木箱へ収納(${parts.join('・')})`,
      physicalResult: `圧縮木箱へ${parts.join('と')}を収納した（木箱状態:${summarizeCrateContents(crate)}）`,
      moved: false
    };
  }

  function runTakeCrate(itemSpec = '') {
    const crate = findNearbyCrate();
    if (!crate) {
      return { actionLabel: '📦 手が届くすぐ隣に圧縮木箱がなかった', physicalResult: '手が届くすぐ隣（距離1分割以内）に圧縮木箱がなく、取り出せなかった', moved: false };
    }
    const stats = C.getSizeStats();
    let itemId = (itemSpec === 'shovel' || itemSpec === 'soil') ? itemSpec : '';
    if (!itemId) {
      if (countItemInCrate(crate, 'shovel') > 0) itemId = 'shovel';
      else if (countItemInCrate(crate, 'soil') > 0) itemId = 'soil';
    }
    if (!itemId || countItemInCrate(crate, itemId) <= 0) {
      return { actionLabel: '📦 圧縮木箱に指定のアイテムが入っていなかった', physicalResult: `圧縮木箱の中に指定アイテムがなかった（現在:${summarizeCrateContents(crate)}）`, moved: false };
    }

    if (itemId === 'shovel') {
      const avail = countItemInCrate(crate, 'shovel');
      const room = C.getMaxAddableShovelsToPocket();
      if (room <= 0) return { actionLabel: '📦 ポケット9枠が満杯でスコップを取り出せなかった', physicalResult: 'ポケット9枠に空きがなくスコップを取り出せなかった', moved: false };
      const take = removeItemFromCrate(crate, 'shovel', Math.min(avail, room));
      DIG.state.pocket.shovel = (DIG.state.pocket.shovel || 0) + take;
      C.saveDigState();
      return {
        actionLabel: `📦 圧縮木箱からスコップ${take}本をポケットへ取り出した`,
        physicalResult: `圧縮木箱からスコップ${take}本をポケットへ取り出した（ポケット内スコップ${DIG.state.pocket.shovel}本・まだ手には装備していない）`,
        moved: false
      };
    }

    const avail = countItemInCrate(crate, 'soil');
    const room = Math.max(0, stats.pocketCap - C.getCarriedResourceTotal());
    if (room <= 0) return { actionLabel: `📦 ポケットの資源上限(${stats.pocketCap})で土を取り出せなかった`, physicalResult: `ポケットが資源上限(${C.getCarriedResourceTotal()}/${stats.pocketCap})に達しており土を取り出せなかった`, moved: false };
    const take = removeItemFromCrate(crate, 'soil', Math.min(avail, room));
    DIG.state.pocket.soil = (DIG.state.pocket.soil || 0) + take;
    C.saveDigState();
    return {
      actionLabel: `📦 圧縮木箱から土${take}個をポケットへ取り出した`,
      physicalResult: `圧縮木箱から土${take}個をポケットの空き上限までまとめて取り出した（ポケット土${DIG.state.pocket.soil}個）`,
      moved: false
    };
  }

  // --- 手枠への着脱(equip_hand) ＆ 破棄(drop_item) ---
  function runEquipHand(itemSpec = '', reqCount = 0) {
    const stats = C.getSizeStats();
    const curHand = DIG.state.equip.hand;

    function unequipHandToPocket() {
      if (!DIG.state.equip.hand || !DIG.state.equip.hand.count) return '';
      const h = DIG.state.equip.hand;
      if (h.id === 'shovel') {
        DIG.state.pocket.shovel = (DIG.state.pocket.shovel || 0) + h.count;
        DIG.state.equip.hand = null;
        return `スコップ${h.count}本をポケットへ戻した`;
      }
      if (h.id === 'soil') {
        DIG.state.pocket.soil = (DIG.state.pocket.soil || 0) + h.count;
        DIG.state.equip.hand = null;
        return `土${h.count}個をポケットへ戻した`;
      }
      DIG.state.equip.hand = null;
      return '';
    }

    if (itemSpec === 'none' || (!itemSpec && curHand)) {
      if (!curHand || !curHand.count) return { actionLabel: '🖐️ 手枠はすでに空だった', physicalResult: '手枠には何も装備していなかった', moved: false };
      const msg = unequipHandToPocket();
      C.saveDigState();
      return { actionLabel: `🖐️ 手枠を外して素手になった(${msg})`, physicalResult: `${msg}。現在手枠は空（素手）になった`, moved: false };
    }

    const targetId = (itemSpec === 'shovel' || itemSpec === 'soil')
      ? itemSpec
      : ((DIG.state.pocket.shovel || 0) > 0 ? 'shovel' : ((DIG.state.pocket.soil || 0) > 0 ? 'soil' : ''));
    if (!targetId) return { actionLabel: '🖐️ ポケットに装備できるアイテムがなかった', physicalResult: 'ポケットにスコップも土もなく、手枠へ装備できなかった', moved: false };

    const prevMsg = unequipHandToPocket();
    if (targetId === 'shovel') {
      const avail = DIG.state.pocket.shovel || 0;
      if (avail <= 0) { C.saveDigState(); return { actionLabel: '🖐️ ポケットにスコップがなかった', physicalResult: 'ポケットにスコップが入っておらず手枠へ持てなかった', moved: false }; }
      const want = (reqCount > 0) ? Math.min(reqCount, stats.handShovelMax) : 1;
      const take = Math.min(avail, want);
      DIG.state.pocket.shovel -= take;
      DIG.state.equip.hand = { id: 'shovel', count: take };
      C.saveDigState();
      const note = take === 1 ? '（掘削は体格範囲内で最大5個）' : '（2本持ちのため掘削不可・2本投擲可）';
      return {
        actionLabel: `🪏 手枠にスコップを${take}本装備した`,
        physicalResult: `${prevMsg ? prevMsg + '後、' : ''}ポケットから手枠へスコップを${take}本装備した${note}（ポケット残り${DIG.state.pocket.shovel}本）`,
        moved: false
      };
    }

    const availSoil = DIG.state.pocket.soil || 0;
    if (availSoil <= 0) { C.saveDigState(); return { actionLabel: '🖐️ ポケットに土がなかった', physicalResult: 'ポケットに土が入っておらず手枠へ持てなかった', moved: false }; }
    const want = (reqCount > 0) ? Math.min(reqCount, stats.handSoilMax) : Math.min(availSoil, stats.handSoilMax);
    const take = Math.min(availSoil, want);
    DIG.state.pocket.soil -= take;
    DIG.state.equip.hand = { id: 'soil', count: take };
    C.saveDigState();
    return {
      actionLabel: `🟫 手枠に土を${take}個持った（上限${stats.handSoilMax}）`,
      physicalResult: `${prevMsg ? prevMsg + '後、' : ''}ポケットから手枠へ土を${take}個移して持った（掘削不可・${take}個一括投擲可、ポケット土残り${DIG.state.pocket.soil}個）`,
      moved: false
    };
  }

  function runDropItem(itemSpec = '', reqCount = 1) {
    const areaId = C.getCurAreaId();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const stats = C.getSizeStats();

    let targetId = (itemSpec === 'shovel' || itemSpec === 'soil') ? itemSpec : '';
    if (!targetId) {
      if ((DIG.state.pocket.shovel || 0) > 0 || (DIG.state.equip.hand && DIG.state.equip.hand.id === 'shovel')) targetId = 'shovel';
      else if ((DIG.state.pocket.soil || 0) > 0 || (DIG.state.equip.hand && DIG.state.equip.hand.id === 'soil')) targetId = 'soil';
    }
    if (!targetId) return { actionLabel: '🗑️ 捨てるアイテムを持っていなかった', physicalResult: 'ポケットにも手枠にも捨てられるアイテムがなかった', moved: false };

    const want = Math.max(1, reqCount || 1);
    if (targetId === 'shovel') {
      let dropped = 0;
      const fromP = Math.min(DIG.state.pocket.shovel || 0, want);
      if (fromP > 0) { DIG.state.pocket.shovel -= fromP; dropped += fromP; }
      if (dropped < want && DIG.state.equip.hand && DIG.state.equip.hand.id === 'shovel') {
        const fromH = Math.min(DIG.state.equip.hand.count, want - dropped);
        DIG.state.equip.hand.count -= fromH;
        if (DIG.state.equip.hand.count <= 0) DIG.state.equip.hand = null;
        dropped += fromH;
      }
      if (dropped <= 0) return { actionLabel: '🗑️ 捨てるスコップを持っていなかった', physicalResult: 'スコップを持っておらず捨てられなかった', moved: false };
      C.addDroppedTool('shovel', absX, absZ, C.findFloorSubYBelow(absX, absZ, baseSubY + 1), dropped, areaId);
      C.saveDigState();
      return { actionLabel: `🗑️ スコップを${dropped}本足元へ捨てた`, physicalResult: `スコップを${dropped}本足元の地面へ捨てた（通り抜け可・後から回収可能）`, moved: false };
    }

    let dropped = 0;
    for (let i = 0; i < want; i++) {
      const hasP = (DIG.state.pocket.soil || 0) > 0;
      const hasH = DIG.state.equip.hand && DIG.state.equip.hand.id === 'soil' && DIG.state.equip.hand.count > 0;
      if (!hasP && !hasH) break;
      const slot = DIG.dig && DIG.dig.findDropSlotForDugSoil ? DIG.dig.findDropSlotForDugSoil({ absX, absZ, totalSubY: baseSubY }, null, stats) : null;
      if (!slot) break;
      if (hasP) DIG.state.pocket.soil -= 1;
      else { DIG.state.equip.hand.count -= 1; if (DIG.state.equip.hand.count <= 0) DIG.state.equip.hand = null; }
      C.addLooseSoilAtFloor(slot.absX, slot.absZ, slot.floorSubY, 1, areaId);
      dropped++;
    }
    if (dropped <= 0) return { actionLabel: '🗑️ 土を捨てられなかった（手持ちなし・周囲満杯）', physicalResult: '捨てられる土がないか周囲の床が満杯で捨てられなかった', moved: false };
    C.saveDigState();
    return { actionLabel: `🗑️ 土を${dropped}個周囲へ捨てた`, physicalResult: `土を${dropped}個周囲の床へ捨てた`, moved: false };
  }

  DIG.items = {
    ensureCrateSlots, countItemInCrate, countUsedSlotsInCrate,
    addItemToCrate, removeItemFromCrate, summarizeCrateContents, findNearbyCrate,
    findNearbyLooseSoilStacks, findNearbyDroppedItems,
    runPickup, runStoreCrate, runTakeCrate, runEquipHand, runDropItem
  };

  if (window.DebugGuard) window.DebugGuard.markLoaded('dig_items.js');
})();
