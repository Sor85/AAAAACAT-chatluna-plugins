/**
 * 变量配置
 * 定义 userInfo、botInfo、groupInfo、random 变量
 */

import { Schema } from "koishi";
import {
  DEFAULT_GROUP_INFO_ITEMS,
  DEFAULT_MEMBER_INFO_ITEMS,
} from "../constants";

export const VariablesSchema = Schema.object({
  userInfo: Schema.object({
    variableName: Schema.string().default("userInfo").description("变量名称"),
    items: Schema.array(
      Schema.union([
        Schema.const("userId").description("用户 ID"),
        Schema.const("nickname").description("群昵称"),
        Schema.const("role").description("群内身份"),
        Schema.const("level").description("群等级"),
        Schema.const("title").description("群头衔"),
        Schema.const("gender").description("性别"),
        Schema.const("age").description("年龄"),
        Schema.const("area").description("地区"),
        Schema.const("joinTime").description("入群时间"),
        Schema.const("lastSentTime").description("最后发言时间"),
      ]),
    )
      .role("checkbox")
      .default([...DEFAULT_MEMBER_INFO_ITEMS])
      .description("显示的详细信息项"),
  })
    .description("用户信息变量")
    .collapse(),
  botInfo: Schema.object({
    variableName: Schema.string().default("botInfo").description("变量名称"),
    items: Schema.array(
      Schema.union([
        Schema.const("userId").description("机器人 ID"),
        Schema.const("nickname").description("群昵称"),
        Schema.const("role").description("群内身份"),
        Schema.const("level").description("群等级"),
        Schema.const("title").description("群头衔"),
        Schema.const("gender").description("性别"),
        Schema.const("age").description("年龄"),
        Schema.const("area").description("地区"),
        Schema.const("joinTime").description("入群时间"),
        Schema.const("lastSentTime").description("最后发言时间"),
      ]),
    )
      .role("checkbox")
      .default([...DEFAULT_MEMBER_INFO_ITEMS])
      .description("显示的机器人详细信息项"),
  })
    .description("机器人信息变量")
    .collapse(),
  groupInfo: Schema.object({
    variableName: Schema.string().default("groupInfo").description("变量名称"),
    items: Schema.array(
      Schema.union([
        Schema.const("groupName").description("群名称"),
        Schema.const("groupId").description("群号"),
        Schema.const("memberCount").description("成员数量"),
        Schema.const("createTime").description("创建时间（仅部分实现支持）"),
        Schema.const("ownerList").description("群主名单"),
        Schema.const("adminList").description("管理员名单"),
      ]),
    )
      .role("checkbox")
      .default([...DEFAULT_GROUP_INFO_ITEMS])
      .description("显示的群信息项"),
  })
    .description("群信息变量")
    .collapse(),
  groupShutList: Schema.object({
    variableName: Schema.string()
      .default("groupShutList")
      .description("变量名称"),
  })
    .description("群禁言列表变量")
    .collapse(),
  random: Schema.object({
    variableName: Schema.string().default("random").description("变量名称"),
    min: Schema.number().default(0).description("默认随机数下限"),
    max: Schema.number().default(100).description("默认随机数上限"),
  })
    .description("随机数变量")
    .collapse(),
})
  .default({
    userInfo: {
      variableName: "userInfo",
      items: [...DEFAULT_MEMBER_INFO_ITEMS],
    },
    botInfo: { variableName: "botInfo", items: [...DEFAULT_MEMBER_INFO_ITEMS] },
    groupInfo: {
      variableName: "groupInfo",
      items: [...DEFAULT_GROUP_INFO_ITEMS],
    },
    groupShutList: { variableName: "groupShutList" },
    random: { variableName: "random", min: 0, max: 100 },
  })
  .description("其他变量");
