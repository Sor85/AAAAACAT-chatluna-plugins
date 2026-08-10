/**
 * XML 工具配置
 * 定义 XML 动作解析开关
 */

import { Schema } from "koishi";

const DEFAULT_XML_REFERENCE_PROMPT = `<available_actions>

Use an independent \`<actions>\` element only when a non-verbal action is needed. Omit it otherwise.

Available actions:

\`<poke id="user_id"/>\`
Use to get someone's attention, playfully greet them, tease them, or react when they ignore you or say something speechless/funny.

\`<emoji message_id="message_id" emoji_id="emoji_id"/>\`
React to a specific message.

Emoji IDs:
424: 赞同
10068: 问号
265: 逆天
76: 赞
66: 爱心

\`<ban id="user_id" duration="seconds"/>\`
Mute a group member when you are a group admin. Use \`duration="0"\` to unmute.

\`<delete message_id="message_id"/>\`
Delete your own message, or another user's message when you are a group admin.

Actions must be placed inside a single \`<actions>\` element:

\`\`\`xml
<actions>
  <poke id="123456"/>
  <emoji message_id="346234" emoji_id="66"/>
  <ban id="123456" duration="600"/>
  <delete message_id="435663"/>
</actions>
\`\`\`

Only include actions that should actually be executed. Do not describe or simulate actions in \`<actions>\`.

</available_actions>`;

export const XmlToolsSchema = Schema.object({
  injectXmlToolAsReplyTool: Schema.boolean()
    .default(false)
    .description("将 XML 工具注入实验性[工具调用回复](https://chatluna.chat/ecosystem/other/character.html#%E9%A2%84%E8%AE%BE)的参数中"),
  enablePokeXmlTool: Schema.boolean()
    .default(false)
    .description(`启用 XML 戳一戳调用，与**戳一戳工具**二选一`),
  enableEmojiXmlTool: Schema.boolean()
    .default(false)
    .description(
      `启用 XML 消息表情调用，需\`chatluna-character\`开启\`enableMessageId\`，与**消息表情工具**二选一，点击查看[emoji_id 对照表](https://bot.q.qq.com/wiki/develop/pythonsdk/model/emoji.html)`,
    ),
  enableDeleteXmlTool: Schema.boolean()
    .default(false)
    .description(
      `启用 XML 消息撤回调用，需\`chatluna-character\`开启\`enableMessageId\`，与**撤回消息工具**二选一`,
    ),
  enableBanXmlTool: Schema.boolean()
    .default(false)
    .description(
      `启用 XML 群成员禁言调用，与**禁言工具**二选一`,
    ),
  autoInjectReferencePrompt: Schema.boolean()
    .default(false)
    .description("自动将下方 XML 参考提示词作为系统提示词注入模型。启用上方实验性工具调用回复后，此选项不生效"),
  referencePrompt: Schema.string()
    .role("textarea")
    .default(DEFAULT_XML_REFERENCE_PROMPT)
    .description("模型回复 XML 参考提示词，默认需自行写入角色提示词；开启上方自动注入后无需手动添加。若开启“将 XML 工具注入实验性[工具调用回复](https://chatluna.chat/ecosystem/other/character.html#%E9%A2%84%E8%AE%BE)的参数中”，则无需增加额外提示词"),
}).description("Character XML 工具");
