// ============================================================================
// 【3D描画・カメラ・Lerp滑らか移動・住人/敵/ペット＆仕掛け描画コア】
// ============================================================================
let scene, activeCamera, renderer;
let terrainGroup, itemsGroup, portalsGroup, entitiesGroup, envGroup;
let robotGroup, petGroup, sharedBulbMat;
let ambientLight, sunLight, starField, waterfallGroup, oceanMesh;

let manualCameraMode = 'follow'; // 'follow' | 'ground' | 'ug' | 'robot'
let cameraDirty = true;
let orbitYaw = 0.72, orbitPitch = 0.56, orbitDist = 8.4;
let fpvYawOffset = 0, fpvPitchOffset = 0;
let isDragging = false, lastPinchDist = 0;
const activePointers = new Map();

// 滑らか移動（Lerp）用の目標座標
const robotVisualTarget = new THREE.Vector3(0, 0, 1);
let robotTargetRotY = Math.PI;
const petVisualTarget = new THREE.Vector3(0, 0, 1);

// ジオメトリ＆マテリアルキャッシュ（発熱・メモリ増加防止）
const geoCache = {
  box1: new THREE.BoxGeometry(1, 1, 1),
  subBox: new THREE.BoxGeometry(0.2, 0.2, 0.2),
  topCap: new THREE.BoxGeometry(1, 0.2, 1),
  midCap: new THREE.BoxGeometry(1, 0.2, 1),
  soilBase: new THREE.BoxGeometry(1, 0.6, 1),
  sphereS: new THREE.SphereGeometry(0.14, 10, 8),
  cylS: new THREE.CylinderGeometry(0.08, 0.1, 0.22, 8),
  ring: new THREE.TorusGeometry(0.36, 0.06, 8, 20),
  octa: new THREE.OctahedronGeometry(0.18, 0)
};
const matCache = {};
function getMat(hex, opts = {}) {
  const key = `${hex}_${opts.op ?? 1}_${opts.em ?? 0}_${opts.wf ? 1 : 0}`;
  if (!matCache[key]) {
    matCache[key] = new THREE.MeshLambertMaterial({
      color: hex,
      transparent: (opts.op !== undefined && opts.op < 1),
      opacity: opts.op ?? 1,
      emissive: opts.em ?? 0x000000,
      wireframe: !!opts.wf
    });
  }
  return matCache[key];
}

// ============================================================================
// 【初期化：Three.jsシーン・光・海・滝・巨大ガメ・星空】
// ============================================================================
function initThreeWorld() {
  const container = document.getElementById('canvas-container');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1d36);

  activeCamera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.08, 120);
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
  scene.add(ambientLight);
  sunLight = new THREE.DirectionalLight(0xfffbeb, 0.85);
  sunLight.position.set(6, 12, 7);
  scene.add(sunLight);

  terrainGroup = new THREE.Group();
  itemsGroup = new THREE.Group();
  portalsGroup = new THREE.Group();
  entitiesGroup = new THREE.Group();
  envGroup = new THREE.Group();
  scene.add(envGroup, terrainGroup, portalsGroup, itemsGroup, entitiesGroup);

  buildEnvironmentProps();
  buildRobotModel();
  buildPetModel();
  setupTouchAndMouseControls(renderer.domElement);
  setupUIEventBindings();
  loadSavedSettingsToInputs();

  applyAreaVisualTheme(getCurrentAreaDef());
  rebuildTerrainAndItems();
  syncRobot3DPosition(true);
  updateAllCamerasTransform();
  updateEnvironmentAndUI();
  loadCloudWorldState();

  window.addEventListener('resize', () => {
    activeCamera.aspect = window.innerWidth / window.innerHeight;
    activeCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    cameraDirty = true;
  });

  animateLoop();
}

