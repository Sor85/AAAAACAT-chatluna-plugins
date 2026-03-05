/**
 * 插件主逻辑
 * 组装所有模块并初始化插件功能
 */

import * as path from "path";
import { Context, Session } from "koishi";
import { ChatLunaPlugin } from "koishi-plugin-chatluna/services/chat";

import type { Config } from "./types";
import { BASE_AFFINITY_DEFAULTS } from "./constants";
import { registerModels } from "./models";
import { createLogger } from "./helpers";
import { stripAtPrefix } from "./utils";
import { createAffinityStore } from "./services/affinity/store";
import { createAffinityCache } from "./services/affinity/cache";
import {
  resolveShortTermConfig,
  resolveActionWindowConfig,
} from "./services/affinity/calculator";
import { applyAffinityDelta } from "./services/affinity/apply-delta";
import { createMessageHistory } from "./services/message/history";
import { createBlacklistService } from "./services/blacklist/repository";
import { createBlacklistGuard } from "./services/blacklist/guard";
import { createUserAliasService } from "./services/user-alias/repository";
import { createLevelResolver } from "./services/relationship/level-resolver";
import { createManualRelationshipManager } from "./services/relationship/manual-config";
import { createRenderService } from "./renders";
import {
  createAffinityProvider,
  createRelationshipLevelProvider,
  createBlacklistListProvider,
  createUserAliasProvider,
} from "./integrations/chatluna/variables";
import {
  createRelationshipTool,
  createBlacklistTool,
} from "./integrations/chatluna/tools";
import {
  registerRankCommand,
  registerInspectCommand,
  registerBlacklistCommand,
  registerBlockCommand,
  registerTempBlockCommand,
  registerClearAllCommand,
  registerAdjustCommand,
} from "./commands";
import {
  fetchMember,
  resolveUserIdentity,
  findMemberByName,
  fetchGroupMemberIds,
  resolveGroupId,
} from "./helpers/member";
const BASE_KEYS = Object.keys(BASE_AFFINITY_DEFAULTS);

function normalizeBaseAffinityConfig(config: Config): void {
  const base = {
    ...BASE_AFFINITY_DEFAULTS,
    ...(config.baseAffinityConfig || {}),
  };
  for (const key of BASE_KEYS) {
    const legacy = (config as unknown as Record<string, unknown>)[key];
    if (legacy !== undefined && legacy !== null) {
      const numeric = Number(legacy);
      if (Number.isFinite(numeric))
        (base as Record<string, number>)[key] = numeric;
    }
  }
  config.baseAffinityConfig = base;
  for (const key of BASE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(config, key))
      delete (config as unknown as Record<string, unknown>)[key];
    Object.defineProperty(config, key, {
      configurable: true,
      enumerable: true,
      get() {
        const target = (
          config.baseAffinityConfig as unknown as Record<string, number>
        )?.[key];
        return Number.isFinite(target)
          ? target
          : (BASE_AFFINITY_DEFAULTS as unknown as Record<string, number>)[key];
      },
      set(value: number) {
        if (!config.baseAffinityConfig)
          config.baseAffinityConfig = { ...BASE_AFFINITY_DEFAULTS };
        (config.baseAffinityConfig as unknown as Record<string, number>)[key] =
          value;
      },
    });
  }
}

function normalizeToolSettings(config: Config): void {
  const nativeToolSettings = {
    registerRelationshipTool:
      config.nativeToolSettings?.registerRelationshipTool ?? false,
    relationshipToolName:
      config.nativeToolSettings?.relationshipToolName || "relationship",
    registerBlacklistTool:
      config.nativeToolSettings?.registerBlacklistTool ?? false,
    blacklistToolName:
      config.nativeToolSettings?.blacklistToolName || "blacklist",
  };

  const xmlToolSettings = {
    enableAffinityXmlToolCall:
      config.xmlToolSettings?.enableAffinityXmlToolCall ?? true,
    enableBlacklistXmlToolCall:
      config.xmlToolSettings?.enableBlacklistXmlToolCall ?? true,
    enableRelationshipXmlToolCall:
      config.xmlToolSettings?.enableRelationshipXmlToolCall ?? true,
    enableUserAliasXmlToolCall:
      config.xmlToolSettings?.enableUserAliasXmlToolCall ?? true,
    characterPromptTemplate:
      config.xmlToolSettings?.characterPromptTemplate ||
      (config as unknown as { characterPromptTemplate?: string })
        .characterPromptTemplate ||
      "",
  };

  const variableSettings = {
    affinityVariableName:
      config.variableSettings?.affinityVariableName ||
      (config as unknown as { affinityVariableName?: string })
        .affinityVariableName ||
      "affinity",
    relationshipAffinityLevelVariableName:
      config.variableSettings?.relationshipAffinityLevelVariableName ||
      (config as unknown as { relationshipAffinityLevelVariableName?: string })
        .relationshipAffinityLevelVariableName ||
      "relationshipAffinityLevel",
    blacklistListVariableName:
      config.variableSettings?.blacklistListVariableName ||
      (config as unknown as { blacklistListVariableName?: string })
        .blacklistListVariableName ||
      "blacklistList",
    userAliasVariableName:
      config.variableSettings?.userAliasVariableName ||
      (config as unknown as { userAliasVariableName?: string })
        .userAliasVariableName ||
      "userAlias",
  };

  config.nativeToolSettings = nativeToolSettings;
  config.xmlToolSettings = xmlToolSettings;
  config.variableSettings = variableSettings;
}

