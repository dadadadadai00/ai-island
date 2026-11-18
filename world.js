// ============================================================================
// 【コア③後半：Three.js 3D空間・海・滝・亀・星座・観察窓カメラ制御】
// ============================================================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1528);

const aspect = window.innerWidth / window.innerHeight;
const outerGroundCam = new THREE.PerspectiveCamera(42, aspect, 0.1, 180);
const outerUnderCam  = new THREE.PerspectiveCamera(42, aspect, 0.1, 180);
const followCam      = new THREE.PerspectiveCamera(42, aspect, 0.1, 180);
const innerRobotCam  = new THREE.PerspectiveCamera(102, aspect, 0.04, 180);

let activeCamera = followCam;
let manualCameraMode = null;
let fpvYawOffset = 0, fpvPitch = -0.06, fpvZoomFactor = 1.0;

// 🛡️ ワープ防止（Lerp補間）用の現在描画座標
let currentVisualPos = new THREE.Vector3(0, 0, 0);
let visualPosInitialized = false;

function resetFpvToRobotFront() {
  fpvYawOffset = 0;
  fpvPitch = (ROBOT.posture === 'crawl') ? -0.03 : -0.06;
  fpvZoomFactor = 1.0;
}

function getCamPhiLimits(mode) {
  if (mode === 'ground') return { min: 0.30, max: 1.38 };
  if (mode === 'underground') return { min: 1.05, max: 2.05 };
  return { min: 0.22, max: 1.62 };
}

function clampCamPhiForCurrentMode() {
  if (manualCameraMode === 'robot') {
    fpvPitch = Math.max(-1.35, Math.min(1.48, fpvPitch));
  } else {
    const lim = getCamPhiLimits(manualCameraMode);
    camPhi = Math.max(lim.min, Math.min(lim.max, camPhi));
  }
}

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const dirLight = new THREE.DirectionalLight(0xfffbeb, 0.85);
dirLight.position.set(8, 16, 10);
scene.add(dirLight);
const underLight = new THREE.DirectionalLight(0xbae6fd, 0.52);
underLight.position.set(-5, -14, -5);
scene.add(underLight);

const subCubeGeo = new THREE.BoxGeometry(0.2025, 0.2025, 0.2025);
const fullCubeEdgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));

const subEdgeCanvas = document.createElement('canvas');
subEdgeCanvas.width = 64; subEdgeCanvas.height = 64;
const seCtx = subEdgeCanvas.getContext('2d');
seCtx.fillStyle = '#ffffff'; seCtx.fillRect(0, 0, 64, 64);
seCtx.strokeStyle = 'rgba(15, 23, 42, 0.42)'; seCtx.lineWidth = 6;
seCtx.strokeRect(2, 2, 60, 60);
const subEdgeTex = new THREE.CanvasTexture(subEdgeCanvas);

const MAX_SUB_INSTANCES = 22000;
const opaqueSubMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
const opaqueSubMesh = new THREE.InstancedMesh(subCubeGeo, opaqueSubMat, MAX_SUB_INSTANCES);
opaqueSubMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
opaqueSubMesh.renderOrder = 0;
scene.add(opaqueSubMesh);

const glassDepthMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthTest: true });
const glassDepthMesh = new THREE.InstancedMesh(subCubeGeo, glassDepthMat, MAX_SUB_INSTANCES);
glassDepthMesh.renderOrder = 9;
scene.add(glassDepthMesh);

const glassSubMat = new THREE.MeshLambertMaterial({
  color: 0xffffff, transparent: true, opacity: 0.20, depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth
});
const glassSubMesh = new THREE.InstancedMesh(subCubeGeo, glassSubMat, MAX_SUB_INSTANCES);
glassSubMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
glassSubMesh.renderOrder = 10;
glassDepthMesh.instanceMatrix = glassSubMesh.instanceMatrix;
scene.add(glassSubMesh);

const macroOutlineGroup = new THREE.Group();
scene.add(macroOutlineGroup);
const macroOutlineMat = new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.55 });

const itemGroup = new THREE.Group();
scene.add(itemGroup);

const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const tempColor = new THREE.Color();
let subVoxelsMeta = [];

function rebuildTerrainAndItems() {
  while (macroOutlineGroup.children.length) macroOutlineGroup.remove(macroOutlineGroup.children[0]);
  while (itemGroup.children.length) itemGroup.remove(itemGroup.children[0]);
  subVoxelsMeta = [];

  const showLines = (CAM_VISUAL_STYLE === 'glass_line');
  opaqueSubMat.map = showLines ? subEdgeTex : null;
  opaqueSubMat.needsUpdate = true;
  glassSubMat.map = showLines ? subEdgeTex : null;
  glassSubMat.depthFunc = showLines ? THREE.LessDepth : THREE.LessEqualDepth;
  glassSubMat.opacity = showLines ? 0.18 : 0.22;
  glassSubMat.needsUpdate = true;

  let subIdx = 0;
  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      const topLv = HEIGHT_MAP[`${x},${z}`] ?? 0;
      for (let lv = AREA1_MIN_UNDER_LV; lv <= topLv; lv++) {
        const centerY = lv * 1.0 - 0.5;
        const chippedSet = CHIP_MAP[`${x},${z},${lv}`] || null;
        const isChipped = Boolean(chippedSet && Object.keys(chippedSet).length > 0);

        if (showLines) {
          const wire = new THREE.LineSegments(fullCubeEdgeGeo, macroOutlineMat);
          wire.position.set(x, centerY, z);
          macroOutlineGroup.add(wire);
        }

        for (let sy = 0; sy < 5; sy++) {
          const layerColorHex = getSubVoxelColorHex(lv, sy);
          for (let sx = 0; sx < 5; sx++) {
            for (let sz = 0; sz < 5; sz++) {
              if (isChipped && chippedSet[`${sx},${sy},${sz}`]) continue;
              if (!isExposedSubVoxel(x, z, lv, sx, sy, sz)) continue;
              if (subIdx >= MAX_SUB_INSTANCES) break;

              const wx = x + (sx - 2) * 0.20;
              const wy = (lv - 1) * 1.0 + sy * 0.20 + 0.10;
              const wz = z + (sz - 2) * 0.20;

              const isCavityWall = isChipped && (sy < 4) && isAdjacentToCarvedCavity(chippedSet, sx, sy, sz);
              const useChecker = showLines || isCavityWall;
              const shade = useChecker ? (((sx + sy + sz) % 2 === 0) ? 1.0 : 0.93) : 1.0;

              tempColor.setHex(layerColorHex).multiplyScalar(shade);
              opaqueSubMesh.setColorAt(subIdx, tempColor);
              glassSubMesh.setColorAt(subIdx, tempColor);

              const fullMat = new THREE.Matrix4();
              if (showLines) {
                fullMat.compose(new THREE.Vector3(wx, wy, wz), new THREE.Quaternion(), new THREE.Vector3(0.93, 0.93, 0.93));
              } else {
                fullMat.makeTranslation(wx, wy, wz);
              }

              const isWaterWall = isWaterFacingOuterSubVoxel(x, z, lv, sx, sy, sz);
              subVoxelsMeta.push({ idx: subIdx, gx: x, gz: z, sx, sy, sz, wx, wy, wz, lv, isChipped, isWaterWall, fullMat, visState: -1 });
              subIdx++;
            }
          }
        }
      }
    }
  }

  opaqueSubMesh.count = subIdx;
  glassDepthMesh.count = subIdx;
  glassSubMesh.count = subIdx;
  if (opaqueSubMesh.instanceColor) opaqueSubMesh.instanceColor.needsUpdate = true;
  if (glassSubMesh.instanceColor) glassSubMesh.instanceColor.needsUpdate = true;

  WORLD_ITEMS.forEach(it => {
    const topY = getSurfaceYAt(it.x, it.z, null, 3);
    let mesh;
    if (it.type === 'apple') {
      mesh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.40, 0.42), new THREE.MeshLambertMaterial({ color: 0xf87171 }));
      body.position.y = 0.20;
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.12, 0.10), new THREE.MeshLambertMaterial({ color: 0x4ade80 }));
      stem.position.y = 0.44;
      mesh.add(body); mesh.add(stem);
    } else if (it.type === 'stone') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.35, 0.42), new THREE.MeshLambertMaterial({ color: 0x94a3b8 }));
      mesh.position.y = 0.18;
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.45, 0.32), new THREE.MeshLambertMaterial({ color: 0x34d399 }));
      mesh.position.y = 0.22;
    }
    mesh.position.set(it.x, topY, it.z);
    itemGroup.add(mesh);
  });
}