function buildEnvironmentProps() {
  // 星空
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 180; i++) {
    const r = 24 + Math.random() * 20;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() * Math.PI * 0.55;
    starPos.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) + 3, r * Math.sin(ph) * Math.sin(th));
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfef9c3, size: 0.22, transparent: true, opacity: 0.85 }));
  envGroup.add(starField);

  // 海面（島の周囲を囲む半透明フレーム）
  oceanMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshLambertMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.52, side: THREE.DoubleSide })
  );
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.y = WATER_SURFACE_Y;
  envGroup.add(oceanMesh);

  // 大滝（4辺の装飾）
  waterfallGroup = new THREE.Group();
  const wfMat = new THREE.MeshLambertMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.58, side: THREE.DoubleSide });
  const wfCoords = [[0, -2.55, 0], [0, 2.55, 0], [-2.55, 0, Math.PI / 2], [2.55, 0, Math.PI / 2]];
  wfCoords.forEach(([x, z, ry]) => {
    const wf = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 4.4), wfMat);
    wf.position.set(x, -2.6, z);
    wf.rotation.y = ry;
    waterfallGroup.add(wf);
  });
  envGroup.add(waterfallGroup);

  // 島を背中で支える巨大な亀
  const turtle = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.8, 5.4), getMat(0x15803d));
  shell.position.y = -5.45;
  turtle.add(shell);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.3), getMat(0x4ade80));
  head.position.set(0, -5.5, 3.3);
  turtle.add(head);
  [[-2.5, 2.3], [2.5, 2.3], [-2.5, -2.3], [2.5, -2.3]].forEach(([fx, fz]) => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.9), getMat(0x22c55e));
    fin.position.set(fx, -5.65, fz);
    turtle.add(fin);
  });
  envGroup.add(turtle);
}

function applyAreaVisualTheme(areaDef) {
  if (!areaDef || !areaDef.theme) return;
  if (scene) scene.background = new THREE.Color(areaDef.theme.skyHex ?? 0x0f1d36);
  if (waterfallGroup) waterfallGroup.visible = areaDef.theme.showWaterfall !== false;
  if (oceanMesh) oceanMesh.visible = (areaDef.group !== 'earth' || areaDef.id === 'earth_5');
}

// ============================================================================
// 【ロボット本体（箱型＆3D骨組み切替）＆ 追従ペットモデル】
// ============================================================================
let rigParts = {};
function buildRobotModel() {
  if (robotGroup) scene.remove(robotGroup);
  robotGroup = new THREE.Group();
  sharedBulbMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

  const isStick = ROBOT.rigType === 'stick';
  const bodyColor = isStick ? 0x38bdf8 : 0x60a5fa;
  const limbColor = isStick ? 0xf8fafc : 0x93c5fd;

  const torsoPivot = new THREE.Group();
  torsoPivot.position.y = 0.42;
  robotGroup.add(torsoPivot);

  const torso = new THREE.Mesh(
    isStick ? new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8) : new THREE.BoxGeometry(0.46, 0.38, 0.36),
    getMat(bodyColor)
  );
  torso.position.y = 0.14;
  torsoPivot.add(torso);

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.36;
  torsoPivot.add(headPivot);

  const head = new THREE.Mesh(
    isStick ? new THREE.SphereGeometry(0.16, 10, 8) : new THREE.BoxGeometry(0.42, 0.34, 0.38),
    getMat(0xe0f2fe)
  );
  head.position.y = 0.16;
  headPivot.add(head);

  // 目（正面は +Z 方向）
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), getMat(0x0f172a));
  eyeL.position.set(-0.1, 0.18, isStick ? 0.14 : 0.19);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;
  headPivot.add(eyeL, eyeR);

  // 頭のアンテナ＆感情電球
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6), getMat(0x94a3b8));
  ant.position.y = 0.38;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), sharedBulbMat);
  bulb.position.y = 0.48;
  headPivot.add(ant, bulb);

  // 腕・脚（関節ピボット付き）
  function makeLimb(x, y, w, h, col) {
    const p = new THREE.Group();
    p.position.set(x, y, 0);
    const m = new THREE.Mesh(isStick ? new THREE.CylinderGeometry(0.035, 0.035, h, 6) : new THREE.BoxGeometry(w, h, w), getMat(col));
    m.position.y = -h / 2;
    p.add(m);
    if (isStick) {
      const jt = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), getMat(0xfde047));
      p.add(jt);
    }
    return p;
  }

  const armL = makeLimb(-0.28, 0.30, 0.11, 0.32, limbColor);
  const armR = makeLimb( 0.28, 0.30, 0.11, 0.32, limbColor);
  const legL = makeLimb(-0.12, 0.40, 0.13, 0.38, 0x3b82f6);
  const legR = makeLimb( 0.12, 0.40, 0.13, 0.38, 0x3b82f6);
  torsoPivot.add(armL, armR);
  robotGroup.add(legL, legR);

  rigParts = { torsoPivot, headPivot, armL, armR, legL, legR, rigType: ROBOT.rigType };
  scene.add(robotGroup);
  applyRobotBulbColor();
}

