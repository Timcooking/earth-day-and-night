// main.js - 入口：初始化 Three.js、装配模型与云层、绑定交互与 UI。
// 使用 ES Modules，从 CDN 加载 three 与控制器。

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.153.0/examples/jsm/controls/OrbitControls.js';

// 本地模块
import { createTowerInstanced, highlightInstance, TOWER_PARAMS } from './model.js';
import { CloudsSystem } from './clouds.js';
import { setupUI } from './ui.js';
import { FLOORS } from './data/floors.js';

// -------------------- 基本参数与状态 --------------------
const canvas = document.getElementById('webgl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false; // 移动端默认关闭阴影

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xffffff, 0.0008); // 更轻雾，避免“白茫茫”吞掉云

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
// 初始视角：稍远一点，便于看云层
camera.position.set(160, 160, 380);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 120;
controls.maxDistance = 600;
controls.minPolarAngle = Math.PI * 0.05;
controls.maxPolarAngle = Math.PI * 0.49;

// 环境光 + 方向光：更明亮、更暖一点
const hemi = new THREE.HemisphereLight(0xffffff, 0xdde8ff, 0.9);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.75);
dir.position.set(200, 500, 200);
scene.add(dir);

// -------------------- 模型：128 层实例化 --------------------
const tower = createTowerInstanced(128); // 返回 { group, instancedMesh, getFloorY }
scene.add(tower.group);

// -------------------- 云层系统 --------------------
const clouds = new CloudsSystem({
  scene,
  count: 5,                // 5 层云
  radius: 220,             // 环绕半径
  towerHeight: TOWER_PARAMS.totalHeight,
  noiseSpeed: 0.02,
});

// -------------------- 滚动映射：虚拟 scrollPosition 0..1 --------------------
let scrollTarget01 = 0;   // 用户输入目标（0..1）
let scrollCurrent01 = 0;  // 实际相机位置（0..1）

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function onWheel(e) {
  // 如果按住 Ctrl，交给浏览器或 OrbitControls 做缩放，不处理滚动浏览
  if (e.ctrlKey) return;
  const delta = -e.deltaY; // 上滚增高
  // 将滚轮像素映射到 0..1（经验值缩放），并限制范围
  scrollTarget01 = clamp01(scrollTarget01 + delta * 0.0005);
}

function onTouch() {
  let lastY = null;
  function touchStart(e) { lastY = e.touches[0].clientY; }
  function touchMove(e) {
    if (lastY == null) return;
    const dy = e.touches[0].clientY - lastY;
    lastY = e.touches[0].clientY;
    scrollTarget01 = clamp01(scrollTarget01 - dy * 0.0015); // 上滑提高
  }
  function touchEnd() { lastY = null; }
  window.addEventListener('touchstart', touchStart, { passive: true });
  window.addEventListener('touchmove', touchMove, { passive: true });
  window.addEventListener('touchend', touchEnd, { passive: true });
}

function onKey(e) {
  if (e.key === 'ArrowUp') scrollTarget01 = clamp01(scrollTarget01 + 0.02);
  if (e.key === 'ArrowDown') scrollTarget01 = clamp01(scrollTarget01 - 0.02);
  // 视图缩放：+ 放大（靠近），- 缩小（远离）
  if (e.key === '+' || e.key === '=') {
    if (typeof controls.dollyIn === 'function') controls.dollyIn(1.1);
  }
  if (e.key === '-' || e.key === '_') {
    if (typeof controls.dollyOut === 'function') controls.dollyOut(1.1);
  }
}

window.addEventListener('wheel', onWheel, { passive: true });
window.addEventListener('keydown', onKey);
onTouch();

// -------------------- UI 装配与楼层交互 --------------------
const ui = setupUI({
  totalFloors: 128,
  onJumpTo: (floorIndex) => {
    // 跳转到指定楼层，映射到 0..1
    const y = tower.getFloorY(floorIndex);
    scrollTarget01 = clamp01(y / TOWER_PARAMS.totalHeight);
  },
  onCloseModal: () => highlightInstance(tower.instancedMesh, -1),
});

// Raycaster 检测楼层点击
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
function onPointerDown(event) {
  // 支持触摸/鼠标
  const rect = renderer.domElement.getBoundingClientRect();
  const x = (event.clientX ?? event.touches?.[0]?.clientX ?? 0) - rect.left;
  const y = (event.clientY ?? event.touches?.[0]?.clientY ?? 0) - rect.top;
  mouse.x = (x / rect.width) * 2 - 1;
  mouse.y = -(y / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(tower.instancedMesh, false);
  if (intersects.length > 0) {
    const id = intersects[0].instanceId ?? -1;
    if (id >= 0) {
      highlightInstance(tower.instancedMesh, id);
      const data = FLOORS[id + 1] || { name: `${id+1}F`, type: '未知', description: '待补充', image: '' };
      ui.showFloorModal(id + 1, data);
      ui.selectFloor(id + 1);
    }
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

// -------------------- 动画循环 --------------------
const clock = new THREE.Clock();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

function updateCameraByScroll(alpha01) {
  // 将 0..1 映射到塔体高度，使用 ease 曲线
  const ease = (t) => t * t * (3 - 2 * t); // smoothstep
  const t = ease(alpha01);
  const targetY = THREE.MathUtils.lerp(-80, TOWER_PARAMS.totalHeight + 120, t);
  // 通过相机位置 y 平滑移动；x/z 用 controls 控制
  camera.position.y = lerp(camera.position.y, targetY, 0.08);
  controls.target.y = camera.position.y - 60; // 轻微向前看
  controls.update();

  // 进度条与 UI 同步
  ui.updateProgress(alpha01, tower.getFloorIndexFromY(targetY));
}

function animate() {
  const dt = clock.getDelta();

  // 平滑插值滚动值
  scrollCurrent01 = lerp(scrollCurrent01, scrollTarget01, 0.08);
  updateCameraByScroll(scrollCurrent01);

  // 云层动画：根据高度穿透调整透明与散开
  clouds.update(dt, camera.position.y);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// 初始化尺寸并启动
resize();
requestAnimationFrame(animate);
