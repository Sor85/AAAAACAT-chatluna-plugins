/**
 * 插件配置模型与默认值
 * 定义后端地址、超时与自动补全开关
 */

import { Schema } from "koishi";

export type EmptyTextAutoFillSource = "template-default" | "user-nickname";

export interface EmptyTextAutoFillRule {
  source: EmptyTextAutoFillSource;
  enabled: boolean;
  weight: number;
}

export interface Config {
  baseUrl: string;
  timeoutMs: number;
  emptyTextAutoFillRules: EmptyTextAutoFillRule[];
  autoFillDefaultTextsWhenEmpty?: boolean;
  autoUseAvatarWhenMinImagesOneAndNoImage: boolean;
  autoFillOneMissingImageWithAvatar: boolean;
  autoFillSenderAndBotAvatarsWhenMinImagesTwoAndNoImage: boolean;
  autoUseGroupNicknameWhenNoDefaultText: boolean;
  renderMemeListAsImage: boolean;
  enableDirectAliasWithoutPrefix: boolean;
  allowMentionPrefixDirectAliasTrigger: boolean;
  enableRandomDedupeWithinHours: boolean;
  randomDedupeWindowHours: number;
  enableRandomKeywordNotice: boolean;
  enableInfoFetchConcurrencyLimit: boolean;
  infoFetchConcurrency: number;
  initLoadRetryTimes: number;
  disableErrorReplyToPlatform: boolean;
}

export const defaultConfig: Config = {
  baseUrl: "http://192.168.5.3:2233",
  timeoutMs: 10000,
  emptyTextAutoFillRules: [
    {
      source: "template-default",
      enabled: true,
      weight: 100,
    },
    {
      source: "user-nickname",
      enabled: false,
      weight: 100,
    },
  ],
  autoUseAvatarWhenMinImagesOneAndNoImage: true,
  autoFillOneMissingImageWithAvatar: true,
  autoFillSenderAndBotAvatarsWhenMinImagesTwoAndNoImage: true,
  autoUseGroupNicknameWhenNoDefaultText: false,
  renderMemeListAsImage: false,
  enableDirectAliasWithoutPrefix: true,
  allowMentionPrefixDirectAliasTrigger: false,
  enableRandomDedupeWithinHours: false,
  randomDedupeWindowHours: 24,
  enableRandomKeywordNotice: false,
  enableInfoFetchConcurrencyLimit: false,
  infoFetchConcurrency: 10,
  initLoadRetryTimes: 3,
  disableErrorReplyToPlatform: false,
};

export const ConfigSchema: Schema<Config> = Schema.object({
  baseUrl: Schema.string()
    .role("link")
    .default(defaultConfig.baseUrl)
    .description("meme-generator-main 后端地址"),
  timeoutMs: Schema.number()
    .min(1000)
    .max(60000)
    .default(defaultConfig.timeoutMs)
    .description("HTTP 请求超时时间（毫秒）"),
  emptyTextAutoFillRules: Schema.array(
    Schema.object({
      source: Schema.union([
        Schema.const("template-default").description("模板默认文字"),
        Schema.const("user-nickname").description("用户昵称"),
      ]).required(),
      enabled: Schema.boolean().default(true).description("是否启用"),
      weight: Schema.number()
        .min(0)
        .max(1000)
        .step(1)
        .default(100)
        .description("权重（仅双开时参与随机分配）"),
    }),
  )
    .role("table")
    .default(defaultConfig.emptyTextAutoFillRules)
    .description(
      "用户未提供文字时的自动补全文案来源（两个来源都开启时按权重随机分配）",
    ),
  autoFillDefaultTextsWhenEmpty: Schema.boolean()
    .default(true)
    .description("兼容旧配置：用户未提供文字时是否自动使用模板默认文字")
    .hidden(),
  autoUseAvatarWhenMinImagesOneAndNoImage: Schema.boolean()
    .default(defaultConfig.autoUseAvatarWhenMinImagesOneAndNoImage)
    .description("最少需求图片数为 1 且无图时是否自动补发送者头像"),
  autoFillOneMissingImageWithAvatar: Schema.boolean()
    .default(defaultConfig.autoFillOneMissingImageWithAvatar)
    .description(
      "用户已提供图片且仅差 1 张图达到最少需求时是否自动补发送者头像",
    ),
  autoFillSenderAndBotAvatarsWhenMinImagesTwoAndNoImage: Schema.boolean()
    .default(
      defaultConfig.autoFillSenderAndBotAvatarsWhenMinImagesTwoAndNoImage,
    )
    .description("最少需求图片数为 2 且无图时是否自动补发送者与 bot 头像"),
  autoUseGroupNicknameWhenNoDefaultText: Schema.boolean()
    .default(defaultConfig.autoUseGroupNicknameWhenNoDefaultText)
    .description("无默认文字且用户未提供文本时是否优先使用群昵称补文案"),
  renderMemeListAsImage: Schema.boolean()
    .default(defaultConfig.renderMemeListAsImage)
    .description("meme.list 是否渲染为图片输出"),
  enableDirectAliasWithoutPrefix: Schema.boolean()
    .default(defaultConfig.enableDirectAliasWithoutPrefix)
    .description("是否允许使用中文别名跳过指令前缀直接触发"),
  allowMentionPrefixDirectAliasTrigger: Schema.boolean()
    .default(defaultConfig.allowMentionPrefixDirectAliasTrigger)
    .description("开启后允许贴合参数（如 看看你的@user1@user2）"),
  enableRandomDedupeWithinHours: Schema.boolean()
    .default(defaultConfig.enableRandomDedupeWithinHours)
    .description("是否开启 meme.random 在时间窗口内随机去重"),
  randomDedupeWindowHours: Schema.number()
    .min(1)
    .max(720)
    .step(1)
    .default(defaultConfig.randomDedupeWindowHours)
    .description("meme.random 去重时间窗口（小时）"),
  enableRandomKeywordNotice: Schema.boolean()
    .default(defaultConfig.enableRandomKeywordNotice)
    .description("meme.random 是否同时发出模板关键词提示"),
  enableInfoFetchConcurrencyLimit: Schema.boolean()
    .default(defaultConfig.enableInfoFetchConcurrencyLimit)
    .description("是否开启模板信息拉取并发限制"),
  infoFetchConcurrency: Schema.number()
    .min(1)
    .max(100)
    .step(1)
    .default(defaultConfig.infoFetchConcurrency)
    .description("模板信息拉取并发上限（开启并发限制后生效）"),
  initLoadRetryTimes: Schema.number()
    .min(0)
    .max(20)
    .step(1)
    .default(defaultConfig.initLoadRetryTimes)
    .description("插件初始化载入表情失败后的自动重试次数"),
  disableErrorReplyToPlatform: Schema.boolean()
    .default(defaultConfig.disableErrorReplyToPlatform)
    .description("开启后不向平台回复错误提示，仅写入日志"),
});
