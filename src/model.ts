/**
 * 模型获取模块
 * 统一通过 ChatLuna 服务创建模型实例
 */
import type { Context, Logger } from "koishi";
import type { Config } from "./config";

type InvokableModel = {
  invoke: (
    input: string,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown>;
};

type ChatLunaContext = Context & {
  chatluna: {
    createChatModel: (fullModelName: string) => Promise<{ value?: unknown }>;
  };
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

export async function getChatModel(
  ctx: Context,
  config: Config,
): Promise<InvokableModel> {
  if (config.toolModel === "无" || config.toolModel.trim().length < 1) {
    throw new Error(
      "请先在插件配置中选择支持 Google Search 和 URL Context 的模型",
    );
  }

  try {
    debugLog(ctx, config, `create model start model=${config.toolModel}`);
    const ref = await (ctx as ChatLunaContext).chatluna.createChatModel(
      config.toolModel,
    );
    const model = ref?.value;

    if (
      !model ||
      typeof model !== "object" ||
      typeof Reflect.get(model, "invoke") !== "function"
    ) {
      throw new Error(`模型 ${config.toolModel} 不可用`);
    }

    debugLog(ctx, config, `create model success model=${config.toolModel}`);
    return model as InvokableModel;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugLog(ctx, config, `create model failed model=${config.toolModel}`);
    throw new Error(
      `无法通过 ChatLuna 创建模型 ${config.toolModel}: ${message}`,
    );
  }
}

export async function invokeWithTimeout(
  ctx: Context,
  config: Config,
  model: InvokableModel,
  prompt: string,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    debugLog(ctx, config, `invoke start timeoutMs=${timeoutMs}`);
    const result = await model.invoke(prompt, { signal: controller.signal });
    if (typeof result === "string") {
      debugLog(
        ctx,
        config,
        `invoke success resultType=string resultLength=${result.length}`,
      );
      return result;
    }

    if (result && typeof result === "object") {
      const content = Reflect.get(result, "content");
      if (typeof content === "string") {
        debugLog(
          ctx,
          config,
          `invoke success resultType=content-string resultLength=${content.length}`,
        );
        return content;
      }
      if (Array.isArray(content)) {
        const text = content
          .map((item) => {
            if (typeof item === "string") return item;
            if (
              item &&
              typeof item === "object" &&
              typeof Reflect.get(item, "text") === "string"
            ) {
              return String(Reflect.get(item, "text"));
            }
            return "";
          })
          .join("\n");
        debugLog(
          ctx,
          config,
          `invoke success resultType=content-array resultLength=${text.length}`,
        );
        return text;
      }
    }

    const fallback = JSON.stringify(result);
    debugLog(
      ctx,
      config,
      `invoke success resultType=json-fallback resultLength=${fallback.length}`,
    );
    return fallback;
  } catch (error) {
    if (controller.signal.aborted) {
      debugLog(ctx, config, `invoke timeout timeoutMs=${timeoutMs}`);
      throw new Error(`模型调用超时（${timeoutMs}ms）`);
    }
    debugLog(ctx, config, "invoke failed");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
