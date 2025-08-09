// ui.js — 侧边楼层导航、进度与模态框逻辑

import { TOWER_PARAMS } from './model.js';

export function setupUI({ totalFloors, onJumpTo, onCloseModal }) {
  const floorList = document.getElementById('floorList');
  const currentFloorEl = document.getElementById('currentFloor');
  const currentHeightEl = document.getElementById('currentHeight');
  const progressBar = document.getElementById('progressBar');

  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modalContent');

  // 生成楼层按钮（分组显示，便于滚动）
  for (let i = totalFloors; i >= 1; i--) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.id = `floor-${i}`;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', i === 1 ? 'true' : 'false');
    btn.textContent = `${i}F`;
    btn.addEventListener('click', () => onJumpTo(i));
    li.appendChild(btn);
    floorList.appendChild(li);
  }

  function selectFloor(i) {
    const prev = floorList.querySelector('[aria-selected="true"]');
    if (prev) prev.setAttribute('aria-selected', 'false');
    const btn = document.getElementById(`floor-${i}`);
    if (btn) btn.setAttribute('aria-selected', 'true');
  }

  function updateProgress(alpha01, floorIndex) {
    progressBar.style.width = `${(alpha01 * 100).toFixed(1)}%`;
    currentFloorEl.textContent = `${floorIndex}`;
    const meters = Math.round((floorIndex - 1) * TOWER_PARAMS.layerHeightMeters);
    currentHeightEl.textContent = `${meters}`;
    selectFloor(floorIndex);
  }

  // 模态框
  function showFloorModal(floorNumber, data) {
    modalContent.innerHTML = '';
    const title = document.createElement('h3');
    title.textContent = `${floorNumber}F · ${data.name || data.type || ''}`;

    const img = document.createElement('img');
    // 1x1 base64 占位，方便后续替换
    img.alt = `${floorNumber}F 图片`;
    img.src = data.image || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABh8iG1QAAAABJRU5ErkJggg==';

    const p = document.createElement('p');
    p.textContent = data.description || '该楼层信息待补充。';

    modalContent.append(title, img, p);
    modal.hidden = false;

    // 关闭事件
    const close = (ev) => {
      if (ev.target?.dataset?.close !== undefined || ev.key === 'Escape') {
        modal.hidden = true;
        window.removeEventListener('keydown', close);
        onCloseModal?.();
      }
    };
    modal.addEventListener('click', close, { once: true });
    window.addEventListener('keydown', close);
  }

  // 键盘辅助：上下箭头切换楼层
  document.addEventListener('keydown', (e) => {
    const current = parseInt(currentFloorEl.textContent || '1', 10);
    if (e.key === 'ArrowUp') onJumpTo(Math.min(totalFloors, current + 1));
    if (e.key === 'ArrowDown') onJumpTo(Math.max(1, current - 1));
  });

  return { updateProgress, showFloorModal, selectFloor };
}
