import * as THREE from 'three';
import * as topojson from 'https://cdn.jsdelivr.net/npm/topojson-client@3/+esm';
import { geoContains } from 'https://cdn.jsdelivr.net/npm/d3-geo@3/+esm';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { toISODateTimeLocal, listIanaTimeZones, dateWithTimeZone, sunDirectionECI } from './utils.js';

let renderer, scene, camera, controls;
let composer, renderPass, bloomPass, afterPass, filmPass;
let globe, atmosphere, nightMask, stars;
let sunLight, sunHelper;
let params = {
  autoOrbit: true,
  showStars: true,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  dateLocalValue: null,
};
let currentUTC = new Date();
let t0; // 动画时间基准（置顶避免 TDZ）
let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let tooltipEl = document.getElementById('tooltip');
let countries = null; // GeoJSON FeatureCollection
let countryIndex = null; // 简单 bbox 预筛
let clockTimer = null; // 实时时钟计时器（上移以避免 TDZ）
let lang = (localStorage.getItem('earth_lang') || 'zh');
const i18n = {
  zh: {
    'label.nowTime': '现在时间',
    'label.time': '时间',
    'label.timezone': '时区',
    'btn.now': '现在',
    'toggle.autoOrbit': '自动环绕',
    'toggle.showStars': '星空',
    'legend.daylight': '日照',
    'legend.night': '夜晚',
  'hint.controls': '拖拽旋转 / 滚轮缩放 / 右键平移',
  'btn.learn': '科普',
  'panel.learn': '科普',
  'panel.kids': '适合儿童',
  'panel.earth': '地球观测',
  'panel.solar': '太阳系'
  , 'btn.about': '关于'
  , 'about.title': '关于这个页面'
  , 'about.close': '关闭'
  , 'about.p1': '这是一个使用 Three.js 实时渲染的地球模拟：展示日夜分界、云层与星空，镜头可拖拽旋转与自动环绕。'
  , 'about.p2': '你可以从上方选择时区，顶部时钟会显示该时区的当前时间；将鼠标悬停在国家上可查看名称与相关信息链接。'
  , 'about.controls': '基本操作'
  , 'about.ctrl.drag': '拖拽旋转地球'
  , 'about.ctrl.zoom': '滚轮缩放视距'
  , 'about.ctrl.pan': '右键拖拽平移'
  },
  en: {
    'label.nowTime': 'Now',
    'label.time': 'Time',
    'label.timezone': 'Time Zone',
    'btn.now': 'Now',
    'toggle.autoOrbit': 'Auto Orbit',
    'toggle.showStars': 'Stars',
    'legend.daylight': 'Daylight',
    'legend.night': 'Night',
  'hint.controls': 'Drag rotate / Wheel zoom / Right-drag pan',
  'btn.learn': 'Learn',
  'panel.learn': 'Learn',
  'panel.kids': 'For Kids',
  'panel.earth': 'Earth Observation',
  'panel.solar': 'Solar System'
  , 'btn.about': 'About'
  , 'about.title': 'About this page'
  , 'about.close': 'Close'
  , 'about.p1': 'A real-time Earth simulator built with Three.js: day-night terminator, clouds and stars, with draggable camera and auto orbit.'
  , 'about.p2': 'Select a time zone above to view its current time; hover a country to see its name and related links.'
  , 'about.controls': 'Controls'
  , 'about.ctrl.drag': 'Drag to rotate the globe'
  , 'about.ctrl.zoom': 'Mouse wheel to zoom'
  , 'about.ctrl.pan': 'Right-drag to pan'
  }
};

const container = document.getElementById('canvas-container');
const tzSelect = document.getElementById('timezone');
const autoOrbitToggle = document.getElementById('auto-orbit');
const showStarsToggle = document.getElementById('show-stars');
const clockEl = document.getElementById('clock');
const langBtn = document.getElementById('lang-toggle');
const learnBtn = document.getElementById('learn-toggle');
const learnPanel = document.getElementById('learn-panel');
const aboutBtn = document.getElementById('about-toggle');
const aboutModal = document.getElementById('about-modal');
const aboutClose = document.getElementById('about-close');

init();
animate(0);

