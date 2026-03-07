/**
 * 插件入口
 * 注册 Gemini Google Search 与 URL Context 到 ChatLuna 工具系统
 */
import type {} from "koishi-plugin-chatluna/services/chat";
import type { ChatLunaTool } from "koishi-plugin-chatluna/llm-core/platform/types";
import { modelSchema } from "koishi-plugin-chatluna/utils/schema";
import { ChatLunaPlugin } from "koishi-plugin-chatluna/services/chat";
import type { Context, Logger } from "koishi";
import { Config } from "./config";
import { createGoogleSearchTool } from "./tools/google-search";
import { createUrlContextTool } from "./tools/url-context";

export { Config };
export type { Config as PluginConfig } from "./config";

export const name = "chatluna-gemini-tools";
export const inject = ["chatluna"];

function getLogger(ctx: Context): Logger | undefined {
  const logger = Reflect.get(ctx as object, "logger");
  if (typeof logger === "function") {
    return logger.call(ctx, name) as Logger;
  }
  return undefined;
}

function debugLog(ctx: Context, config: Config, message: string): void {
  if (!config.debug) {
    return;
  }
  getLogger(ctx)?.info(message);
}

export function isToolRegistrationEnabled(config: Config): boolean {
  return config.toolModel.trim().length > 0 && config.toolModel !== "无";
}

export function isGoogleSearchToolEnabled(config: Config): boolean {
  return isToolRegistrationEnabled(config) && config.enableGoogleSearchTool;
}

export function isUrlContextToolEnabled(config: Config): boolean {
  return isToolRegistrationEnabled(config) && config.enableUrlContextTool;
}

function buildGoogleSearchRegistration(
  ctx: Context,
  config: Config,
): ChatLunaTool {
  return {
    selector() {
      return isGoogleSearchToolEnabled(config);
    },
    authorization() {
      return true;
    },
    createTool() {
      return createGoogleSearchTool(ctx, config);
    },
  };
}

function buildUrlContextRegistration(
  ctx: Context,
  config: Config,
): ChatLunaTool {
  return {
    selector() {
      return isUrlContextToolEnabled(config);
    },
    authorization() {
      return true;
    },
    createTool() {
      return createUrlContextTool(ctx, config);
    },
  };
}

export function apply(ctx: Context, config: Config): void {
  modelSchema(ctx);

  const plugin = new ChatLunaPlugin(
    ctx,
    {
      configMode: "default",
      maxRetries: 3,
      proxyMode: "system",
      proxyAddress: "",
    },
    name,
    false,
  );

  ctx.on("ready", async () => {
    const registrationEnabled = isToolRegistrationEnabled(config);
    debugLog(
      ctx,
      config,
      [
        `ready: toolModelConfigured=${registrationEnabled}`,
        `enableGoogleSearchTool=${config.enableGoogleSearchTool}`,
        `enableUrlContextTool=${config.enableUrlContextTool}`,
      ].join(" "),
    );

    if (isGoogleSearchToolEnabled(config)) {
      plugin.registerTool(
        config.googleSearchToolName,
        buildGoogleSearchRegistration(ctx, config),
      );
      debugLog(ctx, config, `registered tool ${config.googleSearchToolName}`);
    } else {
      debugLog(ctx, config, `skipped tool ${config.googleSearchToolName}`);
    }

    if (isUrlContextToolEnabled(config)) {
      plugin.registerTool(
        config.urlContextToolName,
        buildUrlContextRegistration(ctx, config),
      );
      debugLog(ctx, config, `registered tool ${config.urlContextToolName}`);
    } else {
      debugLog(ctx, config, `skipped tool ${config.urlContextToolName}`);
    }
  });
}
