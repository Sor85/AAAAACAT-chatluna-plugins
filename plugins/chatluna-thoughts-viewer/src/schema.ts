/**
 * 插件配置 Schema
 * 提供监控标签、指令名与别名配置
 */

import { Schema } from "koishi";
import type { Config } from "./types";

export const name = "chatluna-thoughts-viewer";

export const inject = {
  required: ["chatluna"],
  optional: ["chatluna_character"],
};

const BasicSchema = Schema.object({
  monitoredTag: Schema.string()
    .default("think")
    .description("要监听的 XML 标签名，例如 think"),
  commandName: Schema.string()
    .default("查看思考")
    .description("查看当前思考内容的指令名"),
  commandAliases: Schema.array(Schema.string().min(1))
    .role("table")
    .default(["think"])
    .description("查看当前思考内容的指令别名列表"),
  previousCommandName: Schema.string()
    .default("上次思考")
    .description("查看上一次思考内容的指令名"),
  previousCommandAliases: Schema.array(Schema.string().min(1))
    .role("table")
    .default([])
    .description("查看上一次思考内容的指令别名列表"),
  emptyMessage: Schema.string()
    .default("当前没有可展示的思考内容")
    .description("没有可展示内容时的回复文案"),
}).description("基础设置");

const OtherSchema = Schema.object({
  debugLogging: Schema.boolean().default(false).description("输出调试日志"),
}).description("其他设置");

export const ConfigSchema: Schema<Config> = Schema.intersect([
  BasicSchema,
  OtherSchema,
]) as Schema<Config>;
