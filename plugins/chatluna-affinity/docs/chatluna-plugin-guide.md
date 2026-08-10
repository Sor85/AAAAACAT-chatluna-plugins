# ChatLuna 主插件接入指南

这份文档用于把 `chatluna-affinity` 接入到 ChatLuna 主插件的原生工具调用里。

如果你使用的是 ChatLuna Character，请看 [ChatLuna Character 接入指南](./character-prompt-guide.md)。

## 什么时候使用原生工具

当你希望 ChatLuna 主插件直接调用工具来修改好感度数据时，使用原生工具。

原生工具和 Character XML 工具是两套入口：

- 原生工具：注册到 `chatluna.platform.registerTool`，由 ChatLuna 主插件直接调用
- Character XML 工具：从 ChatLuna Character 的回复文本或工具调用回复参数中解析动作

如果你已经使用原生工具，就不需要让模型再输出 `<affinity />`、`<blacklist />`、`<relationship />`、`<userAlias />` 这些 XML。

## 配置步骤

1. 在插件配置中填写 `scopeId`
2. 确认当前 Koishi 环境中只有一个不同的 Affinity `scopeId`
3. 保持“将 XML 工具改为注入实验性工具调用回复”关闭
4. 保存配置并重载插件

满足以上条件时，插件会把“选择要注册到 ChatLuna 的原生工具”中已勾选的工具注入 ChatLuna，并自动绑定当前唯一的 `scopeId`，模型无需填写。工具名称和描述仍可在“原生工具设置”中自定义。

工具执行时会直接使用当前插件实例的 `scopeId`，模型不需要也不能填写 `scopeId`。如果同时存在多个不同 `scopeId`，插件会注销固定名称的自动工具，避免调用被错误实例接管。

## 可用工具

### `affinity_affinity`

调整一个用户的好感度。

参数：

- `userId`：目标用户 ID
- `action`：`increase` 或 `decrease`
- `delta`：正数，表示变化幅度

### `affinity_blacklist`

新增或移除一个用户的黑名单。

参数：

- `userId`：目标用户 ID
- `action`：`add` 或 `remove`
- `mode`：`permanent` 或 `temporary`
- `durationHours`：临时黑名单时长，仅 `action=add` 且 `mode=temporary` 时需要
- `note`：可选备注

### `affinity_relationship`

设置或清空一个用户的关系。

参数：

- `userId`：目标用户 ID
- `action`：`set` 或 `clear`
- `relation`：关系名，仅 `action=set` 时需要

### `affinity_user_alias`

设置一个用户的自定义昵称。

参数：

- `userId`：目标用户 ID
- `name`：要保存的昵称

## 提示词建议

可以在主插件的提示词里加入类似说明：

```text
你可以在需要记录长期互动状态时调用好感度工具。
当用户让你记住关系、昵称、好感变化或黑名单状态时，优先调用可用工具完成记录。
```

## 注意事项

- 每次工具调用只处理一个目标用户
- 工具不暴露 `scopeId`，始终使用当前插件配置的 `scopeId`
- 工具不暴露 `platform`，优先使用当前会话平台，取不到时回退为 `onebot`
- 单一 `scopeId` 且未启用实验性工具调用回复时，已勾选的原生工具会注入 ChatLuna，并自动绑定该 `scopeId`
- 多个不同 `scopeId` 同时运行时不会自动注册固定名称工具，避免跨作用域覆盖
- 如果主插件没有调用工具，先确认当前环境是否只有一个 `scopeId`、插件是否已重载、当前模型是否支持工具调用
