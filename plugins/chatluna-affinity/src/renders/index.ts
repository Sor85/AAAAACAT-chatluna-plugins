/**
 * 渲染模块统一导出
 * 提供所有渲染器的创建函数和类型
 */

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
  log?: LogFn;
}

export function createRenderService(options: RenderServiceOptions) {
  const { log } = options;

  return {
    rankList: createRankListRenderer(log),
    inspect: createInspectRenderer(log),
    blacklist: createBlacklistRenderer(log),
    table: createTableRenderer(log),
  };
}

export type RenderService = ReturnType<typeof createRenderService>;
