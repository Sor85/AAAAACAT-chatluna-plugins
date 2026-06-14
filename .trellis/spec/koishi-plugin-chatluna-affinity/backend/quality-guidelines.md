# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)

## 场景：控制台只读仪表盘 RPC

### 1. 范围 / 触发
- 触发：`chatluna-affinity` 需要把数据库统计通过 Koishi 控制台 WebSocket RPC 暴露给侧栏仪表盘。
- 范围：只读统计接口，不负责写入、管理、分页、导出或实时推送。

### 2. 签名
- 后端事件：`chatluna-affinity/dashboard`
- 配置开关：`enableDashboard: boolean`，默认 `true`
- WebUI 注册：`registerDashboardWebui({ ctx, config, entry, log })`
- RPC 注册：`ctx.console.addListener(event, callback, { authority: 1 })`
- 服务函数：`getDashboardData(ctx, { scopeId }): Promise<DashboardData>`
- 前端页面：`ctx.page({ path: "/chatluna-affinity/dashboard", name: "好感度仪表盘", component })`

### 3. 契约
- 请求：无参数，后端固定读取当前插件实例的 `config.scopeId`。
- 响应必须包含：`scopeId`、`generatedAt`、`totals`、`averages`、`latestInteractionAt`、`weeklyChanges`、`trends`、`relationStats`、`blacklistItems`、`topUsers`。
- `weeklyChanges` 必须按最近 7 天和前 7 天对比输出 `current`、`previous`、`percent`；前 7 天为 0 且当前不为 0 时，`percent` 返回 `null`，表示无可比基准。
- `trends.week` 固定 7 个日分桶，`trends.month` 固定 30 个日分桶，`trends.all` 按月份分桶；横轴以当前数据中最新的 `lastInteractionAt` 或 `blockedAt` 为锚点，避免服务器当天日期把有数据的区间挤出图表。
- 趋势中的用户记录、平均好感和互动次数按好感记录的 `lastInteractionAt` 分桶；黑名单按黑名单记录的 `blockedAt` 分桶。
- `relationStats` 必须带 `kind: "preset" | "custom"`，其中 `specialRelation` 归为 `custom`，普通 `relation` 归为 `preset`。
- `topUsers[].historyPoints` 只允许展示现有数据能证明的点。当前没有历史快照表，`actionStats.entries` 只保存动作时间和方向时，可以用动作时间锚定当前好感值；不能伪造每次变更后的历史好感值。
- `blacklistItems[].avatarUrl` 必须与 `topUsers[].avatarUrl` 使用同一头像来源，数字 `userId` 生成头像地址，非数字 `userId` 返回 `null`。
- 时间字段必须在后端转成 ISO 字符串或 `null`，不要把 `Date` 对象直接作为跨 RPC 契约。
- 数据来源只允许当前 scope 的 `chatluna_affinity_v2`、`chatluna_blacklist_v2`、`chatluna_user_alias_v2`。
- `enableDashboard === false` 时不能注册控制台 entry，也不能注册仪表盘 RPC。

### 4. 校验与错误矩阵
- `console` 服务未启用 -> 不注册监听，插件主体继续启动。
- `enableDashboard` 显式关闭 -> 不加载前端资源，不显示侧栏页面，不暴露仪表盘 RPC。
- 指定 scope 没有数据 -> 返回零值统计和空数组，不抛错。
- 数据库查询失败 -> 让 RPC promise reject，由前端展示读取失败。
- 非法时间值 -> 返回 `null`，避免前端格式化异常。
- 周同比前期无数据 -> `percent=null`，避免把无基准增长误报成固定百分比。
- 用户没有 `actionStats.entries` -> `historyPoints` 返回一个当前点，避免前端曲线空白。

### 5. 好 / 基准 / 坏用例
- 好：只聚合当前 `scopeId`，跨 scope 数据不会进入仪表盘。
- 基准：空表返回 `users=0`、`blacklisted=0`、`aliases=0`、`topUsers=[]`。
- 好：默认配置下注册侧栏页面和 RPC；显式关闭开关后两者都不注册。
- 好：关系分布按 `kind` 拆分，前端能直接切换“预设关系”和“自定义关系”。
- 基准：空表返回 7 个周趋势零值点、30 个月趋势零值点、空总趋势。
- 坏：前端自行读取数据库表名或复制后端聚合逻辑。
- 坏：根据 `actionStats.entries` 推算每次操作后的精确好感值；现有字段没有保存该历史值。
- 坏：关闭仪表盘后仍调用 `addEntry`，导致侧栏入口残留但数据接口不可用。

### 6. 必需测试
- 空 scope：断言零值统计、空关系分布和空排行。
- 混合数据：断言只统计当前 scope，黑名单模式数量、昵称数量、互动总数、最新互动时间和排行顺序正确。
- 趋势与周同比：断言最近 7 天、前 7 天、别名更新时间、黑名单 `blockedAt` 和日分桶统计正确，并覆盖 `now` 晚于数据日期时仍以数据日期为锚点。
- 单人曲线：断言有 `actionStats.entries` 时输出动作时间点，无动作记录时输出当前点。
- 黑名单头像：断言 `blacklistItems[].avatarUrl` 对数字 `userId` 返回头像地址，对非数字 `userId` 返回 `null`。
- 默认开关：断言 schema 中 `enableDashboard` 默认值为 `true`。
- 关闭开关：断言不会调用 `ctx.inject` 注册控制台 entry 和 RPC。

### 7. 错误与正确

#### 错误
```typescript
const rows = await ctx.database.get(MODEL_NAME_V2, {});
return rows;
```

#### 正确
```typescript
const rows = await ctx.database.get(MODEL_NAME_V2, { scopeId: config.scopeId });
return rows.map((row) => ({
  lastInteractionAt: row.lastInteractionAt?.toISOString() ?? null,
}));
```