function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // Scene & Camera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 1.6, 4.2);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 1.6;
  controls.maxDistance = 15;
  controls.rotateSpeed = 0.5;

  // Postprocessing
  composer = new EffectComposer(renderer);
  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.65, 0.6, 0.85);
  composer.addPass(bloomPass);

  afterPass = new AfterimagePass(0.92); // 运动拖影，保守参数
  composer.addPass(afterPass);

  filmPass = new FilmPass(0.2, 0.05, 648, false); // 轻颗粒、扫描线
  composer.addPass(filmPass);

  // Lighting: 使用定向光代表太阳
  sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
  scene.add(sunLight);
  scene.add(sunLight.target);

  // 太阳方向可视小 Helper（默认隐藏，可调试）
  sunHelper = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 3, 0xffdd88);
  sunHelper.visible = false;
  scene.add(sunHelper);

  // 背景星空
  stars = createStars();
  scene.add(stars);

  // 地球
  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  const R = 1.0;
  const geometry = new THREE.SphereGeometry(R, 96, 96);

  const texLoader = new THREE.TextureLoader();
  const base = 'https://threejs.org/examples/textures/planets/';
  const texDay = texLoader.load(base + 'earth_atmos_2048.jpg');
  const texNight = texLoader.load(base + 'earth_lights_2048.png');
  const texBump = texLoader.load(base + 'earth_normal_2048.jpg');
  const texSpec = texLoader.load(base + 'earth_specular_2048.jpg');
  const texCloud = texLoader.load(base + 'earth_clouds_1024.png');
  // 色域与各向异性
  const aniso = Math.min(renderer.capabilities.getMaxAnisotropy?.() || 8, 16);
  [texDay, texNight, texCloud].forEach(t=>{ t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; });
  [texBump, texSpec].forEach(t=>{ t.anisotropy = aniso; });

  // 日夜混合 ShaderMaterial
  const globeMat = new THREE.ShaderMaterial({
    uniforms: {
      uDayTex: { value: texDay },
      uNightTex: { value: texNight },
      uBumpTex: { value: texBump },
      uSpecTex: { value: texSpec },
      uLightDir: { value: new THREE.Vector3(1,0,0) },
      uGloss: { value: 30.0 },
      uExposure: { value: 1.0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      uniform sampler2D uDayTex;
      uniform sampler2D uNightTex;
      uniform sampler2D uBumpTex;
      uniform sampler2D uSpecTex;
      uniform vec3 uLightDir;
      uniform float uGloss;
      uniform float uExposure;

      vec3 ACESFilmicToneMapping(vec3 color){
        float a=2.51; float b=0.03; float c=2.43; float d=0.59; float e=0.14;
        return clamp((color*(a*color+b))/(color*(c*color+d)+e), 0.0, 1.0);
      }

      void main(){
        // 法线、光照
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uLightDir);
        float ndl = max(dot(N, L), 0.0);

        vec3 day = texture2D(uDayTex, vUv).rgb;
        vec3 night = texture2D(uNightTex, vUv).rgb;

        // terminator 平滑：使用 ndl 的平滑步骤
        float k = smoothstep(-0.2, 0.2, ndl);
        vec3 baseColor = mix(night, day, k);

        // 简单高光（海洋），权重由 water mask 决定
        float specMask = texture2D(uSpecTex, vUv).r; // 水域为白
        vec3 R = reflect(normalize(vWorldPos), N);
        float spec = pow(max(dot(R, L), 0.0), uGloss) * specMask * 0.7;

        vec3 color = baseColor * (0.6 + 0.6 * ndl) + vec3(spec);
        color *= uExposure;
        color = ACESFilmicToneMapping(color);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  globe = new THREE.Mesh(geometry, globeMat);
  globe.rotation.z = 23.44 * Math.PI/180; // 地轴倾角
  globeGroup.add(globe);

  // 云层（微透明自转）
  const cloudMat = new THREE.MeshPhongMaterial({ map: texCloud, transparent: true, opacity: 0.35, depthWrite: false });
  const cloud = new THREE.Mesh(new THREE.SphereGeometry(R * 1.005, 96, 96), cloudMat);
  globeGroup.add(cloud);

  // 大气薄辉光
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { uLightDir: { value: new THREE.Vector3(1,0,0) } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main(){
        vNormal = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      uniform vec3 uLightDir;
      void main(){
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uLightDir);
        float rim = pow(1.0 - max(dot(N, -normalize(vWorldPos)), 0.0), 3.0);
        float daySide = smoothstep(0.0, 0.3, dot(N, L));
        vec3 c = mix(vec3(0.05,0.15,0.5), vec3(0.2,0.5,1.0), daySide) * rim * 0.6;
        gl_FragColor = vec4(c, 0.9 * rim);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R * 1.03, 96, 96), atmoMat);
  globeGroup.add(atmosphere);

  // 事件和 UI
  buildTimezoneOptions();
  params.dateLocalValue = toISOInTimeZone(new Date(), params.timeZone);
  tzSelect.value = params.timeZone;
  bindUI();
  applyI18n();
  startClock();

  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', onMouseMove);
  // 初次计算太阳方向
  updateSunForCurrentInputs();

  // 异步加载国家边界（TopoJSON -> GeoJSON）
  loadCountries();
}

function createStars() {
  const g = new THREE.BufferGeometry();
  const N = 4000;
  const positions = new Float32Array(N * 3);
  for (let i=0;i<N;i++){
    const r = 90 + Math.random()*10;
    const theta = Math.random()*Math.PI*2;
    const phi = Math.acos(2*Math.random()-1);
    positions[i*3+0] = r*Math.sin(phi)*Math.cos(theta);
    positions[i*3+1] = r*Math.cos(phi);
    positions[i*3+2] = r*Math.sin(phi)*Math.sin(theta);
  }
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const m = new THREE.PointsMaterial({ color: 0xaab8ff, size: 0.04, sizeAttenuation: true, transparent: true, opacity: 0.9 });
  const points = new THREE.Points(g, m);
  points.matrixAutoUpdate = false;
  points.frustumCulled = false;
  return points;
}

function bindUI(){
  autoOrbitToggle.addEventListener('change', (e)=>{
    params.autoOrbit = e.target.checked;
  });
  showStarsToggle.addEventListener('change', (e)=>{
    params.showStars = e.target.checked;
    stars.visible = params.showStars;
  });
  tzSelect.addEventListener('change', ()=>{
    params.timeZone = tzSelect.value;
  // 切换时区后，将右侧时间更新为该时区的“现在”
  const now = new Date();
  const v = toISOInTimeZone(now, params.timeZone);
  params.dateLocalValue = v;
  updateSunForCurrentInputs();
  // 立即刷新时钟显示
  if (clockEl) clockEl.textContent = formatTimeInTimeZone(new Date(), params.timeZone);
  });
  if (langBtn) {
    langBtn.addEventListener('click', ()=>{
      lang = (lang === 'zh') ? 'en' : 'zh';
      localStorage.setItem('earth_lang', lang);
      langBtn.textContent = (lang === 'zh') ? 'EN' : '中';
      applyI18n();
    });
    langBtn.textContent = (lang === 'zh') ? 'EN' : '中';
  }
  if (learnBtn && learnPanel) {
    learnBtn.addEventListener('click', ()=>{
      learnPanel.classList.toggle('open');
    });
  }
  if (aboutBtn && aboutModal) {
    const toggle = (show)=>{ aboutModal.classList[show? 'add':'remove']('open'); };
    aboutBtn.addEventListener('click', ()=> toggle(true));
    if (aboutClose) aboutClose.addEventListener('click', ()=> toggle(false));
    // 点击遮罩关闭（仅点背景时）
    aboutModal.addEventListener('click', (e)=>{ if (e.target === aboutModal) toggle(false); });
    // Esc 关闭
    window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') toggle(false); });
  }
}

function buildTimezoneOptions(){
  const zones = listIanaTimeZones();
  tzSelect.innerHTML = '';
  zones.forEach(z=>{
    const opt = document.createElement('option');
    opt.value = z; opt.textContent = z;
    tzSelect.appendChild(opt);
  });
}

function onResize(){
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w/h; 
  camera.updateProjectionMatrix();
  composer.setSize(w, h);
  if (bloomPass && bloomPass.setSize) bloomPass.setSize(w, h);
}

async function loadCountries(){
  // TopoJSON + 名称 TSV 成对加载，先尝试 110m，失败回退 50m
  const pairs = [
    ['https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json', 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.tsv'],
    ['https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json',  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.tsv'],
  ];
  const tryLoad = async (topoUrl, tsvUrl) => {
    const [topoRes, tsvRes] = await Promise.all([fetch(topoUrl), fetch(tsvUrl)]);
    if (!topoRes.ok || !tsvRes.ok) throw new Error(`Fetch failed: ${topoUrl} / ${tsvUrl}`);
    const [topoData, tsvText] = await Promise.all([topoRes.json(), tsvRes.text()]);

    // 解析 TSV -> id -> name
    const lines = tsvText.trim().split(/\n/);
    const header = lines[0].split('\t');
    const idIdx = header.findIndex(h => /^(id|iso_n3)$/i.test(h.trim()));
    const nameIdx = header.findIndex(h => /^(name|name_long|name_en|admin|geounit)$/i.test(h.trim()));
    const nameMap = {};
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      const rawId = (cols[idIdx] || '').trim();
      const nm = (cols[nameIdx] || '').trim();
      if (!rawId || !nm) continue;
      const key = /^\d+$/.test(rawId) ? rawId.padStart(3, '0') : rawId;
      nameMap[key] = nm;
    }

    // 选择对象并转 GeoJSON
    const obj = topoData.objects.countries || topoData.objects.ne_admin_0_countries || Object.values(topoData.objects)[0];
    const geo = topojson.feature(topoData, obj);

    // 名称映射
    geo.features.forEach(f => {
      const raw = f.id;
      const key = (typeof raw === 'number')
        ? String(raw).padStart(3, '0')
        : (/^\d+$/.test(String(raw)) ? String(raw).padStart(3, '0') : String(raw));
      f.properties = f.properties || {};
      f.properties.name = nameMap[key] || nameMap[String(raw)] || 'Unknown';
    });

    return { geo, topoUrl, tsvUrl };
  };

  let loaded = null;
  for (const [topoUrl, tsvUrl] of pairs) {
    try {
      loaded = await tryLoad(topoUrl, tsvUrl);
      break;
    } catch (e) {
      console.warn('Load countries attempt failed:', topoUrl, tsvUrl, e);
    }
  }

  if (!loaded) {
    console.error('All country dataset loads failed.');
    return;
  }

  const { geo, topoUrl, tsvUrl } = loaded;
  countries = geo;
  countryIndex = geo.features.map(f => ({ name: f.properties.name, bbox: bboxOfFeature(f.geometry), feature: f }));
  const mapped = geo.features.filter(f => f.properties?.name && f.properties.name !== 'Unknown').length;
  console.info('Countries loaded:', topoUrl, 'names:', tsvUrl, 'mapped=', mapped, '/', geo.features.length);
}

function bboxOfFeature(geom){
  // 计算简单经纬度 bbox
  let minLon=180, minLat=90, maxLon=-180, maxLat=-90;
  const visit = (coords)=>{
    for (let i=0;i<coords.length;i++){
      const c = coords[i];
      if (typeof c[0] === 'number'){
        const lon = c[0], lat = c[1];
        if (lon<minLon) minLon=lon; if (lon>maxLon) maxLon=lon;
        if (lat<minLat) minLat=lat; if (lat>maxLat) maxLat=lat;
      } else {
        visit(c);
      }
    }
  };
  if (geom.type === 'Polygon') visit(geom.coordinates);
  if (geom.type === 'MultiPolygon') visit(geom.coordinates);
  return [minLon, minLat, maxLon, maxLat];
}

function onMouseMove(e){
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  if (!globe) return;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(globe, true);
  if (!hits.length){ hideTooltip(); return; }
  const p = hits[0].point; // 世界坐标
  // 转到地球局部坐标，消除自转与地轴倾角的影响
  const lp = globe.worldToLocal(p.clone());
  // 转经纬（与贴图坐标一致的公式）
  const r = lp.length();
  const lat = 90 - Math.acos(lp.y / r) * 180/Math.PI;
  const thetaDeg = Math.atan2(lp.z, -lp.x) * 180/Math.PI; // (−180,180]
  const lon = ((thetaDeg + 360) % 360) - 180; // 归一到 [−180,180]
  if (!countries || !countryIndex){ hideTooltip(); return; }
  const feat = pickCountry(lat, lon);
  if (!feat){ hideTooltip(); return; }
  const countryName = feat.properties.name;
  const tzGuess = guessTimeZoneOffset(lon);
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  const localOffset = -new Date().getTimezoneOffset()/60;
  const diffHours = tzGuess - localOffset;
  const diffLabel = (Math.abs(diffHours) < 1e-6)? '相同' : (diffHours>0? `快 ${Math.abs(diffHours)} 小时` : `慢 ${Math.abs(diffHours)} 小时`);
  const wiki = `https://zh.wikipedia.org/wiki/${encodeURIComponent(countryName)}`;
  showTooltip(e.clientX, e.clientY, `
    <strong>${countryName}</strong><br/>
    经度 ${lon.toFixed(1)}°, 纬度 ${lat.toFixed(1)}°<br/>
    近似时区 UTC${formatOffset(tzGuess)}，与本机（${localTz}）时间：${diffLabel}<br/>
    <a href="${wiki}" target="_blank" rel="noopener">维基百科</a>
  `);
}

function pickCountry(lat, lon){
  const cand = countryIndex?.filter(c=> lon>=c.bbox[0] && lon<=c.bbox[2] && lat>=c.bbox[1] && lat<=c.bbox[3]) || [];
  for (const c of cand){ if (geoContains(c.feature, [lon, lat])) return c.feature; }
  for (const c of countryIndex||[]){ if (geoContains(c.feature, [lon, lat])) return c.feature; }
  return null;
}

function guessTimeZoneOffset(lon){
  // 经度估算时区（粗略）
  let off = Math.round(lon / 15);
  return Math.max(-12, Math.min(14, off));
}
function formatOffset(h){
  return (h>=0? '+'+h : String(h));
}
function showTooltip(x, y, html){
  if (!tooltipEl) return;
  tooltipEl.style.display = 'block';
  tooltipEl.innerHTML = html;
  const pad = 12;
  let left = x + 14, top = y + 14;
  const rect = tooltipEl.getBoundingClientRect();
  if (left + rect.width + pad > window.innerWidth) left = x - rect.width - 14;
  if (top + rect.height + pad > window.innerHeight) top = y - rect.height - 14;
  tooltipEl.style.left = left + 'px';
  tooltipEl.style.top = top + 'px';
}

function hideTooltip(){
  if (tooltipEl) tooltipEl.style.display = 'none';
}

function updateSunForCurrentInputs(){
  // 使用当前真实时间（UTC）进行太阳方向计算；时区仅影响显示
  const now = new Date();
  currentUTC = now;

  const s = sunDirectionECI(now);
  const dir = new THREE.Vector3(s.x, s.y, s.z).normalize();

  sunLight.position.copy(dir.clone().multiplyScalar(100));
  sunLight.target.position.set(0,0,0);
  sunHelper.setDirection(dir);

  // 更新材质与大气的光方向
  globe.material.uniforms.uLightDir.value.copy(dir);
  atmosphere.material.uniforms.uLightDir.value.copy(dir);
}

// 实时时钟：每秒更新显示，并驱动太阳方向（当用户未手动修改时间时）
function startClock(){
  if (clockTimer) clearInterval(clockTimer);
  const tick = ()=>{
    const now = new Date();
  if (clockEl) clockEl.textContent = formatTimeInTimeZone(now, params.timeZone);
    // 同步“时间”输入显示“现在”的秒动，且推送太阳更新
  const v = toISOInTimeZone(now, params.timeZone);
  params.dateLocalValue = v;
  updateSunForCurrentInputs();
  };
  tick();
  clockTimer = setInterval(tick, 1000);
}

// 简易 i18n 应用：根据 data-i18n 键替换文本
function applyI18n(){
  const dict = i18n[lang] || i18n.zh;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key && dict[key]) el.textContent = dict[key];
  });
}

// 将某个 Date 格式化为指定时区的 yyyy-MM-ddTHH:mm:ss 字符串（不改变该 Date 的绝对时刻）
function toISOInTimeZone(date, timeZone){
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const parts = fmt.formatToParts(date).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
    const y = parts.year.padStart(4,'0');
    const m = parts.month.padStart(2,'0');
    const d = parts.day.padStart(2,'0');
    const H = parts.hour.padStart(2,'0');
    const M = parts.minute.padStart(2,'0');
    const S = parts.second.padStart(2,'0');
    return `${y}-${m}-${d}T${H}:${M}:${S}`;
  } catch(e) {
    // 回退：本地格式
    return toISODateTimeLocal(date);
  }
}

