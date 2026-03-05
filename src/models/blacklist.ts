/**
 * 黑名单数据表定义
 * 定义 chatluna_blacklist 表结构及类型声明
 */

import type { Context } from "koishi";
import type { BlacklistRecord } from "../types";

export const BLACKLIST_MODEL_NAME = "chatluna_blacklist";

declare module "koishi" {
  interface Tables {
    [BLACKLIST_MODEL_NAME]: BlacklistRecord;
  }
}

export function extendBlacklistModel(ctx: Context): void {
  ctx.model.extend(
    BLACKLIST_MODEL_NAME,
    {
      platform: { type: "string", length: 64 },
      userId: { type: "string", length: 64 },
      mode: { type: "string", length: 16 },
      blockedAt: { type: "timestamp" },
      expiresAt: { type: "timestamp", nullable: true },
      nickname: { type: "string", length: 255, nullable: true },
      note: { type: "string", length: 255, nullable: true },
      channelId: { type: "string", length: 128, nullable: true },
      durationHours: { type: "integer", nullable: true },
      penalty: { type: "integer", nullable: true },
    },
    { primary: ["platform", "userId", "mode"] },
  );
}
