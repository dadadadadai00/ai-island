// ============================================================================
// 【分割物理モジュール 5/7：dig_items.js】
// ・圧縮木箱(25枠)の出し入れ・ひんとメモ発見時の日記メモ自動記録
// ・ポケット⇔手枠装備の自由持ち替え（1ターン独立）・拾う・捨てる
// ============================================================================
(function initDigItems() {
  const DIG = window.DIG;
  if (!DIG || !DIG.core || !DIG.move) return;
  const C = DIG.core;
  const M = DIG.move;
  const CONST = DIG.CONST;

  function ensureCrateSlots(crate) {
    if (!crate) return C.createEmptyCrateSlots(false);
    if (!Array.isArray(crate.slots)) crate.slots = C.createEmptyCrateSlots(false);
    while (crate.slots.length < CONST.CRATE_SLOTS) crate.slots.push(null);
    if (crate.slots.length > CONST.CRATE_SLOTS) crate.slots.length = CONST.CRATE_SLOTS;
    for (let i = 0; i < crate.slots.length; i++) {
      const s = crate.slots[i];
      if (!s || !s.id || !Number.isFinite(Number(s.count)) || Math.floor(Number(s.count)) <= 0) {
        crate.slots[i] = null;
      } else {
        crate.slots[i] = { id: String(s.id), count: Math.floor(Number(s.count)) };
      }
    }
    return crate.slots;
  }

  function findAdjacentCrate() {
    const areaId = C.getCurAreaId();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const stats = C.getSizeStats();
    const { minOff, maxOff } = C.getFootprintBounds(stats.reachW);
    const rMinX = absX + minOff, rMaxX = absX + maxOff;
    const rMinZ = absZ + minOff, rMaxZ = absZ + maxOff;

    for (let i = 0; i < DIG.state.crates.length; i++) {
      const c = DIG.state.crates[i];
      if (c.areaId !== areaId) continue;
      ensureCrateSlots(c);
      const cMinX = c.x * 5, cMaxX = c.x * 5 + 4;
      const cMinZ = c.z * 5, cMaxZ = c.z * 5 + 4;
      const gapX = Math.max(0, Math.max(cMinX - rMaxX, rMinX - cMaxX));
      const gapZ = Math.max(0, Math.max(cMinZ - rMaxZ, rMinZ - cMaxZ));
      const cBaseY = M.getCrateBaseSubY(c);
      const vDist = Math.abs(baseSubY - cBaseY);
      if (gapX <= 1 && gapZ <= 1 && vDist <= Math.max(5, stats.reachH + 2)) {
        return c;
      }
    }
    return null;
  }

  function getCrateItemCounts(crate) {
    const counts = { memo: 0, shovel: 0, soil: 0, wood: 0, stone: 0 };
    if (!crate) return counts;
    ensureCrateSlots(crate);
    crate.slots.forEach(s => {
      if (s && s.count > 0) counts[s.id] = (counts[s.id] || 0) + s.count;
    });
    return counts;
  }

  function formatCrateSummary(crate) {
    if (!crate) return 'なし';
    const cnt = getCrateItemCounts(crate);
    const parts = [];
    ['memo', 'shovel', 'soil', 'wood', 'stone'].forEach(id => {
      if ((cnt[id] || 0) > 0 && CONST.ITEM_META[id]) parts.push(`${CONST.ITEM_META[id].name}×${cnt[id]}`);
    });
    return parts.length ? parts.join('・') : '空';
  }

  function countUsedSlotsInCrate(crate) {
    if (!crate) return 0;
    return ensureCrateSlots(crate).filter(s => s && s.count > 0).length;
  }

  function addItemToCrate(crate, itemId, amount) {
    if (!crate || amount <= 0) return 0;
    ensureCrateSlots(crate);
    const meta = CONST.ITEM_META[itemId] || { stackMax: 10 };
    const maxStack = meta.stackMax || 10;
    let rem = Math.floor(amount);

    for (let i = 0; i < crate.slots.length && rem > 0; i++) {
      const s = crate.slots[i];
      if (s && s.id === itemId && s.count < maxStack) {
        const add = Math.min(rem, maxStack - s.count);
        s.count += add;
        rem -= add;
      }
    }
    for (let i = 0; i < crate.slots.length && rem > 0; i++) {
      if (!crate.slots[i]) {
        const add = Math.min(rem, maxStack);
        crate.slots[i] = { id: itemId, count: add };
        rem -= add;
      }
    }
    return Math.floor(amount) - rem;
  }

  function removeItemFromCrate(crate, itemId, amount) {
    if (!crate || amount <= 0) return 0;
    ensureCrateSlots(crate);
    let rem = Math.floor(amount);
    for (let i = crate.slots.length - 1; i >= 0 && rem > 0; i--) {
      const s = crate.slots[i];
      if (s && s.id === itemId && s.count > 0) {
        const take = Math.min(rem, s.count);
        s.count -= take;
        rem -= take;
        if (s.count <= 0) crate.slots[i] = null;
      }
    }
    return Math.floor(amount) - rem;
  }

  // 箱の中身を見た瞬間に「ひんとメモ」や「スコップ」の発見を日記メモへ記録
  function recordCrateDiscoveryToDiary(crate) {
    if (!crate) return '';
    const cnt = getCrateItemCounts(crate);
    const notes = [];
    if ((cnt.memo || 0) > 0) {
      C.addDiaryMemo(`箱の中でひんとメモを読んだ：「${CONST.HINT_MEMO_TEXT}」`);
      notes.push(`ひんとメモ「${CONST.HINT_MEMO_TEXT}」を読んだ`);
    }
    if ((cnt.shovel || 0) > 0) {
      C.addDiaryMemo(`箱の中にパステルスコップ(${cnt.shovel}本)が入っているのを見つけた`);
      notes.push(`パステルスコップ×${cnt.shovel}本を見つけた`);
    }
    return notes.join('・');
  }

  function pickTargetItemFromCrate(crate, itemPref) {
    const cnt = getCrateItemCounts(crate);
    const req = String(itemPref || '').toLowerCase();
    if (req && req !== 'all' && req !== 'none' && (cnt[req] || 0) > 0) return req;
    // 並び順優先：メモ→スコップ→素材
    if ((cnt.memo || 0) > 0) return 'memo';
    if ((cnt.shovel || 0) > 0) return 'shovel';
    const ids = ['soil', 'wood', 'stone'];
    for (let i = 0; i < ids.length; i++) if ((cnt[ids[i]] || 0) > 0) return ids[i];
    return '';
  }

  // --- 箱から取り出す／中を調べる（1ターン・アイテム/個数自由選択） ---
  function runTakeCrate(itemPref = '', reqCount = 0) {
    const crate = findAdjacentCrate();
    if (!crate) {
      return {
        actionLabel: '📦 すぐ隣に調べられる箱がなかった',
        physicalResult: '手の届く距離1分割以内に箱がないため調べられなかった',
        moved: false
      };
    }

    const discNote = recordCrateDiscoveryToDiary(crate);
    const stats = C.getSizeStats();
    const targetId = pickTargetItemFromCrate(crate, itemPref);
    if (!targetId) {
      return {
        actionLabel: '📦 箱の中を確認したが取り出せるものがなかった',
        physicalResult: `箱の中身は「${formatCrateSummary(crate)}」で、指定アイテムがなかった`,
        moved: false
      };
    }

    const meta = CONST.ITEM_META[targetId] || { name: targetId, kind: 'material' };
    const availInCrate = getCrateItemCounts(crate)[targetId] || 0;
    const capLimit = (meta.kind === 'memo')
      ? 1
      : ((meta.kind === 'tool')
          ? C.getMaxAddableShovelsToPocket()
          : Math.max(0, stats.pocketCap - C.getCarriedResourceTotal()));

    if (capLimit <= 0) {
      return {
        actionLabel: `📦 ポケットがいっぱいで${meta.name}を取り出せなかった`,
        physicalResult: `ポケットの空き上限に達しており、箱から${meta.name}を取り出せなかった${discNote ? `（発見：${discNote}）` : ''}`,
        moved: false
      };
    }

    const want = (Number.isFinite(Number(reqCount)) && Number(reqCount) > 0)
      ? Math.min(availInCrate, capLimit, Math.floor(Number(reqCount)))
      : Math.min(availInCrate, capLimit);

    const taken = removeItemFromCrate(crate, targetId, want);
    if (taken <= 0) {
      return { actionLabel: '📦 取り出せなかった', physicalResult: '箱から取り出せなかった', moved: false };
    }

    DIG.state.pocket[targetId] = (DIG.state.pocket[targetId] || 0) + taken;
    C.saveDigState();
    if (DIG.ui && DIG.ui.renderDiaryFullUI) DIG.ui.renderDiaryFullUI();

    const unit = meta.kind === 'memo' ? '枚' : (meta.kind === 'tool' ? '本' : '個');
    const extraMemo = targetId === 'memo'
      ? `。中身：「${CONST.HINT_MEMO_TEXT}」`
      : (discNote ? `（あわせて${discNote}）` : '');
    return {
      actionLabel: `📦 箱から${meta.name}を${taken}${unit}ポケットへ取り出した`,
      physicalResult: `目の前の箱から${meta.name}を${taken}${unit}ポケットへ取り出した${extraMemo}`,
      moved: false
    };
  }

  // --- 箱へ収納する（1ターン・アイテム/個数自由選択） ---
  function runStoreCrate(itemPref = '', reqCount = 0) {
    const crate = findAdjacentCrate();
    if (!crate) {
      return {
        actionLabel: '📦 すぐ隣に箱がなく収納できなかった',
        physicalResult: '手の届く距離1分割以内に箱がないため収納できなかった',
        moved: false
      };
    }

    const discNote = recordCrateDiscoveryToDiary(crate);
    const req = String(itemPref || '').toLowerCase();
    const explicitCount = (Number.isFinite(Number(reqCount)) && Number(reqCount) > 0) ? Math.floor(Number(reqCount)) : 0;
    const targetIds = (req && req !== 'all' && req !== 'none' && CONST.ITEM_META[req])
      ? [req]
      : ['soil', 'wood', 'stone', 'shovel', 'memo'];

    const storedNotes = [];
    let totalStored = 0;

    for (let i = 0; i < targetIds.length; i++) {
      const id = targetIds[i];
      const meta = CONST.ITEM_META[id];
      const headHave = (id === 'soil') ? Math.max(0, DIG.state.headSoil || 0) : 0;
      const pocketHave = Math.max(0, DIG.state.pocket[id] || 0);
      const handHave = (DIG.state.equip.hand && DIG.state.equip.hand.id === id) ? Math.max(0, DIG.state.equip.hand.count || 0) : 0;
      const totalHave = headHave + pocketHave + handHave;
      if (totalHave <= 0) continue;

      const want = explicitCount > 0 ? Math.min(totalHave, explicitCount) : totalHave;
      const stored = addItemToCrate(crate, id, want);
      if (stored <= 0) continue;

      let rem = stored;
      if (id === 'soil' && rem > 0 && DIG.state.headSoil > 0) {
        const d = Math.min(rem, DIG.state.headSoil); DIG.state.headSoil -= d; rem -= d;
      }
      if (rem > 0 && (DIG.state.pocket[id] || 0) > 0) {
        const d = Math.min(rem, DIG.state.pocket[id]); DIG.state.pocket[id] -= d; rem -= d;
      }
      if (rem > 0 && DIG.state.equip.hand && DIG.state.equip.hand.id === id) {
        const d = Math.min(rem, DIG.state.equip.hand.count);
        DIG.state.equip.hand.count -= d;
        if (DIG.state.equip.hand.count <= 0) DIG.state.equip.hand = null;
        rem -= d;
      }
      const unit = meta.kind === 'memo' ? '枚' : (meta.kind === 'tool' ? '本' : '個');
      storedNotes.push(`${meta.name}×${stored}${unit}`);
      totalStored += stored;
      if (explicitCount > 0 && targetIds.length === 1) break;
    }

    if (totalStored <= 0) {
      return {
        actionLabel: '📦 収納できるアイテムがないか箱が満杯だった',
        physicalResult: `収納対象がないか箱が満杯だった${discNote ? `（なお箱を開けて${discNote}）` : ''}`,
        moved: false
      };
    }

    C.saveDigState();
    if (DIG.ui && DIG.ui.renderDiaryFullUI) DIG.ui.renderDiaryFullUI();
    return {
      actionLabel: `📦 箱へ${storedNotes.join('・')}を収納した`,
      physicalResult: `目の前の箱へ${storedNotes.join('・')}を収納した${discNote ? `（${discNote}）` : ''}`,
      moved: false
    };
  }

  function runCrate(sub = 'take', itemPref = '', reqCount = 0) {
    const mode = String(sub || 'take').toLowerCase();
    if (mode === 'store' || mode === 'put' || mode === 'in') return runStoreCrate(itemPref, reqCount);
    return runTakeCrate(itemPref, reqCount);
  }

  // --- ポケット⇔手枠の付け外し（1ターン独立・個数自由選択） ---
  function runEquipHand(itemPref = 'none', reqCount = 0) {
    const stats = C.getSizeStats();
    const req = String(itemPref || 'none').toLowerCase();
    const curHand = DIG.state.equip.hand;

    if (!req || req === 'none' || req === 'empty' || req === 'unequip') {
      if (!curHand || curHand.count <= 0) {
        return { actionLabel: '✋ すでに手枠は空だった', physicalResult: '手枠はすでに空だった', moved: false };
      }
      const meta = CONST.ITEM_META[curHand.id] || { name: curHand.id, kind: 'material' };
      const unit = meta.kind === 'memo' ? '枚' : (meta.kind === 'tool' ? '本' : '個');
      if (meta.kind === 'tool' && C.getMaxAddableShovelsToPocket() < curHand.count) {
        return { actionLabel: '🚫 ポケット枠不足で手枠をしまえなかった', physicalResult: 'ポケットの道具枠が不足しておりしまえなかった', moved: false };
      }
      DIG.state.pocket[curHand.id] = (DIG.state.pocket[curHand.id] || 0) + curHand.count;
      const movedCnt = curHand.count;
      DIG.state.equip.hand = null;
      C.saveDigState();
      if (DIG.ui && DIG.ui.renderDiaryFullUI) DIG.ui.renderDiaryFullUI();
      return {
        actionLabel: `✋ 手枠の${meta.name}×${movedCnt}${unit}をポケットへしまった`,
        physicalResult: `手枠の${meta.name}(${movedCnt}${unit})をポケットへ戻した`,
        moved: false
      };
    }

    if (!CONST.ITEM_META[req]) {
      return { actionLabel: `🚫 不明な装備対象(${req})`, physicalResult: `装備対象(${req})が不明なため持ち替えできなかった`, moved: false };
    }

    const meta = CONST.ITEM_META[req];
    const unit = meta.kind === 'memo' ? '枚' : (meta.kind === 'tool' ? '本' : '個');
    const handLimit = (meta.kind === 'memo') ? 1 : ((meta.kind === 'tool') ? stats.handShovelMax : stats.handSoilMax);
    const want = Math.max(1, Math.min(handLimit, (Number.isFinite(Number(reqCount)) && Number(reqCount) > 0) ? Math.floor(Number(reqCount)) : 1));

    if (curHand && curHand.id !== req && curHand.count > 0) {
      const oldMeta = CONST.ITEM_META[curHand.id] || { kind: 'material' };
      if (oldMeta.kind === 'tool' && C.getMaxAddableShovelsToPocket() < curHand.count) {
        return { actionLabel: '🚫 ポケット枠不足で持ち替えできなかった', physicalResult: '今の装備をしまう空きがポケットになく持ち替えできなかった', moved: false };
      }
      DIG.state.pocket[curHand.id] = (DIG.state.pocket[curHand.id] || 0) + curHand.count;
      DIG.state.equip.hand = null;
    }

    const alreadyInHand = (DIG.state.equip.hand && DIG.state.equip.hand.id === req) ? DIG.state.equip.hand.count : 0;
    const pocketHave = Math.max(0, DIG.state.pocket[req] || 0);
    const totalAvail = alreadyInHand + pocketHave;

    if (totalAvail <= 0) {
      return {
        actionLabel: `✋ ポケットに${meta.name}がなく装備できなかった`,
        physicalResult: `ポケットに${meta.name}が入っていないため手枠へ装備できなかった`,
        moved: false
      };
    }

    const finalCnt = Math.min(want, totalAvail);
    const diff = finalCnt - alreadyInHand;
    if (diff > 0) {
      DIG.state.pocket[req] -= diff;
      DIG.state.equip.hand = { id: req, count: finalCnt };
    } else if (diff < 0) {
      DIG.state.pocket[req] += (-diff);
      DIG.state.equip.hand = finalCnt > 0 ? { id: req, count: finalCnt } : null;
    } else {
      return {
        actionLabel: `✋ すでに手枠に${meta.name}×${finalCnt}${unit}を装備中`,
        physicalResult: `すでに手枠へ${meta.name}を${finalCnt}${unit}装備していた`,
        moved: false
      };
    }

    if (req === 'memo') {
      C.addDiaryMemo(`ひんとメモを手に取って読んだ：「${CONST.HINT_MEMO_TEXT}」`);
    }

    C.saveDigState();
    if (DIG.ui && DIG.ui.renderDiaryFullUI) DIG.ui.renderDiaryFullUI();
    return {
      actionLabel: `✋ 手枠に${meta.name}を${finalCnt}${unit}装備した`,
      physicalResult: `ポケットから手枠へ${meta.name}を${finalCnt}${unit}持ち替えた${req === 'memo' ? `（文面：${CONST.HINT_MEMO_TEXT}）` : ''}`,
      moved: false
    };
  }

  // --- 周囲の散らばり土・落下道具を拾う（個数自由選択） ---
  function runPickup(itemPref = '', reqCount = 0) {
    const areaId = C.getCurAreaId();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const stats = C.getSizeStats();
    const { minOff, maxOff } = C.getFootprintBounds(stats.reachW);
    const req = String(itemPref || '').toLowerCase();
    const explicitCount = (Number.isFinite(Number(reqCount)) && Number(reqCount) > 0) ? Math.floor(Number(reqCount)) : 0;

    const wantShovel = (!req || req === 'all' || req === 'none' || req === 'shovel');
    const wantSoil   = (!req || req === 'all' || req === 'none' || req === 'soil');

    let pickedShovel = 0, pickedSoilPocket = 0, pickedSoilHead = 0;

    if (wantShovel && Array.isArray(DIG.state.worldDroppedItems)) {
      let quota = explicitCount > 0 ? Math.min(explicitCount, C.getMaxAddableShovelsToPocket()) : C.getMaxAddableShovelsToPocket();
      for (let i = DIG.state.worldDroppedItems.length - 1; i >= 0 && quota > 0; i--) {
        const it = DIG.state.worldDroppedItems[i];
        if (it.areaId !== areaId || it.id !== 'shovel' || it.count <= 0) continue;
        const inX = it.absX >= absX + minOff - 1 && it.absX <= absX + maxOff + 1;
        const inZ = it.absZ >= absZ + minOff - 1 && it.absZ <= absZ + maxOff + 1;
        const inY = it.floorSubY >= baseSubY - 1 && it.floorSubY <= baseSubY + stats.reachH;
        if (!inX || !inZ || !inY) continue;
        const take = Math.min(it.count, quota);
        it.count -= take;
        DIG.state.pocket.shovel = (DIG.state.pocket.shovel || 0) + take;
        pickedShovel += take;
        quota -= take;
        if (it.count <= 0) DIG.state.worldDroppedItems.splice(i, 1);
      }
    }

    if (wantSoil) {
      const remExplicit = explicitCount > 0 ? Math.max(0, explicitCount - pickedShovel) : 999;
      let pocketFree = Math.max(0, stats.pocketCap - C.getCarriedResourceTotal());
      const clear = M.getCeilingClearanceSubAt(absX, absZ, baseSubY, stats.reachW);
      let headFree = Math.max(0, stats.headCap - (DIG.state.headSoil || 0));
      let soilQuota = Math.min(remExplicit, pocketFree + headFree);

      const cells = [];
      for (let ox = minOff - 1; ox <= maxOff + 1; ox++) {
        for (let oz = minOff - 1; oz <= maxOff + 1; oz++) {
          cells.push({ ax: absX + ox, az: absZ + oz, dist: Math.abs(ox) + Math.abs(oz) });
        }
      }
      cells.sort((a, b) => a.dist - b.dist);

      for (let i = 0; i < cells.length && soilQuota > 0; i++) {
        const stacks = C.getLooseSoilStacksInColumn(cells[i].ax, cells[i].az, areaId);
        for (let j = stacks.length - 1; j >= 0 && soilQuota > 0; j--) {
          const st = stacks[j];
          if (st.count <= 0) continue;
          if (st.floorSubY > baseSubY + stats.reachH || st.floorSubY + st.count < baseSubY) continue;
          while (st.count > 0 && soilQuota > 0) {
            if (pocketFree > 0) {
              C.addLooseSoilAtFloor(cells[i].ax, cells[i].az, st.floorSubY, -1, areaId);
              DIG.state.pocket.soil = (DIG.state.pocket.soil || 0) + 1;
              st.count--; pocketFree--; soilQuota--; pickedSoilPocket++;
            } else if (headFree > 0) {
              const nextLayers = C.getHeadStackHeight((DIG.state.headSoil || 0) + 1, stats.reachW);
              if (clear < stats.bodyHeight + nextLayers) break;
              C.addLooseSoilAtFloor(cells[i].ax, cells[i].az, st.floorSubY, -1, areaId);
              DIG.state.headSoil = (DIG.state.headSoil || 0) + 1;
              st.count--; headFree--; soilQuota--; pickedSoilHead++;
            } else break;
          }
        }
      }
    }

    if (pickedShovel + pickedSoilPocket + pickedSoilHead <= 0) {
      return {
        actionLabel: '🤲 すぐそばに拾えるものがないか所持上限だった',
        physicalResult: '周囲距離1分割以内に拾えるものがないか、ポケット・頭上の空き上限に達していた',
        moved: false
      };
    }

    C.saveDigState();
    if (DIG.ui && DIG.ui.renderDiaryFullUI) DIG.ui.renderDiaryFullUI();
    const notes = [];
    if (pickedShovel > 0) notes.push(`パステルスコップ×${pickedShovel}本(ポケット)`);
    if (pickedSoilPocket > 0) notes.push(`土×${pickedSoilPocket}個(ポケット)`);
    if (pickedSoilHead > 0) notes.push(`土×${pickedSoilHead}個(頭上)`);
    return {
      actionLabel: `🤲 ${notes.join('・')}を拾った`,
      physicalResult: `周囲の地面から${notes.join('・')}を拾った`,
      moved: false
    };
  }

  // --- 周囲の地面へ捨てる ---
  function runDropItem(itemPref = '', reqCount = 1) {
    const req = String(itemPref || '').toLowerCase();
    const id = (req && CONST.ITEM_META[req]) ? req : ((DIG.state.pocket.soil || 0) > 0 ? 'soil' : 'shovel');
    const meta = CONST.ITEM_META[id];
    const unit = meta.kind === 'memo' ? '枚' : (meta.kind === 'tool' ? '本' : '個');
    const want = Math.max(1, (Number.isFinite(Number(reqCount)) && Number(reqCount) > 0) ? Math.floor(Number(reqCount)) : 1);

    const areaId = C.getCurAreaId();
    const { absX, absZ } = C.getRobotAbsPos();
    const baseSubY = M.getRobotBaseSubY();
    const stats = C.getSizeStats();

    const pHave = Math.max(0, DIG.state.pocket[id] || 0);
    const hHave = (DIG.state.equip.hand && DIG.state.equip.hand.id === id) ? Math.max(0, DIG.state.equip.hand.count || 0) : 0;
    const totalHave = pHave + hHave;
    if (totalHave <= 0) {
      return { actionLabel: `🗑️ 捨てる${meta.name}を持っていなかった`, physicalResult: `${meta.name}を所持していないため捨てられなかった`, moved: false };
    }

    const dropCnt = Math.min(want, totalHave);
    let rem = dropCnt;
    if (rem > 0 && (DIG.state.pocket[id] || 0) > 0) {
      const d = Math.min(rem, DIG.state.pocket[id]); DIG.state.pocket[id] -= d; rem -= d;
    }
    if (rem > 0 && DIG.state.equip.hand && DIG.state.equip.hand.id === id) {
      const d = Math.min(rem, DIG.state.equip.hand.count);
      DIG.state.equip.hand.count -= d;
      if (DIG.state.equip.hand.count <= 0) DIG.state.equip.hand = null;
      rem -= d;
    }

    if (meta.kind === 'tool' || meta.kind === 'memo') {
      C.addDroppedTool(id, absX, absZ, baseSubY, dropCnt, areaId);
    } else {
      let placed = 0;
      const offs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
      for (let n = 0; n < dropCnt; n++) {
        for (let k = 0; k < offs.length; k++) {
          const tx = absX + offs[k][0], tz = absZ + offs[k][1];
          if (!C.isInsideIslandAbs(tx, tz) || M.isCrateBlockingAtSubY(tx, baseSubY, tz, areaId)) continue;
          const fy = C.findFloorSubYBelow(tx, tz, baseSubY + 1);
          const cur = C.getLooseSoilAtFloor(tx, tz, fy, areaId);
          if (cur < stats.maxStackHeight && !C.hasSolidTerrainAtAbsSubY(tx, fy + cur, tz)) {
            C.addLooseSoilAtFloor(tx, tz, fy, 1, areaId);
            placed++;
            break;
          }
        }
      }
      if (placed < dropCnt) DIG.state.pocket[id] = (DIG.state.pocket[id] || 0) + (dropCnt - placed);
    }

    C.saveDigState();
    if (DIG.ui && DIG.ui.renderDiaryFullUI) DIG.ui.renderDiaryFullUI();
    return {
      actionLabel: `🗑️ ${meta.name}を${dropCnt}${unit}その場へ捨てた`,
      physicalResult: `${meta.name}を${dropCnt}${unit}周囲の地面へ捨てた`,
      moved: false
    };
  }

  DIG.items = {
    ensureCrateSlots, findAdjacentCrate, findNearbyCrate: findAdjacentCrate,
    getCrateItemCounts, formatCrateSummary, summarizeCrateContents: formatCrateSummary,
    countUsedSlotsInCrate, addItemToCrate, removeItemFromCrate,
    runTakeCrate, runStoreCrate, runCrate, runEquipHand, runPickup, runDropItem
  };

  if (window.DebugGuard) window.DebugGuard.markLoaded('dig_items.js');
})();
