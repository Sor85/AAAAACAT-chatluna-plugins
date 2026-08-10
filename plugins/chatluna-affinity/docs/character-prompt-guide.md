# ChatLuna Character 接入指南

这篇文档用于把 `chatluna-affinity` 接入到 `chatluna-character` 的角色提示词里。

完成 [readme.md](../readme.md) 中的插件安装和基础配置后，先确认当前插件实例使用的 `scopeId`。下面示例统一使用 `nene`，实际使用时请替换成你自己的 `scopeId`。

## 1. 在角色模板中注入状态变量

先把角色需要读取的状态写进 ChatLuna Character 的提示词或模板中：

```text
好感度: {affinity("nene")}
好感度区间: {relationshipLevel("nene")}
当前群内黑名单: {blacklistList("nene")}
```

变量作用如下：

- `affinity`：读取当前用户的好感度、关系、昵称与对话次数
- `relationshipLevel`：读取好感度区间与关系映射
- `blacklistList`：读取当前群内可见的黑名单列表

注意：`scopeId` 必须写在引号里，例如 `{affinity("nene")}`，不要写成 `{affinity(nene)}`。

## 2. 选择写入方式

插件支持两种写入方式：传统 XML 回复，或实验性的工具调用回复注入。二选一即可。

### 方式 A：传统 XML 回复

如果没有开启“将 XML 工具改为注入实验性‘工具调用回复’的参数中”，可以选择以下任一方式提供 XML 说明：

- 开启“自动将下方 XML 参考提示词作为系统提示词注入模型”，插件会自动注入模板。当前环境只有一个 `scopeId` 时会自动替换 `{scopeId}`；存在多个 `scopeId` 时保留占位符，需在模板中自行填写目标作用域
- 保持自动注入关闭，手动把配置页里的 XML 参考提示词复制到角色提示词，并替换 `{scopeId}`

自动注入默认关闭；开启实验性工具调用回复后，自动注入会自动失效。

示例：

```text
## 动作指令
你可以根据需要创建一个独立的 <actions> 元素。它用于执行非语言的系统指令。如果不需要执行任何动作，请省略此元素。
1. 好感度更新: `<affinity scopeId="" userId="" action="" delta=""/>`
  - scopeId: nene
  - userId: 目标用户 ID
  - action: increase 或 decrease
  - delta: 必须填写正整数
2. 黑名单管理: `<blacklist scopeId="" userId="" action="" mode="" durationHours="" note=""/>`
  - scopeId: nene
  - userId: 目标用户 ID
  - action: add 或 remove
  - mode: permanent 或 temporary
  - durationHours: 仅在 action=add 且 mode=temporary 时填写
  - note: 可选备注
3. 关系调整: `<relationship scopeId="" userId="" action="" relation=""/>`
  - scopeId: nene
  - userId: 目标用户 ID
  - action: set 或 clear
  - relation: 仅在 action=set 时填写
4. 自定义昵称设置: `<userAlias scopeId="" userId="" name=""/>`
  - scopeId: nene
  - userId: 目标用户 ID
  - name: 用户自定义昵称

格式示例:
<actions>
  <affinity scopeId="nene" userId="123456" action="increase" delta="5"/>
  <affinity scopeId="nene" userId="123456" action="decrease" delta="3"/>
  <blacklist scopeId="nene" userId="123456" action="add" mode="permanent" note="violation"/>
  <blacklist scopeId="nene" userId="123456" action="add" mode="temporary" durationHours="12" note="spam"/>
  <relationship scopeId="nene" userId="123456" action="set" relation="姐姐"/>
  <relationship scopeId="nene" userId="123456" action="clear"/>
  <userAlias scopeId="nene" userId="123456" name="小祥"/>
</actions>
```

### 方式 B：实验性工具调用回复注入

如果已经开启“将 XML 工具改为注入实验性‘工具调用回复’的参数中”，并且当前环境只有一个不同的 Affinity `scopeId`，插件会自动把已启用的 XML 工具注入 ChatLuna Character 的工具调用回复字段。角色提示词里不需要再塞完整 XML 参考提示词，也不需要额外提供 `scopeId` 参数；工具会直接绑定当前唯一作用域。

可以写成：

```text
你可以根据互动情况在 character_reply 中使用以下字段更新长期状态：
- affinity_affinity（好感度更新）
  - 适用场景：用户让你开心、帮助你、冒犯你、骚扰你，或发生其他会影响好感度的行为
- affinity_blacklist（黑名单管理）
  - 适用场景：永久拉黑好感度低于 -30 的用户；临时拉黑频繁骚扰你的用户；在情况改善后解除黑名单
- affinity_relationship（关系调整）
  - 适用场景：用户与角色形成特殊关系，或需要清除之前手动指定的特殊关系
- affinity_user_alias（用户自定义昵称）
  - 适用场景：用户希望更改你对他们的称呼
```

这个模式依赖模型是否能稳定触发 ChatLuna Character 的实验性工具调用回复。多个不同 `scopeId` 同时运行时，插件不会注册固定名称的 reply tool 字段，避免跨作用域覆盖；此时请继续使用显式包含 `scopeId` 的传统 XML 回复方式。

## 3. 检查是否生效

接入后建议按下面顺序检查：

1. 与角色对话一次，确认 `{affinity("nene")}` 能输出当前用户信息。
2. 让模型触发一次好感度变化，再使用 `nene.inspect 用户ID` 查看详情。
3. 如果没有变化，检查角色提示词里的 `scopeId` 是否与插件配置完全一致。
4. 仍然无法生效时，开启 `debugLogging` 查看 XML 或工具调用是否被插件接收。
