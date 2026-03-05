/**
 * 用户自定义昵称数据表定义
 * 定义 chatluna_user_alias 表结构及类型声明
 */

import type { Context } from "koishi";
import type { UserAliasRecord } from "../types";

export const USER_ALIAS_MODEL_NAME = "chatluna_user_alias";

declare module "koishi" {
  interface Tables {
    [USER_ALIAS_MODEL_NAME]: UserAliasRecord;
  }
}

export function extendUserAliasModel(ctx: Context): void {
  ctx.model.extend(
    USER_ALIAS_MODEL_NAME,
    {
      platform: { type: "string", length: 64 },
      userId: { type: "string", length: 64 },
      alias: { type: "string", length: 255 },
      updatedAt: { type: "timestamp" },
    },
    { primary: ["platform", "userId"] },
  );
}
