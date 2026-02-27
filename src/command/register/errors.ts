/**
 * register 运行时错误处理
 * 统一错误映射与平台回复策略
 */

import type { Context } from "koishi";
import type { Config } from "../../config";
import { mapBackendStatus, mapNetworkError } from "../../infra/errors";
import type { HttpLikeError } from "./types";

export function asHttpError(error: unknown): HttpLikeError {
  if (typeof error !== "object" || error === null) {
    return { message: String(error) };
  }

  return error as HttpLikeError;
}

export function mapRuntimeErrorMessage(error: unknown): string {
  const httpError = asHttpError(error);
  if (httpError.response?.status) {
    return mapBackendStatus(
      httpError.response.status,
      httpError.response.data?.detail,
    );
  }
  return mapNetworkError(error);
}

export function replyOrSilent(
  config: Config,
  logger: ReturnType<Context["logger"]>,
  scope: string,
  message: string,
): string {
  if (config.disableErrorReplyToPlatform) {
    logger.warn("%s skipped reply: %s", scope, message);
    return "";
  }
  return message;
}
