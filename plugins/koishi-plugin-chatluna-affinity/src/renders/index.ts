/**
 * 渲染模块统一导出
 * 提供所有渲染器的创建函数和类型
 */

import type { Context } from "koishi";
import type { LogFn } from "../types";
import { createRankListRenderer } from "./rank-list";
import { createInspectRenderer } from "./inspect";
import { createBlacklistRenderer } from "./blacklist";
import { createTableRenderer } from "./table";

export * from "./styles";
export * from "./base";
export * from "./rank-list";
export * from "./inspect";
export * from "./blacklist";
export * from "./table";

export interface RenderServiceOptions {
  ctx: Context;
  log?: LogFn;
}

export function createRenderService(options: RenderServiceOptions) {
  const { ctx, log } = options;

  return {
    rankList: createRankListRenderer(ctx, log),
    inspect: createInspectRenderer(ctx, log),
    blacklist: createBlacklistRenderer(ctx, log),
    table: createTableRenderer(ctx, log),
  };
}

export type RenderService = ReturnType<typeof createRenderService>;
