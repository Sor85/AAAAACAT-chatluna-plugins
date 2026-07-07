import { StructuredTool } from "@langchain/core/tools";
import type { Context, Session } from "koishi";
import { z } from "zod";
import type { Config, LogFn, NativeToolKey } from "../../types";
import { applyAffinityDelta } from "../affinity/apply-delta";
import type { ModelResponseProcessorParams } from "../model-response";
import {
  DEFAULT_AFFINITY_NATIVE_TOOL_DESCRIPTION,
  DEFAULT_BLACKLIST_NATIVE_TOOL_DESCRIPTION,
  DEFAULT_RELATIONSHIP_NATIVE_TOOL_DESCRIPTION,
  DEFAULT_USER_ALIAS_NATIVE_TOOL_DESCRIPTION,
} from "./defaults";

interface ToolDefaultAvailability {
  enabled: true;
  main: true;
  chatluna: true;
  characterScope: "all";
}

interface NativeToolMeta {
  source: "extension";
  group: string;
  tags: string[];
  defaultAvailability: ToolDefaultAvailability;
}

export interface NativeToolRegistration {
  selector: () => boolean;
  authorization: () => boolean;
  description: string;
  createTool: () => unknown;
  meta: NativeToolMeta;
}

export interface RegisterNativeToolsDeps
  extends Pick<
    ModelResponseProcessorParams,
    | "config"
    | "cache"
    | "store"
    | "blacklist"
    | "unblockPermanent"
    | "userAlias"
    | "shortTermConfig"
    | "actionWindowConfig"
    | "coefficientConfig"
  > {
  ctx: Context;
  plugin: {
    registerTool: (name: string, tool: NativeToolRegistration) => void;
  };
  log?: LogFn;
}

interface ToolRunnable {
  configurable?: { session?: Session };
}

const NATIVE_TOOL_DEFAULT_AVAILABILITY: ToolDefaultAvailability = {
  enabled: true,
  main: true,
  chatluna: true,
  characterScope: "all",
};

function createNativeToolMeta(tags: string[]): NativeToolMeta {
  return {
    source: "extension",
    group: "affinity",
    tags,
    defaultAvailability: NATIVE_TOOL_DEFAULT_AVAILABILITY,
  };
}

function getSession(runnable: unknown): Session | null {
  return (runnable as ToolRunnable)?.configurable?.session || null;
}

function resolvePlatform(session: Session | null): string {
  return String(session?.platform || "onebot").trim() || "onebot";
}

function resolveToolName(value: string, fallback: string): string {
  return value.trim() || fallback;
}

function resolveToolDescription(value: string, fallback: string): string {
  return value.trim() || fallback;
}

function isNativeToolEnabled(config: Config, toolKey: NativeToolKey): boolean {
  return Boolean(config.nativeToolSettings.enabledNativeTools?.includes(toolKey));
}

