/**
 * XML 拦截器
 * 挂载并恢复 chatluna_character 原始输出拦截
 */

import type { Session } from "koishi";
import type { Config, LogFn } from "../../types";
import { RAW_INTERCEPTOR_TAG } from "../../constants";

interface CharacterService {
  collect?: (callback: (session: Session) => Promise<void>) => void;
  logger?: {
    debug?: (...args: unknown[]) => void;
  };
}

export interface XmlInterceptorDeps {
  ctx: import("koishi").Context;
  config: Config;
  log?: LogFn;
  onResponse: (response: string, session: Session | null) => boolean;
}

export interface XmlInterceptorRuntime {
  start: () => void;
  stop: () => void;
}

export function createXmlInterceptor(
  deps: XmlInterceptorDeps,
): XmlInterceptorRuntime {
  const { ctx, config, log, onResponse } = deps;
  const sessionMap = new Map<string, Session>();
  let currentGuildId: string | null = null;
  let lastSession: Session | null = null;
  const pendingSessions: Array<{
    key: string | null;
    session: Session;
    timestamp: number;
  }> = [];
  let responseSeq = 0;
  const processedResponses = new Set<string>();
  let monitorHandle: (() => void) | null = null;
  let fastRetryHandle: (() => void) | null = null;
  let startupHandle: (() => void) | null = null;
  const responseRetryHandles = new Map<string, () => void>();
  let activeService: CharacterService | null = null;
  let activeLogger: { debug?: (...args: unknown[]) => void } | null = null;
  let originalDebug: ((...args: unknown[]) => void) | null = null;
  let collectorBound = false;

  const restore = (): void => {
    if (activeLogger && originalDebug) {
      activeLogger.debug = originalDebug;
    }
    activeLogger = null;
    originalDebug = null;
  };

  const isActive = (): boolean => {
    const characterService = (
      ctx as unknown as { chatluna_character?: CharacterService }
    ).chatluna_character;
    const debugFn = characterService?.logger?.debug as unknown as
      | Record<string, unknown>
      | undefined;
    return Boolean(debugFn?.[RAW_INTERCEPTOR_TAG]);
  };

  const resolveSession = (): Session | null => {
    while (pendingSessions.length > 100) pendingSessions.shift();
    const now = Date.now();
    while (
      pendingSessions.length > 0 &&
      now - pendingSessions[0].timestamp > 12000
    ) {
      pendingSessions.shift();
    }

    if (pendingSessions.length === 0) {
      return (
        (currentGuildId ? sessionMap.get(currentGuildId) : null) ||
        lastSession ||
        null
      );
    }

    const contextKeys = new Set<string>();
    for (let i = 0; i < pendingSessions.length; i++) {
      contextKeys.add(pendingSessions[i].key || "__null__");
    }

    let resolved = pendingSessions[pendingSessions.length - 1];
    if (currentGuildId) {
      for (let i = pendingSessions.length - 1; i >= 0; i--) {
        if (pendingSessions[i].key === currentGuildId) {
          resolved = pendingSessions[i];
          break;
        }
      }
    }

    pendingSessions.length = 0;

    if (contextKeys.size > 1 && config.debugLogging) {
      log?.("warn", "检测到多个会话上下文，已使用最近会话继续执行 XML", {
        contextCount: contextKeys.size,
        preferredGuildId: currentGuildId,
        resolvedGuildId: resolved.key,
      });
    }

    return resolved.key
      ? sessionMap.get(resolved.key) || resolved.session
      : resolved.session;
  };

  const markProcessed = (responseId: string): void => {
    processedResponses.add(responseId);
    if (processedResponses.size > 100) {
      const first = processedResponses.values().next().value;
      if (first) processedResponses.delete(first);
    }
  };

  const runResponse = (
    responseId: string,
    response: string,
    session: Session | null,
  ): boolean => {
    const handled = onResponse(response, session);
    if (handled) {
      markProcessed(responseId);
      const retryHandle = responseRetryHandles.get(responseId);
      if (retryHandle) {
        retryHandle();
        responseRetryHandles.delete(responseId);
      }
    }
    return handled;
  };

  const retryResponse = (responseId: string, response: string): void => {
    if (
      responseRetryHandles.has(responseId) ||
      processedResponses.has(responseId)
    )
      return;
    const handle = ctx.setTimeout(() => {
      responseRetryHandles.delete(responseId);
      if (processedResponses.has(responseId)) return;
      const session = resolveSession();
      if (!session) {
        if (config.debugLogging) {
          log?.("warn", "拦截到原始输出但缺少会话上下文，XML 工具不会执行", {
            length: response.length,
          });
        }
        runResponse(responseId, response, null);
        return;
      }
      runResponse(responseId, response, session);
    }, 200);
    responseRetryHandles.set(responseId, handle);
  };

  const attach = (): boolean => {
    const characterService = (
      ctx as unknown as { chatluna_character?: CharacterService }
    ).chatluna_character;
    if (!characterService) return false;

    if (activeService !== characterService) {
      activeService = characterService;
      collectorBound = false;
    }

    if (!collectorBound && typeof characterService.collect === "function") {
      characterService.collect(async (session) => {
        const guildId =
          (session as unknown as { guildId?: string })?.guildId ||
          session?.channelId ||
          session?.userId ||
          null;
        currentGuildId = guildId;
        if (guildId) sessionMap.set(guildId, session);
        lastSession = session;
        pendingSessions.push({ key: guildId, session, timestamp: Date.now() });
      });
      collectorBound = true;
    }

    const loggerService = characterService.logger;
    if (!loggerService || typeof loggerService.debug !== "function")
      return false;

    const tagged = loggerService.debug as unknown as Record<string, unknown>;
    if (!tagged[RAW_INTERCEPTOR_TAG]) {
      restore();
      const raw = loggerService.debug.bind(loggerService);
      const wrapped = (...args: unknown[]) => {
        raw(...args);
        const message = args[0];
        if (typeof message !== "string") return;
        const prefix = ["model response: ", "model response:\n"].find((item) =>
          message.startsWith(item),
        );
        if (!prefix) return;
        const response = message.substring(prefix.length);
        if (!response) return;
        const responseId = `${Date.now()}:${responseSeq++}`;
        const session = resolveSession();
        if (!session) {
          retryResponse(responseId, response);
          return;
        }
        runResponse(responseId, response, session);
      };
      (wrapped as unknown as Record<string, unknown>)[RAW_INTERCEPTOR_TAG] =
        true;
      loggerService.debug = wrapped;
      activeLogger = loggerService;
      originalDebug = raw;
    }

    return true;
  };

  const stopFastRetry = (): void => {
    if (!fastRetryHandle) return;
    fastRetryHandle();
    fastRetryHandle = null;
  };

  const startFastRetry = (): void => {
    if (fastRetryHandle) return;
    fastRetryHandle = ctx.setInterval(() => {
      if (isActive()) {
        stopFastRetry();
        return;
      }
      const ready = attach();
      if (ready) {
        log?.("info", "原始输出拦截已恢复");
        stopFastRetry();
      }
    }, 3000);
  };

  const ensureActive = (): void => {
    if (isActive()) {
      stopFastRetry();
      return;
    }
    const ready = attach();
    if (!ready) {
      startFastRetry();
    }
  };

  const startMonitor = (): void => {
    if (monitorHandle) return;
    monitorHandle = ctx.setInterval(() => {
      ensureActive();
    }, 5000);
  };

  const stopMonitor = (): void => {
    if (!monitorHandle) return;
    monitorHandle();
    monitorHandle = null;
  };

  return {
    start: () => {
      const delay = 3000;
      if (startupHandle) return;
      startupHandle = ctx.setTimeout(() => {
        startupHandle = null;
        const ready = attach();
        if (ready) {
          log?.("info", "已启用原始输出拦截模式");
        } else {
          log?.("warn", "chatluna_character 服务不可用，将每3秒重试一次");
          startFastRetry();
        }
        startMonitor();
      }, delay);
    },
    stop: () => {
      if (startupHandle) {
        startupHandle();
        startupHandle = null;
      }
      stopFastRetry();
      stopMonitor();
      for (const handle of responseRetryHandles.values()) handle();
      responseRetryHandles.clear();
      processedResponses.clear();
      restore();
      sessionMap.clear();
      pendingSessions.length = 0;
      currentGuildId = null;
      lastSession = null;
      activeService = null;
    },
  };
}
