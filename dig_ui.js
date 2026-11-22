// ============================================================================
// 【分割物理モジュール 7/7：dig_ui.js】
// ・手帳最上部（正面プレビュー＋左右6装備枠）・下部10枠・圧縮木箱25枠モーダル
// ・既存フック接続・統一10アクション＆距離1触覚サマリー登録・初期起動
// ============================================================================
(function initDigUIAndWire() {
  const DIG = window.DIG;
  if (!DIG || !DIG.core || !DIG.move || !DIG.vision || !DIG.dig || !DIG.items) return;
  const T = DIG.throw || DIG.throwAct;
  if (!T) return;
  DIG.throw = T;
  DIG.throwAct = T;

  const C = DIG.core, M = DIG.move, V = DIG.vision, D = DIG.dig, I = DIG.items;
  const CONST = DIG.CONST;

  // --- 旧名・新名の互換エイリアス補完（他モジュール保護） ---
  if (typeof I.ensureCrateSlots === 'function') {
    const _rawEnsure = I.ensureCrateSlots;
    I.ensureCrateSlots = function(crate) {
      _rawEnsure(crate);
      return (crate && Array.isArray(crate.slots)) ? crate.slots : C.createEmptyCrateSlots(false);
    };
  }
  if (typeof I.summarizeCrateContents !== 'function') {
    I.summarizeCrateContents = (crate) => (typeof I.formatCrateSummary === 'function' ? I.formatCrateSummary(crate) : '空');
  }
  if (typeof I.countUsedSlotsInCrate !== 'function') {
    I.countUsedSlotsInCrate = (crate) => {
      if (!crate) return 0;
      const slots = I.ensureCrateSlots(crate);
      return slots.filter(s => s && s.count > 0).length;
    };
  }
  if (typeof I.findNearbyCrate !== 'function' && typeof I.findAdjacentCrate === 'function') {
    I.findNearbyCrate = I.findAdjacentCrate;
  }

  // --- 正面キャラプレビュー描画 ---
  function drawFrontCharacterPreview(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#e0f2fe'); grad.addColorStop(1, '#f8fafc');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#bbf7d0'; ctx.fillRect(0, h - 22, w, 22);
    ctx.fillStyle = '#d4a373'; ctx.fillRect(0, h - 10, w, 10);

    const stats = C.getSizeStats();
    const bodyW = 26 + stats.reachW * 9, bodyH = 22 + stats.reachH * 10;
    const cx = w / 2, baseY = h - 20, bodyY = baseY - bodyH;

    ctx.fillStyle = 'rgba(15,23,42,0.14)';
    ctx.beginPath(); ctx.ellipse(cx, baseY + 2, bodyW * 0.56, 5, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx - bodyW / 2, bodyY, bodyW, bodyH, 7);
    else ctx.rect(cx - bodyW / 2, bodyY, bodyW, bodyH);
    ctx.fill(); ctx.stroke();

    const faceW = bodyW * 0.68, faceH = Math.min(20, bodyH * 0.44);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cx - faceW / 2, bodyY + bodyH * 0.22, faceW, faceH);
    ctx.fillStyle = '#38bdf8';
    const eyeY = bodyY + bodyH * 0.22 + faceH * 0.5;
    ctx.beginPath();
    ctx.arc(cx - faceW * 0.22, eyeY, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + faceW * 0.22, eyeY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    if ((DIG.state.headSoil || 0) > 0) {
      const layers = Math.min(4, C.getHeadStackHeight(DIG.state.headSoil, stats.reachW));
      for (let l = 0; l < layers; l++) {
        const blocks = Math.max(1, Math.min(4, stats.reachW - l)), bw = 11, bh = 9, rowW = blocks * bw;
        for (let b = 0; b < blocks; b++) {
          ctx.fillStyle = ((b + l) % 2 === 0) ? '#d9a875' : '#c68e5a';
          ctx.strokeStyle = '#7c4a21'; ctx.lineWidth = 1;
          ctx.fillRect(cx - rowW / 2 + b * bw, bodyY - (l + 1) * bh - 2, bw - 1, bh - 1);
          ctx.strokeRect(cx - rowW / 2 + b * bw, bodyY - (l + 1) * bh - 2, bw - 1, bh - 1);
        }
      }
    }

    const hand = DIG.state.equip && DIG.state.equip.hand;
    if (hand && hand.count > 0) {
      const handY = bodyY + bodyH * 0.52;
      if (hand.id === 'shovel') {
        const drawSh = (sx) => {
          ctx.strokeStyle = '#92400e'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(sx, handY - 14); ctx.lineTo(sx, handY + 12); ctx.stroke();
          ctx.fillStyle = '#94a3b8'; ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.2;
          ctx.fillRect(sx - 5, handY + 8, 10, 9); ctx.strokeRect(sx - 5, handY + 8, 10, 9);
        };
        drawSh(cx + bodyW / 2 + 10);
        if (hand.count >= 2) drawSh(cx - bodyW / 2 - 10);
      } else if (hand.id === 'soil') {
        for (let i = 0; i < Math.min(5, hand.count); i++) {
          ctx.fillStyle = (i % 2 === 0) ? '#d9a875' : '#c68e5a';
          ctx.strokeStyle = '#7c4a21'; ctx.lineWidth = 1;
          ctx.fillRect(cx + bodyW / 2 + 5, handY + 6 - i * 8, 10, 8);
          ctx.strokeRect(cx + bodyW / 2 + 5, handY + 6 - i * 8, 10, 8);
        }
      }
    }

    ctx.fillStyle = '#0369a1'; ctx.font = 'bold 9.5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`正面 (高${stats.reachH}×幅${stats.reachW})`, cx, h - 3);
  }

  function renderEquipSlotHTML(slotKey, label) {
    const eq = DIG.state.equip && DIG.state.equip[slotKey];
    const stats = C.getSizeStats();
    let content = '<span style="font-size:9px;color:#94a3b8;font-weight:800;">空</span>';
    let border = '#cbd5e1', bg = '#f8fafc';
    if (eq && eq.count > 0) {
      const meta = CONST.ITEM_META[eq.id] || { icon: '✨', name: eq.id };
      const maxStr = (slotKey === 'hand') ? (eq.id === 'shovel' ? `/${stats.handShovelMax}` : `/${stats.handSoilMax}`) : '';
      border = '#0284c7'; bg = '#e0f2fe';
      content = `<span style="font-size:16px;line-height:1;">${meta.icon}</span><span style="font-size:8.5px;font-weight:900;color:#0369a1;line-height:1;">${eq.count}${maxStr}</span>`;
    }
    return `<div data-equip-slot="${slotKey}" style="width:52px;height:52px;border-radius:10px;border:1.5px solid ${border};background:${bg};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;cursor:pointer;position:relative;box-sizing:border-box;"><span style="position:absolute;top:1px;left:4px;font-size:8px;font-weight:900;color:#64748b;">${label}</span>${content}</div>`;
  }

  function renderEquipPreviewUI() {
    const diaryModal = document.getElementById('modal-diary');
    const content = diaryModal && diaryModal.querySelector('.modal-content');
    if (!content) return;

    let panel = document.getElementById('dig-equip-preview-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'dig-equip-preview-panel';
      panel.style.cssText = 'background:#ffffff;border:1.5px solid #bae6fd;border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;';
      const titleEl = content.querySelector('.modal-title');
      if (titleEl && titleEl.nextSibling) content.insertBefore(panel, titleEl.nextSibling);
      else content.insertBefore(panel, content.firstChild);
    }

    const stats = C.getSizeStats();
    const hand = DIG.state.equip && DIG.state.equip.hand;
    let handDesc = '素手（掘削1個）';
    if (hand && hand.id === 'shovel') {
      handDesc = hand.count === 1 ? 'スコップ1本（最大5個掘削・投擲可）' : `スコップ${hand.count}本（掘削不可・${hand.count}本投擲可）`;
    } else if (hand && hand.id === 'soil') {
      handDesc = `土${hand.count}/${stats.handSoilMax}個（掘削不可・一括投擲可）`;
    }

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:10.5px;font-weight:900;color:#0369a1;">
        <span>🧍 キャラ装備＆正面プレビュー</span>
        <span style="font-size:9.5px;color:#475569;">手枠：${handDesc}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${renderEquipSlotHTML('head', '頭')}${renderEquipSlotHTML('body', '体')}${renderEquipSlotHTML('waist', '腰')}
        </div>
        <div style="border:1.5px solid #7dd3fc;border-radius:12px;overflow:hidden;background:#f0f9ff;flex-shrink:0;">
          <canvas id="dig-front-preview-canvas" width="132" height="168" style="display:block;width:132px;height:168px;"></canvas>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${renderEquipSlotHTML('back', '背')}${renderEquipSlotHTML('hand', '手')}${renderEquipSlotHTML('feet', '足')}
        </div>
      </div>
    `;
    drawFrontCharacterPreview(document.getElementById('dig-front-preview-canvas'));

    const names = { head: '頭（防具・飾り専用／頭上ピラミッド別）', body: '体', waist: '腰', back: '背', hand: '手（スコップ最大2本／土は高さ分）', feet: '足' };
    panel.querySelectorAll('[data-equip-slot]').forEach(el => {
      el.onclick = () => {
        const key = el.getAttribute('data-equip-slot');
        const eq = DIG.state.equip && DIG.state.equip[key];
        if (typeof showToast === 'function') {
          if (eq && eq.count > 0) {
            const m = CONST.ITEM_META[eq.id] || { name: eq.id, icon: '' };
            showToast(`${names[key]}：${m.icon}${m.name} × ${eq.count}`);
          } else showToast(`${names[key]}：未装備`);
        }
      };
    });
  }

  // --- 圧縮木箱25枠モーダル ---
  function ensureCrateModal() {
    let modal = document.getElementById('modal-crate-25');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'modal-crate-25';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-content" style="max-height:90vh;gap:8px;">
        <div class="modal-close" id="btn-close-crate25-x">✕</div>
        <div class="modal-title" id="crate25-title" style="font-size:14px;">📦 圧縮木箱（5×5＝25枠）</div>
        <div id="crate25-meta" style="font-size:10.5px;font-weight:800;color:#92400e;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:6px 8px;"></div>
        <div id="crate25-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;padding:4px;background:#fef3c7;border:1.5px solid #d97706;border-radius:10px;"></div>
        <div style="font-size:10px;color:#64748b;line-height:1.4;">※ 素材類：1枠10個 ／ 道具類：1枠5本 ／ 頭上ピラミッド収納時は「土」へ加算</div>
        <button type="button" id="btn-close-crate25" class="btn-sub" style="font-size:11.5px;">閉じる</button>
      </div>
    `;
    document.body.appendChild(modal);
    const closeFn = () => {
      modal.style.display = 'none'; modal.classList.remove('active');
      DIG.runtime.activeCrateModalId = null;
      if (window.AICommCore && window.AICommCore.resetAllModalZooms) window.AICommCore.resetAllModalZooms();
    };
    document.getElementById('btn-close-crate25-x').onclick = closeFn;
    document.getElementById('btn-close-crate25').onclick = closeFn;
    if (window.AICommCore && window.AICommCore.enablePinchZoomOnAllModals) window.AICommCore.enablePinchZoomOnAllModals();
    return modal;
  }

  function renderCrateModalContent(crateId) {
    const idx = DIG.state.crates.findIndex(c => c.id === crateId);
    const crate = idx >= 0 ? DIG.state.crates[idx] : DIG.state.crates[0];
    if (!crate) return;
    const slots = I.ensureCrateSlots(crate);
    const tEl = document.getElementById('crate25-title');
    const mEl = document.getElementById('crate25-meta');
    const gEl = document.getElementById('crate25-grid');
    if (tEl) tEl.innerText = `📦 圧縮木箱 #${(idx >= 0 ? idx : 0) + 1}（縦5×横5＝25枠）`;
    if (mEl) mEl.innerText = `場所(${crate.x}, ${crate.z}) ／ ${I.summarizeCrateContents(crate)}`;
    if (!gEl) return;

    gEl.innerHTML = '';
    for (let i = 0; i < CONST.CRATE_SLOTS; i++) {
      const s = slots[i];
      const cell = document.createElement('div');
      cell.style.cssText = 'aspect-ratio:1/1;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-weight:900;cursor:pointer;box-sizing:border-box;';
      if (s && s.count > 0) {
        const meta = CONST.ITEM_META[s.id] || { icon: '📦', name: s.id, stackMax: 10 };
        cell.style.background = '#ffffff'; cell.style.border = '1.5px solid #b45309';
        cell.innerHTML = `<span style="font-size:17px;line-height:1;">${meta.icon}</span><span style="font-size:9px;color:#92400e;">${s.count}/${meta.stackMax}</span>`;
        cell.onclick = () => { if (typeof showToast === 'function') showToast(`枠${i + 1}：${meta.icon}${meta.name} ${s.count}/${meta.stackMax}`); };
      } else {
        cell.style.background = 'rgba(255,255,255,0.55)'; cell.style.border = '1px dashed #d97706';
        cell.innerHTML = `<span style="font-size:8.5px;color:#b45309;opacity:0.45;">${i + 1}</span>`;
      }
      gEl.appendChild(cell);
    }
  }

  function openCrateModal(crateId) {
    const modal = ensureCrateModal();
    DIG.runtime.activeCrateModalId = crateId || (DIG.state.crates[0] && DIG.state.crates[0].id) || null;
    renderCrateModalContent(DIG.runtime.activeCrateModalId);
    modal.style.display = 'flex';
    modal.classList.add('active');
  }

  // --- 下部10枠＋独立圧縮木箱ボタン ---
  function renderDiaryFullUI() {
    C.purgeLegacyItems();
    renderEquipPreviewUI();
    const grid = document.getElementById('bag-grid');
    if (!grid) return;

    const stats = C.getSizeStats();
    const headNow = DIG.state.headSoil || 0;
    const carriedRes = C.getCarriedResourceTotal();
    if (grid.previousElementSibling) {
      grid.previousElementSibling.innerText = `🎒 キャラ所持枠（1〜9:ポケット 資源${carriedRes}/${stats.pocketCap}・道具別枠 ／ 10:頭上ピラミッド ${headNow}/${stats.headCap}）`;
    }

    const entries = [];
    ['soil', 'wood', 'stone'].forEach(id => {
      if ((DIG.state.pocket[id] || 0) > 0) entries.push({ id, count: DIG.state.pocket[id], isMat: true });
    });
    let remSh = DIG.state.pocket.shovel || 0;
    while (remSh > 0 && entries.length < 9) {
      const take = Math.min(CONST.STACK_TOOL, remSh);
      entries.push({ id: 'shovel', count: take, isMat: false });
      remSh -= take;
    }

    grid.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'bag-slot';
      slot.style.cssText = 'flex-direction:column;gap:1px;padding:2px;';
      const ent = entries[i];
      if (ent) {
        const meta = CONST.ITEM_META[ent.id] || { icon: '📦', name: ent.id };
        slot.classList.add('filled');
        if (ent.isMat) {
          const over = carriedRes > stats.pocketCap;
          slot.style.borderColor = over ? '#ef4444' : '#b45309';
          slot.style.background  = over ? '#fef2f2' : '#fef3c7';
          slot.innerHTML = `<span style="font-size:15px;line-height:1;">${meta.icon}</span><span style="font-size:8.5px;font-weight:900;color:${over ? '#dc2626' : '#92400e'};">${ent.count}</span>`;
          slot.onclick = () => { if (typeof showToast === 'function') showToast(`${meta.icon}${meta.name}：${ent.count}個（資源合計${carriedRes}/${stats.pocketCap}）`); };
        } else {
          slot.style.borderColor = '#0284c7'; slot.style.background = '#e0f2fe';
          slot.innerHTML = `<span style="font-size:15px;line-height:1;">${meta.icon}</span><span style="font-size:8.5px;font-weight:900;color:#0369a1;">${ent.count}/${CONST.STACK_TOOL}</span>`;
          slot.onclick = () => { if (typeof showToast === 'function') showToast(`${meta.icon}${meta.name}：${ent.count}/${CONST.STACK_TOOL}本（資源上限非消費）`); };
        }
      } else {
        slot.innerHTML = `<span style="font-size:8px;color:#94a3b8;font-weight:800;">枠${i + 1}</span>`;
      }
      grid.appendChild(slot);
    }

    const pyrSlot = document.createElement('div');
    pyrSlot.className = 'bag-slot';
    pyrSlot.style.cssText = 'flex-direction:column;gap:1px;padding:2px;';
    if (headNow > 0) {
      pyrSlot.classList.add('filled'); pyrSlot.style.borderColor = '#0284c7'; pyrSlot.style.background = '#dbeafe';
      pyrSlot.innerHTML = `<span style="font-size:15px;line-height:1;">🔺</span><span style="font-size:8px;font-weight:900;color:#1d4ed8;">${headNow}/${stats.headCap}</span>`;
    } else {
      pyrSlot.style.borderStyle = 'dashed'; pyrSlot.style.borderColor = '#38bdf8'; pyrSlot.style.background = '#f0f9ff';
      pyrSlot.innerHTML = `<span style="font-size:13px;line-height:1;opacity:0.65;">🔺</span><span style="font-size:7.5px;font-weight:900;color:#0284c7;">頭上0/${stats.headCap}</span>`;
    }
    pyrSlot.onclick = () => { if (typeof showToast === 'function') showToast(`🔺 頭上ピラミッド：土${headNow}/${stats.headCap}個（+${stats.headLayers}段・保持中は投擲不可）`); };
    grid.appendChild(pyrSlot);

    let cratePanel = document.getElementById('dig-crate-list-panel');
    if (!cratePanel && grid.parentNode) {
      cratePanel = document.createElement('div');
      cratePanel.id = 'dig-crate-list-panel';
      cratePanel.style.cssText = 'margin-top:8px;padding:8px;background:#fffbeb;border:1.5px solid #f59e0b;border-radius:10px;display:flex;flex-direction:column;gap:6px;';
      grid.parentNode.insertBefore(cratePanel, grid.nextSibling);
    }
    if (cratePanel) {
      cratePanel.innerHTML = '<div style="font-size:10.5px;font-weight:900;color:#92400e;">📦 圧縮木箱（タップで25枠表示 ／ 3D画面の木箱タップでも開閉）</div><div id="dig-crate-btn-row" style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;"></div>';
      const row = document.getElementById('dig-crate-btn-row');
      for (let i = 0; i < 5; i++) {
        const crate = DIG.state.crates[i];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = 'padding:6px 2px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;font-weight:900;';
        if (crate) {
          btn.style.border = '1.5px solid #d97706'; btn.style.background = '#ffffff'; btn.style.color = '#92400e';
          btn.innerHTML = `<span style="font-size:15px;line-height:1;">📦</span><span style="font-size:8.5px;">${I.countUsedSlotsInCrate(crate)}/${CONST.CRATE_SLOTS}枠</span>`;
          btn.onclick = () => openCrateModal(crate.id);
        } else {
          btn.style.border = '1px dashed #cbd5e1'; btn.style.background = '#f8fafc'; btn.style.color = '#94a3b8'; btn.disabled = true;
          btn.innerHTML = '<span style="font-size:8.5px;">空き枠</span>';
        }
        row.appendChild(btn);
      }
    }
    if (DIG.runtime.activeCrateModalId) renderCrateModalContent(DIG.runtime.activeCrateModalId);
  }

  DIG.ui = { openCrateModal, renderDiaryFullUI, renderEquipPreviewUI };

  // --- ボタン再接続 ＆ 既存フック差し替え ---
  const oldBtn = document.getElementById('btn-action');
  if (oldBtn && oldBtn.parentNode) {
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    newBtn.addEventListener('click', () => { if (typeof window.executeTurn === 'function') window.executeTurn(); });
  }

  if (DIG.runtime.origGetSurfaceYAt) {
    getSurfaceYAt = function(gx, gz, lvOverride = null, reqWidth = 1) {
      if (typeof ROBOT !== 'undefined' && ROBOT && ROBOT.pos && lvOverride !== null &&
          Math.round(gx) === Math.round(ROBOT.pos.x) && Math.round(gz) === Math.round(ROBOT.pos.z) && lvOverride === ROBOT.pos.lv) {
        return M.getRobotBaseSubY(gx, gz, lvOverride) * CONST.SUB_SIZE;
      }
      return DIG.runtime.origGetSurfaceYAt(gx, gz, lvOverride, reqWidth);
    };
  }
  if (typeof clampCharSubPosForBodySize === 'function') {
    clampCharSubPosForBodySize = function() {
      if (typeof ROBOT === 'undefined' || !ROBOT || !ROBOT.pos) return;
      ROBOT.pos.sx = Math.max(0, Math.min(4, Math.round(Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2)));
      ROBOT.pos.sz = Math.max(0, Math.min(4, Math.round(Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2)));
      ROBOT.pos.subY = M.getRobotBaseSubY();
      ROBOT.pos.lv = C.floorSubYToRobotLv(ROBOT.pos.subY);
    };
  }
  if (typeof applyLoadedWorldData === 'function') {
    const _origApply = applyLoadedWorldData;
    applyLoadedWorldData = function(d) {
      const hm = d && d.heightMap;
      if (!d || d.cleanEnvTag !== CONST.CLEAN_ENV_TAG || (d.areaId && d.areaId !== 'home') ||
          !hm || hm['0,0'] !== 0 || hm['0,-1'] !== 1 || hm['0,-2'] !== 1 || hm['1,2'] === 1) {
        if (!C.isCleanTerrainValid()) C.applyCleanTestTerrain(true);
        else { C.relocatePortalsToCorner(); C.purgeLegacyItems(); C.saveDigState(); if (typeof saveWorldState === 'function') saveWorldState(); }
        return;
      }
      _origApply(d);
      C.relocatePortalsToCorner(); C.purgeLegacyItems(); C.syncDugCellsToChipMap();
      if (typeof ROBOT !== 'undefined' && ROBOT && ROBOT.pos) {
        ROBOT.pos.sx = Math.max(0, Math.min(4, Math.round(Number.isFinite(ROBOT.pos.sx) ? ROBOT.pos.sx : 2)));
        ROBOT.pos.sz = Math.max(0, Math.min(4, Math.round(Number.isFinite(ROBOT.pos.sz) ? ROBOT.pos.sz : 2)));
        ROBOT.pos.subY = M.getRobotBaseSubY();
      }
      V.renderDigVisuals(); renderDiaryFullUI();
    };
  }
  if (typeof saveWorldState === 'function') {
    const _origSave = saveWorldState;
    saveWorldState = function() {
      C.purgeLegacyItems();
      const res = _origSave.apply(this, arguments);
      try {
        if (typeof safeStorage !== 'undefined') {
          const raw = safeStorage.getItem('island_spacecore_v15');
          if (raw) {
            const obj = JSON.parse(raw);
            obj.cleanEnvTag = CONST.CLEAN_ENV_TAG; obj.areaId = 'home';
            const updatedStr = JSON.stringify(obj);
            safeStorage.setItem('island_spacecore_v15', updatedStr);
            if (typeof firestoreDocRef !== 'undefined' && firestoreDocRef) {
              firestoreDocRef.set({
                stateJson: updatedStr, day: obj.day, time: obj.time, life: obj.life,
                robotGen: obj.robot ? obj.robot.gen : 1, lastMessage: obj.lastMessage || '',
                logs: obj.logs || [], updatedAt: Date.now()
              }).catch(() => {});
            }
          }
        }
      } catch (e) {}
      return res;
    };
  }
  if (typeof renderDiaryModal === 'function') { const _o = renderDiaryModal; renderDiaryModal = function() { _o.apply(this, arguments); renderDiaryFullUI(); }; }
  if (typeof rebuildTerrainAndItems === 'function') {
    const _o = rebuildTerrainAndItems;
    rebuildTerrainAndItems = function() { C.relocatePortalsToCorner(); C.purgeLegacyItems(); C.syncDugCellsToChipMap(); _o(); V.renderDigVisuals(); };
  }
  if (typeof updateEnvironmentAndUI === 'function') {
    const _o = updateEnvironmentAndUI;
    updateEnvironmentAndUI = function() { _o(); V.renderHeadPyramidVisual(); V.renderHandEquipVisual(); renderDiaryFullUI(); };
  }
  if (typeof resetGameDirectly === 'function') {
    const _o = resetGameDirectly;
    resetGameDirectly = function() {
      try { if (typeof safeStorage !== 'undefined') safeStorage.removeItem(CONST.STORAGE_KEY); } catch (e) {}
      if (window.AICommCore && window.AICommCore.resetPhysicalHistory) window.AICommCore.resetPhysicalHistory();
      _o();
    };
  }
  const diaryBtn = document.getElementById('diary-btn');
  if (diaryBtn) diaryBtn.addEventListener('click', () => setTimeout(renderDiaryFullUI, 20));

  // --- AICommCore 接続（統一10アクション＋距離1触覚サマリー） ---
  if (window.AICommCore) {
    if (window.AICommCore.registerVisionProvider) window.AICommCore.registerVisionProvider((opts) => V.buildFirstPersonVisionMap(opts));
    const regBody = window.AICommCore.registerBodySensor || window.AICommCore.registerSensor;
    const faceMap = { front: '正面', up: '上向き', down: '下向き', left: '左向き', right: '右向き' };

    regBody(() => {
      const stats = C.getSizeStats(), st = life.getState(), basis = M.getFacingBasis();
      const { absX, absZ } = C.getRobotAbsPos();
      const clearance = M.getCeilingClearanceSubAt(absX, absZ, M.getRobotBaseSubY(), stats.reachW);
      const hand = DIG.state.equip && DIG.state.equip.hand;
      let handText = '空（素手：掘削1個）';
      if (hand && hand.id === 'shovel') handText = hand.count === 1 ? 'スコップ1本（繋がるブロック最大5個掘削可・投擲可）' : `スコップ${hand.count}本（掘削不可・${hand.count}本投擲可）`;
      else if (hand && hand.id === 'soil') handText = `土${hand.count}/${stats.handSoilMax}個（掘削不可・投擲可）`;
      const nearCrate = I.findNearbyCrate();
      const trapped = (typeof M.isCompletelyTrapped === 'function') && M.isCompletelyTrapped();
      const faceLbl = faceMap[(typeof M.getFaceDir === 'function') ? M.getFaceDir() : 'front'] || '正面';
      const touchLine = (typeof D.describeImmediateTouch === 'function') ? D.describeImmediateTouch() : '';
      const lines = [
        `体格: 高さ${stats.reachH}×幅${stats.reachW} (歩幅:1〜${stats.moveStep}自由 / 階段:${stats.stairMax}・登り:${stats.maxStepUpSub} / しゃがみ高:${stats.crawlH} / 整理上限:${stats.maxStackHeight}段 / 投げ最大:道具${stats.throwToolMax}・土${stats.throwSoilMax})`,
        `体の向き: ${basis.actualFacingName} / 顔の向き: ${faceLbl} / 姿勢: ${ROBOT.posture === 'crawl' ? 'しゃがみ(ほふく)' : '立位'} / 頭上の天井空き: ${clearance}分割`,
        `身体状態: 体力${st.stamina}/100, おなか${st.energy}/100`,
        `手枠装備: ${handText}`,
        `ポケット(1〜9枠): 土${DIG.state.pocket.soil || 0}個（資源合計${C.getCarriedResourceTotal()}/${stats.pocketCap}・手枠共有）、スコップ${DIG.state.pocket.shovel || 0}本（資源上限非消費）`,
        `頭上ピラミッド(10枠目): 土${DIG.state.headSoil || 0}/${stats.headCap}個 (+${stats.headLayers}段・必要天井:${stats.bodyHeight + stats.headLayers}${(DIG.state.headSoil || 0) > 0 ? '・保持中は投擲不可' : ''})`,
        nearCrate ? `隣接圧縮木箱(手が届く): ${I.summarizeCrateContents(nearCrate)}` : '隣接圧縮木箱: なし（手が届く距離1分割以内にない）'
      ];
      if (touchLine) lines.push(touchLine);
      if (trapped) lines.push('⚠️ 完全詰み状態: 周囲が塞がっているため use(sub:"punch"または"kick") で目の前1分割を粉砕(消失)して脱出可能');
      return lines.join('\n');
    });

    if (typeof window.AICommCore.clearActions === 'function') window.AICommCore.clearActions();
    const reg = (id, desc, fn) => window.AICommCore.registerAction({
      id, desc,
      run: (ctx) => { DIG.runtime.lastTurnActionId = id; return fn(ctx); }
    });

    reg('turn',    '独立1T：移動せず体(dir:8方向)と顔(face:"front"/"up"/"down"/"left"/"right")の向きを変える',
      ({ dir, face }) => M.runTurn(dir, face));
    reg('move',    '移動：dir方向へcount歩(1〜最大歩幅)進む。sub:"pickup"/"place"/"throw"で移動しながら同時操作も可',
      ({ dir, count, sub, item }) => M.runSubMove(dir, { count, sub, item }));
    reg('dig',     '掘削：手の届く距離1の繋がり合うブロック/分割ブロックをcount個(1〜最大)削る(target:"front"/"front_down"/"under"/"up"/"left"/"right", shape:"auto"/"wide"/"tall")',
      ({ dir, target, shape, count, dec }) => D.runUnifiedDig({ dir, target: target || 'front', shape: shape || 'auto', count, thought: dec && dec.thought }));
    reg('pickup',  '拾う：すぐそばの土や落ちたスコップ(S)をポケットへ拾う(item:"soil"/"shovel"/"all", count:個数自由)',
      ({ item, count }) => I.runPickup(item, count));
    reg('place',   '置く：頭上・手枠・ポケットの土をdir方向の距離1へcount個そっと置く',
      ({ dir, item, count }) => D.runPlaceSoil(dir, { item, count }));
    reg('throw',   '投げる：手枠装備のスコップや土をdir方向へ放物線でcount個投げる(頭上保持時は不可)',
      ({ dir, count }) => T.runThrowHand(dir, { count }));
    reg('crate',   '独立1T：すぐ隣(距離1分割以内)の圧縮木箱と出し入れ(sub:"take"取り出し/"store"収納, item:"shovel"/"soil"/"all", count:個数自由)',
      ({ sub, item, count }) => I.runCrate(sub || 'take', item, count));
    reg('equip',   '独立1T：ポケット⇔手枠を持ち替える(item:"shovel"/"soil"/"none"素手, count:個数自由)',
      ({ item, count }) => I.runEquipHand(item || 'none', count));
    reg('posture', '独立1T：姿勢・待機(sub:"stand"立つ/"crouch"しゃがむ/"jump"跳ぶ/"rest"休む/"look"見回す)',
      ({ sub, dir, face }) => M.runPosture(sub || 'rest', dir, face));
    reg('use',     'スポーツ動作/使用(sub:"punch"/"kick"/"swing")：通常は土・道具を押し/蹴り/弾き(壁は砂が散る)、完全詰み時のみパンチ・キックで1分割粉砕消失',
      ({ sub, dir, item, count }) => T.runUseAction(sub || 'punch', dir, { item, count }));

    window.AICommCore.registerPostTurnHook(({ dec, sub }) => {
      const act = (dec && dec.action) || DIG.runtime.lastTurnActionId;
      const subLow = String(sub || (dec && dec.sub) || '').toLowerCase();
      const eSpec = (typeof getExpressionSpec === 'function') ? getExpressionSpec(ROBOT.emotion) : null;
      if (act === 'dig' || act === 'throw') ROBOT.emotion = 'swing_v';
      else if (act === 'use') {
        if (typeof POSE_TABLE !== 'undefined' && POSE_TABLE[subLow]) ROBOT.emotion = subLow;
        else if (subLow === 'swing') ROBOT.emotion = 'swing_v';
        else ROBOT.emotion = 'push';
      } else if (act === 'turn' || (act === 'posture' && subLow === 'look')) ROBOT.emotion = 'peek';
      else if (act === 'posture' && subLow === 'rest') ROBOT.emotion = 'sleep';
      else if (act === 'posture' && subLow === 'jump') ROBOT.emotion = 'joy';
      else if (act === 'move' && DIG.runtime.lastMoveVisualKind === 'scramble_climb') ROBOT.emotion = 'struggle';
      else if (act === 'move' && DIG.runtime.lastMoveVisualKind === 'safe_landing') ROBOT.emotion = 'pickup';
      else if (act === 'move' && DIG.runtime.lastMoveVisualKind === 'high_drop') ROBOT.emotion = 'surprise';
      else if (eSpec && eSpec.tool) {
        if (act === 'move') ROBOT.emotion = 'run';
        else if (act === 'pickup' || (act === 'crate' && subLow === 'take')) ROBOT.emotion = 'pickup';
        else if (act === 'place' || (act === 'crate' && subLow === 'store') || act === 'equip') ROBOT.emotion = 'carry';
        else ROBOT.emotion = 'normal';
      }
      DIG.runtime.lastMoveVisualKind = null;
      V.renderHeadPyramidVisual();
      V.renderHandEquipVisual();
      return null;
    });
  }

  // --- 起動 ---
  C.loadDigState();
  if (typeof rebuildTerrainAndItems === 'function') rebuildTerrainAndItems();
  else V.renderDigVisuals();
  if (typeof syncRobot3DPosition === 'function') syncRobot3DPosition(true);
  renderDiaryFullUI();

  window.DigRulesModule = Object.freeze({
    getState: () => DIG.state,
    getSizeStats: C.getSizeStats,
    buildFirstPersonVisionMap: V.buildFirstPersonVisionMap,
    renderDiaryFullUI,
    renderDigVisuals: V.renderDigVisuals,
    renderHeadPyramidVisual: V.renderHeadPyramidVisual,
    renderHandEquipVisual: V.renderHandEquipVisual,
    openCrateModal,
    applyCleanTestTerrain: C.applyCleanTestTerrain
  });

  if (window.DebugGuard) window.DebugGuard.markLoaded('dig_ui.js');
})();