export function registerNativeTools(deps: RegisterNativeToolsDeps): void {
  const {
    config,
    cache,
    store,
    blacklist,
    unblockPermanent,
    userAlias,
    shortTermConfig,
    actionWindowConfig,
    coefficientConfig,
    plugin,
    log,
  } = deps;
  const scopeId = config.scopeId;

  if (isNativeToolEnabled(config, "affinity") && config.affinityEnabled) {
    const toolName = resolveToolName(
      config.nativeToolSettings.affinity.toolName,
      "affinity_affinity",
    );
    const description = resolveToolDescription(
      config.nativeToolSettings.affinity.description,
      DEFAULT_AFFINITY_NATIVE_TOOL_DESCRIPTION,
    );
    plugin.registerTool(toolName, {
      selector: () => true,
      authorization: () => true,
      description,
      createTool: () =>
        new (class extends StructuredTool {
          name = toolName;
          description = description;
          schema = z.object({
            userId: z.string().min(1, "userId is required"),
            action: z.enum(["increase", "decrease"]),
            delta: z.number().positive("delta must be positive"),
          });

          async _call(
            input: {
              userId: string;
              action: "increase" | "decrease";
              delta: number;
            },
            _manager?: unknown,
            runnable?: unknown,
          ) {
            const session = getSession(runnable);
            const platform = resolvePlatform(session);
            await applyAffinityDelta({
              seed: {
                scopeId,
                platform,
                userId: input.userId,
                session: session || undefined,
              },
              userId: input.userId,
              delta: input.delta,
              action: input.action,
              store: {
                ensureForSeed: store.ensureForSeed,
                save: store.save,
                clamp: store.clamp,
              },
              maxActionEntries: actionWindowConfig.maxEntries,
              shortTermConfig,
              coefficientConfig,
              log,
            });
            cache.clear(scopeId, input.userId);
            const sign = input.action === "increase" ? "+" : "-";
            return `已调整 ${input.userId} 的好感度：${sign}${input.delta}`;
          }
        })(),
      meta: createNativeToolMeta(["affinity"]),
    });
    log?.("info", `好感度原生工具已注册: ${toolName}`);
  }

  if (isNativeToolEnabled(config, "blacklist")) {
    const toolName = resolveToolName(
      config.nativeToolSettings.blacklist.toolName,
      "affinity_blacklist",
    );
    const description = resolveToolDescription(
      config.nativeToolSettings.blacklist.description,
      DEFAULT_BLACKLIST_NATIVE_TOOL_DESCRIPTION,
    );
    plugin.registerTool(toolName, {
      selector: () => true,
      authorization: () => true,
      description,
      createTool: () =>
        new (class extends StructuredTool {
          name = toolName;
          description = description;
          schema = z.object({
            userId: z.string().min(1, "userId is required"),
            action: z.enum(["add", "remove"]),
            mode: z.enum(["permanent", "temporary"]),
            durationHours: z.number().positive().optional(),
            note: z.string().optional(),
          });

          async _call(
            input: {
              userId: string;
              action: "add" | "remove";
              mode: "permanent" | "temporary";
              durationHours?: number;
              note?: string;
            },
            _manager?: unknown,
            runnable?: unknown,
          ) {
            const session = getSession(runnable);
            const platform = resolvePlatform(session);
            const note = input.note?.trim() || "native";

            if (input.action === "remove") {
              if (input.mode === "temporary") {
                await blacklist.removeTemporary(platform, input.userId);
                cache.clear(scopeId, input.userId);
                return `已解除 ${input.userId} 的临时黑名单`;
              }
              const result = await unblockPermanent({
                source: "native",
                platform,
                userId: input.userId,
                seed: { scopeId, platform, userId: input.userId, session: session || undefined },
              });
              return result.removed
                ? `已解除 ${input.userId} 的永久黑名单`
                : `${input.userId} 不在永久黑名单中`;
            }

            if (input.mode === "permanent") {
              const existing = await store.load(scopeId, input.userId);
              await blacklist.recordPermanent(platform, input.userId, {
                note,
                nickname: existing?.nickname || input.userId,
              });
              cache.clear(scopeId, input.userId);
              return `已将 ${input.userId} 加入永久黑名单`;
            }

            if (!input.durationHours) {
              return "添加临时黑名单需要填写 durationHours";
            }
            const penalty = Math.max(
              0,
              Number(config.shortTermBlacklistPenalty ?? 5),
            );
            const existing = await store.load(scopeId, input.userId);
            const entry = await blacklist.recordTemporary(
              platform,
              input.userId,
              input.durationHours,
              penalty,
              {
                note,
                nickname: existing?.nickname || input.userId,
              },
            );
            if (!entry) return `未能将 ${input.userId} 加入临时黑名单`;

            if (existing && penalty > 0) {
              const nextAffinity = store.clamp(
                (existing.longTermAffinity ?? existing.affinity ?? 0) - penalty,
              );
              await store.save(
                { scopeId, platform, userId: input.userId },
                nextAffinity,
                existing.specialRelation || "",
              );
            }
            cache.clear(scopeId, input.userId);
            return `已将 ${input.userId} 加入临时黑名单 ${input.durationHours} 小时`;
          }
        })(),
      meta: createNativeToolMeta(["blacklist"]),
    });
    log?.("info", `黑名单原生工具已注册: ${toolName}`);
  }

  if (isNativeToolEnabled(config, "relationship")) {
    const toolName = resolveToolName(
      config.nativeToolSettings.relationship.toolName,
      "affinity_relationship",
    );
    const description = resolveToolDescription(
      config.nativeToolSettings.relationship.description,
      DEFAULT_RELATIONSHIP_NATIVE_TOOL_DESCRIPTION,
    );
    plugin.registerTool(toolName, {
      selector: () => true,
      authorization: () => true,
      description,
      createTool: () =>
        new (class extends StructuredTool {
          name = toolName;
          description = description;
          schema = z.object({
            userId: z.string().min(1, "userId is required"),
            action: z.enum(["set", "clear"]),
            relation: z.string().optional(),
          });

          async _call(
            input: {
              userId: string;
              action: "set" | "clear";
              relation?: string;
            },
            _manager?: unknown,
            runnable?: unknown,
          ) {
            const relation = input.relation?.trim() || "";
            if (input.action === "set" && !relation) {
              return "设置关系需要填写 relation";
            }
            const platform = resolvePlatform(getSession(runnable));
            await store.save(
              { scopeId, platform, userId: input.userId },
              Number.NaN,
              input.action === "clear" ? "" : relation,
            );
            cache.clear(scopeId, input.userId);
            return input.action === "clear"
              ? `已清空 ${input.userId} 的关系`
              : `已将 ${input.userId} 的关系设置为 ${relation}`;
          }
        })(),
      meta: createNativeToolMeta(["relationship"]),
    });
    log?.("info", `关系原生工具已注册: ${toolName}`);
  }

  if (isNativeToolEnabled(config, "userAlias")) {
    const toolName = resolveToolName(
      config.nativeToolSettings.userAlias.toolName,
      "affinity_user_alias",
    );
    const description = resolveToolDescription(
      config.nativeToolSettings.userAlias.description,
      DEFAULT_USER_ALIAS_NATIVE_TOOL_DESCRIPTION,
    );
    plugin.registerTool(toolName, {
      selector: () => true,
      authorization: () => true,
      description,
      createTool: () =>
        new (class extends StructuredTool {
          name = toolName;
          description = description;
          schema = z.object({
            userId: z.string().min(1, "userId is required"),
            name: z.string().min(1, "name is required"),
          });

          async _call(
            input: { userId: string; name: string },
            _manager?: unknown,
            runnable?: unknown,
          ) {
            const platform = resolvePlatform(getSession(runnable));
            await userAlias.setAlias(platform, input.userId, input.name);
            return `已将 ${input.userId} 的自定义昵称设置为 ${input.name}`;
          }
        })(),
      meta: createNativeToolMeta(["alias"]),
    });
    log?.("info", `自定义昵称原生工具已注册: ${toolName}`);
  }
}