const seaCanvas = document.createElement('canvas');
seaCanvas.width = 256; seaCanvas.height = 256;
const sCtx = seaCanvas.getContext('2d');
const radGrad = sCtx.createRadialGradient(128, 128, 40, 128, 128, 128);
radGrad.addColorStop(0.0, 'rgba(125,211,252,0.95)');
radGrad.addColorStop(0.65, 'rgba(56,189,248,0.92)');
radGrad.addColorStop(0.90, 'rgba(186,230,253,0.96)');
radGrad.addColorStop(1.0, 'rgba(255,255,255,1.0)');
sCtx.fillStyle = radGrad; sCtx.fillRect(0, 0, 256, 256);
sCtx.fillStyle = 'rgba(255,255,255,0.72)';
for (let i = 0; i < 55; i++) {
  const ang = (i / 55) * Math.PI * 2 + (i % 3) * 0.4, dist = 76 + (i * 17 % 48);
  sCtx.beginPath(); sCtx.arc(128 + Math.cos(ang) * dist, 128 + Math.sin(ang) * dist, 2 + (i % 4) * 1.3, 0, Math.PI * 2); sCtx.fill();
}
sCtx.clearRect(65, 65, 126, 126);
sCtx.strokeStyle = '#d4a373';
sCtx.lineWidth = 5;
sCtx.strokeRect(65, 65, 126, 126);

const seaGeo = new THREE.CircleGeometry(5.1, 48); seaGeo.rotateX(-Math.PI / 2);
const seaMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(seaCanvas), transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
const seaMesh = new THREE.Mesh(seaGeo, seaMat);
seaMesh.position.y = WATER_SURFACE_Y;
scene.add(seaMesh);

const wfCanvas = document.createElement('canvas');
wfCanvas.width = 256; wfCanvas.height = 256;
const wfCtx = wfCanvas.getContext('2d');
wfCtx.fillStyle = '#58c4f6'; wfCtx.fillRect(0, 0, 256, 256);
for (let i = 0; i < 36; i++) {
  const x = (i * 7) % 256, y = (i * 37) % 256, w = 3 + (i % 3) * 2, h = 45 + (i % 4) * 22;
  wfCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(224,242,254,0.45)';
  wfCtx.fillRect(x, y, w, h); if (y + h > 256) wfCtx.fillRect(x, y - 256, w, h);
}
wfCtx.fillStyle = 'rgba(255,255,255,0.82)';
for (let i = 0; i < 28; i++) {
  wfCtx.beginPath(); wfCtx.ellipse((i * 29 + 11) % 240 + 8, (i * 43 + 7) % 240 + 8, 6 + (i % 4) * 3, 2.5 + (i % 2) * 1.5, 0, 0, Math.PI * 2); wfCtx.fill();
}
const wfTex = new THREE.CanvasTexture(wfCanvas);
wfTex.wrapS = THREE.RepeatWrapping; wfTex.wrapT = THREE.RepeatWrapping; wfTex.repeat.set(3, 1.5);
const waterfallMat = new THREE.MeshBasicMaterial({ map: wfTex, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false });
const waterfallMesh = new THREE.Mesh(new THREE.CylinderGeometry(5.1, 5.2, 7.45, 48, 1, true), waterfallMat);
waterfallMesh.position.y = -4.125;
scene.add(waterfallMesh);

const foamRingGeo = new THREE.RingGeometry(3.8, 6.3, 48); foamRingGeo.rotateX(-Math.PI / 2);
const foamRingMesh = new THREE.Mesh(foamRingGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
foamRingMesh.position.y = -7.85; scene.add(foamRingMesh);

const mistGeo = new THREE.CircleGeometry(14, 36); mistGeo.rotateX(-Math.PI / 2);
const mistMesh = new THREE.Mesh(mistGeo, new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.78, side: THREE.DoubleSide }));
mistMesh.position.y = -7.95; scene.add(mistMesh);

const turtleGroup = new THREE.Group();
const sMain = new THREE.MeshLambertMaterial({ color: 0xd6bfa3 }), sDark = new THREE.MeshLambertMaterial({ color: 0xb89f80 }), sAcc = new THREE.MeshLambertMaterial({ color: 0xe7d8c5 });
turtleGroup.add(new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.4, 7.4), sMain));
const shMid = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.1, 5.8), sDark); shMid.position.y = 1.1; turtleGroup.add(shMid);
const shTop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 4.0), sAcc); shTop.position.y = 1.9; turtleGroup.add(shTop);
const tHead = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 2.0), sMain); tHead.position.set(0, 0.2, 4.4); turtleGroup.add(tHead);
[[3.8,-0.2,2.4,0.3],[-3.8,-0.2,2.4,-0.3],[3.6,-0.2,-2.4,-0.2],[-3.6,-0.2,-2.4,0.2]].forEach(fc => {
  const fl = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 1.5), sDark); fl.position.set(fc[0], fc[1], fc[2]); fl.rotation.y = fc[3]; turtleGroup.add(fl);
});
turtleGroup.position.y = -10.4; scene.add(turtleGroup);

const skyGroup = new THREE.Group(); scene.add(skyGroup);
const starGeo = new THREE.BufferGeometry(), starPos = [];
for (let i = 0; i < 420; i++) {
  const theta = Math.random() * 2 * Math.PI, phi = Math.acos(2 * Math.random() - 1), r = 46;
  starPos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.45, transparent: true, opacity: 0.75 });
skyGroup.add(new THREE.Points(starGeo, starMat));

function addConstellation(name, pts, labelPos) {
  const pGeo = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  skyGroup.add(new THREE.Line(pGeo, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 })));
  skyGroup.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xfde047, size: 0.85 })));
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(15,23,42,0.78)'; ctx.strokeStyle = 'rgba(125,211,252,0.85)'; ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, 240, 48); ctx.fillRect(8, 8, 240, 48);
  ctx.fillStyle = '#bae6fd'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name, 128, 32);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.9 }));
  sp.scale.set(6.5, 1.65, 1); sp.position.set(labelPos[0], labelPos[1], labelPos[2]); skyGroup.add(sp);
}
addConstellation('🦢 はくちょう座', [[0,24,-22],[0,18,-26],[0,11,-30],[-7,18,-26],[7,18,-26]], [0,8,-30]);
addConstellation('👑 カシオペア座', [[-26,18,0],[-24,14,5],[-26,16,10],[-24,13,15],[-26,17,20]], [-26,9,10]);
addConstellation('🥄 北斗七星', [[26,20,-8],[26,17,-3],[25,15,2],[24,12,6],[24,8,10],[27,7,14],[27,11,11]], [26,4,5]);
addConstellation('🏹 オリオン座', [[-5,20,26],[5,20,26],[-2,14,28],[0,14,28],[2,14,28],[-5,8,26],[5,8,26]], [0,4,28]);

