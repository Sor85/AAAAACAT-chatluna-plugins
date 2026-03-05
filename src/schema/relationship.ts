/**
 * 关系 Schema
 * 定义关系相关的配置项
 */

import { Schema } from "koishi";

export const RelationshipSchema = Schema.object({
  relationships: Schema.array(
    Schema.object({
      userId: Schema.string().default("").description("用户 ID"),
      relation: Schema.string().default("").description("关系"),
      note: Schema.string().default("").description("备注"),
    }),
  )
    .role("table")
    .default([])
    .description("特殊关系配置（删除后需手动清理数据库中对应用户的关系字段）"),
  relationshipAffinityLevels: Schema.array(
    Schema.object({
      min: Schema.number().default(0).description("好感度下限"),
      max: Schema.number().default(100).description("好感度上限"),
      relation: Schema.string().description("关系"),
      note: Schema.string().default("").description("备注"),
    }),
  )
    .role("table")
    .default([
      {
        min: -9999,
        max: 0,
        relation: "厌恶",
        note: "会极其敷衍、冷淡，甚至可能选择无视。目的是尽快结束对话。",
      },
      {
        min: 1,
        max: 50,
        relation: "陌生",
        note: "仅为点头之交，缺乏深入了解，互动局限于礼貌层面。",
      },
      {
        min: 51,
        max: 120,
        relation: "熟悉",
        note: "彼此认识，可以进行日常交流，开始使用一些轻松的语气词，展现出更多个性。",
      },
      {
        min: 121,
        max: 180,
        relation: "友好",
        note: "互有好感，愿意主动分享自己的经历和感受，是值得信赖的朋友。",
      },
      {
        min: 181,
        max: 9999,
        relation: "亲密",
        note: "关系非常亲密，会毫无顾忌地开玩笑、吐槽，也会自然地撒娇和分享自己的小情绪。",
      },
    ])
    .description("好感度区间关系"),
}).description("关系设置");
