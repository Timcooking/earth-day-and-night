// clouds.js — 半透明云层系统：多层噪声贴图平面，支持穿透散开动画
// 优先使用 Canvas 生成的 FBM（多倍频）值噪声纹理，细腻柔和；
// 当相机穿过云层高度附近时，对应云层透明度降低与缩放轻微变化，呈现“散开”。

import * as THREE from 'three';

// 2D 随机梯度哈希（可重复）
function hash2d(x, y, seed = 43758.5453) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453123;
  return s - Math.floor(s);
}

// 2D 值噪声（双线性插值）
function valueNoise2D(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf); // smoothstep
  const v = yf * yf * (3 - 2 * yf);
  const n00 = hash2d(xi, yi);
  const n10 = hash2d(xi + 1, yi);
  const n01 = hash2d(xi, yi + 1);
  const n11 = hash2d(xi + 1, yi + 1);
  const nx0 = n00 * (1 - u) + n10 * u;
  const nx1 = n01 * (1 - u) + n11 * u;
  return nx0 * (1 - v) + nx1 * v; // [0,1]
}

// FBM：多八度叠加，频率倍增/振幅递减
function fbm2D(x, y, octaves = 5, lacunarity = 2.0, gain = 0.5) {
  let amp = 0.5; let freq = 1.0; let sum = 0.0; let totalAmp = 0.0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2D(x * freq, y * freq) * amp;
    totalAmp += amp;
    freq *= lacunarity;
    amp *= gain;
  }
  return sum / totalAmp; // [0,1]
}

function makeFBMCanvas(size = 512, octaves = 5) {
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(size, size);

  // 频率缩放：控制云朵大小
  const scale = 2.2; // 越大越密集

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * scale;
      const fy = (y / size) * scale;
      let n = fbm2D(fx, fy, octaves, 2.0, 0.55); // 柔和些
      // 对比度与曲线，形成软云（避免块状）
      n = Math.pow(n, 1.4);
      const alpha = Math.min(255, Math.max(0, Math.floor(n * 255)));
      const i = (y * size + x) * 4;
      img.data[i] = 255;      // 白
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = alpha; // 透明度由噪声决定
    }
  }
  ctx.putImageData(img, 0, 0);
  return cvs;
}

export class CloudsSystem {
  constructor({ scene, count = 5, radius = 260, towerHeight = 500, noiseSpeed = 0.015 }) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.layers = [];
    this.time = 0;
    this.noiseSpeed = noiseSpeed;

    // 降级策略：移动端/低内存 → 降低分辨率与八度
    const isLow = (navigator.deviceMemory && navigator.deviceMemory <= 4) || /Mobile|Android|iOS/i.test(navigator.userAgent);
    if (isLow) count = Math.max(3, Math.floor(count * 0.6));

    const texSize = isLow ? 256 : 512;
    const octaves = isLow ? 4 : 6;
    const canvasTex = new THREE.CanvasTexture(makeFBMCanvas(texSize, octaves));
    canvasTex.wrapS = canvasTex.wrapT = THREE.RepeatWrapping;
    canvasTex.anisotropy = 4;
    canvasTex.needsUpdate = true;

    for (let i = 0; i < count; i++) {
      const h = (i + 1) / (count + 1) * towerHeight; // 均匀分布
      const g = new THREE.PlaneGeometry(radius * 2, radius * 2, 1, 1);
      const m = new THREE.MeshBasicMaterial({
        map: canvasTex,
        color: new THREE.Color(0xf6fbff), // 略偏蓝的白色，增强对比
        opacity: 0.75, // 提高基础可见度
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(g, m);
      mesh.rotation.x = -Math.PI / 2; // 水平
      mesh.position.y = h;

      // 由多片组成厚层，彼此有轻微旋转与偏移，打散重复感
      const sub = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const mm = mesh.clone();
        mm.material = m.clone();
        mm.position.x = (k % 2 === 0 ? -1 : 1) * (radius * 0.22 + Math.random() * radius * 0.3);
        mm.position.z = (k < 2 ? -1 : 1) * (radius * 0.22 + Math.random() * radius * 0.3);
        mm.rotation.z = Math.random() * Math.PI * 2;
        sub.add(mm);
      }

      const layer = {
        group: sub,
        height: h,
        radius,
        offset: new THREE.Vector2(Math.random(), Math.random()),
        scrollFactor: 0.2 + Math.random() * 0.3, // 各层流速不同
      };
      this.layers.push(layer);
      this.group.add(sub);
    }

    scene.add(this.group);
  }

  update(dt, cameraY) {
    this.time += dt;
    for (const layer of this.layers) {
      const near = 140; // 穿透影响范围扩大，过渡更柔
      const dy = Math.abs(cameraY - layer.height);
      const t = THREE.MathUtils.clamp(1 - dy / near, 0, 1);
      const alphaMul = THREE.MathUtils.lerp(1.0, 0.35, t); // 穿透时降低到 ~0.26（配合基数 0.75）
      const scale = THREE.MathUtils.lerp(1.0, 1.1, t);   // 略微放大

      for (const mm of layer.group.children) {
        const mat = mm.material;
        mat.opacity = 0.75 * alphaMul;
        mm.scale.set(scale, 1, scale);
        if (mat.map) {
          mat.map.offset.x = (this.time * this.noiseSpeed * layer.scrollFactor + layer.offset.x) % 1;
          mat.map.offset.y = (this.time * this.noiseSpeed * 0.65 * layer.scrollFactor + layer.offset.y) % 1;
          // 轻微缩放打散重复
          const rep = 1.6 + Math.sin(this.time * 0.05 + layer.offset.x * 6.283) * 0.15;
          mat.map.repeat.set(rep, rep);
        }
      }
    }
  }
}
