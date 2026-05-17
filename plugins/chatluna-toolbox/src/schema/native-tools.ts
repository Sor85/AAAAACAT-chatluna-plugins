/**
 * 原生工具配置
 * 定义 OneBot 原生工具相关 Schema
 */

import { Schema } from "koishi";
import {
  DEFAULT_DELETE_MESSAGE_TOOL_DESCRIPTION,
  DEFAULT_POKE_TOOL_DESCRIPTION,
  DEFAULT_SET_GROUP_BAN_TOOL_DESCRIPTION,
  DEFAULT_SET_GROUP_CARD_TOOL_DESCRIPTION,
  DEFAULT_SET_KOISHI_PLUGIN_MANAGER_TOOL_DESCRIPTION,
  DEFAULT_SET_QQ_AVATAR_TOOL_DESCRIPTION,
  DEFAULT_SET_MSG_EMOJI_TOOL_DESCRIPTION,
  DEFAULT_SET_SELF_PROFILE_TOOL_DESCRIPTION,
} from "../features/native-tools/defaults";

export const NativeToolsSchema = Schema.object({
  poke: Schema.object({
    enabled: Schema.boolean()
      .default(false)
      .description("注册 ChatLuna 工具：戳一戳（与 XML工具 二选一）"),
    toolName: Schema.string().default("poke_user").description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_POKE_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("戳一戳工具")
    .collapse(),
  setSelfProfile: Schema.object({
    enabled: Schema.boolean()
      .default(false)
      .description(
        "注册 ChatLuna 工具：修改自身账户信息（支持昵称/签名/性别）",
      ),
    toolName: Schema.string()
      .default("set_self_profile")
      .description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_SET_SELF_PROFILE_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("修改自身账户信息工具")
    .collapse(),
  setQQAvatar: Schema.object({
    enabled: Schema.boolean()
      .default(false)
      .description("注册 ChatLuna 工具：修改机器人 QQ 头像"),
    toolName: Schema.string().default("set_qq_avatar").description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_SET_QQ_AVATAR_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("修改 QQ 头像工具")
    .collapse(),
  koishiPluginManager: Schema.object({
    enabled: Schema.boolean()
      .default(false)
      .description("注册 ChatLuna 工具：管理 Koishi 插件（重载/停用/移除）"),
    toolName: Schema.string()
      .default("koishi_plugin_manager")
      .description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_SET_KOISHI_PLUGIN_MANAGER_TOOL_DESCRIPTION)
      .description("工具描述"),
    commandAuthority: Schema.number()
      .default(4)
      .min(0)
      .max(5)
      .description(
        "toolbox.plugin 指令需要的最低权限等级。指令本身以低权限注册，进入 action 后由本插件按该等级和用户白名单自行判断。",
      ),
    allowedUserIds: Schema.array(String)
      .default([])
      .role("table")
      .description(
        "允许直接使用 toolbox.plugin 的用户 ID 白名单。命中白名单时不受 commandAuthority 限制，适合未启用 auth 或只想授权少数 QQ 号的场景。",
      ),
  })
    .description("Koishi 插件管理工具")
    .collapse(),
  setGroupCard: Schema.object({
    enabled: Schema.boolean()
      .default(false)
      .description("注册 ChatLuna 工具：修改群成员昵称"),
    toolName: Schema.string().default("set_group_card").description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_SET_GROUP_CARD_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("修改群成员昵称工具")
    .collapse(),
  setGroupBan: Schema.object({
    enabled: Schema.boolean()
      .default(false)
      .description("注册 ChatLuna 工具：禁言群成员"),
    toolName: Schema.string().default("set_group_ban").description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_SET_GROUP_BAN_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("禁言工具")
    .collapse(),
  setMsgEmoji: Schema.object({
    enabled: Schema.boolean()
      .default(false)
      .description(
        "注册 ChatLuna 工具：给消息添加表情（需 chatluna-character 开启 enableMessageId，与 XML工具 二选一，表情对照表：https://bot.q.qq.com/wiki/develop/pythonsdk/model/emoji.html ）",
      ),
    toolName: Schema.string().default("set_msg_emoji").description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_SET_MSG_EMOJI_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("消息表情工具")
    .collapse(),
  deleteMessage: Schema.object({
    enabled: Schema.boolean()
      .default(false)
      .description(
        "注册 ChatLuna 工具：撤回消息（需 chatluna-character 开启 enableMessageId，与 XML工具 二选一）",
      ),
    toolName: Schema.string().default("delete_msg").description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_DELETE_MESSAGE_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("撤回消息工具")
    .collapse(),
})
  .default({
    poke: {
      enabled: false,
      toolName: "poke_user",
      description: DEFAULT_POKE_TOOL_DESCRIPTION,
    },
    setSelfProfile: {
      enabled: false,
      toolName: "set_self_profile",
      description: DEFAULT_SET_SELF_PROFILE_TOOL_DESCRIPTION,
    },
    setQQAvatar: {
      enabled: false,
      toolName: "set_qq_avatar",
      description: DEFAULT_SET_QQ_AVATAR_TOOL_DESCRIPTION,
    },
    koishiPluginManager: {
      enabled: false,
      toolName: "koishi_plugin_manager",
      description: DEFAULT_SET_KOISHI_PLUGIN_MANAGER_TOOL_DESCRIPTION,
      commandAuthority: 4,
      allowedUserIds: [],
    },
    setGroupCard: {
      enabled: false,
      toolName: "set_group_card",
      description: DEFAULT_SET_GROUP_CARD_TOOL_DESCRIPTION,
    },
    setGroupBan: {
      enabled: false,
      toolName: "set_group_ban",
      description: DEFAULT_SET_GROUP_BAN_TOOL_DESCRIPTION,
    },
    setMsgEmoji: {
      enabled: false,
      toolName: "set_msg_emoji",
      description: DEFAULT_SET_MSG_EMOJI_TOOL_DESCRIPTION,
    },
    deleteMessage: {
      enabled: false,
      toolName: "delete_msg",
      description: DEFAULT_DELETE_MESSAGE_TOOL_DESCRIPTION,
    },
  })
  .description("原生工具");
