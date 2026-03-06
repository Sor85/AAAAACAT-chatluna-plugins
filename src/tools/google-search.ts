/**
 * Gemini Google Search 工具
 * 将搜索查询封装为 ChatLuna 可调用工具
 */
import { Tool } from "@langchain/core/tools";
import type { Context } from "koishi";
import type { Config } from "../config";
import { getChatModel, invokeWithTimeout } from "../model";
import { validateQuery } from "../security/validate";

function renderGoogleSearchPrompt(template: string, query: string): string {
  return template.replaceAll("{{query}}", query);
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
    const model = await getChatModel(this.ctx, this.config);
    const prompt = renderGoogleSearchPrompt(
      this.config.googleSearchPrompt,
      safeQuery,
    );

    return invokeWithTimeout(model, prompt, this.config.requestTimeoutMs);
  }
}

export function createGoogleSearchTool(ctx: Context, config: Config): Tool {
  return new GeminiGoogleSearchTool(ctx, config);
}
