// Three.js 场景封装：构建太阳+行星、轨道线、拾取、相机聚焦、Bloom（可选）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';

export class SolarScene {
  constructor({ container, enableBloom = false }) {
    this.container = container;
    this.enableBloom = enableBloom;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // 摄像机
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 20000);
    this.camera.position.set(0, 260, 520);

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  // 更电影化的色调映射
  this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  this.renderer.toneMappingExposure = 1.0;
    this.canvas = this.renderer.domElement;
    container.appendChild(this.canvas);

    // 移动端降级：限制像素比、禁用抗锯齿的额外开销
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const pr = isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(pr);

    // 轨道控制器
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxDistance = 6000;
    this.controls.minDistance = 20;

    // 后处理（可选）
  this.composer = null;
  this.bloomPass = null;
  this.fxaaPass = null;
  this.afterimagePass = null;
  this.filmPass = null;
  this.enableCinematic = false;

    // 数据
    this.SUN = null;
    this.PLANETS = [];
    this.SCALE = { distance: 1e-6, radius: 1e-3, sunRadiusMultiplier: 0.25 };

    // 网格/对象缓存
    this.planetMap = new Map(); // name -> { mesh, data, distanceU, radiusU }
    this.orbitLines = []; // THREE.Line 循环
    this.baseSphereGeo = new THREE.SphereGeometry(1, 32, 16); // 复用几何
    this.raycaster = new THREE.Raycaster();
    this.mouseNDC = new THREE.Vector2();

    // 太阳光源
    this.sunLight = new THREE.PointLight(0xfff6b0, 2, 0, 2); // 强度稍高用于 Bloom
    this.sunMesh = null;