// 将 Date 格式化为指定时区的 HH:MM:SS 文本
function formatTimeInTimeZone(date, timeZone){
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const parts = fmt.formatToParts(date).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
    const H = (parts.hour || '00').padStart(2,'0');
    const M = (parts.minute || '00').padStart(2,'0');
    const S = (parts.second || '00').padStart(2,'0');
    return `${H}:${M}:${S}`;
  } catch(e) {
    const hh = String(date.getHours()).padStart(2,'0');
    const mm = String(date.getMinutes()).padStart(2,'0');
    const ss = String(date.getSeconds()).padStart(2,'0');
    return `${hh}:${mm}:${ss}`;
  }
}

function animate(ts){
  requestAnimationFrame(animate);
  if (t0 === undefined) { t0 = ts; }
  const dt = (ts - t0)/1000; t0 = ts;

  // 自动相机环绕
  if (params.autoOrbit) {
    const az = 0.03 * dt; // 每秒约 0.03 弧度
    const r = controls.getDistance ? controls.getDistance() : camera.position.length();
    camera.position.applyAxisAngle(new THREE.Vector3(0,1,0), az);
    camera.lookAt(0,0,0);
  }

  // 地球自转（真实约 23h56m，这里加速）
  if (globe) {
    globe.rotation.y += 0.05 * dt;
  }

  controls.update();
  stars.visible = params.showStars;

  // 第一次或变更后更新太阳
  if (globe && globe.material && globe.material.uniforms && globe.material.uniforms.uLightDir && !globe.material.uniforms.uLightDir.value.lengthSq()) {
    updateSunForCurrentInputs();
  }

  composer.render();
}