function buildPetModel() {
  if (petGroup) scene.remove(petGroup);
  petGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.32), getMat(0xfef08a));
  body.position.y = 0.14;
  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.07), getMat(0xfb923c));
  earL.position.set(-0.09, 0.28, 0.04);
  const earR = earL.clone(); earR.position.x = 0.09;
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), getMat(0x0f172a));
  eyeL.position.set(-0.07, 0.16, 0.16);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.07;
  petGroup.add(body, earL, earR, eyeL, eyeR);
  petGroup.visible = false;
  scene.add(petGroup);
}

// ============================================================================
// 【地形・ポータル・パズル・アイテム・住人/敵/野生ペットの再構築】
// ============================================================================
function rebuildTerrainAndItems() {
  terrainGroup.clear();
  itemsGroup.clear();
  portalsGroup.clear();
  entitiesGroup.clear();

  const areaDef = getCurrentAreaDef();
  const robLv = getRobotHeightLevel();
  const isUgView = (manualCameraMode === 'ug') || (robLv < 0 && manualCameraMode === 'follow');

  // 1. 地形ブロック（未削りは軽量3層・削り済みは5×5×5分割）
  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      const topLv = HEIGHT_MAP[`${x},${z}`] ?? 0;
      for (let lv = AREA1_MIN_UNDER_LV; lv <= topLv; lv++) {
        // 地下観察窓：ロボより上の手前ブロックを透過または省略
        const isFrontHide = isUgView && lv > robLv && Math.abs(x - ROBOT.pos.x) <= 1 && Math.abs(z - ROBOT.pos.z) <= 1;
        if (isFrontHide && CAM_VISUAL_STYLE === 'hide') continue;
        const op = isFrontHide ? 0.22 : 1.0;

        const ck = `${x},${z},${lv}`;
        const chip = CHIP_MAP[ck];
        if (!chip || Object.keys(chip).length === 0) {
          if (lv >= 0) {
            const topM = new THREE.Mesh(geoCache.topCap, getMat(getSubVoxelColorHex(lv, 4), { op }));
            topM.position.set(x, lv - 0.1, z);
            const midM = new THREE.Mesh(geoCache.midCap, getMat(getSubVoxelColorHex(lv, 3), { op }));
            midM.position.set(x, lv - 0.3, z);
            const baseM = new THREE.Mesh(geoCache.soilBase, getMat(getSubVoxelColorHex(lv, 1), { op }));
            baseM.position.set(x, lv - 0.7, z);
            terrainGroup.add(topM, midM, baseM);
          } else {
            const m = new THREE.Mesh(geoCache.box1, getMat(getSubVoxelColorHex(lv, 2), { op }));
            m.position.set(x, lv - 0.5, z);
            terrainGroup.add(m);
          }
        } else {
          for (let sy = 0; sy < 5; sy++) {
            for (let sx = 0; sx < 5; sx++) {
              for (let sz = 0; sz < 5; sz++) {
                if (chip[`${sx},${sy},${sz}`]) continue;
                if (!isExposedSubVoxel(x, z, lv, sx, sy, sz)) continue;
                const wf = (CAM_VISUAL_STYLE === 'glass_line' && isFrontHide);
                const sm = new THREE.Mesh(geoCache.subBox, getMat(getSubVoxelColorHex(lv, sy), { op, wf }));
                sm.position.set(x + (sx - 2) * 0.2, (lv - 1) + (sy + 0.5) * 0.2, z + (sz - 2) * 0.2);
                terrainGroup.add(sm);
              }
            }
          }
        }
      }
    }
  }

  // 2. 階段・穴・ワープ装置（ポータル）
  const isSolved = !!AREA_PUZZLE_SOLVED[areaDef.id];
  (areaDef.portals || []).forEach(p => {
    const py = getSurfaceYAt(p.x, p.z, null, 3);
    const locked = p.needPuzzle && !isSolved;
    const grp = new THREE.Group();
    grp.position.set(p.x, py, p.z);

    if (p.type === 'stairs_up' || p.type === 'stairs_down') {
      const col = locked ? 0xef4444 : (p.type === 'stairs_up' ? 0xfde047 : 0x7dd3fc);
      for (let i = 0; i < 3; i++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.22), getMat(col, { em: locked ? 0x450a0a : 0x332200 }));
        step.position.set(0, 0.06 + i * 0.12, 0.2 - i * 0.2);
        grp.add(step);
      }
      if (!locked && p.type === 'stairs_up') {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.3, 8), getMat(0xfef08a, { op: 0.32 }));
        beam.position.y = 0.65;
        grp.add(beam);
      }
    } else if (p.type === 'hole_down') {
      const ring = new THREE.Mesh(geoCache.ring, getMat(locked ? 0xef4444 : 0xa855f7, { em: 0x1e1b4b }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05;
      const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 12), getMat(0x020617));
      pit.position.y = 0.02;
      grp.add(ring, pit);
    } else {
      const ring = new THREE.Mesh(geoCache.ring, getMat(locked ? 0xef4444 : 0x22d3ee, { em: 0x083344 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.08;
      ring.userData.spin = true;
      grp.add(ring);
    }
    portalsGroup.add(grp);
  });

  // 3. 素材パズル台座
  if (areaDef.puzzle) {
    const pz = areaDef.puzzle;
    const py = getSurfaceYAt(pz.x, pz.z, null, 3);
    const col = isSolved ? 0x34d399 : 0xf472b6;
    const gem = new THREE.Mesh(geoCache.octa, getMat(col, { em: isSolved ? 0x064e3b : 0x4c0519 }));
    gem.position.set(pz.x, py + 0.34, pz.z);
    gem.userData.spin = true;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.55), getMat(0xf8fafc));
    base.position.set(pz.x, py + 0.05, pz.z);
    portalsGroup.add(base, gem);
  }

  // 4. 落ちているアイテム
  WORLD_ITEMS.forEach(it => {
    const iy = getSurfaceYAt(it.x, it.z, null, 3);
    let mesh;
    if (it.type === 'apple') mesh = new THREE.Mesh(geoCache.sphereS, getMat(0xef4444));
    else if (it.type === 'stone') mesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.24), getMat(0x94a3b8));
    else if (it.type === 'oil') mesh = new THREE.Mesh(geoCache.cylS, getMat(0x38bdf8, { op: 0.85 }));
    else mesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.26), getMat(0x4ade80));
    mesh.position.set(it.x, iy + 0.15, it.z);
    itemsGroup.add(mesh);
  });

  // 5. エリア住人・敵キャラ・野生ペット
  const act = window.ACTIVE_ENTITIES || {};
  function addMiniFigure(ent, kind) {
    if (!ent) return;
    const ey = getSurfaceYAt(ent.x, ent.z, null, 3);
    const g = new THREE.Group();
    g.position.set(ent.x, ey, ent.z);
    const sz = kind === 'pet' ? 0.26 : (kind === 'enemy' ? 0.36 : 0.38);
    const body = new THREE.Mesh(
      kind === 'enemy' ? new THREE.OctahedronGeometry(0.24, 0) : new THREE.BoxGeometry(sz, sz, sz),
      getMat(ent.color || 0xfacc15, { em: kind === 'enemy' ? 0x3b0764 : 0x000000 })
    );
    body.position.y = sz * 0.6;
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.05), getMat(0x0f172a));
    eye.position.set(0, sz * 0.72, sz * 0.5);
    g.add(body, eye);
    if (kind === 'npc') {
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.24, 6), getMat(0xfef08a));
      hat.position.y = sz + 0.16;
      g.add(hat);
    }
    g.userData.bob = true;
    g.userData.baseY = ey;
    entitiesGroup.add(g);
  }
  if (act.npc) addMiniFigure(act.npc, 'npc');
  if (act.guestNpc) addMiniFigure(act.guestNpc, 'npc');
  if (act.enemy && !act.enemy.defeated) addMiniFigure(act.enemy, 'enemy');
  if (act.wildPet) addMiniFigure(act.wildPet, 'pet');
}

