# koishi-plugin-chatluna-affinity

一个给 ChatLuna Character 使用的 Koishi 插件，用来管理角色与用户之间的长期互动状态。它提供好感度、关系、黑名单、自定义昵称，以及配套的模板变量、命令和 XML 动作调用。

## 项目简介

这个插件提供一个好感度管理工具。

它把互动状态落到数据库里，并按 `scopeId` 做实例隔离。你可以把 `scopeId` 理解为当前角色的人设作用域：同一个 `scopeId` 下的数据共享，不同 `scopeId` 之间完全隔离。

插件当前包含四类核心能力：

- 好感度：支持长期 / 短期好感与动态系数，可分别关闭短期好感和变化系数
- 关系：支持按好感区间映射关系，也支持手动指定特殊关系
- 黑名单：支持永久拉黑、临时拉黑与拦截
- 用户昵称：支持为用户保存自定义昵称，并在 `affinity` 变量中输出

## 安装

### 前置依赖

请先确保你的 Koishi 环境已经安装并启用以下依赖：

- `koishi-plugin-chatluna`
- `koishi-plugin-chatluna-character`
- 数据库服务（因为本插件依赖 `database`）

可选依赖：

- 图片渲染由插件内置 Takumi 完成，无需安装额外浏览器服务
- `koishi-plugin-chatluna-group-analysis`：用于在详情页展示用户印象
- `@koishijs/plugin-console`：用于控制台配置界面

### 安装插件

```bash
yarn add koishi-plugin-chatluna-affinity
```

安装后，在 Koishi 中启用本插件并完成配置。

## 快速上手

如果你主要是想在 ChatLuna Character 里使用本插件，建议先看这份伪装成接入指南的教程：[ChatLuna Character 接入指南](./docs/character-prompt-guide.md)。它给出了角色提示词里应该放哪些变量，以及传统 XML 回复和实验性工具调用回复两种接入方式。

如果你主要在 ChatLuna 主插件中使用本插件，建议先看 [ChatLuna 主插件接入指南](./docs/chatluna-plugin-guide.md)。它说明了如何开启原生工具，以及主插件可以直接调用哪些工具。

### 1. 先配置 `scopeId`

这是最重要的配置项。

- `scopeId` 必填
- 只允许中文、英文、数字、`_`、`-`
- 长度 1 到 32
- 不建议直接使用角色名或角色代号
  - 同一个 `scopeId` 下，所有 bot 共享一份互动数据
  - 不同 `scopeId` 下，数据完全隔离

### 2. 保持默认配置先跑通

首次使用时，建议先只确认这些开关：

- `affinityEnabled = true`
- `enableAffinityXmlToolCall = true`
- `enableBlacklistXmlToolCall = true`
- `enableRelationshipXmlToolCall = true`
- `enableUserAliasXmlToolCall = true`

如果你希望只有指定 bot 的真实回复才能触发首次建档，再配置：

- `botSelfIds = ["你的bot selfId"]`

它为空时，表示当前实例内任意 bot 的有效回复都可以触发首次初始化。

### 3. 在角色提示词里接入变量与 XML

如果你在 ChatLuna Character 模板里使用本插件：

- 用变量读取状态
- 用 XML 标签写入状态

最常见的组合就是：

- 模板里放 `{affinity("你的scopeId")}`
- 提示词里允许模型输出 `<affinity .../>`、`<relationship .../>`、`<blacklist .../>`、`<userAlias .../>`

如果开启 `injectXmlToolAsReplyTool`（界面显示为“将 XML 工具改为注入实验性‘工具调用回复’的参数中”），并且当前环境只有一个不同的 Affinity `scopeId`，插件会把可用 XML 工具自动注入 ChatLuna Character 的工具调用回复参数中，不需要把完整 XML 参考提示词塞进角色提示词。

如果继续使用传统 XML 回复，也可以开启 `autoInjectReferencePrompt`。该选项默认关闭，开启后会自动将 `characterPromptTemplate` 作为系统提示词注入。当前环境只有一个 `scopeId` 时，会把所有 `{scopeId}` 替换为当前作用域；存在多个 `scopeId` 时不会替换，需在模板中自行填写目标作用域。开启实验性工具调用回复后，此选项自动失效。

### 好感度动态开关

`affinityDynamics` 中提供两个默认关闭的选项：

- `disableShortTermAffinity`：关闭短期好感，增减值直接作用于长期好感；已有短期好感不折算，显示时按 0 处理。
- `disableAffinityCoefficient`：关闭好感度变化系数，最终显示值直接使用长期好感。

