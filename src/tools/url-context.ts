/**
 * Gemini URL Context 工具
 * 将网页上下文提取封装为 ChatLuna 可调用工具
 */
import { Tool } from "@langchain/core/tools";
import type { Context, Logger } from "koishi";
import type { Config } from "../config";
import { getChatModel, invokeWithTimeout } from "../model";
import { validateQuery, validateUrl } from "../security/validate";

type UrlContextInput = {
  url: string;
  question?: string;
};

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

function parseInput(input: string): UrlContextInput {
  try {
    const parsed = JSON.parse(input) as unknown;

    if (!parsed || typeof parsed !== "object") {
      throw new Error("url_context 输入必须是 JSON 对象");
    }

    const url = Reflect.get(parsed, "url");
    const question = Reflect.get(parsed, "question");

    if (typeof url !== "string" || !url.trim()) {
      throw new Error("url_context 输入缺少合法 url 字段");
    }

    if (question !== undefined && typeof question !== "string") {
      throw new Error("url_context 的 question 字段必须是字符串");
    }

    return {
      url,
      question,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("url_context")) {
      throw error;
    }

    if (input.trim().startsWith("{")) {
      throw new Error(
        'url_context 输入必须是合法 JSON，格式为 {"url":"...","question":"..."}',
      );
    }

    return { url: input };
  }
}

function renderUrlContextPrompt(
  template: string,
  url: string,
  question: string,
): string {
  return template
    .replaceAll("{{url}}", url)
    .replaceAll("{{question}}", question);
}

export class GeminiUrlContextTool extends Tool {
  name: string;

  description: string;

  constructor(
    private readonly ctx: Context,
    private readonly config: Config,
  ) {
    super();
    this.name = config.urlContextToolName;
    this.description = config.urlContextDescription;
  }

  async _call(input: string): Promise<string> {
    const parsed = parseInput(input);
    const safeUrl = validateUrl(parsed.url, this.config.maxUrlLength);
    const safeQuestion = parsed.question
      ? validateQuery(parsed.question, this.config.maxQueryLength)
      : "请总结该页面的核心内容。";
    const urlObject = new URL(safeUrl);
    const parseMode = input.trim().startsWith("{") ? "json" : "raw-url";
    debugLog(
      this.ctx,
      this.config,
      [
        `url_context start tool=${this.name}`,
        `model=${this.config.toolModel}`,
        `parseMode=${parseMode}`,
        `protocol=${urlObject.protocol}`,
        `host=${urlObject.host}`,
        `urlLength=${safeUrl.length}`,
        `hasQuestion=${parsed.question !== undefined}`,
        `questionLength=${safeQuestion.length}`,
        `usedDefaultQuestion=${parsed.question === undefined}`,
      ].join(" "),
    );

    const model = await getChatModel(this.ctx, this.config);
    const prompt = renderUrlContextPrompt(
      this.config.urlContextPrompt,
      safeUrl,
      safeQuestion,
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
      `url_context success tool=${this.name} resultLength=${result.length}`,
    );
    return result;
  }
}

export function createUrlContextTool(ctx: Context, config: Config): Tool {
  return new GeminiUrlContextTool(ctx, config);
}