// ============================================================================
// 【ロボット＆相棒ペットの目標座標更新（Lerp補間）】
// ============================================================================
function syncRobot3DPosition(instant = false) {
  if (!robotGroup) return;
  if (rigParts.rigType !== ROBOT.rigType) buildRobotModel();

  const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const effW = bSpec.reqWidth;
  const wx = ROBOT.pos.x + ((ROBOT.pos.sx ?? 2) - 2) * 0.20;
  const wz = ROBOT.pos.z + ((ROBOT.pos.sz ?? 2) - 2) * 0.20;
  const wy = getSurfaceYAt(ROBOT.pos.x, ROBOT.pos.z, getRobotHeightLevel(), effW);

  robotVisualTarget.set(wx, wy, wz);
  robotTargetRotY = ROBOT.rotY || 0;

  const isCrawl = ROBOT.posture === 'crawl';
  robotGroup.scale.set(bSpec.scaleX * 0.52, isCrawl ? sSpec.scaleY * 0.55 : sSpec.scaleY, bSpec.scaleZ * 0.52);

  if (instant) {
    robotGroup.position.copy(robotVisualTarget);
    robotGroup.rotation.y = robotTargetRotY;
  }

  // 追従ペットの位置更新
  if (petGroup) {
    const petSpec = (ROBOT.pet && window.ENTITY_DB && window.ENTITY_DB.pets[ROBOT.pet.id]) ? window.ENTITY_DB.pets[ROBOT.pet.id] : null;
    if (petSpec) {
      petGroup.visible = true;
      petGroup.children[0].material = getMat(petSpec.color || 0xfef08a);
      const px = (ROBOT.pet.x ?? ROBOT.pos.x) - Math.sin(robotTargetRotY) * 0.35;
      const pz = (ROBOT.pet.z ?? ROBOT.pos.z) - Math.cos(robotTargetRotY) * 0.35;
      const py = getSurfaceYAt(ROBOT.pet.x ?? ROBOT.pos.x, ROBOT.pet.z ?? ROBOT.pos.z, ROBOT.pet.lv ?? null, 1);
      petVisualTarget.set(px, py, pz);
      if (instant) petGroup.position.copy(petVisualTarget);
    } else {
      petGroup.visible = false;
    }
  }
  applyRobotBulbColor();
  cameraDirty = true;
}

