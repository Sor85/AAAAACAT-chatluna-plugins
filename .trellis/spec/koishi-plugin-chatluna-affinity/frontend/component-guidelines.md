# Component Guidelines

> How components are built in this project.

---

## Overview

<!--
Document your project's component conventions here.

Questions to answer:
- What component patterns do you use?
- How are props defined?
- How do you handle composition?
- What accessibility standards apply?
-->

(To be filled by the team)

---

## Component Structure

<!-- Standard structure of a component file -->

(To be filled by the team)

---

## Props Conventions

<!-- How props should be defined and typed -->

(To be filled by the team)

---

## Styling Patterns

<!-- How styles are applied (CSS modules, styled-components, Tailwind, etc.) -->

(To be filled by the team)

---

## Accessibility

<!-- A11y requirements and patterns -->

(To be filled by the team)

---

## Common Mistakes

<!-- Component-related mistakes your team has made -->

(To be filled by the team)

## Koishi 控制台 WebUI 页面

### 1. 范围 / 触发

- 触发：插件需要在 Koishi 控制台侧栏增加独立页面，或需要通过控制台 RPC 读取插件只读数据。
- 适用范围：`client/index.ts` 的 `ctx.page()`、服务端 `ctx.console.addEntry()` / `addListener()`、Vue 页面壳、React/shadcn/ui 页面实现。

### 2. 签名

- 服务端 entry：`ctx.console.addEntry({ dev: string, prod: string })`。
- 客户端侧栏页：`ctx.page({ id, path, name, icon, order, authority, component })`。
- 控制台 RPC：`ctx.console.addListener(event, callback, { authority })` 与前端 `send(event)` 必须使用同一个事件名。

### 3. 契约

- `package.json` 必须声明 `koishi.browser: true` 和 `koishi.public: ["dist"]`，否则控制台无法稳定发现前端产物。
- 服务端 entry 的 `dev` 指向 `client/index.ts`，`prod` 指向 `dist`。
- React 页面不能直接作为 `ctx.page().component` 传入；`component` 必须是 Vue 组件，React 只能在 Vue 外壳中通过 `createRoot()` 挂载。
- React 构建必须在 Vite 中内联 `"process.env.NODE_ENV"`，Koishi 控制台浏览器环境不会提供 Node 的 `process`。
- shadcn/ui 页面使用 Tailwind CSS v4 编译；Vite 必须启用 `@tailwindcss/vite`，否则 `dist/style.css` 可能残留浏览器不认识的 `@apply`。
- shadcn/ui 组件若仓库没有统一 `components.json`，可在插件 `client/components/ui/` 内按需放置最小 registry 组件副本，页面只组合这些 UI primitives，不把它们抽成跨插件共享层。
- 控制台仪表盘需要 SVG 图标时优先使用 `@tabler/icons-react`，避免手写 SVG 或 CSS 图标。
- 排行页的单人历史曲线优先以内嵌展开行呈现，和对应用户数据保持在同一张表里，避免表外独立面板造成列对齐偏移。

### 4. 校验与错误矩阵

- 缺少必需服务导致插件 `apply()` 不执行 -> 侧栏不会出现入口；先看 Koishi 日志中是否出现插件自己的初始化日志。
- 只有 `plugin-details` slot -> 只会出现在插件配置详情页，不会出现在侧栏；侧栏必须调用 `ctx.page()`。
- `component` 传 React 组件 -> Koishi 不能按 Vue 页面渲染；必须用 Vue 外壳挂载 React。
- 未内联 `process.env.NODE_ENV` -> React 生态依赖可能在浏览器报 `process is not defined`。
- 未启用 `@tailwindcss/vite` -> 页面 DOM 和数据正常，但 shadcn/ui/Tailwind 样式不会生效；检查 `dist/style.css` 中是否残留 `@apply`。
- 混用 HeroUI 和 shadcn/ui -> 页面组件状态、样式变量和依赖边界会变复杂；同一仪表盘页面应保持单一组件体系。
- 裸页面不套 `k-layout` / `k-content` -> 页面可能被 Koishi 活动栏遮挡。

### 5. 正常 / 基础 / 错误案例

- 正常：服务端注册 entry + listener，客户端 `ctx.page()` 注册 Vue 外壳，Vue 外壳挂载 React/shadcn/ui 仪表盘。
- 基础：只需要插件详情页补充信息时，继续使用 `plugin-details` slot，不新增侧栏页。
- 错误：仅添加 `addEntry()` 但不写 `ctx.page()`，前端 bundle 会加载但侧栏没有入口。

### 6. 必需测试

- 单测断言默认注册 `addEntry()` 和 `addListener()`，并断言关闭开关时不注册。
- 单测断言配置 schema 的仪表盘开关默认值为 `true`。
- 构建后用真实 Koishi 控制台检查侧栏链接、页面 URL、RPC 数据和页面布局。
- 构建后检查 `dist/style.css` 不包含 `@apply`。
- 构建后搜索 `@heroui`，迁移到 shadcn/ui 的页面不应继续依赖 HeroUI 包或样式。

### 7. 错误 vs 正确

#### 错误

```ts
ctx.slot({
  type: "plugin-details",
  component: Dashboard,
})
```

#### 正确

```ts
ctx.page({
  id: "chatluna-affinity-dashboard",
  path: "/chatluna-affinity/dashboard",
  name: "好感度仪表盘",
  icon: "activity:default",
  authority: 1,
  component: AffinityDashboardPage,
})
```
