// 顶部 UI 控制、信息卡、键盘可访问性
export function setupUI(api) {
  const $ = (sel) => document.querySelector(sel);

  const playBtn = $('#playPauseBtn');
  const slowerBtn = $('#slowerBtn');
  const fasterBtn = $('#fasterBtn');
  const stepBackBtn = $('#stepBackBtn');
  const stepForwardBtn = $('#stepForwardBtn');
  const speedDisplay = $('#speedDisplay');
  const orbitsToggle = $('#orbitsToggle');
  const bloomToggle = $('#bloomToggle');
  const cinematicToggle = $('#cinematicToggle');
  const timeSlider = $('#timeSlider');
  const timeLabel = $('#timeLabel');

  const infoPanel = $('#infoPanel');
  const infoCloseBtn = $('#infoCloseBtn');
  const infoImage = $('#infoImage');
  const infoTitle = $('#infoTitle');
  const infoRadius = $('#infoRadius');
  const infoDistance = $('#infoDistance');
  const infoPeriod = $('#infoPeriod');
  const infoText = $('#infoText');
  const infoLink = $('#infoLink');

  // 初始状态
  setPlaying(true);
  updateSpeedLabel(api.getTimeScale());

  // 绑定事件
  playBtn.addEventListener('click', () => {
    const playing = !api.getPlaying();
    api.setPlaying(playing);
    setPlaying(playing);
  });
  slowerBtn.addEventListener('click', () => bumpSpeed(0.5));
  fasterBtn.addEventListener('click', () => bumpSpeed(2));
  stepBackBtn.addEventListener('click', () => step(-1));
  stepForwardBtn.addEventListener('click', () => step(+1));

  orbitsToggle.addEventListener('change', () => api.onOrbitsToggle(orbitsToggle.checked));
  bloomToggle.addEventListener('change', () => api.onBloomToggle(bloomToggle.checked));
  cinematicToggle.addEventListener('change', () => api.onCinematicToggle?.(cinematicToggle.checked));

  // 时间滑杆：拖动反推仿真时间（基于地球年）
  let dragging = false;
  timeSlider.addEventListener('input', () => {
    dragging = true;
    api.onTimeSlider(parseFloat(timeSlider.value), true);
  });
  timeSlider.addEventListener('change', () => { dragging = false; });

  infoCloseBtn.addEventListener('click', () => hideInfo());

  // 暴露给外部的控制
  function setPlaying(playing) {
    playBtn.textContent = playing ? '⏸' : '▶︎';
  }
  function bumpSpeed(f) {
    // 限制范围
    const cur = api.getTimeScale();
    const next = clamp(cur * f, 1/16, 256);
    api.setTimeScale(next);
    updateSpeedLabel(next);
  }
  function step(dir) { api.onStep(dir); }

  function updateSpeedLabel(scale) {
    speedDisplay.textContent = api.speedFormatter ? api.speedFormatter(scale) : `速度 ${scale}×`;
  }
  function setTimeSlider(t01) {
    if (!dragging) timeSlider.value = String(t01);
  }
  function setTimeLabel(text) { timeLabel.textContent = text; }

  // 信息卡
  function showInfo(p) {
    infoTitle.textContent = p.name;
    infoRadius.textContent = fmtNum(p.radiusKm);
    infoDistance.textContent = fmtNum(p.distanceKm);
    infoPeriod.textContent = fmtNum(p.periodDays);

    const url = resolveImage(p);
    infoImage.src = url;
    infoImage.alt = `${p.name} 图片`;

    infoText.textContent = p.infoText || '—';
    infoLink.href = p.wikiUrl || '#';
    infoLink.textContent = '更多资料';

    infoPanel.classList.remove('hidden');
  }
  function hideInfo() {
    infoPanel.classList.add('hidden');
  }

  function resolveImage(p) {
    if (!p.imageUrl || p.imageUrl === 'auto') {
      // 生成 SVG 占位图（嵌入 base64）：以行星颜色与名称
      const w = 600, h = 400;
      const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
        `<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='${p.color}' stop-opacity='0.9'/>` +
        `<stop offset='100%' stop-color='#111827' stop-opacity='1'/></linearGradient></defs>` +
        `<rect width='100%' height='100%' fill='url(#g)'/>` +
        `<circle cx='${w*0.26}' cy='${h*0.52}' r='${Math.max(24, Math.min(120, p.radiusKm/50))}' fill='${p.color}' fill-opacity='0.85'/>` +
        `<text x='${w*0.6}' y='${h*0.55}' text-anchor='middle' font-family='Arial, sans-serif' font-size='44' fill='#e5e7eb'>${p.name}</text>` +
        `</svg>`;
      return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    }
    return p.imageUrl;
  }

  function fmtNum(n) {
    if (n === 0) return '0';
    if (!Number.isFinite(n)) return '-';
    if (n >= 1e6) return (n/1e6).toFixed(2) + ' M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + ' K';
    return String(n);
  }

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  return {
    setPlaying, updateSpeedLabel, setTimeSlider, setTimeLabel, showInfo, hideInfo,
    bumpSpeed, step,
  };
}
