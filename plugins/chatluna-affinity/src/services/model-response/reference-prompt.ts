/**
 * Character XML 参考提示词注入
 * 在 ChatLuna 系统提示词阶段追加当前作用域对应的动作说明
 */

import { SystemMessage } from "@langchain/core/messages";
import type { Context } from "koishi";
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

export interface RegisterCharacterPromptInjectionDeps {
  ctx: Context;
  config: Config;
  replaceScopeId?: boolean;
  log?: LogFn;
}

export function registerCharacterPromptInjection(
  deps: RegisterCharacterPromptInjectionDeps,
): (() => void) | null {
  const { ctx, config, replaceScopeId = false, log } = deps;
  const settings = config.xmlToolSettings;
  if (!settings.autoInjectReferencePrompt) return null;
  if (settings.injectXmlToolAsReplyTool) {
    log?.(
      "debug",
      "已启用实验性工具调用回复，跳过 Character XML 参考提示词自动注入",
    );
    return null;
  }

  const template = settings.characterPromptTemplate.trim();
  const prompt = replaceScopeId
    ? template.replaceAll("{scopeId}", config.scopeId)
    : template;
  if (!prompt) return null;

  const chatlunaService = (ctx as unknown as { chatluna?: ChatLunaServiceLike })
    .chatluna;
  const contextManager = chatlunaService?.contextManager;
  if (!contextManager?.pipeline) {
    log?.(
      "warn",
      "Character XML 参考提示词自动注入失败：ChatLuna 上下文管理器不可用",
    );
    return null;
  }

  const dispose = contextManager.pipeline(
    "after_system_prompts",
    async (runtime, next) => {
      // 必须作为系统消息注入，避免参考 XML 被 Character 的模型响应处理器误认为待执行动作。
      runtime.result.push(new SystemMessage(prompt));
      runtime.usedTokens += await runtime.tokenCounter(prompt);
      await next();
    },
    0,
  );
  log?.("info", `Character XML 参考提示词自动注入已启用: ${config.scopeId}`);
  return dispose;
}
