/**
 * Gemini Google Search 工具
 * 将搜索查询封装为 ChatLuna 可调用工具
 */
import { Tool } from "@langchain/core/tools";
import type { Context, Logger } from "koishi";
import type { Config } from "../config";
import { getChatModel, invokeWithTimeout } from "../model";
import { validateQuery } from "../security/validate";

function renderGoogleSearchPrompt(template: string, query: string): string {
  return template.replaceAll("{{query}}", query);
}

function getLogger(ctx: Context): Logger | undefined {
  const logger = Reflect.get(ctx as object, "logger");
  if (typeof logger === "function") {
    return logger.call(ctx, "chatluna-gemini-tools") as Logger;
  }
  return undefined;
}

function debugLog(ctx: Context, config: Config, message: string): void {
  if (!config.debug) {
    return;
  }
  getLogger(ctx)?.info(message);
}

export class GeminiGoogleSearchTool extends Tool {
  name: string;

  description: string;

  constructor(
    private readonly ctx: Context,
    private readonly config: Config,
  ) {
    super();
    this.name = config.googleSearchToolName;
    this.description = config.googleSearchDescription;
  }

  async _call(input: string): Promise<string> {
    const safeQuery = validateQuery(input, this.config.maxQueryLength);
    debugLog(
      this.ctx,
      this.config,
      `google_search start tool=${this.name} model=${this.config.toolModel} queryLength=${safeQuery.length}`,
    );
    const model = await getChatModel(this.ctx, this.config);
    const prompt = renderGoogleSearchPrompt(
      this.config.googleSearchPrompt,
      safeQuery,
    );
    const result = await invokeWithTimeout(
      this.ctx,
      this.config,
      model,
      prompt,
      this.config.requestTimeoutMs,
    );
    debugLog(
      this.ctx,
      this.config,
      `google_search success tool=${this.name} resultLength=${result.length}`,
    );
    return result;
  }
}

export function createGoogleSearchTool(ctx: Context, config: Config): Tool {
  return new GeminiGoogleSearchTool(ctx, config);
}
