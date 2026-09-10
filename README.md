# FUEL · 每日营养

把每日摄入变成一座会响应的营养反应堆。基于用户提供的 Vue 营养记录页面重新设计，保留 16 种食物的每 100 g 数值，以及蛋白质 140 g、碳水 130 g、脂肪 55 g 的目标。

## 使用

- 选择食物、输入实际克数、点击「记入今日」。支持小数克数、快捷份量和删除记录。
- 三条轨道的实心填充分别表示三种营养素的目标完成度；细小游动亮点和外围碎片是装置动效，不代表额外摄入。
- 点击「进入能量场」进入沉浸视图。可以拖动旋转、滚轮或按钮缩放、暂停、复位、展开／重组核心，或播放能量脉冲。脉冲仅播放视觉效果，不修改记录。
- 能量为 4 × 蛋白质 + 4 × 碳水 + 9 × 脂肪的估算。食物数值原样沿用，未替换为网络食物库。
- 数据只存在当前浏览器的 `food-tracker` localStorage 中；不同域名或设备不会同步。同域可兼容原有记录格式；直接打开旧本地 HTML 的浏览器数据不会自动跨域迁移。
- 根据本机日期切换当天，页面恢复焦点及记录前也会检查日期。刷新从记录重新计算摄入，避免增减累积误差。损坏数据另存 `food-tracker-backup`。

## 开发

Node.js 22.12+。

```sh
npm ci
npm run dev
npm test
npm run build
```

Vue 3 + Vite + Three.js。源码沿用原页面的 Vue 技术路线。本地入口 `src/App.vue`，营养计算 `src/nutrition.js`，三维场景 `src/orbit.js`。

## Blender 工程

- `art/fuel-core.blend`：可编辑源工程，保存于加入预览相机灯光之前。
- `art/build_core.py`：可重复生成的建模脚本，全部几何为本项目原创。
- `public/models/fuel-core.glb`：网页模型，约 627 KiB。
- `art/core-preview.png`：Blender 渲染检查图，不代表浏览器截图。

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python art/build_core.py
```

核心包含晶体光学外壳、发光内芯、金属支架、紧固件、双层万向环与三色卫星。轨道、漂浮碎片和注入粒子在 Three.js 中实时生成。手机使用较小渲染比例；场景离屏、页面隐藏、打开沉浸视图后暂停背景场景；尊重系统减少动态效果偏好，提供 WebGL 不可用时的二维进度视图。

## 验证与边界

已运行 Node 测试覆盖食物数据一致性、份量计算、删除重算、异常输入、本地跨日、原格式恢复、损坏数据、超出目标，以及 Three.js 几何与真实 GLB 加载。Blender 源工程和预览图由本机 Blender 5.2.1 生成。

已编译页面和完整生产包。未执行浏览器 UI 截图或人工交互验收，不将构建成功当作实际帧率或视觉验收。

WebMCP 在支持 `document.modelContext` 的浏览器中可注册读取、添加和删除工具。工具与页面共用状态和操作，已做模拟注册表下的单元契约验证；本环境未建立真实支持 WebMCP 的浏览器验证上下文，不宣称真实浏览器工具验证完成。

## 来源

详见 `ATTRIBUTIONS.md` 和 `art/IMAGE_PROMPT.md`。原始上传页面保存在 `reference/original.html`，不发布到网站静态资源。
