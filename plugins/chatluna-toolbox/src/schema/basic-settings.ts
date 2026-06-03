/**
 * 基础设置配置
 * 定义 OneBot 协议相关 Schema
 */

import { Schema } from "koishi";

export const BasicSettingsSchema = Schema.object({
  oneBotProtocol: Schema.union([
    Schema.const("napcat").description("NapCat"),
    Schema.const("llbot").description("LLBot"),
  ])
    .default("napcat")
    .description("OneBot 协议"),
}).description("基础设置");
