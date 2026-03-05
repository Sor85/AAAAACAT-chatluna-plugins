/**
 * 数据模型统一导出
 * 提供数据库模型注册入口
 */

import type { Context } from "koishi";
import { extendAffinityModel, MODEL_NAME } from "./affinity";
import { extendBlacklistModel, BLACKLIST_MODEL_NAME } from "./blacklist";
import { extendUserAliasModel, USER_ALIAS_MODEL_NAME } from "./user-alias";

export { MODEL_NAME, BLACKLIST_MODEL_NAME, USER_ALIAS_MODEL_NAME };

export function registerModels(ctx: Context): void {
  extendAffinityModel(ctx);
  extendBlacklistModel(ctx);
  extendUserAliasModel(ctx);
}

export * from "./affinity";
export * from "./blacklist";
export * from "./user-alias";
