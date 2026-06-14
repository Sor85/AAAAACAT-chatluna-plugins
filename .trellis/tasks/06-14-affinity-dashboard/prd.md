# chatluna-affinity 仪表盘页面

## 目标

为 `plugins/chatluna-affinity` 增加一个仪表盘页面，用于在 Koishi 控制台中更直观地查看插件状态和好感度相关信息。用户明确要求使用 `heroui-react` MCP，因此实现前需要基于 HeroUI v3 React 文档确认组件用法和接入边界。

## 已知事实

- 当前插件前端入口是 `plugins/chatluna-affinity/client/index.ts`，通过 Koishi 控制台 `plugin-details` slot 注入 `AffinityDetailsLoader.vue`。
- 当前 `AffinityDetailsLoader.vue` 只在本插件详情页渲染 `SharedNav`，没有现成仪表盘视图。
- 同仓 `chatluna-toolbox` 和 `chatluna-meme-generator` 的详情页形态相同，都是 Vue + `SharedNav`。
- `plugins/chatluna-affinity/package.json` 当前只配置 Vue 前端构建依赖，没有 `react`、`react-dom`、`@heroui/react`、`@heroui/styles`、Tailwind v4 或 React Vite 插件。
- 当前后端未发现已有控制台路由、统计 API 或 socket 数据源；真实数据仪表盘会涉及后端数据库查询接口。
- HeroUI MCP 已确认 v3.0.5 组件可用，`Card`、`Tabs`、`Table`、`Chip`、`ProgressBar` 等组件采用 v3 compound pattern，不需要 v2 `HeroUIProvider`。

## 临时假设

- 仪表盘应出现在 Koishi 控制台的 `chatluna-affinity` 插件详情页，而不是创建独立外部站点。
- 页面应保持插件工具型界面，不做营销页或说明页。
- 若要展示真实数据，需要优先定义最小后端数据范围，避免先写只能展示假数据的复杂 UI。

## 开放问题

- 已选择真实数据仪表盘：新增最小后端控制台 API + React/HeroUI 只读页面。

## 需求（演进中）

- 使用 HeroUI v3 React 文档确认页面组件用法。
- 仪表盘页面必须和当前 Koishi 插件详情页入口兼容。
- 不引入无关配置项、抽象或未来扩展分支。
- 新增只读后端数据接口，返回当前 `scopeId` 下的真实统计数据。
- 页面展示最小可用概览：作用域信息、用户总数、黑名单数量、昵称数量、总互动次数、最近互动、关系分布、好感度排行。
- 数据接口只服务控制台仪表盘，不新增写入能力或管理操作。

## 验收标准（演进中）

- [ ] 打开 `chatluna-affinity` 插件详情页时能看到新增仪表盘入口或页面。
- [ ] 使用的 HeroUI React 组件符合 v3 compound pattern。
- [ ] 页面数据来自后端接口，而不是硬编码示例数据。
- [ ] 后端统计按当前插件配置的 `scopeId` 查询。
- [ ] 构建通过。
- [ ] 最终 diff 只包含当前仪表盘需求直接需要的改动。

## 完成定义

- 代码已实现并按项目规则完成构建。
- 必要的类型检查或测试已运行；若无法运行，说明原因。
- 结束前检查 `git diff`，排除与当前需求无关的改动。
- 不提交，除非用户后续明确授权。

## 暂不做

- 暂不改动 `/docs` 目录。
- 暂不改动用户已有的 `.gitignore` 脏改动。
- 暂不新增与仪表盘无关的插件配置。
- 暂不做数据编辑、清空、导出、分页管理或实时推送。
- 暂不把仪表盘抽成跨插件共享组件。

## 技术方案

后端新增一个 `dashboard` 服务模块，从现有 v2 表读取当前 `scopeId` 下的数据并返回前端稳定 JSON。前端在插件详情页渲染 React/HeroUI 仪表盘，同时保留现有 `SharedNav`。为减少行为边界，仪表盘只读、手动刷新、失败时显示错误状态。

## 决策记录

**背景**：当前插件没有控制台统计 API，只有 Vue 插件详情页导航；用户选择真实数据仪表盘。

**决策**：实现最小只读后端接口和 React/HeroUI 前端视图，展示可从现有表直接推导的真实统计，不做写入型管理功能。

**影响**：需要增加 React/HeroUI 相关前端依赖和构建配置；后续若要做管理面板，可以在同一接口旁扩展，但本次不预留复杂抽象。

## 技术备注

- 相关文件：
  - `plugins/chatluna-affinity/client/index.ts`
  - `plugins/chatluna-affinity/client/AffinityDetailsLoader.vue`
  - `plugins/chatluna-affinity/client/constants.ts`
  - `plugins/chatluna-affinity/package.json`
  - `plugins/chatluna-affinity/vite.config.mts`
  - `plugins/chatluna-affinity/src/plugin.ts`
  - `plugins/chatluna-affinity/src/models/affinity.ts`
  - `plugins/chatluna-affinity/src/models/blacklist.ts`
  - `plugins/chatluna-affinity/src/models/user-alias.ts`
- 相关规范：
  - `.trellis/spec/koishi-plugin-chatluna-affinity/frontend/index.md`
  - `.trellis/spec/guides/index.md`
- HeroUI MCP 参考：
  - `list_components`：确认 HeroUI v3.0.5 可用组件列表。
  - `get_component_docs`：已查询 `Card`、`Button`、`Tabs`、`Table`、`Badge`、`ProgressBar`、`Chip` 文档。
