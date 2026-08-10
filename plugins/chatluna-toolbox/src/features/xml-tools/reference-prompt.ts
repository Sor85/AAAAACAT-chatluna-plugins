/**
 * XML 参考提示词注入
 * 在 ChatLuna 系统提示词阶段后追加用户配置的动作说明
 */

import { SystemMessage } from "@langchain/core/messages";
import type { Config, LogFn } from "../../types";

interface PromptContextRuntimeLike {
  result: unknown[];
  usedTokens: number;
  tokenCounter: (text: string) => Promise<number>;
}

interface ContextManagerLike {
  pipeline?: (
    stage: string,
    middleware: (
      runtime: PromptContextRuntimeLike,
      next: () => Promise<void>,
    ) => Promise<void>,
    priority?: number,
  ) => () => void;
}

interface ChatLunaServiceLike {
  contextManager?: ContextManagerLike;
}

export interface RegisterReferencePromptInjectionDeps {
  ctx: import("koishi").Context;
  config: Config;
  log?: LogFn;
}

export function registerReferencePromptInjection(
  deps: RegisterReferencePromptInjectionDeps,
): (() => void) | null {
  const { ctx, config, log } = deps;
  if (!config.autoInjectReferencePrompt) return null;
  if (config.injectXmlToolAsReplyTool) {
    log?.(
      "debug",
      "已启用实验性工具调用回复，跳过 XML 参考提示词自动注入",
    );
    return null;
  }

  const referencePrompt = config.referencePrompt.trim();
  if (!referencePrompt) return null;

  const chatlunaService = (ctx as unknown as { chatluna?: ChatLunaServiceLike })
    .chatluna;
  const contextManager = chatlunaService?.contextManager;
  if (!contextManager?.pipeline) {
    log?.("warn", "XML 参考提示词自动注入失败：ChatLuna 上下文管理器不可用");
    return null;
  }

  const dispose = contextManager.pipeline(
    "after_system_prompts",
    async (runtime, next) => {
      // 参考提示词必须作为系统消息注入；写入用户消息或 completionMessages 会改变语义，甚至被 XML 运行时当作模型输出执行。
      runtime.result.push(new SystemMessage(referencePrompt));
      runtime.usedTokens += await runtime.tokenCounter(referencePrompt);
      await next();
    },
    0,
  );
  log?.("info", "XML 参考提示词自动注入已启用");
  return dispose;
}
