/**
 * 工具与变量设置 Schema
 * 定义原生工具、XML 工具与变量名称配置
 */

import { Schema } from "koishi";

export const NativeToolSettingsSchema = Schema.object({
  registerRelationshipTool: Schema.boolean()
    .default(false)
    .description("注册 ChatLuna 原生工具：调整关系"),
  relationshipToolName: Schema.string()
    .default("relationship")
    .description("原生工具名称：调整关系"),
  registerBlacklistTool: Schema.boolean()
    .default(false)
    .description("注册 ChatLuna 原生工具：管理黑名单"),
  blacklistToolName: Schema.string()
    .default("blacklist")
    .description("原生工具名称：管理黑名单"),
}).description("原生工具设置");

export const XmlToolSettingsSchema = Schema.object({
  enableAffinityXmlToolCall: Schema.boolean()
    .default(true)
    .description("启用好感度 XML 工具调用"),
  enableBlacklistXmlToolCall: Schema.boolean()
    .default(true)
    .description("启用黑名单 XML 工具调用"),
  enableRelationshipXmlToolCall: Schema.boolean()
    .default(true)
    .description("启用关系 XML 工具调用"),
  enableUserAliasXmlToolCall: Schema.boolean()
    .default(true)
    .description("启用自定义昵称 XML 工具调用"),
  characterPromptTemplate: Schema.string()
    .role("textarea")
    .default(
      `## 动作指令
你可以根据需要创建一个独立的 <actions> 元素。它用于执行非语言的系统指令。如果不需要执行任何动作，请省略此元素。
1. 好感度更新: \`<affinity delta="" action="" id=""/>\`
  - delta: 好感度变化量（正整数），单次增加的好感最大幅度 5，单次减少的好感最大幅度 10
  - action: increase 或 decrease
  - id: 目标用户 ID
  - 适用场景:
    - 用于更新用户好感度
2. 黑名单管理: \`<blacklist action="" mode="" id="" durationHours="" note=""/>\`
  - action: add 或 remove
  - mode: permanent 或 temporary
  - id: 目标用户 ID
  - durationHours: 当 mode=temporary 且 action=add 时生效
  - note: 可选，备注
  - 适用场景:
    - 永久拉黑（permanent）好感度低于 -30 的用户
    - 临时拉黑（temporary）频繁骚扰你的用户
3. 关系调整: \`<relationship relation="" id=""/>\`
  - relation: 目标关系名称
  - id: 目标用户 ID
  - 适用场景:
    - 增加你与用户的特殊关系，如小祥姐姐
4. 自定义昵称设置: \`<userAlias id="" name=""/>\`
  - id: 目标用户 ID
  - name: 用户自定义昵称
  - 适用场景:
    - 用户希望更改你对他的称呼

格式示例:
\`\`\`xml
  <actions>
    <affinity delta="5" action="increase" id="123456"/>
    <blacklist action="add" mode="permanent" id="123456" note="violation"/>
    <blacklist action="add" mode="temporary" id="123456" durationHours="12" note="spam"/>
    <relationship relation="小祥姐姐" id="123456"/>
    <userAlias id="123456" name="小祥"/>
  </actions>
\`\`\``,
    )
    .description("参考提示词")
    .collapse(),
}).description("XML 工具设置");

export const VariableSettingsSchema = Schema.object({
  affinityVariableName: Schema.string()
    .default("affinity")
    .description("好感度变量名称"),
  relationshipAffinityLevelVariableName: Schema.string()
    .default("relationshipAffinityLevel")
    .description("好感度区间变量名称"),
  blacklistListVariableName: Schema.string()
    .default("blacklistList")
    .description("当前群黑名单列表变量名称"),
  userAliasVariableName: Schema.string()
    .default("userAlias")
    .description("用户自定义昵称变量名称"),
}).description("变量设置");

export const OtherSettingsSchema = Schema.object({
  rankRenderAsImage: Schema.boolean()
    .default(false)
    .description("将好感度排行渲染为图片"),
  blacklistRenderAsImage: Schema.boolean()
    .default(false)
    .description("将黑名单渲染为图片"),
  shortTermBlacklistRenderAsImage: Schema.boolean()
    .default(false)
    .description("将临时黑名单渲染为图片"),
  inspectRenderAsImage: Schema.boolean()
    .default(false)
    .description("将好感度详情渲染为图片"),
  inspectShowImpression: Schema.boolean()
    .default(true)
    .description("在好感度详情中显示印象（依赖 chatluna-group-analysis）"),
  debugLogging: Schema.boolean().default(false).description("输出调试日志"),
  affinityGroups: Schema.array(
    Schema.object({
      groupName: Schema.string().required().description("分组名称"),
      botIds: Schema.array(Schema.string())
        .default([])
        .description("组内 Bot 的 selfId 列表"),
    }),
  )
    .default([])
    .description("好感度共享分组（同组 Bot 共享好感度数据）"),
}).description("其他设置");