// ============================================================================
// 【コア②：キャラ骨格コア（🎲サイコロ箱型 ＆ 🦴◯と線のマッチ棒3Dデッサン骨格）】
// ============================================================================
const robotGroup = new THREE.Group();
const robotPoseGroup = new THREE.Group();
robotGroup.add(robotPoseGroup);
scene.add(robotGroup);

const matMainBlue   = new THREE.MeshLambertMaterial({ color: 0x38bdf8 });
const matLightBlue  = new THREE.MeshLambertMaterial({ color: 0xbae6fd });
const matDarkLimb   = new THREE.MeshLambertMaterial({ color: 0x0f172a });
const matStickJoint = new THREE.MeshLambertMaterial({ color: 0xfef08a });
const matStickBone  = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
const matStickFrame = new THREE.MeshLambertMaterial({ color: 0x7dd3fc });
const sharedBulbMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

// A. 🎲 サイコロ箱型モデル（boxRigGroup）
const boxRigGroup = new THREE.Group();
robotPoseGroup.add(boxRigGroup);

const boxBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.32), matMainBlue);
boxBody.position.y = 0.34;
boxRigGroup.add(boxBody);

const boxHeadPivot = new THREE.Group();
boxHeadPivot.position.set(0, 0.56, 0);
boxRigGroup.add(boxHeadPivot);

const boxHead = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.36, 0.36), matLightBlue);
boxHead.position.y = 0.18;
boxHeadPivot.add(boxHead);

const boxEyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.05), matDarkLimb);
boxEyeL.position.set(-0.09, 0.19, 0.18);
boxHeadPivot.add(boxEyeL);

const boxEyeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.05), matDarkLimb);
boxEyeR.position.set(0.09, 0.19, 0.18);
boxHeadPivot.add(boxEyeR);

const boxBulb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), sharedBulbMat);
boxBulb.position.y = 0.42;
boxHeadPivot.add(boxBulb);

const boxArmLPivot = new THREE.Group();
boxArmLPivot.position.set(-0.27, 0.50, 0);
const boxArmL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.32, 0.12), matDarkLimb);
boxArmL.position.y = -0.15;
boxArmLPivot.add(boxArmL);
boxRigGroup.add(boxArmLPivot);

const boxArmRPivot = new THREE.Group();
boxArmRPivot.position.set(0.27, 0.50, 0);
const boxArmR = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.32, 0.12), matDarkLimb);
boxArmR.position.y = -0.15;
boxArmRPivot.add(boxArmR);
boxRigGroup.add(boxArmRPivot);

const boxTool = new THREE.Group();
const boxToolBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.04), new THREE.MeshLambertMaterial({ color: 0xd4a373 }));
boxToolBar.position.set(0, -0.26, 0.12);
boxToolBar.rotation.x = Math.PI / 2.5;
const boxToolHead = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.05, 0.05), new THREE.MeshLambertMaterial({ color: 0x94a3b8 }));
boxToolHead.position.set(0, -0.26, 0.24);
boxTool.add(boxToolBar); boxTool.add(boxToolHead);
boxTool.visible = false;
boxArmRPivot.add(boxTool);

const boxLegLPivot = new THREE.Group();
boxLegLPivot.position.set(-0.11, 0.15, 0);
const boxLegL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.14), matDarkLimb);
boxLegL.position.y = -0.07;
boxLegLPivot.add(boxLegL);
boxRigGroup.add(boxLegLPivot);

const boxLegRPivot = new THREE.Group();
boxLegRPivot.position.set(0.11, 0.15, 0);
const boxLegR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.14), matDarkLimb);
boxLegR.position.y = -0.07;
boxLegRPivot.add(boxLegR);
boxRigGroup.add(boxLegRPivot);

// B. 🦴 3D骨組みモデル（stickRigGroup）
const stickRigGroup = new THREE.Group();
robotPoseGroup.add(stickRigGroup);
const SB = {};

function makeSphereJoint(r = 0.042) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), matStickJoint);
}
function makeStickRod(len = 0.16, r = 0.022) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), matStickBone);
  m.position.y = -len / 2;
  return m;
}

SB.pelvis = new THREE.Group();
SB.pelvis.position.set(0, 0.38, 0);
stickRigGroup.add(SB.pelvis);
SB.pelvis.add(makeSphereJoint(0.048));
const pelvisBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 8), matStickFrame);
pelvisBar.rotation.z = Math.PI / 2;
SB.pelvis.add(pelvisBar);

SB.chest = new THREE.Group();
SB.chest.position.set(0, 0.0, 0);
SB.pelvis.add(SB.chest);
const spineRod = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.020, 0.26, 8), matStickBone);
spineRod.position.y = 0.13;
SB.chest.add(spineRod);
const ribCage = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.20, 10), matStickFrame);
ribCage.scale.set(1.0, 1.0, 0.62);
ribCage.position.y = 0.15;
SB.chest.add(ribCage);
const chestJoint = makeSphereJoint(0.042);
chestJoint.position.y = 0.15;
SB.chest.add(chestJoint);
const clavicleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.38, 8), matStickBone);
clavicleBar.rotation.z = Math.PI / 2;
clavicleBar.position.y = 0.25;
SB.chest.add(clavicleBar);

SB.neck = new THREE.Group();
SB.neck.position.set(0, 0.26, 0);
SB.chest.add(SB.neck);
SB.neck.add(makeSphereJoint(0.036));
const neckRod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8), matStickBone);
neckRod.position.y = 0.03;
SB.neck.add(neckRod);

SB.head = new THREE.Group();
SB.head.position.set(0, 0.06, 0);
SB.neck.add(SB.head);
const stickHeadMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), matStickBone);
stickHeadMesh.scale.set(0.88, 1.12, 0.92);
stickHeadMesh.position.y = 0.14;
SB.head.add(stickHeadMesh);
const faceCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.24, 0.02), matDarkLimb);
faceCrossV.position.set(0, 0.14, 0.125);
SB.head.add(faceCrossV);
const faceCrossH = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.018, 0.02), matDarkLimb);
faceCrossH.position.set(0, 0.15, 0.125);
SB.head.add(faceCrossH);
const stickBulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), sharedBulbMat);
stickBulb.position.y = 0.33;
SB.head.add(stickBulb);

SB.shoulderL = new THREE.Group();
SB.shoulderL.position.set(-0.19, 0.25, 0);
SB.chest.add(SB.shoulderL);
SB.shoulderL.add(makeSphereJoint(0.044));
SB.shoulderL.add(makeStickRod(0.16, 0.022));

SB.elbowL = new THREE.Group();
SB.elbowL.position.set(0, -0.16, 0);
SB.shoulderL.add(SB.elbowL);
SB.elbowL.add(makeSphereJoint(0.038));
SB.elbowL.add(makeStickRod(0.15, 0.020));

SB.wristL = new THREE.Group();
SB.wristL.position.set(0, -0.15, 0);
SB.elbowL.add(SB.wristL);
SB.wristL.add(makeSphereJoint(0.034));
const palmL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.07), matStickFrame);
palmL.position.y = -0.04;
SB.wristL.add(palmL);

SB.shoulderR = new THREE.Group();
SB.shoulderR.position.set(0.19, 0.25, 0);
SB.chest.add(SB.shoulderR);
SB.shoulderR.add(makeSphereJoint(0.044));
SB.shoulderR.add(makeStickRod(0.16, 0.022));

SB.elbowR = new THREE.Group();
SB.elbowR.position.set(0, -0.16, 0);
SB.shoulderR.add(SB.elbowR);
SB.elbowR.add(makeSphereJoint(0.038));
SB.elbowR.add(makeStickRod(0.15, 0.020));

