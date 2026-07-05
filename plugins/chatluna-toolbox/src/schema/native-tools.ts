/**
 * 原生工具配置
 * 定义 OneBot 原生工具相关 Schema
 */

import { Schema } from "koishi";
import {
  DEFAULT_DELETE_MESSAGE_TOOL_DESCRIPTION,
  DEFAULT_LEAVE_GROUP_TOOL_DESCRIPTION,
  DEFAULT_POKE_TOOL_DESCRIPTION,
  DEFAULT_SEARCH_GROUP_MEMBER_TOOL_DESCRIPTION,
  DEFAULT_SET_GROUP_BAN_TOOL_DESCRIPTION,
  DEFAULT_SET_GROUP_CARD_TOOL_DESCRIPTION,
  DEFAULT_SET_GROUP_KICK_TOOL_DESCRIPTION,
  DEFAULT_SET_GROUP_SPECIAL_TITLE_TOOL_DESCRIPTION,
  DEFAULT_SET_QQ_AVATAR_TOOL_DESCRIPTION,
  DEFAULT_SET_MSG_EMOJI_TOOL_DESCRIPTION,
  DEFAULT_SET_SELF_PROFILE_TOOL_DESCRIPTION,
} from "../features/native-tools/defaults";

const EnabledNativeToolsSchema = Schema.array(
  Schema.union([
    Schema.const("poke").description("戳一戳"),
    Schema.const("setSelfProfile").description("修改自身账户信息"),
    Schema.const("setQQAvatar").description("修改 QQ 头像"),
    Schema.const("setGroupCard").description("修改群成员昵称"),
    Schema.const("searchGroupMember").description("搜索群成员"),
    Schema.const("setGroupBan").description("禁言群成员"),
    Schema.const("leaveGroup").description("退群"),
    Schema.const("setGroupKick").description("踢出群成员"),
    Schema.const("setGroupSpecialTitle").description("修改群成员专属头衔"),
    Schema.const("setMsgEmoji").description("消息表情"),
    Schema.const("deleteMessage").description("撤回消息"),
  ]),
)
  .role("checkbox")
  // Koishi 前端只有看到原生 array + checkbox schema 才会渲染为复选框列表；不要用 transform 包裹。
  .extra("default", undefined)
  .description(
    "选择要注册到 ChatLuna 的原生工具，工具名称和描述通常无需修改，可在下方高级设置中调整",
  );

const NativeToolAdvancedSettingsSchema = Schema.object({
  poke: Schema.object({
    enabled: Schema.boolean().default(false).hidden(),
    toolName: Schema.string().default("poke_user").description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_POKE_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("戳一戳工具")
    .collapse(),
  setSelfProfile: Schema.object({
    enabled: Schema.boolean().default(false).hidden(),
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
    enabled: Schema.boolean().default(false).hidden(),
    toolName: Schema.string().default("set_qq_avatar").description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_SET_QQ_AVATAR_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("修改 QQ 头像工具")
    .collapse(),
  setGroupCard: Schema.object({
    enabled: Schema.boolean().default(false).hidden(),
    toolName: Schema.string().default("set_group_card").description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_SET_GROUP_CARD_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("修改群成员昵称工具")
    .collapse(),
  searchGroupMember: Schema.object({
    enabled: Schema.boolean().default(false).hidden(),
    toolName: Schema.string()
      .default("search_group_member")
      .description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_SEARCH_GROUP_MEMBER_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("搜索群成员工具")
    .collapse(),
  setGroupBan: Schema.object({
    enabled: Schema.boolean().default(false).hidden(),
    toolName: Schema.string().default("set_group_ban").description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_SET_GROUP_BAN_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("禁言工具")
    .collapse(),
  leaveGroup: Schema.object({
    enabled: Schema.boolean().default(false).hidden(),
    toolName: Schema.string().default("set_group_leave").description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_LEAVE_GROUP_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("退群工具")
    .collapse(),
  setGroupKick: Schema.object({
    enabled: Schema.boolean().default(false).hidden(),
    toolName: Schema.string().default("set_group_kick").description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_SET_GROUP_KICK_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("踢出群成员工具")
    .collapse(),
  setGroupSpecialTitle: Schema.object({
    enabled: Schema.boolean().default(false).hidden(),
    toolName: Schema.string()
      .default("set_group_special_title")
      .description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_SET_GROUP_SPECIAL_TITLE_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("修改群成员专属头衔工具")
    .collapse(),
  setMsgEmoji: Schema.object({
    enabled: Schema.boolean().default(false).hidden(),
    toolName: Schema.string().default("set_msg_emoji").description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_SET_MSG_EMOJI_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("消息表情工具")
    .collapse(),
  deleteMessage: Schema.object({
    enabled: Schema.boolean().default(false).hidden(),
    toolName: Schema.string().default("delete_msg").description("工具名称"),
    description: Schema.string()
      .default(DEFAULT_DELETE_MESSAGE_TOOL_DESCRIPTION)
      .description("工具描述"),
  })
    .description("撤回消息工具")
    .collapse(),
})
  .description("高级设置")
  .collapse();

export const NativeToolsSchema = Schema.intersect([
  Schema.object({
    enabledNativeTools: EnabledNativeToolsSchema,
  }).description(""),
  NativeToolAdvancedSettingsSchema,
])
  .description("原生工具");