// ============================================================================
// 【カメラ制御 ＆ UI反映】
// ============================================================================
function resetFpvToRobotFront() { fpvYawOffset = 0; fpvPitchOffset = 0; cameraDirty = true; }

function updateAllCamerasTransform() {
  if (!activeCamera || !robotGroup) return;
  const rp = robotGroup.position;

  if (manualCameraMode === 'robot') {
    const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;
    const eyeH = Math.max(0.18, sSpec.scaleY * (ROBOT.posture === 'crawl' ? 0.45 : 0.82));
    const yaw = robotGroup.rotation.y + fpvYawOffset;
    activeCamera.position.set(rp.x, rp.y + eyeH, rp.z);
    activeCamera.lookAt(rp.x + Math.sin(yaw) * 3, rp.y + eyeH + fpvPitchOffset * 2, rp.z + Math.cos(yaw) * 3);
  } else if (manualCameraMode === 'ground') {
    const tx = 0, ty = 0.2, tz = 0;
    const d = Math.max(5.5, orbitDist);
    activeCamera.position.set(tx + Math.sin(orbitYaw) * Math.cos(orbitPitch) * d, ty + Math.sin(orbitPitch) * d, tz + Math.cos(orbitYaw) * Math.cos(orbitPitch) * d);
    activeCamera.lookAt(tx, ty, tz);
  } else if (manualCameraMode === 'ug') {
    const tx = 0, ty = -2.2, tz = 0;
    const d = Math.max(5.5, orbitDist);
    activeCamera.position.set(tx + Math.sin(orbitYaw) * Math.cos(orbitPitch) * d, ty + Math.sin(orbitPitch) * d, tz + Math.cos(orbitYaw) * Math.cos(orbitPitch) * d);
    activeCamera.lookAt(tx, ty, tz);
  } else {
    const d = Math.max(3.2, Math.min(13, orbitDist));
    activeCamera.position.set(rp.x + Math.sin(orbitYaw) * Math.cos(orbitPitch) * d, rp.y + 0.5 + Math.sin(orbitPitch) * d, rp.z + Math.cos(orbitYaw) * Math.cos(orbitPitch) * d);
    activeCamera.lookAt(rp.x, rp.y + 0.35, rp.z);
  }
}