SB.wristR = new THREE.Group();
SB.wristR.position.set(0, -0.15, 0);
SB.elbowR.add(SB.wristR);
SB.wristR.add(makeSphereJoint(0.034));
const palmR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.07), matStickFrame);
palmR.position.y = -0.04;
SB.wristR.add(palmR);

const stickTool = new THREE.Group();
const sToolBar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), new THREE.MeshLambertMaterial({ color: 0xd4a373 }));
sToolBar.position.set(0, -0.04, 0.14);
sToolBar.rotation.x = Math.PI / 2.2;
const sToolHead = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.05), new THREE.MeshLambertMaterial({ color: 0x94a3b8 }));
sToolHead.position.set(0, -0.04, 0.28);
stickTool.add(sToolBar); stickTool.add(sToolHead);
stickTool.visible = false;
SB.wristR.add(stickTool);

SB.hipL = new THREE.Group();
SB.hipL.position.set(-0.11, -0.02, 0);
SB.pelvis.add(SB.hipL);
SB.hipL.add(makeSphereJoint(0.044));
SB.hipL.add(makeStickRod(0.17, 0.025));

SB.kneeL = new THREE.Group();
SB.kneeL.position.set(0, -0.17, 0);
SB.hipL.add(SB.kneeL);
SB.kneeL.add(makeSphereJoint(0.040));
SB.kneeL.add(makeStickRod(0.16, 0.022));

SB.ankleL = new THREE.Group();
SB.ankleL.position.set(0, -0.16, 0);
SB.kneeL.add(SB.ankleL);
SB.ankleL.add(makeSphereJoint(0.034));
const stickFootL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.15), matStickFrame);
stickFootL.position.set(0, -0.02, 0.03);
SB.ankleL.add(stickFootL);

SB.hipR = new THREE.Group();
SB.hipR.position.set(0.11, -0.02, 0);
SB.pelvis.add(SB.hipR);
SB.hipR.add(makeSphereJoint(0.044));
SB.hipR.add(makeStickRod(0.17, 0.025));

SB.kneeR = new THREE.Group();
SB.kneeR.position.set(0, -0.17, 0);
SB.hipR.add(SB.kneeR);
SB.kneeR.add(makeSphereJoint(0.040));
SB.kneeR.add(makeStickRod(0.16, 0.022));

SB.ankleR = new THREE.Group();
SB.ankleR.position.set(0, -0.16, 0);
SB.kneeR.add(SB.ankleR);
SB.ankleR.add(makeSphereJoint(0.034));
const stickFootR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.15), matStickFrame);
stickFootR.position.set(0, -0.02, 0.03);
SB.ankleR.add(stickFootR);

// 🛡️ ワープ防止：instant === true（初回起動・リセット・世代交代）の時だけ瞬間配置し、通常移動はLerpで滑らかに動かす
function syncRobot3DPosition(instant = false) {
  const gx = ROBOT.pos.x, gz = ROBOT.pos.z;
  const subX = ((ROBOT.pos.sx ?? 2) - 2) * 0.20, subZ = ((ROBOT.pos.sz ?? 2) - 2) * 0.20;
  const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const baseY = getSurfaceYAt(gx, gz, ROBOT.pos.lv, bSpec.reqWidth);
  const targetX = gx + subX;
  const targetZ = gz + subZ;

  if (instant || !visualPosInitialized) {
    currentVisualPos.set(targetX, baseY, targetZ);
    robotGroup.position.copy(currentVisualPos);
    robotGroup.rotation.y = ROBOT.rotY || 0;
    visualPosInitialized = true;
  }

  const isStick = (ROBOT.rigType === 'stick');
  stickRigGroup.visible = isStick;
  boxRigGroup.visible = !isStick;

  robotPoseGroup.scale.set(
    bSpec.scaleX,
    sSpec.scaleY,
    bSpec.scaleZ
  );

  if (ROBOT.posture === 'crawl') {
    robotPoseGroup.rotation.x = Math.PI / 2;
    robotPoseGroup.position.set(0, 0.18 * sSpec.scaleY, -0.35 * sSpec.scaleY);
  } else {
    robotPoseGroup.rotation.x = 0;
    robotPoseGroup.position.set(0, 0, 0);
  }

  if (typeof applyRobotBulbColor === 'function') {
    applyRobotBulbColor();
  } else {
    const eSpec = getExpressionSpec(ROBOT.emotion);
    sharedBulbMat.color.setHex(eSpec.bulb);
  }
}

