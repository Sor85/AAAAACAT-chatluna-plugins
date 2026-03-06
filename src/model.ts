/**
 * 模型获取模块
 * 统一通过 ChatLuna 服务创建模型实例
 */
import type { Context } from "koishi";
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

    return model as InvokableModel;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `无法通过 ChatLuna 创建模型 ${config.toolModel}: ${message}`,
    );
  }
}

export async function invokeWithTimeout(
  model: InvokableModel,
  prompt: string,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await model.invoke(prompt, { signal: controller.signal });
    if (typeof result === "string") return result;

    if (result && typeof result === "object") {
      const content = Reflect.get(result, "content");
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content
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
      }
    }

    return JSON.stringify(result);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`模型调用超时（${timeoutMs}ms）`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
