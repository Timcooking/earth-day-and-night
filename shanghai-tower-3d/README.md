# 上海中心大厦 3D 模型展示（静态网页）

基于 Three.js 的纯前端项目，通过实例化网格构建近似的 128 层高楼模型，支持滚轮/触摸滑动浏览高度、穿透云层动画，以及点击楼层弹出介绍卡片。无需打包工具，直接在浏览器中打开即可运行。

## 功能概览
- 3D 模型：用 InstancedMesh 渲染 128 层，顶部收分近似上海中心外形。
- 交互滚动：滚轮/触摸/键盘切换高度，平滑插值映射到相机 Y。
- 云层效果：多层半透明平面使用 Canvas 噪声纹理，靠近时云层散开、透明度降低。
- 楼层介绍：Raycaster 点击实例得到楼层号，显示模态信息卡，支持图片占位。
- UI/UX：侧边楼层导航、顶部进度与当前楼层/高度指示，响应式布局。
- 性能：实例化绘制、移动端降级云层层数，关闭阴影，限制细分。

## 项目结构
```
shanghai-tower-3d/
  index.html         # 入口页面
  styles.css         # 样式与渐变背景
  main.js            # 入口脚本，场景初始化/循环/交互
  model.js           # 塔体实例化模型与高亮
  clouds.js          # 云层系统（噪声纹理 + 穿透散开）
  ui.js              # 侧边导航、模态框、进度条
  data/
    floors.js        # 楼层示例数据（可扩展）
  assets/            # 占位资源目录（可替换图片/贴图）
  README.md
```

## 运行方式（无需打包）
- 方法 A：直接双击 `index.html` 用浏览器打开（推荐 Chrome/Edge 最新版）。
- 方法 B：VS Code + Live Server
  1. 在 VS Code 打开本文件夹。
  2. 安装并启用 Live Server 扩展。
  3. 右键 `index.html` 选择 "Open with Live Server"。

> 注意：本项目使用 ES Modules 直接从 CDN 加载 three 与 OrbitControls，确保浏览器允许模块跨域加载（Live Server 默认可用）。

## 替换模型 / 贴图
- 楼层图片：在 `data/floors.js` 为每个楼层的 `image` 提供 URL 或 base64，即可在模态中显示。
- 云层纹理：当前用 Canvas 生成噪声，无需外部贴图。如需更真实云，可将 `clouds.js` 中的 `makeNoiseCanvas` 换为图片纹理（如远景云），并设置 wrap/repeat。
- 模型外观：修改 `model.js` 的颜色、金属度、粗糙度与顶部收分参数 `taper`。如需用真实 glTF 模型，见下文。

## 扩展楼层数据
- 在 `data/floors.js` 中以层号为键添加条目：
```js
export const FLOORS = {
  1: { name: '大堂与商业', type: '商业配套', description: '...', image: '...可选...' },
  2: { name: '会议中心', type: '会议', description: '...', image: '' },
  // ... 其余楼层
};
```
- 未定义的楼层 UI 会显示占位文本。

## 已知限制与优化建议
- 模型是几何近似，未包含真实扭转/双层幕墙等细节。
- 云层为 2D 平面叠加与噪声动画，非体积云；可改为粒子或体积噪声以提升真实感（成本更高）。
- 移动端默认降级云层层数与关闭阴影；如仍卡顿，可进一步减少实例数或降低像素比。
- Raycaster 对 InstancedMesh 的点击在部分设备上需要确保 WebGL2 支持；否则可退化为近似拾取。
- 进度映射使用 smoothstep，滚动加速度可根据需要调整（`main.js` 中常量）。

## 可选：切换到 npm + Vite + glTF 模型
如果需要使用真实 glTF 模型与打包：
1. 初始化项目：
```bash
npm create vite@latest shanghai-tower-3d -- --template vanilla
cd shanghai-tower-3d
npm i three
```
2. 在源码中：
- 将 `import` 改为 `import * as THREE from 'three'`，OrbitControls 从 `three/examples/jsm/...` 引入。
- 使用 `GLTFLoader` 加载 `assets/shanghai-tower.glb`（请确保模型版权与授权）。
3. 运行与构建：
```bash
npm run dev
npm run build
```

> TODO: 如需替换为真实 glTF 模型，请将文件放置在 `assets/` 并在新工程中用 GLTFLoader 加载；注意对模型材质进行简化以兼顾性能。

## 许可与素材
- 代码可自由用于学习与演示。
- 图片/模型若替换为第三方资源，请确保拥有使用授权与署名要求。