function updateRobotUnifiedAnimation(t) {
  // 🪜 Lerp（線形補間）による段差上り下り・落下の滑らか移動処理（ワープ防止）
  const gx = ROBOT.pos.x, gz = ROBOT.pos.z;
  const subX = ((ROBOT.pos.sx ?? 2) - 2) * 0.20, subZ = ((ROBOT.pos.sz ?? 2) - 2) * 0.20;
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const targetY = getSurfaceYAt(gx, gz, ROBOT.pos.lv, bSpec.reqWidth);
  const targetX = gx + subX;
  const targetZ = gz + subZ;

  if (!visualPosInitialized) {
    currentVisualPos.set(targetX, targetY, targetZ);
    visualPosInitialized = true;
  } else {
    const dist = Math.abs(targetX - currentVisualPos.x) + Math.abs(targetY - currentVisualPos.y) + Math.abs(targetZ - currentVisualPos.z);
    currentVisualPos.x += (targetX - currentVisualPos.x) * 0.14;
    currentVisualPos.y += (targetY - currentVisualPos.y) * 0.14;
    currentVisualPos.z += (targetZ - currentVisualPos.z) * 0.14;
    if (dist > 0.002) cameraDirty = true;
  }
  robotGroup.position.copy(currentVisualPos);

  // 回転の最短距離Lerp補間
  let targetRotY = ROBOT.rotY || 0;
  let diffRot = targetRotY - robotGroup.rotation.y;
  while (diffRot > Math.PI) diffRot -= Math.PI * 2;
  while (diffRot < -Math.PI) diffRot += Math.PI * 2;
  robotGroup.rotation.y += diffRot * 0.18;

  const emoKey = POSE_TABLE[ROBOT.emotion] ? ROBOT.emotion : 'normal';
  const p = POSE_TABLE[emoKey];
  const eSpec = getExpressionSpec(emoKey);
  const effP = getEffectiveParams();
  const powFactor = 0.75 + (effP.power / 100) * 0.52;
  const phase = t * p.spd;
  const wave = Math.sin(phase);
  const cosW = Math.cos(phase);
  const absW = Math.abs(wave);

  let dy = 0, bodyRotY = 0, bodyRotZ = 0, headRotY = 0, headRotZ = 0;
  let armLDX = 0, armRDX = 0, armRDZ = 0, elRDX = 0, legLDX = 0, legRDX = 0;

  if (p.mode === 'jump') {
    dy = absW * p.bounce * powFactor;
    bodyRotY = Math.sin(phase * 0.5) * 0.18;
    armLDX = wave * 0.25 * powFactor; armRDX = -wave * 0.25 * powFactor;
    legLDX = wave * 0.30; legRDX = -wave * 0.30;
  } else if (p.mode === 'stomp') {
    dy = absW * p.bounce * powFactor;
    bodyRotZ = wave * 0.08 * powFactor;
    armLDX = wave * 0.55 * powFactor; armRDX = -wave * 0.55 * powFactor;
    legLDX = Math.max(0, wave) * p.hipX * powFactor; legRDX = Math.max(0, -wave) * p.hipX * powFactor;
  } else if (p.mode === 'dance') {
    dy = absW * p.bounce;
    bodyRotZ = wave * 0.14; bodyRotY = Math.sin(phase * 0.5) * 0.25;
    headRotZ = -wave * 0.18;
    armLDX = wave * 0.35; armRDX = -wave * 0.35;
  } else if (p.mode === 'tremor') {
    dy = p.bounce;
    bodyRotZ = wave * 0.04; headRotY = wave * 0.12;
  } else if (p.mode === 'fan') {
    dy = p.bounce;
    elRDX = wave * 0.50; armRDX = wave * 0.35;
  } else if (p.mode === 'think') {
    headRotZ = wave * 0.22;
  } else if (p.mode === 'wave') {
    armRDZ = wave * 0.40; elRDX = wave * 0.30;
  } else if (p.mode === 'sleep' || p.mode === 'sit') {
    dy = p.bounce;
    headRotZ = wave * 0.08;
  } else if (p.mode === 'swing_v') {
    bodyRotY = wave * 0.20 * powFactor;
    armRDX = wave * 1.25 * powFactor; elRDX = Math.max(0, wave) * 0.65;
  } else if (p.mode === 'swing_h') {
    bodyRotY = wave * 0.45 * powFactor;
    armRDZ = wave * 0.75 * powFactor; armLDX = -wave * 0.35;
  } else if (p.mode === 'pickup') {
    const r = (wave + 1) * 0.5;
    dy = p.bounce * r;
    armLDX = p.shLX * r; armRDX = p.shRX * r;
  } else if (p.mode === 'carry') {
    dy = p.bounce + absW * 0.04;
    legLDX = wave * 0.40; legRDX = -wave * 0.40;
  } else if (p.mode === 'push') {
    armLDX = wave * 0.45 * powFactor; armRDX = -wave * 0.45 * powFactor;
    legLDX = wave * 0.35; legRDX = -wave * 0.35;
  } else if (p.mode === 'run') {
    dy = absW * p.bounce;
    armLDX = wave * 0.95; armRDX = -wave * 0.95;
    legLDX = -wave * 0.95; legRDX = wave * 0.95;
  } else if (p.mode === 'peek') {
    headRotY = wave * 0.45; bodyRotY = wave * 0.20;
  } else if (p.mode === 'struggle') {
    dy = absW * p.bounce * powFactor;
    bodyRotY = Math.sin(phase * 0.7) * 0.35;
    bodyRotZ = cosW * 0.16;
    headRotZ = wave * 0.28;
    armLDX = wave * 0.95 * powFactor; armRDX = cosW * 0.95 * powFactor;
    legLDX = cosW * 0.85; legRDX = -wave * 0.85;
  } else {
    dy = absW * p.bounce;
    armLDX = wave * 0.06; armRDX = -wave * 0.06;
  }

  if (ROBOT.rigType !== 'stick') {
    boxTool.visible = Boolean(eSpec.tool);
    boxRigGroup.position.set(0, Math.max(-0.09, dy), 0);
    boxRigGroup.rotation.set(p.bodyX * 0.5, bodyRotY, bodyRotZ);
    boxHeadPivot.rotation.set(ROBOT.posture === 'crawl' ? -Math.PI / 3 : p.headX, headRotY, headRotZ);
    boxArmLPivot.rotation.set(p.shLX + armLDX, 0, p.shLZ);
    boxArmRPivot.rotation.set(p.shRX + armRDX, 0, p.shRZ + armRDZ);
    boxLegLPivot.rotation.set(p.mode === 'stomp' ? legLDX : (p.hipX * 0.7 + legLDX), 0, 0);
    boxLegRPivot.rotation.set(p.mode === 'stomp' ? legRDX : (p.hipX * 0.7 + legRDX), 0, 0);
    return;
  }

  stickTool.visible = Boolean(eSpec.tool);
  if (ROBOT.posture === 'crawl') {
    const cw = Math.sin(t * 7);
    SB.pelvis.position.set(0, 0.38 + cw * 0.02, 0);
    SB.pelvis.rotation.set(0, 0, 0);
    SB.chest.rotation.set(0, cw * 0.12, 0);
    SB.head.rotation.set(-Math.PI / 2.8, 0, 0);
    SB.shoulderL.rotation.set(-2.1 + cw * 0.4, 0, 0.15); SB.elbowL.rotation.set(-0.65, 0, 0);
    SB.shoulderR.rotation.set(-2.1 - cw * 0.4, 0, -0.15); SB.elbowR.rotation.set(-0.65, 0, 0);
    SB.hipL.rotation.set(-0.4 - cw * 0.35, 0, 0); SB.kneeL.rotation.set(0.75, 0, 0);
    SB.hipR.rotation.set(-0.4 + cw * 0.35, 0, 0); SB.kneeR.rotation.set(0.75, 0, 0);
    return;
  }

  SB.pelvis.position.set(0, 0.38 + dy, 0);
  SB.pelvis.rotation.set(0, bodyRotY * 0.4, bodyRotZ * 0.5);
  SB.chest.rotation.set(p.bodyX, bodyRotY * 0.6, bodyRotZ * 0.5);
  SB.neck.rotation.set(p.headX * 0.4, 0, 0);
  SB.head.rotation.set(p.headX * 0.6, headRotY, headRotZ);

  SB.shoulderL.rotation.set(p.shLX + armLDX, 0, p.shLZ);
  SB.elbowL.rotation.set(p.elLX, 0, 0);
  SB.wristL.rotation.set(0, 0, 0);

  SB.shoulderR.rotation.set(p.shRX + armRDX, 0, p.shRZ + armRDZ);
  SB.elbowR.rotation.set(p.elRX + elRDX, 0, 0);
  SB.wristR.rotation.set(0, 0, armRDZ * 0.5);

  const hL = (p.mode === 'stomp') ? legLDX : (p.hipX + legLDX);
  const hR = (p.mode === 'stomp') ? legRDX : (p.hipX + legRDX);
  const kL = (p.mode === 'stomp') ? (-legLDX * 1.4) : (p.kneeX + Math.max(0, -legLDX));
  const kR = (p.mode === 'stomp') ? (-legRDX * 1.4) : (p.kneeX + Math.max(0, -legRDX));

  SB.hipL.rotation.set(hL, 0, 0);
  SB.kneeL.rotation.set(kL, 0, 0);
  SB.ankleL.rotation.set(-kL * 0.35, 0, 0);

  SB.hipR.rotation.set(hR, 0, 0);
  SB.kneeR.rotation.set(kR, 0, 0);
  SB.ankleR.rotation.set(-kR * 0.35, 0, 0);
}

let camTheta = Math.PI / 4, camPhi = 0.95, camRadius = 9.8, isDragging = false, prevPointer = { x: 0, y: 0 }, cameraDirty = true;
let activePointers = new Map();
let prevPinchDist = null;
let lastAppliedFrostedState = null;

function syncCameraButtonsUI() {
  document.getElementById('cam-ground-btn').classList.toggle('cam-active', manualCameraMode === 'ground');
  document.getElementById('cam-ug-btn').classList.toggle('cam-active', manualCameraMode === 'underground');
  document.getElementById('cam-fpv-btn').classList.toggle('cam-active', manualCameraMode === 'robot');
}

function applyVoxelVisState(sv, newState, useFrostedGlass) {
  if (sv.visState === newState && lastAppliedFrostedState === useFrostedGlass) return false;
  sv.visState = newState;
  if (newState === 0) {
    opaqueSubMesh.setMatrixAt(sv.idx, sv.fullMat);
    if (useFrostedGlass) glassSubMesh.setMatrixAt(sv.idx, zeroMatrix);
  } else {
    opaqueSubMesh.setMatrixAt(sv.idx, zeroMatrix);
    if (useFrostedGlass) glassSubMesh.setMatrixAt(sv.idx, sv.fullMat);
  }
  return true;
}