两个选项同时关闭时，增减值直接作用于长期好感，变量、排行和详情中的好感度直接显示长期好感。

`autoInjectAffinityMechanismPrompt` 默认开启，会把当前生效的好感度机制作为一段独立的 Character 系统提示词注入，帮助模型理解“用户要求增加的数值”和最终显示值之间的差异。它不依赖 XML 模式，也不会与 `characterPromptTemplate` 混合；不需要时可以单独关闭。

`autoInjectReferencePrompt` 仍只负责 XML 参考提示词，默认关闭。

## 查看好感度数据

常用查看方式有这几种：

1. 查看 Koishi 数据库：好感度数据保存在 `chatluna_affinity_v2` 表中，可按 `scopeId` 和 `userId` 查询。
2. 询问 bot：在角色提示词中正确接入 `{affinity("scopeId")}` 后，可以直接向 bot 询问当前用户的好感度、关系和互动次数。
3. 查看好感度仪表盘：启用 Koishi 控制台后，在侧栏打开“好感度仪表盘”，查看当前 `scopeId` 的排行、黑名单和趋势数据。
4. 使用 onebot-webqq：安装 [Sor85/koishi-plugin-onebot-webqq](https://github.com/Sor85/koishi-plugin-onebot-webqq)，并打开 `showWebQQAffinity` 功能后，可在 WebQQ 界面查看好感度。

## 变量

默认变量名如下：

- `affinity`
- `relationshipLevel`
- `blacklistList`

调用格式必须写成：

```text
{变量名("scopeId")}
```

示例：

- `{affinity("nene")}`
- `{relationshipLevel("nene")}`
- `{blacklistList("nene")}`

### `affinity`

返回当前用户或指定用户的好感信息。

输出示例：

```text
id:123456 name:xxx nickname:xxx姐姐 affinity:20 relationship:熟悉 chatcount:12
```

说明：

- `nickname` 只有在用户设置了自定义昵称时才会出现
- `chatcount` 为该用户的对话次数，默认显示，可在变量设置中关闭
- 当未显式传入 `userId` 时，默认取当前上下文用户
- `scopeId` 必须显式传入，不传就返回空字符串

### `relationshipLevel`

返回当前配置下的好感区间关系表，适合直接塞进角色提示词，让模型知道不同区间对应什么关系。

### `blacklistList`

返回当前上下文可见范围内的黑名单信息。

说明：

- 黑名单的实际生效范围是当前 `scopeId`
- 群聊里的列表展示会按当前群成员过滤

### 变量调用注意事项

变量调用时，`scopeId` 必须写在引号里。

正确：

```text
{affinity("nene")}
```

错误：

```text
{affinity(nene)}
```

## XML 动作调用

插件会从模型原始输出中解析以下自闭合标签：

- `<affinity scopeId="" userId="" action="increase|decrease" delta=""/>`
- `<blacklist scopeId="" userId="" action="add|remove" mode="permanent|temporary" durationHours="" note=""/>`
- `<relationship scopeId="" userId="" action="set|clear" relation=""/>`
- `<userAlias scopeId="" userId="" name=""/>`

这些能力分别受对应配置开关控制。

### 实验性工具调用回复注入

`injectXmlToolAsReplyTool` 对应控制台选项“将 XML 工具改为注入实验性‘工具调用回复’的参数中”，默认关闭。

- 关闭时：插件按传统方式从模型原始输出中解析 XML 标签；可以手动写入 XML 格式说明，也可以开启 `autoInjectReferencePrompt` 自动注入。
- 开启时：当整个环境只有一个不同的 Affinity `scopeId` 时，插件会把已启用的 XML 工具自动注入 ChatLuna Character 的工具调用回复参数，并直接绑定该作用域。
- 开启实验性工具调用回复后，`autoInjectReferencePrompt` 不生效，避免重复提示。
- 多个不同 `scopeId` 同时运行时，不注册固定名称的 reply tool 字段，继续使用显式包含 `scopeId` 的传统 XML。
- 这个模式仍然遵守 `enableAffinityXmlToolCall`、`enableBlacklistXmlToolCall`、`enableRelationshipXmlToolCall`、`enableUserAliasXmlToolCall` 等开关。
- 这是实验性能力。如果模型无法稳定触发工具调用回复，保持关闭并继续使用原始 XML 输出方式。

### XML 规则

所有 XML 工具都遵守下面这几条：

- `scopeId` 必填
- `scopeId` 必须和当前插件实例配置一致
- 插件不会从会话里替你猜 `scopeId`
- `scopeId` 填错、缺失或非法时，该标签不会按你的预期生效
- `platform` 在未显式传入时默认按 `onebot` 处理

### 常见示例

增加好感：

```xml
<affinity scopeId="nene" userId="123456" action="increase" delta="5"/>
```

减少好感：

```xml
<affinity scopeId="nene" userId="123456" action="decrease" delta="3"/>
```

设置特殊关系：

```xml
<relationship scopeId="nene" userId="123456" action="set" relation="姐姐"/>
```

移除特殊关系：

```xml
<relationship scopeId="nene" userId="123456" action="clear"/>
```

永久拉黑：

```xml
<blacklist scopeId="nene" userId="123456" action="add" mode="permanent" note="violation"/>
```

临时拉黑：

```xml
<blacklist scopeId="nene" userId="123456" action="add" mode="temporary" durationHours="12" note="spam"/>
```

设置昵称：

```xml
<userAlias scopeId="nene" userId="123456" name="小祥"/>
```

## 指令

指令统一为：

```text
scopeId.指令名
```

例如 `scopeId = nene` 时：

- `nene.inspect [userId] [platform] [image]`：查看指定用户好感度详情
- `nene.rank [limit] [image]`：查看当前作用域好感度排行
- `nene.adjust <userId> <delta>`：手动增减好感度
- `nene.blacklist [limit] [platform] [image]`：查看黑名单列表
- `nene.block <userId> [platform]`：加入永久黑名单
- `nene.unblock <userId> [platform]`：解除永久黑名单，并尝试重置好感度
- `nene.tempBlock <userId> [durationHours] [platform]`：加入临时黑名单
- `nene.tempUnblock <userId> [platform]`：解除临时黑名单
- `nene.clearAll -y`：清空当前作用域下的好感度、黑名单、昵称数据

其中 `clearAll` 是危险操作，需要二次确认。

## 配置说明

插件配置主要分成这些部分：

- 作用域设置：`scopeId`
- 好感度设置：基础值、动态阈值、显示范围、排行默认数量
- 黑名单设置：默认列表、临时拉黑处罚、解除永久拉黑后的初始值等
- 关系设置：区间关系与特殊关系
- 变量设置：变量名重命名
- 原生工具设置：注册给 ChatLuna 主插件直接调用的工具
- Character XML 工具设置：是否启用各类 XML、是否注入实验性工具调用回复，以及参考提示词
- 其他设置：图片渲染、调试日志、详情显示印象等

如果你只是正常使用，优先关注这几个配置：

- `scopeId`
- `initialAffinity`
- `botSelfIds`
- `affinityDisplayRange`
- `rankDefaultLimit`
- `unblockPermanentInitialAffinity`
- `debugLogging`
- `nativeToolSettings.enabledNativeTools`
- `injectXmlToolAsReplyTool`
- `autoInjectReferencePrompt`
- `characterPromptTemplate`

当整个环境只有一个 Affinity `scopeId`，且没有开启 `injectXmlToolAsReplyTool` 时，插件会把 `nativeToolSettings.enabledNativeTools` 中已选择的工具注入 ChatLuna，并自动绑定当前 `scopeId`，模型无需填写。多个不同 `scopeId` 同时运行时会注销这些固定名称工具，避免跨作用域覆盖；此时应使用显式带 `scopeId` 的传统 XML。

`injectXmlToolAsReplyTool` 默认关闭。开启后，在单一 `scopeId` 环境中会优先自动注入 ChatLuna Character 的实验性工具调用回复字段，不再自动注册原生工具。

`autoInjectReferencePrompt` 默认关闭。开启后会自动注入 `characterPromptTemplate`；只有当前环境存在一个 `scopeId` 时，才会将其中所有 `{scopeId}` 替换成当前实例值。存在多个 `scopeId` 时会原样注入模板，需自行将占位符改为目标作用域。它与 `injectXmlToolAsReplyTool` 互斥，后者开启时自动注入提示词不生效。


## 调试建议

排查问题时，先看这几个点：

- `scopeId` 是否填对
- 变量调用是否写成了 `{affinity("scopeId")}` 这种正确格式
- XML 标签里的 `scopeId` 是否与当前实例一致
- `debugLogging` 是否开启
- Takumi 图片渲染失败时，图片模式会自动退回文本模式

如果你怀疑数据脏了，可以执行：

```text
你的scopeId.clearAll -y
```

这会清空当前作用域下的好感度、黑名单和昵称数据，无法恢复。

## 许可证

MIT © 2024-present chatluna-affinity contributors
