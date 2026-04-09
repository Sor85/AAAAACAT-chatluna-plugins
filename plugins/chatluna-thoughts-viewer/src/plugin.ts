/**
 * 插件主逻辑
 * 注册命令并在 chatluna_character 可用时挂载 think runtime
 */

import type { Context } from "koishi";
import { registerThinkCommand } from "./commands/think";
import {
  createThinkRuntime,
  type CharacterServiceLike,
} from "./runtime/think-runtime";
import { createThinkStore } from "./store/think-store";
import type { Config, LogFn, LogLevel } from "./types";

interface CharacterContextLike {
  chatluna_character?: CharacterServiceLike;
}

function createLogger(ctx: Context, config: Config): LogFn {
  const logger = ctx.logger ? ctx.logger("chatluna-thoughts-viewer") : null;

  const writers: Record<LogLevel, (...args: unknown[]) => void> = {
    debug: logger?.debug?.bind(logger) || console.debug,
    info: logger?.info?.bind(logger) || console.info,
    warn: logger?.warn?.bind(logger) || console.warn,
    error: logger?.error?.bind(logger) || console.error,
  };

  return (level, message, detail) => {
    if (!config.debugLogging && level === "debug") return;

    const writer = writers[level];
    if (detail === undefined) {
      writer(message);
      return;
    }

    writer(message, detail);
  };
}

export function apply(ctx: Context, config: Config): void {
  const log = createLogger(ctx, config);
  const store = createThinkStore();
  let characterCtx: Context | null = null;

  const resolveCharacterService = (): CharacterServiceLike | null | undefined => {
    if (!characterCtx) {
      return null;
    }

    return (characterCtx as unknown as CharacterContextLike).chatluna_character;
  };

  const runtime = createThinkRuntime({
    getCharacterService: resolveCharacterService,
    config,
    store,
    log,
  });

  const stopRuntimeSafely = (): void => {
    if (!runtime.isActive()) return;
    runtime.stop();
  };

  registerThinkCommand({
    ctx,
    config,
    store,
  });

  ctx.inject(["chatluna_character"], (innerCtx) => {
    characterCtx = innerCtx;
    const started = runtime.start();
    if (!started) {
      log("warn", "think runtime 启动失败，getTemp 接口不可用");
    }

    innerCtx.on("dispose", () => {
      stopRuntimeSafely();
      if (characterCtx === innerCtx) {
        characterCtx = null;
      }
    });
  });

  ctx.on("dispose", () => {
    characterCtx = null;
    stopRuntimeSafely();
  });
}
