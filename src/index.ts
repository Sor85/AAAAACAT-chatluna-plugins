/**
 * 插件入口
 * 注册 Gemini Google Search 与 URL Context 到 ChatLuna 工具系统
 */
import type {} from "koishi-plugin-chatluna/services/chat";
import type { ChatLunaTool } from "koishi-plugin-chatluna/llm-core/platform/types";
import { modelSchema } from "koishi-plugin-chatluna/utils/schema";
import { ChatLunaPlugin } from "koishi-plugin-chatluna/services/chat";
import type { Context } from "koishi";
import { Config } from "./config";
import { createGoogleSearchTool } from "./tools/google-search";
import { createUrlContextTool } from "./tools/url-context";

export { Config };
export type { Config as PluginConfig } from "./config";

export const name = "chatluna-gemini-tools";
export const inject = ["chatluna"];

export function isToolRegistrationEnabled(config: Config): boolean {
  return (
    config.registerTools &&
    config.toolModel.trim().length > 0 &&
    config.toolModel !== "无"
  );
}

function buildGoogleSearchRegistration(
  ctx: Context,
  config: Config,
): ChatLunaTool {
  return {
    selector() {
      return isToolRegistrationEnabled(config);
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
      return isToolRegistrationEnabled(config);
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
    if (!isToolRegistrationEnabled(config)) {
      return;
    }

    plugin.registerTool(
      config.googleSearchToolName,
      buildGoogleSearchRegistration(ctx, config),
    );
    plugin.registerTool(
      config.urlContextToolName,
      buildUrlContextRegistration(ctx, config),
    );
  });
}
