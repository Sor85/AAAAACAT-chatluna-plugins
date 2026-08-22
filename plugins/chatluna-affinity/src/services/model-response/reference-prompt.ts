/**
 * Character 系统提示词注入
 * 分别注册 XML 参考提示词与好感度机制说明，两者互不依赖
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

export function buildAffinityMechanismPrompt(config: Config): string {
  const dynamics = config.affinityDynamics || {};
  const shortTermDisabled = dynamics.disableShortTermAffinity === true;
  const coefficientDisabled = dynamics.disableAffinityCoefficient === true;
  const shortTerm = dynamics.shortTerm || {};
  const coefficient = dynamics.coefficient || {};
  const rules = shortTermDisabled
    ? [
        "Affinity changes are applied directly to long-term affinity; short-term affinity is not used.",
      ]
    : [
        `Affinity changes first accumulate in short-term affinity. When it reaches the threshold (increase: ${shortTerm.promoteThreshold ?? 15}, decrease: ${Math.abs(shortTerm.demoteThreshold ?? -10)}), it is converted into long-term affinity by the configured step.`,
      ];
  if (!coefficientDisabled) {
    rules.push(
      `Long-term affinity is multiplied by the current coefficient (base coefficient: ${coefficient.base ?? 1}) to produce the displayed affinity.`,
    );
  }
  const content =
    shortTermDisabled && coefficientDisabled
      ? "Affinity changes are applied directly to long-term affinity, and the displayed affinity is the long-term affinity."
      : rules.join(" ");
  return `<available_affinity_mechanism>\n${content}\n</available_affinity_mechanism>`;
}

interface RegisterPromptDeps {
  ctx: Context;
  config: Config;
  log?: LogFn;
}

function registerSystemPrompt(
  deps: RegisterPromptDeps,
  prompt: string,
  failureMessage: string,
  successMessage: string,
): (() => void) | null {
  if (!prompt) return null;

  const chatlunaService = (deps.ctx as unknown as {
    chatluna?: ChatLunaServiceLike;
  }).chatluna;
  const contextManager = chatlunaService?.contextManager;
  if (!contextManager?.pipeline) {
    deps.log?.("warn", failureMessage);
    return null;
  }

  const dispose = contextManager.pipeline(
    "after_system_prompts",
    async (runtime, next) => {
      runtime.result.push(new SystemMessage(prompt));
      runtime.usedTokens += await runtime.tokenCounter(prompt);
      await next();
    },
    0,
  );
  deps.log?.("info", successMessage);
  return dispose;
}

export interface RegisterCharacterPromptInjectionDeps extends RegisterPromptDeps {
  replaceScopeId?: boolean;
}

export function registerCharacterPromptInjection(
  deps: RegisterCharacterPromptInjectionDeps,
): (() => void) | null {
  const { config, replaceScopeId = false, log } = deps;
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

  return registerSystemPrompt(
    deps,
    prompt,
    "Character XML 参考提示词自动注入失败：ChatLuna 上下文管理器不可用",
    `Character XML 参考提示词自动注入已启用: ${config.scopeId}`,
  );
}

export function registerAffinityMechanismPromptInjection(
  deps: RegisterPromptDeps,
): (() => void) | null {
  if (deps.config.autoInjectAffinityMechanismPrompt === false) return null;

  return registerSystemPrompt(
    deps,
    buildAffinityMechanismPrompt(deps.config),
    "好感度机制提示词自动注入失败：ChatLuna 上下文管理器不可用",
    `好感度机制提示词自动注入已启用: ${deps.config.scopeId}`,
  );
}