function updateEnvironmentAndUI() {
  const st = life.getState();
  const setTxt = (id, v) => { const e = document.getElementById(id); if (e) e.innerText = v; };
  const setW = (id, v) => { const e = document.getElementById(id); if (e) e.style.width = `${v}%`; };

  setTxt('val-stamina', st.stamina); setW('bar-stamina', st.stamina);
  setTxt('val-life', st.energy);     setW('bar-life', st.energy);
  setTxt('val-mental', st.mental);   setW('bar-mental', st.mental);

  const rigIcon = ROBOT.rigType === 'stick' ? '🦴骨型' : '🎲箱型';
  setTxt('ui-robot-id', `${rigIcon}・${ROBOT.unitModel}号機`);
  setTxt('ui-days', `🌱 ${GAME_DAY}日目`);
  const timeTxt = TIME_STEP < 6 ? '☀️ 朝' : (TIME_STEP < 12 ? '🌤️ 昼' : (TIME_STEP < 15 ? '🌆 夕' : '🌙 夜'));
  setTxt('ui-time', timeTxt);

  const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const eSpec = getExpressionSpec(ROBOT.emotion);
  setTxt('ui-mood', `${eSpec.icon}${eSpec.label}(${sSpec.label}${sSpec.subH}・${bSpec.label}${bSpec.reqWidth})`);

  const camLabel = manualCameraMode === 'robot' ? '👁️内カメラ' : (manualCameraMode === 'ground' ? '🌌地上全体' : (manualCameraMode === 'ug' ? '⛏️地下全体' : `🤖追従(${getStyleShortName()})`));
  setTxt('history-loc', `${camLabel}・${formatHeightText(getRobotHeightLevel())}`);
  setTxt('ai-status', getActiveBrainBadgeText());

  if (sunLight && ambientLight) {
    const isNight = TIME_STEP >= 15;
    ambientLight.intensity = isNight ? 0.48 : 0.76;
    sunLight.intensity = isNight ? 0.38 : 0.88;
    if (starField) starField.visible = isNight || getCurrentAreaDef().id === 'sky_4' || getCurrentAreaDef().id === 'sky_5';
  }
  updateAreaAndPetUI();
  updateCamButtonHighlight();
}

