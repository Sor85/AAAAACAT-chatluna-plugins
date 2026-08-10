/**
 * 工具与变量设置 Schema
 * 定义 scopeId、XML 工具与变量名称配置
 */

import { Schema } from "koishi";
import {
  DEFAULT_AFFINITY_NATIVE_TOOL_DESCRIPTION,
  DEFAULT_BLACKLIST_NATIVE_TOOL_DESCRIPTION,
  DEFAULT_RELATIONSHIP_NATIVE_TOOL_DESCRIPTION,
  DEFAULT_USER_ALIAS_NATIVE_TOOL_DESCRIPTION,
} from "../services/native-tools/defaults";

export const ScopeSettingsSchema = Schema.object({
  scopeId: Schema.string()
    .pattern(/^[A-Za-z0-9_\-\u4e00-\u9fff]{1,32}$/)
    .required()
    .description(
      "作用域标识，只允许中文、英文、数字、_、-，长度 1-32；不要使用与 bot 名称相同的 scopeId，建议优先使用英文",
    ),
  botSelfIds: Schema.array(Schema.string())
    .default([])
    .description(
      "填写该 scopeId 绑定的 bot 的 selfId（QQ号）；为空时表示当前实例任意 bot",
    ),
}).description("作用域设置");

const EnabledNativeToolsSchema = Schema.array(
  Schema.union([
    Schema.const("affinity").description("好感度"),
    Schema.const("blacklist").description("黑名单"),
    Schema.const("relationship").description("关系"),
    Schema.const("userAlias").description("自定义昵称"),
  ]),
)
  .role("checkbox")
  // Koishi 前端只有看到原生 array + checkbox schema 才会渲染为复选框列表；不要用 transform 包裹。
  .extra("default", undefined)
  .description("选择要注册到 ChatLuna 的原生工具。当当前环境只有一个`scopeId`时，已选工具会自动注入并绑定该`scopeId`，模型无需填写");

export const NativeToolSettingsSchema = Schema.object({
  nativeToolSettings: Schema.object({
    enabledNativeTools: EnabledNativeToolsSchema,
    affinity: Schema.object({
      toolName: Schema.string()
        .default("affinity_affinity")
        .description("工具名称"),
      description: Schema.string()
        .default(DEFAULT_AFFINITY_NATIVE_TOOL_DESCRIPTION)
        .description("工具描述"),
    })
      .description("好感度工具")
      .collapse(),
    blacklist: Schema.object({
      toolName: Schema.string()
        .default("affinity_blacklist")
        .description("工具名称"),
      description: Schema.string()
        .default(DEFAULT_BLACKLIST_NATIVE_TOOL_DESCRIPTION)
        .description("工具描述"),
    })
      .description("黑名单工具")
      .collapse(),
    relationship: Schema.object({
      toolName: Schema.string()
        .default("affinity_relationship")
        .description("工具名称"),
      description: Schema.string()
        .default(DEFAULT_RELATIONSHIP_NATIVE_TOOL_DESCRIPTION)
        .description("工具描述"),
    })
      .description("关系工具")
      .collapse(),
    userAlias: Schema.object({
      toolName: Schema.string()
        .default("affinity_user_alias")
        .description("工具名称"),
      description: Schema.string()
        .default(DEFAULT_USER_ALIAS_NATIVE_TOOL_DESCRIPTION)
        .description("工具描述"),
    })
      .description("自定义昵称工具")
      .collapse(),
  }).description(""),
}).description("原生工具设置");