    // 相机聚焦动画
    this._focusAnim = null; // { t, dur, fromPos, toPos, fromTarget, toTarget }
  }

  init() {
    this.resize();
    // 环境弱光，增强材质可见性
    const ambient = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambient);
    // 太阳光
    this.sunLight.position.set(0, 0, 0);
    this.scene.add(this.sunLight);

    // 稀疏星空（点云）
    const stars = this._makeStars(2000, 8000);
    this.scene.add(stars);

    // 后处理初始化
    this._setupPostprocessing(this.enableBloom);
  }

  buildSystem(SUN, PLANETS, SCALE) {
    this.SUN = SUN; this.PLANETS = PLANETS; this.SCALE = SCALE;

    // 太阳
    const sunRadiusU = SUN.radiusKm * SCALE.radius * SCALE.sunRadiusMultiplier;
    const sunGeo = this.baseSphereGeo;
    const sunMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(SUN.color) });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.name = SUN.name;
    sun.scale.setScalar(Math.max(1e-3, sunRadiusU));
    this.scene.add(sun);
    this.sunMesh = sun;

    // 行星与轨道
    for (const p of PLANETS) {
      const radiusU = p.radiusKm * SCALE.radius;
      const distU = p.distanceKm * SCALE.distance;

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(p.color),
        roughness: 0.9,
        metalness: 0.0,
        emissive: new THREE.Color(p.color).multiplyScalar(0.02),
      });
      const mesh = new THREE.Mesh(this.baseSphereGeo, mat);
      mesh.name = p.name;
      mesh.scale.setScalar(Math.max(1e-3, radiusU));
      // 初始位置在 +X 方向（后续 update 按 theta 更新）
      mesh.position.set(distU, 0, 0);
      this.scene.add(mesh);

      this.planetMap.set(p.name, {
        mesh, data: p, distanceU: distU, radiusU: radiusU,
      });

      // 轨道线（XZ 平面）
      const line = this._makeOrbitCircle(distU, new THREE.Color(p.color).convertLinearToSRGB().multiplyScalar(0.6));
      this.scene.add(line);
      this.orbitLines.push(line);
    }
  }

  setOrbitsVisible(visible) {
    for (const l of this.orbitLines) l.visible = visible;
  }

  setBloomEnabled(enabled) {
    this.enableBloom = enabled;
    this._setupPostprocessing(this.enableBloom || this.enableCinematic);
  }

  setCinematic(enabled) {
    // 电影模式：启用 Bloom + FXAA + Afterimage(拖影) + FilmPass(颗粒/扫描线)
    this.enableCinematic = enabled;
    this._setupPostprocessing(this.enableBloom || this.enableCinematic);
  }

  _setupPostprocessing(enabled) {
    // 清理旧 composer
    if (this.composer) {
      this.composer = null; this.bloomPass = null; this.fxaaPass = null; this.afterimagePass = null; this.filmPass = null;
    }

    if (!enabled) return;

    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const composer = new EffectComposer(this.renderer);
    composer.setSize(size.x, size.y);

    const rp = new RenderPass(this.scene, this.camera);
    composer.addPass(rp);

    // Bloom（若开启 Bloom 或 电影模式则启用）
    if (this.enableBloom || this.enableCinematic) {
      // UnrealBloomPass 参数：分辨率, 强度, 半径, 阈值
      const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.8, 0.9, 0.25);
      composer.addPass(bloom);
      this.bloomPass = bloom;
    }

    if (this.enableCinematic) {
      // FXAA 抗锯齿（在后处理中更稳定）
      const fxaa = new ShaderPass(FXAAShader);
      fxaa.material.uniforms['resolution'].value.set(1 / size.x, 1 / size.y);
      composer.addPass(fxaa);
      this.fxaaPass = fxaa;

      // 轻微拖影（Afterimage），用于“片头感”的平滑残影
      const after = new AfterimagePass(0.92); // 0.92 保留较多前帧，产生柔和拖影
      composer.addPass(after);
      this.afterimagePass = after;

      // 轻颗粒与扫描线（FilmPass），颗粒强度与扫描线频率较低
      const film = new FilmPass(0.15, 0.025, 648, false);
      composer.addPass(film);
      this.filmPass = film;
    }

    this.composer = composer;
  }

  // 每帧更新
  update(dt, simulationDays) {
    // 太阳轻微脉动（强度/颜色缓慢波动）
    const t = simulationDays * 0.02;
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
    this.sunLight.intensity = 1.8 + pulse * 0.7;
    if (this.sunMesh && this.sunMesh.material && this.sunMesh.material.color) {
      const base = new THREE.Color(this.SUN.color);
      const c = base.clone().multiplyScalar(1 + pulse * 0.15);
      this.sunMesh.material.color.copy(c);
    }

    // 行星圆形轨道角度：
    // 角速度 ω = 2π / T_scaled，此处 T_scaled 为真实周期（天）
    // θ(t) = simulationDays * 2π / periodDays
    for (const [name, obj] of this.planetMap) {
      const p = obj.data;
      const theta = simulationDays / p.periodDays * Math.PI * 2;
      const x = Math.cos(theta) * obj.distanceU;
      const z = Math.sin(theta) * obj.distanceU;
      obj.mesh.position.set(x, 0, z);
    }

    // 相机聚焦动画（位置/目标 lerp）
    if (this._focusAnim) {
      const a = this._focusAnim;
      a.t = Math.min(a.t + dt, a.dur);
      const k = a.t / a.dur;
      const e = easeInOutQuad(k);
      this.camera.position.lerpVectors(a.fromPos, a.toPos, e);
      const target = new THREE.Vector3().lerpVectors(a.fromTarget, a.toTarget, e);
      this.controls.target.copy(target);
      if (a.t >= a.dur) this._focusAnim = null;
    }

    this.controls.update();

    // 渲染
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // 拾取：输入 NDC(-1..1) 坐标
  pickPlanet(ndcX, ndcY) {
    this.mouseNDC.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const meshes = Array.from(this.planetMap.values()).map(v => v.mesh).concat(this.sunMesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    const mesh = hits[0].object;
    const name = mesh.name;
    if (name === this.SUN.name) {
      // 点击太阳也返回
      return { name, data: {
        ...this.SUN,
        // 对齐数据字段命名
        radiusKm: this.SUN.radiusKm,
        distanceKm: 0,
        periodDays: 0,
        wikiUrl: this.SUN.wikiUrl,
        imageUrl: this.SUN.imageUrl,
        color: this.SUN.color,
        infoText: this.SUN.infoText,
      }};
    }
    const entry = this.planetMap.get(name);
    return { name, data: entry.data };
  }

  // 相机聚焦到指定行星
  focusOn(name) {
    const targetPos = (name === this.SUN.name)
      ? new THREE.Vector3(0, 0, 0)
      : this.planetMap.get(name)?.mesh.position.clone();

    if (!targetPos) return;

    const fromPos = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();

    // 计算到目标的理想观察距离：行星半径的若干倍
    let radiusU = 50;
    if (name === this.SUN.name) {
      radiusU = this.SUN.radiusKm * this.SCALE.radius * this.SCALE.sunRadiusMultiplier;
    } else {
      radiusU = this.planetMap.get(name).radiusU;
    }
    const back = new THREE.Vector3().subVectors(fromPos, targetPos).normalize();
    if (!isFinite(back.length())) back.set(0, 0.6, 0.8).normalize();

    const distance = Math.max(10, radiusU * 10) + 8;
    const toPos = new THREE.Vector3().addVectors(targetPos, back.multiplyScalar(distance));

    // 聚焦动画参数
    this._focusAnim = {
      t: 0,
      dur: 1.4, // 秒
      fromPos, toPos,
      fromTarget, toTarget: targetPos,
    };
  }

  // 轨道圆环（LineLoop）
  _makeOrbitCircle(radius, color) {
    const segs = Math.max(64, Math.min(256, Math.floor(radius * 6)));
    const geo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < segs; i++) {
      const a = i / segs * Math.PI * 2;
      pts.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 });
    const line = new THREE.LineLoop(geo, mat);
    return line;
  }

  _makeStars(count, radius) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // 随机球壳
      const r = radius * (0.6 + 0.4 * Math.random());
      const u = Math.random(); const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);
      pos[i*3+0] = x; pos[i*3+1] = y; pos[i*3+2] = z;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: true, transparent: true, opacity: 0.85 });
    return new THREE.Points(geo, mat);
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setSize(w, h);
      if (this.fxaaPass) this.fxaaPass.material.uniforms['resolution'].value.set(1 / w, 1 / h);
    }
  }
}

function easeInOutQuad(t) { return t < 0.5 ? 2*t*t : -1 + (4 - 2*t) * t; }