function updateCamButtonHighlight() {
  const g = document.getElementById('cam-ground-btn');
  const u = document.getElementById('cam-ug-btn');
  const f = document.getElementById('cam-fpv-btn');
  if (g) g.classList.toggle('cam-active', manualCameraMode === 'ground');
  if (u) u.classList.toggle('cam-active', manualCameraMode === 'ug');
  if (f) f.classList.toggle('cam-active', manualCameraMode === 'robot');
}

// ============================================================================
// 【タッチ操作 ＆ ボタンイベント配線】
// ============================================================================
function setupTouchAndMouseControls(dom) {
  let prevX = 0, prevY = 0;
  dom.addEventListener('pointerdown', e => {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    isDragging = true; prevX = e.clientX; prevY = e.clientY;
    if (activePointers.size === 2) {
      const pts = [...activePointers.values()];
      lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  });
  dom.addEventListener('pointermove', e => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size === 2) {
      const pts = [...activePointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastPinchDist > 0) orbitDist = Math.max(3.2, Math.min(14, orbitDist - (d - lastPinchDist) * 0.02));
      lastPinchDist = d;
    } else if (isDragging) {
      const dx = e.clientX - prevX, dy = e.clientY - prevY;
      prevX = e.clientX; prevY = e.clientY;
      if (manualCameraMode === 'robot') {
        fpvYawOffset -= dx * 0.006;
        fpvPitchOffset = Math.max(-0.6, Math.min(0.6, fpvPitchOffset - dy * 0.004));
      } else {
        orbitYaw -= dx * 0.007;
        orbitPitch = Math.max(-0.45, Math.min(1.38, orbitPitch + dy * 0.006));
      }
    }
    cameraDirty = true;
  });
  const endPtr = e => { activePointers.delete(e.pointerId); if (activePointers.size < 2) lastPinchDist = 0; if (activePointers.size === 0) isDragging = false; };
  dom.addEventListener('pointerup', endPtr);
  dom.addEventListener('pointercancel', endPtr);
  dom.addEventListener('wheel', e => {
    orbitDist = Math.max(3.2, Math.min(14, orbitDist + e.deltaY * 0.005));
    cameraDirty = true;
  }, { passive: true });
}

function setupUIEventBindings() {
  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  bind('btn-action', () => executeTurn());
  bind('btn-settings', () => openModal('modal-settings'));
  bind('diary-btn', () => openModal('modal-diary'));
  bind('plus-main-btn', () => { const w = document.getElementById('fan-menu-wrapper'); if (w) w.classList.toggle('open'); });
  bind('cam-ground-btn', () => { manualCameraMode = (manualCameraMode === 'ground') ? 'follow' : 'ground'; rebuildTerrainAndItems(); updateEnvironmentAndUI(); });
  bind('cam-ug-btn', () => { manualCameraMode = (manualCameraMode === 'ug') ? 'follow' : 'ug'; rebuildTerrainAndItems(); updateEnvironmentAndUI(); });
  bind('cam-fpv-btn', () => { manualCameraMode = (manualCameraMode === 'robot') ? 'follow' : 'robot'; resetFpvToRobotFront(); updateEnvironmentAndUI(); });
  bind('btn-spin', () => {
    const pool = [
      { id: 'apple', label: '🍎 おいしいリンゴ' },
      { id: 'stone', label: '🪨 段差・パズル用の石' },
      { id: 'oil',   label: '🧴 スライムオイル' },
      { id: 'grass', label: '🌿 草ブロック' }
    ];
    const got = pool[Math.floor(Math.random() * pool.length)];
    if (BAG.length < 10) BAG.push(got.id); else WORLD_ITEMS.push({ type: got.id, x: ROBOT.pos.x, z: ROBOT.pos.z });
    const resEl = document.getElementById('gacha-result-text');
    if (resEl) resEl.innerText = `🎉「${got.label}」が出たよ！（カバンに追加）`;
    rebuildTerrainAndItems(); saveWorldState(); showToast(`🎰 ${got.label}をゲット！`);
  });
}

