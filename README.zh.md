# 3D 爆炸破碎效果

受 [lukebaffait.fr](https://www.lukebaffait.fr/) 启发，基于 Three.js 和原生 JavaScript 构建的滚轮驱动 3D 破碎体验。

**萨莫色雷斯的胜利女神** —— 西方艺术史上最具代表性的雕塑之一 —— 以 GLB 模型加载，在运行时被分解为数百个网格碎片，随着鼠标向下滚动向外爆炸飞散。向上滚动可重新聚合还原。

---

## 演示

> 启动本地服务器后打开 `http://localhost:8080`（见下方）。

- **向下滚动** → 碎片向外爆炸飞散
- **向上滚动** → 碎片重新聚合还原为雕像
- 顶部进度条实时反映当前破碎程度

---

## 技术栈

| 技术 | 用途 |
|---|---|
| [Three.js r160](https://threejs.org/) | 3D 渲染引擎（WebGL） |
| GLTFLoader | 运行时加载 `.glb` 模型 |
| 原生 JS Wheel API | 滚轮驱动动画控制 |
| ACESFilmic 色调映射 | 电影级色彩分级 |

---

## 核心实现原理

### 1. 模型碎片化

加载 GLB 后，将所有子 Mesh 合并为单一 `BufferGeometry`，再按每 N 个三角面切分为约 400 个独立碎片 Mesh。每个碎片的顶点坐标相对于自身质心存储。

### 2. 滚轮 → 破碎

每个碎片存储两套状态：

```
assembledPos  — 在雕像上的原始位置
shatteredPos  — 爆炸后的目标位置（包围球半径的 3.5~7.5 倍向外）
```

滚轮累积 `scrollProgress`（0 → 1），每帧在两套状态间插值：

```js
mesh.position.x = lerp(assembledPos.x, shatteredPos.x, easedT);
```

### 3. 错开动画（Stagger）

每个碎片有随机 `delay`（0~0.25），破碎不同步，爆炸效果自然向外扩散。

### 4. 缓动函数

`easeInOutCubic` 让动画慢启动、快中段、软落地：

```js
function easeInOutCubic(t) {
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
}
```

---

## 快速开始

> 需要本地 HTTP 服务器，因为使用了 ES Module `importmap`。

```bash
# Python（内置）
cd "claude - 3d"
python -m http.server 8080

# Node.js
npx serve .
```

然后在浏览器打开 `http://localhost:8080`。

---

## 项目结构

```
3D-Explosion-Effect/
├── index.html      # 页面结构 + importmap（Three.js via CDN）
├── style.css       # 暗色主题、标题动画、进度条
├── main.js         # Three.js 场景、碎片化逻辑、滚轮控制
├── statue.glb      # 萨莫色雷斯的胜利女神（3D 模型）
├── README.md       # 英文
├── README.fr.md    # 法文
└── README.zh.md    # 中文（本文件）
```

---

## 进阶扩展

| 想法 | 实现方式 |
|---|---|
| 真实 Voronoi 破碎 | 使用 `three-mesh-bvh` + Voronoi 单元分解 |
| 泛光效果 | 添加 Three.js 后处理 `UnrealBloomPass` |
| 物理模拟 | 接入 `cannon-es` 或 `rapier` 实现重力与碰撞 |
| GSAP ScrollTrigger | 替换原生滚轮监听，与页面滚动条更流畅联动 |
| 替换模型 | 将 `statue.glb` 换成任意 GLB，碎片化逻辑与模型无关 |

---

## 许可证

MIT