function updateTransparencyAndOcclusion(modeType, refCamPos, focusX, focusY, focusZ, targetFloorLv, lookDirX = 0, lookDirZ = 0) {
  const showLines = (CAM_VISUAL_STYLE === 'glass_line');
  macroOutlineGroup.visible = showLines;
  let opaqueChanged = false, glassChanged = false;

  if (modeType === 'ground_fixed') {
    waterfallMesh.visible = true; seaMesh.visible = true;
    waterfallMat.opacity = 0.92; seaMat.opacity = 0.95;
    glassDepthMesh.visible = false; glassSubMesh.visible = false;
    for (let i = 0; i < subVoxelsMeta.length; i++) {
      if (applyVoxelVisState(subVoxelsMeta[i], 0, false)) opaqueChanged = true;
    }
    lastAppliedFrostedState = false;
    if (opaqueChanged) opaqueSubMesh.instanceMatrix.needsUpdate = true;
    return;
  }

  if (modeType === 'robot_fpv') {
    const inUndergroundFpv = (targetFloorLv < 0 || ROBOT.posture === 'crawl');
    waterfallMesh.visible = !inUndergroundFpv;
    seaMesh.visible = !inUndergroundFpv;
    glassDepthMesh.visible = false; glassSubMesh.visible = false;
    const curGx = ROBOT.pos.x, curGz = ROBOT.pos.z;
    for (let i = 0; i < subVoxelsMeta.length; i++) {
      const sv = subVoxelsMeta[i];
      if (sv.isWaterWall) {
        if (applyVoxelVisState(sv, 0, false)) opaqueChanged = true;
        continue;
      }
      const dx = sv.wx - refCamPos.x, dy = sv.wy - refCamPos.y, dz = sv.wz - refCamPos.z;
      const distToEye = Math.hypot(dx, dy, dz);
      const dotLook = dx * lookDirX + dz * lookDirZ;
      const isSelfCellCeiling = (sv.gx === curGx && sv.gz === curGz && sv.lv > targetFloorLv && ROBOT.posture === 'stand');
      const isTooCloseToLens = (distToEye < 0.34 && (dotLook < 0.18 || sv.wy > focusY + 0.05));
      const targetState = (isSelfCellCeiling || isTooCloseToLens) ? 1 : 0;
      if (applyVoxelVisState(sv, targetState, false)) opaqueChanged = true;
    }
    lastAppliedFrostedState = false;
    if (opaqueChanged) opaqueSubMesh.instanceMatrix.needsUpdate = true;
    return;
  }

  if (modeType === 'follow_spot') {
    waterfallMesh.visible = false; seaMesh.visible = false;
  } else {
    waterfallMesh.visible = true; seaMesh.visible = true;
    waterfallMat.opacity = (CAM_VISUAL_STYLE === 'hide') ? 0.12 : 0.18;
    seaMat.opacity = (CAM_VISUAL_STYLE === 'hide') ? 0.15 : 0.22;
  }

  const useFrostedGlass = (CAM_VISUAL_STYLE !== 'hide');
  glassSubMesh.visible = useFrostedGlass;
  glassDepthMesh.visible = (CAM_VISUAL_STYLE === 'glass_noline');

  const dirX = refCamPos.x - focusX, dirZ = refCamPos.z - focusZ;
  const lenXZ = Math.hypot(dirX, dirZ) || 1;
  const nx = dirX / lenXZ, nz = dirZ / lenXZ;

  for (let i = 0; i < subVoxelsMeta.length; i++) {
    const sv = subVoxelsMeta[i];
    if (sv.lv <= targetFloorLv) {
      if (applyVoxelVisState(sv, 0, useFrostedGlass)) { opaqueChanged = true; glassChanged = true; }
      continue;
    }
    if (modeType === 'underground_fixed') {
      if (sv.lv >= 0) {
        if (applyVoxelVisState(sv, 0, useFrostedGlass)) { opaqueChanged = true; glassChanged = true; }
        continue;
      }
      const relX = sv.gx - focusX, relZ = sv.gz - focusZ;
      const dotFront = relX * nx + relZ * nz, perpDist = Math.abs(-relX * nz + relZ * nx);
      const inFront = (dotFront > -0.45 && perpDist < 2.65);
      if (applyVoxelVisState(sv, inFront ? 1 : 0, useFrostedGlass)) { opaqueChanged = true; glassChanged = true; }
      continue;
    }
    if (sv.isChipped) {
      const subRelX = sv.wx - focusX, subRelZ = sv.wz - focusZ;
      const subDotFront = subRelX * nx + subRelZ * nz;
      const subPerpDist = Math.abs(-subRelX * nz + subRelZ * nx);
      const blockCharDirectly = (subDotFront > 0.15 && subDotFront < 1.15 && subPerpDist < 0.42 && sv.wy > focusY + 0.1);
      if (applyVoxelVisState(sv, blockCharDirectly ? 1 : 0, useFrostedGlass)) { opaqueChanged = true; glassChanged = true; }
    } else {
      const relX = sv.gx - focusX, relZ = sv.gz - focusZ;
      const dotFront = relX * nx + relZ * nz;
      const perpDist = Math.abs(-relX * nz + relZ * nx);
      const radialDist = Math.hypot(relX, relZ);
      const inSpotWindow = (dotFront > -0.15 && perpDist < 1.35 && radialDist < 1.85);
      if (applyVoxelVisState(sv, inSpotWindow ? 1 : 0, useFrostedGlass)) { opaqueChanged = true; glassChanged = true; }
    }
  }

  lastAppliedFrostedState = useFrostedGlass;
  if (opaqueChanged) opaqueSubMesh.instanceMatrix.needsUpdate = true;
  if (useFrostedGlass && glassChanged) glassSubMesh.instanceMatrix.needsUpdate = true;
}

