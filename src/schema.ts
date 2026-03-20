/**
 * 插件配置 Schema
 * 提供日程与天气配置项及默认值
 */

import { Schema } from "koishi";
import { DEFAULT_SCHEDULE_PROMPT } from "./constants";
import type { Config, VariablesConfig, WeatherConfig } from "./types";

export const name = "chatluna-schedule";

export const inject = {
  required: ["chatluna"],
  optional: ["puppeteer", "chatluna_character"],
};

export const DEFAULT_SCHEDULE_CONFIG = {
  enabled: true,
  model: "",
  personaSource: "none" as const,
  personaChatlunaPreset: "无",
  personaCustomPreset: "",
  timezone: "Asia/Shanghai",
  prompt: DEFAULT_SCHEDULE_PROMPT,
  renderAsImage: false,
  startDelay: 3000,
  registerTool: true,
  toolName: "daily_schedule",
};

export const DEFAULT_WEATHER_CONFIG: WeatherConfig = {
  enabled: false,
  cityName: "",
  hourlyRefresh: false,
  registerTool: false,
  toolName: "get_weather",
};

export const DEFAULT_VARIABLES_CONFIG: VariablesConfig = {
  schedule: "schedule",
  currentSchedule: "currentSchedule",
  outfit: "outfit",
  currentOutfit: "currentOutfit",
  weather: "weather",
};

const scheduleSchema = Schema.object({
  enabled: Schema.boolean()
    .default(DEFAULT_SCHEDULE_CONFIG.enabled)
    .description("是否启用日程功能"),
  model: Schema.dynamic("model")
    .default(DEFAULT_SCHEDULE_CONFIG.model || "")
    .description("日程生成使用的模型"),
  personaSource: Schema.union([
    Schema.const("none").description("不注入人设"),
    Schema.const("chatluna").description("使用 ChatLuna 主插件人设"),
    Schema.const("custom").description("使用自定义人设"),
  ])
    .default(DEFAULT_SCHEDULE_CONFIG.personaSource || "none")
    .description("人设注入来源"),
  personaChatlunaPreset: Schema.dynamic("preset")
    .default(DEFAULT_SCHEDULE_CONFIG.personaChatlunaPreset || "无")
    // @ts-expect-error Koishi Schema hidden callback is runtime-supported
    .hidden(
      (_: unknown, cfg: { personaSource?: string } | undefined) =>
        (cfg?.personaSource || "none") !== "chatluna",
    )
    .description("当选择主插件预设时，指定要注入的 ChatLuna 预设"),
  personaCustomPreset: Schema.string()
    .role("textarea")
    .default(DEFAULT_SCHEDULE_CONFIG.personaCustomPreset || "")
    // @ts-expect-error Koishi Schema hidden callback is runtime-supported
    .hidden(
      (_: unknown, cfg: { personaSource?: string } | undefined) =>
        (cfg?.personaSource || "none") !== "custom",
    )
    .description("当选择自定义人设时注入的文本内容"),
  timezone: Schema.string()
    .default(DEFAULT_SCHEDULE_CONFIG.timezone)
    .description("用于日程生成的时区"),
  prompt: Schema.string()
    .role("textarea")
    .default(DEFAULT_SCHEDULE_CONFIG.prompt)
    .description("日程生成提示词"),
  renderAsImage: Schema.boolean()
    .default(DEFAULT_SCHEDULE_CONFIG.renderAsImage)
    .description("将今日日程渲染为图片"),
  startDelay: Schema.number()
    .default(DEFAULT_SCHEDULE_CONFIG.startDelay)
    .description("启动延迟（毫秒），等待 ChatLuna 加载完成"),
  registerTool: Schema.boolean()
    .default(DEFAULT_SCHEDULE_CONFIG.registerTool)
    .description("注册 ChatLuna 工具：获取今日日程"),
  toolName: Schema.string()
    .default(DEFAULT_SCHEDULE_CONFIG.toolName)
    .description("工具名称"),
});

const weatherSchema = Schema.object({
  enabled: Schema.boolean()
    .default(DEFAULT_WEATHER_CONFIG.enabled)
    .description("是否启用天气功能"),
  cityName: Schema.string()
    .default(DEFAULT_WEATHER_CONFIG.cityName)
    .description("城市名称（如：长沙）"),
  hourlyRefresh: Schema.boolean()
    .default(DEFAULT_WEATHER_CONFIG.hourlyRefresh)
    .description("每小时刷新天气数据（关闭则每天刷新一次）"),
  registerTool: Schema.boolean()
    .default(DEFAULT_WEATHER_CONFIG.registerTool || false)
    .description("注册 ChatLuna 工具：获取天气"),
  toolName: Schema.string()
    .default(DEFAULT_WEATHER_CONFIG.toolName || "get_weather")
    .description("工具名称"),
});

const variablesSchema = Schema.object({
  schedule: Schema.string()
    .default(DEFAULT_VARIABLES_CONFIG.schedule)
    .description("今日日程变量名称"),
  currentSchedule: Schema.string()
    .default(DEFAULT_VARIABLES_CONFIG.currentSchedule)
    .description("当前日程变量名称"),
  outfit: Schema.string()
    .default(DEFAULT_VARIABLES_CONFIG.outfit)
    .description("今日穿搭变量名称"),
  currentOutfit: Schema.string()
    .default(DEFAULT_VARIABLES_CONFIG.currentOutfit)
    .description("当前穿搭变量名称"),
  weather: Schema.string()
    .default(DEFAULT_VARIABLES_CONFIG.weather)
    .description("天气变量名称"),
}).description("变量设置");

const otherSchema = Schema.object({
  debugLogging: Schema.boolean().default(false).description("是否输出调试日志"),
}).description("其他设置");

export const ConfigSchema: Schema<Config> = Schema.intersect([
  Schema.object({
    schedule: scheduleSchema
      .default(DEFAULT_SCHEDULE_CONFIG)
      .description("日程设置"),
    weather: weatherSchema
      .default(DEFAULT_WEATHER_CONFIG)
      .description("天气设置"),
    variables: variablesSchema,
  }),
  otherSchema,
]) as Schema<Config>;
