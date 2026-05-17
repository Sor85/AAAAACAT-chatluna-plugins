/**
 * Koishi 插件管理工具
 * 复用 loader 能力执行 WebUI 同类的重载、停用和移除动作。
 */

import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import type { Context } from "koishi";
import type { LogFn } from "../../../types";
import { DEFAULT_SET_KOISHI_PLUGIN_MANAGER_TOOL_DESCRIPTION } from "../defaults";

export type KoishiPluginManagerAction = "reload" | "restart" | "unload" | "remove";

export interface KoishiPluginManagerToolDeps {
  ctx: Context;
  toolName: string;
  description: string;
  log?: LogFn;
}

export interface KoishiPluginManagerCommandDeps {
  ctx: Context;
  commandAuthority?: number;
  allowedUserIds?: string[];
  log?: LogFn;
}

export interface ManageKoishiPluginParams {
  ctx: Context;
  action: KoishiPluginManagerAction;
  pluginKey: string;
  config?: Record<string, unknown>;
  log?: LogFn;
}

interface LoaderLike {
  entry?: { scope?: ScopeLike };
  reload?: (
    ctx: unknown,
    key: string,
    config: Record<string, unknown>,
  ) => Promise<unknown>;
  unload?: (ctx: unknown, key: string) => void;
  writeConfig?: (silent?: boolean) => Promise<void>;
}

interface ScopeLike {
  ctx: unknown;
  config: Record<string, Record<string, unknown> | undefined>;
}

function renameConfigKey(
  config: ScopeLike["config"],
  oldKey: string,
  newKey: string,
  value: Record<string, unknown>,
): void {
  const keys = Object.keys(config);
  const index = keys.findIndex((key) => key === oldKey || key === `~${oldKey}`);
  const rest = index < 0 ? [] : keys.slice(index + 1);
  delete config[oldKey];
  delete config[`~${oldKey}`];
  const tail: ScopeLike["config"] = {};
  for (const key of rest) {
    tail[key] = config[key];
    delete config[key];
  }
  Object.assign(config, { [newKey]: value }, tail);
}

function resolveRootScope(ctx: Context): { loader: LoaderLike; scope: ScopeLike } {
  const loader = (ctx as unknown as { loader?: LoaderLike }).loader;
  const scope = loader?.entry?.scope;
  if (!loader || !scope) {
    throw new Error("Koishi loader is not available.");
  }
  return { loader, scope };
}

function normalizePluginKey(pluginKey: string): string {
  const key = pluginKey.trim().replace(/^~/, "");
  if (!key) throw new Error("pluginKey is required.");
  return key;
}

function normalizeAction(action: string): KoishiPluginManagerAction {
  const normalized = action.trim().toLowerCase();
  if (
    normalized === "reload" ||
    normalized === "restart" ||
    normalized === "unload" ||
    normalized === "remove"
  ) {
    return normalized;
  }
  throw new Error("action must be one of reload, restart, unload, or remove.");
}

function readPluginConfig(
  scope: ScopeLike,
  key: string,
  override?: Record<string, unknown>,
): Record<string, unknown> {
  if (override) return override;
  return scope.config[key] || scope.config[`~${key}`] || {};
}

function getSessionUserId(session: unknown): string {
  const source = session as
    | {
        userId?: string | number;
        uid?: string | number;
        user?: { id?: string | number; userId?: string | number };
      }
    | undefined;
  return String(
    source?.userId ?? source?.uid ?? source?.user?.id ?? source?.user?.userId ?? "",
  );
}

function getSessionAuthority(session: unknown): number {
  const source = session as
    | { authority?: number; user?: { authority?: number } }
    | undefined;
  return Number(source?.user?.authority ?? source?.authority ?? 0);
}

function isCommandAuthorized(
  session: unknown,
  commandAuthority: number,
  allowedUserIds: string[],
): boolean {
  const userId = getSessionUserId(session);
  if (userId && allowedUserIds.includes(userId)) return true;
  return getSessionAuthority(session) >= commandAuthority;
}