function parseSelfClosingXmlTags(
  text: string,
  tagName: string,
): Array<Record<string, string>> {
  const tags = Array.from(
    text.matchAll(new RegExp(`<${tagName}\\b([^>]*)\\/>`, "gi")),
  );
  if (!tags.length) return [];

  return tags.map((tag) => {
    const attrText = String(tag[1] || "");
    const attrs: Record<string, string> = {};
    for (const pair of attrText.matchAll(/([a-zA-Z_][\w-]*)="([^"]*)"/g)) {
      attrs[pair[1]] = pair[2];
    }
    return attrs;
  });
}

export function apply(ctx: Context, config: Config): void {
  normalizeBaseAffinityConfig(config);
  normalizeToolSettings(config);
  registerModels(ctx);

  // @ts-expect-error - Config type compatibility with ChatLunaPlugin
  const plugin = new ChatLunaPlugin(ctx, config, "affinity", false);

  ctx.inject(["console"], (innerCtx) => {
    const consoleService = (
      innerCtx as unknown as {
        console?: { addEntry?: (entry: unknown) => void };
      }
    ).console;
    consoleService?.addEntry?.({
      dev: path.resolve(__dirname, "../client/index.ts"),
      prod: path.resolve(__dirname, "../dist"),
    });
  });

  const log = createLogger(ctx, config);

  log(
    "warn",
    "⚠️ 升级提示：0.2.1-alpha.10 版本后数据库结构已重构，若出现数据库相关错误，请执行 affinity.clearall 命令清除数据后重试。好感度分析提示词已更新，若您自定义过提示词，请将其恢复默认以应用最新版本。",
  );
  const cache = createAffinityCache();
  const store = createAffinityStore({ ctx, config, log });
  const shortTermConfig = resolveShortTermConfig(config);
  const actionWindowConfig = resolveActionWindowConfig(config);
  const history = createMessageHistory({ ctx, config, log });
  const levelResolver = createLevelResolver(config);
  const manualRelationship = createManualRelationshipManager({
    ctx,
    config,
    log,
    applyConfigUpdate: () => {
      ctx.scope.update(config, false);
    },
  });
  const blacklist = createBlacklistService({
    ctx,
    config,
    log,
  });
  const userAlias = createUserAliasService({
    ctx,
    log,
  });
  const renders = createRenderService({ ctx, log });

  ctx.accept(
    ["relationships"],
    () => {
      manualRelationship
        .syncToDatabase()
        .catch((error) => log("warn", "同步特殊关系配置到数据库失败", error));
    },
    { passive: true },
  );

  const blacklistGuard = createBlacklistGuard({
    config,
    blacklist,
    log,
  });
  ctx.middleware(
    blacklistGuard.middleware as Parameters<typeof ctx.middleware>[0],
    true,
  );

  const affinityInitCache = new Set<string>();
  const makeAffinityInitKey = (session: Session): string =>
    `${session.platform || "unknown"}:${session.selfId || "self"}:${session.userId || "unknown"}`;

  ctx.middleware(async (session, next) => {
    if (config.affinityEnabled) {
      const platform = session?.platform;
      const userId = session?.userId;
      const selfId = session?.selfId;
      if (platform && userId && selfId && userId !== selfId) {
        const key = makeAffinityInitKey(session);
        if (!affinityInitCache.has(key)) {
          affinityInitCache.add(key);
          try {
            const state = await store.ensureForUser(
              session,
              userId,
              (value, low, high) => Math.min(Math.max(value, low), high),
            );
            if (state.isNew && config.debugLogging) {
              log("debug", "已初始化好感度记录", { platform, selfId, userId });
            }
          } catch (error) {
            affinityInitCache.delete(key);
            log("warn", "初始化好感度失败", error);
          }
        }
      }
    }
    return next();
  });

  let rawModelResponseGuildId: string | null = null;
  const rawModelResponseSessionMap = new Map<string, Session>();
  let rawInterceptorMonitorHandle: (() => void) | null = null;
  let rawInterceptorFastRetryHandle: (() => void) | null = null;
  let rawInterceptorReady = false;
  let rawInterceptorService: unknown | null = null;
  let rawInterceptorLogger: { debug?: (...args: unknown[]) => void } | null =
    null;
  let rawInterceptorOriginalDebug: ((...args: unknown[]) => void) | null = null;
  let rawCollectorBound = false;
  let rawInterceptorDisposeBound = false;
  const RAW_INTERCEPTOR_TAG = "__chatlunaAffinityRawInterceptor";
  const RAW_INTERCEPTOR_MONITOR_INTERVAL = 5 * 1000;
  const RAW_INTERCEPTOR_FAST_INTERVAL = 3 * 1000;

  const restoreRawModelInterceptor = (): void => {
    if (rawInterceptorLogger && rawInterceptorOriginalDebug) {
      rawInterceptorLogger.debug = rawInterceptorOriginalDebug;
    }
    rawInterceptorLogger = null;
    rawInterceptorOriginalDebug = null;
  };

  const isRawInterceptorActive = (): boolean => {
    const characterService = (
      ctx as unknown as {
        chatluna_character?: {
          logger?: {
            debug?: (...args: unknown[]) => void;
          };
        };
      }
    ).chatluna_character;
    const debugFn = characterService?.logger?.debug as unknown as
      | { [key: string]: boolean }
      | undefined;
    return Boolean(debugFn?.[RAW_INTERCEPTOR_TAG]);
  };

  const initRawModelInterceptor = (): boolean => {
    const characterService = (
      ctx as unknown as {
        chatluna_character?: {
          collect?: (callback: (session: Session) => Promise<void>) => void;
          logger?: {
            debug: (...args: unknown[]) => void;
          };
        };
      }
    ).chatluna_character;
    if (!characterService) return false;
    if (rawInterceptorService !== characterService) {
      rawInterceptorService = characterService;
      rawCollectorBound = false;
    }

    if (!rawCollectorBound && typeof characterService.collect === "function") {
      characterService.collect?.(async (session: Session) => {
        const guildId =
          (session as unknown as { guildId?: string })?.guildId ||
          session?.channelId ||
          session?.userId ||
          null;
        rawModelResponseGuildId = guildId;
        if (guildId) rawModelResponseSessionMap.set(guildId, session);
      });
      rawCollectorBound = true;
    }

    const characterLogger = characterService.logger;
    if (!characterLogger || typeof characterLogger.debug !== "function")
      return false;

    const taggedDebug = characterLogger.debug as unknown as {
      [key: string]: boolean;
    };
    if (!taggedDebug[RAW_INTERCEPTOR_TAG]) {
      restoreRawModelInterceptor();
      const originalDebug = characterLogger.debug.bind(characterLogger);
      const wrappedDebug = async (...args: unknown[]) => {
        originalDebug(...args);
        const message = args[0];
        if (
          typeof message !== "string" ||
          !message.startsWith("model response: ")
        )
          return;
        const response = message.substring("model response: ".length);
        if (!response) return;
        if (!rawModelResponseGuildId) {
          log("warn", "拦截到原始输出但缺少会话上下文，XML 工具不会执行", {
            length: response.length,
          });
          return;
        }

        const effectiveSession =
          rawModelResponseSessionMap.get(rawModelResponseGuildId) || null;

        if (!effectiveSession) {
          log("warn", "检测到好感度标记但缺少会话上下文", {
            guildId: rawModelResponseGuildId,
          });
          return;
        }

        if (config.debugLogging) {
          log("debug", "拦截到原始输出", {
            guildId: rawModelResponseGuildId,
            length: response.length,
          });
        }

        if (
          config.affinityEnabled &&
          config.xmlToolSettings.enableAffinityXmlToolCall
        ) {
          const affinityMatches = Array.from(
            response.matchAll(
              /<affinity\s+delta="([^"]+)"\s+action="(increase|decrease)"\s+id="([^"]+)"\s*\/>/gi,
            ),
          );
          if (affinityMatches.length) {
            for (const match of affinityMatches) {
              const delta = parseInt(String(match[1] || "0").trim(), 10);
              const action = String(match[2] || "increase")
                .trim()
                .toLowerCase() as "increase" | "decrease";
              const userId = String(match[3] || "").trim();
              if (!isNaN(delta) && delta > 0 && userId) {
                void applyAffinityDelta({
                  session: effectiveSession,
                  userId,
                  delta,
                  action,
                  store: {
                    ensureForUser: store.ensureForUser,
                    save: store.save as (
                      seed: {
                        platform: string;
                        userId: string;
                        selfId?: string;
                        session?: Session;
                      },
                      value: number,
                      relation: string,
                      extra?: Record<string, unknown>,
                    ) => Promise<unknown>,
                    clamp: store.clamp,
                  },
                  levelResolver: {
                    resolveLevelByAffinity:
                      levelResolver.resolveLevelByAffinity,
                  },
                  maxIncrease: config.maxIncreasePerMessage || 5,
                  maxDecrease: config.maxDecreasePerMessage || 3,
                  maxActionEntries: actionWindowConfig.maxEntries,
                  shortTermConfig,
                  log,
                }).catch((error) => {
                  log("warn", "处理 affinity XML 动作失败", error);
                });
              }
            }
          }
        }

        if (config.xmlToolSettings.enableBlacklistXmlToolCall) {
          const blacklistTags = parseSelfClosingXmlTags(response, "blacklist");
          for (const attrs of blacklistTags) {
            const actionRaw = String(attrs.action || "")
              .trim()
              .toLowerCase();
            const action =
              actionRaw === "add" || actionRaw === "remove" ? actionRaw : "";
            const modeRaw = String(attrs.mode || "permanent")
              .trim()
              .toLowerCase();
            const mode =
              modeRaw === "temporary" || modeRaw === "permanent" ? modeRaw : "";
            const platform = String(attrs.platform || "onebot").trim();
            const userId = String(attrs.id || attrs.targetUserId || "").trim();
            const note = String(attrs.note || "xml").trim();
            if (!action || !mode || !platform || !userId) continue;

            const channelId =
              (effectiveSession as unknown as { guildId?: string })?.guildId ||
              effectiveSession?.channelId ||
              (effectiveSession as unknown as { roomId?: string })?.roomId ||
              "";

            if (mode === "temporary") {
              if (action === "remove") {
                await blacklist.removeTemporary(platform, userId);
                cache.clear(platform, userId);
                continue;
              }

              const durationRaw = Number(attrs.durationHours || "");
              if (!Number.isFinite(durationRaw) || durationRaw <= 0) continue;
              const durationHours = durationRaw;
              const penalty = Math.max(
                0,
                Number(config.shortTermBlacklistPenalty ?? 5),
              );

              let nickname = "";
              try {
                const existing = await store.load(
                  effectiveSession.selfId || "",
                  userId,
                );
                nickname = existing?.nickname || "";
              } catch {
                /* ignore */
              }

              const entry = await blacklist.recordTemporary(
                platform,
                userId,
                durationHours,
                penalty,
                {
                  note,
                  nickname,
                  channelId,
                },
              );
              if (!entry) continue;

              if (penalty > 0 && effectiveSession.selfId) {
                try {
                  const record = await store.load(
                    effectiveSession.selfId,
                    userId,
                  );
                  if (record) {
                    const nextAffinity = store.clamp(
                      (record.longTermAffinity ?? record.affinity) - penalty,
                    );
                    await store.save(
                      {
                        platform,
                        userId,
                        selfId: effectiveSession.selfId,
                        session: effectiveSession,
                      },
                      nextAffinity,
                      record.relation || "",
                    );
                  }
                } catch {
                  /* ignore */
                }
              }
              cache.clear(platform, userId);
              continue;
            }

            if (action === "add") {
              let nickname = "";
              try {
                const existing = await store.load(
                  effectiveSession.selfId || "",
                  userId,
                );
                nickname = existing?.nickname || "";
              } catch {
                /* ignore */
              }
              await blacklist.recordPermanent(platform, userId, {
                note,
                nickname,
                channelId,
              });
              cache.clear(platform, userId);
              continue;
            }

            await blacklist.removePermanent(platform, userId, channelId);
            cache.clear(platform, userId);
          }
        }

        if (config.xmlToolSettings.enableUserAliasXmlToolCall) {
          const userAliasTags = parseSelfClosingXmlTags(response, "userAlias");
          for (const attrs of userAliasTags) {
            const platform = String(attrs.platform || "onebot").trim();
            const userId = String(attrs.id || attrs.targetUserId || "").trim();
            const alias = String(attrs.name || attrs.alias || "").trim();
            if (!platform || !userId || !alias) continue;
            await userAlias.setAlias(platform, userId, alias);
          }
        }

        if (config.xmlToolSettings.enableRelationshipXmlToolCall) {
          const relationshipTags = parseSelfClosingXmlTags(
            response,
            "relationship",
          );
          for (const attrs of relationshipTags) {
            const relation = String(attrs.relation || "").trim();
            const platform = String(attrs.platform || "onebot").trim();
            const userId = String(attrs.id || attrs.targetUserId || "").trim();
            if (!relation || !platform || !userId) continue;

            await store.save(
              {
                platform,
                userId,
                selfId: effectiveSession.selfId,
                session: effectiveSession,
              },
              NaN,
              relation,
            );
            cache.clear(platform, userId);
          }
        }
      };
      (wrappedDebug as unknown as { [key: string]: boolean })[
        RAW_INTERCEPTOR_TAG
      ] = true;
      characterLogger.debug = wrappedDebug;
      rawInterceptorLogger = characterLogger;
      rawInterceptorOriginalDebug = originalDebug;
    }
    if (!rawInterceptorDisposeBound) {
      ctx.on("dispose", () => {
        restoreRawModelInterceptor();
      });
      rawInterceptorDisposeBound = true;
    }
    return true;
  };

  const stopRawInterceptorFastRetry = (): void => {
    if (!rawInterceptorFastRetryHandle) return;
    rawInterceptorFastRetryHandle();
    rawInterceptorFastRetryHandle = null;
  };

  const startRawInterceptorFastRetry = (): void => {
    if (rawInterceptorFastRetryHandle) return;
    rawInterceptorFastRetryHandle = ctx.setInterval(() => {
      if (isRawInterceptorActive()) {
        rawInterceptorReady = true;
        stopRawInterceptorFastRetry();
        return;
      }
      const ready = initRawModelInterceptor();
      if (ready && !rawInterceptorReady) {
        log("info", "原始输出拦截已恢复");
      }
      rawInterceptorReady = ready;
      if (ready) stopRawInterceptorFastRetry();
    }, RAW_INTERCEPTOR_FAST_INTERVAL);
  };

  const ensureRawInterceptorActive = (): void => {
    if (isRawInterceptorActive()) {
      rawInterceptorReady = true;
      stopRawInterceptorFastRetry();
      return;
    }
    const ready = initRawModelInterceptor();
    if (ready && !rawInterceptorReady) {
      log("info", "原始输出拦截已恢复");
    }
    rawInterceptorReady = ready;
    if (!ready) startRawInterceptorFastRetry();
  };

  const startRawInterceptorMonitor = (): void => {
    if (rawInterceptorMonitorHandle) return;
    rawInterceptorMonitorHandle = ctx.setInterval(() => {
      const wasReady = rawInterceptorReady;
      ensureRawInterceptorActive();
      if (!rawInterceptorReady && wasReady) {
        log("warn", "原始输出拦截失效，将继续重试");
      }
    }, RAW_INTERCEPTOR_MONITOR_INTERVAL);
  };

  const startDelay = 3000;
  log("debug", `原始输出拦截将在 ${startDelay}ms 后启动`);
  ctx.setTimeout(() => {
    rawInterceptorReady = initRawModelInterceptor();
    if (rawInterceptorReady) {
      log("info", "已启用原始输出拦截模式");
    } else {
      log("warn", "chatluna_character 服务不可用，将每3秒重试一次");
      startRawInterceptorFastRetry();
    }
    startRawInterceptorMonitor();
  }, startDelay);

  const fetchMemberBound = (session: Session, userId: string) =>
    fetchMember(session, userId);
  const resolveUserIdentityBound = (session: Session, input: string) =>
    resolveUserIdentity(session, input);
  const findMemberByNameBound = (session: Session, name: string) =>
    findMemberByName(session, name, log);
  const fetchGroupMemberIdsBound = (session: Session) =>
    fetchGroupMemberIds(session, log);

  const commandDeps = {
    ctx,
    config,
    log,
    store,
    cache,
    renders,
    fetchMember: fetchMemberBound,
    resolveUserIdentity: resolveUserIdentityBound,
    findMemberByName: findMemberByNameBound,
    fetchGroupMemberIds: fetchGroupMemberIdsBound,
    resolveGroupId,
    stripAtPrefix,
  };

  registerRankCommand(commandDeps);
  registerInspectCommand(commandDeps);
  registerAdjustCommand(commandDeps);
  registerBlacklistCommand({
    ...commandDeps,
    blacklist,
  });
  registerBlockCommand({ ...commandDeps, blacklist });
  registerTempBlockCommand({ ...commandDeps, blacklist });
  registerClearAllCommand(commandDeps);

  const initializeServices = async () => {
    log("info", "插件初始化开始...");

    try {
      await manualRelationship.syncToDatabase();
    } catch (error) {
      log("warn", "同步特殊关系配置到数据库失败", error);
    }

    const chatlunaService = (
      ctx as unknown as {
        chatluna?: {
          createChatModel?: (model: string) => Promise<unknown>;
          config?: { defaultModel?: string };
          promptRenderer?: {
            registerFunctionProvider?: (
              name: string,
              provider: unknown,
            ) => void;
          };
        };
      }
    ).chatluna;

    const promptRenderer = chatlunaService?.promptRenderer;

    const affinityProvider = createAffinityProvider({
      config,
      cache,
      store,
      fetchEntries: history.fetchEntries.bind(history),
    });
    promptRenderer?.registerFunctionProvider?.(
      config.variableSettings.affinityVariableName,
      affinityProvider,
    );
    log(
      "info",
      `好感度变量已注册: ${config.variableSettings.affinityVariableName}`,
    );

    const relationshipLevelName = String(
      config.variableSettings.relationshipAffinityLevelVariableName ||
        "relationshipAffinityLevel",
    ).trim();
    if (relationshipLevelName) {
      const relationshipLevelProvider = createRelationshipLevelProvider({
        store,
        config,
      });
      promptRenderer?.registerFunctionProvider?.(
        relationshipLevelName,
        relationshipLevelProvider,
      );
      log("info", `好感度区间变量已注册: ${relationshipLevelName}`);
    }

    const blacklistListName = String(
      config.variableSettings.blacklistListVariableName || "blacklistList",
    ).trim();
    if (blacklistListName) {
      const blacklistListProvider = createBlacklistListProvider({
        store,
        blacklist,
      });
      promptRenderer?.registerFunctionProvider?.(
        blacklistListName,
        blacklistListProvider,
      );
      log("info", `黑名单列表变量已注册: ${blacklistListName}`);
    }

    const userAliasName = String(
      config.variableSettings.userAliasVariableName || "userAlias",
    ).trim();
    if (userAliasName) {
      const userAliasProvider = createUserAliasProvider({
        userAlias,
      });
      promptRenderer?.registerFunctionProvider?.(
        userAliasName,
        userAliasProvider,
      );
      log("info", `用户自定义昵称变量已注册: ${userAliasName}`);
    }

    const toolDeps = {
      config,
      store,
      cache,
      blacklist,
      clamp: store.clamp,
      resolveLevelByAffinity: levelResolver.resolveLevelByAffinity,
      resolveLevelByRelation: levelResolver.resolveLevelByRelation,
      resolveUserIdentity: resolveUserIdentityBound,
    };

    if (config.nativeToolSettings.registerRelationshipTool) {
      const toolName = String(
        config.nativeToolSettings.relationshipToolName || "relationship",
      ).trim();
      plugin.registerTool(toolName, {
        selector: () => true,
        createTool: () => createRelationshipTool(toolDeps),
      });
      log("info", `关系工具已注册: ${toolName}`);
    }

    if (config.nativeToolSettings.registerBlacklistTool) {
      const toolName = String(
        config.nativeToolSettings.blacklistToolName || "blacklist",
      ).trim();
      plugin.registerTool(toolName, {
        selector: () => true,
        createTool: () => createBlacklistTool(toolDeps),
      });
      log("info", `黑名单工具已注册: ${toolName}`);
    }

    log("info", "插件初始化完成");
  };

  if (ctx.root.lifecycle.isActive) {
    initializeServices();
  } else {
    ctx.on("ready", initializeServices);
  }
}