function updateAllCamerasTransform() {
  camRadius = Math.max(5.5, Math.min(20.0, camRadius));
  clampCamPhiForCurrentMode();

  const statusPanel = document.getElementById('status-panel');
  const h = getRobotHeightLevel();
  const isRobotUG = (h < 0 && h !== -99) || (ROBOT.posture === 'crawl');
  const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;

  if (manualCameraMode === 'robot') {
    robotGroup.visible = false;
    fpvZoomFactor = Math.max(0.50, Math.min(1.15, fpvZoomFactor));
    const isCrawl = (ROBOT.posture === 'crawl');
    const curAspect = window.innerWidth / Math.max(1, window.innerHeight);
    const portraitBoost = curAspect < 0.75 ? 10 : 0;
    const baseFov = isCrawl ? (68 + portraitBoost * 0.6) : (98 + portraitBoost);
    const nextFov = Math.max(45, Math.min(118, baseFov * fpvZoomFactor));
    if (Math.abs(innerRobotCam.fov - nextFov) > 0.05) {
      innerRobotCam.fov = nextFov;
      innerRobotCam.updateProjectionMatrix();
    }

    const eyeH = isCrawl ? (0.18 * sSpec.scaleY) : Math.max(0.14, 0.52 * sSpec.scaleY);
    const forwardOffset = isCrawl ? 0.06 : (-0.26 * fpvZoomFactor);
    const rot = ROBOT.rotY || 0;
    const lookYaw = rot + fpvYawOffset;
    const lookDirX = Math.sin(lookYaw), lookDirZ = Math.cos(lookYaw);

    const eyeX = robotGroup.position.x + lookDirX * forwardOffset;
    const eyeY = robotGroup.position.y + eyeH;
    const eyeZ = robotGroup.position.z + lookDirZ * forwardOffset;

    innerRobotCam.position.set(eyeX, eyeY, eyeZ);
    innerRobotCam.lookAt(
      eyeX + 20 * Math.cos(fpvPitch) * lookDirX,
      eyeY + 20 * Math.sin(fpvPitch),
      eyeZ + 20 * Math.cos(fpvPitch) * lookDirZ
    );

    statusPanel.classList.toggle('sky-hidden', fpvPitch > 0.35);
    activeCamera = innerRobotCam;
    updateTransparencyAndOcclusion('robot_fpv', innerRobotCam.position, robotGroup.position.x, robotGroup.position.y, robotGroup.position.z, h, lookDirX, lookDirZ);

  } else if (manualCameraMode === 'ground') {
    robotGroup.visible = true;
    statusPanel.classList.remove('sky-hidden');
    const gPhi = camPhi, fixedDist = 14.8, centerTargetY = 0.8;
    outerGroundCam.position.set(
      fixedDist * Math.sin(gPhi) * Math.sin(camTheta),
      centerTargetY + fixedDist * Math.cos(gPhi),
      fixedDist * Math.sin(gPhi) * Math.cos(camTheta)
    );
    outerGroundCam.lookAt(0, centerTargetY, 0);
    activeCamera = outerGroundCam;
    updateTransparencyAndOcclusion('ground_fixed', outerGroundCam.position, 0, centerTargetY, 0, AREA1_MIN_UNDER_LV);

  } else if (manualCameraMode === 'underground') {
    robotGroup.visible = true;
    statusPanel.classList.remove('sky-hidden');
    const uPhi = camPhi, fixedUGDist = 13.5, ugCenterY = -2.6;
    let camY = Math.max(-6.2, Math.min(-0.65, ugCenterY + fixedUGDist * Math.cos(uPhi)));
    outerUnderCam.position.set(
      fixedUGDist * Math.sin(uPhi) * Math.sin(camTheta),
      camY,
      fixedUGDist * Math.sin(uPhi) * Math.cos(camTheta)
    );
    outerUnderCam.lookAt(0, -2.7, 0);
    activeCamera = outerUnderCam;
    updateTransparencyAndOcclusion('underground_fixed', outerUnderCam.position, 0, -2.7, 0, AREA1_MIN_UNDER_LV);

  } else {
    robotGroup.visible = true;
    statusPanel.classList.remove('sky-hidden');
    const fPhi = camPhi, followDist = Math.max(4.5, Math.min(12.5, camRadius * 0.72));
    const tx = robotGroup.position.x;
    const ty = robotGroup.position.y + Math.max(0.15, (ROBOT.posture === 'crawl' ? 0.25 : 0.45) * sSpec.scaleY);
    const tz = robotGroup.position.z;

    followCam.position.set(
      tx + followDist * Math.sin(fPhi) * Math.sin(camTheta),
      ty + followDist * Math.cos(fPhi),
      tz + followDist * Math.sin(fPhi) * Math.cos(camTheta)
    );
    followCam.lookAt(tx, ty, tz);
    activeCamera = followCam;
    updateTransparencyAndOcclusion(isRobotUG ? 'follow_spot' : 'ground_fixed', followCam.position, tx, robotGroup.position.y, tz, h);
  }

  syncCameraButtonsUI();
}

function updateEnvironmentAndUI() {
  const st = life.getState(), hLevel = getRobotHeightLevel();
  const sSpec = SIZE_SPECS[ROBOT.sizeLevel] || SIZE_SPECS.tiny;
  const bSpec = BODY_SPECS[ROBOT.bodyType] || BODY_SPECS.slim1;
  const eSpec = getExpressionSpec(ROBOT.emotion);
  const rigBadge = ROBOT.rigType === 'stick' ? '🦴3D骨組み' : '🎲箱型';

  document.getElementById('val-stamina').innerText = st.stamina; document.getElementById('bar-stamina').style.width = st.stamina + '%';
  document.getElementById('val-life').innerText = st.energy; document.getElementById('bar-life').style.width = st.energy + '%';
  document.getElementById('val-mental').innerText = st.mental; document.getElementById('bar-mental').style.width = st.mental + '%';
  document.getElementById('ui-robot-id').innerText = `${rigBadge}・${ROBOT.unitModel}号機`;
  document.getElementById('ui-days').innerText = `🌱 ${GAME_DAY}日目`;

  let timeLabel = '☀️ 朝', skyHex = 0x0f1d36, starOpacity = 0.55;
  if (TIME_STEP >= 17) { timeLabel = '🌌 深淵'; skyHex = 0x030712; starOpacity = 1.0; }
  else if (TIME_STEP >= 13) { timeLabel = '🌙 夜'; skyHex = 0x070d19; starOpacity = 0.95; }
  else if (TIME_STEP >= 9) { timeLabel = '🌇 夕方'; skyHex = 0x1e1638; starOpacity = 0.78; }
  else if (TIME_STEP >= 4) { timeLabel = '🌤️ 昼'; skyHex = 0x152c52; starOpacity = 0.45; }
  if (hLevel >= 1 || manualCameraMode === 'robot' || manualCameraMode === 'ground') starOpacity = Math.min(1.0, starOpacity + 0.25);

  scene.background.setHex(skyHex); starMat.opacity = starOpacity;
  document.getElementById('ui-time').innerText = timeLabel;

  const postureOrEmoIcon = ROBOT.posture === 'crawl' ? '🐛ほふく' : `${eSpec.icon}${eSpec.label}`;
  document.getElementById('ui-mood').innerText = `${postureOrEmoIcon}(${sSpec.label}${sSpec.subH}・${bSpec.label}${bSpec.reqWidth})`;

  const facingName = getDirNameFromRot(ROBOT.rotY || 0);
  const viewModeLabel = ROBOT.posture === 'crawl' ? 'ほふく接近' : (fpvZoomFactor < 0.8 ? 'ズーム' : '広角1ブロック');
  const camBadge = manualCameraMode === 'ground'
    ? '🌌外カメラ(地上)'
    : (manualCameraMode === 'underground'
      ? '⛏️外カメラ(地下)'
      : (manualCameraMode === 'robot'
        ? `🤖視点(${facingName}・${viewModeLabel})`
        : `🤖追従(${getStyleShortName()})`));
  document.getElementById('history-loc').innerText = `${camBadge}・${formatHeightText(hLevel)}`;
  document.getElementById('ai-status').innerText = getActiveBrainBadgeText();
  if (typeof updateModeUI === 'function') updateModeUI();
}

// ============================================================================
// UIボタンイベント・タッチ＆ピンチ操作・メインアニメーションループ
// ============================================================================
document.getElementById('cam-ground-btn').onclick = () => {
  manualCameraMode = (manualCameraMode === 'ground') ? null : 'ground';
  camPhi = (manualCameraMode === 'ground') ? 0.88 : 0.95;
  activePointers.clear(); isDragging = false;
  showToast(manualCameraMode ? '🌌 外カメラ（地上固定）：第一エリア地上空間を見渡すよ' : '🤖 追従カメラ（観察窓スポット透過）に戻したよ');
  cameraDirty = true; updateEnvironmentAndUI();
};

document.getElementById('cam-ug-btn').onclick = () => {
  manualCameraMode = (manualCameraMode === 'underground') ? null : 'underground';
  camPhi = (manualCameraMode === 'underground') ? 1.45 : 0.95;
  activePointers.clear(); isDragging = false;
  showToast(manualCameraMode ? '⛏️ 外カメラ（地下固定）：地下5ブロック全体を見渡すよ' : '🤖 追従カメラ（観察窓スポット透過）に戻したよ');
  cameraDirty = true; updateEnvironmentAndUI();
};