export const XmlToolSettingsSchema = Schema.object({
  injectXmlToolAsReplyTool: Schema.boolean()
    .default(false)
    .description(
      "将 XML 工具改为注入实验性[工具调用回复](https://chatluna.chat/ecosystem/other/character.html#%E9%A2%84%E8%AE%BE)的参数中。当前环境只有一个`scopeId`时，会自动注入并绑定该`scopeId`，模型无需填写",
    ),
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
  autoInjectReferencePrompt: Schema.boolean()
    .default(false)
    .description(
      "自动将下方 XML 参考提示词作为系统提示词注入模型。当前环境只有一个`scopeId`时，会将`{scopeId}`替换为当前作用域；存在多个`scopeId`时保留占位符，需自行修改。启用上方实验性工具调用回复后，此选项不生效",
    ),
  characterPromptTemplate: Schema.string()
    .role("textarea")
    .default(
      `<available_actions>

Use an independent \`<actions>\` element only when a non-verbal system action is needed. Omit it otherwise.

Available actions:

\`<affinity scopeId="{scopeId}" userId="user_id" action="action" delta="delta"/>\`
Update a user's affinity.

scopeId: \`{scopeId}\`
userId: target user ID
action: \`increase\` or \`decrease\`
delta: required positive integer

\`<blacklist scopeId="{scopeId}" userId="user_id" action="action" mode="mode" durationHours="hours" note="note"/>\`
Manage a user's blacklist status.

scopeId: \`{scopeId}\`
userId: target user ID
action: \`add\` or \`remove\`
mode: \`permanent\` or \`temporary\`
durationHours: only include when \`action="add"\` and \`mode="temporary"\`
note: optional

\`<relationship scopeId="{scopeId}" userId="user_id" action="action" relation="relation"/>\`
Adjust a user's relationship.

scopeId: \`{scopeId}\`
userId: target user ID
action: \`set\` or \`clear\`
relation: only include when \`action="set"\`

\`<userAlias scopeId="{scopeId}" userId="user_id" name="name"/>\`
Set a custom nickname for a user.

scopeId: \`{scopeId}\`
userId: target user ID
name: custom nickname

Actions must be placed inside a single \`<actions>\` element:

\`\`\`xml
<actions>
  <affinity scopeId="{scopeId}" userId="123456" action="increase" delta="5"/>
  <blacklist scopeId="{scopeId}" userId="123456" action="add" mode="permanent" note="violation"/>
  <blacklist scopeId="{scopeId}" userId="123456" action="add" mode="temporary" durationHours="12" note="spam"/>
  <relationship scopeId="{scopeId}" userId="123456" action="set" relation="小祥姐姐"/>
  <userAlias scopeId="{scopeId}" userId="123456" name="小祥"/>
</actions>
\`\`\`

Only include actions that should actually be executed. Omit fields that are not applicable. Do not describe or simulate actions inside \`<actions>\`.

</available_actions>`,
    )
    .description("模型回复 XML 参考提示词，默认需手动替换`{scopeId}`并写入角色提示词；开启上方自动注入后无需手动写入，单一`scopeId`时还会自动替换占位符，多`scopeId`时需在模板中自行改为目标作用域。若开启实验性工具调用回复，则无需增加额外 XML 提示词")
    .collapse(),
}).description("Character XML 工具设置");

export const VariableSettingsSchema = Schema.object({
  affinityVariableName: Schema.string()
    .default("affinity")
    .description(
      '好感度变量名称，调用示例：{affinity("scopeId")}，请将 scopeId 替换为你设定的实际 scopeId。返回格式为文本行，包含 id、name、nickname、affinity、relationship、chatcount；当展示范围大于 1 时会返回多行。',
    ),
  showChatCountInAffinityVariable: Schema.boolean()
    .default(true)
    .description("在好感度变量中显示对话次数 chatcount"),
  affinityDisplayRange: Schema.number()
    .default(1)
    .min(1)
    .step(1)
    .description("显示当前上下文中多少位用户的好感度信息"),
  relationshipLevelVariableName: Schema.string()
    .default("relationshipLevel")
    .description(
      '好感度区间变量名称，调用示例：{relationshipLevel("scopeId")}，请将 scopeId 替换为你设定的实际 scopeId。返回格式为文本行，列出当前配置中的所有区间，包含 min、max、relationship、note。',
    ),
  blacklistListVariableName: Schema.string()
    .default("blacklistList")
    .description(
      '当前群黑名单列表变量名称，调用示例：{blacklistList("scopeId")}，请将 scopeId 替换为你设定的实际 scopeId。返回格式为文本行，列出当前群命中的黑名单记录，包含 id、name、affinity、mode、blockedAt；临时黑名单额外包含 expiresAt。',
    ),
}).description("变量设置");

export const OtherSettingsSchema = Schema.object({
  enableDashboard: Schema.boolean()
    .default(true)
    .description("在 Koishi 控制台侧栏显示好感度仪表盘"),
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
}).description("其他设置");