function loadSavedSettingsToInputs() {
  const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  setV('setting-ai-type', safeStorage.getItem('ai_type') || 'none');
  setV('setting-gemini-key', safeStorage.getItem('api_gemini') || '');
  setV('setting-groq-key', safeStorage.getItem('api_groq') || '');
  setV('setting-speed', String(ROBOT.speed || 3));
  setV('setting-size-level', ROBOT.sizeLevel);
  setV('setting-body-type', ROBOT.bodyType);
  setV('setting-cam-style', CAM_VISUAL_STYLE);
  setV('setting-obs-mode', OBS_MODE);
}

// ============================================================================
// 【毎フレームアニメーションループ（Lerp滑らか移動＆20種ポーズ）】
// ============================================================================
let animClock = 0;
function animateLoop() {
  requestAnimationFrame(animateLoop);
  animClock += 0.016;

  // 1. ロボットの滑らか移動（Lerp）＆滑らか回転
  if (robotGroup) {
    robotGroup.position.lerp(robotVisualTarget, 0.14);
    let diff = robotTargetRotY - robotGroup.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    robotGroup.rotation.y += diff * 0.16;

    // ポーズアニメーション
    const pose = POSE_TABLE[ROBOT.emotion] || POSE_TABLE.normal;
    const s = Math.sin(animClock * pose.spd);
    const { torsoPivot, headPivot, armL, armR, legL, legR } = rigParts;
    if (torsoPivot) {
      torsoPivot.position.y = 0.42 + Math.abs(s) * Math.max(0, pose.bounce) + (pose.bounce < 0 ? pose.bounce : 0);
      torsoPivot.rotation.x = (ROBOT.posture === 'crawl' ? 0.55 : pose.bodyX) + s * 0.04;
      headPivot.rotation.x = pose.headX + s * 0.05;
      armL.rotation.x = pose.shLX + s * 0.25;
      armL.rotation.z = pose.shLZ;
      armR.rotation.x = pose.shRX - s * 0.25;
      armR.rotation.z = pose.shRZ;
      legL.rotation.x = pose.hipX * 0.35 + s * 0.22;
      legR.rotation.x = pose.hipX * 0.35 - s * 0.22;
    }
  }

  // 2. 追従ペットの滑らか移動（電車ごっこLerp）
  if (petGroup && petGroup.visible) {
    petGroup.position.lerp(petVisualTarget, 0.10);
    petGroup.position.y = petVisualTarget.y + Math.abs(Math.sin(animClock * 5.2)) * 0.08;
    petGroup.rotation.y = robotGroup ? robotGroup.rotation.y : 0;
  }

  // 3. ワープ装置・パズル・住人/敵の軽いゆらぎ演出
  portalsGroup.children.forEach(obj => {
    if (obj.userData.spin) obj.rotation.y += 0.025;
    obj.children.forEach(ch => { if (ch.userData.spin) ch.rotation.z += 0.03; });
  });
  entitiesGroup.children.forEach((g, idx) => {
    if (g.userData.bob) g.position.y = (g.userData.baseY ?? 0) + Math.sin(animClock * 3 + idx) * 0.05;
  });

  updateAllCamerasTransform();
  renderer.render(scene, activeCamera);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThreeWorld);
} else {
  initThreeWorld();
}
