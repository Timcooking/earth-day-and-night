# 太阳系 3D 模拟器（纯静态版）

基于 Three.js ES Module 的简化太阳系可视化，用鼠标/触控旋转、缩放，顶栏控制仿真时间（播放/暂停、加减速、步进、进度滑杆），支持点击行星查看信息并相机平滑聚焦。可选开启 Bloom 效果；移动端自动降级像素比以提升性能。

## 文件结构
- index.html — 页面骨架与 UI
- styles.css — 页面样式
- js/main.js — 入口：状态、循环、UI/场景协调
- js/scene.js — Three.js 场景与行星/轨道/拾取/聚焦/Bloom
- js/ui.js — 顶部控制条与信息卡、键盘辅助
- data/planets.js — 行星/太阳数据（真实值）与缩放因子
- README.md — 使用说明与注意事项

## 缩放策略
为兼顾可视性与性能，使用以下缩放：
- 距离缩放 distanceScale = 1e-6（1,000,000:1）
- 半径缩放 radiusScale = 1e-3（1,000:1）
- 太阳半径额外乘 sunRadiusMultiplier = 0.25（避免太阳过大遮挡内轨道）

角速度计算（圆形简化）：
- 对每颗行星：θ(t) = t · 2π / periodDays
- 其中 t 为“模拟天数”，periodDays 为真实公转周期（地球日）
- 主循环：simulationDays += deltaSeconds · baseSimDaysPerSecond · timeScale

时间进度滑杆：
- 以“地球年”365.25 天为基准，将 simulationDays 取模映射到 [0,1] 进度。

相机平滑聚焦：
- 使用自写插值（easeInOutQuad）对 camera.position 与 controls.target 进行时长约 1.4s 的插值动画。

## 如何在本地运行
1. 在 VS Code 打开项目文件夹 `solar-3d-simulator/`。
2. 安装并启动 Live Server 扩展（右键 `index.html` → “Open with Live Server”）。
3. 浏览器自动打开页面；如未自动打开，访问类似 `http://127.0.0.1:5500/solar-3d-simulator/`。
4. 鼠标拖拽旋转视角，滚轮缩放；顶部 UI 控制时间与效果；点击任一行星弹出信息卡并自动聚焦。

可选命令行（Windows PowerShell，仅当你需要本地静态服务时）：
```
# 若已安装 Python
python -m http.server 5500
# 然后浏览器访问 http://127.0.0.1:5500/solar-3d-simulator/
```

## 替换贴图/图片
- 当前为“颜色”材质渲染球体，信息卡图片为 SVG base64 占位（`imageUrl: 'auto'`）。
- 若要使用真实贴图：
  - 在 `data/planets.js` 中将某行星的 `imageUrl` 改为你的图片 URL（建议使用 HTTPS 的公开静态链接）。
  - 如需贴图到球体表面，可在 `js/scene.js` 中为该行星创建 `THREE.TextureLoader()` 加载纹理，并将 `MeshStandardMaterial` 的 `map` 设置为该纹理（注意跨域与版权）。
- 如果需要本地图片，请将图片放在 `assets/` 目录并通过相对路径引用，确保通过 Live Server 访问。

## 已知限制与说明
- 轨道为圆形简化，不包含偏心率、轨道倾角与章动等真实天体力学细节。
- 太阳半径人为缩小（`sunRadiusMultiplier`）以获得更好的视图构图。
- 不包含自转、卫星系统与环（如土星环）；可在数据层与场景构建中扩展。
- Bloom 效果在低端/移动设备上可能性能欠佳，默认关闭，可通过 UI 开启。
- 采用单一共享球体几何（通过缩放控制大小）以减少几何开销。
- 信息卡数据简述来自常识性概述，详细请参考外链。
- 由于使用 CDN 导入 ES Modules，请通过本地服务器（如 Live Server）访问，避免跨源或 file:// 访问限制。
- 不启用阴影（开销较大且对当前视觉收益有限）。

## 开发者提示（改进点与坑）
1. 想更逼真：为每颗行星加入各自轨道倾角与偏心率，位置由椭圆参数与近点角推进计算。
2. 引入自转：给每颗行星增加自转周期，mesh.rotation.y 基于模拟时间推进。
3. 贴图与法线：为地球、木星等加载高分辨率贴图与法线贴图，注意跨域与版权。
4. 太阳外发光：在 Bloom 基础上可加 `Sprite` 或屏幕空间 `god rays` 效果（性能权衡）。
5. 性能优化：将星空点云缓冲到单一 `BufferGeometry`（已做），必要时降低星点数量或关闭。
6. UI 拓展：增加“重置相机”、保存/恢复视角、行星筛选与定位快捷入口。
7. 数值稳定性：长时间后台时对 dt 设上限（已做），避免大步长导致穿越；也可在恢复时分多帧补偿推进。
8. 时间轴：若需“全系统周期”进度，可用行星周期的近似最小公倍数或更长基准代替地球年。
9. 尺度参数：不同显示器/场景初始构图可微调 `distanceScale`、`radiusScale`、相机远近裁剪面与初始位置。
10. 交互拾取：可加 `outline` 或 `ring` 高亮选中目标，并在信息卡显示当前“相机与行星距离”。