export async function manageKoishiPlugin(
  params: ManageKoishiPluginParams,
): Promise<string> {
  const { loader, scope } = resolveRootScope(params.ctx);
  const key = normalizePluginKey(params.pluginKey);

  if (params.action === "remove") {
    loader.unload?.(scope.ctx, key);
    delete scope.config[key];
    delete scope.config[`~${key}`];
    await loader.writeConfig?.();
    const message = `插件配置已移除：${key}`;
    params.log?.("info", message);
    return message;
  }

  if (params.action === "unload") {
    const config = readPluginConfig(scope, key, params.config);
    loader.unload?.(scope.ctx, key);
    renameConfigKey(scope.config, key, `~${key}`, config);
    await loader.writeConfig?.();
    const message = `插件已停用：${key}`;
    params.log?.("info", message);
    return message;
  }

  const config = readPluginConfig(scope, key, params.config);
  await loader.reload?.(scope.ctx, key, config);
  renameConfigKey(scope.config, key, key, config);
  await loader.writeConfig?.();
  const message = `插件已重载：${key}`;
  params.log?.("info", message);
  return message;
}

export function createKoishiPluginManagerTool(
  deps: KoishiPluginManagerToolDeps,
) {
  const { ctx, toolName, description, log } = deps;

  // @ts-ignore
  return new (class extends StructuredTool {
    name = toolName || "koishi_plugin_manager";
    description =
      description || DEFAULT_SET_KOISHI_PLUGIN_MANAGER_TOOL_DESCRIPTION;
    schema = z.object({
      action: z
        .enum(["reload", "restart", "unload", "remove"])
        .describe(
          "插件动作。reload/restart=重启或启用插件，unload=关闭插件并保留配置，remove=卸载并删除配置。",
        ),
      pluginKey: z
        .string()
        .min(1, "pluginKey is required")
        .describe(
          "koishi.yml 中的插件键名，可带实例后缀，例如 chatluna-toolbox 或 chatluna-toolbox:r0sjxj。",
        ),
      config: z
        .record(z.unknown())
        .optional()
        .describe("reload/restart 或 unload 时可选的替换配置 JSON 对象。"),
    });

    async _call(input: {
      action: KoishiPluginManagerAction;
      pluginKey: string;
      config?: Record<string, unknown>;
    }) {
      try {
        return await manageKoishiPlugin({ ctx, log, ...input });
      } catch (error) {
        log?.("warn", "koishi_plugin_manager failed", error);
        return `koishi_plugin_manager failed: ${(error as Error).message}`;
      }
    }
  })();
}

export function registerKoishiPluginManagerCommand(
  deps: KoishiPluginManagerCommandDeps,
): void {
  const { ctx, log } = deps;
  const commandAuthority = deps.commandAuthority ?? 4;
  const allowedUserIds = (deps.allowedUserIds ?? [])
    .map((id) => String(id).trim())
    .filter(Boolean);
  const usage =
    "用法：toolbox.plugin <reload|restart|unload|remove> <pluginKey>";
  if (typeof ctx.command !== "function") return;

  ctx
    .command("toolbox.plugin <action> <pluginKey>", "管理 Koishi 插件", {
      authority: 0,
    })
    .alias("ctoolbox.plugin")
    .option("config", "-c <json:string> reload/unload 时使用的替换配置 JSON")
    .action(async ({ options, session }, action?: string, pluginKey?: string) => {
      if (!isCommandAuthorized(session, commandAuthority, allowedUserIds)) {
        return `权限不足：需要权限等级 ${commandAuthority} 或在允许的用户列表中。`;
      }
      if (!action || !pluginKey) return usage;

      try {
        const config =
          typeof options?.config === "string" && options.config.trim()
            ? (JSON.parse(options.config) as Record<string, unknown>)
            : undefined;
        return await manageKoishiPlugin({
          ctx,
          action: normalizeAction(action),
          pluginKey,
          config,
          log,
        });
      } catch (error) {
        log?.("warn", "toolbox.plugin failed", error);
        return `toolbox.plugin failed: ${(error as Error).message}`;
      }
    });

  log?.("info", "Koishi 插件管理指令已注册: toolbox.plugin");
}
