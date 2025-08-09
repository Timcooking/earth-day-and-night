// model.js — 上海中心风格的塔体：128 层实例化渲染
// 采用 InstancedMesh 以提高性能，并提供楼层高度映射与高亮接口。

import * as THREE from 'https://unpkg.com/three@0.153.0/build/three.module.js';

export const TOWER_PARAMS = {
  layerCount: 128,
  layerHeightMeters: 3.9,
  unitScale: 1,
  baseSize: { x: 80, z: 80 },
  taper: 0.45,
  color: 0xbfd8ff,         // 更亮的蓝白色
  highlightColor: 0xffb84d,
  twistRadians: 2.2, // 自底向顶总扭转角（约126°）
};
TOWER_PARAMS.totalHeight = TOWER_PARAMS.layerCount * TOWER_PARAMS.layerHeightMeters * TOWER_PARAMS.unitScale;

export function createTowerInstanced(layerCount = TOWER_PARAMS.layerCount) {
  const group = new THREE.Group();

  // 使用圆盘（圆柱）作为每一层的楼板，避免方块感
  const thickness = 1.2; // 更薄以减少硬边
  const radialSegments = 32; // 圆滑程度（适度）
  const geom = new THREE.CylinderGeometry(1, 1, thickness, radialSegments, 1, false);

  const mat = new THREE.MeshStandardMaterial({
    color: TOWER_PARAMS.color,
    metalness: 0.25,
    roughness: 0.25,
    opacity: 0.96,
    transparent: true,
    envMapIntensity: 0.35,
    emissive: 0x98c7ff,
    emissiveIntensity: 0.06,
  });

  const instancedMesh = new THREE.InstancedMesh(geom, mat, layerCount);
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < layerCount; i++) {
    const ratio = i / (layerCount - 1);
    // 半径从底到顶收分
    const radius = THREE.MathUtils.lerp(TOWER_PARAMS.baseSize.x * 0.5, TOWER_PARAMS.baseSize.x * 0.5 * TOWER_PARAMS.taper, ratio);
    const rZ = THREE.MathUtils.lerp(TOWER_PARAMS.baseSize.z * 0.5, TOWER_PARAMS.baseSize.z * 0.5 * TOWER_PARAMS.taper, ratio);

    // 扭转角（自底向顶逐渐旋转）
    const twist = TOWER_PARAMS.twistRadians * ratio;

    dummy.position.set(0, i * (TOWER_PARAMS.layerHeightMeters * TOWER_PARAMS.unitScale), 0);
    dummy.rotation.set(0, twist, 0);
    // 非等比缩放实现椭圆截面（略微拉伸），更接近真实外廓
    dummy.scale.set(radius, 1, rZ);
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(i, dummy.matrix);

    // 颜色渐变（蓝白色调），自下而上更亮
    const c = new THREE.Color().setHSL(0.58 - ratio * 0.06, 0.35, 0.72 + ratio * 0.06);
    instancedMesh.setColorAt(i, c);
  }

  instancedMesh.computeBoundingSphere();
  instancedMesh.computeBoundingBox?.();
  group.add(instancedMesh);

  // 浅色基座
  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(TOWER_PARAMS.baseSize.x * 0.65, TOWER_PARAMS.baseSize.x * 0.65, 2, 48),
    new THREE.MeshStandardMaterial({ color: 0xe9eef7, roughness: 0.95, metalness: 0 })
  );
  ground.position.y = -2.0;
  group.add(ground);

  // 辅助：返回某层中心的 Y 高度
  function getFloorY(index /* 1-based or 0-based? */) {
    const zero = Math.max(0, (typeof index === 'number' ? index - 1 : 0));
    return zero * (TOWER_PARAMS.layerHeightMeters * TOWER_PARAMS.unitScale);
  }
  function getFloorIndexFromY(y) {
    const idx = Math.round(y / (TOWER_PARAMS.layerHeightMeters * TOWER_PARAMS.unitScale));
    return THREE.MathUtils.clamp(idx + 1, 1, layerCount);
  }

  return { group, instancedMesh, getFloorY, getFloorIndexFromY };
}

// 高亮某个楼层（修改其 instanceColor），传入 -1 取消
let lastHighlighted = -1;
export function highlightInstance(instancedMesh, index /* 0-based */) {
  if (!instancedMesh) return;
  if (lastHighlighted >= 0) {
    // 复位上一个（使用原始颜色；这里简单重算 HSL 渐变）
    const i = lastHighlighted;
    const ratio = i / (instancedMesh.count - 1);
    const c = new THREE.Color().setHSL(0.58 - ratio * 0.06, 0.35, 0.72 + ratio * 0.06);
    instancedMesh.setColorAt(i, c);
  }
  if (index >= 0 && index < instancedMesh.count) {
    instancedMesh.setColorAt(index, new THREE.Color(TOWER_PARAMS.highlightColor));
  }
  instancedMesh.instanceColor.needsUpdate = true;
  lastHighlighted = index;
}