document.getElementById('cam-fpv-btn').onclick = () => {
  manualCameraMode = (manualCameraMode === 'robot') ? null : 'robot';
  activePointers.clear(); isDragging = false;
  if (manualCameraMode === 'robot') {
    resetFpvToRobotFront();
    const dirName = getDirNameFromRot(ROBOT.rotY || 0);
    showToast(`🤖 キャラ視点(広角)：${dirName}の1ブロック全体が見えるよ！2本指でズームもできます`);
  } else {
    camPhi = 0.95;
    showToast('🤖 追従カメラ（観察窓スポット透過）に戻したよ');
  }
  cameraDirty = true; updateEnvironmentAndUI();
};

const domElem = renderer.domElement;

domElem.addEventListener('pointerdown', e => {
  if (e.isPrimary && activePointers.size > 0) {
    activePointers.clear();
    prevPinchDist = null;
  }
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { domElem.setPointerCapture(e.pointerId); } catch (err) {}

  if (activePointers.size === 1) {
    isDragging = true;
    prevPointer.x = e.clientX;
    prevPointer.y = e.clientY;
    prevPinchDist = null;
  } else if (activePointers.size >= 2) {
    isDragging = false;
    const pts = Array.from(activePointers.values());
    prevPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }
}, { passive: true });

window.addEventListener('pointermove', e => {
  if (!activePointers.has(e.pointerId)) {
    if (!isDragging) return;
  } else {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  if (activePointers.size >= 2) {
    const pts = Array.from(activePointers.values());
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (prevPinchDist !== null) {
      const delta = prevPinchDist - dist;
      if (Math.abs(delta) >= 0.4) {
        if (manualCameraMode === 'robot') {
          fpvZoomFactor = Math.max(0.50, Math.min(1.15, fpvZoomFactor + delta * 0.0025));
        } else {
          camRadius = Math.max(5.5, Math.min(20.0, camRadius + delta * 0.025));
        }
        cameraDirty = true;
        prevPinchDist = dist;
      }
    } else {
      prevPinchDist = dist;
    }
    return;
  }

  if (!isDragging) return;
  const dx = e.clientX - prevPointer.x, dy = e.clientY - prevPointer.y;
  if (Math.abs(dx) < 0.35 && Math.abs(dy) < 0.35) return;
  prevPointer.x = e.clientX; prevPointer.y = e.clientY;

  if (manualCameraMode === 'robot') {
    fpvYawOffset -= dx * 0.0078;
    fpvPitch = Math.max(-1.35, Math.min(1.48, fpvPitch + dy * 0.0075));
  } else {
    camTheta -= dx * 0.0090;
    const lim = getCamPhiLimits(manualCameraMode);
    camPhi = Math.max(lim.min, Math.min(lim.max, camPhi + dy * 0.0085));
  }
  cameraDirty = true;
}, { passive: true });

function onPointerUpOrCancel(e) {
  activePointers.delete(e.pointerId);
  try { domElem.releasePointerCapture(e.pointerId); } catch (err) {}
  if (activePointers.size === 1) {
    const remaining = Array.from(activePointers.values())[0];
    prevPointer.x = remaining.x; prevPointer.y = remaining.y;
    isDragging = true; prevPinchDist = null;
  } else if (activePointers.size === 0) {
    isDragging = false; prevPinchDist = null;
  }
}
window.addEventListener('pointerup', onPointerUpOrCancel, { passive: true });
window.addEventListener('pointercancel', onPointerUpOrCancel, { passive: true });
window.addEventListener('blur', () => { activePointers.clear(); isDragging = false; prevPinchDist = null; }, { passive: true });

domElem.addEventListener('wheel', e => {
  if (manualCameraMode === 'robot') {
    fpvZoomFactor = Math.max(0.50, Math.min(1.15, fpvZoomFactor + e.deltaY * 0.0008));
  } else {
    camRadius = Math.max(5.5, Math.min(20.0, camRadius + e.deltaY * 0.01));
  }
  cameraDirty = true;
}, { passive: true });

const fanWrapper = document.getElementById('fan-menu-wrapper');
document.getElementById('plus-main-btn').onclick = () => { fanWrapper.classList.toggle('open'); };
document.getElementById('diary-btn').onclick = () => openModal('modal-diary');
document.getElementById('btn-settings').onclick = () => openModal('modal-settings');
document.getElementById('btn-action').onclick = executeTurn;

document.getElementById('btn-spin').onclick = () => {
  const pool = [
    { type: 'apple', icon: '🍎', name: 'おいしいリンゴ（島に配置！）' },
    { type: 'stone', icon: '🪨', name: '踏み台・段差ブロック（カバンに追加！）' },
    { type: 'oil',   icon: '🧴', name: 'ツルツル・スライムオイル（狭所突破＆ケア用！）' },
    { type: 'grass', icon: '🌿', name: '草ブロック（カバンに追加！）' }
  ];
  const picked = pool[Math.floor(Math.random() * pool.length)];
  if (picked.type === 'apple') WORLD_ITEMS.push({ type: 'apple', x: Math.floor(Math.random() * 5) - 2, z: Math.floor(Math.random() * 5) - 2 });
  else if (BAG.length < 10) BAG.push(picked.type);
  life.mental = Math.min(100, life.mental + 25);
  ROBOT.emotion = 'joy';
  document.getElementById('gacha-result-text').innerText = `${picked.icon} ${picked.name}`;
  rebuildTerrainAndItems(); syncRobot3DPosition(); cameraDirty = true; updateEnvironmentAndUI(); saveWorldState();
  showToast(`${picked.icon} ゲット！1号機も大喜び！`);
};

const obsModeEl = document.getElementById('setting-obs-mode');
if (obsModeEl && typeof OBS_MODE !== 'undefined') {
  obsModeEl.value = OBS_MODE;
}
document.getElementById('setting-cam-style').value = CAM_VISUAL_STYLE;
document.getElementById('setting-size-level').value = ROBOT.sizeLevel;
document.getElementById('setting-body-type').value = ROBOT.bodyType;
document.getElementById('setting-ai-type').value = safeStorage.getItem('ai_type') || 'none';
document.getElementById('setting-gemini-key').value = safeStorage.getItem('api_gemini') || '';
document.getElementById('setting-groq-key').value = safeStorage.getItem('api_groq') || '';
document.getElementById('setting-speed').value = String(ROBOT.speed || 3);

rebuildTerrainAndItems();
syncRobot3DPosition(true);
updateAllCamerasTransform();
updateEnvironmentAndUI();
loadCloudWorldState();

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  updateRobotUnifiedAnimation(t);

  if (cameraDirty) {
    updateAllCamerasTransform();
    cameraDirty = false;
  }

  wfTex.offset.y = (t * 0.17) % 1.0;
  const seaPulse = 1 + Math.sin(t * 1.8) * 0.006; seaMesh.scale.set(seaPulse, 1, seaPulse);
  const foamScale = 1 + Math.sin(t * 2.2) * 0.025; foamRingMesh.scale.set(foamScale, foamScale, 1);
  turtleGroup.position.y = -10.4 + Math.sin(t * 0.7) * 0.18; turtleGroup.rotation.y = Math.sin(t * 0.25) * 0.06;
  skyGroup.rotation.y = t * 0.015;

  renderer.render(scene, activeCamera);
}
requestAnimationFrame(animate);

window.addEventListener('resize', () => {
  const a = window.innerWidth / window.innerHeight;
  [outerGroundCam, outerUnderCam, followCam, innerRobotCam].forEach(c => { c.aspect = a; c.updateProjectionMatrix(); });
  renderer.setSize(window.innerWidth, window.innerHeight);
  cameraDirty = true;
});
