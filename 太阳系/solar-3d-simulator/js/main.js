// 入口：初始化场景、UI、动画循环与交互
import { SolarScene } from './scene.js';
import { setupUI } from './ui.js';
import { PLANETS, SUN, SCALE } from '../data/planets.js';

const appEl = document.getElementById('webgl');

// 仿真状态
let isPlaying = true;
// timeScale：用户可调的倍率（相对于 baseSimDaysPerSecond）
let timeScale = 1;
// 基础“每天/每秒”——决定默认播放速度（可在 UI 中等比缩放）
const baseSimDaysPerSecond = 5; // 每真实秒推进 5 个“模拟日”，默认速度
let simulationDays = 0; // 累计的“模拟天数”

// 将仿真时间映射到 UI 滑杆（以地球年为基准）
const earthYearDays = 365.25;

// 初始化场景
const solarScene = new SolarScene({
  container: appEl,
  enableBloom: false, // 初始由 UI 按需开启
});
solarScene.init();
solarScene.buildSystem(SUN, PLANETS, SCALE);

// UI 绑定
const ui = setupUI({
  getPlaying: () => isPlaying,
  setPlaying: (v) => { isPlaying = v; },
  getTimeScale: () => timeScale,
  setTimeScale: (v) => { timeScale = v; updateSpeedLabel(); },
  onStep: (dir) => { // dir: +1 前进，-1 后退
    simulationDays += dir * 1; // 单步 = 1 天
    isPlaying = false;
    ui.setPlaying(false);
    syncTimeSlider();
    renderOnce(); // 步进后立即渲染
  },
  onOrbitsToggle: (show) => solarScene.setOrbitsVisible(show),
  onBloomToggle: (enabled) => solarScene.setBloomEnabled(enabled),
  onCinematicToggle: (enabled) => solarScene.setCinematic(enabled),
  onTimeSlider: (t01, fromUser) => {
    // t01 ∈ [0,1]，映射到 1 个地球年的范围
    simulationDays = t01 * earthYearDays;
    if (fromUser) {
      // 用户拖动时，暂停并立即渲染到该时间点
      isPlaying = false;
      ui.setPlaying(false);
      renderOnce();
    }
    updateTimeLabel();
  },
  speedFormatter: (scale) => `速度 ${scale.toFixed(2)}×`,
});

// 射线拾取：点击/触摸选中行星并聚焦
function handlePick(clientX, clientY) {
  const rect = solarScene.canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;

  const hit = solarScene.pickPlanet(x, y);
  if (hit) {
    // 相机平滑聚焦
    solarScene.focusOn(hit.name);
    // 展示信息卡
    ui.showInfo(hit.data);
  }
}

solarScene.canvas.addEventListener('click', (e) => {
  handlePick(e.clientX, e.clientY);
});
solarScene.canvas.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  handlePick(t.clientX, t.clientY);
});

// 键盘快捷键（可访问性）
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space') {
    isPlaying = !isPlaying;
    ui.setPlaying(isPlaying);
    e.preventDefault();
  } else if (e.code === 'ArrowUp') {
    ui.bumpSpeed(2); e.preventDefault();
  } else if (e.code === 'ArrowDown') {
    ui.bumpSpeed(0.5); e.preventDefault();
  } else if (e.code === 'ArrowRight') {
    ui.step(+1); e.preventDefault();
  } else if (e.code === 'ArrowLeft') {
    ui.step(-1); e.preventDefault();
  }
});

// 更新速度显示
function updateSpeedLabel() { ui.updateSpeedLabel(timeScale); }

// 将 simulationDays 映射到滑杆
function syncTimeSlider() {
  const t01 = ((simulationDays % earthYearDays) + earthYearDays) % earthYearDays / earthYearDays;
  ui.setTimeSlider(t01);
  updateTimeLabel();
}
function updateTimeLabel() {
  const pct = (((simulationDays % earthYearDays) + earthYearDays) % earthYearDays) / earthYearDays * 100;
  ui.setTimeLabel(`${pct.toFixed(1)}%`);
}

// 动画循环
let last = performance.now();
function animate(now) {
  const dt = Math.min(0.05, (now - last) / 1000); // 限制单帧 dt，避免长时间后台导致跳变
  last = now;

  if (isPlaying) {
    // 每帧推进：simulationDays += deltaSeconds * baseSimDaysPerSecond * timeScale
    simulationDays += dt * baseSimDaysPerSecond * timeScale;
    syncTimeSlider();
  }

  solarScene.update(dt, simulationDays);
  requestAnimationFrame(animate);
}
function renderOnce() {
  // 用于暂停/步进/拖动滑杆后立即显示
  solarScene.update(0, simulationDays);
}

updateSpeedLabel();
syncTimeSlider();
requestAnimationFrame(animate);

// 响应窗口变化
window.addEventListener('resize', () => solarScene.resize());

// 桌面浏览器默认开启电影模式，提高观感；移动端保持关闭
if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  solarScene.setCinematic(true);
  const el = document.querySelector('#cinematicToggle');
  if (el) el.checked = true;
}
